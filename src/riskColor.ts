// Risk is the 0–100 score from the report's logical mirror (graph nodes,
// namespace heatmap). HIGHER IS WORSE — it is NOT the readiness score. Render
// it as CVSS-style severity bands so it can't be confused with the readiness
// gauge (which is higher=better).
//
//   0 → None | 1-39 → Low | 40-69 → Medium | 70-89 → High | 90-100 → Critical

export type RiskLevel = 'None' | 'Low' | 'Medium' | 'High' | 'Critical';

export interface RiskSeverity {
  level: RiskLevel;
  color: string;
}

// Risk >= this is High or worse — used to highlight graph nodes.
export const HIGH_RISK_THRESHOLD = 70;

export function riskSeverity(risk: number): RiskSeverity {
  const r = Math.max(0, Math.min(100, Number.isFinite(risk) ? risk : 0));
  if (r === 0) return { level: 'None', color: '#2e7d32' }; // green
  if (r < 40) return { level: 'Low', color: '#f9a825' }; // amber
  if (r < 70) return { level: 'Medium', color: '#f57c00' }; // orange
  if (r < 90) return { level: 'High', color: '#e64a19' }; // deep orange
  return { level: 'Critical', color: '#c62828' }; // red
}
