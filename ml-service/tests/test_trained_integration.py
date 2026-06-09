import os
import sys
import importlib
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "research"))
from ksbio.seeds import set_global_seed                  # noqa: E402
from ksbio.encoder import KeystrokeEncoder               # noqa: E402
from ksbio.artifact import save_artifact, ArtifactMeta   # noqa: E402
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID  # noqa: E402

# The frozen wire contract (app/contract.py) enforces EmbedResponse.embedding to
# be EXACTLY 128 dims (Field min_length=max_length=EMBED_DIM, EMBED_DIM=128).
# The served model is 128-dim, so the test artifact must be 128-dim too — a
# 64-dim artifact would trip the response validator on /embed and /embed_batch.
EMBED_DIM = 128


def _ks(c, dt, ut):
    return {"char": c, "keyCode": "Key" + c.upper(), "downTime": dt,
            "upTime": ut, "position": 0, "isCorrect": True}


def _window(off):
    return [_ks("t", 1.0 + off, 1.08 + off), _ks("h", 1.3 + off, 1.36 + off),
            _ks("e", 1.6 + off, 1.69 + off)]


def _client_with_artifact(tmp_path):
    art = os.path.join(tmp_path, "cmu.pt")
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=EMBED_DIM)
    save_artifact(art, enc, ArtifactMeta(version="cmu-it", embed_dim=EMBED_DIM,
                  git_commit="x", config={}, timing_features=TIMING_FEATURES,
                  max_char_id=MAX_CHAR_ID))
    os.environ["ML_ARTIFACT_PATH"] = art
    import app.model as model; importlib.reload(model)
    import app.main as main; importlib.reload(main)
    from fastapi.testclient import TestClient
    return TestClient(main.app), main


def test_trained_model_embeds_and_verifies_well_formed(tmp_path):
    client, main = _client_with_artifact(tmp_path)
    try:
        r = client.get("/health")
        assert r.json()["modelVersion"] == "cmu-it"
        embs = client.post("/embed_batch",
                           json={"windows": [_window(i*0.001) for i in range(5)],
                                 "modelVersion": "cmu-it"}).json()["embeddings"]
        dim = len(embs[0])
        centroid = [sum(v[j] for v in embs)/len(embs) for j in range(dim)]
        profile = {"centroid": centroid, "covInverse": None,
                   "refs": embs, "threshold": 0.5}
        z = client.post("/embed", json={"keystrokes": _window(0.0005),
                        "modelVersion": "cmu-it"}).json()["embedding"]
        v = client.post("/verify", json={"embedding": z, "profile": profile,
                        "modelVersion": "cmu-it"}).json()
        assert v["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}
        assert len(z) == dim
    finally:
        os.environ.pop("ML_ARTIFACT_PATH", None)
        import app.model as model; importlib.reload(model)
        import app.main as main2; importlib.reload(main2)


def test_trained_model_preserves_locality(tmp_path):
    """The property the stub could NOT satisfy: a near-identical window is
    closer (L2) to the anchor than a very different window."""
    client, main = _client_with_artifact(tmp_path)
    try:
        anchor = np.array(client.post("/embed",
            json={"keystrokes": _window(0.0), "modelVersion": "cmu-it"}
            ).json()["embedding"])
        near = np.array(client.post("/embed",
            json={"keystrokes": _window(0.001), "modelVersion": "cmu-it"}
            ).json()["embedding"])
        far = np.array(client.post("/embed",
            json={"keystrokes": [_ks("z", 5.0, 5.5), _ks("q", 9.0, 9.9)],
                  "modelVersion": "cmu-it"}).json()["embedding"])
        assert np.linalg.norm(anchor - near) < np.linalg.norm(anchor - far)
    finally:
        os.environ.pop("ML_ARTIFACT_PATH", None)
        import app.model as model; importlib.reload(model)
        import app.main as main2; importlib.reload(main2)
