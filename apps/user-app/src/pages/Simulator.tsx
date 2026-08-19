import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  Tv,
  Zap,
  Radio,
  Activity,
  Search,
  X,
  Heart,
} from "lucide-react";
import type { LatLng, SafetyEvent, SafetyState } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

const SCENARIOS = [
  { id: "normal", label: "Normal" },
  { id: "route_deviation", label: "Route deviation" },
  { id: "sudden_stop", label: "Sudden stop" },
  { id: "missed_check_in", label: "Missed check-in" },
  { id: "high_risk_route", label: "High-risk route" },
  { id: "emergency", label: "Emergency" },
  { id: "full_demo", label: "Full demo" },
];

export default function Simulator({ userId }: Props) {
  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [speed, setSpeed] = useState(12);
  const [scenario, setScenario] = useState<string | null>(null);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [state, setState] = useState<SafetyState | null>(null);
  const [replay, setReplay] = useState<SafetyEvent[]>([]);
  const [replayIdx, setReplayIdx] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [activePane, setActivePane] = useState<"events" | "replay" | "scenarios">("events");
  const replayTimer = useRef<number | null>(null);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    try {
      const s = await api.simulatorState();
      setRunning(s.running);
      if (s.position) setPosition(s.position);
      setSpeed(s.speed_mps);
      setScenario(s.scenario);
    } catch {}
    try {
      const ev = await api.events(userId, 20);
      setEvents(ev);
    } catch {}
    try {
      setState(await api.state(userId));
    } catch {}
  }

  useEffect(() => {
    const step = (dLat: number, dLng: number) => {
      if (!position) return;
      api.simulatorTeleport(userId, {
        lat: position.lat + dLat,
        lng: position.lng + dLng,
      });
      setPosition((p) => (p ? { lat: p.lat + dLat, lng: p.lng + dLng } : p));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === "w") step(0.0009, 0);
      else if (k === "s") step(-0.0009, 0);
      else if (k === "a") step(0, -0.0009);
      else if (k === "d") step(0, 0.0009);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, userId]);

  async function onMapClick(latlng: LatLng) {
    await api.simulatorMoveTo(userId, latlng);
    setPosition(latlng);
  }

  async function startSim() {
    await api.simulatorStart(userId, speed, scenario || undefined);
    setRunning(true);
  }
  async function stopSim() {
    await api.simulatorStop();
    setRunning(false);
  }
  async function resetSim() {
    await api.simulatorReset();
    setRunning(false);
    setPosition(null);
    refresh();
  }
  async function runScenario(name: string) {
    setScenario(name);
    await api.runScenario(name);
    refresh();
  }
  async function applySpeed() {
    await api.simulatorSpeed(speed);
  }

  async function startReplay() {
    const ev = await api.events(userId, 50);
    setReplay(ev.slice().reverse());
    setReplayIdx(0);
    setReplayPlaying(true);
  }

  useEffect(() => {
    if (!replayPlaying) return;
    if (replayIdx >= replay.length) {
      setReplayPlaying(false);
      return;
    }
    const t = (window.setTimeout(() => {
      setReplayIdx((i) => i + 1);
    }, 800) as unknown) as number;
    replayTimer.current = t;
    return () => clearTimeout(t);
  }, [replayIdx, replayPlaying, replay]);

  const replayEvent = replay[replayIdx];
  const replayPosition = replayEvent?.location || null;

  const filteredEvents = events.filter((e) =>
    (e.type || "").toLowerCase().includes(search.toLowerCase())
  );

  const center = position || { lat: 28.6139, lng: 77.2090 };

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Safety Simulator</h1>
        <p>Move a virtual user. Each movement runs through the real safety engine — not a fake visualization.</p>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Safety level</span>
          <span className={`badge ${state?.safety_level || "normal"}`}>
            {state?.safety_level || "normal"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Risk score</span>
          <span className="stat-value">{state?.last_risk?.risk_score ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Position</span>
          <span className="stat-value" style={{ fontSize: "1rem", fontFamily: "var(--font-mono)" }}>
            {position ? `${position.lat.toFixed(3)}, ${position.lng.toFixed(3)}` : "—"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Status</span>
          <span className={`badge ${running ? "normal" : "check_in"}`}>
            {scenario ? `Scenario: ${scenario}` : running ? "Running" : "Idle"}
          </span>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="grid-sidebar">
        <div>
          <div className="section-map tall">
            <MapView
              center={center}
              position={position}
              onMapClick={onMapClick}
            />
          </div>
          <div className="map-legend" style={{ position: "relative", marginTop: 8, transform: "none", left: "auto", bottom: "auto" }}>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#22C55E" }} /> Virtual user</div>
            <div className="legend-item"><span className="muted" style={{ fontSize: "0.7rem" }}>WASD to move · click to drive</span></div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Controls */}
          <div className="card">
            <h3 className="section-title"><Radio size={16} color="var(--color-accent-green)" /> Controls</h3>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              {!running ? (
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={startSim}>
                  <Play size={14} /> Start
                </button>
              ) : (
                <button className="btn" style={{ flex: 1 }} onClick={stopSim}>
                  <Pause size={14} /> Pause
                </button>
              )}
              <button className="btn btn-secondary" onClick={resetSim}>
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <div className="row between">
                <label style={{ fontSize: "0.7rem" }}>Speed</label>
                <span className="range-display">{speed} m/s · {Math.round(speed * 3.6)} km/h</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
              <button className="btn btn-secondary" onClick={applySpeed} style={{ marginTop: 4, width: "100%" }}>
                <Zap size={12} /> Apply speed
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="card">
            <h3 className="section-title"><Activity size={16} color="var(--color-accent-green)" /> Live data</h3>
            <div className="map-disaster-bar" style={{ position: "static", transform: "none", marginBottom: 8, width: "100%" }}>
              <button
                className={activePane === "events" ? "active" : ""}
                onClick={() => setActivePane("events")}
                style={{ flex: 1 }}
              >
                <Activity size={12} /> Events
              </button>
              <button
                className={activePane === "replay" ? "active" : ""}
                onClick={() => setActivePane("replay")}
                style={{ flex: 1 }}
              >
                <Tv size={12} /> Replay
              </button>
              <button
                className={activePane === "scenarios" ? "active" : ""}
                onClick={() => setActivePane("scenarios")}
                style={{ flex: 1 }}
              >
                <Zap size={12} /> Scripts
              </button>
            </div>

            {activePane === "events" && (
              <div className="maps-panel-search" style={{ marginBottom: 8 }}>
                <Search />
                <input
                  type="text"
                  placeholder="Filter events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingRight: "32px" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="maps-panel-clear-btn" aria-label="Clear">
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {activePane === "events" && (
              <div className="timeline" style={{ maxHeight: 240 }}>
                {filteredEvents.length === 0 ? (
                  <div className="empty-state">
                    <p>No events yet</p>
                  </div>
                ) : (
                  filteredEvents.slice(0, 10).map((e) => (
                    <div className="timeline-item" key={e.id}>
                      <div className="body">
                        <div className="title">{e.type.replace(/_/g, " ")}</div>
                        <div className="meta">
                          <span className="mono">{new Date(e.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activePane === "replay" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={startReplay}>
                    <Tv size={12} /> Load
                  </button>
                  {replayPlaying ? (
                    <button className="btn" onClick={() => setReplayPlaying(false)}>
                      <Pause size={12} />
                    </button>
                  ) : (
                    <button className="btn" disabled={replay.length === 0} onClick={() => setReplayPlaying(true)}>
                      <Play size={12} />
                    </button>
                  )}
                </div>
                {replayEvent && (
                  <div className="card tight" style={{ background: "rgba(34, 197, 94, 0.08)", borderColor: "var(--color-accent-green)" }}>
                    <div className="muted" style={{ fontSize: "0.7rem" }}>Step {replayIdx + 1} / {replay.length}</div>
                    <strong style={{ fontSize: "0.9rem" }}>{replayEvent.type.replace(/_/g, " ")}</strong>
                  </div>
                )}
              </div>
            )}

            {activePane === "scenarios" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    className="btn btn-secondary"
                    onClick={() => runScenario(s.id)}
                    style={{ fontSize: "0.75rem", padding: "8px 6px" }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
