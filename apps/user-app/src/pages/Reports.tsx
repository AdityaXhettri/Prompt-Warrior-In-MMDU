import { useEffect, useState } from "react";
import { AlertOctagon, MapPin, Plus } from "lucide-react";
import type { CommunityReport, Hotspot, LatLng } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

const CATEGORIES: { id: CommunityReport["category"]; label: string }[] = [
  { id: "poor_lighting", label: "Poor lighting" },
  { id: "harassment", label: "Harassment" },
  { id: "dangerous_crossing", label: "Dangerous crossing" },
  { id: "accident", label: "Accident" },
  { id: "suspicious_activity", label: "Suspicious activity" },
  { id: "broken_streetlight", label: "Broken streetlight" },
  { id: "other", label: "Other" },
];

export default function Reports({ userId }: Props) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [picking, setPicking] = useState(false);
  const [category, setCategory] = useState<CommunityReport["category"]>("poor_lighting");
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<LatLng | null>(null);

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
    reload();
  }

  return (
    <>
      <div>
        <h1 className="page-title">Community Reports</h1>
        <div className="page-subtitle">
          Anonymous safety reports around you. SafetyNet uses aggregated hotspots to suggest
          safer routes — never to assume a single report means a place is dangerous.
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Map</h3>
          <MapView
            center={picked || { lat: 28.6139, lng: 77.2090 }}
            position={picked}
            hotspots={hotspots}
            onMapClick={(latlng) => picking && setPicked(latlng)}
          />
        </div>
        <div className="card">
          <h3>Report an issue</h3>
          <div className="row">
            <button
              className="btn"
              onClick={() => setPicking((p) => !p)}
              style={{ background: picking ? "var(--bg-3)" : undefined }}
            >
              <MapPin size={14} /> {picking ? "Click map to pick location" : "Pick on map"}
            </button>
            {picked && (
              <span className="muted">
                {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
              </span>
            )}
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Category</label>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Severity (1 low – 5 high)</label>
            <input
              type="range"
              min={1}
              max={5}
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
            />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <textarea
              className="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <button className="btn primary" disabled={!picked} onClick={submit}>
            <Plus size={14} /> File report
          </button>

          <div style={{ marginTop: 16 }}>
            <h3>Aggregated hotspots</h3>
            <div className="timeline">
              {hotspots.length === 0 ? (
                <div className="empty">No hotspots yet.</div>
              ) : (
                hotspots.map((h) => (
                  <div className="timeline-item" key={h.cell_id}>
                    <div className="icon">
                      <AlertOctagon size={14} />
                    </div>
                    <div className="body">
                      <div className="title">
                        {h.count} reports · risk {Math.round(h.risk_weight * 100)}%
                      </div>
                      <div className="meta">
                        {h.top_categories.join(", ")}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Recent reports</h3>
        {reports.length === 0 ? (
          <div className="empty">No reports yet.</div>
        ) : (
          <div className="grid grid-3">
            {reports.slice(-9).reverse().map((r) => (
              <div className="card tight" key={r.id}>
                <strong>{r.category.replace(/_/g, " ")}</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  severity {r.severity} · {r.location.lat.toFixed(4)}, {r.location.lng.toFixed(4)}
                </div>
                {r.description && (
                  <div style={{ fontSize: 13, marginTop: 6 }}>{r.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
