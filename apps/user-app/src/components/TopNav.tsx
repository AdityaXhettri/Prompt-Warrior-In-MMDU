import { ShieldCheck, AlertTriangle } from "lucide-react";
import type { SafetyState } from "@safetynet/shared-types";

interface Props {
  state: SafetyState | null;
  connected: boolean;
}

export default function TopNav({ state, connected }: Props) {
  const level = state?.safety_level || "normal";
  return (
    <header className="topnav">
      <div className="brand">
        <div className="brand-mark">
          <ShieldCheck size={18} />
        </div>
        <div>
          <div>SafetyNet</div>
          <div className="muted" style={{ fontSize: 11, fontWeight: 400 }}>
            Watches over you when you travel
          </div>
        </div>
      </div>
      <div className="spacer" />
      <span className={`connection-pill${connected ? "" : " disconnected"}`}>
        <span className="dot" />
        {connected ? "live" : "offline"}
      </span>
      <span className="pill">
        {level === "emergency" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
        <span className={`badge ${level}`}>{level.replace("_", " ")}</span>
      </span>
    </header>
  );
}
