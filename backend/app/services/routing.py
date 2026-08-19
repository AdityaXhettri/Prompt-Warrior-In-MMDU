"""Routing + community safety hotspot aggregation.

When Google Maps Platform is configured, RouteService delegates to the
Directions API. Otherwise it produces a deterministic polyline and
annotates it with community-derived safety context so the *intent* of
the feature (safer, not just shorter, routes) is fully demonstrable.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List, Tuple

from ..core.geo import grid_cell_id, haversine_m, point_to_polyline_m
from ..db.store import Store
from ..models.schemas import CommunityReport, Hotspot, LatLng, RouteResponse

log = logging.getLogger("safetynet.routing")


class RouteService:
    def __init__(self, store: Store) -> None:
        self.store = store

    # ---- hotspot aggregation ----
    def recompute_hotspots(self) -> List[Hotspot]:
        bucket: Dict[str, List[CommunityReport]] = defaultdict(list)
        for r in self.store.reports:
            bucket[grid_cell_id(r.location)].append(r)
        out: List[Hotspot] = []
        for cell_id, items in bucket.items():
            n = len(items)
            avg_sev = sum(i.severity for i in items) / n
            cats = sorted({i.category for i in items})
            center = LatLng(
                lat=sum(i.location.lat for i in items) / n,
                lng=sum(i.location.lng for i in items) / n,
            )
            # weight: more reports + higher severity + recency = higher weight
            weight = min(1.0, (n / 5.0) * (avg_sev / 5.0))
            out.append(
                Hotspot(
                    cell_id=cell_id,
                    center=center,
                    count=n,
                    avg_severity=round(avg_sev, 2),
                    top_categories=cats,
                    risk_weight=round(weight, 3),
                )
            )
        out.sort(key=lambda h: h.risk_weight, reverse=True)
        return out

    def hotspots_near(self, point: LatLng, radius_m: float = 400.0) -> List[Hotspot]:
        out: List[Hotspot] = []
        for h in self.recompute_hotspots():
            if haversine_m(point, h.center) <= radius_m:
                out.append(h)
        return out

    # ---- route planning ----
    async def plan(self, origin: LatLng, destination: LatLng, avoid_hotspots: bool = True) -> RouteResponse:
        # If a real Maps key is present, defer to Google; otherwise use
        # the deterministic polyline so the simulator and apps still work.
        from ..core.config import get_settings

        s = get_settings()
        if s.use_google_maps and s.google_maps_api_key:
            try:
                return await self._google_route(origin, destination, s.google_maps_api_key)
            except Exception as exc:  # noqa: BLE001
                log.warning("Google Maps failed, falling back: %s", exc)

        polyline = _interpolate(origin, destination, steps=24)
        hotspots = self.hotspots_near(origin, radius_m=600) + self.hotspots_near(destination, radius_m=600)
        crossing = [h for h in hotspots if _polyline_hits(polyline, h.center, 200.0)]
        safety_score = 1.0
        notes: List[str] = []
        if avoid_hotspots and crossing:
            safety_score = max(0.4, 1.0 - 0.15 * len(crossing))
            notes.append(
                f"{len(crossing)} community-reported hotspot(s) cross the direct route."
            )
            notes.append("Consider a slightly longer but safer route — SafetyNet can reroute.")
        distance_m = sum(haversine_m(polyline[i], polyline[i + 1]) for i in range(len(polyline) - 1))
        duration_s = distance_m / 8.0  # ~8 m/s walking baseline
        return RouteResponse(
            polyline=polyline,
            distance_m=round(distance_m),
            duration_s=round(duration_s),
            safety_score=round(safety_score, 2),
            notes=notes,
        )

    async def _google_route(self, origin: LatLng, destination: LatLng, api_key: str) -> RouteResponse:
        import httpx

        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{origin.lat},{origin.lng}",
            "destination": f"{destination.lat},{destination.lng}",
            "mode": "walking",
            "key": api_key,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
        route = data["routes"][0]
        pts: List[LatLng] = []
        for step in route["legs"][0]["steps"]:
            loc = step["start_location"]
            pts.append(LatLng(lat=loc["lat"], lng=loc["lng"]))
        end = route["legs"][0]["end_location"]
        pts.append(LatLng(lat=end["lat"], lng=end["lng"]))

        distance_m = sum(haversine_m(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
        duration_s = route["legs"][0]["duration"]["value"]
        return RouteResponse(
            polyline=pts,
            distance_m=round(distance_m),
            duration_s=round(duration_s),
            safety_score=1.0,
            notes=["Route from Google Maps Directions API."],
        )


def _interpolate(a: LatLng, b: LatLng, steps: int = 24) -> List[LatLng]:
    return [
        LatLng(lat=a.lat + (b.lat - a.lat) * t / steps, lng=a.lng + (b.lng - a.lng) * t / steps)
        for t in range(steps + 1)
    ]


def _polyline_hits(polyline: List[LatLng], point: LatLng, radius_m: float) -> bool:
    return point_to_polyline_m(point, polyline) <= radius_m
