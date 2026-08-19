import { useEffect, useState } from "react";
import { Phone, UserPlus, Trash } from "lucide-react";
import type { TrustedContact } from "@safetynet/shared-types";
import { api } from "../lib/api";

interface Props {
  userId: string;
}

export default function Contacts({ userId }: Props) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("Friend");
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    api.listContacts(userId).then(setContacts).catch(() => setError("Cannot reach backend"));
  };

  useEffect(reload, [userId]);

  const addContact = async () => {
    if (!name || !phone) return;
    try {
      await api.addContact({
        user_id: userId,
        name,
        phone,
        relation,
        is_primary: contacts.length === 0,
      });
      setName("");
      setPhone("");
      reload();
    } catch (err: any) {
      setError(err?.message || "Failed to add contact");
    }
  };

  const removeContact = async (id: string) => {
    try {
      await api.deleteContact(id);
    } catch {
      // backend may not have it — still remove locally
    }
    const next = contacts.filter((c) => c.id !== id);
    setContacts(next);
    localStorage.setItem("safetynet:contacts", JSON.stringify(next));
  };

  // Sync localStorage with the backend list on mount.
  useEffect(() => {
    localStorage.setItem("safetynet:contacts", JSON.stringify(contacts));
  }, [contacts]);

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Trusted Contacts</h1>
        <p>
          People SafetyNet will reach out to when it detects a problem you
          can't respond to. The first contact you add is marked as primary.
        </p>
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
            <UserPlus size={18} color="var(--color-accent-green)" />
            Add a contact
          </h3>
          <div className="form-group">
            <label style={{ color: "var(--color-text-primary)" }}>Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aarav"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: "var(--color-text-primary)" }}>Phone (with country code)</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div className="form-group">
            <label style={{ color: "var(--color-text-primary)" }}>Relation</label>
            <input
              className="input"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="Friend"
              style={{ color: "var(--color-text-primary)" }}
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={addContact}>
            <UserPlus size={14} /> Add contact
          </button>
        </div>

        <div>
          {error && (
            <div className="card" style={{ borderColor: "rgba(239,68,68,0.3)", marginBottom: "var(--space-lg)" }}>
              <p style={{ color: "var(--color-accent-red)" }}>{error}</p>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: 16, fontSize: "0.95rem", textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)" }}>
              Your trusted contacts ({contacts.length})
            </h3>
            {contacts.length === 0 ? (
              <div className="empty-state">
                <UserPlus size={32} />
                <h3>No contacts yet</h3>
                <p>Add at least one to enable SOS escalation.</p>
              </div>
            ) : (
              <div className="grid grid-2">
                {contacts.map((c) => (
                  <div
                    className="card tight"
                    key={c.id}
                    style={{
                      background: c.is_primary ? "rgba(34, 197, 94, 0.1)" : "var(--color-bg-card)",
                      borderColor: c.is_primary ? "var(--color-accent-green)" : "var(--color-border)",
                    }}
                  >
                    <div className="row between">
                      <div className="row">
                        <Phone size={14} color="var(--color-accent-green)" />
                        <strong style={{ color: "var(--color-text-primary)" }}>{c.name}</strong>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {c.is_primary && (
                          <span className="risk-badge low">primary</span>
                        )}
                        <button className="btn-icon" onClick={() => removeContact(c.id)}>
                          <Trash size={12} />
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        marginTop: 6,
                        color: "var(--color-text-primary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {c.phone}
                    </div>
                    <div className="muted" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                      {c.relation}
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
