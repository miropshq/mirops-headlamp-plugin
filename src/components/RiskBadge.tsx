import Chip from '@mui/material/Chip';
import React from 'react';
import { riskSeverity } from '../riskColor';

// Renders a per-component/namespace RISK value as a CVSS-style severity badge
// (None/Low/Medium/High/Critical), visually distinct from the readiness score.
export function RiskBadge({ risk, size = 'small' }: { risk: number; size?: 'small' | 'medium' }) {
  const { level, color } = riskSeverity(risk);
  return (
    <Chip
      label={level}
      size={size}
      sx={{ bgcolor: color, color: '#fff', fontWeight: 600 }}
    />
  );
}
