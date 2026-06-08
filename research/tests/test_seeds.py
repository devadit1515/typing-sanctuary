import numpy as np
from ksbio.seeds import set_global_seed

def test_seed_makes_numpy_deterministic():
    set_global_seed(42)
    a = np.random.rand(5)
    set_global_seed(42)
    b = np.random.rand(5)
    assert np.allclose(a, b)

def test_different_seed_differs():
    set_global_seed(1)
    a = np.random.rand(5)
    set_global_seed(2)
    b = np.random.rand(5)
    assert not np.allclose(a, b)
