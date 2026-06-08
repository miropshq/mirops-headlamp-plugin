import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { Link, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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
import { useParams } from 'react-router-dom';
import { UpgradeAnalysis } from '../resources';
import { Report } from '../types';
import { DecisionChip } from './DecisionChip';
import { ScoreGauge } from './ScoreGauge';

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

export function UpgradeAnalysisDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const [item, error] = UpgradeAnalysis.useGet(name, namespace);
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (!item || !namespace || !name) return;
    setReportLoading(true);
    setReportError(null);

    // The operator serves reports from an in-cluster service that is not
    // reachable from the browser directly. Route the request through the
    // Kubernetes API server service proxy via Headlamp's backend.
    const path =
      `/api/v1/namespaces/${namespace}/services/mirops-operator-reports:8084` +
      `/proxy/reports/${name}.json`;
    ApiProxy.request(path)
      .then((data: Report) => setReport(data))
      .catch(e => setReportError(e.message))
      .finally(() => setReportLoading(false));
  }, [item, namespace, name]);

  if (error) return <Alert severity="error">{String(error)}</Alert>;
  if (!item) return <CircularProgress />;

  const status = item.status ?? {};
  const decision = status.decision ?? 'WARNING';
  const score = status.totalScore ?? 0;
  const remediationRef = item.metadata?.annotations?.['mirops.io/remediation-plan'];

  return (
    <>
      {/* Header */}
      <SectionBox title={`Upgrade Analysis: ${name}`}>
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <ScoreGauge score={score} decision={decision} />
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <DecisionChip decision={decision} />
              {item.spec?.targetVersion && (
                <Chip label={`Target: ${item.spec.targetVersion}`} size="small" variant="outlined" />
              )}
            </Box>
            {status.reason && (
              <Typography variant="body2" color="text.secondary">{status.reason}</Typography>
            )}
            {remediationRef && (
              <Box sx={{ mt: 1 }}>
                <Link
                  routeName="remediationPlanDetail"
                  params={{ namespace, name: remediationRef }}
                >
                  View Remediation Plan →
                </Link>
              </Box>
            )}
          </Box>
        </Box>

        {/* AI Reasoning */}
        {status.aiReasoning && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600}>AI Reasoning ({status.aiModel})</Typography>
            <Typography variant="body2">{status.aiReasoning}</Typography>
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
        {reportLoading && <CircularProgress size={20} />}
        {reportError && (
          <Alert severity="warning">
            Could not load report: {reportError}
          </Alert>
        )}
        {report && (
          <>
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
                <MetricCard label="Pod Delta" value={report.metrics.stability.podDelta} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <MetricCard label="Restart Delta" value={report.metrics.stability.restartDelta} />
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
                <MetricCard label="Risk" value={report.scores.base.risk} />
              </Grid>
              {report.scores.ai && (
                <Grid item xs={6} sm={2}>
                  <MetricCard label={`AI (${report.scores.ai.model ?? 'model'})`} value={report.scores.ai.score} />
                </Grid>
              )}
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* Workloads */}
            <WorkloadTable
              title="Nodes"
              rows={report.workloads.nodes}
              columns={[
                { label: 'Name', key: 'name' },
                { label: 'Status', key: 'status' },
              ]}
            />
            <WorkloadTable
              title="Deployments"
              rows={report.workloads.deployments.map(d => ({
                ...d,
                replicas: `${d.readyReplicas}/${d.desiredReplicas}`,
              }))}
              columns={[
                { label: 'Namespace', key: 'namespace' },
                { label: 'Name', key: 'name' },
                { label: 'Ready', key: 'replicas' },
              ]}
            />
            <WorkloadTable
              title="StatefulSets"
              rows={report.workloads.statefulsets.map(d => ({
                ...d,
                replicas: `${d.readyReplicas}/${d.desiredReplicas}`,
              }))}
              columns={[
                { label: 'Namespace', key: 'namespace' },
                { label: 'Name', key: 'name' },
                { label: 'Ready', key: 'replicas' },
              ]}
            />
            <WorkloadTable
              title="DaemonSets"
              rows={report.workloads.daemonsets}
              columns={[
                { label: 'Namespace', key: 'namespace' },
                { label: 'Name', key: 'name' },
                { label: 'Unavailable', key: 'numberUnavailable' },
              ]}
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
          </>
        )}
      </SectionBox>
    </>
  );
}
