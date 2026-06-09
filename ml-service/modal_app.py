"""Modal deployment for the inference service (GPU). Mounts the research package
(encoder + featurize + artifact loader) and the trained artifact; serves the
FastAPI app. The artifact is selected by ML_ARTIFACT_PATH inside the image.

Deploy (BILLABLE):  modal deploy modal_app.py
GPU added here per Plan 2; the served model is whatever artifact is mounted.

NOTE: this file is NOT imported by the test suite (importing it requires the
`modal` package, which is intentionally NOT a dependency of the inference
service). The config is validated by a static text check in
tests/test_modal_config.py. requirements.txt already pins torch==2.5.1, so the
image includes torch."""
import os
import modal

image = (
    modal.Image.debian_slim()
    .pip_install_from_requirements("requirements.txt")   # includes torch==2.5.1
    .add_local_dir("../research/ksbio", "/root/research/ksbio")
    .add_local_dir("artifacts", "/root/artifacts")
)

app = modal.App("keystroke-inference")


@app.function(
    image=image,
    gpu="T4",                                    # smallest sane inference GPU
    env={"ML_ARTIFACT_PATH": "/root/artifacts/cmu-v1.pt"},
)
@modal.asgi_app()
def fastapi_app():
    import sys
    sys.path.insert(0, "/root/research")
    from app.main import app as fastapi
    return fastapi
