import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import React from 'react';

// Max points per dimension, from the operator's internal/analysis/score.go:
//   Health 25, Capacity 30, Stability 20, Compatibility 25  (sum = 100).
// The report emits the raw sub-scores but not their maxima, so we carry them here.
// If the operator changes the weights, update these (or have the report emit them).
const DIMENSIONS = [
  { key: 'health', label: 'Health', max: 25 },
  { key: 'capacity', label: 'Capacity', max: 30 },
  { key: 'stability', label: 'Stability', max: 20 },
  { key: 'compatibility', label: 'Compatibility', max: 25 },
] as const;

interface BaseScores {
  health: number;
  capacity: number;
  stability: number;
  compatibility: number;
}

interface Props {
  base: BaseScores;
  ai?: { score: number; model?: string };
}

// band maps a fill ratio to a MUI semantic palette key so the color is theme-aware and
// consistent with the readiness gauge (healthy → success, attention → warning, low → error).
function band(ratio: number): { palette: 'success' | 'warning' | 'error'; icon: string; aria: string } {
  if (ratio >= 0.85) return { palette: 'success', icon: '✓', aria: 'healthy' };
  if (ratio >= 0.6) return { palette: 'warning', icon: '⚠', aria: 'needs attention' };
  return { palette: 'error', icon: '✕', aria: 'low' };
}

// ScoreBreakdown shows the four readiness dimensions as status bars, each filled against its own
// maximum (not 100) so a weak dimension stands out even though the dimensions have different
// budgets. The number + icon means identity/severity is never conveyed by color alone.
export function ScoreBreakdown({ base, ai }: Props) {
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', lineHeight: 1.6 }}
      >
        Score breakdown
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          columnGap: 1.5,
          rowGap: 1,
          alignItems: 'center',
        }}
      >
        {DIMENSIONS.map(d => {
          const value = base[d.key];
          const ratio = Math.max(0, Math.min(1, value / d.max));
          const { palette, icon, aria } = band(ratio);
          return (
            <React.Fragment key={d.key}>
              <Typography variant="body2">{d.label}</Typography>
              <LinearProgress
                variant="determinate"
                value={ratio * 100}
                aria-label={`${d.label}: ${value} of ${d.max}, ${aria}`}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: `${palette}.main`,
                    borderRadius: 999,
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                }}
              >
                {value} / {d.max}{' '}
                <Box component="span" sx={{ color: `${palette}.main` }} aria-hidden="true">
                  {icon}
                </Box>
              </Typography>
            </React.Fragment>
          );
        })}
      </Box>
      {ai && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          AI score {ai.score}
          {ai.model ? ` (${ai.model})` : ''} — blended 70% base / 30% AI
        </Typography>
      )}
    </Box>
  );
}
