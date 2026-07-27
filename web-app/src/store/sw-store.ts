import { create } from "zustand";
import type { LocationPin, RegionalEvent, PublicCamera, RadioStation } from "@/lib/data";

export type OverlayKey = "temp" | "precip" | "wind" | "none";
export type ViewMode = "map" | "earth";

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
  setEvents: (e: RegionalEvent[]) => void;
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

  panel: "events" | "feeds" | "terminal" | null;
  setPanel: (p: "events" | "feeds" | "terminal" | null) => void;

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

  overlay: OverlayKey;
  setOverlay: (o: OverlayKey) => void;

  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  earthZoom: number;
  setEarthZoom: (z: number) => void;

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
  setEvents: (e) => set({ events: e, eventsLoading: false }),
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

  panel: "events",
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

  overlay: "none",
  setOverlay: (o) => set({ overlay: o }),

  viewMode: "map",
  setViewMode: (m) => set({ viewMode: m }),
  earthZoom: 12,
  setEarthZoom: (z) => set({ earthZoom: Math.min(21, Math.max(3, z)) }),

  climatePoints: [],
  setClimatePoints: (p) => set({ climatePoints: p }),

  radarPath: null,
  setRadarPath: (p) => set({ radarPath: p }),

  hazard: null,
  hazardLoading: false,
  setHazard: (h) => set({ hazard: h, hazardLoading: false }),
  setHazardLoading: (v) => set({ hazardLoading: v }),
}));
