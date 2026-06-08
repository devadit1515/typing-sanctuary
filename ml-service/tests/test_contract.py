from app.contract import EmbedRequest, EmbedResponse, Keystroke

def test_embed_request_parses():
    req = EmbedRequest(
        keystrokes=[Keystroke(char="a", keyCode="KeyA", downTime=1.0,
                              upTime=1.1, position=0, isCorrect=True)],
        modelVersion="stub-0",
    )
    assert req.modelVersion == "stub-0"
    assert len(req.keystrokes) == 1

def test_embed_response_shape():
    resp = EmbedResponse(embedding=[0.0] * 128, modelVersion="stub-0")
    assert len(resp.embedding) == 128
