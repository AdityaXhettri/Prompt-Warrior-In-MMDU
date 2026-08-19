import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Tv, Zap, MapPin } from "lucide-react";
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
    } catch {
      /* offline */
    }
    try {
      const ev = await api.events(userId, 15);
      setEvents(ev);
    } catch {}
    try {
      setState(await api.state(userId));
    } catch {}
  }

  // WASD keyboard control
  useEffect(() => {
    const step = (dLat: number, dLng: number) => {
      if (!position) return;
      // ~0.0001 deg per press -> a few meters
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

  return (
    <>
      <div>
        <h1 className="page-title">Safety Simulator</h1>
        <div className="page-subtitle">
          Move a virtual user. Every movement runs through the real safety engine — not a fake
          visualization. Use click, W/A/S/D, or scripted scenarios.
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Live simulator map</h3>
          <MapView
            center={position || { lat: 28.6139, lng: 77.2090 }}
            position={position}
            onMapClick={onMapClick}
          />
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <button className="btn" onClick={() => onMapClick({ lat: (position?.lat || 28.61) + 0.005, lng: position?.lng || 77.209 })}>
              <MapPin size={14} /> Move North
            </button>
            <button className="btn" onClick={() => onMapClick({ lat: (position?.lat || 28.61) - 0.005, lng: position?.lng || 77.209 })}>
              <MapPin size={14} /> Move South
            </button>
            <button className="btn" onClick={() => onMapClick({ lat: position?.lat || 28.61, lng: (position?.lng || 77.209) + 0.005 })}>
              <MapPin size={14} /> Move East
            </button>
            <button className="btn" onClick={() => onMapClick({ lat: position?.lat || 28.61, lng: (position?.lng || 77.209) - 0.005 })}>
              <MapPin size={14} /> Move West
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Tip: press <span className="mono">W</span> <span className="mono">A</span>{" "}
            <span className="mono">S</span> <span className="mono">D</span> on the keyboard to move
            the virtual user.
          </div>
        </div>

        <div className="card">
          <h3>Controls</h3>
          <div className="row" style={{ gap: 8 }}>
            {!running ? (
              <button className="btn primary" onClick={startSim}>
                <Play size={14} /> Start
              </button>
            ) : (
              <button className="btn" onClick={stopSim}>
                <Pause size={14} /> Pause
              </button>
            )}
            <button className="btn ghost" onClick={resetSim}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Movement speed (m/s)</label>
            <input
              type="range"
              min={1}
              max={30}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <div className="muted" style={{ fontSize: 12 }}>
              {speed} m/s · {Math.round(speed * 3.6)} km/h
            </div>
            <button className="btn" onClick={() => api.simulatorSpeed(speed)}>
              <Zap size={14} /> Apply speed
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>Replay last session</h3>
            <div className="row">
              <button className="btn" onClick={startReplay}>
                <Tv size={14} /> Load replay
              </button>
              {replayPlaying ? (
                <button className="btn" onClick={() => setReplayPlaying(false)}>
                  <Pause size={14} /> Pause
                </button>
              ) : (
                <button className="btn" onClick={() => setReplayPlaying(true)} disabled={replay.length === 0}>
                  <Play size={14} /> Play
                </button>
              )}
            </div>
            {replayEvent && (
              <div className="muted" style={{ marginTop: 8 }}>
                {replayIdx + 1}/{replay.length}: {replayEvent.type.replace(/_/g, " ")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Reusable scenarios</h3>
        <div className="grid grid-4">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className="card tight"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => runScenario(s.id)}
            >
              <strong>{s.label}</strong>
              <div className="muted" style={{ fontSize: 12 }}>
                Play scripted demo
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Replay map</h3>
          <MapView
            center={replayPosition || position || { lat: 28.6139, lng: 77.2090 }}
            position={replayPosition}
          />
        </div>
        <div className="card">
          <h3>Live state</h3>
          <div className="grid grid-2">
            <div className="card tight">
              <div className="muted" style={{ fontSize: 12 }}>
                Safety level
              </div>
              <span className={`badge ${state?.safety_level || "normal"}`}>
                {state?.safety_level || "normal"}
              </span>
            </div>
            <div className="card tight">
              <div className="muted" style={{ fontSize: 12 }}>
                Risk score
              </div>
              <div className="value">{state?.last_risk?.risk_score ?? 0}</div>
            </div>
            <div className="card tight">
              <div className="muted" style={{ fontSize: 12 }}>
                Position
              </div>
              <div className="mono">
                {position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : "—"}
              </div>
            </div>
            <div className="card tight">
              <div className="muted" style={{ fontSize: 12 }}>
                AI explanation
              </div>
              <div style={{ fontSize: 13 }}>{state?.last_risk?.explanation || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Live events</h3>
        <div className="timeline">
          {events.map((e) => (
            <div className="timeline-item" key={e.id}>
              <div className="body">
                <div className="title">{e.type.replace(/_/g, " ")}</div>
                <div className="meta">
                  {e.location ? `${e.location.lat.toFixed(4)}, ${e.location.lng.toFixed(4)} · ` : ""}
                  <span className="mono">{new Date(e.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
