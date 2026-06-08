import { Icon } from '@iconify/react';
import { K8s, Router } from '@kinvolk/headlamp-plugin/lib';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
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
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { UpgradeAnalysis } from '../resources';

interface FormState {
  name: string;
  namespace: string;
  targetVersion: string;
  // scope
  scopeMode: 'all' | 'application';
  excludeNamespaces: string[];
  // ai
  aiEnabled: boolean;
  aiProvider: 'anthropic' | 'openai';
  aiModel: string;
  aiCredentialsSecret: string;
  // remediation
  remediationEnabled: boolean;
  remediationMaxRiskLevel: 'low' | 'medium' | 'high';
  remediationAutoApprove: boolean;
  // resync
  resyncInterval: string;
  // source
  sourceType: 'file' | 's3' | 'blob';
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
  namespace: 'default',
  targetVersion: '',
  scopeMode: 'all',
  excludeNamespaces: [],
  aiEnabled: false,
  aiProvider: 'anthropic',
  aiModel: '',
  aiCredentialsSecret: '',
  remediationEnabled: false,
  remediationMaxRiskLevel: 'low',
  remediationAutoApprove: false,
  resyncInterval: '',
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

function buildCR(f: FormState) {
  const spec: any = {
    targetVersion: f.targetVersion,
  };

  if (f.scopeMode !== 'all' || f.excludeNamespaces.length > 0) {
    spec.scope = { mode: f.scopeMode };
    if (f.excludeNamespaces.length > 0) {
      spec.scope.excludeNamespaces = f.excludeNamespaces;
    }
  }

  if (f.aiEnabled) {
    spec.ai = {
      enabled: true,
      ...(f.aiProvider && { provider: f.aiProvider }),
      ...(f.aiModel && { model: f.aiModel }),
      ...(f.aiCredentialsSecret && { credentialsSecret: f.aiCredentialsSecret }),
      remediation: {
        enabled: f.remediationEnabled,
        ...(f.remediationMaxRiskLevel !== 'low' && { maxRiskLevel: f.remediationMaxRiskLevel }),
        ...(f.remediationAutoApprove && { autoApprove: true }),
      },
    };
  }

  if (f.resyncInterval) {
    spec.resync = { interval: f.resyncInterval };
  }

  const source: any = { type: f.sourceType };
  if (f.sourceType === 'file' && f.sourcePath) source.path = f.sourcePath;
  if (f.sourceType === 's3') {
    if (f.sourceBucket) source.bucket = f.sourceBucket;
    if (f.sourceRegion) source.region = f.sourceRegion;
    if (f.sourceKey) source.key = f.sourceKey;
    if (f.sourceCredentialsSecret) source.credentialsSecret = f.sourceCredentialsSecret;
  }
  if (f.sourceType === 'blob') {
    if (f.sourceAccountName) source.accountName = f.sourceAccountName;
    if (f.sourceContainerName) source.containerName = f.sourceContainerName;
    if (f.sourceBlobName) source.blobName = f.sourceBlobName;
    if (f.sourceCredentialsSecret) source.credentialsSecret = f.sourceCredentialsSecret;
  }
  if (Object.keys(source).length > 1 || f.sourceType !== 'file') {
    spec.source = source;
  }

  return {
    apiVersion: 'mirops.mirops.io/v1',
    kind: 'UpgradeAnalysis',
    metadata: { name: f.name, namespace: f.namespace },
    spec,
  };
}

export function UpgradeAnalysisCreate() {
  const history = useHistory();
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [newNs, setNewNs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [namespaces] = K8s.ResourceClasses.Namespace.useList();

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
    set('excludeNamespaces', form.excludeNamespaces.filter(n => n !== ns));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.targetVersion) return;
    setSubmitting(true);
    setError(null);
    try {
      const cr = buildCR(form);
      await UpgradeAnalysis.apiEndpoint.post(cr);
      history.push(
        Router.createRouteURL('upgradeAnalysisDetail', {
          namespace: form.namespace,
          name: form.name,
        })
      );
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const nsOptions: string[] = namespaces?.map((n: any) => n.metadata.name) ?? ['default'];

  return (
    <Paper sx={{ maxWidth: 720, mx: 'auto', p: 4, mt: 3 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Nuevo Upgrade Analysis
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* ── Identidad ── */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Name"
            required
            fullWidth
            value={form.name}
            onChange={e => set('name', e.target.value)}
            helperText="Nombre del CR en el cluster"
          />
          <FormControl fullWidth required>
            <InputLabel>Namespace</InputLabel>
            <Select
              value={form.namespace}
              label="Namespace"
              onChange={e => set('namespace', e.target.value)}
            >
              {nsOptions.map(ns => (
                <MenuItem key={ns} value={ns}>{ns}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <TextField
          label="Target Version"
          required
          fullWidth
          placeholder="1.31"
          value={form.targetVersion}
          onChange={e => set('targetVersion', e.target.value)}
          helperText="Versión de Kubernetes a la que se quiere hacer upgrade (ej. 1.31)"
        />

        <Divider />

        {/* ── Scope ── */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography fontWeight={600}>Scope</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <FormLabel>Modo</FormLabel>
              <RadioGroup
                row
                value={form.scopeMode}
                onChange={e => set('scopeMode', e.target.value as any)}
              >
                <FormControlLabel value="all" control={<Radio />} label="All (sistema + aplicación)" />
                <FormControlLabel value="application" control={<Radio />} label="Application (excluye sistema)" />
              </RadioGroup>
              <FormHelperText>
                "all" incluye kube-system y otros namespaces de sistema. "application" los excluye.
              </FormHelperText>
            </FormControl>

            <Box>
              <FormLabel sx={{ display: 'block', mb: 1 }}>Excluir namespaces (opcional)</FormLabel>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  size="small"
                  placeholder="namespace-name"
                  value={newNs}
                  onChange={e => setNewNs(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNamespace())}
                />
                <Button variant="outlined" size="small" startIcon={<Icon icon="mdi:plus" />} onClick={addNamespace}>
                  Agregar
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {form.excludeNamespaces.map(ns => (
                  <Box
                    key={ns}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      bgcolor: 'action.selected', borderRadius: 1, px: 1, py: 0.25,
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

        {/* ── AI ── */}
        <Accordion>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography fontWeight={600}>AI Scoring</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch checked={form.aiEnabled} onChange={e => set('aiEnabled', e.target.checked)} />
              }
              label="Habilitar AI scoring (base 70% + AI 30%)"
            />

            {form.aiEnabled && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Provider</InputLabel>
                  <Select
                    value={form.aiProvider}
                    label="Provider"
                    onChange={e => set('aiProvider', e.target.value as any)}
                  >
                    <MenuItem value="anthropic">Anthropic</MenuItem>
                    <MenuItem value="openai">OpenAI</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="Model"
                  fullWidth
                  placeholder={form.aiProvider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o'}
                  value={form.aiModel}
                  onChange={e => set('aiModel', e.target.value)}
                  helperText="Nombre del modelo a usar"
                />

                <TextField
                  label="Credentials Secret"
                  fullWidth
                  placeholder="my-ai-secret"
                  value={form.aiCredentialsSecret}
                  onChange={e => set('aiCredentialsSecret', e.target.value)}
                  helperText="Secret de Kubernetes con ANTHROPIC_API_KEY u OPENAI_API_KEY"
                />

                <Divider />
                <Typography variant="subtitle2" fontWeight={600}>Remediation</Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={form.remediationEnabled}
                      onChange={e => set('remediationEnabled', e.target.checked)}
                    />
                  }
                  label="Habilitar remediation plan automático"
                />

                {form.remediationEnabled && (
                  <>
                    <FormControl fullWidth>
                      <InputLabel>Max Risk Level</InputLabel>
                      <Select
                        value={form.remediationMaxRiskLevel}
                        label="Max Risk Level"
                        onChange={e => set('remediationMaxRiskLevel', e.target.value as any)}
                      >
                        <MenuItem value="low">Low — solo acciones de bajo riesgo</MenuItem>
                        <MenuItem value="medium">Medium — bajo y medio riesgo</MenuItem>
                        <MenuItem value="high">High — todas las acciones</MenuItem>
                      </Select>
                      <FormHelperText>Nivel máximo de riesgo de las acciones que puede proponer la AI</FormHelperText>
                    </FormControl>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.remediationAutoApprove}
                          onChange={e => set('remediationAutoApprove', e.target.checked)}
                        />
                      }
                      label="Auto-approve — ejecutar acciones inmediatamente sin aprobación manual"
                    />
                  </>
                )}
              </>
            )}
          </AccordionDetails>
        </Accordion>

        {/* ── Resync ── */}
        <Accordion>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography fontWeight={600}>Resync (opcional)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              label="Interval"
              fullWidth
              placeholder="15m"
              value={form.resyncInterval}
              onChange={e => set('resyncInterval', e.target.value)}
              helperText='Intervalo de re-análisis automático (ej. "15m", "1h"). Vacío = solo una vez.'
            />
          </AccordionDetails>
        </Accordion>

        {/* ── Source ── */}
        <Accordion>
          <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
            <Typography fontWeight={600}>Source — destino del reporte (avanzado)</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={form.sourceType}
                label="Tipo"
                onChange={e => set('sourceType', e.target.value as any)}
              >
                <MenuItem value="file">File (por defecto)</MenuItem>
                <MenuItem value="s3">S3</MenuItem>
                <MenuItem value="blob">Azure Blob</MenuItem>
              </Select>
            </FormControl>

            {form.sourceType === 'file' && (
              <TextField
                label="Path"
                fullWidth
                value={form.sourcePath}
                onChange={e => set('sourcePath', e.target.value)}
                helperText="Ruta del archivo en el filesystem del operator"
              />
            )}

            {form.sourceType === 's3' && (
              <>
                <TextField label="Bucket" fullWidth value={form.sourceBucket} onChange={e => set('sourceBucket', e.target.value)} />
                <TextField label="Region" fullWidth value={form.sourceRegion} onChange={e => set('sourceRegion', e.target.value)} />
                <TextField label="Key" fullWidth value={form.sourceKey} onChange={e => set('sourceKey', e.target.value)} helperText="Ruta del objeto dentro del bucket" />
                <TextField label="Credentials Secret" fullWidth value={form.sourceCredentialsSecret} onChange={e => set('sourceCredentialsSecret', e.target.value)} helperText="Secret con AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY" />
              </>
            )}

            {form.sourceType === 'blob' && (
              <>
                <TextField label="Account Name" fullWidth value={form.sourceAccountName} onChange={e => set('sourceAccountName', e.target.value)} />
                <TextField label="Container Name" fullWidth value={form.sourceContainerName} onChange={e => set('sourceContainerName', e.target.value)} />
                <TextField label="Blob Name" fullWidth value={form.sourceBlobName} onChange={e => set('sourceBlobName', e.target.value)} />
                <TextField label="Credentials Secret" fullWidth value={form.sourceCredentialsSecret} onChange={e => set('sourceCredentialsSecret', e.target.value)} helperText="Secret con AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID" />
              </>
            )}
          </AccordionDetails>
        </Accordion>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => history.goBack()} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !form.name || !form.targetVersion}
          >
            {submitting ? <CircularProgress size={20} /> : 'Generar Análisis'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
