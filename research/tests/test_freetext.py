import os
from ksbio.freetext import load_freetext, sliding_windows

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "freetext_mini.csv")

def test_load_groups_events_by_subject_in_order():
    data = load_freetext(FIX)
    assert set(data.keys()) == {"u1", "u2"}
    assert len(data["u1"]) == 10
    # events stay in typed order (downTime non-decreasing)
    dts = [e.downTime for e in data["u1"]]
    assert dts == sorted(dts)

def test_sliding_windows_respect_size_and_stride():
    data = load_freetext(FIX)
    wins = sliding_windows(data["u1"], size=5, stride=2)
    # 10 events, size 5, stride 2 -> windows starting at 0,2,4 -> 3 windows
    assert len(wins) == 3
    assert all(len(w) == 5 for w in wins)

def test_window_events_have_featurize_attributes():
    data = load_freetext(FIX)
    w = sliding_windows(data["u1"], size=5, stride=5)[0]
    for attr in ("char", "downTime", "upTime"):
        assert hasattr(w[0], attr)
