import { Icon } from '@iconify/react';
import { Link, ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Button from '@mui/material/Button';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { UpgradeAnalysis } from '../resources';
import { DecisionChip } from './DecisionChip';

export function UpgradeAnalysisList() {
  const history = useHistory();

  return (
    <ResourceListView
      title="Upgrade Analyses"
      resourceClass={UpgradeAnalysis}
      headerProps={{
        actions: [
          <Button
            key="create"
            variant="contained"
            size="small"
            startIcon={<Icon icon="mdi:plus" />}
            onClick={() => history.push('/mirops/upgrade-analyses/create')}
          >
            Nuevo análisis
          </Button>,
        ],
      }}
      columns={[
        {
          id: 'name',
          label: 'Name',
          getValue: (item: UpgradeAnalysis) => item.metadata.name,
          render: (item: UpgradeAnalysis) => (
            <Link
              routeName="upgradeAnalysisDetail"
              params={{ namespace: item.metadata.namespace, name: item.metadata.name }}
            >
              {item.metadata.name}
            </Link>
          ),
        },
        'namespace',
        {
          id: 'targetVersion',
          label: 'Target Version',
          getValue: (item: UpgradeAnalysis) => item.spec?.targetVersion ?? '-',
        },
        {
          id: 'decision',
          label: 'Decision',
          getValue: (item: UpgradeAnalysis) => item.status?.decision ?? '',
          render: (item: UpgradeAnalysis) =>
            item.status?.decision ? <DecisionChip decision={item.status.decision} /> : <>-</>,
        },
        {
          id: 'score',
          label: 'Score',
          getValue: (item: UpgradeAnalysis) =>
            item.status?.totalScore !== undefined ? `${item.status.totalScore}/100` : '-',
        },
        'age',
      ]}
    />
  );
}
