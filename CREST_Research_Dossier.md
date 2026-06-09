# CREST Gold Award — Research Dossier (Keystroke-Dynamics Biometric Verification)

> **Purpose.** This is the single authoritative reference for the CREST Gold submission of the *Typing Sanctuary* keystroke-biometric project. It consolidates (A) how CREST Gold actually works and is assessed, (B) comparable strong projects to model the write-up on, and (C) the verified domain literature the report's lit-review and ethics section will draw from.
>
> **Provenance rule.** Every substantive claim carries a source URL. Figures that could not be confirmed from a primary source are flagged **[UNVERIFIED]** — do **not** state them as fact without checking. No EER numbers or DOIs in this document were invented. Direct CREST quotes are followed by the source URL, mirroring the style of `Crest_Guidelines.md`.
>
> **How to use this for the paper.** §A tells you what each of the 15 criteria needs and where it is evidenced. §B gives you the "shape" of a winning Gold project and 21 comparable works to cite. §C gives you ready-to-cite, verified references for the methods (triplet loss, Ledoit-Wolf), the benchmark (CMU 9.6% EER), the state of the art (TypeNet), the evaluation standard (ISO/IEC 19795), and the ethics (GDPR Art. 9). The companion file `Crest_Guidelines.md` holds the original criterion-by-criterion source extraction; this dossier extends it with deeper research and the comparable-project landscape.

---

## PART A — CREST Gold: mechanics, assessment, and criteria

### A1. The 15 criteria and the 5 + 2 + 3 + 5 split (CONFIRMED)

CREST Gold is assessed against **15 criteria across 4 sections**. The split is **5 + 2 + 3 + 5 = 15**. Wording is verbatim from the official Gold criteria guidance page.

**Section 1 — Planning the project (5)**
- **1.1** The student set a clear aim for the project and broke it down into smaller objectives.
- **1.2** The student explained a wider purpose for the project.
- **1.3** The student identified a range of approaches to the project.
- **1.4** The student described their plan for the project and why they chose that approach.
- **1.5** The student planned and organised their time well.

**Section 2 — Throughout the project (2)**
- **2.1** The student made good use of the materials and people available.
- **2.2** The student researched the background to the project and acknowledged their sources appropriately.

**Section 3 — Finalising the project (3)**
- **3.1** The student made logical conclusions and explained the implications for the wider world.
- **3.2** The student explained how their actions and decisions affected the project's outcome.
- **3.3** The student explained what they have learnt and reflected on what they could improve.

**Section 4 — Project-wide criteria (5)**
- **4.1** The student showed understanding of the science behind their project, appropriate to their level.
- **4.2** The student made decisions to direct the project, taking account of ethical and safety issues.
- **4.3** The student showed creative thinking.
- **4.4** The student identified and overcame problems successfully.
- **4.5** The student explained their project clearly, in writing or conversation.

Source: https://www.crestawards.org/help-centre/gold-criteria-guidance/

**There is no separate URL per criterion** — all guidance lives on that one page. (The general all-levels overview is at https://www.crestawards.org/help-centre/criteria-for-bronze-silver-and-gold-crest-awards/.) `Crest_Guidelines.md` cites individual criterion-slug URLs gathered from search snippets; treat the single guidance page above as canonical.

**Threshold.** *"To get a Gold CREST Award you need to demonstrate at least 11 of the CREST criteria at acceptable standard or above, covering all four sections of the criteria."* Source: https://www.crestawards.org/help-centre/how-are-gold-projects-assessed/

**Acceptable vs Excellent.** No numeric bands. Each criterion is judged **met / not-met** at "acceptable standard or above"; the differentiator is *depth of evidence*. Criterion 1.5 explicitly rejects bare statements and demands a Gantt/timeline. Source: https://www.crestawards.org/help-centre/gold-criteria-guidance/

#### Criterion-coverage map for THIS project

| Criterion | Evidence this project already supplies | Still to write (in the report) |
|---|---|---|
| 1.1 aim → objectives | Scoped Q: *can a content-independent deep keystroke embedding verify identity, and beat the scaled-Manhattan baseline?* | One testable sentence + 3–6 measurable sub-objectives as a bullet list |
| 1.2 wider purpose | Behavioural biometrics for account-takeover defence, passwordless/continuous auth, accessibility | Name a concrete stakeholder / statistic / gap |
| 1.3 range of approaches | Hybrid decision: stat ensemble vs deep model vs hybrid | Trade-off table (cost/time/feasibility/risk) |
| 1.4 plan + why | Hybrid architecture (shell + stateless inference + offline harness) | Write the plan narrative + why |
| 1.5 planned time | Real git history gives dated commits | **Gantt/timeline with planned vs actual dates** |
| 2.1 materials & people | CMU dataset, PyTorch, FastAPI, Modal, scikit-learn all used | Document each external resource by name |
| 2.2 sources | This dossier (CMU, TypeNet, FaceNet, Ledoit-Wolf, GDPR…) | ≥10 sources, **synthesise** not summarise; identify a gap |
| 3.1 conclusions → implications | Measured open-set EER vs 9.6% baseline (Day 1 output) | Link result → method → objective → wider-world implication |
| 3.2 decisions → outcome | The review-driven design decisions are traceable | Per-decision: what was decided, why, what changed |
| 3.3 reflection | — | ≥½ page: what was learnt, what you'd change |
| 4.1 science | Metric learning, triplet loss, EER, Ledoit-Wolf all implemented | Explain the science at the right level |
| 4.2 ethics & safety | Fail-safe/never-fail-open design; honest data split; GDPR special-category framing | Substantive ethics subsection (consent, minimisation, dual-use) |
| 4.3 creative thinking | Hand-built Ledoit-Wolf ensemble running in a *learned* embedding space; content-independent embedding | Explicitly call out the creative/novel choices |
| 4.4 problems overcome | The closed-set→open-set fix + windowing trap + ~9 adversarial-review bugs (`problem_log.json`) | Dedicated subsection: Problem X → root cause Y → fix Z → verified by W |
| 4.5 explained clearly | — | The whole report's clarity |
| (all) AI use | Build was AI-assisted (Claude Code) | **AI Use Statement** — mandatory (see A5) |

### A2. Assessment process

- **Who / how:** trained CREST assessors judge remotely on the submitted documents, on a **met/not-met basis** (no numeric score/banding). Source: https://www.crestawards.org/help-centre/how-are-gold-projects-assessed/
- **Threshold:** ≥11 of 15, covering all four sections. Sources as A1.
- **Turnaround:** *"We aim to have all projects assessed within 2 weeks of payment, however during periods of high activity this can take up to 6 weeks."* Source: https://www.crestawards.org/help-centre/how-are-gold-projects-assessed/
- **Shortfall path:** written feedback + revise-and-resubmit (reassessment fee applies), **or** the assessor may offer a lower level (e.g. Silver) which the student accepts or declines. Source: same.

### A3. Required deliverables, format, file limits, portal

- **Documents:** (1) a project **report/portfolio** from aim to conclusion; (2) a **CREST Gold Student Profile Form per student** (criteria→page map + reflection); appendices (raw data, code, figures, logbook) allowed. Sources: https://www.crestawards.org/help-centre/required-documentation-for-silver-and-gold-crest/ ; https://www.crestawards.org/resources/crest-gold-student-profile-form/
- **Format:** *"any format of project is accepted, as long as you provide enough detail to meet the CREST criteria."* Video-/slides-only submissions are warned against as too thin; a **written report is strongly preferred at Gold**. **Number the report pages** so the profile form can cross-reference them. Sources: required-documentation page; https://www.crestawards.org/help-centre/do-crest-projects-have-a-minimum-or-maximum-word-count/
- **Word count:** **none** — the test is "enough detail to meet the criteria." **[UNVERIFIED]** A community-reported "~5,000-word/~11-page" Gold report (The Student Room) is anecdotal, not CREST policy — do not cite as a rule. Source: word-count page above.
- **File limit:** single file or zip **≤ 500 MB**; combine into one clearly-named zip; **link** videos rather than embed. Source: required-documentation page.
- **Portal:** submit via **apply.crestawards.org**. Source: https://www.crestawards.org/help-centre/how-to-apply-for-silver-and-gold-crest-awards/

### A4. The ~70-hour expectation

*"Gold projects are complex and require around 70 hours of work."* For students **16+**, mentor strongly recommended; in groups each student does their own ~70 hours and meets criteria individually. Covers the whole arc: background → planning/design → build/data → analysis → reflection → report. Treat 70 hours as a **floor**. Sources: https://www.crestawards.org/secondary-further-education/gold/ ; https://www.crestawards.org/media/jqopgot2/crest-gold-student-guide.pdf

### A5. CREST AI-use policy (the three rules + disclosure)

CREST permits generative-AI use with three conditions. Source: https://www.crestawards.org/help-centre/crest-guidelines-on-use-of-ai-for-students/

1. **Originality** — *"You should not use entire sections of AI-generated content such that the work submitted is not sufficiently your own."*
2. **Attribution** — *"All AI-generated content must be referenced in your work and if possible, clearly evidenced"* (provide prompts/outputs).
3. **Explanation/declaration** — explain how the AI tool was used (best in the Student Profile Form) and **confirm on the application that all AI content has been referenced and declared.**

**Disclosure format.** No rigid template. The AI declaration is a **free-text** statement (there is **no AI tick-box** in the Profile Form PDF — see A8). **Practical move:** keep an appendix logging each AI interaction — *tool, date, prompt, output, how you used/modified it*. That single appendix discharges rules 2 and 3 and also evidences criteria 4.2/4.3/4.4.

- **Allowed:** brainstorming, literature pointer-finding, code scaffolding, debugging, language polish, draft figures — each disclosed.
- **Not allowed:** pasting AI prose as the report body; submitting AI code without understanding/modification; fabricating data.

### A6. Published Gold case studies (the winning pattern)

CREST/BSA case-study hub: https://www.crestawards.org/about-crest/news-case-studies/. The three tech-relevant Gold case studies (no additional named software/AI/data/cyber Gold case study is publicly published beyond these):

**(a) Tom — BSL-to-speech wrist device.** 17-year-old; EMG **muscle sensors + machine learning + coding + 3D printing** translate the BSL alphabet to text/audio; STFC mentor. *Praised for:* genuine **wider purpose** (low-cost accessibility), complete sensing→ML→output build, real mentor. Sources: https://www.crestawards.org/about-crest/news-case-studies/machine-learning-communication-device-gold-crest-award/ ; https://www.britishscienceassociation.org/news/a-level-student-builds-highly-accurate-budget-sign-language-to-speech-wrist-technology

**(b) Theia: AR Technology — AI glasses for dementia.** Team of 4 (17–18), SE-Wales FE college; **facial recognition** + companion app to help dementia patients recognise loved ones; framed as a theoretical company. *Praised for:* strong **human-impact** framing (rooted in a member's family experience), clear role division, company/product structure. Sources: https://www.crestawards.org/about-crest/news-case-studies/ai-dementia-healthcare-gold-award-case-study/ ; https://www.britishscienceassociation.org/blog/education-a-gold-crest-awards-case-study-bringing-ai-into-dementia-healthcare

**(c) Donnie — frisbee-catching machine.** 19-year-old (China → Cambridge engineering offer); netted catcher + conveyor returns the disc. *Praised for:* complete engineering design cycle, depth on a single mechanism, documented admissions outcome. Source (overseas-students case study): https://www.crestawards.org/about-crest/news-case-studies/crest-awards-overseas-students/

**On-theme bonus:** BSA × Google DeepMind AI-literacy partnership via CREST — useful to argue an AI-biometrics project is squarely on-theme right now. https://www.crestawards.org/about-crest/news-case-studies/bsa-partnership-deepmind-discovery-crest/

> **The common thread across winning Gold case studies:** (1) an explicit *wider purpose* tied to a real human need; (2) a complete end-to-end pipeline personally built; (3) a named mentor; (4) honest reflection on limitations. Mirror all four.

### A7. Prior publication / dual submission to a journal

CREST publishes **no explicit "must be previously unpublished" rule**. What is documented: it actively supports **dual submission to the Big Bang Competition** (https://www.crestawards.org/help-centre/submitting-for-crest-awards-and-the-big-bang-competition/) and entry via an **EPQ** (https://www.crestawards.org/help-centre/enter-an-extended-project-qualification-epq-for-a-crest-award/) — a re-use-friendly culture. The help centre is **silent on journals specifically.** **[UNVERIFIED — confirm directly]** Email `crest@britishscienceassociation.org` before assuming a journal preprint is fine. Common pattern: journal manuscript as a *deliverable/appendix*, wrapped by a CREST-shaped report that adds planning, reflection, ethics, and criteria evidence.

### A8. Student Profile Form — exact structure (VERIFIED from extracted PDF)

A single shared Bronze/Silver/Gold form, 5 pages. Source: https://www.crestawards.org/media/le5pqz0v/crest-student-profile-form.pdf

- **Page 1 — identity:** first name only (no surname), award level, project title, mentor/supervisor name. Instruction: *"Please fill in this profile form and submit it along with your report. This is a requirement for your submission."*
- **Pages 2–3 — THE criteria→page-number mapping table** (the core of the form). Three columns: **Criteria** | *"Where do you show this in your report or project record?"* (template shows the example *"Page 2, paragraph 5"*) | *"Your notes to the assessor (optional)."* Every criterion is a row, grouped under the four section headings. **For each numbered criterion, write the page (and paragraph) where the evidence lives** — this is the primary thing the student fills in. Assessors read this first.
- **Page 4 — Personal reflections** (reflection section exists): prompts on success/not, what was learnt, impact on others/the wider world, what you'd improve, future development. Plus a **mentor confirmation + signature + date** block.
- **Page 5 —** optional further notes/drawings.
- **No AI tick-box anywhere** — the AI declaration is the free-text statement of A5, placed in the report and/or the profile-form reflection.

### A9. Gold Student Guide — report-structure advice (VERIFIED from extracted PDF)

Source: https://www.crestawards.org/media/jqopgot2/crest-gold-student-guide.pdf. Seven sections: before/during the project, producing your report, completing the profile form, personal reflections, assessment, what next.

- **Report structure:** **NOT prescriptive about headings.** Closest framing: *"you will need to write a report to introduce, describe and evaluate your work"* — i.e. **introduce → describe → evaluate**, plus reflection. **No IMRaD is mandated** (but IMRaD is a perfectly acceptable way to "introduce/describe/evaluate" — recommended for this project: Introduction/Aim · Background · Method · Results · Discussion/Implications · Reflection).
- **Rules:** number the pages; use your own words (*"You should not use information copied straight from the internet"*); list your sources, and at Gold *"'in-text' references should be used."*
- **Length:** no page count; reflection *"around half a page"* per student.
- **Logbook:** *"Take lots of notes of what you do, including your planning from early on… This will help you to write your report and personal reflections."*
- **Worked examples:** two full *personal-reflection* examples (team + individual); no full-report example.

---

## PART B — Comparable strong projects (model the write-up on these)

A mix of (i) genuine student capstones/theses, (ii) published student-adjacent papers in the exact methods space, and (iii) field-defining works to cite as the benchmark this project competes with.

**Keystroke dynamics — student capstones & student-led papers**
1. **SJSU keystroke-dynamics master's projects** (SJSU ScholarWorks) — CMU fixed-text + Clarkson/Buffalo free-text, classical ML + DL; public dataset, clear EER reporting. https://scholarworks.sjsu.edu/cgi/viewcontent.cgi?article=2004&context=etd_projects
2. **Gupta, "ML-Based User Identification Through Mouse Dynamics"** (SJSU master's project) — clean behavioural-biometrics capstone template. https://scholarworks.sjsu.edu/etd_projects/1381/
3. **"Machine Learning and Deep Learning for Fixed-Text Keystroke Dynamics"** (arXiv 2107.00507) — systematic comparison on CMU ".tie5Roanl"; methods/results-chapter template. https://arxiv.org/pdf/2107.00507
4. **"Impact of Data Breadth and Depth on Siamese NN Performance"** (arXiv 2501.07600) — siamese across Aalto/CMU/Clarkson II; directly relevant to siamese/triplet design + breadth-vs-depth argument. https://arxiv.org/html/2501.07600
5. **Lis, Niewiadomska-Szynkiewicz, Dziewulska, *Sensors* 23(15):6685 (2023)** — Siamese + n-shot on static text; **EER ≈ 9.1% on ".tie5Roanl"**; excellent model-design reference. https://www.mdpi.com/1424-8220/23/15/6685 (OA: https://pmc.ncbi.nlm.nih.gov/articles/PMC10422646/)
6. **"Robust Keystroke Biometric Anomaly Detection"** (arXiv 1606.09075) — reproduces/stress-tests CMU detectors; baseline-comparison citation. https://arxiv.org/pdf/1606.09075
7. **"Fast Free-text Authentication via Instance-based Keystroke Dynamics"** (arXiv 2006.09337) — free-text continuous auth. https://arxiv.org/pdf/2006.09337
8. **KeyRecs keystroke dataset** (*Data in Brief*, 2023) — recent citable open dataset / extension. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10474054/

**Behavioural biometrics — gait, mouse, touch**
9. **Touchalytics — Frank et al., *IEEE TIFS* 8(1), 2013** — touchscreen biometric; **median EER 0% intra / 2–3% inter-session**; a model "wider-purpose + ethics + rigorous EER" paper. https://arxiv.org/abs/1207.6231 ; https://dl.acm.org/doi/10.1109/TIFS.2012.2225048
10. **"ML/DL Applications to Mouse Dynamics for Continuous Authentication"** (arXiv 2205.13646). https://arxiv.org/pdf/2205.13646
11. **SapiMouse — mouse dynamics with deep feature learning** — pairs with the siamese approach. https://www.researchgate.net/publication/352872875_SapiMouse_Mouse_Dynamics-based_User_Authentication_Using_Deep_Feature_Learning
12. **"Mouse Dynamics Behavioral Biometrics: A Survey"** (arXiv 2208.09061). https://arxiv.org/html/2208.09061v2
13. **"Sensor-based Continuous Authentication … Behavioral Biometrics: A Survey"** (arXiv 2001.08578) — single citation for the landscape. https://arxiv.org/pdf/2001.08578

**Deep metric learning / siamese / triplet (the methods used)**
14. **FaceNet — Schroff et al., CVPR 2015** — canonical triplet-loss 128-D embedding, 99.63% LFW; origin of the training objective. https://arxiv.org/abs/1503.03832
15. **Hermans, Beyer, Leibe, "In Defense of the Triplet Loss" (2017)** — batch-hard mining; how to train triplet loss well. https://arxiv.org/abs/1703.07737
16. **Wen et al., center loss, ECCV 2016** — complementary discriminative objective. https://link.springer.com/chapter/10.1007/978-3-319-46478-7_31
17. **TypeNet — Acien et al., *IEEE TBIOM* 2021** — siamese LSTM keystroke biometrics at scale; **EER 2.2% physical / 9.2% touch**; scales to 100k subjects. The single most important "we do what SOTA does, at student scale" comparator. https://arxiv.org/abs/2101.05570

**ML-for-authentication / security applied projects**
18. **Ensemble Siamese Network using ECG signals** — few-shot enrolment advantage. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10222383/
19. **Cross-Sensor Fingerprint Matching using Siamese + adversarial learning.** https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8197308/
20. **EmgAuth — "Unlocking Smartphones with EMG Signals"** (arXiv 2103.12542) — bridges to Tom's CREST EMG glove. https://arxiv.org/pdf/2103.12542
21. **Keystroke Dynamics survey — *ACM Computing Surveys* (2024/25)** — authoritative lit-review opener. https://dl.acm.org/doi/full/10.1145/3733103

**What made the strong ones strong (the pattern to copy):** a public named dataset with **EER/FAR/FRR on a held-out split** (never a vague accuracy); a clear baseline (scaled-Manhattan 9.6% on CMU) so the contribution is measurable; an explicit wider purpose; a dedicated ethics paragraph on biometric sensitivity, consent, on-device processing, GDPR special-category status.

> **[UNVERIFIED]** No specific ISEF / Regeneron STS / Google Science Fair keystroke-biometrics finalist could be individually verified. Do **not** name one without checking the official abstract databases (abstracts.societyforscience.org, societyforscience.org/regeneron-sts/, Google Science Fair archive). The SJSU capstones above are concrete, verifiable substitutes.

---

## PART C — Domain literature for the lit-review (verified citations)

### C1. CMU benchmark — Killourhy & Maxion (2009) — the number to beat
- **Citation:** K. S. Killourhy and R. A. Maxion, "Comparing Anomaly-Detection Algorithms for Keystroke Dynamics," *Proc. DSN-2009*, pp. **125–134**, IEEE.
- **Dataset:** **51 subjects** × password **".tie5Roanl"** × **400 reps** (8 sessions × 50); hold/down-down/up-down timing features; 14 detectors. Public page: https://www.cs.cmu.edu/~keystroke/
- **Baseline EER table (VERIFIED against the CMU page; fractional rates, std-dev in parens):**

  | Detector | EER (std) |
  |---|---|
  | **Manhattan (scaled)** | **0.0962 (0.0694)** ← the headline baseline to beat |
  | Nearest Neighbor (Mahalanobis) | 0.0996 (0.0642) |
  | Mahalanobis | 0.1101 (0.0645) |
  | Manhattan | 0.1529 (0.0925) |
  | Euclidean | 0.1706 (0.0952) |

  Sources: https://www.cs.cmu.edu/~keystroke/ ; https://www.cs.cmu.edu/~maxion/datasets.html

### C2. Free-text keystroke datasets
- **Aalto / Dhakal et al. (2018), "Observations on Typing from 136 Million Keystrokes," CHI '18.** **168,000** volunteers, **136M** keystrokes; code+data released; the corpus TypeNet uses. **DOI 10.1145/3173574.3174220.** https://dl.acm.org/doi/10.1145/3173574.3174220 ; dataset: https://userinterfaces.aalto.fi/136Mkeystrokes/
- **Buffalo free-text (SUNY Buffalo)** — **[UNVERIFIED n≈148]**, free+fixed text, continuous-auth.
- **Clarkson II free-text (Clarkson Univ.)** — long-duration free-text benchmark. **[UNVERIFIED exact size]**
- **Sun, Çeker & Upadhyaya (2016), "Shared Keystroke Dataset for Continuous Authentication," *IEEE WIFS 2016*** — ~**157 subjects**, 3 sessions over ~4 months, fixed+free. https://www.semanticscholar.org/paper/Shared-keystroke-dataset-for-continuous-Sun-%C3%87eker/5293993ca5ade7262228878e545b873610723b7d
- Survey context: https://arxiv.org/html/2502.16177v1

> **[UNVERIFIED]** Buffalo (~148) and Clarkson II exact participant counts are from secondary surveys — verify against the primary dataset papers before quoting.

### C3. TypeNet — the deep-learning state of the art
- **Acien, Morales, Monaco, Vera-Rodriguez, Fierrez, "TypeNet: Deep Learning Keystroke Biometrics," *IEEE TBIOM*, 2021.** arXiv:2101.05570. Siamese **LSTM**; softmax/contrastive/triplet compared; **EER 2.2% (physical) / 9.2% (touch)** with 5 gallery + 50-key test sequences; error grows only moderately to **100,000 subjects**. https://arxiv.org/abs/2101.05570 ; PDF: http://biometrics.eps.uam.es/fierrez/files/2021_TBIOM_TypeNet_Acien.pdf

### C4. Triplet / batch-hard / center loss (the training objective)
- **FaceNet** — Schroff, Kalenichenko, Philbin, *CVPR 2015*, pp. 815–823. **DOI 10.1109/CVPR.2015.7298682**; arXiv:1503.03832. 128-D embedding; online (semi-hard) triplet mining; 99.63% LFW.
- **Batch-hard triplet** — Hermans, Beyer, Leibe (2017), arXiv:1703.07737. The standard reference for batch-hard online mining (what this project's `triplet.py` implements).
- **Center loss** — Wen, Zhang, Li, Qiao, *ECCV 2016*, LNCS 9911, pp. 499–515. **DOI 10.1007/978-3-319-46478-7_31**. (The center regularizer in `triplet.py`.)

### C5. Ledoit–Wolf shrinkage covariance (the verifier)
- **Ledoit, O., Wolf, M. (2004), "A Well-Conditioned Estimator for Large-Dimensional Covariance Matrices," *J. Multivariate Analysis* 88(2):365–411. DOI 10.1016/S0047-259X(03)00096-4.** https://www.sciencedirect.com/science/article/pii/S0047259X03000964 ; scikit-learn impl to cite in code: https://scikit-learn.org/stable/modules/generated/sklearn.covariance.LedoitWolf.html
- *Relevance:* gives a well-conditioned, invertible covariance for Mahalanobis scoring on small-sample, high-dim keystroke embeddings — exactly this project's regime.

### C6. EER / FAR / FRR / DET and ISO/IEC 19795
- **Standard:** **ISO/IEC 19795-1** (ISO/IEC JTC 1/SC 37), "Biometric performance testing and reporting — Part 1: Principles and framework." Defines FMR/FNMR, FAR/FRR, FTA/FTE, **EER**, DET-curve reporting. Catalogue: https://www.iso.org/standard/73515.html (full text paywalled). **[UNVERIFIED]** Confirm the exact current edition/year before printing.
- **Definitions for the methods chapter:** FMR/FNMR = one-to-one comparison errors; FAR/FRR = system verification errors; **EER** = the operating point where FAR = FRR (lower = better); **DET curve** = FAR vs FRR across thresholds. Clean survey: https://arxiv.org/pdf/1903.02548

### C7. GDPR / biometric-data ethics (criterion 4.2)
- **GDPR Article 9** — processing of *"biometric data for the purpose of uniquely identifying a natural person"* is a **special category**, prohibited unless an Art. 9(2) exception plus an Art. 6 lawful basis both apply. https://gdpr-info.eu/art-9-gdpr/
- **GDPR Art. 4(14)** — biometric data includes specific technical processing of physical, physiological **or behavioural** characteristics. **Keystroke/typing rhythm is a behavioural biometric** in scope when used to identify. ICO: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- **Ethics framing for the report:** behavioural-biometric data becomes special-category *specifically when processed to uniquely identify*. Justify **consent**, **data minimisation**, **on-device/template storage**, and why a **public anonymised dataset (CMU)** was used rather than collecting new identifiable data. Pair with the project's **fail-safe / never-fail-open** design decision.

### C8. Cost/feasibility note (informs the "deferred GPU" decision)
- **Modal T4 price (June 2026): $0.000164/sec = $0.59/hour**, billed per-second, $30/month free credit on Starter. https://modal.com/pricing
- **Estimate for this workload** (CNN+BiGRU ~1M params, ~60 epochs, CMU ~20k rows): **~2–15 min** of compute → **~$0.10–$0.60**, comfortably inside the free credit. **[UNVERIFIED]** The minutes-of-compute figure is an engineering estimate; only the per-second price is sourced. *Implication:* the "billable GPU step" is trivially cheap — and the same tiny model trains on **local CPU for $0** in ~10–30 min, which is the path this sprint takes.

---

## SOURCES (consolidated)

**CREST / BSA (Part A):** crestawards.org pages — gold-criteria-guidance, how-are-gold-projects-assessed, criteria-for-bronze-silver-and-gold, required-documentation-for-silver-and-gold, do-crest-projects-have-a-minimum-or-maximum-word-count, crest-guidelines-on-use-of-ai-for-students, secondary-further-education/gold, how-to-apply-for-silver-and-gold, resources/crest-gold-student-profile-form, media/le5pqz0v/crest-student-profile-form.pdf, media/jqopgot2/crest-gold-student-guide.pdf, about-crest/news-case-studies (+ machine-learning-communication-device, ai-dementia-healthcare, crest-awards-overseas-students, bsa-partnership-deepmind-discovery), submitting-for-crest-awards-and-the-big-bang-competition, enter-an-extended-project-qualification-epq; apply.crestawards.org; britishscienceassociation.org news/blog case studies.

**Part B (comparable projects):** SJSU ScholarWorks (etd_projects/1381, article 2004); arXiv 2107.00507, 2501.07600, 1606.09075, 2006.09337, 1207.6231, 2205.13646, 2208.09061, 2001.08578, 2103.12542; MDPI Sensors 23(15):6685 (PMC10422646); PMC10474054, PMC10222383, PMC8197308; arXiv 1503.03832, 1703.07737, 2101.05570; Springer 978-3-319-46478-7_31; ACM 10.1145/3733103; ResearchGate SapiMouse.

**Part C (domain literature):** cs.cmu.edu/~keystroke, cs.cmu.edu/~maxion/datasets; ACM 10.1145/3173574.3174220 + userinterfaces.aalto.fi/136Mkeystrokes; Semantic Scholar Sun-Çeker; arXiv 2502.16177, 1903.02548; arXiv 2101.05570 + biometrics.eps.uam.es TypeNet PDF; arXiv 1503.03832, 1703.07737; Springer center-loss; sciencedirect S0047-259X(03)00096-4 + scikit-learn LedoitWolf; iso.org/standard/73515; gdpr-info.eu/art-9-gdpr; ico.org.uk special-category-data; modal.com/pricing.

## Flagged UNVERIFIED (do not state as fact without checking)
- CREST report word count "~5,000 words / ~11 pages" — informal forum anecdote, not policy.
- Journal / prior-publication eligibility for CREST — email crest@britishscienceassociation.org.
- Buffalo (~148) and Clarkson II exact participant counts — verify against primary papers.
- ISO/IEC 19795-1 exact current edition/year — confirm on iso.org.
- Specific ISEF / Regeneron STS / Google Science Fair keystroke finalists — none individually verified.
- Modal training compute-minutes (~2–15 min) — engineering estimate; only the per-second price is sourced.
