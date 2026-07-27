"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyRound, ExternalLink, PersonStanding } from "lucide-react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import {
  clearGoogleMapsApiKey,
  getGoogleMapsApiKey,
  notifyGoogleKeyChange,
  setGoogleMapsApiKey,
  streetViewEmbedUrl,
} from "@/lib/google-maps";
import { useSWStore } from "@/store/sw-store";
import LoadingState from "@/components/ui/LoadingState";

export default function StreetViewPanel() {
  const focus = useSWStore((s) => s.focus);
  const mapCenter = useSWStore((s) => s.mapCenter);
  const hazard = useSWStore((s) => s.hazard);

  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);

  const coords = useMemo(() => {
    if (focus) return { lat: focus.lat, lng: focus.lng };
    if (hazard) return { lat: hazard.lat, lng: hazard.lng };
    return { lat: mapCenter[0], lng: mapCenter[1] };
  }, [focus, hazard, mapCenter]);

  const label = focus?.name ?? hazard?.placeName ?? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`;

  useEffect(() => {
    const syncKey = () => {
      const key = getGoogleMapsApiKey();
      setApiKeyState(key);
      setShowKeyPanel(!key);
    };
    syncKey();
    window.addEventListener("sw-google-key", syncKey);
    return () => window.removeEventListener("sw-google-key", syncKey);
  }, []);

  const applyKey = useCallback((raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    setGoogleMapsApiKey(cleaned);
    notifyGoogleKeyChange();
    setApiKeyState(cleaned);
    setShowKeyPanel(false);
  }, []);

  const embedSrc = streetViewEmbedUrl(coords.lat, coords.lng, apiKey);

  useEffect(() => {
    if (!apiKey || !containerRef.current) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const host = containerRef.current;

    (async () => {
      setLoading(true);
      setUnavailable(false);
      try {
        setOptions({ key: apiKey, v: "weekly" });
        await importLibrary("maps");
        if (cancelled || !host) return;

        host.innerHTML = "";
        const panorama = new google.maps.StreetViewPanorama(host, {
          position: coords,
          pov: { heading: 210, pitch: 0 },
          zoom: 1,
          addressControl: false,
          linksControl: true,
          panControl: true,
          enableCloseButton: false,
          fullscreenControl: true,
          motionTracking: false,
          motionTrackingControl: false,
        });
        panoramaRef.current = panorama;

        const service = new google.maps.StreetViewService();
        service.getPanorama({ location: coords, radius: 120 }, (data, status) => {
          if (cancelled) return;
          if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
            panorama.setPosition(data.location.latLng);
            setUnavailable(false);
          } else {
            setUnavailable(true);
          }
          setLoading(false);
        });
      } catch {
        if (!cancelled) {
          setUnavailable(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      panoramaRef.current = null;
      if (host) host.innerHTML = "";
    };
  }, [apiKey, coords.lat, coords.lng]);

  const mapsPanoUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords.lat},${coords.lng}`;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "#000" }}>
      {apiKey ? (
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      ) : (
        <iframe
          key={`${coords.lat}-${coords.lng}`}
          title="Google Street View"
          src={embedSrc}
          style={{ width: "100%", height: "100%", border: 0 }}
          allow="fullscreen"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => setLoading(false)}
        />
      )}

      {loading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          <LoadingState label="Loading Street View…" sublabel={`Finding imagery near ${label}`} />
        </div>
      )}

      {unavailable && !loading && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 6, textAlign: "center", padding: 20, maxWidth: 320,
          background: "rgba(10,14,20,0.9)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10,
        }}>
          <p style={{ fontSize: 12, color: "#fbbf24", margin: "0 0 10px" }}>
            No Street View coverage at this exact spot. Try a nearby road or open Google Maps.
          </p>
          <a href={mapsPanoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#22d3ee" }}>
            Open in Google Maps →
          </a>
        </div>
      )}

      {(showKeyPanel || !apiKey) && (
        <div style={{
          position: "absolute", right: 12, top: 64, zIndex: 20, width: 280, pointerEvents: "auto",
          background: "rgba(10,14,20,0.92)", border: "1px solid rgba(34,211,238,0.25)",
          borderRadius: 10, padding: 12, backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "#22d3ee", fontSize: 10, letterSpacing: "0.15em" }}>
            <KeyRound size={14} /> STREET VIEW API KEY
          </div>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyKey(keyDraft)}
            placeholder="AIza… (optional)"
            style={{
              width: "100%", marginBottom: 6, padding: "6px 8px", fontSize: 11, fontFamily: "monospace",
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#e2e8f0",
            }}
          />
          <button type="button" onClick={() => applyKey(keyDraft)} style={{ fontSize: 10, padding: "4px 10px", cursor: "pointer", border: "1px solid rgba(34,211,238,0.3)", background: "rgba(34,211,238,0.08)", color: "#22d3ee", borderRadius: 4 }}>
            SAVE KEY
          </button>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, pointerEvents: "auto", display: "flex", alignItems: "center", gap: 8,
        background: "rgba(10,14,20,0.85)", border: "1px solid rgba(34,211,238,0.25)",
        borderRadius: 8, padding: "8px 12px", backdropFilter: "blur(10px)",
      }}>
        <PersonStanding size={14} style={{ color: "#22d3ee" }} />
        <span style={{ fontSize: 10, color: "#94a3b8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Street View · {label}
        </span>
        <a href={mapsPanoUrl} target="_blank" rel="noreferrer" style={{ display: "flex", color: "#64748b" }} title="Open in Google Maps">
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
