import { K8s } from '@kinvolk/headlamp-plugin/lib/K8s';

export const UPGRADE_ANALYSIS_RESOURCE = K8s.makeCustomResourceClass({
  apiInfo: [{ group: 'mirops.mirops.io', version: 'v1' }],
  isNamespaced: true,
  singularName: 'upgradeanalysis',
  pluralName: 'upgradeanalyses',
});

export const REMEDIATION_PLAN_RESOURCE = K8s.makeCustomResourceClass({
  apiInfo: [{ group: 'mirops.mirops.io', version: 'v1' }],
  isNamespaced: true,
  singularName: 'remediationplan',
  pluralName: 'remediationplans',
});
