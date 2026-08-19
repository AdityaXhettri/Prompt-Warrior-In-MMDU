import { useEffect, useState } from "react";
import { Shield, Map, MapPin, ListChecks, Activity, Radio, AlertOctagon, Settings } from "lucide-react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import Dashboard from "./pages/Dashboard";
import Zones from "./pages/Zones";
import JourneyPage from "./pages/Journey";
import Simulator from "./pages/Simulator";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import type { SafetyState } from "@safetynet/shared-types";
import { api, subscribeStream } from "./lib/api";

export type Page = "dashboard" | "zones" | "journey" | "simulator" | "reports" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [userId] = useState("demo-user");
  const [state, setState] = useState<SafetyState | null>(null);
  const [connected, setConnected] = useState(false);
  const [_lastEvent, setLastEvent] = useState<unknown>(null);

  useEffect(() => {
    api.state(userId).then(setState).catch(() => setState(null));
  }, [userId]);

  useEffect(() => {
    const unsub = subscribeStream(userId, (msg) => {
      setConnected(true);
      if (msg && typeof msg === "object") {
        if ("safety_level" in msg) {
          setState(msg as SafetyState);
        }
        setLastEvent(msg);
      }
    });
    // SSE failures set disconnected via error event below
    return () => {
      unsub();
    };
  }, [userId]);

  return (
    <div className="app">
      <TopNav state={state} connected={connected} />
      <Sidebar page={page} onChange={setPage} />
      <main className="main">
        {page === "dashboard" && <Dashboard userId={userId} state={state} onNav={setPage} />}
        {page === "zones" && <Zones userId={userId} />}
        {page === "journey" && <JourneyPage userId={userId} state={state} />}
        {page === "simulator" && <Simulator userId={userId} />}
        {page === "reports" && <Reports userId={userId} />}
        {page === "settings" && <SettingsPage userId={userId} />}
      </main>
    </div>
  );
}
