import math
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _ks(c, dt, ut):
    return {"char": c, "keyCode": "Key" + c.upper(), "downTime": dt,
            "upTime": ut, "position": 0, "isCorrect": True}

def test_embed_is_deterministic_and_128d():
    payload = {"keystrokes": [_ks("a", 1.0, 1.1), _ks("b", 1.3, 1.4)],
               "modelVersion": "stub-0"}
    r1 = client.post("/embed", json=payload)
    r2 = client.post("/embed", json=payload)
    assert r1.status_code == 200
    e1 = r1.json()["embedding"]
    assert len(e1) == 128
    assert e1 == r2.json()["embedding"]

def test_embed_differs_for_different_timings():
    a = client.post("/embed", json={"keystrokes": [_ks("a", 1.0, 1.1)],
                                    "modelVersion": "stub-0"}).json()["embedding"]
    b = client.post("/embed", json={"keystrokes": [_ks("a", 2.0, 2.5)],
                                    "modelVersion": "stub-0"}).json()["embedding"]
    assert a != b

def test_embed_is_l2_normalized():
    e = client.post("/embed", json={"keystrokes": [_ks("a", 1.0, 1.1)],
                                    "modelVersion": "stub-0"}).json()["embedding"]
    norm = math.sqrt(sum(x * x for x in e))
    assert abs(norm - 1.0) < 1e-6
