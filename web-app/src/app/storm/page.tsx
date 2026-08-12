import type { Metadata } from "next";
import StormClient from "./StormClient";
import { sanitizeDisplayTitle } from "@/lib/security";

type Props = { searchParams: Promise<{ title?: string; id?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const label = sanitizeDisplayTitle(sp.id, 40) || "Severe storm";
  const title = `Storm report · ${label} · SentinelWatch`;
  const description =
    "Storm catcher brief with risk score, local conditions, outlook, and safety guidance.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "SentinelWatch",
    },
    twitter: { card: "summary", title, description },
  };
}

export default function StormPage() {
  return <StormClient />;
}
