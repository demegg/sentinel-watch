import { useSWStore } from "@/store/sw-store";
import type { LocationPin } from "@/lib/data";

export async function loadRegionalFeeds(place: LocationPin) {
  const { setFeedsLoading, setFeeds, setPanel } = useSWStore.getState();
  setFeedsLoading(true);
  setPanel("feeds");

  const url =
    `/api/feeds?lat=${place.lat}&lng=${place.lng}` +
    `&city=${encodeURIComponent(place.name)}` +
    (place.country ? `&country=${encodeURIComponent(place.country)}` : "") +
    (place.countryCode ? `&countryCode=${place.countryCode}` : "") +
    `&radius=55`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      setFeeds([], []);
      return { cameras: 0, radios: 0 };
    }

    const data = await res.json();
    const cams = data.cameras ?? [];
    const radios = data.radios ?? [];
    setFeeds(cams, radios);
    return { cameras: cams.length, radios: radios.length };
  } catch {
    setFeeds([], []);
    return { cameras: 0, radios: 0 };
  }
}
