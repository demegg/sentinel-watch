"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSWStore } from "@/store/sw-store";
import EventsPanel from "./EventsPanel";
import FeedsPanel from "../feeds/LocalFeeds";
import CommandTerminal from "../terminal/CommandTerminal";
import { AlertTriangle, Camera, Terminal, X } from "lucide-react";

const PANEL_LABELS = {
  events: { icon: <AlertTriangle size={13} />, title: "CRISIS EVENTS" },
  feeds: { icon: <Camera size={13} />, title: "LIVE FEEDS" },
  terminal: { icon: <Terminal size={13} />, title: "TERMINAL" },
};

export default function Sidebar() {
  const panel = useSWStore((s) => s.panel);
  const setPanel = useSWStore((s) => s.setPanel);

  return (
    <AnimatePresence>
      {panel && (
        <motion.div
          key={panel}
          className="sw-sidebar"
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#22d3ee" }}>{PANEL_LABELS[panel].icon}</span>
            <span style={{ flex: 1, fontSize: 10, letterSpacing: "0.25em", color: "#64748b", fontWeight: 600 }}>
              {PANEL_LABELS[panel].title}
            </span>
            <button
              onClick={() => setPanel(null)}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: 4, cursor: "pointer", color: "#475569" }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: panel === "terminal" ? "hidden" : "auto" }}>
            {panel === "events" && <EventsPanel />}
            {panel === "feeds" && <FeedsPanel />}
            {panel === "terminal" && (
              <div style={{ padding: 12, display: "flex", flexDirection: "column", height: "100%" }}>
                <CommandTerminal />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
