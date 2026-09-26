import { Link } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { ReportWorkloads } from '../types';
import { PaginationBar, usePaginated } from './Pagination';

// A single Deployment can own dozens of failing pods (a 15-replica CrashLoopBackOff). Listing them
// all inside one table cell makes that row taller than the whole rest of the report, so the cell
// shows this many by default behind a "Show N more" / "Show less" toggle (see ProblemPodsCell).
const NESTED_POD_CAP = 6;

function WorkloadTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: any[];
  columns: { label: string; key: string }[];
}) {
  if (!rows || rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map(c => (
              <TableCell key={c.key}>{c.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map(c => (
                <TableCell key={c.key}>{String(row[c.key] ?? '-')}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

interface WorkloadRow {
  namespace: string;
  name: string;
  pods?: { name: string; reason?: string; restarts: number }[];
}

// ProblemPodsCell renders a workload's failing pods, collapsed to NESTED_POD_CAP so one busy
// Deployment (15 CrashLoopBackOff replicas) can't outgrow the whole table. The "Show N more" toggle
// expands the full list in place and flips to "Show less", so the detail is one click away — not lost.
function ProblemPodsCell({
  namespace,
  pods,
}: {
  namespace: string;
  pods: { name: string; reason?: string; restarts: number }[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (pods.length === 0) return <>—</>;
  const shown = expanded ? pods : pods.slice(0, NESTED_POD_CAP);
  const hidden = pods.length - NESTED_POD_CAP;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {shown.map(p => (
        <Box key={p.name} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link routeName="Pod" params={{ namespace, name: p.name }}>
            {p.name}
          </Link>
          {p.reason && <Chip label={p.reason} size="small" color="warning" variant="outlined" />}
          {p.restarts > 0 && (
            <Typography variant="caption" color="text.secondary">
              {p.restarts} restarts
            </Typography>
          )}
        </Box>
      ))}
      {hidden > 0 && (
        <Typography
          variant="caption"
          onClick={() => setExpanded(e => !e)}
          sx={{
            cursor: 'pointer',
            color: 'primary.main',
            width: 'fit-content',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </Typography>
      )}
    </Box>
  );
}

// Renders a workload table where the namespace, the workload and each problem
// pod link to their Headlamp detail view, so the user can jump straight to the
// resource instead of just reading a name.
function WorkloadSection<T extends WorkloadRow>({
  title,
  routeName,
  rows,
  status,
}: {
  title: string;
  routeName: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Job';
  rows: T[];
  status: (row: T) => string;
}) {
  const p = usePaginated(rows ?? []);
  if (!rows || rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Namespace</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Problem pods</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {p.items.map((row, i) => {
            const problemPods = (row.pods ?? []).filter(p => p.reason || p.restarts > 0);
            return (
              <TableRow key={i}>
                <TableCell>
                  <Link routeName="namespace" params={{ name: row.namespace }}>
                    {row.namespace}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link routeName={routeName} params={{ namespace: row.namespace, name: row.name }}>
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{status(row)}</TableCell>
                <TableCell>
                  <ProblemPodsCell namespace={row.namespace} pods={problemPods} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <PaginationBar page={p.page} pageSize={p.pageSize} total={p.total} onChange={p.setPage} />
    </Box>
  );
}

const PVC_PHASE_COLOR: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  Bound: 'success',
  Pending: 'warning',
  Lost: 'error',
};

// PVCTable lists every PersistentVolumeClaim with its phase, so a Lost or Pending claim is visible
// in the data section (not only as a graph node). Lost/Pending are the ones that block or warn on
// an upgrade — a drained node can't reattach storage that isn't Bound.
function PVCTable({ rows }: { rows: NonNullable<ReportWorkloads['pvcs']> }) {
  const pg = usePaginated(rows ?? []);
  if (!rows || rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Persistent Volume Claims
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Namespace</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Storage Class</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pg.items.map((p, i) => (
            <TableRow key={i}>
              <TableCell>
                <Link routeName="namespace" params={{ name: p.namespace }}>
                  {p.namespace}
                </Link>
              </TableCell>
              <TableCell>
                <Link
                  routeName="persistentVolumeClaim"
                  params={{ namespace: p.namespace, name: p.name }}
                >
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>{p.storageClass || '—'}</TableCell>
              <TableCell>
                <Chip
                  label={p.phase}
                  size="small"
                  color={PVC_PHASE_COLOR[p.phase] ?? 'default'}
                  variant={p.phase === 'Bound' ? 'outlined' : 'filled'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar page={pg.page} pageSize={pg.pageSize} total={pg.total} onChange={pg.setPage} />
    </Box>
  );
}

// NodesTable lists cluster nodes with their status. A large cluster has hundreds of nodes, so the
// list is paged like the workload tables.
function NodesTable({ rows }: { rows: ReportWorkloads['nodes'] }) {
  const pg = usePaginated(rows ?? []);
  if (!rows || rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Nodes
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pg.items.map(n => (
            <TableRow key={n.name}>
              <TableCell>
                <Link routeName="node" params={{ name: n.name }}>
                  {n.name}
                </Link>
              </TableCell>
              <TableCell>{n.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar page={pg.page} pageSize={pg.pageSize} total={pg.total} onChange={pg.setPage} />
    </Box>
  );
}

// WorkloadsData is the report's raw workload inventory (nodes, deployments, PVCs, deprecated APIs).
// A "Only show problems" toggle — on by default — hides the healthy rows that otherwise dominate
// the tables (Ready nodes, fully-ready deployments, Bound PVCs), so what needs attention isn't
// buried. StatefulSets/DaemonSets/Jobs/Deprecated APIs already carry only problems from the
// operator, so the toggle doesn't touch them.
export function WorkloadsData({ workloads }: { workloads: ReportWorkloads }) {
  const [onlyProblems, setOnlyProblems] = useState(true);
  const w = workloads;
  const nodes = onlyProblems ? w.nodes.filter(n => n.status !== 'Ready') : w.nodes;
  const deployments = onlyProblems
    ? w.deployments.filter(d => d.readyReplicas < d.desiredReplicas)
    : w.deployments;
  const pvcs = onlyProblems ? (w.pvcs ?? []).filter(p => p.phase !== 'Bound') : w.pvcs ?? [];
  const barePods = onlyProblems
    ? (w.barePods ?? []).filter(p => p.status !== 'Running')
    : w.barePods ?? [];

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Workloads
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={onlyProblems}
              onChange={e => setOnlyProblems(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Only show problems</Typography>}
        />
      </Box>

      <NodesTable rows={nodes} />

      <WorkloadSection
        title="Deployments"
        routeName="Deployment"
        rows={deployments}
        status={d => `${d.readyReplicas}/${d.desiredReplicas} ready`}
      />
      <WorkloadSection
        title="StatefulSets"
        routeName="StatefulSet"
        rows={w.statefulsets}
        status={d => `${d.readyReplicas}/${d.desiredReplicas} ready`}
      />
      <WorkloadSection
        title="DaemonSets"
        routeName="DaemonSet"
        rows={w.daemonsets}
        status={d => `${d.numberUnavailable} unavailable`}
      />
      <WorkloadSection
        title="Jobs"
        routeName="Job"
        rows={w.jobs}
        status={j =>
          j.status === 'Failed' ? `failed${j.reason ? ` (${j.reason})` : ''}` : `${j.active} active`
        }
      />
      <BarePodsTable rows={barePods} />
      <PVCTable rows={pvcs} />
      {w.deprecatedApis && w.deprecatedApis.length > 0 && (
        <WorkloadTable
          title="Deprecated APIs"
          rows={w.deprecatedApis}
          columns={[
            { label: 'Group', key: 'group' },
            { label: 'Version', key: 'version' },
            { label: 'Resource', key: 'resource' },
            { label: 'Removed In', key: 'removedIn' },
          ]}
        />
      )}
    </>
  );
}

const BARE_POD_STATUS_COLOR: Record<string, 'success' | 'error' | 'default'> = {
  Running: 'success',
  Down: 'error',
};

// BarePodsTable lists standalone pods (no owning workload — `kubectl run`, raw Pod manifests).
// They aren't covered by any Deployment/StatefulSet row, so a failing bare pod would otherwise be
// invisible in the data section. A "Down" (not-ready) one is the case that matters for an upgrade.
function BarePodsTable({ rows }: { rows: NonNullable<ReportWorkloads['barePods']> }) {
  const pg = usePaginated(rows ?? []);
  if (!rows || rows.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Standalone Pods
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Namespace</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pg.items.map((p, i) => (
            <TableRow key={i}>
              <TableCell>
                <Link routeName="namespace" params={{ name: p.namespace }}>
                  {p.namespace}
                </Link>
              </TableCell>
              <TableCell>
                <Link routeName="Pod" params={{ namespace: p.namespace, name: p.name }}>
                  {p.name}
                </Link>
              </TableCell>
              <TableCell>
                <Chip
                  label={p.status}
                  size="small"
                  color={BARE_POD_STATUS_COLOR[p.status] ?? 'default'}
                  variant={p.status === 'Running' ? 'outlined' : 'filled'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <PaginationBar page={pg.page} pageSize={pg.pageSize} total={pg.total} onChange={pg.setPage} />
    </Box>
  );
}
