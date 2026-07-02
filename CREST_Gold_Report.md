# Can You Be Recognised by the Way You Type?

### Verifying who someone is from their typing rhythm alone

|  |  |
|----|----|
| Author | Devadit Jain |
| Field | Machine learning · behavioural biometrics · online security |
| Type | Research and build |
| Dates | 25 November 2025 – 10 June 2026 |

## In brief

Someone got into an account I cared about with a stolen password, and the login never blinked — the password was right, so as far as the system knew, the thief was me. This project asks whether the *way* a person types, their rhythm, could be a quiet second check that a stolen password can't fake. I built a system that turns a burst of typing into a kind of numerical fingerprint and decides whether a new burst matches. Tested on 51 people typing the same password, and judged only on people it had never seen before, it got about one decision in ten wrong — good, but not quite good enough to beat the best method from a well-known 2009 study. This is the story of building it, the mistake that nearly handed me a much prettier and completely fake result, and what an honest near-miss is actually worth.

*(You can follow all of this without any background in code or AI. Where an idea gets technical, I explain it with an everyday comparison first; the exact designs and numbers live in Appendix C, and skipping it costs you none of the story.)*

## Contents

1. A password that defended nothing
2. You type like nobody else
3. Building a typing fingerprint
4. The number that was too good to be true
5. What I actually found
6. What it means — and what it doesn't
7. The ethics of a system that recognises you
8. What I got wrong, and what I'd change
9. Acknowledgements · AI use · References · Appendices

------------------------------------------------------------------------

## 1. A password that defended nothing

Someone got into an account I cared about with a stolen password. The login never blinked — why would it? The password was correct, so as far as the system was concerned, the person typing it *was* me. That's the quiet flaw under every password ever made: it checks what you *know*, not who you *are*. Steal the secret and you inherit the identity.

This isn't a rare problem. Verizon's 2024 security report found stolen passwords behind about 88% of attacks on web apps, most of them automated — attackers take millions of leaked passwords from one site and fire them at the login pages of every other site, betting that people reuse them. They're usually right. Two-factor codes help, but they nag you at every login, and anything that nags gets switched off.

So I asked a different question. What if the second check didn't ask you to *do* anything — what if it just watched *how* you already type? Your typing has a rhythm. The tiny pauses, the way you hold some keys longer than others, the little stumble before a capital — it's as personal as an accent, and it comes from motor habits you can't really fake on purpose. The idea's old: telegraph operators a century ago could recognise each other by the rhythm of their tapping. What's new is that computers have only recently got good enough to do it from *anything* you type, not just one memorised phrase.

That's the whole project in a sentence:

> **Can a computer tell it's really you from your typing rhythm alone — and how close can it get to the best published result?**

To stop myself fooling myself later, I pinned that down to things I could actually check:

- Build a network that turns a burst of typing into a fixed-size numerical fingerprint, running on an ordinary laptop.
- Train it so the same person's samples land close together and different people land far apart.
- Test it *honestly* — only on people it has never seen — with the code refusing to grade itself on anyone it studied.
- Add a classical statistical decision-maker on top, so I can compare a simple method against an elaborate one from the same run.
- Make the whole thing reproducible from one command, and show it running live and failing safely.

**How the project ran.** It went in four dated stages, each having to work before the next began (roughly 84 hours in total, tracked in the commit history):

| When | Stage | What happened |
|----|----|----|
| Nov–Dec 2025 | Typing app + keystroke capture | Built; became the source of real typing data |
| Feb–Mar 2026 | Accounts + first simple recognisers | First typing checks; a clean split between research and product |
| Jun 2026 | The deep-learning research | Rebuilt the recogniser as a learned model; tested it on strangers |
| Jun 2026 | Write-up | This report, the ethics, the reproducibility check |

One plan changed mid-project, and it changed everything: I found my honesty test was broken and had to rebuild it (§4).

## 2. You type like nobody else

Recognising someone by their typing is a *behavioural* biometric — it's about how you act, like a signature or a walk, not what your body is, like a fingerprint or an iris. The raw signal is just timing: how long each key is held, and the gaps between one key and the next. Boring on its own. Surprisingly personal in bulk.

There's an easy version of the problem and a hard one. Easy: everyone types the *same* phrase, so you can line up matching keystrokes and compare. Hard: the person types *anything*, so you have to read the rhythm without leaning on the words. Real, always-on security needs the hard version. I worked on the easy one — the version with a clean, public benchmark to measure against — while building the machinery the hard version would need later.

Now, how do you even score a thing like this? Any such system makes two opposite mistakes: it can let an impostor in, or lock the real person out. They trade off — tighten it to catch more impostors and you start bouncing genuine users; loosen it and impostors slip through. Because you can slide that dial anywhere, a single "accuracy" figure would be meaningless. The fair summary is the **equal error rate**: the setting where both mistakes are equally likely. Lower is better. A 10% equal error rate means that, at the balanced dial setting, show it ten impostors and about one gets in — while about one genuine user in ten gets wrongly turned away. That one number is how biometrics are compared, and it's the number I chased.

Two studies set the goalposts. Back in 2009, Killourhy and Maxion built the exact dataset I use — 51 people each typing the password `.tie5Roanl` 400 times — and tested 14 hand-built methods. Their best scored 9.6%. That's the bar. At the other extreme, a 2021 system called TypeNet learned from 136 million keystrokes across roughly 168,000 people and hit 2.2% — proof that this works brilliantly *if* you have internet-scale data. Nobody had asked the question in between: on the small public benchmark, does a *learned* fingerprint beat the old hand-built method, tested fairly on strangers? That gap is where a student with a laptop can actually contribute.

## 3. Building a typing fingerprint

There were three honestly different ways to build this, and I weighed them before picking:

- **Pure statistics** — compare each new sample against a hand-built statistical profile of the user. Simple, well-understood, and the 2009 benchmark itself — but tied to one fixed phrase, and a human has to decide which features matter.
- **A standard classifier** — train a network to sort typing into "user 1, user 2, …". Accurate, but you'd have to retrain it from scratch every single time someone new signs up. Useless for a real product.
- **A learned fingerprint** *(what I chose)* — train the network to *place* each sample in space, so a new user just adds a few of their own dots. No retraining, not tied to one phrase.

I chose the third and bolted the first on top of it: run the old, trusted statistics *inside* the learned space. That hybrid — classical statistics on a learned fingerprint — is the core idea of the whole project.

Here's the fingerprint idea in plain terms. Picture an enormous space where every burst of typing becomes a single dot. Train the network well, and the same person's dots land in a tight little cluster, while different people's clusters sit far apart. Now recognising someone is just a question of distance: is this new dot inside your cluster, or nearer someone else's? My network boils each burst of typing down to a list of 128 numbers — that's the dot's position. The training is the same trick face recognition uses: I show it two samples from the same person and one from someone else, over and over, and nudge it to pull the matching pair together and push the odd one away. Do that hundreds of thousands of times and the clustering just… emerges. (The exact network and settings are in Appendix C. It's small — it trains on a laptop in about 23 minutes, for nothing, and fingerprints a sample in under a thousandth of a second.)

Deciding "is this really you?" then comes down to measuring how far a new dot sits from your enrolled cluster. I use three different distance measures and blend them: a plain distance to the centre of your cluster, a distance to your nearest few enrolled samples, and a smarter one that accounts for how much your own typing naturally wobbles. To *enrol* a new person I just record about a dozen of their dots — no retraining — and set them a personal threshold based on how consistent they are.

Finally, I wired it into a real app: you consent, type a few times to enrol, and get verified on a new sample. If anything breaks — the service is down, the model's the wrong version — it answers "can't tell, ask for another factor", never "let them in". As a quick live check I enrolled one held-out person and ran genuine and impostor samples through it: genuine samples scored 3.10 on average, impostors 6.73 (lower means more genuine). So the deployed thing really does rank impostors below the real user. It also, satisfyingly, crashed the first time — more on that next.

## 4. The number that was too good to be true

My first proper result was fantastic. I remember being genuinely pleased with it. Then I read back through my own code and my stomach dropped: the network had trained on *all* 51 people — including the exact ones I was then testing it on. I'd been grading it on people it had already studied.

It's the oldest mistake in machine learning, and it feels exactly like this: giving a student the exam questions the night before, then being impressed when they ace the exam. The number wasn't a lie I told on purpose. The code had quietly handed me a flattering result and I'd been happy to pocket it. That's the moment the project actually became science — the moment I started treating a good result as something to *attack* rather than celebrate.

The fix set the rule for everything after it. Split the 51 people: 35 to train on, 16 locked away. The network only ever sees the 35. It's judged only on the 16 strangers — with a runtime check that makes it *impossible* for a test person to leak into training. That's the honest test for authentication, because the only thing that matters is whether it recognises people it's never met. It also cost me my pretty number: the honest error rate came out far higher than the fake one. Worth every point.

Most of the real work was debugging like this — and the useful bugs were never the ones a test caught, but the ones I caught by asking whether a *passing* test actually proved what it claimed. Two stand out. The live service crashed for one unusually consistent typist, because typing the same password almost identically every time drove their personal threshold to nearly zero and blew up a later calculation — something none of my test data, which was artificially varied, could ever have triggered. Only a real person did. And on day one the real data file trained on all-zero timings, because its columns were named differently from my test fixture and my code read straight past them, printing a believable number the whole time. (The full log of thirteen fixes is in the project repository.)

## 5. What I actually found

Here's the headline, measured on the 16 strangers, averaged over three runs. Lower is better.

| Decision method | Error rate | Compared with |
|----|----|----|
| Simple distance (the fair comparison) | **14.2%** | the 2009 benchmark's 9.6% |
| Full blended method | **10.2%** | — |

Read plainly: it works — it recognises strangers far better than a coin flip, live, end to end. But on this small, fixed-password test it does *not* beat the 2009 hand-built method. 14.2% against 9.6%. An honest near-miss, not a win.

Two things make the near-miss interesting. First, the blended method (10.2%) isn't just more accurate than the simple one (14.2%) — it's far *steadier*, barely moving between runs. I re-ran the whole test over 14 different random splits and the blended method won every single time, which is almost impossible by luck. Digging in, that steadiness comes from one of the three distance measures (the "smarter" one) doing nearly all the work — a specific finding, not hand-waving, and it points to an easy future improvement. Second, I'll be straight about the uncertainty: those headline runs sit on the lucky side. Across all 14 splits the averages are higher (about 18.7% and 13.3%), so the real gap to 9.6% is a bit wider than the headline flatters.

The most striking result isn't the average at all — it's how wildly people differ. The easiest person to recognise had an error rate under 1%. The hardest was over 33%. Same model, same password, and one person is *thirty-seven times* harder to pin down than another. It isn't random: the people the system struggles with are the ones whose own typing is so inconsistent that it collides with everyone else's. Which tells you the real ceiling here isn't the model — it's how little identifying information there is in an 11-key password.

You can even see it. I squashed the 128-number fingerprints down to a 2-D picture (Figure B.2): several people form tight, clearly separate clusters even though the model never trained on them, while a muddy patch in the middle is exactly the hard-to-recognise crowd. The picture and the numbers agree. And when I tried to do better — more training, more samples per person — nothing helped, and the model's internal score showed it had already learned everything the short password *can* teach. More effort can't extract information that isn't there. (The experiments behind all of this are in Appendix C.)

## 6. What it means — and what it doesn't

So, does typing rhythm prove who you are? Sort of, and honestly so. It works well enough to be a useful *second* check behind a password — an attacker with your stolen password still has to type like you, at zero extra effort for you, and run continuously it could even notice if the person mid-session is suddenly someone else. It does not beat a good hand-built method on tiny, fixed-text data. And the genuinely useful finding is narrower and more interesting than "my model is great": putting classical statistics on top of a learned fingerprint makes the decision *more stable*, and I can point to exactly which ingredient does it.

For perspective: my 14.2% sits above the 2009 method's 9.6% on its home turf, and nowhere near TypeNet's 2.2% — but that 2.2% is bought with internet-scale data I simply don't have. I also pitted my design against a Transformer, the architecture behind most of today's famous AI models, on identical terms; it did clearly worse and less reliably (19.8%). On data this small, my simpler design's built-in assumptions about timing and sequence beat the fancier model's flexibility. That's a concrete reason to have chosen it, not a guess.

The limits are real and I'd rather state them than have an assessor find them. One small dataset. One 11-key password. A small model on a laptop. Fixed text only — the free-typing version is built but not yet measured on a big corpus. And the confidence *percentage* the product shows isn't calibrated yet, even though the accept-or-reject ordering is sound. None of that makes the result wrong; all of it is a reason not to oversell it.

## 7. The ethics of a system that recognises you

Anything that can recognise people by their behaviour can also *watch* them, so I treated the ethics as part of the build, not a footnote.

- **Typing data is legally the most protected kind.** Under GDPR, biometric data used to identify someone is "special category" data, and the law explicitly counts behavioural traits. The moment this thing identifies you, it's handling your most sensitive data — which shaped every choice below.
- **I used public, anonymous data — not new identifiable data.** The headline result is measured entirely on the 2009 benchmark, whose subjects are anonymous and consented to research. I deliberately did *not* train the reported model on real users of my product.
- **Consent is opt-in and revocable, and I store the fingerprint, not the typing.** Opting out deletes your profile. The service keeps no record of what you actually typed — only the derived fingerprint and a log of decisions. A stolen fingerprint is far less damaging than a recording of everything you wrote.
- **It fails safe, never open.** Any breakage forces another factor. It never defaults to "let them in".
- **It fails some people more than others — and that's a fairness problem.** My own 37-fold spread in error rate (§5) is a textbook disparate-impact risk: the people it serves worst would be wrongly rejected far more often than the 14.2% average admits, and the average hides it completely. That's the concrete reason this must never be the *only* check, and why a real deployment needs a per-person error audit, not just an average. Usefully, those people are identifiable in advance (they're the least consistent typists), so a fair system can spot them and lean on a fallback instead of quietly failing them.
- **Same tech, wrong hands.** What protects an account could also track or de-anonymise people by their typing. I frame it as opt-in protection the user controls, report the error rates rather than bury them, and would never sell a 10%-error system as infallible.

## 8. What I got wrong, and what I'd change

The single most important thing I learned wasn't a technique — it was to distrust my own results. My first evaluation handed me a number I loved, and it was garbage (§4). Catching that meant training myself to ask "what would make this *wrong*?" before celebrating, and it's the habit I'll keep long after I've forgotten the maths. It also taught me why biometrics live and die on error-rate curves rather than plain accuracy: when you can fail in two opposite ways, one cheerful number hides the trade-off that actually matters.

Working with no mentor cut both ways. Every check on my work was one I ran on myself, which is probably why I eventually caught the flaw — I'd learned to doubt my own code. But it's also exactly where working alone hurt: there was nobody to glance over my shoulder and say "hang on, aren't those your training people?" I made the mistake, and for a while I was the only person who could have caught it, and I didn't. So if I did it again, I'd write the whole test procedure down *before* writing a line of the code for it — on paper, the leak would have been obvious — and I'd find one person allowed to doubt me, early. Saying a result out loud to someone catches what re-reading your own code never will.

Where I'd take it next follows straight from the ceiling being the *data*, not the model:

- **Free typing on a big real dataset** (the 136-million-keystroke Aalto corpus). The pipeline's built; it just needs the data. This is the obvious next experiment.
- **Fix the confidence scale** so the percentage the product shows actually means something.
- **Train at scale** on proper hardware, TypeNet-style, to see if the hybrid's advantage survives as accuracy climbs.
- **Collect a small, consented set of real users** to test whether it holds up across datasets — with the §7 safeguards built in from the first line.

I set out to find, honestly, whether the way a person types could be a quiet second lock on their identity. It can — not a perfect one, and not yet better than a 15-year-old benchmark on this small a test, but a real, measured, reproducible one, built by someone who learned the hard way to stop trusting his own good news.

------------------------------------------------------------------------

## Acknowledgements

This was an independent project with no mentor, so the "people" who helped were the research community: Killourhy and Maxion for the dataset and the benchmark to beat; the teams behind FaceNet and TypeNet, whose methods I built on; Ledoit and Wolf for the statistical trick at the heart of the result; and the maintainers of the open-source tools I used (PyTorch, NumPy, scikit-learn, FastAPI). I leaned on the international biometric-testing standard and the UK regulator's data-protection guidance to get the testing and the ethics right. AI assistance is disclosed just below.

## A note on AI use

I used Anthropic's Claude (via the Claude Code assistant) for first drafts of some functions, help hunting bugs, surfacing papers I then checked against the originals, and drafting and tightening this report, which I edited into my own voice. It produced no number in this report. I set the direction, made every scientific decision, ran and tested all the code, and verified every result myself.

## References

1. Killourhy, K. S. & Maxion, R. A. (2009). *Comparing Anomaly-Detection Algorithms for Keystroke Dynamics.* DSN-2009, pp. 125–134. Dataset: <https://www.cs.cmu.edu/~keystroke/>
2. Acien, A., Morales, A., Monaco, J. V., Vera-Rodriguez, R. & Fierrez, J. (2021). *TypeNet: Deep Learning Keystroke Biometrics.* IEEE T-BIOM. arXiv:2101.05570.
3. Schroff, F., Kalenichenko, D. & Philbin, J. (2015). *FaceNet: A Unified Embedding for Face Recognition and Clustering.* CVPR 2015. arXiv:1503.03832.
4. Hermans, A., Beyer, L. & Leibe, B. (2017). *In Defense of the Triplet Loss for Person Re-Identification.* arXiv:1703.07737.
5. Wen, Y., Zhang, K., Li, Z. & Qiao, Y. (2016). *A Discriminative Feature Learning Approach for Deep Face Recognition (center loss).* ECCV 2016.
6. Ledoit, O. & Wolf, M. (2004). *A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices.* J. Multivariate Analysis 88(2), 365–411.
7. Dhakal, V., Feit, A. M., Kristensson, P. O. & Oulasvirta, A. (2018). *Observations on Typing from 136 Million Keystrokes (Aalto dataset).* CHI 2018. Data: <https://userinterfaces.aalto.fi/136Mkeystrokes/>
8. ISO/IEC 19795-1. *Biometric performance testing and reporting — Part 1.* <https://www.iso.org/standard/73515.html>
9. *Keystroke Dynamics: Concepts, Techniques, and Applications.* ACM Computing Surveys (2024/25). DOI 10.1145/3733103.
10. Frank, M. et al. (2013). *Touchalytics: Touchscreen Input as a Behavioral Biometric for Continuous Authentication.* IEEE TIFS 8(1). arXiv:1207.6231.
11. UK GDPR, Article 9 (special-category data) and Article 4(14) (biometric data). <https://gdpr-info.eu/art-9-gdpr/>
12. Verizon (2024). *2024 Data Breach Investigations Report.* <https://www.verizon.com/business/resources/reports/dbir/>
13. Cho, K. et al. (2014). *Learning Phrase Representations using RNN Encoder–Decoder (GRU).* EMNLP 2014. arXiv:1406.1078.
14. Bahdanau, D., Cho, K. & Bengio, Y. (2015). *Neural Machine Translation by Jointly Learning to Align and Translate (attention).* ICLR 2015. arXiv:1409.0473.
15. van der Maaten, L. & Hinton, G. (2008). *Visualizing Data using t-SNE.* JMLR 9, 2579–2605.
16. Kingma, D. P. & Ba, J. (2015). *Adam: A Method for Stochastic Optimization.* ICLR 2015. arXiv:1412.6980.

## Appendices

### Appendix A — Glossary

- **Biometric** — recognising a person from a trait; typing rhythm is a *behavioural* one.
- **Fingerprint / embedding** — the 128 numbers the model produces for one typing sample; same-person fingerprints land close together.
- **Equal error rate (EER)** — the balanced setting where "impostor gets in" and "real user locked out" are equally likely; 10% ≈ wrong one time in ten.
- **Open-set test** — judged only on people not seen in training; the honest test for authentication.
- **Mahalanobis / Ledoit–Wolf** — a distance measure that accounts for how much a person's own typing naturally varies, kept stable when enrolment samples are few.

### Appendix B — Full results, figures and provenance

Per-subject error rate (simple distance, seed 42), 16 held-out people, most to least distinctive:

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

Average of these is 0.1421, matching the headline seed-42 figure. Aggregate over the three runs (seeds 42/43/44): simple distance 0.1422 ± 0.0279; full blend 0.1016 ± 0.0097; benchmark 0.0962. The 0.9%–33.5% spread is the §5 fairness finding.

**Provenance (for independent verification).**

- Dataset (`DSL-StrongPasswordData.csv`) SHA-256: `b11d23538b1865fa6ecf4e8b78567caa312e9c1027604bb022fcc6ad7eaa7a33`
- Git commit of the recorded run: `13fafe8f039d969fd77734b67d2457d37c59f918`
- Seeds 42 / 43 / 44 · 128-number fingerprint · 60 training passes · laptop CPU · ~23 min · Python 3.12, PyTorch 2.12 (CPU)

**Figure B.1 — the error trade-off (DET curve).**

![DET curve for the simple-distance scorer on the 16 held-out people.](research/artifacts/det_curve.png){width=3.4in}

*The trade-off between locking out genuine users and letting impostors in, across every dial setting, for the simple-distance method on the 16 strangers. The balanced (equal-error) point is at 14.2%; the 9.6% benchmark is marked.*

**Figure B.2 — the fingerprints, as a picture (t-SNE).**

![The 16 held-out people's fingerprints squashed to two dimensions, coloured by person.](research/artifacts/tsne.png){width=3.7in}

*Each person's 128-number fingerprints, squashed to a 2-D picture and coloured by person. Several people form tight, well-separated clusters though the model never trained on them; the muddy middle matches the hard-to-recognise people of §5.*

### Appendix C — Technical specification

*The exact designs and numbers, for readers who want them. None of it is needed to follow the report.*

**Features.** Each keystroke = four timing features (hold, down–down, flight, up–up) measured relative to the window's first keystroke, plus a 16-dimensional learned character embedding (a 20-D per-keystroke vector). Same featurisation in training and serving.

**Encoder (`KeystrokeEncoder`, 83,505 parameters, 0.32 MB float32).** Input fusion (20-D) → two `Conv1d` layers (20→64→64, kernel 3) → bidirectional GRU (64 each way → 128; Cho et al., 2014) → single-head additive attention with a length mask (Bahdanau et al., 2015) → linear projection to 128-D → L2-normalisation. Embeds one window in ≈ 0.8 ms (mean of 200 runs, batch of one).

**Training.** Batch-hard triplet loss (margin 0.2; Hermans et al., 2017) + center loss (weight 0.01; Wen et al., 2016), Adam (lr 1e-3; Kingma & Ba, 2015), 60 epochs, batches of 16 subjects × 2 windows = 32, squared-Euclidean distance on L2-normalised embeddings. Deterministic: same seed → same weights bit-for-bit on CPU.

**Verification ensemble.** Enrolment stores the centroid, the enrolment embeddings (k-NN, k = 3), and the Ledoit–Wolf inverse-covariance matrix. Score = unweighted mean of (i) L1 distance to the centroid, (ii) mean L1 distance to the 3 nearest enrolment embeddings, (iii) Ledoit–Wolf Mahalanobis distance; singular covariance falls back to the centroid distance. Per-user threshold = 90th percentile of leave-one-out genuine distances × 1.15, floored at a small positive value.

**Evaluation.** Open-set 35/16 subject split (seeded); per test subject an enrolment half and a test half; genuine vs. all other test subjects as impostors; empty-test guard. Two scorers (scaled-Manhattan headline; full ensemble secondary), never cross-compared. Seeds 42/43/44 for the headline; 14 seeds for the ensemble-vs-primary comparison — the ensemble wins 14/14 (Wilcoxon signed-rank *p* ≈ 0.0001). Subject-level bootstrap (20,000 draws) gives a 95% CI of [9.5%, 19.2%] on the seed-42 14.2%. Separability (nearest-impostor distance ÷ within-subject scatter) vs. per-subject EER: Spearman ρ = −0.84, *p* = 0.0001. 14-seed means: primary ≈ 18.7%, ensemble ≈ 13.3%.

**Hyperparameter search (nested validation).** Test 16 held out; inside the 35, a 24-inner-train / 11-validation split; one setting changed at a time, judged only on the 11:

| Change from original | Validation EER (primary / ensemble) |
|----|----|
| Original (60 epochs, margin 0.2, centre 0.01, 2 windows/subj) | 0.1933 / 0.1678 |
| more windows/subj (2→4) | 0.2572 / 0.1731 |
| more windows/subj (2→8) | 0.1975 / 0.2023 |
| longer training (60→120 epochs) | 0.1904 / 0.1684 |
| wider margin (0.2→0.3) | 0.1933 / 0.1678 |
| stronger centre-loss (0.01→0.05) | 0.2054 / 0.1725 |

The validation "winner" (120 epochs) scored 0.1610 ± 0.0866 / 0.1128 ± 0.0378 on the real test — worse and less stable than the original's 0.1422 ± 0.0279 / 0.1016 ± 0.0097, with one seed at 0.284. Training loss saturates at the margin in every row: the bottleneck is the 11-key password, not the optimisation.

**Which distance carries the ensemble.** Mean over 3 seeds: full 0.1016; drop centroid-L1 0.1016; drop k-NN 0.1016; drop Mahalanobis 0.1330. Over 14 seeds: full 0.1326; drop Mahalanobis 0.1783; drop either other term 0.1326. The Ledoit–Wolf Mahalanobis term carries essentially all of the advantage; the other two are numerically swamped by its larger scale. Rescaling the three before blending would let the other two contribute.

**Transformer comparison.** A comparable Transformer encoder (2 layers, 4 heads, 77,296 parameters — slightly *smaller* than the CNN+BiGRU), identical protocol, same 3 seeds: primary EER 19.8% ± 5.4%, ensemble 12.3% ± 4.9%, against this model's 14.2% ± 2.8% and 10.2% ± 1.0%. Both models' loss saturates at the margin, so both are data-limited; the convolution/recurrence priors extract a steadier signal from small data than self-attention.
