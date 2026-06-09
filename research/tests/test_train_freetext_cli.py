import os
from train_freetext import run_phase2, Phase2Args

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "freetext_mini.csv")

def test_phase2_tiny_run_produces_artifact(tmp_path):
    art = os.path.join(tmp_path, "ft_tiny.pt")
    args = Phase2Args(csv_path=FIX, artifact_path=art, embed_dim=16,
                      epochs=2, window=5, stride=2, seed=1, version="ft-tiny")
    res = run_phase2(args)
    assert os.path.exists(art)
    assert res["version"] == "ft-tiny"
    assert res["n_windows"] > 0

def test_phase2_reproducible(tmp_path):
    art = os.path.join(tmp_path, "a.pt")
    args = Phase2Args(csv_path=FIX, artifact_path=art, embed_dim=16,
                      epochs=2, window=5, stride=2, seed=3, version="ft-tiny")
    r1 = run_phase2(args)
    r2 = run_phase2(args)
    assert abs(r1["final_loss"] - r2["final_loss"]) < 1e-6
