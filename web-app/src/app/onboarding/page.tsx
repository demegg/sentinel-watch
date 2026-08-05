"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Search, X } from "lucide-react";
import { CITIES } from "@/lib/data";
import { markAppEntered } from "@/lib/app-session";
import type { SavedPlace } from "@/lib/auth-storage";
import { useAuthStore } from "@/store/auth-store";
import LoadingState from "@/components/ui/LoadingState";

type Suggest = {
  id: string;
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const user = useAuthStore((s) => s.user);
  const places = useAuthStore((s) => s.places);
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const setPlaces = useAuthStore((s) => s.setPlaces);

  const [picked, setPicked] = useState<SavedPlace[]>([]);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggest[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace("/auth?mode=signup");
      return;
    }
    // Allow returning to add places via ?edit=1
    const edit = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("edit") === "1";
    if (user.onboardingDone && !edit) {
      markAppEntered();
      router.replace("/app");
      return;
    }
    if (edit && places.length) {
      setPicked(places.slice(0, 3));
    }
  }, [hydrated, user, router, places]);

  const search = useCallback((value: string) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const lower = value.trim().toLowerCase();
    if (lower.length < 1) {
      setSuggestions([]);
      return;
    }
    const local = CITIES.filter(
      (c) =>
        c.name.toLowerCase().startsWith(lower) ||
        c.country.toLowerCase().startsWith(lower)
    )
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        name: c.name,
        country: c.country,
        countryCode: c.countryCode,
        lat: c.lat,
        lng: c.lng,
      }));
    setSuggestions(local);

    if (lower.length < 2) return;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}&count=6`);
        const data = await res.json();
        const remote: Suggest[] = (data.results ?? []).map(
          (p: {
            id: string;
            name: string;
            country: string;
            countryCode?: string;
            lat: number;
            lng: number;
          }) => ({
            id: p.id,
            name: p.name,
            country: p.country ?? "",
            countryCode: p.countryCode,
            lat: p.lat,
            lng: p.lng,
          })
        );
        const seen = new Set(local.map((s) => `${s.name}|${s.country}`));
        setSuggestions([
          ...local,
          ...remote.filter((r) => !seen.has(`${r.name}|${r.country}`)),
        ].slice(0, 8));
      } catch {
        /* keep local */
      }
    }, 220);
  }, []);

  const add = (s: Suggest) => {
    if (picked.length >= 3) return;
    if (picked.some((p) => Math.abs(p.lat - s.lat) < 0.05 && Math.abs(p.lng - s.lng) < 0.05)) {
      return;
    }
    setPicked((prev) => [
      ...prev,
      {
        id: `place-${Date.now()}-${s.id}`,
        name: s.name,
        country: s.country,
        countryCode: s.countryCode,
        lat: s.lat,
        lng: s.lng,
        addedAt: Date.now(),
      },
    ]);
    setQ("");
    setSuggestions([]);
  };

  const finish = (next: SavedPlace[]) => {
    setBusy(true);
    if (user?.onboardingDone) setPlaces(next);
    else completeOnboarding(next);
    markAppEntered();
    router.push("/app");
  };

  if (!hydrated || !user) {
    return (
      <div className="sw-auth-page">
        <LoadingState label="Preparing onboarding…" />
      </div>
    );
  }

  return (
    <div className="sw-auth-page sw-onboard-page">
      <div className="sw-auth-card sw-onboard-card">
        <div className="sw-auth-brand">
          <span className="sw-auth-logo">🛡</span>
          <div>
            <div className="sw-auth-title">Welcome, {user.name.split(" ")[0]}</div>
            <div className="sw-auth-sub">Add places you care about</div>
          </div>
        </div>

        <p className="sw-onboard-copy">
          Pick 1–3 cities or regions. Every time you open the map, SentinelWatch will show their
          live status first — not random world noise.
        </p>

        <div className="sw-onboard-picked">
          {picked.map((p) => (
            <div key={p.id} className="sw-onboard-chip">
              <MapPin size={12} />
              <span>
                {p.name}
                {p.country ? `, ${p.country}` : ""}
              </span>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {picked.length === 0 && (
            <div className="sw-onboard-empty">No places yet — search below</div>
          )}
        </div>

        {picked.length < 3 && (
          <div className="sw-onboard-search">
            <div className="sw-onboard-search-row">
              <Search size={14} />
              <input
                value={q}
                onChange={(e) => search(e.target.value)}
                placeholder="Search city or region…"
                aria-label="Search places"
              />
            </div>
            {suggestions.length > 0 && (
              <ul className="sw-onboard-suggest">
                {suggestions.map((s) => (
                  <li key={`${s.id}-${s.lat}`}>
                    <button type="button" onClick={() => add(s)}>
                      <Plus size={14} />
                      <span>
                        <strong>{s.name}</strong>
                        <em>{s.country}</em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="sw-onboard-actions">
          <button
            type="button"
            className="sw-auth-submit"
            disabled={busy || picked.length < 1}
            onClick={() => finish(picked)}
          >
            {busy ? "Opening map…" : `Continue with ${picked.length || 0} place${picked.length === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            className="sw-auth-guest"
            disabled={busy}
            onClick={() => finish([])}
            style={{ background: "transparent", border: "none", width: "100%" }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
