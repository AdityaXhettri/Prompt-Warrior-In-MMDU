import { useEffect, useState } from "react";
import { Phone, Save, User, Bell, Wifi, Hand, Trash, ShieldCheck } from "lucide-react";
import type { TrustedContact, UserProfile } from "@safetynet/shared-types";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

const TOGGLES = [
  { id: "handsfree", label: "Hands-free SOS", desc: "Shake or long-press to alert guardians", icon: Hand, default: true },
  { id: "offline", label: "Offline-safe fallback", desc: "Keep safety rules running locally when disconnected", icon: Wifi, default: true },
  { id: "ai", label: "AI risk reasoning", desc: "Use the AI engine for contextual risk assessment", icon: ShieldCheck, default: true },
  { id: "checkin", label: "Auto check-in prompts", desc: "Ask me to confirm if an anomaly is detected", icon: Bell, default: true },
];

export default function SettingsPage({ userId }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [contacts, setContacts] = useState<TrustedContact[]>([]);

  useEffect(() => {
    api.getUser(userId).then((u) => {
      setUser(u);
      setName(u.display_name);
      setPhone(u.phone);
      setEmail(u.email || "");
    }).catch(() => {});
    api.listContacts(userId).then(setContacts).catch(() => {});

    // Load saved toggles from localStorage
    const saved = localStorage.getItem("safetynet:toggles");
    const initial: Record<string, boolean> = {};
    TOGGLES.forEach((t) => {
      initial[t.id] = saved ? JSON.parse(saved)[t.id] ?? t.default : t.default;
    });
    setToggles(initial);
  }, [userId]);

  function save() {
    localStorage.setItem("safetynet:profile", JSON.stringify({ display_name: name, phone, email }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(id: string) {
    const next = { ...toggles, [id]: !toggles[id] };
    setToggles(next);
    localStorage.setItem("safetynet:toggles", JSON.stringify(next));
  }

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Your profile, safety preferences, and feature toggles.</p>
      </div>

      <div className="grid-sidebar">
        <div className="card" style={{ alignSelf: "start" }}>
          <h3
            style={{
              marginBottom: "var(--space-lg)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}
          >
            <User size={18} color="var(--color-accent-green)" />
            Profile
          </h3>
          <div className="form-group">
            <label>Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
          </div>
          <div className="form-group">
            <label>Email (optional)</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={save}>
            <Save size={14} />
            {saved ? "Saved" : "Save profile"}
          </button>
        </div>

        <div>
          <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
            <h3
              style={{
                marginBottom: "var(--space-lg)",
                fontSize: "0.85rem",
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              Safety features
            </h3>
            {TOGGLES.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.id}
                  className="row between"
                  style={{
                    padding: "12px 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div className="row" style={{ gap: 12, flex: 1 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: "var(--color-accent-green-glow)",
                        color: "var(--color-accent-green)",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t.label}</div>
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {t.desc}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(t.id)}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 999,
                      background: toggles[t.id] ? "var(--color-accent-green)" : "var(--color-bg-secondary)",
                      border: "1px solid var(--color-border)",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 200ms ease",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: toggles[t.id] ? 20 : 2,
                        width: 16,
                        height: 16,
                        background: "#04111c",
                        borderRadius: "50%",
                        transition: "left 200ms ease",
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card">
            <h3
              style={{
                marginBottom: "var(--space-lg)",
                fontSize: "0.85rem",
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            >
              Trusted contacts (read-only)
            </h3>
            {contacts.length === 0 ? (
              <div className="empty-state">
                <Phone size={32} />
                <h3>No contacts</h3>
                <p>Add some from the Trusted Contacts page</p>
              </div>
            ) : (
              <div className="grid grid-2">
                {contacts.map((c) => (
                  <div className="card tight" key={c.id}>
                    <div className="row">
                      <Phone size={14} />
                      <strong>{c.name}</strong>
                    </div>
                    <div className="muted" style={{ fontSize: "0.75rem", marginTop: 4 }}>
                      {c.phone}
                    </div>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {c.relation}
                      {c.is_primary && " · primary"}
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
