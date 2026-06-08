import numpy as np
from ksbio.ensemble import (
    scaled_manhattan, scaled_euclidean, compute_profile_stats,
    ledoit_wolf_shrinkage, mahalanobis_distance,
)

def test_scaled_manhattan_matches_hand_calc():
    # mean=[0,0], mad=[1,2]; test=[1,2] -> (|1-0|/1 + |2-0|/2)/2 = (1+1)/2 = 1.0
    profile = {"means": np.array([0.0, 0.0]), "mads": np.array([1.0, 2.0])}
    test = np.array([1.0, 2.0])
    assert abs(scaled_manhattan(test, profile) - 1.0) < 1e-9

def test_scaled_euclidean_matches_hand_calc():
    # sqrt(((1/1)^2 + (2/2)^2)/2) = sqrt((1+1)/2) = 1.0
    profile = {"means": np.array([0.0, 0.0]), "mads": np.array([1.0, 2.0])}
    test = np.array([1.0, 2.0])
    assert abs(scaled_euclidean(test, profile) - 1.0) < 1e-9

def test_compute_profile_stats_shapes():
    vecs = np.array([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])
    stats = compute_profile_stats(vecs)
    assert np.allclose(stats["means"], [3.0, 4.0])
    assert stats["mads"].shape == (2,)

def test_ledoit_wolf_inverse_is_well_conditioned():
    rng = np.random.default_rng(0)
    vecs = rng.normal(size=(20, 5))
    res = ledoit_wolf_shrinkage(vecs)
    assert res["inverse"] is not None
    prod = res["shrunk_cov"] @ res["inverse"]
    assert np.allclose(prod, np.eye(5), atol=1e-6)

def test_mahalanobis_zero_at_mean():
    rng = np.random.default_rng(1)
    vecs = rng.normal(size=(30, 4))
    res = ledoit_wolf_shrinkage(vecs)
    d = mahalanobis_distance(res["mean"], res["mean"], res["inverse"])
    assert abs(d) < 1e-9
