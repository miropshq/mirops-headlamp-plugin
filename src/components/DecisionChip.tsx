import Chip from '@mui/material/Chip';
import React from 'react';
import { Decision } from '../types';

interface Props {
  decision: Decision;
}

const COLOR_MAP: Record<Decision, 'success' | 'warning' | 'error'> = {
  SAFE: 'success',
  WARNING: 'warning',
  BLOCK: 'error',
};

export function DecisionChip({ decision }: Props) {
  return <Chip label={decision} color={COLOR_MAP[decision]} size="small" />;
}
