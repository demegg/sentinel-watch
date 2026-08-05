"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useAlertsStore } from "@/store/alerts-store";

/** Background watcher — polls saved-place alert rules while the app is open. */
export default function AlertsWatcher() {
  const user = useAuthStore((s) => s.user);
  const places = useAuthStore((s) => s.places);
  const hydrate = useAlertsStore((s) => s.hydrate);
  const syncRulesFromPlaces = useAlertsStore((s) => s.syncRulesFromPlaces);
  const runCheck = useAlertsStore((s) => s.runCheck);
  const prefs = useAlertsStore((s) => s.prefs);
  const initialDone = useRef(false);

  useEffect(() => {
    hydrate(user?.email ?? null);
  }, [user?.email, hydrate]);

  useEffect(() => {
    if (user?.email) syncRulesFromPlaces(places);
  }, [user?.email, places, syncRulesFromPlaces]);

  useEffect(() => {
    if (!user?.email || !places.length) {
      initialDone.current = false;
      return;
    }

    if (!initialDone.current) {
      initialDone.current = true;
      const t = window.setTimeout(() => {
        void runCheck();
      }, 3500);
      return () => window.clearTimeout(t);
    }
  }, [user?.email, places.length, runCheck]);

  useEffect(() => {
    if (!user?.email || !places.length) return;
    const ms = Math.max(45, prefs.pollSeconds) * 1000;
    const id = window.setInterval(() => {
      void runCheck();
    }, ms);
    return () => window.clearInterval(id);
  }, [user?.email, places.length, prefs.pollSeconds, runCheck]);

  return null;
}
