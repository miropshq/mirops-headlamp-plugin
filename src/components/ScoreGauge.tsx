import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import React from 'react';

// HealthBand describes the readiness score on its own axis — how healthy the cluster looks — using
// health words, deliberately NOT the decision's SAFE/WARNING/CRITICAL. This keeps the gauge from
// ever appearing to "block": the gauge is health, the separate verdict banner is the gate.
export type HealthBand = 'SAFE' | 'FAIR' | 'AT_RISK';

interface Props {
  score: number;
  band: HealthBand;
}

const BAND_MAP: Record<HealthBand, { color: string; label: string }> = {
  SAFE: { color: '#2e7d32', label: 'SAFE' },
  FAIR: { color: '#ed6c02', label: 'FAIR' },
  AT_RISK: { color: '#d32f2f', label: 'AT RISK' },
};

export function ScoreGauge({ score, band }: Props) {
  const { color, label } = BAND_MAP[band];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ position: 'relative', width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#e0e0e0" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <Typography
          variant="h5"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontWeight: 700,
            color,
          }}
        >
          {score}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Readiness Score
      </Typography>
      <Chip
        label={label}
        size="small"
        variant="outlined"
        sx={{ mt: 0.5, fontWeight: 600, color, borderColor: color }}
      />
    </Box>
  );
}
