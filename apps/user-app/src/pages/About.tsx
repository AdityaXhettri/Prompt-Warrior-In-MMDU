import { BrainCircuit, Route, Siren, Users, Wifi, MapPin } from "lucide-react";

const principles = [
  {
    icon: Siren,
    title: "Graduated escalation",
    body: "Moving from normal to check-in to guardian alert to emergency is deliberate. SafetyNet asks first, alerts second, and only escalates when the evidence warrants it.",
  },
  {
    icon: BrainCircuit,
    title: "Deterministic + AI",
    body: "Hard rules produce named signals. The AI engine combines those signals into a single risk score, confidence, explanation, and recommended action.",
  },
  {
    icon: Route,
    title: "Safer routes, not shortest",
    body: "Community hotspot reports are aggregated and used as routing context — never as proof of danger. SafetyNet can recommend a slightly longer but safer route.",
  },
  {
    icon: Users,
    title: "Community + courtyard",
    body: "Anonymous reports of unsafe conditions combine with the familiar-route intelligence to build a safety net that grows with the people around you.",
  },
  {
    icon: Wifi,
    title: "Offline-safe",
    body: "When the network is down, the deterministic rules keep running locally and sync when the connection returns. A brief loss of signal is not a loss of safety.",
  },
  {
    icon: MapPin,
    title: "Map-first",
    body: "The map is the primary surface. Risk, alerts, and explanations sit alongside the geography they refer to.",
  },
];

const techStack = [
  "React", "TypeScript", "Vite", "Tailwind", "Leaflet",
  "FastAPI", "Python", "Pydantic", "Supabase", "PostgreSQL",
  "Google Maps", "Twilio", "OpenAI",
];

export default function About() {
  return (
    <div className="content-layout">
      <div className="page-header">
        <h1>About SafetyNet</h1>
        <p>
          SafetyNet is a hackathon-scale personal + community safety platform
          built on the principle that <strong>watching, checking, understanding
          context</strong> matters more than reflexive escalation.
        </p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: "var(--space-xl)" }}>
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: "1rem", textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)" }}>
            What is SafetyNet?
          </h3>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.6, fontSize: "0.95rem" }}>
            SafetyNet watches over you when you travel. It is a persistent safety
            net that knows your familiar places, watches your journey, and only
            asks for help when it should — never on a single anomaly.
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: "1rem", textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)" }}>
            Three connected interfaces
          </h3>
          <ul style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, paddingLeft: 18, fontSize: "0.95rem" }}>
            <li><strong>User App</strong> — Safety Zones, Safe Journeys, SOS</li>
            <li><strong>Guardian Dashboard</strong> — live map, AI reasoning, alerts</li>
            <li><strong>CLI + Simulator</strong> — scripted demos, virtual users</li>
          </ul>
        </div>
      </div>

      <div className="page-header">
        <h2 style={{ fontSize: "1.25rem" }}>Design principles</h2>
      </div>

      <div className="about-grid">
        {principles.map(({ icon: Icon, title, body }) => (
          <div className="card" key={title}>
            <div className="row" style={{ alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--color-accent-green-glow)",
                  color: "var(--color-accent-green)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Icon size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: "0.95rem", textTransform: "none", letterSpacing: 0, color: "var(--color-text-primary)" }}>
                {title}
              </h3>
            </div>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
              {body}
            </p>
          </div>
        ))}
      </div>

      <div className="page-header" style={{ marginTop: "var(--space-2xl)" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Tech stack</h2>
        <p>The same frontend, backend, and shared types power every interface.</p>
      </div>
      <div className="card">
        {techStack.map((t) => (
          <span className="tech-tag" key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}
