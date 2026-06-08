"""Versioned model artifact — the seam between research (produces) and the
inference service (consumes). Carries weights + config + git commit + the
feature spec so an identical encoder is reconstructed and eval re-runs to
identical numbers (spec §3, §4.5)."""
from dataclasses import dataclass, asdict
import torch
from .encoder import KeystrokeEncoder
from .featurize import TIMING_FEATURES, MAX_CHAR_ID


@dataclass
class ArtifactMeta:
    version: str
    embed_dim: int
    git_commit: str
    config: dict
    timing_features: int
    max_char_id: int


def save_artifact(path, encoder: KeystrokeEncoder, meta: ArtifactMeta):
    torch.save({"state_dict": encoder.state_dict(), "meta": asdict(meta)}, path)


def load_artifact(path):
    # weights_only=True restricts unpickling to tensors + basic types — our blob
    # is exactly a state_dict + a plain metadata dict, so this is safe AND closes
    # the arbitrary-code-execution hole that weights_only=False (the old default)
    # opens. The artifact is the deployed seam; a swapped .pt must never be able
    # to run code inside the inference service.
    blob = torch.load(path, map_location="cpu", weights_only=True)
    meta = ArtifactMeta(**blob["meta"])
    # Guard: the serving feature spec must match what the model trained on.
    if meta.timing_features != TIMING_FEATURES or meta.max_char_id != MAX_CHAR_ID:
        raise ValueError(
            f"Artifact feature spec mismatch: artifact "
            f"(T={meta.timing_features}, V={meta.max_char_id}) vs runtime "
            f"(T={TIMING_FEATURES}, V={MAX_CHAR_ID}). Re-train or re-deploy.")
    enc = KeystrokeEncoder(embed_dim=meta.embed_dim)
    enc.load_state_dict(blob["state_dict"])
    enc.eval()
    return enc, meta
