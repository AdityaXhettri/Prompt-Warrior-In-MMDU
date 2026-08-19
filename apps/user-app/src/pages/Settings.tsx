import { useEffect, useState } from "react";
import { Phone, UserPlus } from "lucide-react";
import type { TrustedContact, UserProfile } from "@safetynet/shared-types";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

export default function SettingsPage({ userId }: Props) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("Friend");

  const reload = () => {
    api.getUser(userId).then(setUser).catch(() => {});
    api.listContacts(userId).then(setContacts).catch(() => {});
  };
  useEffect(reload, [userId]);

  async function addContact() {
    if (!name || !phone) return;
    await fetch(`${(import.meta.env.VITE_API_URL as string) || "http://localhost:8000"}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "",
        user_id: userId,
        name,
        phone,
        relation,
        is_primary: contacts.length === 0,
      }),
    });
    setName("");
    setPhone("");
    reload();
  }

  return (
    <>
      <div>
        <h1 className="page-title">Settings</h1>
        <div className="page-subtitle">Your profile, trusted contacts, and escalation rules.</div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Profile</h3>
          {user ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="row">
                <strong>{user.display_name}</strong>
              </div>
              <div className="muted">{user.phone}</div>
              <div className="muted">{user.email}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                ID: <span className="mono">{user.id}</span>
              </div>
            </div>
          ) : (
            <div className="empty">Loading…</div>
          )}
        </div>

        <div className="card">
          <h3>Add trusted contact</h3>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone (with country code)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>Relation</label>
            <input
              className="input"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            />
          </div>
          <button className="btn primary" onClick={addContact}>
            <UserPlus size={14} /> Add contact
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Your trusted contacts</h3>
        {contacts.length === 0 ? (
          <div className="empty">No contacts yet.</div>
        ) : (
          <div className="grid grid-3">
            {contacts.map((c) => (
              <div className="card tight" key={c.id}>
                <div className="row">
                  <Phone size={14} />
                  <strong>{c.name}</strong>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {c.phone}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {c.relation} {c.is_primary && "· primary"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
