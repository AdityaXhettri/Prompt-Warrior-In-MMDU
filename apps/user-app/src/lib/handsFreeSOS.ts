/**
 * Hands-free SOS triggers for SafetyNet.
 *
 * Three detection mechanisms:
 * 1. Shake detection — devicemotion acceleration > 30 m/s²
 * 2. Long-press spacebar — hold Space for > 2.5 seconds
 * 3. Immobility detection — same position for 15 min during active journey
 *
 * All triggers share a 30-second cooldown to prevent accidental SOS storms.
 */

import { useEffect, useRef, useCallback } from "react";
import { api } from "./api";

const SHAKE_THRESHOLD = 30; // m/s²
const LONG_PRESS_MS = 2500;
const COOLDOWN_MS = 30_000;
const IMMOBILITY_CHECK_MS = 60_000;
const IMMOBILITY_TRIGGER_MS = 15 * 60_000;
const IMMOBILITY_DISTANCE_THRESHOLD = 0.0005; // ~55m in lat/lng

export function useHandsFreeSOS(
  userId: string,
  enabled: boolean,
  onTriggered?: (method: "shake" | "longpress" | "immobility") => void,
) {
  const lastTriggerRef = useRef(0);
  const spaceDownRef = useRef<number | null>(null);
  const spaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  const triggerSOS = useCallback(
    async (method: "shake" | "longpress" | "immobility") => {
      const now = Date.now();
      if (now - lastTriggerRef.current < COOLDOWN_MS) return;
      lastTriggerRef.current = now;

      try {
        await api.sos(userId);
        onTriggered?.(method);
      } catch (err) {
        console.warn("[hands-free] SOS failed:", err);
      }
    },
    [userId, onTriggered],
  );

  // ---------- 1. Shake detection ----------
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt(
        (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2,
      );
      if (magnitude > SHAKE_THRESHOLD) {
        triggerSOS("shake");
      }
    };

    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [enabled, triggerSOS]);

  // ---------- 2. Long-press spacebar ----------
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      spaceDownRef.current = Date.now();
      spaceTimerRef.current = setTimeout(() => {
        triggerSOS("longpress");
        spaceDownRef.current = null;
      }, LONG_PRESS_MS);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceDownRef.current = null;
      if (spaceTimerRef.current) {
        clearTimeout(spaceTimerRef.current);
        spaceTimerRef.current = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (spaceTimerRef.current) clearTimeout(spaceTimerRef.current);
    };
  }, [enabled, triggerSOS]);

  // ---------- 3. Immobility detection ----------
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(async () => {
      try {
        const state = await api.state(userId);
        if (!state.active_journey_id) {
          lastPositionRef.current = null;
          return;
        }

        // Get latest position from recent events
        const events = await api.events(userId, 5);
        const latestWithLocation = events.find((e) => e.location);
        if (!latestWithLocation?.location) return;

        const pos = latestWithLocation.location;
        const now = Date.now();

        if (!lastPositionRef.current) {
          lastPositionRef.current = { lat: pos.lat, lng: pos.lng, at: now };
          return;
        }

        const dLat = Math.abs(pos.lat - lastPositionRef.current.lat);
        const dLng = Math.abs(pos.lng - lastPositionRef.current.lng);

        if (dLat < IMMOBILITY_DISTANCE_THRESHOLD && dLng < IMMOBILITY_DISTANCE_THRESHOLD) {
          // Position hasn't changed meaningfully
          if (now - lastPositionRef.current.at >= IMMOBILITY_TRIGGER_MS) {
            triggerSOS("immobility");
            lastPositionRef.current = { lat: pos.lat, lng: pos.lng, at: now }; // reset after trigger
          }
        } else {
          // Position changed — reset timer
          lastPositionRef.current = { lat: pos.lat, lng: pos.lng, at: now };
        }
      } catch {
        // network error — skip this check
      }
    }, IMMOBILITY_CHECK_MS);

    return () => clearInterval(interval);
  }, [enabled, userId, triggerSOS]);
}
