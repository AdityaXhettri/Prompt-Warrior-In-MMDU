import type {
  Hotspot,
  Journey,
  LatLng,
  RiskAssessment,
  SafetyEvent,
  SafetyState,
  SafetyZone,
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
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return (await r.json()) as T;
  }
  state(uid: string) {
    return this.req<SafetyState>(`/users/${uid}/state`);
  }
  events(uid: string, limit = 40) {
    return this.req<SafetyEvent[]>(`/users/${uid}/events?limit=${limit}`);
  }
  risks(uid: string, limit = 10) {
    return this.req<RiskAssessment[]>(`/users/${uid}/risks?limit=${limit}`);
  }
  alerts(uid: string) {
    return this.req<{ id: string; level: string; message: string; status: string; to?: string; created_at: string }[]>(
      `/users/${uid}/alerts`
    );
  }
  zones(uid: string) {
    return this.req<SafetyZone[]>(`/users/${uid}/zones`);
  }
  activeJourney(uid: string) {
    return this.req<Journey | null>(`/users/${uid}/journeys/active`);
  }
  hotspots() {
    return this.req<Hotspot[]>(`/hotspots`);
  }
  analyze(uid: string) {
    return this.req<RiskAssessment>(`/ai/analyze/${uid}`, { method: "POST" });
  }
  // as a guardian, you can ask the engine to push a check-in to the user
  checkIn(uid: string, ok: boolean) {
    return this.req<{ ok: boolean; state: SafetyState }>(
      `/check-in/${uid}?ok=${ok ? "true" : "false"}`,
      { method: "POST" }
    );
  }
}

export const api = new ApiClient(BASE_URL);

export function subscribeStream(userId: string, onMessage: (data: any) => void): () => void {
  const url = `${BASE_URL}/stream/${userId}`;
  let es: EventSource | null = null;
  try {
    es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
  } catch {}
  return () => es?.close();
}
