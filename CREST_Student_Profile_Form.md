# CREST Gold Award — Student Profile Form

> **What this is.** CREST requires a Student Profile Form submitted *alongside* the report — one per student. It is the assessor's map: for each of the 15 criteria you point to *where in the report* you show it, with an optional short note. This file mirrors the official form (download and transcribe at <https://www.crestawards.org/resources/crest-gold-student-profile-form/>). The "Where" column cites report **sections**; after you export the report to PDF, add the page (and paragraph) numbers the official form asks for, because pagination shifts on export.

---

| | |
|---|---|
| Student / team member's first name | Devadit |
| CREST Award level | **Gold** |
| Project title | Verifying Identity from Typing Rhythm: An Open-Set Deep Metric Learning Approach |
| Mentor name | None — independent project (see the note at the end) |

---

## Criteria checklist

*Notes to the assessor are optional and deliberately brief — the evidence is in the report section named.*

### 1 — Planning your project

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **1.1** Set a clear aim, broken into smaller objectives | §1 (+ scorecard in §5) | One testable aim ("can a computer tell it's you from your typing rhythm?"), split into five *numbered, measurable* objectives (O1–O5), each with an explicit "done when…" success test — then marked hit/miss honestly against the results in §5. |
| **1.2** Explained a wider purpose | §1 | Account-takeover from stolen credentials as the real problem (88% of basic web-application attacks), plus the personal incident behind it. |
| **1.3** Identified a range of approaches | §3 | Three genuinely different designs (pure statistics / standard classifier / learned fingerprint) compared in a trade-off table across cost, phrase-independence, feasibility and deployment risk; the classifier ruled out and the hybrid choice justified. |
| **1.4** Described the plan and why I chose it | §3 | The three-part research / serve / product design, and why running classical statistics inside a learned fingerprint is the core idea. |
| **1.5** Planned and organised my time | §1 ("How the project ran") | A planned-vs-actual timeline of six dated build stages, reconstructed from the commit history (Nov 2025–Jul 2026): a +3-week slip on authentication, recovered by compressing the next stage; the exam period scheduled inside the research window; and a +2-week slip on the write-up from the mid-sprint rebuild of the broken honesty test (§4). |

### 2 — Throughout your project

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **2.1** Made good use of materials and people | §9 (Acknowledgements) | Every dataset, library, tool and standard named; an independent project, so the research community stood in for a mentor. |
| **2.2** Researched the background, acknowledged sources | §2 + References | The background synthesises the field's trajectory (hand-built detectors → learned representations, via the ACM survey), brackets it between the 2009 benchmark and TypeNet as two worlds that never meet, and derives the project from the un-asked question between them; 16 references, all primary papers or standards. |

### 3 — Finalising your project

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **3.1** Logical conclusions + implications for the wider world | §6 | The result answers the aim directly; implications drawn for account security, research, and (hedged) accessibility. |
| **3.2** How my actions/decisions affected the outcome | §4 + §8 | The broken-test fix changed every number; and when tuning looked slightly better it failed on the real test, so I kept the original (§5). |
| **3.3** What I learnt and would improve | §8 | Learning to distrust my own results as the key lesson, working solo, and what I'd change next time. |

### 4 — Project-wide

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **4.1** Understanding of the science | §2 + §3 + App. C | The science explained in plain terms in the body; the full model design, settings and statistics in the technical appendix — each deep mechanism (L2-normalisation, batch-hard triplets, Ledoit–Wolf shrinkage) explained in my own words as *why it works*, not just named and cited. |
| **4.2** Ethics and safety decisions | §7 | Typing data as GDPR special-category; consent, data minimisation, fail-safe design, and the measured disparate impact (a 37× error spread). |
| **4.3** Creative thinking | §3 | The core idea: running a classical shrinkage-statistics decision-maker *inside* a learned fingerprint. |
| **4.4** Identified and overcame problems | §4 | Four problems told in full — the broken honesty test, the live crash on a too-consistent typist, the all-zero-columns bug, and the never-measured ensemble — each with root cause, fix and outcome; the full log of thirteen is in the repository. |
| **4.5** Explained the project clearly | Whole report + App. A | Written to be followed without a technical background — an everyday comparison for each hard idea, jargon in a glossary, and the depth kept in a technical appendix. |

---

## Personal reflections

*(These are written from the real project history and are mine to refine — read each through and adjust the phrasing into my own voice before transcribing onto the official form.)*

**Why I chose this project.** It started from a real security incident: an account I cared about was accessed with stolen credentials, and the password had "worked" perfectly for the attacker — a password proves knowledge of a secret, not identity. I wanted to know whether *how* a person types could be a quiet extra layer a stolen password can't defeat.

**How it was / wasn't successful.** It produced an honest, reproducible open-set result (14.2% primary / 10.2% ensemble EER on 16 unseen subjects) and a working live system, and a nested-validation ablation confirmed the configuration was near-optimal. It did *not* beat the 9.6% published baseline on the headline metric — and I reported that rather than switch to a more flattering protocol. The real success was the rigour of the evaluation.

**What I learnt.** The difference between closed- and open-set evaluation, and how easily a flawed protocol produces an impressive-but-meaningless number; why biometrics are measured by EER/DET rather than accuracy; that reproducibility (pinned data, fixed seeds, one-command rerun) is what turns a claim into a result; and that selecting hyperparameters on a small validation fold can overfit noise, so a number that "looks better" can generalise worse. Working without a mentor, I learnt to be my own sceptic.

**What impact it might have on others.** Even a 10% EER typing biometric is useful as a silent *second* factor against account-takeover at zero user effort, and as a future continuous check against session hijacking — provided it is built with consent and fail-safe safeguards. For a field where reproducibility is often weak, a fully pinned, one-command-rerun pipeline is itself a small contribution.

**What I would improve.** Calibrate the confidence scale; run the free-text model on a real large corpus (Aalto); train at scale on GPU; collect a small *consented* dataset of real users; and seek a mentor or peer reviewer earlier, since explaining a result to another person catches errors that re-reading your own code does not.

---

## My mentor

This project was completed **independently, with no mentor or supervisor.** The role a mentor usually plays — the second person who distrusts a convenient result — I had to do myself by auditing my own work, which is how the broken-test mistake (§4) was eventually caught. AI assistance is disclosed in the report's AI-use note: Claude was used as a coding aid, but I wrote the entire report myself. I set the research direction, made every scientific decision, ran and tested all the code, and verified every result.

> **Logistics note (check before submitting).** CREST Gold projects are normally submitted through a registered CREST provider or coordinator, and the official form has a section for a supervisor/teacher to verify the work. Because this is an independent submission with no mentor, **confirm the correct route with CREST first** — email `crest@britishscienceassociation.org` or check the "how to apply" guidance — as you may need to register as an independent participant or have an eligible adult act as the verifying coordinator. Do not leave the verification section blank without confirming what CREST requires.

---

## AI declaration

Per CREST's AI policy, I confirm all AI-assisted content has been referenced and declared. The full disclosure — tool, what it did, and how I checked it — is in the report's **"A note on AI use"** section. On the official application, remember to tick the AI-declaration box.

| | |
|---|---|
| Student name | Devadit Jain |
| Declaration | I confirm this is my own work. |
| Signature / date | *(Sign and date on the official CREST form.)* |
