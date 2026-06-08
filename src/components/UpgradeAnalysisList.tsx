import {
  Link,
  SectionBox,
  SectionFilterHeader,
  SimpleTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { K8s } from '@kinvolk/headlamp-plugin/lib/K8s';
import AddIcon from '@mui/icons-material/Add';
import Button from '@mui/material/Button';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { UPGRADE_ANALYSIS_RESOURCE } from '../resources';
import { DecisionChip } from './DecisionChip';

export function UpgradeAnalysisList() {
  const history = useHistory();
  const [analyses, error] = K8s.useList(UPGRADE_ANALYSIS_RESOURCE);

  return (
    <SectionBox
      title={
        <SectionFilterHeader
          title="Upgrade Analyses"
          noNamespaceFilter={false}
          actions={[
            <Button
              key="create"
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => history.push('/mirops/upgrade-analyses/create')}
            >
              Nuevo análisis
            </Button>,
          ]}
        />
      }
    >
      <SimpleTable
        data={analyses}
        error={error}
        columns={[
          {
            label: 'Name',
            getter: (item: any) => (
              <Link
                routeName="upgradeAnalysisDetail"
                params={{ namespace: item.metadata.namespace, name: item.metadata.name }}
              >
                {item.metadata.name}
              </Link>
            ),
          },
          {
            label: 'Namespace',
            getter: (item: any) => item.metadata.namespace,
          },
          {
            label: 'Target Version',
            getter: (item: any) => item.spec?.targetVersion ?? '-',
          },
          {
            label: 'Decision',
            getter: (item: any) =>
              item.status?.decision ? (
                <DecisionChip decision={item.status.decision} />
              ) : (
                '-'
              ),
          },
          {
            label: 'Score',
            getter: (item: any) =>
              item.status?.totalScore !== undefined ? `${item.status.totalScore}/100` : '-',
          },
          {
            label: 'Age',
            getter: (item: any) => item.metadata.creationTimestamp ?? '-',
          },
        ]}
      />
    </SectionBox>
  );
}
