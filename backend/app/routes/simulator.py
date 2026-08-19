"""Simulator routes (HTTP wrapper around SimulatorService)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..db.store import Store, get_store
from ..models.schemas import LatLng
from ..services.simulator import SimulatorService, get_simulator

router = APIRouter()


def _sim(store: Store) -> SimulatorService:
    return get_simulator(store)


def _public_state(s: SimulatorService) -> dict:
    """Return a JSON-safe snapshot of the simulator state."""
    return {
        "user_id": s.state.user_id,
        "running": s.state.running,
        "speed_mps": s.state.speed_mps,
        "position": s.state.position.model_dump() if s.state.position else None,
        "target": s.state.target_pos.model_dump() if s.state.target_pos else None,
        "scenario": s.state.scenario,
        "started_at": s.state.started_at,
    }


@router.post("/simulator/start")
async def start(
    user_id: str = "demo-user",
    speed_mps: float = 12.0,
    scenario: Optional[str] = None,
    store: Store = Depends(get_store),
) -> dict:
    s = _sim(store)
    await s.start(user_id, speed_mps, scenario)
    return {"ok": True, "state": _public_state(s)}


@router.post("/simulator/stop")
async def stop(store: Store = Depends(get_store)) -> dict:
    s = _sim(store)
    await s.stop()
    return {"ok": True}


@router.post("/simulator/reset")
async def reset(store: Store = Depends(get_store)) -> dict:
    s = _sim(store)
    await s.reset()
    return {"ok": True}


@router.post("/simulator/teleport")
async def teleport(payload: dict, store: Store = Depends(get_store)) -> dict:
    s = _sim(store)
    user_id = payload.get("user_id", "demo-user")
    to = LatLng(lat=payload["lat"], lng=payload["lng"])
    await s.teleport(user_id, to)
    return {"ok": True}


@router.post("/simulator/move-to")
async def move_to(payload: dict, store: Store = Depends(get_store)) -> dict:
    s = _sim(store)
    user_id = payload.get("user_id", "demo-user")
    target = LatLng(lat=payload["lat"], lng=payload["lng"])
    await s.move_to(user_id, target)
    return {"ok": True}


@router.post("/simulator/speed")
async def set_speed(payload: dict, store: Store = Depends(get_store)) -> dict:
    s = _sim(store)
    await s.set_speed(float(payload["speed_mps"]))
    return {"ok": True, "speed_mps": s.state.speed_mps}


@router.get("/simulator/state")
async def sim_state(store: Store = Depends(get_store)) -> dict:
    s = _sim(store)
    return _public_state(s)
