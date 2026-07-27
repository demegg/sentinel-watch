import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Sentinel Watch",
  description:
    "Sentinel Watch — real-time global crisis monitoring. Earthquakes, wildfires, conflicts, live cams and radio on one command-center map. Eyes everywhere. Always watching.",
};

export default function Page() {
  return <LandingPage />;
}
