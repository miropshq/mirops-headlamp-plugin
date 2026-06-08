import {
  Link,
  SectionBox,
  SectionFilterHeader,
  SimpleTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { K8s } from '@kinvolk/headlamp-plugin/lib/K8s';
import React from 'react';
import { UPGRADE_ANALYSIS_RESOURCE } from '../resources';
import { DecisionChip } from './DecisionChip';

export function UpgradeAnalysisList() {
  const [analyses, error] = K8s.ResourceClasses.CustomResourceDefinition
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      K8s.useList(UPGRADE_ANALYSIS_RESOURCE)
    : [[], null];

  return (
    <SectionBox
      title={
        <SectionFilterHeader
          title="Upgrade Analyses"
          noNamespaceFilter={false}
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
