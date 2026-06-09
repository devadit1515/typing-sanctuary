import os
from train_cmu import run_phase1, run_multiseed, split_subjects, Phase1Args

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "cmu_mini.csv")

def test_phase1_tiny_run_produces_artifact_and_open_set_eer(tmp_path):
    art = os.path.join(tmp_path, "cmu_tiny.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=1, version="cmu-tiny")
    result = run_phase1(args)
    assert os.path.exists(art)
    # New honest API: primary (scaled-Manhattan) + secondary (ensemble) EER.
    assert 0.0 <= result["primary_eer_scaled_manhattan"] <= 1.0
    assert 0.0 <= result["secondary_eer_full_ensemble"] <= 1.0
    assert result["version"] == "cmu-tiny"
    # Open-set: the split actually held subjects out and scored them.
    assert result["n_train_subjects"] + result["n_test_subjects"] == \
        result["n_subjects_total"]
    assert result["n_test_subjects"] >= 2          # >=2 so each has an impostor
    assert result["n_eer_subjects"] >= 1

def test_phase1_is_open_set_no_leakage(tmp_path):
    # The encoder must never be trained on a subject it is later scored on.
    art = os.path.join(tmp_path, "a.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=5, version="cmu-tiny")
    r = run_phase1(args)
    assert set(r["train_subjects"]).isdisjoint(set(r["test_subjects"]))

def test_split_subjects_is_deterministic():
    subs = [f"s{i:03d}" for i in range(20)]
    a = split_subjects(subs, seed=7)
    b = split_subjects(subs, seed=7)
    assert a == b                                  # same seed -> same split
    train, test = a
    assert set(train).isdisjoint(set(test))
    assert sorted(train + test) == sorted(subs)    # partition, nothing dropped

def test_phase1_is_reproducible(tmp_path):
    art = os.path.join(tmp_path, "a.pt")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=5, version="cmu-tiny")
    r1 = run_phase1(args)
    r2 = run_phase1(args)
    assert abs(r1["primary_eer_scaled_manhattan"] -
               r2["primary_eer_scaled_manhattan"]) < 1e-6

def test_metrics_json_is_written_and_well_formed(tmp_path):
    import json
    art = os.path.join(tmp_path, "cmu_tiny.pt")
    mout = os.path.join(tmp_path, "metrics.json")
    args = Phase1Args(csv_path=FIXTURE, artifact_path=art, embed_dim=16,
                      epochs=2, seed=1, version="cmu-tiny")
    run_multiseed(args, [1, 2], metrics_out=mout)
    with open(mout) as f:
        m = json.load(f)
    assert m["eval_protocol"].startswith("open-set")
    assert m["n_train_subjects"] + m["n_test_subjects"] == m["n_subjects_total"]
    assert m["n_seeds"] == 2
    assert m["baseline_eer_published_scaled_manhattan"] == 0.0962
    assert len(m["dataset_sha256"]) == 64           # a real SHA-256 hex digest
    assert 0.0 <= m["primary_eer_mean"] <= 1.0

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
