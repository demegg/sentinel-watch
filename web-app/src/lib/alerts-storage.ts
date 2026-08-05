export type AlertMinSeverity = "medium" | "high" | "critical";

export type AlertRule = {
  id: string;
  placeId: string;
  placeName: string;
  lat: number;
  lng: number;
  radiusKm: number;
  minSeverity: AlertMinSeverity;
  enabled: boolean;
};

export type AlertItem = {
  id: string;
  ruleId: string;
  placeId: string;
  placeName: string;
  eventId: string;
  title: string;
  detail: string;
  severity: string;
  kind: string;
  lat: number;
  lng: number;
  distanceKm: number;
  source: string;
  createdAt: number;
  read: boolean;
};

const RULES_KEY = "sw-alert-rules-v1";
const ALERTS_KEY = "sw-alert-inbox-v1";
const SEEN_KEY = "sw-alert-seen-v1";
const PREFS_KEY = "sw-alert-prefs-v1";

export type AlertPrefs = {
  browserPush: boolean;
  pollSeconds: number;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadAlertRules(email: string): AlertRule[] {
  const all = readJson<Record<string, AlertRule[]>>(RULES_KEY, {});
  return all[email.toLowerCase()] ?? [];
}

export function saveAlertRules(email: string, rules: AlertRule[]) {
  const all = readJson<Record<string, AlertRule[]>>(RULES_KEY, {});
  all[email.toLowerCase()] = rules.slice(0, 20);
  writeJson(RULES_KEY, all);
}

export function loadAlertInbox(email: string): AlertItem[] {
  const all = readJson<Record<string, AlertItem[]>>(ALERTS_KEY, {});
  return (all[email.toLowerCase()] ?? []).slice(0, 80);
}

export function saveAlertInbox(email: string, items: AlertItem[]) {
  const all = readJson<Record<string, AlertItem[]>>(ALERTS_KEY, {});
  all[email.toLowerCase()] = items.slice(0, 80);
  writeJson(ALERTS_KEY, all);
}

export function loadSeenEventIds(email: string): string[] {
  const all = readJson<Record<string, string[]>>(SEEN_KEY, {});
  return all[email.toLowerCase()] ?? [];
}

export function saveSeenEventIds(email: string, ids: string[]) {
  const all = readJson<Record<string, string[]>>(SEEN_KEY, {});
  all[email.toLowerCase()] = ids.slice(-400);
  writeJson(SEEN_KEY, all);
}

export function loadAlertPrefs(): AlertPrefs {
  return readJson<AlertPrefs>(PREFS_KEY, { browserPush: true, pollSeconds: 90 });
}

export function saveAlertPrefs(prefs: AlertPrefs) {
  writeJson(PREFS_KEY, prefs);
}

export function defaultRuleForPlace(place: {
  id: string;
  name: string;
  lat: number;
  lng: number;
}): AlertRule {
  return {
    id: `rule-${place.id}`,
    placeId: place.id,
    placeName: place.name,
    lat: place.lat,
    lng: place.lng,
    radiusKm: 250,
    minSeverity: "high",
    enabled: true,
  };
}

const SEV_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function meetsMinSeverity(sev: string, min: AlertMinSeverity) {
  return (SEV_RANK[sev] ?? 0) >= (SEV_RANK[min] ?? 2);
}
