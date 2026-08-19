import { motion } from "framer-motion";
import {
  Brain,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  Users,
  Lightbulb,
  ArrowRight,
} from "lucide-react";

const factors = [
  {
    label: "Travel Time",
    value: "Late Night",
    score: 20,
    icon: Clock,
  },
  {
    label: "Lighting",
    value: "Limited",
    score: 25,
    icon: Lightbulb,
  },
  {
    label: "Crowd Density",
    value: "Low",
    score: 15,
    icon: Users,
  },
    {
    label: "Community Reports",
    value: "3 Reports",
    score: 25,
    icon: AlertTriangle,
  },
];

export default function Predict() {
  const totalScore = factors.reduce(
    (total, factor) => total + factor.score,
    0
  );

  const riskLevel =
    totalScore >= 70
      ? "HIGH CONCERN"
      : totalScore >= 40
        ? "MODERATE CONCERN"
        : "LOW CONCERN";

  return (
    <div className="content-layout min-h-screen">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-cyan-400">
              <Brain className="h-4 w-4" />
              AI SAFETY ENGINE
            </div>

            <h1 className="text-3xl font-bold text-white">
              AI Journey Analysis
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Understand the safety context of your journey before you start.
            </p>
          </div>
        </motion.div>

        {/* Main Analysis Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"
        >
          <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
            {/* Risk Score */}
            <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r">
              <div className="mb-6 flex items-center gap-2 text-sm text-slate-400">
                <ShieldCheck className="h-4 w-4" />
                SAFETY CONFIDENCE
              </div>

              <div className="flex items-center gap-6">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-8 border-amber-400/20">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">
                      {Math.max(0, 100 - totalScore)}%
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      confidence
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-sm text-slate-400">
                    Current assessment
                  </div>

                  <div className="text-xl font-semibold text-amber-400">
                    {riskLevel}
                  </div>

                  <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">
                    Several journey signals require attention. This does not
                    mean you are in danger. Silent Guardian recommends checking
                    the route before starting.
                  </p>
                </div>
              </div>
            </div>

            {/* Factors */}
            <div className="p-8">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-white">
                  Why this assessment?
                </h2>

                <p className="mt-1 text-sm text-slate-400">
                  The AI combines multiple contextual signals.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {factors.map((factor, index) => {
                  const Icon = factor.icon;

                  return (
                    <motion.div
                      key={factor.label}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + index * 0.05 }}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl bg-white/5 p-2">
                            <Icon className="h-4 w-4 text-cyan-400" />
                          </div>

                          <div>
                            <div className="text-sm font-medium text-white">
                              {factor.label}
                            </div>

                            <div className="text-xs text-slate-500">
                              {factor.value}
                            </div>
                          </div>
                        </div>

                        <span className="text-sm font-semibold text-amber-400">
                          +{factor.score}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* AI Recommendation */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.05] p-6"
        >
          <div className="flex gap-4">
            <div className="rounded-2xl bg-cyan-400/10 p-3">
              <Brain className="h-5 w-5 text-cyan-400" />
            </div>

            <div className="flex-1">
              <h2 className="font-semibold text-white">
                AI Recommendation
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Your journey has some safety concerns based on the available
                signals. Consider using a main, better-lit route and keep a
                trusted contact available during the journey.
              </p>

              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
              >
                Use Safer Route
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Demo Context */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <MapPin className="mb-3 h-5 w-5 text-cyan-400" />
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Journey
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              College → Hostel
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Clock className="mb-3 h-5 w-5 text-cyan-400" />
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Expected Arrival
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              10:30 PM
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <Users className="mb-3 h-5 w-5 text-cyan-400" />
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Travelling
            </div>
            <div className="mt-1 text-sm font-medium text-white">
              Alone
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}