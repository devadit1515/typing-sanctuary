import numpy as np
from ksbio.seeds import set_global_seed

def test_torch_imports_and_seeds_deterministically():
    import torch
    set_global_seed(123)
    a = torch.rand(4)
    set_global_seed(123)
    b = torch.rand(4)
    assert torch.allclose(a, b)

def test_seed_also_sets_numpy():
    set_global_seed(7)
    x = np.random.rand(3)
    set_global_seed(7)
    y = np.random.rand(3)
    assert np.allclose(x, y)
