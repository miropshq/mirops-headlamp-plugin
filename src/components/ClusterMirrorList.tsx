import { Link, ResourceListView, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { timeAgo } from '../format';
import { useDefaultMirror } from '../mirror';
import { ClusterMirror } from '../resources';
import { NewMirrorButton } from './ClusterMirrorCreate';

// ClusterMirrorList is the Mirops landing page: every mirror in the cluster, like Upgrade Analyses —
// an empty list until one is created. A name opens its detail.
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

  return (
    <>
      {mirrors.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No ClusterMirror yet — mirops doesn&apos;t create one. Use <strong>New mirror</strong> to
          create it.
        </Alert>
      )}
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
    </>
  );
}
