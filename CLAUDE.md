## Mirops Engine (logical mirror) — new report.json sections

The operator now builds a logical mirror of the cluster. Three new top-level
sections in report.json (all omitempty), plus 2 new status fields.

### status (CR) — new fields
| Field | Type | Notes |
|---|---|---|
| `addonsChecked` | int | add-ons evaluated for compatibility |
| `incompatibleAddons` | int | add-ons incompatible with targetVersion |

### report.json `addons[]` — compatibility table
```jsonc
{ "name": "istio", "version": "1.21.0", "status": "incompatible",
  "requiredVersion": ">=1.24.0",   // the ADD-ON version to upgrade TO for the target k8s
  "note": "current version supports k8s >=1.27.0 <=1.30.0; upgrade to add-on >=1.24.0..." }
```
`status`: `compatible` (green) | `incompatible` (red) | `unknown` (gray).
When incompatible, render: "upgrade to {requiredVersion}".

### report.json `graph` — the mirror (full inventory, healthy or not)
```jsonc
{ "nodes": [ { "id": "Deployment/shop/frontend", "kind": "Deployment",
               "name": "frontend", "namespace": "shop", "type": "workload",
               "status": "Healthy", "risk": 54 } ],
  "edges": [ { "from": "...", "to": "...", "type": "depends-on" } ] }
```
- node `type`: `workload` (Deployment/StatefulSet/DaemonSet/Job/CronJob) |
  `network` (Service/Ingress) | `addon` | `config` (ConfigMap/Secret) |
  `storage` (PVC) | `infra` (Node)
- node `risk`: 0–100, already propagated through dependencies — color nodes by it
  (0 green → 100 red; >=50 means "at risk")
- edge `type`: `routes-to` (Ingress→Service) | `selects` (Service→workload) |
  `uses-config` | `uses-storage` (workload→PVC) | `runs-on` (workload→Node) |
  `depends-on` (workload/Ingress→add-on)

### report.json `risk.byNamespace[]` — namespace heatmap
```jsonc
{ "namespace": "shop", "risk": 54, "components": 5, "atRisk": 2 }
```
(`namespace: "cluster"` bucket holds cluster-scoped components: add-ons, nodes.)

### Suggested UI
1. Add-on compatibility table on the UpgradeAnalysis view (status badge +
   "upgrade to X" hint from requiredVersion).
2. Dependency graph view: nodes colored by risk, edge labels by type —
   answers "what breaks if I upgrade / drain this?"
3. Namespace risk heatmap from risk.byNamespace.
