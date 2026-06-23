# mirops-ui — Re-analyze button

Add a **"Re-analyze"** button to the `UpgradeAnalysis` detail view that re-runs the analysis on
demand (e.g. after the user fixed something in the cluster and wants to re-evaluate the same CR).

The operator re-runs when the **`mirops.io/refresh`** annotation changes — it bypasses the resync
interval. There is no special "reconcile" API; the button just **patches that annotation**. This
mirrors the existing approve flow in `src/components/RemediationPlanDetail.tsx`
(`item.patch({ spec: {...} })`).

In `src/components/UpgradeAnalysisDetail.tsx` — `item` is already the `UpgradeAnalysis` KubeObject
from `UpgradeAnalysis.useGet(name)` (~line 311); `Button` / `CircularProgress` / `Alert` / `useState`
are already imported:

```tsx
const [refreshing, setRefreshing] = useState(false);
const [refreshError, setRefreshError] = useState<string | null>(null);

async function reanalyze() {
  setRefreshing(true);
  setRefreshError(null);
  try {
    await item.patch({
      metadata: { annotations: { 'mirops.io/refresh': String(Date.now()) } },
    });
  } catch (e) {
    setRefreshError(e instanceof Error ? e.message : String(e));
  } finally {
    setRefreshing(false);
  }
}
```

Place the button next to the existing "Raw JSON" button (the flex-end `Box`, ~line 661):

```tsx
<Button variant="contained" size="small" disabled={refreshing} onClick={reanalyze}>
  {refreshing ? <CircularProgress size={18} /> : 'Re-analyze'}
</Button>
{refreshError && <Alert severity="error">{refreshError}</Alert>}
```

Notes:
- `item.patch({ metadata: { annotations: {...} } })` is a merge patch — it only adds/updates the
  annotation; the rest of the object is untouched. The operator detects it and re-runs; Headlamp's
  detail view auto-refreshes, so the new decision/score appears in seconds.
- Prefer the name **"Re-analyze"** over "Reconcile" — describe the user action, not the k8s mechanism.
- A spec edit also re-runs immediately (operator `observedGeneration`), so this button is mainly for
  re-running after fixing the *cluster* rather than the CR.
