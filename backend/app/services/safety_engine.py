"""Deterministic Safety Engine.

Pure rule layer. Produces a list of `Signal` objects describing objective
observations. The AI engine combines these signals to produce a final
risk assessment. Keeping the rules deterministic makes the system
debuggable, testable, and explainable.
"""
from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from ..core.config import get_settings
from ..core.geo import haversine_m, is_inside_zone, point_to_polyline_m
from ..db.store import Store
from ..models.schemas import (
    Journey,
    LatLng,
    SafetyEvent,
    SafetyState,
    SafetyZone,
)
from .ai_engine import Signal, ai_engine

log = logging.getLogger("safetynet.engine")
settings = get_settings()


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class SafetyEngine:
    """Stateless facade. All state lives in the Store."""

    def __init__(self, store: Store) -> None:
        self.store = store

    # ---------------- public API ----------------
    async def ingest_location(
        self,
        user_id: str,
        location: LatLng,
        *,
        source: str = "real",
        create_update_event: bool = True,
    ) -> Tuple[SafetyEvent, SafetyState, List[Signal]]:
        journey = self.store.active_journey(user_id)
        signals: List[Signal] = []
        previous_zone = self.store.get_state(user_id).current_zone_id

        # 1. Zone check.
        zones = self.store.list_zones(user_id)
        inside_zone: Optional[SafetyZone] = None
        for z in zones:
            if is_inside_zone(location, z.center, z.radius_m):
                inside_zone = z
                break

        event_type = "simulator_move" if source == "simulator" else "location_update"
        event = SafetyEvent(
            user_id=user_id,
            journey_id=journey.id if journey else None,
            type=event_type,  # type: ignore[arg-type]
            location=location,
            payload={"source": source},
        )
        self.store.add_event(event)

        # Zone transitions.
        if inside_zone and previous_zone != inside_zone.id:
            self.store.add_event(
                SafetyEvent(
                    user_id=user_id,
                    journey_id=journey.id if journey else None,
                    type="zone_enter",
                    location=location,
                    payload={"zone_id": inside_zone.id, "label": inside_zone.label},
                )
            )
        elif not inside_zone and previous_zone:
            self.store.add_event(
                SafetyEvent(
                    user_id=user_id,
                    journey_id=journey.id if journey else None,
                    type="zone_exit",
                    location=location,
                    payload={"zone_id": previous_zone},
                )
            )

        # Update state.
        state = self.store.get_state(user_id)
        state.current_zone_id = inside_zone.id if inside_zone else None

        # 2. Route deviation, if journey is active.
        if journey and journey.expected_route:
            deviation = point_to_polyline_m(location, journey.expected_route)
            if deviation > settings.route_deviation_m:
                signals.append(
                    Signal(
                        name="route_deviation",
                        weight=0.55,
                        detail=f"User is {int(deviation)}m off the expected route.",
                    )
                )
                self.store.add_event(
                    SafetyEvent(
                        user_id=user_id,
                        journey_id=journey.id,
                        type="route_deviation",
                        location=location,
                        payload={"deviation_m": int(deviation)},
                    )
                )

        # 3. ETA delay.
        if journey:
            now = _now()
            if now > journey.expected_arrival_at:
                delay = int((now - journey.expected_arrival_at).total_seconds())
                if delay > settings.eta_delay_threshold_s:
                    signals.append(
                        Signal(
                            name="eta_delay",
                            weight=0.35,
                            detail=f"ETA exceeded by {delay // 60} minutes.",
                        )
                    )
                    self.store.add_event(
                        SafetyEvent(
                            user_id=user_id,
                            journey_id=journey.id,
                            type="eta_delay",
                            location=location,
                            payload={"delay_s": delay},
                        )
                    )

        # 4. Inactivity.
        last_at = self.store.last_location_at.get(user_id)
        if last_at:
            gap = time.time() - last_at
            if gap > settings.inactivity_threshold_s:
                signals.append(
                    Signal(
                        name="inactivity",
                        weight=0.25,
                        detail=f"No updates for {int(gap)}s.",
                    )
                )
                self.store.add_event(
                    SafetyEvent(
                        user_id=user_id,
                        journey_id=journey.id if journey else None,
                        type="inactivity",
                        location=location,
                        payload={"gap_s": int(gap)},
                    )
                )

        # 5. Familiarity.
        if journey and journey.familiarity == "unfamiliar":
            signals.append(
                Signal(
                    name="unfamiliar_destination",
                    weight=0.1,
                    detail="Destination is not in user's familiar-route history.",
                )
            )

        # 6. Zone exit while journey active.
        if journey and previous_zone and not inside_zone:
            signals.append(
                Signal(
                    name="zone_exit_after_start",
                    weight=0.15,
                    detail="User left a Safety Zone after starting a journey.",
                )
            )

        # 7. Manual SOS short-circuit.
        if event.payload.get("manual_sos"):
            signals.append(Signal(name="manual_sos", weight=1.0, detail="User pressed SOS."))

        # AI assessment.
        risk = await ai_engine.assess(
            state=state,
            signals=signals,
            recent_events=self.store.recent_events(user_id, limit=12),
        )
        state.last_risk = risk
        state.safety_level = risk.safety_level
        self.store.risks.append(risk)

        # Publish realtime updates.
        from .bus import bus

        await bus.publish(f"state:{user_id}", state.model_dump(mode="json"))
        await bus.publish(f"events:{user_id}", event.model_dump(mode="json"))
        await bus.publish(f"risk:{user_id}", risk.model_dump(mode="json"))

        return event, state, signals

    # ---------------- journey helpers ----------------
    async def start_journey(
        self,
        user_id: str,
        destination: LatLng,
        destination_label: Optional[str],
        expected_arrival_at: datetime,
        trusted_contact_id: Optional[str],
        origin: Optional[LatLng] = None,
    ) -> Journey:
        # Build a simple expected route (straight line sampled) if Maps API
        # is not configured. The actual route geometry is rendered client-side
        # from the same coordinate list.
        if origin is None:
            last = list(self.store.recent_locations.get(user_id, []))
            origin = last[-1] if last else destination

        expected_route = _interpolate(origin, destination, steps=24)

        # Familiarity signature: origin->destination bucket.
        sig = _route_signature(origin, destination)
        visits = sum(
            1
            for j in self.store.journeys.values()
            if j.user_id == user_id and j.route_signature == sig
        )
        familiarity = "familiar" if visits >= 3 else "unfamiliar"

        journey = Journey(
            user_id=user_id,
            destination=destination,
            destination_label=destination_label,
            expected_arrival_at=expected_arrival_at,
            trusted_contact_id=trusted_contact_id,
            expected_route=expected_route,
            familiarity=familiarity,  # type: ignore[arg-type]
            route_signature=sig,
        )
        self.store.journeys[journey.id] = journey
        self.store.get_state(user_id).active_journey_id = journey.id

        self.store.add_event(
            SafetyEvent(
                user_id=user_id,
                journey_id=journey.id,
                type="journey_start",
                location=origin,
                payload={
                    "destination": destination.model_dump(),
                    "familiar": familiarity == "familiar",
                },
            )
        )
        from .bus import bus

        await bus.publish(f"state:{user_id}", self.store.get_state(user_id).model_dump(mode="json"))
        return journey

    async def end_journey(self, user_id: str, *, status: str = "completed") -> Optional[Journey]:
        j = self.store.active_journey(user_id)
        if not j:
            return None
        j.status = status  # type: ignore[arg-type]
        j.ended_at = _now()
        self.store.get_state(user_id).active_journey_id = None
        self.store.add_event(
            SafetyEvent(
                user_id=user_id,
                journey_id=j.id,
                type="journey_end",
                payload={"status": status},
            )
        )
        from .bus import bus

        await bus.publish(f"state:{user_id}", self.store.get_state(user_id).model_dump(mode="json"))
        return j

    # ---------------- familiar suggestions ----------------
    def suggest_familiar_zones(self, user_id: str) -> List[Tuple[LatLng, int]]:
        """Return clusters of recent locations ranked by visit count."""
        from collections import defaultdict

        clusters: dict[str, list[LatLng]] = defaultdict(list)
        for loc in self.store.recent_locations.get(user_id, []):
            key = f"{round(loc.lat, 3)}:{round(loc.lng, 3)}"
            clusters[key].append(loc)
        ranked = sorted(clusters.items(), key=lambda kv: len(kv[1]), reverse=True)
        out: List[Tuple[LatLng, int]] = []
        for key, locs in ranked[:5]:
            center = LatLng(
                lat=sum(l.lat for l in locs) / len(locs),
                lng=sum(l.lng for l in locs) / len(locs),
            )
            out.append((center, len(locs)))
        return out


def _interpolate(a: LatLng, b: LatLng, steps: int = 16) -> List[LatLng]:
    return [
        LatLng(lat=a.lat + (b.lat - a.lat) * t / steps, lng=a.lng + (b.lng - a.lng) * t / steps)
        for t in range(steps + 1)
    ]


def _route_signature(a: LatLng, b: LatLng) -> str:
    h = hashlib.sha1(f"{round(a.lat,2)}:{round(a.lng,2)}->{round(b.lat,2)}:{round(b.lng,2)}".encode()).hexdigest()
    return h[:10]
