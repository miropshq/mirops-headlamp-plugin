import { registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { ClusterMirrorDetail } from './components/ClusterMirrorDetail';
import { ClusterMirrorList } from './components/ClusterMirrorList';
import { RemediationPlanDetail } from './components/RemediationPlanDetail';
import { UpgradeAnalysisCreate } from './components/UpgradeAnalysisCreate';
import { UpgradeAnalysisDetail } from './components/UpgradeAnalysisDetail';
import { UpgradeAnalysisList } from './components/UpgradeAnalysisList';

// Sidebar: mirops section. The always-on Cluster Mirror is the landing page; Upgrade Analyses is the
// opt-in upgrade mode next to it.
registerSidebarEntry({
  parent: '',
  name: 'mirops',
  label: 'Mirops',
  icon: 'mdi:graph-outline',
  url: '/mirops/mirror',
});

registerSidebarEntry({
  parent: 'mirops',
  name: 'clusterMirror',
  label: 'Cluster Mirror',
  url: '/mirops/mirror',
});

registerSidebarEntry({
  parent: 'mirops',
  name: 'upgradeAnalyses',
  label: 'Upgrade Analyses',
  url: '/mirops/upgrade-analyses',
});

// Routes
registerRoute({
  path: '/mirops/mirror',
  sidebar: 'clusterMirror',
  name: 'clusterMirrorList',
  exact: true,
  component: () => <ClusterMirrorList />,
});

registerRoute({
  path: '/mirops/mirror/:name',
  sidebar: 'clusterMirror',
  name: 'clusterMirrorDetail',
  exact: true,
  component: () => <ClusterMirrorDetail />,
});

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
  path: '/mirops/upgrade-analyses/:name',
  sidebar: 'upgradeAnalyses',
  name: 'upgradeAnalysisDetail',
  exact: true,
  component: () => <UpgradeAnalysisDetail />,
});

registerRoute({
  path: '/mirops/remediation-plans/:name',
  sidebar: 'upgradeAnalyses',
  name: 'remediationPlanDetail',
  exact: true,
  component: () => <RemediationPlanDetail />,
});
