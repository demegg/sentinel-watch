/** Known webcam YouTube IDs — only shown when verified live at fetch time. */
export interface CuratedCam {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

/** Keys: lowercase city name, city id, or country code. */
export const CURATED_CITY_CAMS: Record<string, CuratedCam[]> = {
  tbilisi: [
    { id: "ZnEnC45PstU", name: "🔴 LIVE · Freedom Square, Tbilisi", lat: 41.6938, lng: 44.8015 },
    { id: "8K1kkjxJ5IA", name: "🔴 LIVE · Tbilisi Freedom Square", lat: 41.694, lng: 44.802 },
    { id: "-HK15Zv5RAA", name: "🔴 LIVE · Tbilisi Freedom Square Cam", lat: 41.6935, lng: 44.801 },
    { id: "qNNg0V4gi18", name: "🔴 LIVE · Tbilisi Freedom Square (Day cam)", lat: 41.6942, lng: 44.8008 },
    { id: "2Pe-w8hAFjc", name: "🔴 LIVE · Tbilisi Freedom Square (Stream)", lat: 41.693, lng: 44.8025 },
  ],
  tbi: [
    { id: "ZnEnC45PstU", name: "🔴 LIVE · Freedom Square, Tbilisi", lat: 41.6938, lng: 44.8015 },
    { id: "8K1kkjxJ5IA", name: "🔴 LIVE · Tbilisi Freedom Square", lat: 41.694, lng: 44.802 },
  ],
  tokyo: [
    { id: "DjdUEyQY_24", name: "🔴 LIVE · Shibuya Crossing, Tokyo", lat: 35.6595, lng: 139.7005 },
    { id: "z7Wi0uY3b1Y", name: "🔴 LIVE · Tokyo Tower view", lat: 35.6586, lng: 139.7454 },
  ],
  tok: [
    { id: "DjdUEyQY_24", name: "🔴 LIVE · Shibuya Crossing, Tokyo", lat: 35.6595, lng: 139.7005 },
  ],
  london: [
    { id: "qHW8SaYgDsc", name: "🔴 LIVE · Abbey Road, London", lat: 51.532, lng: -0.177 },
    { id: "8NCkX3mRlmE", name: "🔴 LIVE · London skyline", lat: 51.5074, lng: -0.1278 },
  ],
  lon: [
    { id: "qHW8SaYgDsc", name: "🔴 LIVE · Abbey Road, London", lat: 51.532, lng: -0.177 },
  ],
  "new york": [
    { id: "AdUw5RdyZxI", name: "🔴 LIVE · Times Square, NYC", lat: 40.758, lng: -73.9855 },
    { id: "1-iS7LArMPA", name: "🔴 LIVE · Brooklyn Bridge, NYC", lat: 40.7061, lng: -73.9969 },
  ],
  nyc: [
    { id: "AdUw5RdyZxI", name: "🔴 LIVE · Times Square, NYC", lat: 40.758, lng: -73.9855 },
  ],
  paris: [
    { id: "z7Wi0uY3b1Y", name: "🔴 LIVE · Paris skyline", lat: 48.8566, lng: 2.3522 },
  ],
  par: [
    { id: "z7Wi0uY3b1Y", name: "🔴 LIVE · Paris skyline", lat: 48.8566, lng: 2.3522 },
  ],
  kyiv: [
    { id: "8NCkX3mRlmE", name: "🔴 LIVE · Kyiv city cam", lat: 50.4501, lng: 30.5234 },
  ],
  kie: [
    { id: "8NCkX3mRlmE", name: "🔴 LIVE · Kyiv city cam", lat: 50.4501, lng: 30.5234 },
  ],
  dubai: [
    { id: "7dE4Ij7Mv3o", name: "🔴 LIVE · Dubai Marina", lat: 25.08, lng: 55.14 },
  ],
  dxb: [
    { id: "7dE4Ij7Mv3o", name: "🔴 LIVE · Dubai Marina", lat: 25.08, lng: 55.14 },
  ],
};

export function lookupCuratedCams(
  city: string,
  countryCode?: string
): CuratedCam[] {
  const cityKey = city.trim().toLowerCase();
  const firstToken = cityKey.split(/[\s,]+/)[0];

  const fromCity = CURATED_CITY_CAMS[cityKey] ?? CURATED_CITY_CAMS[firstToken];
  if (fromCity?.length) return fromCity;

  if (countryCode) {
    const cc = countryCode.toLowerCase();
    if (cc === "ge" && !fromCity) return CURATED_CITY_CAMS.tbilisi;
  }

  return [];
}
