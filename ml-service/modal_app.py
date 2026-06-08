"""Modal deployment wrapper for the inference service.
Deploy:  modal deploy modal_app.py
Not invoked by tests; documents the deploy path. GPU added in Plan 2."""
import modal

image = (modal.Image.debian_slim()
         .pip_install_from_requirements("requirements.txt"))

app = modal.App("keystroke-inference")

@app.function(image=image)
@modal.asgi_app()
def fastapi_app():
    from app.main import app as fastapi
    return fastapi
