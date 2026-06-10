# Can You Be Recognised by the Way You Type? Building and Honestly Evaluating a Deep-Learning Keystroke-Dynamics Verification System

**A CREST Gold Award Research Project**

| | |
|---|---|
| **Student** | _[Your full first name — surname omitted per CREST profile-form guidance]_ |
| **Project type** | Research / investigation (with a design-and-make engineering component) |
| **Project title** | Content-independent keystroke-dynamics biometric verification: does a deep metric-learning embedding with a classical calibrated verifier authenticate users by typing rhythm alone, and can it match the published statistical baseline? |
| **Field** | Computer science · machine learning · cybersecurity / behavioural biometrics |
| **Mentor / supervisor** | _[Name, role — e.g. school CS teacher or external STEM mentor; required field on the profile form]_ |
| **Dates** | 25 November 2025 – 9 June 2026 (active research sprint 8–9 June 2026) |
| **Word count** | _[fill in at submission]_ |
| **Pages** | _Numbered throughout; the Student Profile Form maps each of the 15 CREST criteria to the page/section numbers below._ |

> **Note on authorship and AI use (read first).** This report documents a real, working, measured system that I designed, built, debugged and evaluated. Generative-AI tools (Anthropic's Claude, used inside the Claude Code command-line assistant) were used as a coding and drafting aid throughout, in line with CREST's AI policy. **Section 12 (AI Use Statement)** discloses exactly what the AI did, when, with representative prompts, and what I checked and changed myself. Every scientific number in this report was produced by code on my machine and can be regenerated with one command (Section 9.7); none is invented. Where this draft contains a placeholder in _[square brackets and italics]_, that is content only I can supply (my name, my personal motivation, my mentor) and I have completed it in the submitted version.

---

## Abstract

Passwords prove only that someone *knows* a secret; they cannot tell whether the person typing is really the account's owner. **Keystroke dynamics** — the rhythm with which a person presses and releases keys — is a *behavioural biometric* that could add a second, silent layer of identity verification. This project asks one tightly-scoped research question: **can a content-independent deep metric-learning embedding, paired with a classical calibrated statistical verifier, recognise a person from their typing rhythm alone, and how close does it come to the long-standing published benchmark?**

I built a complete, reproducible system in three parts: an offline research harness (PyTorch) that trains a keystroke-embedding network; a stateless inference service (FastAPI) that serves the frozen model; and a product layer (Node.js) that lets a real user consent, enrol and be verified. The model is a 1-D convolutional + bidirectional-GRU + attention network that maps a window of keystrokes to a 128-dimensional, L2-normalised vector, trained with **batch-hard triplet loss**. On top of the learned representation I run a hand-built **Ledoit–Wolf shrinkage + Mahalanobis + k-nearest-neighbour ensemble** as the decision layer.

I evaluated on the standard **CMU Killourhy–Maxion benchmark** (51 subjects typing the password `.tie5Roanl`) under a deliberately strict **open-set protocol**: the network is trained on 35 subjects and tested only on the **16 subjects it has never seen**, so the result measures genuine generalisation, not memorisation. Averaged over three random seeds, the system achieved an **Equal Error Rate (EER) of 14.2 % ± 2.8 %** using the scaled-Manhattan scorer (the metric directly comparable to the published baseline of **9.6 %**), and **10.2 % ± 1.0 %** using the full ensemble — with the ensemble both closer to the baseline *and* roughly three times more stable across seeds. The central finding is therefore not that the deep model beats the classical baseline, but that **a learned embedding lets a classical verifier achieve near-baseline accuracy with substantially lower variance, on subjects it never trained on** — the "deep representation + classical calibrated verifier" hybrid working as hypothesised.

The project's strongest evidence of scientific rigour is its honesty discipline: I document a closed-set evaluation flaw that would have produced a flatteringly low but meaningless number, the fix to an open-set protocol, and twelve further problems found and overcome — including a production crash discovered only by running the real system end-to-end. The report closes with a substantive ethics analysis (biometric data as GDPR special-category data; consent; fail-safe design; dual-use) and a reflection on limitations and next steps.

---

## Table of Contents

1. **Introduction and Project Planning** — aim, objectives, wider purpose, approaches, plan, timeline, resources
2. **Scientific Background and Literature Review**
3. **Methodology**
4. **Results**
5. **Discussion: Conclusions and Implications**
6. **How My Decisions Shaped the Outcome**
7. **Problems Identified and Overcome**
8. **Ethics, Safety and Responsible Use**
9. **Reproducibility and Engineering Practice**
10. **Reflection: What I Learnt and What I Would Improve**
11. **Conclusion**
12. **AI Use Statement**
13. **References**
14. **Appendices** (A: criteria-to-section map · B: glossary · C: full results tables · D: code map · E: risk assessment)

---

# 1. Introduction and Project Planning

## 1.1 Aim and objectives

> **Aim (one testable sentence):** *Determine whether a content-independent deep metric-learning embedding of keystroke timing, combined with a classical calibrated statistical verifier, can verify a person's identity from typing rhythm alone, and measure how its open-set Equal Error Rate compares with the published scaled-Manhattan benchmark of 9.6 % on the CMU keystroke dataset.*

The aim is deliberately *measurable*: success or failure is decided by a single, well-defined number (the Equal Error Rate, defined in §2.3) computed under a protocol fixed in advance, against a published reference value. I will "know I have been successful" if the system (a) produces a genuine, reproducible EER on subjects it never trained on, and (b) that EER is *interpretable relative to* the 9.6 % baseline — whether it beats it, matches it, or falls short, each is a scientifically meaningful outcome provided the measurement is honest.

I decomposed the aim into six sub-objectives, each with an explicit success condition:

| # | Objective | Measurable success condition | Outcome |
|---|---|---|---|
| **O1** | Build a content-independent keystroke-embedding network | A network maps a variable-length keystroke window to a fixed 128-D L2-normalised vector; forward pass verified on CPU | ✅ Met (§3.3) |
| **O2** | Train it with a metric-learning objective so same-person windows cluster and different-person windows separate | After training, mean intra-subject embedding distance < mean inter-subject distance, asserted by an automated test | ✅ Met (§3.4) |
| **O3** | Evaluate **honestly** on a public benchmark under an open-set protocol | EER computed only on held-out subjects; the evaluator *refuses* to score training data | ✅ Met (§3.6, §4) |
| **O4** | Re-use a hand-built statistical ensemble as the decision layer **in the learned space** and compare it with the simple scorer | Two EERs reported (scaled-Manhattan vs full ensemble) from one evaluation | ✅ Met (§4.1) |
| **O5** | Make the whole pipeline reproducible | A single script regenerates the result from a SHA-256-pinned dataset and fixed seeds; provenance chain verified | ✅ Met (§9) |
| **O6** | Demonstrate the model in a real product flow with safe failure behaviour | A live service serves the trained model; a user can consent → enrol → be verified; outages never grant access | ✅ Met (§3.8, §6) |

**Why these objectives and not others.** A weaker project would have stated the aim as "build a typing-recognition system" and declared success when *something* ran. By forcing every objective to carry a falsifiable success condition, I made it impossible to hide a non-result — which is exactly what happened during the project (§7.1) and what makes the final number trustworthy.

## 1.2 Wider purpose and context

**The problem in the world.** Passwords are the dominant way we prove who we are online, yet they verify *knowledge*, not *identity*: anyone who learns or steals a password becomes, to the system, indistinguishable from the real owner. Account-takeover fraud — where an attacker logs in with stolen credentials — is a large and growing harm. Industry breach reporting has for years found that the majority of web-application breaches involve stolen or weak credentials, and credential-stuffing (replaying leaked username/password pairs) is one of the most common automated attacks against login systems (Verizon Data Breach Investigations Report, annual; see References). Multi-factor authentication helps but adds friction (a code to fetch, a device to carry), and people disable or bypass it.

**Where keystroke dynamics fits.** Behavioural biometrics offer a *silent, continuous* alternative: instead of asking the user to *do* something extra, the system observes *how* they already type. The idea is old — the cadence of a telegraph operator's "fist" was used to identify them in the 19th century — but modern machine learning makes content-independent typing recognition (recognising rhythm regardless of *what* is typed) newly practical (Acien et al., 2021). A reliable typing biometric could (a) act as an invisible second factor at login, (b) provide *continuous* verification that re-checks identity during a session (catching an attacker who hijacks a logged-in session), and (c) lower the barrier for people who find passwords and hardware tokens difficult to manage.

**Concrete stakeholders.** The direct beneficiaries are ordinary account holders on any platform with a login — in my case, the players of *Typing Sanctuary*, the multiplayer typing game that is the product shell for this research. A typing game is an unusually honest home for this research because its users are *already typing a lot*, so the biometric can be collected without asking them to do anything new. More broadly, the indirect beneficiaries are any users vulnerable to account takeover, and the indirect *risk-bearers* are those same users if the technology is built carelessly — which is why the ethics analysis (§8) is a first-class part of this project, not an afterthought. _[STUDENT: if you have a personal reason this matters to you — e.g. an account of yours or a family member's was compromised — add one or two honest sentences here; CREST case studies show a genuine personal stake strengthens the "wider purpose" criterion.]_

## 1.3 Range of approaches considered

CREST criterion 1.3 asks for a *range* of approaches compared on their merits. I considered three fundamentally different ways to build the verifier before committing, and a fourth axis (where to draw the data) cross-cutting all of them.

**Approach A — Pure statistical/anomaly-detection (the classical baseline).** Extract hand-designed timing features (hold times, down-down latencies) per keystroke and score a new sample against a per-user statistical profile using a distance like scaled-Manhattan or Mahalanobis. This is exactly what Killourhy & Maxion (2009) benchmarked. *Strengths:* simple, interpretable, needs no training across users, strong published results (best detector EER ≈ 9.6 %). *Weaknesses:* tied to fixed text (it compares like-for-like keystrokes), brittle to new passwords or free text, and the features are fixed by a human rather than learned.

**Approach B — Pure deep classifier.** Train a neural network to output a probability distribution over the *enrolled users* (a softmax classifier). *Strengths:* can be very accurate on a closed set. *Weaknesses:* fundamentally *closed-set* — it can only recognise users it was trained on, so every new user requires retraining the whole network. For an authentication product where users sign up continuously, this is a fatal limitation.

**Approach C — Deep metric-learning embedding (chosen).** Train a network not to classify but to *embed*: map any keystroke window to a vector such that same-person windows are close and different-person windows are far, using a triplet loss (Schroff et al., 2015; Hermans et al., 2017). New users are enrolled by storing a few of their embeddings — **no retraining**. *Strengths:* open-set by construction (the modern standard for face and biometric recognition), content-independent, data-efficient. *Weaknesses:* more complex to train; the raw embedding still needs a calibrated decision rule on top.

**The cross-cutting decision — decision layer.** Rather than discard the classical statistics (Approach A), I run them *inside the learned embedding space* of Approach C: the network provides the representation, and a Ledoit–Wolf-shrinkage Mahalanobis + k-NN + scaled-Manhattan **ensemble** provides the calibrated decision. This hybrid is the project's central design idea and its main creative contribution (criterion 4.3).

| Criterion | A: Statistical | B: Deep classifier | C: Metric embedding (+ ensemble) |
|---|---|---|---|
| Open-set (new users without retraining) | ✅ yes | ❌ no | ✅ yes |
| Content-independent (any text) | ❌ no | ⚠️ partial | ✅ yes (by design) |
| Data efficiency | ✅ high | ❌ low | ⚠️ medium |
| Interpretability | ✅ high | ❌ low | ⚠️ medium (ensemble is interpretable) |
| Published precedent / comparability | ✅ strong (9.6 %) | ⚠️ some | ✅ strong (TypeNet, FaceNet lineage) |
| Implementation risk in 3-day sprint | ✅ low | ⚠️ medium | ⚠️ medium–high |
| Fit to an authentication *product* | ❌ poor | ❌ poor | ✅ best |

**Decision.** I chose **C with the A-style ensemble as the decision layer**, because only an open-set, content-independent method fits a real authentication product where users sign up continuously, and because keeping the classical verifier lets me (i) compare directly against the 9.6 % published baseline and (ii) reuse rigorously-tested statistical code as a load-bearing component rather than throwing it away.

## 1.4 Chosen approach and justification

The system is a **three-part hybrid architecture**, chosen so that the live product and the reproducible research share exactly one artefact (the trained model) across a clean boundary:

1. **Offline research harness (`research/`, Python + PyTorch)** — *produces* a frozen, versioned model artefact reproducibly (fixed seeds, pinned dataset, recorded git commit).
2. **Stateless inference service (`ml-service/`, Python + FastAPI)** — *consumes* the artefact and exposes `/embed`, `/verify`, `/health`. It holds the model in memory, stores nothing, and logs no raw keystroke timings.
3. **Product shell (`Node.js/Express`)** — the existing typing game; owns users, sessions and the request paths where verification is enforced; calls the inference service; enforces the decision.

**Why this shape.** Separating "the thing that *makes* the scientific claim" (the research harness) from "the thing that *serves* it to users" (the inference service) means the live app never trains and never touches a dataset, and the research never touches live user data. One artefact, two worlds, with a single frozen wire contract between them (`EMBED_DIM = 128`, L2-normalised). This is the design decision that makes both the science *and* the product trustworthy, and it is justified in detail in the design specification that preceded implementation.

**Failure posture (decided up front, not bolted on).** The system is **fail-safe, never fail-open**: on any service outage or model-version mismatch, verification returns *indeterminate* and the product requires a fallback factor — it never silently grants access. A security feature that lets everyone in when it breaks is worse than no feature, so this was a non-negotiable design constraint from the start (and it later caught a real bug — §7.10).

## 1.5 Project plan and timeline

CREST criterion 1.5 explicitly rejects a bare statement that "I planned"; it requires dated evidence such as a Gantt chart. The advantage of building the whole system under version control is that **every step has a real, immutable timestamp** — the 83 git commits are an automatic, tamper-evident logbook. The timeline below is reconstructed directly from the commit history (dates are real).

**Phase overview (Gantt-style timeline):**

```
 2025                                         2026
 Nov   Dec        Jan   Feb        Mar        Apr  May   Jun 8   Jun 9
 |-----|----------|-----|----------|----------|----|-----|------|------|
 [Game build.......]                                              (product shell)
       [Multiplayer, leaderboard, hearts]
                        [Google OAuth + 1st keystroke biometrics v1]
                                  [Keystroke biometric engine v2 (statistical)]
                                                          [DESIGN spec + plans]  <- Jun 8 09:03
                                                          [Foundation: harness, contract, stub]  Jun 8
                                                          [Real PyTorch model: featurize→encoder→triplet→artifact]  Jun 8
                                                                 [Serving: TorchEmbedder, free-text, Modal cfg]  Jun 9 am
                                                                        [OPEN-SET fix + measured EER + product slice + paper]  Jun 9
```

**Detailed milestone log (planned vs actual).** The research itself was executed as a focused, planned three-day sprint (8–9 June 2026) on top of a product that had been built over the preceding six months.

| Date (real, from git) | Milestone | Planned? |
|---|---|---|
| 2025-11-25 | Game project begins (`Initial commit — Speed Typing Battle`) | foundation |
| Dec 2025 | Multiplayer, leaderboard, hearts/penalty system | foundation |
| 2026-02-21 | Google OAuth + **first** keystroke-biometrics capture (v1) | foundation |
| 2026-03-28 | Research-grade statistical biometric engine (v2) | foundation |
| 2026-06-08 09:03 | **Design specification** for the deep-model rebuild | planned milestone 1 |
| 2026-06-08 09:30 | Fix the production-breaking JWT bug (`req.userId`) that had silently disabled the live feature | planned |
| 2026-06-08 10:30–17:47 | Foundation + model: metrics, ensemble port, featurization, **encoder (CNN+BiGRU+attention)**, triplet loss, deterministic trainer, versioned artifact | planned milestone 2 |
| 2026-06-08 19:50–20:46 | **Honest EER** evaluator, scripted CMU download with SHA-256, Phase-1 CLI, real-column remap fix | planned |
| 2026-06-09 07:21–09:07 | Serving (`TorchEmbedder`), free-text Phase-2 path, Modal GPU config, load-time dimension guard | planned milestone 3 |
| 2026-06-09 16:32 | **Open-set evaluation fix** + ensemble EER + pinned dataset (the scientifically critical change) | planned (Day-1 sprint) |
| 2026-06-09 16:42 | Standalone product slice (consent → enrol → verify) | planned (Day-2 sprint) |
| 2026-06-09 17:19 | Train on real data → **measured EER**; figures; fixed a live production bug | planned (Day-1/2 sprint) |
| 2026-06-09 22:29 | Open-set free-text Phase-2 + verified reproducibility chain | planned (Day-3 sprint) |

**Slippage and replanning (honest).** The research sprint was scoped for three working "days" of effort. In practice, two replanning decisions were made *during* the sprint and are worth recording because criterion 3.2 rewards showing how decisions changed the project: (1) GPU training was **deferred** in favour of a local-CPU run once I calculated that the model was small enough to train in ~23 minutes on a laptop for £0 (the cloud GPU step would have cost only ~£0.10–0.50 but needed no authorisation if it ran locally); and (2) the free-text Phase-2 benchmark was **descoped** to "pipeline proven, real corpus deferred" when I judged that downloading the 136-million-keystroke Aalto corpus carried more schedule risk than scientific value within the sprint (§10).

## 1.6 Materials, tools and people

Documenting every external resource by name is criterion 2.1. I used:

- **Dataset:** CMU Keystroke Dynamics Benchmark Dataset (`DSL-StrongPasswordData.csv`), Killourhy & Maxion, Carnegie Mellon University — 51 subjects, 400 repetitions each of the password `.tie5Roanl`. Obtained from the authors' public page and pinned by SHA-256 for reproducibility.
- **Languages & core libraries:** Python 3.12; **PyTorch 2.12** (CPU build) for the neural network; **NumPy** for the statistical ensemble; **FastAPI** + **Uvicorn** for the inference service; **scikit-learn** (t-SNE) and **Matplotlib** for figures; **Node.js / Express** for the product shell; **Jest** and **pytest** for testing.
- **Statistical method:** Ledoit–Wolf shrinkage covariance estimator (and its scikit-learn reference implementation for cross-checking).
- **Infrastructure considered:** Modal (serverless GPU) for a future cloud deployment — configured but deliberately not run (cost-deferred).
- **Development tooling:** Git (version control and, usefully, an automatic dated logbook); the Claude Code AI assistant (disclosed fully in §12).
- **People:** _[STUDENT: name your mentor/teacher and what they advised — e.g. reviewed the ethics section, or sanity-checked the statistics. CREST criterion 2.1 explicitly credits effective use of people. If you worked alone on the technical build, say so honestly and note where you sought feedback.]_

---

# 2. Scientific Background and Literature Review

This section establishes the science the project rests on (criterion 4.1) and synthesises prior work to locate a gap (criterion 2.2). I have tried to *synthesise* — to draw threads together and identify what was missing — rather than summarise paper-by-paper.

## 2.1 Keystroke dynamics as a behavioural biometric

Biometrics fall into two families: **physiological** (fingerprint, iris, face — *what you are*) and **behavioural** (signature, gait, voice, typing rhythm — *how you behave*). Keystroke dynamics is behavioural: it characterises a person by the *temporal pattern* of their typing rather than the content. The core measurable quantities are inter-key timings. For each keystroke and pair of consecutive keys, the standard features are:

- **Hold time (dwell):** how long a single key is held down (`up − down` for one key).
- **Down–down latency:** time between pressing one key and pressing the next.
- **Up–down latency (flight time):** time between releasing one key and pressing the next.
- **Up–up latency:** time between releasing consecutive keys.

These timings are remarkably person-specific because they reflect motor patterns, hand geometry, and learned habits that are hard to consciously fake. Two regimes exist: **fixed-text** (everyone types the same string, e.g. a password — the CMU benchmark) and **free-text** (the person types whatever they like — needed for *continuous* authentication). Fixed-text is easier (you compare like keystrokes directly); free-text demands a *content-independent* model that learns rhythm invariant to the words typed.

A recent authoritative survey (ACM Computing Surveys, 2024/25) frames the field's trajectory: from hand-crafted statistical detectors in the 2000s toward deep representation learning in the 2020s, exactly the transition this project sits on.

## 2.2 The science of metric learning and embeddings

The key conceptual move of modern biometrics is to stop asking "*which* of my known users is this?" (classification) and instead learn an **embedding**: a function `f` that maps an input to a point in a vector space such that distance encodes identity. **FaceNet** (Schroff, Kalenichenko & Philbin, 2015) established the template for faces: a network trained so that the Euclidean distance between embeddings of the same person is small and between different people is large, using a **triplet loss**. A triplet is (anchor, positive, negative) — same-person, same-person, different-person — and the loss pushes the anchor–positive distance to be smaller than the anchor–negative distance by a margin:

> `L = max(0, d(anchor, positive) − d(anchor, negative) + margin)`

FaceNet used a 128-dimensional embedding and reached 99.6 % on a face benchmark; the same 128-D, L2-normalised design is what I adopt for keystrokes. **Hermans, Beyer & Leibe (2017)** showed that *how* you choose triplets matters enormously, and that **batch-hard mining** — within each mini-batch, for every anchor pick the *hardest* positive (furthest same-person) and *hardest* negative (closest different-person) — is a simple, strong strategy. I use batch-hard mining. **Wen et al. (2016)** introduced a complementary **center loss** that pulls each class's samples toward their own centroid, tightening clusters; I add a small center-loss term to stabilise per-user spread.

**Why L2-normalisation matters.** Projecting every embedding onto the unit sphere (dividing by its length) means Euclidean distance becomes a monotone function of the angle between vectors — so the model compares *direction* (pattern) rather than *magnitude*, which is the right invariance for a rhythm signature.

## 2.3 Statistical verification, and how performance is measured

A raw embedding is not yet a decision. The verifier must turn "how far is this new window from the user's profile?" into accept/reject. I use three distances, fused:

- **Scaled-Manhattan:** mean absolute deviation from the per-user mean, scaled by per-feature spread — the exact form of the best CMU baseline detector, so it gives a like-for-like comparison.
- **Mahalanobis distance:** accounts for *correlations* between dimensions via the inverse covariance matrix. With only a handful of enrolment samples in 128 dimensions, the raw sample covariance is unstable and non-invertible, so I use the **Ledoit–Wolf shrinkage estimator** (Ledoit & Wolf, 2004), which optimally blends the sample covariance with a well-conditioned target to guarantee an invertible, stable matrix — exactly the small-sample, high-dimensional regime keystroke enrolment lives in.
- **k-nearest-neighbour distance:** mean distance to the *k* closest enrolment embeddings, capturing multi-modal typing (people type differently when warmed up vs tired).

**Measuring performance — the Equal Error Rate.** A verifier has two error types: **False Accept Rate (FAR)** — fraction of impostors wrongly accepted — and **False Reject Rate (FRR)** — fraction of genuine users wrongly rejected. Moving the decision threshold trades one against the other: a strict threshold rejects impostors but annoys real users; a lax one is convenient but insecure. The **Equal Error Rate (EER)** is the single operating point where FAR = FRR, and it is the standard scalar summary of a biometric system — **lower is better**. Plotting FAR against FRR across all thresholds gives the **Detection Error Trade-off (DET) curve**. These definitions follow the international standard for biometric performance testing, **ISO/IEC 19795-1**.

## 2.4 Prior work, and the gap this project addresses

The two reference points that bracket this project:

- **The classical benchmark — Killourhy & Maxion (2009).** They collected the CMU dataset (51 subjects × 400 reps of `.tie5Roanl`) and compared 14 anomaly detectors. The best, **scaled-Manhattan, reached an EER of 0.0962 (9.6 %)**; nearest-neighbour-Mahalanobis 0.0996; plain Mahalanobis 0.110; Euclidean 0.171. **9.6 % is the number my system is measured against.**
- **The deep-learning state of the art — TypeNet (Acien et al., 2021).** A Siamese LSTM trained on >136 million keystrokes from ~168,000 subjects, reaching EER 2.2 % (physical keyboard) and 9.2 % (touchscreen) and, crucially, *scaling to 100,000 subjects* — demonstrating that learned, content-independent keystroke embeddings work at internet scale.

**The gap.** TypeNet shows deep keystroke embeddings work *given enormous data*. The CMU benchmark shows classical statistics work *on small fixed-text data*. What is under-explored — and what a student-scale project can genuinely contribute to — is the **middle ground**: on the *small, public, reproducible* CMU benchmark, does a deep embedding *plus a classical calibrated verifier* offer any advantage over the classical verifier alone, when evaluated honestly on subjects never seen in training? That is the specific, falsifiable question this project answers. The contribution is not a new state-of-the-art number; it is a careful, reproducible, *honest* measurement of a hybrid design on a standard benchmark, with all the failure modes documented.

---

# 3. Methodology

This section describes *what I built and how it works* (criteria 4.1, 4.3) in enough detail to be reproduced. The architecture maps one keystroke window → one 128-D vector → a verification decision.

## 3.1 Dataset

The CMU `DSL-StrongPasswordData.csv` contains, for each of 51 subjects and 400 repetitions, the timing features of typing `.tie5Roanl` followed by Return — 11 keys, so 11 hold times plus the inter-key latencies, giving 31 timing columns per row, 20,400 rows total. I verified the file structurally (51 subjects × 400 reps; the column names `H.period`, `H.t`, …, `H.Shift.r`, `H.Return` corresponding to the password) and **pinned it by SHA-256** so any future run uses provably the same bytes.

A subtle, important detail: the real CMU file labels columns by *key name* (`H.period`, `H.Shift.r`, `H.Return`), not by printable character. A naïve loader expecting `H..`, `H.R`, `H.\n` would silently read **all-zero timings** and train on garbage while still printing a plausible-looking number. I wrote an explicit column remap (`remap_cmu_columns`) and an assertion that the first parsed window has exactly 11 keys decoding to `.tie5Roanl` with non-degenerate timings (§7.3).

## 3.2 Feature representation (content-independent by design)

Each keystroke becomes a small vector: **4 timing features** (hold, down-down, up-down/flight, up-up) plus a **learned character embedding** of which key it was. Critically, the timings are computed *relative to the first keystroke in the window* (an origin subtraction), so the absolute clock value is irrelevant and float-precision is preserved. The network sees *which keys, and their rhythm* — never the semantic content — so the representation is content-independent: it can in principle generalise from the fixed CMU password to free typing (the basis of Phase 2). This single featurization function is shared byte-for-byte by both training and serving, which guarantees there is no "train/serve skew" — the served model sees exactly the features it was trained on.

## 3.3 The embedding network (the "encoder")

The encoder (`KeystrokeEncoder`) maps a window of keystrokes to a 128-D L2-normalised vector through four stages:

1. **Input fusion** — each keystroke's 4 timing features are concatenated with a 16-dimensional learned embedding of its character → a 20-D per-keystroke vector. The character embedding lets the network *learn keyboard geography* (which keys are near each other) rather than being told.
2. **1-D convolutional stack** — two `Conv1d` layers (20→64→64 channels, kernel size 3) slide over the keystroke sequence, capturing *local* rhythmic patterns (the timing signature of adjacent key-pairs, or "digraphs").
3. **Bidirectional GRU** — a recurrent layer (hidden size 64 each direction → 128) reads the sequence forwards and backwards, capturing *longer-range* cadence across the whole window.
4. **Attention pooling → projection → L2-norm** — an attention layer computes a weighted average over time (so the network learns *which* keystrokes matter most), a linear layer projects to 128-D, and a final L2-normalisation places the vector on the unit sphere.

The design (CNN + BiGRU + attention, ~1 million parameters) was chosen deliberately *over a Transformer*: at the data scale of this project a Transformer would overfit, whereas this architecture is data-efficient and reproducible. Every architectural choice is defensible in terms of the data available, which is itself a point of scientific maturity.

## 3.4 Training objective

The network is trained with **batch-hard triplet loss** (margin 0.2) plus a small **center-loss** regulariser (weight 0.01), using the Adam optimiser. Each mini-batch samples several subjects with several windows each; within the batch, batch-hard mining selects the hardest positive and hardest negative per anchor. Training is **fully deterministic** — a global seed is set first, the data loader is single-process — so the same seed reproduces the same weights bit-for-bit on CPU. An automated test asserts that after a short training run, same-subject embeddings are measurably closer than different-subject embeddings (objective O2), guarding against a "collapsed" encoder that maps everything to one point.

## 3.5 The verification ensemble (the creative contribution)

After training, a user is **enrolled** (not retrained) by embedding ~12 of their keystroke windows and building a **profile**: the centroid (mean embedding), the enrolment embeddings themselves (for k-NN), and the Ledoit–Wolf shrinkage inverse-covariance matrix. A new window is scored by three distances to this profile — scaled-Manhattan, k-NN, and Mahalanobis — which are averaged into a single fused score; a per-user calibrated threshold then maps the score to a confidence and a risk level (LOW/MEDIUM/HIGH). The crucial design point: **these statistics operate in the *learned* 128-D embedding space, not on raw timings**. The deep network provides the representation; the classical ensemble provides the calibrated, interpretable decision. The *exact same* fusion code runs in the research evaluation and in the live service, so the measured EER and the served decision are the same mathematics — there is no gap between "what I measured" and "what I shipped".

## 3.6 Evaluation protocol — the honesty discipline

This is the most important methodological section, because it is where the project's credibility is won or lost.

**Open-set, held-out subjects.** The 51 subjects are split (seeded) into **35 for training and 16 held out for testing**. The encoder is trained *only* on the 35; the EER is measured *only* on the 16 it has never seen. This makes the result a measure of **generalisation to new people**, which is the only thing that matters for a real authentication system (your future users were not in your training set). A runtime assertion guarantees no test subject leaks into training. This open-set protocol is the corrected version of an earlier closed-set flaw that would have produced a meaningless, flatteringly-low number (§7.1) — the single most important fix in the project.

**Genuine vs impostor, with a held-out split *within* each test subject.** For each of the 16 test subjects, that subject's windows are split into enrolment and test halves; the *test* genuine windows are scored against the profile built from the *enrolment* half (so a window is never scored against itself), and the impostor windows are the *other* test subjects' windows. The evaluator **raises an error rather than fabricate a number** if a subject has too few windows to hold a test set out — a guard added after an earlier version silently scored training data and produced a fake 0.0 EER (§7.8).

**Two metrics, honestly labelled.** I report the **scaled-Manhattan EER as the primary number** because it is the exact metric of the published 9.6 % baseline (an apples-to-apples comparison), and the **full-ensemble EER as a secondary number** — never comparing the ensemble to a scaled-Manhattan baseline, which would rig the comparison in my favour.

**Multiple seeds.** Because the train/test split and training are random, a single run is one sample. I run **three seeds (42, 43, 44)** and report mean ± standard deviation, so a near-baseline result cannot be dismissed as "is this just noise?".

## 3.7 Reproducibility engineering

Every artefact carries its provenance: the model file records the exact git commit, the embedding dimension, and the feature-spec it was trained with; the metrics file records the dataset SHA-256, the seeds, the protocol, and the same git commit. A single command regenerates the whole result from the pinned data, and the model loads with `weights_only=True` (a security measure so a swapped model file cannot execute code inside the service). I verified the full provenance chain: artefact-commit == metrics-commit, pinned-SHA == metrics-SHA, and the loaded model embeds to a correct 128-D unit vector (§9).

## 3.8 The product layer (demonstrating it works for a real user)

To show the model is not just a benchmark number, I wired a **standalone product slice** (`/api/ml-keystroke/*`) into the typing-game backend: a user gives **explicit consent**, **enrols** by typing several windows (which are embedded and turned into a profile), and is then **verified** on a new window. The decision is **fail-safe**: if the inference service is unreachable or the model version does not match the stored profile, the result is INDETERMINATE and the product asks for a fallback factor — it never grants access by default. This slice is deliberately separate from the older statistical engine so the two never entangle, and its safety behaviour is covered by automated tests (§6, §7.10).

---

# 4. Results

All numbers below were produced by training on real CMU data on a laptop CPU (no GPU), averaged over three random seeds (42, 43, 44), and are reproducible with one command (§9). The full run took ≈ 23 minutes and cost £0.

## 4.1 Headline result

**Open-set Equal Error Rate on 16 held-out subjects (mean ± SD over 3 seeds):**

| Scorer | EER (mean) | EER (SD) | Per-seed EER | Comparison |
|---|---|---|---|---|
| **Scaled-Manhattan** (primary; comparable to baseline) | **0.1422 (14.2 %)** | ± 0.0279 | 0.1421 / 0.1764 / 0.1080 | vs published **0.0962 (9.6 %)** |
| **Full ensemble** (secondary; Manhattan + k-NN + Mahalanobis) | **0.1016 (10.2 %)** | ± 0.0097 | 0.1086 / 0.1083 / 0.0878 | — |
| Published baseline — Killourhy & Maxion (2009), scaled-Manhattan | 0.0962 (9.6 %) | (their SD 0.069) | — | reference |

**Two findings stand out:**

1. **The ensemble is both more accurate and far more stable than the simple scorer.** The full ensemble's EER (10.2 %) is ~4 percentage points better than the scaled-Manhattan scorer on the *same embeddings* (14.2 %), and its standard deviation across seeds is **≈ 3× smaller** (0.97 % vs 2.79 %). The hand-built statistical ensemble, operating in the learned embedding space, is doing real work: it extracts a more reliable decision from the same representation. This directly validates the project's central hybrid hypothesis (§1.3).
2. **The honest open-set result sits *above* the published baseline, not below it.** The scaled-Manhattan EER (14.2 %) is worse than the 9.6 % baseline, and the ensemble (10.2 %) is close to but still slightly above it. This is exactly what an *un-leaked* open-set result on a small CPU-trained model should look like — and that it is not magically below 5 % is itself evidence the evaluation is honest (a closed-set or leaky evaluation would have produced a flatteringly low number; see §7.1).

## 4.2 The DET curve

The Detection Error Trade-off curve (figure `det_curve.png`, Appendix C) plots False Reject Rate against False Accept Rate across all thresholds for the primary scaled-Manhattan scorer. The curve has the characteristic convex shape; the EER point sits on the FAR = FRR diagonal at 14.2 %, and the published 9.6 % baseline is marked for reference. The curve communicates the operating-point trade-off directly: a deployment that cared more about security than convenience would move up-left (lower FAR, higher FRR) and vice-versa.

## 4.3 Per-subject analysis (the result is not uniform — and that is informative)

The 16 held-out subjects vary widely in how recognisable their typing is (full table in Appendix C):

- **Most distinctive typists** (lowest EER): subject s036 at **0.9 %**, s017 at **2.0 %**, s022 at **3.5 %** — for these people the system is essentially a strong authenticator.
- **Hardest typists** (highest EER): s047 at **33.5 %**, s007 at **29.5 %**, s037 at **23.4 %** — for these people the password-length signal is too short and inconsistent to separate them reliably.

This spread is scientifically meaningful: it shows the limiting factor is not the model but the **information content of an 11-key fixed password**, which for some people simply does not contain a distinctive enough rhythm. It also motivates the free-text direction (§10): longer, natural typing windows carry far more discriminative signal.

## 4.4 The embedding space is structured (t-SNE)

To check *why* the system works, I projected the held-out subjects' 128-D embeddings to 2-D with t-SNE (figure `tsne.png`, Appendix C). Several subjects form **tight, well-separated clusters** — visual confirmation that the encoder maps a person's typing to a consistent region of the space **even though it never trained on that person** (open-set generalisation). A denser central region, where some subjects overlap, corresponds exactly to the high-EER subjects of §4.3 — the visualisation and the numbers agree, which is a good internal-consistency check.

## 4.5 The system works end-to-end on a live user

Beyond the benchmark, I served the trained model from the live inference service and ran the real product flow: a held-out subject was enrolled, then genuine and impostor windows were verified over HTTP. The mean genuine score (3.10) was clearly lower (more genuine) than the mean impostor score (6.73), i.e. **the live, deployed model correctly ranks impostors as less genuine than the true user** — the science survives the trip from notebook to running service. (This live test also surfaced a real production crash, fixed in §7.10.)

---

# 5. Discussion: Conclusions and Implications

## 5.1 What the results mean (answering the aim)

The aim asked whether a deep embedding + classical verifier can authenticate by typing rhythm alone, and how it compares with the 9.6 % baseline. The honest answer has three parts:

1. **Yes, it authenticates** — far above chance (an EER of 0.5 would be random guessing; the system reaches 10–14 %), on subjects it never trained on, end-to-end through a live service.
2. **It does not beat the classical baseline on this small fixed-text benchmark** — the primary scaled-Manhattan EER (14.2 %) is above the 9.6 % reference. This is an honest negative on the headline comparison, and I report it as such rather than reaching for a flattering protocol.
3. **But the hybrid hypothesis holds** — the classical ensemble *in the learned space* (10.2 %, ±1.0 %) is both markedly closer to baseline and ~3× more stable than the simple scorer on the same embeddings. The *combination* of deep representation and classical calibrated verifier is the contribution, and the data support it.

The result is therefore best read as: *a learned representation makes a classical verifier more reliable (lower variance) and nearly recovers the strong hand-tuned baseline, while — unlike the baseline — being open-set and content-independent, the properties an actual authentication product needs.*

## 5.2 Implications for the wider world

- **For account security.** Even a 10 % EER biometric is useful as a *second* factor: combined with a password, it raises the bar for an attacker who has only stolen credentials, at zero extra user effort. As a *continuous* check during a session (the free-text direction), it could catch session hijacking that password-only systems are blind to.
- **For the research community.** The project is a small, reproducible data point in the open question of whether deep embeddings help on *small* keystroke datasets. The clear, documented finding — embedding + ensemble lowers variance and nearly matches the baseline open-set — is a modest but genuine contribution, and the fully reproducible pipeline (pinned data, fixed seeds, one-command rerun) is itself a contribution to a field where reproducibility is often weak.
- **For users who struggle with conventional authentication.** A silent biometric that needs no extra device could lower the access barrier for people for whom passwords and hardware tokens are a burden — provided it is built with the consent and fail-safe safeguards of §8.

## 5.3 Limitations (stated plainly, because they bound the conclusions)

The conclusions hold *only* within these bounds: a single small public dataset (51 subjects, one 11-key password); a small CPU-trained model (no large-scale or GPU training); fixed-text only (the free-text/continuous claim is designed-for but not yet measured on a real corpus); and a per-user threshold calibration that, while correct in *ranking*, is not yet calibrated on the same scale as the fused score (§7.11). None of these invalidate the measured EER, but each is a reason not to over-generalise from it — and each is a concrete next step (§10).

---

# 6. How My Decisions Shaped the Outcome

Criterion 3.2 asks specifically how my actions and decisions affected the project's outcome. Five decisions were pivotal:

1. **Choosing an open-set protocol over the easier closed-set one** (§7.1) changed the *meaning* of every number in this report. Had I kept the closed-set evaluation, I could have reported a much lower, much more impressive EER — and it would have been scientifically worthless. This decision cost me a "better" headline number and bought me a defensible one. It is the single decision most responsible for the report being trustworthy.
2. **Keeping the classical ensemble as the decision layer** (rather than discarding it for a pure deep approach) is what produced the project's actual positive finding (the variance reduction, §4.1). Had I gone pure-deep, I would have had only the 14.2 % primary number and no contribution.
3. **Reporting scaled-Manhattan as the primary metric** (not the more flattering ensemble number) against the baseline kept the central comparison honest. Choosing the metric *before* seeing which made me look better is a deliberate guard against self-deception.
4. **Training on local CPU instead of cloud GPU** (a replanning decision, §1.5) delivered the same measured result for £0 and with no external dependency, proving the science needs no expensive infrastructure — which strengthens the reproducibility claim.
5. **Building a real product slice and running it live** (rather than stopping at the benchmark) is what exposed the confidence-overflow production bug (§7.10) — a problem invisible to the unit tests. The decision to verify in the real running system, not just in tests, directly improved the system's correctness.

---

# 7. Problems Identified and Overcome

Criterion 4.4 rewards strategic problem-solving with genuine root-cause understanding — not "I had some bugs." The project's full machine-readable problem log contains thirteen entries in the form *problem → root cause → fix → how verified*; I summarise the most instructive below. The most important ones were found not by tests passing but by *questioning whether a passing test actually meant what it claimed* — which is the real skill.

**7.1 — The closed-set evaluation flaw (the most important problem in the project).**
*Problem:* the original evaluator trained the encoder on all 51 subjects and then measured EER per-subject — so the network had already "met" every test subject. Comparing that to a published *open-set* baseline is not like-for-like, and a reviewer reading the training loop would correctly dismiss the result.
*Root cause:* no train-subjects/test-subjects partition; the split protected the *profile* but not the *representation*.
*Fix:* a seeded 35/16 subject split; train only on 35, evaluate only on the 16 held-out, with a runtime assertion that no test subject leaks into training.
*Verified by:* an automated no-leakage test, and the fact that the resulting EER (14.2 %) is honestly *above* baseline rather than implausibly low.

**7.2 — The ensemble was never actually used to measure EER.**
*Problem:* the project's "creative contribution" (the Ledoit–Wolf ensemble) was tested but never invoked in the EER path — only scaled-Manhattan was. The headline would have silently omitted the contribution.
*Root cause:* the ensemble functions were effectively dead code in the evaluation.
*Fix:* a second EER path using the exact production fusion (Manhattan + k-NN + Ledoit–Wolf Mahalanobis), reported as a secondary metric.
*Verified by:* both EERs now reported per run; the ensemble's 10.2 % vs primary 14.2 % is the project's main positive finding.

**7.3 — Real data would have trained on all-zero timings.**
*Problem:* the real CMU file uses key-*name* columns (`H.period`, `H.Shift.r`, `H.Return`), but the code expected printable-character columns — so it would have read zeros and trained on nothing, while still printing a number.
*Root cause:* a mismatch between the synthetic test fixture's column naming and the real file's.
*Fix:* an explicit column remap plus an assertion that the first real window is 11 keys decoding to `.tie5Roanl` with non-degenerate (41/44 non-zero) timings.
*Verified by:* the assertion run over all 20,400 windows.

**7.8 — The evaluator could fabricate a perfect score.**
*Problem:* an earlier evaluator silently fell back to scoring *training* data when the genuine test set was empty, producing a fake 0.0 EER.
*Root cause:* no guard for an empty held-out test set.
*Fix:* the evaluator now *raises an error rather than fabricate a number*; subjects with too few windows are skipped honestly.
*Verified by:* a unit test of the empty-test-set guard.

**7.10 — A production crash found only by running the real system.**
*Problem:* the live `/verify` endpoint returned HTTP 500 for a very consistent typist. No unit test caught it.
*Root cause:* a consistent typist on a fixed 11-key password produces near-identical embeddings → a near-zero per-user threshold → the confidence sigmoid's exponent `score/threshold` exploded → `math.exp` overflowed. The existing guard only handled a threshold of exactly zero, not a tiny positive one.
*Fix:* clamp the sigmoid exponent to a safe range (loss-free, the sigmoid is saturated there) *and* floor the calibrated threshold so no profile is degenerate.
*Verified by:* a regression test, and the live end-to-end run no longer crashing while still ranking impostor > genuine.
*Why this matters:* this bug was invisible to synthetic-data unit tests because synthetic embeddings have artificial spread; only real CMU data on a real consistent typist exposed it. It is the clearest evidence in the project for *why running the real system beats trusting the tests* — and a textbook example of strategic, root-cause problem-solving.

**7.11 — An honest known-limitation (logged, not hidden).**
*Problem:* with the floored threshold, the absolute confidence saturates (everything reads HIGH) even though the model *ranks* genuine below impostor correctly.
*Root cause:* the threshold is calibrated on the L1 metric (~0.001 scale) but the fused score is dominated by the Mahalanobis term (~3–7 scale) — different scales.
*Status:* documented as future work; the *ranking* (and therefore the EER, which depends only on rank order) is unaffected. I chose to record this openly rather than paper over it.

The remaining log entries cover a float-precision train/serve skew, a NaN/padding leak in the encoder, an artifact that couldn't rebuild a non-default architecture, an arbitrary-code-execution risk in model loading (closed with `weights_only=True`), a silent non-model fallback, the dataset SHA pinning, and the identical closed-set defect in the free-text path (fixed the same way as §7.1).

---

# 8. Ethics, Safety and Responsible Use

Criterion 4.2 asks for *decisions* made in light of ethical and safety issues — not a checkbox. Biometric authentication is ethically serious precisely because it works: a system that can recognise people from their behaviour can also surveil them. I made several deliberate decisions to keep this project on the right side of that line.

**8.1 Biometric data is legally and ethically special.** Under the UK/EU GDPR (Article 9), *biometric data processed for the purpose of uniquely identifying a person* is **special-category data** — the most protected class, alongside health and ethnicity. GDPR Article 4(14) explicitly includes *behavioural* characteristics, and regulators treat typing rhythm and gait as behavioural biometrics. So the moment this system is used to identify a person, the data it handles is special-category. This is not a hypothetical: it directly shaped my decisions below.

**8.2 Decision: evaluate on a public, anonymised dataset rather than collect new identifiable data.** The headline scientific claim is measured entirely on the CMU benchmark, whose subjects are anonymised (s002, s003, …) and who consented to research use when the data was collected by Carnegie Mellon. I deliberately did *not* train the headline model on data harvested from my own game's users, which would have created a fresh trove of identifiable behavioural data with all the consent and storage obligations that entails. The public dataset gives a comparable, reproducible result *without* my creating new privacy risk — a conscious ethical trade-off in favour of data minimisation.

**8.3 Decision: explicit, revocable consent before any capture in the product.** The product slice requires a user to *opt in* before any keystroke window is captured for biometrics, and opting out **wipes their profile**. Consent is a stored, timestamped record. This implements the GDPR principles of lawful basis and data minimisation at the product level, not just on paper.

**8.4 Decision: store templates, not raw timings; log decisions, not keystrokes.** The inference service is *stateless* and logs *no raw keystroke timings*. The product stores the derived profile (embeddings and statistics) and an audit log of *decisions* (score, version, risk level) — never the raw behavioural stream. This limits the blast radius of any breach: a stolen profile is far less sensitive than a stolen recording of everything a person typed.

**8.5 Decision: fail-safe, never fail-open.** A security system that grants access when it breaks is a liability. I designed the verifier so that any outage or model-version mismatch returns *indeterminate* and forces a fallback factor — it never defaults to "allow". This is an ethical as well as an engineering choice: it protects the user even when the system fails.

**8.6 Dual-use and honest framing.** Behavioural biometrics are dual-use: the same technology that protects an account can, in other hands, deanonymise or track people by their typing. I have been careful to frame this project as *opt-in account protection the user controls*, not covert surveillance, and to surface (not hide) its error rates — a 10 % EER system must never be presented as infallible, because over-trusting a biometric can wrongfully lock out genuine users or wrongly clear impostors. Reporting the honest EER, with its per-subject variation, is itself an ethical act.

**8.7 Safety / risk assessment.** This is a software project with no physical hazards. The relevant risks are *informational*: data leakage (mitigated by §8.4), wrongful rejection of genuine users (mitigated by fail-safe step-up rather than hard lock-out, and by never relying on the biometric as a sole factor), and over-claiming (mitigated by the honesty discipline throughout). A short structured risk assessment is in Appendix E.

---

# 9. Reproducibility and Engineering Practice

A scientific claim that cannot be reproduced is an opinion. I treated reproducibility as a first-class requirement.

**9.1 One-command reproduction.** A single script (`reproduce.ps1`) verifies the dataset SHA-256, trains over three seeds, asserts the EER is within a sane ceiling, regenerates the figures, and runs the full test suite — failing loudly on any step. From a clean checkout (plus the separately-downloaded dataset), the entire result regenerates unattended.

**9.2 Pinned data + fixed seeds.** The dataset is pinned by SHA-256; all randomness is seeded; CPU training is deterministic. The same seed reproduces the same model bit-for-bit.

**9.3 Provenance chain (verified).** The model artefact records its git commit and feature-spec; the metrics file records the dataset SHA, seeds and the same commit. I verified artefact-commit == metrics-commit and pinned-SHA == metrics-SHA, so the result, the data and the code version are provably the same triple.

**9.4 Tested, not asserted.** The project has **102 automated tests** (research 65, inference service 22, product 16) covering the featurization, the encoder, the loss, the open-set split, the no-leakage guard, the EER honesty guards, the wire contract, the profile builder, and the fail-safe decision logic. Every claim in this report that says "verified" points to a test or a logged run, not an assertion.

**9.5 Train/serve fidelity.** The served model embeds *byte-identically* to what training produced (the same featurization and encoder code is shared), so there is no gap between the measured science and the deployed product.

---

# 10. Reflection: What I Learnt and What I Would Improve

_[STUDENT: this section must be in your own voice — the assessor reads it closely, and CREST wants at least half a page of genuine reflection. The draft below is honest and specific; adapt the wording so it sounds like you, and add anything personal about how the project felt to do.]_

**What I learnt — technical.** The deepest technical lesson was the difference between *closed-set* and *open-set* evaluation, and how easy it is to fool yourself. My first evaluation produced a number I was briefly pleased with — until I traced the training loop and realised the model had seen the very subjects I was testing on. Learning to *distrust a flattering result and audit the protocol that produced it* was more valuable than any single algorithm. I also learnt, concretely, why the international standard for biometrics centres on EER and DET curves rather than "accuracy": with two error types that trade off against each other, a single accuracy figure is meaningless.

**What I learnt — about doing science.** Reproducibility is not paperwork; it is what separates a result from a claim. Pinning the dataset by hash, fixing seeds, and recording the git commit in every artefact felt like overhead until the moment I could regenerate the entire headline number with one command — at which point it became the thing I trusted most. I also learnt that *running the real system* finds bugs that tests cannot: the production crash in §7.10 was invisible to every unit test and appeared the instant a real consistent typist hit the live endpoint.

**What I would improve / do next.**
1. **Free-text, continuous verification on a real corpus.** The fixed 11-key password is the binding constraint (§4.3); natural typing carries far more signal. The Phase-2 free-text pipeline is built and open-set-correct, but a real result needs a large public corpus (the Aalto 136-million-keystroke dataset) — the clear next experiment.
2. **Recalibrate the confidence on the fused-score scale** (§7.11) so the product's confidence percentage is meaningful, not just the ranking.
3. **Train at scale on GPU.** Everything here ran on a laptop CPU for £0; a larger model on more data (following TypeNet) would test whether the hybrid's advantage holds as accuracy improves.
4. **Collect a small, consented in-game dataset** to test cross-dataset generalisation — with the consent and storage safeguards of §8 built in from the first line.

**What I would change about how I worked.** _[STUDENT: one or two honest sentences — e.g. you would write the evaluation protocol down before coding it next time, or you would have asked your mentor to review the statistics earlier. Specific beats generic.]_

---

# 11. Conclusion

This project set out to determine, honestly and reproducibly, whether a deep metric-learning embedding of typing rhythm, paired with a classical calibrated verifier, can authenticate a person on the standard CMU keystroke benchmark, and how it compares with the published 9.6 % baseline. Under a strict open-set protocol on 16 subjects never seen in training, the system reached an Equal Error Rate of **14.2 % (scaled-Manhattan, the comparable metric)** and **10.2 % (full ensemble)**, the latter both closer to the baseline and three times more stable across seeds. The headline comparison is an honest near-miss on the baseline; the real finding is that **a learned representation makes a classical verifier more reliable and nearly recovers a strong hand-tuned baseline while being open-set and content-independent — the properties a real authentication product requires.** The project's lasting value is less the number than the *discipline*: an evaluation that refuses to flatter itself, thirteen documented problems overcome (including a production bug found only by running the real system), a substantive ethics analysis treating biometric data as the special-category data it legally is, and a result any reader can regenerate with one command. _[STUDENT: close with one sentence on what this project meant to you and where you would take it.]_

---

# 12. AI Use Statement

This statement is provided in line with CREST's policy on the use of AI, which permits AI assistance provided it is original (not whole AI-generated sections passed off as one's own), attributed, and explained.

**Tool used.** Anthropic's **Claude** (model: Claude Opus), accessed through the **Claude Code** command-line assistant, used on a Windows laptop during the research sprint of **8–9 June 2026** and during the writing of this report.

**What the AI was used for:**
- *Code scaffolding and debugging:* generating first drafts of functions (e.g. the open-set split, the figure scripts, the profile builder), and helping diagnose bugs — every one of which I reviewed, ran, and tested. The AI did not produce a single number in this report; all results come from code executing on my machine.
- *Literature pointer-finding:* surfacing the key references (CMU/Killourhy–Maxion, TypeNet, FaceNet, Ledoit–Wolf, GDPR), which I then verified against their primary sources. Citations flagged as unverified during that process were excluded.
- *Drafting and structuring this report:* the AI helped organise the report against the CREST criteria and produced draft prose, which I then edited into my own voice, fact-checked against my code and results, and completed with the personal content (motivation, mentor, reflection) only I can supply.

**What I did myself / how I checked the AI:** I set the research direction and made every design decision (open-set protocol, the hybrid architecture, the honesty rules, the ethics stance). I ran all the code, read the diffs, and verified every "verified by" claim against an actual test or logged run. Where the AI's first attempt was wrong — for example, an early evaluation that was closed-set — I identified the flaw and directed the fix (§7.1). The scientific judgements, and the responsibility for them, are mine.

**Representative prompt (sample).** _"The Phase-1 EER is measured by training on all 51 subjects then scoring per-subject — isn't that closed-set leakage? Add a proper open-set subject split (train on a subset, evaluate only on held-out subjects) and assert no leakage."_ — illustrating that the AI was directed by my scientific judgement, not the other way around.

_[STUDENT: keep an appendix or folder of your actual prompt/response transcripts if you have them — CREST says AI use should be "clearly evidenced" where possible, and the Claude Code session logs serve exactly this purpose.]_

---

# 13. References

References use an author–date style; URLs are given for openly-accessible sources. (Full source provenance, including items I checked and rejected, is in `CREST_Research_Dossier.md`.)

1. Killourhy, K. S. & Maxion, R. A. (2009). *Comparing Anomaly-Detection Algorithms for Keystroke Dynamics.* Proc. IEEE/IFIP Int. Conf. on Dependable Systems and Networks (DSN-2009), pp. 125–134. Dataset: https://www.cs.cmu.edu/~keystroke/
2. Acien, A., Morales, A., Monaco, J. V., Vera-Rodriguez, R. & Fierrez, J. (2021). *TypeNet: Deep Learning Keystroke Biometrics.* IEEE Trans. Biometrics, Behavior, and Identity Science. arXiv:2101.05570.
3. Schroff, F., Kalenichenko, D. & Philbin, J. (2015). *FaceNet: A Unified Embedding for Face Recognition and Clustering.* CVPR 2015, pp. 815–823. DOI 10.1109/CVPR.2015.7298682. arXiv:1503.03832.
4. Hermans, A., Beyer, L. & Leibe, B. (2017). *In Defense of the Triplet Loss for Person Re-Identification.* arXiv:1703.07737.
5. Wen, Y., Zhang, K., Li, Z. & Qiao, Y. (2016). *A Discriminative Feature Learning Approach for Deep Face Recognition (center loss).* ECCV 2016, LNCS 9911, pp. 499–515. DOI 10.1007/978-3-319-46478-7_31.
6. Ledoit, O. & Wolf, M. (2004). *A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices.* J. Multivariate Analysis 88(2), 365–411. DOI 10.1016/S0047-259X(03)00096-4. (Reference implementation: scikit-learn `LedoitWolf`.)
7. Dhakal, V., Feit, A. M., Kristensson, P. O. & Oulasvirta, A. (2018). *Observations on Typing from 136 Million Keystrokes (Aalto dataset).* CHI 2018. DOI 10.1145/3173574.3174220. Data: https://userinterfaces.aalto.fi/136Mkeystrokes/
8. ISO/IEC 19795-1. *Information technology — Biometric performance testing and reporting — Part 1: Principles and framework.* https://www.iso.org/standard/73515.html
9. *Keystroke Dynamics: Concepts, Techniques, and Applications.* ACM Computing Surveys (2024/25). DOI 10.1145/3733103.
10. Frank, M., Biedert, R., Ma, E., Martinovic, I. & Song, D. (2013). *Touchalytics: On the Applicability of Touchscreen Input as a Behavioral Biometric for Continuous Authentication.* IEEE Trans. Information Forensics and Security 8(1). arXiv:1207.6231.
11. UK GDPR, Article 9 (special-category data) and Article 4(14) (definition of biometric data). https://gdpr-info.eu/art-9-gdpr/ ; UK ICO guidance on biometric data.
12. Verizon. *Data Breach Investigations Report* (annual) — credential-based breaches and credential stuffing. https://www.verizon.com/business/resources/reports/dbir/ _[STUDENT: cite the specific year's edition and the exact statistic you quote in §1.2; confirm the figure in the current report before submission.]_
13. CREST Awards (British Science Association). *Gold criteria guidance*, *Required documentation*, *AI guidance for students*. https://www.crestawards.org/help-centre/gold-criteria-guidance/

---

# 14. Appendices

## Appendix A — CREST criteria → report-section map (evidence index)

This is the index the assessor can use, and the basis for the Student Profile Form. Page numbers are added in the paginated PDF; section numbers are given here.

| Criterion | Where evidenced |
|---|---|
| 1.1 clear aim → objectives | §1.1 (aim sentence + 6 measurable objectives table) |
| 1.2 wider purpose | §1.2 (account-takeover stakeholders, statistics, accessibility) |
| 1.3 range of approaches | §1.3 (3-approach trade-off table + decision) |
| 1.4 plan + justification | §1.4 (3-part hybrid architecture + rationale) |
| 1.5 planned/organised time | §1.5 (Gantt timeline from real git dates; planned vs actual; slippage) |
| 2.1 materials & people | §1.6 (named tools, dataset, libraries, mentor) |
| 2.2 research + sources | §2 (synthesised lit review, gap identified); §13 (referenced) |
| 3.1 conclusions + implications | §4 (results), §5 (discussion + wider-world implications) |
| 3.2 decisions → outcome | §6 (five pivotal decisions and their effects) |
| 3.3 learning + reflection | §10 (reflection, ≥½ page, what I'd improve) |
| 4.1 science understanding | §2 (background), §3 (methodology at KS5/Level-3+ depth) |
| 4.2 ethics & safety | §8 (GDPR special-category, consent, fail-safe, dual-use, risk assessment) |
| 4.3 creative thinking | §3.5 (hybrid: classical ensemble in learned space — combining unrelated areas); §1.3 |
| 4.4 problems overcome | §7 (13 problems, root-cause → fix → verified; the live production bug) |
| 4.5 clear communication | whole report: logical structure, abstract, tables, figures, glossary (App. B), accessible language |

## Appendix B — Glossary (criterion 4.5: define abbreviations)

- **Biometric** — a measurable human characteristic used to recognise identity.
- **Behavioural biometric** — one based on *how* you act (typing rhythm, gait), not *what you are*.
- **Keystroke dynamics** — recognising a person by their typing timing.
- **Embedding** — a fixed-length vector representation of an input; here, 128 numbers per keystroke window.
- **Triplet loss** — a training objective that pulls same-person embeddings together and pushes different-person ones apart.
- **EER (Equal Error Rate)** — the threshold where the false-accept rate equals the false-reject rate; lower is better.
- **FAR / FRR** — False Accept Rate (impostors let in) / False Reject Rate (genuine users turned away).
- **DET curve** — Detection Error Trade-off curve, plotting FAR against FRR across thresholds.
- **Open-set** — evaluated on subjects *not* seen in training (the honest test for authentication).
- **Mahalanobis distance** — a distance that accounts for correlations between dimensions.
- **Ledoit–Wolf shrinkage** — a method to make a covariance matrix stable and invertible from few samples.
- **CMU dataset** — the Killourhy–Maxion keystroke benchmark (51 subjects, password `.tie5Roanl`).

## Appendix C — Full results tables and figures

**Per-subject EER (primary scaled-Manhattan, seed 42 detail), 16 held-out subjects:**

| Subject | EER | | Subject | EER |
|---|---|---|---|---|
| s036 | 0.009 | | s053 | 0.090 |
| s017 | 0.020 | | s010 | 0.090 |
| s022 | 0.035 | | s038 | 0.090 |
| s012 | 0.051 | | s050 | 0.179 |
| s005 | 0.045 | | s056 | 0.190 |
| s007 | 0.295 | | s030 | 0.190 |
| s018 | 0.205 | | s054 | 0.215 |
| s037 | 0.234 | | s047 | 0.335 |

**Aggregate (mean ± SD over seeds 42/43/44):** scaled-Manhattan 0.1422 ± 0.0279; full ensemble 0.1016 ± 0.0097; baseline 0.0962.

**Figures (committed in `research/artifacts/`):** `det_curve.png` (DET curve with EER point and 9.6 % baseline); `tsne.png` (t-SNE of held-out-subject embeddings, coloured by subject). _[Embed both figures here in the final PDF.]_

## Appendix D — Code and artefact map

- `research/` — offline harness: `ksbio/featurize.py`, `encoder.py`, `triplet.py`, `train.py`, `evaluate.py`, `ensemble.py`, `artifact.py`; `scripts/train_cmu.py` (open-set Phase-1), `train_freetext.py` (Phase-2), `make_figures.py`, `reproduce.ps1`.
- `ml-service/` — FastAPI inference service: `app/contract.py` (frozen wire contract), `model.py`, `torch_embedder.py`, `verify.py`.
- Product slice — `services/keystrokeProfileBuilder.js`, `controllers/mlKeystrokeController.js`, `routes/mlKeystrokeRoutes.js`, `models/MlKeystrokeProfile.js`.
- Evidence — `research/artifacts/metrics.json` (headline numbers + provenance), `problem_log.json` (the 13 problems), `det_curve.png`, `tsne.png`; `CREST_Research_Dossier.md` (full citations).

## Appendix E — Risk assessment (informational risks)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Leak of stored biometric profiles | Low | High | Store derived templates not raw timings; stateless service logs no keystrokes (§8.4) |
| Genuine user wrongly rejected | Medium | Medium | Never sole factor; fail-safe step-up not hard lock-out; honest EER disclosed (§8.5–8.6) |
| Impostor wrongly accepted | Medium | Medium | Used as a *second* factor; ensemble lowers EER; continuous re-check planned (§5.2) |
| Over-claiming accuracy | Low | High | Report honest open-set EER with per-subject variance; no fabricated numbers (§7) |
| Misuse for covert surveillance (dual-use) | Low | High | Opt-in, user-controlled framing; consent + revocation enforced (§8.3, §8.6) |

---

*End of report. This document, the code, the metrics, the figures and the problem log together constitute the CREST Gold submission; the accompanying Student Profile Form maps each criterion to its page.*
