"""Transformer-encoder baseline vs the CNN+BiGRU, same open-set protocol, same
triplet+centre loss, same seeds/split/eval. Tests the §3.3 capacity claim
empirically. Resumable: skips seeds already in the output json.
Run from research/ dir:  python tf_baseline.py 42,43,44 artifacts/tf_baseline.json
"""
import io, sys, json, os, math, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, ".")
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from ksbio.seeds import set_global_seed
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID
from ksbio.triplet import batch_hard_triplet_loss, center_loss
from ksbio.train import _collate
from ksbio.evaluate import embed_sequences, _eer_from_embeddings
from scripts.train_cmu import _samples_from_csv, split_subjects

CSV = "data/cmu/DSL-StrongPasswordData.csv"
seeds = [int(s) for s in sys.argv[1].split(",")]
OUT = sys.argv[2] if len(sys.argv) > 2 else "artifacts/tf_baseline.json"


class TfEnc(nn.Module):
    """Comparable-depth Transformer encoder with the KeystrokeEncoder interface."""
    def __init__(self, embed_dim=128, char_emb=16, d_model=64, nhead=4, layers=2, ff=128):
        super().__init__()
        self.d_model = d_model
        self.char_embedding = nn.Embedding(MAX_CHAR_ID, char_emb, padding_idx=0)
        self.inproj = nn.Linear(TIMING_FEATURES + char_emb, d_model)
        layer = nn.TransformerEncoderLayer(d_model, nhead, ff, batch_first=True)
        self.tf = nn.TransformerEncoder(layer, layers)
        self.proj = nn.Linear(d_model, embed_dim)

    def _pe(self, n, device):
        pe = torch.zeros(n, self.d_model, device=device)
        pos = torch.arange(0, n, dtype=torch.float, device=device).unsqueeze(1)
        div = torch.exp(torch.arange(0, self.d_model, 2, device=device).float()
                        * (-math.log(10000.0) / self.d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        return pe

    def forward(self, feats, char_ids, lengths):
        b, n, _ = feats.shape
        ce = self.char_embedding(char_ids)
        x = self.inproj(torch.cat([feats, ce], -1)) + self._pe(n, feats.device).unsqueeze(0)
        idx = torch.arange(n, device=feats.device).unsqueeze(0)
        pad = idx >= lengths.to(feats.device).unsqueeze(1)   # True = padding
        x = self.tf(x, src_key_padding_mask=pad)
        valid = (~pad).float().unsqueeze(-1)
        pooled = (x * valid).sum(1) / valid.sum(1).clamp(min=1)
        return F.normalize(self.proj(pooled), p=2, dim=1)


def train_tf(train_samples, seed, epochs=60):
    set_global_seed(seed)
    enc = TfEnc()
    opt = torch.optim.Adam(enc.parameters(), lr=1e-3)
    gen = torch.Generator().manual_seed(seed)
    loader = DataLoader(train_samples, batch_size=32, shuffle=True,
                        collate_fn=_collate, generator=gen)
    enc.train()
    last = 0.0
    for _ in range(epochs):
        tot, k = 0.0, 0
        for feats, cids, lengths, labels in loader:
            opt.zero_grad()
            z = enc(feats, cids, lengths)
            loss = batch_hard_triplet_loss(z, labels, margin=0.2) + 0.01 * center_loss(z, labels)
            loss.backward(); opt.step()
            tot += float(loss.item()); k += 1
        last = tot / max(k, 1)
    enc.eval()
    return enc, last


results = []
if os.path.exists(OUT):
    try:
        prev = json.load(open(OUT)); results = prev if isinstance(prev, list) else prev.get("results", [])
    except Exception:
        results = []
done = {r["seed"] for r in results}
n_params = sum(p.numel() for p in TfEnc().parameters())
print("Transformer params:", n_params)

for sd in [s for s in seeds if s not in done]:
    t0 = time.time()
    set_global_seed(sd)
    _, by_subject = _samples_from_csv(CSV, sd)
    train_subj, test_subj = split_subjects(list(by_subject.keys()), sd)
    label_of = {s: i for i, s in enumerate(train_subj)}
    train_samples = [(f, c, f.shape[0], label_of[s]) for s in train_subj for f, c in by_subject[s]]
    enc, final_loss = train_tf(train_samples, sd)
    emb = {s: embed_sequences(enc, [w[0] for w in by_subject[s]], [w[1] for w in by_subject[s]]) for s in test_subj}
    prim, ens = [], []
    for tgt in test_subj:
        gen = emb[tgt]; imp = np.vstack([emb[s] for s in test_subj if s != tgt])
        if len(gen) < 2 or len(imp) == 0: continue
        try:
            ep, _, _, _ = _eer_from_embeddings(gen, imp, scorer="primary")
            ee, _, _, _ = _eer_from_embeddings(gen, imp, scorer="ensemble")
        except ValueError:
            continue
        prim.append(ep); ens.append(ee)
    row = {"seed": sd, "tf_primary": float(np.mean(prim)), "tf_ensemble": float(np.mean(ens)),
           "final_loss": final_loss, "params": n_params, "secs": round(time.time() - t0, 1)}
    results.append(row); print(json.dumps(row)); sys.stdout.flush()
    json.dump(results, open(OUT, "w"), indent=2)

p = np.array([r["tf_primary"] for r in results]); e = np.array([r["tf_ensemble"] for r in results])
print("TF primary  mean=%.4f sd=%.4f" % (p.mean(), p.std()))
print("TF ensemble mean=%.4f sd=%.4f" % (e.mean(), e.std()))
print("(CNN+BiGRU headline: primary 0.1422, ensemble 0.1016; params 83505)")
