# Keystroke Biometrics — Research Harness

Reproducible training + evaluation. Always call `set_global_seed` first.

## Setup
    cd research
    python -m venv .venv
    # Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
    pip install -r requirements.txt

## Run tests
    python -m pytest tests/ -v
