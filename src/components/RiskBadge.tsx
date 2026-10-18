import Chip from '@mui/material/Chip';
import React from 'react';
import { riskSeverity } from '../riskColor';

// Low/Medium/High sit on amber and orange fills, where white text is unreadable (well under 4.5:1),
// so they take dark text; None (green) and Critical (red) are dark enough to keep white.
const DARK_TEXT_LEVELS = new Set(['Low', 'Medium', 'High']);

// Renders a per-component/namespace RISK value as a CVSS-style severity badge
// (None/Low/Medium/High/Critical), visually distinct from the readiness score.
export function RiskBadge({ risk, size = 'small' }: { risk: number; size?: 'small' | 'medium' }) {
  const { level, color } = riskSeverity(risk);
  const text = DARK_TEXT_LEVELS.has(level) ? '#1d2126' : '#fff';
  return <Chip label={level} size={size} sx={{ bgcolor: color, color: text, fontWeight: 600 }} />;
}
