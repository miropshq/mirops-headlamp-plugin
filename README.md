# Mirops Headlamp plugin

A [Headlamp](https://headlamp.dev/) plugin (React + TypeScript) that visualizes the output of the
**mirops** Kubernetes operator. Its core value is the part a terminal can't show: it **draws the
dependency graph** of your cluster and shows where risk sits right now, and — when upgrade analysis is
on — whether the cluster is ready for a new Kubernetes version.

The plugin adds a **Mirops** sidebar section with two pages:

- **Cluster Mirror** (the landing page) — the cluster's state right now, from the always-on
  `ClusterMirror`.
- **Upgrade Analyses** — what a version upgrade adds on top: the verdict, add-on compatibility,
  removed APIs and drain blockers.

---

## Features

### Cluster Mirror

- **Live header** — when the mirror was last rebuilt, how often it rebuilds, its scope, and a
  **Refresh now** button (sets the `mirops.io/refresh` annotation). Rebuild errors show inline.
- **Summary** — components, dependencies, components at risk, and namespaces at risk.
- **Namespace risk** — a heatmap of the highest component risk per namespace, worst first.
- **At-risk components** — every component with risk 50 or higher, what depends on it, and where its
  risk comes from — plus the full **dependency graph** on demand.
- **Problems right now**, **add-ons detected**, and the **workload inventory**.
- **Several mirrors** — one mirror opens directly; with several, a list (the one named `default`
  opens first). With none, the page shows the YAML to create one.

### Upgrade Analyses

- **Only what the upgrade adds** — the cluster's current state (workloads, problems, namespace risk,
  the graph) lives on the Cluster Mirror page, linked from each analysis. Reports from operators before
  0.2.0 still show those sections in the analysis.
- **Turned-off notice** — when the operator runs with upgrade analysis off (Helm
  `upgrade.enabled=false`), the list and the create form say so and show the command to turn it on,
  instead of an analysis that would never finish.
- **Upgrade decision** — a condition-driven verdict (`SAFE | WARNING | CRITICAL | ERROR`) with a
  unified **Findings** panel listing every blocker and warning.
- **Readiness score** — a 0–100 gauge on its own health axis, separate from the verdict, so a healthy
  number never contradicts a blocked upgrade, with the score breakdown as status bars.
- **Upgrade impact** — for each add-on the target version breaks, everything that depends on it.
- **Add-on compatibility** — a table flagging incompatible add-ons and the version to upgrade to.
- **Upgrade checks** — deprecated APIs, add-on issues, CPU/memory pressure, pod drop and restarts: what
  draining the nodes and the new version depend on.
- **AI insights** — surfaces AI reasoning/score when enabled, and an explicit banner when the AI
  call failed (e.g. insufficient credit).
- **Remediation plans** — review, approve, and selectively execute operator-proposed actions.
- **Create & configure** — author an `UpgradeAnalysis` from the UI: target version, scope, report
  destination, and AI settings — provider, model, **max tokens**, and remediation risk level.

---

## Custom Resources

The plugin reads three **cluster-scoped** CRDs from the mirops operator (group `mirops.mirops.io/v1`):

| Kind | Purpose |
| --- | --- |
| `ClusterMirror` | The always-on mirror of the cluster: dependency graph and current risk. |
| `UpgradeAnalysis` | Requests/holds the upgrade-readiness analysis for the whole cluster. |
| `RemediationPlan` | Operator-proposed remediation actions, gated on approval. |

All three are **cluster-scoped** (they model/analyse/remediate the whole cluster, so they have no
namespace). The operator creates none of them for you except RemediationPlans.

### Data sources

- **The mirror report** (`<name>.mirror`) — the current state: `summary`, `atRisk`, `risk`, `addons`,
  `workloads`, `issues`, `graph`, and `upgrade` (whether upgrade analysis is on). The Cluster Mirror
  page reads it, and Upgrade Analyses reads its `upgrade.enabled` to show the turned-off notice.
- **The upgrade report** (`<name>.mirops`) — the `decision`, scores, add-on compatibility, removed
  APIs and drain blockers of one analysis.
- **CR status** — the mirror's `lastSync`, `syncError` and counters; the analysis's status-only
  fields: `aiError`, `aiScore`, `aiModel`, `addonsChecked`, `incompatibleAddons`, `lastAnalysisTime`,
  and a mirrored `decision`.

Both reports come from the operator's in-cluster reports service (`mirops-reports`), which reads remote
destinations (S3 / Azure Blob / PVC) back with the operator's own credentials. The plugin reaches it
through the Kubernetes API server's service proxy, so the browser never needs storage credentials.

### Operator versions

| Plugin | Operator | Notes |
| --- | --- | --- |
| `0.3.0` | `0.2.0` | Cluster Mirror page. With an older operator the Cluster Mirror page says it needs 0.2.0, and Upgrade Analyses keeps working. |
| `0.2.0` | `0.1.0` | Score breakdown as status bars. |
| `0.1.0` | `0.1.0` | Initial release. |

---

## Installation

The plugin ships as a container image; an `initContainer` copies it into Headlamp's plugin
directory on startup. See [deploy/headlamp-values.yaml](deploy/headlamp-values.yaml) for the full
Helm values.

```sh
# 1. Add the Headlamp Helm repo
helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/
helm repo update

# 2. Install Headlamp with the mirops plugin (public image, no pull secret needed)
helm install headlamp headlamp/headlamp -n headlamp --create-namespace \
  -f deploy/headlamp-values.yaml

# 3. Access it
kubectl -n headlamp port-forward svc/headlamp 8080:80
open http://localhost:8080
```

After CI pushes a new image, refresh with `kubectl -n headlamp rollout restart deploy/headlamp`.

### Configuring the operator's namespace

The mirops CRs are cluster-scoped, so they don't tell the plugin where the operator's report
Service (`mirops-reports`) lives. Set that namespace once in
[deploy/headlamp-values.yaml](deploy/headlamp-values.yaml):

```yaml
initContainers:
  - name: mirops-plugin
    env:
      - name: MIROPS_NAMESPACE
        value: mirops      # change if you install the operator elsewhere
```

The `initContainer` writes that value to a `config.json` next to the plugin, which the plugin reads
at runtime to proxy the reports (`<name>.mirror`, `<name>.mirops`) from the right place. **If unset,
it defaults to `mirops`.**

---

## The decision model

The decision is **condition-driven**, not score-driven:

```jsonc
"decision": {
  "allow": false,                 // THE gate (boolean). true = upgrade allowed
  "level": "CRITICAL",            // "SAFE" | "WARNING" | "CRITICAL"
  "blockers": [                   // every blocker is CRITICAL-level
    "incompatible add-on: istio 1.21.0 (upgrade to >=1.24.0)",
    "PVC test4/data is Lost"
  ]
}
```

- `decision.allow` is the boolean gate, derived from deterministic facts (incompatible add-ons, Lost
  PVCs, PDB, CPU/mem, pods not ready beyond a profile ratio) — **not** from the score.
- `scores.total` is a **readiness** gauge (↑ better) and no longer gates blocking.
- `ERROR` is a distinct config error (e.g. `targetVersion` not higher than the live cluster); the
  analysis did not run, so it's rendered neutrally rather than as a red verdict.

### Two opposite scales

- **Readiness** (`scores.total`, ↑ better) → the score gauge.
- **Risk severity** (node + namespace `risk`, ↑ worse) → CVSS-style colors
  (`0 None · 1–39 Low · 40–69 Medium · 70–89 High · 90–100 Critical`).

Risk is a different axis from `decision.level`: a node can be High risk while the decision is SAFE.

---

## Development

```sh
npm install
npm start      # run the plugin against a local Headlamp
npm run build  # production build
npm run tsc    # type-check
npm run lint   # eslint
npm run format # prettier
```

Requires Node `>=18 <=22`.

### Project layout

| Path | What |
| --- | --- |
| [src/types.ts](src/types.ts) | Contract types (`Report`, `MirrorReport`, `Decision`, …). |
| [src/resources.ts](src/resources.ts) | CR resource classes (Kubernetes API). |
| [src/reports.ts](src/reports.ts) · [src/mirror.ts](src/mirror.ts) | Report fetching through the service proxy; picking the mirror. |
| [src/index.tsx](src/index.tsx) | Sidebar + route registration. |
| [src/riskColor.ts](src/riskColor.ts) | Risk → severity/color mapping. |
| [src/components/ClusterMirrorList.tsx](src/components/ClusterMirrorList.tsx) · [ClusterMirrorDetail.tsx](src/components/ClusterMirrorDetail.tsx) | The Cluster Mirror page. |
| [src/components/DependencyGraph.tsx](src/components/DependencyGraph.tsx) | The dependency graph. |
| [src/components/UpgradeAnalysisDetail.tsx](src/components/UpgradeAnalysisDetail.tsx) | Upgrade analysis detail view. |
| [src/components/UpgradeAnalysisCreate.tsx](src/components/UpgradeAnalysisCreate.tsx) | Create form. |
| [src/components/UpgradeDisabled.tsx](src/components/UpgradeDisabled.tsx) | The "upgrade analysis is turned off" notice. |
| [src/components/DecisionChip.tsx](src/components/DecisionChip.tsx) · [ScoreGauge.tsx](src/components/ScoreGauge.tsx) · [RiskChip.tsx](src/components/RiskChip.tsx) · [RiskBadge.tsx](src/components/RiskBadge.tsx) | Badges & gauges. |

---

## License

Licensed under the [Apache License 2.0](LICENSE).
