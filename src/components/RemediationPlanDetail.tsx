import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { RemediationPlan } from '../resources';
import { ActionResult, RemediationAction, RemediationPhase } from '../types';
import { RiskChip } from './RiskChip';

const PHASE_COLOR: Record<RemediationPhase, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  'pending-approval': 'warning',
  running: 'info',
  completed: 'success',
  failed: 'error',
};

export function RemediationPlanDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [item, error] = RemediationPlan.useGet(name, namespace);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [patching, setPatching] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);

  if (error) return <Alert severity="error">{String(error)}</Alert>;
  if (!item) return <CircularProgress />;

  const actions: RemediationAction[] = item.spec?.actions ?? [];
  const phase: RemediationPhase = item.status?.phase ?? 'pending-approval';
  const results: ActionResult[] = item.status?.results ?? [];
  const approved: boolean = item.spec?.approved ?? false;
  const isExecutable = !approved && (phase === 'pending-approval');

  function toggleSkip(id: string) {
    setSkipped(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patch(skipSet: Set<string>, approve: boolean) {
    if (!item) return;
    setPatching(true);
    setPatchError(null);
    try {
      const patchedActions = actions.map(a => ({ ...a, skip: skipSet.has(a.id) }));
      await item.patch({ spec: { actions: patchedActions, approved: approve } });
    } catch (e: any) {
      setPatchError(e?.message ?? String(e));
    } finally {
      setPatching(false);
    }
  }

  function handleApproveAll() {
    patch(new Set(), true);
  }

  function handleExecuteSelected() {
    // skipped = actions NOT in the selection → all currently checked-off are skipped
    patch(skipped, true);
  }

  const resultById = Object.fromEntries(results.map(r => [r.id, r]));

  return (
    <SectionBox title={`Remediation Plan: ${name}`}>
      {/* Header status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Chip
          label={phase}
          color={PHASE_COLOR[phase]}
          size="small"
        />
        {item.spec?.upgradeAnalysisRef && (
          <Typography variant="body2" color="text.secondary">
            Analysis: <strong>{item.spec.upgradeAnalysisRef}</strong>
          </Typography>
        )}
        {approved && (
          <Chip label="Approved" color="success" size="small" variant="outlined" />
        )}
      </Box>

      {patchError && <Alert severity="error" sx={{ mb: 2 }}>{patchError}</Alert>}

      {/* Actions table */}
      <Table size="small">
        <TableHead>
          <TableRow>
            {isExecutable && <TableCell padding="checkbox">Run</TableCell>}
            <TableCell>ID</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Target</TableCell>
            <TableCell>Risk</TableCell>
            <TableCell>Reason</TableCell>
            {results.length > 0 && <TableCell>Result</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {actions.map(action => {
            const result = resultById[action.id];
            const isSkipped = skipped.has(action.id) || action.skip;
            return (
              <TableRow
                key={action.id}
                sx={{ opacity: isSkipped && isExecutable ? 0.4 : 1 }}
              >
                {isExecutable && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={!skipped.has(action.id)}
                      onChange={() => toggleSkip(action.id)}
                      size="small"
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Typography variant="caption" fontFamily="monospace">{action.id}</Typography>
                </TableCell>
                <TableCell>{action.type}</TableCell>
                <TableCell>
                  {action.namespace ? `${action.namespace}/` : ''}{action.name}
                </TableCell>
                <TableCell><RiskChip risk={action.risk} /></TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  <Typography variant="body2">{action.reason}</Typography>
                </TableCell>
                {results.length > 0 && (
                  <TableCell>
                    {result ? (
                      <Chip
                        label={result.status}
                        color={
                          result.status === 'success'
                            ? 'success'
                            : result.status === 'failed'
                            ? 'error'
                            : 'default'
                        }
                        size="small"
                      />
                    ) : '-'}
                    {result?.error && (
                      <Typography variant="caption" color="error" display="block">
                        {result.error}
                      </Typography>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Action buttons */}
      {isExecutable && (
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            color="success"
            disabled={patching}
            onClick={handleApproveAll}
          >
            {patching ? <CircularProgress size={18} /> : 'Aprobar y ejecutar todo'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            disabled={patching || skipped.size === actions.length}
            onClick={handleExecuteSelected}
          >
            {patching ? <CircularProgress size={18} /> : `Ejecutar seleccionadas (${actions.length - skipped.size})`}
          </Button>
        </Box>
      )}

      {/* Completion info */}
      {phase === 'completed' && item.status?.completedAt && (
        <Alert severity="success" sx={{ mt: 2 }}>
          Completed at {item.status.completedAt}
        </Alert>
      )}
      {phase === 'failed' && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Execution failed. Check individual action results above.
        </Alert>
      )}
    </SectionBox>
  );
}
