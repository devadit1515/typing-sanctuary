import os
import sys
import math
import pytest

# make the research package importable for fixture creation
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "research"))

from ksbio.seeds import set_global_seed                       # noqa: E402
from ksbio.encoder import KeystrokeEncoder                    # noqa: E402
from ksbio.artifact import save_artifact, ArtifactMeta        # noqa: E402
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID      # noqa: E402

from app.torch_embedder import TorchEmbedder                  # noqa: E402


def _make_artifact(path, embed_dim=32):
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=embed_dim)
    meta = ArtifactMeta(version="cmu-test", embed_dim=embed_dim,
                        git_commit="test", config={},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(path, enc, meta)


def _ks(c, dt, ut):
    return type("K", (), {"char": c, "keyCode": "Key" + c.upper(),
                          "downTime": dt, "upTime": ut,
                          "position": 0, "isCorrect": True})()


def test_embedder_loads_and_reports_version(tmp_path):
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p)
    emb = TorchEmbedder(p)
    assert emb.version == "cmu-test"


def test_embed_is_unit_length_and_right_dim(tmp_path):
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p, embed_dim=32)
    emb = TorchEmbedder(p)
    v = emb.embed([_ks("t", 1.0, 1.08), _ks("h", 1.3, 1.36)])
    assert len(v) == 32
    norm = math.sqrt(sum(x * x for x in v))
    assert abs(norm - 1.0) < 1e-5


def test_embed_is_deterministic(tmp_path):
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p)
    emb = TorchEmbedder(p)
    ks = [_ks("a", 1.0, 1.1), _ks("b", 1.3, 1.4)]
    assert emb.embed(ks) == emb.embed(ks)


def test_served_embedding_matches_research_encoder(tmp_path):
    # The whole point of importing ksbio (vs reimplementing) is fidelity: the
    # served vector must EQUAL the research encoder's direct output. Guards
    # against a future stray transform creeping into embed().
    from ksbio.featurize import featurize_window
    p = os.path.join(tmp_path, "a.pt")
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32)
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="test",
                        config={}, timing_features=TIMING_FEATURES,
                        max_char_id=MAX_CHAR_ID)
    save_artifact(p, enc, meta)
    emb = TorchEmbedder(p)
    window = [_ks("t", 1.0, 1.08), _ks("h", 1.3, 1.36), _ks("e", 1.6, 1.69)]
    served = emb.embed(window)
    # direct research path
    feats, cids = featurize_window(window)
    import torch
    with torch.no_grad():
        z = emb.encoder(torch.from_numpy(feats).unsqueeze(0),
                        torch.from_numpy(cids).unsqueeze(0),
                        torch.tensor([feats.shape[0]]))
    direct = z.squeeze(0).tolist()
    assert served == direct


def test_embed_rejects_empty_window(tmp_path):
    # An empty keystroke list must raise a clear error (the encoder asserts
    # length >= 1), not silently return a degenerate vector.
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p)
    emb = TorchEmbedder(p)
    with pytest.raises(AssertionError):
        emb.embed([])
