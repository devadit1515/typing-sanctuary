"""Extended multi-seed study + paired significance test + leave-one-component-out
ensemble ablation. Reuses the EXACT headline training/eval path (train_cmu) so
numbers are comparable to metrics.json. Run from the research/ dir.

Usage: python seed_study.py 42,43,44 out.json
"""
import sys, io, json, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
import numpy as np
from scipy.stats import wilcoxon, ttest_rel
sys.path.insert(0, ".")
from ksbio.seeds import set_global_seed
from ksbio.evaluate import embed_sequences
from ksbio.ensemble import (compute_profile_stats, scaled_manhattan,
                            ledoit_wolf_shrinkage, mahalanobis_distance)
from ksbio.metrics import equal_error_rate
from scripts.train_cmu import (_samples_from_csv, split_subjects,
                               train_on_subjects, Phase1Args)

CSV = "data/cmu/DSL-StrongPasswordData.csv"
seeds = [int(s) for s in sys.argv[1].split(",")]
OUT = sys.argv[2] if len(sys.argv) > 2 else "artifacts/seed_study.json"


def l1c(z, c):
    return float(np.mean(np.abs(z - c)))


def knn(z, refs, k=3):
    d = sorted(float(np.mean(np.abs(z - r))) for r in refs)
    k = min(k, len(d))
    return float(np.mean(d[:k])) if k else 0.0


def comp_scores(test_emb, enroll, comps, centroid, cov_inv):
    out = []
    for z in test_emb:
        t = []
        if "c" in comps:
            t.append(l1c(z, centroid))
        if "n" in comps:
            t.append(knn(z, enroll))
        if "m" in comps:
            t.append(mahalanobis_distance(z, centroid, cov_inv)
                     if cov_inv is not None else l1c(z, centroid))
        out.append(sum(t) / len(t))
    return np.array(out)


VARIANTS = {"full": "cnm", "drop_centroid": "nm", "drop_knn": "cm", "drop_maha": "cn"}

# Resume support: load any per-seed rows already computed, skip those seeds.
import os
results = []
if os.path.exists(OUT):
    try:
        prev = json.load(open(OUT))
        results = prev["results"] if isinstance(prev, dict) and "results" in prev else prev
        results = [r for r in results if "seed" in r]
    except Exception:
        results = []
done = {r["seed"] for r in results}
todo = [s for s in seeds if s not in done]
print(f"resume: {sorted(done)} done, running {todo}")
for sd in todo:
    t0 = time.time()
    set_global_seed(sd)
    samples, by_subject = _samples_from_csv(CSV, sd)
    subs = list(by_subject.keys())
    train_subj, test_subj = split_subjects(subs, sd)
    args = Phase1Args(CSV, "artifacts/_seedstudy_tmp.pt", seed=sd)  # epochs=60, spc=2
    enc, _ = train_on_subjects(by_subject, train_subj, args)
    emb = {s: embed_sequences(enc, [w[0] for w in by_subject[s]],
                              [w[1] for w in by_subject[s]]) for s in test_subj}
    per_primary, per_var = [], {k: [] for k in VARIANTS}
    for tgt in test_subj:
        gen = emb[tgt]
        imp = np.vstack([emb[s] for s in test_subj if s != tgt])
        if len(gen) == 0 or len(imp) == 0:
            continue
        cut = max(1, int(len(gen) * 0.5))
        enroll, gen_test = gen[:cut], gen[cut:]
        if len(gen_test) == 0:
            continue
        profile = compute_profile_stats(enroll)
        gp = np.array([scaled_manhattan(z, profile) for z in gen_test])
        ip = np.array([scaled_manhattan(z, profile) for z in imp])
        eP, _ = equal_error_rate(gp, ip)
        per_primary.append(eP)
        centroid = enroll.mean(0)
        cov_inv = ledoit_wolf_shrinkage(enroll)["inverse"]
        for name, comps in VARIANTS.items():
            gs = comp_scores(gen_test, enroll, comps, centroid, cov_inv)
            is_ = comp_scores(imp, enroll, comps, centroid, cov_inv)
            e, _ = equal_error_rate(gs, is_)
            per_var[name].append(e)
    row = {"seed": sd, "primary": float(np.mean(per_primary))}
    for k in VARIANTS:
        row[k] = float(np.mean(per_var[k]))
    row["secs"] = round(time.time() - t0, 1)
    results.append(row)
    print(json.dumps(row))
    sys.stdout.flush()
    json.dump(results, open(OUT, "w"), indent=2)

prim = np.array([r["primary"] for r in results])
full = np.array([r["full"] for r in results])
agg = {"n_seeds": len(results), "seeds": seeds,
       "primary_mean": float(prim.mean()), "primary_sd": float(prim.std()),
       "full_mean": float(full.mean()), "full_sd": float(full.std())}
for k in VARIANTS:
    a = np.array([r[k] for r in results])
    agg[k + "_mean"] = float(a.mean())
    agg[k + "_sd"] = float(a.std())
if len(results) >= 2:
    try:
        w = wilcoxon(prim, full)
        agg["wilcoxon_stat"] = float(w.statistic)
        agg["wilcoxon_p"] = float(w.pvalue)
    except Exception as e:
        agg["wilcoxon_err"] = str(e)
    agg["ttest_p"] = float(ttest_rel(prim, full).pvalue)
    agg["ensemble_wins"] = int(np.sum(full < prim))
agg["results"] = results
json.dump(agg, open(OUT, "w"), indent=2)
print("AGG " + json.dumps({k: v for k, v in agg.items() if k != "results"}))
