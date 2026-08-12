"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  ChevronDown,
  LocateFixed,
  Navigation,
  Plane,
  Radar,
  Route,
  Search,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { useSWStore } from "@/store/sw-store";
import {
  aircraftMatches,
  interceptInsight,
  normalizeAircraftQuery,
  type PlaneState,
} from "@/lib/aircraft";
import { haversineKm } from "@/lib/data";
import RelativeTime from "@/components/ui/RelativeTime";

const HOT_CORRIDOR_KM = 150;

export default function AircraftFinder() {
  const enabled = useSWStore((s) => s.liveLayers.planes);
  const aircraft = useSWStore((s) => s.aircraft);
  const fetchedAt = useSWStore((s) => s.aircraftFetchedAt);
  const error = useSWStore((s) => s.aircraftError);
  const selectedId = useSWStore((s) => s.selectedAircraftId);
  const selectAircraft = useSWStore((s) => s.selectAircraft);
  const setAircraft = useSWStore((s) => s.setAircraft);
  const setMapView = useSWStore((s) => s.setMapView);
  const mapCenter = useSWStore((s) => s.mapCenter);
  const events = useSWStore((s) => s.events);
  const trails = useSWStore((s) => s.aircraftTrails);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const results = useMemo(
    () =>
      aircraft
        .filter((plane) => aircraftMatches(plane, query))
        .sort((a, b) => a.callsign.localeCompare(b.callsign))
        .slice(0, 8),
    [aircraft, query]
  );

  const selected = useMemo(
    () => aircraft.find((plane) => plane.id === selectedId) ?? null,
    [aircraft, selectedId]
  );

  const hotCorridor = useMemo(() => {
    if (!aircraft.length || !events.length) return 0;
    const hotEvents = events.filter((e) => e.severity === "critical" || e.severity === "high");
    if (!hotEvents.length) return 0;
    let count = 0;
    for (const plane of aircraft) {
      if (plane.onGround) continue;
      for (const event of hotEvents) {
        if (haversineKm(plane.lat, plane.lng, event.lat, event.lng) <= HOT_CORRIDOR_KM) {
          count += 1;
          break;
        }
      }
    }
    return count;
  }, [aircraft, events]);

  const nearestThreat = useMemo(() => {
    if (!selected || !events.length) return null;
    let nearest: { title: string; severity: string; lat: number; lng: number; distanceKm: number } | null =
      null;
    for (const event of events) {
      const distanceKm = haversineKm(selected.lat, selected.lng, event.lat, event.lng);
      if (!nearest || distanceKm < nearest.distanceKm) {
        nearest = {
          title: event.title,
          severity: event.severity,
          lat: event.lat,
          lng: event.lng,
          distanceKm,
        };
      }
    }
    return nearest;
  }, [selected, events]);

  const intercept = useMemo(() => {
    if (!selected || !nearestThreat) return null;
    return interceptInsight(selected, nearestThreat.lat, nearestThreat.lng, nearestThreat.distanceKm);
  }, [selected, nearestThreat]);

  if (!enabled) return null;

  const choose = (plane: PlaneState) => {
    selectAircraft(plane.id);
    setMapView([plane.lat, plane.lng], 9);
    setQuery(plane.callsign === "UNKN" ? plane.id.toUpperCase() : plane.callsign);
    setSearchMessage("");
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeAircraftQuery(query);
    if (!normalized) return;

    const local = aircraft.find((plane) => aircraftMatches(plane, normalized));
    if (local) {
      choose(local);
      return;
    }

    setSearching(true);
    setSearchMessage("");
    try {
      const directIcao = /^[0-9A-F]{6}$/.test(normalized);
      const params = new URLSearchParams();
      if (directIcao) {
        params.set("q", normalized);
      } else {
        // Callsign search: widen around current map center (OpenSky has no callsign endpoint).
        const pad = 18;
        const [lat, lng] = mapCenter;
        params.set("lamin", String(Math.max(-85, lat - pad)));
        params.set("lomin", String(Math.max(-180, lng - pad)));
        params.set("lamax", String(Math.min(85, lat + pad)));
        params.set("lomax", String(Math.min(180, lng + pad)));
        params.set("q", normalized);
      }

      const response = await fetch(`/api/planes?${params.toString()}`);
      const data = await response.json();
      const matches = (data.planes ?? []) as PlaneState[];
      const found =
        matches.find((plane) => aircraftMatches(plane, normalized)) ?? matches[0] ?? null;

      if (!response.ok || !found) {
        setSearchMessage(
          data.error ??
            (directIcao
              ? "Aircraft not currently transmitting."
              : "No callsign match in this region. Zoom toward the flight corridor or try its ICAO24 id.")
        );
        return;
      }

      setAircraft(
        [found, ...aircraft.filter((plane) => plane.id !== found.id)],
        data.fetchedAt ?? Date.now(),
        null
      );
      choose(found);
    } catch {
      setSearchMessage("Aircraft search is temporarily unavailable.");
    } finally {
      setSearching(false);
    }
  };

  const subtitle = (() => {
    if (hotCorridor > 0) return `${hotCorridor} in hot corridor`;
    if (aircraft.length) return `${aircraft.length} aircraft in view`;
    return "Scanning airspace";
  })();

  return (
    <section className={`sw-aircraft-finder${open ? " is-open" : ""}`} aria-label="SkyTrace aircraft finder">
      <button
        type="button"
        className="sw-aircraft-finder-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="sw-aircraft-pulse" aria-hidden>
          <Radar size={15} />
        </span>
        <span>
          <strong>SkyTrace</strong>
          <small className={hotCorridor > 0 ? "is-hot" : undefined}>{subtitle}</small>
        </span>
        <ChevronDown size={15} className={open ? "is-rotated" : undefined} aria-hidden />
      </button>

      {open && (
        <div className="sw-aircraft-finder-body">
          <div className="sw-aircraft-finder-kicker">
            <Plane size={12} /> LIVE AIRCRAFT FINDER
          </div>

          <form className="sw-aircraft-search" onSubmit={submit}>
            <Search size={14} aria-hidden />
            <label className="sr-only" htmlFor="aircraft-search">
              Search aircraft by callsign or ICAO24
            </label>
            <input
              id="aircraft-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value.toUpperCase());
                setSearchMessage("");
              }}
              placeholder="Callsign or ICAO24"
              maxLength={12}
              autoComplete="off"
            />
            <button type="submit" disabled={searching || !query.trim()}>
              {searching ? "…" : "Find"}
            </button>
          </form>

          {searchMessage && <p className="sw-aircraft-message">{searchMessage}</p>}
          {!searchMessage && error && <p className="sw-aircraft-message">{error}</p>}

          {query.trim() && results.length > 0 && (
            <div className="sw-aircraft-results" role="listbox" aria-label="Aircraft matches">
              {results.map((plane) => (
                <button
                  key={plane.id}
                  type="button"
                  role="option"
                  aria-selected={selectedId === plane.id}
                  className={selectedId === plane.id ? "is-selected" : undefined}
                  onClick={() => choose(plane)}
                >
                  <span>
                    <strong>{plane.callsign}</strong>
                    <small>
                      {plane.id.toUpperCase()} · {plane.originCountry || "Unknown origin"}
                    </small>
                  </span>
                  <span className="sw-aircraft-result-meta">
                    {plane.altitudeFt == null ? "ALT —" : `${plane.altitudeFt.toLocaleString()} ft`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected ? (
            <div className="sw-aircraft-telemetry">
              <div className="sw-aircraft-telemetry-head">
                <span>
                  <Plane size={14} />
                  <strong>{selected.callsign}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setMapView([selected.lat, selected.lng], 10)}
                  aria-label={`Center map on ${selected.callsign}`}
                  title="Center aircraft"
                >
                  <LocateFixed size={14} />
                </button>
              </div>
              <div className="sw-aircraft-stats">
                <span>
                  <small>ALTITUDE</small>
                  {selected.altitudeFt?.toLocaleString() ?? "—"} ft
                </span>
                <span>
                  <small>SPEED</small>
                  {selected.velocityKts ?? "—"} kts
                </span>
                <span>
                  <small>HEADING</small>
                  {selected.heading == null ? "—" : `${Math.round(selected.heading)}°`}
                </span>
              </div>
              <div className="sw-aircraft-insight">
                <Route size={13} />
                <span>{Math.max(0, (trails[selected.id]?.length ?? 1) - 1)} live trail segments</span>
              </div>
              {nearestThreat && (
                <div
                  className={`sw-aircraft-insight is-threat${
                    nearestThreat.distanceKm < 120 ? " is-close" : ""
                  }`}
                >
                  <ShieldAlert size={13} />
                  <span>
                    Nearest crisis: <strong>{nearestThreat.title}</strong> ·{" "}
                    {nearestThreat.distanceKm.toFixed(0)} km
                  </span>
                </div>
              )}
              {intercept && nearestThreat && (
                <div className={`sw-aircraft-intercept is-${intercept.status}`}>
                  <Navigation size={13} />
                  <span>
                    Intercept vector <strong>{intercept.status}</strong>
                    {` · brg ${intercept.bearingDeg}°`}
                    {intercept.etaMinutes != null && (
                      <>
                        {" · "}
                        <Timer size={11} className="sw-aircraft-inline-icon" /> ETA ~
                        {intercept.etaMinutes}m
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="sw-aircraft-hint">
              Search or tap an aircraft to start a live trail, intercept vector, and crisis-proximity
              scan.
            </p>
          )}

          <div className="sw-aircraft-source">
            <span>OpenSky Network</span>
            {fetchedAt && (
              <span>
                updated <RelativeTime ts={fetchedAt} />
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
