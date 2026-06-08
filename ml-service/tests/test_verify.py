from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _profile():
    return {
        "centroid": [0.0, 0.0, 0.0, 0.0],
        "covInverse": [[1.0,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],
        "refs": [[0.01,0,0,0],[0,0.01,0,0],[0.0,0,0.01,0]],
        "threshold": 1.0,
    }

def test_verify_genuine_low_score():
    payload = {"embedding": [0.02, 0.0, 0.0, 0.0],
               "profile": _profile(), "modelVersion": "stub-0"}
    r = client.post("/verify", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["score"] < 1.0
    assert body["riskLevel"] in {"LOW", "MEDIUM", "HIGH"}
    assert 0.0 <= body["confidence"] <= 100.0

def test_verify_impostor_high_score():
    payload = {"embedding": [5.0, 5.0, 5.0, 5.0],
               "profile": _profile(), "modelVersion": "stub-0"}
    r = client.post("/verify", json=payload)
    body = r.json()
    assert body["score"] > 1.0
    assert body["riskLevel"] == "HIGH"
