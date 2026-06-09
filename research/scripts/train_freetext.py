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
from ksbio.evaluate import eer_for_subject
from ksbio.artifact import save_artifact, ArtifactMeta


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
    samples, by_subject, labels = [], {}, {}
    for subj, events in data.items():
        for w in sliding_windows(events, size=args.window, stride=args.stride):
            feats, cids = featurize_window(w)
            if subj not in labels:
                labels[subj] = len(labels)
            samples.append((torch.from_numpy(feats), torch.from_numpy(cids),
                            feats.shape[0], labels[subj]))
            by_subject.setdefault(subj, []).append(
                (torch.from_numpy(feats), torch.from_numpy(cids)))

    cfg = TrainConfig(embed_dim=args.embed_dim, epochs=args.epochs, seed=args.seed,
                      batch_subjects=min(16, max(2, len(by_subject))),
                      samples_per_subject=2)
    enc, history = train_encoder(samples, cfg)

    eers = []
    subjects = list(by_subject.keys())
    for target in subjects:
        gen = by_subject[target]
        imp = [w for s in subjects if s != target for w in by_subject[s]]
        if not gen or not imp:
            continue
        try:
            eer, _ = eer_for_subject(enc, [g[0] for g in gen], [g[1] for g in gen],
                                     [i[0] for i in imp], [i[1] for i in imp])
            eers.append(eer)
        except ValueError:
            # too few genuine windows for this subject; skip honestly
            continue
    mean_eer = float(np.mean(eers)) if eers else 1.0

    os.makedirs(os.path.dirname(args.artifact_path) or ".", exist_ok=True)
    meta = ArtifactMeta(version=args.version, embed_dim=args.embed_dim,
                        git_commit=_git_commit(),
                        config={"epochs": args.epochs, "window": args.window,
                                "stride": args.stride, "seed": args.seed},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(args.artifact_path, enc, meta)
    return {"version": args.version, "n_windows": len(samples),
            "n_subjects": len(subjects), "mean_eer": mean_eer,
            "final_loss": history["loss"][-1]}


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
          f"subjects={res['n_subjects']} mean_EER={res['mean_eer']:.4f} "
          f"final_loss={res['final_loss']:.4f}")


if __name__ == "__main__":
    main()
