from pydantic import BaseModel
from datetime import datetime


class PixelCreate(BaseModel):
    lat: float
    lng: float
    color: str
    session_id: str


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
