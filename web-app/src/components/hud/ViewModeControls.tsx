"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Globe, Map } from "lucide-react";
import { useSWStore, type ViewMode } from "@/store/sw-store";

const MODES: { id: ViewMode; label: string; icon: ReactNode }[] = [
  { id: "map", label: "Crisis Map", icon: <Map size={12} /> },
  { id: "earth", label: "3D Earth", icon: <Globe size={12} /> },
];

export default function ViewModeControls() {
  const viewMode = useSWStore((s) => s.viewMode);
  const setViewMode = useSWStore((s) => s.setViewMode);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const current = MODES.find((m) => m.id === viewMode) ?? MODES[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="sw-view-modes sw-view-dropdown" ref={wrapRef}>
      <button
        type="button"
        className="sw-view-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {current.icon}
        <span className="sw-mode-label">{current.label}</span>
        <ChevronDown size={12} style={{ opacity: 0.7, transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="sw-view-dropdown-menu" role="listbox">
          {MODES.map((m) => {
            const on = viewMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={on}
                className={`sw-view-dropdown-item${on ? " is-active" : ""}`}
                onClick={() => {
                  setViewMode(m.id);
                  setOpen(false);
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
