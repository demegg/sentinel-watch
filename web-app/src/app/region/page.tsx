import type { Metadata } from "next";
import RegionClient from "./RegionClient";

type Props = { searchParams: Promise<{ lat?: string; lng?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const lat = sp.lat ?? "";
  const lng = sp.lng ?? "";
  const title =
    lat && lng
      ? `Region report · ${lat}, ${lng} · SentinelWatch`
      : "Region report · SentinelWatch";
  const description =
    "Tourist safety brief with risk score, advisories, political news, and live nearby events.";
  const url =
    lat && lng
      ? `https://sentinel-watch-gamma.vercel.app/region?lat=${lat}&lng=${lng}`
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
