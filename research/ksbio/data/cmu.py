"""CMU Killourhy-Maxion loader. Timing columns are those prefixed H./DD./UD.
Returns {subject: ndarray[n_reps, n_features]}."""
import csv
import numpy as np
from ..seeds import set_global_seed

_TIMING_PREFIXES = ("H.", "DD.", "UD.")

def load_cmu(path):
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        cols = [c for c in reader.fieldnames if c.startswith(_TIMING_PREFIXES)]
        by_subject = {}
        for row in reader:
            subj = row["subject"]
            vec = [float(row[c]) for c in cols]
            by_subject.setdefault(subj, []).append(vec)
    return {s: np.array(v, dtype=float) for s, v in by_subject.items()}

def genuine_impostor_split(data, target, seed=42, train_frac=0.5):
    set_global_seed(seed)
    genuine = data[target]
    n = genuine.shape[0]
    idx = np.random.permutation(n)
    cut = max(1, int(n * train_frac))
    train_idx, test_idx = idx[:cut], idx[cut:]
    impostor = np.vstack([m for s, m in data.items() if s != target])
    return {
        "genuine_train": genuine[train_idx],
        "genuine_test": genuine[test_idx],
        "impostor": impostor,
    }
