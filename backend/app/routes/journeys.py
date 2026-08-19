"""Journey, route, and risk endpoints."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from ..db.store import Store, get_store
from ..models.schemas import (
    CommunityReport,
    Hotspot,
    Journey,
    LatLng,
    RiskAssessment,
    RouteRequest,
    RouteResponse,
    SafetyEvent,
    SafetyState,
    SimulateMoveRequest,
    SimulateMoveResponse,
    StartJourneyRequest,
)
from ..services.notifications import NotificationService
from ..services.routing import RouteService
from ..services.safety_engine import SafetyEngine

router = APIRouter()


@router.post("/journeys", response_model=Journey)
async def start_journey(
    payload: StartJourneyRequest, store: Store = Depends(get_store)
) -> Journey:
    engine = SafetyEngine(store)
    return await engine.start_journey(
        user_id=payload.user_id,
        destination=payload.destination,
        destination_label=payload.destination_label,
        expected_arrival_at=payload.expected_arrival_at,
        trusted_contact_id=payload.trusted_contact_id,
        origin=payload.origin,
    )


@router.post("/journeys/{user_id}/end")
async def end_journey(
    user_id: str, status: str = "completed", store: Store = Depends(get_store)
) -> Journey:
    engine = SafetyEngine(store)
    j = await engine.end_journey(user_id, status=status)
    if not j:
        raise HTTPException(404, "no active journey")
    return j


@router.get("/users/{user_id}/journeys/active", response_model=Optional[Journey])
def active_journey(user_id: str, store: Store = Depends(get_store)) -> Optional[Journey]:
    return store.active_journey(user_id)


@router.get("/users/{user_id}/journeys", response_model=List[Journey])
def list_journeys(user_id: str, store: Store = Depends(get_store)) -> List[Journey]:
    return [j for j in store.journeys.values() if j.user_id == user_id]


@router.post("/simulate/move", response_model=SimulateMoveResponse)
async def simulate_move(
    payload: SimulateMoveRequest, store: Store = Depends(get_store)
) -> SimulateMoveResponse:
    engine = SafetyEngine(store)
    event, state, _ = await engine.ingest_location(
        payload.user_id, payload.to, source=payload.source
    )
    assert state.last_risk is not None
    return SimulateMoveResponse(event=event, risk=state.last_risk, state=state)


@router.post("/sos/{user_id}")
async def sos(user_id: str, store: Store = Depends(get_store)) -> dict:
    """Manual SOS — records the event, escalates to emergency, notifies."""
    engine = SafetyEngine(store)
    locator = store.recent_locations.get(user_id, [])
    loc = locator[-1] if locator else None
    # synthesize event
    from ..models.schemas import SafetyEvent

    ev = SafetyEvent(
        user_id=user_id,
        journey_id=store.active_journey(user_id).id if store.active_journey(user_id) else None,
        type="manual_sos",
        location=loc,
        payload={"manual_sos": True},
    )
    store.add_event(ev)
    state = store.get_state(user_id)
    # Use AI engine to bolt-on risks.
    from ..services.ai_engine import Signal, ai_engine

    risk = await ai_engine.assess(
        state=state,
        signals=[Signal(name="manual_sos", weight=1.0, detail="User pressed SOS.")],
        recent_events=store.recent_events(user_id, limit=12),
    )
    state.last_risk = risk
    state.safety_level = "emergency"
    store.risks.append(risk)
    note = NotificationService(store)
    alert = await note.send(
        user_id,
        level="emergency",
        message=(
            f"EMERGENCY: {user_id} pressed SOS. Last known: "
            f"{loc.lat:.5f},{loc.lng:.5f}"
            if loc
            else f"EMERGENCY: {user_id} pressed SOS. Location unknown."
        ),
    )
    from ..services.bus import bus

    await bus.publish(f"state:{user_id}", state.model_dump(mode="json"))
    await bus.publish(f"alerts:{user_id}", alert.model_dump(mode="json"))
    return {"ok": True, "risk": risk.model_dump(mode="json"), "alert": alert.model_dump(mode="json")}


@router.post("/check-in/{user_id}")
async def check_in(user_id: str, ok: bool = True, store: Store = Depends(get_store)) -> dict:
    from ..models.schemas import SafetyEvent

    state = store.get_state(user_id)
    state.pending_check_in = False
    event = SafetyEvent(
        user_id=user_id,
        journey_id=store.active_journey(user_id).id if store.active_journey(user_id) else None,
        type="check_in_ok" if ok else "missed_check_in",
        payload={"ok": ok},
    )
    store.add_event(event)
    # Lower risk after a successful check-in.
    if ok and state.last_risk:
        state.last_risk.risk_score = max(0, state.last_risk.risk_score - 25)
        if state.last_risk.risk_score < 40:
            state.last_risk.risk_level = "low"
            state.safety_level = "normal"
    elif not ok:
        # bump risk on missed check-in
        from ..services.ai_engine import Signal, ai_engine

        risk = await ai_engine.assess(
            state=state,
            signals=[Signal(name="missed_check_in", weight=0.6, detail="User did not respond.")],
            recent_events=store.recent_events(user_id, limit=12),
        )
        state.last_risk = risk
        state.safety_level = risk.safety_level
        store.risks.append(risk)
    from ..services.bus import bus

    await bus.publish(f"state:{user_id}", state.model_dump(mode="json"))
    return {"ok": True, "state": state.model_dump(mode="json")}


@router.get("/users/{user_id}/state", response_model=SafetyState)
def get_state(user_id: str, store: Store = Depends(get_store)) -> SafetyState:
    return store.get_state(user_id)


@router.get("/users/{user_id}/events", response_model=List[SafetyEvent])
def recent_events(user_id: str, limit: int = 30, store: Store = Depends(get_store)) -> List[SafetyEvent]:
    return store.recent_events(user_id, limit=limit)


@router.get("/users/{user_id}/risks", response_model=List[RiskAssessment])
def recent_risks(user_id: str, limit: int = 20, store: Store = Depends(get_store)) -> List[RiskAssessment]:
    out: List[RiskAssessment] = []
    for r in reversed(store.risks):
        if r.user_id == user_id:
            out.append(r)
            if len(out) >= limit:
                break
    return out


@router.post("/routes", response_model=RouteResponse)
async def plan_route(payload: RouteRequest, store: Store = Depends(get_store)) -> RouteResponse:
    svc = RouteService(store)
    return await svc.plan(payload.origin, payload.destination, avoid_hotspots=payload.avoid_hotspots)


@router.get("/hotspots", response_model=List[Hotspot])
def hotspots(store: Store = Depends(get_store)) -> List[Hotspot]:
    return RouteService(store).recompute_hotspots()


@router.get("/users/{user_id}/alerts")
def list_alerts(user_id: str, store: Store = Depends(get_store)) -> List[dict]:
    return [a.model_dump(mode="json") for a in store.alerts if a.user_id == user_id]
