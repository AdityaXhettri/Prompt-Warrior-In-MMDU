# SafetyNet

> AI-powered personal and community safety platform. SafetyNet watches over you when you travel — not by assuming every unusual event is an emergency, but by watching, checking, understanding context, and escalating only when the evidence warrants it.

Built for **PromptWars × GDGoC MM(DU)** hackathon.

> **Design note.** The UI/UX is built on the visual language of [ClimateGuard](https://github.com/) — the same dark sidebar, the same green accent, the same map-first panel system, the same SOS modal flow — but every feature, type, route, and event in SafetyNet is implemented from scratch with no project-specific code carried over. The shared visual language is the only inheritance.

---

## What is SafetyNet?

SafetyNet is a "safety net" that quietly follows you when you leave a familiar place. It is **three connected interfaces** that all use the same backend and shared safety engine:

| Interface | Audience | Purpose |
|-----------|----------|---------|
| **User App** ([apps/user-app](apps/user-app)) | The traveler | Define Safety Zones, plan Safe Journeys, see live status, file community reports. |
| **Guardian Dashboard** ([apps/guardian-dashboard](apps/guardian-dashboard)) | Trusted contact | Watch the traveler's live map, AI reasoning, risk score, alerts, and check-in state. |
| **SafetyNet CLI + Interactive Simulator** ([cli](cli), [apps/user-app/src/pages/Simulator.tsx](apps/user-app/src/pages/Simulator.tsx)) | Dev / judge | Run scripted scenarios, drive a virtual user, inspect the engine, replay sessions. |

Underneath, a single **FastAPI backend** owns the deterministic safety engine, the AI risk engine, the simulator, the realtime event bus, and the Supabase/PostgreSQL/Maps/Twilio/LLM integrations.

---

## Architecture

```
┌────────────────────┐    ┌────────────────────────┐    ┌──────────────────────┐
│   User App (Vite/  │    │  Guardian Dashboard    │    │  SafetyNet CLI       │
│   React + TS +     │    │  (Vite/React + TS +    │    │  (Python + Rich)     │
│   Tailwind + Map)  │    │  Tailwind + Map)       │    │                      │
└────────┬───────────┘    └────────────┬───────────┘    └──────────┬───────────┘
         │ HTTP + SSE                   │                           │
         └─────────────────────────────┼───────────────────────────┘
                                       │
                                       ▼
              ┌────────────────────────────────────────────────────────┐
              │  FastAPI backend (Python)                              │
              │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
              │  │ Deterministic│  │  AI Risk     │  │  Simulator   │  │
              │  │ Safety Engine│ →│  Engine (LLM │ ←│  Service     │  │
              │  │              │  │  + heuristic)│  │              │  │
              │  └──────────────┘  └──────────────┘  └──────────────┘  │
              │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
              │  │ Routing +    │  │ Notification │  │  Event bus   │  │
              │  │ Hotspots     │  │ (Twilio)     │  │  (SSE/PubSub)│  │
              │  └──────────────┘  └──────────────┘  └──────────────┘  │
              └──────────────────────┬─────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌──────────────┐          ┌──────────────────┐         ┌────────────────────┐
│ Supabase /   │          │ Google Maps      │         │ Twilio (SMS)        │
│ PostgreSQL   │          │ Platform         │         │                    │
└──────────────┘          └──────────────────┘         └────────────────────┘
                                     │
                                     ▼
                          ┌────────────────────┐
                          │ External AI/LLM    │
                          │ (OpenAI-compatible)│
                          └────────────────────┘
```

Shared types live in [`packages/shared-types`](packages/shared-types) so every component agrees on event/state/risk schemas.

---

## Repository layout

```
.
├── apps/
│   ├── user-app/             # React + TS + Vite User App
│   └── guardian-dashboard/   # React + TS + Vite Guardian Dashboard
├── backend/                  # FastAPI safety engine + AI + simulator + realtime
├── cli/                      # SafetyNet CLI (Python)
├── packages/
│   └── shared-types/         # Single source of truth for event model
├── docs/                     # Extra documentation
├── README.md                 # You are here
└── .env.example              # Backend environment variables
```

---

## Quick start

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env                                # optional, leave blank for offline mode
uvicorn app.main:app --reload --port 8000
```

The backend starts at `http://localhost:8000`, with full API docs at `http://localhost:8000/docs`.

Health check:

```bash
curl http://localhost:8000/status
```

### 2. User App

```bash
cd apps/user-app
npm install
npm run dev
```

Open `http://localhost:5173`.

### 3. Guardian Dashboard

```bash
cd apps/guardian-dashboard
npm install
npm run dev
```

Open `http://localhost:5174`.

### 4. SafetyNet CLI

```bash
cd cli
pip install -r requirements.txt
export SAFETYNET_URL=http://localhost:8000
python -m safetynet_cli status
```

### 5. Run the full demo

```bash
# in one terminal
python -m safetynet_cli demo full
```

This walks the audience through a journey that starts normal, deviates, goes silent, escalates via AI, notifies a guardian, then escalates to emergency.

---

## Core philosophy

> **SafetyNet does not assume that every unusual event is an emergency.**

Concrete implications:

- **A single event is never treated as an emergency.** Multiple signals are combined.
- **Unfamiliarity is not danger.** "Unfamiliar destination" is a small weight (0.10), not a trigger.
- **A user response to a check-in materially reduces risk.** Check-in OK drops the risk score by 25 points.
- **Graduated escalation:** Normal → Check-in → Guardian Alert → Emergency.
- **Deterministic, explainable rules first.** The AI engine reasons over named signals and produces structured outputs (level, score, confidence, explanation, recommended action).

---

## Safety states

The platform uses four canonical safety levels, mapped to graduated escalation:

| Level | Meaning | Action |
|-------|---------|--------|
| `normal` | Everything is fine. | Continuous passive monitoring. |
| `check_in` | An anomaly needs user confirmation. | Send in-app or SMS check-in. |
| `guardian_alert` | Repeated anomaly without response. | SMS trusted contact. |
| `emergency` | Manual SOS or strong critical signal. | Notify all guardians, alert operators. |

---

## The event model

Every emission of the safety engine is a `SafetyEvent`:

```ts
type EventType =
  | 'location_update' | 'zone_enter' | 'zone_exit'
  | 'route_deviation' | 'inactivity' | 'eta_delay'
  | 'missed_check_in' | 'check_in_ok' | 'manual_sos'
  | 'community_report' | 'simulator_move'
  | 'journey_start' | 'journey_end' | 'system';
```

Events are additions to the engine. The deterministic engine turns them into **signals** (each with a weight 0..1). The AI engine combines signals into a final **risk assessment**.

| Signal | Weight | Meaning |
|--------|--------|---------|
| `manual_sos` | 1.00 | User pressed SOS. |
| `route_deviation` | 0.55 | User is off the expected route. |
| `missed_check_in` | 0.60 | User didn't respond to a check-in. |
| `eta_delay` | 0.35 | ETA exceeded by >5 min. |
| `inactivity` | 0.25 | No updates for >3 min. |
| `zone_exit_after_start` | 0.15 | Left a Safety Zone mid-journey. |
| `unfamiliar_destination` | 0.10 | Destination not in familiar history. |

The AI engine returns a deterministic structure: `risk_level` (low/moderate/elevated/high/critical), `risk_score` (0–100), `confidence` (0–1), `explanation`, `recommended_action`, `contributing_factors`, and the mapped `safety_level`.

When no LLM is configured, a deterministic heuristic produces the same structure so the demo is fully reproducible.

---

## Safety Zones

A Safety Zone is a familiar geography (home, college, hostel, workplace, or a custom place) with a configurable radius. Users can:

- **Add zones manually** (click on the map).
- **Accept suggestions** from frequent-visited locations offered by the engine.
- **Always retain control** — the engine never silently creates a zone.

Being inside a Safety Zone is the **normal/familiar** state. Crossing its boundary is **not** an automatic emergency — it simply activates Safety Mode (closer attention).

---

## Safe Journeys

A Safe Journey is a deliberate commitment:

1. The user picks a destination, ETA, and trusted contact.
2. The backend computes the expected route (straight-line sampled; Google Directions when configured).
3. The familiar-route engine compares the route signature to past journeys. If the user has done this trip 3+ times, it's `familiar`; otherwise `unfamiliar`. Either way, the journey is active.
4. Every location update generates a `SafetyEvent`. The safety engine runs in real-time.
5. The user can respond to check-ins, cancel, or press SOS.

---

## Deterministic + AI risk engine

The safety engine is split into two clear layers:

1. **Deterministic rules** ([backend/app/services/safety_engine.py](backend/app/services/safety_engine.py)) — pure Python, no LLM. Computes zone membership, route deviation, ETA delay, inactivity, and synthesizes signals.
2. **AI risk engine** ([backend/app/services/ai_engine.py](backend/app/services/ai_engine.py)) — uses an external LLM (OpenAI-compatible) when `USE_LLM=true` and `LLM_API_KEY` is set; otherwise falls back to a weighted-sum heuristic that produces identical structure.

The split is intentional: **rules are auditable, AI is contextual**.

---

## Community safety

Users can file anonymous reports:

- Categories: poor lighting, harassment, dangerous crossing, accident, suspicious activity, broken streetlight, other.
- Severity 1–5.
- Reports are aggregated into **hotspots** by geohash-like grid cells.
- Hotspots are **contextual information** for routing — SafetyNet can recommend a slightly longer but safer route.

The system deliberately **never treats a single report as proof of danger** — only aggregated hotspots with weight > 0 cross the threshold for rerouting.

---

## Offline-safe fallback

The deterministic layer can run locally when the backend is unreachable:

- Events are queued in `localStorage` ([apps/user-app/src/lib/offline.ts](apps/user-app/src/lib/offline.ts)).
- The local JS replica computes zone, route-deviation, and inactivity signals.
- When the network returns, the queue drains back to the backend via `/simulate/move`.

This means a brief loss of signal does not mean a loss of safety.

---

## Hands-free emergency (stretch)

The User App supports two hands-free triggers:

- **Shake detection** (`devicemotion`): a sudden acceleration > 30 m/s² triggers SOS.
- **Long-press spacebar** (desktop / accessibility fallback): holding Space for > 2.5 s triggers SOS.
- **Immobility detection**: the same location for > 15 min while a journey is active triggers SOS.

All triggers debounce with a 30 s cooldown to avoid accidental storms.

---

## Simulator

The interactive simulator is a first-class feed into the safety pipeline — not a fake visualization. Every movement runs through the same `ingest_location` path the real app uses.

Controls:

- **Click on the map** to move the virtual user to a point.
- **W / A / S / D** on the keyboard to step the user.
- **Speed slider** (1–30 m/s) to change movement speed.
- **Start / Pause / Reset** for autonomous movement.
- **Scenarios** (`normal`, `route_deviation`, `sudden_stop`, `missed_check_in`, `high_risk_route`, `emergency`, `full_demo`) for scripted demos.
- **Replay** to step through a recorded event timeline.

The simulator service is a singleton, so all cameras in the User App and Guardian Dashboard see the same virtual user.

---

## CLI

```text
safetynet status
safetynet zone list --user-id demo-user
safetynet zone add --user-id demo-user --label "Home" --lat 28.6 --lng 77.2 --radius 300 --kind home
safetynet zone suggestions --user-id demo-user
safetynet journey start --user-id demo-user --lat 28.7041 --lng 77.1025 --label College --eta 2025-01-01T18:00:00Z
safetynet journey status --user-id demo-user
safetynet state --user-id demo-user
safetynet events --user-id demo-user --limit 20
safetynet risks --user-id demo-user --limit 10
safetynet alerts --user-id demo-user
safetynet safety analyze --user-id demo-user
safetynet sos --user-id demo-user
safetynet check-in --user-id demo-user
safetynet check-in --user-id demo-user --missed
safetynet simulate --user-id demo-user --lat 28.66 --lng 77.16
safetynet simulator start --user-id demo-user --speed 12
safetynet simulator stop
safetynet simulator teleport --user-id demo-user --lat 28.61 --lng 77.20
safetynet simulator move-to --user-id demo-user --lat 28.7 --lng 77.1
safetynet simulator speed --speed 8
safetynet simulator state
safetynet scenario full_demo
safetynet demo full --user-id demo-user
safetynet report add --user-id demo-user --lat 28.61 --lng 77.20 --category poor_lighting --severity 3
safetynet hotspots
safetynet contacts --user-id demo-user
```

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/status` | Health summary |
| GET | `/users/{id}` | User profile |
| GET | `/users/{id}/contacts` | Trusted contacts |
| POST | `/contacts` | Add trusted contact |
| POST | `/zones` | Create Safety Zone |
| GET | `/users/{id}/zones` | List Safety Zones |
| GET | `/users/{id}/zones/suggestions` | Familiar-zone suggestions |
| DELETE | `/zones/{id}` | Delete Safety Zone |
| POST | `/reports` | File community report |
| GET | `/reports` | List reports |
| GET | `/hotspots` | Aggregated hotspots |
| POST | `/journeys` | Start a Safe Journey |
| POST | `/journeys/{user_id}/end` | End a journey |
| GET | `/users/{id}/journeys/active` | Active journey |
| GET | `/users/{id}/journeys` | All journeys |
| POST | `/routes` | Plan a route (with hotspot awareness) |
| GET | `/users/{id}/state` | Latest safety state |
| GET | `/users/{id}/events` | Recent events |
| GET | `/users/{id}/risks` | Recent risk assessments |
| GET | `/users/{id}/alerts` | Dispatched alerts |
| POST | `/simulate/move` | Inject a move event |
| POST | `/sos/{user_id}` | Manual SOS |
| POST | `/check-in/{user_id}` | Check-in response |
| POST | `/ai/analyze/{user_id}` | AI analyze on current state |
| POST | `/scenarios/{name}` | Run a scripted demo |
| POST | `/simulator/start` | Start simulator |
| POST | `/simulator/stop` | Stop simulator |
| POST | `/simulator/reset` | Reset simulator |
| POST | `/simulator/teleport` | Teleport virtual user |
| POST | `/simulator/move-to` | Move virtual user to a target |
| POST | `/simulator/speed` | Change speed |
| GET | `/simulator/state` | Simulator state |
| GET | `/stream/{user_id}` | SSE stream of state/risk/alerts |

---

## Environment variables

All backend config is in [backend/.env.example](backend/.env.example). Anything left blank fails soft to the in-memory store / deterministic engine.

```env
# Toggle each external service
USE_SUPABASE=false
USE_GOOGLE_MAPS=false
USE_TWILIO=false
USE_LLM=false
```

The frontend apps use `VITE_API_URL` to point at the backend.

---

## Database schema

When `USE_SUPABASE=true`, the same shapes map to Supabase tables:

```sql
create table users (id uuid primary key, display_name text, phone text, email text, created_at timestamptz default now());
create table trusted_contacts (id uuid primary key, user_id uuid references users(id), name text, phone text, relation text, is_primary boolean);
create table safety_zones (id uuid primary key, user_id uuid references users(id), label text, center jsonb, radius_m float, kind text, is_familiar_suggestion boolean, created_at timestamptz default now());
create table journeys (id uuid primary key, user_id uuid references users(id), destination jsonb, expected_arrival_at timestamptz, started_at timestamptz, ended_at timestamptz, status text, trusted_contact_id uuid, expected_route jsonb, familiarity text, route_signature text);
create table safety_events (id uuid primary key, user_id uuid references users(id), journey_id uuid, type text, location jsonb, payload jsonb, created_at timestamptz default now());
create table risk_assessments (id uuid primary key, user_id uuid, journey_id uuid, risk_level text, risk_score int, confidence float, explanation text, recommended_action text, contributing_factors text[], safety_level text, created_at timestamptz default now());
create table alerts (id uuid primary key, user_id uuid, journey_id uuid, level text, channel text, message text, to text, status text, sent_at timestamptz, created_at timestamptz default now());
create table community_reports (id uuid primary key, user_id uuid, location jsonb, category text, description text, severity int, created_at timestamptz default now());
```

Realtime: subscribe to `state:{user_id}`, `events:{user_id}`, `risk:{user_id}`, `alerts:{user_id}` channels.

---

## Hackathon demo flow (3 minutes)

1. **Open the User App.** Show the dashboard, watch the safety level = "normal".
2. **Add a Safety Zone.** Click the map to set "Home", then accept a familiar-zone suggestion near College.
3. **Start a Safe Journey.** Pick College, ETA, trusted contact. The expected route appears.
4. **Open the Guardian Dashboard** in a second window. The traveler dot is visible, AI reasoning says "Travel looks normal".
5. **Run the Simulator.** Move the virtual user — first along the route (normal), then off-route (AI bumps risk to "elevated", sends a check-in), then stop (inactivity + missed check-in pushes risk to "high", guardian is alerted via Twilio or logged alert).
6. **Press SOS.** The Guardian Dashboard flips to emergency; the alert is logged.
7. **CLI voiceover.** `safetynet demo full` runs the entire chain in one command.

---

## Constraints honored

- **< 10 MB source tree** (excluding `node_modules` and the venv). The repo ships only hand-written source — no bundled assets, no model weights, no large binaries.
- **Modular, type-safe** — the shared types package is the single source of truth.
- **Realtime** — backend uses SSE today, Supabase Realtime in production.
- **Graceful degradation** — every external integration degrades to a deterministic fallback.
- **No fake visualizations** — the simulator feeds the exact same backend events the real app produces.

---

## License

Hackathon project — MIT for the source code we wrote. External logos and trademarks belong to their owners.
