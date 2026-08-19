import { Compass, MapPin, Map, ListChecks, Radio, Users, Settings } from "lucide-react";
import type { Page } from "../App";

interface Props {
  page: Page;
  onChange: (p: Page) => void;
}

const items: { id: Page; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: Compass },
  { id: "zones", label: "Safety Zones", icon: MapPin },
  { id: "journey", label: "Safe Journey", icon: Map },
  { id: "simulator", label: "Simulator", icon: Radio },
  { id: "reports", label: "Community Reports", icon: ListChecks },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ page, onChange }: Props) {
  return (
    <aside className="sidenav">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.id}
            className={`nav-item ${page === it.id ? "active" : ""}`}
            onClick={() => onChange(it.id)}
          >
            <Icon size={16} />
            <span>{it.label}</span>
          </div>
        );
      })}
      <div style={{ marginTop: "auto", padding: 12, fontSize: 12, color: "var(--fg-3)" }}>
        SafetyNet v0.1.0<br />
        PromptWars × GDGoC MM(DU)
      </div>
    </aside>
  );
}
