import { useReport } from './reports';
import { ClusterMirror } from './resources';
import { MirrorReport } from './types';

// The ClusterMirror the Helm chart creates. The plugin treats it as "the" mirror when there are several.
export const DEFAULT_MIRROR_NAME = 'default';

// A mirror's report on the reports service (the operator writes <name>.mirror; analyses use .mirops).
export function mirrorReportFile(name: string): string {
  return `${name}.mirror`;
}

// useDefaultMirror returns the mirror named "default", else the first one. error is set when the API
// has no ClusterMirror resource at all — an operator older than 0.2.0.
export function useDefaultMirror() {
  const [mirrors, error] = ClusterMirror.useList();
  const mirror = mirrors?.find(m => m.metadata.name === DEFAULT_MIRROR_NAME) ?? mirrors?.[0];
  return { mirror, mirrors, error };
}

export type UpgradeState = 'unknown' | 'enabled' | 'disabled';

// useUpgradeState reads whether this install runs upgrade analysis from the mirror report's
// upgrade.enabled (Helm upgrade.enabled). Anything short of a readable mirror report is 'unknown', and
// callers treat unknown like enabled: hiding a feature that works is worse than showing one that's off.
export function useUpgradeState() {
  const { mirror } = useDefaultMirror();
  const name = mirror?.metadata.name;
  const { report } = useReport<MirrorReport>(name ? mirrorReportFile(name) : undefined, {
    enabled: !!name,
    refreshKey: mirror?.status?.lastSync,
    resetOnRefresh: false,
  });

  let state: UpgradeState = 'unknown';
  if (report?.kind === 'ClusterMirror') {
    state = report.upgrade?.enabled ? 'enabled' : 'disabled';
  }
  return { state, mirrorName: name, atRisk: report?.summary?.atRisk };
}
