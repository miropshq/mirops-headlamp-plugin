import Chip from '@mui/material/Chip';
import React from 'react';
import { RiskLevel } from '../types';

interface Props {
  risk: RiskLevel;
}

const COLOR_MAP: Record<RiskLevel, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

export function RiskChip({ risk }: Props) {
  return <Chip label={risk} color={COLOR_MAP[risk]} size="small" variant="outlined" />;
}
