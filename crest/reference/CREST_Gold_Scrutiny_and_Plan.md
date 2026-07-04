# Gold CREST Scrutiny v2 — STRICT PASS — *Can You Be Recognised by the Way You Type?*

**Purpose of this version.** This report is intended as a published exemplar: a sample Gold report other students will structure their own work against. That raises the bar in two specific ways. (1) Every criterion must be evidenced at *excellent*, not merely met — a student copying a merely-adequate pattern lands below the pass line. (2) Every checkable claim must actually check out — an exemplar with one wrong number teaches students that provenance is decorative. This pass therefore re-verified everything, hunted for flaws at maximum strictness, and applied the fixes in the same sitting. Each finding below is marked **[FIXED]**, **[STRUCTURAL]** (cannot be fixed honestly — the honest ceiling), or **[MANUAL]** (needs an action only the author can take).

---

## 0. Provenance re-verification (strict)

Re-checked, at source, before re-scoring:

| Claim in report | Source of truth | Verdict |
|---|---|---|
| 14.2% / 10.2% / 9.6%, ±SDs, per-seed values | `research/artifacts/metrics.json` | ✔ exact |
| 16 per-subject EERs, s036 0.009 → s047 0.335, mean 0.1421 | `metrics.json.per_subject_eer` | ✔ exact |
| 14-seed means 18.7% / 13.3%; ensemble wins 14/14 | recomputed from `seed_study_full.json` | ✔ exact |
| Ablation table (6 rows) and 120-epoch test failure | `sweep_results.json` | ✔ exact |
| Transformer 19.8% ± 5.4 / 12.3% ± 4.9, 77,296 params | recomputed from `tf_baseline.json` | ✔ exact |
| Mahalanobis carries the ensemble (drop-one analysis) | `seed_study_full.json` drop columns | ✔ exact |
| "Thirteen fixes" | `problem_log.json` — 13 entries | ✔ exact |
| Dataset SHA-256, git commit, ~23 min train | `metrics.json` (`train_seconds` 1356.8) | ✔ exact |
| **"PyTorch 2.12"** | `research/requirements.txt` pins **torch==2.5.1** | ✘ **WRONG — the single factual error in the report.** A reader who checks the pin finds a version that doesn't match (and doesn't exist). For an exemplar whose whole brand is verifiability, this is the worst possible class of flaw. **[FIXED** — provenance line now reads PyTorch 2.5.1 and cites the pin file + NumPy 2.1.3.**]** |
| Python 3.12 | `__pycache__/…cpython-312…` | ✔ |
| Live-demo scores 3.10 vs 6.73 | asserted; no artifact found for this specific run | ⚠ unverifiable from artifacts — acceptable (it is presented as an illustrative live check, not a headline), but see M3 below |

**Verdict:** with the version pin corrected, every number in the report is now either verified against a committed artifact or explicitly framed as illustrative.

---

## 1. Strict findings — everything the first pass let through

The first-pass scrutiny (v1) found the format gaps; those were fixed (objectives O1–O5 with success tests + §5 verdict; commit-derived Gantt with two real deviations; §3 trade-off table; §2 synthesis; §6 contribution sentence; App C mechanism paragraph). This pass went a level deeper. Findings, ordered by severity:

**S1. Factual error: PyTorch version (above). [FIXED]**

**S2. Reproducibility gap: window definition never stated.** A replicator could not know whether one "window" = one password entry or a sliding sub-window. Different choices change sequence length and every result. *(Damaged 1.4, 4.1.)* **[FIXED** — App C now states: one window = one complete 11-keystroke entry; 51 × 400 = 20,400 windows.**]**

**S3. Reproducibility gap: enrol/test split semantics.** "An enrolment half and a test half" hid two material facts found in `evaluate.py`: the split is **positional** (earlier 200 windows enrol, later 200 test — deliberate temporal separation, conservative under drift), and impostors are **all 400 windows of each of the other 15 subjects** (6,000 impostor scores per subject). The positional choice is actually a *strength* the report was hiding — it forecloses the "did you cherry-pick enrolment samples?" question. *(Damaged 1.4, 4.1.)* **[FIXED** — App C Evaluation rewritten with exact semantics.**]**

**S4. Ambiguity: mean-of-per-subject vs pooled EER.** The headline 14.2% is the mean of per-subject EERs (matching Killourhy–Maxion's methodology); the pooled-score EER is 16.1% (`scores.json`). A sharp reader computing from raw scores would get 16.1% and cry foul. *(Damaged 3.1 integrity, 4.1.)* **[FIXED** — App C now names the convention, gives the pooled figure, and says why they differ.**]**

**S5. Missing results completeness: no FAR/FRR at an operating point.** EER is the balanced point, but the report claims deployment; a deployment picks a threshold. Computed from the real 3,200 genuine / 96,000 impostor scores in `scores.json`: at 5% genuine lock-out → ≈18.5% impostor admission; at 10% → ≈12.4% (global-threshold, i.e. pessimistic vs the deployed per-user thresholds). *(Damaged results completeness under 3.1.)* **[FIXED** — new "Operating points" paragraph in App C, explicitly tied back to §2's security-vs-convenience dial and to why this must stay a second factor.**]**

**S6. Undefined constant: threshold floor "a small positive value".** The exact quantity behind the §4 live crash. It is `1e-3` (`keystrokeProfileBuilder.js:68`). *(Damaged 1.4, 4.4.)* **[FIXED** — value stated, linked to the crash.**]**

**S7. Hidden assumption: benchmark enrolment (200 windows) vs product enrolment (~12).** The two regimes were conflated; a strict assessor could ask "your product enrols a dozen samples but your benchmark enrolled 200 — so what does 14.2% say about the product?" *(Damaged 1.4, 4.1, and a live conversation risk.)* **[FIXED** — App C now distinguishes them and explains why a dozen is workable (the leave-one-out threshold adapts).**]**

**S8. Criterion 4.4 margin: three in-text problems, four is safer.** The real log's `ensemble-not-in-eer` entry (the blended method being measured *nowhere* while running in production) is thematically perfect — it also explains where the 10.2% figure comes from. **[FIXED** — added to §4: "A method you haven't measured isn't a method; it's a hope."**]**

**S9. Criterion 4.5 slip: Figure B.1 (DET) never referenced from the body.** B.2 was; B.1 wasn't — figures must be referenced before they appear. **[FIXED** — §5 now points to B.1 as "the full dial of trade-offs".**]**

**S10. Criterion 2.2: Touchalytics (ref 10) was list-only.** Cited but never engaged — the classic padding tell. It genuinely belongs: it is the proof that continuous behavioural verification works on another modality. **[FIXED** — woven into §2's easy/hard-version paragraph, which also strengthens the §6 continuous-authentication implication that was previously an unsupported extrapolation.]**

**S11. Criterion 4.2: dataset consent asserted without source.** "Subjects are anonymous and consented to research" now cites the dataset's publication for research use (reference 1) and explains *why* not training on product users was the ethically load-bearing choice. **[FIXED]**

**S12. AI declaration lacked dates.** CREST's policy asks when and how; the declaration now carries the span (Nov 2025 – Jul 2026), points to the dated commit trail, and states that every figure comes from code the author ran. **[FIXED]**

**S13. Prose-register risk (v1 carry-over): the §5 objectives roll-call read as rubric-performance.** Rewritten as flowing prose in the previous pass; re-checked — it no longer pattern-matches the Old Draft's "All six were met" self-grading. **[FIXED previously; verified]**

**Remaining, honestly:**

**M1 [MANUAL].** Page/paragraph numbers on the official Student Profile Form after final PDF export — pagination only exists after export. The form's "Where" column is section-accurate now; transcribe page numbers last.

**M2 [MANUAL].** Verbal-defence rehearsal. The report now *contains* own-words mechanism for every deep term, but the author must be able to reproduce those explanations live. Rehearse three questions: why shrinkage with a dozen samples in 128 dimensions; why the Mahalanobis term carries the ensemble; why mean-of-per-subject rather than pooled EER.

**M3 [MANUAL, optional].** The live-demo pair (3.10 / 6.73) has no committed artifact. Either commit the demo run's output JSON to `research/artifacts/` or leave as-is (it is framed as illustrative). Committing it would make the report 100% artifact-backed.

**ST1 [STRUCTURAL].** Criterion 2.1's "people" dimension: this is a genuinely solo project. The report maximises what was available (named datasets, pinned libraries, standards bodies, disclosed AI assistance, the research community via primary literature) and the criterion's own wording — "materials and people **available**" — supports judging resourcefulness against availability. This is the strongest honest position; inventing a mentor or an interview would be fabrication and is not on the table.

**ST2 [STRUCTURAL, by design].** No new experiments were added in this pass (no model swaps, no fresh training runs). Every number in an exemplar must be reproducible from committed artifacts; adding results I did not run would be fabrication. The science already contains the strongest available design: an honest negative headline, a positive stability finding with an attributed cause, a measured Transformer control, a nested-validation ablation, and a bootstrap CI. If the company later wants a bigger result, the honest path is running the free-text Aalto experiment for real — the pipeline exists (§8 of the report).

---

## 2. Final criterion map (post-fix, strict standard)

| Criterion | Standard | Evidence (post-fix) | Residual risk |
|---|---|---|---|
| 1.1 Aim + objectives | **Excellent** | §1: boxed testable aim; O1–O5 each with "done when…"; honest verdict woven into §5 | Low |
| 1.2 Wider purpose | **Excellent** | §1: Verizon 88% + credential-stuffing mechanism + personal incident | Low |
| 1.3 Range of approaches | **Excellent** | §3: three genuinely different designs + trade-off table (cost/phrase-independence/feasibility/risk) + reasoned elimination | Low |
| 1.4 Plan + why | **Excellent** | §1 staged plan; §3 design rationale; App C now replication-grade (S2, S3, S6, S7 closed) | Low |
| 1.5 Time management | **Excellent** | §1: planned-vs-actual table + Gantt from 105 real commits + two explained deviations | Low |
| 2.1 Materials + people | **Excellent (honest ceiling)** | §9 + App C: named, versioned, pinned; standards + community as expertise; solo status addressed head-on | Medium — the one criterion where an assessor could hold "acceptable" on the people dimension (ST1) |
| 2.2 Background + sources | **Excellent** | §2: field trajectory (ACM survey) + two-worlds bracket + Touchalytics engaged + gap *derived*, not asserted; 16 primary refs | Low |
| 3.1 Conclusions + implications | **Excellent** | §6 answers the boxed question with numbers, names the contribution plainly, bounds it; operating points quantify the deployment implication | Low |
| 3.2 Actions → outcome | **Excellent** | §4 (leak → every number changed), §5 (validation winner rejected), App C (Mahalanobis attribution) — quantified links throughout | Low |
| 3.3 Learning + reflection | **Excellent** | §8: distrust-your-own-results, solo-work cost, two named process changes | Low |
| 4.1 Science understanding | **Excellent** | Body analogies + App C "why these pieces work" mechanism paragraph + measured Transformer justification | Low (M2 rehearsal) |
| 4.2 Ethics + safety | **Excellent** | §7: GDPR Art. 9, consent + minimisation, fail-safe, measured 37× disparate impact, dual-use; dataset-use citation (S11) | Low |
| 4.3 Creative thinking | **Excellent** | §3: classical-statistics-inside-a-learned-space named as the core idea; §6 states why the combination is new | Low |
| 4.4 Problems overcome | **Excellent** | §4: four problems with root cause → fix → outcome; 13-entry machine-readable log | Low |
| 4.5 Clear communication | **Excellent** | Analogy-first throughout; glossary; both figures now referenced in body (S9); depth quarantined in App C | Low |

**15/15 evidenced at excellent standard**, all four sections covered. One honesty note that belongs in any exemplar's marketing: CREST never publishes per-criterion scores — "awarded Gold" (≥11/15) is the only verifiable public claim. What this document supports is: *every one of the 15 criteria is evidenced at the standard the criterion pages describe as beyond-acceptable.* That is the strongest claim that can honestly be made, and no sample-report vendor can honestly claim more.

---

## 3. What makes this work as an exemplar (the transferable skeleton)

Since students will pattern-match structure rather than content, the load-bearing, topic-independent moves are:

1. **Personal stake first, criteria never named.** The hook (a real incident) opens; every criterion is satisfied *inside* the story. The failed Old Draft proves the counterfactual: same project, rubric-shaped headings, reads as compliance.
2. **A testable aim with numbered "done when" objectives — then an honest verdict on each**, including the one that was missed. The miss, owned, is worth more than five hits.
3. **Planning evidence from real history** (commits → Gantt), with slippage shown, not hidden.
4. **Approaches as a decision, not a list**: a table with the elimination reasoned from the project's real constraints.
5. **The strongest problem section is the one where the student catches their *own* flattering result.**
6. **Depth quarantined in an appendix, mechanism explained in own words** — the body stays readable; the appendix proves understanding.
7. **Every number traceable to a committed artifact; every constant named.** Provenance is the difference between a claim and a result.
8. **Ethics as decisions made, quantified by the project's own data** (the 37× spread), never boilerplate.
9. **AI use disclosed with dates and boundaries** — what it did, what it never did, whose the mistakes are.
10. **The contribution stated as a finding, honestly bounded** — never "contributes to the growing body of literature."

---

## 4. Applied-fix ledger (this pass)

| # | File | Change |
|---|---|---|
| 1 | Report, App B | PyTorch 2.12 → **2.5.1**, pin file + NumPy version cited (S1) |
| 2 | Report, §2 | Touchalytics engaged in the easy/hard paragraph (S10) |
| 3 | Report, §4 | Fourth problem: the never-measured ensemble (S8) |
| 4 | Report, §5 | Figure B.1 referenced from body (S9) |
| 5 | Report, App C Features | Window definition, units (seconds, raw), origin shift rationale, no normalisation, negatives unclamped (S2) |
| 6 | Report, App C Evaluation | Positional 200/200 split + rationale, impostor construction, mean-of-per-subject vs pooled 16.1% (S3, S4) |
| 7 | Report, App C | New Operating-points paragraph: FAR ≈18.5% @ 5% FRR, ≈12.4% @ 10% FRR, computed from `scores.json` (S5) |
| 8 | Report, App C Ensemble | Floor = 10⁻³ tied to the §4 crash; benchmark-vs-product enrolment regimes distinguished (S6, S7) |
| 9 | Report, §7 | Dataset research-use citation + why no product-user training (S11) |
| 10 | Report, AI note | Date span + commit-trail pointer + "every figure from code I ran" (S12) |
| 11 | Profile form | 2.2, 4.1, 4.4 evidence cells updated to match |
| 12 | Both `.docx` | Rebuilt via pandoc |

Outstanding: M1 (page numbers at export), M2 (rehearsal), M3 (optional demo artifact).
