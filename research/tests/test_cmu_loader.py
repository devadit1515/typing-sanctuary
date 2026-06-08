import os
import numpy as np
from ksbio.data.cmu import load_cmu, genuine_impostor_split

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "cmu_mini.csv")

def test_load_returns_per_subject_matrices():
    data = load_cmu(FIXTURE)
    assert set(data.keys()) == {"s001", "s002"}
    assert data["s001"].shape[0] == 2  # 2 reps
    assert data["s001"].shape[1] == 4  # 4 timing columns

def test_split_is_deterministic():
    data = load_cmu(FIXTURE)
    a = genuine_impostor_split(data, target="s001", seed=42)
    b = genuine_impostor_split(data, target="s001", seed=42)
    assert np.allclose(a["genuine_train"], b["genuine_train"])
    assert np.allclose(a["impostor"], b["impostor"])

def test_split_separates_target_from_others():
    data = load_cmu(FIXTURE)
    s = genuine_impostor_split(data, target="s001", seed=0)
    assert s["impostor"].shape[0] == 2  # only s002 rows
