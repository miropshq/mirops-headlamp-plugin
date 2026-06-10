import Chip from '@mui/material/Chip';
import React from 'react';
import { Decision } from '../types';

interface Props {
  decision: Decision;
}

// ERROR is a config error, not an analysis verdict — render it neutral/grey
// and labeled so it doesn't read as a red BLOCK.
const COLOR_MAP: Record<Decision, 'success' | 'warning' | 'error' | 'default'> = {
  SAFE: 'success',
  WARNING: 'warning',
  BLOCK: 'error',
  ERROR: 'default',
};

export function DecisionChip({ decision }: Props) {
  const label = decision === 'ERROR' ? 'CONFIG ERROR' : decision;
  return (
    <Chip
      label={label}
      color={COLOR_MAP[decision]}
      size="small"
      variant={decision === 'ERROR' ? 'outlined' : 'filled'}
    />
  );
}
