"""Phase-2 entrypoint: content-independent model on free-text windows. Same
encoder + triplet trainer + artifact as Phase 1; only the data path differs.
Produces the continuous-guard model the app ships.

Run (full):  python scripts/train_freetext.py --csv data/freetext/corpus.csv \\
                 --epochs 80 --embed-dim 128 --window 40 --stride 20 \\
                 --version freetext-v1 --artifact artifacts/freetext-v1.pt
"""
import argparse
import os
import subprocess
from dataclasses import dataclass
import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.freetext import load_freetext, sliding_windows
from ksbio.featurize import featurize_window, TIMING_FEATURES, MAX_CHAR_ID
from ksbio.train import train_encoder, TrainConfig
from ksbio.artifact import save_artifact, ArtifactMeta
# Reuse the SAME open-set machinery as Phase 1 (train_cmu): train on
# train-subjects only, measure EER on held-out subjects, primary + secondary.
# Free-text had the identical closed-set defect before this.
from train_cmu import split_subjects, _eval_test_subjects


@dataclass
class Phase2Args:
    csv_path: str
    artifact_path: str
    embed_dim: int = 128
    epochs: int = 80
    window: int = 40
    stride: int = 20
    seed: int = 42
    version: str = "freetext-v1"


def _git_commit():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:                                # noqa: BLE001
        return "unknown"


def run_phase2(args: Phase2Args):
    set_global_seed(args.seed)
    data = load_freetext(args.csv_path)
    # Window every subject's free typing first (content-independent: the net sees
    # rhythm over arbitrary text, not the text itself).
    by_subject = {}
    for subj, events in data.items():
        for w in sliding_windows(events, size=args.window, stride=args.stride):
            feats, cids = featurize_window(w)
            by_subject.setdefault(subj, []).append(
                (torch.from_numpy(feats), torch.from_numpy(cids)))
    subjects = list(by_subject.keys())

    # OPEN-SET split: train on train-subjects only, evaluate on held-out subjects.
    train_subjects, test_subjects = split_subjects(subjects, args.seed)
    train_set = set(train_subjects)
    train_samples = []
    label_of = {subj: i for i, subj in enumerate(train_subjects)}
    for subj in train_subjects:
        for feats, cids in by_subject[subj]:
            train_samples.append((feats, cids, feats.shape[0], label_of[subj]))

    cfg = TrainConfig(embed_dim=args.embed_dim, epochs=args.epochs, seed=args.seed,
                      batch_subjects=min(16, max(2, len(train_subjects))),
                      samples_per_subject=2)
    enc, history = train_encoder(train_samples, cfg)
    assert not (set(test_subjects) & train_set), \
        "open-set violation: a test subject leaked into the training set"

    ev = _eval_test_subjects(enc, by_subject, test_subjects)

    os.makedirs(os.path.dirname(args.artifact_path) or ".", exist_ok=True)
    meta = ArtifactMeta(version=args.version, embed_dim=args.embed_dim,
                        git_commit=_git_commit(),
                        config={"epochs": args.epochs, "window": args.window,
                                "stride": args.stride, "seed": args.seed,
                                "n_train_subjects": len(train_subjects),
                                "n_test_subjects": len(test_subjects)},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(args.artifact_path, enc, meta)
    return {"version": args.version,
            "n_windows": sum(len(v) for v in by_subject.values()),
            "n_subjects": len(subjects),
            "n_train_subjects": len(train_subjects),
            "n_test_subjects": len(test_subjects),
            "n_eer_subjects": ev["n_eer_subjects"],
            "primary_eer_scaled_manhattan": ev["mean_primary"],
            "secondary_eer_full_ensemble": ev["mean_secondary"],
            "final_loss": history["loss"][-1],
            "train_subjects": train_subjects, "test_subjects": test_subjects}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", dest="csv_path", required=True)
    p.add_argument("--artifact", dest="artifact_path", required=True)
    p.add_argument("--embed-dim", type=int, default=128)
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--window", type=int, default=40)
    p.add_argument("--stride", type=int, default=20)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--version", default="freetext-v1")
    a = p.parse_args()
    res = run_phase2(Phase2Args(a.csv_path, a.artifact_path, a.embed_dim,
                                a.epochs, a.window, a.stride, a.seed, a.version))
    print(f"[phase2] version={res['version']} windows={res['n_windows']} "
          f"train/test subjects={res['n_train_subjects']}/{res['n_test_subjects']} "
          f"OPEN-SET primary_EER={res['primary_eer_scaled_manhattan']:.4f} "
          f"ensemble_EER={res['secondary_eer_full_ensemble']:.4f} "
          f"final_loss={res['final_loss']:.4f}")


if __name__ == "__main__":
    main()
