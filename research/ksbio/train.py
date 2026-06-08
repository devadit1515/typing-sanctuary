"""Deterministic triplet trainer (spec §4.5: seed first, reproducible numbers).
A sample is (feats[n,T], char_ids[n], length, label). The same code path runs
the CPU smoke test (tiny cfg) and the full GPU run (large cfg)."""
from dataclasses import dataclass
import torch
from torch.utils.data import DataLoader
from .seeds import set_global_seed
from .encoder import KeystrokeEncoder
from .triplet import batch_hard_triplet_loss, center_loss


@dataclass
class TrainConfig:
    embed_dim: int = 128
    epochs: int = 30
    batch_subjects: int = 16
    samples_per_subject: int = 4
    lr: float = 1e-3
    margin: float = 0.2
    center_weight: float = 0.01
    seed: int = 42


def _collate(batch):
    feats = torch.stack([b[0] for b in batch])
    char_ids = torch.stack([b[1] for b in batch])
    lengths = torch.tensor([b[2] for b in batch])
    labels = torch.tensor([b[3] for b in batch])
    return feats, char_ids, lengths, labels


def train_encoder(samples, cfg: TrainConfig):
    set_global_seed(cfg.seed)
    enc = KeystrokeEncoder(embed_dim=cfg.embed_dim)
    opt = torch.optim.Adam(enc.parameters(), lr=cfg.lr)
    gen = torch.Generator().manual_seed(cfg.seed)
    batch_size = cfg.batch_subjects * cfg.samples_per_subject
    loader = DataLoader(samples, batch_size=batch_size, shuffle=True,
                        collate_fn=_collate, generator=gen)
    history = {"loss": []}
    enc.train()
    for _ in range(cfg.epochs):
        epoch_loss, steps = 0.0, 0
        for feats, char_ids, lengths, labels in loader:
            opt.zero_grad()
            z = enc(feats, char_ids, lengths)
            loss = batch_hard_triplet_loss(z, labels, margin=cfg.margin)
            loss = loss + cfg.center_weight * center_loss(z, labels)
            loss.backward()
            opt.step()
            epoch_loss += float(loss.item())
            steps += 1
        history["loss"].append(epoch_loss / max(steps, 1))
    enc.eval()
    return enc, history
