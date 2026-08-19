import { useState } from "react";
import { Route, AlertTriangle, Compass, Plus } from "lucide-react";
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

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Safe Routes</h1>
        <p>Plan a route that avoids community-reported hotspots. SafetyNet can recommend a slightly longer but safer route.</p>
      </div>

      <div className="grid-sidebar">
        <div>
          <div className="section-map">
            <MapView
              center={origin}
              position={origin}
              destination={destination}
              expectedRoute={route?.polyline || []}
              actualRoute={[]}
              showZones={false}
            />
          </div>
          <div className="map-legend" style={{ position: "relative", marginTop: 8, transform: "none", left: "auto", bottom: "auto" }}>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#0ea5e9" }} /> Planned route</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#f97316" }} /> Destination</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <h3 className="section-title"><Route size={16} color="var(--color-accent-green)" /> Route controls</h3>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.7rem" }}>Origin</label>
              <input
                className="input"
                value={`${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
                readOnly
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: "0.7rem" }}>Destination</label>
              <input
                className="input"
                value={`${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}`}
                readOnly
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", cursor: "pointer", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={avoidHotspots}
                onChange={(e) => setAvoidHotspots(e.target.checked)}
              />
              Avoid community hotspots
            </label>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 12 }}
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
            <div className="card" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
              <p style={{ color: "var(--color-accent-red)", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={14} /> {error}
              </p>
            </div>
          )}

          {route && (
            <div className="card">
              <h3 className="section-title"><Plus size={16} color="var(--color-accent-green)" /> Route details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div className="card tight" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Distance</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent-green)" }}>
                    {(route.distance_m / 1000).toFixed(2)} km
                  </div>
                </div>
                <div className="card tight" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Duration</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent-green)" }}>
                    {Math.round(route.duration_s / 60)} min
                  </div>
                </div>
                <div className="card tight" style={{ background: "rgba(0,0,0,0.3)", gridColumn: "1 / -1" }}>
                  <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Safety score</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-accent-green)", fontSize: "1.1rem" }}>
                    {Math.round(route.safety_score * 100)}%
                  </div>
                </div>
              </div>
              {route.notes && route.notes.length > 0 && (
                <div style={{ padding: 12, background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 8, fontSize: "0.8rem", color: "var(--color-accent-yellow)" }}>
                  <strong>Heads up:</strong>
                  <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                    {route.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
