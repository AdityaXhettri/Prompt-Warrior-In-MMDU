"""Pydantic schemas (DTOs) for the SafetyNet API.

Mirrors the shared TS types where possible. Kept in one place so internal
storage, API surface, and tests stay aligned.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


def _new_id() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class LatLng(BaseModel):
    lat: float
    lng: float


class UserProfile(BaseModel):
    id: str = Field(default_factory=_new_id)
    display_name: str
    phone: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)


class TrustedContact(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    name: str
    phone: str
    relation: Optional[str] = None
    is_primary: bool = False


class SafetyZone(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    label: str
    center: LatLng
    radius_m: float = 250
    kind: Literal["home", "college", "hostel", "work", "custom"] = "custom"
    is_familiar_suggestion: bool = False
    created_at: datetime = Field(default_factory=_now)


class CommunityReport(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    location: LatLng
    category: Literal[
        "poor_lighting",
        "harassment",
        "dangerous_crossing",
        "accident",
        "suspicious_activity",
        "broken_streetlight",
        "other",
    ] = "other"
    description: Optional[str] = None
    severity: int = Field(default=3, ge=1, le=5)
    created_at: datetime = Field(default_factory=_now)


class Hotspot(BaseModel):
    cell_id: str
    center: LatLng
    count: int
    avg_severity: float
    top_categories: List[str]
    risk_weight: float  # 0..1


class Journey(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    destination: LatLng
    destination_label: Optional[str] = None
    expected_arrival_at: datetime
    started_at: datetime = Field(default_factory=_now)
    ended_at: Optional[datetime] = None
    status: Literal["planned", "active", "completed", "cancelled", "failed"] = "active"
    trusted_contact_id: Optional[str] = None
    expected_route: List[LatLng] = Field(default_factory=list)
    familiarity: Literal["familiar", "unfamiliar"] = "unfamiliar"
    route_signature: Optional[str] = None


class SafetyEvent(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    journey_id: Optional[str] = None
    type: Literal[
        "location_update",
        "zone_enter",
        "zone_exit",
        "route_deviation",
        "inactivity",
        "eta_delay",
        "missed_check_in",
        "check_in_ok",
        "manual_sos",
        "community_report",
        "simulator_move",
        "journey_start",
        "journey_end",
        "system",
    ]
    location: Optional[LatLng] = None
    payload: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=_now)


class RiskAssessment(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    journey_id: Optional[str] = None
    risk_level: Literal["low", "moderate", "elevated", "high", "critical"]
    risk_score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0.0, le=1.0)
    explanation: str
    recommended_action: str
    contributing_factors: List[str] = Field(default_factory=list)
    safety_level: Literal["normal", "check_in", "guardian_alert", "emergency"]
    created_at: datetime = Field(default_factory=_now)


class SafetyState(BaseModel):
    user_id: str
    safety_level: Literal["normal", "check_in", "guardian_alert", "emergency"] = "normal"
    current_zone_id: Optional[str] = None
    active_journey_id: Optional[str] = None
    last_event_at: Optional[datetime] = None
    last_risk: Optional[RiskAssessment] = None
    pending_check_in: bool = False


class Alert(BaseModel):
    id: str = Field(default_factory=_new_id)
    user_id: str
    journey_id: Optional[str] = None
    level: Literal["normal", "check_in", "guardian_alert", "emergency"]
    channel: Literal["sms", "push", "email", "in_app"] = "in_app"
    message: str
    to: Optional[str] = None
    status: Literal["pending", "sent", "failed", "acknowledged"] = "pending"
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_now)


class StatusResponse(BaseModel):
    ok: bool
    version: str
    uptime_s: float
    users: int
    zones: int
    active_journeys: int
    alerts_last_24h: int


class SimulateMoveRequest(BaseModel):
    user_id: str
    to: LatLng
    speed_mps: Optional[float] = None
    source: Literal["simulator", "real"] = "simulator"


class SimulateMoveResponse(BaseModel):
    event: SafetyEvent
    risk: RiskAssessment
    state: SafetyState


class StartJourneyRequest(BaseModel):
    user_id: str
    destination: LatLng
    destination_label: Optional[str] = None
    expected_arrival_at: datetime
    trusted_contact_id: Optional[str] = None
    origin: Optional[LatLng] = None


class FamiliarSuggestion(BaseModel):
    center: LatLng
    label: str
    visits: int
    suggested_radius_m: float


class RouteRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    avoid_hotspots: bool = True


class RouteResponse(BaseModel):
    polyline: List[LatLng]
    distance_m: float
    duration_s: float
    safety_score: float  # 0..1
    notes: List[str] = Field(default_factory=list)
