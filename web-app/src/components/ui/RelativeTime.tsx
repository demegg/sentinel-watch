"use client";

import { useEffect, useState } from "react";

function formatTimeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

/** Renders relative timestamps only after mount to avoid hydration mismatches. */
export default function RelativeTime({ ts }: { ts: number }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setLabel(formatTimeAgo(ts));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [ts]);

  return <span suppressHydrationWarning>{label ?? "…"}</span>;
}
