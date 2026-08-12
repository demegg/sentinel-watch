import { create } from "zustand";
import type { LocationPin, RegionalEvent, PublicCamera, RadioStation } from "@/lib/data";
import type { PlaneState, AircraftTrackPoint } from "@/lib/aircraft";

export type OverlayKey = "temp" | "precip" | "wind" | "none";

/** Multi-select intel layers — independent from climate overlay. */
export type LiveLayerKey =
  | "planes"
  | "combat"
  | "storms"
  | "fires"
  | "quakes"
  | "space";

export const DEFAULT_LIVE_LAYERS: Record<LiveLayerKey, boolean> = {
  planes: false,
  combat: false,
  storms: false,
  fires: false,
  quakes: false,
  space: false,
};

export interface HazardReport {
  lat: number;
  lng: number;
  placeName: string;
  country: string;
  countryCode?: string;
  region?: string;
  summary: string;
  hazards: {
    id: string;
    category: "wildlife" | "venom" | "crime" | "conflict" | "terror" | "health" | "weather" | "transport" | "cultural" | "other";
    level: "low" | "moderate" | "high" | "critical";
    title: string;
    detail: string;
    avoid?: boolean;
  }[];
  nearbyEvents: RegionalEvent[];
  fetchedAt: number;
}

interface TerminalLine {
  type: "in" | "out";
  text: string;
}

interface SWStore {
  focus: LocationPin | null;
  setFocus: (p: LocationPin | null) => void;

  events: RegionalEvent[];
  eventsLoading: boolean;
  eventsFetchedAt: number | null;
  eventsSources: string[];
  setEvents: (e: RegionalEvent[], meta?: { fetchedAt?: number; sources?: string[] }) => void;
  setEventsLoading: (v: boolean) => void;

  cameras: PublicCamera[];
  radios: RadioStation[];
  feedsLoading: boolean;
  setFeeds: (c: PublicCamera[], r: RadioStation[]) => void;
  setFeedsLoading: (v: boolean) => void;

  activeCamera: PublicCamera | null;
  setActiveCamera: (c: PublicCamera | null) => void;
  activeRadio: RadioStation | null;
  setActiveRadio: (r: RadioStation | null) => void;

  selectedEvent: RegionalEvent | null;
  setSelectedEvent: (e: RegionalEvent | null) => void;

  panel: "events" | "feeds" | "terminal" | "places" | "alerts" | null;
  setPanel: (p: "events" | "feeds" | "terminal" | "places" | "alerts" | null) => void;

  terminalHistory: TerminalLine[];
  pushTerminal: (l: TerminalLine) => void;
  clearTerminal: () => void;

  /** Forces map to fly; bump flyId to re-trigger same coords */
  mapCenter: [number, number];
  mapZoom: number;
  flyId: number;
  setMapView: (center: [number, number], zoom: number) => void;

  /** After search: fit map to city + nearby crisis markers */
  fitRegionId: number;
  requestFitRegion: () => void;

  mapScope: "global" | "regional";
  setMapScope: (scope: "global" | "regional") => void;

  overlay: OverlayKey;
  setOverlay: (o: OverlayKey) => void;

  liveLayers: Record<LiveLayerKey, boolean>;
  toggleLiveLayer: (key: LiveLayerKey) => void;
  setLiveLayer: (key: LiveLayerKey, on: boolean) => void;

  aircraft: PlaneState[];
  aircraftFetchedAt: number | null;
  aircraftError: string | null;
  selectedAircraftId: string | null;
  aircraftTrails: Record<string, AircraftTrackPoint[]>;
  setAircraft: (planes: PlaneState[], fetchedAt?: number, error?: string | null) => void;
  selectAircraft: (id: string | null) => void;

  climatePoints: {
    lat: number;
    lng: number;
    temp: number;
    wind: number;
    windDir: number;
    bounds: [[number, number], [number, number]];
  }[];
  setClimatePoints: (p: SWStore["climatePoints"]) => void;

  radarPath: string | null;
  setRadarPath: (p: string | null) => void;

  hazard: HazardReport | null;
  hazardLoading: boolean;
  setHazard: (h: HazardReport | null) => void;
  setHazardLoading: (v: boolean) => void;
}

export const useSWStore = create<SWStore>((set) => ({
  focus: null,
  setFocus: (p) => set({ focus: p }),

  events: [],
  eventsLoading: false,
  eventsFetchedAt: null,
  eventsSources: [],
  setEvents: (e, meta) =>
    set({
      events: e,
      eventsLoading: false,
      eventsFetchedAt: meta?.fetchedAt ?? Date.now(),
      eventsSources: meta?.sources ?? [],
    }),
  setEventsLoading: (v) => set({ eventsLoading: v }),

  cameras: [],
  radios: [],
  feedsLoading: false,
  setFeeds: (c, r) => set({ cameras: c, radios: r, feedsLoading: false }),
  setFeedsLoading: (v) => set({ feedsLoading: v }),

  activeCamera: null,
  setActiveCamera: (c) => set({ activeCamera: c }),
  activeRadio: null,
  setActiveRadio: (r) => set({ activeRadio: r }),

  selectedEvent: null,
  setSelectedEvent: (e) => set({ selectedEvent: e }),

  panel: "places",
  setPanel: (p) => set({ panel: p }),

  terminalHistory: [
    { type: "out", text: "SentinelWatch online. Type 'help' for commands." },
  ],
  pushTerminal: (l) =>
    set((s) => ({ terminalHistory: [...s.terminalHistory.slice(-120), l] })),
  clearTerminal: () => set({ terminalHistory: [] }),

  mapCenter: [20, 0],
  mapZoom: 2,
  flyId: 0,
  setMapView: (center, zoom) =>
    set((s) => ({ mapCenter: center, mapZoom: zoom, flyId: s.flyId + 1 })),

  fitRegionId: 0,
  requestFitRegion: () => set((s) => ({ fitRegionId: s.fitRegionId + 1 })),

  mapScope: "global",
  setMapScope: (scope) => set({ mapScope: scope }),

  overlay: "none",
  setOverlay: (o) => set({ overlay: o }),

  liveLayers: { ...DEFAULT_LIVE_LAYERS },
  toggleLiveLayer: (key) =>
    set((s) => ({ liveLayers: { ...s.liveLayers, [key]: !s.liveLayers[key] } })),
  setLiveLayer: (key, on) =>
    set((s) => ({ liveLayers: { ...s.liveLayers, [key]: on } })),

  aircraft: [],
  aircraftFetchedAt: null,
  aircraftError: null,
  selectedAircraftId: null,
  aircraftTrails: {},
  setAircraft: (planes, fetchedAt = Date.now(), error = null) =>
    set((s) => {
      const trails = { ...s.aircraftTrails };
      for (const plane of planes) {
        const previous = trails[plane.id] ?? [];
        const last = previous[previous.length - 1];
        const moved = !last || Math.abs(last.lat - plane.lat) > 0.002 || Math.abs(last.lng - plane.lng) > 0.002;
        if (moved) {
          trails[plane.id] = [
            ...previous.slice(-11),
            { lat: plane.lat, lng: plane.lng, timestamp: fetchedAt },
          ];
        }
      }
      const visibleIds = new Set(planes.map((p) => p.id));
      for (const id of Object.keys(trails)) {
        if (!visibleIds.has(id) && id !== s.selectedAircraftId) delete trails[id];
      }
      return { aircraft: planes, aircraftFetchedAt: fetchedAt, aircraftError: error, aircraftTrails: trails };
    }),
  selectAircraft: (id) => set({ selectedAircraftId: id }),

  climatePoints: [],
  setClimatePoints: (p) => set({ climatePoints: p }),

  radarPath: null,
  setRadarPath: (p) => set({ radarPath: p }),

  hazard: null,
  hazardLoading: false,
  setHazard: (h) => set({ hazard: h, hazardLoading: false }),
  setHazardLoading: (v) => set({ hazardLoading: v }),
}));
