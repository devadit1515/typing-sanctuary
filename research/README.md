# Keystroke Biometrics — Research Harness

Reproducible training + evaluation. Always call `set_global_seed` first.

## Setup
    cd research
    python -m venv .venv
    # Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
    pip install -r requirements.txt

## Run tests
    python -m pytest tests/ -v

## Phase 2 — free-text (continuous-guard) model
Content-independent model trained on windowed free typing. See
`data/freetext/README.md` for corpus acquisition (with a game-data fallback).
Train: `python scripts/train_freetext.py --csv <file> --version freetext-v1 --artifact artifacts/freetext-v1.pt`
