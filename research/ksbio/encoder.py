"""The embedding 'twin' (spec §4.2): char-embedding + timing features ->
1-D temporal CNN -> BiGRU -> attention pooling -> L2-normalized vector.
Chosen over a Transformer for data-efficiency + reproducibility at our scale."""
import torch
import torch.nn as nn
import torch.nn.functional as F
from .featurize import TIMING_FEATURES, MAX_CHAR_ID


class AttentionPool(nn.Module):
    """Additive attention pooling over time with a length mask."""
    def __init__(self, dim):
        super().__init__()
        self.score = nn.Linear(dim, 1)

    def forward(self, x, mask):  # x: [b,n,d], mask: [b,n] bool (True=valid)
        scores = self.score(x).squeeze(-1)              # [b,n]
        scores = scores.masked_fill(~mask, float("-inf"))
        weights = torch.softmax(scores, dim=1)          # [b,n]
        return torch.bmm(weights.unsqueeze(1), x).squeeze(1)  # [b,d]


class KeystrokeEncoder(nn.Module):
    def __init__(self, embed_dim=128, char_emb=16, cnn_ch=64, gru_hidden=64):
        super().__init__()
        self.char_embedding = nn.Embedding(MAX_CHAR_ID, char_emb, padding_idx=0)
        in_dim = TIMING_FEATURES + char_emb
        self.cnn = nn.Sequential(
            nn.Conv1d(in_dim, cnn_ch, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(cnn_ch, cnn_ch, kernel_size=3, padding=1),
            nn.ReLU(),
        )
        self.gru = nn.GRU(cnn_ch, gru_hidden, batch_first=True,
                          bidirectional=True)
        self.pool = AttentionPool(gru_hidden * 2)
        self.proj = nn.Linear(gru_hidden * 2, embed_dim)

    def forward(self, feats, char_ids, lengths):
        # feats: [b,n,T], char_ids: [b,n], lengths: [b]
        b, n, _ = feats.shape
        ce = self.char_embedding(char_ids)              # [b,n,char_emb]
        x = torch.cat([feats, ce], dim=-1)              # [b,n,in_dim]
        x = self.cnn(x.transpose(1, 2)).transpose(1, 2) # [b,n,cnn_ch]
        x, _ = self.gru(x)                              # [b,n,2*gru_hidden]
        idx = torch.arange(n, device=feats.device).unsqueeze(0)
        mask = idx < lengths.unsqueeze(1)               # [b,n] valid positions
        pooled = self.pool(x, mask)                     # [b,2*gru_hidden]
        z = self.proj(pooled)                           # [b,embed_dim]
        return F.normalize(z, p=2, dim=1)               # L2 unit vectors
