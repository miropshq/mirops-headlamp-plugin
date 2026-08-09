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
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
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

function ConditionAlert({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return <Alert severity="warning" sx={{ mb: 1 }}>{label}</Alert>;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h6" fontWeight={700}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

const ADDON_STATUS_COLOR: Record<AddonStatus, 'success' | 'error' | 'default'> = {
  compatible: 'success',
  incompatible: 'error',
  unknown: 'default',
};

function AddonCompatibilityTable({ report }: { report: Report }) {
  const addons = report.addons ?? [];
  if (addons.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Add-on Compatibility
      </Typography>
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

function NamespaceRiskHeatmap({ byNamespace }: { byNamespace: NamespaceRisk[] }) {
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
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
        Namespace Risk
      </Typography>
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
          {rows.map((row, i) => {
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
                  {problemPods.length === 0 ? (
                    '—'
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {problemPods.map(p => (
                        <Box
                          key={p.name}
                          sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}
                        >
                          <Link
                            routeName="Pod"
                            params={{ namespace: row.namespace, name: p.name }}
                          >
                            {p.name}
                          </Link>
                          {p.reason && (
                            <Chip label={p.reason} size="small" color="warning" variant="outlined" />
                          )}
                          {p.restarts > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {p.restarts} restarts
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          {reason}
        </Typography>
      )}
      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        {bridge}
      </Typography>
    </Alert>
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

  useEffect(() => {
    if (!item || !name) return;

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
      if ((item.status ?? {}).reportState === 'failed') {
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
  }, [item, name, reportsNamespace]);

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
            {remediationRef && (
              <Box sx={{ mt: 1 }}>
                <Link
                  routeName="remediationPlanDetail"
                  params={{ name: remediationRef }}
                >
                  View Remediation Plan →
                </Link>
              </Box>
            )}
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" size="small" disabled={refreshing} onClick={reanalyze}>
                {refreshing ? <CircularProgress size={18} /> : 'Re-analyze'}
              </Button>
              {refreshError && (
                <Alert severity="error" sx={{ mt: 1 }}>{refreshError}</Alert>
              )}
            </Box>
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

        {/* AI Reasoning */}
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

      {/* Report section */}
      <SectionBox title="Analysis Report">
        {reportPending && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Generating report…
            </Typography>
          </Box>
        )}
        {reportError && (
          <Alert severity="warning">
            Could not load report: {reportError}
          </Alert>
        )}
        {report && (
          <>
            {/* Why blocked — the red verdict comes with its explicit causes, so
                the headline never contradicts the detail. Falls back to the
                single-line reason when blockers is empty. */}
            {report.decision.level === 'CRITICAL' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>Upgrade blocked</AlertTitle>
                {report.decision.blockers?.length ? (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                    {report.decision.blockers.map(b => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  report.reason
                )}
              </Alert>
            )}

            {/* Conditions warnings */}
            <Box sx={{ mb: 2 }}>
              <ConditionAlert label="PDB is blocking upgrades" active={report.conditions.pdbBlocking} />
              <ConditionAlert label="High CPU pressure detected" active={report.conditions.highCpuPressure} />
              <ConditionAlert label="High memory pressure detected" active={report.conditions.highMemoryPressure} />
              <ConditionAlert label="Cluster is unstable" active={report.conditions.unstableCluster} />
            </Box>

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

            {/* Logical mirror: add-on compatibility, namespace risk, dependency graph */}
            <AddonCompatibilityTable report={report} />
            {report.risk?.byNamespace && (
              <NamespaceRiskHeatmap byNamespace={report.risk.byNamespace} />
            )}
            {report.graph && <DependencyGraph graph={report.graph} />}

            {/* Workloads */}
            {report.workloads.nodes.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Nodes</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.workloads.nodes.map(n => (
                      <TableRow key={n.name}>
                        <TableCell>
                          <Link routeName="node" params={{ name: n.name }}>{n.name}</Link>
                        </TableCell>
                        <TableCell>{n.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
            <WorkloadSection
              title="Deployments"
              routeName="Deployment"
              rows={report.workloads.deployments}
              status={d => `${d.readyReplicas}/${d.desiredReplicas} ready`}
            />
            <WorkloadSection
              title="StatefulSets"
              routeName="StatefulSet"
              rows={report.workloads.statefulsets}
              status={d => `${d.readyReplicas}/${d.desiredReplicas} ready`}
            />
            <WorkloadSection
              title="DaemonSets"
              routeName="DaemonSet"
              rows={report.workloads.daemonsets}
              status={d => `${d.numberUnavailable} unavailable`}
            />
            <WorkloadSection
              title="Jobs"
              routeName="Job"
              rows={report.workloads.jobs}
              status={j => `${j.active} active`}
            />
            {report.workloads.deprecatedApis && report.workloads.deprecatedApis.length > 0 && (
              <WorkloadTable
                title="Deprecated APIs"
                rows={report.workloads.deprecatedApis}
                columns={[
                  { label: 'Group', key: 'group' },
                  { label: 'Version', key: 'version' },
                  { label: 'Resource', key: 'resource' },
                  { label: 'Removed In', key: 'removedIn' },
                ]}
              />
            )}

            {/* Issues */}
            {report.issues && report.issues.length > 0 && (
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Issues</Typography>
                {report.issues.map((issue, i) => (
                  <Alert key={i} severity="warning" sx={{ mb: 1 }}>{issue}</Alert>
                ))}
              </Box>
            )}

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
