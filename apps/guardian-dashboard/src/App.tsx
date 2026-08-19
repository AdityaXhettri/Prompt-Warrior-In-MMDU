import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Plus,
  Minus,
  Activity,
  Bell,
  Heart,
  ShieldCheck,
  Phone,
  RefreshCw,
  X,
} from "lucide-react";
import type { SafetyEvent, SafetyState, SafetyZone } from "@safetynet/shared-types";
import { api, subscribeStream } from "./lib/api";
import MapView from "./components/MapView";

const USER_ID = "demo-user";

const FILTERS = [
  { id: "events", label: "Events", icon: Activity },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "risk", label: "Risk", icon: Heart },
];

const SAFETY_LABEL: Record<string, string> = {
  normal: "Nominal",
  check_in: "Check-in needed",
  guardian_alert: "Guardian alert",
  emergency: "Emergency",
};

export default function App() {
  const [state, setState] = useState<SafetyState | null>(null);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [actualRoute, setActualRoute] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"time" | "level">("time");
  const [filter, setFilter] = useState<string>("events");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<any>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
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
    } catch (err: any) {
      setError(
        err?.message?.toLowerCase().includes("fetch")
          ? "Cannot reach the backend — make sure it is running on port 8000."
          : err?.message || "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    const unsub = subscribeStream(USER_ID, (msg) => {
      if (msg && typeof msg === "object" && "safety_level" in msg) {
        setState(msg as SafetyState);
      }
    });
    return () => {
      clearInterval(t);
      unsub();
    };
  }, [retryCount]);

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

  const filtered = filter === "events" ? events : filter === "alerts" ? alerts : [];
  const displayList = Array.isArray(filtered)
    ? filtered.filter((it: any) => {
        if (!search) return true;
        const text = (it.type || it.message || it.explanation || "")
          .toString()
          .toLowerCase();
        return text.includes(search.toLowerCase());
      })
    : [];

  return (
    <div className="dashboard-layout">
      {/* Map */}
      <div className="map-fullscreen">
        <MapView
          center={position || { lat: 28.6139, lng: 77.2090 }}
          position={position}
          destination={activeJourney?.destination}
          zones={zones}
          expectedRoute={activeJourney?.expected_route}
          actualRoute={actualRoute}
          mapRef={mapRef}
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
            style={{ background: "transparent", border: "none", color: "#64748B", cursor: "pointer", padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {loading && !error && (
        <div className="data-loading-overlay">
          <div className="spinner-sm" />
          <span style={{ color: "var(--color-text-secondary)", fontSize: "0.85rem" }}>
            Connecting to traveler…
          </span>
        </div>
      )}

      {/* Maps Panel */}
      <aside className={`maps-panel${panelCollapsed ? " collapsed" : ""}`}>
        <div className="maps-panel-header">
          <div className="maps-panel-title">
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={16} color="var(--color-accent-green)" />
              Guardian
            </h2>
            <button className="maps-panel-toggle-btn" onClick={() => setPanelCollapsed(true)} aria-label="Close panel">
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* Status */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
              marginTop: 12,
            }}
          >
            <div
              className="card tight"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Safety level
              </div>
              <span className={`badge ${level}`}>{SAFETY_LABEL[level] || level}</span>
            </div>
            <div
              className="card tight"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Risk score
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.25rem" }}>{score}</div>
            </div>
          </div>

          {/* ETA / journey */}
          {activeJourney && (
            <div
              className="card tight"
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--color-border)",
                marginBottom: 12,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    ETA
                  </div>
                  <strong style={{ fontSize: "0.9rem" }}>
                    {new Date(activeJourney.expected_arrival_at).toLocaleTimeString()}
                  </strong>
                </div>
                <span className="risk-badge low">{activeJourney.familiarity}</span>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="maps-panel-search">
            <Search />
            <input
              type="text"
              placeholder="Search…"
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
          {displayList.length === 0 ? (
            <div className="empty-state">
              <Search size={32} />
              <h3>No {filter}</h3>
              <p>You're up to date.</p>
            </div>
          ) : (
            displayList.map((it: any, i) => {
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
              return null;
            })
          )}
        </div>

        {/* Guardian actions */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={() => api.checkIn(USER_ID, true)}
          >
            <Phone size={14} /> Send "I'm OK" prompt
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: "100%" }}
            onClick={() => api.analyze(USER_ID)}
          >
            <RefreshCw size={14} /> Re-analyze now
          </button>
        </div>
      </aside>

      {/* Floating panel toggle */}
      {panelCollapsed && (
        <button
          className="panel-toggle-float"
          onClick={() => setPanelCollapsed(false)}
          aria-label="Open panel"
          title="Show guardian panel"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Floating filter bar */}
      <div
        className="map-disaster-bar"
        style={panelCollapsed ? {} : { left: "calc(380px + 50%)", transform: "translateX(calc(-50% - 190px))" }}
      >
        {FILTERS.map((f) => (
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
