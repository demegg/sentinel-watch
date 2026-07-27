"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { markAppEntered } from "@/lib/app-session";
import Globe from "./Globe";

const TITLE = "SENTINEL WATCH";

// Inline radar-sweep mark (matches assets/logo.svg)
function LogoMark({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lp-sweep" x1="16" y1="16" x2="28" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff4d4d" />
          <stop offset="1" stopColor="#ff8c42" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="lp-ring" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff4d4d" />
          <stop offset="1" stopColor="#ff8c42" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill="#0f1319" stroke="url(#lp-ring)" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="5.5" ry="13" stroke="#64748b" strokeWidth="1" />
      <path d="M3 16h26" stroke="#64748b" strokeWidth="1" strokeLinecap="round" />
      <path d="M16 3v26" stroke="#475569" strokeWidth="0.75" strokeLinecap="round" opacity="0.6" />
      {/* spinning sweep */}
      <g style={{ transformOrigin: "16px 16px", animation: "lp-radar 4s linear infinite" }}>
        <path d="M16 16L16 3A13 13 0 0 1 27.2 11.5Z" fill="url(#lp-sweep)" opacity="0.9" />
      </g>
      <circle cx="16" cy="16" r="2.25" fill="#ff4d4d" />
      <circle cx="16" cy="16" r="4.5" stroke="#ff4d4d" strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const enter = () => {
    if (leaving) return;
    markAppEntered();
    setLeaving(true);
  };

  return (
    <motion.main
      className="lp-main"
      initial={{ opacity: 1 }}
      animate={leaving ? { opacity: 0, scale: 1.04, filter: "blur(6px)" } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => leaving && router.push("/app")}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background:
          "radial-gradient(1200px 800px at 50% 42%, #0f172a 0%, #0a0e14 55%, #060810 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: "#e2e8f0",
      }}
    >
      {/* Starfield */}
      <div className="lp-stars" aria-hidden />
      {/* Scanline grid vignette */}
      <div className="lp-grid" aria-hidden />

      {/* Globe centerpiece — flex-centered wrapper so framer's scale transform
          doesn't fight the centering translate */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <motion.div
          className="lp-globe-wrap"
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Globe />
        </motion.div>
      </div>

      {/* Foreground content */}
      <div className="lp-content" style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "0 24px",
          pointerEvents: "none",
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 18px rgba(239,68,68,0.4))", marginBottom: 22 }}
        >
          <LogoMark size={64} />
        </motion.div>

        {/* Title — letter by letter, words stay unbroken (wrap as whole words) */}
        <motion.h1
          className="lp-title"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: 0.75 } } }}
          style={{
            margin: 0,
            fontSize: "clamp(1.9rem, 8vw, 5rem)",
            fontWeight: 800,
            letterSpacing: "0.16em",
            lineHeight: 1.08,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: "0.28em",
            rowGap: "0.12em",
            filter: "drop-shadow(0 0 34px rgba(239,68,68,0.28))",
          }}
        >
          {(() => {
            let n = 0;
            return TITLE.split(" ").map((word, wi) => (
              <span key={wi} style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
                {word.split("").map((ch) => {
                  const delay = 0.75 + n++ * 0.055;
                  return (
                    <motion.span
                      key={delay}
                      variants={{
                        hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
                        show: { opacity: 1, y: 0, filter: "blur(0px)" },
                      }}
                      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        display: "inline-block",
                        background: "linear-gradient(180deg, #ffffff 0%, #e2e8f0 45%, #94a3b8 100%)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        color: "transparent",
                      }}
                    >
                      {ch}
                    </motion.span>
                  );
                })}
              </span>
            ));
          })()}
        </motion.h1>

        {/* Accent divider */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 1.55, duration: 0.7, ease: "easeOut" }}
          style={{
            width: 220,
            maxWidth: "60vw",
            height: 1,
            margin: "26px 0 20px",
            background:
              "linear-gradient(90deg, transparent, #ef4444 30%, #f97316 70%, transparent)",
          }}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.5 }}
          style={{
            fontSize: 10,
            letterSpacing: "0.35em",
            color: "#f97316",
            marginBottom: 14,
            fontWeight: 600,
          }}
        >
          BETA
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="lp-tagline"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7, duration: 0.9, ease: "easeOut" }}
          style={{
            margin: 0,
            fontSize: "clamp(0.85rem, 2.2vw, 1.15rem)",
            fontWeight: 300,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(148,163,184,0.85)",
          }}
        >
          Eyes everywhere. Always watching.
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.1, duration: 0.7, ease: "easeOut" }}
          onClick={enter}
          className="lp-cta"
          style={{ pointerEvents: "auto" }}
        >
          <span className="lp-cta-dot" />
          Enter the Watch
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 2 }}>
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>

        {/* Status strip */}
        <motion.div
          className="lp-status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
          style={{
            marginTop: 34,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 10.5,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: "#475569",
          }}
        >
          <span className="lp-live" />
          Global feed online · No account required
        </motion.div>
      </div>
    </motion.main>
  );
}
