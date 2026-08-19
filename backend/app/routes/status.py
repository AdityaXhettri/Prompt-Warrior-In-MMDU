"""Status / health endpoints."""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends

from .. import __version__
from ..db.store import Store, get_store
from ..models.schemas import StatusResponse

router = APIRouter()


@router.get("/status", response_model=StatusResponse)
def status(store: Store = Depends(get_store)) -> StatusResponse:
    last_24h = sum(
        1 for a in store.alerts if (time.time() - a.created_at.timestamp()) < 86400
    )
    active_journeys = sum(1 for j in store.journeys.values() if j.status == "active")
    return StatusResponse(
        ok=True,
        version=__version__,
        uptime_s=round(time.time() - store.started_at, 1),
        users=len(store.users),
        zones=len(store.zones),
        active_journeys=active_journeys,
        alerts_last_24h=last_24h,
    )


@router.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
