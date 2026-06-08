"""Wire contract between the Node app and the inference service (spec section 6.2)."""
from pydantic import BaseModel, Field

EMBED_DIM = 128

class Keystroke(BaseModel):
    char: str
    keyCode: str
    downTime: float
    upTime: float
    position: int
    isCorrect: bool

class EmbedRequest(BaseModel):
    keystrokes: list[Keystroke]
    modelVersion: str

class EmbedResponse(BaseModel):
    embedding: list[float] = Field(min_length=EMBED_DIM, max_length=EMBED_DIM)
    modelVersion: str

class EmbedBatchRequest(BaseModel):
    windows: list[list[Keystroke]]
    modelVersion: str

class EmbedBatchResponse(BaseModel):
    embeddings: list[list[float]]
    modelVersion: str

class Profile(BaseModel):
    centroid: list[float]
    covInverse: list[list[float]] | None = None
    refs: list[list[float]]
    threshold: float

class VerifyRequest(BaseModel):
    embedding: list[float]
    profile: Profile
    modelVersion: str

class VerifyResponse(BaseModel):
    score: float
    confidence: float
    riskLevel: str
    perComponent: dict[str, float]
