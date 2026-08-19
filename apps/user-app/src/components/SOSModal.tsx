import { useState, useEffect } from "react";
import { X, Settings, AlertCircle, PhoneCall, CheckCircle, MapPin } from "lucide-react";
import { api } from "../lib/api";

const DISASTER_TYPES = [
  { id: "manual_sos", label: "SOS", icon: "��" },
  { id: "harassment", label: "Harassment", icon: "⚠️" },
  { id: "accident", label: "Accident", icon: "��" },
  { id: "poor_lighting", label: "Poor lighting", icon: "��" },
  { id: "suspicious_activity", label: "Suspicious", icon: "��️" },
  { id: "other", label: "Other", icon: "��" },
] as const;

export default function SOSModal({ isOpen, onClose, onNavigateToContacts }: { isOpen: boolean; onClose: () => void; onNavigateToContacts?: () => void }) {
  const [step, setStep] = useState<"select" | "sending" | "result">("select");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [result, setResult] = useState<{ summary: string; risk: any; message: string; contacts: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const p = JSON.parse(localStorage.getItem("safetynet:profile") || "null");
      const c = JSON.parse(localStorage.getItem("safetynet:contacts") || "[]");
      setProfile(p);
      setContacts(c);
    } catch {
      setProfile(null);
      setContacts([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !location && !detectingLocation) {
      detectLocation();
    }
  }, [isOpen]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      setLocation({ lat: 28.6139, lng: 77.2090 });
      return;
    }
    setDetectingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setDetectingLocation(false);
      },
      (err) => {
        setLocationError(`Location error: ${err.message}`);
        setDetectingLocation(false);
        setLocation({ lat: 28.6139, lng: 77.2090 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSelectDisaster = async (disasterType: string) => {
    if (!location) {
      setError("Still detecting location — please wait a moment.");
      return;
    }
    setSelectedType(disasterType);
    setStep("sending");
    setError(null);

    try {
      // 1. Trigger SOS so the backend dispatches the alert.
      const res = await api.sos("demo-user");
      const loc = location || { lat: 28.6139, lng: 77.2090 };
      setResult({
        summary: `Emergency dispatched. Guardians notified.`,
        risk: res?.risk,
        message: `EMERGENCY: ${profile?.display_name || "demo-user"} pressed SOS. Last known: ${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`,
        contacts: contacts,
      });
      setStep("result");
    } catch (err: any) {
      setError(err?.message || "Unable to dispatch SOS.");
      setStep("select");
    }
  };

  const handleClose = () => {
    setStep("select");
    setSelectedType(null);
    setResult(null);
    setError(null);
    setLocation(null);
    setLocationError(null);
    setDetectingLocation(false);
    onClose();
  };

  if (!isOpen) return null;

  const types = DISASTER_TYPES;

  return (
    <div className="sos-modal-overlay" onClick={handleClose}>
      <div className="sos-modal" onClick={(e) => e.stopPropagation()}>
        {/* Sending screen */}
        {step === "sending" && (
          <>
            <div className="sos-modal-header sos-header-emergency">
              <h2>
                <span className="sos-pulse-dot" />
                Sending SOS
              </h2>
              <button className="sos-modal-close" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>
            <div className="sos-modal-body">
              <div className="sos-sending">
                <div className="sos-radar">
                  <div className="sos-radar-ring ring-1" />
                  <div className="sos-radar-ring ring-2" />
                  <div className="sos-radar-ring ring-3" />
                  <div className="sos-radar-center">��</div>
                </div>
                <h3>Sending SOS Alert…</h3>
                <p>
                  Contacting your trusted contacts
                  {contacts.length > 0 ? ` (${contacts.length})` : ""}
                </p>
                <div className="sos-sending-type">
                  {types.find((t) => t.id === selectedType)?.icon}{" "}
                  {types.find((t) => t.id === selectedType)?.label}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Result screen */}
        {step === "result" && result && (
          <>
            <div className="sos-modal-header sos-header-success">
              <h2>
                <CheckCircle size={24} />
                SOS Sent
              </h2>
              <button className="sos-modal-close" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>
            <div className="sos-modal-body">
              <div className="sos-result">
                <p className="sos-result-summary">{result.summary}</p>
                <div className="sos-result-contacts">
                  {contacts.length === 0 ? (
                    <div className="sos-result-contact sent">
                      <span className="sos-result-status">✅</span>
                      <span className="sos-result-name">No contacts on file</span>
                      <span className="sos-result-phone">Add Trusted Contacts</span>
                    </div>
                  ) : (
                    contacts.map((c, i) => (
                      <div className="sos-result-contact sent" key={i}>
                        <span className="sos-result-status">✅</span>
                        <span className="sos-result-name">{c.name}</span>
                        <span className="sos-result-phone">{c.phone}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="sos-result-message-preview">
                  <h4>Message Sent</h4>
                  <pre>{result.message}</pre>
                </div>
                <button className="sos-submit-btn" onClick={handleClose}>
                  Close
                </button>
              </div>
            </div>
          </>
        )}

        {/* Setup prompt */}
        {step === "select" && !profile && (
          <>
            <div className="sos-modal-header sos-header-warning">
              <h2>
                <AlertCircle size={24} />
                Setup Recommended
              </h2>
              <button className="sos-modal-close" onClick={handleClose}>
                <X size={20} />
              </button>
            </div>
            <div className="sos-modal-body">
              <div className="sos-setup-prompt">
                <div className="sos-setup-icon">��</div>
                <h3>Add Your Profile + Trusted Contacts</h3>
                <p>
                  For best results, save your profile and at least one trusted contact.
                  SafetyNet can still send an SOS without them.
                </p>
                <div className="sos-setup-checklist">
                  <div className={`sos-check-item ${profile?.display_name ? "done" : ""}`}>
                    {profile?.display_name ? "✅" : "⬜"} Your name
                  </div>
                  <div className={`sos-check-item ${contacts.length > 0 ? "done" : ""}`}>
                    {contacts.length > 0 ? "✅" : "⬜"} At least one trusted contact
                  </div>
                </div>
                <button
                  className="sos-submit-btn"
                  onClick={() => {
                    handleClose();
                    if (onNavigateToContacts) onNavigateToContacts();
                  }}
                >
                  <PhoneCall size={18} />
                  Go to Trusted Contacts
                </button>
              </div>
            </div>
          </>
        )}

        {/* Main: disaster type selection */}
        {step === "select" && (
          <>
            <div className="sos-modal-header sos-header-emergency">
              <h2>
                <span className="sos-pulse-dot" />
                SOS Emergency
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="sos-modal-settings"
                  onClick={() => {
                    handleClose();
                    if (onNavigateToContacts) onNavigateToContacts();
                  }}
                  title="Trusted contacts"
                  aria-label="Trusted contacts"
                >
                  <Settings size={20} />
                </button>
                <button className="sos-modal-close" onClick={handleClose}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="sos-modal-body">
              {error && (
                <div className="sos-error-banner">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              <div className="sos-location-status">
                <MapPin size={14} />
                {detectingLocation && <span>Detecting location…</span>}
                {locationError && <span className="warn">{locationError}</span>}
                {location && !detectingLocation && (
                  <span className="ok">
                    �� {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </span>
                )}
              </div>

              <p className="sos-instruction">
                Select emergency type to alert your network
                {contacts.length > 0 ? `: ${contacts.length} contact${contacts.length > 1 ? "s" : ""}` : ""}:
              </p>

              <div className="sos-disaster-grid">
                {types.map((type) => (
                  <button
                    key={type.id}
                    className={`sos-disaster-btn type-${type.id}`}
                    onClick={() => handleSelectDisaster(type.id)}
                    disabled={detectingLocation}
                  >
                    <span className="sos-disaster-icon">{type.icon}</span>
                    <span className="sos-disaster-label">{type.label}</span>
                  </button>
                ))}
              </div>

              <div className="sos-modal-footer-info">
                <p>
                  Sending as <strong>{profile?.display_name || "demo-user"}</strong>
                  {profile?.phone ? ` (${profile.phone})` : ""}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
