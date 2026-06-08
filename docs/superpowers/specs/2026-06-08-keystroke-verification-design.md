# Keystroke Biometric Verification — Design Spec

**Date:** 2026-06-08
**Status:** Approved (design); pending implementation plan
**Project:** Typing Sanctuary
**Author:** drafted with Claude Code

---

## 1. Goal & Scope

Build a genuinely state-of-the-art keystroke biometric verification system that
real users can use, backed by a strong deep model and a reproducible evaluation,
embodied in a polished web app. A research paper is a deferred (but explicitly
not-sabotaged) goal: reproducibility rigor is built in from day one so the paper
remains achievable later.

**In scope (now):**
- The verification **model** (deep metric-learning embedding + statistical verifier).
- The **web app** functionality so users can enroll, log in with typing as a
  second factor, and be continuously verified during a session.
- A **reproducible offline research/training harness** that produces the model.

**Deferred (not now, not blocked):**
- Writing the research paper itself.
- Live public demo as a *credibility* artifact (the app is the showcase, but
  numerical claims come from offline benchmarks, not live self-data).

**Explicit non-goals:**
- No cost optimization. Best engineering choice wins over cheapest.
- No rewrite of the existing Node app, game, auth, or social systems.

---

## 2. Key Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | Hybrid: Node app + Python (PyTorch) model service | Deep model + public datasets need Python; keep working Node app as product shell |
| Architecture | Two services + one frozen, versioned model artifact | Live product and reproducible research share one artifact via a clean seam |
| Model hosting | Dedicated always-on GPU host (Modal/Lambda/Fly GPU/Railway) | Cost no object; best inference + headroom |
| Headline model | Siamese/triplet metric-learning embedding (content-independent, free-text) | Open-set, data-efficient, modern biometric standard; defensible vs. Transformer |
| Encoder | 1-D temporal CNN stack + small BiGRU + attention pooling → 128-D | Data-efficient, reproducible, won't overfit at our scale |
| Decision layer | Existing hand-built Ledoit-Wolf + scaled-Manhattan ensemble, run **in the learned embedding space** | "Deep representation + classical calibrated verifier" hybrid; reuses prior work as a load-bearing component |
| Data plan | CMU Killourhy-Maxion (Phase 1 baseline) → public free-text corpus (Phase 2 contribution) | Comparable baseline first, novel contribution second |
| Product flows | Both: typing-as-login-factor (gate) + continuous identity guard | Fullest product; best showcase of the model |
| Reproducibility | Fixed seeds, saved splits, versioned artifacts, re-runnable eval | User requirement; also future paper requirement |
| Failure posture | Fail-safe, not fail-open; never hostile to genuine users | A security feature must not let everyone in on an outage |

---

## 3. System Architecture

Four components with clean boundaries:

1. **Browser (existing `public/` frontend)** — typing game (unchanged gameplay),
   enrollment UI, login step-up, session-guard indicator, keystroke capture lib.
2. **Node/Express app (existing — "product shell")** — JWT auth, users, game,
   social (unchanged); new enrollment + verify controllers; calls Python service;
   enforces decisions; owns all persistent state (Mongo).
3. **Python/FastAPI inference service (dedicated GPU host)** — loads the frozen,
   versioned model artifact; exposes `/embed`, `/verify`, `/embed_batch`,
   `/health`. **Stateless**: holds model in memory, stores nothing, logs no raw
   timings.
4. **Python research harness (offline, reproducible)** — datasets, training,
   evaluation; produces the versioned model artifact + metrics report.

```
Browser ──HTTPS(JWT)──> Node/Express ──HTTPS(service token)──> Python FastAPI (GPU)
                              │                                       ▲
                              └── Mongo (users, profiles,             │ loads artifact
                                  reference embeddings, audit log)    │
                                                          Python research harness (offline)
```

**The load-bearing boundary:** the **frozen model artifact**. The research
harness *produces* it reproducibly; the inference service *consumes* it. The live
app never trains and never touches a dataset; the research never touches the live
DB. One artifact, two worlds.

**Changes to existing code (surgical):**
- Fix `req.session.userId` → `req.userId` (JWT) in keystroke controllers — likely
  why the current engine fails in production.
- Repoint verification from in-JS ensemble to the Python service.
- Existing JS `featureEngineering.js` / `linearAlgebra.js` / `classifierEngine.js`
  are **retained as the Phase-1 baseline / control**, not deleted.

---

## 4. The Model

### 4.1 Input representation (content-independent)
A keystroke window = sequence of ~30–60 keystroke events. Per keystroke/pair:
- 4 core timings: **Hold** (down→up), **Down-Down**, **Up-Down (flight)**, **Up-Up**.
- learned **character embedding** (key identity; net learns keyboard geography).
- context flags (isCorrect; optionally hand/row).

Deliberately content-independent: the net sees *which keys + their timings* and
learns rhythm invariant to *what* is typed.

### 4.2 Embedding network (the "twin")
One network applied to multiple inputs ("Siamese" = shared weights, not two models):
- char-embedding + timing features → fused per-keystroke vector
- 1-D temporal CNN stack + small **BiGRU** (local digraph rhythm + longer cadence)
- attention pooling → single **128-D** vector, **L2-normalized** (distance = angle).

Chosen over a Transformer deliberately: more data-efficient, reproducible, lower
overfit risk at our data scale — every choice defensible.

### 4.3 Training objective
- **Triplet loss with online hard-negative mining** (anchor=you, positive=you,
  negative=other; penalize when impostor is closer than your own sample).
- small **center/variance regularizer** so each user's samples cluster tightly
  (stabilizes per-user thresholds downstream).

### 4.4 Two-phase training (matches data plan)
- **Phase 1 — CMU (fixed-text):** train + evaluate; first honest EER comparable to
  published work; proves pipeline end-to-end on clean data.
- **Phase 2 — free-text corpus:** retrain content-independent on windowed free
  typing → the continuous-verification model the app ships.

### 4.5 Reproducibility (baked in)
Fixed seeds everywhere; deterministic data splits saved to disk; every artifact
tagged with version + exact config + git commit; eval script re-runs to identical
numbers.

---

## 5. Verification Decision Logic

### 5.1 Enrollment (builds a profile; NO retraining)
1. User types ~10–15 windows of clean keystrokes; Node stores raw timings.
2. Node → Python `/embed_batch` → reference embeddings.
3. Node builds the **profile**:
   - reference embeddings (for k-NN in embedding space),
   - **centroid** (avg fingerprint),
   - **Ledoit-Wolf shrinkage covariance** over 128-D embeddings (variation directions),
   - **personal threshold** + confidence level.
4. Profile **versioned with the model version** that produced it. Model retrain ⇒
   old profiles flagged for re-enrollment (cross-version embeddings not comparable).

### 5.2 Computing a decision (core; used by both flows)
1. New window → `/embed` → test embedding **z**.
2. Ensemble verifier **in embedding space** vs. profile:
   - scaled-Manhattan / Euclidean to centroid,
   - **Mahalanobis** via shrinkage covariance,
   - **k-NN** to nearest reference embeddings (multi-modal typing).
3. **Fuse** sub-scores (existing `scoreFusion` logic) → raw score.
4. Normalize → **confidence %** via per-user calibration; compare to personal
   threshold → `{decision, confidence, riskLevel}`.

### 5.3 Per-user threshold (calibration)
Leave-one-out CV on the user's own reference embeddings → distribution of genuine
scores → threshold = percentile + safety margin. More data ⇒ tighter, higher
confidence.

**Honest measurement split (no overclaiming):**
- **Per-user data bounds false-*rejects*** (we have the user's genuine samples).
- **Public-benchmark data bounds false-*accepts* / EER** (we have labeled impostors).
- We never compute an EER from self-collected data.

### 5.4 Flow differences (only here)
- **Login gate:** one ~40–60 keystroke window, single decision; fail ⇒ second
  factor (re-type / email code), never hard-lock on one window.
- **Continuous guard:** rolling windows; track **smoothed risk (EWMA)** over
  several windows; sustained mismatch ⇒ step-up / flag; hysteresis prevents flapping.

Outputs always `{confidence 0–100, riskLevel LOW/MED/HIGH, action}` — never a bare
yes/no.

---

## 6. Data Flow & Service Contract

### 6.1 Capture payload (browser → Node), per window
```
{ windowId, keystrokes: [{ char, keyCode, downTime, upTime, position, isCorrect }],
  source: "enroll" | "login" | "guard", clientMeta }
```
`downTime`/`upTime` are `performance.now()` high-res; **Node derives** Hold/DD/UD/UU
(server-trusted timing, not client-computed).

### 6.2 Python service contract (Node → Python; internal; service-token auth)
```
POST /embed       { keystrokes:[…], modelVersion } → { embedding:[128], modelVersion }
POST /embed_batch { windows:[…], modelVersion }    → { embeddings:[[128]…], modelVersion }
POST /verify      { embedding:[…], profile:{centroid,covInverse,refs,threshold,calib},
                    modelVersion } → { score, confidence, riskLevel,
                                       perComponent:{maha,knn,manhattan} }
GET  /health → { ok, modelVersion, device }
```
Python is **stateless** (frozen model in memory; no storage; no raw-timing logs).
All state lives in Mongo via Node. **Default: Python owns `/verify`** so embedding +
decision are co-located and versioned together; Node keeps the JS ensemble only as
the Phase-1 baseline.

### 6.3 Flows
- **Enrollment:** N windows → store raw → `/embed_batch` → build profile → save
  versioned profile. No training. Seconds.
- **Login gate:** existing JWT password check → type short passage → `/embed` +
  `/verify` → LOW ⇒ issue JWT; MED/HIGH ⇒ step-up (re-type or email code; ≤2 tries).
- **Continuous guard:** post a window every ~30–60 keys (throttled, background) →
  `/verify` → EWMA risk → sustained HIGH ⇒ step-up / flag. Single bad windows absorbed.

### 6.4 Failure handling (critical)
- Python unreachable/timeout ⇒ verification **indeterminate, NOT pass**. Login ⇒
  require fallback factor. Guard ⇒ log "unverified," don't eject an active user over
  an outage. (Fail safe, not hostile.)
- `modelVersion` mismatch (request vs. profile) ⇒ reject with "re-enrollment
  needed"; never score across versions.
- All decisions → **audit log** (timestamp, score, version, action) for tuning,
  debugging, future paper.

### 6.5 Privacy / consent
Explicit consent before any capture; opt-out wipes samples + profile; raw
keystrokes stored only with consent and retention-capped. (Schema already has
consent/opt-out fields.)

---

## 7. Web App UX & Affected Pages

### 7.1 Consent + onboarding (new, lightweight)
One clear screen: what's captured (timings, not content), why, opt-out anytime.
Writes consent record.

### 7.2 Enrollment — two paths, same backend
- **Passive (primary):** normal game runs quietly contribute windows; subtle
  progress meter ("Typing profile: 7/12 — keep playing"). Zero extra friction.
- **Active (optional booster):** "Enroll now" wizard, 3–4 short passages, live
  progress, "profile ready" celebration. Reuses existing keystroke-training page,
  rewired.
- Profile page: enrollment status, profile strength/confidence, toggle to **enable
  typing as a login factor** (off by default; opt-in).

### 7.3 Login step-up (modifies existing login)
- Normal: password → short passage → LOW ⇒ straight in (~1s extra).
- Doubt (MED/HIGH): calm, non-accusatory step-up ("type once more" / "email a
  code"); ≤2 tries before email code. **Never** "ACCESS DENIED." Tone = assist.
- Outage: silently fall to email code.

### 7.4 Session-guard indicator (new, subtle)
Status chip in nav: "🛡 Identity verified" (LOW) ↔ "Verifying…". Sustained HIGH ⇒
quiet modal "confirm it's you" ⇒ step-up. Chip is also the **consent surface**
(click ⇒ what's monitored, pause/opt-out). Framed as protection the user owns.

### 7.5 Profile / dashboard additions (extends existing profile page)
Profile strength, last-verification confidence, recent decision history (surface
`testingHistory`/audit log). Optional "**Try to fool it**" mode = existing
impostor-challenge, kept as an *engagement game*, clearly NOT a security claim.

### 7.6 Pages affected (surgical)
- `login` → add step-up step.
- `keystroke-training` → rewire to new enrollment backend.
- `profile` → enrollment/strength/history + login-factor toggle.
- nav/layout → guard chip.
- New: consent screen, step-up modal.
- Game pages → emit keystroke windows for passive enrollment + guard (capture hook
  only; gameplay unchanged).

---

## 8. Staging Seam (if ever needed)

Time is not the constraint, so the plan builds everything. But the natural cut line
if staging is ever required: **login-gate first (fully usable product)** →
**continuous-guard second** (most novel, most UX-delicate).

---

## 9. Open Items / Dependencies

- **Free-text corpus access** (Buffalo/Clarkson) may need an academic data-use
  request; start early in Phase 1 so it's in hand for Phase 2. Fallback: build the
  free-text evaluation on data the game collects at scale (plan B, not plan A).
- GPU host provider selection (Modal vs. Lambda vs. Fly GPU vs. Railway) —
  finalized in the implementation plan.
- Exact window size (30 vs. 60) and embedding dim (128) to be confirmed
  empirically in Phase 1; values above are the starting defaults.

---

## 10. Definition of Done (this phase)

- Users can: consent → enroll (passive or active) → enable typing login factor →
  log in with password + typing → be continuously guarded during a session, with
  assistive (non-hostile) recovery on doubt and safe behavior on outage.
- A trained, **versioned** model artifact exists, produced by a **re-runnable**
  harness with fixed seeds and saved splits.
- Phase-1 EER measured on the CMU benchmark and recorded honestly.
- All verification decisions audit-logged; privacy/consent enforced.
