import torch
from ksbio.seeds import set_global_seed
from ksbio.train import train_encoder, TrainConfig
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID

def _toy_dataset(n_subjects=4, reps=6, n=8):
    """Each 'subject' is a cluster; samples are (feats,char_ids,length,label)."""
    set_global_seed(0)
    samples = []
    for s in range(n_subjects):
        base = torch.randn(n, TIMING_FEATURES) * 0.01 + s
        cids = torch.randint(1, MAX_CHAR_ID, (n,))
        for r in range(reps):
            feats = base + torch.randn(n, TIMING_FEATURES) * 0.01
            samples.append((feats, cids, n, s))
    return samples

def test_training_runs_and_loss_trends_down():
    cfg = TrainConfig(embed_dim=32, epochs=3, batch_subjects=4,
                      samples_per_subject=3, lr=1e-2, seed=42)
    data = _toy_dataset()
    enc, history = train_encoder(data, cfg)
    assert len(history["loss"]) == 3
    # last epoch loss <= first epoch loss (learning, not diverging)
    assert history["loss"][-1] <= history["loss"][0] + 1e-6

def test_training_is_deterministic_with_fixed_seed():
    cfg = TrainConfig(embed_dim=32, epochs=2, batch_subjects=4,
                      samples_per_subject=3, lr=1e-2, seed=7)
    data = _toy_dataset()
    _, h1 = train_encoder(data, cfg)
    _, h2 = train_encoder(data, cfg)
    assert abs(h1["loss"][-1] - h2["loss"][-1]) < 1e-6
