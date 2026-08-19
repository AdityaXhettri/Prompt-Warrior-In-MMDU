"""SSE realtime channel.

Clients subscribe to a user's channel and receive JSON events as they're
emitted by the bus. Backed by Supabase Realtime in production; this
in-process implementation makes the demo real-time without external infra.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from ..db.store import Store, get_store
from ..services.bus import bus

router = APIRouter()


@router.get("/stream/{user_id}")
async def stream(user_id: str, request: Request, store: Store = Depends(get_store)) -> StreamingResponse:
    async def event_stream() -> AsyncIterator[bytes]:
        # Send initial state snapshot so the client hydrates immediately.
        snapshot = store.get_state(user_id).model_dump(mode="json")
        yield _sse("snapshot", snapshot)
        channel = f"state:{user_id}"
        q = await bus.subscribe(channel)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield _sse("message", json.loads(msg))
                except asyncio.TimeoutError:
                    yield _sse("ping", {"t": "keepalive"})
        finally:
            await bus.unsubscribe(channel, q)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n".encode()
