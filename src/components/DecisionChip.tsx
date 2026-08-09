import Chip from '@mui/material/Chip';
import React from 'react';
import { Decision } from '../types';

interface Props {
  decision: Decision;
}

// ERROR is a config error, not an analysis verdict — render it neutral/grey
// and labeled so it doesn't read as a red CRITICAL.
const COLOR_MAP: Record<Decision, 'success' | 'warning' | 'error' | 'default'> = {
  SAFE: 'success',
  WARNING: 'warning',
  CRITICAL: 'error',
  ERROR: 'default',
};

// The chip shows the upgrade verdict (the actionable go/no-go), not the raw level, so it matches the
// detail view's verdict banner. SAFE = allowed, WARNING = not recommended (proceed at your own risk,
// not blocked), CRITICAL = blocked.
const LABEL_MAP: Record<Decision, string> = {
  SAFE: 'Allowed',
  WARNING: 'Not recommended',
  CRITICAL: 'Blocked',
  ERROR: 'Config error',
};

export function DecisionChip({ decision }: Props) {
  const label = LABEL_MAP[decision];
  return (
    <Chip
      label={label}
      color={COLOR_MAP[decision]}
      size="small"
      variant={decision === 'ERROR' ? 'outlined' : 'filled'}
    />
  );
}
