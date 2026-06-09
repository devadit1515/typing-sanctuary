"""Model loader. Prefers a trained artifact (ML_ARTIFACT_PATH); falls back to a
DETERMINISTIC STUB when none is present, so local dev + foundation tests stay
green. MODEL_VERSION reflects whichever model is actually loaded — the single
swap point. Spec §6.4: profiles built under a different version are rejected
upstream as version-mismatched."""
import hashlib
import logging
import os
import numpy as np

EMBED_DIM = 128


def device_name():
    return "cpu"


class StubEmbedder:
    """Maps a keystroke window deterministically to a unit vector in R^128.
    NOT a real model — only for plumbing/fallback."""
    version = "stub-0"

    def embed(self, keystrokes):
        parts = []
        for k in keystrokes:
            hold = float(k.upTime) - float(k.downTime)
            parts.append(f"{k.char}:{k.downTime:.4f}:{hold:.4f}")
        seed_bytes = "|".join(parts).encode("utf-8")
        vec = np.empty(EMBED_DIM, dtype=np.float64)
        for i in range(EMBED_DIM):
            h = hashlib.sha256(seed_bytes + str(i).encode()).digest()
            val = int.from_bytes(h[:8], "big") / 2**64
            vec[i] = val * 2.0 - 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec.tolist()


def _load_embedder():
    path = os.environ.get("ML_ARTIFACT_PATH")
    if path:
        if os.path.exists(path):
            from .torch_embedder import TorchEmbedder
            return TorchEmbedder(path)
        # Set-but-missing: the operator INTENDED a real model but the path is
        # wrong/unmounted. Fall back to the stub (fail-safe, don't crash) but
        # WARN loudly — silently serving a non-model from a security feature is
        # a dangerous, hard-to-notice misconfiguration.
        logging.warning(
            "ML_ARTIFACT_PATH set to %r but file not found; falling back to "
            "StubEmbedder (NON-MODEL — verification will be meaningless). "
            "Check the artifact path / mount.", path)
    return StubEmbedder()


_EMBEDDER = _load_embedder()
MODEL_VERSION = _EMBEDDER.version


def get_embedder():
    return _EMBEDDER
