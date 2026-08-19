"""Smoke tests for the SafetyNet backend.

Run with: `python -m pytest backend/tests` from the repo root after
installing `requirements.txt`. These tests validate the core event
pipeline without requiring external services.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.db import store as store_module
from app.main import app


def _reset_store():
    store_module._store = None  # noqa: SLF001


def _new_store():
    _reset_store()
    return store_module.get_store()


client = TestClient(app)


def test_status_endpoint():
    _new_store()
    r = client.get("/status")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["version"]


def test_zone_create_and_list():
    _new_store()
    r = client.post(
        "/zones",
        json={
            "user_id": "demo-user",
            "label": "Test",
            "center": {"lat": 28.6, "lng": 77.2},
            "radius_m": 100,
            "kind": "custom",
        },
    )
    assert r.status_code == 200
    r2 = client.get("/users/demo-user/zones")
    assert r2.status_code == 200
    zones = r2.json()
    assert any(z["label"] == "Test" for z in zones)


def test_journey_full_flow():
    _new_store()
    now = datetime.now(tz=timezone.utc)
    r = client.post(
        "/journeys",
        json={
            "user_id": "demo-user",
            "destination": {"lat": 28.7041, "lng": 77.1025, "label": "College"},
            "expected_arrival_at": (now + timedelta(minutes=25)).isoformat(),
        },
    )
    assert r.status_code == 200
    jid = r.json()["id"]
    # move along the route
    for t in (0.25, 0.5, 0.75, 1.0):
        r = client.post(
            "/simulate/move",
            json={
                "user_id": "demo-user",
                "to": {"lat": 28.6139 + (28.7041 - 28.6139) * t, "lng": 77.2090 + (77.1025 - 77.2090) * t},
            },
        )
        assert r.status_code == 200
    state = client.get("/users/demo-user/state").json()
    assert state["active_journey_id"] == jid


def test_sos_triggers_emergency():
    _new_store()
    r = client.post("/sos/demo-user")
    assert r.status_code == 200
    state = client.get("/users/demo-user/state").json()
    assert state["safety_level"] == "emergency"


def test_off_route_signals():
    _new_store()
    now = datetime.now(tz=timezone.utc)
    client.post(
        "/journeys",
        json={
            "user_id": "demo-user",
            "destination": {"lat": 28.7041, "lng": 77.1025, "label": "College"},
            "expected_arrival_at": (now + timedelta(minutes=25)).isoformat(),
        },
    )
    # teleport far off-route
    r = client.post(
        "/simulate/move",
        json={"user_id": "demo-user", "to": {"lat": 28.5, "lng": 77.0}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["risk"]["risk_score"] > 0


def test_scenarios_endpoint():
    _new_store()
    for name in ("normal", "route_deviation", "sudden_stop", "missed_check_in",
                 "high_risk_route", "emergency", "full_demo"):
        r = client.post(f"/scenarios/{name}")
        assert r.status_code == 200, name
        assert "steps" in r.json()


def test_simulator_endpoints():
    _new_store()
    client.post("/simulator/start?user_id=demo-user&speed_mps=12")
    client.post("/simulator/teleport", json={"user_id": "demo-user", "lat": 28.6, "lng": 77.2})
    client.post("/simulator/speed", json={"speed_mps": 8.0})
    s = client.get("/simulator/state").json()
    assert s["user_id"] == "demo-user"
    client.post("/simulator/stop")
    client.post("/simulator/reset")
