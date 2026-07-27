import { isMostlyLatin, toEnglishLabel } from "@/lib/english-text";

export interface ResolvedPlace {
  name: string;
  country: string;
  countryCode?: string;
  region?: string;
}

const NOMINATIM_HEADERS = {
  "User-Agent": "SentinelWatch/1.0",
  Accept: "application/json",
  "Accept-Language": "en",
};

async function nominatimReverse(lat: number, lng: number) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?` +
    `lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`;
  const res = await fetch(url, {
    headers: NOMINATIM_HEADERS,
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.address ?? {};
  return {
    name:
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.county ||
      a.state ||
      data.name ||
      "",
    country: a.country ?? "",
    countryCode: (a.country_code as string | undefined)?.toUpperCase(),
    region: a.state || a.region || a.province || "",
  };
}

/** Resolve coordinates to English place labels for all UI surfaces. */
export async function resolvePlaceEnglish(lat: number, lng: number): Promise<ResolvedPlace> {
  const fallback: ResolvedPlace = {
    name: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    country: "",
  };

  try {
    const nom = await nominatimReverse(lat, lng);
    if (!nom) return fallback;

    let name = toEnglishLabel(nom.name);
    let country = toEnglishLabel(nom.country);
    const region = toEnglishLabel(nom.region);

    if (!isMostlyLatin(name)) {
      name = fallback.name;
    }
    if (!isMostlyLatin(country)) {
      country = "";
    }

    return {
      name: name || fallback.name,
      country,
      countryCode: nom.countryCode,
      region: region || undefined,
    };
  } catch {
    return fallback;
  }
}
