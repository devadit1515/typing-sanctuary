import os
from train_cmu import run_phase1, Phase1Args

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "cmu_mini.csv")

def test_phase1_tiny_run_produces_artifact_and_eer(tmp_path):
    art = os.path.join(tmp_path, "cmu_tiny.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=1, version="cmu-tiny")
    result = run_phase1(args)
    assert os.path.exists(art)
    assert "mean_eer" in result
    assert 0.0 <= result["mean_eer"] <= 1.0
    assert result["version"] == "cmu-tiny"

def test_phase1_is_reproducible(tmp_path):
    art = os.path.join(tmp_path, "a.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=5, version="cmu-tiny")
    r1 = run_phase1(args)
    r2 = run_phase1(args)
    assert abs(r1["mean_eer"] - r2["mean_eer"]) < 1e-6

def test_remap_makes_real_cmu_columns_readable():
    # A real-CMU-style row uses key-NAME columns (H.period, H.Shift.r, H.Return);
    # row_to_sequence expects printable-char columns. remap bridges them so the
    # timing features are actually non-zero (not silently all-zero).
    from train_cmu import remap_cmu_columns
    from ksbio.cmu_sequences import row_to_sequence
    from ksbio.featurize import featurize_window
    import numpy as np
    real_row = {
        "subject": "s001",
        "H.period": 0.10, "DD.period.t": 0.30, "UD.period.t": 0.20,
        "H.t": 0.11, "DD.t.i": 0.28, "UD.t.i": 0.18,
        "H.Shift.r": 0.13, "H.Return": 0.09,
    }
    remapped = remap_cmu_columns(real_row)
    # the period hold must now be reachable under the printable-char name
    assert "H.." in remapped and abs(float(remapped["H.."]) - 0.10) < 1e-9
    assert remapped["subject"] == "s001"
    seq = row_to_sequence(remapped)
    feats, _ = featurize_window(seq)
    # at least some timing feature is non-zero (NOT the all-zero degenerate case)
    assert float(np.abs(feats).sum()) > 0.0
