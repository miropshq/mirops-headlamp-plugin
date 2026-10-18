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
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { componentLabel } from '../format';
import { useDefaultMirror } from '../mirror';
import { useReport } from '../reports';
import { RemediationPlan, UpgradeAnalysis } from '../resources';
import { AddonImpact, AddonStatus, Decision, Report } from '../types';
import { DependencyGraph } from './DependencyGraph';
import { IssuesSection } from './IssuesSection';
import { NamespaceRiskHeatmap } from './NamespaceRiskHeatmap';
import { ScoreBreakdown } from './ScoreBreakdown';
import { HealthBand, ScoreGauge } from './ScoreGauge';
import { WorkloadsData } from './WorkloadsData';

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h6" fontWeight={700}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
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
        Add-on compatibility with {report.targetVersion}
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
                {a.status === 'incompatible'
                  ? a.requiredVersion
                    ? `upgrade to ${a.requiredVersion}`
                    : 'no version available'
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
      ? `Cluster health is ${score}${
          healthBand === 'SAFE' ? ' (good)' : ''
        }, but the cluster is unstable — not blocked, but stabilize it before upgrading.`
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

// How many affected components UpgradeImpact names before "and N more".
const IMPACT_SHOWN = 8;

// UpgradeImpact is the upgrade's own blast radius: for each add-on the target version breaks, what
// depends on it. Nothing renders when no add-on is incompatible (or the report predates the field).
function UpgradeImpact({
  impact,
  targetVersion,
}: {
  impact: AddonImpact[];
  targetVersion: string;
}) {
  if (impact.length === 0) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        Upgrade impact
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        What depends on each add-on that Kubernetes {targetVersion} breaks.
      </Typography>
      {impact.map(i => {
        const affected = i.affected ?? [];
        return (
          <Paper
            key={i.addon}
            variant="outlined"
            sx={{ p: 2, mb: 1, display: 'flex', gap: 3, flexWrap: 'wrap' }}
          >
            <Box sx={{ minWidth: 200 }}>
              <Typography variant="body1" fontWeight={600}>
                {i.addon} {i.version}
              </Typography>
              {i.requiredVersion && (
                <Typography variant="body2" color="text.secondary">
                  Needs {i.requiredVersion} for Kubernetes {targetVersion}
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                {affected.length === 0
                  ? 'Nothing depends on it'
                  : `${affected.length} component${
                      affected.length === 1 ? ' depends' : 's depend'
                    } on it`}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {affected.slice(0, IMPACT_SHOWN).map(id => (
                  <Chip
                    key={id}
                    label={componentLabel(id)}
                    size="small"
                    variant="outlined"
                    sx={{ fontFamily: 'monospace' }}
                  />
                ))}
                {affected.length > IMPACT_SHOWN && (
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    and {affected.length - IMPACT_SHOWN} more
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}

// UpgradeChecks are the metrics that only matter because of the upgrade: removed APIs and add-on
// issues for the new version, and the headroom and stability the node drain depends on. Pod counts
// are the cluster's current state and live in the mirror.
function UpgradeChecks({ report }: { report: Report }) {
  const m = report.metrics;
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const checks: [string, string | number][] = [
    ['Deprecated APIs', m.compatibility.deprecatedApis],
    ['Add-on Issues', m.compatibility.addonIssues],
    ['CPU Pressure', pct(m.resources.cpuPressure)],
    ['Memory Pressure', pct(m.resources.memoryPressure)],
    ['Pod Drop Ratio', pct(m.stability.podDropRatio)],
    ['Restart Delta', m.stability.restartDelta],
  ];
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        Upgrade checks
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        What draining the nodes and the new version depend on.
      </Typography>
      <Grid container spacing={2}>
        {checks.map(([label, value]) => (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <MetricCard label={label} value={value} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// LegacyClusterState keeps the cluster-state sections for reports from operators before 0.2.0, which
// have no ClusterMirror to show them in.
function LegacyClusterState({ report }: { report: Report }) {
  const byNamespace = report.risk?.byNamespace ?? [];
  const hasChains = (report.graph?.edges?.length ?? 0) > 0;
  return (
    <>
      <Divider sx={{ mb: 3 }} />
      <NamespaceRiskHeatmap byNamespace={byNamespace} />
      {hasChains && report.graph && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Dependency Graph
          </Typography>
          <DependencyGraph graph={report.graph} />
        </Box>
      )}
      <WorkloadsData workloads={report.workloads} />
      <IssuesSection issues={report.issues} />
    </>
  );
}

export function UpgradeAnalysisDetail() {
  const { name } = useParams<{ name: string }>();
  const [item, error] = UpgradeAnalysis.useGet(name);
  const [plans] = RemediationPlan.useList();
  const { mirror } = useDefaultMirror();
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Re-arm the report poll only when a *new* report is expected — a fresh analysis completes
  // (lastAnalysisTime changes) or a write fails (reportState, which also stops the retries). Reports
  // use the `.mirops` extension (JSON content) for every destination, local included.
  const {
    report,
    error: reportError,
    loading: reportLoading,
  } = useReport<Report>(name ? `${name}.mirops` : undefined, {
    enabled: !!item,
    refreshKey: item?.status?.lastAnalysisTime,
    failed: item?.status?.reportState === 'failed',
  });

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
          <Typography variant="subtitle2" fontWeight={600}>
            Configuration error
          </Typography>
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
  const aiFailed = !!status.aiError || (aiRequested && !status.aiReasoning && !status.aiScore);
  const remediationRequested = aiRequested && item.spec?.ai?.remediation?.enabled === true;

  return (
    <>
      {/* Header */}
      <SectionBox title={`Upgrade Analysis: ${name}`}>
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <ScoreGauge score={score} band={healthBand} />
          <Box sx={{ flex: 1 }}>
            <VerdictBanner
              decision={decision}
              score={score}
              healthBand={healthBand}
              reason={status.reason}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
              {item.spec?.targetVersion && (
                <Chip
                  label={`Target: ${item.spec.targetVersion}`}
                  size="small"
                  variant="outlined"
                />
              )}
              <Chip
                label={`Profile: ${item.spec?.scoringProfile ?? 'production'}`}
                size="small"
                variant="outlined"
                color={
                  (item.spec?.scoringProfile ?? 'production') === 'production'
                    ? 'primary'
                    : 'default'
                }
              />
              {status.addonsChecked !== undefined && status.addonsChecked > 0 && (
                <Chip
                  label={`Add-ons: ${status.addonsChecked} checked · ${
                    status.incompatibleAddons ?? 0
                  } incompatible`}
                  size="small"
                  variant="outlined"
                  color={(status.incompatibleAddons ?? 0) > 0 ? 'error' : 'success'}
                />
              )}
            </Box>
            {/* Score breakdown — the four readiness dimensions as status bars, right in the header
                next to the gauge. Renders once the report is loaded (it carries the sub-scores). */}
            {report && <ScoreBreakdown base={report.scores.base} ai={report.scores.ai} />}
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
              <Alert severity="error" sx={{ mt: 1 }}>
                {refreshError}
              </Alert>
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
              {/* "Loading" once the operator has written the report (reportState = written) — we're
                  just fetching the file; "Generating" only while the analysis is still producing it. */}
              {status.reportState === 'written' ? 'Loading report…' : 'Generating report…'}
            </Typography>
          </Box>
        ) : (
          <>
            {/* AI Reasoning — with the report, once "Generating report…" finishes */}
            {status.aiReasoning && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  AI Reasoning ({status.aiModel})
                </Typography>
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
                  AI scoring was enabled but the AI call failed, so the score and decision above are
                  the base analysis only
                  {remediationRequested && ', and no RemediationPlan was generated'}.
                </Typography>
                {status.aiError ? (
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      mt: 1,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                    }}
                  >
                    {status.aiError}
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Check the operator logs for the exact cause (common: invalid/empty API key or
                    insufficient API credits).
                  </Typography>
                )}
              </Alert>
            )}
            {reportError && <Alert severity="warning">Could not load report: {reportError}</Alert>}
            {report && (
              <>
                {/* The cluster's current state (workloads, problems, namespace risk, the graph) lives
                in the mirror; this report shows only what the upgrade adds. */}
                {report.kind && mirror && (
                  <Alert
                    severity="info"
                    sx={{ mb: 3 }}
                    action={
                      <Link routeName="clusterMirrorDetail" params={{ name: mirror.metadata.name }}>
                        Open Cluster Mirror →
                      </Link>
                    }
                  >
                    The cluster&apos;s state — workloads, problems, namespace risk and the full
                    dependency graph — is in Cluster Mirror.
                  </Alert>
                )}

                {/* One consolidated Findings block: blockers (must fix) and warnings (don't block),
                for every verdict — so the report always says what's wrong and whether it stops the
                upgrade. A current-state problem that blocks the upgrade (a Lost PVC) is listed here
                too, since it explains the verdict; its detail is in the mirror. */}
                <Findings
                  blockers={report.decision.blockers ?? []}
                  warnings={buildWarnings(report, score, safeThreshold)}
                />

                <UpgradeImpact
                  impact={report.upgradeImpact ?? []}
                  targetVersion={report.targetVersion}
                />

                <AddonCompatibilityTable report={report} />

                <UpgradeChecks report={report} />

                {/* Operators before 0.2.0 have no mirror, so their reports keep the cluster-state
                sections here. */}
                {!report.kind && <LegacyClusterState report={report} />}

                {/* AI Reasoning from report */}
                {report.aiReasoning && !status.aiReasoning && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      AI Reasoning
                    </Typography>
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
            sx={{
              m: 0,
              fontSize: '0.75rem',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
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
          <Button size="small" onClick={() => setShowRawJson(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
