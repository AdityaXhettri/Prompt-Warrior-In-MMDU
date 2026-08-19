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
import { useHandsFreeSOS } from "./lib/handsFreeSOS";

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

const DEMO_USER_ID = "demo-user";

export default function App() {
  const [currentPage, setCurrentPage] =
    useState<Page>("dashboard");

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [sosModalOpen, setSOSModalOpen] =
    useState(false);

  const [state, setState] =
    useState<SafetyState | null>(null);

  const userId = DEMO_USER_ID;

  // Read handsfree toggle from localStorage (default: true)
  const [handsfreeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("safetynet:toggles");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.handsfree ?? true;
      }
    } catch {
      // fallback
    }
    return true;
  });

  useHandsFreeSOS(userId, handsfreeEnabled, (method) => {
    console.info(`[Hands-free SOS] Triggered via ${method}`);
    setSOSModalOpen(true);
  });

  useEffect(() => {
    let mounted = true;

    // Load initial safety state
    const loadSafetyState = async () => {
      try {
        const initialState = await api.state(userId);

        if (mounted) {
          setState(initialState);
        }
      } catch (error) {
        console.error("Failed to load safety state:", error);
      }
    };

    loadSafetyState();

    // Subscribe to real-time safety updates
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeStream(userId, (msg) => {
        if (
          mounted &&
          msg &&
          typeof msg === "object" &&
          "safety_level" in msg
        ) {
          setState(msg as SafetyState);
        }
      });
    } catch (error) {
      console.error("Failed to subscribe to safety stream:", error);
    }

    // Cleanup
    return () => {
      mounted = false;

      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId]);

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <Dashboard
            userId={userId}
            state={state}
          />
        );

      case "zones":
        return (
          <Zones
            userId={userId}
          />
        );

      case "journey":
        return (
          <JourneyPage
            userId={userId}
            state={state}
          />
        );

      case "predict":
        return <Predict />;

      case "evacuate":
        return <Evacuate />;

      case "simulator":
        return (
          <Simulator
            userId={userId}
          />
        );

      case "reports":
        return (
          <Reports
            userId={userId}
          />
        );

      case "contacts":
        return (
          <Contacts
            userId={userId}
          />
        );

      case "about":
        return <About />;

      case "settings":
        return (
          <div className="content-layout">
            <SettingsPage
              userId={userId}
            />
          </div>
        );

      default:
        return (
          <Dashboard
            userId={userId}
            state={state}
          />
        );
    }
  };

  return (
    <>
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() =>
          setSidebarCollapsed((collapsed) => !collapsed)
        }
        onSOSClick={() =>
          setSOSModalOpen(true)
        }
      />

      <main className="app-main">
        {renderPage()}
      </main>

      <SOSModal
        isOpen={sosModalOpen}
        userId={userId}
        onClose={() =>
          setSOSModalOpen(false)
        }
        onNavigateToContacts={() => {
          setSOSModalOpen(false);
          setCurrentPage("contacts");
        }}
      />
    </>
  );
}
