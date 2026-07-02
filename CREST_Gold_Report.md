# Can You Be Recognised by the Way You Type?

### Building and testing a system that verifies who someone is from their typing rhythm alone

|  |  |
|----|----|
| Author | Devadit Jain |
| Field | Machine learning · behavioural biometrics · online security |
| Type | Research and build |
| Dates | 25 November 2025 – 10 June 2026 |

> **How to read this report.** The main sections are written to be understood without any background in programming or AI — you can follow the whole story, and what it means, from the plain-English thread. Where a technical idea matters, I explain it with an everyday comparison first. The exact model design, settings and statistics live in **Appendix C** for readers who want them; skipping that appendix costs you none of the argument.

------------------------------------------------------------------------

## Abstract

A password only proves you know a secret. It says nothing about *who* is typing it — which is why a stolen password works perfectly for a thief. This project asks whether the way a person types — their rhythm, the tiny pauses and holds that are as personal as an accent — could quietly confirm identity as a second check behind a password.

I built a system that learns to turn a short burst of typing into a kind of numerical fingerprint, then decides whether a new burst matches an enrolled person. I tested it on a standard public dataset of 51 people typing the same password, using a deliberately strict test: the system is judged only on people it has never seen before. Its error rate came out at 14.2% on the measure that compares fairly with the long-standing benchmark, and 10.2% using a more elaborate decision method. So it works — it recognises people well above chance — but on this small, fixed-password test it doesn't beat the best method from a well-known 2009 study, which scores 9.6%. The more interesting finding is about *how* the system behaves: the elaborate decision method is not just more accurate but far more stable, and I traced that stability to one specific statistical ingredient. Along the way I document the mistake that nearly handed me a flattering but meaningless result, the ethics of building something that recognises people by their behaviour, and everything that broke and how I fixed it.

## Contents

1. Introduction
2. The idea, and what's been done before
3. What I built, and how I tested it
4. Results
5. What the results mean
6. Ethics and responsible use
7. What went wrong, and how I fixed it
8. Conclusion and next steps
9. Reflection
10. Acknowledgements
11. AI use statement
12. References
13. Appendices

------------------------------------------------------------------------

# 1. Introduction

## 1.1 The problem

Passwords check knowledge, not identity. Anyone who steals or guesses your password becomes, as far as the system is concerned, you. That gap is expensive: Verizon's 2024 Data Breach Investigations Report found stolen credentials were involved in about 88% of attacks on web applications, and "credential stuffing" — automatically trying millions of leaked username-and-password pairs against login pages — is one of the most common attacks online (Verizon, 2024). Two-factor authentication helps, but it adds a step, and steps that annoy people get switched off.

Typing rhythm offers a different kind of check. Instead of asking you to do something extra, the system watches how you already type. The idea is surprisingly old — 19th-century telegraph operators could recognise each other by the rhythm of their tapping, their "fist" — but only recently has software become good enough to recognise people from freely typed text, not just one memorised phrase (Acien et al., 2021). That's what could turn it from a curiosity into a real security layer: an invisible second check at login, or a continuous one that notices if the person typing mid-session is no longer you.

This isn't abstract for me. An account I cared about was broken into with a stolen password, and the system never noticed — the password was correct, so the attacker simply *was* me. A perfectly correct password defended nothing. That's what pushed me to ask: could *how* a person types be a quiet check that a stolen password can't fake?

## 1.2 What I set out to do

> **Aim.** Find out whether a computer can verify a person's identity from their typing rhythm alone, and measure how close it gets to the best published result on a standard benchmark (an error rate of 9.6%).

The aim has a pass/fail test built in — one number, measured on people the system has never seen, read against a known reference. I broke it into six objectives, each with a condition I could actually check:

| # | Objective | How I'd know it worked |
|----|----|----|
| O1 | Build a network that turns a burst of typing into a fixed-size numerical fingerprint | It runs on an ordinary laptop and always produces the same size of output |
| O2 | Train it so the same person's samples land close together and different people land apart | A test confirms same-person samples are closer than different-person ones |
| O3 | Test it honestly, only on people it never trained on | The error rate is measured on held-out strangers; the code refuses to grade itself on people it studied |
| O4 | Add a classical statistical decision-maker on top of the learned fingerprint | Two error rates reported from one run, so I can compare the simple and elaborate methods |
| O5 | Make the whole thing reproducible | One command regenerates the result from the exact same data and settings |
| O6 | Show it working in a real application, and failing safely | A live service recognises a user; if anything breaks, it never lets someone in by default |

## 1.3 How I ran the project

The work ran in four dated stages, each one having to work before the next began. The first three built the typing app and gathered the data; the fourth — the June research stage — is what most of this report is about. (CREST expects Gold projects to take around 70 hours; this one, evidenced by the dated commit history, took roughly 84.)

| When | Stage | What happened |
|----|----|----|
| Nov–Dec 2025 | Typing web app + keystroke capture | Built; became the real source of typing data |
| Feb–Mar 2026 | Accounts + first statistical recognisers | First simple typing checks; the clean boundary between research and product |
| Jun 2026 | Deep-learning research | Rebuilt the recogniser as a learned model; tested it on strangers |
| Jun 2026 | Write-up | Report, ethics, reproducibility check |

Two plans changed as I went. I dropped a planned cloud step to train on rented hardware once I saw the model trained in about 23 minutes on my own laptop for nothing — the rental would have cost a little money and added a dependency for no benefit. And I scaled back the "free typing" phase to "the pipeline is built and proven" rather than spend limited time on a 136-million-keystroke dataset (§8). The biggest change came mid-project, when I discovered my test was flawed and had to rebuild it (§7); that single fix changed the meaning of every number in this report.

# 2. The idea, and what's been done before

## 2.1 Typing rhythm as a fingerprint

There are two kinds of biometric. Physical ones — fingerprint, iris, face — describe what your body *is*. Behavioural ones — signature, walk, typing rhythm — describe how you *do* something. Typing rhythm is behavioural: it recognises you by your timing, not by what you write. The raw signal is just the timing between keys — how long each key is held down, and the gaps between one key and the next. These are surprisingly personal, because they come from motor habits and hand shape that are hard to fake on purpose.

There's an easy version and a hard version. In *fixed text* everyone types the same phrase, so you can line up matching keystrokes directly; in *free text* the person types anything, and the system has to read rhythm independently of the words. Real-world continuous authentication needs the hard version. This project tackles the fixed-text one — the case with a clean public benchmark — while building the pipeline the hard version would need.

## 2.2 Teaching a computer to recognise it

The clever trick behind modern biometrics is to stop asking "which of my known users is this?" and instead learn to *place* each sample in space. Picture a vast space where every burst of typing becomes a single dot. Train the system well, and the same person's dots cluster tightly together while different people's clusters sit far apart. Recognising someone then becomes a simple question of distance: is this new dot near your cluster, or nearer someone else's?

This is exactly how modern face recognition works. FaceNet (Schroff et al., 2015) trained a network to place face photos in such a space and reached 99.6% accuracy on a standard face test. I use the same idea — and the same size of "fingerprint", a list of 128 numbers per typing sample — for keystrokes instead of faces. The training method, in plain terms: I repeatedly show the network two samples from the same person and one from someone else, and nudge it to pull the matching pair closer and push the odd one away. Do that hundreds of thousands of times and the clustering emerges on its own. (The technical name is *triplet loss*; the mechanics are in Appendix C.) The big win over learning a fixed list of users is that a new person can join without retraining anything — you just record a few of their dots, which is essential for a product where people sign up constantly.

## 2.3 How you measure success

Any system like this makes two kinds of mistake: it can let an impostor in (a false accept), or lock the real user out (a false reject). These trade off against each other. Tighten the system to catch more impostors and it locks out more genuine users; loosen it and the reverse. Because you can slide that trade-off anywhere, a single accuracy figure would be misleading. The standard fair summary is the **Equal Error Rate (EER)** — the setting where the two mistakes are equally likely. Lower is better, and a 10% EER means that, at the balanced setting, the system is wrong about one time in ten. (Plotting the full trade-off gives a curve called the DET curve; both follow the international standard for biometric testing, ISO/IEC 19795-1.)

Deciding "is this new dot really you?" comes down to measuring distance from your enrolled cluster, and there's more than one sensible way to measure it. I use three, and combine them: a plain distance to the centre of your cluster, a distance to your nearest few enrolled samples, and a smarter distance that accounts for how much your own typing naturally wobbles from sample to sample. That third one (its technical name is a *Mahalanobis distance*, made stable with a technique from Ledoit & Wolf, 2004) turns out to matter a lot later.

## 2.4 What's been done before, and the gap

Two studies bracket this project. On one side, the classical benchmark: Killourhy & Maxion (2009) collected the exact dataset I use — 51 people each typing the password `.tie5Roanl` 400 times — and compared 14 hand-crafted methods. Their best scored an EER of 9.6%. It's a careful study, but bounded by design: one fixed password, every method hand-tuned on raw timings, and nothing in it about whether a *learned* model would help.

On the other side, the modern state of the art: TypeNet (Acien et al., 2021) trained a large model on 136 million keystrokes from about 168,000 people and reached an EER of 2.2%, scaling to 100,000 users. It proves learned typing recognition works brilliantly — but that 2.2% is bought with internet-scale data, and the paper never asks whether the same idea still helps in the small-data world where reproducible benchmarking actually happens.

The two never meet. One owns small, fixed-text data and hand-built methods; the other owns web-scale data and a learned model. Nobody asks the obvious in-between question: on the small public benchmark, does a *learned* fingerprint plus a classical decision-maker beat the classical method on its own, tested fairly on strangers? That's the gap a student-scale project can actually fill.

# 3. What I built, and how I tested it

## 3.1 Three ways to build it, and the one I chose

There were three genuinely different designs, and I weighed them before committing:

- **A — Pure statistics.** Compare each new sample against a hand-built statistical profile of a user's timings. This is the 2009 benchmark: simple, easy to interpret, no training across users, strong results (9.6%) — but tied to one fixed phrase, and a human has to choose which features matter.
- **B — A standard classifier.** Train a network to sort typing into "user 1, user 2, …". Accurate on a fixed set of people, but it has to be retrained from scratch every time someone new signs up — a dealbreaker for a live product.
- **C — A learned fingerprint (chosen).** Train the network to *place* samples in space (§2.2), so a new user joins by just recording a few dots. It welcomes new users without retraining and isn't tied to a fixed phrase — at the cost of being harder to train, and needing a separate decision rule on top.

I chose C and put an A-style statistical decision-maker on top of it. Only an open, "new users welcome" design fits a real product, and running the classical statistics *inside* the learned space let me keep the well-tested statistical code and compare directly against the 9.6% benchmark. That combination — classical statistics operating on a learned fingerprint — is the core idea of the project.

## 3.2 The shape of the system

The system has three parts that share exactly one thing — the trained model — across a clean line:

1. **The research harness** *makes* a finished, version-stamped model, reproducibly.
2. **The inference service** *serves* that model over a simple interface. It holds the model in memory, stores nothing, and logs no raw typing.
3. **The product** is the existing web app. It owns users and sessions, asks the service for a decision, and enforces it.

Keeping the part that *makes* the claim separate from the part that *serves* it means the live app never touches the research data, and the research never touches live users. I also fixed the failure behaviour up front: if anything breaks, the answer is "can't tell — ask for another factor", never "let them in" — a rule that later caught a real bug (§7).

## 3.3 The model: turning typing into 128 numbers

The model reads a short window of keystrokes — for each key, how long it was held and the gaps around it, plus which key it was — and boils the whole window down to a list of 128 numbers: the fingerprint. It does this in stages that each look for a different scale of pattern: short layers that catch the rhythm of adjacent key-pairs, a layer that reads the sequence in both directions to catch longer cadence, and a final step that decides which moments in the window matter most before producing the 128 numbers. It's a small model by modern standards — small enough to train on a laptop in minutes and to fingerprint a typing sample in about a thousandth of a second, comfortably fast enough for a real login. The exact architecture is in Appendix C.

## 3.4 Teaching it

Training is the "pull the matching pair together, push the odd one apart" process from §2.2, repeated over the training people for 60 passes through the data. I keep it fully deterministic — same starting seed, same result every time — so the numbers in this report can be regenerated exactly. A built-in test checks that, after training, same-person samples really do land closer than different-person ones, so I'd catch it immediately if training had collapsed into nonsense. The exact settings are in Appendix C.

## 3.5 Making the decision

Once the model is trained, a new user is *enrolled*, not retrained: I record about a dozen of their typing samples as dots and summarise them into a profile. To verify a new sample, I measure its distance from that profile using the three measures from §2.3, blended into a single score — lower means more likely genuine. If the smart distance can't be computed for some reason, it quietly falls back to the simple one, so a verification degrades rather than crashes. Each user gets their own threshold, set from how much their own enrolled samples vary, with a small safety floor so an extremely consistent typist can't drive it to zero (the cause of a real crash — §7). The same decision code runs in the research and in the live service, so the error rate I measured and the decision the product ships are the same arithmetic.

One quirk matters for reading the results: because the three distances are blended without reweighting, and the smart distance is numerically much larger than the other two, it dominates the blend. A later check (§4.4) shows it carries almost all of the advantage — which points to an easy future improvement rather than a flaw.

## 3.6 Testing it honestly

This is the part that decides whether the number means anything.

**Test on strangers, not on people it studied.** I split the 51 people into 35 for training and 16 held out. The model trains only on the 35, and its error rate is measured only on the 16 it has never seen. This is the honest test for authentication — it measures whether the system generalises to *new* people. Testing it on people it trained on would be like grading a student on an exam after giving them the questions in advance; it produces an impressive number that means nothing. A runtime check makes it impossible for a test person to leak into training.

**Real user versus impostor.** For each of the 16 test people, half their samples are used to enrol them and the other half to test. Their own test samples should be accepted; everyone else's should be rejected. If a person has too few samples to do this properly, the code raises an error rather than invent a number.

**Repeat, and don't tune on the test.** Because the split and training involve randomness, I ran everything three times (seeds 42, 43, 44) and report the average. And I never picked settings by trying them on the test people — that would secretly turn the test into practice. Instead I tuned on a slice carved from the *training* people and ran the winner once on the held-out 16 (§4.4, Appendix C).

## 3.7 Running it for real

To show the model is more than a benchmark number, I wired it into the product: a user consents, enrols by typing a few windows, and is then verified on a new one. The decision fails safe — if the service is unreachable or the model version doesn't match, the answer is "indeterminate" and the app asks for another factor. As an end-to-end check I enrolled a held-out person and verified genuine and impostor samples over the live connection: the genuine samples scored 3.10 on average and impostors 6.73 (lower is more genuine), so the deployed system ranks impostors as less genuine than the real user, matching the offline result. This is a single-person wiring check, not a performance result — the benchmark in §4 is the evidence of performance — but it also flushed out a real crash (§7).

# 4. Results

Everything below was trained on real data on a laptop (no special hardware), averaged over three runs, and can be regenerated from the exact dataset and settings (Appendix B). The full run took about 23 minutes and cost nothing.

## 4.1 The headline

Here is the error rate on the 16 held-out strangers, as an average of three runs (lower is better):

| Decision method | Error rate (EER) | Run-to-run spread | Compared with |
|----|----|----|----|
| Simple distance (the fair comparison) | **14.2%** | ± 2.8% | the published 9.6% |
| Full blended method | **10.2%** | ± 1.0% | — |
| 2009 benchmark (Killourhy & Maxion) | 9.6% | — | reference |

The headline sits *above* the benchmark: 14.2% against 9.6%. So on this small, fixed-password test, the learned model does not beat the 2009 hand-crafted method. Two things are worth drawing out anyway.

First, the blended method is both more accurate and much steadier than the simple one on the very same fingerprints — 10.2% versus 14.2%, and it barely moves from run to run (a spread of 1.0% against 2.8%). Three runs can't prove that steadiness, so I re-ran the whole test over 14 different random splits: the blended method won all 14 times, which is extremely unlikely to be luck (a standard statistical test gives roughly a 1-in-10,000 chance). §4.4 pins down *why*.

Second, those three runs happen to sit on the lucky side. Across all 14 splits the average error rates are higher — about 18.7% and 13.3% — so the real gap to 9.6% is a bit wider than the headline suggests. To be upfront about the uncertainty, a resampling test puts the plausible range for the 14.2% figure at roughly 9.5% to 19.2%: wide, because (as the next section shows) different people are wildly different to recognise.

## 4.2 Some people are far easier to recognise than others

The 16 test people vary enormously. The most distinctive typist has an error rate under 1%; the least distinctive is above 33% — a person the 11-key password simply can't pin down. That spread isn't random. For each person I compared how much their own typing wobbles against how far they sit from the nearest other typist, and this "how separable are you" measure tracks the error rate almost perfectly (a strong statistical correlation). The people the system struggles with are the ones whose typing is so inconsistent that it collides with other people's. So the limiting factor isn't really the model — it's how little identifying information there is in an 11-key password. A longer, richer typing sample (free text — §8) should help exactly these people.

## 4.3 A picture of the result

To see *why* it works, I squashed the 128-number fingerprints of the held-out people down to a 2-D picture (Figure B.2 in the appendix). Several people form tight, clearly separated clusters, even though the model never trained on them — visual confirmation that it maps a person's typing to a consistent region. A muddier zone in the middle lines up with the hard-to-recognise people from §4.2, so the picture and the numbers tell the same story.

## 4.4 Checking it isn't a fluke

I ran two checks. The first asks: did I just get lucky with my settings? To answer it without cheating on the test people, I tried changing one setting at a time — more samples per person, longer training, and so on — judging each only on a slice held out of the *training* people. Nothing helped. The one change that looked slightly better (longer training) turned out *worse* when I finally ran it on the real test, and less stable too, with one run sliding badly. That's what chasing noise looks like, so I kept the original settings — now backed by evidence rather than hope. A revealing detail fell out of this: the model's training "score" maxes out in every version, meaning it has already learned everything the 11-key password can teach it. More training can't squeeze out information that isn't there. That is the strongest argument for moving to free text.

The second check asks: which of the three distance measures is actually doing the work? I removed each one in turn. Dropping either of the two simple distances changed nothing at all; dropping the smart distance threw most of the advantage away. So the blended method's edge isn't the blending — it's that one smart distance, computed inside the learned space, and the other two are being numerically drowned out. The practical lesson is that rescaling the three before blending would let the other two contribute, and could push the result further. (Both experiments, with their exact numbers, are in Appendix C.)

# 5. What the results mean

## 5.1 Reading the result

The aim asked whether a computer can verify identity from typing rhythm, and how close it gets to 9.6%. The answer has three parts. It works — it recognises strangers well above chance, end to end through a live service. It doesn't beat the classical benchmark on this small fixed-password test: 14.2% against 9.6%. And the hybrid idea holds in a specific, measurable way — putting classical statistics on top of a learned fingerprint makes the decision both more accurate and far steadier, an effect that survived 14 independent splits and traces to one statistical ingredient (§4.4). A learned fingerprint makes a classical decision-maker more reliable while staying open to new users and not tied to one phrase — which is what a real product needs and the benchmark method is not.

All six objectives (§1.2) were met — the model runs on a laptop (O1), same-person samples cluster (O2), the error rate is measured only on strangers (O3), one run yields both error rates (O4), the pipeline regenerates exactly (O5), and the live service runs consent-to-verification and fails safe (O6).

## 5.2 How it compares

Against the two studies that bracket the field (§2.4), the result lands where you'd expect a small-data hybrid to land: above the 2009 method's 9.6% on its own fixed-text turf, and nowhere near TypeNet's 2.2%, which is bought with internet-scale data this project deliberately doesn't have. The comparison I could run myself was against a Transformer — the architecture behind most of today's large AI models. I built a comparable one and ran it through the identical test: it came out clearly worse and much less stable (an error rate of 19.8% against this model's 14.2%). On data this small, the simpler design's built-in assumptions about sequence and timing pull a steadier signal out than the more flexible Transformer can. The architecture choice holds up — for a concrete reason, not a guess.

## 5.3 Why it matters

**For account security.** Even a 10% error-rate biometric is useful as a *second* factor. Behind a password, it raises the bar for an attacker who only has stolen credentials, at no extra effort for the user; run continuously, it could catch a session hijack that a password-only system never sees.

**For research.** A small, fully reproducible data point on whether learned fingerprints help on small keystroke datasets — modest, but real, and the reproducible pipeline is worth something on its own in a field where reproducibility is often weak.

**For people who find passwords hard.** A silent check that needs no extra device *could* lower the barrier for people for whom passwords and security tokens are a burden. I flag this as a hope, not a finding — I've run no study on it, and as §6 explains, the same technology can fail some people more often than others, which cuts the other way.

## 5.4 The limits

The conclusions only hold within their bounds: one small public dataset, one 11-key password, a small model trained on a laptop, and fixed text only — the free-text claim is designed for but not yet measured on a real corpus. The per-user threshold ranks people correctly but isn't yet calibrated, so the product's confidence *percentage* isn't yet meaningful even though the accept/reject ordering is (§7, problem 9). The checks in §4.4 sharpen these limits rather than softening them: because no extra training or data helped, the 11-key password — not the model, not the hardware — is the ceiling. That's why free text (§8) is the highest-value next step.

# 6. Ethics and responsible use

Biometric authentication is ethically serious for one reason: it works. Anything that can recognise people by their behaviour can also watch them. Several choices here were made to stay on the right side of that line.

**Typing data is legally "special".** Under UK/EU data-protection law (GDPR), biometric data used to identify a person is *special-category* data — the most protected class — and the law explicitly counts behavioural traits. So the moment this system identifies someone, it's handling the most sensitive kind of personal data, and that shaped everything below.

**I used public, anonymised data — not new identifiable data.** The headline result is measured entirely on the 2009 benchmark, whose subjects are anonymous and consented to research use. I deliberately did *not* train the reported model on real product users, which would have created fresh, identifiable behavioural data with all the duties that brings.

**Consent is explicit and revocable.** In the product, a user has to opt in before any typing is captured, and opting out deletes their profile. Consent is a stored, timestamped record — data-minimisation built into the product, not written on a policy page.

**Store the fingerprint, not the typing.** The service keeps no raw timings. The product stores only the derived profile and a log of decisions (score, version, risk) — never a record of what someone actually typed. A stolen profile is far less sensitive than a recording of everything a person wrote.

**Fail safe, never fail open.** Any outage or version mismatch returns "indeterminate" and forces another factor. It never defaults to "allow" — an ethical choice as much as an engineering one.

**Unequal error rates are a fairness problem.** My own results carry one I have to name. The error rate ran from under 1% for the most distinctive typist to over 33% for the least — a roughly 37-fold difference in how often the system fails a person, on the same model and password. A biometric whose error rate isn't uniform across people is a textbook fairness risk: the people it serves worst would be wrongly rejected far more often than the 14.2% average suggests, and that average hides it completely. This is the concrete reason the system must never be the *only* check, and why a real deployment needs a per-person error audit, not just an average. Usefully, the people it fails most are identifiable in advance (they're the least consistent typists — §4.2), so a fair deployment can spot them and lean on a fallback rather than quietly failing them more often.

**Dual use, and risk.** The same technology that protects an account could, in the wrong hands, track or de-anonymise people by their typing — so I frame it as opt-in protection the user controls, and never sell a 10% error-rate system as infallible. The project has no physical hazards; its risks are informational — data leakage, wrongly rejecting genuine users, the unequal error rates above, and over-claiming — each mitigated as described.

# 7. What went wrong, and how I fixed it

Most of the work that shaped the numbers was debugging, and the useful bugs weren't the ones a test caught — they were the ones I caught by asking whether a *passing* test actually proved what it claimed. I kept a running log of thirteen; here are four, plus the two most important told in full below.

| Problem | Why it happened | Fix | How I checked |
|---|---|---|---|
| The live service could verify nobody — nothing built a user profile | The enrolment-to-profile step was missing | Wrote the profile builder | 5 new tests pass |
| The real data file's columns didn't match the code, so it trained on all-zero timings | The real file names columns differently from the test fixture | Added a column remap and a sanity assertion | Timings now non-zero |
| The system could report a perfect 0% error on an empty test set | No guard against an empty test | The code now refuses and raises | Guard test |
| Loading the model could run hidden code from a swapped file | An unsafe default in the load function | Load in safe mode with a size check | Round-trip test |

**The flawed test (the big one).** My first version trained the model on all 51 people and then measured its error rate per person — so the model had already met everyone it was being tested on. That's the "exam questions in advance" mistake from §3.6, and it produced a beautiful, meaningless number. The fix was the strict 35/16 split, training on 35 and grading only on the 16 held-out strangers, with a runtime check that no test person can leak into training. It's the single change that changed the meaning of every number here — and it pushed the error rate from an implausibly low figure up to an honest 14.2%.

**A crash only the real system revealed.** The live verification endpoint crashed for one very consistent typist, and no test had caught it. Someone who types a fixed password almost identically every time produces near-identical fingerprints, which drove their personal threshold to nearly zero and made a later calculation blow up. I clamped the calculation and put a floor under the threshold. The reason no test caught it: my test data was artificially varied, so it never produced a "too consistent" user — only a real person did. It's the clearest example in the project of why running the real thing beats trusting the tests. (The full log of thirteen problems is in the project repository.)

# 8. Conclusion and next steps

I set out to measure, honestly and reproducibly, whether a computer can verify a person from their typing rhythm on a standard benchmark, and how close it gets to the published 9.6%. On 16 people the model had never seen, it reached 14.2% on the comparable measure and 10.2% with the blended method — the blended one both closer to the benchmark and far steadier, an effect that survived 14 independent tests and traces to one statistical ingredient. The headline comparison is a near-miss: on small, fixed-text data, the learned model doesn't beat the 2009 method. What the project does deliver is a fair, reproducible test of a hybrid design — classical statistics running inside a learned fingerprint — with its limits measured rather than hidden: the short password is the ceiling, some people are 37 times harder to recognise than others, and the advantage comes from one specific ingredient, not the blend I first assumed.

The next steps follow straight from where the ceiling is:

1. **Free text on a large real dataset.** The 11-key password is the limit, and the checks in §4.4 proved it. The free-text pipeline is built and correct; a real result needs a large public corpus (the 136-million-keystroke Aalto dataset). This is the clear next experiment.
2. **Calibrate the confidence scale** so the product's percentage means something, not just the ordering.
3. **Train at scale** on proper hardware, following TypeNet, to see whether the hybrid's advantage holds as accuracy climbs.
4. **Collect a small, consented dataset of real users** to test whether it generalises across datasets, with the §6 safeguards built in from the start.

# 9. Reflection

The project turned a corner the moment I stopped believing my own first result. My first test gave an error rate I was thrilled with — until I read back through my code and realised the model had already seen, in training, the exact people I was testing it on. I hadn't cheated on purpose; the code had quietly handed me a flattering number and I'd been happy to take it. Learning to treat a good result as something to *attack* — to ask "what would make this wrong?" before celebrating — is the habit I'll keep longer than any technique. Redoing it properly cost me a nicer-looking number, and it's the decision I'm most sure was right. It also taught me why biometrics are judged on error-rate curves rather than plain "accuracy": when you can fail in two opposite ways, one number hides the trade-off that matters.

Working with no mentor cut both ways. Every check on my work was one I ran on myself, which is probably why I eventually caught the flawed test — I'd trained myself to distrust my own results. But it's also where working alone hurt: there was nobody to glance over and say "hang on, aren't those your training people?" I made the mistake and was the only person who could catch it, and for a while I just didn't.

If I did it again I'd change two things. First, I'd write the whole test procedure down *before* writing any of the code for it — the flaw survived because the procedure only lived in my head, where it was easy to talk myself into a number I liked; on paper the leak would have been obvious. Second, I'd find a mentor or even one peer reviewer early. Saying a result out loud to someone allowed to doubt you catches what re-reading your own code never will.

# 10. Acknowledgements

This was an independent project with no mentor or supervisor, so the "people" side came from the wider research community: Killourhy and Maxion for the dataset and the benchmark to measure against; the teams behind FaceNet and TypeNet, whose methods I built on; Ledoit and Wolf for the statistical technique at the heart of the result; and the maintainers of the open-source tools I relied on (PyTorch, NumPy, scikit-learn, FastAPI and others). I read the international biometric-testing standard and the UK regulator's data-protection guidance to get the testing and the ethics right. AI assistance is disclosed in full in §11; every scientific decision, every result, and the final wording are my own.

# 11. AI use statement

**Tool.** Anthropic's Claude (Claude Opus 4.8), through the Claude Code command-line assistant, on a Windows laptop, during development and while writing this report.

**What I used it for.** *Code scaffolding and debugging:* first drafts of some functions and help diagnosing bugs — all of which I reviewed, ran and tested; it produced no number in this report. *Finding references:* surfacing key papers, which I checked against the original sources and dropped if I couldn't verify them. *Drafting:* organising the report and producing draft prose, which I edited into my own voice, fact-checked, and finished with the personal parts only I can write. I set the research direction, made every scientific decision, ran and tested all the code, and verified every result.

# 12. References

Author–date style; URLs given for openly accessible sources. Fuller provenance, including items I checked and rejected, is in `CREST_Research_Dossier.md`.

1. Killourhy, K. S. & Maxion, R. A. (2009). *Comparing Anomaly-Detection Algorithms for Keystroke Dynamics.* Proc. IEEE/IFIP Int. Conf. on Dependable Systems and Networks (DSN-2009), pp. 125–134. Dataset: <https://www.cs.cmu.edu/~keystroke/>
2. Acien, A., Morales, A., Monaco, J. V., Vera-Rodriguez, R. & Fierrez, J. (2021). *TypeNet: Deep Learning Keystroke Biometrics.* IEEE Trans. Biometrics, Behavior, and Identity Science. arXiv:2101.05570.
3. Schroff, F., Kalenichenko, D. & Philbin, J. (2015). *FaceNet: A Unified Embedding for Face Recognition and Clustering.* CVPR 2015, pp. 815–823. DOI 10.1109/CVPR.2015.7298682. arXiv:1503.03832.
4. Hermans, A., Beyer, L. & Leibe, B. (2017). *In Defense of the Triplet Loss for Person Re-Identification.* arXiv:1703.07737.
5. Wen, Y., Zhang, K., Li, Z. & Qiao, Y. (2016). *A Discriminative Feature Learning Approach for Deep Face Recognition (center loss).* ECCV 2016, LNCS 9911, pp. 499–515. DOI 10.1007/978-3-319-46478-7_31.
6. Ledoit, O. & Wolf, M. (2004). *A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices.* J. Multivariate Analysis 88(2), 365–411. DOI 10.1016/S0047-259X(03)00096-4.
7. Dhakal, V., Feit, A. M., Kristensson, P. O. & Oulasvirta, A. (2018). *Observations on Typing from 136 Million Keystrokes (Aalto dataset).* CHI 2018. DOI 10.1145/3173574.3174220. Data: <https://userinterfaces.aalto.fi/136Mkeystrokes/>
8. ISO/IEC 19795-1. *Information technology — Biometric performance testing and reporting — Part 1.* <https://www.iso.org/standard/73515.html>
9. *Keystroke Dynamics: Concepts, Techniques, and Applications.* ACM Computing Surveys (2024/25). DOI 10.1145/3733103.
10. Frank, M., Biedert, R., Ma, E., Martinovic, I. & Song, D. (2013). *Touchalytics: On the Applicability of Touchscreen Input as a Behavioral Biometric for Continuous Authentication.* IEEE Trans. Information Forensics and Security 8(1). arXiv:1207.6231.
11. UK GDPR, Article 9 (special-category data) and Article 4(14) (definition of biometric data). <https://gdpr-info.eu/art-9-gdpr/> ; UK ICO guidance on biometric data.
12. Verizon (2024). *2024 Data Breach Investigations Report (DBIR).* <https://www.verizon.com/business/resources/reports/dbir/>
13. Cho, K. et al. (2014). *Learning Phrase Representations using RNN Encoder–Decoder (GRU).* EMNLP 2014. arXiv:1406.1078.
14. Bahdanau, D., Cho, K. & Bengio, Y. (2015). *Neural Machine Translation by Jointly Learning to Align and Translate (attention).* ICLR 2015. arXiv:1409.0473.
15. van der Maaten, L. & Hinton, G. (2008). *Visualizing Data using t-SNE.* Journal of Machine Learning Research 9, 2579–2605.
16. Kingma, D. P. & Ba, J. (2015). *Adam: A Method for Stochastic Optimization.* ICLR 2015. arXiv:1412.6980.

# 13. Appendices

## Appendix A — Glossary

- **Biometric** — recognising a person from a physical or behavioural trait. Typing rhythm is a *behavioural* biometric.
- **Fingerprint / embedding** — here, the list of 128 numbers the model produces for one typing sample. Same-person fingerprints land close together.
- **EER (Equal Error Rate)** — the balanced setting where "letting an impostor in" and "locking the real user out" are equally likely. Lower is better; 10% ≈ wrong one time in ten.
- **Open-set test** — tested only on people not seen during training (the honest test for authentication).
- **Triplet loss** — the training method: pull same-person samples together, push different-person ones apart.
- **Mahalanobis distance / Ledoit–Wolf** — a distance measure that accounts for how much a person's own typing naturally varies, made stable when there are few enrolment samples.
- **The benchmark / CMU dataset** — Killourhy & Maxion's 2009 keystroke dataset: 51 people, password `.tie5Roanl`, best published EER 9.6%.

## Appendix B — Full results, figures and provenance

Per-subject error rate (simple distance, run with seed 42), 16 held-out people, most to least distinctive:

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

The average of these is 0.1421, matching the headline seed-42 figure (a consistency check). The spread from 0.9% to 33.5% is the §4.2 finding. Aggregate over the three runs (seeds 42/43/44): simple distance 0.1422 ± 0.0279; full blend 0.1016 ± 0.0097; benchmark 0.0962.

**Provenance fingerprints (for independent verification).** So the result can be checked without the repository:

- Dataset (`DSL-StrongPasswordData.csv`) SHA-256: `b11d23538b1865fa6ecf4e8b78567caa312e9c1027604bb022fcc6ad7eaa7a33`
- Git commit of the recorded run: `13fafe8f039d969fd77734b67d2457d37c59f918`
- Seeds 42 / 43 / 44 · 128-number fingerprint · 60 training passes · laptop CPU · ~23 min total
- Environment: Python 3.12, PyTorch 2.12 (CPU)

**Figure B.1 — the error trade-off (DET curve).**

![DET curve for the simple-distance scorer on the 16 held-out people.](research/artifacts/det_curve.png){width=3.4in}

*The trade-off between locking out genuine users and letting in impostors, across every setting, for the simple-distance method on the 16 held-out people. The balanced (equal-error) point is at 14.2%; the 9.6% benchmark is marked for reference.*

**Figure B.2 — the fingerprints, as a picture (t-SNE).**

![The 16 held-out people's 128-number fingerprints squashed to two dimensions, coloured by person.](research/artifacts/tsne.png){width=3.7in}

*Each person's 128-number fingerprints, squashed to a 2-D picture and coloured by person. Several people form tight, well-separated clusters even though the model never trained on them; the muddier middle matches the hard-to-recognise people of §4.2.*

## Appendix C — Technical specification

*For readers who want the exact design and settings. None of this is needed to follow the report.*

**Feature representation.** Each keystroke is four timing features (hold, down–down, flight, up–up) measured relative to the window's first keystroke, plus a 16-dimensional learned character embedding — a 20-D per-keystroke vector. The same featurisation runs in training and serving.

**Encoder (`KeystrokeEncoder`, 83,505 parameters, 0.32 MB float32).** Input fusion (20-D) → two `Conv1d` layers (20→64→64, kernel 3) → bidirectional GRU (64 units each way → 128; Cho et al., 2014) → single-head additive attention over the valid time steps with a length mask (Bahdanau et al., 2015) → linear projection to 128-D → L2-normalisation onto the unit sphere. One window embeds in ≈ 0.8 ms (mean of 200 runs, batch of one).

**Training.** Batch-hard triplet loss (margin 0.2; Hermans et al., 2017) + center loss (weight 0.01; Wen et al., 2016), Adam (Kingma & Ba, 2015) at learning rate 1e-3, 60 epochs, batches of 16 subjects × 2 windows = 32, squared-Euclidean distance on the L2-normalised embeddings. Deterministic (global seed, single-process loader): the same seed reproduces the same weights bit-for-bit on CPU.

**Verification ensemble.** Enrolment stores the centroid, the enrolment embeddings (for k-NN, k = 3), and the Ledoit–Wolf inverse-covariance matrix. Score = unweighted mean of (i) per-dimension L1 distance to the centroid, (ii) mean L1 distance to the 3 nearest enrolment embeddings, (iii) Ledoit–Wolf Mahalanobis distance. Singular covariance falls back to the centroid distance. Per-user threshold = 90th percentile of leave-one-out genuine distances × 1.15, floored at a small positive value.

**Evaluation.** Open-set 35/16 subject split (seeded); per test subject, an enrolment half and a test half; genuine vs. all other test subjects' windows as impostors; empty-test guard. Two scorers reported (scaled-Manhattan headline; full ensemble secondary), never cross-compared. Seeds 42/43/44 for the headline; 14 seeds for the ensemble-vs-primary comparison (Wilcoxon signed-rank *p* ≈ 0.0001, 14/14 wins). Subject-level bootstrap (20,000 draws) gives a 95% CI of [9.5%, 19.2%] on the seed-42 14.2%. Separability (nearest-impostor distance ÷ within-subject scatter) vs. per-subject EER: Spearman ρ = −0.84, *p* = 0.0001.

**Hyperparameter selection (nested validation).** Test 16 held out; inside the 35, a 24-inner-train / 11-validation split; one setting changed at a time, judged only on the 11:

| Change from original | Validation EER (primary / ensemble) |
|----|----|
| Original (60 epochs, margin 0.2, centre 0.01, 2 windows/subj) | 0.1933 / 0.1678 |
| more windows/subj (2→4) | 0.2572 / 0.1731 |
| more windows/subj (2→8) | 0.1975 / 0.2023 |
| longer training (60→120 epochs) | 0.1904 / 0.1684 |
| wider margin (0.2→0.3) | 0.1933 / 0.1678 |
| stronger centre-loss (0.01→0.05) | 0.2054 / 0.1725 |

The validation "winner" (120 epochs) scored 0.1610 ± 0.0866 / 0.1128 ± 0.0378 on the real test — worse and less stable than the original's 0.1422 ± 0.0279 / 0.1016 ± 0.0097, with one seed at 0.284. Training loss saturates at the margin in every row, so the bottleneck is the information in an 11-key password, not optimisation.

**Component ablation (which distance carries the ensemble).** Mean over 3 seeds: full 0.1016; drop centroid-L1 0.1016; drop k-NN 0.1016; drop Mahalanobis 0.1330. Across 14 seeds: full 0.1326; drop Mahalanobis 0.1783; drop either other term 0.1326. The Ledoit–Wolf Mahalanobis term carries essentially all of the ensemble's advantage; the other two are numerically swamped by its larger scale.

**Transformer comparison.** A comparable Transformer encoder (2 layers, 4 heads, 77,296 parameters — slightly *smaller* than the CNN+BiGRU) run through the identical protocol over the same 3 seeds: primary EER 19.8% ± 5.4%, ensemble 12.3% ± 4.9%, against this model's 14.2% ± 2.8% and 10.2% ± 1.0%. Both models' loss saturates at the margin, so both are data-limited; the convolution/recurrence priors extract a steadier signal from small data than self-attention.
