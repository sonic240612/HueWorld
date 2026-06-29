import os
import struct
import uuid
from datetime import datetime, timedelta
from typing import Optional
from ..config import settings

# ── In-memory store (fallback when Supabase is not configured) ──
_memory_pixels: list[dict] = []


def _use_supabase() -> bool:
    url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
    key = settings.supabase_key or os.getenv("SUPABASE_SERVICE_KEY", "")
    return bool(url and key)


_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        url = settings.supabase_url or os.getenv("SUPABASE_URL", "")
        key = settings.supabase_key or os.getenv("SUPABASE_SERVICE_KEY", "")
        _supabase_client = create_client(url, key)
    return _supabase_client


def _parse_dt(s: str) -> datetime:
    """Parse ISO datetime string, handling 'Z' suffix for Python <3.11.
    Always returns timezone-naive UTC for consistent comparison."""
    dt = datetime.fromisoformat(s.replace("Z", "+00:00").replace(" ", "T"))
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


def _now() -> datetime:
    return datetime.utcnow()


def _is_active(pixel: dict) -> bool:
    return _parse_dt(pixel["expires_at"]) > _now()


# ── Public API ──

def insert_pixel(
    location_wkt: str,
    color: str,
    raw_lat: float,
    raw_lng: float,
    session_id: str,
    expires_at: str,
) -> dict:
    if _use_supabase():
        result = (
            _get_supabase()
            .table("pixels")
            .insert({
                "location": location_wkt,
                "color": color,
                "raw_lat": raw_lat,
                "raw_lng": raw_lng,
                "session_id": session_id,
                "expires_at": expires_at,
            })
            .execute()
        )
        return result.data[0] if result.data else {}
    else:
        pixel = {
            "id": str(uuid.uuid4()),
            "location": location_wkt,
            "color": color,
            "raw_lat": raw_lat,
            "raw_lng": raw_lng,
            "session_id": session_id,
            "created_at": _now().isoformat(),
            "expires_at": expires_at,
        }
        _memory_pixels.append(pixel)
        if len(_memory_pixels) > 10000:
            _memory_pixels[:] = _memory_pixels[-10000:]
        return pixel


def _ewkb_to_lnglat(hex_str: str) -> Optional[tuple[float, float]]:
    try:
        data = bytes.fromhex(hex_str)
    except (ValueError, AttributeError):
        return None
    if len(data) < 25:
        return None
    byte_order = data[0]
    is_little = byte_order == 1
    fmt = '<' if is_little else '>'
    geom_type = struct.unpack(fmt + 'I', data[1:5])[0]
    has_srid = bool(geom_type & 0x20000000)
    offset = 5
    if has_srid:
        offset = 9
    if len(data) < offset + 16:
        return None
    x, y = struct.unpack(fmt + '2d', data[offset:offset + 16])
    return (x, y)


def _parse_location(row: dict) -> Optional[dict]:
    point_str = row.get("location", "")

    coords = None
    if point_str.startswith("POINT"):
        parts = point_str.replace("POINT(", "").replace(")", "").split()
        if len(parts) == 2:
            coords = (float(parts[0]), float(parts[1]))
    else:
        coords = _ewkb_to_lnglat(point_str)

    if coords is not None:
        lng, lat = coords
        return {
            "id": row["id"],
            "lat": lat,
            "lng": lng,
            "color": row["color"],
            "session_id": row["session_id"],
            "created_at": (
                row["created_at"]
                if isinstance(row["created_at"], str)
                else row["created_at"].isoformat()
            ),
        }
    return None


def query_pixels(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    limit: int = 5000,
    since: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> list[dict]:
    if _use_supabase():
        query = (
            _get_supabase()
            .table("pixels")
            .select("id, location, color, session_id, created_at")
            .limit(limit)
        )
        if start:
            query = query.gte("created_at", start)
        if end:
            query = query.lte("created_at", end)
        if not start and not end:
            query = query.gte("expires_at", "now()")
        result = query.execute()
        rows = result.data or []
    else:
        rows = [p for p in _memory_pixels]
        if start:
            start_dt = _parse_dt(start)
            rows = [p for p in rows if _parse_dt(p["created_at"]) >= start_dt]
        if end:
            end_dt = _parse_dt(end)
            rows = [p for p in rows if _parse_dt(p["created_at"]) <= end_dt]
        if not start and not end:
            rows = [p for p in rows if _is_active(p)]
        rows = rows[-limit:] if len(rows) > limit else rows

    pixels = []
    for row in rows:
        parsed = _parse_location(row)
        if parsed and sw_lat <= parsed["lat"] <= ne_lat and sw_lng <= parsed["lng"] <= ne_lng:
            pixels.append(parsed)
    return pixels


def get_all_active_pixels(limit: int = 10000) -> list[dict]:
    if _use_supabase():
        result = (
            _get_supabase()
            .table("pixels")
            .select("color, location")
            .gte("expires_at", "now()")
            .limit(limit)
            .execute()
        )
        return result.data or []
    else:
        return [p for p in _memory_pixels if _is_active(p)][:limit]


def count_active_pixels() -> int:
    if _use_supabase():
        result = (
            _get_supabase()
            .table("pixels")
            .select("id", count="exact")
            .gte("expires_at", "now()")
            .execute()
        )
        return result.count or 0
    else:
        return sum(1 for p in _memory_pixels if _is_active(p))


def delete_expired_pixels() -> int:
    """Remove expired pixels. Returns number of deleted rows."""
    if _use_supabase():
        result = (
            _get_supabase()
            .table("pixels")
            .delete()
            .lt("expires_at", "now()")
            .execute()
        )
        return len(result.data) if result.data else 0
    else:
        before = len(_memory_pixels)
        _memory_pixels[:] = [p for p in _memory_pixels if _is_active(p)]
        return before - len(_memory_pixels)
