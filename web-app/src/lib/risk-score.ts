/** Risk scoring for region / conflict / storm briefs. */

export type RiskLevel = "clear" | "caution" | "avoid";

export type RiskScore = {
  level: RiskLevel;
  score: number; // 0–100
  label: string;
  reasons: string[];
};

const LEVEL_POINTS: Record<string, number> = {
  low: 8,
  medium: 18,
  moderate: 18,
  high: 32,
  critical: 48,
};

export function computeRiskScore(input: {
  hazardLevels?: string[];
  eventSeverities?: string[];
  avoidCount?: number;
  baseSeverity?: string;
  kind?: "region" | "conflict" | "storm";
}): RiskScore {
  let score = 0;
  const reasons: string[] = [];

  if (input.kind === "conflict") {
    score += input.baseSeverity === "critical" ? 72 : 55;
    reasons.push(
      input.baseSeverity === "critical"
        ? "Active critical conflict zone"
        : "Active high-risk conflict zone"
    );
  }

  if (input.kind === "storm") {
    score +=
      input.baseSeverity === "critical"
        ? 65
        : input.baseSeverity === "high"
          ? 48
          : 30;
    reasons.push(
      input.baseSeverity === "critical"
        ? "Severe / major storm system"
        : "Active storm or flood system nearby"
    );
  }

  for (const level of input.hazardLevels ?? []) {
    const pts = LEVEL_POINTS[level] ?? 10;
    score += Math.min(pts, 40);
  }
  const criticalHazards = (input.hazardLevels ?? []).filter((l) => l === "critical").length;
  const highHazards = (input.hazardLevels ?? []).filter((l) => l === "high").length;
  if (criticalHazards) reasons.push(`${criticalHazards} critical advisory(ies)`);
  else if (highHazards) reasons.push(`${highHazards} high-priority advisory(ies)`);

  for (const sev of input.eventSeverities ?? []) {
    score += Math.min(LEVEL_POINTS[sev] ?? 10, 36);
  }
  const critEvents = (input.eventSeverities ?? []).filter((s) => s === "critical").length;
  if (critEvents) reasons.push(`${critEvents} critical live event(s) nearby`);

  const avoid = input.avoidCount ?? 0;
  if (avoid > 0) {
    score += Math.min(avoid * 6, 24);
    reasons.push(`${avoid} items flagged to avoid`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: RiskLevel = "clear";
  let label = "Clear";
  if (score >= 55) {
    level = "avoid";
    label = "Avoid";
  } else if (score >= 28) {
    level = "caution";
    label = "Caution";
  }

  if (!reasons.length) {
    reasons.push(
      level === "clear"
        ? "No major hazards detected in current feeds"
        : "Elevated risk from live situational feeds"
    );
  }

  return { level, score, label, reasons: reasons.slice(0, 4) };
}
