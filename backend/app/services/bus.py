"""In-process pub/sub bus used to fan-out realtime updates.

In production this is backed by Supabase Realtime / Postgres logical
replication; for the hackathon demo we keep it in-process so the API
remains a single source of truth for the User App, Guardian Dashboard,
Simulator and CLI without requiring external infra.
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any, AsyncIterator, Dict, Set


class EventBus:
    def __init__(self) -> None:
        self._subs: Dict[str, Set[asyncio.Queue]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def publish(self, channel: str, data: Any) -> None:
        msg = json.dumps(data, default=str)
        async with self._lock:
            queues = list(self._subs.get(channel, set()))
        for q in queues:
            # Non-blocking so a slow consumer never stalls the engine.
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                pass

    async def subscribe(self, channel: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=128)
        async with self._lock:
            self._subs[channel].add(q)
        return q

    async def unsubscribe(self, channel: str, q: asyncio.Queue) -> None:
        async with self._lock:
            self._subs[channel].discard(q)

    async def stream(self, channel: str) -> AsyncIterator[str]:
        q = await self.subscribe(channel)
        try:
            while True:
                msg = await q.get()
                yield msg
        finally:
            await self.unsubscribe(channel, q)


bus = EventBus()
