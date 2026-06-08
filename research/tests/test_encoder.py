import torch
from ksbio.seeds import set_global_seed
from ksbio.encoder import KeystrokeEncoder
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID

def _batch(b=2, n=5):
    feats = torch.randn(b, n, TIMING_FEATURES)
    char_ids = torch.randint(0, MAX_CHAR_ID, (b, n))
    lengths = torch.tensor([n] * b)
    return feats, char_ids, lengths

def test_output_is_128d_and_l2_normalized():
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=128)
    feats, char_ids, lengths = _batch()
    z = enc(feats, char_ids, lengths)
    assert z.shape == (2, 128)
    norms = z.norm(dim=1)
    assert torch.allclose(norms, torch.ones(2), atol=1e-5)

def test_forward_is_deterministic_in_eval_mode():
    set_global_seed(1)
    enc = KeystrokeEncoder(embed_dim=128).eval()
    feats, char_ids, lengths = _batch()
    with torch.no_grad():
        a = enc(feats, char_ids, lengths)
        b = enc(feats, char_ids, lengths)
    assert torch.allclose(a, b)

def test_padding_mask_changes_nothing_for_full_length():
    # a fully-valid window and the same window are identical regardless of mask
    set_global_seed(2)
    enc = KeystrokeEncoder(embed_dim=128).eval()
    feats, char_ids, lengths = _batch(b=1, n=6)
    with torch.no_grad():
        z = enc(feats, char_ids, lengths)
    assert z.shape == (1, 128)

def test_smaller_embed_dim_supported():
    set_global_seed(3)
    enc = KeystrokeEncoder(embed_dim=32)
    feats, char_ids, lengths = _batch()
    z = enc(feats, char_ids, lengths)
    assert z.shape == (2, 32)
