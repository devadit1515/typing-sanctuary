from fastapi import FastAPI
from .contract import (EmbedRequest, EmbedResponse, EmbedBatchRequest,
                       EmbedBatchResponse)
from .contract import VerifyRequest, VerifyResponse
from .verify import verify as run_verify
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

@app.post("/verify", response_model=VerifyResponse)
def verify_endpoint(req: VerifyRequest):
    p = {"centroid": req.profile.centroid, "refs": req.profile.refs,
         "threshold": req.profile.threshold, "covInverse": req.profile.covInverse}
    result = run_verify(req.embedding, p)
    return VerifyResponse(**result)
