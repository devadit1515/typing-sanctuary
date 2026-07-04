# PROJECT HANDOFF — Typing Sanctuary / Keystroke-Biometric Verification

> **Read this first.** This file is the single entry point for a fresh session. It tells you
> what this project is, *why* it exists (a CREST Gold research award), what has been built and
> tested, what is deliberately **deferred** (and costs money — do not run it without explicit
> go-ahead), and exactly how to resume. The deeper sources of truth are the spec and plan docs
> linked in [§12 Pointers](#12-pointers); this file is the index that ties them together.
>
> **Status snapshot (as of latest commit `b45364a`):** branch `feat/keystroke-verification`,
> **49 commits ahead of `main`**, working tree clean. Tests **all green**: research **65**,
> ml-service **22**, Node **16** → **103 total**. The model **has now been trained on the real CMU
> data on local CPU (zero spend)**, so the **measured open-set EER exists**: **0.1422 ± 0.0279**
> (primary scaled-Manhattan) / **0.1016 ± 0.0097** (full ensemble) vs the 0.0962 published baseline —
> see [§6](#6-whats-done--plan-1--plan-2) and `research/artifacts/metrics.json`. The **CREST Gold
> report is written and built** ([`CREST_Gold_Report.md`](CREST_Gold_Report.md) + `.docx`, with the
> DET and t-SNE figures embedded) alongside the Student Profile Form. What remains billable is the
> **Modal GPU deploy** and a **real free-text (Aalto) run** — see
> [§7](#7-what-is-deferred--billable-user-triggered-only).

---

## Table of Contents

1. [What this project is](#1-what-this-project-is)
2. [The CREST Gold goal](#2-the-crest-gold-goal)
3. [Architecture (hybrid, decided)](#3-architecture-hybrid-decided)
4. [The frozen wire contract (DO NOT BREAK)](#4-the-frozen-wire-contract-do-not-break)
5. [Repository map](#5-repository-map)
6. [What's done — Plan 1 + Plan 2](#6-whats-done--plan-1--plan-2)
7. [What is DEFERRED — billable, user-triggered ONLY](#7-what-is-deferred--billable-user-triggered-only)
8. [Plan 3 — not yet written (future)](#8-plan-3--not-yet-written-future)
9. [Decision log & honesty rules](#9-decision-log--honesty-rules)
10. [Environment & git hazards (OneDrive)](#10-environment--git-hazards-onedrive)
11. [How to resume (quickstart)](#11-how-to-resume-quickstart)
12. [Pointers](#12-pointers)

---

## 1. What this project is

**Typing Sanctuary** is a multiplayer typing game (Node.js + Express + Socket.io + MongoDB via
FerretDB/NeonDB, deployed on Render.com). Its distinguishing feature — and the reason this
codebase matters academically — is a **keystroke-biometric verification layer**: the system
learns *how* a person types (rhythm, hold times, flight times) and uses that as a behavioural
biometric to verify identity, both as a login gate and as a continuous session guard.

The **game is the product shell**. The **biometric rebuild is the research project**. Almost all
recent work is the research/biometric layer, living on branch `feat/keystroke-verification`. The
full game app (auth, friends, profiles, multiplayer rooms) is documented in the project memory —
see [§12 Pointers](#12-pointers) — and is *not* re-described here.

---

## 2. The CREST Gold goal

**This effort is aimed at a CREST Gold Award** (UK British Science Association research award).
This is the framing the next session must keep in view: the goal is not "more features" — it is a
**defensible research project with a written report that satisfies the CREST Gold criteria.** The
authoritative criteria reference is **[`Crest_Guidelines.md`](Crest_Guidelines.md)** at the repo
root (sourced from primary CREST pages). Read it.

**What CREST Gold requires (summary):**
- **15 criteria across 4 sections.** Threshold: demonstrate at least **11**, covering **all four
  sections**, at "acceptable standard or above".
- **~70 hours of work** — treat as a *floor*, not a target.
- **Depth over breadth.** CREST explicitly rewards **one tightly-scoped research question with a
  few well-justified sub-systems**, NOT a grab-bag of cool features. (Our scoped question: *can a
  content-independent deep keystroke-embedding verify identity, and does it beat the hand-built
  statistical baseline?*)
- **Deliverables:** a written **report** (aim → method → results → reflection); a **Student
  Profile Form** that maps each of the 15 criteria to specific report page numbers; **appendices**
  (raw data, code, figures); and an **AI-use disclosure** (every AI tool, what it did, dates, a
  representative prompt sample, and the human post-editing).

### Criteria-coverage map (engineering evidence vs. still-to-write)

| Criterion | Already supported by the engineering work | Still needs writing |
|---|---|---|
| **1.1** clear aim → objectives | scoped research question exists implicitly | ⚠️ write the aim as one testable sentence + 3–6 measurable sub-objectives as a bullet list |
| **1.2** wider purpose | behavioural biometrics for account security | ⚠️ name a concrete stakeholder/statistic/gap |
| **1.3** range of approaches | the hybrid-architecture decision (stat ensemble vs. deep model vs. hybrid) | ⚠️ write a trade-off table (cost/time/feasibility/risk) |
| **1.5** planned & organised time | git history gives real dates | ⚠️ **Gantt/timeline** — CREST rejects bare "I planned"; needs dated chart |
| **2.1** materials & people | CMU dataset, PyTorch, Modal, FastAPI all used | ⚠️ document each external resource by name |
| **2.2** sources & acknowledgement | CMU Killourhy-Maxion + free-text corpora cited in design | ⚠️ ≥10 sources, synthesise not summarise |
| **3.1 / 3.2** conclusions & decisions → outcome | the review-driven decisions are traceable | ⚠️ link each result to method → objective → implication |
| **3.3** reflection | — | ⚠️ ≥½ page: what was learnt, what you'd change |
| **4.1** science understanding | metric learning, triplet loss, EER all implemented | ⚠️ explain the science at the right level in the report |
| **4.2** ethics & safety decisions | **fail-safe / never-fail-open** design choice; honest-data split | ⚠️ substantive ethics subsection: consent, data ethics, dual-use of biometrics |
| **4.3** creative thinking | hand-built Ledoit-Wolf ensemble + content-independent embedding | ⚠️ explicitly call out the creative/novel choices |
| **4.4** identified & overcame problems | **the ~9 silent bugs the adversarial review caught** ([§9](#9-decision-log--honesty-rules)) — gold-tier "Problem X, root cause Y, fix Z, verified by W" evidence | ⚠️ write them up in a dedicated subsection |
| **(all)** AI-use | this whole build was AI-assisted (Claude Code) | ⚠️ **AI Use Statement** — mandatory, currently missing |

**Takeaway for the next session:** the *engineering* is largely a CREST asset already; the
*report artefacts* (decomposed aim, Gantt chart, ethics section, reflection, sources, AI-use
statement) are the gap. Several of these can be drafted now without spending any money.

---

## 3. Architecture (hybrid, decided)

A **three-part hybrid**:

1. **Node/Express product shell** — the existing game app. Owns users, sessions, the UI, and the
   request paths where verification will eventually be enforced.
2. **Stateless Python FastAPI inference service** (`ml-service/`) — loads a **frozen, versioned
   model artifact** and exposes `/embed`, `/embed_batch`, `/verify`, `/health`. Designed to run on
   a **Modal** GPU host. Stateless: profiles/enrollment live in the Node app's DB, not here.
3. **Offline Python research harness** (`research/`) — *produces* the artifact reproducibly
   (fixed seeds, recorded git commit + config). The service only ever *consumes* artifacts.

**Headline model:** a Siamese/triplet **content-independent** keystroke embedding (CNN + BiGRU +
attention → **128-D L2-normalized** vector), trained with batch-hard triplet loss + a center
regularizer. "Content-independent" = it learns *rhythm*, invariant to *what text* was typed.

**Verifier:** the existing hand-built **Ledoit-Wolf shrinkage + scaled-Manhattan ensemble**
becomes the calibrated verifier operating **in the learned embedding space** (not on raw
features). The deep model provides the representation; the statistical ensemble scores it.

**Product intent:** BOTH a **login gate** (step-up auth) AND a **continuous session guard**.
**Fail-safe, never fail-open** — on any outage or version mismatch, the system must not silently
grant access.

**Data plan:** Phase 1 = CMU Killourhy-Maxion fixed-password benchmark (`.tie5Roanl` + Return);
Phase 2 = public **free-text** corpus for the content-independent contribution, with the game's
own collected data as a fallback.

---

## 4. The frozen wire contract (DO NOT BREAK)

This is the load-bearing seam between three subsystems in two languages. A new session must not
casually change it. Defined in [`ml-service/app/contract.py`](ml-service/app/contract.py) and
enforced in [`ml-service/app/model.py`](ml-service/app/model.py).

- **`EMBED_DIM = 128`** — every embedding is a 128-element `list[float]`, **L2-normalized**. The
  `/embed` response is `Field(min_length=128, max_length=128)`, so a non-128 model fails response
  validation at request time.
- **Embedder interface:** `get_embedder().embed(keystrokes) -> list[float]` plus a `.version`
  string. This is the entire contract the rest of the system depends on.
- **`MODEL_VERSION`** (`model.py:68`) is the **single swap point** — it reflects whichever model
  actually loaded. Spec §6.4: profiles built under a different version are rejected upstream as
  version-mismatched.
- **Load-time dim guard** (`model.py:48-54`): `_load_embedder()` **raises** if a loaded artifact's
  `embed_dim != 128`, failing fast and loud at startup instead of producing opaque HTTP 500s later.
- **Set-but-missing fallback** (`model.py:60-64`): if `ML_ARTIFACT_PATH` is set but the file is
  absent, the loader **logs a loud warning and falls back to the `StubEmbedder`** (fail-safe, don't
  crash) — but the stub is explicitly NOT a real model (hash-based, locality not preserved).
- **Train/serve fidelity:** the service reuses the research harness's `featurize_window` and
  encoder, so a served embedding is **byte-identical** to what training produced (verified, maxdiff
  `0.0` — no train/serve skew).

---

## 5. Repository map

Three subsystems. One-line purpose per key file.

```
research/                         # offline harness — PRODUCES the artifact
  ksbio/
    featurize.py                  # keystroke events -> (4 timing feats + char ids); SINGLE shared input repr
    encoder.py                    # KeystrokeEncoder: char-emb -> CNN -> BiGRU -> attention pool -> 128-D L2
    triplet.py                    # batch-hard triplet loss + center regularizer
    train.py                      # deterministic trainer (seeded), TrainConfig
    artifact.py                   # versioned save/load (weights_only=True safe-load); ArtifactMeta
    evaluate.py                   # honest EER per subject (REFUSES to score training data)
    cmu_sequences.py              # CMU password row -> keystroke sequence (.tie5Roanl + Return)
    freetext.py                   # free-text loader + sliding windows (Phase-2)
    ensemble.py / metrics.py / seeds.py / data/cmu.py   # NumPy ensemble port, EER/FAR/FRR, seeding, CMU loader
  scripts/
    download_cmu.py               # scripted CMU download + SHA-256 verify (EXPECTED_SHA256 still a sentinel)
    train_cmu.py                  # Phase-1 CLI: train -> per-subject EER -> save artifact; auto-detects real CMU cols
    train_freetext.py             # Phase-2 CLI: same encoder/trainer fed by free-text windows
  tests/                          # 61 passing
ml-service/                       # FastAPI inference service — CONSUMES the artifact
  app/
    contract.py                   # the frozen wire contract (Pydantic) — EMBED_DIM=128
    model.py                      # _load_embedder() + MODEL_VERSION swap point + dim guard + stub fallback
    torch_embedder.py             # TorchEmbedder: loads artifact, embeds (byte-identical to training)
    verify.py / main.py           # /verify scoring; FastAPI routes (/health /embed /embed_batch /verify)
  modal_app.py                    # Modal GPU image + artifact mount (deploy DEFERRED)
  tests/                          # 21 passing
ml/                               # ⚠️ LEGACY sklearn dir — SUPERSEDED by research/. Its fabricated
                                  #    "EER<5%" / "70-80% accuracy" claims were stripped (Task 0).
docs/superpowers/                 # specs + plans (see §12)
Crest_Guidelines.md               # ⚠️ authoritative CREST Gold criteria reference
```

The full **Node game app** (server.js, controllers, models, public/) is intentionally not
re-listed here — see the project memory `MEMORY.md` ([§12](#12-pointers)) for that map.

---

## 6. What's done — Plan 1 + Plan 2

### Plan 1 — Foundation (DONE)
- **Fixed the production-breaking JWT bug:** keystroke/biometric controllers now read
  `req.userId`, not `req.session.userId`. *This is why the live feature never worked.*
- `research/` harness: deterministic seeds, NumPy port of the ensemble (parity-tested), EER/FAR/FRR
  metrics, CMU loader + deterministic split (synthetic fixture; real CSV gitignored).
- `ml-service/` FastAPI: wire contract + `/health`, `/embed`, `/embed_batch`, `/verify` — serving a
  **deterministic STUB embedder** (hash-based, locality NOT preserved — honestly flagged).
- Feature-flagged Node client (`services/mlServiceClient.js`) — changes **no** behaviour until
  `ML_SERVICE_URL` is set; **not yet wired into any route.**

### Plan 2 — Real model (DONE, all 18 tasks 0–17, CPU-only, zero spend)
Pipeline, end to end, all built and tested on CPU:

featurize → encoder (CNN+BiGRU+attention, 128-D L2) → triplet loss → deterministic trainer →
versioned artifact (`weights_only=True` safe-load) → honest EER → scripted CMU download →
**Phase-1 CLI** → **`TorchEmbedder` serving** (byte-identical to training, maxdiff `0.0`;
**locality proven end-to-end** through the real FastAPI routes: near-window L2 `0.0000` vs far
`0.277` — the property the hash stub could not satisfy) → `get_embedder()` swap point → free-text
Phase-2 loader + CLI + corpus-acquisition doc → Modal GPU config.

**Tests:** research **65** + ml-service **22** + Node **16** = **103 passing**, tree clean.

> The deep model code is complete **and has now been trained on the real CMU data on local CPU**
> (~23 min, zero spend), producing the measured open-set EER (§6.1 below). What remains is the
> *optional, billable* cloud deploy and a real free-text run — see next section.

### Plan 2 outcome — the measured result (DONE on local CPU, zero spend)

The Phase-1 training was run on the real `DSL-StrongPasswordData.csv` with an **open-set split**
(35 train / 16 held-out subjects — the held-out 16 are scored, never trained on), over seeds
42/43/44:

- **Primary (scaled-Manhattan) EER = 0.1422 ± 0.0279**
- **Full ensemble EER = 0.1016 ± 0.0097** — near the 0.0962 published baseline, with ~3× lower
  variance. This is the report's central claim: the hand-built Ledoit–Wolf ensemble, operating in
  the learned embedding space, recovers near-baseline accuracy with much lower variance.
- The number is **honest**: open-set, so it sits *above* baseline rather than implausibly below it.
- Evidence: [`research/artifacts/metrics.json`](research/artifacts/metrics.json) (committed),
  `det_curve.png`, `tsne.png` (both now embedded in the report's Appendix C), and a §4.6
  nested-validation ablation (`metrics_e120.json`/`sweep_results.json`) showing the validation-
  selected 120-epoch alternative scored *worse* (0.1610 ± 0.0866) — confirming the 60-epoch
  headline. `cmu-v1.pt` + `scores.json` are gitignored but regenerable via
  `research/scripts/reproduce.ps1`.

The **CREST Gold report is written and built**: [`CREST_Gold_Report.md`](CREST_Gold_Report.md)
(+ `.docx` via [`build-crest-docx.ps1`](build-crest-docx.ps1), DET + t-SNE figures embedded) and
the [Student Profile Form](CREST_Student_Profile_Form.md) mapping each criterion to the report.

---

## 7. What is DEFERRED — billable, user-triggered ONLY

> ⚠️⚠️⚠️ **HARD RULE FOR THE NEXT SESSION:** the steps below **spend the user's money** (GPU
> compute / Modal). **Do NOT run any of them without the user's explicit go-ahead in this
> session.** Document and prepare only. ⚠️⚠️⚠️

> **Already done, no longer deferred:** the real CMU dataset download + the full ~60-epoch
> Phase-1 training were completed on **local CPU** (zero spend), and the **headline EER now exists**
> (§6.1). The items below are what is *still* deferred.

Remaining deferred work — **billable or data-acquisition, user-triggered ONLY**:

1. **`modal deploy`** the inference service with the trained artifact mounted
   (`ML_ARTIFACT_PATH=/root/artifacts/cmu-v1.pt`, `gpu="T4"` in `ml-service/modal_app.py`).
   **Billable (Modal GPU).** The model already serves correctly locally end-to-end; this only makes
   it live in the cloud.
2. **Real free-text (Aalto) run.** The Phase-2 pipeline (`train_freetext.py`) is open-set-correct
   and runs on a fixture, but a real free-text EER needs the Aalto corpus downloaded. No GPU spend,
   but a dataset-acquisition step — documented as future work in the report's §10.

The Phase-1 CLI auto-detects real CMU columns (`"H.period" in header`) and remaps the key-name
columns to printable-char columns via `remap_cmu_columns` — the fix that prevents silently training
on all-zero timings. (The `EXPECTED_SHA256` digest in `download_cmu.py` should be set to the
measured value if the download script is re-run from scratch.)

---

## 8. Plan 3 — not yet written (future)

The product-integration layer. **Not started, no plan doc yet.**
- Enrollment UI (capture a user's typing profile).
- Login step-up (verify on sign-in).
- Continuous session-guard chip (EWMA + hysteresis to avoid flapping).
- Consent screen (biometric data — an ethics requirement, also CREST 4.2 evidence).
- **Wire the Node controllers to actually CALL the ML client** in production request paths
  (today `services/mlServiceClient.js` exists but is never invoked).

---

## 9. Decision log & honesty rules

**Decisions locked with the user:**
- **Hybrid architecture** (shell + stateless inference + offline research harness) over a monolith.
- **Defer GPU spend** — everything CPU-testable; the billable train/deploy is a final, explicit,
  user-triggered step.
- **Both phases** in scope: Phase 1 (CMU fixed-password) *and* Phase 2 (free-text).
- **Scripted CMU download with SHA-256** verification (reproducibility).
- **"Keep the subagent review process"** even though it cost more — the user explicitly prioritised
  correctness over cost after a frank discussion about API spend.

**Honesty thesis (non-negotiable — also the spine of a credible CREST report):**
- **Never claim an accuracy/EER number not measured on a real dataset.** The legacy `ml/` code had
  hardcoded "70–80% accuracy" / "EER<5%" strings — those were *fabricated* and have been removed.
- Keep the data split honest: **per-user data bounds false-rejects; public-benchmark data bounds
  false-accepts / EER.** Never score a subject against their own training data.

**The ~9 silent bugs the adversarial review caught** (these pass happy-path tests but would corrupt
production — they are excellent CREST criterion-4.4 "problems identified & overcome" evidence):
1. **EER fabrication (Task 8):** the evaluator silently fell back to scoring *training* data when
   the genuine test set was empty → a flattering fake `0.0` EER. **Now raises `ValueError`.**
2. **Real-CMU all-zero timings (Task 10):** the real CSV uses `H.period`, not `H..`; without a
   remap the model would train on all-zero timings → meaningless `0.5` EER. **Added `remap_cmu_columns`.**
3. Float32 train/serve skew from large timestamp magnitudes (Task 2) → per-window origin subtraction.
4. NaN guard + padding-leak in the encoder (Task 3).
5. Collapsed-encoder test gap (Task 6) → added intra/inter separation assertions.
6. Artifact couldn't rebuild a non-default architecture (Task 7) → persist all hyperparameters.
7. Serving deploy-fragility: silent `ModuleNotFoundError` if research pkg missing (Task 11) → loud error.
8. Silent non-model fallback when `ML_ARTIFACT_PATH` misconfigured (Task 12) → loud warning.
9. Cross-task: no load-time check that artifact `embed_dim == 128` (final review I1) → load-time guard.

---

## 10. Environment & git hazards (OneDrive)

This repo lives on **OneDrive**, which actively interferes with git. Discipline that must be kept:
- Use **`git --no-pager`** for all git reads.
- **Never run parallel agents that touch git** — serialize all git operations.
- **Never `git add -A`** — stage **explicit file paths** only.
- `controllers/*.js` recurrently show as **phantom-modified** (OneDrive sync artifact) — **IGNORE
  them, never stage them.** They are byte-identical to what's committed.
- OneDrive once **resurrected an empty `.git/rebase-merge/`** directory; deleting it was correct and
  `git fsck` confirmed the repo healthy. If you see an orphaned rebase-merge with zero state files,
  it's this — safe to remove.
- Shell is **Windows PowerShell** (use `$null`, `$env:VAR`, backtick line-continuation; the Bash
  tool is also available for POSIX scripts).

**Branch-state gotcha:** all keystroke work lives on **`feat/keystroke-verification`**. `main` has
**only** the design + Plan-1 docs, NOT the implementation. If you find uncommitted
`req.session.userId → req.userId` edits on `main`, they are a **stale duplicate** of feat commit
`3c759d4` — discard them and work on the feat branch.

---

## 11. How to resume (quickstart)

For a brand-new session, in order:

1. **Get on the right branch:**
   ```
   git --no-pager status
   git checkout feat/keystroke-verification        # if not already on it
   ```
2. **Confirm the build is green** (expect 65 / 22 / 16 = 103):
   ```
   cd research    && python -m pytest -q
   cd ml-service  && python -m pytest -q
   npm test                                          # from repo root — Node Jest, 16 tests
   ```
3. **Read the context** (don't re-derive it): [`Crest_Guidelines.md`](Crest_Guidelines.md), the
   [report](CREST_Gold_Report.md), and the design spec / Plan-2 doc — linked in [§12](#12-pointers).
4. **Rebuild the Word docs if the report markdown changed:** `./build-crest-docx.ps1` (needs pandoc;
   already installed). The figures embed via relative paths resolved with `--resource-path`. There
   is **no PDF engine installed** — produce the PDF by opening `CREST_Gold_Report.docx` in Word and
   "Save As → PDF"; that pagination is also what fills the Profile Form's page-number fields.
5. **Likely next real work** (ask the user which):
   - **CREST submission finishing touches** (no spend): export the PDF, fill the Profile Form page
     numbers and word count, re-confirm the DBIR statistic (§13 note).
   - **Real free-text (Aalto) run** ([§7](#7-what-is-deferred--billable-user-triggered-only)) — data
     download, no GPU spend.
   - **Modal GPU deploy** ([§7](#7-what-is-deferred--billable-user-triggered-only)) — **billable, ask first.**
   - **Plan 3** product integration ([§8](#8-plan-3--not-yet-written-future)).

---

## 12. Pointers

These remain the **deeper sources of truth**; this handoff is the index over them.

- **CREST criteria (authoritative):** [`Crest_Guidelines.md`](Crest_Guidelines.md)
- **Design spec:** [`docs/superpowers/specs/2026-06-08-keystroke-verification-design.md`](docs/superpowers/specs/2026-06-08-keystroke-verification-design.md)
- **Plan 1 (Foundation):** [`docs/superpowers/plans/2026-06-08-foundation.md`](docs/superpowers/plans/2026-06-08-foundation.md)
- **Plan 2 (Real model):** [`docs/superpowers/plans/2026-06-08-real-model.md`](docs/superpowers/plans/2026-06-08-real-model.md)
- **Frozen contract:** [`ml-service/app/contract.py`](ml-service/app/contract.py), [`ml-service/app/model.py`](ml-service/app/model.py)
- **Project memory (full Node app map, auth pattern, deployment):** `MEMORY.md` in the Claude
  project memory dir (`~/.claude/projects/.../memory/MEMORY.md`), with `foundation-plan-status.md`
  tracking plan status.

---

*This handoff was compiled from a verified live inspection of the repo (branch state, commit log,
test runs, and the actual contract/model/CLI source) — every status claim above was checked against
the code, not recalled. The EER figures it now reports are the **measured** open-set results from
the local-CPU training run, recorded in `research/artifacts/metrics.json` — not estimates.*
