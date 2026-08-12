import { haversineKm } from "@/lib/data";
import type { PublicCamera } from "@/lib/data";
import { lookupCuratedCams } from "@/lib/city-cams";
import {
  hostnameEquals,
  isSafeDailymotionEmbed,
  isSafeYoutubeId,
  safeThumbnailUrl,
} from "@/lib/security";

const PIPED_BASES = [
  "https://api.piped.private.coffee",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.kavin.rocks",
];

const INVIDIOUS_BASES = [
  "https://invidious.fdn.fr",
  "https://vid.puffyan.us",
  "https://inv.nadeko.net",
];

const GLOBAL_CAM_BLOCKLIST = [
  "earthtv",
  "the world live",
  "world live streams",
  "earth cam live",
  "live cams hd",
  "port cam",
  "sari-sari",
  "tyre repair",
];

const PRERECORDED_TITLE = [
  /walking tour/i,
  /walk tour/i,
  /time[- ]?lapse/i,
  /\bvlog\b/i,
  /don'ts in/i,
  /travel tips/i,
  /highlights/i,
  /compilation/i,
  /night walk/i,
  /street food/i,
  /drone video/i,
  /8k hdr/i,
  /\bdigest\b/i,
  /bus rides/i,
  /tour travel guide/i,
  /exploring the/i,
  /day \d+/i,
  /4k walking/i,
  /helmet cam/i,
  /worldwide webcam/i,
  /random cams/i,
  /webcams tour/i,
  /live chat/i,
  /first person journey/i,
];

const LIVE_EMBED_HOSTS = [
  { host: "ipcamlive.com", label: "IPCamLive" },
  { host: "skylinewebcams.com", label: "SkylineWebcams" },
  { host: "webcamtaxi.com", label: "WebcamTaxi" },
  { host: "earthcam.com", label: "EarthCam" },
  { host: "feratel.com", label: "Feratel" },
  { host: "worldcam.eu", label: "WorldCam" },
  { host: "camstreamer.com", label: "CamStreamer" },
  { host: "webcamhopper.com", label: "WebcamHopper" },
];

const UA = "SentinelWatch/1.0 (live camera discovery)";

export function offsetAround(lat: number, lng: number, index: number, total: number) {
  const radiusDeg = 0.025 + (index % 5) * 0.008;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  return {
    lat: lat + Math.cos(angle) * radiusDeg,
    lng: lng + Math.sin(angle) * radiusDeg * 1.25,
  };
}

function classifyStream(url: string): PublicCamera["kind"] {
  if (isSafeYoutubeId(url)) return "youtube";
  if (
    hostnameEquals(url, ["youtube.com", "youtube-nocookie.com", "youtu.be"]) ||
    Boolean(extractYoutubeId(url))
  ) {
    return "youtube";
  }
  if (isSafeDailymotionEmbed(url) || hostnameEquals(url, ["dailymotion.com"])) {
    return isSafeDailymotionEmbed(url) ? "dailymotion" : "page";
  }
  const u = url.toLowerCase();
  if (u.includes(".m3u8")) return "hls";
  if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u) || /\/mjpe?g/i.test(u)) return "image";
  return "page";
}

function extractYoutubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/^([\w-]{11})$/);
  return m?.[1] ?? null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleMatchesRegion(title: string, city: string, country?: string) {
  const t = title.toLowerCase();
  const cityToken = city.trim().toLowerCase().split(/[\s,]+/)[0];

  if (cityToken === "london" && /new london,\s*ct|new london connecticut/i.test(title)) {
    return false;
  }
  if (country && /^(uk|united kingdom|england|great britain)$/i.test(country.trim())) {
    if (/,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/i.test(title)) {
      return false;
    }
  }

  if (cityToken.length >= 3 && new RegExp(`\\b${escapeRegex(cityToken)}\\b`, "i").test(title)) {
    return true;
  }
  const countryToken = country?.trim().toLowerCase();
  if (countryToken && countryToken.length >= 4 && t.includes(countryToken)) {
    if (cityToken.length >= 4 && !t.includes(cityToken)) {
      if (GLOBAL_CAM_BLOCKLIST.some((b) => t.includes(b))) return false;
    }
    return /live|webcam|camera|cam|stream|square|skyline|panorama/i.test(title);
  }
  return false;
}

function isPrerecordedTitle(title: string) {
  return PRERECORDED_TITLE.some((r) => r.test(title));
}

function isWebcamTitle(title: string) {
  return /webcam|live cam|live camera|live stream|24\/7|skyline|panorama|traffic cam|city cam|freedom square|old town|beach cam|earthcam|abbey road|times square/i.test(
    title
  );
}

function isBlockedGlobalCam(title: string, city: string) {
  const t = title.toLowerCase();
  const cityToken = city.trim().toLowerCase().split(/[\s,]+/)[0];
  if (!GLOBAL_CAM_BLOCKLIST.some((b) => t.includes(b))) return false;
  return cityToken.length < 3 || !t.includes(cityToken);
}

function liveCameraBase(
  partial: Omit<PublicCamera, "isLive" | "liveVerified"> & { isLive?: boolean; liveVerified?: boolean }
): PublicCamera {
  return {
    ...partial,
    isLive: partial.isLive ?? true,
    liveVerified: partial.liveVerified ?? true,
  };
}

/** YouTube watch page exposes isLiveNow when a broadcast is actually on air. */
export async function verifyYoutubeIsLiveNow(videoId: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 15000) return null;
    if (/"isLiveNow"\s*:\s*true/.test(html)) return true;
    if (/"isLiveNow"\s*:\s*false/.test(html)) return false;
    return null;
  } catch {
    return null;
  }
}

async function verifyYoutubeCandidate(id: string, pipedLive: boolean): Promise<boolean> {
  if (pipedLive) return true;
  const scraped = await verifyYoutubeIsLiveNow(id);
  if (scraped === true) return true;
  if (scraped === false) return false;
  return false;
}

async function verifyYoutubeBatch(candidates: YtCandidate[], limit = 16): Promise<Set<string>> {
  const live = new Set<string>();
  const slice = candidates.slice(0, limit);
  const results = await Promise.allSettled(
    slice.map((c) => verifyYoutubeCandidate(c.id, c.pipedLive))
  );
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) live.add(slice[i].id);
  });
  return live;
}

type PipedItem = { title?: string; url?: string; duration?: number; thumbnail?: string };

async function searchPiped(base: string, q: string): Promise<PipedItem[]> {
  const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = (data.items ?? data) as PipedItem[];
  return Array.isArray(items) ? items : [];
}

async function searchInvidious(
  base: string,
  q: string
): Promise<Array<{ title?: string; videoId?: string; liveNow?: boolean; lengthSeconds?: number }>> {
  const res = await fetch(
    `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&sort_by=view_count`,
    { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000), cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function buildSearchQueries(city: string, country?: string) {
  const region = country ? `${city} ${country}` : city;
  return [
    `${region} live webcam`,
    `${city} live camera 24/7`,
    `${city} live stream webcam`,
    `${city} skyline live cam`,
    `${city} traffic camera live`,
    `${city} square live webcam`,
    `${city} beach cam live`,
    `live webcam ${city}`,
    `${city} earthcam live`,
    `${city} ipcamlive`,
    `${city} skylinewebcams`,
    `${city} webcamtaxi`,
    `${city} feratel webcam`,
  ];
}

function embedHostFromUrl(url: string): (typeof LIVE_EMBED_HOSTS)[number] | null {
  const lower = url.toLowerCase();
  return LIVE_EMBED_HOSTS.find((h) => lower.includes(h.host)) ?? null;
}

function pushEmbedCam(
  url: string,
  title: string,
  city: string,
  country: string | undefined,
  lat: number,
  lng: number,
  found: PublicCamera[],
  seen: Set<string>
) {
  if (!url.startsWith("http") || seen.has(url)) return;
  const host = embedHostFromUrl(url);
  if (!host) return;
  if (!titleMatchesRegion(title || url, city, country) && !titleMatchesRegion(url, city, country)) return;
  seen.add(url);
  const pos = offsetAround(lat, lng, found.length, 20);
  found.push(
    liveCameraBase({
      id: `embed-${host.host}-${found.length}`,
      name: title?.trim() ? `🔴 LIVE · ${title.slice(0, 72)}` : `🔴 LIVE · ${host.label} · ${city}`,
      lat: pos.lat,
      lng: pos.lng,
      exact: false,
      source: "embed",
      streamUrl: url,
      kind: "page",
      distanceKm: Math.round(haversineKm(lat, lng, pos.lat, pos.lng) * 10) / 10,
    })
  );
}

export async function fetchOsmCameras(lat: number, lng: number, radiusM: number): Promise<PublicCamera[]> {
  const query = `
    [out:json][timeout:35];
    (
      nwr(around:${radiusM},${lat},${lng})["contact:webcam"];
      nwr(around:${radiusM},${lat},${lng})["tourism"="webcam"];
      nwr(around:${radiusM},${lat},${lng})["url:m3u8"];
      nwr(around:${radiusM},${lat},${lng})["url:stream"];
      nwr(around:${radiusM},${lat},${lng})["webcam"];
      nwr(around:${radiusM},${lat},${lng})["camera:type"="webcam"];
    );
    out center tags 60;
  `;

  for (const endpoint of [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = await res.json();
      const cams: PublicCamera[] = [];

      for (const e of (data.elements ?? []) as Array<{
        id: number;
        type: string;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>) {
        const tags = e.tags ?? {};
        const stream =
          tags["url:m3u8"] ||
          tags["url:stream"] ||
          tags["contact:webcam"] ||
          tags.webcam ||
          tags.url ||
          tags.image;
        if (!stream || !/^https?:\/\//i.test(stream)) continue;

        const cLat = e.lat ?? e.center?.lat;
        const cLng = e.lon ?? e.center?.lon;
        if (cLat == null || cLng == null) continue;

        const kind = classifyStream(stream);
        if (kind === "youtube") continue;
        if (kind === "page") {
          const liveHint =
            tags["camera:stream"] === "live" ||
            /ipcamlive|mjpg|mjpeg|\/stream|live\.|webcam|windy\.com/i.test(stream);
          if (!liveHint) continue;
        }

        cams.push(
          liveCameraBase({
            id: `osm-${e.type}-${e.id}`,
            name: tags.name || tags.operator || "Live webcam",
            lat: cLat,
            lng: cLng,
            exact: true,
            source: "osm",
            streamUrl: stream,
            kind,
            distanceKm: Math.round(haversineKm(lat, lng, cLat, cLng) * 10) / 10,
          })
        );
      }
      return cams.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 40);
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchWindyCameras(lat: number, lng: number, radiusKm: number): Promise<PublicCamera[]> {
  const apiKey = process.env.WINDY_WEBCAM_API_KEY?.trim();
  if (!apiKey) return [];

  const radius = Math.min(80, Math.max(10, Math.round(radiusKm)));
  const params = new URLSearchParams({
    nearby: `${lat},${lng},${radius}`,
    limit: "24",
    include: "images,player,location",
    lang: "en",
  });
  const url = `https://api.windy.com/webcams/api/v3/webcams?${params}`;

  try {
    const res = await fetch(url, {
      headers: { "x-windy-api-key": apiKey, "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    const webcams = (data.webcams ?? data.result?.webcams ?? []) as Array<{
      webcamId?: number;
      title?: string;
      player?: { live?: string; day?: string };
      images?: { current?: { preview?: string; icon?: string } };
      location?: { latitude?: number; longitude?: number; city?: string };
    }>;

    return webcams
      .map((w, i) => {
        const embed = w.player?.live || w.player?.day;
        const cLat = w.location?.latitude;
        const cLng = w.location?.longitude;
        if (!embed || cLat == null || cLng == null) return null;
        const thumb = w.images?.current?.preview ?? w.images?.current?.icon;
        return liveCameraBase({
          id: `windy-${w.webcamId ?? i}`,
          name: `🔴 LIVE · ${w.title ?? w.location?.city ?? "Webcam"}`,
          lat: cLat,
          lng: cLng,
          exact: true,
          source: "windy",
          streamUrl: embed,
          kind: "page",
          distanceKm: Math.round(haversineKm(lat, lng, cLat, cLng) * 10) / 10,
          thumbnail: safeThumbnailUrl(thumb) ?? undefined,
        });
      })
      .filter((c): c is PublicCamera => c != null);
  } catch {
    return [];
  }
}

async function fetchDailymotionLive(city: string, country?: string): Promise<PublicCamera[]> {
  const q = `${city} ${country ?? ""} webcam`.trim();
  try {
    const res = await fetch(
      `https://api.dailymotion.com/videos?filters=live&search=${encodeURIComponent(q)}&limit=12&fields=id,title,live_status,embed_url`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000), cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = (data.list ?? []) as Array<{
      id: string;
      title?: string;
      live_status?: string;
      embed_url?: string;
    }>;

    return list
      .filter((v) => v.live_status === "onair" && v.id && titleMatchesRegion(v.title ?? "", city, country))
      .map((v, i) =>
        liveCameraBase({
          id: `dm-${v.id}`,
          name: `🔴 LIVE · ${(v.title ?? "Dailymotion stream").slice(0, 72)}`,
          lat: 0,
          lng: 0,
          exact: false,
          source: "dailymotion",
          streamUrl: isSafeDailymotionEmbed(v.embed_url)
            ? v.embed_url!
            : `https://www.dailymotion.com/embed/video/${encodeURIComponent(v.id)}`,
          kind: "dailymotion",
          distanceKm: i,
        })
      )
      .filter((cam) => isSafeDailymotionEmbed(cam.streamUrl));
  } catch {
    return [];
  }
}

type YtCandidate = { id: string; title: string; thumbnail?: string; pipedLive: boolean };

function collectYoutubeCandidates(
  items: PipedItem[],
  city: string,
  country: string | undefined,
  candidates: Map<string, YtCandidate>
) {
  for (const item of items) {
    const title = item.title ?? "";
    const url = item.url ?? "";
    const id = extractYoutubeId(url);

    if (id) {
      if (item.duration !== -1) continue;
      if (!titleMatchesRegion(title, city, country)) continue;
      if (isPrerecordedTitle(title)) continue;
      if (isBlockedGlobalCam(title, city)) continue;
      if (!isWebcamTitle(title) && !/live/i.test(title)) continue;
      if (/live @|dj set|groovejet|festival set|club night/i.test(title) && !/square|webcam|skyline|camera/i.test(title)) {
        continue;
      }
      if (!candidates.has(id)) {
        candidates.set(id, {
          id,
          title,
          thumbnail: safeThumbnailUrl(item.thumbnail) ?? undefined,
          pipedLive: true,
        });
      }
      continue;
    }

    if (url.startsWith("http") && embedHostFromUrl(url)) {
      // handled separately via embed collector
    }
  }
}

function collectEmbedFromItems(
  items: PipedItem[],
  city: string,
  country: string | undefined,
  found: PublicCamera[],
  seen: Set<string>
) {
  for (const item of items) {
    const url = item.url ?? "";
    const title = item.title ?? "";
    if (!url.startsWith("http")) continue;
    if (extractYoutubeId(url)) continue;
    pushEmbedCam(url, title, city, country, 0, 0, found, seen);
  }
}

export async function discoverLiveCameras(
  city: string,
  country: string | undefined,
  countryCode: string | undefined,
  lat: number,
  lng: number,
  radiusKm: number
): Promise<{ cameras: PublicCamera[]; sources: Record<string, number> }> {
  const queries = buildSearchQueries(city, country);
  const ytCandidates = new Map<string, YtCandidate>();
  const embedScratch: PublicCamera[] = [];
  const embedSeen = new Set<string>();

  const pipedSearches = await Promise.allSettled(
    PIPED_BASES.flatMap((base) => queries.map((q) => searchPiped(base, q)))
  );
  for (const batch of pipedSearches) {
    if (batch.status !== "fulfilled") continue;
    collectYoutubeCandidates(batch.value, city, country, ytCandidates);
    collectEmbedFromItems(batch.value, city, country, embedScratch, embedSeen);
  }

  if (ytCandidates.size < 4) {
    for (const base of INVIDIOUS_BASES) {
      try {
        const items = await searchInvidious(base, queries[0]);
        for (const it of items) {
          if (!it.liveNow || !it.videoId) continue;
          const title = it.title ?? "";
          if (!titleMatchesRegion(title, city, country)) continue;
          if (isPrerecordedTitle(title) || isBlockedGlobalCam(title, city)) continue;
          if (!ytCandidates.has(it.videoId)) {
            ytCandidates.set(it.videoId, { id: it.videoId, title, pipedLive: true });
          }
        }
      } catch {
        /* next instance */
      }
    }
  }

  const curated = lookupCuratedCams(city, countryCode);
  const curatedById = new Map(curated.map((c) => [c.id, c]));
  for (const cam of curated) {
    if (ytCandidates.has(cam.id)) continue;
    ytCandidates.set(cam.id, {
      id: cam.id,
      title: cam.name,
      thumbnail: `https://i.ytimg.com/vi/${cam.id}/hqdefault.jpg`,
      pipedLive: false,
    });
  }

  const candidateList = [...ytCandidates.values()];
  const verifiedLive = await verifyYoutubeBatch(candidateList, 16);

  const youtubeCams: PublicCamera[] = [];
  let idx = 0;
  for (const meta of candidateList) {
    const id = meta.id;
    if (!verifiedLive.has(id)) continue;
    const curatedMeta = curatedById.get(id);
    const cLat = curatedMeta?.lat ?? offsetAround(lat, lng, idx, 20).lat;
    const cLng = curatedMeta?.lng ?? offsetAround(lat, lng, idx, 20).lng;
    youtubeCams.push(
      liveCameraBase({
        id: curatedMeta ? `curated-${id}` : `yt-${id}`,
        name: meta.title.includes("LIVE") || meta.title.includes("🔴") ? meta.title.slice(0, 80) : `🔴 LIVE · ${meta.title.slice(0, 72)}`,
        lat: cLat,
        lng: cLng,
        exact: curatedMeta?.lat != null,
        source: "youtube",
        streamUrl: id,
        kind: "youtube",
        distanceKm: Math.round(haversineKm(lat, lng, cLat, cLng) * 10) / 10,
        thumbnail: safeThumbnailUrl(meta.thumbnail) ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        liveVerified: true,
      })
    );
    idx++;
  }

  const embedCams = embedScratch.map((cam, i) => {
    const pos = offsetAround(lat, lng, i, Math.max(embedScratch.length, 1));
    return liveCameraBase({
      ...cam,
      lat: pos.lat,
      lng: pos.lng,
      distanceKm: Math.round(haversineKm(lat, lng, pos.lat, pos.lng) * 10) / 10,
    });
  });

  const [osmCams, windyCams, dmCams] = await Promise.all([
    fetchOsmCameras(lat, lng, radiusKm * 1000),
    fetchWindyCameras(lat, lng, radiusKm),
    fetchDailymotionLive(city, country),
  ]);

  const dmWithCoords = dmCams.map((cam, i) => {
    const pos = offsetAround(lat, lng, i, Math.max(dmCams.length, 1));
    return liveCameraBase({
      ...cam,
      lat: pos.lat,
      lng: pos.lng,
      distanceKm: Math.round(haversineKm(lat, lng, pos.lat, pos.lng) * 10) / 10,
    });
  });

  const seenKeys = new Set<string>();
  const merged = [...osmCams, ...windyCams, ...youtubeCams, ...embedCams, ...dmWithCoords].filter((c) => {
    const key =
      c.kind === "youtube"
        ? `yt:${c.streamUrl}`
        : c.kind === "dailymotion"
          ? `dm:${c.streamUrl}`
          : c.id;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  merged.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (a.liveVerified !== b.liveVerified) return a.liveVerified ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });

  const sources = {
    osm: osmCams.length,
    windy: windyCams.length,
    youtube: youtubeCams.length,
    embed: embedCams.length,
    dailymotion: dmWithCoords.length,
    verified: merged.filter((c) => c.liveVerified).length,
  };

  return { cameras: merged.slice(0, 48), sources };
}
