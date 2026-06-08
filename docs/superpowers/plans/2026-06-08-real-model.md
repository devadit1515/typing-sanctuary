# Real Model Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deterministic stub embedder with a genuinely trained, content-independent deep metric-learning model — built and unit-tested entirely on CPU — that produces a frozen, versioned artifact serving behind the *identical* Plan 1 wire contract, with an honest EER measured on the CMU benchmark and a free-text windowing path ready for the continuous-guard model.

**Architecture:** The `research/` package gains a PyTorch encoder (char-embedding → 1-D temporal CNN → BiGRU → attention pooling → 128-D L2-normalized vector), a triplet-loss training loop with online hard-negative mining and fixed seeds, an evaluation harness that measures EER on a held-out CMU subject split, and an artifact serializer. The `ml-service/` gains a `TorchEmbedder` that loads that artifact and implements the same `get_embedder().embed(keystrokes)` interface the stub did — so the swap changes the served *weights*, not the *contract*. Phase 1 trains on CMU (fixed-text, reconstructed into keystroke sequences); Phase 2 adds a free-text windowing loader and retrains content-independent. Full-scale GPU training + Modal deploy is the final, explicitly-triggered task — everything before it runs and is tested on CPU with tiny configs.

**Tech Stack:** Python 3.11 + PyTorch (CPU wheel for dev/test) + NumPy + pytest (existing `research/` + `ml-service/` harnesses). No Node changes in this plan. Modal GPU host configured but only deployed in the final you-triggered task.

**Spec:** `docs/superpowers/specs/2026-06-08-keystroke-verification-design.md`
**Predecessor:** `docs/superpowers/plans/2026-06-08-foundation.md` (Plan 1 — DONE; this plan depends on its `research/` and `ml-service/` packages).

---

## Frozen Contract (DO NOT BREAK)

Plan 1 froze these; the trained model drops in behind them unchanged. Verified against `ml-service/app/model.py` and `ml-service/app/contract.py`:

- `EMBED_DIM = 128`. Embeddings are **L2-normalized**, returned as a plain `list[float]` of length 128.
- The service obtains its model via `get_embedder()`, which returns an object exposing:
  - `.embed(keystrokes) -> list[float]` (length 128), where each `keystroke` has attributes `char`, `keyCode`, `downTime`, `upTime`, `position`, `isCorrect` (the Pydantic `Keystroke` model).
  - `.version -> str` (a string like `"cmu-v1"`).
- `MODEL_VERSION` (module constant in `ml-service/app/model.py`) is the single swap point. Changing it from `"stub-0"` to the trained version is what makes profiles built under the old version incomparable (spec §6.4: version mismatch ⇒ "re-enrollment needed", never score across versions).
- `/embed`, `/embed_batch`, `/verify`, `/health` route shapes are unchanged. `/verify` keeps using `app/verify.py` (the ported ensemble) — Plan 2 does NOT change the verifier, only the embedder feeding it.

**Reproducibility invariant (spec §4.5):** every training run calls `set_global_seed` first; the saved artifact is tagged with version + exact config + git commit; the eval script re-runs to identical numbers. Any task that trains MUST seed first and MUST be deterministic on CPU.

---

## Relationship to the legacy `ml/` directory

A pre-spec `ml/` directory exists (tracked on both branches): a scikit-learn `RandomForestAuth` skeleton + `KeystrokePreprocessor`, with a README promising LSTM/SVM/ensemble files that were never written and a **hardcoded, unmeasured** "Target: EER < 5%". This predates the spec and uses a *weaker, different* architecture (per-user binary RandomForest on aggregated stats) than the spec's content-independent metric-learning embedding.

**Decision:** `ml/` is **superseded, not extended.** Plan 2 builds the real model in `research/ksbio/` (where the seeds, parity-tested ensemble, metrics, and CMU loader already live). Task 0 demotes `ml/` to a clearly-labelled legacy baseline so no future reader mistakes it for the live model. We do NOT delete it (it can serve as a documented sklearn baseline-of-a-baseline), but we remove every implication that it is the production path, and we strip the fabricated accuracy claim.

---

## File Structure

**`research/` (model, training, eval — all CPU-testable):**
- `research/requirements.txt` — MODIFY: add `torch` (CPU), `tqdm`.
- `research/ksbio/encoder.py` — CREATE: PyTorch `KeystrokeEncoder` (char-emb → CNN → BiGRU → attention pool → 128-D L2). One responsibility: the network.
- `research/ksbio/featurize.py` — CREATE: turn a list of keystroke events into the encoder's input tensors (timing features + char ids). Shared by training and the service. One responsibility: event-sequence → model input.
- `research/ksbio/cmu_sequences.py` — CREATE: reconstruct CMU fixed-text rows (`H.`/`DD.`/`UD.` columns) into ordered keystroke-event sequences for the encoder. One responsibility: CMU-row → event-sequence adapter.
- `research/ksbio/triplet.py` — CREATE: triplet sampling with online hard-negative mining + triplet loss + center/variance regularizer. One responsibility: the training objective.
- `research/ksbio/train.py` — CREATE: deterministic training loop, produces an in-memory trained encoder + config. One responsibility: orchestrate training.
- `research/ksbio/artifact.py` — CREATE: save/load a versioned model artifact (weights + config + git commit + feature spec). One responsibility: artifact (de)serialization + the seam the service consumes.
- `research/ksbio/evaluate.py` — CREATE: embed CMU genuine/impostor splits, score with the ported ensemble, compute EER. One responsibility: honest evaluation.
- `research/ksbio/freetext.py` — CREATE (Phase 2): sliding-window loader for a free-text corpus + the game's own collected windows (fallback). One responsibility: free-text → windowed event-sequences.
- `research/scripts/__init__.py` — CREATE: empty (makes `scripts/` a package).
- `research/scripts/download_cmu.py` — CREATE: fetch CMU CSV, verify SHA-256, place in gitignored data dir.
- `research/scripts/train_cmu.py` — CREATE: CLI entrypoint, runs Phase-1 train → eval → save artifact (tiny by default, full via flags).
- `research/scripts/train_freetext.py` — CREATE (Phase 2): CLI entrypoint for the content-independent model.
- `research/conftest.py` — MODIFY: add `scripts/` to the test path (so CLI modules import in tests).
- `research/tests/test_no_legacy_overclaim.py`, `test_torch_available.py`, `test_featurize.py`, `test_encoder.py`, `test_cmu_sequences.py`, `test_triplet.py`, `test_train_smoke.py`, `test_artifact.py`, `test_evaluate.py`, `test_download_cmu.py`, `test_train_cmu_cli.py`, `test_freetext.py`, `test_train_freetext_cli.py`, `test_freetext_docs.py` — CREATE.
- `research/tests/fixtures/freetext_mini.csv` — CREATE (Phase 2 test fixture).
- `research/data/` — gitignored already (anchored `/data/`); real CMU CSV lands here.
- `research/data/freetext/README.md` — CREATE: free-text corpus acquisition path + fallback.
- `research/artifacts/` — CREATE dir (gitignored): trained artifacts land here.

**`ml-service/` (serve the trained artifact behind the frozen contract):**
- `ml-service/requirements.txt` — MODIFY: add `torch` (CPU).
- `ml-service/app/torch_embedder.py` — CREATE: `TorchEmbedder` that loads an artifact and implements `.embed()` + `.version`. Mirrors `research` encoder; loads weights, no training.
- `ml-service/app/model.py` — MODIFY: `get_embedder()` returns `TorchEmbedder` when an artifact is present, else falls back to `StubEmbedder`; `MODEL_VERSION` derives from the loaded artifact.
- `ml-service/app/artifacts/` — CREATE dir: the deployed artifact is copied here (gitignored; a tiny CPU-trained test artifact MAY be committed for the swap test — decided in Task 13).
- `ml-service/tests/test_torch_embedder.py`, `test_model_swap.py`, `test_trained_integration.py`, `test_modal_config.py` — CREATE.
- `ml-service/modal_app.py` — MODIFY (final task): add GPU + artifact mount.
- `ml-service/.env.example` — MODIFY (final task): add `ML_ARTIFACT_PATH`.

**Legacy:**
- `ml/README.md` — MODIFY: mark legacy, remove fabricated EER claim, point to `research/`.

---

## PART A — Phase 1: the real CMU model (CPU-built, honestly measured)

### Task 0: Demote the legacy `ml/` directory (no fabricated claims)

**Files:**
- Modify: `ml/README.md`

- [ ] **Step 1: Write a test that the fabricated claim is gone and the legacy banner is present**

Create `research/tests/test_no_legacy_overclaim.py`:
```python
"""Guard: the legacy ml/ dir must not advertise an unmeasured accuracy target,
and must point readers to the real model in research/ (spec: never claim
accuracy numbers not measured on a real dataset)."""
import os

ML_README = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "README.md")

def test_legacy_readme_has_no_fabricated_eer_target():
    with open(ML_README, encoding="utf-8") as f:
        text = f.read()
    assert "Target" not in text or "EER < 5%" not in text
    assert "LEGACY" in text.upper()
    assert "research/" in text
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_no_legacy_overclaim.py -v`
Expected: FAIL — README still contains the fabricated target and no legacy banner.

- [ ] **Step 3: Edit `ml/README.md`**

Replace the opening heading block (lines 1-2) so the file now begins with:
```markdown
# [LEGACY — superseded] Early scikit-learn keystroke experiments

> **This directory is LEGACY.** It predates the approved design spec and is NOT
> the production model. The live, content-independent metric-learning model and
> its reproducible training live in `research/` (see
> `docs/superpowers/specs/2026-06-08-keystroke-verification-design.md`). These
> files are retained only as a simple sklearn baseline-of-a-baseline for
> comparison. Nothing here is wired into the app.
```

Delete the entire `## Performance Metrics` target lines that assert `**Target**: EER < 5%, AUC > 0.95` — replace that block with:
```markdown
## Performance Metrics
FAR / FRR / EER / AUC are defined as usual. **No accuracy numbers are claimed
here** — any real measurement is produced by `research/ksbio/evaluate.py` on a
public benchmark, never hardcoded.
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_no_legacy_overclaim.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ml/README.md research/tests/test_no_legacy_overclaim.py
git commit -m "docs(ml): demote legacy sklearn dir, strip fabricated EER target"
```

---

### Task 1: Add PyTorch (CPU) to the research harness

**Files:**
- Modify: `research/requirements.txt`

- [ ] **Step 1: Add torch + tqdm to requirements**

Edit `research/requirements.txt` to:
```
numpy==2.1.3
pytest==8.3.4
torch==2.5.1
tqdm==4.67.1
```
(`torch==2.5.1` resolves to the CPU wheel on machines without CUDA. Reproducibility note: pin exactly.)

- [ ] **Step 2: Install**

Run: `cd research && pip install -r requirements.txt`
Expected: torch + tqdm installed, no errors. (CPU wheel; large download is expected.)

- [ ] **Step 3: Write a test that torch is importable and seeding is deterministic with it**

Create `research/tests/test_torch_available.py`:
```python
import numpy as np
from ksbio.seeds import set_global_seed

def test_torch_imports_and_seeds_deterministically():
    import torch
    set_global_seed(123)
    a = torch.rand(4)
    set_global_seed(123)
    b = torch.rand(4)
    assert torch.allclose(a, b)

def test_seed_also_sets_numpy():
    set_global_seed(7)
    x = np.random.rand(3)
    set_global_seed(7)
    y = np.random.rand(3)
    assert np.allclose(x, y)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_torch_available.py -v`
Expected: PASS, 2 passed. (`set_global_seed` already seeds torch when present — see `ksbio/seeds.py` from Plan 1.)

- [ ] **Step 5: Commit**

```bash
git add research/requirements.txt research/tests/test_torch_available.py
git commit -m "build(research): add pinned PyTorch (CPU) + tqdm"
```

---

### Task 2: Featurize keystroke events into model input

**Why:** The encoder needs fixed tensors: a per-keystroke timing-feature matrix and a per-keystroke character-id vector. This module is the SINGLE source of the input representation — both training and the inference service import it, so the served model sees exactly what it trained on.

**Files:**
- Create: `research/ksbio/featurize.py`
- Test: `research/tests/test_featurize.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_featurize.py`:
```python
import numpy as np
from ksbio.featurize import (
    char_to_id, featurize_window, TIMING_FEATURES, MAX_CHAR_ID,
)

def _ks(char, down, up, pos, correct=True):
    # mimic the service Keystroke (attribute access)
    return type("K", (), {"char": char, "keyCode": "Key" + char.upper(),
                          "downTime": down, "upTime": up,
                          "position": pos, "isCorrect": correct})()

def test_char_to_id_is_stable_and_bounded():
    a = char_to_id("a")
    assert char_to_id("a") == a
    assert 0 <= a < MAX_CHAR_ID
    assert char_to_id("a") != char_to_id("b")

def test_unknown_char_maps_to_zero_bucket():
    assert char_to_id("☃") == 0  # snowman -> UNK bucket

def test_featurize_window_shapes_and_timing_count():
    ks = [_ks("t", 1.00, 1.08, 0), _ks("h", 1.30, 1.36, 1),
          _ks("e", 1.60, 1.69, 2)]
    feats, char_ids = featurize_window(ks)
    assert feats.shape == (3, TIMING_FEATURES)   # one row per keystroke
    assert char_ids.shape == (3,)
    assert char_ids.dtype == np.int64

def test_hold_time_feature_is_up_minus_down():
    ks = [_ks("a", 2.0, 2.1, 0), _ks("b", 2.5, 2.7, 1)]
    feats, _ = featurize_window(ks)
    # column 0 is hold time; first keystroke hold = 0.1
    assert abs(feats[0, 0] - 0.1) < 1e-6

def test_first_keystroke_flight_is_zero():
    ks = [_ks("a", 2.0, 2.1, 0), _ks("b", 2.5, 2.7, 1)]
    feats, _ = featurize_window(ks)
    # flight (down-down) column for the first keystroke has no predecessor -> 0
    assert abs(feats[0, 1]) < 1e-9
    # second keystroke down-down = 2.5 - 2.0 = 0.5
    assert abs(feats[1, 1] - 0.5) < 1e-6
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_featurize.py -v`
Expected: FAIL — `ksbio.featurize` not found.

- [ ] **Step 3: Implement featurize**

Create `research/ksbio/featurize.py`:
```python
"""Keystroke-event -> model-input featurization. SINGLE source of the input
representation: imported by both training (research) and serving (ml-service),
so the deployed model sees exactly the features it trained on.

Per keystroke we emit 4 timing features (spec §4.1) + a character id (the net
learns keyboard geography via a learned char embedding).
Timing features per keystroke i:
  0 hold      = up_i - down_i
  1 down-down = down_i - down_{i-1}   (0 for i=0)
  2 flight    = down_i - up_{i-1}     (0 for i=0)  [up-down]
  3 up-up     = up_i - up_{i-1}       (0 for i=0)
"""
import numpy as np

TIMING_FEATURES = 4

# Vocabulary: 0 = UNK, then a-z, 0-9, and a handful of common punctuation/space.
_VOCAB = list("abcdefghijklmnopqrstuvwxyz0123456789 .,;'-")
_CHAR_TO_ID = {c: i + 1 for i, c in enumerate(_VOCAB)}  # +1 so 0 stays UNK
MAX_CHAR_ID = len(_VOCAB) + 1  # vocabulary size incl. UNK

def char_to_id(ch):
    if not ch:
        return 0
    return _CHAR_TO_ID.get(ch.lower()[:1], 0)

def featurize_window(keystrokes):
    """keystrokes: list of objects with .char .downTime .upTime (attribute access).
    Returns (feats: float32 [n,4], char_ids: int64 [n])."""
    n = len(keystrokes)
    feats = np.zeros((n, TIMING_FEATURES), dtype=np.float32)
    char_ids = np.zeros((n,), dtype=np.int64)
    prev_down = prev_up = None
    for i, k in enumerate(keystrokes):
        down = float(k.downTime)
        up = float(k.upTime)
        feats[i, 0] = up - down                       # hold
        if prev_down is not None:
            feats[i, 1] = down - prev_down            # down-down
            feats[i, 2] = down - prev_up              # flight (up-down)
            feats[i, 3] = up - prev_up                # up-up
        char_ids[i] = char_to_id(getattr(k, "char", ""))
        prev_down, prev_up = down, up
    return feats, char_ids
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_featurize.py -v`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/featurize.py research/tests/test_featurize.py
git commit -m "feat(research): keystroke-event featurization (shared by train + serve)"
```

---

### Task 3: The encoder network (char-emb → CNN → BiGRU → attention → 128-D L2)

**Why:** This is the spec's "twin" (§4.2). It must output a 128-D **L2-normalized** vector so the served contract holds and distances are angular.

**Files:**
- Create: `research/ksbio/encoder.py`
- Test: `research/tests/test_encoder.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_encoder.py`:
```python
import torch
from ksbio.seeds import set_global_seed
from ksbio.encoder import KeystrokeEncoder
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID

def _batch(b=2, n=5):
    feats = torch.randn(b, n, TIMING_FEATURES)
    char_ids = torch.randint(0, MAX_CHAR_ID, (b, n))
    lengths = torch.tensor([n] * b)
    return feats, char_ids, lengths

def test_output_is_128d_and_l2_normalized():
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=128)
    feats, char_ids, lengths = _batch()
    z = enc(feats, char_ids, lengths)
    assert z.shape == (2, 128)
    norms = z.norm(dim=1)
    assert torch.allclose(norms, torch.ones(2), atol=1e-5)

def test_forward_is_deterministic_in_eval_mode():
    set_global_seed(1)
    enc = KeystrokeEncoder(embed_dim=128).eval()
    feats, char_ids, lengths = _batch()
    with torch.no_grad():
        a = enc(feats, char_ids, lengths)
        b = enc(feats, char_ids, lengths)
    assert torch.allclose(a, b)

def test_padding_mask_changes_nothing_for_full_length():
    # a fully-valid window and the same window are identical regardless of mask
    set_global_seed(2)
    enc = KeystrokeEncoder(embed_dim=128).eval()
    feats, char_ids, lengths = _batch(b=1, n=6)
    with torch.no_grad():
        z = enc(feats, char_ids, lengths)
    assert z.shape == (1, 128)

def test_smaller_embed_dim_supported():
    set_global_seed(3)
    enc = KeystrokeEncoder(embed_dim=32)
    feats, char_ids, lengths = _batch()
    z = enc(feats, char_ids, lengths)
    assert z.shape == (2, 32)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_encoder.py -v`
Expected: FAIL — `ksbio.encoder` not found.

- [ ] **Step 3: Implement the encoder**

Create `research/ksbio/encoder.py`:
```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_encoder.py -v`
Expected: PASS, 4 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/encoder.py research/tests/test_encoder.py
git commit -m "feat(research): CNN+BiGRU+attention keystroke encoder (128-D L2)"
```

---

### Task 4: Reconstruct CMU fixed-text rows into keystroke sequences

**Why (critical):** Plan 1's `load_cmu` returns aggregated per-rep feature vectors (the `H.`/`DD.`/`UD.` columns). The encoder consumes ordered keystroke EVENTS. The CMU password is the FIXED string `.tie5Roanl` (then Return), so each row's columns can be unrolled back into an ordered event sequence with synthetic but internally-consistent `downTime`/`upTime`. This adapter is the bridge; getting it wrong silently trains the model on the wrong input.

**CMU column convention (Killourhy-Maxion):** for the fixed password, columns are `H.<key>` (hold), `DD.<key1>.<key2>` (down-down latency to the next key), `UD.<key1>.<key2>` (up-down latency). We reconstruct absolute times by walking keys in order: `down_0 = 0`, `up_i = down_i + H.<key_i>`, `down_{i+1} = down_i + DD.<key_i>.<key_{i+1}>`.

**Files:**
- Create: `research/ksbio/cmu_sequences.py`
- Test: `research/tests/test_cmu_sequences.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_cmu_sequences.py`:
```python
import numpy as np
from ksbio.cmu_sequences import row_to_sequence, CMU_PASSWORD_KEYS

def test_password_key_order_is_the_known_cmu_string():
    # The CMU benchmark password is ".tie5Roanl"
    assert "".join(CMU_PASSWORD_KEYS[:10]) == ".tie5Roanl"

def test_reconstructed_times_are_monotonic_and_consistent():
    # Build a synthetic row dict: hold=0.1 for every key, DD=0.3 to next key.
    keys = CMU_PASSWORD_KEYS
    row = {}
    for i, k in enumerate(keys):
        row[f"H.{k}"] = 0.10
    for i in range(len(keys) - 1):
        row[f"DD.{keys[i]}.{keys[i+1]}"] = 0.30
        row[f"UD.{keys[i]}.{keys[i+1]}"] = 0.20
    seq = row_to_sequence(row)
    assert len(seq) == len(keys)
    # down times strictly increase by 0.30 each step
    for i in range(1, len(seq)):
        assert abs(seq[i].downTime - seq[i-1].downTime - 0.30) < 1e-6
    # every hold is 0.10
    for k in seq:
        assert abs((k.upTime - k.downTime) - 0.10) < 1e-6

def test_sequence_objects_have_featurize_compatible_attributes():
    keys = CMU_PASSWORD_KEYS
    row = {f"H.{k}": 0.1 for k in keys}
    for i in range(len(keys) - 1):
        row[f"DD.{keys[i]}.{keys[i+1]}"] = 0.3
    seq = row_to_sequence(row)
    k0 = seq[0]
    for attr in ("char", "keyCode", "downTime", "upTime", "position", "isCorrect"):
        assert hasattr(k0, attr)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_cmu_sequences.py -v`
Expected: FAIL — `ksbio.cmu_sequences` not found.

- [ ] **Step 3: Implement the adapter**

Create `research/ksbio/cmu_sequences.py`:
```python
"""Adapter: CMU fixed-password rows -> ordered keystroke-event sequences the
encoder can featurize. The CMU benchmark password is '.tie5Roanl' + Return.
Column convention (Killourhy-Maxion):
  H.<key>            hold time of <key>
  DD.<k1>.<k2>       down-to-down latency from k1 to k2
  UD.<k1>.<k2>       up-to-down latency from k1 to k2 (flight)
We reconstruct absolute times deterministically by walking keys in order."""
from dataclasses import dataclass

# Key labels as they appear in the CMU column names. The dots in column names
# make '.' the literal 'period' key; we keep a parallel printable form too.
CMU_PASSWORD_KEYS = ["period", "t", "i", "e", "five", "Shift.r", "o", "a", "n", "l", "Return"]
# Printable char per key (for the char embedding); Shift.r -> 'r', five -> '5'.
_KEY_TO_CHAR = {"period": ".", "five": "5", "Shift.r": "r", "Return": "\n",
                "t": "t", "i": "i", "e": "e", "o": "o", "a": "a", "n": "n", "l": "l"}


@dataclass
class _KS:
    char: str
    keyCode: str
    downTime: float
    upTime: float
    position: int
    isCorrect: bool = True


def _col(row, name, default=0.0):
    v = row.get(name, default)
    return float(v) if v not in (None, "") else default


def row_to_sequence(row):
    """row: dict of CMU columns -> list[_KS] in typed order."""
    keys = CMU_PASSWORD_KEYS
    seq = []
    down = 0.0
    for i, key in enumerate(keys):
        hold = _col(row, f"H.{key}")
        up = down + hold
        ch = _KEY_TO_CHAR.get(key, key[:1])
        seq.append(_KS(char=ch, keyCode=key, downTime=down, upTime=up,
                       position=i, isCorrect=True))
        if i < len(keys) - 1:
            dd = _col(row, f"DD.{key}.{keys[i+1]}")
            down = down + dd
    return seq
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_cmu_sequences.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/cmu_sequences.py research/tests/test_cmu_sequences.py
git commit -m "feat(research): CMU fixed-text row -> keystroke-sequence adapter"
```

---

### Task 5: Triplet loss + online hard-negative mining + center regularizer

**Why:** The training objective (spec §4.3): anchor=you, positive=you, negative=other; penalize when an impostor embedding is closer than your own sample. Plus a small center/variance term so each user's embeddings cluster tightly (stabilizes per-user thresholds).

**Files:**
- Create: `research/ksbio/triplet.py`
- Test: `research/tests/test_triplet.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_triplet.py`:
```python
import torch
from ksbio.seeds import set_global_seed
from ksbio.triplet import batch_hard_triplet_loss, center_loss

def test_loss_is_zero_when_classes_are_well_separated():
    # two classes, each at a distinct unit vector, margin satisfied
    set_global_seed(0)
    emb = torch.tensor([[1.0, 0.0], [0.99, 0.01],   # class 0 (close together)
                        [0.0, 1.0], [0.01, 0.99]])  # class 1 (close together)
    emb = torch.nn.functional.normalize(emb, dim=1)
    labels = torch.tensor([0, 0, 1, 1])
    loss = batch_hard_triplet_loss(emb, labels, margin=0.2)
    assert loss.item() < 1e-3

def test_loss_is_positive_when_impostor_is_closer_than_self():
    # anchor's same-class partner is FAR, an other-class point is NEAR -> penalty
    emb = torch.tensor([[1.0, 0.0],     # a0 (class 0)
                        [-1.0, 0.0],    # a1 (class 0) but opposite side
                        [0.9, 0.1]])    # b0 (class 1) close to a0
    emb = torch.nn.functional.normalize(emb, dim=1)
    labels = torch.tensor([0, 0, 1])
    loss = batch_hard_triplet_loss(emb, labels, margin=0.2)
    assert loss.item() > 0.0

def test_center_loss_shrinks_intra_class_spread():
    emb = torch.tensor([[1.0, 0.0], [0.0, 1.0]])  # same label, far apart
    labels = torch.tensor([0, 0])
    spread = center_loss(emb, labels)
    assert spread.item() > 0.0
    tight = center_loss(torch.tensor([[1.0, 0.0], [1.0, 0.0]]),
                        torch.tensor([0, 0]))
    assert tight.item() < 1e-6
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_triplet.py -v`
Expected: FAIL — `ksbio.triplet` not found.

- [ ] **Step 3: Implement triplet + center losses**

Create `research/ksbio/triplet.py`:
```python
"""Triplet loss with batch-hard mining + a center regularizer (spec §4.3).
Distances are squared-Euclidean on L2-normalized embeddings (monotonic in angle).
Batch-hard: for each anchor, hardest positive (farthest same-class) and hardest
negative (closest other-class) within the batch."""
import torch
import torch.nn.functional as F


def _pairwise_sq_dists(emb):
    # emb: [b,d] -> [b,b] squared euclidean
    prod = emb @ emb.t()
    sq = torch.diagonal(prod)
    d = sq.unsqueeze(0) - 2 * prod + sq.unsqueeze(1)
    return d.clamp(min=0.0)


def batch_hard_triplet_loss(emb, labels, margin=0.2):
    d = _pairwise_sq_dists(emb)                       # [b,b]
    same = labels.unsqueeze(0) == labels.unsqueeze(1) # [b,b] bool
    eye = torch.eye(len(labels), dtype=torch.bool, device=emb.device)
    pos_mask = same & ~eye
    neg_mask = ~same
    # hardest positive: max distance among same-class (0 if none)
    pos_d = (d * pos_mask).max(dim=1).values
    # hardest negative: min distance among other-class (inf if none)
    neg_d = d.masked_fill(~neg_mask, float("inf")).min(dim=1).values
    valid = pos_mask.any(dim=1) & neg_mask.any(dim=1)
    losses = F.relu(pos_d - neg_d + margin)
    losses = losses[valid]
    return losses.mean() if losses.numel() else emb.sum() * 0.0


def center_loss(emb, labels):
    """Mean squared distance of each embedding to its class centroid."""
    total = emb.sum() * 0.0
    count = 0
    for lab in labels.unique():
        m = labels == lab
        group = emb[m]
        centroid = group.mean(dim=0, keepdim=True)
        total = total + ((group - centroid) ** 2).sum()
        count += group.shape[0]
    return total / max(count, 1)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_triplet.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/triplet.py research/tests/test_triplet.py
git commit -m "feat(research): batch-hard triplet loss + center regularizer"
```

---

### Task 6: Deterministic training loop (CPU-smoke trainable)

**Why:** Orchestrates encoder + triplet loss into a reproducible trainer. Built so a TINY config (few subjects, few epochs) trains to completion on CPU in seconds inside a test, and the SAME code scales to the full run on GPU later.

**Files:**
- Create: `research/ksbio/train.py`
- Test: `research/tests/test_train_smoke.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_train_smoke.py`:
```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_train_smoke.py -v`
Expected: FAIL — `ksbio.train` not found.

- [ ] **Step 3: Implement the trainer**

Create `research/ksbio/train.py`:
```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_train_smoke.py -v`
Expected: PASS, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/train.py research/tests/test_train_smoke.py
git commit -m "feat(research): deterministic triplet training loop (CPU-smoke)"
```

---

### Task 7: Versioned artifact (save/load) — the service seam

**Why:** The artifact is the load-bearing boundary (spec §3). It must carry weights + the EXACT config + git commit + the feature spec so the service reconstructs an identical encoder and `evaluate.py` re-runs to identical numbers.

**Files:**
- Create: `research/ksbio/artifact.py`
- Test: `research/tests/test_artifact.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_artifact.py`:
```python
import os
import torch
from ksbio.seeds import set_global_seed
from ksbio.encoder import KeystrokeEncoder
from ksbio.artifact import save_artifact, load_artifact, ArtifactMeta
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID

def _enc():
    set_global_seed(0)
    return KeystrokeEncoder(embed_dim=32)

def test_round_trip_preserves_weights_and_meta(tmp_path):
    enc = _enc()
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="abc123",
                        config={"epochs": 1}, timing_features=TIMING_FEATURES,
                        max_char_id=MAX_CHAR_ID)
    path = os.path.join(tmp_path, "art.pt")
    save_artifact(path, enc, meta)
    enc2, meta2 = load_artifact(path)
    assert meta2.version == "cmu-test"
    assert meta2.embed_dim == 32
    assert meta2.git_commit == "abc123"
    # weights identical -> identical output
    feats = torch.randn(1, 5, TIMING_FEATURES)
    cids = torch.randint(0, MAX_CHAR_ID, (1, 5))
    lengths = torch.tensor([5])
    with torch.no_grad():
        a = enc(feats, cids, lengths)
        b = enc2(feats, cids, lengths)
    assert torch.allclose(a, b, atol=1e-6)

def test_load_rejects_feature_spec_mismatch(tmp_path):
    enc = _enc()
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="x",
                        config={}, timing_features=TIMING_FEATURES + 99,
                        max_char_id=MAX_CHAR_ID)
    path = os.path.join(tmp_path, "bad.pt")
    save_artifact(path, enc, meta)
    try:
        load_artifact(path)
        assert False, "should have raised on feature-spec mismatch"
    except ValueError as e:
        assert "feature" in str(e).lower()

def test_load_uses_weights_only_safe_unpickling(tmp_path, monkeypatch):
    """Security: the artifact is the deployed seam — loading must NOT allow
    arbitrary code execution. Assert torch.load is called with weights_only=True."""
    import ksbio.artifact as artifact_mod
    enc = _enc()
    meta = ArtifactMeta(version="cmu-test", embed_dim=32, git_commit="x",
                        config={}, timing_features=TIMING_FEATURES,
                        max_char_id=MAX_CHAR_ID)
    path = os.path.join(tmp_path, "art.pt")
    save_artifact(path, enc, meta)
    seen = {}
    real_load = torch.load
    def _spy(p, *a, **kw):
        seen["weights_only"] = kw.get("weights_only")
        return real_load(p, *a, **kw)
    monkeypatch.setattr(artifact_mod.torch, "load", _spy)
    artifact_mod.load_artifact(path)
    assert seen["weights_only"] is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_artifact.py -v`
Expected: FAIL — `ksbio.artifact` not found.

- [ ] **Step 3: Implement the artifact module**

Create `research/ksbio/artifact.py`:
```python
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_artifact.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/artifact.py research/tests/test_artifact.py
git commit -m "feat(research): versioned model artifact with feature-spec guard"
```

---

### Task 8: Honest EER evaluation on CMU embeddings

**Why:** The headline honesty requirement (spec §5.3): EER is measured on PUBLIC benchmark data with labelled impostors, by embedding genuine/impostor windows and scoring with the Plan-1 ported ensemble. No fabricated numbers; the script re-runs to the same value.

**Files:**
- Create: `research/ksbio/evaluate.py`
- Test: `research/tests/test_evaluate.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_evaluate.py`:
```python
import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.encoder import KeystrokeEncoder
from ksbio.evaluate import embed_sequences, eer_for_subject

def _seq_batch(n_windows, n=6, shift=0.0):
    from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID
    set_global_seed(int(shift * 1000) + 1)
    feats = [torch.randn(n, TIMING_FEATURES) * 0.01 + shift for _ in range(n_windows)]
    cids = [torch.randint(1, MAX_CHAR_ID, (n,)) for _ in range(n_windows)]
    return feats, cids

def test_embed_sequences_returns_unit_vectors():
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32).eval()
    feats, cids = _seq_batch(3)
    embs = embed_sequences(enc, feats, cids)
    assert embs.shape == (3, 32)
    norms = np.linalg.norm(embs, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)

def test_eer_is_between_zero_and_one():
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32).eval()
    gen_feats, gen_cids = _seq_batch(8, shift=0.0)
    imp_feats, imp_cids = _seq_batch(8, shift=5.0)
    eer, thr = eer_for_subject(enc, gen_feats, gen_cids, imp_feats, imp_cids)
    assert 0.0 <= eer <= 1.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_evaluate.py -v`
Expected: FAIL — `ksbio.evaluate` not found.

- [ ] **Step 3: Implement evaluate**

Create `research/ksbio/evaluate.py`:
```python
"""Honest evaluation: embed genuine/impostor windows with the trained encoder,
score against a genuine profile using the ported ensemble, compute EER (spec
§5.3). EER comes from public-benchmark impostors ONLY — never self-data."""
import numpy as np
import torch
from .ensemble import compute_profile_stats, scaled_manhattan
from .metrics import equal_error_rate


def embed_sequences(encoder, feats_list, cids_list):
    """feats_list: list of [n,T] tensors; cids_list: list of [n] tensors.
    Returns np.ndarray [n_windows, embed_dim] of L2-normalized embeddings."""
    out = []
    encoder.eval()
    with torch.no_grad():
        for feats, cids in zip(feats_list, cids_list):
            n = feats.shape[0]
            z = encoder(feats.unsqueeze(0), cids.unsqueeze(0),
                        torch.tensor([n]))
            out.append(z.squeeze(0).numpy())
    return np.vstack(out)


def eer_for_subject(encoder, gen_feats, gen_cids, imp_feats, imp_cids,
                    enroll_frac=0.5):
    """Split genuine into enroll/test, build a profile, score genuine-test and
    impostor windows, return (EER, threshold). Lower score = more genuine."""
    gen = embed_sequences(encoder, gen_feats, gen_cids)
    imp = embed_sequences(encoder, imp_feats, imp_cids)
    cut = max(1, int(len(gen) * enroll_frac))
    enroll, gen_test = gen[:cut], gen[cut:]
    profile = compute_profile_stats(enroll)
    gen_scores = np.array([scaled_manhattan(z, profile) for z in gen_test])
    imp_scores = np.array([scaled_manhattan(z, profile) for z in imp])
    if gen_scores.size == 0:
        gen_scores = np.array([scaled_manhattan(z, profile) for z in enroll])
    return equal_error_rate(gen_scores, imp_scores)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_evaluate.py -v`
Expected: PASS, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/evaluate.py research/tests/test_evaluate.py
git commit -m "feat(research): honest EER evaluation on CMU embeddings"
```

---

### Task 9: Scripted CMU download with SHA-256 verification

**Why:** Reproducible data acquisition (your decision: scripted + checksum). The CSV stays gitignored; the script fetches and verifies it. If the URL is dead, the script fails loudly with manual-download instructions — never silently produces a partial file.

**Files:**
- Create: `research/scripts/__init__.py`, `research/scripts/download_cmu.py`
- Test: `research/tests/test_download_cmu.py`

- [ ] **Step 1: Make `scripts/` importable in tests**

The test imports the download script as a top-level module (`from download_cmu import ...`). Add `research/scripts/` to the test path by appending ONE line to the existing `research/conftest.py` (created in Plan 1):
```python
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "scripts"))
```
(The existing `conftest.py` already does `import sys, os` and inserts the package root; this adds `scripts/` alongside it.)

- [ ] **Step 2: Write the failing test (no network — test the verifier + placement logic)**

Create `research/tests/test_download_cmu.py`:
```python
import hashlib
import os
from download_cmu import verify_sha256, DATA_REL_PATH

def test_verify_sha256_accepts_correct_digest(tmp_path):
    p = os.path.join(tmp_path, "f.csv")
    content = b"subject,sessionIndex\ns001,1\n"
    with open(p, "wb") as f:
        f.write(content)
    digest = hashlib.sha256(content).hexdigest()
    assert verify_sha256(p, digest) is True

def test_verify_sha256_rejects_wrong_digest(tmp_path):
    p = os.path.join(tmp_path, "f.csv")
    with open(p, "wb") as f:
        f.write(b"hello")
    assert verify_sha256(p, "0" * 64) is False

def test_data_path_is_under_gitignored_data_dir():
    # must land under research/data/ (anchored /data/ is gitignored)
    assert DATA_REL_PATH.replace("\\", "/").startswith("data/")
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_download_cmu.py -v`
Expected: FAIL — `download_cmu` not found.

- [ ] **Step 3: Implement the download script**

Create `research/scripts/__init__.py` (empty).
Create `research/scripts/download_cmu.py`:
```python
"""Fetch the CMU Killourhy-Maxion 'DSL-StrongPasswordData' CSV and verify its
SHA-256, placing it under research/data/ (gitignored). Reproducible: same file,
verified digest, or a loud failure with manual instructions.

The public dataset page: https://www.cs.cmu.edu/~keystroke/  (DSL-StrongPasswordData.csv)
"""
import hashlib
import os
import sys
import urllib.request

DATA_REL_PATH = os.path.join("data", "cmu", "DSL-StrongPasswordData.csv")
# Public mirror; if it 404s, follow the manual instructions printed below.
CMU_URL = "https://www.cs.cmu.edu/~keystroke/DSL-StrongPasswordData.csv"
# Known digest of the canonical CSV. If the upstream file legitimately changes,
# update this constant in the SAME commit that records why.
EXPECTED_SHA256 = "REPLACE_WITH_MEASURED_DIGEST"

MANUAL = (
    "Manual download:\n"
    "  1. Visit https://www.cs.cmu.edu/~keystroke/\n"
    "  2. Download DSL-StrongPasswordData.csv\n"
    f"  3. Place it at research/{DATA_REL_PATH}\n"
    "  4. Re-run with --skip-download to verify the digest.\n")


def verify_sha256(path, expected):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest() == expected


def main(skip_download=False):
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # research/
    dest = os.path.join(here, DATA_REL_PATH)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not skip_download:
        try:
            print(f"Downloading CMU dataset -> {dest}")
            urllib.request.urlretrieve(CMU_URL, dest)
        except Exception as e:                       # noqa: BLE001
            print(f"Download failed: {e}\n{MANUAL}", file=sys.stderr)
            return 1
    if not os.path.exists(dest):
        print(f"File missing.\n{MANUAL}", file=sys.stderr)
        return 1
    if EXPECTED_SHA256 == "REPLACE_WITH_MEASURED_DIGEST":
        actual = hashlib.sha256(open(dest, "rb").read()).hexdigest()
        print("No pinned digest yet. Measured digest of the downloaded file:")
        print(f"  {actual}")
        print("Set EXPECTED_SHA256 to this value (in a commit explaining why).")
        return 0
    if not verify_sha256(dest, EXPECTED_SHA256):
        print("DIGEST MISMATCH — refusing to use this file.", file=sys.stderr)
        return 1
    print("CMU dataset verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main(skip_download="--skip-download" in sys.argv))
```

(The `scripts/` path was already added to `conftest.py` in Step 1, so the test can import `download_cmu`.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_download_cmu.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 5: First real-data checkpoint (manual, you-run)**

Run: `cd research && python scripts/download_cmu.py`
Expected: either the file downloads and the script prints the measured SHA-256 (then you paste it into `EXPECTED_SHA256` and commit), OR it fails loudly with manual instructions. **This is the only network step in Part A; it touches no GPU and no cloud.**

- [ ] **Step 6: Commit**

```bash
git add research/scripts/ research/tests/test_download_cmu.py research/conftest.py
git commit -m "feat(research): scripted CMU download with SHA-256 verification"
```

---

### Task 10: Phase-1 CLI — train on CMU, measure EER, save artifact

**Why:** Wires Tasks 2-9 into one re-runnable entrypoint. Default config is TINY (so it runs on CPU in a test/dev), with flags for the full run. Produces the versioned artifact + a metrics line. This is the script the final GPU task invokes with full flags.

**Files:**
- Create: `research/scripts/train_cmu.py`
- Test: `research/tests/test_train_cmu_cli.py`

- [ ] **Step 1: Write the failing test (tiny end-to-end on the synthetic fixture)**

Create `research/tests/test_train_cmu_cli.py`:
```python
import os
from train_cmu import run_phase1, Phase1Args

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "cmu_mini.csv")

def test_phase1_tiny_run_produces_artifact_and_eer(tmp_path):
    art = os.path.join(tmp_path, "cmu_tiny.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=1, version="cmu-tiny")
    result = run_phase1(args)
    assert os.path.exists(art)
    assert "mean_eer" in result
    assert 0.0 <= result["mean_eer"] <= 1.0
    assert result["version"] == "cmu-tiny"

def test_phase1_is_reproducible(tmp_path):
    art = os.path.join(tmp_path, "a.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=5, version="cmu-tiny")
    r1 = run_phase1(args)
    r2 = run_phase1(args)
    assert abs(r1["mean_eer"] - r2["mean_eer"]) < 1e-6
```

Note: `cmu_mini.csv` (Plan 1 fixture) has only the generic timing columns, not the real CMU password columns. For the CLI test to exercise the sequence adapter, the loader path in `run_phase1` uses `load_cmu` (generic columns → per-rep vectors) and treats each rep as a 1-keystroke "window" via a thin shim when real CMU columns are absent. The FULL run (real CSV) uses `cmu_sequences.row_to_sequence`. `run_phase1` must auto-detect: if `H.period` column exists → sequence path; else → generic-vector path (fixture/dev).

**The n=1 "window" is a DEV-FIXTURE SHIM ONLY** — it exists so the CLI smoke test can run against Plan 1's column-only fixture without real data. It is NOT the modeling approach: the real CMU run reconstructs full multi-keystroke sequences via `row_to_sequence`. The encoder handles `n=1` correctly (attention softmax over one position = identity), so the shim runs, but no real training ever uses length-1 windows. Do not "optimize" the real path to match the shim.

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_train_cmu_cli.py -v`
Expected: FAIL — `train_cmu` not found.

- [ ] **Step 3: Implement the Phase-1 CLI**

Create `research/scripts/train_cmu.py`:
```python
"""Phase-1 entrypoint: train the encoder on CMU, measure EER per held-out
subject, save a versioned artifact. TINY defaults run on CPU; pass big flags for
the full GPU run. Auto-detects real CMU password columns vs. generic dev fixture.

Run (full):  python scripts/train_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv \\
                 --epochs 60 --embed-dim 128 --version cmu-v1 \\
                 --artifact artifacts/cmu-v1.pt
"""
import argparse
import os
import subprocess
from dataclasses import dataclass
import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.data.cmu import load_cmu
from ksbio.cmu_sequences import row_to_sequence
from ksbio.featurize import featurize_window, TIMING_FEATURES, MAX_CHAR_ID
from ksbio.train import train_encoder, TrainConfig
from ksbio.evaluate import eer_for_subject
from ksbio.artifact import save_artifact, ArtifactMeta


@dataclass
class Phase1Args:
    csv_path: str
    artifact_path: str
    embed_dim: int = 128
    epochs: int = 60
    seed: int = 42
    version: str = "cmu-v1"


def _git_commit():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:                                # noqa: BLE001
        return "unknown"


def _samples_from_csv(csv_path, seed):
    """Returns (samples, subject_to_windows). samples = list of
    (feats[n,T] tensor, char_ids[n] tensor, length, label_int)."""
    set_global_seed(seed)
    with open(csv_path, newline="") as f:
        header = f.readline()
    use_sequence = "H.period" in header  # real CMU password columns present
    samples, by_subject, labels = [], {}, {}
    if use_sequence:
        import csv as _csv
        with open(csv_path, newline="") as f:
            for row in _csv.DictReader(f):
                subj = row["subject"]
                seq = row_to_sequence(row)
                feats, cids = featurize_window(seq)
                _add(samples, by_subject, labels, subj, feats, cids)
    else:
        data = load_cmu(csv_path)  # {subj: [n_reps, n_cols]}
        for subj, mat in data.items():
            for rep in mat:
                # treat each rep vector as a single-keystroke "window"
                feats = np.zeros((1, TIMING_FEATURES), dtype=np.float32)
                feats[0, :min(TIMING_FEATURES, rep.shape[0])] = \
                    rep[:TIMING_FEATURES]
                cids = np.ones((1,), dtype=np.int64)
                _add(samples, by_subject, labels,
                     subj, torch.from_numpy(feats), torch.from_numpy(cids))
    return samples, by_subject


def _add(samples, by_subject, labels, subj, feats, cids):
    if subj not in labels:
        labels[subj] = len(labels)
    lab = labels[subj]
    n = feats.shape[0]
    samples.append((feats, cids, n, lab))
    by_subject.setdefault(subj, []).append((feats, cids))


def run_phase1(args: Phase1Args):
    set_global_seed(args.seed)
    samples, by_subject = _samples_from_csv(args.csv_path, args.seed)
    cfg = TrainConfig(embed_dim=args.embed_dim, epochs=args.epochs,
                      seed=args.seed,
                      batch_subjects=min(16, max(2, len(by_subject))),
                      samples_per_subject=2)
    enc, history = train_encoder(samples, cfg)

    # Per-subject EER: that subject genuine, all others impostor.
    eers = []
    subjects = list(by_subject.keys())
    for target in subjects:
        gen = by_subject[target]
        imp = [w for s in subjects if s != target for w in by_subject[s]]
        if not gen or not imp:
            continue
        gf = [w[0] for w in gen]; gc = [w[1] for w in gen]
        if_ = [w[0] for w in imp]; ic = [w[1] for w in imp]
        eer, _ = eer_for_subject(enc, gf, gc, if_, ic)
        eers.append(eer)
    mean_eer = float(np.mean(eers)) if eers else 1.0

    os.makedirs(os.path.dirname(args.artifact_path) or ".", exist_ok=True)
    meta = ArtifactMeta(version=args.version, embed_dim=args.embed_dim,
                        git_commit=_git_commit(),
                        config={"epochs": args.epochs, "seed": args.seed},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(args.artifact_path, enc, meta)
    return {"mean_eer": mean_eer, "n_subjects": len(subjects),
            "final_loss": history["loss"][-1], "version": args.version}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", dest="csv_path", required=True)
    p.add_argument("--artifact", dest="artifact_path", required=True)
    p.add_argument("--embed-dim", type=int, default=128)
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--version", default="cmu-v1")
    a = p.parse_args()
    res = run_phase1(Phase1Args(a.csv_path, a.artifact_path, a.embed_dim,
                                a.epochs, a.seed, a.version))
    print(f"[phase1] version={res['version']} subjects={res['n_subjects']} "
          f"mean_EER={res['mean_eer']:.4f} final_loss={res['final_loss']:.4f}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_train_cmu_cli.py -v`
Expected: PASS, 2 passed.

- [ ] **Step 5: Run the FULL research suite**

Run: `cd research && python -m pytest tests/ -v`
Expected: PASS — all Plan 1 + Plan 2 research tests green.

- [ ] **Step 6: Commit**

```bash
git add research/scripts/train_cmu.py research/tests/test_train_cmu_cli.py
git commit -m "feat(research): Phase-1 CMU train->EER->artifact CLI (CPU-tiny default)"
```

---

## PART B — Serve the trained model behind the frozen contract

### Task 11: `TorchEmbedder` in the service (loads artifact, same interface)

**Why:** The service must serve the trained weights through the EXACT `get_embedder().embed()` + `.version` interface the stub used (frozen contract). `TorchEmbedder` mirrors the encoder forward pass and the featurization so the served embedding equals what training produced.

**Files:**
- Modify: `ml-service/requirements.txt`
- Create: `ml-service/app/torch_embedder.py`
- Test: `ml-service/tests/test_torch_embedder.py`

- [ ] **Step 1: Add torch to the service requirements**

Edit `ml-service/requirements.txt` — append:
```
torch==2.5.1
```

- [ ] **Step 2: Install**

Run: `cd ml-service && pip install -r requirements.txt`
Expected: torch installed (CPU wheel).

- [ ] **Step 3: Write the failing test**

The service must embed exactly like research. To avoid a brittle cross-package import, the service vendors a thin copy of featurize + encoder via the artifact loader; the test trains a tiny artifact with the research code, then loads it in the service and checks shape + L2 + determinism. Create `ml-service/tests/test_torch_embedder.py`:
```python
import os
import sys
import math
import torch
import pytest

# make the research package importable for fixture creation
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "research"))

from ksbio.seeds import set_global_seed                       # noqa: E402
from ksbio.encoder import KeystrokeEncoder                    # noqa: E402
from ksbio.artifact import save_artifact, ArtifactMeta        # noqa: E402
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID      # noqa: E402

from app.torch_embedder import TorchEmbedder                  # noqa: E402


def _make_artifact(path, embed_dim=32):
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=embed_dim)
    meta = ArtifactMeta(version="cmu-test", embed_dim=embed_dim,
                        git_commit="test", config={},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(path, enc, meta)


def _ks(c, dt, ut):
    return type("K", (), {"char": c, "keyCode": "Key" + c.upper(),
                          "downTime": dt, "upTime": ut,
                          "position": 0, "isCorrect": True})()


def test_embedder_loads_and_reports_version(tmp_path):
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p)
    emb = TorchEmbedder(p)
    assert emb.version == "cmu-test"


def test_embed_is_unit_length_and_right_dim(tmp_path):
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p, embed_dim=32)
    emb = TorchEmbedder(p)
    v = emb.embed([_ks("t", 1.0, 1.08), _ks("h", 1.3, 1.36)])
    assert len(v) == 32
    norm = math.sqrt(sum(x * x for x in v))
    assert abs(norm - 1.0) < 1e-5


def test_embed_is_deterministic(tmp_path):
    p = os.path.join(tmp_path, "a.pt")
    _make_artifact(p)
    emb = TorchEmbedder(p)
    ks = [_ks("a", 1.0, 1.1), _ks("b", 1.3, 1.4)]
    assert emb.embed(ks) == emb.embed(ks)
```

- [ ] **Step 4: Run to verify it fails**

Run: `cd ml-service && python -m pytest tests/test_torch_embedder.py -v`
Expected: FAIL — `app.torch_embedder` not found.

- [ ] **Step 5: Implement `TorchEmbedder`**

The service reuses the research encoder + featurize by adding `research/` to its path at load time (single-machine deploy; Modal image will include both). Create `ml-service/app/torch_embedder.py`:
```python
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
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd ml-service && python -m pytest tests/test_torch_embedder.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 7: Commit**

```bash
git add ml-service/requirements.txt ml-service/app/torch_embedder.py ml-service/tests/test_torch_embedder.py
git commit -m "feat(ml-service): TorchEmbedder serves trained artifact (frozen interface)"
```

---

### Task 12: Swap `get_embedder()` to prefer the trained artifact (stub fallback)

**Why:** The single swap point. When an artifact is present, the service serves it and `MODEL_VERSION` reflects the trained version (so old stub profiles are correctly flagged version-mismatched per spec §6.4). With no artifact, it falls back to the stub — keeping local dev and Plan-1 tests green.

**Files:**
- Modify: `ml-service/app/model.py`
- Test: `ml-service/tests/test_model_swap.py`

- [ ] **Step 1: Write the failing test**

Create `ml-service/tests/test_model_swap.py`:
```python
import os
import sys
import importlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "research"))
from ksbio.seeds import set_global_seed                  # noqa: E402
from ksbio.encoder import KeystrokeEncoder               # noqa: E402
from ksbio.artifact import save_artifact, ArtifactMeta   # noqa: E402
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID  # noqa: E402


def test_falls_back_to_stub_when_no_artifact(monkeypatch):
    monkeypatch.delenv("ML_ARTIFACT_PATH", raising=False)
    import app.model as model
    importlib.reload(model)
    assert model.MODEL_VERSION == "stub-0"
    emb = model.get_embedder()
    assert emb.version == "stub-0"


def test_uses_artifact_when_present(monkeypatch, tmp_path):
    art = os.path.join(tmp_path, "cmu.pt")
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=32)
    save_artifact(art, enc, ArtifactMeta(version="cmu-v1", embed_dim=32,
                  git_commit="x", config={}, timing_features=TIMING_FEATURES,
                  max_char_id=MAX_CHAR_ID))
    monkeypatch.setenv("ML_ARTIFACT_PATH", art)
    import app.model as model
    importlib.reload(model)
    assert model.MODEL_VERSION == "cmu-v1"
    assert model.get_embedder().version == "cmu-v1"
    # cleanup: reload back to stub so other tests are unaffected
    monkeypatch.delenv("ML_ARTIFACT_PATH", raising=False)
    importlib.reload(model)
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ml-service && python -m pytest tests/test_model_swap.py -v`
Expected: FAIL — `model.py` ignores `ML_ARTIFACT_PATH` and is hardcoded to stub.

- [ ] **Step 3: Modify `model.py`**

Replace `ml-service/app/model.py` with (keeps `StubEmbedder` intact, adds artifact preference):
```python
"""Model loader. Prefers a trained artifact (ML_ARTIFACT_PATH); falls back to a
DETERMINISTIC STUB when none is present, so local dev + foundation tests stay
green. MODEL_VERSION reflects whichever model is actually loaded — the single
swap point. Spec §6.4: profiles built under a different version are rejected
upstream as version-mismatched."""
import hashlib
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
    if path and os.path.exists(path):
        from .torch_embedder import TorchEmbedder
        return TorchEmbedder(path)
    return StubEmbedder()


_EMBEDDER = _load_embedder()
MODEL_VERSION = _EMBEDDER.version


def get_embedder():
    return _EMBEDDER
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ml-service && python -m pytest tests/test_model_swap.py -v`
Expected: PASS, 2 passed.

- [ ] **Step 5: Run the FULL service suite (stub path must stay green)**

Run: `cd ml-service && python -m pytest tests/ -v`
Expected: PASS — health, contract, embed stub, verify, integration, torch embedder, model swap all green (no `ML_ARTIFACT_PATH` set ⇒ stub default).

- [ ] **Step 6: Commit**

```bash
git add ml-service/app/model.py ml-service/tests/test_model_swap.py
git commit -m "feat(ml-service): get_embedder prefers trained artifact, stub fallback"
```

---

### Task 13: End-to-end swap smoke — trained artifact through /embed and /verify

**Why:** Prove the trained model flows through the real routes with a well-formed result AND that, unlike the locality-blind stub, the trained encoder's self-similarity is sane (near-identical windows ⇒ closer than a wildly different window). This is the property the Plan-1 integration test honestly could NOT assert.

**Files:**
- Create: `ml-service/tests/test_trained_integration.py`

- [ ] **Step 1: Write the test (trains a tiny artifact, points the app at it)**

Create `ml-service/tests/test_trained_integration.py`:
```python
import os
import sys
import importlib
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "research"))
from ksbio.seeds import set_global_seed                  # noqa: E402
from ksbio.encoder import KeystrokeEncoder               # noqa: E402
from ksbio.artifact import save_artifact, ArtifactMeta   # noqa: E402
from ksbio.featurize import TIMING_FEATURES, MAX_CHAR_ID  # noqa: E402


def _ks(c, dt, ut):
    return {"char": c, "keyCode": "Key" + c.upper(), "downTime": dt,
            "upTime": ut, "position": 0, "isCorrect": True}


def _window(off):
    return [_ks("t", 1.0 + off, 1.08 + off), _ks("h", 1.3 + off, 1.36 + off),
            _ks("e", 1.6 + off, 1.69 + off)]


def _client_with_artifact(tmp_path):
    art = os.path.join(tmp_path, "cmu.pt")
    set_global_seed(0)
    enc = KeystrokeEncoder(embed_dim=64)
    save_artifact(art, enc, ArtifactMeta(version="cmu-it", embed_dim=64,
                  git_commit="x", config={}, timing_features=TIMING_FEATURES,
                  max_char_id=MAX_CHAR_ID))
    os.environ["ML_ARTIFACT_PATH"] = art
    import app.model as model; importlib.reload(model)
    import app.main as main; importlib.reload(main)
    from fastapi.testclient import TestClient
    return TestClient(main.app), main


def test_trained_model_embeds_and_verifies_well_formed(tmp_path):
    client, main = _client_with_artifact(tmp_path)
    try:
        r = client.get("/health")
        assert r.json()["modelVersion"] == "cmu-it"
        embs = client.post("/embed_batch",
                           json={"windows": [_window(i*0.001) for i in range(5)],
                                 "modelVersion": "cmu-it"}).json()["embeddings"]
        dim = len(embs[0])
        centroid = [sum(v[j] for v in embs)/len(embs) for j in range(dim)]
        profile = {"centroid": centroid, "covInverse": None,
                   "refs": embs, "threshold": 0.5}
        z = client.post("/embed", json={"keystrokes": _window(0.0005),
                        "modelVersion": "cmu-it"}).json()["embedding"]
        v = client.post("/verify", json={"embedding": z, "profile": profile,
                        "modelVersion": "cmu-it"}).json()
        assert v["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}
        assert len(z) == dim
    finally:
        os.environ.pop("ML_ARTIFACT_PATH", None)
        import app.model as model; importlib.reload(model)
        import app.main as main2; importlib.reload(main2)


def test_trained_model_preserves_locality(tmp_path):
    """The property the stub could NOT satisfy: a near-identical window is
    closer (L2) to the anchor than a very different window."""
    client, main = _client_with_artifact(tmp_path)
    try:
        anchor = np.array(client.post("/embed",
            json={"keystrokes": _window(0.0), "modelVersion": "cmu-it"}
            ).json()["embedding"])
        near = np.array(client.post("/embed",
            json={"keystrokes": _window(0.001), "modelVersion": "cmu-it"}
            ).json()["embedding"])
        far = np.array(client.post("/embed",
            json={"keystrokes": [_ks("z", 5.0, 5.5), _ks("q", 9.0, 9.9)],
                  "modelVersion": "cmu-it"}).json()["embedding"])
        assert np.linalg.norm(anchor - near) < np.linalg.norm(anchor - far)
    finally:
        os.environ.pop("ML_ARTIFACT_PATH", None)
        import app.model as model; importlib.reload(model)
        import app.main as main2; importlib.reload(main2)
```

- [ ] **Step 2: Run it**

Run: `cd ml-service && python -m pytest tests/test_trained_integration.py -v`
Expected: PASS, 2 passed. (Locality holds because the encoder is continuous — even untrained — unlike the hash stub.)

- [ ] **Step 3: Run ALL service tests**

Run: `cd ml-service && python -m pytest tests/ -v`
Expected: PASS — every service test green; default (no env) still stub.

- [ ] **Step 4: Commit**

```bash
git add ml-service/tests/test_trained_integration.py
git commit -m "test(ml-service): trained-artifact integration + locality property"
```

---

## PART C — Phase 2: content-independent free-text model

### Task 14: Free-text sliding-window loader (corpus + game-data fallback)

**Why (spec §4.4, §9):** The continuous-guard model is content-INDEPENDENT, trained on windowed FREE typing. Academic corpus access (Buffalo/Clarkson) has lead time, so this loader works against BOTH a documented public corpus format AND the game's own collected windows (the spec's explicit plan-B), so Phase 2 is never hard-blocked.

**Files:**
- Create: `research/ksbio/freetext.py`
- Create: `research/tests/fixtures/freetext_mini.csv`
- Test: `research/tests/test_freetext.py`

- [ ] **Step 1: Create a tiny free-text fixture**

Create `research/tests/fixtures/freetext_mini.csv`:
```
subject,char,downTime,upTime,isCorrect
u1,h,0.00,0.08,1
u1,e,0.15,0.21,1
u1,l,0.30,0.37,1
u1,l,0.45,0.50,1
u1,o,0.60,0.69,1
u1,w,0.80,0.88,1
u1,o,0.95,1.01,1
u1,r,1.10,1.17,1
u1,l,1.25,1.30,1
u1,d,1.40,1.49,1
u2,t,0.00,0.05,1
u2,h,0.12,0.20,1
u2,e,0.25,0.33,1
u2,r,0.40,0.47,1
u2,e,0.55,0.60,1
u2,i,0.70,0.78,1
u2,s,0.85,0.92,1
u2,m,1.00,1.08,1
u2,o,1.15,1.20,1
u2,re,1.30,1.39,1
```

- [ ] **Step 2: Write the failing test**

Create `research/tests/test_freetext.py`:
```python
import os
from ksbio.freetext import load_freetext, sliding_windows

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "freetext_mini.csv")

def test_load_groups_events_by_subject_in_order():
    data = load_freetext(FIX)
    assert set(data.keys()) == {"u1", "u2"}
    assert len(data["u1"]) == 10
    # events stay in typed order (downTime non-decreasing)
    dts = [e.downTime for e in data["u1"]]
    assert dts == sorted(dts)

def test_sliding_windows_respect_size_and_stride():
    data = load_freetext(FIX)
    wins = sliding_windows(data["u1"], size=5, stride=2)
    # 10 events, size 5, stride 2 -> windows starting at 0,2,4 -> 3 windows
    assert len(wins) == 3
    assert all(len(w) == 5 for w in wins)

def test_window_events_have_featurize_attributes():
    data = load_freetext(FIX)
    w = sliding_windows(data["u1"], size=5, stride=5)[0]
    for attr in ("char", "downTime", "upTime"):
        assert hasattr(w[0], attr)
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_freetext.py -v`
Expected: FAIL — `ksbio.freetext` not found.

- [ ] **Step 4: Implement the free-text loader**

Create `research/ksbio/freetext.py`:
```python
"""Free-text loader for the content-independent (continuous-guard) model.
Accepts a generic per-event CSV (subject,char,downTime,upTime,isCorrect) — the
shape the game already collects — so Phase 2 runs on a public corpus OR on the
game's own data (spec §9 plan-B). Produces sliding windows of keystroke events."""
import csv
from dataclasses import dataclass


@dataclass
class _Event:
    char: str
    keyCode: str
    downTime: float
    upTime: float
    position: int
    isCorrect: bool = True


def load_freetext(path):
    """Returns {subject: [ _Event, ... ]} preserving typed order."""
    by_subject = {}
    with open(path, newline="") as f:
        for i, row in enumerate(csv.DictReader(f)):
            subj = row["subject"]
            ev = _Event(char=row["char"], keyCode="Key" + row["char"][:1].upper(),
                        downTime=float(row["downTime"]), upTime=float(row["upTime"]),
                        position=i, isCorrect=str(row.get("isCorrect", "1")) in ("1", "True", "true"))
            by_subject.setdefault(subj, []).append(ev)
    return by_subject


def sliding_windows(events, size=40, stride=20):
    """Yield fixed-size windows over an event stream. Drops a trailing partial
    window (content-independent training wants uniform-length windows)."""
    out = []
    i = 0
    while i + size <= len(events):
        out.append(events[i:i + size])
        i += stride
    return out
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_freetext.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 6: Commit**

```bash
git add research/ksbio/freetext.py research/tests/test_freetext.py research/tests/fixtures/freetext_mini.csv
git commit -m "feat(research): free-text sliding-window loader (corpus + game-data)"
```

---

### Task 15: Phase-2 CLI — content-independent training on windows

**Why:** Reuses the SAME encoder + triplet trainer + artifact, fed by free-text windows instead of CMU rows. Produces a distinct versioned artifact (e.g. `freetext-v1`) — the model the continuous guard actually ships. Tiny default for CPU; flags for the full run.

**Files:**
- Create: `research/scripts/train_freetext.py`
- Test: `research/tests/test_train_freetext_cli.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_train_freetext_cli.py`:
```python
import os
from train_freetext import run_phase2, Phase2Args

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "freetext_mini.csv")

def test_phase2_tiny_run_produces_artifact(tmp_path):
    art = os.path.join(tmp_path, "ft_tiny.pt")
    args = Phase2Args(csv_path=FIX, artifact_path=art, embed_dim=16,
                      epochs=2, window=5, stride=2, seed=1, version="ft-tiny")
    res = run_phase2(args)
    assert os.path.exists(art)
    assert res["version"] == "ft-tiny"
    assert res["n_windows"] > 0

def test_phase2_reproducible(tmp_path):
    art = os.path.join(tmp_path, "a.pt")
    args = Phase2Args(csv_path=FIX, artifact_path=art, embed_dim=16,
                      epochs=2, window=5, stride=2, seed=3, version="ft-tiny")
    r1 = run_phase2(args)
    r2 = run_phase2(args)
    assert abs(r1["final_loss"] - r2["final_loss"]) < 1e-6
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_train_freetext_cli.py -v`
Expected: FAIL — `train_freetext` not found.

- [ ] **Step 3: Implement the Phase-2 CLI**

Create `research/scripts/train_freetext.py`:
```python
"""Phase-2 entrypoint: content-independent model on free-text windows. Same
encoder + triplet trainer + artifact as Phase 1; only the data path differs.
Produces the continuous-guard model the app ships.

Run (full):  python scripts/train_freetext.py --csv data/freetext/corpus.csv \\
                 --epochs 80 --embed-dim 128 --window 40 --stride 20 \\
                 --version freetext-v1 --artifact artifacts/freetext-v1.pt
"""
import argparse
import os
import subprocess
from dataclasses import dataclass
import numpy as np
import torch
from ksbio.seeds import set_global_seed
from ksbio.freetext import load_freetext, sliding_windows
from ksbio.featurize import featurize_window, TIMING_FEATURES, MAX_CHAR_ID
from ksbio.train import train_encoder, TrainConfig
from ksbio.evaluate import eer_for_subject
from ksbio.artifact import save_artifact, ArtifactMeta


@dataclass
class Phase2Args:
    csv_path: str
    artifact_path: str
    embed_dim: int = 128
    epochs: int = 80
    window: int = 40
    stride: int = 20
    seed: int = 42
    version: str = "freetext-v1"


def _git_commit():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:                                # noqa: BLE001
        return "unknown"


def run_phase2(args: Phase2Args):
    set_global_seed(args.seed)
    data = load_freetext(args.csv_path)
    samples, by_subject, labels = [], {}, {}
    for subj, events in data.items():
        for w in sliding_windows(events, size=args.window, stride=args.stride):
            feats, cids = featurize_window(w)
            if subj not in labels:
                labels[subj] = len(labels)
            samples.append((torch.from_numpy(feats), torch.from_numpy(cids),
                            feats.shape[0], labels[subj]))
            by_subject.setdefault(subj, []).append(
                (torch.from_numpy(feats), torch.from_numpy(cids)))

    cfg = TrainConfig(embed_dim=args.embed_dim, epochs=args.epochs, seed=args.seed,
                      batch_subjects=min(16, max(2, len(by_subject))),
                      samples_per_subject=2)
    enc, history = train_encoder(samples, cfg)

    eers = []
    subjects = list(by_subject.keys())
    for target in subjects:
        gen = by_subject[target]
        imp = [w for s in subjects if s != target for w in by_subject[s]]
        if not gen or not imp:
            continue
        eer, _ = eer_for_subject(enc, [g[0] for g in gen], [g[1] for g in gen],
                                 [i[0] for i in imp], [i[1] for i in imp])
        eers.append(eer)
    mean_eer = float(np.mean(eers)) if eers else 1.0

    os.makedirs(os.path.dirname(args.artifact_path) or ".", exist_ok=True)
    meta = ArtifactMeta(version=args.version, embed_dim=args.embed_dim,
                        git_commit=_git_commit(),
                        config={"epochs": args.epochs, "window": args.window,
                                "stride": args.stride, "seed": args.seed},
                        timing_features=TIMING_FEATURES, max_char_id=MAX_CHAR_ID)
    save_artifact(args.artifact_path, enc, meta)
    return {"version": args.version, "n_windows": len(samples),
            "n_subjects": len(subjects), "mean_eer": mean_eer,
            "final_loss": history["loss"][-1]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--csv", dest="csv_path", required=True)
    p.add_argument("--artifact", dest="artifact_path", required=True)
    p.add_argument("--embed-dim", type=int, default=128)
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--window", type=int, default=40)
    p.add_argument("--stride", type=int, default=20)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--version", default="freetext-v1")
    a = p.parse_args()
    res = run_phase2(Phase2Args(a.csv_path, a.artifact_path, a.embed_dim,
                                a.epochs, a.window, a.stride, a.seed, a.version))
    print(f"[phase2] version={res['version']} windows={res['n_windows']} "
          f"subjects={res['n_subjects']} mean_EER={res['mean_eer']:.4f} "
          f"final_loss={res['final_loss']:.4f}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_train_freetext_cli.py -v`
Expected: PASS, 2 passed.

- [ ] **Step 5: Run the FULL research suite**

Run: `cd research && python -m pytest tests/ -v`
Expected: PASS — all research tests green.

- [ ] **Step 6: Commit**

```bash
git add research/scripts/train_freetext.py research/tests/test_train_freetext_cli.py
git commit -m "feat(research): Phase-2 content-independent free-text training CLI"
```

---

### Task 16: Document the free-text corpus acquisition (unblock Phase 2 data)

**Why:** Spec §9 flags academic data-access lead time as the one real external dependency. We record the request path NOW so it can be started in parallel, with the game-data fallback explicit — so a slow academic reply never blocks shipping.

**Files:**
- Modify: `research/README.md`
- Create: `research/data/freetext/README.md`

- [ ] **Step 1: Write a presence test for the acquisition doc**

Create `research/tests/test_freetext_docs.py`:
```python
import os

DOC = os.path.join(os.path.dirname(__file__), "..", "data", "freetext", "README.md")

def test_freetext_acquisition_doc_exists_and_names_fallback():
    with open(DOC, encoding="utf-8") as f:
        text = f.read().lower()
    assert "buffalo" in text or "clarkson" in text  # the academic corpora
    assert "fallback" in text                        # the game-data plan B
    assert "subject,char,downtime,uptime" in text    # the expected CSV shape
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_freetext_docs.py -v`
Expected: FAIL — doc not found.

- [ ] **Step 3: Write the acquisition doc**

Create `research/data/freetext/README.md`:
```markdown
# Free-text corpus — acquisition & format

The Phase-2 (continuous-guard) model is content-independent and trains on
windowed free typing. Two sources, in priority order:

## Plan A — public academic corpus
- **Buffalo Keystroke Dataset** and **Clarkson II** are the standard free-text
  benchmarks. Both typically require a short academic data-use request.
- Start the request EARLY (it has lead time). Track status here.

## Plan B — the game's own collected windows (fallback, never blocks us)
The Typing Sanctuary game already captures per-keystroke timings. With consent
(spec §6.5), export them to the same CSV shape and train on those. This makes
Phase 2 runnable without waiting on an external reply.

## Expected CSV shape (both sources normalize to this)
```
subject,char,downTime,upTime,isCorrect
u1,h,0.00,0.08,1
...
```
`downTime`/`upTime` in seconds (or any consistent unit — the encoder learns
relative rhythm). Place the normalized file at
`research/data/freetext/<name>.csv` (gitignored) and point
`scripts/train_freetext.py --csv` at it.
```

- [ ] **Step 4: Append a Phase-2 note to `research/README.md`**

Append to `research/README.md`:
```markdown

## Phase 2 — free-text (continuous-guard) model
Content-independent model trained on windowed free typing. See
`data/freetext/README.md` for corpus acquisition (with a game-data fallback).
Train: `python scripts/train_freetext.py --csv <file> --version freetext-v1 --artifact artifacts/freetext-v1.pt`
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_freetext_docs.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add research/README.md research/data/freetext/README.md research/tests/test_freetext_docs.py
git commit -m "docs(research): free-text corpus acquisition path + game-data fallback"
```

---

## PART D — The deferred, you-triggered GPU + deploy task

### Task 17: Modal GPU image + deploy (BILLABLE — run only when you say go)

**Why deferred:** Per your decision, nothing billable runs mid-plan. Tasks 0-16 are fully built and CPU-tested. This task is the ONLY one that spends GPU credits / does a cloud deploy. It is split so the config change is committed and reviewable, and the actual `modal deploy` + full training run is a clearly-marked manual step you execute.

**Files:**
- Modify: `ml-service/modal_app.py`
- Create: `ml-service/.env.example` additions (artifact path)

- [ ] **Step 1: Add a test that the Modal config references a GPU and mounts an artifact path**

Create `ml-service/tests/test_modal_config.py`:
```python
import os

MODAL = os.path.join(os.path.dirname(os.path.dirname(__file__)), "modal_app.py")

def test_modal_app_declares_gpu_and_artifact_env():
    with open(MODAL, encoding="utf-8") as f:
        src = f.read()
    assert "gpu" in src.lower()                       # a GPU is requested
    assert "ML_ARTIFACT_PATH" in src                  # artifact wired via env
    assert "torch" in src.lower()                     # torch in the image
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ml-service && python -m pytest tests/test_modal_config.py -v`
Expected: FAIL — current `modal_app.py` (from Plan 1) is CPU-only, no artifact env.

- [ ] **Step 3: Update `modal_app.py`**

Replace `ml-service/modal_app.py` with:
```python
"""Modal deployment for the inference service (GPU). Mounts the research package
(encoder + featurize + artifact loader) and the trained artifact; serves the
FastAPI app. The artifact is selected by ML_ARTIFACT_PATH inside the image.

Deploy (BILLABLE):  modal deploy modal_app.py
GPU added here per Plan 2; the served model is whatever artifact is mounted."""
import os
import modal

image = (
    modal.Image.debian_slim()
    .pip_install_from_requirements("requirements.txt")   # includes torch
    .add_local_dir("../research/ksbio", "/root/research/ksbio")
    .add_local_dir("artifacts", "/root/artifacts")
)

app = modal.App("keystroke-inference")


@app.function(
    image=image,
    gpu="T4",                                    # smallest sane inference GPU
    env={"ML_ARTIFACT_PATH": "/root/artifacts/cmu-v1.pt"},
)
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/root/research")
    from app.main import app as fastapi
    return fastapi
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ml-service && python -m pytest tests/test_modal_config.py -v`
Expected: PASS.

- [ ] **Step 5: Append artifact env to `.env.example`**

Append to `ml-service/.env.example`:
```
# Which trained artifact the service serves (set inside the Modal image):
ML_ARTIFACT_PATH=/root/artifacts/cmu-v1.pt
```

- [ ] **Step 6: Commit the config (still no spend)**

```bash
git add ml-service/modal_app.py ml-service/.env.example ml-service/tests/test_modal_config.py
git commit -m "feat(ml-service): Modal GPU image + artifact mount (deploy deferred)"
```

- [ ] **Step 7: [YOU TRIGGER — BILLABLE] Full training run + deploy**

These steps spend money/credits. Run them only when you decide to:

1. **Get + verify the real CMU data** (if not already): `cd research && python scripts/download_cmu.py`, paste the printed SHA-256 into `EXPECTED_SHA256`, commit.
2. **Full Phase-1 training** (GPU recommended; CPU works but slow):
   `cd research && python scripts/train_cmu.py --csv data/cmu/DSL-StrongPasswordData.csv --epochs 60 --embed-dim 128 --version cmu-v1 --artifact ../ml-service/artifacts/cmu-v1.pt`
   Record the printed `mean_EER` honestly (this is the real, measured number — no rounding up, no comparison-shopping a better seed).
3. **Provision Modal**: `pip install modal && modal token new`.
4. **Deploy**: `cd ml-service && modal deploy modal_app.py`. Note the returned URL.
5. **Smoke the live service**: `curl <url>/health` → expect `{"modelVersion":"cmu-v1",...}`.
6. **(Phase 2, when data is in hand)** repeat (2) with `train_freetext.py` → `freetext-v1.pt`, redeploy pointing `ML_ARTIFACT_PATH` at it.

- [ ] **Step 8: Record the measured numbers**

Create `docs/superpowers/specs/2026-06-08-phase1-results.md` with the ACTUAL measured `mean_EER`, n_subjects, git commit, exact command, and date. Honest framing only — no targets, no fabrication.

```bash
git add docs/superpowers/specs/2026-06-08-phase1-results.md
git commit -m "docs: record measured Phase-1 CMU EER (honest, reproducible)"
```

---

## Done Criteria (Plan 2)

**CPU-verifiable now (Tasks 0-16, no spend):**
- [ ] `research/` tests green: torch-available, featurize, encoder, cmu_sequences, triplet, train-smoke, artifact, evaluate, download-cmu, train-cmu CLI, freetext, train-freetext CLI, docs, no-legacy-overclaim.
- [ ] `ml-service/` tests green: all Plan-1 tests still pass with stub default, PLUS torch_embedder, model_swap, trained_integration (incl. locality), modal_config.
- [ ] The trained-model interface matches the frozen contract: `get_embedder().embed()` returns a 128-D (or configured-dim) L2-normalized `list[float]`; `.version` reflects the loaded artifact; stub fallback intact when no artifact.
- [ ] Encoder preserves locality (the property the stub could not): proven by `test_trained_model_preserves_locality`.
- [ ] Reproducibility: every train/eval path seeds first; two runs with the same seed give identical loss/EER (proven by the reproducibility tests).
- [ ] Legacy `ml/` demoted; no fabricated EER target anywhere.
- [ ] Phase-2 free-text path built and tested; corpus acquisition documented with a non-blocking game-data fallback.

**You-triggered (Task 17, billable):**
- [ ] Real CMU CSV downloaded + SHA-256 pinned.
- [ ] Full Phase-1 training run; **measured** mean EER recorded honestly in `phase1-results.md`.
- [ ] Modal GPU service deployed; `/health` returns the trained `modelVersion`.
- [ ] (When free-text data is in hand) Phase-2 artifact trained + deployed.

## What this plan deliberately does NOT do (→ Plan 3)

- Wiring the keystroke controllers / routes to actually CALL the ML client in production request paths (Plan 3).
- Enrollment UI, login step-up, session-guard chip, consent screen (Plan 3).
- Per-user threshold calibration surfaced in the product (the math exists in the ensemble; the product flow is Plan 3).
- EWMA continuous-guard smoothing + hysteresis in the live session (Plan 3 — the model that feeds it is built here).
```
