import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Search,
  ArrowUpDown,
  Compass,
  MapPin,
  RefreshCw,
  X,
  Activity,
  Bell,
  Heart,
  ShieldCheck,
  Flame,
  Eye,
} from "lucide-react";
import type { SafetyEvent, SafetyState, SafetyZone, RiskAssessment, Hotspot } from "@safetynet/shared-types";
import { api, subscribeStream } from "../lib/api";
import MapView from "../components/MapView";
import { colorForRisk, riskLabel, type RiskZone } from "../lib/riskCities";

interface DashboardProps {
  userId: string;
  state: SafetyState | null;
}

const SAFETY_LABEL: Record<string, string> = {
  normal: "Nominal",
  check_in: "Check-in",
  guardian_alert: "Guardian alert",
  emergency: "Emergency",
};

export default function Dashboard({ userId, state }: DashboardProps) {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [risks, setRisks] = useState<RiskAssessment[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, r, a, z, h] = await Promise.all([
        api.events(userId, 30),
        api.risks(userId, 5),
        api.alerts(userId),
        api.listZones(userId),
        api.hotspots(),
      ]);
      setEvents(e);
      setRisks(r);
      setAlerts(a);
      setZones(z);
      setHotspots(h);
    } catch (err: any) {
      setError(
        err?.message?.toLowerCase().includes("fetch")
          ? "Cannot reach the backend — make sure it is running on port 8000."
          : err?.message || "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    const unsub = subscribeStream(userId, () => {
      // light refresh on state change
    });
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [userId, retryCount, refresh]);

  const lastRisk = state?.last_risk;
  const level = state?.safety_level || "normal";
  const score = lastRisk?.risk_score ?? 0;
  const position = [...events].reverse().find((e) => e.location)?.location || null;

  const eventsHere = events.filter((e) => e.location);
  const eventsCount = eventsHere.length;
  const hotspotsCount = hotspots.length;

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Live overview of your safety state, recent events, and active risk signals.</p>
      </div>

      {error && (
        <div className="backend-error-banner" style={{ position: "relative", transform: "none", left: "auto", top: "auto", marginBottom: 16 }}>
          <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
          <span style={{ color: "#F87171", fontSize: "0.85rem" }}>{error}</span>
          <button onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw size={13} /> Retry
          </button>
          <button onClick={() => setError(null)} style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Safety level</span>
          <span className={`badge ${level}`}>{SAFETY_LABEL[level] || level}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Risk score</span>
          <span className="stat-value">{score}</span>
          <div className={`bar ${score >= 65 ? "danger" : score >= 40 ? "warn" : ""}`}>
            <div className="fill" style={{ width: `${score}%` }} />
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Events (live)</span>
          <span className="stat-value">{eventsCount}</span>
          <span className="stat-sub">last 30</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Hotspots</span>
          <span className="stat-value">{hotspotsCount}</span>
          <span className="stat-sub">community-reported</span>
        </div>
      </div>

      {/* Map section */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="section-map" style={{ borderRadius: 0, border: "none" }}>
          <MapView
            center={position || { lat: 28.6139, lng: 77.2090 }}
            position={position}
            zones={zones}
            hotspots={hotspots}
            showRiskZones
            onRiskZoneClick={setSelectedZone}
            showZones
          />
        </div>
        {selectedZone && (
          <RiskAreaCard zone={selectedZone} onClose={() => setSelectedZone(null)} />
        )}
        <div className="map-legend">
          <div className="legend-item"><span className="legend-swatch" style={{ background: "#22C55E" }} /> Safe</div>
          <div className="legend-item"><span className="legend-swatch" style={{ background: "#F59E0B" }} /> Moderate</div>
          <div className="legend-item"><span className="legend-swatch" style={{ background: "#F97316" }} /> High</div>
          <div className="legend-item"><span className="legend-swatch" style={{ background: "#EF4444" }} /> Critical</div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3 className="section-title"><Activity size={16} color="var(--color-accent-green)" /> Recent events</h3>
          {events.length === 0 ? (
            <div className="empty-state">
              <Activity size={28} />
              <h3>No events yet</h3>
              <p>Move the simulator or start a journey</p>
            </div>
          ) : (
            <div className="timeline">
              {events.slice(0, 8).map((e) => (
                <div className="timeline-item" key={e.id}>
                  <div className="icon">
                    {e.type.includes("emerg") ? <AlertTriangle size={14} /> : e.type.includes("zone") ? <MapPin size={14} /> : <ShieldCheck size={14} />}
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
          <h3 className="section-title"><Heart size={16} color="var(--color-accent-green)" /> AI reasoning</h3>
          {lastRisk ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="timeline-item">
                <div className="icon"><Heart size={14} /></div>
                <div className="body">
                  <div className="title">Risk level: {lastRisk.risk_level}</div>
                  <div className="meta">Confidence: {Math.round(lastRisk.confidence * 100)}%</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className="icon"><ShieldCheck size={14} /></div>
                <div className="body">
                  <div className="title">Recommended action</div>
                  <div className="meta">{lastRisk.recommended_action}</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className="icon"><Bell size={14} /></div>
                <div className="body">
                  <div className="title">Last alert</div>
                  <div className="meta">
                    {alerts.length === 0 ? "No alerts dispatched" : `${alerts.length} total — level ${alerts[alerts.length - 1].level}`}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Heart size={28} />
              <h3>No assessment yet</h3>
              <p>Engine has not produced a risk score in this session</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- RiskAreaCard ----------------------------- */
function RiskAreaCard({ zone, onClose }: { zone: RiskZone; onClose: () => void }) {
  const color = colorForRisk(zone.riskScore);
  const label = riskLabel(zone.riskScore);
  return (
    <div className="card" style={{ marginTop: 12, borderColor: color }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div>
          <div className="row" style={{ gap: 8 }}>
            <h3 style={{ color: "var(--color-text-primary)", textTransform: "none", letterSpacing: 0, fontSize: "1rem", marginBottom: 0 }}>
              {zone.name}
            </h3>
            <span className="risk-badge" style={{ background: color + "33", color }}>
              {label}
            </span>
          </div>
          <div className="muted" style={{ fontSize: "0.78rem", marginTop: 4 }}>
            {zone.district}, {zone.state}
          </div>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="grid-2" style={{ gap: 8, marginBottom: 10 }}>
        <div className="card tight" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--color-border)" }}>
          <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Risk score</div>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.25rem", color }}>
            {zone.riskScore}
          </div>
        </div>
        <div className="card tight" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--color-border)" }}>
          <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>Bounded by</div>
          <div className="mono" style={{ fontSize: "0.75rem" }}>
            {zone.ll.lat.toFixed(3)},{zone.ll.lng.toFixed(3)} ↗ {zone.ur.lat.toFixed(3)},{zone.ur.lng.toFixed(3)}
          </div>
        </div>
      </div>

      <div className="area-section">
        <div className="area-section-title">⚠️ Top reported issues</div>
        <div className="area-list">
          {zone.topIssues.map((it, i) => (
            <div className="area-list-item" key={i}>
              <span className="dot" style={{ background: color }} />
              {it}
            </div>
          ))}
        </div>
      </div>

      <div className="area-section">
        <div className="area-section-title">�� When you visit this area</div>
        <div className="area-list">
          <div className="area-list-item">
            <span className="dot" style={{ background: "#22C55E" }} />
            Share your live location with a trusted contact
          </div>
          <div className="area-list-item">
            <span className="dot" style={{ background: "#F59E0B" }} />
            Stick to main roads, avoid the streets highlighted in red
          </div>
          <div className="area-list-item">
            <span className="dot" style={{ background: "#EF4444" }} />
            {zone.riskScore >= 60 ? "Plan a Safe Journey before heading here" : "Stay alert, log an SOS if anything feels off"}
          </div>
        </div>
      </div>
    </div>
  );
}
