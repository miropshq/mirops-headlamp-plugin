import { ApiProxy, Router } from '@kinvolk/headlamp-plugin/lib';
import { Link, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { RemediationPlan, UpgradeAnalysis } from '../resources';
import { riskSeverity } from '../riskColor';
import { AddonStatus, Decision, NamespaceRisk, Report } from '../types';
import { DependencyGraph } from './DependencyGraph';
import { RiskBadge } from './RiskBadge';
import { HealthBand,ScoreGauge } from './ScoreGauge';

// Viewing a remote report can fail at the proxy with HTTP 502 carrying a JSON
// body { error, location, detail }. Surface `detail` (the actionable cause)
// when present; fall back to the raw error message otherwise.
function extractReportError(e: any): string {
  const raw = e?.message ?? String(e);
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === 'object' && body.detail) {
      return body.location ? `${body.detail} (${body.location})` : body.detail;
    }
  } catch {
    /* not JSON — use the raw message */
  }
  return raw;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h6" fontWeight={700}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

// A crashing workload can produce dozens of rows (a Deployment with 15 CrashLoopBackOff pods, one
// Issue line per pod). Rather than render every row at once — which turns the report into an endless
// scroll — long lists are paged into chunks of RESOURCE_PAGE_SIZE with a range pager ("1–12 of N").
const RESOURCE_PAGE_SIZE = 12;

// A single Deployment can own dozens of failing pods (a 15-replica CrashLoopBackOff). Listing them
// all inside one table cell makes that row taller than the whole rest of the report, so the cell
// shows this many by default behind a "Show N more" / "Show less" toggle (see ProblemPodsCell).
const NESTED_POD_CAP = 6;

// usePaginated slices `rows` into the current page. `page` is clamped in render so shrinking the list
// (e.g. toggling "Only show problems") can never leave the pager pointing past the last page.
function usePaginated<T>(rows: T[], pageSize = RESOURCE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    page: current,
    setPage,
    pageCount,
    pageSize,
    total: rows.length,
  };
}

// PaginationBar is the range-style pager Headlamp uses on its own tables ("1–12 of 40  ‹ ›"). It's
// MUI's TablePagination rendered standalone (component="div") below a table, with the rows-per-page
// selector hidden. It removes itself when everything fits on one page, so short lists are untouched.
function PaginationBar({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= pageSize) return null;
  return (
    <TablePagination
      component="div"
      count={total}
      page={page - 1}
      rowsPerPage={pageSize}
      rowsPerPageOptions={[]}
      onPageChange={(_, p) => onChange(p + 1)}
    />
  );
}

// IssuesSection lists the report's issues, one alert per line. A single crashing Deployment emits one
// issue per pod, so this is the list most likely to run into the dozens — it's paged like the tables.
function IssuesSection({ issues }: { issues?: string[] }) {
  const pg = usePaginated(issues ?? []);
  if (!issues || issues.length === 0) return null;
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Issues
      </Typography>
      {pg.items.map((issue, i) => (
        <Alert key={i} severity="warning" sx={{ mb: 1 }}>
          {issue}
        </Alert>
      ))}
      <PaginationBar page={pg.page} pageSize={pg.pageSize} total={pg.total} onChange={pg.setPage} />
    </Box>
  );
}

const ADDON_STATUS_COLOR: Record<AddonStatus, 'success' | 'error' | 'default'> = {
  compatible: 'success',
  incompatible: 'error',
  unknown: 'default',
};

function AddonCompatibilityTable({ report, embedded }: { report: Report; embedded?: boolean }) {
  const addons = report.addons ?? [];
  if (addons.length === 0) return null;
  return (
    <Box sx={{ mb: embedded ? 0 : 3 }}>
      {!embedded && (
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          Add-on Compatibility
        </Typography>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Add-on</TableCell>
            <TableCell>Version</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Note</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {addons.map(a => (
            <TableRow key={a.name}>
              <TableCell>{a.name}</TableCell>
              <TableCell>{a.version}</TableCell>
              <TableCell>
                <Chip
                  label={a.status}
                  color={ADDON_STATUS_COLOR[a.status] ?? 'default'}
                  size="small"
                  variant={a.status === 'unknown' ? 'outlined' : 'filled'}
                />
              </TableCell>
              <TableCell>
                {a.status === 'incompatible' && a.requiredVersion
                  ? `upgrade to ${a.requiredVersion}`
                  : '—'}
              </TableCell>
              <TableCell sx={{ maxWidth: 420 }}>
                <Typography variant="caption">{a.note ?? '—'}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

// Synthetic bucket holding cluster-scoped components (Nodes) — not a real
// Namespace, so it isn't navigable and is sorted last with distinct styling.
const CLUSTER_SCOPED_BUCKET = 'cluster-scoped';

// The operator serves report.json from an in-cluster Service named
// 'mirops-reports'. UpgradeAnalysis is cluster-scoped so it no longer carries a
// namespace to locate it, and the operator can be installed in any namespace.
// The deployer sets that namespace in headlamp-values.yaml; the initContainer
// writes it to a config.json next to the plugin, which we read at runtime. This
// default is the fallback when no config.json is present.
const REPORTS_SERVICE_NAME = 'mirops-reports';
const REPORTS_SERVICE_NAMESPACE = 'mirops';

// Read the operator's namespace from the plugin's runtime config.json (written
// by the Helm initContainer from headlamp-values.yaml). Falls back to the
// default until/unless the file resolves.
function useReportsNamespace(): string {
  const [namespace, setNamespace] = useState(REPORTS_SERVICE_NAMESPACE);
  useEffect(() => {
    fetch('/plugins/mirops/config.json')
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (cfg?.reportsNamespace) setNamespace(cfg.reportsNamespace);
      })
      .catch(() => {
        /* no config.json — keep the default */
      });
  }, []);
  return namespace;
}

function NamespaceRiskHeatmap({
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
                    ? () =>
                        history.push(
                          Router.createRouteURL('namespace', { name: ns.namespace })
                        )
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
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{title}</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map(c => <TableCell key={c.key}>{c.label}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map(c => <TableCell key={c.key}>{String(row[c.key] ?? '-')}</TableCell>)}
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
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>{title}</Typography>
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

// VerdictBanner is the upgrade go/no-go — a separate axis from the readiness gauge. Its color is the
// semaphore (allowed / not recommended / blocked); the health gauge stays on its own health color
// even here. The bridge line states plainly that the two describe different things, so a healthy
// score beside a blocked verdict never reads as a contradiction. The detailed blockers/conditions
// live in the report section below.
function VerdictBanner({
  decision,
  score,
  healthBand,
  reason,
}: {
  decision: Decision;
  score: number;
  healthBand: HealthBand;
  reason?: string;
}) {
  const cfg = {
    SAFE: { sev: 'success' as const, title: 'Upgrade allowed' },
    WARNING: { sev: 'warning' as const, title: 'Not recommended' },
    CRITICAL: { sev: 'error' as const, title: 'Upgrade blocked' },
    ERROR: { sev: 'info' as const, title: 'Analysis error' },
  }[decision];

  const bridge =
    decision === 'SAFE'
      ? 'Cluster is healthy and nothing blocks the upgrade — ready to go.'
      : decision === 'WARNING'
        ? `Cluster health is ${score}${healthBand === 'SAFE' ? ' (good)' : ''}, but the cluster is unstable — not blocked, but stabilize it before upgrading.`
        : `Cluster health (${score}) is a separate reading — a blocker prevents the upgrade until it's fixed (see below).`;

  return (
    <Alert severity={cfg.sev} sx={{ mb: 1.5 }}>
      <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>{cfg.title}</AlertTitle>
      {decision !== 'SAFE' && reason && (
        <Typography variant="body2" sx={{ mb: 0.5, color: 'text.primary' }}>
          {reason}
        </Typography>
      )}
      <Typography variant="body2" sx={{ color: 'text.primary' }}>
        {bridge}
      </Typography>
    </Alert>
  );
}

// buildWarnings gathers the non-blocking issues to show in Findings. Blockers come straight from
// report.decision.blockers; warnings are the "attention, but not a hard stop" items.
function buildWarnings(report: Report, score: number, safeThreshold: number): string[] {
  const warnings: string[] = [];
  const blocked = (report.decision.blockers?.length ?? 0) > 0;
  // report.reason describes the top non-blocking issue (e.g. pods not ready). Show it when the
  // cluster is unstable but that instability isn't already listed as a hard blocker.
  if (report.conditions.unstableCluster && !blocked && report.reason) {
    warnings.push(report.reason);
  }
  if (score < safeThreshold) {
    warnings.push(`Readiness score ${score} is below the SAFE bar (${safeThreshold})`);
  }
  return warnings;
}

// Findings is the single "what's wrong" block at the top of the Analysis Report: blockers (must fix)
// and warnings (don't block), listed for every verdict — so the report is informative whether the
// upgrade is blocked, not recommended, or clear. The data sections below are unchanged.
function Findings({ blockers, warnings }: { blockers: string[]; warnings: string[] }) {
  const clean = blockers.length === 0 && warnings.length === 0;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Findings
      </Typography>
      {clean && (
        <Alert severity="success">No issues found — the cluster is ready to upgrade.</Alert>
      )}
      {blockers.length > 0 && (
        <Alert severity="error" sx={{ mb: warnings.length ? 1.5 : 0 }}>
          <AlertTitle>Blockers — must be fixed first</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.primary' }}>
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </Box>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert severity="warning">
          <AlertTitle>Warnings — won&apos;t block the upgrade</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.primary' }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </Box>
        </Alert>
      )}
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
function PVCTable({ rows }: { rows: NonNullable<Report['workloads']['pvcs']> }) {
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
function NodesTable({ rows }: { rows: Report['workloads']['nodes'] }) {
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
function WorkloadsData({ report }: { report: Report }) {
  const [onlyProblems, setOnlyProblems] = useState(true);
  const w = report.workloads;
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
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
      >
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
        status={j => `${j.active} active`}
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
function BarePodsTable({ rows }: { rows: NonNullable<Report['workloads']['barePods']> }) {
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

// GraphEmptyState is what the Dependency Graph tab shows when there are no dependency chains (no
// edges). Most add-ons are isolated, so unless something actually depends on an at-risk component
// (a Lost PVC, a down node, istio sidecars, a TLS ingress → workloads) there is no blast radius to
// draw. Rather than a lone node in an empty canvas, explain why and point back to the add-on table.
function GraphEmptyState({
  hasAddonIssue,
  onGoToAddons,
}: {
  hasAddonIssue: boolean;
  onGoToAddons: () => void;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Box
        component="svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        sx={{ width: 44, height: 44, color: 'text.disabled', mb: 1 }}
      >
        <path d="M9 17H7A5 5 0 0 1 7 7" />
        <path d="M15 7h2a5 5 0 0 1 4 8" />
        <line x1="8" y1="12" x2="12" y2="12" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </Box>
      <Typography variant="subtitle1" fontWeight={600} color="text.secondary" gutterBottom>
        No dependency chains
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mb: 2 }}>
        Nothing in this cluster depends on the at-risk components, so there&apos;s no blast radius to
        draw.{hasAddonIssue && ' The at-risk add-on is listed under Add-on Compatibility.'}
      </Typography>
      {hasAddonIssue && (
        <Button variant="contained" size="small" onClick={onGoToAddons}>
          Go to Add-on Compatibility
        </Button>
      )}
    </Box>
  );
}

// RiskCompatibilityTabs collapses the three lenses on the logical mirror — Add-on Compatibility,
// Namespace Risk, and the Dependency Graph — into one tabbed section (switch, don't scroll through
// three stacked blocks). It opens context-aware: on the add-on tab when something is incompatible
// (a hard blocker), otherwise namespace risk; never the graph, which is often empty. Each tab
// carries a count badge. The graph tab is conditional — dimmed, and clicking it shows a "no
// dependency chains" empty-state — whenever the graph has no edges.
function RiskCompatibilityTabs({ report }: { report: Report }) {
  const addons = report.addons ?? [];
  const byNamespace = report.risk?.byNamespace ?? [];
  const graph = report.graph;

  const hasAddons = addons.length > 0;
  const hasNamespaces = byNamespace.length > 0;
  const hasGraph = !!graph && graph.nodes.length > 0;

  const incompatibleCount = addons.filter(a => a.status === 'incompatible').length;
  const atRiskNamespaces = byNamespace.filter(n => n.atRisk > 0).length;
  const chainCount = graph?.edges?.length ?? 0;
  const hasChains = chainCount > 0;

  // Context-aware default: land on whatever is wrong. Incompatible add-ons first (a hard blocker),
  // then namespace risk; never default to the graph.
  const defaultTab: 'addon' | 'ns' | 'graph' =
    incompatibleCount > 0 && hasAddons
      ? 'addon'
      : hasNamespaces
        ? 'ns'
        : hasAddons
          ? 'addon'
          : 'graph';
  const [tab, setTab] = useState<'addon' | 'ns' | 'graph'>(defaultTab);

  if (!hasAddons && !hasNamespaces && !hasGraph) return null;

  const chipSx = { ml: 0.75, height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Risk &amp; Compatibility
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
      >
        {hasAddons && (
          <Tab
            value="addon"
            sx={{ minHeight: 40, textTransform: 'none' }}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Add-on Compatibility
                {incompatibleCount > 0 && (
                  <Chip label={incompatibleCount} size="small" color="error" sx={chipSx} />
                )}
              </Box>
            }
          />
        )}
        {hasNamespaces && (
          <Tab
            value="ns"
            sx={{ minHeight: 40, textTransform: 'none' }}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Namespace Risk
                {atRiskNamespaces > 0 && (
                  <Chip label={atRiskNamespaces} size="small" color="warning" sx={chipSx} />
                )}
              </Box>
            }
          />
        )}
        {hasGraph && (
          <Tab
            value="graph"
            // Dimmed (not disabled) when there are no chains, so it stays clickable and can explain
            // why it's empty instead of just being unavailable.
            sx={{ minHeight: 40, textTransform: 'none', opacity: hasChains ? 1 : 0.55 }}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                Dependency Graph
                <Chip
                  label={`${chainCount} ${chainCount === 1 ? 'chain' : 'chains'}`}
                  size="small"
                  variant="outlined"
                  sx={chipSx}
                />
              </Box>
            }
          />
        )}
      </Tabs>
      <Box sx={{ pt: 2 }}>
        {tab === 'addon' && hasAddons && <AddonCompatibilityTable report={report} embedded />}
        {tab === 'ns' && hasNamespaces && (
          <NamespaceRiskHeatmap byNamespace={byNamespace} embedded />
        )}
        {tab === 'graph' &&
          hasGraph &&
          (hasChains ? (
            <DependencyGraph graph={graph!} />
          ) : (
            <GraphEmptyState
              hasAddonIssue={incompatibleCount > 0}
              onGoToAddons={() => setTab('addon')}
            />
          ))}
      </Box>
    </Box>
  );
}

export function UpgradeAnalysisDetail() {
  const { name } = useParams<{ name: string }>();
  const [item, error] = UpgradeAnalysis.useGet(name);
  const [plans] = RemediationPlan.useList();
  const reportsNamespace = useReportsNamespace();
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Re-arm the report poll only when a *new* report is actually expected — the CR first loads
  // (hasItem), a fresh analysis completes (lastAnalysisTime changes), or a write fails
  // (reportState). Depending on the whole `item` re-ran this on every watch tick (status
  // heartbeats, observedGeneration bumps), which reset the view to "Generating…" over and over.
  const hasItem = !!item;
  const pollReportState = item?.status?.reportState;
  const pollLastAnalysis = item?.status?.lastAnalysisTime;

  useEffect(() => {
    if (!hasItem || !name) return;

    // Poll the report endpoint rather than trusting a single read: right after an analysis the
    // export may still be in flight (the object isn't in storage yet → 404) and the CR watch can
    // lag, so a one-shot fetch gets stuck on "Generating…". Retry quietly until the report is
    // available; only surface an error after the operator reports a hard failure or retries run out.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const maxAttempts = 20; // ~1 min at 3s

    // The operator serves reports from an in-cluster service not reachable from the browser
    // directly; route through the Kubernetes API server service proxy via Headlamp's backend.
    const path =
      `/api/v1/namespaces/${reportsNamespace}/services/${REPORTS_SERVICE_NAME}:8084` +
      `/proxy/reports/${name}.json`;

    setReportLoading(true);
    setReportError(null);
    setReport(null);

    const attempt = () => {
      // Hard failure recorded by the operator (banner above): stop retrying.
      if (pollReportState === 'failed') {
        if (!cancelled) setReportLoading(false);
        return;
      }
      ApiProxy.request(path)
        .then((data: Report) => {
          if (cancelled) return;
          setReport(data);
          setReportLoading(false);
        })
        .catch(e => {
          if (cancelled) return;
          attempts += 1;
          if (attempts >= maxAttempts) {
            setReportError(extractReportError(e));
            setReportLoading(false);
          } else {
            timer = setTimeout(attempt, 3000); // report not written yet — keep waiting
          }
        });
    };
    attempt();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, reportsNamespace, hasItem, pollLastAnalysis, pollReportState]);

  if (error) return <Alert severity="error">{String(error)}</Alert>;
  if (!item) return <CircularProgress />;

  const status = item.status ?? {};
  const decision = status.decision ?? 'WARNING';
  const score = status.totalScore ?? 0;

  // Health band = the score on its own axis (SAFE ≥ profile threshold, else FAIR, then AT_RISK). It
  // colors the gauge and is independent of the decision/verdict, so the two never contradict.
  const safeThreshold = (item.spec?.scoringProfile ?? 'production') === 'production' ? 90 : 85;
  const healthBand: HealthBand = score >= safeThreshold ? 'SAFE' : score >= 60 ? 'FAIR' : 'AT_RISK';

  // "Generating report…" while the report is still being polled (the export may be in flight); it
  // resolves to the report or an error once polling settles.
  const reportPending = reportLoading && !report && !reportError;

  // Re-run the analysis on demand. The operator re-reconciles when the
  // 'mirops.io/refresh' annotation changes (bypassing the resync interval); this
  // is a merge patch that only touches the annotation.
  async function reanalyze() {
    if (!item) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await item.patch({
        metadata: { annotations: { 'mirops.io/refresh': String(Date.now()) } },
      });
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  // decision === ERROR is a config error (e.g. targetVersion not higher than the
  // live cluster): the analysis did not run, so there is no score/report. Render
  // a config-error banner instead of the normal verdict + report flow.
  if (decision === 'ERROR') {
    return (
      <SectionBox title={`Upgrade Analysis: ${name}`}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={600}>Configuration error</Typography>
          <Typography variant="body2">
            {status.reason ??
              'This analysis could not run. Check that spec.targetVersion is higher than the current cluster version.'}
          </Typography>
        </Alert>
        {item.spec?.targetVersion && (
          <Chip label={`Target: ${item.spec.targetVersion}`} size="small" variant="outlined" />
        )}
      </SectionBox>
    );
  }

  // The operator writes status (verdict + score + AI) once the analysis finishes; until then there is
  // no verdict yet. Render one "analyzing" spinner instead of a placeholder WARNING verdict and a
  // premature "AI unavailable" banner that would flash before the real result lands. On a re-analysis
  // the previous status is still present, so this only shows on the very first run.
  if (!status.decision) {
    return (
      <SectionBox title={`Upgrade Analysis: ${name}`}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress size={22} />
          <Typography variant="body1">
            Analyzing cluster — evaluating readiness
            {item.spec?.ai?.enabled ? ' and running AI scoring' : ''}…
          </Typography>
        </Box>
      </SectionBox>
    );
  }

  // The operator links a RemediationPlan back to its analysis via
  // spec.upgradeAnalysisRef (no annotation on the analysis itself).
  const remediationPlan = plans?.find(p => p.spec?.upgradeAnalysisRef === name);
  const remediationRef = remediationPlan?.metadata.name;

  // AI was requested but failed: the operator sets status.aiError (categorized).
  // Older operators only logged it, so also fall back to a heuristic.
  const aiRequested = item.spec?.ai?.enabled === true;
  const aiFailed =
    !!status.aiError || (aiRequested && !status.aiReasoning && !status.aiScore);
  const remediationRequested = aiRequested && item.spec?.ai?.remediation?.enabled === true;

  return (
    <>
      {/* Header */}
      <SectionBox title={`Upgrade Analysis: ${name}`}>
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <ScoreGauge score={score} band={healthBand} />
          <Box sx={{ flex: 1 }}>
            <VerdictBanner decision={decision} score={score} healthBand={healthBand} reason={status.reason} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
              {item.spec?.targetVersion && (
                <Chip label={`Target: ${item.spec.targetVersion}`} size="small" variant="outlined" />
              )}
              <Chip
                label={`Profile: ${item.spec?.scoringProfile ?? 'production'}`}
                size="small"
                variant="outlined"
                color={(item.spec?.scoringProfile ?? 'production') === 'production' ? 'primary' : 'default'}
              />
              {status.addonsChecked !== undefined && status.addonsChecked > 0 && (
                <Chip
                  label={`Add-ons: ${status.addonsChecked} checked · ${status.incompatibleAddons ?? 0} incompatible`}
                  size="small"
                  variant="outlined"
                  color={(status.incompatibleAddons ?? 0) > 0 ? 'error' : 'success'}
                />
              )}
            </Box>
            {/* Button first so it holds a stable position; the remediation link sits beside it and
                appears (once the plan loads) without shifting the button. */}
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="contained" size="small" disabled={refreshing} onClick={reanalyze}>
                {refreshing ? <CircularProgress size={18} /> : 'Re-analyze'}
              </Button>
              {remediationRef && (
                <Box sx={{ ml: 'auto' }}>
                  <Link routeName="remediationPlanDetail" params={{ name: remediationRef }}>
                    View Remediation Plan →
                  </Link>
                </Box>
              )}
            </Box>
            {refreshError && (
              <Alert severity="error" sx={{ mt: 1 }}>{refreshError}</Alert>
            )}
          </Box>
        </Box>

        {/* Report write failed in the operator — the verdict above is still
            valid, but the full report body may be unavailable. */}
        {status.reportState === 'failed' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>
              Report could not be written
            </Typography>
            <Typography variant="body2">
              The analysis ran and the verdict above is valid, but the operator failed to write the
              report{status.reportLocation ? ` to ${status.reportLocation}` : ''}.
            </Typography>
            {status.reportError && (
              <Typography
                variant="body2"
                component="pre"
                sx={{ mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}
              >
                {status.reportError}
              </Typography>
            )}
          </Alert>
        )}

        {/* Conditions */}
        {status.conditions && status.conditions.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {status.conditions.map(c => (
                <TableRow key={c.type}>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>{c.reason ?? '-'}</TableCell>
                  <TableCell>{c.message ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionBox>

      {/* Report section — while the report is still being fetched show only the spinner; once it
          resolves, render the AI reasoning and the report body together, so nothing appears above a
          still-loading report. */}
      <SectionBox>
        {reportPending ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Generating report…
            </Typography>
          </Box>
        ) : (
          <>
            {/* AI Reasoning — with the report, once "Generating report…" finishes */}
            {status.aiReasoning && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>AI Reasoning ({status.aiModel})</Typography>
                <Typography variant="body2">{status.aiReasoning}</Typography>
              </Alert>
            )}
            {/* AI was enabled but produced no result → it failed in the operator */}
            {aiFailed && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  AI unavailable — showing base analysis only
                </Typography>
                <Typography variant="body2">
                  AI scoring was enabled but the AI call failed, so the score and decision
                  above are the base analysis only
                  {remediationRequested && ', and no RemediationPlan was generated'}.
                </Typography>
                {status.aiError ? (
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{ mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.8rem' }}
                  >
                    {status.aiError}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Check the operator logs for the exact cause (common: invalid/empty API
                    key or insufficient API credits).
                  </Typography>
                )}
              </Alert>
            )}
            {reportError && (
              <Alert severity="warning">
                Could not load report: {reportError}
              </Alert>
            )}
            {report && (
          <>
            {/* One consolidated Findings block: blockers (must fix) and warnings (don't block),
                for every verdict — so the report always says what's wrong and whether it stops the
                upgrade. The data sections below (metrics, breakdown, add-ons, risk, graph) follow. */}
            <Findings
              blockers={report.decision.blockers ?? []}
              warnings={buildWarnings(report, score, safeThreshold)}
            />

            {/* Metrics grid */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Total Pods" value={report.metrics.pods.total} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Not Ready" value={report.metrics.pods.notReady} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Restarts" value={report.metrics.pods.restarts} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Deprecated APIs" value={report.metrics.compatibility.deprecatedApis} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard
                  label="CPU Pressure"
                  value={`${(report.metrics.resources.cpuPressure * 100).toFixed(1)}%`}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard
                  label="Memory Pressure"
                  value={`${(report.metrics.resources.memoryPressure * 100).toFixed(1)}%`}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard
                  label="Pod Drop Ratio"
                  value={`${(report.metrics.stability.podDropRatio * 100).toFixed(1)}%`}
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Restart Delta" value={report.metrics.stability.restartDelta} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Add-on Issues" value={report.metrics.compatibility.addonIssues} />
              </Grid>
            </Grid>

            {/* Score breakdown */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Score Breakdown</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={2}>
                <MetricCard label="Total" value={report.scores.total} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <MetricCard label="Health" value={report.scores.base.health} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <MetricCard label="Capacity" value={report.scores.base.capacity} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <MetricCard label="Stability" value={report.scores.base.stability} />
              </Grid>
              <Grid item xs={6} sm={2}>
                <MetricCard label="Compatibility" value={report.scores.base.compatibility} />
              </Grid>
              {report.scores.ai && (
                <Grid item xs={6} sm={2}>
                  <MetricCard label={`AI (${report.scores.ai.model ?? 'model'})`} value={report.scores.ai.score} />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* Logical mirror — one tabbed section (add-on compatibility · namespace risk ·
                dependency graph) with a context-aware default and a conditional graph tab. */}
            <RiskCompatibilityTabs report={report} />

            {/* Workloads — raw inventory with an "only problems" toggle */}
            <WorkloadsData report={report} />

            {/* Issues — paged, one CrashLoopBackOff pod per line can be dozens of entries */}
            <IssuesSection issues={report.issues} />

            {/* AI Reasoning from report */}
            {report.aiReasoning && !status.aiReasoning && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>AI Reasoning</Typography>
                <Typography variant="body2">{report.aiReasoning}</Typography>
              </Alert>
            )}

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outlined" size="small" onClick={() => setShowRawJson(true)}>
                Raw JSON
              </Button>
            </Box>
          </>
            )}
          </>
        )}
      </SectionBox>

      <Dialog open={showRawJson} onClose={() => setShowRawJson(false)} maxWidth="md" fullWidth>
        <DialogTitle>Raw Report JSON</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{ m: 0, fontSize: '0.75rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          >
            {JSON.stringify(report, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            size="small"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(report, null, 2));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button size="small" onClick={() => setShowRawJson(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
