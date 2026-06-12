// SAFE/WARNING/BLOCK are real analysis results. ERROR is a config error
// (e.g. targetVersion not higher than the live cluster) — the analysis did
// not run; render it distinctly, not as a red BLOCK.
export type Decision = 'SAFE' | 'WARNING' | 'BLOCK' | 'ERROR';
export type RiskLevel = 'low' | 'medium' | 'high';
export type RemediationPhase = 'pending-approval' | 'running' | 'completed' | 'failed';
export type ActionType = 'restart-pod' | 'scale-deployment' | 'cordon-node' | 'delete-pod';

export interface RemediationAction {
  id: string;
  type: ActionType;
  namespace?: string;
  name: string;
  reason: string;
  risk: RiskLevel;
  params?: Record<string, string>;
  skip: boolean;
}

export interface ActionResult {
  id: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  executedAt?: string;
}

// ─── Logical mirror sections (all omitempty in report.json) ──────────────────

export type AddonStatus = 'compatible' | 'incompatible' | 'unknown';

export interface AddonReport {
  name: string;
  version: string;
  status: AddonStatus;
  // The ADD-ON version to upgrade TO for the target k8s. Render
  // "upgrade to {requiredVersion}" when status is incompatible.
  requiredVersion?: string;
  note?: string;
}

export type GraphNodeType = 'workload' | 'network' | 'addon' | 'config' | 'storage' | 'infra';
export type GraphEdgeType =
  | 'routes-to'
  | 'selects'
  | 'uses-config'
  | 'uses-storage'
  | 'runs-on'
  | 'depends-on';

export interface GraphNode {
  id: string; // e.g. "Deployment/shop/frontend"
  kind: string;
  name: string;
  namespace?: string;
  type: GraphNodeType;
  status?: string;
  // 0–100, already propagated through dependencies; >=50 means "at risk"
  risk: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

export interface ReportGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NamespaceRisk {
  // "cluster" bucket holds cluster-scoped components (add-ons, nodes)
  namespace: string;
  risk: number;
  components: number;
  atRisk: number;
}

// Report JSON shape served by the operator HTTP endpoint
export interface Report {
  generatedAt: string;
  cluster: string;
  clusterVersion: string;
  targetVersion: string;
  decision: {
    threshold: number;
    allow: boolean;
    level: Decision;
  };
  reason: string;
  aiReasoning?: string;
  scores: {
    total: number;
    base: {
      score: number;
      weight: string;
      contribution: number;
      health: number;
      capacity: number;
      stability: number;
      risk: number;
    };
    ai?: {
      score: number;
      weight: string;
      contribution: number;
      model?: string;
    };
  };
  conditions: {
    pdbBlocking: boolean;
    highCpuPressure: boolean;
    highMemoryPressure: boolean;
    unstableCluster: boolean;
  };
  metrics: {
    pods: { total: number; notReady: number; restarts: number };
    resources: { cpuPressure: number; memoryPressure: number };
    stability: { podDelta: number; restartDelta: number };
    compatibility: { deprecatedApis: number; addonIssues: number };
  };
  workloads: {
    nodes: { name: string; status: string; conditions?: string[] }[];
    deployments: {
      namespace: string;
      name: string;
      readyReplicas: number;
      desiredReplicas: number;
      pods?: { name: string; reason?: string; restarts: number }[];
    }[];
    statefulsets: {
      namespace: string;
      name: string;
      readyReplicas: number;
      desiredReplicas: number;
      pods?: { name: string; reason?: string; restarts: number }[];
    }[];
    daemonsets: {
      namespace: string;
      name: string;
      numberUnavailable: number;
      pods?: { name: string; reason?: string; restarts: number }[];
    }[];
    jobs: {
      namespace: string;
      name: string;
      active: number;
      pods?: { name: string; reason?: string; restarts: number }[];
    }[];
    pdbs?: { namespace: string; name: string }[];
    deprecatedApis?: {
      group: string;
      version: string;
      resource: string;
      removedIn: string;
    }[];
  };
  issues?: string[];
  // Logical mirror sections (omitted by older operators)
  addons?: AddonReport[];
  graph?: ReportGraph;
  risk?: { byNamespace: NamespaceRisk[] };
}
