import type { Metadata } from "next";
import ConflictClient from "./ConflictClient";

type Props = { searchParams: Promise<{ title?: string; id?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const name = sp.title || sp.id || "Conflict zone";
  const title = `Conflict report · ${name} · SentinelWatch`;
  const description =
    "Conflict situational brief with risk score, guidance, and political news.";

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

export default function ConflictPage() {
  return <ConflictClient />;
}
