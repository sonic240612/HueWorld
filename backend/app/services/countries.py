import json
import os
from typing import Optional

_COUNTRIES_GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "countries.geojson")

_countries_cache: Optional[list[dict]] = None


def _load_countries() -> list[dict]:
    global _countries_cache
    if _countries_cache is not None:
        return _countries_cache
    if not os.path.exists(_COUNTRIES_GEOJSON_PATH):
        _countries_cache = []
        return _countries_cache
    with open(_COUNTRIES_GEOJSON_PATH, "r") as f:
        data = json.load(f)
    features = data.get("features", [])
    _countries_cache = features
    return features


def _point_in_polygon(lat: float, lng: float, polygon: list) -> bool:
    """Ray casting algorithm for point-in-polygon."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def _point_in_multipolygon(lat: float, lng: float, coordinates: list) -> bool:
    for polygon_list in coordinates:
        if _point_in_polygon(lat, lng, polygon_list[0]):
            return True
    return False


def find_country(lat: float, lng: float) -> Optional[str]:
    features = _load_countries()
    for feature in features:
        props = feature.get("properties", {})
        name = props.get("name", "")
        if not name or props.get("ISO3166-1-Alpha-3", "") == "-99":
            continue
        geometry = feature.get("geometry", {})
        geom_type = geometry.get("type")
        coords = geometry.get("coordinates", [])
        if geom_type == "Polygon":
            if _point_in_polygon(lat, lng, coords[0]):
                return name
        elif geom_type == "MultiPolygon":
            if _point_in_multipolygon(lat, lng, coords):
                return name
    return None
