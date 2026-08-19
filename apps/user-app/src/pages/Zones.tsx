import { useEffect, useState } from "react";
import { MapPin, Plus, Sparkles, Trash } from "lucide-react";
import type { FamiliarSuggestion, LatLng, SafetyZone } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

export default function Zones({ userId }: Props) {
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [suggestions, setSuggestions] = useState<FamiliarSuggestion[]>([]);
  const [picking, setPicking] = useState<{ center: LatLng } | null>(null);
  const [label, setLabel] = useState("Custom");
  const [radius, setRadius] = useState(250);
  const [kind, setKind] = useState<SafetyZone["kind"]>("custom");

  const reload = () => {
    api.listZones(userId).then(setZones).catch(() => {});
    api.zoneSuggestions(userId).then(setSuggestions).catch(() => {});
  };

  useEffect(reload, [userId]);

  async function addZone() {
    if (!picking) return;
    await api.createZone({
      id: "",
      user_id: userId,
      label,
      center: picking.center,
      radius_m: radius,
      kind,
      is_familiar_suggestion: false,
      created_at: new Date().toISOString(),
    });
    setPicking(null);
    reload();
  }

  async function acceptSuggestion(s: FamiliarSuggestion) {
    await api.createZone({
      id: "",
      user_id: userId,
      label: "Frequent stop",
      center: s.center,
      radius_m: s.suggested_radius_m,
      kind: "custom",
      is_familiar_suggestion: true,
      created_at: new Date().toISOString(),
    });
    reload();
  }

  async function deleteZone(id: string) {
    await api.deleteZone(id);
    reload();
  }

  return (
    <>
      <div>
        <h1 className="page-title">Safety Zones</h1>
        <div className="page-subtitle">
          Define places where you feel safe. SafetyNet treats them as familiar — leaving them is
          not an emergency, but it does start paying attention.
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Map</h3>
          <MapView
            center={picking?.center || zones[0]?.center || { lat: 28.6139, lng: 77.2090 }}
            position={picking?.center}
            zones={zones}
            onMapClick={(latlng) => setPicking({ center: latlng })}
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {picking
              ? `Picked: ${picking.center.lat.toFixed(4)}, ${picking.center.lng.toFixed(4)}`
              : "Click anywhere on the map to add a new Safety Zone."}
          </div>
        </div>

        <div className="card">
          <h3>{picking ? "New zone" : "Add zone"}</h3>
          {!picking ? (
            <div className="empty">Click a point on the map to begin.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="field">
                <label>Label</label>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="field">
                <label>Kind</label>
                <select className="select" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                  <option value="home">Home</option>
                  <option value="college">College</option>
                  <option value="hostel">Hostel</option>
                  <option value="work">Work</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="field">
                <label>Radius (m)</label>
                <input
                  className="input"
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                />
              </div>
              <div className="row">
                <button className="btn primary" onClick={addZone}>
                  <Plus size={14} /> Add zone
                </button>
                <button className="btn ghost" onClick={() => setPicking(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <h3>Familiar suggestions</h3>
            {suggestions.length === 0 ? (
              <div className="empty">No suggestions yet — travel a bit and SafetyNet will offer zones for you.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {suggestions.map((s) => (
                  <div className="timeline-item" key={`${s.center.lat}-${s.center.lng}`}>
                    <div className="icon">
                      <Sparkles size={14} />
                    </div>
                    <div className="body">
                      <div className="title">{s.label}</div>
                      <div className="meta">
                        {s.center.lat.toFixed(4)}, {s.center.lng.toFixed(4)} · {s.visits} visits
                      </div>
                    </div>
                    <button className="btn" onClick={() => acceptSuggestion(s)}>
                      <Plus size={12} /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Your zones</h3>
        {zones.length === 0 ? (
          <div className="empty">No zones yet.</div>
        ) : (
          <div className="grid grid-3">
            {zones.map((z) => (
              <div className="card tight" key={z.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <MapPin size={14} />
                    <strong>{z.label}</strong>
                  </div>
                  <button className="btn ghost" onClick={() => deleteZone(z.id)}>
                    <Trash size={12} />
                  </button>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {z.kind} · {z.radius_m}m · {z.center.lat.toFixed(4)}, {z.center.lng.toFixed(4)}
                </div>
                {z.is_familiar_suggestion && (
                  <span className="badge low" style={{ marginTop: 8 }}>
                    from frequent visits
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
