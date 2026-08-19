# SafetyNet — Architecture Notes

This document explains *why* the system is shaped the way it is, in addition to the surface-level API docs in the README.

## Layered confidence

SafetyNet is built on the principle that **deterministic rules come first and AI comes second**. That reverse order is intentional:

1. The deterministic rule engine produces a small, named list of `Signal` objects (each with a weight 0..1).
2. The AI engine receives those signals — not raw events — and interprets them in context.
3. The output is a structured `RiskAssessment` with level, score, confidence, explanation, and recommended action.

This keeps the system auditable. If the LLM is misbehaving, the signals still explain *why* the system thinks the user is at risk.

## Why a separate "familiar" axis

Unfamiliarity is its own signal with weight 0.10 — present, but deliberately low. The familiar-route engine hashes the origin/destination pair, counts past journeys on the same signature, and labels journeys `familiar` once they're seen 3+ times. This means:

- New places don't panic the system.
- Repeated travel *also* gets explicitly tracked (so that any deviation feels safer to flag).
- The user always retains control over what counts as a Safety Zone.

## Why the simulator is a real pipeline

The interactive simulator is a singleton service inside the backend. Every movement it makes is fed through the same `SafetyEngine.ingest_location` path the real app uses. The points of differentiation are tiny:

- The simulator tags events with `source: "simulator"` instead of `"real"`.
- The simulator can move autonomously, teleport, follow a target, etc.

That's it. The risk engine, the realtime bus, and the alerts do not know or care that the events came from a virtual user. This is what makes the demo honest — judges can see that the same pipeline that protects a real human is what the simulator is exercising.

## Why SSE today, Supabase Realtime tomorrow

The backend already publishes to a per-user event bus. The SSE endpoint `/stream/{user_id}` is a thin subscription over that bus. In production, the same bus adapter can be swapped for `supabase.channel(...).on(...)` — the route surface stays the same.

## Offline queue semantics

The frontend queues events in `localStorage` keyed by `safetynet:offline-buffer`. When the network returns, the user app drains the queue to `/simulate/move`. The deterministic local rule engine ([apps/user-app/src/lib/offline.ts](apps/user-app/src/lib/offline.ts)) provides continuity protection: zone membership, route deviation, and inactivity checks run locally with the same weights as the backend.

## Hands-free emergency

The Optional hands-free emergency ([apps/user-app/src/lib/offline.ts](apps/user-app/src/lib/offline.ts)) watches:

- `devicemotion` for shake-based SOS (acceleration > 30 m/s²).
- A held `Space` key for > 2.5 s (desktop / accessibility fallback).
- Immobility: same coordinates for > 15 min while a journey is active.

All triggers are debounced with a 30 s cooldown to avoid accidental storms.

## Twilio & Google Maps

Both integrations are wrapped behind an interface. When credentials are absent, the system falls back to:

- In-memory alerts that the Guardian Dashboard can inspect.
- A straight-line polyline route computed in `RouteService`.

The fallback is not a stub — it is the same engine, just with different transport. Replacing the fallback with the real services requires no code changes outside the service wrapper.

## Extensibility

- **Schemas** are in [`packages/shared-types`](packages/shared-types). To add a new event type, add it to the union and to the backend's `SafetyEvent.type` literal — TypeScript will surface every consumer that needs to handle it.
- **Routes** are in [`backend/app/routes`](backend/app/routes). Each route file is a thin adapter over the services.
- **Services** are in [`backend/app/services`](backend/app/services). Adding e.g. a `VoiceSOSService` is a matter of writing a new module and a new router.
