"use client";

export default function LoadingState({
  label,
  sublabel,
  compact,
}: {
  label: string;
  sublabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="sw-loading"
      style={{
        textAlign: "center",
        padding: compact ? "20px 12px" : "32px 16px",
        color: "#64748b",
        fontSize: compact ? 11 : 12,
        letterSpacing: "0.08em",
        lineHeight: 1.6,
      }}
    >
      <div className="sw-loading-spinner" aria-hidden />
      <div style={{ marginTop: 10, color: "#94a3b8" }}>{label}</div>
      {sublabel && (
        <div style={{ marginTop: 6, fontSize: 10, color: "#475569", letterSpacing: "0.04em" }}>
          {sublabel}
        </div>
      )}
    </div>
  );
}
