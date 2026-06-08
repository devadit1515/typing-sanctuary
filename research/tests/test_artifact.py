import os
import torch
from ksbio.seeds import set_global_seed
from ksbio.encoder import KeystrokeEncoder
from ksbio.artifact import save_artifact, load_artifact, ArtifactMeta
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID

def _enc():
    set_global_seed(0)
    return KeystrokeEncoder(embed_dim=32)

def test_round_trip_preserves_weights_and_meta(tmp_path):
    enc = _enc()
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="abc123",
                        config={"epochs": 1}, timing_features=TIMING_FEATURES,
                        max_char_id=MAX_CHAR_ID)
    path = os.path.join(tmp_path, "art.pt")
    save_artifact(path, enc, meta)
    enc2, meta2 = load_artifact(path)
    assert meta2.version == "cmu-test"
    assert meta2.embed_dim == 32
    assert meta2.git_commit == "abc123"
    # weights identical -> identical output
    feats = torch.randn(1, 5, TIMING_FEATURES)
    cids = torch.randint(0, MAX_CHAR_ID, (1, 5))
    lengths = torch.tensor([5])
    with torch.no_grad():
        a = enc(feats, cids, lengths)
        b = enc2(feats, cids, lengths)
    assert torch.allclose(a, b, atol=1e-6)

def test_load_rejects_feature_spec_mismatch(tmp_path):
    enc = _enc()
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="x",
                        config={}, timing_features=TIMING_FEATURES + 99,
                        max_char_id=MAX_CHAR_ID)
    path = os.path.join(tmp_path, "bad.pt")
    save_artifact(path, enc, meta)
    try:
        load_artifact(path)
        assert False, "should have raised on feature-spec mismatch"
    except ValueError as e:
        assert "feature" in str(e).lower()

def test_load_uses_weights_only_safe_unpickling(tmp_path, monkeypatch):
    """Security: the artifact is the deployed seam — loading must NOT allow
    arbitrary code execution. Assert torch.load is called with weights_only=True."""
    import ksbio.artifact as artifact_mod
    enc = _enc()
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="x",
                        config={}, timing_features=TIMING_FEATURES,
                        max_char_id=MAX_CHAR_ID)
    path = os.path.join(tmp_path, "art.pt")
    save_artifact(path, enc, meta)
    seen = {}
    real_load = torch.load
    def _spy(p, *a, **kw):
        seen["weights_only"] = kw.get("weights_only")
        return real_load(p, *a, **kw)
    monkeypatch.setattr(artifact_mod.torch, "load", _spy)
    artifact_mod.load_artifact(path)
    assert seen["weights_only"] is True
