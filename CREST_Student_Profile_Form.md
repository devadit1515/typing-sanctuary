# CREST Gold Award — Student Profile Form

> **What this is.** CREST requires a Student Profile Form submitted *alongside* the report — one per student, even in a group. It has two functional parts: (1) a **criteria checklist** where you point the assessor to *where in your report* each of the 15 criteria is evidenced (the assessor reads this first), and (2) a **personal reflection**. This file reproduces that structure so you can transcribe it into the official CREST form (Word/PDF) at https://www.crestawards.org/resources/crest-gold-student-profile-form/. Fill in the _[bracketed]_ fields and replace "§x" with the **page numbers** of those sections in your final paginated PDF (the official form asks for "Page X, paragraph Y").

---

## Part 1 — Project details

| Field | Entry |
|---|---|
| First name | _[your first name only — the form asks not to include surname]_ |
| CREST Award level | **Gold** |
| Project title | Content-independent keystroke-dynamics biometric verification: does a deep metric-learning embedding with a classical calibrated verifier authenticate users by typing rhythm alone? |
| Mentor / supervisor | _[name and role]_ |
| Approximate hours | _[≥ 70 hours — Gold expectation; the 83 dated git commits over 25 Nov 2025–9 Jun 2026 evidence the time spent]_ |

---

## Part 2 — Criteria checklist (the evidence index)

For each criterion, write the **page (and paragraph)** in your report where the assessor will find the evidence. Replace each "Report §" with the matching page number after you paginate the PDF.

### Section 1 — Planning the project

| Criterion | Where I show this (page / section) | My note to the assessor |
|---|---|---|
| **1.1** Clear aim broken into objectives | Report §1.1 (p. _[ ]_) | The aim is one testable sentence; it is decomposed into 6 objectives each with a measurable success condition and an outcome column. |
| **1.2** Wider purpose | Report §1.2 (p. _[ ]_) | Account-takeover fraud and credential stuffing as the real-world problem; named stakeholders (account holders, the game's players); accessibility angle. |
| **1.3** Range of approaches | Report §1.3 (p. _[ ]_) | Three distinct approaches (statistical / deep classifier / metric-embedding) compared in a trade-off table on seven criteria, with the decision justified. |
| **1.4** Plan and why I chose it | Report §1.4 (p. _[ ]_) | The three-part hybrid architecture and why the research/serve separation makes both the science and the product trustworthy. |
| **1.5** Planned and organised time | Report §1.5 (p. _[ ]_) | A Gantt-style timeline built from **real, immutable git commit dates** (83 commits), planned vs actual milestones, and two honest replanning decisions with reasons. |

### Section 2 — Throughout the project

| Criterion | Where I show this | My note to the assessor |
|---|---|---|
| **2.1** Made good use of materials and people | Report §1.6 (p. _[ ]_) | Every dataset, library, tool and person named; _[mentor's contribution]_. |
| **2.2** Researched background, acknowledged sources | Report §2 + §13 (p. _[ ]_) | A *synthesised* literature review (not paper-by-paper) that locates a specific gap; author–date in-text references with a full reference list; full provenance in `CREST_Research_Dossier.md`. |

### Section 3 — Finalising the project

| Criterion | Where I show this | My note to the assessor |
|---|---|---|
| **3.1** Logical conclusions + implications for the wider world | Report §4 + §5 (p. _[ ]_) | Results answer the aim directly; §5.2 draws out implications for account security, the research community, and accessibility. |
| **3.2** How my actions/decisions affected the outcome | Report §6 (p. _[ ]_) | Five pivotal decisions, each with its concrete effect — e.g. the open-set choice cost a "better" number but bought a defensible one. |
| **3.3** What I learnt and would improve | Report §10 (p. _[ ]_) | ≥ half a page of specific reflection: closed-vs-open-set as the key lesson, reproducibility, and four concrete next steps. |

### Section 4 — Project-wide

| Criterion | Where I show this | My note to the assessor |
|---|---|---|
| **4.1** Understanding of the science | Report §2 + §3 (p. _[ ]_) | Metric learning, triplet loss, L2-normalisation, Ledoit–Wolf shrinkage, Mahalanobis, EER/DET explained at Level-3+ depth and applied. |
| **4.2** Ethics and safety decisions | Report §8 + App. E (p. _[ ]_) | Biometric data as GDPR special-category; consent; data minimisation (public dataset, templates not raw timings); fail-safe design; dual-use; risk assessment. |
| **4.3** Creative thinking | Report §3.5 + §1.3 (p. _[ ]_) | The creative core is combining two usually-separate fields — deep representation learning and classical shrinkage statistics — by running the classical ensemble *inside the learned embedding space*. |
| **4.4** Identified and overcame problems | Report §7 (p. _[ ]_) | 13 problems in *problem → root cause → fix → verified* form, including a live production crash found only by running the real system — strategic, root-cause problem-solving. |
| **4.5** Explained the project clearly | Whole report (p. _[ ]_) | Logical structure, abstract, labelled tables and figures, a glossary defining every term/abbreviation (App. B), accessible language. |

> **Coverage:** all **15** criteria are evidenced across all **four** sections — comfortably above the Gold threshold of "at least 11 covering all four sections."

---

## Part 3 — Personal reflections

_[STUDENT: write this in your own words — the assessor weighs it heavily. The official form gives five prompts; honest, specific answers beat polished generic ones. Draft answers below to adapt.]_

**How my project was / was not successful.** It succeeded in producing an honest, reproducible measured result (open-set EER 14.2 % primary / 10.2 % ensemble on 16 unseen subjects) and a working live system. It did *not* beat the 9.6 % published baseline on the headline metric — and I have reported that honestly rather than hiding behind a more flattering protocol. The real success was the *rigour*: an evaluation that refuses to flatter itself.

**What I learnt.** The difference between closed-set and open-set evaluation, and how easily a flawed protocol produces an impressive-but-meaningless number; why biometrics are measured by EER/DET rather than accuracy; and that reproducibility (pinned data, fixed seeds, one-command rerun) is what turns a claim into a result. _[add your own]_

**What impact the results might have on others.** Even a 10 % EER typing biometric is useful as a silent *second* factor against account-takeover at zero user effort, and as a future continuous check against session hijacking — provided it is built with consent and fail-safe safeguards. _[add your own]_

**What I would do to improve the work.** Recalibrate the confidence scale (§7.11); run the free-text/continuous model on a real large corpus (Aalto); train at scale on GPU; and collect a small consented in-game dataset to test cross-dataset generalisation. _[add your own]_

**What I would do to develop the project in future.** _[your own — e.g. turn it into a deployed opt-in feature in the live game, or extend to mouse-dynamics as a second behavioural channel.]_

---

## Part 4 — AI declaration

Per CREST's AI policy, I confirm that all AI-assisted content has been referenced and declared. The full disclosure — tool (Anthropic Claude via Claude Code), dates (8–9 June 2026 and report drafting), what it did, how I checked it, and a representative prompt — is in **Report §12 (AI Use Statement)**. The AI assisted with code scaffolding, debugging, literature-pointer finding, and drafting; I set the research direction, made every scientific decision, ran and tested all code, verified every result, and edited all prose into my own voice. _[STUDENT: tick the AI declaration box on the official application and keep your Claude Code session logs as evidence.]_

---

## Part 5 — Mentor confirmation

_[Mentor/supervisor: please confirm this project is the student's own work by signing the official form.]_

| | |
|---|---|
| Mentor name | _[ ]_ |
| Signature / date | _[ ]_ |
