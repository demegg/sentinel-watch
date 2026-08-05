import { safeHttpUrl } from "@/lib/security";
import { fetchUpstream } from "@/lib/net";

export type ReportNewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: number;
  summary: string;
};

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

export async function fetchTopicNews(query: string, limit = 10): Promise<ReportNewsItem[]> {
  const items: ReportNewsItem[] = [];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetchUpstream(url, {
      timeoutMs: 10000,
      headers: {
        "User-Agent": "SentinelWatch/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) return items;
    const xml = await res.text();
    for (const block of xml.split(/<item[\s>]/i).slice(1, limit + 4)) {
      const title = decodeXml(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
      const link = decodeXml(
        block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
          block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ??
          ""
      );
      const source =
        decodeXml(block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "") ||
        "Google News";
      const pub = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
      const desc = decodeXml(
        block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? ""
      );
      const safeLink = safeHttpUrl(link);
      if (!title || !safeLink) continue;
      items.push({
        id: `news-${items.length}-${title.slice(0, 16).replace(/\W+/g, "")}`,
        title: title.slice(0, 240),
        link: safeLink,
        source: source.slice(0, 80),
        publishedAt: pub ? Date.parse(pub) || Date.now() : Date.now(),
        summary: desc.slice(0, 200),
      });
      if (items.length >= limit) break;
    }
  } catch {
    /* empty */
  }
  return items;
}
