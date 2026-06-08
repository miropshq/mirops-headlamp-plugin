import {
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib/K8s';
import React from 'react';
import { RemediationPlanDetail } from './components/RemediationPlanDetail';
import { UpgradeAnalysisCreate } from './components/UpgradeAnalysisCreate';
import { UpgradeAnalysisDetail } from './components/UpgradeAnalysisDetail';
import { UpgradeAnalysisList } from './components/UpgradeAnalysisList';

// Sidebar: mirops section
registerSidebarEntry({
  parent: null,
  name: 'mirops',
  label: 'Mirops',
  icon: 'mdi:arrow-up-circle-outline',
  url: '/mirops/upgrade-analyses',
});

registerSidebarEntry({
  parent: 'mirops',
  name: 'upgradeAnalyses',
  label: 'Upgrade Analyses',
  url: '/mirops/upgrade-analyses',
});

// Routes
registerRoute({
  path: '/mirops/upgrade-analyses',
  sidebar: 'upgradeAnalyses',
  name: 'upgradeAnalysisList',
  exact: true,
  component: () => <UpgradeAnalysisList />,
});

registerRoute({
  path: '/mirops/upgrade-analyses/create',
  sidebar: 'upgradeAnalyses',
  name: 'upgradeAnalysisCreate',
  exact: true,
  component: () => <UpgradeAnalysisCreate />,
});

registerRoute({
  path: '/mirops/upgrade-analyses/:namespace/:name',
  sidebar: 'upgradeAnalyses',
  name: 'upgradeAnalysisDetail',
  exact: true,
  component: () => <UpgradeAnalysisDetail />,
});

registerRoute({
  path: '/mirops/remediation-plans/:namespace/:name',
  sidebar: 'upgradeAnalyses',
  name: 'remediationPlanDetail',
  exact: true,
  component: () => <RemediationPlanDetail />,
});
