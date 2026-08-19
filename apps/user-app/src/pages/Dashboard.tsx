import { useEffect, useState } from "react";
import { AlertTriangle, BatteryCharging, Heart, MapPin, Radio, ShieldCheck, Siren } from "lucide-react";
import type { SafetyEvent, SafetyState, RiskAssessment } from "@safetynet/shared-types";
import { api } from "../lib/api";
import MapView from "../components/MapView";
import type { Page } from "../App";

interface Props {
  userId: string;
  state: SafetyState | null;
  onNav: (p: Page) => void;
}

const SAFETY_LABEL: Record<string, string> = {
  normal: "Nominal",
  check_in: "Needs check-in",
  guardian_alert: "Guardian alerted",
  emergency: "Emergency",
};

export default function Dashboard({ userId, state, onNav }: Props) {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    api.events(userId, 12).then(setEvents).catch(() => {});
    api.risks(userId, 5).then(setRisks).catch(() => {});
  }, [userId, state?.last_event_at]);

  useEffect(() => {
    // Use last event with location as current position.
    const last = events.find((e) => e.location);
    if (last?.location) setPosition(last.location);
  }, [events]);

  const lastRisk = state?.last_risk;
  const score = lastRisk?.risk_score ?? 0;
  const level = state?.safety_level || "normal";

  async function handleSos() {
    if (!confirm("Trigger emergency SOS? Your guardians will be notified immediately.")) return;
    await api.sos(userId);
    alert("SOS dispatched. Guardians notified.");
  }

  return (
    <>
      <div className="row" style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title">Hello, traveler</h1>
          <div className="page-subtitle">
            SafetyNet is watching over you. Your current safety level is{" "}
            <span className={`badge ${level}`}>{SAFETY_LABEL[level] || level}</span>.
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => onNav("simulator")}>
            <Radio size={14} /> Simulator
          </button>
          <button className="btn sos" onClick={handleSos}>
            <Siren size={16} /> SOS
          </button>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card">
          <h3>Safety level</h3>
          <div className="kpi">
            <span className={`badge ${level}`}>{SAFETY_LABEL[level] || level}</span>
            <span className="label">real-time</span>
          </div>
        </div>
        <div className="card">
          <h3>Risk score</h3>
          <div className="kpi">
            <span className="value">{score}</span>
            <div className={`bar ${score >= 65 ? "danger" : score >= 40 ? "warn" : ""}`}>
              <div className="fill" style={{ width: `${score}%` }} />
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Last event</h3>
          <div className="kpi">
            <span className="value" style={{ fontSize: 18 }}>
              {events[0]?.type.replace(/_/g, " ") || "—"}
            </span>
            <span className="label">{events[0]?.created_at || "no events yet"}</span>
          </div>
        </div>
        <div className="card">
          <h3>Why this score</h3>
          <div className="kpi">
            <span className="value" style={{ fontSize: 14, lineHeight: 1.4 }}>
              {lastRisk?.explanation || "All signals nominal."}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Live map</h3>
          <MapView
            center={position || { lat: 28.6139, lng: 77.2090 }}
            position={position}
            zones={[]}
            className=""
          />
        </div>
        <div className="card">
          <h3>AI reasoning</h3>
          {lastRisk ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="timeline-item">
                <div className="icon">
                  <Heart size={14} />
                </div>
                <div className="body">
                  <div className="title">Risk level: {lastRisk.risk_level}</div>
                  <div className="meta">Confidence: {Math.round(lastRisk.confidence * 100)}%</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className="icon">
                  <BatteryCharging size={14} />
                </div>
                <div className="body">
                  <div className="title">Recommended action</div>
                  <div className="meta">{lastRisk.recommended_action}</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className="icon">
                  <AlertTriangle size={14} />
                </div>
                <div className="body">
                  <div className="title">Contributing factors</div>
                  <div className="meta">{lastRisk.contributing_factors.join(", ") || "—"}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty">No assessments yet — start a journey or simulate movement.</div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Event timeline</h3>
          {events.length === 0 ? (
            <div className="empty">No events yet.</div>
          ) : (
            <div className="timeline">
              {events.map((e) => (
                <div className="timeline-item" key={e.id}>
                  <div className="icon">
                    {e.type.includes("emerg") ? (
                      <AlertTriangle size={14} />
                    ) : e.type.includes("zone") ? (
                      <MapPin size={14} />
                    ) : (
                      <ShieldCheck size={14} />
                    )}
                  </div>
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
          )}
        </div>
        <div className="card">
          <h3>Recent risk assessments</h3>
          {risks.length === 0 ? (
            <div className="empty">No risk assessments yet.</div>
          ) : (
            <div className="timeline">
              {risks.map((r) => (
                <div className="timeline-item" key={r.id}>
                  <div className="icon">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="body">
                    <div className="title">
                      <span className={`badge ${r.risk_level}`}>{r.risk_level}</span>{" "}
                      <span className="mono">{r.risk_score}/100</span>
                    </div>
                    <div className="meta">{r.explanation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
