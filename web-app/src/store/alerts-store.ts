"use client";

import { create } from "zustand";
import {
  defaultRuleForPlace,
  loadAlertInbox,
  loadAlertPrefs,
  loadAlertRules,
  loadSeenEventIds,
  meetsMinSeverity,
  saveAlertInbox,
  saveAlertPrefs,
  saveAlertRules,
  saveSeenEventIds,
  type AlertItem,
  type AlertMinSeverity,
  type AlertPrefs,
  type AlertRule,
} from "@/lib/alerts-storage";
import type { SavedPlace } from "@/lib/auth-storage";
import { newId } from "@/lib/auth-storage";

interface AlertsStore {
  hydrated: boolean;
  email: string | null;
  rules: AlertRule[];
  inbox: AlertItem[];
  prefs: AlertPrefs;
  checking: boolean;
  lastCheckAt: number | null;
  hydrate: (email: string | null) => void;
  syncRulesFromPlaces: (places: SavedPlace[]) => void;
  setRuleEnabled: (ruleId: string, enabled: boolean) => void;
  setRuleSeverity: (ruleId: string, minSeverity: AlertMinSeverity) => void;
  setRuleRadius: (ruleId: string, radiusKm: number) => void;
  setPrefs: (prefs: Partial<AlertPrefs>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearInbox: () => void;
  runCheck: () => Promise<number>;
  unreadCount: () => number;
}

function persist(email: string | null, rules: AlertRule[], inbox: AlertItem[]) {
  if (!email) return;
  saveAlertRules(email, rules);
  saveAlertInbox(email, inbox);
}

export const useAlertsStore = create<AlertsStore>((set, get) => ({
  hydrated: false,
  email: null,
  rules: [],
  inbox: [],
  prefs: { browserPush: true, pollSeconds: 90 },
  checking: false,
  lastCheckAt: null,

  hydrate: (email) => {
    if (!email) {
      set({
        hydrated: true,
        email: null,
        rules: [],
        inbox: [],
        prefs: loadAlertPrefs(),
      });
      return;
    }
    set({
      hydrated: true,
      email,
      rules: loadAlertRules(email),
      inbox: loadAlertInbox(email),
      prefs: loadAlertPrefs(),
    });
  },

  syncRulesFromPlaces: (places) => {
    const { email, rules } = get();
    if (!email) return;
    const byPlace = new Map(rules.map((r) => [r.placeId, r]));
    const next: AlertRule[] = places.map((p) => {
      const existing = byPlace.get(p.id);
      if (existing) {
        return {
          ...existing,
          placeName: p.name,
          lat: p.lat,
          lng: p.lng,
        };
      }
      return defaultRuleForPlace(p);
    });
    saveAlertRules(email, next);
    set({ rules: next });
  },

  setRuleEnabled: (ruleId, enabled) => {
    const { email, rules, inbox } = get();
    const next = rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r));
    persist(email, next, inbox);
    set({ rules: next });
  },

  setRuleSeverity: (ruleId, minSeverity) => {
    const { email, rules, inbox } = get();
    const next = rules.map((r) => (r.id === ruleId ? { ...r, minSeverity } : r));
    persist(email, next, inbox);
    set({ rules: next });
  },

  setRuleRadius: (ruleId, radiusKm) => {
    const { email, rules, inbox } = get();
    const next = rules.map((r) =>
      r.id === ruleId ? { ...r, radiusKm: Math.min(800, Math.max(50, radiusKm)) } : r
    );
    persist(email, next, inbox);
    set({ rules: next });
  },

  setPrefs: (partial) => {
    const prefs = { ...get().prefs, ...partial };
    saveAlertPrefs(prefs);
    set({ prefs });
  },

  markRead: (id) => {
    const { email, rules, inbox } = get();
    const next = inbox.map((a) => (a.id === id ? { ...a, read: true } : a));
    persist(email, rules, next);
    set({ inbox: next });
  },

  markAllRead: () => {
    const { email, rules, inbox } = get();
    const next = inbox.map((a) => ({ ...a, read: true }));
    persist(email, rules, next);
    set({ inbox: next });
  },

  clearInbox: () => {
    const { email, rules } = get();
    persist(email, rules, []);
    set({ inbox: [] });
  },

  unreadCount: () => get().inbox.filter((a) => !a.read).length,

  runCheck: async () => {
    const { email, rules, inbox, prefs } = get();
    if (!email || get().checking) return 0;
    const enabled = rules.filter((r) => r.enabled);
    if (!enabled.length) {
      set({ lastCheckAt: Date.now() });
      return 0;
    }

    set({ checking: true });
    let seen = new Set(loadSeenEventIds(email));
    const fresh: AlertItem[] = [];

    try {
      await Promise.all(
        enabled.map(async (rule) => {
          try {
            const res = await fetch(
              `/api/events?lat=${rule.lat}&lng=${rule.lng}&radius=${rule.radiusKm}`
            );
            const data = await res.json();
            for (const ev of data.events ?? []) {
              if (!meetsMinSeverity(ev.severity, rule.minSeverity)) continue;
              const dedupe = `${rule.placeId}:${ev.id}`;
              if (seen.has(dedupe)) continue;
              seen.add(dedupe);
              fresh.push({
                id: newId("alert"),
                ruleId: rule.id,
                placeId: rule.placeId,
                placeName: rule.placeName,
                eventId: ev.id,
                title: ev.title,
                detail: ev.detail,
                severity: ev.severity,
                kind: ev.kind,
                lat: ev.lat,
                lng: ev.lng,
                distanceKm: ev.distanceKm,
                source: ev.source,
                createdAt: Date.now(),
                read: false,
              });
            }
          } catch {
            /* skip place */
          }
        })
      );

      if (fresh.length) {
        const nextInbox = [...fresh, ...inbox].slice(0, 80);
        saveAlertInbox(email, nextInbox);
        saveSeenEventIds(email, [...seen]);
        set({ inbox: nextInbox, lastCheckAt: Date.now(), checking: false });

        if (prefs.browserPush && typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            for (const a of fresh.slice(0, 3)) {
              try {
                new Notification(`SentinelWatch · ${a.placeName}`, {
                  body: `${a.severity.toUpperCase()}: ${a.title}`,
                  tag: a.eventId,
                });
              } catch {
                /* ignore */
              }
            }
          }
        }
        return fresh.length;
      }

      saveSeenEventIds(email, [...seen]);
      set({ lastCheckAt: Date.now(), checking: false });
      return 0;
    } catch {
      set({ checking: false, lastCheckAt: Date.now() });
      return 0;
    }
  },
}));
