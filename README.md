# Typing Sanctuary — keystroke-dynamics identity verification

**Live at [typing-sanctuary.onrender.com](https://typing-sanctuary.onrender.com)**

Typing Sanctuary verifies *who is typing* from typing rhythm alone: how long each key is held and the gaps between keys. A password proves you know a secret; typing rhythm is a behavioural biometric that a stolen password cannot fake. This repository holds the full system — the deep metric-learning model, the research pipeline that measures it honestly, and the live web service that runs it end to end.

## Results

Measured open-set on the public CMU keystroke benchmark (51 subjects typing the same password 400 times), scored **only on subjects withheld from training**, averaged over three seeds:

| Decision method | Equal error rate | Reference point |
|---|---|---|
| Simple distance (fair comparison) | **14.2%** | 2009 benchmark's best hand-built method: 9.6% |
| Full blended verifier | **10.2%** | no direct baseline |

It does not beat the 2009 hand-built method on its own ground — and that is reported as the finding, not hidden. The blended verifier's advantage is stability: it won on all 14 random splits tested (Wilcoxon p ≈ 0.0001), and an ablation attributes that to the Ledoit–Wolf Mahalanobis component. The full write-up, with every number, figure and limitation, is in [`crest/`](crest/).

## How it works

1. **Fingerprint.** A small CNN + BiGRU encoder (83k parameters, trains on a laptop CPU in ~23 minutes) reduces one burst of typing to a 128-number embedding. Same-person embeddings cluster; different people sit apart. Trained with batch-hard triplet loss, the method behind face recognition.
2. **Verify.** Classical distance statistics run inside that learned space: distance to the enrolled centroid, to the nearest enrolled samples, and a Ledoit–Wolf Mahalanobis distance that models how a person's own typing varies. Enrolling a new user takes about a dozen samples and no retraining.
3. **Fail safe.** On any failure the service answers "ask for another factor", never "let them in".

## Repository layout

```
server.js, routes/, services/, ...   Express app: accounts, sessions, the typing
                                     platform that collects consented keystroke data
ml-service/                          Stateless FastAPI inference service (embed + verify)
research/                            Training, evaluation and reproduction pipeline
crest/                               Research report (CREST Gold submission) + form
docs/                                Deployment and project documentation
```

## Reproduce the result

The headline numbers re-run from one command on a pinned dataset (SHA-256 checked) with fixed seeds:

```
cd research
pwsh -File scripts/reproduce.ps1   # verify data hash -> train 3 seeds -> assert EERs -> figures
```

CPU-only, roughly 25 minutes, no spend. Versions are pinned in `research/requirements.txt`; see [`research/README.md`](research/README.md) for the manual steps.

## Run the app locally

```
npm install
cp .env.example .env    # set MONGODB_URI, SESSION_SECRET, email credentials
npm start               # Express on :3000
```

The ML service runs separately (`cd ml-service`, see its [README](ml-service/README.md)); the Node app degrades gracefully when it is absent.

## Deployment

Hosted on **Render** (`render.yaml`), with MongoDB Atlas. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Ethics, in brief

Biometric consent is opt-in and revocable. The service stores the derived fingerprint, never the raw typing. The reported model is trained only on the public, anonymised research dataset, not on real users. Verification failures fall back to another factor. The full ethics discussion, including a measured 37× per-person spread in error rate and why that matters for fairness, is in the report.

## Author

Devadit Jain. AI assistance (Claude, as a coding aid) is disclosed in the report's AI-use note. MIT licence.
