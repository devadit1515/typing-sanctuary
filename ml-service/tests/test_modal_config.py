import os

MODAL = os.path.join(os.path.dirname(os.path.dirname(__file__)), "modal_app.py")

def test_modal_app_declares_gpu_and_artifact_env():
    with open(MODAL, encoding="utf-8") as f:
        src = f.read()
    assert "gpu" in src.lower()                       # a GPU is requested
    assert "ML_ARTIFACT_PATH" in src                  # artifact wired via env
    assert "torch" in src.lower()                     # torch in the image
