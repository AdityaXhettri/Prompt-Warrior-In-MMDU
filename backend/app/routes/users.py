"""User, contact, and zone CRUD."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..db.store import Store, get_store
from ..models.schemas import (
    CommunityReport,
    FamiliarSuggestion,
    LatLng,
    SafetyZone,
    TrustedContact,
    UserProfile,
)
from ..services.safety_engine import SafetyEngine

router = APIRouter()


# ---------- users ----------
@router.post("/users", response_model=UserProfile)
def create_user(payload: UserProfile, store: Store = Depends(get_store)) -> UserProfile:
    store.users[payload.id] = payload
    return payload


@router.get("/users", response_model=List[UserProfile])
def list_users(store: Store = Depends(get_store)) -> List[UserProfile]:
    return list(store.users.values())


@router.get("/users/{user_id}", response_model=UserProfile)
def get_user(user_id: str, store: Store = Depends(get_store)) -> UserProfile:
    u = store.users.get(user_id)
    if not u:
        raise HTTPException(404, "user not found")
    return u


# ---------- contacts ----------
@router.post("/contacts", response_model=TrustedContact)
def add_contact(payload: TrustedContact, store: Store = Depends(get_store)) -> TrustedContact:
    store.contacts[payload.id] = payload
    return payload


@router.get("/users/{user_id}/contacts", response_model=List[TrustedContact])
def list_contacts(user_id: str, store: Store = Depends(get_store)) -> List[TrustedContact]:
    return [c for c in store.contacts.values() if c.user_id == user_id]


# ---------- zones ----------
@router.post("/zones", response_model=SafetyZone)
def create_zone(payload: SafetyZone, store: Store = Depends(get_store)) -> SafetyZone:
    store.zones[payload.id] = payload
    return payload


@router.get("/users/{user_id}/zones", response_model=List[SafetyZone])
def list_zones(user_id: str, store: Store = Depends(get_store)) -> List[SafetyZone]:
    return store.list_zones(user_id)


@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: str, store: Store = Depends(get_store)) -> dict:
    if zone_id not in store.zones:
        raise HTTPException(404, "zone not found")
    del store.zones[zone_id]
    return {"ok": True}


@router.get("/users/{user_id}/zones/suggestions", response_model=List[FamiliarSuggestion])
def zone_suggestions(user_id: str, store: Store = Depends(get_store)) -> List[FamiliarSuggestion]:
    engine = SafetyEngine(store)
    out: List[FamiliarSuggestion] = []
    for center, visits in engine.suggest_familiar_zones(user_id):
        out.append(
            FamiliarSuggestion(
                center=center,
                label=f"Frequent stop ({visits} visits)",
                visits=visits,
                suggested_radius_m=200.0,
            )
        )
    return out


# ---------- community reports ----------
@router.post("/reports", response_model=CommunityReport)
def add_report(payload: CommunityReport, store: Store = Depends(get_store)) -> CommunityReport:
    store.reports.append(payload)
    return payload


@router.get("/reports", response_model=List[CommunityReport])
def list_reports(store: Store = Depends(get_store)) -> List[CommunityReport]:
    return list(store.reports)
