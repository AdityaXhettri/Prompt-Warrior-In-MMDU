import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Activity,
  ArrowRight,
} from "lucide-react";
import type { RiskAssessment } from "@safetynet/shared-types";
import { api } from "../lib/api";

const DEMO_USER_ID = "demo-user";

const LEVEL_COLORS: Record<string, string> = {
  low: "var(--color-accent-green)",
  moderate: "#f59e0b",
  elevated: "#f97316",
  high: "#ef4444",
  critical: "#dc2626",
};

const SAFETY_LABELS: Record<string, string> = {
  normal: "Normal",
  check_in: "Check-in needed",
  guardian_alert: "Guardian alert",
  emergency: "Emergency",
};

export default function Predict() {
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.analyze(DEMO_USER_ID);
      setRisk(r);
    } catch (err: any) {
      setError(err?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyze();
  }, []);

  const score = risk?.risk_score ?? 0;
  const confidence = risk?.confidence ?? 0;
  const level = risk?.risk_level ?? "low";
  const safetyLevel = risk?.safety_level ?? "normal";
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.low;

  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>AI Risk Analysis</h1>
        <p>
          Live assessment from the SafetyNet AI engine. Combines multiple signals
          — never treats a single event as an emergency.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={analyze} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          {loading ? "Analyzing…" : "Run analysis"}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "rgba(239,68,68,0.3)", marginBottom: 16 }}>
          <p style={{ color: "var(--color-accent-red)" }}>{error}</p>
        </div>
      )}

      {risk && (
        <>
          {/* Main assessment */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="card"
            style={{ marginBottom: 16 }}
          >
            <div className="grid-sidebar" style={{ gap: 24 }}>
              {/* Score ring */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 16 }}>
                <div style={{
                  width: 140, height: 140, borderRadius: "50%",
                  border: `6px solid ${color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexDirection: "column",
                }}>
                  <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}>
                    {score}
                  </div>
                  <div className="muted" style={{ fontSize: "0.7rem" }}>risk score</div>
                </div>
                <span className={`badge ${safetyLevel}`}>
                  {SAFETY_LABELS[safetyLevel] || safetyLevel}
                </span>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    <Brain size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                    AI Assessment
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 600, color, textTransform: "uppercase" }}>
                    {level} risk
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    Confidence
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "1.1rem" }}>
                    {Math.round(confidence * 100)}%
                  </div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    Explanation
                  </div>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--color-text-primary)" }}>
                    {risk.explanation}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contributing factors + recommendation */}
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            {risk.contributing_factors.map((f, i) => (
              <motion.div
                key={f}
                className="stat-card"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <span className="stat-label">
                  <Activity size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                  Signal #{i + 1}
                </span>
                <span className="stat-value" style={{ fontSize: "0.85rem", textTransform: "capitalize" }}>
                  {f.replace(/_/g, " ")}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Recommended action */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
            style={{ borderColor: `${color}30`, background: `${color}08` }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ padding: 10, borderRadius: 12, background: `${color}15`, flexShrink: 0 }}>
                <ShieldCheck size={20} color={color} />
              </div>
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 4, color: "var(--color-text-primary)" }}>
                  Recommended Action
                </h3>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
                  {risk.recommended_action}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {!risk && !loading && !error && (
        <div className="empty-state">
          <Brain size={32} />
          <h3>No analysis yet</h3>
          <p>Click "Run analysis" to assess the current safety state.</p>
        </div>
      )}
    </div>
  );
}