"""Model loader interface. Foundation phase ships a DETERMINISTIC STUB so the
service + Node integration can be built and tested before the real model exists.
Plan 2 replaces StubEmbedder with the trained PyTorch model behind this same API."""
import hashlib
import numpy as np

MODEL_VERSION = "stub-0"
EMBED_DIM = 128

def device_name():
    return "cpu"

class StubEmbedder:
    """Maps a keystroke window deterministically to a unit vector in R^128.
    NOT a real model — only for plumbing. Replaced in Plan 2."""
    version = MODEL_VERSION

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

_EMBEDDER = StubEmbedder()

def get_embedder():
    return _EMBEDDER
