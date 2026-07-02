# Can You Be Recognised by the Way You Type?

### Building and testing an open-set keystroke-dynamics verification system

|  |  |
|----|----|
| Author | Devadit Jain |
| Field | Machine learning · behavioural biometrics · applied security |
| Type | Research and build |
| Dates | 25 November 2025 – 10 June 2026 |
| Code & data | Reproducible from a SHA-pinned dataset and fixed seeds (Appendix B) |

------------------------------------------------------------------------

## Abstract

A password proves you know a secret. It says nothing about whether you are the person the account belongs to — which is why a stolen password works just as well for the thief. Keystroke dynamics, the rhythm of how someone types, is a behavioural biometric that could sit quietly behind a password as a second check on identity.

This project asks one narrow question: can a deep embedding of typing timing, paired with a classical statistical verifier, recognise a person from rhythm alone, and how close does it get to the standard benchmark? I built a system in three parts — a PyTorch research harness that trains the model, a FastAPI service that serves the frozen model, and a Node.js layer where a real user can consent, enrol and be verified. The model is a 1-D convolutional network with a bidirectional GRU and an attention layer that turns a window of keystrokes into a 128-number vector. On that learned representation, an ensemble of three distances (an L1 distance to the user's centroid, a nearest-neighbour distance, and a Ledoit–Wolf-shrinkage Mahalanobis distance) makes the accept-or-reject decision.

I evaluated on the CMU keystroke benchmark — 51 people typing `.tie5Roanl` — under a strict open-set protocol: train on 35 people, test only on the 16 the model never saw. Over three seeds the headline scaled-Manhattan EER was 14.2% ± 2.8%, the metric that sits directly beside the published 9.6% baseline; the full ensemble reached 10.2% ± 1.0%. So on this small fixed-text benchmark the deep model does not beat the 2009 classical detector. The more useful finding is about *how* the hybrid behaves: the ensemble is both closer to the baseline and markedly steadier from seed to seed than the simple scorer on the same embeddings, and a component ablation traces that stability to the Mahalanobis term computed inside the learned space. Across 14 seeds the ensemble beats the simple scorer every time (Wilcoxon *p* ≈ 0.0001), though on the wider run both error rates are higher (≈ 18.7% and ≈ 13.3%). The report covers the method, the per-subject variation that limits the result, an ethics analysis treating typing data as the special-category data it legally is, and a full account of the bugs that shaped the numbers.

## Contents

1. Introduction
2. Background and related work
3. Method
4. Results
5. Discussion
6. Ethics and responsible use
7. Engineering challenges
8. Conclusion and future work
9. Reflection
10. Acknowledgements
11. AI use statement
12. References
13. Appendices

------------------------------------------------------------------------

# 1. Introduction

## 1.1 The problem

Passwords check knowledge, not identity. Anyone who steals or guesses one becomes, as far as the system is concerned, the real owner. That gap is expensive: Verizon's 2024 Data Breach Investigations Report found stolen credentials were involved in about 88% of Basic Web Application Attacks, and credential-stuffing — replaying leaked username/password pairs automatically — is one of the dominant login attacks (Verizon, 2024). Multi-factor authentication helps, but it adds friction, and friction gets switched off.

Keystroke dynamics offers a different kind of second factor: instead of asking the user to do something extra, the system watches how they already type. The idea is old — 19th-century telegraph operators were recognised by the rhythm of their "fist" — but machine learning has only recently made *content-independent* typing recognition practical (Acien et al., 2021), which is what turns it from a party trick into something you could put behind a login or run continuously during a session.

This isn't abstract for me. An account I cared about was taken with stolen credentials, and the system never noticed: the password was correct, so the attacker simply *was* me. A perfectly correct password defended nothing. That is what pushed me towards behavioural biometrics — could *how* a person types be a quiet check that a stolen password can't fake?

## 1.2 Aim and objectives

> **Aim.** Find out whether a content-independent deep embedding of keystroke timing, combined with a classical statistical verifier, can verify a person's identity from typing rhythm alone, and measure how its open-set EER compares with the published scaled-Manhattan benchmark of 9.6% on the CMU dataset.

The aim has a pass/fail test built in: one number, the Equal Error Rate (§2.3), measured under a protocol fixed before I saw the result, read against a published reference. I split it into six objectives, each with a condition I could actually check:

| # | Objective | What "done" looked like |
|----|----|----|
| O1 | Build a keystroke-embedding network | Maps a variable-length window to a fixed 128-D vector; forward pass runs on CPU |
| O2 | Train it so same-person windows cluster and different-person windows separate | Mean within-person distance < mean between-person distance, checked by a test |
| O3 | Evaluate on a public benchmark, open-set | EER computed only on held-out people; the evaluator refuses to score training data |
| O4 | Reuse a statistical ensemble as the decision layer inside the embedding | Two EERs reported (scaled-Manhattan vs full ensemble) from one run |
| O5 | Make the pipeline reproducible | One script regenerates the result from a SHA-pinned dataset and fixed seeds |
| O6 | Show it working in a real product flow with safe failure | A live service serves the model; a user can consent → enrol → verify; outages never grant access |

## 1.3 How I ran the project

The work fell into four dated stages, each gating the next. The first three built the product and the data the research stands on; the fourth — the June deep-learning stage — is what most of this report is about.

| When | Stage | Outcome |
|----|----|----|
| Nov–Dec 2025 | Typing web app + keystroke capture | Built; became the real source of typing data |
| Feb–Mar 2026 | Accounts + first statistical recognisers | v1/v2 statistical checks; the clean seam between research and product |
| Jun 2026 | Deep-learning research | Rebuilt the recogniser as a deep embedding; evaluated open-set |
| Jun 2026 | Write-up | Report, ethics, reproducibility check |

Two plans changed along the way. I dropped the planned cloud-GPU training once the model trained in about 23 minutes on my laptop for £0 — a ~£0.10–0.50 cloud step plus its dependency wasn't worth it. And I scaled the free-text phase back to "pipeline built and proven" rather than spend limited time downloading and training on the 136-million-keystroke Aalto corpus (§8). The largest unplanned change came mid-project, when an evaluation flaw forced me to rebuild the protocol from closed-set to open-set (§7); that single fix changed the meaning of every number here.

# 2. Background and related work

## 2.1 Keystroke dynamics as a behavioural biometric

Biometrics split two ways. Physiological traits (fingerprint, iris, face) describe what you *are*; behavioural traits (signature, gait, typing rhythm) describe how you *behave*. Keystroke dynamics is behavioural — it recognises a person by the timing of their typing, not its content. The raw signal is inter-key timing:

- **Hold time (dwell):** how long a key is held down.
- **Down–down latency:** time between pressing one key and the next.
- **Up–down latency (flight time):** time between releasing one key and pressing the next.
- **Up–up latency:** time between releasing consecutive keys.

These are surprisingly personal — they come from motor habits and hand geometry that are hard to fake on purpose. *Fixed-text* recognition, where everyone types the same string (the CMU benchmark), is the easy case: you can line matching keystrokes up directly. *Free-text* recognition — anything the person types, which is what continuous authentication needs — demands a model that reads rhythm independently of the words. A 2024/25 ACM Computing Surveys review traces the field's shift from hand-built statistical detectors in the 2000s to deep representation learning in the 2020s. This project sits on that seam.

## 2.2 Metric learning and embeddings

The key move in modern biometrics is to stop asking "which known user is this?" (classification) and instead learn an *embedding*: a function that maps an input to a vector where distance encodes identity. FaceNet (Schroff et al., 2015) set the template — a network trained with a triplet loss so embeddings of the same person sit close and different people sit far apart. A triplet is (anchor, positive, negative): same, same, different. The loss pushes the anchor–positive distance below the anchor–negative distance by a margin:

> `L = max(0, d(anchor, positive) − d(anchor, negative) + margin)`

FaceNet used a 128-D embedding and reached 99.6% on faces; I use the same 128-D, L2-normalised design for keystrokes. Hermans et al. (2017) showed that *which* triplets you pick matters, and that batch-hard mining — for each anchor, the hardest positive and hardest negative in the mini-batch — is a simple, strong choice, so I use it. Wen et al. (2016) added a center loss that pulls each class toward its own centre; I add a small amount to keep per-user spread under control. L2-normalisation puts every embedding on the unit sphere, so distance depends on *direction* rather than magnitude — the right thing for comparing rhythm patterns.

## 2.3 Making and measuring the decision

A raw embedding isn't a decision. The verifier turns "how far is this window from the user's profile?" into accept-or-reject, and there are several distances worth combining:

- **Scaled-Manhattan:** mean absolute deviation from the user's mean, scaled by per-feature spread. This is the exact form of the best CMU detector, so it gives a like-for-like comparison.
- **Mahalanobis:** accounts for correlations between dimensions through the inverse covariance matrix. With only a handful of enrolment samples in 128 dimensions, the raw sample covariance is unstable and not even invertible, so I use Ledoit–Wolf shrinkage (Ledoit & Wolf, 2004), which blends the sample covariance with a well-behaved target to guarantee a stable, invertible matrix — exactly the small-sample, high-dimensional situation enrolment lives in.
- **Nearest-neighbour:** mean distance to the *k* closest enrolment embeddings (*k* = 3), which copes with people who type in more than one way.

A verifier makes two kinds of error: accepting an impostor (False Accept Rate, FAR) or rejecting a genuine user (False Reject Rate, FRR). Moving the threshold trades one for the other. The **Equal Error Rate (EER)** is the point where FAR = FRR — the standard single-number summary of a biometric, lower is better — and plotting FAR against FRR across thresholds gives the **Detection Error Trade-off (DET)** curve. These follow ISO/IEC 19795-1. Throughout, scaled-Manhattan on its own is the headline metric (the exact form of the published detector, so the comparison is fair); the fused ensemble is reported as a separate, secondary number, never scored against a scaled-Manhattan baseline.

## 2.4 Prior work and the gap

Two reference points bracket the project.

**The classical benchmark — Killourhy & Maxion (2009).** They collected the CMU dataset (51 people × 400 repetitions of `.tie5Roanl`) and compared 14 anomaly detectors; the best, scaled-Manhattan, reached EER 0.0962 (9.6%). Rigorous, but bounded by design: fixed-text only, one 10-character password, every detector hand-engineered on raw timing features. Nothing in it speaks to free text or to whether a *learned* representation would help.

**The deep state of the art — TypeNet (Acien et al., 2021).** A Siamese LSTM trained on 136M+ keystrokes from about 168,000 people, reaching EER 2.2% on a physical keyboard and 9.2% on a touchscreen, and scaling to 100,000 users. It shows learned, content-independent keystroke embeddings work at internet scale — but that 2.2% leans on web-scale data, and the paper doesn't test whether the same idea still helps in the small-data, single-password regime where most reproducible benchmarking happens.

The two never meet. One owns small fixed-text data and hand-built statistics; the other owns web-scale free text and a learned model; neither asks what happens when you bring a deep representation *down* to the small benchmark. That's the falsifiable question a student-scale project can actually answer: on the small, public, reproducible CMU benchmark, does a deep embedding *plus* a classical verifier beat the classical verifier alone, tested honestly on people it never trained on?

# 3. Method

The pipeline is short: one keystroke window in, one 128-number vector out, a decision off the back of that. This section gives enough detail to reproduce it.

## 3.1 Approach and system design

There were three genuinely different ways to build the verifier, and I compared them before committing:

- **A — Pure statistical / anomaly detection.** Score a new sample against a per-user statistical profile of hand-designed timing features, using a distance like scaled-Manhattan or Mahalanobis. This is what Killourhy & Maxion (2009) benchmarked: simple, interpretable, no cross-user training, strong published results (≈ 9.6%) — but tied to fixed text, and the features are chosen by a human.
- **B — Pure deep classifier.** A softmax over the enrolled users: accurate on a fixed set, but closed-set by nature, so every new sign-up means retraining the whole network — a dealbreaker for a product where people sign up constantly.
- **C — Deep metric-learning embedding (chosen).** Train the network to *embed* rather than classify, so a new user is enrolled by storing a few embeddings, no retraining. It's open-set by construction, content-independent, and reasonably data-efficient — at the cost of being harder to train, with the raw embedding still needing a decision rule on top.

I chose C and put an A-style ensemble on top. Only an open-set, content-independent method fits a product where users keep signing up, and running the classical statistics *inside* the learned embedding space let me keep the tested statistical code and compare directly against the 9.6% baseline. That combination — a classical verifier operating on a learned representation — is the core idea of the project.

The system that resulted has three parts, sharing exactly one thing — the trained model — across a clean boundary:

1. **Research harness** (`research/`, PyTorch) — *makes* a frozen, versioned model reproducibly (fixed seeds, pinned dataset, recorded git commit).
2. **Inference service** (`ml-service/`, FastAPI) — *serves* it through `/embed`, `/verify`, `/health`; holds the model in memory, stores nothing, logs no raw timings.
3. **Product shell** (Node.js / Express) — the existing web app; owns users and sessions, calls the service, enforces the decision.

Keeping the thing that *makes* the claim apart from the thing that *serves* it means the live app never trains or touches a dataset, and the research never touches live user data. The two meet at a single fixed contract (`EMBED_DIM = 128`, L2-normalised). I fixed the failure behaviour up front, too: fail-safe, never fail-open. Any outage or version mismatch returns "indeterminate" and falls back to another factor, rather than quietly letting someone in. A security feature that admits everyone when it breaks is worse than none — a rule that later caught a real bug (§7).

## 3.2 Dataset

The CMU file holds, for 51 people × 400 repetitions, the timing of typing `.tie5Roanl` then Return — 11 keys, 31 timing columns per row, 20,400 rows. I checked it structurally and pinned it by SHA-256, so any run provably uses the same bytes. One detail mattered more than it looks: the real file names its columns by key (`H.period`, `H.Shift.r`, `H.Return`), not by printable character, so a loader expecting `H..`, `H.R`, `H.\n` would silently read all-zero timings and train on nothing while still printing a believable number. The fix was a column remap plus an assertion that the first window is exactly 11 keys spelling `.tie5Roanl` with non-zero timings (§7).

## 3.3 Features

Each keystroke becomes a small vector: four timing features (hold, down-down, flight, up-up) plus a learned embedding of which key it was. Timings are measured relative to the window's first keystroke, so the absolute clock value drops out while the precision stays. The network sees which keys were pressed and their rhythm, never what the text means — which is what makes the representation content-independent, and what should let it carry from the fixed CMU password to free typing. The same featurisation code runs in training and serving, so the served model can't see different features from the trained one.

## 3.4 The encoder

The encoder (`KeystrokeEncoder`) turns a window into a 128-D L2-normalised vector in four stages:

1. **Input fusion** — each keystroke's four timing features join a 16-D learned character embedding, making a 20-D per-keystroke vector. The character embedding lets the network learn keyboard geography rather than being told it.
2. **1-D convolutions** — two `Conv1d` layers (20→64→64, kernel 3) pick up local rhythm: the timing of adjacent key-pairs, or digraphs.
3. **Bidirectional GRU** — a recurrent layer (GRU: Cho et al., 2014; 64 units each way → 128) reads the sequence in both directions, catching longer-range cadence.
4. **Attention pooling → projection → L2-norm** — a single-head additive attention layer (Bahdanau et al., 2015; a learned score per time step, soft-maxed over the valid keystrokes with a length mask) weights the time steps, a linear layer projects to 128-D, and L2-normalisation puts the vector on the unit sphere.

I chose CNN + BiGRU + attention over a Transformer for a concrete reason: the open-set split trains on 35 people, about 14,000 windows of one 11-key password — small, low-diversity data on which self-attention tends to overfit, and the convolution and recurrence bake in the locality and sequence priors that data this thin can't teach from scratch. I tested that choice rather than asserting it (§5.2). The network has 83,505 parameters (0.32 MB as float32), trains to roughly 10% open-set EER on a laptop CPU in minutes, and embeds one window in about 0.8 ms (mean of 200 runs, batch of one) — comfortably real-time.

## 3.5 Training

I train with batch-hard triplet loss (margin 0.2) plus a small center-loss term (weight 0.01), using Adam (Kingma & Ba, 2015) at a 1e-3 learning rate for 60 epochs. Each mini-batch is built from 16 people with 2 windows each (a batch of 32); distances are squared-Euclidean on the L2-normalised embeddings, and batch-hard mining picks, for each anchor, the hardest positive (the farthest same-person window in the batch) and the hardest negative (the closest different-person one). Training is deterministic — global seed, single-process loader — so the same seed reproduces the same weights bit-for-bit on CPU. A test checks that same-person embeddings end up closer than different-person ones (O2), guarding against a collapsed encoder.

## 3.6 The verification ensemble

After training, a user is *enrolled*, not retrained. I embed about a dozen of their windows into a profile: the centroid, the enrolment embeddings themselves (for nearest-neighbour), and the Ledoit–Wolf inverse-covariance matrix. A new window is scored by three distances to that profile, fused into one number as their plain unweighted mean: (i) the per-dimension L1 distance to the centroid, (ii) the mean L1 distance to the three nearest enrolment embeddings, and (iii) the Ledoit–Wolf Mahalanobis distance. If the shrinkage covariance ever comes out singular, the Mahalanobis term falls back to the centroid distance, so a verification degrades rather than crashes. Lower means more genuine.

A per-user threshold turns that score into a confidence and a risk level. Each enrolment embedding is scored against the centroid of the *others* (leave-one-out, so a window is never compared with itself), and the threshold is the 90th percentile of those genuine distances times a 1.15 cushion, floored at a small positive value so a perfectly consistent typist can't drive it to zero (the bug behind §7). All of this runs inside the *learned* 128-D space, not on raw timings, and the same fusion code runs in research and in the live service, so the EER I measured and the decision I ship are the same maths.

One property is worth stating up front, because it shapes how to read the results: the three terms are fused unweighted, and a Mahalanobis distance in 128 dimensions is numerically far larger than a mean-absolute L1 term, so it dominates the mean. A component ablation (§4.4) shows it carries essentially all of the ensemble's advantage — which points at a clear improvement (scale the terms before fusing) rather than a flaw in the result.

## 3.7 Evaluation protocol

The protocol is the part that decides whether the number means anything.

**Open-set, held-out people.** I split the 51 people (seeded) into 35 for training and 16 held out. The encoder trains only on the 35, and the EER is measured only on the 16 it has never seen, so the result measures generalisation to new people — the only thing that matters for authentication. A runtime check guarantees no test person leaks into training.

**Genuine vs impostor, within each test person.** For each test person I split their windows into an enrolment half and a test half. Genuine windows score against the profile built from the enrolment half (so a window is never scored against itself); impostor windows are the other test people's. If a person has too few windows to hold a test set out, the evaluator raises an error rather than invent a number.

**Two metrics.** Scaled-Manhattan EER is the headline (the exact metric of the 9.6% baseline); the full-ensemble EER is secondary.

**Three seeds.** Because both the split and the training are random, I run seeds 42/43/44 and report mean ± SD, so a near-baseline result can't be waved away as noise. (Later I re-ran the whole pipeline over 14 seeds to check the ensemble-vs-primary effect — §4.4.)

**Hyperparameters by nested validation.** Try many settings and keep the best on the test set, and you've quietly turned the test set into a training signal. So I set the 16 test people aside first, then inside the 35 training people carved a further 24 inner-train / 11 validation split, judged every setting only on the validation people, and ran the validation winner once on the 16. Because nothing was chosen using the test set, the final EER stays an open-set estimate (§4.4).

## 3.8 The live system

To show the model is more than a benchmark number, I wired a standalone slice (`/api/ml-keystroke/*`) into the product backend. A user consents, enrols by typing several windows (which become a profile), and is verified on a new window. The decision is fail-safe: if the service is unreachable, or the model version doesn't match the profile, the result is INDETERMINATE and the product asks for another factor. The slice is kept separate from the older statistical engine, and its safety behaviour is tested (§7).

As an end-to-end check I enrolled a held-out person and verified genuine and impostor windows over HTTP: the mean genuine score (3.10) came out clearly below the mean impostor score (6.73), so the deployed model ranks impostors as less genuine than the real user, matching the offline run. This is a single-user smoke test — it shows the wiring works, not that the system performs well across a population; the headline EER (§4.1) is the evidence of performance. It also surfaced the crash in §7 (problem 8).

# 4. Results

Everything below was trained on real CMU data on a laptop CPU (no GPU), averaged over three seeds (42, 43, 44), and is reproducible from a pinned dataset and fixed seeds (Appendix B). The full run took about 23 minutes and cost £0.

## 4.1 Headline result

Open-set EER on the 16 held-out people (mean ± SD over 3 seeds):

| Scorer | EER (mean) | SD | Per-seed | Comparison |
|----|----|----|----|----|
| Scaled-Manhattan (headline; comparable to baseline) | 0.1422 (14.2%) | ± 0.0279 | 0.1421 / 0.1764 / 0.1080 | vs published 0.0962 (9.6%) |
| Full ensemble (secondary; centroid-L1 + NN + Mahalanobis) | 0.1016 (10.2%) | ± 0.0097 | 0.1086 / 0.1083 / 0.0878 | — |
| Published baseline — Killourhy & Maxion (2009) | 0.0962 (9.6%) | (their SD 0.069) | — | reference |

The headline number sits above the baseline: 14.2% against 9.6%. On this small fixed-text benchmark, the deep model does not beat the 2009 classical detector. Two things are worth drawing out anyway.

First, the ensemble is both more accurate and steadier than the simple scorer on the same embeddings — 10.2% against 14.2%, with a seed-to-seed SD of 0.97% against 2.79%. (That SD is an internal comparison between my own two scorers, not a claim against the baseline's across-subject spread of 0.069.) Three seeds can't settle whether the ensemble is genuinely steadier, so I re-ran the open-set pipeline over 14 seeds: it beats scaled-Manhattan on all 14 (Wilcoxon signed-rank *p* ≈ 0.0001). The advantage is real, and §4.4 pins down where it comes from.

Second, seeds 42/43/44 sit on the optimistic side of the spread. Across 14 seeds the mean EERs are higher — ≈ 18.7% primary, ≈ 13.3% ensemble — so the headline three-seed figures are a favourable slice of a wider distribution, and the real gap to 9.6% is larger than the headline suggests. A subject-level bootstrap (resampling the 16 held-out people, 20,000 draws) puts a 95% confidence interval of [9.5%, 19.2%] on the seed-42 14.2%: wide, because per-person EER varies so much (§4.2). The DET curve for the headline scorer is in Appendix B (Figure B.1); its equal-error point sits on the FAR = FRR diagonal at 14.2%, with the 9.6% baseline marked.

## 4.2 Per-subject variation

The 16 held-out people vary a lot in how recognisable they are (full table in Appendix B):

- **Most distinctive** (lowest EER): s036 at 0.9%, s017 at 2.0%, s022 at 3.5% — strong authenticators on their own.
- **Hardest** (highest EER): s047 at 33.5%, s007 at 29.5%, s037 at 23.4% — for them the 11-key password is too short and inconsistent to tell them apart.

The spread isn't random. For each held-out person I compared their within-person embedding scatter against the distance to the nearest other typist; that separability ratio (nearest-impostor distance ÷ own scatter) tracks per-subject EER closely (Spearman ρ = −0.84, *p* = 0.0001). The distinctive authenticators sit far from everyone relative to their own consistency; the hardest type inconsistently enough that their rhythm collides with other people's in the embedding. So the limiting factor isn't the model — it's the information in an 11-key fixed password, which for some people is simply too little to separate them. A longer, richer sample (free text, §8) should ease things for exactly these users.

## 4.3 The embedding space

To see *why* it works, I projected the held-out 128-D embeddings down to 2-D with t-SNE (van der Maaten & Hinton, 2008) — Figure B.2. Several people form tight, well-separated clusters, which confirms the encoder maps a person's typing to a consistent region even though it never trained on them. A denser middle region of overlap lines up with the high-EER people from §4.2, so the picture and the numbers agree.

## 4.4 Does the configuration hold up?

Two ablations check that the headline isn't luck, and that I'm crediting the right thing for the ensemble's edge. Neither touches the test set except where the protocol allows.

**Was the setting well-chosen, or lucky?** Using the nested-validation split from §3.7 (16 test people untouched; a 24/11 inner-train/validation split inside the 35), I changed one setting at a time and judged it only on the validation people:

| Setting (change from the original) | Validation primary EER | Validation ensemble EER | Final loss |
|----|----|----|----|
| Original (60 epochs, margin 0.2, centre 0.01, 2 windows/subject) | 0.1933 | 0.1678 | 0.200 |
| more windows per subject (2 → 4) | 0.2572 | 0.1731 | 0.200 |
| more windows per subject (2 → 8) | 0.1975 | 0.2023 | 0.200 |
| longer training (60 → 120 epochs) | 0.1904 | 0.1684 | 0.200 |
| wider margin (0.2 → 0.3) | 0.1933 | 0.1678 | 0.300 |
| stronger centre-loss (0.01 → 0.05) | 0.2054 | 0.1725 | 0.200 |

(Validation EERs run higher than the §4.1 test EERs because the inner-train set has only 24 people, so the encoder is weaker. These numbers are only ever compared with each other.) Nothing helped meaningfully. More windows per subject made it worse, which surprised me — I'd expected harder triplet mining to help. The only nominal gain was doubling the epochs (−0.003 validation EER, well inside the noise of an 11-person fold), and when I ran that validation winner once on the 16 test people it generalised *worse* and far less steadily: primary 0.161 ± 0.087 against the original's 0.142 ± 0.028, with one seed sliding to 0.284. That −0.003 was noise; acting on it would have hurt. One more thing falls out of the table: the training loss saturates at the margin in every row, so the triplets are essentially all satisfied and the bottleneck isn't optimisation but the information in an 11-key password (§4.2). More epochs, samples or margin can't pull out a signal that isn't in the data.

**Which distance carries the ensemble?** Before crediting "averaging three distances" for the gain in §4.1, I dropped each term in turn and re-scored the same held-out embeddings (mean over the three seeds):

| Ensemble variant | EER (mean of 3 seeds) |
|-----------------------------------------|-----------------------|
| Full (centroid-L1 + k-NN + Mahalanobis) | 0.1016 |
| − drop centroid-L1 (k-NN + Mahalanobis) | 0.1016 |
| − drop k-NN (centroid-L1 + Mahalanobis) | 0.1016 |
| − drop Mahalanobis (centroid-L1 + k-NN) | 0.1330 |

Removing the centroid-L1 or nearest-neighbour term changes the EER by essentially nothing; removing the Mahalanobis term throws most of the advantage away, back toward the 0.1422 primary scorer. So the ensemble's edge isn't the averaging — it's the Ledoit–Wolf Mahalanobis distance computed in the learned space, with the other two numerically swamped by its larger scale. The pattern holds across all 14 seeds: the full ensemble averages 0.1326 and dropping Mahalanobis rises to 0.1783, while dropping the other two leaves it unchanged. The practical read is that a shrinkage-covariance Mahalanobis distance inside the learned embedding recovers most of the gap to the baseline with lower seed-to-seed variance than scaled-Manhattan — and that scaling the terms before fusing would let the other two actually contribute.

# 5. Discussion

## 5.1 What the numbers mean

The aim asked whether a deep embedding plus a classical verifier can authenticate from typing rhythm, and how it compares with 9.6%. The answer has three parts. It authenticates — well above chance, reaching 0.10–0.14 on people it never trained on, end to end through a live service. It does not beat the classical baseline on this small fixed-text benchmark: the headline scaled-Manhattan EER is 14.2%, above 9.6%. And the hybrid idea holds in a specific, measurable way — the ensemble inside the learned space is both closer to the baseline and steadier from seed to seed than the simple scorer on the same embeddings, an effect that survives 14 seeds (Wilcoxon *p* ≈ 0.0001) and traces to the shrinkage-covariance Mahalanobis term (§4.4). A learned representation makes a classical verifier more reliable while staying open-set and content-independent — which is what a real product needs and the fixed-text baseline is not.

All six objectives (§1.2) were met: the 128-D encoder runs on CPU (O1); same-person windows cluster, by both the intra/inter test and the t-SNE picture (O2); the open-set EER is measured only on held-out people, with an evaluator that refuses to score training data (O3); two EERs come from one run (O4); the pipeline regenerates from a pinned SHA and fixed seeds (O5); and the live service serves consent → enrol → verify with fail-safe behaviour (O6).

## 5.2 Comparison: baseline, TypeNet, and a Transformer

Against the two reference points of §2.4, the result lands where you'd expect a small-data hybrid to land: above Killourhy & Maxion's 9.6% on their own fixed-text turf, and nowhere near TypeNet's 2.2%, which is bought with web-scale free-text data this project deliberately doesn't have. The interesting comparison is the one I could run myself. To test the §3.4 claim that a Transformer would overfit this data, I built a comparable Transformer encoder (2 layers, 4 heads, 77,296 parameters — in fact slightly *smaller* than the CNN+BiGRU, which corrects my first guess that it would be much larger) and ran it through the identical open-set protocol over the same three seeds. It came out worse and far less stable: primary EER 19.8% ± 5.4%, ensemble 12.3% ± 4.9%, against this model's 14.2% ± 2.8% and 10.2% ± 1.0%. Both models' training loss saturates at the margin, so both are data-limited — but the convolution-and-recurrence priors pull a steadier signal from thin data than self-attention can. The architecture choice holds up empirically; the honest reason is inductive bias at this scale, not the parameter count I first reached for.

## 5.3 Implications

**For account security.** Even a 10% EER biometric is useful as a *second* factor. Behind a password, it raises the bar for an attacker who only has stolen credentials, at no extra effort for the user; run continuously, it could catch session hijacking a password-only system never sees.

**For research.** A small, reproducible data point on whether deep embeddings help on small keystroke datasets — the finding (an embedding-plus-ensemble lowers variance and nearly matches the baseline open-set) is modest but real, and the fully reproducible pipeline is worth something on its own in a field where reproducibility is often weak.

**For people who struggle with conventional authentication.** A silent biometric that needs no extra device *could* lower the barrier for people for whom passwords and tokens are a burden. I flag this as a hypothesis, not a finding: I've run no accessibility study, and a behavioural biometric carries its own risk for people whose typing is less consistent — the high-EER subjects of §4.2 are a warning, and §6 returns to it as a fairness problem.

## 5.4 Limitations

The conclusions hold only within their bounds: a single small public dataset (51 people, one 11-key password), a small CPU-trained model, and fixed text only — the free-text claim is designed for but not yet measured on a real corpus. The per-user threshold ranks correctly but isn't yet calibrated to the fused score's scale, so the product's confidence percentage is not yet meaningful even though the ranking is (§7, problem 9). The §4.4 ablations sharpen these limits rather than soften them: because no extra training, sampling or margin helped, the 11-key password — not the model, not the compute — is the ceiling, which is why free text (§8) is the highest-value next step.

# 6. Ethics and responsible use

Biometric authentication is ethically serious for one reason: it works. A system that can recognise people by their behaviour can also watch them. Several choices here were made to stay on the right side of that line.

**Typing data is special-category data.** Under UK/EU GDPR (Article 9), biometric data processed to uniquely identify a person is special-category data — the most protected class — and Article 4(14) explicitly includes behavioural characteristics. So the moment this system identifies someone, the data it handles is special-category, which shaped everything below.

**Public, anonymised data — not new identifiable data.** The headline result is measured entirely on the CMU benchmark, whose subjects are anonymised (s002, and so on) and consented to research use. I deliberately did not train the headline model on real product users, which would have created fresh identifiable behavioural data with all its consent and storage duties.

**Explicit, revocable consent in the product.** The product slice makes a user opt in before any window is captured, and opting out wipes their profile. Consent is a stored, timestamped record — data minimisation built into the product, not written on a policy page.

**Store templates, not raw timings.** The inference service is stateless and logs no raw timings. The product stores the derived profile (embeddings and statistics) and an audit log of decisions (score, version, risk), never the raw stream of what someone typed. A stolen profile is far less sensitive than a recording of everything they typed.

**Fail-safe, never fail-open.** Any outage or version mismatch returns "indeterminate" and forces another factor. It never defaults to "allow" — an ethical choice as much as an engineering one.

**Unequal error rates across users.** My own results carry a fairness problem I have to name. Per-subject EER (§4.2) runs from 0.9% for the most distinctive typist to 33.5% for the least — roughly a 37-fold difference in how often the system fails a person, on the same model and password. A biometric whose error rate isn't uniform across users is a textbook disparate-impact risk: the people it serves worst would, in a careless deployment, be wrongly rejected or wrongly admitted far more often than the population EER of 14.2% suggests, and that headline hides it completely. This is the concrete reason the system must never be a sole factor, and the reason a real deployment needs a *per-user* error audit, not just an aggregate EER. The high-EER users aren't random either — they're the least internally consistent typists (§4.2, ρ = −0.84) — so a fair deployment can identify them in advance and lean on a fallback factor rather than quietly failing them more often.

**Dual use, and honest framing.** The same technology that protects an account can, in the wrong hands, track or de-anonymise people by their typing. I frame it as opt-in protection the user controls, not covert surveillance, and I report the error rates rather than bury them. A 10% EER system must never be sold as infallible.

**Risk assessment.** This is a software project with no physical hazards. The risks are informational: data leakage, wrongly rejecting genuine users (mitigated by fail-safe step-up), the unequal error rates above, and over-claiming (mitigated by reporting the numbers plainly).

# 7. Engineering challenges

Most of the work that shaped the numbers was debugging, and the useful bugs weren't caught by a test passing — they were caught by asking whether a passing test actually meant what it claimed. I kept a machine-readable log (`research/artifacts/problem_log.json`) of thirteen, each as problem → root cause → fix → how verified:

| # | Severity | Problem | Root cause | Fix | Verified by |
|---|---|---|---|---|---|
| 1 | critical | EER measured closed-set (trained on all 51, scored per-subject) | No train/test split by person | Seeded 35/16 split; score only the held-out 16 | No-leakage test; result above baseline |
| 2 | high | Ledoit–Wolf ensemble never used in the EER path | Ensemble was dead code there | Added an ensemble EER path using the deployed fusion | Ensemble 10.2% < primary 14.2% |
| 3 | high | Wrong branch could collapse each rep to a 1-keystroke window | Silent real-CMU vs fixture branch | Assert the sequence branch fires | 20,400 windows all length 11 |
| 4 | medium | Open-set eval re-embedded impostors O(N) times | `eer_for_subject` re-embedded each call | Embed once, cache, score both metrics | 300 s → 89 s, identical EER |
| 5 | low | Ledoit–Wolf used a slow per-sample loop | `pi_sum` built n outer products | Vectorised (einsum) | Bit-parity 1e-9 across 4 shapes |
| 6 | high | Service could verify no-one — nothing built a profile | Enrolment→profile step missing | New `keystrokeProfileBuilder.js`, leave-one-out threshold | 5 profile-builder tests |
| 7 | medium | Download script's SHA-256 was unverifiable | `EXPECTED_SHA256` a sentinel | Pinned the measured digest | `download_cmu.py --skip-download` verifies |
| 8 | high | Live `/verify` 500'd for a very consistent typist | Tiny threshold overflowed the sigmoid exponent | Clamp exponent, floor threshold | Regression test; live ranks impostor > genuine |
| 9 | medium | Confidence saturates (all HIGH) though ranking is right | Threshold and fused score on different scales | Logged as future work; rank-based EER unaffected | Ranking holds; flagged openly |
| 10 | high | Free-text phase had the same closed-set defect as #1 | Defect duplicated across entrypoints | Refactored to reuse the open-set machinery | `test_phase2_is_open_set_no_leakage` |
| 11 | high | Evaluator could fabricate 0.0 EER on an empty test set | No empty-test-set guard | Evaluator now raises | Empty-test-set guard test |
| 12 | high | Real key-named columns (`H.period`) → all-zero timings | Fixture vs real-file column mismatch | `remap_cmu_columns` before featurising | Remap test; 41/44 non-zero |
| 13 | medium | `torch.load` could run arbitrary code from a swapped file | `weights_only` defaulted to False | Load `weights_only=True` + dim guard | Round-trip + load-time guard |

Two are worth telling in full.

**The closed-set flaw (problem 1).** The original evaluator trained the encoder on all 51 people, then measured EER per person — so the network had already met every test subject. That isn't comparable to an open-set baseline, and anyone reading the training loop would rightly bin the result. The cause was simple: with no split by person, the protocol protected the profile but not the representation. The fix was the seeded 35/16 split, training on 35 and evaluating only on the 16 held-out, with a runtime check that no test person leaks into training. It's the single change that changed the meaning of every number in this report, and it dropped the EER from an implausible near-zero to an honest 14.2% above the baseline.

**A crash only the real system showed (problem 8).** The live `/verify` endpoint returned HTTP 500 for a very consistent typist, and no unit test caught it. Such a typist, on a fixed 11-key password, produces nearly identical embeddings, so the per-user threshold drops close to zero, the confidence sigmoid's exponent (`score/threshold`) blows up, and `math.exp` overflows. I clamped the exponent to a safe range (lossless, since the sigmoid is flat there) and floored the threshold so no profile can be degenerate. Synthetic test embeddings have artificial spread, so the tests never hit it — only real data from a real consistent typist did. It's the clearest case in the project of why running the real system beats trusting the tests.

# 8. Conclusion and future work

I set out to measure, honestly and reproducibly, whether a deep embedding of typing rhythm plus a classical verifier can authenticate a person on the CMU benchmark, and how it compares with the published 9.6%. Under a strict open-set protocol, on 16 people the model never saw, it reached 14.2% EER with the comparable scaled-Manhattan metric and 10.2% with the full ensemble — the ensemble both closer to the baseline and steadier from seed to seed, an effect that survives 14 seeds and traces to the shrinkage-covariance Mahalanobis term. The headline comparison is a near-miss: on small fixed-text data, the deep model doesn't beat the 2009 classical detector. What the project does deliver is a reproducible, open-set test of a hybrid design — a classical verifier run inside a learned embedding space — with its limits measured rather than hidden: the 11-key password is the ceiling, per-user error varies 37-fold, and the ensemble's edge is one specific term, not the averaging I first assumed.

The next steps follow directly from where the ceiling is:

1. **Free text on a real corpus.** The 11-key password is the limiting factor (§4.2) and the ablations proved it. The free-text pipeline is built and open-set-correct; a real result needs a large public corpus (the Aalto 136-million-keystroke dataset). This is the clear next experiment.
2. **Calibrate the confidence scale** (§7, problem 9) so the product's confidence percentage means something, not just the ranking.
3. **Train at scale on GPU**, following TypeNet, to test whether the hybrid's advantage holds as accuracy rises.
4. **Collect a small, consented dataset of real users** to test cross-dataset generalisation, with the §6 safeguards built in from the start.

# 9. Reflection

The project turned a corner the moment I stopped believing my own first result. My first evaluation gave an EER I was pleased with — until I read back through the training loop and realised the model had already seen, in training, the exact people I was testing it on. I hadn't cheated on purpose; the code had quietly handed me a flattering number and I'd been happy to take it. Learning to treat a good result as something to attack — to ask "what would make this wrong?" before celebrating — is the habit I'll keep longer than any single technique. Redoing it open-set cost me a nicer-looking number, and it's the decision I'm most sure was right. It also drove home why biometrics are judged on EER and DET curves rather than "accuracy": when you can fail in two opposite ways, one number hides the trade-off that matters.

Working with no mentor cut both ways. Every check on my work was one I ran on myself, which is probably why I eventually caught the closed-set mistake — I'd trained myself to distrust my own results. But it's also where working alone hurt: there was nobody to glance over and say "hang on, aren't those your training subjects?" I made the mistake and was the only person who could catch it, and for a while I just didn't.

If I did it again I'd change two things. First, I'd write the whole evaluation protocol down before writing any of the evaluator — the closed-set flaw survived because the protocol only existed in my head, where it was easy to talk myself into a number I liked; on paper the leak would have been obvious. Second, I'd get a mentor, or even one peer reviewer, early on. Saying a result out loud to someone allowed to doubt you catches what re-reading your own code never will.

# 10. Acknowledgements

This was an independent project with no mentor or supervisor, so the "people" side of it came from the wider research community: Killourhy and Maxion for the CMU dataset and the baseline to measure against; the FaceNet, TypeNet, GRU, attention and center-loss authors whose methods I built on; Ledoit and Wolf for the shrinkage estimator; and the maintainers of PyTorch, NumPy, scikit-learn, FastAPI and the other libraries I relied on. I read the ISO/IEC 19795-1 biometric-testing standard and the ICO's GDPR guidance to get the evaluation and the ethics right. AI assistance (Anthropic's Claude, via Claude Code) is disclosed in full in §11; every scientific decision, every result, and the final prose are my own.

# 11. AI use statement

**Tool.** Anthropic's Claude (Claude Opus 4.8), through the Claude Code command-line assistant, on a Windows laptop during the development work and while writing this report.

**What I used it for.** *Code scaffolding and debugging:* first drafts of functions (the open-set split, the figure scripts, the profile builder) and help diagnosing bugs — all of which I reviewed, ran and tested; it produced no number in this report. *Finding references:* surfacing key papers (Killourhy–Maxion, TypeNet, FaceNet, Ledoit–Wolf, GDPR), which I checked against primary sources and dropped if I couldn't verify them. *Drafting:* organising the report and producing draft prose, which I edited into my own voice, fact-checked, and finished with the personal parts only I can write. I set the research direction, made every scientific decision, ran and tested all the code, and verified every result.

# 12. References

Author–date style; URLs given for openly accessible sources. Fuller provenance, including items I checked and rejected, is in `CREST_Research_Dossier.md`.

1. Killourhy, K. S. & Maxion, R. A. (2009). *Comparing Anomaly-Detection Algorithms for Keystroke Dynamics.* Proc. IEEE/IFIP Int. Conf. on Dependable Systems and Networks (DSN-2009), pp. 125–134. Dataset: <https://www.cs.cmu.edu/~keystroke/>
2. Acien, A., Morales, A., Monaco, J. V., Vera-Rodriguez, R. & Fierrez, J. (2021). *TypeNet: Deep Learning Keystroke Biometrics.* IEEE Trans. Biometrics, Behavior, and Identity Science. arXiv:2101.05570.
3. Schroff, F., Kalenichenko, D. & Philbin, J. (2015). *FaceNet: A Unified Embedding for Face Recognition and Clustering.* CVPR 2015, pp. 815–823. DOI 10.1109/CVPR.2015.7298682. arXiv:1503.03832.
4. Hermans, A., Beyer, L. & Leibe, B. (2017). *In Defense of the Triplet Loss for Person Re-Identification.* arXiv:1703.07737.
5. Wen, Y., Zhang, K., Li, Z. & Qiao, Y. (2016). *A Discriminative Feature Learning Approach for Deep Face Recognition (center loss).* ECCV 2016, LNCS 9911, pp. 499–515. DOI 10.1007/978-3-319-46478-7_31.
6. Ledoit, O. & Wolf, M. (2004). *A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices.* J. Multivariate Analysis 88(2), 365–411. DOI 10.1016/S0047-259X(03)00096-4. (Reference implementation: scikit-learn `LedoitWolf`.)
7. Dhakal, V., Feit, A. M., Kristensson, P. O. & Oulasvirta, A. (2018). *Observations on Typing from 136 Million Keystrokes (Aalto dataset).* CHI 2018. DOI 10.1145/3173574.3174220. Data: <https://userinterfaces.aalto.fi/136Mkeystrokes/>
8. ISO/IEC 19795-1. *Information technology — Biometric performance testing and reporting — Part 1: Principles and framework.* <https://www.iso.org/standard/73515.html>
9. *Keystroke Dynamics: Concepts, Techniques, and Applications.* ACM Computing Surveys (2024/25). DOI 10.1145/3733103.
10. Frank, M., Biedert, R., Ma, E., Martinovic, I. & Song, D. (2013). *Touchalytics: On the Applicability of Touchscreen Input as a Behavioral Biometric for Continuous Authentication.* IEEE Trans. Information Forensics and Security 8(1). arXiv:1207.6231.
11. UK GDPR, Article 9 (special-category data) and Article 4(14) (definition of biometric data). <https://gdpr-info.eu/art-9-gdpr/> ; UK ICO guidance on biometric data.
12. Verizon (2024). *2024 Data Breach Investigations Report (DBIR).* Stolen credentials involved in ≈ 88% of Basic Web Application Attacks. <https://www.verizon.com/business/resources/reports/dbir/>
13. CREST Awards (British Science Association). *Gold criteria guidance*, *Required documentation*, *AI guidance for students.* <https://www.crestawards.org/help-centre/gold-criteria-guidance/>
14. Cho, K., van Merriënboer, B., Gulcehre, C., Bahdanau, D., Bougares, F., Schwenk, H. & Bengio, Y. (2014). *Learning Phrase Representations using RNN Encoder–Decoder for Statistical Machine Translation (GRU).* EMNLP 2014. arXiv:1406.1078.
15. Bahdanau, D., Cho, K. & Bengio, Y. (2015). *Neural Machine Translation by Jointly Learning to Align and Translate (additive attention).* ICLR 2015. arXiv:1409.0473.
16. van der Maaten, L. & Hinton, G. (2008). *Visualizing Data using t-SNE.* Journal of Machine Learning Research 9, 2579–2605.
17. Kingma, D. P. & Ba, J. (2015). *Adam: A Method for Stochastic Optimization.* ICLR 2015. arXiv:1412.6980.

# 13. Appendices

## Appendix A — Glossary

- **Behavioural biometric** — recognition by how you act (typing rhythm, gait), not what you are.
- **Embedding** — a fixed-length vector representation of an input; here, 128 numbers per window.
- **Triplet loss** — a training objective that pulls same-person embeddings together and pushes different-person ones apart.
- **EER (Equal Error Rate)** — the threshold where the false-accept rate equals the false-reject rate; lower is better. The DET curve plots FAR against FRR across thresholds.
- **Open-set** — tested on people not seen in training (the honest test for authentication).
- **Nested validation** — choosing settings on a validation split carved from the training data, so the test set is never used to choose anything.
- **Mahalanobis distance** — a distance that accounts for correlations between dimensions.
- **Ledoit–Wolf shrinkage** — a way to make a covariance matrix stable and invertible from few samples.
- **CMU dataset** — the Killourhy–Maxion keystroke benchmark (51 people, password `.tie5Roanl`).

## Appendix B — Full results, figures and provenance

Per-subject EER (scaled-Manhattan, seed 42), 16 held-out people, most to least distinctive:

| Rank | Subject | EER   |     | Rank | Subject | EER   |
|------|---------|-------|-----|------|---------|-------|
| 1    | s036    | 0.009 |     | 9    | s050    | 0.179 |
| 2    | s017    | 0.020 |     | 10   | s056    | 0.190 |
| 3    | s022    | 0.035 |     | 11   | s030    | 0.190 |
| 4    | s005    | 0.045 |     | 12   | s018    | 0.205 |
| 5    | s012    | 0.051 |     | 13   | s054    | 0.215 |
| 6    | s010    | 0.090 |     | 14   | s037    | 0.234 |
| 7    | s038    | 0.090 |     | 15   | s007    | 0.295 |
| 8    | s053    | 0.090 |     | 16   | s047    | 0.335 |

The seed-42 mean of these is 0.1421, matching the headline seed-42 EER (a consistency check). The spread from 0.9% to 33.5% is the §4.2 finding: the limiting factor is the information in an 11-key password, not the model. Aggregate (mean ± SD over seeds 42/43/44): scaled-Manhattan 0.1422 ± 0.0279; full ensemble 0.1016 ± 0.0097; baseline 0.0962. The nested-validation cross-check (§4.4): the validation-selected alternative (120 epochs) scored 0.1610 ± 0.0866 / 0.1128 ± 0.0378 on the same people — worse and less stable, confirming the headline setting.

**Provenance fingerprints (for independent verification).** So the result can be checked without the repository:

- Dataset (`DSL-StrongPasswordData.csv`) SHA-256: `b11d23538b1865fa6ecf4e8b78567caa312e9c1027604bb022fcc6ad7eaa7a33`
- Git commit of the recorded run: `13fafe8f039d969fd77734b67d2457d37c59f918`
- Seeds 42 / 43 / 44 · embedding dim 128 · 60 epochs · CPU · ~23 min total
- Environment: Python 3.12, PyTorch 2.12 (CPU)

The model artifact and `metrics.json` both record this commit, and `metrics.json` records this SHA-256, so the data, the code version and the result are provably one triple. Both figures are generated by `research/scripts/make_figures.py` and live in `research/artifacts/`.

**Figure B.1 — DET curve.**

![DET curve for the headline scaled-Manhattan scorer on the 16 held-out people, plotting FRR against FAR across all thresholds.](research/artifacts/det_curve.png)

*FRR against FAR across all decision thresholds for the headline scaled-Manhattan scorer on the 16 held-out people. The equal-error point sits on the FAR = FRR diagonal at 14.2%; the 9.6% published baseline (Killourhy & Maxion 2009) is marked for reference.*

**Figure B.2 — Embedding space (t-SNE).**

![t-SNE projection of the 16 held-out people's 128-D embeddings into two dimensions, coloured by person.](research/artifacts/tsne.png)

*The 128-D embeddings of the 16 held-out people, projected to 2-D with t-SNE and coloured by person. Several people form tight, well-separated clusters even though the encoder never trained on them; the denser overlap region corresponds to the high-EER people of §4.2.*
