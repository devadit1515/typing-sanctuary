"""Serves the trained artifact behind the frozen embedder interface
(.embed(keystrokes) -> list[float], .version). Reuses the research encoder +
featurization so the served embedding equals what training produced."""
import os
import sys
import torch

# Reuse the research package's artifact loader + featurizer so the SERVED
# embedding is byte-identical to what training produced (no train/serve skew).
# Dev layout: research/ is a sibling of ml-service/. The deployed image (Modal,
# Task 17) must independently ensure `ksbio` is importable (it mounts research/
# and adds it to sys.path before importing app). The relative computation below
# is the DEV-ONLY fallback; we insert it only if it actually exists so a stale
# guess is never pushed onto sys.path.
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_RESEARCH = os.path.join(_ROOT, "research")
if os.path.isdir(_RESEARCH) and _RESEARCH not in sys.path:
    sys.path.insert(0, _RESEARCH)

try:
    from ksbio.artifact import load_artifact          # noqa: E402
    from ksbio.featurize import featurize_window       # noqa: E402
except ModuleNotFoundError as e:  # pragma: no cover - deployment misconfig
    raise ModuleNotFoundError(
        "TorchEmbedder requires the research package (ksbio) on sys.path. "
        f"Dev fallback computed _RESEARCH={_RESEARCH!r} (exists="
        f"{os.path.isdir(_RESEARCH)}). In a deployed image, ensure ksbio is "
        "importable (mount research/ and add it to sys.path before importing "
        "app)."
    ) from e


class TorchEmbedder:
    def __init__(self, artifact_path):
        self.encoder, self.meta = load_artifact(artifact_path)
        self.version = self.meta.version

    def embed(self, keystrokes) -> list:
        """Embed one keystroke window -> L2-normalized list[float] (length =
        embed_dim). Reuses the research featurizer + encoder so the result
        equals what training produced (the frozen serving contract)."""
        feats, char_ids = featurize_window(keystrokes)
        n = feats.shape[0]
        ft = torch.from_numpy(feats).unsqueeze(0)
        ci = torch.from_numpy(char_ids).unsqueeze(0)
        lengths = torch.tensor([n])
        with torch.no_grad():
            z = self.encoder(ft, ci, lengths)
        return z.squeeze(0).tolist()
