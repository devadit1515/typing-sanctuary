import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.encoder import KeystrokeEncoder
from ksbio.evaluate import embed_sequences, eer_for_subject

def _seq_batch(n_windows, n=6, shift=0.0):
    from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID
    set_global_seed(int(shift * 1000) + 1)
    feats = [torch.randn(n, TIMING_FEATURES) * 0.01 + shift for _ in range(n_windows)]
    cids = [torch.randint(1, MAX_CHAR_ID, (n,)) for _ in range(n_windows)]
    return feats, cids

def test_embed_sequences_returns_unit_vectors():
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32).eval()
    feats, cids = _seq_batch(3)
    embs = embed_sequences(enc, feats, cids)
    assert embs.shape == (3, 32)
    norms = np.linalg.norm(embs, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)

def test_eer_is_between_zero_and_one():
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32).eval()
    gen_feats, gen_cids = _seq_batch(8, shift=0.0)
    imp_feats, imp_cids = _seq_batch(8, shift=5.0)
    eer, thr = eer_for_subject(enc, gen_feats, gen_cids, imp_feats, imp_cids)
    assert 0.0 <= eer <= 1.0
