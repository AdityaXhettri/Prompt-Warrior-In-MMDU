import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Flag, MapPin, Navigation, Plus, Siren, StopCircle } from "lucide-react";
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

  return (
    <>
      <div>
        <h1 className="page-title">Safe Journey</h1>
        <div className="page-subtitle">
          Tell SafetyNet where you're going. We'll watch the route, watch the clock, and only
          escalate when the signals warrant it.
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Plan a journey</h3>
          {active ? (
            <div>
              <div className="row" style={{ gap: 12 }}>
                <Flag size={18} />
                <strong>Active journey</strong>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                To <strong>{active.destination_label || "destination"}</strong> · ETA in{" "}
                <strong>{remaining}m</strong> · {active.familiarity}
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn ghost" onClick={() => checkIn(true)}>
                  <CheckCircle2 size={14} /> I'm OK
                </button>
                <button className="btn danger" onClick={endJourney}>
                  <StopCircle size={14} /> End journey
                </button>
                <button className="btn sos" onClick={handleSos}>
                  <Siren size={14} /> SOS
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="field">
                <label>Destination label</label>
                <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="field">
                <label>Expected arrival</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Trusted contact</label>
                <select
                  className="select"
                  value={contactId || ""}
                  onChange={(e) => setContactId(e.target.value || undefined)}
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn"
                onClick={() => setPicking((p) => !p)}
                style={{ background: picking ? "var(--bg-3)" : undefined }}
              >
                <MapPin size={14} /> {picking ? "Click map to pick destination" : "Pick on map"}
              </button>
              {dest && (
                <div className="muted">
                  Picked: {dest.lat.toFixed(4)}, {dest.lng.toFixed(4)}
                </div>
              )}
              <button className="btn primary" disabled={!dest} onClick={startJourney}>
                <Navigation size={14} /> Start journey
              </button>
            </div>
          )}
        </div>

        <div className="card">
          <h3>Map</h3>
          <MapView
            center={dest || { lat: 28.6139, lng: 77.2090 }}
            position={actual[actual.length - 1] || null}
            destination={dest}
            expectedRoute={route}
            actualRoute={actual}
            onMapClick={(latlng) => picking && setDest(latlng)}
            showZones={false}
          />
        </div>
      </div>
    </>
  );
}
