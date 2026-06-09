import os
import sys
import importlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "research"))
from ksbio.seeds import set_global_seed                  # noqa: E402
from ksbio.encoder import KeystrokeEncoder               # noqa: E402
from ksbio.artifact import save_artifact, ArtifactMeta   # noqa: E402
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID  # noqa: E402


def test_falls_back_to_stub_when_no_artifact(monkeypatch):
    monkeypatch.delenv("ML_ARTIFACT_PATH", raising=False)
    import app.model as model
    importlib.reload(model)
    assert model.MODEL_VERSION == "stub-0"
    emb = model.get_embedder()
    assert emb.version == "stub-0"


def test_uses_artifact_when_present(monkeypatch, tmp_path):
    art = os.path.join(tmp_path, "cmu.pt")
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32)
    save_artifact(art, enc, ArtifactMeta(version="cmu-v1", embed_dim=32,
                  git_commit="x", config={}, timing_features=TIMING_FEATURES,
                  max_char_id=MAX_CHAR_ID))
    monkeypatch.setenv("ML_ARTIFACT_PATH", art)
    import app.model as model
    importlib.reload(model)
    assert model.MODEL_VERSION == "cmu-v1"
    assert model.get_embedder().version == "cmu-v1"
    # cleanup: reload back to stub so other tests are unaffected
    monkeypatch.delenv("ML_ARTIFACT_PATH", raising=False)
    importlib.reload(model)
