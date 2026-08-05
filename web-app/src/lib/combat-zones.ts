/** Always-available conflict hotspots (open-source approx centers — not military intel). */
import { haversineKm } from "@/lib/data";

export type CuratedCombatZone = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  radiusKm: number;
  severity: "high" | "critical";
  summary: string;
  guidance: string[];
};

export const CURATED_COMBAT_ZONES: CuratedCombatZone[] = [
  {
    id: "cz-ua",
    title: "Ukraine conflict zone",
    lat: 48.5,
    lng: 37.5,
    radiusKm: 420,
    severity: "critical",
    summary:
      "Active large-scale armed conflict across eastern and southern Ukraine with air, drone, and artillery threats.",
    guidance: [
      "Avoid front-line and recently contested oblasts unless essential.",
      "Follow official air-raid alerts and know shelter locations.",
      "Expect infrastructure disruption, curfews, and travel restrictions.",
    ],
  },
  {
    id: "cz-gaza",
    title: "Gaza / Israel conflict zone",
    lat: 31.5,
    lng: 34.47,
    radiusKm: 90,
    severity: "critical",
    summary:
      "High-intensity conflict with rocket fire, airstrikes, and severe civilian risk in and around Gaza and southern Israel.",
    guidance: [
      "Non-essential travel is strongly discouraged.",
      "Monitor official civil defense instructions continuously.",
      "Border crossings and airspace can close with little notice.",
    ],
  },
  {
    id: "cz-lebanon",
    title: "Southern Lebanon conflict zone",
    lat: 33.25,
    lng: 35.4,
    radiusKm: 80,
    severity: "high",
    summary:
      "Cross-border exchanges and strike risk concentrated in southern Lebanon and adjacent border areas.",
    guidance: [
      "Avoid southern border districts and military zones.",
      "Roads and towns near the Blue Line can become unsafe quickly.",
      "Keep contingency routes north if conditions worsen.",
    ],
  },
  {
    id: "cz-sudan",
    title: "Sudan civil conflict",
    lat: 15.5,
    lng: 32.5,
    radiusKm: 350,
    severity: "critical",
    summary:
      "Multi-front civil war with urban combat, displacement, and collapsed services in many areas.",
    guidance: [
      "Avoid Khartoum, Darfur conflict corridors, and contested cities.",
      "Medical care and banking may be unavailable.",
      "Evacuation options are limited — leave early if advised.",
    ],
  },
  {
    id: "cz-yemen",
    title: "Yemen conflict zone",
    lat: 15.35,
    lng: 44.2,
    radiusKm: 280,
    severity: "high",
    summary:
      "Protracted conflict with airstrikes, militia control, and Red Sea spillover risks.",
    guidance: [
      "Avoid contested governorates and unknown checkpoints.",
      "Maritime approaches in the Red Sea may be hazardous.",
      "Humanitarian access and fuel supply are unreliable.",
    ],
  },
  {
    id: "cz-myanmar",
    title: "Myanmar conflict zone",
    lat: 21.9,
    lng: 96.1,
    radiusKm: 320,
    severity: "high",
    summary:
      "Widespread armed conflict between the military and resistance groups across multiple regions.",
    guidance: [
      "Avoid conflict-affected states and night travel.",
      "Internet blackouts and roadblocks are common.",
      "Register with your embassy if you must remain.",
    ],
  },
  {
    id: "cz-sahel",
    title: "Sahel / Mali–Niger–Burkina zone",
    lat: 14.5,
    lng: 1.5,
    radiusKm: 450,
    severity: "high",
    summary:
      "Jihadist insurgency and intercommunal violence across the central Sahel belt.",
    guidance: [
      "Avoid remote roads and borderlands after dark.",
      "Kidnap and IED risk remains elevated outside major cities.",
      "Check local security notices before any overland travel.",
    ],
  },
  {
    id: "cz-somalia",
    title: "Somalia conflict zone",
    lat: 2.0,
    lng: 45.3,
    radiusKm: 280,
    severity: "high",
    summary:
      "Al-Shabaab attacks, clan conflict, and insecure roads outside protected compounds.",
    guidance: [
      "Limit movement to vetted secure areas.",
      "Avoid public gatherings and government facilities without need.",
      "Use trusted local security guidance for any travel.",
    ],
  },
  {
    id: "cz-drc",
    title: "Eastern DRC conflict zone",
    lat: -1.7,
    lng: 29.2,
    radiusKm: 260,
    severity: "high",
    summary:
      "Armed group activity and displacement concentrated in North/South Kivu and Ituri.",
    guidance: [
      "Avoid Goma outskirts and rural axes when fighting flares.",
      "Humanitarian corridors can close suddenly.",
      "Stay clear of mining conflict zones.",
    ],
  },
  {
    id: "cz-syria",
    title: "Syria conflict remnants",
    lat: 35.2,
    lng: 37.5,
    radiusKm: 300,
    severity: "high",
    summary:
      "Fragmented control, airstrikes, and UXO risk persist across much of Syria.",
    guidance: [
      "Do not travel to Syria for tourism.",
      "UXO and arbitrary detention risks remain high.",
      "Follow UN / embassy guidance exclusively.",
    ],
  },
  {
    id: "cz-libya",
    title: "Libya instability zone",
    lat: 27.0,
    lng: 17.2,
    radiusKm: 350,
    severity: "high",
    summary:
      "Militia competition, intermittent clashes, and weak national security control.",
    guidance: [
      "Avoid political flashpoints in Tripoli and the south.",
      "Armed checkpoints are unpredictable.",
      "Keep low profile and verified local contacts.",
    ],
  },
  {
    id: "cz-ethiopia",
    title: "Ethiopia / Amhara–Tigray tensions",
    lat: 13.5,
    lng: 39.5,
    radiusKm: 220,
    severity: "high",
    summary:
      "Localized fighting and movement restrictions in northern Ethiopia.",
    guidance: [
      "Check regional travel bans before departing Addis.",
      "Communications blackouts can occur during operations.",
      "Avoid military convoys and contested towns.",
    ],
  },
  {
    id: "cz-kashmir",
    title: "Kashmir Line of Control",
    lat: 34.1,
    lng: 74.8,
    radiusKm: 120,
    severity: "high",
    summary:
      "Militarized Line of Control with periodic cross-border fire and security operations.",
    guidance: [
      "Stay away from LoC / border belts without authorization.",
      "Follow local security force instructions.",
      "Expect sudden curfews and road closures.",
    ],
  },
  {
    id: "cz-donbas",
    title: "Donbas front",
    lat: 48.0,
    lng: 37.8,
    radiusKm: 180,
    severity: "critical",
    summary:
      "Active front-line combat in Donetsk and Luhansk sectors with dense artillery and drone activity.",
    guidance: [
      "Front-line towns are extremely dangerous.",
      "Do not approach trench lines or unknown fields.",
      "Only essential authorized personnel should enter.",
    ],
  },
  {
    id: "cz-redsea",
    title: "Red Sea shipping threat zone",
    lat: 14.5,
    lng: 42.5,
    radiusKm: 250,
    severity: "high",
    summary:
      "Missile / drone threats against commercial shipping in the southern Red Sea and Gulf of Aden.",
    guidance: [
      "Commercial vessels should follow UKMTO / naval advisories.",
      "Coastal areas near Bab el-Mandeb can see spillover risk.",
      "Avoid unnecessary maritime transit through threat corridors.",
    ],
  },
];

export function findCombatZone(id: string | null | undefined) {
  if (!id) return null;
  return CURATED_COMBAT_ZONES.find((z) => z.id === id) ?? null;
}

/** Nearest curated zone within its own radius (prevents fake conflict titles). */
export function findNearestCombatZone(lat: number, lng: number) {
  let best: CuratedCombatZone | null = null;
  let bestDist = Infinity;
  for (const z of CURATED_COMBAT_ZONES) {
    const d = haversineKm(lat, lng, z.lat, z.lng);
    if (d <= z.radiusKm && d < bestDist) {
      best = z;
      bestDist = d;
    }
  }
  return best;
}
