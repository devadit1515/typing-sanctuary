"""Phase-1 entrypoint: train the encoder on CMU, measure EER per held-out
subject, save a versioned artifact. TINY defaults run on CPU; pass big flags for
the full GPU run. Auto-detects real CMU password columns vs. generic dev fixture.

Run (full):  python scripts/train_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv \\
                 --epochs 60 --embed-dim 128 --version cmu-v1 \\
                 --artifact artifacts/cmu-v1.pt
"""
import argparse
import os
import subprocess
from dataclasses import dataclass
import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.data.cmu import load_cmu
from ksbio.cmu_sequences import row_to_sequence
from ksbio.featurize import featurize_window, TIMING_FEATURES, MAX_CHAR_ID
from ksbio.train import train_encoder, TrainConfig
from ksbio.evaluate import eer_for_subject
from ksbio.artifact import save_artifact, ArtifactMeta


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


def run_phase1(args: Phase1Args):
    set_global_seed(args.seed)
    samples, by_subject = _samples_from_csv(args.csv_path, args.seed)
    cfg = TrainConfig(embed_dim=args.embed_dim, epochs=args.epochs,
                      seed=args.seed,
                      batch_subjects=min(16, max(2, len(by_subject))),
                      samples_per_subject=2)
    enc, history = train_encoder(samples, cfg)

    # Per-subject EER: that subject genuine, all others impostor.
    eers = []
    subjects = list(by_subject.keys())
    for target in subjects:
        gen = by_subject[target]
        imp = [w for s in subjects if s != target for w in by_subject[s]]
        if not gen or not imp:
            continue
        gf = [w[0] for w in gen]; gc = [w[1] for w in gen]
        if_ = [w[0] for w in imp]; ic = [w[1] for w in imp]
        try:
            eer, _ = eer_for_subject(enc, gf, gc, if_, ic)
            eers.append(eer)
        except ValueError:
            # too few genuine windows to hold out a test set for this subject;
            # skip it honestly rather than fabricate an EER.
            continue
    mean_eer = float(np.mean(eers)) if eers else 1.0

    os.makedirs(os.path.dirname(args.artifact_path) or ".", exist_ok=True)
    meta = ArtifactMeta(version=args.version, embed_dim=args.embed_dim,
                        git_commit=_git_commit(),
                        config={"epochs": args.epochs, "seed": args.seed},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(args.artifact_path, enc, meta)
    return {"mean_eer": mean_eer, "n_subjects": len(subjects),
            "n_eer_subjects": len(eers),
            "final_loss": history["loss"][-1], "version": args.version}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", dest="csv_path", required=True)
    p.add_argument("--artifact", dest="artifact_path", required=True)
    p.add_argument("--embed-dim", type=int, default=128)
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--version", default="cmu-v1")
    a = p.parse_args()
    res = run_phase1(Phase1Args(a.csv_path, a.artifact_path, a.embed_dim,
                                a.epochs, a.seed, a.version))
    print(f"[phase1] version={res['version']} subjects={res['n_subjects']} "
          f"eer_subjects={res['n_eer_subjects']} "
          f"mean_EER={res['mean_eer']:.4f} final_loss={res['final_loss']:.4f}")


if __name__ == "__main__":
    main()
