"""Geo helpers that don't require any external SDK.

Pure-Python Haversine + point-to-polyline distance. Kept dependency-free so
the safety engine remains deterministic and testable.
"""
from __future__ import annotations

import math
from typing import Iterable, List, Tuple

from ..models.schemas import LatLng


EARTH_RADIUS_M = 6_371_000.0


def haversine_m(a: LatLng, b: LatLng) -> float:
    """Great-circle distance between two points in meters."""
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    dlat = lat2 - lat1
    dlng = math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def is_inside_zone(point: LatLng, center: LatLng, radius_m: float) -> bool:
    return haversine_m(point, center) <= radius_m


def point_to_polyline_m(point: LatLng, polyline: Iterable[LatLng]) -> float:
    """Minimum distance in meters from `point` to any segment of `polyline`."""
    pts: List[LatLng] = list(polyline)
    if not pts:
        return float("inf")
    if len(pts) == 1:
        return haversine_m(point, pts[0])
    best = float("inf")
    for i in range(len(pts) - 1):
        d = _point_to_segment_m(point, pts[i], pts[i + 1])
        if d < best:
            best = d
    return best


def _point_to_segment_m(p: LatLng, a: LatLng, b: LatLng) -> float:
    """Distance from point p to segment ab, using local equirectangular projection."""
    # Convert to local meters around `a` for stable projection at hackathon distances.
    cos_lat = math.cos(math.radians(a.lat))
    ax, ay = 0.0, 0.0
    bx = (b.lng - a.lng) * cos_lat * (math.pi / 180.0) * EARTH_RADIUS_M
    by = (b.lat - a.lat) * (math.pi / 180.0) * EARTH_RADIUS_M
    px = (p.lng - a.lng) * cos_lat * (math.pi / 180.0) * EARTH_RADIUS_M
    py = (p.lat - a.lat) * (math.pi / 180.0) * EARTH_RADIUS_M
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def grid_cell_id(p: LatLng, cell_size_deg: float = 0.005) -> str:
    """Stable id for community report aggregation (de-duplication)."""
    ix = int(p.lat / cell_size_deg)
    iy = int(p.lng / cell_size_deg)
    return f"{ix}:{iy}"


def centroid(points: List[LatLng]) -> LatLng:
    n = len(points)
    if n == 0:
        return LatLng(lat=0.0, lng=0.0)
    return LatLng(
        lat=sum(p.lat for p in points) / n,
        lng=sum(p.lng for p in points) / n,
    )
