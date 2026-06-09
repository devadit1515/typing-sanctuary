"""Generate the publication figures for the Phase-1 CMU result, read from the
artifacts written by train_cmu.py. No retraining: the DET curve reads the cached
score arrays (scores.json), and t-SNE re-embeds the held-out test subjects with
the saved artifact.

Figures (CREST evidence):
  - det_curve.png : FAR vs FRR (log-log), EER point + published 9.6% baseline
                    marked. Criterion 3.1/4.1 — the headline result, visualized.
  - tsne.png      : 2-D t-SNE of held-out-subject embeddings, coloured by
                    subject. Criterion 4.3 — shows the encoder separates the
                    identities of people it never trained on (open-set).

Run:
  PYTHONPATH=. python scripts/make_figures.py \
      --metrics artifacts/metrics.json --csv data/cmu/DSL-StrongPasswordData.csv \
      --artifact artifacts/cmu-v1.pt --out-dir artifacts
"""
import argparse
import json
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")  # headless: write files, never open a window
import matplotlib.pyplot as plt

from ksbio.metrics import far_frr_at_threshold
from ksbio.artifact import load_artifact
from ksbio.evaluate import embed_sequences
from train_cmu import _samples_from_csv, split_subjects


def det_curve(scores_path, out_path):
    """Plot FAR vs FRR across thresholds from cached genuine/impostor scores."""
    with open(scores_path) as f:
        sc = json.load(f)
    gen = np.asarray(sc["genuine"], float)
    imp = np.asarray(sc["impostor"], float)
    eer = sc.get("eer")
    baseline = sc.get("baseline_eer")

    cand = np.unique(np.concatenate([gen, imp]))
    thresholds = np.concatenate([[cand.min() - 1e-6], cand, [cand.max() + 1e-6]])
    fars, frrs = [], []
    for t in thresholds:
        far, frr = far_frr_at_threshold(gen, imp, t)
        fars.append(far); frrs.append(frr)
    fars, frrs = np.array(fars), np.array(frrs)

    fig, ax = plt.subplots(figsize=(5.5, 5.0))
    ax.plot(fars * 100, frrs * 100, "-", color="#1f77b4", lw=2,
            label="Our model (scaled-Manhattan, open-set)")
    # EER reference line (FAR == FRR) and our operating point.
    lim = max(1.0, float(np.max([fars.max(), frrs.max()]) * 100))
    ax.plot([0, lim], [0, lim], "--", color="#999", lw=1, label="EER line (FAR=FRR)")
    if eer is not None:
        ax.scatter([eer * 100], [eer * 100], color="#1f77b4", zorder=5,
                   s=60, label=f"Our EER = {eer*100:.1f}%")
    if baseline is not None:
        ax.scatter([baseline * 100], [baseline * 100], color="#d62728", marker="x",
                   zorder=5, s=80,
                   label=f"Published baseline = {baseline*100:.1f}%")
    ax.set_xlabel("False Accept Rate (%)")
    ax.set_ylabel("False Reject Rate (%)")
    ax.set_title("DET curve — open-set keystroke verification (CMU)")
    ax.set_xlim(0, lim); ax.set_ylim(0, lim)
    ax.grid(True, alpha=0.3)
    ax.legend(fontsize=8, loc="upper right")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    return out_path


def tsne_plot(csv_path, artifact_path, seed, out_path, max_per_subject=40):
    """t-SNE of the held-out test subjects' embeddings, coloured by subject.
    Re-derives the SAME open-set split train_cmu.py used (deterministic from
    seed), embeds those subjects' windows with the saved artifact, projects to 2-D."""
    from sklearn.manifold import TSNE
    enc, meta = load_artifact(artifact_path)
    _, by_subject = _samples_from_csv(csv_path, seed)
    _, test_subjects = split_subjects(list(by_subject.keys()), seed)

    X, labels = [], []
    for s in test_subjects:
        wins = by_subject[s][:max_per_subject]
        emb = embed_sequences(enc, [w[0] for w in wins], [w[1] for w in wins])
        X.append(emb); labels += [s] * len(emb)
    X = np.vstack(X)
    perplexity = max(5, min(30, (len(X) - 1) // 3))
    proj = TSNE(n_components=2, perplexity=perplexity, init="pca",
                random_state=seed).fit_transform(X)

    uniq = sorted(set(labels))
    cmap = matplotlib.colormaps["tab20"].resampled(len(uniq))
    idx = {s: i for i, s in enumerate(uniq)}
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    colors = [cmap(idx[l]) for l in labels]
    ax.scatter(proj[:, 0], proj[:, 1], c=colors, s=14, alpha=0.8)
    ax.set_title(f"t-SNE of {len(uniq)} held-out subjects' typing embeddings\n"
                 f"(open-set: never seen in training)")
    ax.set_xticks([]); ax.set_yticks([])
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    return out_path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--metrics", default="artifacts/metrics.json")
    p.add_argument("--scores", default=None,
                   help="defaults to scores.json next to --metrics")
    p.add_argument("--csv", default="data/cmu/DSL-StrongPasswordData.csv")
    p.add_argument("--artifact", default="artifacts/cmu-v1.pt")
    p.add_argument("--out-dir", default="artifacts")
    p.add_argument("--seed", type=int, default=None,
                   help="open-set split seed; defaults to metrics.json seed")
    p.add_argument("--skip-tsne", action="store_true")
    a = p.parse_args()

    os.makedirs(a.out_dir, exist_ok=True)
    metrics = json.load(open(a.metrics))
    scores = a.scores or os.path.join(os.path.dirname(a.metrics) or ".",
                                      metrics.get("scores_file", "scores.json"))
    seed = a.seed if a.seed is not None else metrics.get("seed", 42)

    det = det_curve(scores, os.path.join(a.out_dir, "det_curve.png"))
    print(f"wrote {det}")
    if not a.skip_tsne:
        ts = tsne_plot(a.csv, a.artifact, seed,
                       os.path.join(a.out_dir, "tsne.png"))
        print(f"wrote {ts}")


if __name__ == "__main__":
    main()
