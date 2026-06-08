import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import { Decision } from '../types';

interface Props {
  score: number;
  decision: Decision;
}

const COLOR_MAP: Record<Decision, string> = {
  SAFE: '#2e7d32',
  WARNING: '#ed6c02',
  BLOCK: '#d32f2f',
};

export function ScoreGauge({ score, decision }: Props) {
  const color = COLOR_MAP[decision];
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
        Score / 100
      </Typography>
    </Box>
  );
}
