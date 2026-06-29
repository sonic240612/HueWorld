import random
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ..models.pixel import PixelCreate, PixelSubmitResponse
from ..services.store import insert_pixel, query_pixels, delete_expired_pixels, count_active_pixels
from ..config import settings

router = APIRouter(prefix="/api/pixels", tags=["pixels"])

_last_submission: dict[str, datetime] = {}


def _apply_jitter(lat: float, lng: float, max_meters: int) -> tuple[float, float]:
    offset_deg = max_meters / 111_320.0
    lat += random.uniform(-offset_deg, offset_deg)
    lng += random.uniform(-offset_deg, offset_deg)
    return round(lat, 5), round(lng, 5)


def _check_cooldown(session_id: str) -> bool:
    now = datetime.utcnow()
    if session_id in _last_submission:
        elapsed = (now - _last_submission[session_id]).total_seconds()
        if elapsed < settings.cooldown_seconds:
            return False
    _last_submission[session_id] = now
    return True


@router.post("", response_model=PixelSubmitResponse)
async def create_pixel(data: PixelCreate):
    if not data.color.startswith("#") or len(data.color) != 7:
        raise HTTPException(status_code=400, detail="Invalid color format")
    if not _check_cooldown(data.session_id):
        raise HTTPException(status_code=429, detail="Cool-down active")

    jittered_lat, jittered_lng = _apply_jitter(data.lat, data.lng, settings.jitter_meters)
    active_count = count_active_pixels()
    ttl = settings.max_ttl_hours if active_count < settings.min_pixel_threshold else settings.pixel_ttl_hours
    expires_at = (datetime.utcnow() + timedelta(hours=ttl)).isoformat()

    created = insert_pixel(
        location_wkt=f"POINT({jittered_lng} {jittered_lat})",
        color=data.color.upper(),
        raw_lat=data.lat,
        raw_lng=data.lng,
        session_id=data.session_id,
        expires_at=expires_at,
    )

    if not created:
        raise HTTPException(status_code=500, detail="Failed to create pixel")

    return PixelSubmitResponse(id=created["id"], success=True)


@router.get("")
async def get_pixels(
    sw_lat: float = Query(...),
    sw_lng: float = Query(...),
    ne_lat: float = Query(...),
    ne_lng: float = Query(...),
    limit: int = Query(default=5000, le=10000),
    since: Optional[str] = Query(default=None, description="ISO timestamp: only pixels created after this time"),
    start: Optional[str] = Query(default=None, description="Time-lapse start (ISO timestamp)"),
    end: Optional[str] = Query(default=None, description="Time-lapse end (ISO timestamp)"),
):
    pixels = query_pixels(sw_lat, sw_lng, ne_lat, ne_lng, limit, since=since, start=start, end=end)
    return {"pixels": pixels}


@router.post("/cleanup")
async def cleanup_pixels():
    """Delete expired pixels. Call periodically (e.g. via cron)."""
    deleted = delete_expired_pixels()
    return {"deleted": deleted}
