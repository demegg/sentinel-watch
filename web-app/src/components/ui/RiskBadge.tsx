"use client";

export default function RiskBadge({
  level,
  score,
  label,
  reasons,
  compact,
}: {
  level: "clear" | "caution" | "avoid";
  score: number;
  label: string;
  reasons?: string[];
  compact?: boolean;
}) {
  return (
    <div className={`sw-risk-badge is-${level}${compact ? " is-compact" : ""}`}>
      <div className="sw-risk-badge-top">
        <span className="sw-risk-badge-level">{label}</span>
        <span className="sw-risk-badge-score">{score}/100</span>
      </div>
      {!compact && reasons && reasons.length > 0 && (
        <ul className="sw-risk-badge-reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
