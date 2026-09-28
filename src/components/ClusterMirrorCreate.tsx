import { Icon } from '@iconify/react';
import { Router } from '@kinvolk/headlamp-plugin/lib';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { mirrorReportName } from '../mirror';
import { ClusterMirror } from '../resources';

interface FormState {
  name: string;
  // scope
  scopeMode: 'all' | 'application';
  excludeNamespaces: string[];
  // refresh
  refreshInterval: string;
  // source
  sourceType: 'file' | 's3' | 'blob' | 'pvc';
  sourcePath: string;
  sourceBucket: string;
  sourceRegion: string;
  sourceKey: string;
  sourceAccountName: string;
  sourceContainerName: string;
  sourceBlobName: string;
  sourceCredentialsSecret: string;
}

const DEFAULT: FormState = {
  name: '',
  scopeMode: 'application',
  excludeNamespaces: [],
  refreshInterval: '5m',
  sourceType: 'file',
  sourcePath: '',
  sourceBucket: '',
  sourceRegion: '',
  sourceKey: '',
  sourceAccountName: '',
  sourceContainerName: '',
  sourceBlobName: '',
  sourceCredentialsSecret: '',
};

const NAME_RE = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
// Go duration, as the CRD's refresh.interval takes it: "30s", "5m", "1h30m".
const DURATION_RE = /^(\d+(\.\d+)?(ns|us|µs|ms|s|m|h))+$/;

function buildCR(f: FormState) {
  const spec: any = {
    scope: { mode: f.scopeMode },
    refresh: { mode: 'interval', interval: f.refreshInterval || '5m' },
  };
  if (f.excludeNamespaces.length > 0) {
    spec.scope.excludeNamespaces = f.excludeNamespaces;
  }

  const source: any = { type: f.sourceType };
  if ((f.sourceType === 'file' || f.sourceType === 'pvc') && f.sourcePath)
    source.path = f.sourcePath;
  if (f.sourceType === 's3') {
    if (f.sourceBucket) source.bucket = f.sourceBucket;
    if (f.sourceRegion) source.region = f.sourceRegion;
    // Set explicitly: operator 0.2.0 would otherwise name a mirror's report <name>.mirror.
    source.key = f.sourceKey || mirrorReportName(f.name);
    if (f.sourceCredentialsSecret) source.credentialsSecret = f.sourceCredentialsSecret;
  }
  if (f.sourceType === 'blob') {
    if (f.sourceAccountName) source.accountName = f.sourceAccountName;
    if (f.sourceContainerName) source.containerName = f.sourceContainerName;
    source.blobName = f.sourceBlobName || mirrorReportName(f.name);
    if (f.sourceCredentialsSecret) source.credentialsSecret = f.sourceCredentialsSecret;
  }
  if (Object.keys(source).length > 1 || f.sourceType !== 'file') {
    spec.source = source;
  }

  return {
    apiVersion: 'mirops.mirops.io/v1',
    kind: 'ClusterMirror',
    metadata: { name: f.name },
    spec,
  };
}

// validate returns the first reason the form can't be submitted, or null.
function validate(f: FormState, taken: string[]): string | null {
  if (!f.name) return 'Name is required';
  if (!NAME_RE.test(f.name) || f.name.length > 253)
    return 'Name must be lowercase letters, digits and "-", starting and ending with a letter or digit';
  if (taken.includes(f.name)) return `A ClusterMirror named "${f.name}" already exists`;
  if (f.refreshInterval && !DURATION_RE.test(f.refreshInterval))
    return 'Refresh interval must be a duration like 30s, 5m or 1h';
  if (f.sourceType === 's3' && !f.sourceBucket) return 'S3 needs a bucket';
  if (f.sourceType === 'blob' && (!f.sourceAccountName || !f.sourceContainerName))
    return 'Azure Blob needs a storage account and a container';
  return null;
}

// NewMirrorButton opens the create form; shown on the mirror list and its empty state.
export function NewMirrorButton({ variant = 'outlined' }: { variant?: 'outlined' | 'contained' }) {
  const history = useHistory();
  return (
    <Button
      variant={variant}
      size="small"
      startIcon={<Icon icon="mdi:plus" />}
      onClick={() => history.push(Router.createRouteURL('clusterMirrorCreate'))}
    >
      New mirror
    </Button>
  );
}

// ClusterMirrorCreate is the form for a new ClusterMirror. Most clusters need one; more make sense for a
// different scope, report destination or interval. Each mirror rebuilds the whole graph on its interval.
export function ClusterMirrorCreate() {
  const history = useHistory();
  const [mirrors] = ClusterMirror.useList();
  const taken = mirrors?.map(m => m.metadata.name) ?? [];

  const [form, setForm] = useState<FormState>(DEFAULT);
  const [newNs, setNewNs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = validate(form, taken);
  // The report file this name produces; an example until a name is typed.
  const reportFile = mirrorReportName(form.name || 'cluster-default');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addNamespace() {
    const ns = newNs.trim();
    if (ns && !form.excludeNamespaces.includes(ns)) {
      set('excludeNamespaces', [...form.excludeNamespaces, ns]);
    }
    setNewNs('');
  }

  function removeNamespace(ns: string) {
    set(
      'excludeNamespaces',
      form.excludeNamespaces.filter(n => n !== ns)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    setSubmitting(true);
    setError(null);
    try {
      await ClusterMirror.apiEndpoint.post(buildCR(form));
      history.push(Router.createRouteURL('clusterMirrorDetail', { name: form.name }));
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper sx={{ maxWidth: 720, mx: 'auto', p: 4, mt: 3 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        New Cluster Mirror
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {taken.length > 0
          ? `This cluster already has ${taken.length} mirror${
              taken.length > 1 ? 's' : ''
            }. One is usually enough — add another for a different scope, report destination or interval. Each one rebuilds the whole graph on its interval.`
          : 'The mirror keeps a live map of the cluster — what depends on what, and what is at risk right now — and writes it as a report your pipelines can check changes against.'}
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {/* ClusterMirror is cluster-scoped — no namespace field. */}
        <TextField
          label="Name"
          required
          fullWidth
          placeholder="cluster-default"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          helperText={`Report: ${reportFile}`}
        />

        <TextField
          label="Refresh every"
          fullWidth
          placeholder="5m"
          value={form.refreshInterval}
          onChange={e => set('refreshInterval', e.target.value)}
          helperText='How often the operator rebuilds the mirror and rewrites its report (e.g. "1m", "5m", "1h").'
        />

        {/* ── Scope ── */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography fontWeight={600}>Scope</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <FormLabel>Mode</FormLabel>
              <RadioGroup
                row
                value={form.scopeMode}
                onChange={e => set('scopeMode', e.target.value as any)}
              >
                <FormControlLabel
                  value="application"
                  control={<Radio />}
                  label="Application (excludes system)"
                />
                <FormControlLabel
                  value="all"
                  control={<Radio />}
                  label="All (system + application)"
                />
              </RadioGroup>
              <FormHelperText>
                "application" mirrors your workloads. "all" also includes kube-system and other
                system namespaces.
              </FormHelperText>
            </FormControl>

            <Box>
              <FormLabel sx={{ display: 'block', mb: 1 }}>Exclude namespaces (optional)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="namespace-name"
                  value={newNs}
                  onChange={e => setNewNs(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNamespace())}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Icon icon="mdi:plus" />}
                  onClick={addNamespace}
                >
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {form.excludeNamespaces.map(ns => (
                  <Box
                    key={ns}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      bgcolor: 'action.selected',
                      borderRadius: 1,
                      px: 1,
                      py: 0.25,
                    }}
                  >
                    <Typography variant="caption">{ns}</Typography>
                    <IconButton size="small" onClick={() => removeNamespace(ns)}>
                      <Icon icon="mdi:delete" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* ── Source ── */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography fontWeight={600}>Source — report destination</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={form.sourceType}
                label="Type"
                onChange={e => set('sourceType', e.target.value as any)}
              >
                <MenuItem value="file">File Pod (default)</MenuItem>
                <MenuItem value="s3">S3</MenuItem>
                <MenuItem value="blob">Azure Blob</MenuItem>
                <MenuItem value="pvc">PVC</MenuItem>
              </Select>
              <FormHelperText>
                Pipelines read the report from here with mirops scan. Use S3 or Azure Blob so CI can
                reach it; File Pod stays inside the operator.
              </FormHelperText>
            </FormControl>

            {form.sourceType === 'file' && (
              <TextField
                label="File name"
                fullWidth
                placeholder={reportFile}
                value={form.sourcePath}
                onChange={e => set('sourcePath', e.target.value)}
                helperText={`Leave empty to use ${reportFile} in the operator's reports directory (this is where the plugin loads the report from).`}
              />
            )}

            {form.sourceType === 'pvc' && (
              <TextField
                label="Path"
                fullWidth
                placeholder="/var/mirops/reports"
                value={form.sourcePath}
                onChange={e => set('sourcePath', e.target.value)}
                helperText={`Directory on the PVC (mounted by the Helm chart with reportPVC.enabled). The report is written there as ${reportFile}.`}
              />
            )}

            {form.sourceType === 's3' && (
              <>
                <TextField
                  label="Bucket"
                  required
                  fullWidth
                  value={form.sourceBucket}
                  onChange={e => set('sourceBucket', e.target.value)}
                />
                <TextField
                  label="Region"
                  fullWidth
                  placeholder="us-east-2"
                  value={form.sourceRegion}
                  onChange={e => set('sourceRegion', e.target.value)}
                />
                <TextField
                  label="Key"
                  fullWidth
                  placeholder={`reports/${reportFile}`}
                  value={form.sourceKey}
                  onChange={e => set('sourceKey', e.target.value)}
                  helperText={`Full object path within the bucket. Leave empty for ${reportFile} at the bucket root.`}
                />
                <TextField
                  label="Credentials Secret (optional)"
                  fullWidth
                  value={form.sourceCredentialsSecret}
                  onChange={e => set('sourceCredentialsSecret', e.target.value)}
                  helperText="Optional — leave empty to use IRSA (the pod's IAM role). Otherwise a Secret with AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
                />
              </>
            )}

            {form.sourceType === 'blob' && (
              <>
                <TextField
                  label="Storage Account Name"
                  required
                  fullWidth
                  value={form.sourceAccountName}
                  onChange={e => set('sourceAccountName', e.target.value)}
                  helperText="The storage account name (e.g. miropsreports)"
                />
                <TextField
                  label="Container Name"
                  required
                  fullWidth
                  value={form.sourceContainerName}
                  onChange={e => set('sourceContainerName', e.target.value)}
                />
                <TextField
                  label="Blob Name"
                  fullWidth
                  placeholder={reportFile}
                  value={form.sourceBlobName}
                  onChange={e => set('sourceBlobName', e.target.value)}
                  helperText={`Leave empty for ${reportFile}.`}
                />
                <TextField
                  label="Credentials Secret (optional)"
                  fullWidth
                  value={form.sourceCredentialsSecret}
                  onChange={e => set('sourceCredentialsSecret', e.target.value)}
                  helperText="Optional — leave empty to use Workload Identity / Managed Identity (UMI). Otherwise a Secret with AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID."
                />
              </>
            )}
          </AccordionDetails>
        </Accordion>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', alignItems: 'center' }}>
          {invalid && form.name && (
            <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
              {invalid}
            </Typography>
          )}
          <Button variant="outlined" onClick={() => history.goBack()} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting || !!invalid}>
            {submitting ? <CircularProgress size={20} /> : 'Create mirror'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
