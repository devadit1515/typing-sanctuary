import io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, ".")
import numpy as np
from scipy.stats import spearmanr, pearsonr
from ksbio.artifact import load_artifact
from ksbio.evaluate import embed_sequences
from scripts.train_cmu import _samples_from_csv, split_subjects

CSV = "data/cmu/DSL-StrongPasswordData.csv"
m = json.load(open("artifacts/metrics.json"))
per = {d["subject"]: d["eer"] for d in m["per_subject_eer"]}

# 1) subject-bootstrap 95% CI on the seed-42 headline EER
vals = np.array(list(per.values()))
rng = np.random.RandomState(0)
boot = np.array([rng.choice(vals, size=len(vals), replace=True).mean() for _ in range(20000)])
lo, hi = np.percentile(boot, [2.5, 97.5])
print("BOOTSTRAP seed42 mean EER=%.4f  95%% subject-bootstrap CI=[%.4f, %.4f]" % (vals.mean(), lo, hi))

# 2) 14-seed component ablation
s = json.load(open("artifacts/seed_study_full.json"))
rows = s["results"] if isinstance(s, dict) and "results" in s else s
def col(k): return np.array([r[k] for r in rows])
print("N seeds =", len(rows))
for k in ["primary", "full", "drop_centroid", "drop_knn", "drop_maha"]:
    a = col(k); print("14SEED %-14s mean=%.4f sd=%.4f" % (k, a.mean(), a.std()))

# 3) per-subject failure diagnostic on the seed-42 encoder
enc, meta = load_artifact("artifacts/cmu-v1.pt")
_, by_subject = _samples_from_csv(CSV, 42)
train_subj, test_subj = split_subjects(list(by_subject.keys()), 42)
emb = {sj: embed_sequences(enc, [w[0] for w in by_subject[sj]], [w[1] for w in by_subject[sj]]) for sj in test_subj}
cent = {sj: emb[sj].mean(0) for sj in test_subj}
def l1(a, b): return float(np.mean(np.abs(a - b)))
diag = []
for sj in test_subj:
    e, c = emb[sj], cent[sj]
    intra = float(np.mean([l1(x, c) for x in e]))                       # within-person spread
    imp = min(l1(c, cent[o]) for o in test_subj if o != sj)             # nearest impostor centroid
    diag.append((sj, per.get(sj, float("nan")), intra, imp, imp / (intra + 1e-9)))
eers = np.array([d[1] for d in diag]); intras = np.array([d[2] for d in diag])
imps = np.array([d[3] for d in diag]); sep = imps / (intras + 1e-9)
print("\nsubj   EER    intra   impNN  separability(imp/intra)")
for d in sorted(diag, key=lambda x: x[1]):
    print("%-5s %.3f  %.4f  %.4f  %.2f" % d)
print("\nSpearman(intra, EER)     r=%.3f p=%.4f" % spearmanr(intras, eers))
print("Spearman(separability,EER) r=%.3f p=%.4f" % spearmanr(sep, eers))
print("Pearson(intra, EER)      r=%.3f p=%.4f" % pearsonr(intras, eers))
