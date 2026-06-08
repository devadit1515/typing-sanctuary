"""Serves the trained artifact behind the frozen embedder interface
(.embed(keystrokes) -> list[float], .version). Reuses the research encoder +
featurization so the served embedding equals what training produced."""
import os
import sys
import torch

# Make the research package importable (artifact loader + featurizer live there).
_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_RESEARCH = os.path.join(_ROOT, "research")
if _RESEARCH not in sys.path:
    sys.path.insert(0, _RESEARCH)

from ksbio.artifact import load_artifact          # noqa: E402
from ksbio.featurize import featurize_window       # noqa: E402


class TorchEmbedder:
    def __init__(self, artifact_path):
        self.encoder, self.meta = load_artifact(artifact_path)
        self.version = self.meta.version

    def embed(self, keystrokes):
        feats, char_ids = featurize_window(keystrokes)
        n = feats.shape[0]
        ft = torch.from_numpy(feats).unsqueeze(0)
        ci = torch.from_numpy(char_ids).unsqueeze(0)
        lengths = torch.tensor([n])
        with torch.no_grad():
            z = self.encoder(ft, ci, lengths)
        return z.squeeze(0).tolist()
