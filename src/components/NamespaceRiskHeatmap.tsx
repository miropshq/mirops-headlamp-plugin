import { Router } from '@kinvolk/headlamp-plugin/lib';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { riskSeverity } from '../riskColor';
import { NamespaceRisk } from '../types';
import { RiskBadge } from './RiskBadge';

// Synthetic bucket holding cluster-scoped components (Nodes) — not a real
// Namespace, so it isn't navigable and is sorted last with distinct styling.
export const CLUSTER_SCOPED_BUCKET = 'cluster-scoped';

export function NamespaceRiskHeatmap({
  byNamespace,
  embedded,
}: {
  byNamespace: NamespaceRisk[];
  embedded?: boolean;
}) {
  const history = useHistory();
  if (byNamespace.length === 0) return null;
  const sorted = [...byNamespace].sort((a, b) => {
    // Keep the synthetic cluster-scoped tile last regardless of risk.
    const aSynthetic = a.namespace === CLUSTER_SCOPED_BUCKET;
    const bSynthetic = b.namespace === CLUSTER_SCOPED_BUCKET;
    if (aSynthetic !== bSynthetic) return aSynthetic ? 1 : -1;
    return b.risk - a.risk;
  });
  return (
    <Box sx={{ mb: embedded ? 0 : 3 }}>
      {!embedded && (
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          Namespace Risk
        </Typography>
      )}
      <Grid container spacing={2}>
        {sorted.map(ns => {
          const isClusterScoped = ns.namespace === CLUSTER_SCOPED_BUCKET;
          const navigable = !isClusterScoped;
          return (
            <Grid item xs={6} sm={4} md={2} key={ns.namespace}>
              <Paper
                variant="outlined"
                onClick={
                  navigable
                    ? () => history.push(Router.createRouteURL('namespace', { name: ns.namespace }))
                    : undefined
                }
                sx={{
                  p: 2,
                  textAlign: 'center',
                  borderLeft: '4px solid',
                  borderLeftColor: riskSeverity(ns.risk).color,
                  borderStyle: isClusterScoped ? 'dashed' : 'solid',
                  bgcolor: isClusterScoped ? 'action.hover' : undefined,
                  cursor: navigable ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <RiskBadge risk={ns.risk} />
                <Typography variant="body2" noWrap>
                  {isClusterScoped ? 'cluster-scoped' : ns.namespace}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ns.atRisk}/{ns.components} at risk
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
