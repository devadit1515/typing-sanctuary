# CREST Gold Award — Student Profile Form

> **What this is.** CREST requires a Student Profile Form submitted *alongside* the report — one per student, even in a group. It has two functional parts: (1) a **criteria checklist** where you point the assessor to *where in your report* each of the 15 criteria is evidenced (the assessor reads this first), and (2) a **personal reflection**. This file reproduces that structure so you can transcribe it into the official CREST form (Word/PDF) at https://www.crestawards.org/resources/crest-gold-student-profile-form/. Fill in the _[bracketed]_ fields and replace "§x" with the **page numbers** of those sections in your final paginated PDF (the official form asks for "Page X, paragraph Y").

---

## Part 1 — Project details

| Field | Entry |
|---|---|
| First name | Devadit |
| CREST Award level | **Gold** |
| Project title | Content-independent keystroke-dynamics biometric verification: does a deep metric-learning embedding with a classical calibrated verifier authenticate users by typing rhythm alone? |
| Mentor / supervisor | None — independent project (no mentor or supervisor) |
| Approximate hours | ≈ 84 hours (above the ~70-hour Gold expectation), evidenced by 87 dated git commits over 25 Nov 2025 – 10 Jun 2026, 50 of them inside the 8–10 June research sprint — see Report §1.5 effort table |

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
| **1.5** Planned and organised time | Report §1.5 (p. _[ ]_) | A Gantt-style timeline built from **real, immutable git commit dates** (87 commits), an explicit ~84-hour effort breakdown, planned vs actual milestones, and two honest replanning decisions with reasons. |

### Section 2 — Throughout the project

| Criterion | Where I show this | My note to the assessor |
|---|---|---|
| **2.1** Made good use of materials and people | Report §1.6 (p. _[ ]_) | Every dataset, library, tool, standard and source named. This was an **independent project with no mentor**, so §1.6 documents how the *research community* (published authors, library maintainers, ISO/ICO standards) and rigorous self-auditing stood in for a supervisor — stated honestly, not hidden. |
| **2.2** Researched background, acknowledged sources | Report §2 + §13 (p. _[ ]_) | A *synthesised* literature review (not paper-by-paper) that locates a specific gap; author–date in-text references with a full reference list; full provenance in `CREST_Research_Dossier.md`. |

### Section 3 — Finalising the project

| Criterion | Where I show this | My note to the assessor |
|---|---|---|
| **3.1** Logical conclusions + implications for the wider world | Report §4 + §5 (p. _[ ]_) | Results answer the aim directly; §5.2 draws out implications for account security, the research community, and accessibility. |
| **3.2** How my actions/decisions affected the outcome | Report §6 (p. _[ ]_) | Six pivotal decisions, each with its concrete effect — e.g. the open-set choice cost a "better" number but bought a defensible one, and refusing a noisy tuning "win" (§4.6) kept the headline honest. |
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

_(These answers are written from the real project history and are mine to refine — Devadit, read each through and adjust the phrasing so it reads in your own voice before transcribing onto the official form.)_

**Why I chose this project.** It started from a real security incident: an account I cared about was accessed using stolen credentials, and it struck me that the password had "worked" perfectly for the attacker because a password proves only knowledge of a secret, not identity. I wanted to know whether *how* a person types — their rhythm — could become a quiet extra layer that a stolen password cannot defeat.

**How my project was / was not successful.** It succeeded in producing an honest, reproducible measured result (open-set EER 14.2 % primary / 10.2 % ensemble on 16 unseen subjects) and a working live system, and a nested-validation ablation later confirmed the configuration was near-optimal. It did *not* beat the 9.6 % published baseline on the headline metric — and I reported that honestly rather than hiding behind a more flattering protocol. The real success was the *rigour*: an evaluation that refuses to flatter itself.

**What I learnt.** The difference between closed-set and open-set evaluation, and how easily a flawed protocol produces an impressive-but-meaningless number; why biometrics are measured by EER/DET rather than accuracy; that reproducibility (pinned data, fixed seeds, one-command rerun) is what turns a claim into a result; and — from the ablation — how selecting hyperparameters on a small validation fold can overfit noise, so that a number that "looks better" can generalise worse. Working without a mentor, I also learnt to be my own sceptic: to distrust a convenient result and audit the protocol that produced it.

**What impact the results might have on others.** Even a 10 % EER typing biometric is useful as a silent *second* factor against account-takeover at zero user effort, and as a future continuous check against session hijacking — provided it is built with consent and fail-safe safeguards. For a field where reproducibility is often weak, a fully pinned, one-command-rerun pipeline is itself a small contribution.

**What I would do to improve the work.** Recalibrate the confidence scale (§7.6); run the free-text/continuous model on a real large corpus (Aalto); train at scale on GPU to test whether the hybrid's advantage holds as accuracy improves; collect a small *consented* in-game dataset to test cross-dataset generalisation; and — having worked entirely solo — seek a mentor or peer reviewer earlier next time, since explaining a result to another person catches errors that re-reading your own code does not.

**What I would do to develop the project in future.** Turn it into a deployed, opt-in, user-controlled feature in the live typing game it grew from (consent and fail-safe behaviour built in from the first line), then extend from fixed-text login checks to *continuous* free-text verification during a session, and potentially add mouse-dynamics as a second behavioural channel.

---

## Part 4 — AI declaration

Per CREST's AI policy, I confirm that all AI-assisted content has been referenced and declared. The full disclosure — tool (Anthropic Claude via Claude Code), dates (8–10 June 2026 and report drafting), what it did, how I checked it, and a representative prompt — is in **Report §12 (AI Use Statement)**. The AI assisted with code scaffolding, debugging, literature-pointer finding, and drafting; I set the research direction, made every scientific decision, ran and tested all code, verified every result, and edited all prose into my own voice. I have **not attached raw session transcripts**; instead the originality of the work is evidenced by the §12 statement, the dated git history (which records the human decisions and edits at each step), and the fact that every result is reproducible from my own code. _[Devadit: tick the AI declaration box on the official application.]_

---

## Part 5 — Verification of own work (independent submission)

This project was completed **independently, without a mentor or supervisor.** I confirm that the work described in this report and profile form is my own: I made every scientific decision, wrote and ran all the code, and verified every result, with AI assistance disclosed and bounded as described in Part 4 and Report §12.

| | |
|---|---|
| Student name | Devadit Jain |
| Declaration | I confirm this is my own work. |
| Signature / date | _[Devadit: sign and date on the official form]_ |

> **Logistics note (important — check before submitting):** CREST Gold projects are normally submitted through a registered CREST provider or coordinator (usually a teacher), and the official Student Profile Form has a section for a supervisor/teacher to verify the work. Because this is an independent submission with no mentor, **confirm the correct route with CREST before applying** — email `crest@britishscienceassociation.org` or check the "how to apply" guidance — as you may need to register as an independent participant or have an eligible adult (not necessarily a subject mentor) act as the verifying coordinator. Do not leave the verification section blank without first confirming what CREST requires for an independent entry.
