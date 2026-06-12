// Shared color scale for the 0–100 risk score coming from the report's
// logical mirror (graph nodes, namespace heatmap). 0 = green → 100 = red,
// >= 50 is considered "at risk".
export const AT_RISK_THRESHOLD = 50;

export function riskColor(risk: number): string {
  const clamped = Math.max(0, Math.min(100, risk));
  const hue = 120 - clamped * 1.2; // 120 (green) → 0 (red)
  return `hsl(${hue}, 70%, 38%)`;
}
