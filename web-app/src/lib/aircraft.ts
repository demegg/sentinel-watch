export type PlaneState = {
  id: string;
  callsign: string;
  lat: number;
  lng: number;
  altitudeFt: number | null;
  velocityKts: number | null;
  heading: number | null;
  onGround: boolean;
  originCountry: string;
};

export type AircraftTrackPoint = {
  lat: number;
  lng: number;
  timestamp: number;
};

export type InterceptInsight = {
  bearingDeg: number;
  headingDelta: number;
  closing: boolean;
  status: "closing" | "flanking" | "departing";
  etaMinutes: number | null;
};

export function normalizeAircraftQuery(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function aircraftMatches(plane: PlaneState, query: string): boolean {
  const q = normalizeAircraftQuery(query);
  if (!q) return true;
  return plane.callsign.replace(/\s/g, "").toUpperCase().includes(q) || plane.id.toUpperCase().includes(q);
}

/** Initial bearing from A → B in degrees [0, 360). */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest signed angle difference in degrees (−180, 180]. */
export function headingDelta(fromDeg: number, toDeg: number): number {
  const raw = ((toDeg - fromDeg + 540) % 360) - 180;
  return raw;
}

/** Project a point along a true heading by distanceKm. */
export function projectCourse(
  lat: number,
  lng: number,
  heading: number,
  distanceKm: number
): { lat: number; lng: number } {
  const R = 6371;
  const δ = distanceKm / R;
  const θ = (heading * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
  return { lat: (φ2 * 180) / Math.PI, lng: ((((λ2 * 180) / Math.PI + 540) % 360) - 180) };
}

/**
 * Intercept Vector — are we closing on a crisis at current ground track?
 * Unique crisis×aviation fusion: ETA if heading within ±45° of bearing to event.
 */
export function interceptInsight(
  plane: Pick<PlaneState, "lat" | "lng" | "heading" | "velocityKts" | "onGround">,
  crisisLat: number,
  crisisLng: number,
  distanceKm: number
): InterceptInsight {
  const bearing = bearingDeg(plane.lat, plane.lng, crisisLat, crisisLng);
  const heading = plane.heading ?? bearing;
  const delta = Math.abs(headingDelta(heading, bearing));
  const closing = delta <= 45;
  const flanking = !closing && delta <= 110;
  const status: InterceptInsight["status"] = closing ? "closing" : flanking ? "flanking" : "departing";

  let etaMinutes: number | null = null;
  if (closing && !plane.onGround && plane.velocityKts && plane.velocityKts > 40 && distanceKm > 2) {
    const speedKmh = plane.velocityKts * 1.852;
    const closingSpeed = speedKmh * Math.cos((delta * Math.PI) / 180);
    if (closingSpeed > 20) etaMinutes = Math.round((distanceKm / closingSpeed) * 60);
  }

  return { bearingDeg: Math.round(bearing), headingDelta: Math.round(delta), closing, status, etaMinutes };
}
