# Keystroke Biometrics — Research Harness

Reproducible training + evaluation. Always call `set_global_seed` first.

## Setup
    cd research
    python -m venv .venv
    # Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
    pip install -r requirements.txt

## Run tests
    python -m pytest tests/ -v

## Phase 1 — CMU fixed-password benchmark (the headline result)

The headline scientific result: an **open-set** keystroke-verification EER on the
CMU Killourhy-Maxion `.tie5Roanl` benchmark, compared to the published
scaled-Manhattan baseline (**EER 0.0962**, Killourhy & Maxion 2009 — see
`../CREST_Research_Dossier.md` §C1).

**Evaluation protocol (honest, open-set).** The 51 subjects are split 35 train /
16 held-out test (seeded). The encoder trains on train-subjects ONLY; EER is
measured ONLY on held-out subjects it never saw — so the number is comparable to
the published open-set baseline, not a closed-set (leakage) number. Two metrics:
- **primary** = scaled-Manhattan EER (apples-to-apples with the baseline);
- **secondary** = the full production ensemble (L1 + k-NN + Ledoit-Wolf
  Mahalanobis), byte-identical to `ml-service/app/verify.py`.

**One-command reproduce** (CPU, ~25 min, $0):

    cd research
    pwsh -File scripts/reproduce.ps1     # verify SHA -> train(3 seeds) -> assert EER -> figures -> tests

**Manual run:**

    python scripts/download_cmu.py                       # fetch + print SHA (first time)
    set PYTHONPATH=.                                       # Windows; Unix: export PYTHONPATH=.
    python scripts/train_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv \
        --artifact artifacts/cmu-v1.pt --embed-dim 128 --epochs 60 \
        --seeds 42,43,44 --version cmu-v1 --metrics-out artifacts/metrics.json
    python scripts/make_figures.py                        # det_curve.png + tsne.png

**Outputs** (in `artifacts/`): `metrics.json` (headline EER mean±std, open-set
protocol, dataset SHA, git commit), `cmu-v1.pt` (versioned model), `scores.json`
(DET inputs), `det_curve.png`, `tsne.png`, `problem_log.json` (criterion-4.4
evidence). `metrics.json`, the figures, and `problem_log.json` are committed; the
`.pt` weights and `scores.json` are gitignored (rebuilt by `reproduce.ps1`).

## Phase 2 — free-text (continuous-guard) model
Content-independent model trained on windowed free typing. See
`data/freetext/README.md` for corpus acquisition (with a game-data fallback).
Train: `python scripts/train_freetext.py --csv <file> --version freetext-v1 --artifact artifacts/freetext-v1.pt`
