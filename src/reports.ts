import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { useEffect, useState } from 'react';

// Viewing a remote report can fail at the proxy with HTTP 502 carrying a JSON
// body { error, location, detail }. Surface `detail` (the actionable cause)
// when present; fall back to the raw error message otherwise.
export function extractReportError(e: any): string {
  const raw = e?.message ?? String(e);
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === 'object' && body.detail) {
      return body.location ? `${body.detail} (${body.location})` : body.detail;
    }
  } catch {
    /* not JSON — use the raw message */
  }
  return raw;
}

// The operator serves the report (<name>.mirops) from an in-cluster Service named
// 'mirops-reports'. UpgradeAnalysis is cluster-scoped so it no longer carries a
// namespace to locate it, and the operator can be installed in any namespace.
// The deployer sets that namespace in headlamp-values.yaml; the initContainer
// writes it to a config.json next to the plugin, which we read at runtime. This
// default is the fallback when no config.json is present.
export const REPORTS_SERVICE_NAME = 'mirops-reports';
export const REPORTS_SERVICE_NAMESPACE = 'mirops';
const REPORTS_SERVICE_PORT = 8084;

// A report that isn't there yet (an export still in flight) is retried quietly every RETRY_MS, up to
// MAX_ATTEMPTS (~1 min), before the error is shown.
const RETRY_MS = 3000;
const MAX_ATTEMPTS = 20;

// Read the operator's namespace from the plugin's runtime config.json (written
// by the Helm initContainer from headlamp-values.yaml). Falls back to the
// default until/unless the file resolves.
export function useReportsNamespace(): string {
  const [namespace, setNamespace] = useState(REPORTS_SERVICE_NAMESPACE);
  useEffect(() => {
    fetch('/plugins/mirops/config.json')
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (cfg?.reportsNamespace) setNamespace(cfg.reportsNamespace);
      })
      .catch(() => {
        /* no config.json — keep the default */
      });
  }, []);
  return namespace;
}

interface UseReportOptions {
  // Don't fetch until the resource that owns the report has loaded.
  enabled: boolean;
  // Changes whenever a new report is expected (an analysis finished, the mirror rebuilt) and re-arms
  // the poll. Depending on the whole resource instead would re-run on every watch tick.
  refreshKey?: unknown;
  // The operator recorded a hard write failure: stop instead of retrying.
  failed?: boolean;
  // Clear the shown report while the next one loads. True for a re-run analysis, whose old verdict is
  // stale; false for the mirror, which is rewritten in place every few minutes.
  resetOnRefresh?: boolean;
}

// useReport fetches a report (<name>.mirops, <name>.mirror) from the operator's reports service. That
// service isn't reachable from the browser directly, so the request goes through the Kubernetes API
// server's service proxy via Headlamp's backend.
//
// It polls rather than trusting a single read: right after an analysis or a rebuild the export may
// still be in flight (the object isn't in storage yet → 404) and the watch can lag, so a one-shot fetch
// gets stuck. It retries quietly until the report is available and only surfaces an error once the
// operator reports a hard failure or the retries run out.
export function useReport<T>(file: string | undefined, opts: UseReportOptions) {
  const namespace = useReportsNamespace();
  const [report, setReport] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { enabled, refreshKey, failed = false, resetOnRefresh = true } = opts;

  useEffect(() => {
    if (!enabled || !file) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const path =
      `/api/v1/namespaces/${namespace}/services/${REPORTS_SERVICE_NAME}:${REPORTS_SERVICE_PORT}` +
      `/proxy/reports/${file}`;

    setLoading(true);
    setError(null);
    if (resetOnRefresh) setReport(null);

    const attempt = () => {
      if (failed) {
        if (!cancelled) setLoading(false);
        return;
      }
      ApiProxy.request(path)
        .then((data: T) => {
          if (cancelled) return;
          setReport(data);
          setLoading(false);
        })
        .catch(e => {
          if (cancelled) return;
          attempts += 1;
          if (attempts >= MAX_ATTEMPTS) {
            setError(extractReportError(e));
            setLoading(false);
          } else {
            timer = setTimeout(attempt, RETRY_MS); // report not written yet — keep waiting
          }
        });
    };
    attempt();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [file, namespace, enabled, refreshKey, failed, resetOnRefresh]);

  return { report, error, loading };
}
