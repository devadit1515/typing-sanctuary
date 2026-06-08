"""NumPy port of the JS statistical ensemble (classifierEngine, linearAlgebra,
scoreFusion). Parity-tested against hand-computed values. Source of truth for the
verifier used by both the inference service and the research harness."""
import numpy as np

_EPS = 1e-10

def scaled_manhattan(test, profile):
    means, mads = profile["means"], profile["mads"]
    mask = mads >= _EPS
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs(test[mask] - means[mask]) / mads[mask]))

def scaled_euclidean(test, profile):
    means, mads = profile["means"], profile["mads"]
    mask = mads >= _EPS
    if not mask.any():
        return 0.0
    z = (test[mask] - means[mask]) / mads[mask]
    return float(np.sqrt(np.mean(z * z)))

def compute_profile_stats(raw_vectors):
    v = np.asarray(raw_vectors, dtype=float)
    means = v.mean(axis=0)
    medians = np.median(v, axis=0)
    std_devs = v.std(axis=0, ddof=1) if v.shape[0] > 1 else np.zeros(v.shape[1])
    mads = np.mean(np.abs(v - means), axis=0)
    mad_medians = np.mean(np.abs(v - medians), axis=0)
    return {"means": means, "medians": medians, "std_devs": std_devs,
            "mads": mads, "mad_medians": mad_medians}

def ledoit_wolf_shrinkage(samples):
    x = np.asarray(samples, dtype=float)
    n, p = x.shape
    mean = x.mean(axis=0)
    xc = x - mean
    s = (xc.T @ xc) / (n - 1 if n > 1 else 1)
    mu = np.trace(s) / p
    pi_sum = 0.0
    for i in range(n):
        outer = np.outer(xc[i], xc[i])
        diff = outer - s
        pi_sum += np.sum(diff * diff)
    pi_sum /= (n * n)
    target = mu * np.eye(p)
    gamma = np.sum((s - target) ** 2)
    alpha = min(1.0, pi_sum / gamma) if gamma > 0 else 1.0
    alpha = max(0.0, alpha)
    shrunk = (1 - alpha) * s + alpha * target
    try:
        inverse = np.linalg.inv(shrunk)
    except np.linalg.LinAlgError:
        inverse = None
    return {"shrunk_cov": shrunk, "inverse": inverse, "mean": mean, "alpha": alpha}

def mahalanobis_distance(x, mean, cov_inverse):
    diff = np.asarray(x, float) - np.asarray(mean, float)
    d2 = float(diff @ cov_inverse @ diff)
    return float(np.sqrt(max(0.0, d2)))
