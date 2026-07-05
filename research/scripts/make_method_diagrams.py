"""Generate the Method-section diagrams for the CREST report.

Outputs (300 dpi, print-friendly):
    research/artifacts/method_pipeline.png     - Figure 1: the method end to end
    research/artifacts/verification_logic.png  - Figure 2: the verification decision

Run from the research/ directory:  python scripts/make_method_diagrams.py
"""
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Polygon

OUT = Path(__file__).resolve().parents[1] / "artifacts"
OUT.mkdir(exist_ok=True)

BOX_FACE = "#f2f4f8"
BOX_EDGE = "#5a6b8c"
OK_FACE = "#eef7f0"
OK_EDGE = "#4a8c5c"
FAIL_FACE = "#fdf3e3"
FAIL_EDGE = "#b8862d"
TEXT = "#1f2937"
FS = 8.5


def box(ax, cx, cy, w, h, text, face=BOX_FACE, edge=BOX_EDGE, ls="-", fs=FS):
    ax.add_patch(FancyBboxPatch((cx - w / 2, cy - h / 2), w, h,
                                boxstyle="round,pad=0.012",
                                fc=face, ec=edge, lw=1.3, linestyle=ls))
    ax.text(cx, cy, text, ha="center", va="center", fontsize=fs, color=TEXT)


def diamond(ax, cx, cy, w, h, text, fs=FS):
    ax.add_patch(Polygon([(cx, cy + h / 2), (cx + w / 2, cy),
                          (cx, cy - h / 2), (cx - w / 2, cy)],
                         closed=True, fc="#fbf7ee", ec=BOX_EDGE, lw=1.3))
    ax.text(cx, cy, text, ha="center", va="center", fontsize=fs, color=TEXT)


def arrow(ax, x0, y0, x1, y1, label=None, lx=0.0, ly=0.0):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-|>", color=BOX_EDGE, lw=1.3,
                                shrinkA=2, shrinkB=2))
    if label:
        ax.text((x0 + x1) / 2 + lx, (y0 + y1) / 2 + ly, label,
                fontsize=FS - 0.5, color=TEXT, ha="center", va="center",
                bbox=dict(fc="white", ec="none", pad=1))


def line(ax, x0, y0, x1, y1):
    ax.plot([x0, x1], [y0, y1], color=BOX_EDGE, lw=1.3,
            solid_capstyle="round", zorder=1)


def pipeline():
    fig, ax = plt.subplots(figsize=(12.6, 3.4))
    ax.set_xlim(0, 12.6)
    ax.set_ylim(0, 3.4)
    ax.axis("off")

    y = 2.35
    w, h = 1.86, 1.18
    steps = [
        (1.15, "Typing sample\n11 keystrokes"),
        (3.22, "Features\n4 timings + key\nidentity, per keystroke"),
        (5.29, "Encoder network\nCNN → BiGRU\n→ attention"),
        (7.36, "Fingerprint\n128 numbers"),
        (9.43, "Verifier\n3 distances vs\nenrolled cluster"),
    ]
    for cx, label in steps:
        box(ax, cx, y, w, h, label)
    box(ax, 11.50, y, w, h,
        "Decision\ngenuine, or ask\nanother factor", face=OK_FACE, edge=OK_EDGE)

    xs = [s[0] for s in steps] + [11.50]
    for a, b in zip(xs[:-1], xs[1:]):
        arrow(ax, a + w / 2 + 0.01, y, b - w / 2 - 0.01, y)

    # enrolment store feeding the verifier
    box(ax, 9.43, 0.72, 3.30, 0.78,
        "Enrolled cluster: ~12 samples and a\npersonal threshold, stored at enrolment",
        face="white", ls=(0, (4, 3)), fs=FS - 0.5)
    arrow(ax, 9.43, 1.13, 9.43, y - h / 2 - 0.03)

    fig.savefig(OUT / "method_pipeline.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def verification_logic():
    fig, ax = plt.subplots(figsize=(7.8, 6.6))
    ax.set_xlim(0, 7.8)
    ax.set_ylim(0, 6.6)
    ax.axis("off")

    mx = 2.45          # main column
    fx = 6.30          # fail-safe column
    bw = 3.0

    box(ax, mx, 6.15, bw, 0.55, "New typing sample")
    diamond(ax, mx, 5.15, 3.1, 1.00, "Service and model\nhealthy?")
    box(ax, mx, 4.15, bw, 0.55, "Compute fingerprint\n(128 numbers)")
    box(ax, mx, 3.12, 3.5, 0.80,
        "Three distances to the enrolled cluster:\ncentre · nearest 3 samples · variance-aware")
    box(ax, mx, 2.15, bw, 0.55, "Score = average of the three")
    diamond(ax, mx, 1.10, 3.1, 1.00, "Score within personal\nthreshold?")
    box(ax, mx, 0.28, 2.4, 0.50, "Accept as genuine", face=OK_FACE, edge=OK_EDGE)
    box(ax, fx, 5.15, 2.2, 0.80, "Ask for\nanother factor", face=FAIL_FACE, edge=FAIL_EDGE)

    arrow(ax, mx, 5.87, mx, 5.68)                              # sample -> healthy?
    arrow(ax, mx + 1.55, 5.15, fx - 1.10, 5.15, "no", ly=0.15) # healthy? -no-> fail
    arrow(ax, mx, 4.64, mx, 4.44, "yes", lx=0.30)              # healthy? -yes-> fingerprint
    arrow(ax, mx, 3.87, mx, 3.53)                              # fingerprint -> distances
    arrow(ax, mx, 2.71, mx, 2.44)                              # distances -> score
    arrow(ax, mx, 1.87, mx, 1.62)                              # score -> threshold?
    arrow(ax, mx, 0.59, mx, 0.54, "yes", lx=0.30, ly=0.05)     # threshold? -yes-> accept
    line(ax, mx + 1.55, 1.10, fx, 1.10)                        # threshold? -no-> right
    arrow(ax, fx, 1.10, fx, 4.73, "no", lx=0.24)               # ... then up to fail

    fig.savefig(OUT / "verification_logic.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def architecture():
    fig, ax = plt.subplots(figsize=(11.4, 3.0))
    ax.set_xlim(0, 11.4)
    ax.set_ylim(0, 3.0)
    ax.axis("off")

    y = 1.85
    box(ax, 1.95, y, 3.3, 1.15,
        "Research pipeline\ntrains, evaluates, and\npublishes a versioned model")
    box(ax, 5.85, y, 2.9, 1.15,
        "Inference service\nstateless: fingerprint\nand score only")
    box(ax, 9.55, y, 2.9, 1.15,
        "Product\naccounts, consent,\nenrolments, decisions")

    arrow(ax, 3.62, y, 4.38, y, "versioned\nmodel", ly=-0.52)
    arrow(ax, 8.08, y + 0.18, 7.32, y + 0.18, "sample", ly=0.16)
    arrow(ax, 7.32, y - 0.18, 8.08, y - 0.18, "score", ly=-0.18)

    ax.text(9.55, 0.72,
            "checks the model version on every call;\na mismatch is a failure, and failure asks for another factor",
            ha="center", va="center", fontsize=FS - 0.5, color=TEXT,
            style="italic")

    fig.savefig(OUT / "system_architecture.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def keystroke_anatomy():
    """The four timings the model reads, drawn on two real key presses."""
    fig, ax = plt.subplots(figsize=(9.6, 3.1))
    ax.set_xlim(-0.3, 9.6)
    ax.set_ylim(0, 3.1)
    ax.axis("off")

    # press intervals (arbitrary but realistic proportions)
    k1d, k1u = 0.6, 2.6   # key 1 down / up
    k2d, k2u = 3.4, 6.0   # key 2 down / up
    y1, y2 = 2.30, 1.72
    for (a, b, y, lab) in [(k1d, k1u, y1, "key 1 held"), (k2d, k2u, y2, "key 2 held")]:
        ax.plot([a, b], [y, y], lw=10, color=BOX_EDGE, solid_capstyle="butt", alpha=0.55)
        ax.text(a - 0.15, y, lab, ha="right", va="center", fontsize=FS, color=TEXT)

    def dim(x0, x1, y, label):
        ax.annotate("", xy=(x1, y), xytext=(x0, y),
                    arrowprops=dict(arrowstyle="<|-|>", color="#8a6a30", lw=1.3))
        ax.plot([x0, x0], [y - 0.07, y + 0.07], color="#8a6a30", lw=1)
        ax.plot([x1, x1], [y - 0.07, y + 0.07], color="#8a6a30", lw=1)
        ax.text((x0 + x1) / 2, y - 0.21, label, ha="center", va="top",
                fontsize=FS - 0.5, color=TEXT)

    dim(k1d, k1u, 1.30, "hold  (down 1 → up 1)")
    dim(k1u, k2d, 0.86, "flight  (up 1 → down 2)")
    dim(k1d, k2d, 0.42, "down–down")
    dim(k1u, k2u, 2.86, "up–up")
    ax.annotate("time →", xy=(9.4, 0.06), ha="right", fontsize=FS - 0.5, color=TEXT)

    fig.savefig(OUT / "keystroke_anatomy.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


def per_subject_chart():
    """Per-subject EER bars from the recorded run's metrics artifact."""
    import json
    m = json.loads((OUT / "metrics.json").read_text())
    per = m["per_subject_eer"]  # list of {subject, eer}
    items = sorted(((r["subject"], r["eer"]) for r in per), key=lambda kv: kv[1])
    names = [k for k, _ in items]
    vals = [v * 100 for _, v in items]

    fig, ax = plt.subplots(figsize=(8.6, 4.4))
    ax.barh(range(len(vals)), vals, color=BOX_EDGE, alpha=0.75, height=0.62)
    ax.set_yticks(range(len(names)), names, fontsize=7.5, family="monospace")
    ax.invert_yaxis()
    ax.axvline(m["baseline_eer_published_scaled_manhattan"] * 100, ls=(0, (4, 3)),
               color="#8a6a30", lw=1.4)
    ax.axvline(m["primary_eer_scaled_manhattan"] * 100, color="#b8862d", lw=1.4)
    ax.text(m["baseline_eer_published_scaled_manhattan"] * 100 + 0.3, 0.35,
            "2009 benchmark 9.6%", fontsize=8, color="#8a6a30")
    ax.text(m["primary_eer_scaled_manhattan"] * 100 + 0.3, 1.35,
            "this model, mean 14.2%", fontsize=8, color="#b8862d")
    ax.set_xlabel("equal error rate, %", fontsize=9)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.tick_params(axis="x", labelsize=8)

    fig.savefig(OUT / "per_subject_eer.png", dpi=300, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    pipeline()
    verification_logic()
    architecture()
    keystroke_anatomy()
    per_subject_chart()
    for f in ["method_pipeline", "verification_logic", "system_architecture",
              "keystroke_anatomy", "per_subject_eer"]:
        print("wrote", OUT / (f + ".png"))
