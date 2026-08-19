"""AI Risk Engine.

Combines multiple signals rather than treating any single event as an
emergency. The deterministic safety engine produces a set of "factors"
(each weighted 0..1) and the AI engine merges them into a final risk
score, level, confidence, natural-language explanation, and a
recommended action.

The LLM is optional. When no API key is configured, the engine falls
back to a deterministic heuristic that produces identical structure and
labels so the demo is fully reproducible.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from ..core.config import get_settings
from ..models.schemas import LatLng, RiskAssessment, SafetyEvent, SafetyState

log = logging.getLogger("safetynet.ai")


@dataclass
class Signal:
    """Single contributing factor.

    Each signal is a discrete observation from the deterministic engine
    (e.g. "user is 420m off-route"). The AI engine treats them as
    evidence, not as a verdict.
    """

    name: str
    weight: float  # 0..1
    detail: str


_PROMPT = """You are SafetyNet, an AI safety analyst. You will receive a JSON object
with signals describing a user's situation. Produce a JSON object with:
  risk_level: one of "low" | "moderate" | "elevated" | "high" | "critical"
  risk_score: integer 0..100
  confidence: float 0..1
  explanation: 1-2 sentence natural-language summary a guardian can read
  recommended_action: short imperative sentence (e.g. "Send automatic check-in")
  contributing_factors: list of the 2-4 most relevant signal names
  safety_level: "normal" | "check_in" | "guardian_alert" | "emergency"

Rules:
- Never assume a single event is an emergency. Combine signals.
- Unfamiliarity alone is not danger.
- A user's response to a check-in should reduce risk.
- Inactivity plus check-in failure plus route deviation is more serious than any one alone.
- If this is a manual SOS, treat as critical but still note other context.
Respond with JSON only."""


class AIEngine:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def assess(
        self,
        *,
        state: SafetyState,
        signals: List[Signal],
        recent_events: List[SafetyEvent],
    ) -> RiskAssessment:
        # Fast deterministic fallback when no LLM is configured.
        if not self.settings.use_llm or not self.settings.llm_api_key:
            return self._heuristic(state, signals)

        signals_payload = [
            {"name": s.name, "weight": round(s.weight, 3), "detail": s.detail}
            for s in signals
        ]
        events_payload = [
            {
                "type": e.type,
                "payload": e.payload,
                "location": e.location.model_dump() if e.location else None,
                "at": e.created_at.isoformat(),
            }
            for e in recent_events[-12:]
        ]
        user_payload = {
            "safety_level": state.safety_level,
            "in_zone": state.current_zone_id is not None,
            "active_journey": state.active_journey_id is not None,
            "pending_check_in": state.pending_check_in,
        }
        body = {
            "model": self.settings.llm_model,
            "messages": [
                {"role": "system", "content": _PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"user": user_payload, "signals": signals_payload, "events": events_payload}
                    ),
                },
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    f"{self.settings.llm_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.settings.llm_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
                r.raise_for_status()
                content = r.json()["choices"][0]["message"]["content"]
                data = json.loads(content)
        except Exception as exc:  # noqa: BLE001
            log.warning("LLM call failed, falling back to heuristic: %s", exc)
            return self._heuristic(state, signals)

        try:
            return RiskAssessment(
                user_id=state.user_id,
                journey_id=state.active_journey_id,
                risk_level=data["risk_level"],
                risk_score=int(data["risk_score"]),
                confidence=float(data["confidence"]),
                explanation=str(data["explanation"]),
                recommended_action=str(data["recommended_action"]),
                contributing_factors=list(data.get("contributing_factors", [])),
                safety_level=data["safety_level"],
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("LLM response malformed: %s", exc)
            return self._heuristic(state, signals)

    # ---------------- heuristic fallback ----------------
    def _heuristic(self, state: SafetyState, signals: List[Signal]) -> RiskAssessment:
        if not signals:
            level = "low"
            score = 5
            conf = 0.9
            action = "Continue passive monitoring."
            explanation = "All signals are nominal. No action needed."
            factors: List[str] = []
        else:
            # weighted sum with diminishing returns so a single signal never
            # saturates the score.
            raw = sum(s.weight for s in signals)
            # log-ish scaling: 1 signal ~ 35, 2 ~ 60, 3 ~ 75, 4+ ~ 85-95
            score = int(min(100, round(100 * (1 - 2 ** (-raw)))))
            score = max(0, min(100, score))
            level = self._score_to_level(score)
            top = sorted(signals, key=lambda s: s.weight, reverse=True)[:3]
            factors = [s.name for s in top]
            conf = min(0.95, 0.5 + 0.1 * len(signals))
            explanation = self._explain(level, signals)
            action = self._action(level, state)

        return RiskAssessment(
            user_id=state.user_id,
            journey_id=state.active_journey_id,
            risk_level=level,
            risk_score=score,
            confidence=round(conf, 2),
            explanation=explanation,
            recommended_action=action,
            contributing_factors=factors,
            safety_level=self._level_to_safety(level, state),
        )

    @staticmethod
    def _score_to_level(score: int) -> str:
        if score >= 85:
            return "critical"
        if score >= 65:
            return "high"
        if score >= 40:
            return "elevated"
        if score >= 20:
            return "moderate"
        return "low"

    @staticmethod
    def _level_to_safety(level: str, state: SafetyState) -> str:
        if state.pending_check_in:
            return "check_in"
        if level in ("high", "critical"):
            return "emergency" if level == "critical" else "guardian_alert"
        if level == "elevated":
            return "check_in"
        return "normal"

    @staticmethod
    def _explain(level: str, signals: List[Signal]) -> str:
        names = ", ".join(s.name.replace("_", " ") for s in signals[:3])
        if level == "low":
            return f"Travel looks normal. Minor variation in {names}."
        if level == "moderate":
            return f"Journey is slightly off-pattern ({names}). Keeping a closer watch."
        if level == "elevated":
            return f"Multiple signals suggest something out of pattern ({names}). Requesting a check-in."
        if level == "high":
            return f"Strong indicators of trouble ({names}). Notifying trusted contacts."
        return f"Critical signals detected ({names}). Escalating to emergency response."

    @staticmethod
    def _action(level: str, state: SafetyState) -> str:
        if level == "low":
            return "Continue passive monitoring."
        if level == "moderate":
            return "Increase sampling rate; observe next 2 pings."
        if level == "elevated":
            return "Send in-app check-in request to the user."
        if level == "high":
            return "Notify trusted contacts via SMS; keep tracking."
        return "Trigger emergency escalation and notify all guardians."


ai_engine = AIEngine()
