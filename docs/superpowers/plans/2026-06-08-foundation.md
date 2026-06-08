# Foundation Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the zero-external-dependency foundation for the keystroke verification system: fix the auth bug that breaks the existing feature, add test tooling, scaffold the Python inference service with its contract, port the JS statistical ensemble to Python, and stand up a reproducible research-harness skeleton with the CMU data loader.

**Architecture:** Three subsystems, this plan covers the foundation of each. Node app gets the auth fix + a typed client for the Python service (behind a feature flag, no behavior change yet). A new `ml-service/` Python FastAPI app exposes the frozen-model contract (stubbed model for now). A new `research/` Python package holds the reproducible harness skeleton (seeds, splits, CMU loader, metrics) and a Python port of the existing JS ensemble that both the service and harness import.

**Tech Stack:** Node 18 + Express (existing) + Jest (new). Python 3.11 + FastAPI + Uvicorn + NumPy + pytest (new). Modal for eventual GPU hosting (config stubbed, not deployed in this plan).

**Spec:** `docs/superpowers/specs/2026-06-08-keystroke-verification-design.md`

---

## File Structure

**Node (existing app):**
- `middleware/authMiddleware.js` — already correct; no change.
- `controllers/keystrokeAuthController.js` — MODIFY: `req.session.userId` → `req.userId`.
- `controllers/biometricController.js` — MODIFY: same auth fix if present.
- `services/mlServiceClient.js` — CREATE: typed HTTP client for the Python service.
- `config/mlService.js` — CREATE: base URL + service token + feature flag from env.
- `tests/services/mlServiceClient.test.js` — CREATE.
- `tests/controllers/keystrokeAuth.auth.test.js` — CREATE.

**Python inference service (new top-level `ml-service/`):**
- `ml-service/app/main.py` — FastAPI app, routes `/health` `/embed` `/embed_batch` `/verify`.
- `ml-service/app/contract.py` — Pydantic request/response models (the wire contract).
- `ml-service/app/model.py` — model loader interface + a deterministic STUB embedder.
- `ml-service/app/verify.py` — verification decision in embedding space.
- `ml-service/tests/test_contract.py`, `test_health.py`, `test_embed_stub.py`, `test_verify.py`, `test_integration_smoke.py`.
- `ml-service/requirements.txt`, `ml-service/README.md`, `ml-service/modal_app.py`, `ml-service/.env.example`.

**Python research harness (new top-level `research/`):**
- `research/ksbio/__init__.py`
- `research/ksbio/seeds.py` — global seed setting (numpy/random/torch).
- `research/ksbio/ensemble.py` — port of JS `classifierEngine.js` + `scoreFusion.js` + `linearAlgebra.js`.
- `research/ksbio/metrics.py` — EER / FAR / FRR computation.
- `research/ksbio/data/cmu.py` — CMU Killourhy-Maxion loader + deterministic split.
- `research/tests/test_seeds.py`, `test_ensemble_parity.py`, `test_metrics.py`, `test_cmu_loader.py`.
- `research/tests/fixtures/cmu_mini.csv`
- `research/requirements.txt`, `research/README.md`.

---

## Task 1: Add Jest test tooling to the Node app

**Files:**
- Modify: `package.json`
- Create: `tests/smoke.test.js`

- [ ] **Step 1: Write a smoke test that asserts the test runner works**

Create `tests/smoke.test.js`:
```javascript
describe('test tooling', () => {
  test('jest runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Install Jest and supertest**

Run: `npm install --save-dev jest supertest`
Expected: packages added to devDependencies, no errors.

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` `"scripts"`, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Run the smoke test**

Run: `npm test -- tests/smoke.test.js`
Expected: PASS, 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/smoke.test.js
git commit -m "chore: add Jest test tooling"
```

---

## Task 2: Fix the JWT auth bug in keystroke controllers

**Root cause (verified):** `authMiddleware.requireAuth` sets `req.userId` (`middleware/authMiddleware.js:23`), but `controllers/keystrokeAuthController.js` reads `req.session.userId` (e.g. line 24). Under JWT login, `req.session.userId` is undefined, so every endpoint operates on `undefined`.

**Files:**
- Test: `tests/controllers/keystrokeAuth.auth.test.js`
- Modify: `controllers/keystrokeAuthController.js` (all `req.session.userId` → `req.userId`)
- Modify: `controllers/biometricController.js` (same, if any occurrences)

- [ ] **Step 1: Write the failing test**

Create `tests/controllers/keystrokeAuth.auth.test.js`:
```javascript
describe('keystrokeAuthController reads req.userId (JWT), not req.session.userId', () => {
  test('source code contains no req.session.userId references', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../controllers/keystrokeAuthController.js'),
      'utf8'
    );
    expect(src.includes('req.session.userId')).toBe(false);
    expect(src.includes('req.userId')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/controllers/keystrokeAuth.auth.test.js`
Expected: FAIL — source still contains `req.session.userId`.

- [ ] **Step 3: Replace all occurrences**

In `controllers/keystrokeAuthController.js`, replace every `req.session.userId` with `req.userId`. (Multiple occurrences across getEnrollmentStatus, submitSample, verifyTest, createImpostorChallenge, enableBiometricAuth, disableBiometricAuth, getPasswordStatus, setKeystrokePassword, trainPassword, verifyPassword.) Use a global replace, then visually confirm no `req.session.userId` remains.

In `controllers/biometricController.js`, do the same for any `req.session.userId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/controllers/keystrokeAuth.auth.test.js`
Expected: PASS.

- [ ] **Step 5: Verify routes attach requireAuth**

Read `routes/keystrokeAuthRoutes.js`. Confirm every authenticated route applies `requireAuth` (so `req.userId` is populated). If any authenticated route is missing it, add `requireAuth`. Note findings in the commit message.

- [ ] **Step 6: Commit**

```bash
git add controllers/keystrokeAuthController.js controllers/biometricController.js tests/controllers/keystrokeAuth.auth.test.js
git commit -m "fix: keystroke controllers read req.userId (JWT) not req.session.userId"
```

---

## Task 3: Python research package skeleton + deterministic seeds

**Files:**
- Create: `research/requirements.txt`, `research/README.md`, `research/ksbio/__init__.py`, `research/ksbio/seeds.py`
- Test: `research/tests/test_seeds.py`

- [ ] **Step 1: Write requirements**

Create `research/requirements.txt`:
```
numpy==2.1.3
pytest==8.3.4
```
(PyTorch added in Plan 2; foundation needs only numpy.)

- [ ] **Step 2: Write the failing test**

Create `research/tests/test_seeds.py`:
```python
import numpy as np
from ksbio.seeds import set_global_seed

def test_seed_makes_numpy_deterministic():
    set_global_seed(42)
    a = np.random.rand(5)
    set_global_seed(42)
    b = np.random.rand(5)
    assert np.allclose(a, b)

def test_different_seed_differs():
    set_global_seed(1)
    a = np.random.rand(5)
    set_global_seed(2)
    b = np.random.rand(5)
    assert not np.allclose(a, b)
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_seeds.py -v`
Expected: FAIL — `ksbio.seeds` not found.

- [ ] **Step 4: Implement seeds**

Create `research/ksbio/__init__.py` (empty).
Create `research/ksbio/seeds.py`:
```python
"""Global seed control for reproducible experiments."""
import os
import random
import numpy as np

def set_global_seed(seed: int) -> None:
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
    except ImportError:
        pass  # torch not installed in foundation phase
```

Also create `research/tests/__init__.py` (empty) and a `research/conftest.py` so `ksbio` is importable:
```python
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_seeds.py -v`
Expected: PASS, 2 passed.

- [ ] **Step 6: Write README**

Create `research/README.md`:
```markdown
# Keystroke Biometrics — Research Harness

Reproducible training + evaluation. Always call `set_global_seed` first.

## Setup
    cd research
    python -m venv .venv
    # Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
    pip install -r requirements.txt

## Run tests
    python -m pytest tests/ -v
```

- [ ] **Step 7: Commit**

```bash
git add research/
git commit -m "feat(research): harness skeleton with deterministic seeds"
```

---

## Task 4: Port the statistical ensemble to Python (with parity test)

**Why:** The Python service and harness both need the verifier. We port the existing JS `linearAlgebra.js` + `classifierEngine.js` + `scoreFusion.js` and prove parity against hand-computed values so behavior is preserved.

**Files:**
- Create: `research/ksbio/ensemble.py`
- Test: `research/tests/test_ensemble_parity.py`

- [ ] **Step 1: Write the failing parity test**

Create `research/tests/test_ensemble_parity.py`:
```python
import numpy as np
from ksbio.ensemble import (
    scaled_manhattan, scaled_euclidean, compute_profile_stats,
    ledoit_wolf_shrinkage, mahalanobis_distance,
)

def test_scaled_manhattan_matches_hand_calc():
    # mean=[0,0], mad=[1,2]; test=[1,2] -> (|1-0|/1 + |2-0|/2)/2 = (1+1)/2 = 1.0
    profile = {"means": np.array([0.0, 0.0]), "mads": np.array([1.0, 2.0])}
    test = np.array([1.0, 2.0])
    assert abs(scaled_manhattan(test, profile) - 1.0) < 1e-9

def test_scaled_euclidean_matches_hand_calc():
    # sqrt(((1/1)^2 + (2/2)^2)/2) = sqrt((1+1)/2) = 1.0
    profile = {"means": np.array([0.0, 0.0]), "mads": np.array([1.0, 2.0])}
    test = np.array([1.0, 2.0])
    assert abs(scaled_euclidean(test, profile) - 1.0) < 1e-9

def test_compute_profile_stats_shapes():
    vecs = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])
    stats = compute_profile_stats(vecs)
    assert np.allclose(stats["means"], [3.0, 4.0])
    assert stats["mads"].shape == (2,)

def test_ledoit_wolf_inverse_is_well_conditioned():
    rng = np.random.default_rng(0)
    vecs = rng.normal(size=(20, 5))
    res = ledoit_wolf_shrinkage(vecs)
    assert res["inverse"] is not None
    prod = res["shrunk_cov"] @ res["inverse"]
    assert np.allclose(prod, np.eye(5), atol=1e-6)

def test_mahalanobis_zero_at_mean():
    rng = np.random.default_rng(1)
    vecs = rng.normal(size=(30, 4))
    res = ledoit_wolf_shrinkage(vecs)
    d = mahalanobis_distance(res["mean"], res["mean"], res["inverse"])
    assert abs(d) < 1e-9
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_ensemble_parity.py -v`
Expected: FAIL — `ksbio.ensemble` not found.

- [ ] **Step 3: Implement the ensemble (NumPy port)**

Create `research/ksbio/ensemble.py`:
```python
"""NumPy port of the JS statistical ensemble (classifierEngine, linearAlgebra,
scoreFusion). Parity-tested against hand-computed values. Source of truth for the
verifier used by both the inference service and the research harness."""
import numpy as np

_EPS = 1e-10

def scaled_manhattan(test, profile):
    means, mads = profile["means"], profile["mads"]
    mask = mads >= _EPS
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs(test[mask] - means[mask]) / mads[mask]))

def scaled_euclidean(test, profile):
    means, mads = profile["means"], profile["mads"]
    mask = mads >= _EPS
    if not mask.any():
        return 0.0
    z = (test[mask] - means[mask]) / mads[mask]
    return float(np.sqrt(np.mean(z * z)))

def compute_profile_stats(raw_vectors):
    v = np.asarray(raw_vectors, dtype=float)
    means = v.mean(axis=0)
    medians = np.median(v, axis=0)
    std_devs = v.std(axis=0, ddof=1) if v.shape[0] > 1 else np.zeros(v.shape[1])
    mads = np.mean(np.abs(v - means), axis=0)
    mad_medians = np.mean(np.abs(v - medians), axis=0)
    return {"means": means, "medians": medians, "std_devs": std_devs,
            "mads": mads, "mad_medians": mad_medians}

def ledoit_wolf_shrinkage(samples):
    x = np.asarray(samples, dtype=float)
    n, p = x.shape
    mean = x.mean(axis=0)
    xc = x - mean
    s = (xc.T @ xc) / (n - 1 if n > 1 else 1)
    mu = np.trace(s) / p
    pi_sum = 0.0
    for i in range(n):
        outer = np.outer(xc[i], xc[i])
        diff = outer - s
        pi_sum += np.sum(diff * diff)
    pi_sum /= (n * n)
    target = mu * np.eye(p)
    gamma = np.sum((s - target) ** 2)
    alpha = min(1.0, pi_sum / gamma) if gamma > 0 else 1.0
    alpha = max(0.0, alpha)
    shrunk = (1 - alpha) * s + alpha * target
    try:
        inverse = np.linalg.inv(shrunk)
    except np.linalg.LinAlgError:
        inverse = None
    return {"shrunk_cov": shrunk, "inverse": inverse, "mean": mean, "alpha": alpha}

def mahalanobis_distance(x, mean, cov_inverse):
    diff = np.asarray(x, float) - np.asarray(mean, float)
    d2 = float(diff @ cov_inverse @ diff)
    return float(np.sqrt(max(0.0, d2)))
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_ensemble_parity.py -v`
Expected: PASS, 5 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/ensemble.py research/tests/test_ensemble_parity.py
git commit -m "feat(research): NumPy port of statistical ensemble with parity tests"
```

---

## Task 5: EER / FAR / FRR metrics

**Files:**
- Create: `research/ksbio/metrics.py`
- Test: `research/tests/test_metrics.py`

- [ ] **Step 1: Write the failing test**

Create `research/tests/test_metrics.py`:
```python
import numpy as np
from ksbio.metrics import equal_error_rate, far_frr_at_threshold

def test_perfect_separation_zero_eer():
    genuine = np.array([0.1, 0.2, 0.15])
    impostor = np.array([0.8, 0.9, 0.85])
    eer, thr = equal_error_rate(genuine, impostor)
    assert eer < 1e-6

def test_complete_overlap_high_eer():
    genuine = np.array([0.5, 0.5, 0.5])
    impostor = np.array([0.5, 0.5, 0.5])
    eer, thr = equal_error_rate(genuine, impostor)
    assert eer > 0.4

def test_far_frr_at_threshold():
    # lower score = more genuine; accept if score <= threshold
    genuine = np.array([0.1, 0.2, 0.3])
    impostor = np.array([0.4, 0.5, 0.6])
    far, frr = far_frr_at_threshold(genuine, impostor, 0.35)
    assert far == 0.0
    assert frr == 0.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_metrics.py -v`
Expected: FAIL — `ksbio.metrics` not found.

- [ ] **Step 3: Implement metrics**

Create `research/ksbio/metrics.py`:
```python
"""Biometric error metrics. Convention: LOWER score = more genuine.
A sample is ACCEPTED when score <= threshold."""
import numpy as np

def far_frr_at_threshold(genuine, impostor, threshold):
    genuine = np.asarray(genuine, float)
    impostor = np.asarray(impostor, float)
    frr = float(np.mean(genuine > threshold)) if genuine.size else 0.0
    far = float(np.mean(impostor <= threshold)) if impostor.size else 0.0
    return far, frr

def equal_error_rate(genuine, impostor):
    """Sweep thresholds; return (EER, threshold) where FAR is closest to FRR."""
    genuine = np.asarray(genuine, float)
    impostor = np.asarray(impostor, float)
    candidates = np.unique(np.concatenate([genuine, impostor]))
    lo = candidates.min() - 1e-6
    hi = candidates.max() + 1e-6
    thresholds = np.concatenate([[lo], candidates, [hi]])
    best_eer, best_thr, best_gap = 1.0, float(thresholds[0]), np.inf
    for thr in thresholds:
        far, frr = far_frr_at_threshold(genuine, impostor, thr)
        gap = abs(far - frr)
        if gap < best_gap:
            best_gap, best_eer, best_thr = gap, (far + frr) / 2.0, float(thr)
    return best_eer, best_thr
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_metrics.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add research/ksbio/metrics.py research/tests/test_metrics.py
git commit -m "feat(research): EER/FAR/FRR metrics"
```

---

## Task 6: CMU dataset loader + deterministic split

**Note:** The real CMU `DSL-StrongPasswordData.csv` is downloaded separately (not committed). The loader is tested against a small synthetic fixture so tests need zero external data.

**Files:**
- Create: `research/ksbio/data/__init__.py`, `research/ksbio/data/cmu.py`
- Create: `research/tests/fixtures/cmu_mini.csv`
- Test: `research/tests/test_cmu_loader.py`

- [ ] **Step 1: Create the synthetic fixture**

Create `research/tests/fixtures/cmu_mini.csv`:
```
subject,sessionIndex,rep,H.period,DD.period.t,UD.period.t,H.t
s001,1,1,0.10,0.30,0.20,0.09
s001,1,2,0.11,0.31,0.21,0.08
s002,1,1,0.20,0.50,0.40,0.18
s002,1,2,0.22,0.52,0.41,0.19
```

- [ ] **Step 2: Write the failing test**

Create `research/tests/test_cmu_loader.py`:
```python
import os
import numpy as np
from ksbio.data.cmu import load_cmu, genuine_impostor_split

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "cmu_mini.csv")

def test_load_returns_per_subject_matrices():
    data = load_cmu(FIXTURE)
    assert set(data.keys()) == {"s001", "s002"}
    assert data["s001"].shape[0] == 2  # 2 reps
    assert data["s001"].shape[1] == 4  # 4 timing columns

def test_split_is_deterministic():
    data = load_cmu(FIXTURE)
    a = genuine_impostor_split(data, target="s001", seed=42)
    b = genuine_impostor_split(data, target="s001", seed=42)
    assert np.allclose(a["genuine_train"], b["genuine_train"])
    assert np.allclose(a["impostor"], b["impostor"])

def test_split_separates_target_from_others():
    data = load_cmu(FIXTURE)
    s = genuine_impostor_split(data, target="s001", seed=0)
    assert s["impostor"].shape[0] == 2  # only s002 rows
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd research && python -m pytest tests/test_cmu_loader.py -v`
Expected: FAIL — `ksbio.data.cmu` not found.

- [ ] **Step 4: Implement the loader**

Create `research/ksbio/data/__init__.py` (empty).
Create `research/ksbio/data/cmu.py`:
```python
"""CMU Killourhy-Maxion loader. Timing columns are those prefixed H./DD./UD.
Returns {subject: ndarray[n_reps, n_features]}."""
import csv
import numpy as np
from ..seeds import set_global_seed

_TIMING_PREFIXES = ("H.", "DD.", "UD.")

def load_cmu(path):
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        cols = [c for c in reader.fieldnames if c.startswith(_TIMING_PREFIXES)]
        by_subject = {}
        for row in reader:
            subj = row["subject"]
            vec = [float(row[c]) for c in cols]
            by_subject.setdefault(subj, []).append(vec)
    return {s: np.array(v, dtype=float) for s, v in by_subject.items()}

def genuine_impostor_split(data, target, seed=42, train_frac=0.5):
    set_global_seed(seed)
    genuine = data[target]
    n = genuine.shape[0]
    idx = np.random.permutation(n)
    cut = max(1, int(n * train_frac))
    train_idx, test_idx = idx[:cut], idx[cut:]
    impostor = np.vstack([m for s, m in data.items() if s != target])
    return {
        "genuine_train": genuine[train_idx],
        "genuine_test": genuine[test_idx],
        "impostor": impostor,
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd research && python -m pytest tests/test_cmu_loader.py -v`
Expected: PASS, 3 passed.

- [ ] **Step 6: Commit**

```bash
git add research/ksbio/data/ research/tests/test_cmu_loader.py research/tests/fixtures/cmu_mini.csv
git commit -m "feat(research): CMU loader with deterministic split + synthetic fixture"
```

---

## Task 7: Python inference service — contract + health

**Files:**
- Create: `ml-service/requirements.txt`, `ml-service/README.md`
- Create: `ml-service/app/__init__.py`, `ml-service/app/contract.py`, `ml-service/app/main.py`, `ml-service/app/model.py`
- Test: `ml-service/tests/test_health.py`, `ml-service/tests/test_contract.py`
- Create: `ml-service/conftest.py`

**Note:** Tasks 7 and 8 are done together — `main.py` imports `model.py`, so `model.py` (Task 8) is created here too. The stub embedder body is filled in Task 8; in Task 7 create `model.py` with constants + a placeholder embedder.

- [ ] **Step 1: Write requirements**

Create `ml-service/requirements.txt`:
```
fastapi==0.115.6
uvicorn==0.34.0
pydantic==2.10.4
numpy==2.1.3
httpx==0.28.1
pytest==8.3.4
```

- [ ] **Step 2: conftest for imports**

Create `ml-service/conftest.py`:
```python
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
```

- [ ] **Step 3: Write the failing contract + health tests**

Create `ml-service/tests/test_contract.py`:
```python
from app.contract import EmbedRequest, EmbedResponse, Keystroke

def test_embed_request_parses():
    req = EmbedRequest(
        keystrokes=[Keystroke(char="a", keyCode="KeyA", downTime=1.0,
                              upTime=1.1, position=0, isCorrect=True)],
        modelVersion="stub-0",
    )
    assert req.modelVersion == "stub-0"
    assert len(req.keystrokes) == 1

def test_embed_response_shape():
    resp = EmbedResponse(embedding=[0.0] * 128, modelVersion="stub-0")
    assert len(resp.embedding) == 128
```

Create `ml-service/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "modelVersion" in body
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd ml-service && python -m pytest tests/ -v`
Expected: FAIL — `app` module not found.

- [ ] **Step 5: Implement the contract**

Create `ml-service/app/__init__.py` (empty).
Create `ml-service/app/contract.py`:
```python
"""Wire contract between the Node app and the inference service (spec section 6.2)."""
from pydantic import BaseModel, Field

EMBED_DIM = 128

class Keystroke(BaseModel):
    char: str
    keyCode: str
    downTime: float
    upTime: float
    position: int
    isCorrect: bool

class EmbedRequest(BaseModel):
    keystrokes: list[Keystroke]
    modelVersion: str

class EmbedResponse(BaseModel):
    embedding: list[float] = Field(min_length=EMBED_DIM, max_length=EMBED_DIM)
    modelVersion: str

class EmbedBatchRequest(BaseModel):
    windows: list[list[Keystroke]]
    modelVersion: str

class EmbedBatchResponse(BaseModel):
    embeddings: list[list[float]]
    modelVersion: str

class Profile(BaseModel):
    centroid: list[float]
    covInverse: list[list[float]] | None = None
    refs: list[list[float]]
    threshold: float

class VerifyRequest(BaseModel):
    embedding: list[float]
    profile: Profile
    modelVersion: str

class VerifyResponse(BaseModel):
    score: float
    confidence: float
    riskLevel: str
    perComponent: dict[str, float]
```

- [ ] **Step 6: Implement model.py (constants + placeholder; body in Task 8)**

Create `ml-service/app/model.py`:
```python
"""Model loader interface. Body of the stub embedder is implemented in Task 8."""
MODEL_VERSION = "stub-0"
EMBED_DIM = 128

def device_name():
    return "cpu"

class StubEmbedder:
    version = MODEL_VERSION
    def embed(self, keystrokes):
        raise NotImplementedError  # implemented in Task 8

_EMBEDDER = StubEmbedder()

def get_embedder():
    return _EMBEDDER
```

- [ ] **Step 7: Implement main with health route**

Create `ml-service/app/main.py`:
```python
from fastapi import FastAPI
from .model import MODEL_VERSION, device_name

app = FastAPI(title="Keystroke Verification Inference Service")

@app.get("/health")
def health():
    return {"ok": True, "modelVersion": MODEL_VERSION, "device": device_name()}
```

- [ ] **Step 8: Run to verify health + contract pass**

Run: `cd ml-service && python -m pytest tests/test_contract.py tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add ml-service/requirements.txt ml-service/conftest.py ml-service/app/__init__.py ml-service/app/contract.py ml-service/app/model.py ml-service/app/main.py ml-service/tests/test_contract.py ml-service/tests/test_health.py
git commit -m "feat(ml-service): wire contract + health endpoint"
```

---

## Task 8: Deterministic STUB embedder + /embed + /embed_batch

**Why a stub:** The real model arrives in Plan 2. A *deterministic* stub (hash of timings → fixed unit vector) lets us build and test the entire service + Node integration now, and swap in the trained model later behind the same contract.

**Files:**
- Modify: `ml-service/app/model.py` (implement StubEmbedder.embed)
- Modify: `ml-service/app/main.py` (add /embed, /embed_batch)
- Test: `ml-service/tests/test_embed_stub.py`

- [ ] **Step 1: Write the failing test**

Create `ml-service/tests/test_embed_stub.py`:
```python
import math
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _ks(c, dt, ut):
    return {"char": c, "keyCode": "Key" + c.upper(), "downTime": dt,
            "upTime": ut, "position": 0, "isCorrect": True}

def test_embed_is_deterministic_and_128d():
    payload = {"keystrokes": [_ks("a", 1.0, 1.1), _ks("b", 1.3, 1.4)],
               "modelVersion": "stub-0"}
    r1 = client.post("/embed", json=payload)
    r2 = client.post("/embed", json=payload)
    assert r1.status_code == 200
    e1 = r1.json()["embedding"]
    assert len(e1) == 128
    assert e1 == r2.json()["embedding"]

def test_embed_differs_for_different_timings():
    a = client.post("/embed", json={"keystrokes": [_ks("a", 1.0, 1.1)],
                                    "modelVersion": "stub-0"}).json()["embedding"]
    b = client.post("/embed", json={"keystrokes": [_ks("a", 2.0, 2.5)],
                                    "modelVersion": "stub-0"}).json()["embedding"]
    assert a != b

def test_embed_is_l2_normalized():
    e = client.post("/embed", json={"keystrokes": [_ks("a", 1.0, 1.1)],
                                    "modelVersion": "stub-0"}).json()["embedding"]
    norm = math.sqrt(sum(x * x for x in e))
    assert abs(norm - 1.0) < 1e-6
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ml-service && python -m pytest tests/test_embed_stub.py -v`
Expected: FAIL — no /embed route (and NotImplementedError).

- [ ] **Step 3: Implement the stub embedder body**

Replace `ml-service/app/model.py` with:
```python
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
```

- [ ] **Step 4: Add embed routes to main**

Replace `ml-service/app/main.py` with:
```python
from fastapi import FastAPI
from .contract import (EmbedRequest, EmbedResponse, EmbedBatchRequest,
                       EmbedBatchResponse)
from .model import MODEL_VERSION, device_name, get_embedder

app = FastAPI(title="Keystroke Verification Inference Service")

@app.get("/health")
def health():
    return {"ok": True, "modelVersion": MODEL_VERSION, "device": device_name()}

@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    vec = get_embedder().embed(req.keystrokes)
    return EmbedResponse(embedding=vec, modelVersion=MODEL_VERSION)

@app.post("/embed_batch", response_model=EmbedBatchResponse)
def embed_batch(req: EmbedBatchRequest):
    emb = get_embedder()
    vecs = [emb.embed(w) for w in req.windows]
    return EmbedBatchResponse(embeddings=vecs, modelVersion=MODEL_VERSION)
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd ml-service && python -m pytest tests/ -v`
Expected: PASS — health, contract, embed stub all green.

- [ ] **Step 6: Commit**

```bash
git add ml-service/app/model.py ml-service/app/main.py ml-service/tests/test_embed_stub.py
git commit -m "feat(ml-service): deterministic stub embedder + /embed + /embed_batch"
```

---

## Task 9: /verify endpoint using the ported ensemble

**Dependency note:** `/verify` reuses the ensemble math. For deploy simplicity the service keeps a **self-contained copy** of the needed functions in `app/verify.py`; the canonical version + parity tests live in `research/ksbio/ensemble.py` (Task 4).

**Files:**
- Create: `ml-service/app/verify.py`
- Modify: `ml-service/app/main.py` (add /verify)
- Test: `ml-service/tests/test_verify.py`

- [ ] **Step 1: Write the failing test**

Create `ml-service/tests/test_verify.py`:
```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _profile():
    return {
        "centroid": [0.0, 0.0, 0.0, 0.0],
        "covInverse": [[1.0,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],
        "refs": [[0.01,0,0,0],[0,0.01,0,0],[0.0,0,0.01,0]],
        "threshold": 1.0,
    }

def test_verify_genuine_low_score():
    payload = {"embedding": [0.02, 0.0, 0.0, 0.0],
               "profile": _profile(), "modelVersion": "stub-0"}
    r = client.post("/verify", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["score"] < 1.0
    assert body["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}
    assert 0.0 <= body["confidence"] <= 100.0

def test_verify_impostor_high_score():
    payload = {"embedding": [5.0, 5.0, 5.0, 5.0],
               "profile": _profile(), "modelVersion": "stub-0"}
    r = client.post("/verify", json=payload)
    body = r.json()
    assert body["score"] > 1.0
    assert body["riskLevel"] == "HIGH"
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ml-service && python -m pytest tests/test_verify.py -v`
Expected: FAIL — no /verify route.

- [ ] **Step 3: Implement verify**

Create `ml-service/app/verify.py`:
```python
"""Verification decision in embedding space (spec section 5.2). Self-contained
copy of the ensemble functions; canonical version + parity tests live in
research/ksbio/ensemble.py."""
import math

def _l1_to_centroid(z, centroid):
    return sum(abs(a - b) for a, b in zip(z, centroid)) / len(z)

def _mahalanobis(z, centroid, cov_inv):
    diff = [a - b for a, b in zip(z, centroid)]
    tmp = [sum(cov_inv[i][j] * diff[j] for j in range(len(diff)))
           for i in range(len(diff))]
    d2 = sum(diff[i] * tmp[i] for i in range(len(diff)))
    return math.sqrt(max(0.0, d2))

def _knn(z, refs, k=3):
    dists = sorted(sum(abs(a - b) for a, b in zip(z, r)) / len(z) for r in refs)
    k = min(k, len(dists))
    return sum(dists[:k]) / k if k else 0.0

def _confidence(score, threshold, k=5.0):
    if threshold <= 0:
        return 100.0 if score <= 0.1 else 0.0
    val = 100.0 / (1.0 + math.exp(k * (score / threshold - 1.0)))
    return round(min(100.0, max(0.0, val)), 2)

def verify(embedding, profile):
    centroid = profile["centroid"]
    refs = profile["refs"]
    threshold = profile["threshold"]
    cov_inv = profile.get("covInverse")

    manhattan = _l1_to_centroid(embedding, centroid)
    knn = _knn(embedding, refs)
    maha = _mahalanobis(embedding, centroid, cov_inv) if cov_inv else manhattan

    components = {"manhattan": manhattan, "knn": knn, "maha": maha}
    score = sum(components.values()) / len(components)

    confidence = _confidence(score, threshold)
    risk = "LOW" if confidence >= 85 else "MEDIUM" if confidence >= 50 else "HIGH"
    return {"score": score, "confidence": confidence, "riskLevel": risk,
            "perComponent": components}
```

- [ ] **Step 4: Add /verify route to main**

Append to `ml-service/app/main.py` (and add imports at top):
```python
from .contract import VerifyRequest, VerifyResponse
from .verify import verify as run_verify

@app.post("/verify", response_model=VerifyResponse)
def verify_endpoint(req: VerifyRequest):
    p = {"centroid": req.profile.centroid, "refs": req.profile.refs,
         "threshold": req.profile.threshold, "covInverse": req.profile.covInverse}
    result = run_verify(req.embedding, p)
    return VerifyResponse(**result)
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd ml-service && python -m pytest tests/ -v`
Expected: PASS — all service tests green.

- [ ] **Step 6: Commit**

```bash
git add ml-service/app/verify.py ml-service/app/main.py ml-service/tests/test_verify.py
git commit -m "feat(ml-service): /verify endpoint using ported ensemble"
```

---

## Task 10: Node → Python service client (feature-flagged, no behavior change)

**Files:**
- Create: `config/mlService.js`, `services/mlServiceClient.js`
- Test: `tests/services/mlServiceClient.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/services/mlServiceClient.test.js`:
```javascript
const { isEnabled, embed } = require('../../services/mlServiceClient');

describe('mlServiceClient', () => {
  test('disabled by default when ML_SERVICE_URL unset', () => {
    delete process.env.ML_SERVICE_URL;
    expect(isEnabled()).toBe(false);
  });

  test('enabled when ML_SERVICE_URL set', () => {
    process.env.ML_SERVICE_URL = 'http://localhost:8000';
    expect(isEnabled()).toBe(true);
    delete process.env.ML_SERVICE_URL;
  });

  test('embed throws clear error when disabled', async () => {
    delete process.env.ML_SERVICE_URL;
    await expect(embed([], 'stub-0')).rejects.toThrow(/not configured/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/services/mlServiceClient.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement config**

Create `config/mlService.js`:
```javascript
module.exports = {
  baseUrl: () => process.env.ML_SERVICE_URL || null,
  serviceToken: () => process.env.ML_SERVICE_TOKEN || null,
  timeoutMs: () => parseInt(process.env.ML_SERVICE_TIMEOUT_MS || '4000', 10),
};
```

- [ ] **Step 4: Implement the client**

Create `services/mlServiceClient.js`:
```javascript
/**
 * Typed client for the Python inference service (spec section 6.2).
 * Feature-flagged: a no-op unless ML_SERVICE_URL is configured, so wiring this
 * in changes NO behavior until we explicitly enable it.
 * Fail-safe: callers must treat a thrown error as "indeterminate, not pass".
 */
const cfg = require('../config/mlService');

function isEnabled() {
  return !!cfg.baseUrl();
}

async function _post(path, body) {
  if (!isEnabled()) {
    throw new Error('ML service not configured (ML_SERVICE_URL unset)');
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), cfg.timeoutMs());
  try {
    const res = await fetch(cfg.baseUrl() + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.serviceToken() ? { 'X-Service-Token': cfg.serviceToken() } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ML service ${path} returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function embed(keystrokes, modelVersion) {
  return _post('/embed', { keystrokes, modelVersion });
}

async function embedBatch(windows, modelVersion) {
  return _post('/embed_batch', { windows, modelVersion });
}

async function verify(embedding, profile, modelVersion) {
  return _post('/verify', { embedding, profile, modelVersion });
}

module.exports = { isEnabled, embed, embedBatch, verify };
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/services/mlServiceClient.test.js`
Expected: PASS, 3 passed.

- [ ] **Step 6: Run the full Node test suite**

Run: `npm test`
Expected: PASS — smoke, auth, client tests all green.

- [ ] **Step 7: Commit**

```bash
git add config/mlService.js services/mlServiceClient.js tests/services/mlServiceClient.test.js
git commit -m "feat: feature-flagged Node client for the Python inference service"
```

---

## Task 11: Modal deployment config (stub, not deployed)

**Files:**
- Create: `ml-service/modal_app.py`, `ml-service/.env.example`
- Modify: `ml-service/README.md`

- [ ] **Step 1: Write the Modal app definition**

Create `ml-service/modal_app.py`:
```python
"""Modal deployment wrapper for the inference service.
Deploy:  modal deploy modal_app.py
Not invoked by tests; documents the deploy path. GPU added in Plan 2."""
import modal

image = (modal.Image.debian_slim()
         .pip_install_from_requirements("requirements.txt"))

app = modal.App("keystroke-inference")

@app.function(image=image)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as fastapi
    return fastapi
```

- [ ] **Step 2: Write env example**

Create `ml-service/.env.example`:
```
# Node app reads these to talk to the service:
ML_SERVICE_URL=https://your-modal-app.modal.run
ML_SERVICE_TOKEN=change-me
ML_SERVICE_TIMEOUT_MS=4000
```

- [ ] **Step 3: Document in README**

Create/append `ml-service/README.md`:
```markdown
# Keystroke Verification Inference Service

Stateless FastAPI service. Serves a deterministic stub embedder in the foundation
phase (Plan 1); the trained PyTorch model + GPU arrive in Plan 2 behind the same
wire contract.

## Run locally
    cd ml-service
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

## Test
    python -m pytest tests/ -v

## Deploy (Modal)
    pip install modal && modal token new
    modal deploy modal_app.py
```

- [ ] **Step 4: Commit**

```bash
git add ml-service/modal_app.py ml-service/.env.example ml-service/README.md
git commit -m "chore(ml-service): Modal deploy config + local run docs (stub model)"
```

---

## Task 12: Foundation integration verification

**Files:**
- Create: `ml-service/tests/test_integration_smoke.py`

- [ ] **Step 1: Write an end-to-end smoke test (embed → build mini profile → verify)**

Create `ml-service/tests/test_integration_smoke.py`:
```python
"""Foundation acceptance: the embed->profile->verify loop works end-to-end with
the stub model. Proves the plumbing before the real model lands.

HONEST NOTE: the stub (hash-based) embedder does NOT preserve locality, so
near-identical inputs do not yield near-identical embeddings. This test asserts
the loop RUNS and returns well-formed output — NOT that self-scores are low.
That property is validated in Plan 2 with the real model."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _ks(c, dt, ut):
    return {"char": c, "keyCode": "Key" + c.upper(), "downTime": dt,
            "upTime": ut, "position": 0, "isCorrect": True}

def _window(offset):
    return [_ks("t", 1.0 + offset, 1.08 + offset),
            _ks("h", 1.3 + offset, 1.36 + offset),
            _ks("e", 1.6 + offset, 1.69 + offset)]

def test_enroll_then_verify_returns_well_formed_output():
    windows = [_window(i * 0.001) for i in range(5)]
    r = client.post("/embed_batch",
                    json={"windows": windows, "modelVersion": "stub-0"})
    refs = r.json()["embeddings"]
    dim = len(refs[0])
    centroid = [sum(v[j] for v in refs) / len(refs) for j in range(dim)]
    profile = {"centroid": centroid, "covInverse": None,
               "refs": refs, "threshold": 0.5}
    z = client.post("/embed",
                    json={"keystrokes": _window(0.0005),
                          "modelVersion": "stub-0"}).json()["embedding"]
    v = client.post("/verify",
                    json={"embedding": z, "profile": profile,
                          "modelVersion": "stub-0"}).json()
    assert v["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}
    assert "score" in v and "confidence" in v
    assert len(z) == 128
```

- [ ] **Step 2: Run it**

Run: `cd ml-service && python -m pytest tests/test_integration_smoke.py -v`
Expected: PASS.

- [ ] **Step 3: Run ALL test suites**

- Node: `npm test` → all green.
- Research: `cd research && python -m pytest tests/ -v` → all green.
- Service: `cd ml-service && python -m pytest tests/ -v` → all green.

- [ ] **Step 4: Commit**

```bash
git add ml-service/tests/test_integration_smoke.py
git commit -m "test(ml-service): foundation embed->profile->verify integration smoke"
```

---

## Done Criteria (Plan 1)

- [ ] `npm test` green: smoke, auth-fix, ml client.
- [ ] `research/` tests green: seeds, ensemble parity, metrics, CMU loader.
- [ ] `ml-service/` tests green: contract, health, embed stub, verify, integration.
- [ ] The JWT auth bug is fixed (no `req.session.userId` in keystroke controllers).
- [ ] Python service runs locally (`uvicorn`) and answers `/health` `/embed` `/embed_batch` `/verify`.
- [ ] Node has a feature-flagged client that changes NO existing behavior until `ML_SERVICE_URL` is set.
- [ ] Modal deploy path documented (not yet deployed; GPU + real model in Plan 2).

## What this plan deliberately does NOT do (→ Plan 2 / Plan 3)

- Real PyTorch model, training, CMU EER measurement (Plan 2).
- Free-text dataset + content-independent model (Plan 2).
- Enrollment UI, login step-up, session-guard chip, consent screen (Plan 3).
- Wiring the keystroke controllers to actually call the ML client in production
  request paths (Plan 3, once the real model is deployed).
```
