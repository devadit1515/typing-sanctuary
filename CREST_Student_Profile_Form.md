# CREST Gold Award — Student Profile Form

> **What this is.** CREST requires a Student Profile Form submitted *alongside* the report — one per student. It is the assessor's map: for each of the 15 criteria you point to *where in the report* you show it, with an optional short note. This file mirrors the official form (download and transcribe at <https://www.crestawards.org/resources/crest-gold-student-profile-form/>). The "Where" column cites report **sections**; after you export the report to PDF, add the page (and paragraph) numbers the official form asks for, because pagination shifts on export.

---

| | |
|---|---|
| Student / team member's first name | Devadit |
| CREST Award level | **Gold** |
| Project title | Can you be recognised by the way you type? Building and testing an open-set keystroke-dynamics verification system |
| Mentor name | None — independent project (see the note at the end) |

---

## Criteria checklist

*Notes to the assessor are optional and deliberately brief — the evidence is in the report section named.*

### 1 — Planning your project

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **1.1** Set a clear aim, broken into smaller objectives | §1.2 | One testable aim, split into six objectives each with a checkable success condition. |
| **1.2** Explained a wider purpose | §1.1 | Account-takeover from stolen credentials as the real problem; who a silent second factor helps. |
| **1.3** Identified a range of approaches | §3.1 | Three verifier designs compared (statistical / deep classifier / metric embedding) and the choice justified. |
| **1.4** Described the plan and why I chose it | §3.1–3.2 | The three-part research / serve / product architecture and why that separation makes the science and the product trustworthy. |
| **1.5** Planned and organised my time | §1.3 | Four dated stages, each gating the next, plus the two replanning decisions and their reasons. |

### 2 — Throughout your project

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **2.1** Made good use of materials and people | §10 (+ §3) | Every dataset, library, tool and standard named; an independent project, so the research community stood in for a mentor — stated honestly. |
| **2.2** Researched the background, acknowledged sources | §2 + §12 | A synthesised literature review that locates a specific gap, with author–date references and a fuller dossier. |

### 3 — Finalising your project

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **3.1** Logical conclusions + implications for the wider world | §5 + §8 | Results answer the aim directly; implications drawn for account security, research, and accessibility. |
| **3.2** How my actions/decisions affected the outcome | §7 + §9 | The closed-set fix changed every number; refusing a noisy tuning "win" (§4.4) kept the headline honest. |
| **3.3** What I learnt and would improve | §9 | Closed-vs-open-set as the key lesson, working solo, and what I'd change next time. |

### 4 — Project-wide

| Criterion | Where I show this | Note to the assessor |
|---|---|---|
| **4.1** Understanding of the science | §2 + §3 + App. C | The science explained in plain terms in the body; the full model design, settings and statistics (metric learning, triplet loss, Ledoit–Wolf/Mahalanobis, EER) in the technical appendix. |
| **4.2** Ethics and safety decisions | §6 | Typing data as GDPR special-category; consent, data minimisation, fail-safe design, disparate impact. |
| **4.3** Creative thinking | §3.1 + §5.2 | The core idea: running a classical shrinkage-statistics ensemble *inside* a learned embedding space. |
| **4.4** Identified and overcame problems | §7 | Thirteen problems in problem → root cause → fix → verified form, including a crash only the live system revealed. |
| **4.5** Explained the project clearly | Whole report + App. A | Written to be followed without a technical background (a "how to read" note, an everyday comparison for each hard idea, jargon in a glossary), with the depth kept in the technical appendix. |

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

This project was completed **independently, with no mentor or supervisor.** The role a mentor usually plays — the second person who distrusts a convenient result — I had to do myself by auditing my own work, which is how the closed-set mistake (§7) was eventually caught. AI assistance is disclosed in full in Report §11: I set the research direction, made every scientific decision, ran and tested all the code, and verified every result.

> **Logistics note (check before submitting).** CREST Gold projects are normally submitted through a registered CREST provider or coordinator, and the official form has a section for a supervisor/teacher to verify the work. Because this is an independent submission with no mentor, **confirm the correct route with CREST first** — email `crest@britishscienceassociation.org` or check the "how to apply" guidance — as you may need to register as an independent participant or have an eligible adult act as the verifying coordinator. Do not leave the verification section blank without confirming what CREST requires.

---

## AI declaration

Per CREST's AI policy, I confirm all AI-assisted content has been referenced and declared. The full disclosure — tool, dates, what it did, how I checked it — is in **Report §11**. On the official application, remember to tick the AI-declaration box.

| | |
|---|---|
| Student name | Devadit Jain |
| Declaration | I confirm this is my own work. |
| Signature / date | *(Sign and date on the official CREST form.)* |
