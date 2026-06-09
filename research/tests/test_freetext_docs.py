import os

DOC = os.path.join(os.path.dirname(__file__), "..", "data", "freetext", "README.md")

def test_freetext_acquisition_doc_exists_and_names_fallback():
    with open(DOC, encoding="utf-8") as f:
        text = f.read().lower()
    assert "buffalo" in text or "clarkson" in text  # the academic corpora
    assert "fallback" in text                        # the game-data plan B
    assert "subject,char,downtime,uptime" in text    # the expected CSV shape
