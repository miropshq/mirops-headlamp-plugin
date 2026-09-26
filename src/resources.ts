import { KubeObject, KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { ActionResult, Decision, RemediationAction, RemediationPhase } from './types';

const GROUP = 'mirops.mirops.io';
const VERSION = 'v1';

// ─── UpgradeAnalysis ──────────────────────────────────────────────────────────

export interface UpgradeAnalysisSpec {
  targetVersion: string;
  scoringProfile?: 'production' | 'non-production';
  scope?: {
    mode: 'all' | 'application';
    excludeNamespaces?: string[];
  };
  ai?: {
    enabled: boolean;
    provider?: 'anthropic' | 'openai';
    model?: string;
    maxTokens?: number;
    credentialsSecret?: string;
    remediation?: {
      enabled: boolean;
      maxRiskLevel?: 'low' | 'medium' | 'high';
      autoApprove?: boolean;
    };
  };
  resync?: {
    interval?: string;
  };
  source?: {
    type: 'file' | 's3' | 'blob' | 'pvc';
    [key: string]: string | undefined;
  };
}

export interface UpgradeAnalysisStatus {
  decision?: Decision;
  totalScore?: number;
  reason?: string;
  aiScore?: number;
  aiReasoning?: string;
  aiModel?: string;
  aiError?: string;
  addonsChecked?: number;
  incompatibleAddons?: number;
  lastAnalysisTime?: string;
  reportPath?: string;
  // Report write outcome (operator-set). When reportState === 'failed', the
  // verdict is still valid but the report body may be unavailable.
  reportState?: 'written' | 'failed';
  reportError?: string;
  reportLocation?: string;
  conditions?: {
    type: string;
    status: string;
    reason?: string;
    message?: string;
    lastTransitionTime?: string;
  }[];
}

export interface UpgradeAnalysisType extends KubeObjectInterface {
  spec: UpgradeAnalysisSpec;
  status?: UpgradeAnalysisStatus;
}

export class UpgradeAnalysis extends KubeObject<UpgradeAnalysisType> {
  static kind = 'UpgradeAnalysis';
  static apiName = 'upgradeanalyses';
  static apiVersion = `${GROUP}/${VERSION}`;
  // Cluster-scoped: analyses the whole cluster, has no namespace.
  static isNamespaced = false;

  get spec(): UpgradeAnalysisSpec {
    return this.jsonData.spec;
  }

  get status(): UpgradeAnalysisStatus | undefined {
    return this.jsonData.status;
  }

  static get detailsRoute() {
    return '/mirops/upgrade-analyses/:name';
  }
}

// ─── ClusterMirror ────────────────────────────────────────────────────────────

export interface ClusterMirrorSpec {
  scope?: {
    mode: 'all' | 'application';
    excludeNamespaces?: string[];
  };
  refresh?: {
    mode?: 'interval';
    // Go duration as serialized by the API, e.g. "5m0s".
    interval?: string;
  };
}

export interface ClusterMirrorStatus {
  components?: number;
  edges?: number;
  atRisk?: number;
  lastSync?: string;
  byNamespace?: { namespace: string; maxRisk: number; atRisk: number }[];
  // Set when the last rebuild (or writing its report) failed.
  syncError?: string;
  observedGeneration?: number;
}

export interface ClusterMirrorType extends KubeObjectInterface {
  spec: ClusterMirrorSpec;
  status?: ClusterMirrorStatus;
}

export class ClusterMirror extends KubeObject<ClusterMirrorType> {
  static kind = 'ClusterMirror';
  static apiName = 'clustermirrors';
  static apiVersion = `${GROUP}/${VERSION}`;
  // Cluster-scoped: mirrors the whole cluster, has no namespace.
  static isNamespaced = false;

  get spec(): ClusterMirrorSpec {
    return this.jsonData.spec;
  }

  get status(): ClusterMirrorStatus | undefined {
    return this.jsonData.status;
  }

  static get detailsRoute() {
    return '/mirops/mirror/:name';
  }
}

// ─── RemediationPlan ──────────────────────────────────────────────────────────

export interface RemediationPlanSpec {
  upgradeAnalysisRef: string;
  approved: boolean;
  actions: RemediationAction[];
}

export interface RemediationPlanStatus {
  phase?: RemediationPhase;
  results?: ActionResult[];
  executedAt?: string;
  completedAt?: string;
}

export interface RemediationPlanType extends KubeObjectInterface {
  spec: RemediationPlanSpec;
  status?: RemediationPlanStatus;
}

export class RemediationPlan extends KubeObject<RemediationPlanType> {
  static kind = 'RemediationPlan';
  static apiName = 'remediationplans';
  static apiVersion = `${GROUP}/${VERSION}`;
  // Cluster-scoped: remediates the whole cluster, has no namespace.
  static isNamespaced = false;

  get spec(): RemediationPlanSpec {
    return this.jsonData.spec;
  }

  get status(): RemediationPlanStatus | undefined {
    return this.jsonData.status;
  }

  static get detailsRoute() {
    return '/mirops/remediation-plans/:name';
  }
}
