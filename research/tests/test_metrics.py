import numpy as np
from ksbio.metrics import equal_error_rate, far_frr_at_threshold

def test_perfect_separation_zero_eer():
    genuine = np.array([0.1, 0.2, 0.15])
    impostor = np.array([0.8, 0.9, 0.85])
    eer, thr = equal_error_rate(genuine, impostor)
    assert eer < 1e-6

def test_complete_overlap_high_eer():
    genuine = np.array([0.5, 0.5, 0.5])
    impostor = np.array([0.5, 0.5, 0.5])
    eer, thr = equal_error_rate(genuine, impostor)
    assert eer > 0.4

def test_far_frr_at_threshold():
    genuine = np.array([0.1, 0.2, 0.3])
    impostor = np.array([0.4, 0.5, 0.6])
    far, frr = far_frr_at_threshold(genuine, impostor, 0.35)
    assert far == 0.0
    assert frr == 0.0
