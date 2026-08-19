"""In-memory store with optional Supabase persistence.

Holds all domain objects. The Supabase adapter is opt-in via `use_supabase`;
when disabled, the in-memory store is authoritative. This keeps the demo
running on a fresh laptop with zero credentials while preserving a clear
production path.
"""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional

from ..core.config import get_settings
from ..models.schemas import (
    Alert,
    CommunityReport,
    Journey,
    LatLng,
    RiskAssessment,
    SafetyEvent,
    SafetyState,
    SafetyZone,
    TrustedContact,
    UserProfile,
)


@dataclass
class Store:
    users: Dict[str, UserProfile] = field(default_factory=dict)
    contacts: Dict[str, TrustedContact] = field(default_factory=dict)
    zones: Dict[str, SafetyZone] = field(default_factory=dict)
    journeys: Dict[str, Journey] = field(default_factory=dict)
    events: Deque[SafetyEvent] = field(default_factory=lambda: deque(maxlen=5000))
    states: Dict[str, SafetyState] = field(default_factory=dict)
    risks: Deque[RiskAssessment] = field(default_factory=lambda: deque(maxlen=2000))
    alerts: Deque[Alert] = field(default_factory=lambda: deque(maxlen=2000))
    reports: List[CommunityReport] = field(default_factory=list)
    # last N locations per user, used for familiar-route detection
    recent_locations: Dict[str, Deque[LatLng]] = field(
        default_factory=lambda: defaultdict(lambda: deque(maxlen=200))
    )
    # last location per user (used by inactivity check)
    last_location_at: Dict[str, float] = field(default_factory=dict)
    started_at: float = field(default_factory=time.time)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    # ----- helpers -----
    def get_state(self, user_id: str) -> SafetyState:
        st = self.states.get(user_id)
        if st is None:
            st = SafetyState(user_id=user_id)
            self.states[user_id] = st
        return st

    def active_journey(self, user_id: str) -> Optional[Journey]:
        for j in self.journeys.values():
            if j.user_id == user_id and j.status == "active":
                return j
        return None

    def list_zones(self, user_id: str) -> List[SafetyZone]:
        return [z for z in self.zones.values() if z.user_id == user_id]

    def add_event(self, ev: SafetyEvent) -> None:
        self.events.append(ev)
        self.last_location_at[ev.user_id] = ev.created_at.timestamp()
        st = self.get_state(ev.user_id)
        st.last_event_at = ev.created_at
        if ev.location:
            self.recent_locations[ev.user_id].append(ev.location)

    def recent_events(self, user_id: str, limit: int = 30) -> List[SafetyEvent]:
        out: List[SafetyEvent] = []
        for ev in reversed(self.events):
            if ev.user_id == user_id:
                out.append(ev)
                if len(out) >= limit:
                    break
        return out


_store: Optional[Store] = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
        # Seed a demo user so the apps and CLI work out of the box.
        demo = UserProfile(id="demo-user", display_name="Demo User", phone="+10000000000")
        _store.users[demo.id] = demo
        _store.contacts["demo-contact-1"] = TrustedContact(
            id="demo-contact-1",
            user_id="demo-user",
            name="Aarav (Guardian)",
            phone="+10000000001",
            relation="Friend",
            is_primary=True,
        )
        _store.zones["demo-zone-home"] = SafetyZone(
            id="demo-zone-home",
            user_id="demo-user",
            label="Home",
            center=LatLng(lat=28.6139, lng=77.2090),
            radius_m=300,
            kind="home",
        )
        _store.zones["demo-zone-college"] = SafetyZone(
            id="demo-zone-college",
            user_id="demo-user",
            label="College",
            center=LatLng(lat=28.7041, lng=77.1025),
            radius_m=400,
            kind="college",
        )
    return _store


settings = get_settings()
