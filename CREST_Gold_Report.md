# Can You Be Recognised by the Way You Type? Building and Testing a Keystroke-Dynamics Verification System

**A CREST Gold Award Research Project**

| | |
|---|---|
| Student | Devadit Jain |
| Project type | Research / investigation (with a design-and-make engineering component) |
| Project title | Content-independent keystroke-dynamics verification: can a deep embedding plus a classical statistical verifier recognise a person from typing rhythm alone, and how close does it get to the published benchmark? |
| Field | Computer science · machine learning · cybersecurity / behavioural biometrics |
| Mentor / supervisor | None — independent project, no mentor or supervisor |
| Dates | 25 November 2025 – 10 June 2026 (research sprint 8–10 June 2026) |
| Word count | _[fill in at submission]_ |
| Pages | _Numbered throughout; the Student Profile Form maps each of the 15 CREST criteria to the sections below._ |

> **A note on AI use, read first.** I designed, built, debugged and evaluated this system myself. I used an AI assistant (Anthropic's Claude, inside the Claude Code tool) to help with coding, debugging and drafting, which CREST allows. Section 12 sets out exactly what it did and what I checked. Every number in this report came out of code running on my own laptop and can be regenerated with a single command; none is made up. A few placeholders in _[square brackets]_ remain — they are values to fill in at submission (page numbers, word count, where to paste the figures), not missing content.

---

## Abstract

A password only proves that someone knows a secret. It cannot tell whether the person typing it is really the account's owner. Keystroke dynamics — the rhythm of how someone presses and releases keys — is a behavioural biometric that could add a second, silent identity check on top of a password. This project asks one question: can a deep embedding of typing timing, combined with a classical statistical verifier, recognise a person from rhythm alone, and how close does it get to the long-standing published benchmark?

I built the whole system in three parts: a research harness in PyTorch that trains the model, a small FastAPI service that serves the frozen model, and a Node.js product layer where a real user can consent, enrol and be verified. The model is a 1-D convolutional + bidirectional-GRU + attention network that turns a window of keystrokes into a 128-number vector. On top of that learned representation I run a hand-built ensemble (Ledoit–Wolf shrinkage + Mahalanobis + nearest-neighbour) to make the actual accept/reject decision.

I tested on the standard CMU benchmark (51 people typing the password `.tie5Roanl`) using a deliberately strict open-set protocol: train on 35 people, test only on the 16 the model has never seen, so the result measures whether it generalises to new users rather than memorising old ones. Averaged over three random seeds, the system reached an Equal Error Rate (EER) of 14.2% ± 2.8% with the scaled-Manhattan scorer — the metric that is directly comparable to the published baseline of 9.6% — and 10.2% ± 1.0% with the full ensemble. The ensemble was both closer to the baseline and about three times more stable across seeds. So the main finding is not that the deep model beats the classical baseline; it is that putting a classical verifier inside a learned embedding space gets close to the baseline with much lower variance, on people it never trained on.

What I am most proud of is the honesty of the evaluation. I describe a closed-set mistake that would have produced a much better-looking but meaningless number, the fix to an open-set protocol, and twelve other problems I found and fixed — including a crash that only showed up when I ran the real system. A later ablation, which kept the test set untouched, confirmed that my settings were already near-optimal: the one change that looked better on the validation split actually generalised worse on the test set. The report ends with an ethics section (biometric data is special-category data under GDPR; consent; fail-safe design; dual use) and an honest reflection on the limits and next steps.

---

## Table of Contents

1. Introduction and project planning
2. Background and literature
3. Method
4. Results
5. Discussion
6. How my decisions shaped the outcome
7. Problems I found and fixed
8. Ethics and safety
9. Reproducibility
10. Reflection
11. Conclusion
12. AI use statement
13. References
14. Appendices (A: criteria map · B: glossary · C: full results · D: code map · E: risk assessment)

---

# 1. Introduction and project planning

## 1.1 Aim and objectives

> **Aim:** Find out whether a content-independent deep embedding of keystroke timing, combined with a classical statistical verifier, can verify a person's identity from typing rhythm alone, and measure how its open-set EER compares with the published scaled-Manhattan benchmark of 9.6% on the CMU dataset.

I wrote the aim so it has a clear pass/fail test: a single number, the Equal Error Rate (defined in §2.3), measured under a protocol fixed before I saw the result, against a published reference. I would count the project a success if it (a) produced a real, reproducible EER on people it never trained on, and (b) that number could be read sensibly against the 9.6% baseline — whether it beat it, matched it, or fell short. Each of those outcomes is meaningful, as long as the measurement is honest.

I broke the aim into six objectives, each with a success condition I could check:

| # | Objective | Success condition | Outcome |
|---|---|---|---|
| O1 | Build a keystroke-embedding network | Maps a variable-length window to a fixed 128-D vector; forward pass runs on CPU | Met (§3.3) |
| O2 | Train it so same-person windows cluster and different-person windows separate | After training, mean within-person distance < mean between-person distance, checked by a test | Met (§3.4) |
| O3 | Evaluate honestly on a public benchmark, open-set | EER computed only on held-out people; the evaluator refuses to score training data | Met (§3.6, §4) |
| O4 | Reuse a statistical ensemble as the decision layer inside the embedding space | Two EERs reported (scaled-Manhattan vs full ensemble) from one run | Met (§4.1) |
| O5 | Make the pipeline reproducible | One script regenerates the result from a SHA-pinned dataset and fixed seeds | Met (§9) |
| O6 | Show it working in a real product flow with safe failure | A live service serves the model; a user can consent → enrol → be verified; outages never grant access | Met (§3.8, §6) |

Forcing each objective to carry a checkable condition mattered more than it sounds. It is what stopped me hiding a non-result behind something that merely "ran" — which is exactly the trap I nearly fell into (§7.1).

## 1.2 Wider purpose

Passwords are how most of us prove who we are online, but they check knowledge, not identity: anyone who steals or guesses a password becomes, as far as the system is concerned, the real owner. Account-takeover is a large and stubborn problem. Verizon's 2024 Data Breach Investigations Report found that stolen credentials were used in roughly 77% of breaches against web applications, and that compromised credentials remain the most common way attackers get in; credential-stuffing (replaying leaked username/password pairs automatically) is a dominant attack on login systems (Verizon, 2024). Multi-factor authentication helps but adds friction — a code to fetch, a device to carry — and people switch it off or work around it. So a login is usually defended by a single secret that, once leaked, offers no further protection. That is the gap a behavioural biometric could fill.

Behavioural biometrics work silently: instead of asking the user to do something extra, the system watches how they already type. The idea is old — telegraph operators were recognised by the rhythm of their "fist" in the 19th century — but modern machine learning makes content-independent typing recognition (recognising rhythm whatever the text) genuinely practical (Acien et al., 2021). A good typing biometric could act as an invisible second factor at login, run continuously during a session to catch a hijacked login, and lower the barrier for people who find passwords and hardware tokens hard to manage.

The people who would benefit are ordinary account holders on any site with a login — in my case the players of *Typing Sanctuary*, the typing game that is the product side of this project. A typing game is a natural home for the idea because its users are already typing constantly, so the biometric can be collected without asking them to do anything new. The same people are also the ones put at risk if the technology is built carelessly, which is why I treat ethics (§8) as part of the project rather than an add-on.

This is not abstract for me. A security incident, where an account I cared about was accessed using stolen credentials, is what made the weakness of passwords feel real: the password "worked" perfectly for the attacker, because it only ever proved knowledge of a secret, not identity. That is what pushed me towards behavioural biometrics, and towards the specific question of whether *how* a person types could be a quiet second check that a stolen password cannot fake. _[Devadit: if you're comfortable, replace this with the specific detail — which account and roughly what happened — one concrete sentence is stronger; the version above is already true and fine to leave.]_

## 1.3 Approaches I considered

There were three genuinely different ways to build the verifier. I compared them before committing.

**A — Pure statistical / anomaly detection (the classical baseline).** Extract hand-designed timing features per keystroke and score a new sample against a per-user statistical profile, using a distance like scaled-Manhattan or Mahalanobis. This is what Killourhy & Maxion (2009) benchmarked. It is simple, interpretable, needs no cross-user training, and has strong published results (best detector EER ≈ 9.6%). Its weaknesses: it is tied to fixed text (it compares like-for-like keystrokes), it breaks on new passwords or free text, and a human chooses the features.

**B — Pure deep classifier.** Train a network to output a probability over the enrolled users (a softmax classifier). It can be very accurate on a fixed set of users, but it is closed-set by nature: it only recognises users it was trained on, so every new sign-up means retraining the whole network. For a product where people sign up all the time, that is a dealbreaker.

**C — Deep metric-learning embedding (chosen).** Train the network not to classify but to embed: map any window to a vector so that same-person windows land close together and different-person windows land far apart, using a triplet loss (Schroff et al., 2015; Hermans et al., 2017). A new user is enrolled by storing a few of their embeddings — no retraining. It is open-set by construction (the standard approach in modern face and biometric recognition), content-independent, and reasonably data-efficient. It is harder to train, and the raw embedding still needs a sensible decision rule on top of it.

Rather than throw away the classical statistics of A, I run them inside the learned embedding space of C: the network gives the representation, and a Ledoit–Wolf Mahalanobis + nearest-neighbour + scaled-Manhattan ensemble makes the decision. That combination is the core idea of the project.

| | A: Statistical | B: Deep classifier | C: Metric embedding (+ ensemble) |
|---|---|---|---|
| Open-set (new users, no retraining) | yes | no | yes |
| Content-independent (any text) | no | partial | yes |
| Data efficiency | high | low | medium |
| Interpretability | high | low | medium |
| Published precedent | strong (9.6%) | some | strong (TypeNet, FaceNet) |
| Risk to build in a short sprint | low | medium | medium–high |
| Fit to an authentication product | poor | poor | best |

I chose C with the A-style ensemble on top, because only an open-set, content-independent method fits a real product where users keep signing up, and because keeping the classical verifier let me compare directly against the 9.6% baseline and reuse statistical code I had already tested rather than discarding it.

## 1.4 The plan, and why this shape

The system has three parts, arranged so the live product and the research share exactly one thing — the trained model — across a clean boundary:

1. **Research harness** (`research/`, Python + PyTorch) — *makes* a frozen, versioned model reproducibly (fixed seeds, pinned dataset, recorded git commit).
2. **Inference service** (`ml-service/`, Python + FastAPI) — *serves* that model through `/embed`, `/verify`, `/health`. It holds the model in memory, stores nothing, and logs no raw timings.
3. **Product shell** (Node.js / Express) — the existing typing game; owns users and sessions, calls the inference service, and enforces the decision.

Keeping the thing that *makes* the scientific claim separate from the thing that *serves* it to users means the live app never trains and never touches a dataset, and the research never touches live user data. There is a single fixed contract between them (`EMBED_DIM = 128`, L2-normalised). That separation is what makes both the science and the product trustworthy.

I also fixed the failure behaviour up front: the system is fail-safe, never fail-open. On any outage or version mismatch, verification returns "indeterminate" and the product falls back to another factor — it never silently lets someone in. A security feature that admits everyone when it breaks is worse than none, so this was non-negotiable. It later caught a real bug (§7.5).

## 1.5 Plan and timeline

Building everything under version control means every step has a real, dated timestamp, so the 87 git commits (Nov 2025 – Jun 2026) act as an automatic logbook. 37 of them cover the six-month foundation (the game and the first two biometric engines), and 50 fall inside the three-day research sprint of 8–10 June 2026 (33, 13 and 4 on the three days). _[Devadit: this is a live count; re-run `git rev-list --count HEAD` at submission for the exact final figure.]_ The timeline below comes straight from the commit history.

```
 2025                                         2026
 Nov   Dec        Jan   Feb        Mar        Apr  May  Jun8  Jun9 Jun10
 |-----|----------|-----|----------|----------|----|-----|-----|-----|----|
 [Game build.......]                                            (product shell)
       [Multiplayer, leaderboard, hearts]
                        [Google OAuth + 1st keystroke biometrics v1]
                                  [Keystroke biometric engine v2 (statistical)]
                                                        [Design spec + plans]  Jun 8 09:03
                                                        [Foundation: harness, contract, stub]  Jun 8
                                                        [Real model: featurize -> encoder -> triplet -> artifact]  Jun 8
                                                              [Serving, free-text path, Modal config]  Jun 9 am
                                                              [Open-set fix + measured EER + product slice]  Jun 9
                                                                    [Nested-validation ablation + report]  Jun 10
```

| Date (from git) | Milestone |
|---|---|
| 2025-11-25 | Game project begins ("Initial commit — Speed Typing Battle") |
| Dec 2025 | Multiplayer, leaderboard, hearts/penalty system |
| 2026-02-21 | Google OAuth + first keystroke-biometrics capture (v1) |
| 2026-03-28 | Statistical biometric engine (v2) |
| 2026-06-08 09:03 | Design specification for the deep-model rebuild |
| 2026-06-08 09:30 | Fixed a production JWT bug (`req.userId`) that had silently disabled the live feature |
| 2026-06-08 10:30–17:47 | Model: metrics, ensemble port, featurization, encoder (CNN+BiGRU+attention), triplet loss, deterministic trainer, versioned artifact |
| 2026-06-08 19:50–20:46 | Honest EER evaluator, scripted CMU download with SHA-256, Phase-1 CLI, column-remap fix |
| 2026-06-09 07:21–09:07 | Serving (`TorchEmbedder`), free-text path, Modal GPU config, load-time dimension guard |
| 2026-06-09 16:32 | Open-set evaluation fix + ensemble EER + pinned dataset |
| 2026-06-09 16:42 | Standalone product slice (consent → enrol → verify) |
| 2026-06-09 17:19 | Trained on real data → measured EER; figures; fixed a live bug |
| 2026-06-09 22:29 | Open-set free-text Phase-2 + reproducibility chain |
| 2026-06-10 | Nested-validation ablation (test set kept untouched); confirmed settings near-optimal |

CREST expects about 70 hours of work at Gold. My rough breakdown, estimated against the dated commit clusters, comes to about 84:

| Phase of work | Approx. hours | Evidence |
|---|---|---|
| Background reading (CREST research; ~18 papers; CMU, TypeNet, FaceNet, Ledoit–Wolf, GDPR) | ~10 | §2, §13, dossier |
| Product-shell work relevant to the research (capture v1/v2, the serving seam) | ~14 | 37 foundation commits |
| Research design (architecture, the fixed contract, the open-set protocol) | ~8 | Design-spec commit |
| Implementation (encoder, triplet loss, ensemble, evaluator, profile builder, service) | ~20 | Sprint commits Jun 8–9 |
| Experiments and debugging (training runs, open-set fix, the 13 problems, the ablation) | ~14 | §7, metrics, sweep results |
| Analysis and figures (EER, DET, t-SNE, per-subject, ablation) | ~6 | §4, figures |
| Writing, ethics and reflection | ~12 | this report |
| **Total** | **~84** | above the 70-hour expectation |

Two things slipped during the sprint, and both were deliberate calls worth recording. First, I deferred GPU training once I worked out the model was small enough to train in about 23 minutes on my laptop for £0; the cloud GPU step would only have cost roughly £0.10–0.50 but needed no authorisation if it ran locally, so local CPU it was. Second, I scaled the free-text Phase-2 benchmark back to "pipeline proven, real corpus deferred" when I judged that downloading the 136-million-keystroke Aalto corpus was more schedule risk than it was worth inside the sprint (§10).

## 1.6 Materials, tools and people

- **Dataset:** the CMU Keystroke Dynamics Benchmark (`DSL-StrongPasswordData.csv`), Killourhy & Maxion, Carnegie Mellon — 51 people, 400 repetitions each of `.tie5Roanl`. Taken from the authors' public page and pinned by SHA-256.
- **Languages and libraries:** Python 3.12; PyTorch 2.12 (CPU) for the network; NumPy for the ensemble; FastAPI + Uvicorn for the service; scikit-learn (t-SNE) and Matplotlib for figures; Node.js / Express for the product; Jest and pytest for testing.
- **Statistical method:** the Ledoit–Wolf shrinkage covariance estimator, cross-checked against scikit-learn's implementation.
- **Infrastructure considered:** Modal (serverless GPU) for a future deployment — configured but not run, to avoid cost.
- **Tooling:** Git (version control, and a handy dated logbook); the Claude Code AI assistant (fully disclosed in §12).
- **People:** this was an independent project, with no mentor or supervisor. The "people" side of it therefore came from the wider research community rather than one named person: the authors whose methods I built on (Killourhy & Maxion; the FaceNet and TypeNet teams; Ledoit & Wolf), the maintainers of the open-source libraries I used, and the public standards and guidance I read (ISO/IEC 19795-1; the ICO's GDPR material). The job a mentor usually does — being the second person who distrusts a convenient result — I had to do myself, by auditing my own work, which is how the most important mistake got caught (§7.1). I note the lack of an outside reviewer honestly as a limitation and something I would change (§10).

---

# 2. Background and literature

This section sets out the science the project rests on, and pulls the prior work together to find the gap I am trying to fill. I have tried to join the threads rather than summarise paper by paper.

## 2.1 Keystroke dynamics as a behavioural biometric

Biometrics split into two families: physiological (fingerprint, iris, face — what you *are*) and behavioural (signature, gait, voice, typing rhythm — how you *behave*). Keystroke dynamics is behavioural: it describes a person by the timing of their typing, not the content. The basic measurements are inter-key timings:

- **Hold time (dwell):** how long a key is held down.
- **Down–down latency:** time between pressing one key and the next.
- **Up–down latency (flight time):** time between releasing one key and pressing the next.
- **Up–up latency:** time between releasing consecutive keys.

These timings are surprisingly personal, because they come from motor habits and hand geometry that are hard to fake on purpose. There are two settings: fixed-text, where everyone types the same string (the CMU benchmark), and free-text, where the person types whatever they like (needed for continuous authentication). Fixed-text is easier because you compare matching keystrokes directly; free-text needs a content-independent model that learns rhythm regardless of the words. A recent ACM Computing Surveys review (2024/25) describes the field moving from hand-built statistical detectors in the 2000s to deep representation learning in the 2020s — the exact transition this project sits on.

## 2.2 Metric learning and embeddings

The key move in modern biometrics is to stop asking "which known user is this?" (classification) and instead learn an embedding: a function that maps an input to a point in a vector space where distance encodes identity. FaceNet (Schroff, Kalenichenko & Philbin, 2015) set the template for faces — a network trained so that the distance between two embeddings of the same person is small and between different people is large, using a triplet loss. A triplet is (anchor, positive, negative): same person, same person, different person. The loss pushes the anchor–positive distance below the anchor–negative distance by a margin:

> `L = max(0, d(anchor, positive) − d(anchor, negative) + margin)`

FaceNet used a 128-dimensional embedding and reached 99.6% on a face benchmark; I use the same 128-D, L2-normalised design for keystrokes. Hermans, Beyer & Leibe (2017) showed that *which* triplets you pick matters a lot, and that batch-hard mining — for each anchor in a mini-batch, take the hardest positive (furthest same-person) and hardest negative (closest different-person) — is a simple, strong choice. I use it. Wen et al. (2016) added a center loss that pulls each class towards its own centre, tightening the clusters; I add a small amount of it to keep per-user spread under control.

L2-normalisation (dividing each embedding by its length, so it lands on the unit sphere) means distance depends on the *direction* of the vector, not its magnitude — the right thing for comparing rhythm patterns.

## 2.3 The decision, and how you measure it

A raw embedding is not yet a decision. The verifier has to turn "how far is this new window from the user's profile?" into accept or reject. I use three distances together:

- **Scaled-Manhattan:** mean absolute deviation from the user's mean, scaled by per-feature spread — the exact form of the best CMU detector, so it gives a like-for-like comparison.
- **Mahalanobis:** accounts for correlations between dimensions using the inverse covariance matrix. With only a handful of enrolment samples in 128 dimensions, the raw sample covariance is unstable and not invertible, so I use Ledoit–Wolf shrinkage (Ledoit & Wolf, 2004), which blends the sample covariance with a well-behaved target to guarantee a stable, invertible matrix — exactly the small-sample, high-dimensional situation enrolment lives in.
- **Nearest-neighbour:** mean distance to the *k* closest enrolment embeddings, which copes with people who type in more than one way (warmed up versus tired).

To measure performance: a verifier makes two kinds of error, accepting an impostor (False Accept Rate, FAR) and rejecting a genuine user (False Reject Rate, FRR). Moving the threshold trades one for the other — strict annoys real users, lax is insecure. The Equal Error Rate (EER) is the point where FAR = FRR, and it is the standard single-number summary of a biometric. Lower is better. Plotting FAR against FRR across all thresholds gives the Detection Error Trade-off (DET) curve. These follow the international standard for biometric testing, ISO/IEC 19795-1.

## 2.4 Prior work and the gap

Two reference points bracket this project:

- **The classical benchmark, Killourhy & Maxion (2009).** They collected the CMU dataset (51 people × 400 reps of `.tie5Roanl`) and compared 14 anomaly detectors. The best, scaled-Manhattan, reached EER 0.0962 (9.6%); nearest-neighbour-Mahalanobis 0.0996; plain Mahalanobis 0.110; Euclidean 0.171. 9.6% is the number I measure against.
- **The deep state of the art, TypeNet (Acien et al., 2021).** A Siamese LSTM trained on more than 136 million keystrokes from about 168,000 people, reaching EER 2.2% on a physical keyboard and 9.2% on touchscreen, and scaling to 100,000 users — showing that learned, content-independent keystroke embeddings work at internet scale.

TypeNet shows deep embeddings work given enormous data. The CMU benchmark shows classical statistics work on small fixed-text data. The under-explored middle ground — and something a student-scale project can actually contribute to — is this: on the small, public, reproducible CMU benchmark, does a deep embedding *plus* a classical verifier do any better than the classical verifier alone, when you test it honestly on people it never trained on? That is the falsifiable question here. The contribution is not a new record; it is a careful, reproducible, honest measurement of a hybrid design on a standard benchmark, with the failure modes written down.

---

# 3. Method

This section is the build, in enough detail to reproduce. The pipeline is: one keystroke window → one 128-number vector → a decision.

## 3.1 Dataset

The CMU file holds, for each of 51 people and 400 repetitions, the timing of typing `.tie5Roanl` then Return — 11 keys, so 11 hold times plus the inter-key latencies, giving 31 timing columns per row and 20,400 rows in total. I checked it structurally (51 people × 400 reps; the column names `H.period`, `H.t`, …, `H.Shift.r`, `H.Return` matching the password) and pinned it by SHA-256, so any future run uses provably the same bytes.

One detail mattered more than it looks. The real file names its columns by key (`H.period`, `H.Shift.r`, `H.Return`), not by printable character. A loader expecting `H..`, `H.R`, `H.\n` would quietly read all-zero timings and train on nothing, while still printing a believable number. I wrote an explicit column remap and an assertion that the first parsed window is exactly 11 keys spelling `.tie5Roanl`, with real (non-zero) timings (§7.3).

## 3.2 Feature representation

Each keystroke becomes a small vector: four timing features (hold, down-down, flight, up-up) plus a learned embedding of which key it was. The timings are measured relative to the first keystroke in the window, so the absolute clock value drops out and floating-point precision is kept. The network sees which keys, and their rhythm, never the meaning of the text — so the representation is content-independent and can in principle carry over from the fixed CMU password to free typing (the basis of Phase 2). The same featurization code runs in training and in serving, so there is no risk of the served model seeing different features from the trained one.

## 3.3 The encoder

The encoder (`KeystrokeEncoder`) turns a window into a 128-D L2-normalised vector in four stages:

1. **Input fusion** — each keystroke's four timing features are joined with a 16-D learned embedding of its character, giving a 20-D per-keystroke vector. The character embedding lets the network learn keyboard geography (which keys sit near each other) instead of being told.
2. **1-D convolutions** — two `Conv1d` layers (20→64→64 channels, kernel 3) slide over the sequence and pick up local rhythm (the timing of adjacent key-pairs, or digraphs).
3. **Bidirectional GRU** — a recurrent layer (hidden size 64 each way → 128) reads the sequence forwards and backwards, catching longer-range cadence across the window.
4. **Attention pooling → projection → L2-norm** — attention takes a weighted average over time (so the network learns which keystrokes matter most), a linear layer projects to 128-D, and a final L2-normalisation puts the vector on the unit sphere.

I chose CNN + BiGRU + attention over a Transformer on purpose: at this data scale a Transformer would overfit, whereas this is data-efficient and reproducible. The whole network has only about 83,500 trainable parameters (≈ 0.08 M), which is the point — a model this small trains to roughly 10% open-set EER on a laptop CPU in minutes, with little room to overfit a 51-person benchmark.

## 3.4 Training

I train with batch-hard triplet loss (margin 0.2) plus a small center-loss term (weight 0.01), using Adam. Each mini-batch picks several people with several windows each; batch-hard mining then selects the hardest positive and hardest negative for each anchor. Training is deterministic — a global seed is set first and the data loader is single-process — so the same seed reproduces the same weights bit-for-bit on CPU. A test checks that after a short run, same-person embeddings really are closer than different-person ones (objective O2), which guards against a collapsed encoder that maps everything to one point.

## 3.5 The verification ensemble

After training, a user is enrolled (not retrained) by embedding about 12 of their windows and building a profile: the centroid (mean embedding), the enrolment embeddings themselves (for nearest-neighbour), and the Ledoit–Wolf inverse-covariance matrix. A new window is scored by three distances to that profile — scaled-Manhattan, nearest-neighbour and Mahalanobis — averaged into one fused score; a per-user threshold then maps it to a confidence and a risk level (LOW/MEDIUM/HIGH). The important part is that these statistics run inside the *learned* 128-D space, not on raw timings: the network gives the representation, the ensemble gives the decision. The exact same fusion code runs in the research evaluation and in the live service, so the EER I measured and the decision I ship are the same maths.

## 3.6 Evaluation protocol

This is the section the whole project's credibility rests on.

**Open-set, held-out people.** I split the 51 people (seeded) into 35 for training and 16 held out for testing. The encoder trains only on the 35; the EER is measured only on the 16 it has never seen. That makes the result a measure of generalisation to new people, which is the only thing that matters for real authentication — your future users were not in your training set. A runtime check guarantees no test person leaks into training. This replaces an earlier closed-set mistake that would have produced a much lower but meaningless number (§7.1).

**Genuine versus impostor, split within each test person.** For each of the 16 test people, I split their windows into an enrolment half and a test half; the test (genuine) windows are scored against the profile built from the enrolment half, so a window is never scored against itself, and the impostor windows are the other test people's windows. If a person has too few windows to hold a test set out, the evaluator raises an error rather than make a number up — a guard I added after an earlier version silently scored training data and produced a fake 0.0 EER (§7.4).

**Two metrics, labelled honestly.** I report the scaled-Manhattan EER as the headline, because it is the exact metric of the published 9.6% baseline. I report the full-ensemble EER as a secondary number, and never compare the ensemble against a scaled-Manhattan baseline, which would tilt the comparison in my favour.

**Three seeds.** Because the split and training are random, one run is one sample. I run three seeds (42, 43, 44) and report mean ± standard deviation, so a near-baseline result can't be waved away as noise.

**Hyperparameter choice by nested validation.** An easy way to fool yourself in machine learning is to try lots of settings, keep the one that scores best on the test set, and report it — which quietly turns the test set into a training signal. To avoid that, I set the 16 test people aside first and never used them for any decision. Inside the 35 training people I carved a further 24 inner-train / 11 validation split, and judged every setting only on the validation people. The single setting that won on validation was then run once on the 16 test people. Because nothing was ever chosen using the test set, the final EER stays an honest open-set estimate. The result is the ablation in §4.6.

## 3.7 Reproducibility engineering

Every artefact carries its own provenance. The model file records the git commit, the embedding dimension and the feature spec it was trained with; the metrics file records the dataset SHA-256, the seeds, the protocol and the same commit. One command regenerates the whole result from the pinned data, and the model loads with `weights_only=True` so a swapped model file can't run code inside the service. I checked the chain end to end: model-commit equals metrics-commit, pinned SHA equals metrics SHA, and the loaded model embeds to a correct 128-D unit vector (§9).

## 3.8 The product layer

To show the model is more than a benchmark number, I wired a standalone slice (`/api/ml-keystroke/*`) into the game backend: a user gives explicit consent, enrols by typing several windows (which become a profile), and is then verified on a new window. The decision is fail-safe: if the service is unreachable or the model version doesn't match the stored profile, the result is INDETERMINATE and the product asks for another factor — it never grants access by default. This slice is kept separate from the older statistical engine so the two don't tangle, and its safety behaviour is covered by tests (§6, §7.5).

---

# 4. Results

Everything below was trained on real CMU data on a laptop CPU (no GPU), averaged over three seeds (42, 43, 44), and is reproducible with one command (§9). The full run took about 23 minutes and cost £0.

## 4.1 Headline result

Open-set EER on the 16 held-out people (mean ± SD over 3 seeds):

| Scorer | EER (mean) | SD | Per-seed | Comparison |
|---|---|---|---|---|
| Scaled-Manhattan (headline; comparable to baseline) | 0.1422 (14.2%) | ± 0.0279 | 0.1421 / 0.1764 / 0.1080 | vs published 0.0962 (9.6%) |
| Full ensemble (secondary; Manhattan + NN + Mahalanobis) | 0.1016 (10.2%) | ± 0.0097 | 0.1086 / 0.1083 / 0.0878 | — |
| Published baseline — Killourhy & Maxion (2009) | 0.0962 (9.6%) | (their SD 0.069) | — | reference |

Two things stand out.

First, the ensemble is both more accurate and far steadier than the simple scorer. Its EER (10.2%) is about four points better than scaled-Manhattan (14.2%) on the *same* embeddings, and its standard deviation across seeds is roughly three times smaller (0.97% vs 2.79%). The hand-built ensemble, working in the learned space, is doing real work: it pulls a more reliable decision out of the same representation. That is the hybrid idea from §1.3 paying off.

Second, the honest open-set result sits *above* the baseline, not below it. Scaled-Manhattan (14.2%) is worse than 9.6%, and the ensemble (10.2%) is close but still slightly above. That is what an un-leaked open-set result on a small CPU-trained model should look like. The fact that it didn't come out implausibly low is itself a sign the evaluation is honest — a leaky or closed-set version would have produced a flattering number (§7.1).

## 4.2 The DET curve

The DET curve (figure `det_curve.png`, Appendix C) plots FRR against FAR across all thresholds for the headline scaled-Manhattan scorer. It has the usual convex shape; the EER point sits on the FAR = FRR diagonal at 14.2%, and the 9.6% baseline is marked for reference. The curve shows the operating trade-off directly: a deployment that cared more about security than convenience would move up and left (lower FAR, higher FRR), and the other way for convenience.

## 4.3 Per-subject analysis

The 16 held-out people vary a lot in how recognisable their typing is (full table in Appendix C):

- **Most distinctive** (lowest EER): s036 at 0.9%, s017 at 2.0%, s022 at 3.5% — for these people the system is essentially a strong authenticator.
- **Hardest** (highest EER): s047 at 33.5%, s007 at 29.5%, s037 at 23.4% — for these people the 11-key password is too short and inconsistent to tell them apart reliably.

That spread is informative: the limiting factor isn't the model, it is the information in an 11-key fixed password, which for some people just doesn't carry a distinctive enough rhythm. It is also the main argument for free text (§10), where longer natural typing carries far more signal.

## 4.4 The embedding space (t-SNE)

To check *why* it works, I projected the held-out people's 128-D embeddings to 2-D with t-SNE (figure `tsne.png`, Appendix C). Several people form tight, well-separated clusters — visual confirmation that the encoder maps a person's typing to a consistent region even though it never trained on that person. A denser middle region, where some people overlap, lines up with the high-EER people from §4.3, so the picture and the numbers agree.

## 4.5 End-to-end on a live user

Beyond the benchmark, I served the trained model from the live service and ran the real flow: a held-out person was enrolled, then genuine and impostor windows were verified over HTTP. The mean genuine score (3.10) was clearly lower, i.e. more genuine, than the mean impostor score (6.73), so the deployed model correctly ranks impostors as less genuine than the real user. The model behaves the same in the running service as in the notebook. (This live test also turned up a real crash, fixed in §7.5.)

## 4.6 Was the headline setting well-chosen, or just lucky? An ablation

A fair criticism of any single result is whether I happened to pick good settings, and whether a small change would have done better. To answer that without touching the test set, I ran the nested-validation ablation from §3.6. The 16 test people stayed untouched; inside the 35 training people I used a 24 inner-train / 11 validation split and changed one setting at a time, judging each only on the validation people.

| Setting (change from the original) | Validation primary EER | Validation ensemble EER | Final loss |
|---|---|---|---|
| Original (60 epochs, margin 0.2, centre-weight 0.01, 2 windows/subject) | 0.1933 | 0.1678 | 0.200 |
| more windows per subject (2 → 4) | 0.2572 | 0.1731 | 0.200 |
| more windows per subject (2 → 8) | 0.1975 | 0.2023 | 0.200 |
| longer training (60 → 120 epochs) | 0.1904 | 0.1684 | 0.200 |
| wider margin (0.2 → 0.3) | 0.1933 | 0.1678 | 0.300 |
| stronger centre-loss (0.01 → 0.05) | 0.2054 | 0.1725 | 0.200 |

(The validation EERs are higher than the test EERs in §4.1 because the inner-train set has only 24 people, not 35, so the encoder is weaker. These numbers are only meant to be compared with each other, which is all config selection needs; they are never compared with the baseline or reported as the result.)

Three things come out of this.

1. **The original setting was already near-optimal.** Nothing helped meaningfully: more windows per subject made it worse (I had expected harder triplet mining to help — it didn't), a stronger centre-loss made it worse, and a wider margin was identical. The only nominal improvement, doubling the epochs, lowered validation EER by 0.003 — well inside the noise of an 11-person fold.

2. **That tiny "win" didn't survive the test set.** Following the protocol, I ran the validation winner (120 epochs) once on the 16 test people. It didn't generalise better — it generalised worse and far less steadily: primary EER 0.161 ± 0.087 against the original's 0.142 ± 0.028, and ensemble 0.113 ± 0.038 against 0.102 ± 0.010, with one seed sliding to 0.284. This is exactly what overfitting a small validation fold looks like: a 0.003 validation gain was noise, and acting on it would have hurt. So I kept the original setting, now backed by evidence rather than assumed.

3. **The loss saturates at the margin** (final loss ≈ the margin in every row — 0.200, and 0.300 when the margin is 0.300). That means the triplets are essentially all satisfied to the margin: the bottleneck isn't optimisation, it is the information in an 11-key password (§4.3). The system is on a plateau — more epochs, more samples or a wider margin can't pull out a signal that isn't in the data. That is the strongest argument for moving to free text (§10).

The value here isn't a better number, it is the demonstration that the reported number is robust, plus an honest account of a tuning attempt that failed, written down rather than hidden.

---

# 5. Discussion

## 5.1 What the results mean

The aim asked whether a deep embedding plus a classical verifier can authenticate from typing rhythm, and how it compares with 9.6%. The honest answer has three parts:

1. It authenticates — well above chance (random guessing is 0.5; the system reaches 0.10–0.14), on people it never trained on, end to end through a live service.
2. It doesn't beat the classical baseline on this small fixed-text benchmark — the headline scaled-Manhattan EER (14.2%) is above 9.6%. That is an honest negative on the headline comparison, and I report it rather than reach for a kinder protocol.
3. The hybrid idea holds — the classical ensemble inside the learned space (10.2%, ±1.0%) is both closer to the baseline and about three times steadier than the simple scorer on the same embeddings. The combination of deep representation and classical verifier is the contribution, and the data back it.

So the best reading is: a learned representation makes a classical verifier more reliable (lower variance) and nearly recovers a strong hand-tuned baseline, while — unlike the baseline — being open-set and content-independent, which is what a real product needs.

## 5.2 Implications

- **For account security.** Even a 10% EER biometric is useful as a *second* factor: combined with a password, it raises the bar for an attacker who only has stolen credentials, at no extra effort for the user. Run continuously during a session (the free-text direction), it could catch session hijacking that password-only systems can't see.
- **For research.** This is a small, reproducible data point on whether deep embeddings help on small keystroke datasets. The finding — embedding plus ensemble lowers variance and nearly matches the baseline open-set — is modest but real, and the fully reproducible pipeline is itself worth something in a field where reproducibility is often weak.
- **For people who struggle with conventional authentication.** A silent biometric that needs no extra device could lower the barrier for people for whom passwords and tokens are a burden — as long as it is built with the consent and fail-safe safeguards of §8.

## 5.3 Limitations

The conclusions only hold within these bounds: a single small public dataset (51 people, one 11-key password); a small CPU-trained model (no large-scale or GPU training); fixed text only (the free-text claim is designed for but not yet measured on a real corpus); and a per-user threshold that ranks correctly but isn't yet on the same scale as the fused score (§7.6). The ablation in §4.6 actually sharpens these bounds rather than softening them: since no amount of extra training, sampling or margin helped, the 11-key password — not the model or the compute — is clearly the limiting factor, which is exactly why free text (§10) is the highest-value next step. None of this invalidates the measured EER, but each point is a reason not to over-generalise from it.

---

# 6. How my decisions shaped the outcome

Six decisions mattered most to how this turned out:

1. **Choosing open-set over the easier closed-set protocol** (§7.1) changed the meaning of every number in the report. Closed-set would have given me a much lower, much more impressive EER that was scientifically worthless. This cost me a better-looking number and bought me a defensible one, and it is the single biggest reason the report can be trusted.
2. **Keeping the classical ensemble** rather than going pure-deep is what produced the actual positive finding — the variance reduction in §4.1. Without it I would have had only the 14.2% number and no contribution.
3. **Reporting scaled-Manhattan as the headline** against the baseline, rather than the kinder ensemble number, kept the central comparison honest. Fixing the metric before seeing which made me look better was a deliberate guard against fooling myself.
4. **Training on local CPU instead of cloud GPU** (§1.5) gave the same result for £0 with no external dependency, which also makes it easier to reproduce.
5. **Building and running the real product slice** rather than stopping at the benchmark is what exposed the confidence-overflow crash (§7.5), which no unit test caught. Checking in the running system, not just in tests, directly improved correctness.
6. **Refusing to chase a noisy validation "win"** (§4.6) decided the final number. Nested validation nominally preferred a longer-trained model by 0.003 EER, but on the test set it generalised worse. I kept the original setting and wrote up the failed tuning attempt rather than quietly adopt a number that looked better on paper.

---

# 7. Problems I found and fixed

I kept a machine-readable problem log (`research/artifacts/problem_log.json`) of thirteen entries, each as problem → root cause → fix → how verified. The important ones weren't caught by a test passing; they were caught by asking whether a passing test actually meant what it claimed. The full log is below, and the six most instructive are then expanded.

| # | Severity | Problem | Root cause | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | critical | EER measured closed-set (trained on all 51, then scored per-subject) — not comparable to the open-set baseline | No train/test split by person | Seeded 35-train / 16-test split; score only the 16 held-out | No-leakage test; result honestly above baseline |
| 2 | high | The Ledoit–Wolf ensemble was never used to compute EER — only scaled-Manhattan was | Ensemble functions were dead code in the EER path | Added an ensemble EER path using the deployed fusion | Both EERs reported; ensemble 10.2% < primary 14.2% |
| 3 | high | If the wrong branch fired, each rep collapsed to a 1-keystroke window, making the temporal model meaningless | Silent branch choice between real-CMU and fixture paths | Assert the sequence branch fires; every window = 11 keys | 20,400 windows checked, all length 11 |
| 4 | medium | Open-set eval re-embedded impostor windows O(N) times; a 3-epoch run blew a 300 s wall | `eer_for_subject` re-embedded on every call | Embed each window once, cache, score both metrics from cache | 300 s → 89 s with identical EER |
| 5 | low | Ledoit–Wolf used a slow Python per-sample loop | `pi_sum` built n separate outer products | Vectorised via algebraic expansion (einsum) | Bit-parity to 1e-9 across 4 shapes |
| 6 | high | The service could embed and verify but nothing built a Profile, so it could verify no-one | Enrolment→profile step never implemented | New `keystrokeProfileBuilder.js` with leave-one-out threshold | 5 profile-builder tests |
| 7 | medium | The download script carried a placeholder SHA-256, so the dataset was unverifiable | `EXPECTED_SHA256` was a sentinel | Pinned the measured digest with provenance | `download_cmu.py --skip-download` verifies |
| 8 | high | Live `/verify` returned HTTP 500 for a very consistent typist; tests missed it | Tiny threshold made the sigmoid exponent overflow | Clamp the exponent and floor the threshold | Regression test; live run ranks impostor > genuine |
| 9 | medium | With the floored threshold, confidence saturates (all reads HIGH) though ranking is right | Threshold and fused score live on different scales | Logged as future work; EER (rank-based) unaffected | Ranking holds; flagged openly |
| 10 | high | The free-text Phase-2 path had the same closed-set defect as #1 | Defect duplicated across both entrypoints | Refactored Phase-2 to reuse the open-set machinery | `test_phase2_is_open_set_no_leakage` |
| 11 | high | The evaluator could fabricate a perfect 0.0 EER by scoring training data when the test set was empty | No guard for an empty held-out test set | Evaluator now raises rather than fabricates | Empty-test-set guard test |
| 12 | high | Real CMU columns are key-named (`H.period`); a naïve loader would train on all-zero timings | Fixture vs real-file column-naming mismatch | `remap_cmu_columns` translates before featurising | Remap test; first window has 41/44 non-zero timings |
| 13 | medium | `torch.load` default could run arbitrary code from a swapped model file | `weights_only` defaulted to False | Load with `weights_only=True` + a load-time dimension guard | Round-trip test; load-time guard |

The six below are the ones that best show auditing a passing result instead of trusting it.

**7.1 — The closed-set flaw (the most important problem).** The original evaluator trained the encoder on all 51 people and then measured EER per person, so the network had already met every test subject. Comparing that to a published open-set baseline is not like-for-like, and anyone reading the training loop would rightly dismiss it. The cause was that there was no split by person — the split protected the profile but not the representation. The fix was a seeded 35/16 split: train only on 35, evaluate only on the 16 held-out, with a runtime check that no test person leaks into training. Verified by an automated no-leakage test, and by the fact that the resulting EER (14.2%) is honestly above the baseline rather than implausibly low.

**7.2 — The ensemble was never actually used to measure EER.** The "creative" part of the project, the Ledoit–Wolf ensemble, was tested but never called in the EER path — only scaled-Manhattan was, so the headline would have quietly left it out. The ensemble functions were effectively dead code in the evaluation. I added a second EER path using the exact production fusion (Manhattan + nearest-neighbour + Ledoit–Wolf Mahalanobis), reported as the secondary metric. Both EERs are now reported per run, and the ensemble's 10.2% against the primary 14.2% is the main positive finding.

**7.3 — Real data would have trained on all-zero timings.** The real file uses key-name columns (`H.period`, `H.Shift.r`, `H.Return`), but the code expected printable-character columns, so it would have read zeros and trained on nothing while still printing a number. The cause was a mismatch between my synthetic test fixture's column naming and the real file's. The fix was an explicit column remap plus an assertion that the first real window is 11 keys spelling `.tie5Roanl` with real (41 of 44 non-zero) timings, checked across all 20,400 windows.

**7.4 — The evaluator could fabricate a perfect score.** An earlier version silently fell back to scoring training data when the genuine test set was empty, producing a fake 0.0 EER. There was no guard for an empty held-out test set. Now the evaluator raises an error rather than make a number up, and people with too few windows are skipped honestly. Verified by a unit test of the guard.

**7.5 — A crash only the real system showed.** The live `/verify` endpoint returned HTTP 500 for a very consistent typist, and no unit test caught it. The cause: a consistent typist on a fixed 11-key password produces nearly identical embeddings, so the per-user threshold goes close to zero, the confidence sigmoid's exponent (`score/threshold`) blows up, and `math.exp` overflows. The existing guard only handled a threshold of exactly zero, not a tiny positive one. I clamped the exponent to a safe range (lossless, the sigmoid is flat there) and floored the threshold so no profile is degenerate. Verified by a regression test and by the live run no longer crashing while still ranking impostor above genuine. This one matters because it was invisible to synthetic-data tests — synthetic embeddings have artificial spread; only real data on a real consistent typist exposed it. It is the clearest case in the project of why running the real system beats trusting the tests.

**7.6 — An honest limitation, logged not hidden.** With the floored threshold, the absolute confidence saturates (everything reads HIGH) even though the model ranks genuine below impostor correctly. The threshold is calibrated on the L1 metric (about 0.001 scale) while the fused score is dominated by the Mahalanobis term (about 3–7 scale), so they live on different scales. I left this as future work: the ranking, and therefore the EER, which only depends on rank order, is unaffected. I chose to write it down openly rather than paper over it.

The remaining seven entries (rows 4–7, 10, 12, 13 above) carry the same discipline: the O(N) re-embedding cost fixed with a one-time cache (identical EER); the Ledoit–Wolf loop vectorised to 1e-9 parity; the missing profile-builder; the placeholder dataset SHA replaced with a real digest; the same closed-set defect in the free-text path, fixed the same way as #1; the all-zero-timings remap; and the arbitrary-code risk in model loading, closed with `weights_only=True`. Each is in `problem_log.json` in full.

---

# 8. Ethics and safety

Biometric authentication is ethically serious precisely because it works: a system that can recognise people by their behaviour can also watch them. I made several deliberate choices to stay on the right side of that line.

**8.1 Biometric data is special.** Under UK/EU GDPR (Article 9), biometric data processed to uniquely identify a person is special-category data — the most protected class, alongside health and ethnicity. Article 4(14) explicitly includes behavioural characteristics, and regulators treat typing rhythm and gait as behavioural biometrics. So the moment this system is used to identify someone, the data it handles is special-category. That shaped the decisions below.

**8.2 I used a public, anonymised dataset rather than collect new identifiable data.** The headline result is measured entirely on the CMU benchmark, whose subjects are anonymised (s002, s003, …) and consented to research use when Carnegie Mellon collected it. I deliberately did not train the headline model on my own game's users, which would have created a fresh pile of identifiable behavioural data with all the consent and storage duties that brings. The public dataset gives a comparable, reproducible result without my creating new privacy risk.

**8.3 Explicit, revocable consent in the product.** The product slice makes a user opt in before any window is captured for biometrics, and opting out wipes their profile. Consent is a stored, timestamped record. That puts the GDPR principles of lawful basis and data minimisation into the product, not just onto paper.

**8.4 Store templates, not raw timings; log decisions, not keystrokes.** The inference service is stateless and logs no raw timings. The product stores the derived profile (embeddings and statistics) and an audit log of decisions (score, version, risk level), never the raw stream of what someone typed. A stolen profile is far less sensitive than a recording of everything a person typed.

**8.5 Fail-safe, never fail-open.** A security system that grants access when it breaks is a liability. Any outage or version mismatch returns "indeterminate" and forces another factor — it never defaults to "allow". That is an ethical choice as much as an engineering one: it protects the user even when the system fails.

**8.6 Dual use, and honest framing.** Behavioural biometrics cut both ways: the same technology that protects an account can, in the wrong hands, track or de-anonymise people by their typing. I have framed this as opt-in protection the user controls, not covert surveillance, and I report the error rates rather than hide them. A 10% EER system must never be sold as infallible, because over-trusting a biometric can lock out genuine users or wave through impostors. Reporting the honest EER, with its per-person variation, is part of using it responsibly.

**8.7 Risk assessment.** This is a software project with no physical hazards; the risks are informational — data leakage (mitigated by §8.4), wrongly rejecting genuine users (mitigated by fail-safe step-up rather than a hard lock-out, and by never using the biometric as the only factor), and over-claiming (mitigated by reporting honest numbers). A short table is in Appendix E.

---

# 9. Reproducibility

A result you can't reproduce is really just an opinion, so I treated reproducibility as a requirement, not a nicety.

**9.1 One command.** A single script (`reproduce.ps1`) verifies the dataset SHA-256, trains over three seeds, checks the EER is within a sane ceiling, regenerates the figures and runs the full test suite, failing loudly on any step. From a clean checkout plus the separately-downloaded dataset, the whole result regenerates on its own.

**9.2 Pinned data, fixed seeds.** The dataset is pinned by SHA-256, all randomness is seeded, and CPU training is deterministic, so the same seed gives the same model bit-for-bit.

**9.3 Provenance chain.** The model records its git commit and feature spec; the metrics file records the dataset SHA, the seeds and the same commit. I checked that model-commit equals metrics-commit and pinned-SHA equals metrics-SHA, so the result, the data and the code version are provably one triple.

**9.4 Tested, not asserted.** The project has 103 automated tests (research 65, inference service 22, product 16) covering featurization, the encoder, the loss, the open-set split, the no-leakage guard, the EER honesty guards, the wire contract, the profile builder and the fail-safe decision logic. Every "verified" claim in this report points to a test or a logged run.

**9.5 Train/serve match.** The served model embeds byte-identically to what training produced, because the featurization and encoder code are shared, so there is no gap between the science I measured and the product I shipped.

---

# 10. Reflection

_(Written in the first person from the real history of the project. Devadit — read it through once and adjust anything so it sounds like you.)_

**What I learnt, technically.** The deepest lesson was the difference between closed-set and open-set evaluation, and how easy it is to fool yourself. My first evaluation gave a number I was briefly pleased with, until I traced the training loop and realised the model had already seen the people I was testing on. Learning to distrust a flattering result and audit the protocol behind it was worth more than any single algorithm. I also learnt, concretely, why biometrics are measured with EER and DET curves rather than "accuracy": with two error types that trade off, one accuracy figure tells you almost nothing.

**What I learnt about doing science.** Reproducibility isn't paperwork; it is what turns a claim into a result. Pinning the dataset by hash, fixing seeds and recording the git commit in every artefact felt like overhead until the moment I could regenerate the whole headline number with one command — at which point it became the thing I trusted most. And running the real system finds bugs that tests don't: the crash in §7.5 was invisible to every unit test and appeared the instant a real consistent typist hit the live endpoint.

**What I would do next.**
1. **Free text on a real corpus.** The 11-key password is the limiting factor (§4.3), and the ablation (§4.6) proved it — nothing I changed moved the result, so the ceiling is the data, not the model. The free-text pipeline is built and open-set-correct, but a real result needs a large public corpus (the Aalto 136-million-keystroke dataset). That is the clear next experiment.
2. **Fix the confidence scale** (§7.6) so the product's confidence percentage is meaningful, not just the ranking.
3. **Train at scale on GPU.** Everything here ran on a laptop for £0; a bigger model on more data (following TypeNet) would test whether the hybrid's advantage holds as accuracy rises.
4. **Collect a small, consented in-game dataset** to test cross-dataset generalisation, with the §8 safeguards built in from the start.

**What I would change about how I worked.** Two things. First, I would write the evaluation protocol down in full before writing any of the evaluator — the closed-set flaw (§7.1) lasted as long as it did because the protocol only lived in my head, where it was easy to talk myself into a flattering number. Second, I worked entirely on my own, so every check was a self-check. That sharpened my self-auditing, and it is how I caught my own mistakes, but it is not a substitute for an outside reader. Next time I would find a mentor or a peer reviewer early, because explaining a result out loud to someone else catches things that re-reading your own code does not.

---

# 11. Conclusion

I set out to find, honestly and reproducibly, whether a deep embedding of typing rhythm plus a classical verifier can authenticate a person on the standard CMU benchmark, and how it compares with the published 9.6%. Under a strict open-set protocol on 16 people the model never saw, it reached an EER of 14.2% with the comparable scaled-Manhattan metric and 10.2% with the full ensemble, the ensemble being both closer to the baseline and three times steadier across seeds. The headline comparison is an honest near-miss; the real finding is that a learned representation makes a classical verifier more reliable and nearly recovers a strong hand-tuned baseline, while staying open-set and content-independent — the properties a real product needs. What lasts here is less the number than the way it was reached: an evaluation that doesn't flatter itself, thirteen problems found and fixed (including one a unit test would never have caught), an ethics section that treats biometric data as the special-category data it legally is, and a result anyone can regenerate with one command.

For me, this turned a frustrating personal experience — watching a stolen password defeat an account as if it belonged to the attacker — into something useful: a working, honestly-measured demonstration that the way a person types can become a quiet extra layer of defence. I would take it next into free-text, continuous verification, where the signal is far richer, and in the end into an opt-in, user-controlled feature in the very game it grew out of.

---

# 12. AI use statement

This follows CREST's AI policy, which allows AI help as long as it is original (not whole AI-written sections passed off as your own), attributed, and explained.

**Tool.** Anthropic's Claude (Claude Opus 4.8), through the Claude Code command-line assistant, on a Windows laptop during the research sprint of 8–10 June 2026 and while writing this report.

**What I used it for.**
- *Code scaffolding and debugging:* first drafts of functions (for example the open-set split, the figure scripts, the profile builder) and help diagnosing bugs, all of which I reviewed, ran and tested. It did not produce a single number in this report; the results all come from code running on my machine.
- *Finding references:* surfacing the key papers (Killourhy–Maxion, TypeNet, FaceNet, Ledoit–Wolf, GDPR), which I then checked against the primary sources; anything I couldn't verify, I dropped.
- *Drafting and structure:* it helped organise the report and produced draft prose, which I edited into my own voice, fact-checked against my code and results, and completed with the personal parts only I can write.

**What I did myself.** I set the direction and made every design decision — the open-set protocol, the hybrid architecture, the honesty rules, the ethics stance. I ran all the code, read the diffs, and checked every "verified" claim against an actual test or run. Where the AI's first attempt was wrong — for instance the early closed-set evaluation — I spotted the flaw and directed the fix (§7.1). The judgements, and the responsibility for them, are mine.

**A representative prompt.** *"The Phase-1 EER is measured by training on all 51 subjects then scoring per-subject — isn't that closed-set leakage? Add a proper open-set subject split and assert no leakage."* This is the kind of direction I gave it: the science came from me.

**On evidence.** I haven't attached the raw session transcripts. Instead, the evidence that the work is mine is this statement and the prompt above, the git history (87 dated commits showing the decisions, dead-ends and edits at each step, which an AI can't retrofit), and the fact that every result regenerates from my own code (§9).

---

# 13. References

Author–date style; URLs given for openly-accessible sources. Full provenance, including items I checked and rejected, is in `CREST_Research_Dossier.md`.

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
12. Verizon (2024). *2024 Data Breach Investigations Report (DBIR).* Stolen credentials ≈ 77% of Basic Web Application Attacks; compromised credentials the leading initial-access vector. https://www.verizon.com/business/resources/reports/dbir/ _[Devadit: re-confirm the exact percentage against the edition you cite at submission; the DBIR is published annually.]_
13. CREST Awards (British Science Association). *Gold criteria guidance*, *Required documentation*, *AI guidance for students*. https://www.crestawards.org/help-centre/gold-criteria-guidance/

---

# 14. Appendices

## Appendix A — CREST criteria → section map

An index for the assessor, and the basis for the Student Profile Form. Page numbers go in the paginated PDF; section numbers are given here.

| Criterion | Where |
|---|---|
| 1.1 clear aim → objectives | §1.1 (aim + six measurable objectives) |
| 1.2 wider purpose | §1.2 (account-takeover, stakeholders, personal stake) |
| 1.3 range of approaches | §1.3 (three approaches + trade-off table) |
| 1.4 plan + justification | §1.4 (three-part architecture + reasoning) |
| 1.5 planned/organised time | §1.5 (Gantt from real git dates; ~84-hour effort table; slippage) |
| 2.1 materials & people | §1.6 (named tools, dataset, libraries; independent-project framing) |
| 2.2 research + sources | §2 (synthesised review, gap identified); §13 (references) |
| 3.1 conclusions + implications | §4 (results incl. §4.6 ablation), §5 (discussion) |
| 3.2 decisions → outcome | §6 (six decisions, incl. refusing a noisy tuning "win") |
| 3.3 learning + reflection | §10 (reflection, what I'd improve) |
| 4.1 science understanding | §2, §3, and §3.6 + §4.6 (nested validation, overfitting, plateau) |
| 4.2 ethics & safety | §8 (GDPR special-category, consent, fail-safe, dual use, risk) |
| 4.3 creative thinking | §3.5 (classical ensemble inside the learned space); §1.3; §4.6 |
| 4.4 problems overcome | §7 (13 problems, root cause → fix → verified) |
| 4.5 clear communication | whole report: structure, abstract, tables, figures, glossary (App. B) |

## Appendix B — Glossary

- **Biometric** — a measurable human characteristic used to recognise identity.
- **Behavioural biometric** — one based on how you act (typing rhythm, gait), not what you are.
- **Keystroke dynamics** — recognising a person by their typing timing.
- **Embedding** — a fixed-length vector representation of an input; here, 128 numbers per window.
- **Triplet loss** — a training objective that pulls same-person embeddings together and pushes different-person ones apart.
- **EER (Equal Error Rate)** — the threshold where the false-accept rate equals the false-reject rate; lower is better.
- **FAR / FRR** — False Accept Rate (impostors let in) / False Reject Rate (genuine users turned away).
- **DET curve** — Detection Error Trade-off curve, FAR against FRR across thresholds.
- **Open-set** — tested on people not seen in training (the honest test for authentication).
- **Nested validation** — choosing settings on a validation split carved from the training data, so the test set is never used to choose anything.
- **Ablation** — changing one part at a time to see how much it matters.
- **Generalisation plateau** — the point where more training or data stops helping because the input itself has no more signal.
- **Mahalanobis distance** — a distance that accounts for correlations between dimensions.
- **Ledoit–Wolf shrinkage** — a way to make a covariance matrix stable and invertible from few samples.
- **CMU dataset** — the Killourhy–Maxion keystroke benchmark (51 people, password `.tie5Roanl`).

## Appendix C — Full results and figures

Per-subject EER (scaled-Manhattan, seed 42), 16 held-out people, most to least distinctive:

| Rank | Subject | EER | | Rank | Subject | EER |
|---|---|---|---|---|---|---|
| 1 | s036 | 0.009 | | 9 | s050 | 0.179 |
| 2 | s017 | 0.020 | | 10 | s056 | 0.190 |
| 3 | s022 | 0.035 | | 11 | s030 | 0.190 |
| 4 | s005 | 0.045 | | 12 | s018 | 0.205 |
| 5 | s012 | 0.051 | | 13 | s054 | 0.215 |
| 6 | s010 | 0.090 | | 14 | s037 | 0.234 |
| 7 | s038 | 0.090 | | 15 | s007 | 0.295 |
| 8 | s053 | 0.090 | | 16 | s047 | 0.335 |

The seed-42 mean of these is 0.1421, which matches the headline seed-42 EER (a consistency check). The spread from 0.9% to 33.5% is the §4.3 finding: the limiting factor is the information in an 11-key password, not the model.

Aggregate (mean ± SD over seeds 42/43/44): scaled-Manhattan 0.1422 ± 0.0279; full ensemble 0.1016 ± 0.0097; baseline 0.0962. Ablation cross-check (§4.6): the validation-selected alternative (120 epochs) scored 0.1610 ± 0.0866 / 0.1128 ± 0.0378 on the same people — worse and less stable, confirming the headline setting.

Figures (in `research/artifacts/`): `det_curve.png` (DET curve with the EER point and the 9.6% baseline marked); `tsne.png` (t-SNE of held-out embeddings, coloured by person). _[Embed both figures here in the final PDF.]_

## Appendix D — Code and artefact map

- `research/` — harness: `ksbio/featurize.py`, `encoder.py`, `triplet.py`, `train.py`, `evaluate.py`, `ensemble.py`, `artifact.py`; `scripts/train_cmu.py` (open-set Phase-1), `train_freetext.py` (Phase-2), `sweep_cmu.py` (the §4.6 ablation), `make_figures.py`, `reproduce.ps1`.
- `ml-service/` — FastAPI service: `app/contract.py` (the fixed wire contract), `model.py`, `torch_embedder.py`, `verify.py`.
- Product slice — `services/keystrokeProfileBuilder.js`, `controllers/mlKeystrokeController.js`, `routes/mlKeystrokeRoutes.js`, `models/MlKeystrokeProfile.js`.
- Evidence — `research/artifacts/metrics.json` (headline + provenance), `sweep_results.json` (validation ablation), `metrics_e120.json` (the §4.6 test cross-check), `problem_log.json` (the 13 problems), `det_curve.png`, `tsne.png`; `CREST_Research_Dossier.md` (full citations).

## Appendix E — Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Leak of stored biometric profiles | Low | High | Store derived templates not raw timings; stateless service logs no keystrokes (§8.4) |
| Genuine user wrongly rejected | Medium | Medium | Never the only factor; fail-safe step-up, not a hard lock-out; honest EER disclosed (§8.5–8.6) |
| Impostor wrongly accepted | Medium | Medium | Used as a second factor; ensemble lowers EER; continuous re-check planned (§5.2) |
| Over-claiming accuracy | Low | High | Honest open-set EER with per-person variance; no fabricated numbers (§7) |
| Misuse for covert surveillance (dual use) | Low | High | Opt-in, user-controlled framing; consent and revocation enforced (§8.3, §8.6) |

---

*End of report. This document, together with the code, the metrics, the figures and the problem log, makes up the CREST Gold submission; the Student Profile Form maps each criterion to its page.*
