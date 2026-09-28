import { Link, ResourceListView, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import React from 'react';
import { timeAgo } from '../format';
import { useDefaultMirror } from '../mirror';
import { ClusterMirror } from '../resources';
import { NewMirrorButton } from './ClusterMirrorCreate';

const EXAMPLE_MIRROR = `apiVersion: mirops.mirops.io/v1
kind: ClusterMirror
metadata:
  name: default
spec:
  refresh:
    interval: 5m`;

// ClusterMirrorList is the Mirops landing page: every mirror in the cluster, like Upgrade Analyses.
// Most installs have one (usually named "default"); a name opens its detail.
export function ClusterMirrorList() {
  const { mirrors, error } = useDefaultMirror();

  if (error) {
    return (
      <SectionBox title="Cluster Mirror">
        <Alert severity="info">
          Couldn&apos;t list ClusterMirrors ({String(error)}). Cluster Mirror needs the mirops
          operator 0.2.0 or newer — Upgrade Analyses keeps working with older operators.
        </Alert>
      </SectionBox>
    );
  }
  if (!mirrors) return <CircularProgress />;

  if (mirrors.length === 0) {
    return (
      <SectionBox title="Cluster Mirror">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 760 }}>
          <Typography variant="body2">
            There&apos;s no ClusterMirror in this cluster. mirops doesn&apos;t create one — like an
            UpgradeAnalysis, you create it after installing. Name it &quot;default&quot; so this
            page opens it first.
          </Typography>
          <Box>
            <NewMirrorButton variant="contained" />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Or apply it with kubectl:
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: 'grey.900',
              color: 'grey.100',
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            {EXAMPLE_MIRROR}
          </Box>
        </Box>
      </SectionBox>
    );
  }

  return (
    <ResourceListView
      title="Cluster Mirrors"
      resourceClass={ClusterMirror}
      headerProps={{ actions: [<NewMirrorButton key="create" variant="contained" />] }}
      columns={[
        {
          id: 'name',
          label: 'Name',
          getValue: (item: ClusterMirror) => item.metadata.name,
          render: (item: ClusterMirror) => (
            <Link routeName="clusterMirrorDetail" params={{ name: item.metadata.name }}>
              {item.metadata.name}
            </Link>
          ),
        },
        {
          id: 'status',
          label: 'Status',
          getValue: (item: ClusterMirror) =>
            item.status?.syncError ? 'Error' : item.status?.lastSync ? 'Live' : 'Building',
        },
        {
          id: 'components',
          label: 'Components',
          getValue: (item: ClusterMirror) => item.status?.components ?? '-',
        },
        {
          id: 'atRisk',
          label: 'At risk',
          getValue: (item: ClusterMirror) => item.status?.atRisk ?? '-',
        },
        {
          id: 'report',
          label: 'Report',
          getValue: (item: ClusterMirror) => item.status?.reportLocation ?? '-',
        },
        {
          id: 'lastSync',
          label: 'Last rebuild',
          getValue: (item: ClusterMirror) => timeAgo(item.status?.lastSync),
        },
        'age',
      ]}
    />
  );
}
