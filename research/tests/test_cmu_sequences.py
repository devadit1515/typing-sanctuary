import numpy as np
from ksbio.cmu_sequences import row_to_sequence, CMU_PASSWORD_KEYS

def test_password_key_order_is_the_known_cmu_string():
    # The CMU benchmark password is ".tie5Roanl"
    assert "".join(CMU_PASSWORD_KEYS[:10]) == ".tie5Roanl"

def test_reconstructed_times_are_monotonic_and_consistent():
    # Build a synthetic row dict: hold=0.1 for every key, DD=0.3 to next key.
    keys = CMU_PASSWORD_KEYS
    row = {}
    for i, k in enumerate(keys):
        row[f"H.{k}"] = 0.10
    for i in range(len(keys) - 1):
        row[f"DD.{keys[i]}.{keys[i+1]}"] = 0.30
        row[f"UD.{keys[i]}.{keys[i+1]}"] = 0.20
    seq = row_to_sequence(row)
    assert len(seq) == len(keys)
    # down times strictly increase by 0.30 each step
    for i in range(1, len(seq)):
        assert abs(seq[i].downTime - seq[i-1].downTime - 0.30) < 1e-6
    # every hold is 0.10
    for k in seq:
        assert abs((k.upTime - k.downTime) - 0.10) < 1e-6

def test_sequence_objects_have_featurize_compatible_attributes():
    keys = CMU_PASSWORD_KEYS
    row = {f"H.{k}": 0.1 for k in keys}
    for i in range(len(keys) - 1):
        row[f"DD.{keys[i]}.{keys[i+1]}"] = 0.3
    seq = row_to_sequence(row)
    k0 = seq[0]
    for attr in ("char", "keyCode", "downTime", "upTime", "position", "isCorrect"):
        assert hasattr(k0, attr)
