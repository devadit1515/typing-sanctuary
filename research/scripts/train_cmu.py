"""Phase-1 entrypoint: train the encoder on CMU, measure EER per held-out
subject, save a versioned artifact. TINY defaults run on CPU; pass big flags for
the full GPU run. Auto-detects real CMU password columns vs. generic dev fixture.

Run (full):  python scripts/train_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv \\
                 --epochs 60 --embed-dim 128 --version cmu-v1 \\
                 --artifact artifacts/cmu-v1.pt
"""
import argparse
import json
import os
import subprocess
import time
from dataclasses import dataclass
import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.data.cmu import load_cmu
from ksbio.cmu_sequences import row_to_sequence
from ksbio.featurize import featurize_window, TIMING_FEATURES, MAX_CHAR_ID
from ksbio.train import train_encoder, TrainConfig
from ksbio.evaluate import embed_sequences, _eer_from_embeddings
from ksbio.artifact import save_artifact, ArtifactMeta

# Published baseline to contextualise our headline number: the scaled-Manhattan
# detector of Killourhy & Maxion (2009), DSN-2009 pp.125-134, EER 0.0962 on the
# same ".tie5Roanl" CMU benchmark. We compare our open-set scaled-Manhattan EER
# to THIS number (apples-to-apples); see CREST_Research_Dossier.md C1.
BASELINE_EER_SCALED_MANHATTAN = 0.0962
BASELINE_SOURCE = "Killourhy & Maxion 2009 (DSN-2009, pp.125-134)"


# Real CMU key labels (as they appear in DSL-StrongPasswordData.csv column names),
# in typed order, paired with the printable chars row_to_sequence expects.
_CMU_KEY_LABELS = ["period", "t", "i", "e", "five", "Shift.r", "o", "a", "n", "l", "Return"]
_CMU_LABEL_TO_CHAR = {"period": ".", "t": "t", "i": "i", "e": "e", "five": "5",
                      "Shift.r": "R", "o": "o", "a": "a", "n": "n", "l": "l",
                      "Return": "\n"}


def remap_cmu_columns(row):
    """Translate a raw CMU CSV row (key-NAME columns like H.period, DD.period.t,
    H.Shift.r, H.Return) into the printable-char column names row_to_sequence
    expects (H.., DD...t, H.R, H.<newline>). Returns a new dict. Non-timing
    columns (subject, sessionIndex, rep) are passed through unchanged so the
    caller can still read row['subject']."""
    out = {}
    labels = _CMU_KEY_LABELS
    # passthrough non-timing fields
    for k in ("subject", "sessionIndex", "rep"):
        if k in row:
            out[k] = row[k]
    for i, lab in enumerate(labels):
        ch = _CMU_LABEL_TO_CHAR[lab]
        # hold: H.<label> -> H.<char>
        if f"H.{lab}" in row:
            out[f"H.{ch}"] = row[f"H.{lab}"]
        # latencies to the next key: DD.<lab>.<next>, UD.<lab>.<next>
        if i < len(labels) - 1:
            nxt = labels[i + 1]
            nch = _CMU_LABEL_TO_CHAR[labels[i + 1]]
            if f"DD.{lab}.{nxt}" in row:
                out[f"DD.{ch}.{nch}"] = row[f"DD.{lab}.{nxt}"]
            if f"UD.{lab}.{nxt}" in row:
                out[f"UD.{ch}.{nch}"] = row[f"UD.{lab}.{nxt}"]
    return out


@dataclass
class Phase1Args:
    csv_path: str
    artifact_path: str
    embed_dim: int = 128
    epochs: int = 60
    seed: int = 42
    version: str = "cmu-v1"


def _git_commit():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:                                # noqa: BLE001
        return "unknown"


def _samples_from_csv(csv_path, seed):
    """Returns (samples, subject_to_windows). samples = list of
    (feats[n,T] tensor, char_ids[n] tensor, length, label_int)."""
    set_global_seed(seed)
    with open(csv_path, newline="") as f:
        header = f.readline()
    use_sequence = "H.period" in header  # real CMU password columns present
    samples, by_subject, labels = [], {}, {}
    if use_sequence:
        import csv as _csv
        with open(csv_path, newline="") as f:
            for row in _csv.DictReader(f):
                subj = row["subject"]
                seq = row_to_sequence(remap_cmu_columns(row))
                feats, cids = featurize_window(seq)
                _add(samples, by_subject, labels, subj, feats, cids)
    else:
        data = load_cmu(csv_path)  # {subj: [n_reps, n_cols]}
        for subj, mat in data.items():
            for rep in mat:
                # treat each rep vector as a single-keystroke "window"
                feats = np.zeros((1, TIMING_FEATURES), dtype=np.float32)
                feats[0, :min(TIMING_FEATURES, rep.shape[0])] = \
                    rep[:TIMING_FEATURES]
                cids = np.ones((1,), dtype=np.int64)
                _add(samples, by_subject, labels,
                     subj, torch.from_numpy(feats), torch.from_numpy(cids))
    return samples, by_subject


def _add(samples, by_subject, labels, subj, feats, cids):
    if subj not in labels:
        labels[subj] = len(labels)
    lab = labels[subj]
    if not torch.is_tensor(feats):
        feats = torch.as_tensor(feats)
    if not torch.is_tensor(cids):
        cids = torch.as_tensor(cids)
    n = feats.shape[0]
    samples.append((feats, cids, n, lab))
    by_subject.setdefault(subj, []).append((feats, cids))


def split_subjects(subjects, seed, test_frac=0.3137):
    """OPEN-SET split: partition subject IDs into train vs held-out test sets,
    seeded and deterministic. The encoder is trained on train-subjects ONLY; EER
    is measured ONLY on test-subjects the encoder never saw. This is the honesty-
    critical change: comparing a CLOSED-set EER (encoder trained on the very
    subjects it is scored on) to a published OPEN-set baseline is not like-for-
    like and is the #1 rejection cause for a biometrics result.

    Default test_frac 0.3137 -> 16 of 51 CMU subjects held out (35 train / 16
    test), a conventional ~2:1 split that leaves enough impostors in the test
    pool for a stable EER. Returns (train_subjects, test_subjects) as lists."""
    rng = np.random.RandomState(seed)
    order = list(subjects)
    rng.shuffle(order)
    n_test = max(1, int(round(len(order) * test_frac)))
    test = sorted(order[:n_test])
    train = sorted(order[n_test:])
    return train, test


def _eval_test_subjects(enc, by_subject, test_subjects):
    """Open-set evaluation, embedding every held-out window EXACTLY ONCE.

    For each test subject: genuine = that subject's windows; impostors = the
    OTHER test subjects' windows (never a train subject, never the subject's own
    enrollment). Both the primary (scaled-Manhattan) and secondary (ensemble) EER
    are computed from the SAME cached embeddings — avoiding the O(N) redundant
    encoder passes the per-call scorers would incur (the same impostor windows
    embedded once per target, twice per metric).

    Returns a dict with per-subject + mean EER for both metrics and the pooled
    genuine/impostor score arrays (primary) for the DET curve."""
    # Embed each test subject's windows once; cache by subject.
    emb = {s: embed_sequences(enc, [w[0] for w in by_subject[s]],
                              [w[1] for w in by_subject[s]])
           for s in test_subjects}

    primary, secondary = [], []
    pooled_gen, pooled_imp = [], []
    for target in test_subjects:
        gen = emb[target]
        imp = np.vstack([emb[s] for s in test_subjects if s != target]) \
            if len(test_subjects) > 1 else np.empty((0, gen.shape[1]))
        if len(gen) == 0 or len(imp) == 0:
            continue
        try:
            eer_p, _, gs, is_ = _eer_from_embeddings(gen, imp, scorer="primary")
            eer_e, _, _, _ = _eer_from_embeddings(gen, imp, scorer="ensemble")
        except ValueError:
            # too few genuine windows to hold out a test set for this subject;
            # skip honestly rather than fabricate an EER (evaluate.py guard).
            continue
        primary.append((target, eer_p))
        secondary.append((target, eer_e))
        pooled_gen.append(gs)
        pooled_imp.append(is_)

    prim = [e for _, e in primary]
    sec = [e for _, e in secondary]
    return {
        "per_subject_primary": primary,
        "per_subject_secondary": secondary,
        "mean_primary": float(np.mean(prim)) if prim else 1.0,
        "mean_secondary": float(np.mean(sec)) if sec else 1.0,
        "n_eer_subjects": len(prim),
        "pooled_gen": np.concatenate(pooled_gen) if pooled_gen else np.array([]),
        "pooled_imp": np.concatenate(pooled_imp) if pooled_imp else np.array([]),
    }


def run_phase1(args: Phase1Args):
    set_global_seed(args.seed)
    samples, by_subject = _samples_from_csv(args.csv_path, args.seed)
    subjects = list(by_subject.keys())

    # --- OPEN-SET split: train on train-subjects, evaluate on held-out subjects.
    # Rebuild training samples directly from the train subjects' windows (with a
    # fresh contiguous label space) rather than filtering `samples` by its opaque
    # int labels — keeps the train set provably free of any test subject.
    train_subjects, test_subjects = split_subjects(subjects, args.seed)
    train_set = set(train_subjects)
    train_samples = []
    label_of = {subj: i for i, subj in enumerate(train_subjects)}
    for subj in train_subjects:
        for feats, cids in by_subject[subj]:
            train_samples.append((feats, cids, feats.shape[0], label_of[subj]))

    cfg = TrainConfig(embed_dim=args.embed_dim, epochs=args.epochs,
                      seed=args.seed,
                      batch_subjects=min(16, max(2, len(train_subjects))),
                      samples_per_subject=2)
    enc, history = train_encoder(train_samples, cfg)

    # Leakage guard: NO test subject may appear in the training label space.
    assert not (set(test_subjects) & train_set), \
        "open-set violation: a test subject leaked into the training set"

    ev = _eval_test_subjects(enc, by_subject, test_subjects)

    os.makedirs(os.path.dirname(args.artifact_path) or ".", exist_ok=True)
    meta = ArtifactMeta(version=args.version, embed_dim=args.embed_dim,
                        git_commit=_git_commit(),
                        config={"epochs": args.epochs, "seed": args.seed,
                                "n_train_subjects": len(train_subjects),
                                "n_test_subjects": len(test_subjects)},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(args.artifact_path, enc, meta)
    return {
        "version": args.version,
        "n_subjects_total": len(subjects),
        "n_train_subjects": len(train_subjects),
        "n_test_subjects": len(test_subjects),
        "n_eer_subjects": ev["n_eer_subjects"],
        "primary_eer_scaled_manhattan": ev["mean_primary"],
        "secondary_eer_full_ensemble": ev["mean_secondary"],
        "per_subject_eer": [{"subject": s, "eer": e}
                            for s, e in ev["per_subject_primary"]],
        "final_loss": history["loss"][-1],
        "seed": args.seed,
        "epochs": args.epochs,
        "embed_dim": args.embed_dim,
        "train_subjects": train_subjects,
        "test_subjects": test_subjects,
        # pooled primary score arrays for the DET curve (lists for JSON safety)
        "pooled_gen_scores": ev["pooled_gen"].tolist(),
        "pooled_imp_scores": ev["pooled_imp"].tolist(),
    }


def _dataset_sha256(path):
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def run_multiseed(args: Phase1Args, seeds, metrics_out=None):
    """Run phase 1 over several seeds and aggregate mean±std of the headline EER.
    A single CPU run is one seed; near a published baseline a single point invites
    'is this noise?', and CPU runs are cheap — so we report mean±std over seeds.
    The artifact saved is the FIRST seed's (deterministic, reproducible)."""
    runs = []
    t0 = time.time()
    for i, sd in enumerate(seeds):
        a = Phase1Args(args.csv_path, args.artifact_path, args.embed_dim,
                       args.epochs, sd, args.version)
        res = run_phase1(a)
        runs.append(res)
        print(f"[phase1] seed={sd} "
              f"primary_EER={res['primary_eer_scaled_manhattan']:.4f} "
              f"ensemble_EER={res['secondary_eer_full_ensemble']:.4f} "
              f"({res['n_eer_subjects']}/{res['n_test_subjects']} test subjects)")
    train_seconds = time.time() - t0
    prim = np.array([r["primary_eer_scaled_manhattan"] for r in runs])
    ens = np.array([r["secondary_eer_full_ensemble"] for r in runs])
    first = runs[0]
    metrics = {
        "dataset": "CMU-Killourhy-Maxion-DSL-StrongPasswordData",
        "dataset_sha256": _dataset_sha256(args.csv_path),
        "n_subjects_total": first["n_subjects_total"],
        "n_train_subjects": first["n_train_subjects"],
        "n_test_subjects": first["n_test_subjects"],
        "eval_protocol": "open-set: EER on held-out subjects unseen in training",
        "window_keys": 11,
        "primary_metric": "scaled_manhattan_eer",
        "primary_eer_scaled_manhattan": float(prim.mean()),
        "primary_eer_mean": float(prim.mean()),
        "primary_eer_std": float(prim.std()),
        "n_seeds": len(seeds),
        "seeds": list(seeds),
        "secondary_eer_full_ensemble": float(ens.mean()),
        "secondary_eer_full_ensemble_std": float(ens.std()),
        "baseline_eer_published_scaled_manhattan": BASELINE_EER_SCALED_MANHATTAN,
        "baseline_source": BASELINE_SOURCE,
        "per_subject_eer": first["per_subject_eer"],
        "per_seed_primary_eer": prim.tolist(),
        "per_seed_ensemble_eer": ens.tolist(),
        "embed_dim": args.embed_dim,
        "epochs": args.epochs,
        "seed": seeds[0],
        "git_commit": _git_commit(),
        "device": "cpu",
        "train_seconds": train_seconds,
        "artifact": os.path.basename(args.artifact_path),
        "scores_file": "scores.json",
    }
    if metrics_out:
        out_dir = os.path.dirname(metrics_out) or "."
        os.makedirs(out_dir, exist_ok=True)
        with open(metrics_out, "w") as f:
            json.dump(metrics, f, indent=2)
        # Sidecar: the first seed's pooled primary genuine/impostor scores, so the
        # DET curve (make_figures.py) can be redrawn without retraining.
        with open(os.path.join(out_dir, "scores.json"), "w") as f:
            json.dump({"genuine": first["pooled_gen_scores"],
                       "impostor": first["pooled_imp_scores"],
                       "metric": "scaled_manhattan",
                       "eer": metrics["primary_eer_mean"],
                       "baseline_eer": BASELINE_EER_SCALED_MANHATTAN}, f)
    return metrics


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", dest="csv_path", required=True)
    p.add_argument("--artifact", dest="artifact_path", required=True)
    p.add_argument("--embed-dim", type=int, default=128)
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--seeds", default=None,
                   help="comma-separated seeds for a mean±std run, e.g. 42,43,44")
    p.add_argument("--version", default="cmu-v1")
    p.add_argument("--metrics-out", default=None,
                   help="path to write metrics.json (multi-seed aggregate)")
    a = p.parse_args()
    base = Phase1Args(a.csv_path, a.artifact_path, a.embed_dim, a.epochs,
                      a.seed, a.version)
    if a.seeds:
        seeds = [int(s) for s in a.seeds.split(",") if s.strip()]
        m = run_multiseed(base, seeds, metrics_out=a.metrics_out)
        print(f"[phase1] OPEN-SET primary scaled-Manhattan EER = "
              f"{m['primary_eer_mean']:.4f} ± {m['primary_eer_std']:.4f} "
              f"(mean of {m['n_seeds']} seeds, {m['n_test_subjects']} held-out "
              f"subjects) vs baseline {m['baseline_eer_published_scaled_manhattan']:.4f}")
        print(f"[phase1] secondary ensemble EER = "
              f"{m['secondary_eer_full_ensemble']:.4f}")
    else:
        res = run_phase1(base)
        if a.metrics_out:
            run_multiseed(base, [a.seed], metrics_out=a.metrics_out)
        print(f"[phase1] version={res['version']} "
              f"train/test subjects={res['n_train_subjects']}/{res['n_test_subjects']} "
              f"eer_subjects={res['n_eer_subjects']} "
              f"OPEN-SET primary_EER={res['primary_eer_scaled_manhattan']:.4f} "
              f"ensemble_EER={res['secondary_eer_full_ensemble']:.4f} "
              f"final_loss={res['final_loss']:.4f}")


if __name__ == "__main__":
    main()
