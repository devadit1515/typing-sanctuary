"""Biometric error metrics. Convention: LOWER score = more genuine.
A sample is ACCEPTED when score <= threshold."""
import numpy as np

def far_frr_at_threshold(genuine, impostor, threshold):
    genuine = np.asarray(genuine, float)
    impostor = np.asarray(impostor, float)
    frr = float(np.mean(genuine > threshold)) if genuine.size else 0.0
    far = float(np.mean(impostor <= threshold)) if impostor.size else 0.0
    return far, frr

def equal_error_rate(genuine, impostor):
    """Sweep thresholds; return (EER, threshold) where FAR is closest to FRR."""
    genuine = np.asarray(genuine, float)
    impostor = np.asarray(impostor, float)
    candidates = np.unique(np.concatenate([genuine, impostor]))
    lo = candidates.min() - 1e-6
    hi = candidates.max() + 1e-6
    thresholds = np.concatenate([[lo], candidates, [hi]])
    best_eer, best_thr, best_gap = 1.0, float(thresholds[0]), np.inf
    for thr in thresholds:
        far, frr = far_frr_at_threshold(genuine, impostor, thr)
        gap = abs(far - frr)
        if gap < best_gap:
            best_gap, best_eer, best_thr = gap, (far + frr) / 2.0, float(thr)
    return best_eer, best_thr
