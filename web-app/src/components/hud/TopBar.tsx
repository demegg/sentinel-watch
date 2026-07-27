"use client";

import { useState } from "react";
import { useSWStore } from "@/store/sw-store";
import { AlertTriangle, Camera, Radio, Terminal, Search, Smartphone, Menu, X } from "lucide-react";

export default function TopBar({ onSearch }: { onSearch: (q: string) => void }) {
  const events = useSWStore((s) => s.events);
  const cameras = useSWStore((s) => s.cameras);
  const eventsLoading = useSWStore((s) => s.eventsLoading);
  const feedsLoading = useSWStore((s) => s.feedsLoading);
  const panel = useSWStore((s) => s.panel);
  const setPanel = useSWStore((s) => s.setPanel);
  const focus = useSWStore((s) => s.focus);

  const [searchQ, setSearchQ] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    onSearch(searchQ.trim());
    setSearchQ("");
    setMobileMenuOpen(false);
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
        <div className="sw-topbar-brand">
          <div className="sw-topbar-logo">🛡</div>
          <div className="sw-topbar-brand-text">
            <div className="sw-topbar-title">SentinelWatch</div>
            {focus && (
              <div className="sw-topbar-focus">
                {focus.name}{focus.country ? `, ${focus.country}` : ""}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSearch} className="sw-topbar-search">
          <Search size={12} className="sw-topbar-search-icon" aria-hidden />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search place…"
            className="sw-topbar-search-input"
            aria-label="Search place"
          />
        </form>

        <div className="sw-topbar-stats">
          {(eventsLoading || feedsLoading) && (
            <div className="sw-topbar-loading">
              <span className="sw-loading-spinner" style={{ width: 14, height: 14, margin: 0 }} aria-hidden />
              <span className="sw-topbar-loading-text">
                {eventsLoading && feedsLoading ? "Loading…" : eventsLoading ? "Events…" : "Feeds…"}
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
          {navButtons.map(({ id, icon, label }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={`sw-topbar-mobile-item${panel === id ? " is-active" : ""}`}
              onClick={() => togglePanel(id)}
            >
              {icon}
              <span>{id === "terminal" ? "Terminal" : id === "feeds" ? `Feeds (${label})` : `Events (${label})`}</span>
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
