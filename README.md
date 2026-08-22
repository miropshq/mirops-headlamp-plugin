# mirops Headlamp plugin

A [Headlamp](https://headlamp.dev/) plugin (React + TypeScript) that visualizes the output of the
**mirops** Kubernetes operator. Its core value is the part a terminal can't show: it **draws the
dependency graph** of your cluster and renders the upgrade decision, add-on compatibility, and
per-namespace risk.

mirops analyses whether a Kubernetes cluster is ready to upgrade to a target version. This plugin
surfaces that analysis inside Headlamp, next to the live cluster it already talks to.

---

## Features

- **Upgrade decision** — a condition-driven verdict (`SAFE | WARNING | CRITICAL | ERROR`) with a
  unified **Findings** panel listing every blocker and warning.
- **Readiness score** — a 0–100 gauge on its own health axis, separate from the verdict, so a healthy
  number never contradicts a blocked upgrade.
- **Risk & Compatibility** — one tabbed section switching between **Add-on Compatibility**, **Namespace
  Risk** (heatmap), and the **Dependency Graph**. It opens on whatever is wrong (context-aware) and each
  tab carries a count badge.
- **Dependency graph** — `graph.nodes` + `graph.edges`, nodes colored by **risk** (CVSS-style), shaped
  by **type** (`workload | network | addon | config | storage | infra`), and labeled with the **risk
  value** on each node. Conditional: when nothing depends on the at-risk components it dims and shows a
  *no dependency chains* state instead of a lone node.
- **Add-on compatibility** — a table flagging incompatible add-ons and the version to upgrade to.
- **Workloads & metrics** — deployments, statefulsets, daemonsets, jobs, **PVCs** (with phase),
  **standalone pods**, and deprecated APIs — behind an *only show problems* toggle — plus pod health,
  resource pressure, and stability deltas. Long tables and the issue list **paginate**.
- **AI insights** — surfaces AI reasoning/score when enabled, and an explicit banner when the AI
  call failed (e.g. insufficient credit).
- **Remediation plans** — review, approve, and selectively execute operator-proposed actions.
- **Create & configure** — author an `UpgradeAnalysis` from the UI: target version, scope, report
  destination, and AI settings — provider, model, **max tokens**, and remediation risk level.

---

## Custom Resources

The plugin reads two **cluster-scoped** CRDs from the mirops operator (group `mirops.mirops.io/v1`):

| Kind | Purpose |
| --- | --- |
| `UpgradeAnalysis` | Requests/holds the upgrade-readiness analysis for the whole cluster. |
| `RemediationPlan` | Operator-proposed remediation actions, gated on approval. |

Both are **cluster-scoped** (they analyse/remediate the whole cluster, so they have no namespace).

### Two data sources

- **`report.json`** — the full mirror (`graph`, `risk`, `addons`), `decision`, scores, metrics, and
  workloads. Served by the operator's in-cluster HTTP endpoint (or S3 / Azure Blob / PVC). The
  plugin reaches it through the Kubernetes API server's service proxy.
- **`UpgradeAnalysis` CR status** — status-only fields not in `report.json`: `aiError`, `aiScore`,
  `aiModel`, `addonsChecked`, `incompatibleAddons`, `reportPath`, `lastAnalysisTime`, and a mirrored
  `decision`.

The plugin prefers `report.json` for everything it has and uses the CR status only for the
status-only fields (notably `aiError`).

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

`UpgradeAnalysis` is cluster-scoped, so it doesn't tell the plugin where the operator's report
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
at runtime to proxy `report.json` from the right place. **If unset, it defaults to `mirops`.**

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
| [src/types.ts](src/types.ts) | Contract types (`Report`, `Decision`, …). |
| [src/resources.ts](src/resources.ts) | CR resource classes (Kubernetes API). |
| [src/index.tsx](src/index.tsx) | Sidebar + route registration. |
| [src/riskColor.ts](src/riskColor.ts) | Risk → severity/color mapping. |
| [src/components/DependencyGraph.tsx](src/components/DependencyGraph.tsx) | The dependency graph. |
| [src/components/UpgradeAnalysisDetail.tsx](src/components/UpgradeAnalysisDetail.tsx) | Detail view. |
| [src/components/UpgradeAnalysisCreate.tsx](src/components/UpgradeAnalysisCreate.tsx) | Create form. |
| [src/components/DecisionChip.tsx](src/components/DecisionChip.tsx) · [ScoreGauge.tsx](src/components/ScoreGauge.tsx) · [RiskChip.tsx](src/components/RiskChip.tsx) · [RiskBadge.tsx](src/components/RiskBadge.tsx) | Badges & gauges. |

See [CLAUDE.md](CLAUDE.md) for deeper contract notes and invariants to preserve.

---

## License

Licensed under the [Apache License 2.0](LICENSE).
