"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Camera, Radio, X, Play, Square, ExternalLink } from "lucide-react";
import type { PublicCamera, RadioStation } from "@/lib/data";
import { safeHttpUrl, isSafeYoutubeId } from "@/lib/security";
import { useSWStore } from "@/store/sw-store";
import LoadingState from "@/components/ui/LoadingState";

function safeCamUrl(cam: PublicCamera): string | null {
  if (cam.kind === "youtube") {
    return isSafeYoutubeId(cam.streamUrl) ? cam.streamUrl : null;
  }
  return safeHttpUrl(cam.streamUrl, {
    allowHttp: cam.kind === "hls" || cam.kind === "image",
  });
}

/* ─── Camera Row ─────────────────────────────────────── */
function CameraRow({ cam, onWatch }: { cam: PublicCamera; onWatch: () => void }) {
  const thumb =
    cam.thumbnail ??
    (cam.kind === "youtube" ? `https://i.ytimg.com/vi/${cam.streamUrl}/hqdefault.jpg` : null);

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "8px 0",
        display: "flex",
        gap: 10,
      }}
    >
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          style={{
            width: 72, height: 48, objectFit: "cover", borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, cursor: "pointer",
          }}
          onClick={onWatch}
        />
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.4 }}>{cam.name}</div>
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.05em", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span>{cam.source.toUpperCase()} · {cam.exact ? "EXACT" : "APPROX"} · {cam.distanceKm} km</span>
          {cam.liveVerified && (
            <span style={{ color: "#f87171", fontWeight: 600, letterSpacing: "0.12em" }}>LIVE VERIFIED</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          <button
            onClick={onWatch}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.25)",
              color: "#fbbf24", fontSize: 10, padding: "3px 8px",
              cursor: "pointer", borderRadius: 3, letterSpacing: "0.1em",
            }}
          >
            <Play size={9} /> WATCH
          </button>
          {cam.kind === "youtube" && (
            <a
              href={`https://www.youtube.com/watch?v=${cam.streamUrl}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(34,211,238,0.06)",
                border: "1px solid rgba(34,211,238,0.2)",
                color: "#22d3ee", fontSize: 10, padding: "3px 8px",
                borderRadius: 3, letterSpacing: "0.1em", textDecoration: "none",
              }}
            >
              <ExternalLink size={9} /> YOUTUBE
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Radio Row ──────────────────────────────────────── */
function RadioRow({
  station, playing, onPlay, onStop,
}: {
  station: RadioStation; playing: boolean; onPlay: () => void; onStop: () => void;
}) {
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "8px 0",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontSize: 12, color: "#e2e8f0" }}>{station.name}</div>
      <div style={{ fontSize: 10, color: "#475569" }}>
        {station.country ? `${station.country.toUpperCase()} · ` : ""}
        {station.codec ?? "stream"}{station.bitrate ? ` · ${station.bitrate}kbps` : ""}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        <button
          onClick={playing ? onStop : onPlay}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: playing ? "rgba(74,222,128,0.12)" : "rgba(74,222,128,0.06)",
            border: `1px solid rgba(74,222,128,${playing ? 0.5 : 0.2})`,
            color: "#4ade80", fontSize: 10, padding: "3px 8px",
            cursor: "pointer", borderRadius: 3, letterSpacing: "0.1em",
          }}
        >
          {playing ? <Square size={9} /> : <Play size={9} />}
          {playing ? "STOP" : "PLAY"}
        </button>
      </div>
    </div>
  );
}

/* ─── Camera Viewer ──────────────────────────────────── */
export function CameraViewer() {
  const cam = useSWStore((s) => s.activeCamera);
  const setActiveCamera = useSWStore((s) => s.setActiveCamera);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imgTick, setImgTick] = useState(0);

  useEffect(() => {
    if (!cam || cam.kind !== "image") return;
    const t = setInterval(() => setImgTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [cam]);

  useEffect(() => {
    const video = videoRef.current;
    if (!cam || cam.kind !== "hls" || !video) return;
    const src = safeCamUrl(cam);
    if (!src) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
    return () => hls?.destroy();
  }, [cam]);

  if (!cam) return null;

  const stream = safeCamUrl(cam);
  if (!stream) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(10,14,20,0.97)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#94a3b8", flexDirection: "column", gap: 12,
        }}
      >
        <div>Blocked unsafe camera URL</div>
        <button onClick={() => setActiveCamera(null)}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "8px 14px", cursor: "pointer", color: "#e2e8f0" }}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(10,14,20,0.97)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: "1px solid rgba(34,211,238,0.15)",
          background: "rgba(17,24,39,0.8)",
        }}
      >
        <Camera size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(34,211,238,0.6)" }}>
            {cam.liveVerified ? "LIVE VERIFIED CAMERA" : "LIVE CAMERA"} · {cam.exact ? "EXACT PIN" : "APPROX AREA"}
          </div>
          <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {cam.name}
          </div>
        </div>
        {cam.kind === "youtube" && (
          <a
            href={`https://www.youtube.com/watch?v=${stream}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#22d3ee", display: "flex", alignItems: "center", gap: 4 }}
          >
            <ExternalLink size={12} /> YOUTUBE
          </a>
        )}
        {cam.kind === "page" && (
          <a href={stream} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#22d3ee", display: "flex", alignItems: "center", gap: 4 }}>
            <ExternalLink size={12} /> OPEN
          </a>
        )}
        <button onClick={() => setActiveCamera(null)}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: 6, cursor: "pointer", color: "#94a3b8" }}>
          <X size={14} />
        </button>
      </div>

      {/* Video */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", padding: 12 }}>
        {cam.kind === "youtube" && (
          <iframe
            title={cam.name}
            style={{ width: "100%", maxWidth: 900, height: "100%", border: 0 }}
            src={`https://www.youtube.com/embed/${stream}?autoplay=1&mute=1&rel=0&playsinline=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        )}
        {cam.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={imgTick}
            src={`${stream}${stream.includes("?") ? "&" : "?"}_=${imgTick}`}
            alt={cam.name}
            style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
        )}
        {cam.kind === "hls" && (
          <video ref={videoRef} style={{ maxHeight: "100%", maxWidth: "100%" }} controls autoPlay muted playsInline />
        )}
        {cam.kind === "dailymotion" && (
          <iframe
            title={cam.name}
            style={{ width: "100%", maxWidth: 900, height: "100%", border: 0 }}
            src={`${stream}${stream.includes("?") ? "&" : "?"}autoplay=1&mute=1`}
            allow="autoplay; fullscreen"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        )}
        {cam.kind === "page" && (
          <iframe title={cam.name} src={stream}
            style={{ width: "100%", maxWidth: 900, height: "100%", border: 0, background: "#000" }}
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerPolicy="no-referrer" />
        )}
      </div>
    </div>
  );
}

/* ─── Radio Player ───────────────────────────────────── */
export function RadioPlayer() {
  const station = useSWStore((s) => s.activeRadio);
  const setActiveRadio = useSWStore((s) => s.setActiveRadio);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    if (!station) { audio.pause(); audio.removeAttribute("src"); return; }
    const src = safeHttpUrl(station.streamUrl, { allowHttp: true });
    if (!src) {
      setError("Blocked unsafe stream URL");
      audio.pause();
      audio.removeAttribute("src");
      return;
    }
    audio.src = src;
    void audio.play().catch(() => setError("Tap play to start audio"));
  }, [station]);

  if (!station) return null;

  return (
    <div className="sw-radio-player">
      <Radio size={14} style={{ color: "#4ade80", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#86efac", letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {station.name}
        </div>
        {error && <div style={{ fontSize: 10, color: "#fbbf24" }}>{error}</div>}
        <audio ref={audioRef} controls style={{ height: 24, width: "100%", marginTop: 4 }} />
      </div>
      <button onClick={() => setActiveRadio(null)}
        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, padding: 4, cursor: "pointer", color: "#94a3b8" }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ─── Feeds Panel (sidebar content) ─────────────────── */
export default function FeedsPanel() {
  const focus = useSWStore((s) => s.focus);
  const cameras = useSWStore((s) => s.cameras);
  const radios = useSWStore((s) => s.radios);
  const feedsLoading = useSWStore((s) => s.feedsLoading);
  const setActiveCamera = useSWStore((s) => s.setActiveCamera);
  const activeRadio = useSWStore((s) => s.activeRadio);
  const setActiveRadio = useSWStore((s) => s.setActiveRadio);
  const [tab, setTab] = useState<"cameras" | "radio">("cameras");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Regional header */}
      {focus && (
        <div style={{ padding: "10px 16px 0", fontSize: 11, color: "#94a3b8" }}>
          <span style={{ color: "#22d3ee", fontWeight: 600 }}>
            {focus.name}{focus.country ? `, ${focus.country}` : ""}
          </span>
          <span style={{ color: "#475569" }}> · local cameras · national radio</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {(["cameras", "radio"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "6px 0", fontSize: 10, letterSpacing: "0.15em",
              cursor: "pointer", background: "transparent",
              border: `1px solid ${tab === t ? "rgba(34,211,238,0.35)" : "transparent"}`,
              color: tab === t ? "#22d3ee" : "#475569",
              borderRadius: 3, transition: "all 0.15s",
            }}
          >
            {t === "cameras" ? `CAMERAS (${cameras.length})` : `RADIO (${radios.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
        {feedsLoading && (
          <LoadingState
            compact
            label="Loading feeds…"
            sublabel={
              focus
                ? `Cameras near ${focus.name}${focus.country ? ` · radio across ${focus.country}` : ""}`
                : "Scanning regional cameras and national radio"
            }
          />
        )}

        {!feedsLoading && tab === "cameras" && cameras.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 12px", color: "#475569", fontSize: 12, lineHeight: 1.6 }}>
            No verified live webcams found for {focus?.name ?? "this area"}.
            {"\n"}We scan OSM streams, Windy, Dailymotion, embed sites, and YouTube — only on-air feeds are shown.
            {"\n"}Try another city: goto {"<"}city{">"}
          </div>
        )}

        {!feedsLoading && tab === "cameras" &&
          cameras.map((cam) => (
            <CameraRow key={cam.id} cam={cam} onWatch={() => setActiveCamera(cam)} />
          ))}

        {!feedsLoading && tab === "radio" && radios.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 12px", color: "#475569", fontSize: 12 }}>
            No radio stations found{focus?.country ? ` for ${focus.country}` : ""}.
          </div>
        )}

        {!feedsLoading && tab === "radio" &&
          radios.map((st) => (
            <RadioRow
              key={st.id}
              station={st}
              playing={activeRadio?.id === st.id}
              onPlay={() => {
                setActiveRadio(st);
                void fetch(`https://de1.api.radio-browser.info/json/url/${st.stationuuid}`, {
                  headers: { "User-Agent": "SentinelWatch/1.0" },
                }).catch(() => undefined);
              }}
              onStop={() => setActiveRadio(null)}
            />
          ))}
      </div>
    </div>
  );
}
