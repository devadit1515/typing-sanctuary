import numpy as np
from ksbio.featurize import (
    char_to_id, featurize_window, TIMING_FEATURES, MAX_CHAR_ID,
)

def _ks(char, down, up, pos, correct=True):
    # mimic the service Keystroke (attribute access)
    return type("K", (), {"char": char, "keyCode": "Key" + char.upper(),
                          "downTime": down, "upTime": up,
                          "position": pos, "isCorrect": correct})()

def test_char_to_id_is_stable_and_bounded():
    a = char_to_id("a")
    assert char_to_id("a") == a
    assert 0 <= a < MAX_CHAR_ID
    assert char_to_id("a") != char_to_id("b")

def test_unknown_char_maps_to_zero_bucket():
    assert char_to_id("☃") == 0  # snowman -> UNK bucket

def test_featurize_window_shapes_and_timing_count():
    ks = [_ks("t", 1.00, 1.08, 0), _ks("h", 1.30, 1.36, 1),
          _ks("e", 1.60, 1.69, 2)]
    feats, char_ids = featurize_window(ks)
    assert feats.shape == (3, TIMING_FEATURES)   # one row per keystroke
    assert char_ids.shape == (3,)
    assert char_ids.dtype == np.int64

def test_hold_time_feature_is_up_minus_down():
    ks = [_ks("a", 2.0, 2.1, 0), _ks("b", 2.5, 2.7, 1)]
    feats, _ = featurize_window(ks)
    # column 0 is hold time; first keystroke hold = 0.1
    assert abs(feats[0, 0] - 0.1) < 1e-6

def test_first_keystroke_lag_features_are_zero():
    ks = [_ks("a", 2.0, 2.1, 0), _ks("b", 2.5, 2.7, 1)]
    feats, _ = featurize_window(ks)
    # down-down (col 1) for the first keystroke has no predecessor -> 0
    assert abs(feats[0, 1]) < 1e-9
    # second keystroke down-down = 2.5 - 2.0 = 0.5
    assert abs(feats[1, 1] - 0.5) < 1e-6

def test_flight_and_upup_columns_have_correct_values():
    # two keys: a(down2.0,up2.1) then b(down2.5,up2.7)
    ks = [_ks("a", 2.0, 2.1, 0), _ks("b", 2.5, 2.7, 1)]
    feats, _ = featurize_window(ks)
    # second keystroke: flight (col 2) = down1 - up0 = 2.5 - 2.1 = 0.4
    assert abs(feats[1, 2] - 0.4) < 1e-6
    # second keystroke: up-up (col 3) = up1 - up0 = 2.7 - 2.1 = 0.6
    assert abs(feats[1, 3] - 0.6) < 1e-6

def test_feats_dtype_is_float32():
    ks = [_ks("a", 1.0, 1.1, 0)]
    feats, _ = featurize_window(ks)
    assert feats.dtype == np.float32

def test_empty_window_returns_well_shaped_empty_arrays():
    feats, char_ids = featurize_window([])
    assert feats.shape == (0, TIMING_FEATURES)
    assert char_ids.shape == (0,)
    assert feats.dtype == np.float32
    assert char_ids.dtype == np.int64

def test_features_are_invariant_to_absolute_time_origin():
    # shifting all timestamps by a large constant must not change features
    base = [_ks("t", 1.00, 1.08, 0), _ks("h", 1.30, 1.36, 1),
            _ks("e", 1.60, 1.69, 2)]
    shifted = [_ks("t", 1.00 + 1e6, 1.08 + 1e6, 0),
               _ks("h", 1.30 + 1e6, 1.36 + 1e6, 1),
               _ks("e", 1.60 + 1e6, 1.69 + 1e6, 2)]
    fb, _ = featurize_window(base)
    fs, _ = featurize_window(shifted)
    assert np.allclose(fb, fs, atol=1e-5)
