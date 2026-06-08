# Keystroke Verification Inference Service

Stateless FastAPI service. Serves a deterministic stub embedder in the foundation
phase (Plan 1); the trained PyTorch model + GPU arrive in Plan 2 behind the same
wire contract.

## Run locally
    cd ml-service
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

## Test
    python -m pytest tests/ -v

## Deploy (Modal)
    pip install modal && modal token new
    modal deploy modal_app.py
