import type { Metadata } from "next";
import RegionClient from "./RegionClient";
import { isValidLatLng } from "@/lib/security";

type Props = { searchParams: Promise<{ lat?: string; lng?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const valid = isValidLatLng(lat, lng);
  const title = valid
    ? `Region report · ${lat.toFixed(2)}, ${lng.toFixed(2)} · SentinelWatch`
    : "Region report · SentinelWatch";
  const description =
    "Tourist safety brief with risk score, advisories, political news, and live nearby events.";
  const url = valid
    ? `https://sentinel-watch-gamma.vercel.app/region?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
    : "https://sentinel-watch-gamma.vercel.app/region";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "SentinelWatch",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function RegionPage() {
  return <RegionClient />;
}
