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
    # The reproducibility guarantee is bit-identical FULL trajectory, not just
    # the endpoint — exact equality across all epochs.
    assert h1["loss"] == h2["loss"]

def test_training_separates_subjects_in_embedding_space():
    # Stronger than loss-trends-down: a COLLAPSED encoder (all embeddings equal)
    # would drive loss down but is useless. Assert the trained encoder actually
    # separates subjects: mean within-subject distance < mean between-subject.
    cfg = TrainConfig(embed_dim=32, epochs=8, batch_subjects=4,
                      samples_per_subject=3, lr=1e-2, seed=42)
    data = _toy_dataset(n_subjects=4, reps=6, n=8)
    enc, _ = train_encoder(data, cfg)
    # embed every sample
    embs, labels = [], []
    with torch.no_grad():
        for feats, cids, length, lab in data:
            z = enc(feats.unsqueeze(0), cids.unsqueeze(0), torch.tensor([length]))
            embs.append(z.squeeze(0)); labels.append(lab)
    embs = torch.stack(embs)
    labels = torch.tensor(labels)
    # pairwise euclidean distances
    d = torch.cdist(embs, embs)
    same = labels.unsqueeze(0) == labels.unsqueeze(1)
    eye = torch.eye(len(labels), dtype=torch.bool)
    intra = d[same & ~eye].mean()
    inter = d[~same].mean()
    assert intra < inter, f"encoder did not separate subjects: intra={intra:.4f} inter={inter:.4f}"
