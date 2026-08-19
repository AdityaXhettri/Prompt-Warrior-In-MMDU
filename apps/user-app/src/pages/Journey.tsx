import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Compass,
  Flag,
  MapPin,
  Navigation,
  Search,
  Siren,
  StopCircle,
  X,
} from "lucide-react";
import type { LatLng, SafetyState, TrustedContact } from "@safetynet/shared-types";
import MapView from "../components/MapView";
import { api } from "../lib/api";

interface Props {
  userId: string;
  state: SafetyState | null;
}

export default function JourneyPage({ userId, state }: Props) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [dest, setDest] = useState<LatLng | null>(null);
  const [label, setLabel] = useState("College");
  const [eta, setEta] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 25);
    return now.toISOString().slice(0, 16);
  });
  const [contactId, setContactId] = useState<string | undefined>(undefined);
  const [active, setActive] = useState<any>(null);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [actual, setActual] = useState<LatLng[]>([]);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listContacts(userId).then((r) => {
      setContacts(r);
      if (r[0]) setContactId(r[0].id);
    });
    api.activeJourney(userId).then(setActive).catch(() => {});
  }, [userId, state?.active_journey_id]);

  useEffect(() => {
    if (!active) {
      setRoute([]);
      setActual([]);
      return;
    }
    setRoute(active.expected_route || []);
    api.events(userId, 200).then((evs) => {
      const pts = evs
        .filter((e) => e.journey_id === active.id && e.location)
        .map((e) => e.location as LatLng)
        .reverse();
      setActual(pts);
    });
  }, [active, userId]);

  async function startJourney() {
    if (!dest) return;
    const j = await api.startJourney({
      user_id: userId,
      destination: { ...dest, label },
      expected_arrival_at: new Date(eta).toISOString(),
      trusted_contact_id: contactId,
    });
    setActive(j);
    setRoute(j.expected_route || []);
  }

  async function endJourney() {
    await api.endJourney(userId);
    setActive(null);
  }

  async function checkIn(ok: boolean) {
    await api.checkIn(userId, ok);
  }

  async function handleSos() {
    if (!confirm("Trigger emergency SOS? Guardian will be notified.")) return;
    await api.sos(userId);
  }

  const remaining = useMemo(() => {
    if (!active) return null;
    const ms = new Date(active.expected_arrival_at).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 60000));
  }, [active]);

  const center = dest || (actual[actual.length - 1] as LatLng) || { lat: 28.6139, lng: 77.2090 };

  const filteredContacts = contacts.filter((c) =>
    (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Safe Journey</h1>
        <p>Tell SafetyNet where you're going. We'll watch the route, the clock, and only escalate when the signals warrant it.</p>
      </div>

      {/* KPIs */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Status</span>
          <span className={`badge ${active ? "normal" : "check_in"}`}>
            {active ? "Active" : "Idle"}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">ETA in</span>
          <span className="stat-value">{active ? `${remaining}m` : "—"}</span>
          <span className="stat-sub">{active ? active.destination_label || "destination" : "no journey yet"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Trusted contact</span>
          <span className="stat-value" style={{ fontSize: "1.25rem" }}>
            {contacts[0]?.name || "—"}
          </span>
          <span className="stat-sub">{contacts[0]?.phone || "add a contact first"}</span>
        </div>
      </div>

      {/* Map + side */}
      <div className="grid-sidebar">
        <div>
          <div className="section-map">
            <MapView
              center={center}
              position={actual[actual.length - 1] || null}
              destination={dest}
              expectedRoute={route}
              actualRoute={actual}
              onMapClick={(latlng) => picking && setDest(latlng)}
              showZones={false}
            />
          </div>
          <div className="map-legend" style={{ position: "relative", marginTop: 8, transform: "none", left: "auto", bottom: "auto" }}>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#0ea5e9" }} /> Expected route</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#22C55E" }} /> Actual path</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: "#f97316" }} /> Destination</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {active ? (
            <div className="card">
              <h3 className="section-title"><Flag size={16} color="var(--color-accent-green)" /> Active journey</h3>
              <div className="muted" style={{ fontSize: "0.85rem", marginBottom: 10 }}>
                To <strong>{active.destination_label || "destination"}</strong> · familiar: {active.familiarity}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => checkIn(true)}>
                  <CheckCircle2 size={14} /> I'm OK
                </button>
                <button className="btn btn-danger" onClick={endJourney}>
                  <StopCircle size={14} /> End journey
                </button>
                <button className="btn btn-sos" onClick={handleSos}>
                  <Siren size={14} /> SOS
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h3 className="section-title"><Compass size={16} color="var(--color-accent-green)" /> Plan a journey</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Destination</label>
                  <input
                    className="input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="College"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Expected arrival</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={eta}
                    onChange={(e) => setEta(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.7rem" }}>Trusted contact</label>
                  <select
                    className="select"
                    value={contactId || ""}
                    onChange={(e) => setContactId(e.target.value || undefined)}
                  >
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
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
                {dest && (
                  <div className="muted" style={{ fontSize: "0.7rem", padding: 8, background: "rgba(0,0,0,0.3)", borderRadius: 8, fontFamily: "var(--font-mono)" }}>
                    {dest.lat.toFixed(4)}, {dest.lng.toFixed(4)}
                  </div>
                )}
                <button className="btn btn-primary" disabled={!dest} onClick={startJourney}>
                  <Navigation size={14} /> Start journey
                </button>
              </div>
            </div>
          )}

          {/* Contacts */}
          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <h3 className="section-title" style={{ marginBottom: 0 }}>Trusted contacts</h3>
              <span className="muted" style={{ fontSize: "0.7rem" }}>{contacts.length}</span>
            </div>
            <div className="maps-panel-search" style={{ marginBottom: 8 }}>
              <Search />
              <input
                type="text"
                placeholder="Search…"
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
            {filteredContacts.length === 0 ? (
              <div className="empty-state">
                <p>No contacts · add some from the Contacts page</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {filteredContacts.map((c) => (
                  <div className="district-card" key={c.id}>
                    <div className="district-card-header">
                      <div>
                        <div className="district-card-name">{c.name}</div>
                        <div className="district-card-state">{c.phone}</div>
                      </div>
                      {c.is_primary && <span className="risk-badge low">primary</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
