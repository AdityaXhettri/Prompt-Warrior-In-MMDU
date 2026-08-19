import { useEffect, useState, useRef, useCallback } from "react";
import {
  AlertTriangle,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Plus,
  Minus,
  RefreshCw,
  X,
  Activity,
  Bell,
  Heart,
  Battery,
  ShieldCheck,
} from "lucide-react";
import type { SafetyEvent, SafetyState, SafetyZone, RiskAssessment } from "@safetynet/shared-types";
import { api, subscribeStream } from "../lib/api";
import MapView from "../components/MapView";

interface DashboardProps {
  userId: string;
  state: SafetyState | null;
  onNavigate?: (p: string) => void;
}

const SAFETY_FILTERS = [
  { id: "zones", label: "Zones", icon: ShieldCheck },
  { id: "events", label: "Events", icon: Activity },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "risk", label: "Risk", icon: Heart },
];

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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"time" | "level">("time");
  const [filter, setFilter] = useState<string>("zones");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);
  const [_lastEvent, setLastEvent] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, r, a, z] = await Promise.all([
        api.events(userId, 40),
        api.risks(userId, 8),
        api.alerts(userId),
        api.zones(userId),
      ]);
      setEvents(e);
      setRisks(r);
      setAlerts(a);
      setZones(z);
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
    const unsub = subscribeStream(userId, (msg) => {
      if (msg && typeof msg === "object" && "safety_level" in msg) {
        setLastEvent(msg);
      }
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

  const handleZoomIn = () => {
    if (mapRef.current?.setZoom) {
      mapRef.current.setZoom(Math.min((mapRef.current.getZoom() || 13) + 1, 18));
    }
  };
  const handleZoomOut = () => {
    if (mapRef.current?.setZoom) {
      mapRef.current.setZoom(Math.max((mapRef.current.getZoom() || 13) - 1, 3));
    }
  };
  const handleReset = () => {
    if (mapRef.current?.setView) {
      mapRef.current.setView([0, 0], 3);
    }
  };

  // Panel contents
  const filtered =
    filter === "zones"
      ? zones
      : filter === "events"
      ? events
      : filter === "alerts"
      ? alerts
      : risks;

  const displayList = Array.isArray(filtered)
    ? filtered.filter((it: any) => {
        if (!search) return true;
        const text = (it.label || it.name || it.type || it.message || it.explanation || "")
          .toString()
          .toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : [];

  return (
    <div className="dashboard-layout">
      {/* Map fills the viewport */}
      <div className="map-fullscreen">
        <MapView
          center={position || { lat: 28.6139, lng: 77.2090 }}
          position={position}
          zones={zones}
          showZones
        />
      </div>

      {/* Backend error banner */}
      {error && (
        <div className="backend-error-banner">
          <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
          <span style={{ color: "#F87171", fontSize: "0.85rem", lineHeight: 1.4 }}>{error}</span>
          <button onClick={() => setRetryCount((c) => c + 1)}>
            <RefreshCw size={13} /> Retry
          </button>
          <button
            onClick={() => setError(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Data loading overlay */}
      {loading && !error && (
        <div className="data-loading-overlay">
          <div className="spinner-sm" />
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
            Loading live data…
          </span>
        </div>
      )}

      {/* Maps Panel */}
      <Panel
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        collapsed={panelCollapsed}
        onToggle={() => setPanelCollapsed((p) => !p)}
        items={displayList}
        safetyLevel={level}
        score={score}
      />

      {/* Floating panel toggle button */}
      {panelCollapsed && (
        <button
          className="panel-toggle-float"
          onClick={() => setPanelCollapsed(false)}
          aria-label="Open panel"
          title="Show overview"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Floating filter bar */}
      <div
        className="map-disaster-bar"
        style={panelCollapsed ? {} : { left: "calc(380px + 50%)", transform: "translateX(calc(-50% - 190px))" }}
      >
        {SAFETY_FILTERS.map((f) => (
          <button
            key={f.id}
            className={filter === f.id ? "active" : ""}
            onClick={() => setFilter(f.id)}
          >
            <f.icon size={12} />
            {f.label}
          </button>
        ))}
      </div>

      {/* Map controls */}
      <div className="map-controls-bottom">
        <button className="map-ctrl-btn" onClick={handleZoomIn} aria-label="Zoom in" title="Zoom in">
          <Plus />
        </button>
        <div className="map-ctrl-zoom-divider" />
        <button className="map-ctrl-btn" onClick={handleZoomOut} aria-label="Zoom out" title="Zoom out">
          <Minus />
        </button>
        <button className="map-ctrl-btn" onClick={handleReset} aria-label="Reset view" title="Reset view">
          <Compass />
        </button>
      </div>
    </div>
  );
}

/* ─── Side panel ──────────────────────────────────────────────── */
interface PanelProps {
  filter: string;
  setFilter: (f: string) => void;
  search: string;
  setSearch: (s: string) => void;
  sortBy: "time" | "level";
  setSortBy: (s: "time" | "level") => void;
  collapsed: boolean;
  onToggle: () => void;
  items: any[];
  safetyLevel: string;
  score: number;
}

function Panel({
  filter,
  setFilter,
  search,
  setSearch,
  sortBy,
  setSortBy,
  collapsed,
  onToggle,
  items,
  safetyLevel,
  score,
}: PanelProps) {
  const counts: Record<string, number> = {
    zones: 0,
    events: 0,
    alerts: 0,
    risk: 0,
  };
  // (Counts are passed via items length; here we just show the filter name)

  return (
    <div className={`maps-panel${collapsed ? " collapsed" : ""}`}>
      <div className="maps-panel-header">
        <div className="maps-panel-title">
          <h2>Safety Overview</h2>
          <button className="maps-panel-toggle-btn" onClick={onToggle} aria-label="Close panel">
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Status quick-stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div className="card tight" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--color-border)" }}>
            <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Safety level
            </div>
            <span className={`badge ${safetyLevel}`}>{SAFETY_LABEL[safetyLevel] || safetyLevel}</span>
          </div>
          <div className="card tight" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--color-border)" }}>
            <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Risk score
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.25rem" }}>{score}</div>
          </div>
        </div>

        {/* Search */}
        <div className="maps-panel-search">
          <Search />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingRight: "32px" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="maps-panel-clear-btn" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="maps-panel-controls">
          <div className="maps-panel-sort">
            <button className={sortBy === "time" ? "active" : ""} onClick={() => setSortBy("time")}>
              <ArrowUpDown size={10} />
              Recent
            </button>
            <button className={sortBy === "level" ? "active" : ""} onClick={() => setSortBy("level")}>
              Severity
            </button>
          </div>
        </div>
      </div>

      <div className="maps-panel-list">
        {items.length === 0 ? (
          <div className="empty-state">
            <Search size={32} />
            <h3>No items in this view</h3>
            <p>Try a different filter or search term</p>
          </div>
        ) : (
          <Sort items={items} by={sortBy} filter={filter} />
        )}
      </div>
    </div>
  );
}

function Sort({ items, by, filter }: { items: any[]; by: string; filter: string }) {
  let sorted = [...items];
  if (filter === "events") {
    sorted.sort((a, b) =>
      by === "time"
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : 0
    );
  }
  return (
    <>
      {sorted.map((it: any, i) => {
        if (filter === "zones") {
          return (
            <div className="district-card" key={it.id || i}>
              <div className="district-card-header">
                <div>
                  <div className="district-card-name">{it.label}</div>
                  <div className="district-card-state">
                    {it.kind} · {Math.round(it.radius_m)}m
                  </div>
                </div>
                <span className="risk-badge low">zone</span>
              </div>
              <div className="district-card-meta">
                <span className="district-card-risk" style={{ color: "var(--color-accent-green)" }}>
                  {it.center.lat.toFixed(4)}, {it.center.lng.toFixed(4)}
                </span>
              </div>
            </div>
          );
        }
        if (filter === "events") {
          return (
            <div className="district-card" key={it.id || i}>
              <div className="district-card-header">
                <div>
                  <div className="district-card-name">{it.type.replace(/_/g, " ")}</div>
                  <div className="district-card-state">
                    {it.location ? `${it.location.lat.toFixed(4)}, ${it.location.lng.toFixed(4)}` : "no location"}
                  </div>
                </div>
                <span className="risk-badge low">event</span>
              </div>
              <div className="district-card-meta">
                <span className="muted" style={{ fontSize: "0.7rem" }}>
                  {new Date(it.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        }
        if (filter === "alerts") {
          return (
            <div className="district-card" key={it.id || i}>
              <div className="district-card-header">
                <div>
                  <div className="district-card-name">{it.message?.slice(0, 60) || "alert"}</div>
                  <div className="district-card-state">
                    {it.to || "in-app"} · {it.status}
                  </div>
                </div>
                <span className={`risk-badge ${it.level === "emergency" ? "critical" : "low"}`}>
                  {it.level}
                </span>
              </div>
              <div className="district-card-meta">
                <span className="muted" style={{ fontSize: "0.7rem" }}>
                  {new Date(it.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        }
        if (filter === "risk") {
          return (
            <div className="district-card" key={it.id || i}>
              <div className="district-card-header">
                <div>
                  <div className="district-card-name">{it.explanation}</div>
                  <div className="district-card-state">
                    score {it.risk_score}/100 · conf {Math.round(it.confidence * 100)}%
                  </div>
                </div>
                <span className={`risk-badge ${it.risk_level}`}>{it.risk_level}</span>
              </div>
              <div className="district-card-meta">
                <span className="muted" style={{ fontSize: "0.7rem" }}>
                  {new Date(it.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}
