import { useEffect, useState } from "react";
import { BrainCircuit, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import type { RiskAssessment } from "@safetynet/shared-types";
import { api } from "../lib/api";

const RISK_COLORS = {
  critical: "#EF4444",
  high: "#F59E0B",
  elevated: "#F59E0B",
  moderate: "#3B82F6",
  low: "#22C55E",
};

function RiskGauge({ score, level }: { score: number; level: string }) {
  const circumference = 2 * Math.PI * 70;
  const offset = circumference - (score / 100) * circumference;
  const color = (RISK_COLORS as Record<string, string>)[level] || "#22C55E";
  return (
    <div className="risk-gauge">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle className="gauge-bg" cx="90" cy="90" r="70" />
        <circle
          className="gauge-fill"
          cx="90"
          cy="90"
          r="70"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="gauge-text">
        <div className="gauge-percentage" style={{ color }}>
          {score}
        </div>
        <div className="gauge-label">Risk score</div>
      </div>
    </div>
  );
}

export default function Predict() {
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const r = await api.analyze("demo-user");
      setRisk(r);
    } catch (err: any) {
      setError(err?.message || "Failed to analyze");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    analyze();
  }, []);

  const factors = (risk?.contributing_factors || []).map((name) => ({
    name,
    importance:
      name === "manual_sos"
        ? 1.0
        : name === "route_deviation"
        ? 0.55
        : name === "missed_check_in"
        ? 0.6
        : name === "eta_delay"
        ? 0.35
        : name === "inactivity"
        ? 0.25
        : name === "zone_exit_after_start"
        ? 0.15
        : name === "unfamiliar_destination"
        ? 0.1
        : 0.1,
  }));

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>Risk Analysis</h1>
        <p>
          Run SafetyNet's deterministic + AI engine on the current event log. The
          engine combines route deviation, ETA, inactivity, zone transitions, and
          check-in signals into a single explainable risk score.
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
            <BrainCircuit size={18} color="var(--color-accent-green)" />
            Analysis controls
          </h3>
          <div className="form-group">
            <label>Engine</label>
            <select defaultValue="hybrid">
              <option value="hybrid">Deterministic + AI</option>
              <option value="deterministic">Deterministic only</option>
              <option value="ai">AI only</option>
            </select>
          </div>
          <div className="form-group">
            <label>Lookback window</label>
            <select defaultValue="20">
              <option value="10">Last 10 events</option>
              <option value="20">Last 20 events</option>
              <option value="50">Last 50 events</option>
            </select>
          </div>
          <div className="form-group">
            <label>Confidence threshold</label>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="60"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={analyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <div className="spinner-sm" />
                Analyzing…
              </>
            ) : (
              <>
                <BrainCircuit size={16} /> Re-run analysis
              </>
            )}
          </button>
        </div>

        <div>
          {error && (
            <div className="card" style={{ borderColor: "rgba(239,68,68,0.3)", marginBottom: "var(--space-lg)" }}>
              <p style={{ color: "var(--color-accent-red)", display: "flex", gap: 6, alignItems: "center" }}>
                <AlertTriangle size={16} /> {error}
              </p>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginTop: 4 }}>
                Make sure the backend server is running on port 8000.
              </p>
            </div>
          )}

          {risk && (
            <div className={`result-card ${risk.risk_level}`}>
              <div style={{ textAlign: "center", marginBottom: "var(--space-lg)" }}>
                <p
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "0.85rem",
                    marginBottom: 4,
                  }}
                >
                  SafetyNet analysis
                </p>
                <span className={`risk-badge ${risk.risk_level}`}>
                  {risk.risk_level} risk
                </span>
              </div>

              <RiskGauge score={risk.risk_score} level={risk.risk_level} />

              <h3 style={{ fontSize: "0.95rem", marginBottom: "var(--space-md)" }}>
                Contributing factors
              </h3>
              <div className="factor-list">
                {factors.length === 0 ? (
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    No signals above threshold. System is nominal.
                  </div>
                ) : (
                  factors.map((f) => (
                    <div className="factor-item" key={f.name}>
                      <span className="factor-name">{f.name.replace(/_/g, " ")}</span>
                      <div className="factor-bar-bg">
                        <div
                          className="factor-bar-fill"
                          style={{
                            width: `${f.importance * 100}%`,
                            background:
                              (RISK_COLORS as Record<string, string>)[
                                f.importance > 0.6 ? "critical" : f.importance > 0.3 ? "high" : "low"
                              ] || "#22C55E",
                          }}
                        />
                      </div>
                      <span className="factor-value">{(f.importance * 100).toFixed(1)}%</span>
                    </div>
                  ))
                )}
              </div>

              <div
                style={{
                  marginTop: "var(--space-lg)",
                  padding: "var(--space-md)",
                  background: "var(--color-bg-secondary)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <h4
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-muted)",
                    marginBottom: "var(--space-sm)",
                  }}
                >
                  Reasoning
                </h4>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{risk.explanation}</p>
                <p
                  style={{
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    marginTop: "var(--space-sm)",
                    color: "var(--color-accent-green)",
                  }}
                >
                  <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {risk.recommended_action}
                </p>
              </div>

              <div
                style={{
                  marginTop: "var(--space-md)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-sm)",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--color-text-muted)" }}>Confidence</span>
                <span style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                  {Math.round(risk.confidence * 100)}%
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>Safety level</span>
                <span style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                  {risk.safety_level}
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>Score</span>
                <span style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                  {risk.risk_score}/100
                </span>
              </div>
            </div>
          )}

          {!risk && !error && (
            <div className="card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
              <BrainCircuit size={48} color="var(--color-text-muted)" style={{ marginBottom: "var(--space-md)" }} />
              <h3 style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-sm)" }}>
                Ready to analyze
              </h3>
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                Click analyze to evaluate the current event log.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
