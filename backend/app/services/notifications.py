"""Notification service.

When Twilio credentials are configured, real SMS are sent. Otherwise the
service records alerts in the in-memory store and logs them so the demo
flow is fully observable. The CLI can list alerts to inspect the
escalation history.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from ..core.config import get_settings
from ..db.store import Store
from ..models.schemas import Alert, TrustedContact

log = logging.getLogger("safetynet.notify")


class NotificationService:
    def __init__(self, store: Store) -> None:
        self.store = store
        self.settings = get_settings()

    def trusted_for(self, user_id: str, contact_id: Optional[str] = None) -> Optional[TrustedContact]:
        if contact_id:
            c = self.store.contacts.get(contact_id)
            if c and c.user_id == user_id:
                return c
        for c in self.store.contacts.values():
            if c.user_id == user_id and c.is_primary:
                return c
        # fall back to first contact
        for c in self.store.contacts.values():
            if c.user_id == user_id:
                return c
        return None

    async def send(
        self,
        user_id: str,
        *,
        level: str,
        message: str,
        contact_id: Optional[str] = None,
        journey_id: Optional[str] = None,
    ) -> Alert:
        contact = self.trusted_for(user_id, contact_id)
        to = contact.phone if contact else None
        alert = Alert(
            user_id=user_id,
            journey_id=journey_id,
            level=level,  # type: ignore[arg-type]
            channel="sms" if to else "in_app",
            message=message,
            to=to,
            status="pending",
        )

        if self.settings.use_twilio and to:
            try:
                self._send_twilio(to, message)
                alert.status = "sent"
                alert.sent_at = datetime.now(tz=timezone.utc)
            except Exception as exc:  # noqa: BLE001
                log.warning("Twilio send failed: %s", exc)
                alert.status = "failed"
        else:
            log.info("[alert %s] -> %s: %s", level, to or "in-app", message)
            alert.status = "sent"
            alert.sent_at = datetime.now(tz=timezone.utc)

        self.store.alerts.append(alert)
        from .bus import bus

        await bus.publish(f"alerts:{user_id}", alert.model_dump(mode="json"))
        return alert

    def _send_twilio(self, to: str, message: str) -> None:
        from twilio.rest import Client

        client = Client(self.settings.twilio_account_sid, self.settings.twilio_auth_token)
        client.messages.create(
            body=message,
            from_=self.settings.twilio_from_number,
            to=to,
        )
