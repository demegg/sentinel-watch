import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — Real-Time Global Crisis Monitor` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${SITE_NAME} — Real-Time Global Crisis Monitor`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    title: `${SITE_NAME} — Real-Time Global Crisis Monitor`,
    description: SITE_DESCRIPTION,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#org` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      alternateName: ["SentinelWatch", "Sentinel Watch Beta"],
      applicationCategory: "NewsApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Live earthquake and wildfire map",
        "Conflict and storm situational briefs",
        "Live cameras and local radio feeds",
        "Aircraft search and crisis proximity (SkyTrace)",
      ],
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_TAGLINE,
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Structured data for Google — static JSON only, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Server-rendered crawlable copy (always in HTML, even before JS). */}
      <section className="sw-seo-crawl" aria-label={`${SITE_NAME} overview`}>
        <p>
          <strong>{SITE_NAME}</strong> — {SITE_DESCRIPTION}
        </p>
        <ul>
          <li>Live global crisis map for earthquakes, wildfires, storms, and conflicts</li>
          <li>Nearby live cameras and local radio feeds</li>
          <li>SkyTrace aircraft search with crisis proximity</li>
          <li>Free web crisis monitor — guest or signed-in</li>
        </ul>
      </section>
      <LandingPage />
    </>
  );
}
