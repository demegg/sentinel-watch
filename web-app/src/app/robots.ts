import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/download"],
        disallow: ["/api/", "/auth", "/onboarding", "/app", "/conflict", "/storm", "/region"],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/download"],
        disallow: ["/api/", "/auth", "/onboarding", "/app"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
