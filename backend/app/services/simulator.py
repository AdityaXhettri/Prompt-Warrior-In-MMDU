"""Safety Simulator service.

A virtual user that the demo can move around the map. Each movement is
funneled through the same `ingest_location` path the real app uses, so
the simulator is a first-class feed into the safety pipeline — not a
purely visual toy.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Dict, List, Optional

from ..core.geo import haversine_m
from ..db.store import Store
from ..models.schemas import LatLng

log = logging.getLogger("safetynet.sim")


@dataclass
class SimState:
    user_id: str = "demo-user"
    running: bool = False
    speed_mps: float = 12.0  # ~43 km/h on a bike
    position: Optional[LatLng] = None
    target_pos: Optional[LatLng] = None
    scenario: Optional[str] = None
    started_at: Optional[float] = None
    last_tick: Optional[float] = None
    task: Optional[asyncio.Task] = None
    listeners: List[Callable[[dict], Awaitable[None]]] = field(default_factory=list)


class SimulatorService:
    def __init__(self, store: Store) -> None:
        self.store = store
        self.state = SimState()

    # ---------------- control ----------------
    async def start(self, user_id: str, speed_mps: float, scenario: Optional[str] = None) -> None:
        if self.state.running:
            await self.stop()
        self.state.user_id = user_id
        self.state.speed_mps = max(0.5, speed_mps)
        self.state.scenario = scenario
        self.state.running = True
        self.state.started_at = time.time()
        if self.state.position is None:
            # start at the home zone from seeded data
            self.state.position = LatLng(lat=28.6139, lng=77.2090)
        self.state.task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self.state.running = False
        if self.state.task:
            self.state.task.cancel()
            try:
                await self.state.task
            except (asyncio.CancelledError, Exception):
                pass
            self.state.task = None

    async def reset(self) -> None:
        await self.stop()
        self.state.position = LatLng(lat=28.6139, lng=77.2090)
        self.state.target_pos = None
        self.state.scenario = None

    async def teleport(self, user_id: str, to: LatLng) -> None:
        self.state.user_id = user_id
        self.state.position = to
        self.state.target_pos = None
        # Synthesize a location event so the engine reacts.
        from .safety_engine import SafetyEngine

        engine = SafetyEngine(self.store)
        await engine.ingest_location(user_id, to, source="simulator")

    async def move_to(self, user_id: str, target: LatLng) -> None:
        self.state.user_id = user_id
        self.state.target_pos = target
        if self.state.position is None:
            self.state.position = target
        if not self.state.running:
            await self.start(user_id, self.state.speed_mps)

    async def set_speed(self, speed_mps: float) -> None:
        self.state.speed_mps = max(0.5, float(speed_mps))

    # ---------------- internal ----------------
    async def _run(self) -> None:
        from .safety_engine import SafetyEngine

        engine = SafetyEngine(self.store)
        tick_s = 0.5
        while self.state.running:
            try:
                if self.state.position and self.state.target_pos:
                    remaining = haversine_m(self.state.position, self.state.target_pos)
                    step = self.state.speed_mps * tick_s
                    if remaining <= step:
                        self.state.position = self.state.target_pos
                        self.state.target_pos = None
                    else:
                        f = step / remaining
                        self.state.position = LatLng(
                            lat=self.state.position.lat + (self.state.target_pos.lat - self.state.position.lat) * f,
                            lng=self.state.position.lng + (self.state.target_pos.lng - self.state.position.lng) * f,
                        )
                if self.state.position:
                    await engine.ingest_location(
                        self.state.user_id, self.state.position, source="simulator"
                    )
            except asyncio.CancelledError:
                break
            except Exception as exc:  # noqa: BLE001
                log.exception("simulator tick failed: %s", exc)
            await asyncio.sleep(tick_s)


simulator = SimulatorService  # alias for routers


# Singleton instance so HTTP requests share the same running simulator.
_simulator_instance: SimulatorService | None = None


def get_simulator(store: Store) -> SimulatorService:
    global _simulator_instance
    if _simulator_instance is None:
        _simulator_instance = SimulatorService(store)
        _simulator_instance.state.user_id = "demo-user"
    return _simulator_instance
