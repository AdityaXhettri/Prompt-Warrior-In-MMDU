import {
  LayoutDashboard,
  MapPin,
  Compass,
  Radio,
  AlertOctagon,
  UserPlus,
  Info,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  BrainCircuit,
  Route,
  PhoneCall,
  Siren,
} from "lucide-react";

import type { Page } from "../App";

const navItems: { id: Page; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "zones", label: "Safety Zones", icon: MapPin },
  { id: "journey", label: "Safe Journey", icon: Compass },
  { id: "predict", label: "Risk Analysis", icon: BrainCircuit },
  { id: "evacuate", label: "Routes", icon: Route },
  { id: "simulator", label: "Simulator", icon: Radio },
  { id: "reports", label: "Community Reports", icon: AlertOctagon },
  { id: "contacts", label: "Trusted Contacts", icon: UserPlus },
  { id: "about", label: "About", icon: Info },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onSOSClick,
}: {
  currentPage: string;
  onNavigate: (p: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSOSClick: () => void;
}) {
  return (
    <nav
      className={`sidebar${collapsed ? " collapsed" : ""}`}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="sidebar-header">
        <div
          className="sidebar-brand"
          onClick={() => onNavigate("dashboard")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onNavigate("dashboard")}
        >
          <div className="sidebar-brand-icon">
            <ShieldAlert />
          </div>
          <span className="sidebar-brand-text">
            Safety<span className="accent">Net</span>
          </span>
        </div>
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <div className="sidebar-content">
        <div className="sidebar-group">
          <div className="sidebar-group-label">Navigation</div>
          <ul className="sidebar-nav">
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  className={`sidebar-nav-item${currentPage === item.id ? " active" : ""}`}
                  onClick={() => onNavigate(item.id)}
                  aria-current={currentPage === item.id ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={16} />
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* SOS Emergency Button */}
        <div className="sidebar-group">
          <button
            className={`sidebar-sos-button${collapsed ? " collapsed" : ""}`}
            onClick={onSOSClick}
            title={collapsed ? "Send SOS Alert" : undefined}
          >
            <Siren size={18} />
            {!collapsed && <span className="sidebar-sos-label">SOS Emergency</span>}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-content">
          <h4>SafetyNet</h4>
          <p>Your personal + community safety net. Watches over you when you travel.</p>
        </div>
      </div>
    </nav>
  );
}
