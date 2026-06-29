import math
from typing import Dict, List, Optional, Tuple
from fastapi import APIRouter, Query
from ..models.stats import (
    GlobalStatsResponse,
    ViewportStatsResponse,
    CountryRankingResponse,
    RegionStatsResponse,
    ColorDistribution,
    CountryStat,
)
from ..services.store import get_all_active_pixels, count_active_pixels
from ..services.aggregation import (
    get_dominant_from_rows,
    get_color_distribution,
    average_color,
)
from ..services.countries import find_country

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _parse_location(row: dict) -> Optional[Tuple[float, float]]:
    point_str = row.get("location", "")
    coords = point_str.replace("POINT(", "").replace(")", "").split()
    if len(coords) == 2:
        return (float(coords[1]), float(coords[0]))
    return None


@router.get("/global", response_model=GlobalStatsResponse)
async def get_global_stats():
    rows = get_all_active_pixels(10000)
    avg_color = get_dominant_from_rows(rows)
    pixel_count = count_active_pixels()
    return GlobalStatsResponse(avg_color=avg_color, pixel_count=pixel_count)


@router.get("/viewport", response_model=ViewportStatsResponse)
async def get_viewport_stats(
    sw_lat: float = Query(...),
    sw_lng: float = Query(...),
    ne_lat: float = Query(...),
    ne_lng: float = Query(...),
):
    all_rows = get_all_active_pixels(5000)
    filtered = []
    for row in all_rows:
        loc = _parse_location(row)
        if loc and sw_lat <= loc[0] <= ne_lat and sw_lng <= loc[1] <= ne_lng:
            filtered.append(row)

    dominant = get_dominant_from_rows(filtered)
    distribution = get_color_distribution(filtered)

    return ViewportStatsResponse(
        dominant_color=dominant,
        color_distribution=[
            ColorDistribution(color=d["color"], count=d["count"])
            for d in distribution
        ],
    )


@router.get("/countries", response_model=CountryRankingResponse)
async def get_country_rankings():
    rows = get_all_active_pixels(20000)

    country_colors: Dict[str, List[str]] = {}
    for row in rows:
        loc = _parse_location(row)
        if not loc:
            continue
        country = find_country(loc[0], loc[1])
        if country:
            country_colors.setdefault(country, []).append(row["color"])

    stats = []
    for country, colors in country_colors.items():
        stats.append(CountryStat(
            country=country,
            avg_color=average_color(colors),
            pixel_count=len(colors),
        ))

    stats.sort(key=lambda s: -s.pixel_count)
    return CountryRankingResponse(countries=stats[:50])


@router.get("/region", response_model=RegionStatsResponse)
async def get_region_stats(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(default=500, ge=1, le=20000),
):
    rows = get_all_active_pixels(20000)

    lat_deg = radius_km / 111.32
    cos_lat = abs(math.cos(math.radians(lat))) or 1
    lng_deg = radius_km / (111.32 * cos_lat)

    nearby = []
    for row in rows:
        loc = _parse_location(row)
        if loc and abs(loc[0] - lat) <= lat_deg and abs(loc[1] - lng) <= lng_deg:
            dlat = loc[0] - lat
            dlng = loc[1] - lng
            dist_km = math.sqrt(dlat * dlat + dlng * dlng) * 111.32
            if dist_km <= radius_km:
                nearby.append(row)

    avg_color = get_dominant_from_rows(nearby)
    distribution = get_color_distribution(nearby)

    return RegionStatsResponse(
        avg_color=avg_color,
        pixel_count=len(nearby),
        color_distribution=[
            ColorDistribution(color=d["color"], count=d["count"])
            for d in distribution
        ],
    )


@router.get("/timeline")
async def get_timeline(
    hours: int = Query(default=24, ge=1, le=168),
):
    rows = get_all_active_pixels(50000)
    now = __import__("datetime").datetime.utcnow()
    from ..services.store import _parse_dt

    buckets: Dict[str, int] = {}
    for row in rows:
        created = _parse_dt(row["created_at"])
        age_h = (now - created).total_seconds() / 3600
        if age_h > hours:
            continue
        bucket_key = created.strftime("%Y-%m-%dT%H:00:00Z")
        buckets[bucket_key] = buckets.get(bucket_key, 0) + 1

    timeline = sorted(buckets.items())
    return {
        "timeline": [{"timestamp": k, "count": v} for k, v in timeline],
        "total": sum(buckets.values()),
    }
