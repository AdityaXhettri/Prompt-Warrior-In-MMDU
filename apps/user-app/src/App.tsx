import { useEffect, useState } from "react";
import type { SafetyState } from "@safetynet/shared-types";
import Sidebar from "./components/Sidebar";
import SOSModal from "./components/SOSModal";
import Dashboard from "./pages/Dashboard";
import Zones from "./pages/Zones";
import JourneyPage from "./pages/Journey";
import Simulator from "./pages/Simulator";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Predict from "./pages/Predict";
import Evacuate from "./pages/Evacuate";
import Contacts from "./pages/Contacts";
import About from "./pages/About";
import { api, subscribeStream } from "./lib/api";

export type Page =
  | "dashboard"
  | "zones"
  | "journey"
  | "predict"
  | "evacuate"
  | "simulator"
  | "reports"
  | "contacts"
  | "about"
  | "settings";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sosModalOpen, setSOSModalOpen] = useState(false);
  const [state, setState] = useState<SafetyState | null>(null);
  const [userId] = useState("demo-user");

  useEffect(() => {
    api.state(userId).then(setState).catch(() => {});
    const unsub = subscribeStream(userId, (msg) => {
      if (msg && typeof msg === "object" && "safety_level" in msg) {
        setState(msg as SafetyState);
      }
    });
    return () => unsub();
  }, [userId]);

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard userId={userId} state={state} />;
      case "zones":
        return (
          <div className="content-layout">
            <Zones userId={userId} />
          </div>
        );
      case "journey":
        return (
          <div className="content-layout">
            <JourneyPage userId={userId} state={state} />
          </div>
        );
      case "predict":
        return <Predict />;
      case "evacuate":
        return <Evacuate />;
      case "simulator":
        return (
          <div className="content-layout">
            <Simulator userId={userId} />
          </div>
        );
      case "reports":
        return (
          <div className="content-layout">
            <Reports userId={userId} />
          </div>
        );
      case "contacts":
        return <Contacts userId={userId} />;
      case "about":
        return <About />;
      case "settings":
        return (
          <div className="content-layout">
            <SettingsPage userId={userId} />
          </div>
        );
      default:
        return <Dashboard userId={userId} state={state} />;
    }
  };

  return (
    <>
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p: string) => setCurrentPage(p as Page)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onSOSClick={() => setSOSModalOpen(true)}
      />
      <main className="app-main">{renderPage()}</main>
      <SOSModal
        isOpen={sosModalOpen}
        onClose={() => setSOSModalOpen(false)}
        onNavigateToContacts={() => setCurrentPage("contacts")}
      />
    </>
  );
}
