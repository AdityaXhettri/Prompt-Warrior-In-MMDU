"""HTTP client for the SafetyNet backend."""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx


class SafetyNetClient:
    def __init__(self, base_url: Optional[str] = None) -> None:
        self.base_url = (base_url or os.getenv("SAFETYNET_URL") or "http://localhost:8000").rstrip("/")
        self._client = httpx.Client(base_url=self.base_url, timeout=15.0)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "SafetyNetClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def _get(self, path: str) -> Dict[str, Any]:
        r = self._client.get(path)
        r.raise_for_status()
        return r.json()

    def _post(self, path: str, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
        r = self._client.post(path, json=payload or {})
        r.raise_for_status()
        return r.json()

    def _delete(self, path: str) -> Dict[str, Any]:
        r = self._client.delete(path)
        r.raise_for_status()
        return r.json()

    # ---- endpoints ----
    def status(self) -> Dict[str, Any]:
        return self._get("/status")

    def zones(self, user_id: str) -> list[Dict[str, Any]]:
        return self._get(f"/users/{user_id}/zones")

    def create_zone(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._post("/zones", payload)

    def delete_zone(self, zone_id: str) -> Dict[str, Any]:
        return self._delete(f"/zones/{zone_id}")

    def zone_suggestions(self, user_id: str) -> list[Dict[str, Any]]:
        return self._get(f"/users/{user_id}/zones/suggestions")

    def active_journey(self, user_id: str) -> Dict[str, Any] | None:
        return self._get(f"/users/{user_id}/journeys/active")

    def start_journey(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._post("/journeys", payload)

    def end_journey(self, user_id: str, status: str = "completed") -> Dict[str, Any]:
        return self._post(f"/journeys/{user_id}/end?status={status}")

    def state(self, user_id: str) -> Dict[str, Any]:
        return self._get(f"/users/{user_id}/state")

    def events(self, user_id: str, limit: int = 30) -> list[Dict[str, Any]]:
        return self._get(f"/users/{user_id}/events?limit={limit}")

    def risks(self, user_id: str, limit: int = 10) -> list[Dict[str, Any]]:
        return self._get(f"/users/{user_id}/risks?limit={limit}")

    def alerts(self, user_id: str) -> list[Dict[str, Any]]:
        return self._get(f"/users/{user_id}/alerts")

    def analyze(self, user_id: str) -> Dict[str, Any]:
        return self._post(f"/ai/analyze/{user_id}")

    def move(self, user_id: str, to: Dict[str, float], source: str = "simulator") -> Dict[str, Any]:
        return self._post("/simulate/move", {"user_id": user_id, "to": to, "source": source})

    def sos(self, user_id: str) -> Dict[str, Any]:
        return self._post(f"/sos/{user_id}")

    def check_in(self, user_id: str, ok: bool = True) -> Dict[str, Any]:
        return self._post(f"/check-in/{user_id}?ok={'true' if ok else 'false'}")

    def simulator_start(self, user_id: str, speed_mps: float, scenario: str | None = None) -> Dict[str, Any]:
        qs = f"user_id={user_id}&speed_mps={speed_mps}"
        if scenario:
            qs += f"&scenario={scenario}"
        return self._post(f"/simulator/start?{qs}")

    def simulator_stop(self) -> Dict[str, Any]:
        return self._post("/simulator/stop")

    def simulator_reset(self) -> Dict[str, Any]:
        return self._post("/simulator/reset")

    def simulator_teleport(self, user_id: str, lat: float, lng: float) -> Dict[str, Any]:
        return self._post("/simulator/teleport", {"user_id": user_id, "lat": lat, "lng": lng})

    def simulator_move_to(self, user_id: str, lat: float, lng: float) -> Dict[str, Any]:
        return self._post("/simulator/move-to", {"user_id": user_id, "lat": lat, "lng": lng})

    def simulator_speed(self, speed_mps: float) -> Dict[str, Any]:
        return self._post("/simulator/speed", {"speed_mps": speed_mps})

    def simulator_state(self) -> Dict[str, Any]:
        return self._get("/simulator/state")

    def run_scenario(self, name: str) -> Dict[str, Any]:
        return self._post(f"/scenarios/{name}")

    def reports(self) -> list[Dict[str, Any]]:
        return self._get("/reports")

    def add_report(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._post("/reports", payload)

    def hotspots(self) -> list[Dict[str, Any]]:
        return self._get("/hotspots")

    def contacts(self, user_id: str) -> list[Dict[str, Any]]:
        return self._get(f"/users/{user_id}/contacts")
