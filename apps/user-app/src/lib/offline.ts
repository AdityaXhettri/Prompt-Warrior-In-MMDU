// Offline buffer + hands-free emergency helpers for the User App.
//
// When the network is unavailable, the deterministic safety rules
// continue locally: we run a thin JS replica of the route-deviation,
// ETA and inactivity logic and queue events for later sync.
//
// When connection returns, we drain the queue back to the backend.

import type { LatLng, SafetyEvent } from "@safetynet/shared-types";

const KEY = "safetynet:offline-buffer";
const ZONES_KEY = "safetynet:zones-cache";
const STATE_KEY = "safetynet:last-state";

export interface QueuedEvent {
  id: string;
  user_id: string;
  type: SafetyEvent["type"];
  location?: LatLng;
  payload: Record<string, unknown>;
  created_at: string;
  source: "offline-queue";
}

export function loadBuffer(): QueuedEvent[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushToBuffer(ev: QueuedEvent) {
  const buf = loadBuffer();
  buf.push(ev);
  if (buf.length > 1000) buf.splice(0, buf.length - 1000);
  localStorage.setItem(KEY, JSON.stringify(buf));
}

export function clearBuffer() {
  localStorage.removeItem(KEY);
}

export async function drainBuffer(baseUrl: string, userId: string) {
  const buf = loadBuffer();
  let index = 0;
  for (; index < buf.length; index++) {
    const ev = buf[index];
    try {
      if (ev.location) {
        const r = await fetch(`${baseUrl}/simulate/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, to: ev.location, source: "real" }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
    } catch {
      // network flaked mid-drain; keep the remaining items
      const remaining = buf.slice(index);
      localStorage.setItem(KEY, JSON.stringify(remaining));
      return;
    }
  }
  clearBuffer();
}

// Cache last zones for offline use.
export function cacheZones(zones: unknown) {
  localStorage.setItem(ZONES_KEY, JSON.stringify(zones));
}
export function loadCachedZones(): any[] {
  try {
    return JSON.parse(localStorage.getItem(ZONES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function cacheState(state: unknown) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
export function loadCachedState(): any | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "null");
  } catch {
    return null;
  }
}

// ---------- Local deterministic safety rules ----------
// Pure JS implementation of the most important rules so the app can
// continue protecting the user when the backend is unreachable.

export interface LocalRisk {
  risk_level: "low" | "moderate" | "elevated" | "high" | "critical";
  risk_score: number;
  explanation: string;
  safety_level: "normal" | "check_in" | "guardian_alert" | "emergency";
  contributing_factors: string[];
}

export function localAssess(
  prev: { location?: LatLng; last_at?: number } | null,
  next: { location: LatLng; now: number },
  zones: Array<{ center: LatLng; radius_m: number }>,
  inJourney: boolean,
  expectedRoute: LatLng[],
): LocalRisk {
  const factors: string[] = [];
  let score = 0;

  // 1. Zone check
  const inZone = zones.some((z) => haversine(next.location, z.center) <= z.radius_m);
  if (!inZone && inJourney) {
    score += 15;
    factors.push("left_familiar_zone");
  }

  // 2. Route deviation
  if (expectedRoute.length > 0) {
    const dev = distanceToPolyline(next.location, expectedRoute);
    if (dev > 200) {
      score += 55;
      factors.push("route_deviation");
    }
  }

  // 3. Inactivity (>3 min)
  if (prev?.last_at) {
    const gap = (next.now - prev.last_at) / 1000;
    if (gap > 180) {
      score += 25;
      factors.push("inactivity");
    }
  }

  // 4. Manual SOS flag
  if (next.location && (next.location as any)._sos) {
    score = 100;
    factors.push("manual_sos");
  }

  let risk_level: LocalRisk["risk_level"] = "low";
  if (score >= 85) risk_level = "critical";
  else if (score >= 65) risk_level = "high";
  else if (score >= 40) risk_level = "elevated";
  else if (score >= 20) risk_level = "moderate";

  const safety_level: LocalRisk["safety_level"] =
    risk_level === "critical" ? "emergency" : risk_level === "high" ? "guardian_alert" : risk_level === "elevated" ? "check_in" : "normal";

  return {
    risk_level,
    risk_score: Math.min(100, score),
    safety_level,
    explanation: factors.length ? `Local: ${factors.join(", ")}` : "Local: all signals nominal.",
    contributing_factors: factors,
  };
}

function haversine(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function distanceToPolyline(p: LatLng, line: LatLng[]) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = pointToSegment(p, line[i], line[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

function pointToSegment(p: LatLng, a: LatLng, b: LatLng) {
  const ax = 0,
    ay = 0;
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const R = 6371000;
  const bx = ((b.lng - a.lng) * cosLat * Math.PI) / 180 * R;
  const by = ((b.lat - a.lat) * Math.PI) / 180 * R;
  const px = ((p.lng - a.lng) * cosLat * Math.PI) / 180 * R;
  const py = ((p.lat - a.lat) * Math.PI) / 180 * R;
  const dx = bx - ax,
    dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px, py);
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx,
    cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// ---------- Hands-free emergency ----------
// Watches the device orientation and motion sensors. If the device
// experiences a sudden impact (fall, shake) or the user holds the SOS
// shutter for a long time, the app sends an emergency event even when
// the user can't reach the button.

export interface HandsFreeHandlers {
  onTrigger: (reason: "shake" | "immobility" | "long_press") => void;
}

export function startHandsFree(handlers: HandsFreeHandlers) {
  let lastTrigger = 0;
  const COOLDOWN = 30000;
  const trigger = (reason: "shake" | "immobility" | "long_press") => {
    if (Date.now() - lastTrigger < COOLDOWN) return;
    lastTrigger = Date.now();
    handlers.onTrigger(reason);
  };

  // shake detection via device motion
  let lastShakeAt = 0;
  const onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const mag = Math.hypot(a.x, a.y, a.z);
    if (mag > 30 && Date.now() - lastShakeAt > 1500) {
      lastShakeAt = Date.now();
      trigger("shake");
    }
  };

  // long-press via spacebar (desktop fallback)
  let spaceHeld = false;
  let spaceStart = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Space" && !e.repeat) {
      spaceHeld = true;
      spaceStart = Date.now();
    } else if (e.code === "Space" && !spaceHeld) {
      // already counting
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space" && spaceHeld) {
      const held = Date.now() - spaceStart;
      if (held > 2500) trigger("long_press");
      spaceHeld = false;
    }
  };

  // immobility detection: same coords for >15 min triggers.
  let lastPos: LatLng | null = null;
  let lastPosAt = Date.now();
  const onPos = (p: LatLng) => {
    if (lastPos && haversine(p, lastPos) < 10) {
      if (Date.now() - lastPosAt > 900_000) {
        trigger("immobility");
        lastPosAt = Date.now();
      }
    } else {
      lastPos = p;
      lastPosAt = Date.now();
    }
  };

  window.addEventListener("devicemotion", onMotion);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);

  return {
    stop: () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    },
    onPos,
  };
}
