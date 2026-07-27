"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWStore } from "@/store/sw-store";
import { CITIES } from "@/lib/data";
import {
  AlertTriangle,
  Camera,
  Radio,
  Terminal,
  Search,
  Smartphone,
  Menu,
  X,
  RotateCcw,
} from "lucide-react";

type SuggestPlace = {
  id: string;
  name: string;
  country: string;
  countryCode?: string;
  lat: number;
  lng: number;
  timezone?: string;
  admin1?: string;
  source: "local" | "geocode";
};

function localSuggestions(q: string): SuggestPlace[] {
  const lower = q.toLowerCase().trim();
  if (lower.length < 1) return [];
  return CITIES.filter(
    (c) =>
      c.name.toLowerCase().startsWith(lower) ||
      c.id.startsWith(lower) ||
      c.country.toLowerCase().startsWith(lower)
  ).map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    countryCode: c.countryCode,
    lat: c.lat,
    lng: c.lng,
    timezone: c.timezone,
    source: "local" as const,
  }));
}

export default function TopBar({
  onSearch,
  onResetWorld,
}: {
  onSearch: (q: string) => void;
  onResetWorld: () => void;
}) {
  const events = useSWStore((s) => s.events);
  const cameras = useSWStore((s) => s.cameras);
  const eventsLoading = useSWStore((s) => s.eventsLoading);
  const feedsLoading = useSWStore((s) => s.feedsLoading);
  const panel = useSWStore((s) => s.panel);
  const setPanel = useSWStore((s) => s.setPanel);
  const focus = useSWStore((s) => s.focus);
  const mapScope = useSWStore((s) => s.mapScope);

  const [searchQ, setSearchQ] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestPlace[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const closeSuggest = useCallback(() => {
    setSuggestOpen(false);
    setActiveIdx(-1);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) closeSuggest();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [closeSuggest]);

  const fetchSuggestions = useCallback(async (q: string) => {
    const local = localSuggestions(q);
    if (q.trim().length < 2) {
      setSuggestions(local.slice(0, 8));
      setSuggestOpen(local.length > 0);
      return;
    }
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(q.trim())}&count=8`
      );
      const data = await res.json();
      const remote: SuggestPlace[] = (data.results ?? []).map(
        (p: {
          id: string;
          name: string;
          country: string;
          countryCode?: string;
          lat: number;
          lng: number;
          timezone?: string;
          admin1?: string;
        }) => ({
          ...p,
          source: "geocode" as const,
        })
      );
      const seen = new Set(local.map((p) => p.name.toLowerCase()));
      const merged = [
        ...local,
        ...remote.filter((p) => !seen.has(p.name.toLowerCase())),
      ].slice(0, 8);
      setSuggestions(merged);
      setSuggestOpen(merged.length > 0);
    } catch {
      setSuggestions(local.slice(0, 8));
      setSuggestOpen(local.length > 0);
    }
  }, []);

  const onQueryChange = (value: string) => {
    setSearchQ(value);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    // Instant local hits
    const local = localSuggestions(value);
    setSuggestions(local.slice(0, 8));
    setSuggestOpen(local.length > 0 || value.trim().length >= 2);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, 220);
  };

  const pickSuggestion = (s: SuggestPlace) => {
    setSearchQ("");
    closeSuggest();
    setMobileMenuOpen(false);
    onSearch(s.name);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQ.trim();
    if (!q) return;
    if (activeIdx >= 0 && suggestions[activeIdx]) {
      pickSuggestion(suggestions[activeIdx]);
      return;
    }
    onSearch(q);
    setSearchQ("");
    closeSuggest();
    setMobileMenuOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      closeSuggest();
    }
  };

  const togglePanel = (id: "events" | "feeds" | "terminal") => {
    setPanel(panel === id ? null : id);
    setMobileMenuOpen(false);
  };

  const critical = events.filter((e) => e.severity === "critical").length;

  const navButtons = [
    { id: "events" as const, icon: <AlertTriangle size={14} />, label: String(events.length) },
    { id: "feeds" as const, icon: <Camera size={14} />, label: String(cameras.length) },
    { id: "terminal" as const, icon: <Terminal size={14} />, label: "" },
  ];

  return (
    <header className="sw-topbar">
      <div className="sw-topbar-inner">
        <button
          type="button"
          className="sw-topbar-brand"
          onClick={onResetWorld}
          title="Reset to world map"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
            font: "inherit",
            color: "inherit",
          }}
        >
          <div className="sw-topbar-logo">🛡</div>
          <div className="sw-topbar-brand-text">
            <div className="sw-topbar-title">SentinelWatch</div>
            {focus && (
              <div className="sw-topbar-focus">
                {focus.name}
                {focus.country ? `, ${focus.country}` : ""}
              </div>
            )}
          </div>
        </button>

        <div className="sw-topbar-search-wrap" ref={wrapRef}>
          <form onSubmit={handleSearch} className="sw-topbar-search" autoComplete="off">
            <Search size={12} className="sw-topbar-search-icon" aria-hidden />
            <input
              value={searchQ}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length) setSuggestOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search city…"
              className="sw-topbar-search-input"
              aria-label="Search city"
              aria-autocomplete="list"
              aria-expanded={suggestOpen}
              role="combobox"
            />
          </form>
          {suggestOpen && suggestions.length > 0 && (
            <ul className="sw-search-suggest" role="listbox">
              {suggestions.map((s, i) => (
                <li key={`${s.id}-${s.lat}-${s.lng}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    className={`sw-search-suggest-item${i === activeIdx ? " is-active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                  >
                    <span className="sw-search-suggest-name">{s.name}</span>
                    <span className="sw-search-suggest-meta">
                      {[s.admin1, s.country].filter(Boolean).join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(mapScope === "regional" || focus) && (
          <button
            type="button"
            className="sw-topbar-reset"
            onClick={onResetWorld}
            title="Reset to world map"
          >
            <RotateCcw size={13} />
            <span>World</span>
          </button>
        )}

        <div className="sw-topbar-stats">
          {(eventsLoading || feedsLoading) && (
            <div className="sw-topbar-loading">
              <span className="sw-loading-spinner" style={{ width: 14, height: 14, margin: 0 }} aria-hidden />
              <span className="sw-topbar-loading-text">
                {eventsLoading && feedsLoading
                  ? "Loading…"
                  : eventsLoading
                    ? "Events…"
                    : "Feeds…"}
              </span>
            </div>
          )}
          {critical > 0 && (
            <div className="sw-topbar-critical">
              <AlertTriangle size={12} />
              <span>{critical}</span>
            </div>
          )}
          <div className="sw-topbar-event-count">
            <span>{events.length}</span> events
          </div>
        </div>

        <nav className="sw-topbar-nav" aria-label="Panels">
          {navButtons.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => togglePanel(id)}
              title={id}
              className={`sw-topbar-nav-btn${panel === id ? " is-active" : ""}`}
            >
              {icon}
              {label !== "" && <span>{label}</span>}
            </button>
          ))}
          <a href="/download" className="sw-topbar-app-link">
            <Smartphone size={13} />
            <span>App</span>
          </a>
        </nav>

        <button
          type="button"
          className="sw-topbar-menu-btn"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="sw-topbar-mobile-menu" role="menu">
          {(mapScope === "regional" || focus) && (
            <button
              type="button"
              role="menuitem"
              className="sw-topbar-mobile-item"
              onClick={() => {
                onResetWorld();
                setMobileMenuOpen(false);
              }}
            >
              <RotateCcw size={14} />
              <span>Reset world map</span>
            </button>
          )}
          {navButtons.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`sw-topbar-mobile-item${panel === id ? " is-active" : ""}`}
              onClick={() => togglePanel(id)}
            >
              {icon}
              <span>
                {id === "terminal"
                  ? "Terminal"
                  : id === "feeds"
                    ? `Feeds (${label})`
                    : `Events (${label})`}
              </span>
            </button>
          ))}
          <a href="/download" className="sw-topbar-mobile-item" role="menuitem">
            <Smartphone size={14} />
            <span>Download App</span>
          </a>
        </div>
      )}
    </header>
  );
}
