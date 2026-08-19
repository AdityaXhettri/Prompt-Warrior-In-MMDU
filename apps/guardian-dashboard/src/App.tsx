import { useEffect, useState } from "react";
import { Bell, Heart, MessageSquare, ShieldCheck, AlertTriangle, MapPin, Radio } from "lucide-react";
import type { SafetyEvent, SafetyState, SafetyZone } from "@safetynet/shared-types";
import { api, subscribeStream } from "./lib/api";
import MapView from "./components/MapView";

const USER_ID = "demo-user";

export default function App() {
  const [state, setState] = useState<SafetyState | null>(null);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [actualRoute, setActualRoute] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  const refresh = async () => {
    try {
      const [s, e, a, z, j] = await Promise.all([
        api.state(USER_ID),
        api.events(USER_ID, 40),
        api.alerts(USER_ID),
        api.zones(USER_ID),
        api.activeJourney(USER_ID),
      ]);
      setState(s);
      setEvents(e);
      setAlerts(a);
      setZones(z);
      setActiveJourney(j);
      if (j) {
        const pts = e
          .filter((ev) => ev.journey_id === j.id && ev.location)
          .map((ev) => ev.location)
          .reverse();
        setActualRoute(pts);
      } else {
        setActualRoute([]);
      }
    } catch {}
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    const unsub = subscribeStream(USER_ID, (msg) => {
      setConnected(true);
      if (msg && typeof msg === "object" && "safety_level" in msg) {
        setState(msg as SafetyState);
      }
    });
    return () => {
      clearInterval(t);
      unsub();
    };
  }, []);

  const lastRisk = state?.last_risk;
  const level = state?.safety_level || "normal";
  const score = lastRisk?.risk_score ?? 0;
  const position = [...events].reverse().find((e) => e.location)?.location || null;

  return (
    <div className="guardian-app">
      <header className="topnav" style={{ gridColumn: "1 / 3" }}>
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div>SafetyNet · Guardian</div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
              Watching over your traveler
            </div>
          </div>
        </div>
        <div className="spacer" />
        <span className={`connection-pill${connected ? "" : " disconnected"}`}>
          <span className="dot" />
          {connected ? "live" : "offline"}
        </span>
        <span className="pill">
          <span className={`badge ${level}`}>{level.replace("_", " ")}</span>
        </span>
      </header>

      <main className="guardian-main">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <MapView
            center={position || { lat: 28.6139, lng: 77.2090 }}
            position={position}
            destination={activeJourney?.destination}
            zones={zones}
            expectedRoute={activeJourney?.expected_route}
            actualRoute={actualRoute}
          />
        </div>
        <div className="grid grid-4">
          <div className="card">
            <h3>Safety level</h3>
            <span className={`badge ${level}`}>{level.replace("_", " ")}</span>
          </div>
          <div className="card">
            <h3>Risk score</h3>
            <div className="value">{score}</div>
            <div className={`bar ${score >= 65 ? "danger" : score >= 40 ? "warn" : ""}`}>
              <div className="fill" style={{ width: `${score}%` }} />
            </div>
          </div>
          <div className="card">
            <h3>ETA</h3>
            <div className="value" style={{ fontSize: 18 }}>
              {activeJourney
                ? new Date(activeJourney.expected_arrival_at).toLocaleTimeString()
                : "—"}
            </div>
            <div className="muted">{activeJourney ? activeJourney.destination_label : "no active journey"}</div>
          </div>
          <div className="card">
            <h3>Familiarity</h3>
            <div className="value" style={{ fontSize: 18 }}>
              {activeJourney?.familiarity || "—"}
            </div>
            <div className="muted">auto-detected from past journeys</div>
          </div>
        </div>
      </main>

      <aside className="guardian-side">
        <div className="card">
          <h3>Traveler</h3>
          <div className="row">
            <Heart size={14} /> <strong>Demo User</strong>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            <MapPin size={12} />{" "}
            {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : "—"}
          </div>
          {activeJourney && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              <Radio size={12} /> journey {activeJourney.id.slice(0, 8)}
            </div>
          )}
        </div>

        <div className="card">
          <h3>AI reasoning</h3>
          {lastRisk ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="timeline-item">
                <div className="icon">
                  <AlertTriangle size={14} />
                </div>
                <div className="body">
                  <div className="title">{lastRisk.risk_level.toUpperCase()} · {lastRisk.risk_score}/100</div>
                  <div className="meta">{lastRisk.explanation}</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className="icon">
                  <MessageSquare size={14} />
                </div>
                <div className="body">
                  <div className="title">Recommended</div>
                  <div className="meta">{lastRisk.recommended_action}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">No recent assessment.</div>
          )}
        </div>

        <div className="card">
          <h3>Latest events</h3>
          <div className="timeline">
            {events.slice(0, 8).map((e) => (
              <div className="timeline-item" key={e.id}>
                <div className="icon">
                  <ShieldCheck size={14} />
                </div>
                <div className="body">
                  <div className="title">{e.type.replace(/_/g, " ")}</div>
                  <div className="meta mono">
                    {new Date(e.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Alerts</h3>
          {alerts.length === 0 ? (
            <div className="empty">No alerts dispatched.</div>
          ) : (
            <div className="timeline">
              {alerts.slice(-8).reverse().map((a) => (
                <div className="timeline-item" key={a.id}>
                  <div className="icon">
                    <Bell size={14} />
                  </div>
                  <div className="body">
                    <div className="title">
                      <span className={`badge ${a.level}`}>{a.level}</span> {a.status}
                    </div>
                    <div className="meta">{a.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Guardian actions</h3>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => api.checkIn(USER_ID, true)}>
              Send "I'm OK" prompt
            </button>
            <button className="btn ghost" onClick={() => api.analyze(USER_ID)}>
              Re-analyze
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
