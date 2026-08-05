import type { Metadata } from "next";
import StormClient from "./StormClient";

type Props = { searchParams: Promise<{ title?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const name = sp.title || "Severe storm";
  const title = `Storm report · ${name} · SentinelWatch`;
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
