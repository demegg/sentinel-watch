"use client";

import RelativeTime from "./RelativeTime";

const SOURCE_META: Record<string, { label: string; color: string }> = {
  USGS: { label: "USGS", color: "#f97316" },
  "NASA EONET": { label: "NASA EONET", color: "#38bdf8" },
  GDACS: { label: "GDACS", color: "#ef4444" },
  Wikidata: { label: "Wikidata", color: "#a855f7" },
  "Open-Meteo": { label: "Open-Meteo", color: "#22d3ee" },
  "Google News": { label: "News", color: "#94a3b8" },
  Advisories: { label: "Advisories", color: "#facc15" },
};

export function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] ?? { label: source, color: "#64748b" };
  return (
    <span
      className="sw-source-badge"
      title={`Source: ${meta.label}`}
      style={{ borderColor: `${meta.color}55`, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

export default function TrustBar({
  sources,
  fetchedAt,
  compact,
  note,
}: {
  sources?: string[];
  fetchedAt?: number | null;
  compact?: boolean;
  note?: string;
}) {
  const list = (sources ?? []).filter(Boolean);
  return (
    <div className={`sw-trust-bar${compact ? " is-compact" : ""}`}>
      <div className="sw-trust-bar-row">
        {fetchedAt ? (
          <span className="sw-trust-updated">
            Updated <RelativeTime ts={fetchedAt} />
          </span>
        ) : (
          <span className="sw-trust-updated">Live sources</span>
        )}
        {list.length > 0 && (
          <div className="sw-trust-sources">
            {list.map((s) => (
              <SourceBadge key={s} source={s} />
            ))}
          </div>
        )}
      </div>
      {!compact && (
        <p className="sw-trust-note">
          {note ??
            "Aggregated from public feeds — verify critical decisions with official sources."}
        </p>
      )}
    </div>
  );
}
