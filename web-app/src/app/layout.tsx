import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sentinel Watch Beta — Global Crisis Monitor",
  description:
    "Beta: real-time global crisis monitoring — earthquakes, wildfires, conflicts, live cams, and radio.",
  keywords: ["crisis", "monitoring", "earthquakes", "live map", "sentinel", "beta"],
  openGraph: {
    title: "Sentinel Watch Beta",
    description: "Global crisis monitoring in real time (beta).",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0e14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Sentinel Watch" />
      </head>
      <body lang="en">{children}</body>
    </html>
  );
}
