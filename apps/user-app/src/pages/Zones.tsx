import { useEffect, useState } from "react";
import {
  MapPin,
  Plus,
  Sparkles,
  Trash,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Compass,
  Plus as PlusIcon,
  Minus,
  Home,
  Building2,
  Briefcase,
  School,
  MapPinHouse,
} from "lucide-react";
import type { FamiliarSuggestion, LatLng, SafetyZone } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

const KINDS = [
  { id: "home", label: "Home", icon: Home },
  { id: "college", label: "College", icon: School },
  { id: "hostel", label: "Hostel", icon: Building2 },
  { id: "work", label: "Work", icon: Briefcase },
  { id: "custom", label: "Custom", icon: MapPinHouse },
];

interface Props {
  userId: string;
}

export default function Zones({ userId }: Props) {
  const [zones, setZones] = useState<SafetyZone[]>([]);
  const [suggestions, setSuggestions] = useState<FamiliarSuggestion[]>([]);
  const [picking, setPicking] = useState<{ center: LatLng } | null>(null);
  const [zoneName, setZoneName] = useState("Home");
  const [radius, setRadius] = useState(250);
  const [kind, setKind] = useState<SafetyZone["kind"]>("home");
  const [search, setSearch] = useState("");
  const [activePane, setActivePane] = useState<"zones" | "suggestions">("zones");

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
      label: zoneName.trim() || "Untitled zone",
      center: picking.center,
      radius_m: radius,
      kind,
      is_familiar_suggestion: false,
      created_at: new Date().toISOString(),
    });
    setPicking(null);
    setZoneName("Home");
    setRadius(250);
    setKind("home");
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

  const filteredZones = zones.filter((z) =>
    (z.label || "").toLowerCase().includes(search.toLowerCase())
  );

  const center: LatLng = picking?.center || zones[0]?.center || { lat: 28.6139, lng: 77.2090 };

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Safety Zones</h1>
        <p>
          Define places where you feel safe. <strong>Inside a green zone</strong> everything is normal.
          Crossing the boundary is not an emergency — SafetyNet just starts paying closer attention.
        </p>
      </div>

      {/* Top KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Your zones</span>
          <span className="stat-value">{zones.length}</span>
          <span className="stat-sub">all marked as safe</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Suggestions</span>
          <span className="stat-value">{suggestions.length}</span>
          <span className="stat-sub">frequent visits</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Picked radius</span>
          <span className="stat-value">{radius}m</span>
          <span className="stat-sub">about {Math.round(radius / 80)} min walking</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active kind</span>
          <span className="stat-value" style={{ fontSize: "1.25rem" }}>{kind}</span>
          <span className="stat-sub">applied to next zone</span>
        </div>
      </div>

      {/* Map + side panel */}
      <div className="grid-sidebar">
        <div>
          {/* Map */}
          <div className="section-map">
            <MapView
              center={center}
              position={picking?.center}
              zones={zones}
              onMapClick={(latlng) => setPicking({ center: latlng })}
              showZones
            />
          </div>
          <div className="map-legend" style={{ position: "relative", marginTop: 8, transform: "none", left: "auto", bottom: "auto" }}>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#22C55E" }} /> Safe area (your zone)</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#0ea5e9" }} /> Picked center</div>
          </div>
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Add zone form */}
          <div className="card">
            <h3 className="section-title"><PlusIcon size={16} color="var(--color-accent-green)" /> {picking ? "New zone" : "Add zone"}</h3>
            {!picking ? (
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                Click on the map to pick a center, then configure the zone below.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Zone name</label>
                  <input
                    className="input"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="Home, College, Hostel…"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Kind</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                    {KINDS.map((k) => {
                      const Icon = k.icon;
                      const active = kind === k.id;
                      return (
                        <button
                          key={k.id}
                          onClick={() => setKind(k.id as SafetyZone["kind"])}
                          style={{
                            background: active ? "var(--color-accent-green-glow)" : "var(--color-bg-secondary)",
                            border: `1px solid ${active ? "var(--color-accent-green)" : "var(--color-border)"}`,
                            color: active ? "var(--color-accent-green)" : "var(--color-text-secondary)",
                            padding: "8px 4px",
                            borderRadius: 8,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            fontFamily: "inherit",
                          }}
                        >
                          <Icon size={14} />
                          {k.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div className="row between">
                    <label style={{ fontSize: "0.7rem" }}>Radius</label>
                    <span className="range-display">{radius}m</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={2000}
                    step={50}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  />
                </div>
                <div className="muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                  Center: {picking.center.lat.toFixed(4)}, {picking.center.lng.toFixed(4)}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={addZone}>
                    <Plus size={14} /> Save zone
                  </button>
                  <button className="btn btn-secondary" onClick={() => setPicking(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions */}
          <div className="card">
            <h3 className="section-title"><Sparkles size={16} color="var(--color-accent-green)" /> Familiar suggestions</h3>
            {suggestions.length === 0 ? (
              <div className="empty-state">
                <Sparkles size={28} />
                <h3>No suggestions yet</h3>
                <p>Travel a bit and SafetyNet will offer zones for you</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {suggestions.map((s) => (
                  <div className="district-card" key={`${s.center.lat}-${s.center.lng}`}>
                    <div className="district-card-header">
                      <div>
                        <div className="district-card-name">{s.label}</div>
                        <div className="district-card-state">
                          {s.center.lat.toFixed(4)}, {s.center.lng.toFixed(4)} · {s.visits} visits
                        </div>
                      </div>
                      <button className="btn-icon" onClick={() => acceptSuggestion(s)} aria-label="Add suggestion">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zones list */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 className="section-title" style={{ marginBottom: 0 }}><MapPin size={16} color="var(--color-accent-green)" /> Your zones ({zones.length})</h3>
          <div className="maps-panel-search" style={{ width: 220 }}>
            <Search />
            <input
              type="text"
              placeholder="Filter zones..."
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
        </div>
        {filteredZones.length === 0 ? (
          <div className="empty-state">
            <MapPin size={28} />
            <h3>No zones yet</h3>
            <p>Click the map to add your first safe area</p>
          </div>
        ) : (
          <div className="grid-3">
            {filteredZones.map((z) => (
              <div className="card tight" key={z.id}>
                <div className="row between">
                  <div className="row">
                    <MapPin size={14} color="var(--color-accent-green)" />
                    <strong>{z.label}</strong>
                  </div>
                  <button className="btn-icon" onClick={() => deleteZone(z.id)} aria-label="Delete">
                    <Trash size={12} />
                  </button>
                </div>
                <div className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  {z.kind} · {z.radius_m}m
                </div>
                <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", marginTop: 4 }}>
                  {z.center.lat.toFixed(4)}, {z.center.lng.toFixed(4)}
                </div>
                {z.is_familiar_suggestion && (
                  <span className="risk-badge low" style={{ marginTop: 8 }}>from frequent visits</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
