import type {
  CommunityReport,
  FamiliarSuggestion,
  Hotspot,
  Journey,
  LatLng,
  RiskAssessment,
  RouteResponse,
  SafetyEvent,
  SafetyState,
  SafetyZone,
  SimulateMoveResponse,
  TrustedContact,
  UserProfile,
} from "@safetynet/shared-types";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";

class ApiClient {
  base: string;
  constructor(base: string) {
    this.base = base.replace(/\/$/, "");
  }

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`${r.status} ${r.statusText}: ${txt}`);
    }
    return (await r.json()) as T;
  }

  status() {
    return this.req<{ ok: boolean; version: string; uptime_s: number }>("/status");
  }

  // user
  getUser(id: string) {
    return this.req<UserProfile>(`/users/${id}`);
  }
  listContacts(id: string) {
    return this.req<TrustedContact[]>(`/users/${id}/contacts`);
  }

  // zones
  listZones(uid: string) {
    return this.req<SafetyZone[]>(`/users/${uid}/zones`);
  }
  createZone(z: SafetyZone) {
    return this.req<SafetyZone>(`/zones`, { method: "POST", body: JSON.stringify(z) });
  }
  deleteZone(zid: string) {
    return this.req<{ ok: boolean }>(`/zones/${zid}`, { method: "DELETE" });
  }
  zoneSuggestions(uid: string) {
    return this.req<FamiliarSuggestion[]>(`/users/${uid}/zones/suggestions`);
  }

  // journey
  activeJourney(uid: string) {
    return this.req<Journey | null>(`/users/${uid}/journeys/active`);
  }
  startJourney(payload: {
    user_id: string;
    destination: LatLng & { label?: string };
    expected_arrival_at: string;
    trusted_contact_id?: string;
    origin?: LatLng;
  }) {
    return this.req<Journey>(`/journeys`, { method: "POST", body: JSON.stringify(payload) });
  }
  endJourney(uid: string) {
    return this.req<Journey>(`/journeys/${uid}/end`, { method: "POST" });
  }

  // state + events
  state(uid: string) {
    return this.req<SafetyState>(`/users/${uid}/state`);
  }
  events(uid: string, limit = 30) {
    return this.req<SafetyEvent[]>(`/users/${uid}/events?limit=${limit}`);
  }
  risks(uid: string, limit = 10) {
    return this.req<RiskAssessment[]>(`/users/${uid}/risks?limit=${limit}`);
  }
  alerts(uid: string) {
    return this.req<{ id: string; level: string; message: string; status: string; to?: string }[]>(
      `/users/${uid}/alerts`
    );
  }

  // actions
  sos(uid: string) {
    return this.req<{ ok: boolean; risk: RiskAssessment; alert: unknown }>(`/sos/${uid}`, {
      method: "POST",
    });
  }
  checkIn(uid: string, ok = true) {
    return this.req<{ ok: boolean; state: SafetyState }>(
      `/check-in/${uid}?ok=${ok ? "true" : "false"}`,
      { method: "POST" }
    );
  }
  simulateMove(uid: string, to: LatLng) {
    return this.req<SimulateMoveResponse>(`/simulate/move`, {
      method: "POST",
      body: JSON.stringify({ user_id: uid, to, source: "real" }),
    });
  }

  // simulator
  simulatorStart(uid: string, speed = 12, scenario?: string) {
    const qs = new URLSearchParams({ user_id: uid, speed_mps: String(speed) });
    if (scenario) qs.set("scenario", scenario);
    return this.req<{ ok: boolean; state: unknown }>(`/simulator/start?${qs}`, { method: "POST" });
  }
  simulatorStop() {
    return this.req<{ ok: boolean }>(`/simulator/stop`, { method: "POST" });
  }
  simulatorReset() {
    return this.req<{ ok: boolean }>(`/simulator/reset`, { method: "POST" });
  }
  simulatorTeleport(uid: string, to: LatLng) {
    return this.req<{ ok: boolean }>(`/simulator/teleport`, {
      method: "POST",
      body: JSON.stringify({ user_id: uid, lat: to.lat, lng: to.lng }),
    });
  }
  simulatorMoveTo(uid: string, to: LatLng) {
    return this.req<{ ok: boolean }>(`/simulator/move-to`, {
      method: "POST",
      body: JSON.stringify({ user_id: uid, lat: to.lat, lng: to.lng }),
    });
  }
  simulatorSpeed(speed: number) {
    return this.req<{ ok: boolean; speed_mps: number }>(`/simulator/speed`, {
      method: "POST",
      body: JSON.stringify({ speed_mps: speed }),
    });
  }
  simulatorState() {
    return this.req<{
      user_id: string;
      running: boolean;
      speed_mps: number;
      position: LatLng | null;
      target: LatLng | null;
      scenario: string | null;
      started_at: number | null;
    }>(`/simulator/state`);
  }

  // scenarios
  runScenario(name: string) {
    return this.req<{ ok: boolean; steps: { step: string }[] }>(`/scenarios/${name}`, {
      method: "POST",
    });
  }

  // routes
  planRoute(origin: LatLng, destination: LatLng, avoidHotspots = true) {
    return this.req<RouteResponse>(`/routes`, {
      method: "POST",
      body: JSON.stringify({ origin, destination, avoid_hotspots: avoidHotspots }),
    });
  }

  // community
  hotspots() {
    return this.req<Hotspot[]>(`/hotspots`);
  }
  reports() {
    return this.req<CommunityReport[]>(`/reports`);
  }
  addReport(payload: CommunityReport) {
    return this.req<CommunityReport>(`/reports`, { method: "POST", body: JSON.stringify(payload) });
  }
}

export const api = new ApiClient(BASE_URL);

// Subscribe to SSE stream of state updates for a user.
export function subscribeStream(userId: string, onMessage: (data: any) => void): () => void {
  const url = `${BASE_URL}/stream/${userId}`;
  let es: EventSource | null = null;
  try {
    es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        // ignore
      }
    };
    es.addEventListener("message", (e: any) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    });
  } catch (err) {
    console.warn("SSE failed", err);
  }
  return () => {
    if (es) es.close();
  };
}
