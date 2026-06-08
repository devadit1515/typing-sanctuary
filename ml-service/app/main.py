from fastapi import FastAPI
from .contract import (EmbedRequest, EmbedResponse, EmbedBatchRequest,
                       EmbedBatchResponse)
from .model import MODEL_VERSION, device_name, get_embedder

app = FastAPI(title="Keystroke Verification Inference Service")

@app.get("/health")
def health():
    return {"ok": True, "modelVersion": MODEL_VERSION, "device": device_name()}

@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    vec = get_embedder().embed(req.keystrokes)
    return EmbedResponse(embedding=vec, modelVersion=MODEL_VERSION)

@app.post("/embed_batch", response_model=EmbedBatchResponse)
def embed_batch(req: EmbedBatchRequest):
    emb = get_embedder()
    vecs = [emb.embed(w) for w in req.windows]
    return EmbedBatchResponse(embeddings=vecs, modelVersion=MODEL_VERSION)
