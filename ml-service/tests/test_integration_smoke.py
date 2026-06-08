"""Foundation acceptance: the embed->profile->verify loop works end-to-end with
the stub model. Proves the plumbing before the real model lands.

HONEST NOTE: the stub (hash-based) embedder does NOT preserve locality, so
near-identical inputs do not yield near-identical embeddings. This test asserts
the loop RUNS and returns well-formed output — NOT that self-scores are low.
That property is validated in Plan 2 with the real model."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _ks(c, dt, ut):
    return {"char": c, "keyCode": "Key" + c.upper(), "downTime": dt,
            "upTime": ut, "position": 0, "isCorrect": True}

def _window(offset):
    return [_ks("t", 1.0 + offset, 1.08 + offset),
            _ks("h", 1.3 + offset, 1.36 + offset),
            _ks("e", 1.6 + offset, 1.69 + offset)]

def test_enroll_then_verify_returns_well_formed_output():
    windows = [_window(i * 0.001) for i in range(5)]
    r = client.post("/embed_batch",
                    json={"windows": windows, "modelVersion": "stub-0"})
    refs = r.json()["embeddings"]
    dim = len(refs[0])
    centroid = [sum(v[j] for v in refs) / len(refs) for j in range(dim)]
    profile = {"centroid": centroid, "covInverse": None,
               "refs": refs, "threshold": 0.5}
    z = client.post("/embed",
                    json={"keystrokes": _window(0.0005),
                          "modelVersion": "stub-0"}).json()["embedding"]
    v = client.post("/verify",
                    json={"embedding": z, "profile": profile,
                          "modelVersion": "stub-0"}).json()
    assert v["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}
    assert "score" in v and "confidence" in v
    assert len(z) == 128
