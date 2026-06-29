import uuid
from pydantic import BaseModel, field_validator
from datetime import datetime


class PixelCreate(BaseModel):
    lat: float
    lng: float
    color: str
    session_id: str

    @field_validator("session_id")
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError(f"Invalid session_id: must be a valid UUID")
        return v


class PixelResponse(BaseModel):
    id: str
    lat: float
    lng: float
    color: str
    session_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class PixelSubmitResponse(BaseModel):
    id: str
    success: bool
