"""Verification decision in embedding space (spec section 5.2). Self-contained
copy of the ensemble functions; canonical version + parity tests live in
research/ksbio/ensemble.py."""
import math

def _l1_to_centroid(z, centroid):
    return sum(abs(a - b) for a, b in zip(z, centroid)) / len(z)

def _mahalanobis(z, centroid, cov_inv):
    diff = [a - b for a, b in zip(z, centroid)]
    tmp = [sum(cov_inv[i][j] * diff[j] for j in range(len(diff)))
           for i in range(len(diff))]
    d2 = sum(diff[i] * tmp[i] for i in range(len(diff)))
    return math.sqrt(max(0.0, d2))

def _knn(z, refs, k=3):
    dists = sorted(sum(abs(a - b) for a, b in zip(z, r)) / len(z) for r in refs)
    k = min(k, len(dists))
    return sum(dists[:k]) / k if k else 0.0

def _confidence(score, threshold, k=5.0):
    if threshold <= 0:
        return 100.0 if score <= 0.1 else 0.0
    val = 100.0 / (1.0 + math.exp(k * (score / threshold - 1.0)))
    return round(min(100.0, max(0.0, val)), 2)

def verify(embedding, profile):
    centroid = profile["centroid"]
    refs = profile["refs"]
    threshold = profile["threshold"]
    cov_inv = profile.get("covInverse")

    manhattan = _l1_to_centroid(embedding, centroid)
    knn = _knn(embedding, refs)
    maha = _mahalanobis(embedding, centroid, cov_inv) if cov_inv else manhattan

    components = {"manhattan": manhattan, "knn": knn, "maha": maha}
    score = sum(components.values()) / len(components)

    confidence = _confidence(score, threshold)
    risk = "LOW" if confidence >= 85 else "MEDIUM" if confidence >= 50 else "HIGH"
    return {"score": score, "confidence": confidence, "riskLevel": risk,
            "perComponent": components}
