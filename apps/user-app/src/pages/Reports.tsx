import { useEffect, useState } from "react";
import {
  AlertOctagon,
  MapPin,
  Plus,
  Search,
  X,
  Activity,
  Flame,
  Lightbulb,
  Construction,
  Users,
  Eye,
} from "lucide-react";
import type { CommunityReport, Hotspot, LatLng } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

const CATEGORIES = [
  { id: "poor_lighting", label: "Poor lighting", icon: Lightbulb, color: "#F59E0B" },
  { id: "harassment", label: "Harassment", icon: Users, color: "#EF4444" },
  { id: "dangerous_crossing", label: "Dangerous crossing", icon: Construction, color: "#F97316" },
  { id: "accident", label: "Accident", icon: AlertOctagon, color: "#EF4444" },
  { id: "suspicious_activity", label: "Suspicious activity", icon: Eye, color: "#8B5CF6" },
  { id: "broken_streetlight", label: "Broken streetlight", icon: Lightbulb, color: "#F59E0B" },
  { id: "other", label: "Other", icon: Activity, color: "#3B82F6" },
];

export default function Reports({ userId }: Props) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<LatLng | null>(null);
  const [category, setCategory] = useState<CommunityReport["category"]>("poor_lighting");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [activePane, setActivePane] = useState<"reports" | "hotspots" | "new">("reports");

  const reload = () => {
    api.reports().then(setReports).catch(() => {});
    api.hotspots().then(setHotspots).catch(() => {});
  };
  useEffect(reload, [userId]);

  async function submit() {
    if (!picked) return;
    await api.addReport({
      id: "",
      user_id: userId,
      location: picked,
      category,
      severity,
      description,
      created_at: new Date().toISOString(),
    });
    setPicked(null);
    setDescription("");
    setPicking(false);
    setActivePane("reports");
    reload();
  }

  const filteredReports = reports.filter((r) =>
    (r.category + " " + (r.description || "")).toLowerCase().includes(search.toLowerCase())
  );

  const center: LatLng = picked || { lat: 28.6139, lng: 77.2090 };

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Community Reports</h1>
        <p>Anonymous reports of unsafe conditions. SafetyNet aggregates them into hotspots and uses them as routing context — never as proof of danger.</p>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total reports</span>
          <span className="stat-value">{reports.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Hotspots</span>
          <span className="stat-value">{hotspots.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Top category</span>
          <span className="stat-value" style={{ fontSize: "1.25rem" }}>
            {reports[0]?.category?.replace(/_/g, " ") || "—"}
          </span>
        </div>
      </div>

      {/* Map + side */}
      <div className="grid-sidebar">
        <div>
          <div className="section-map">
            <MapView
              center={center}
              position={picked}
              hotspots={hotspots}
              onMapClick={(latlng) => picking && setPicked(latlng)}
              showZones={false}
            />
          </div>
          <div className="map-legend" style={{ position: "relative", marginTop: 8, transform: "none", left: "auto", bottom: "auto" }}>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#EF4444" }} /> Hotspot</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#0ea5e9" }} /> Picked location</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <h3 className="section-title"><AlertOctagon size={16} color="var(--color-accent-green)" /> Reports</h3>
            <div className="map-disaster-bar" style={{ position: "static", transform: "none", marginBottom: 8, width: "100%" }}>
              <button
                className={activePane === "reports" ? "active" : ""}
                onClick={() => setActivePane("reports")}
                style={{ flex: 1 }}
              >
                <Activity size={12} /> Reports
              </button>
              <button
                className={activePane === "hotspots" ? "active" : ""}
                onClick={() => setActivePane("hotspots")}
                style={{ flex: 1 }}
              >
                <Flame size={12} /> Hotspots
              </button>
              <button
                className={activePane === "new" ? "active" : ""}
                onClick={() => setActivePane("new")}
                style={{ flex: 1 }}
              >
                <Plus size={12} /> New
              </button>
            </div>

            {activePane === "reports" && (
              <div className="maps-panel-search" style={{ marginBottom: 8 }}>
                <Search />
                <input
                  type="text"
                  placeholder="Filter…"
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

            {activePane === "reports" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {filteredReports.length === 0 ? (
                  <div className="empty-state"><p>No reports yet</p></div>
                ) : (
                  filteredReports.slice().reverse().map((r) => {
                    const cat = CATEGORIES.find((c) => c.id === r.category);
                    const Icon = cat?.icon || Activity;
                    return (
                      <div
                        className="district-card"
                        key={r.id}
                        onClick={() => setPicked(r.location)}
                      >
                        <div className="district-card-header">
                          <div>
                            <div className="district-card-name">
                              <Icon size={12} style={{ verticalAlign: "middle", marginRight: 6, color: cat?.color }} />
                              {r.category.replace(/_/g, " ")}
                            </div>
                            <div className="district-card-state">severity {r.severity}</div>
                          </div>
                          <span className={`risk-badge ${r.severity >= 4 ? "critical" : r.severity >= 3 ? "high" : "low"}`}>
                            sev {r.severity}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activePane === "hotspots" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {hotspots.length === 0 ? (
                  <div className="empty-state"><p>No hotspots yet</p></div>
                ) : (
                  hotspots.map((h) => (
                    <div
                      className="district-card"
                      key={h.cell_id}
                      onClick={() => setPicked(h.center)}
                    >
                      <div className="district-card-header">
                        <div>
                          <div className="district-card-name">{h.count} reports</div>
                          <div className="district-card-state">{h.top_categories.join(", ")}</div>
                        </div>
                        <span className={`risk-badge ${h.risk_weight > 0.6 ? "critical" : h.risk_weight > 0.3 ? "high" : "low"}`}>
                          {Math.round(h.risk_weight * 100)}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activePane === "new" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Category</label>
                  <select
                    className="select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CommunityReport["category"])}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div className="row between">
                    <label style={{ fontSize: "0.7rem" }}>Severity</label>
                    <span className="range-display">{severity} / 5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={severity}
                    onChange={(e) => setSeverity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Description</label>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What happened?"
                  />
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPicking((p) => !p)}
                  style={{
                    background: picking ? "var(--color-accent-green-glow)" : undefined,
                    borderColor: picking ? "var(--color-accent-green)" : undefined,
                    color: picking ? "var(--color-accent-green)" : undefined,
                  }}
                >
                  <MapPin size={14} />
                  {picking ? "Click map to pick" : "Pick on map"}
                </button>
                {picked && (
                  <div className="muted" style={{ fontSize: "0.7rem", padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 8, fontFamily: "var(--font-mono)" }}>
                    {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
                  </div>
                )}
                <button className="btn btn-primary" disabled={!picked} onClick={submit}>
                  <Plus size={14} /> File report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
