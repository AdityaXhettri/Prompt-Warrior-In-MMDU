import { useEffect, useState } from "react";
import { Route, AlertTriangle, MapPin, X, Compass } from "lucide-react";
import type { LatLng, RouteResponse } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

export default function Evacuate() {
  const [origin, setOrigin] = useState<LatLng>({ lat: 28.6139, lng: 77.2090 });
  const [destination, setDestination] = useState<LatLng>({ lat: 28.7041, lng: 77.1025 });
  const [avoidHotspots, setAvoidHotspots] = useState(true);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [pickingDest, setPickingDest] = useState(false);

  const plan = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.planRoute(origin, destination, avoidHotspots);
      setRoute(r);
    } catch (err: any) {
      setError(err?.message || "Failed to plan route");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (latlng: LatLng) => {
    if (pickingOrigin) {
      setOrigin(latlng);
      setPickingOrigin(false);
    } else if (pickingDest) {
      setDestination(latlng);
      setPickingDest(false);
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Side panel */}
      <div className={`maps-panel${panelCollapsed ? " collapsed" : ""}`}>
        <div className="maps-panel-header">
          <div className="maps-panel-title">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Route size={18} color="var(--color-accent-green)" />
              <h2>Safe Routes</h2>
            </div>
            <button
              className="maps-panel-toggle-btn"
              onClick={() => setPanelCollapsed(true)}
              aria-label="Close panel"
            >
              <X size={14} />
            </button>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: 8, lineHeight: 1.4 }}>
            Plan a route that avoids community-reported hotspots.
          </p>
        </div>

        <div
          className="maps-panel-list"
          style={{
            padding: 16,
            gap: 16,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div className="card" style={{ padding: 16, background: "rgba(255, 255, 255, 0.02)" }}>
            <div className="form-group">
              <label style={{ fontSize: "0.8rem" }}>Origin</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={`${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
                  readOnly
                  style={{ flex: 1 }}
                />
                <button
                  className={`btn-icon${pickingOrigin ? " active" : ""}`}
                  onClick={() => {
                    setPickingOrigin(true);
                    setPickingDest(false);
                  }}
                  title="Pick on map"
                  style={pickingOrigin ? { background: "var(--color-accent-green-glow)", color: "var(--color-accent-green)" } : {}}
                >
                  <MapPin size={14} />
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label style={{ fontSize: "0.8rem" }}>Destination</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={`${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`}
                  readOnly
                  style={{ flex: 1 }}
                />
                <button
                  className="btn-icon"
                  onClick={() => {
                    setPickingDest(true);
                    setPickingOrigin(false);
                  }}
                  title="Pick on map"
                  style={pickingDest ? { background: "var(--color-accent-green-glow)", color: "var(--color-accent-green)" } : {}}
                >
                  <MapPin size={14} />
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={avoidHotspots}
                  onChange={(e) => setAvoidHotspots(e.target.checked)}
                />
                Avoid community hotspots
              </label>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 16 }}
              onClick={plan}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner-sm" />
                  Planning…
                </>
              ) : (
                <>
                  <Compass size={14} />
                  Plan safe route
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="card" style={{ borderColor: "rgba(239,68,68,0.3)", padding: 12, background: "rgba(239,68,68,0.05)" }}>
              <p
                style={{
                  color: "var(--color-accent-red)",
                  fontSize: "0.85rem",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <AlertTriangle size={14} /> {error}
              </p>
            </div>
          )}

          {route && (
            <div className="card" style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 16 }}>Route Details</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  padding: 12,
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--color-text-muted)" }}>Distance</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-accent-green)",
                    textAlign: "right",
                  }}
                >
                  {(route.distance_m / 1000).toFixed(2)} km
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>Duration</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-accent-green)",
                    textAlign: "right",
                  }}
                >
                  {Math.round(route.duration_s / 60)} min
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>Safety score</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-accent-green)",
                    textAlign: "right",
                  }}
                >
                  {Math.round(route.safety_score * 100)}%
                </span>
              </div>

              {route.notes && route.notes.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    borderRadius: 8,
                    marginBottom: 12,
                    fontSize: "0.8rem",
                    color: "var(--color-accent-yellow)",
                  }}
                >
                  <strong>Heads up:</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                    {route.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="route-timeline" style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                <div className="route-step">
                  <div
                    className="step-dot"
                    style={{
                      borderColor: "var(--color-accent-green)",
                      background: "var(--color-accent-green)",
                    }}
                  />
                  <div className="step-info">
                    <h4 style={{ color: "var(--color-accent-green)" }}>�� Origin</h4>
                    <p>
                      {origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
                <div className="route-step">
                  <div
                    className="step-dot"
                    style={{
                      borderColor: "var(--color-accent-red)",
                      background: "var(--color-accent-red)",
                    }}
                  />
                  <div className="step-info">
                    <h4 style={{ color: "var(--color-accent-red)" }}>�� Destination</h4>
                    <p>
                      {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-fullscreen">
        <MapView
          center={origin}
          position={origin}
          destination={destination}
          expectedRoute={route?.polyline || []}
          actualRoute={[]}
          onMapClick={handleMapClick}
          showZones={false}
        />
      </div>

      {/* Show panel button when collapsed */}
      {panelCollapsed && (
        <button
          className="show-panel-btn"
          onClick={() => setPanelCollapsed(false)}
          aria-label="Show routing panel"
        >
          <Route size={16} />
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Configure Route</span>
        </button>
      )}
    </div>
  );
}
