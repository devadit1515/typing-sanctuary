"""Guard: the legacy ml/ dir must not advertise an unmeasured accuracy target,
and must point readers to the real model in research/ (spec: never claim
accuracy numbers not measured on a real dataset)."""
import os

ML_README = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "README.md")

def test_legacy_readme_has_no_fabricated_eer_target():
    with open(ML_README, encoding="utf-8") as f:
        text = f.read()
    assert "Target" not in text or "EER < 5%" not in text
    assert "LEGACY" in text.upper()
    assert "research/" in text
