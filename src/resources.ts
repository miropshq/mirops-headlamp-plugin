import { KubeObject, KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { ActionResult, Decision, RemediationAction, RemediationPhase } from './types';

const GROUP = 'mirops.mirops.io';
const VERSION = 'v1';

// ─── UpgradeAnalysis ──────────────────────────────────────────────────────────

export interface UpgradeAnalysisSpec {
  targetVersion: string;
  scope?: {
    mode: 'all' | 'application';
    excludeNamespaces?: string[];
  };
  ai?: {
    enabled: boolean;
    provider?: 'anthropic' | 'openai';
    model?: string;
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
    type: 'file' | 's3' | 'blob';
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
  lastAnalysisTime?: string;
  reportPath?: string;
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
  static isNamespaced = true;

  get spec(): UpgradeAnalysisSpec {
    return this.jsonData.spec;
  }

  get status(): UpgradeAnalysisStatus | undefined {
    return this.jsonData.status;
  }

  static get detailsRoute() {
    return '/mirops/upgrade-analyses/:namespace/:name';
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
  static isNamespaced = true;

  get spec(): RemediationPlanSpec {
    return this.jsonData.spec;
  }

  get status(): RemediationPlanStatus | undefined {
    return this.jsonData.status;
  }

  static get detailsRoute() {
    return '/mirops/remediation-plans/:namespace/:name';
  }
}
