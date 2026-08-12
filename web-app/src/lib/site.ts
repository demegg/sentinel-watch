/** Canonical public site URL for SEO, sitemap, and absolute metadata. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://sentinel-watch-gamma.vercel.app";

export const SITE_NAME = "Sentinel Watch";

export const SITE_TAGLINE = "Eyes everywhere. Always watching.";

export const SITE_DESCRIPTION =
  "Sentinel Watch is a real-time global crisis monitor — earthquakes, wildfires, storms, conflicts, live cameras, aircraft tracking, and radio on one live command-center map.";

export const SITE_KEYWORDS = [
  "Sentinel Watch",
  "SentinelWatch",
  "crisis monitor",
  "global crisis monitoring",
  "earthquake map",
  "wildfire tracker",
  "live crisis map",
  "disaster monitoring",
  "conflict monitor",
  "live cams",
  "aircraft tracking",
  "SkyTrace",
];
