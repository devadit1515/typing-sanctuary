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
