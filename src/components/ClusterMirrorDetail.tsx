import { Link, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
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
import { componentLabel, durationLabel, parseGoDuration, timeAgo } from '../format';
import { mirrorReportFile } from '../mirror';
import { useReport } from '../reports';
import { ClusterMirror } from '../resources';
import { AtRiskComponent, MirrorReport } from '../types';
import { DependencyGraph } from './DependencyGraph';
import { IssuesSection } from './IssuesSection';
import { NamespaceRiskHeatmap } from './NamespaceRiskHeatmap';
import { PaginationBar, usePaginated } from './Pagination';
import { RiskBadge } from './RiskBadge';
import { WorkloadsData } from './WorkloadsData';

// The CRD defaults spec.refresh.interval to 5m; this covers a mirror created without it.
const DEFAULT_INTERVAL = '5m0s';

// How many dependents to name inline before "and N more".
const DEPENDENTS_SHOWN = 3;

// Headlamp routes for the kinds the mirror can link to. Kinds not listed (Service, Ingress, config,
// add-ons) render as plain text.
const ROUTE_BY_KIND: Record<string, { route: string; namespaced: boolean }> = {
  Deployment: { route: 'Deployment', namespaced: true },
  StatefulSet: { route: 'StatefulSet', namespaced: true },
  DaemonSet: { route: 'DaemonSet', namespaced: true },
  Job: { route: 'Job', namespaced: true },
  Pod: { route: 'Pod', namespaced: true },
  PVC: { route: 'persistentVolumeClaim', namespaced: true },
  Node: { route: 'node', namespaced: false },
};

function ComponentName({ c }: { c: AtRiskComponent }) {
  const target = ROUTE_BY_KIND[c.kind];
  if (!target || (target.namespaced && !c.namespace)) {
    return <Typography variant="body2">{c.name}</Typography>;
  }
  const params = target.namespaced ? { namespace: c.namespace, name: c.name } : { name: c.name };
  return (
    <Link routeName={target.route} params={params}>
      {c.name}
    </Link>
  );
}

function SummaryTile({
  value,
  label,
  caption,
}: {
  value: string | number;
  label: string;
  caption: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="h5" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>
    </Paper>
  );
}

// AtRiskTable lists the components at risk and what depends on each one — what breaks if it fails. A
// component that's fine itself but depends on something broken says where its risk comes from.
function AtRiskTable({ rows }: { rows: AtRiskComponent[] }) {
  const pg = usePaginated(rows);
  if (rows.length === 0) {
    return <Alert severity="success">Nothing is at risk right now.</Alert>;
  }
  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Component</TableCell>
            <TableCell>Namespace</TableCell>
            <TableCell>Risk</TableCell>
            <TableCell>Why</TableCell>
            <TableCell>Depended on by</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pg.items.map(c => {
            const deps = c.dependents ?? [];
            const more = deps.length - DEPENDENTS_SHOWN;
            return (
              <TableRow key={c.id} sx={{ verticalAlign: 'top' }}>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {c.kind}
                  </Typography>
                  <ComponentName c={c} />
                </TableCell>
                <TableCell>{c.namespace || 'cluster-scoped'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RiskBadge risk={c.risk} />
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {c.risk}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{c.status || '—'}</Typography>
                  {c.inheritedFrom && (
                    <Typography variant="caption" color="text.secondary">
                      inherits risk from {componentLabel(c.inheritedFrom)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {deps.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nothing depends on it
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="body2" fontWeight={500}>
                        {deps.length} depend{deps.length === 1 ? 's' : ''} on it
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {deps.slice(0, DEPENDENTS_SHOWN).map(componentLabel).join(', ')}
                        {more > 0 && ` and ${more} more`}
                      </Typography>
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <PaginationBar page={pg.page} pageSize={pg.pageSize} total={pg.total} onChange={pg.setPage} />
    </>
  );
}

function AddonsTable({ addons }: { addons: NonNullable<MirrorReport['addons']> }) {
  if (addons.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No known add-ons detected.
      </Typography>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Add-on</TableCell>
          <TableCell>Namespace</TableCell>
          <TableCell>Version</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {addons.map(a => (
          <TableRow key={a.name}>
            <TableCell>{a.name}</TableCell>
            <TableCell>{a.namespace || '—'}</TableCell>
            <TableCell>{a.version || 'unknown'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      {caption && (
        <Typography variant="body2" color="text.secondary">
          {caption}
        </Typography>
      )}
    </Box>
  );
}

// ClusterMirrorDetail is the always-on view of the cluster: its dependency graph and current risk,
// rebuilt by the operator on an interval. It carries no target version and no verdict — that is
// Upgrade Analyses' job. The name comes from the route, or from ClusterMirrorList when the cluster has
// a single mirror and the list opens it directly.
export function ClusterMirrorDetail({ name: nameProp }: { name?: string }) {
  const params = useParams<{ name: string }>();
  const name = nameProp ?? params.name;
  const [item, error] = ClusterMirror.useGet(name);
  const [showGraph, setShowGraph] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Re-fetch the report when the mirror rebuilds (lastSync moves), keeping the previous one on screen
  // meanwhile so the page doesn't flash back to a spinner every few minutes.
  const {
    report,
    error: reportError,
    loading,
  } = useReport<MirrorReport>(name ? mirrorReportFile(name) : undefined, {
    enabled: !!item,
    refreshKey: item?.status?.lastSync,
    resetOnRefresh: false,
  });

  if (error) return <Alert severity="error">{String(error)}</Alert>;
  if (!item) return <CircularProgress />;

  const status = item.status ?? {};
  const interval = item.spec?.refresh?.interval || DEFAULT_INTERVAL;
  const intervalMs = parseGoDuration(interval);
  const lastSync = status.lastSync;

  // A rebuild that's more than two intervals late means the operator has stopped keeping this mirror
  // current (crashed, can't reach the API), so the numbers below may be out of date.
  const stale = !!lastSync && Date.now() - Date.parse(lastSync) > 2 * intervalMs;
  const liveness = status.syncError
    ? { label: 'Error', color: 'error.main' }
    : !lastSync
    ? { label: 'Building', color: 'text.disabled' }
    : stale
    ? { label: 'Stale', color: 'warning.main' }
    : { label: 'Live', color: 'success.main' };

  const excluded = item.spec?.scope?.excludeNamespaces?.length ?? 0;
  const scopeLabel =
    (item.spec?.scope?.mode === 'application' ? 'application namespaces' : 'all namespaces') +
    (excluded > 0 ? ` (${excluded} excluded)` : '');

  const summary = report?.summary;
  const components = summary?.components ?? status.components ?? '—';
  const edges = summary?.edges ?? status.edges ?? '—';
  const atRisk = summary?.atRisk ?? status.atRisk ?? '—';
  const namespacesAtRisk = summary
    ? `${summary.namespacesAtRisk} of ${summary.namespaces}`
    : status.byNamespace
    ? `${status.byNamespace.filter(n => n.atRisk > 0).length} of ${status.byNamespace.length}`
    : '—';

  // The operator rebuilds on a change to the 'mirops.io/refresh' annotation, bypassing the interval;
  // this merge patch only touches that annotation.
  async function refresh() {
    if (!item) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await item.patch({ metadata: { annotations: { 'mirops.io/refresh': String(Date.now()) } } });
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  const graph = report?.graph;
  const hasChains = (graph?.edges?.length ?? 0) > 0;

  return (
    <>
      <SectionBox title={`Cluster Mirror: ${name}`}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: liveness.color }} />
            <Typography variant="body2" fontWeight={600}>
              {liveness.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              · rebuilt {timeAgo(lastSync)} · every {durationLabel(interval)} · {scopeLabel}
            </Typography>
          </Box>
          <Button variant="contained" size="small" disabled={refreshing} onClick={refresh}>
            {refreshing ? <CircularProgress size={18} /> : 'Refresh now'}
          </Button>
        </Box>

        {status.syncError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {status.syncError}
          </Alert>
        )}
        {refreshError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {refreshError}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6} md={3}>
            <SummaryTile
              value={components}
              label="Components"
              caption="Workloads, services, config, volumes, nodes and add-ons"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryTile
              value={edges}
              label="Dependencies"
              caption="Service → workload, workload → config, volume and node"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryTile
              value={atRisk}
              label="At risk"
              caption="Components with risk 50 or higher"
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <SummaryTile
              value={namespacesAtRisk}
              label="Namespaces at risk"
              caption="Counting cluster-scoped nodes as one"
            />
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, maxWidth: 780 }}>
          Risk here is the cluster&apos;s state right now — workloads down, volumes pending or lost,
          nodes not ready — and everything that depends on them. It isn&apos;t an upgrade verdict;
          that&apos;s what Upgrade Analyses is for.
        </Typography>
      </SectionBox>

      <SectionBox>
        {loading && !report && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              {lastSync ? 'Loading the mirror…' : 'Building the mirror…'}
            </Typography>
          </Box>
        )}
        {reportError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Could not load the mirror report: {reportError}
          </Alert>
        )}
        {report && report.kind !== 'ClusterMirror' && (
          <Alert severity="error">
            The reports service returned something that isn&apos;t a ClusterMirror report.
          </Alert>
        )}
        {report?.kind === 'ClusterMirror' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box>
              <SectionTitle
                title="Namespace risk"
                caption="Highest component risk in each namespace, worst first. Open one to see its workloads."
              />
              <NamespaceRiskHeatmap byNamespace={report.risk?.byNamespace ?? []} embedded />
            </Box>

            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <SectionTitle
                  title="At-risk components"
                  caption="Risk 50 or higher, and what depends on each one — what breaks if it fails."
                />
                {graph && (
                  <Button size="small" onClick={() => setShowGraph(s => !s)} sx={{ mb: 1.5 }}>
                    {showGraph ? 'Hide dependency graph' : 'Open dependency graph'}
                  </Button>
                )}
              </Box>
              {showGraph &&
                graph &&
                (hasChains ? (
                  <Box sx={{ mb: 2 }}>
                    <DependencyGraph graph={graph} />
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No dependency chains in this cluster yet.
                  </Typography>
                ))}
              <AtRiskTable rows={report.atRisk ?? []} />
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <SectionTitle
                  title="Problems right now"
                  caption={`${report.pods.total} pods · ${report.pods.notReady} not ready · ${report.pods.restarts} restarts`}
                />
                {(report.issues?.length ?? 0) > 0 ? (
                  <IssuesSection issues={report.issues} />
                ) : (
                  <Alert severity="success">No problems right now.</Alert>
                )}
              </Grid>
              <Grid item xs={12} md={5}>
                <SectionTitle
                  title="Add-ons detected"
                  caption="Whether each one works with a new Kubernetes version is checked in Upgrade Analyses."
                />
                <AddonsTable addons={report.addons ?? []} />
              </Grid>
            </Grid>

            <Box>
              <WorkloadsData workloads={report.workloads} />
            </Box>
          </Box>
        )}
      </SectionBox>
    </>
  );
}
