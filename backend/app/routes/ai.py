"""AI Analysis + Scenario demos.

`POST /ai/analyze` runs the AI engine on the current state of a user
without ingesting a new event — useful for the CLI command
`safetynet safety analyze` and the dashboard's "explain" button.

`POST /scenarios/{name}` runs a scripted sequence of events that
produces a deterministic story for the demo. The full demo scenario
walks the audience through a journey that escalates from normal to
emergency.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..core.geo import haversine_m
from ..db.store import Store, get_store
from ..models.schemas import LatLng, RiskAssessment, SafetyEvent
from ..services.ai_engine import Signal, ai_engine
from ..services.safety_engine import SafetyEngine
from ..services.simulator import SimulatorService

router = APIRouter()


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


@router.post("/ai/analyze/{user_id}", response_model=RiskAssessment)
async def analyze(user_id: str, store: Store = Depends(get_store)) -> RiskAssessment:
    state = store.get_state(user_id)
    events = store.recent_events(user_id, limit=20)
    # synthesize signals from the most recent events
    signals: List[Signal] = []
    for e in events[:8]:
        if e.type == "route_deviation":
            signals.append(Signal(name="route_deviation", weight=0.55, detail=str(e.payload)))
        elif e.type == "inactivity":
            signals.append(Signal(name="inactivity", weight=0.25, detail=str(e.payload)))
        elif e.type == "eta_delay":
            signals.append(Signal(name="eta_delay", weight=0.35, detail=str(e.payload)))
        elif e.type == "zone_exit":
            signals.append(Signal(name="zone_exit", weight=0.2, detail=str(e.payload)))
        elif e.type == "manual_sos":
            signals.append(Signal(name="manual_sos", weight=1.0, detail="manual sos"))
        elif e.type == "missed_check_in":
            signals.append(Signal(name="missed_check_in", weight=0.6, detail="no reply"))
    return await ai_engine.assess(state=state, signals=signals, recent_events=events)


@router.post("/scenarios/{name}")
async def run_scenario(name: str, store: Store = Depends(get_store)) -> dict:
    if name not in SCENARIO_BUILDERS:
        raise HTTPException(404, f"unknown scenario: {name}")
    plan = SCENARIO_BUILDERS[name]()
    engine = SafetyEngine(store)
    log = []
    for step in plan:
        kind, payload = step
        if kind == "start":
            j = await engine.start_journey(
                user_id=payload["user_id"],
                destination=payload["destination"],
                destination_label=payload.get("label"),
                expected_arrival_at=payload["expected_arrival_at"],
                trusted_contact_id=payload.get("trusted_contact_id"),
                origin=payload.get("origin"),
            )
            log.append({"step": "start_journey", "journey_id": j.id})
        elif kind == "move":
            await engine.ingest_location(
                payload["user_id"], payload["to"], source="simulator"
            )
            log.append({"step": "move", "to": payload["to"].model_dump()})
        elif kind == "wait":
            await asyncio.sleep(payload["seconds"])
        elif kind == "sos":
            from ..models.schemas import SafetyEvent

            state = store.get_state(payload["user_id"])
            ev = SafetyEvent(
                user_id=payload["user_id"],
                type="manual_sos",
                payload={"manual_sos": True},
            )
            store.add_event(ev)
            risk = await ai_engine.assess(
                state=state,
                signals=[Signal(name="manual_sos", weight=1.0, detail="manual sos")],
                recent_events=store.recent_events(payload["user_id"], limit=12),
            )
            state.last_risk = risk
            state.safety_level = "emergency"
            log.append({"step": "sos", "risk_score": risk.risk_score})
        else:
            raise HTTPException(400, f"unknown step kind: {kind}")
    return {"ok": True, "steps": log}


# ---------- scenario builders ----------


def _home_college_origin() -> LatLng:
    return LatLng(lat=28.6139, lng=77.2090)


def _home_college_destination() -> LatLng:
    return LatLng(lat=28.7041, lng=77.1025)


def _now_plus(minutes: int) -> datetime:
    return _now() + timedelta(minutes=minutes)


def _step_along(a: LatLng, b: LatLng, t: float) -> LatLng:
    return LatLng(lat=a.lat + (b.lat - a.lat) * t, lng=a.lng + (b.lng - a.lng) * t)


SCENARIO_BUILDERS = {
    "normal": lambda: _scn_normal(),
    "route_deviation": lambda: _scn_deviation(),
    "sudden_stop": lambda: _scn_sudden_stop(),
    "missed_check_in": lambda: _scn_missed_checkin(),
    "high_risk_route": lambda: _scn_high_risk(),
    "emergency": lambda: _scn_emergency(),
    "full_demo": lambda: _scn_full(),
}


def _scn_normal():
    a = _home_college_origin()
    b = _home_college_destination()
    return [
        ("start", {
            "user_id": "demo-user",
            "destination": b,
            "label": "College",
            "expected_arrival_at": _now_plus(25),
            "origin": a,
        }),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.25)}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.5)}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.75)}),
        ("move", {"user_id": "demo-user", "to": b}),
    ]


def _scn_deviation():
    a = _home_college_origin()
    b = _home_college_destination()
    off = LatLng(lat=a.lat + 0.005, lng=a.lng + 0.005)
    return [
        ("start", {"user_id": "demo-user", "destination": b, "label": "College",
                   "expected_arrival_at": _now_plus(25), "origin": a}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.3)}),
        ("move", {"user_id": "demo-user", "to": off}),
        ("move", {"user_id": "demo-user", "to": LatLng(lat=off.lat + 0.01, lng=off.lng + 0.01)}),
    ]


def _scn_sudden_stop():
    a = _home_college_origin()
    b = _home_college_destination()
    mid = _step_along(a, b, 0.4)
    return [
        ("start", {"user_id": "demo-user", "destination": b, "label": "College",
                   "expected_arrival_at": _now_plus(25), "origin": a}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.2)}),
        ("move", {"user_id": "demo-user", "to": mid}),
        ("wait", {"seconds": 6}),  # represents inactivity
    ]


def _scn_missed_checkin():
    a = _home_college_origin()
    b = _home_college_destination()
    return [
        ("start", {"user_id": "demo-user", "destination": b, "label": "College",
                   "expected_arrival_at": _now_plus(5), "origin": a}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.2)}),
        ("wait", {"seconds": 8}),
    ]


def _scn_high_risk():
    a = _home_college_origin()
    b = _home_college_destination()
    return [
        ("move", {"user_id": "demo-user", "to": a}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.1)}),
        ("move", {"user_id": "demo-user", "to": LatLng(lat=28.62, lng=77.18)}),  # off-route
        ("move", {"user_id": "demo-user", "to": LatLng(lat=28.63, lng=77.17)}),
        ("wait", {"seconds": 6}),
    ]


def _scn_emergency():
    a = _home_college_origin()
    b = _home_college_destination()
    return [
        ("start", {"user_id": "demo-user", "destination": b, "label": "College",
                   "expected_arrival_at": _now_plus(25), "origin": a}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.3)}),
        ("sos", {"user_id": "demo-user"}),
    ]


def _scn_full():
    a = _home_college_origin()
    b = _home_college_destination()
    return [
        ("start", {"user_id": "demo-user", "destination": b, "label": "College",
                   "expected_arrival_at": _now_plus(25), "origin": a}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.15)}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.35)}),
        ("move", {"user_id": "demo-user", "to": _step_along(a, b, 0.55)}),
        ("move", {"user_id": "demo-user", "to": LatLng(lat=28.66, lng=77.16)}),  # deviates
        ("wait", {"seconds": 6}),
        ("sos", {"user_id": "demo-user"}),
    ]
