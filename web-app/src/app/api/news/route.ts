import { NextRequest, NextResponse } from "next/server";
import {
  isValidLatLng,
  sanitizeQuery,
  safeHttpUrl,
  safeClientError,
} from "@/lib/security";

export const revalidate = 300;

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
}

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks.slice(0, 25)) {
    const title = decodeXml(
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
    );
    const link = decodeXml(
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
        block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ??
        ""
    );
    const source =
      decodeXml(
        block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? ""
      ) || "Google News";
    const pub =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    const desc = decodeXml(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? ""
    );
    const safeLink = safeHttpUrl(link);
    if (!title || !safeLink) continue;
    items.push({
      id: `news-${title.slice(0, 24).replace(/\W+/g, "")}-${items.length}`,
      title: title.slice(0, 300),
      link: safeLink,
      source: source.slice(0, 80),
      publishedAt: pub ? Date.parse(pub) || Date.now() : Date.now(),
      summary: desc.slice(0, 220),
    });
  }
  return items;
}

async function fetchGoogleNews(query: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "SentinelWatch/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });
  if (!res.ok) throw new Error(`Google News ${res.status}`);
  return parseRss(await res.text());
}

export async function GET(req: NextRequest) {
  const q = sanitizeQuery(req.nextUrl.searchParams.get("q"));
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const hasCoords = isValidLatLng(lat, lng);

  if (!q && !hasCoords) {
    return NextResponse.json(
      { error: "Provide q or lat/lng" },
      { status: 400 }
    );
  }

  const queries = [
    q ? `${q} when:7d` : null,
    q ? `${q} (breaking OR crisis OR disaster OR conflict OR outage OR war OR emergency)` : null,
    hasCoords ? `near:${lat},${lng}` : null,
  ].filter(Boolean) as string[];

  try {
    const batches = await Promise.all(
      queries.map(async (query) => {
        try {
          return await fetchGoogleNews(query);
        } catch {
          return [] as NewsItem[];
        }
      })
    );

    const seen = new Set<string>();
    const news = batches
      .flat()
      .filter((n) => {
        const key = n.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 20);

    return NextResponse.json({
      source: "google-news-rss",
      query: q || undefined,
      count: news.length,
      news,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "error",
        news: [],
        error: safeClientError(err, "News unavailable"),
      },
      { status: 502 }
    );
  }
}
