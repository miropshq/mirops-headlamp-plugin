// parseGoDuration turns a Go duration as the API serializes it ("5m0s", "1h30m0s", "500ms") into
// milliseconds; 0 when it can't be parsed. "ms" is matched before "m" so "500ms" isn't read as minutes.
export function parseGoDuration(d?: string): number {
  if (!d) return 0;
  const re = /(\d+(?:\.\d+)?)(ms|h|m|s)/g;
  let ms = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const v = parseFloat(m[1]);
    ms += m[2] === 'h' ? v * 3_600_000 : m[2] === 'm' ? v * 60_000 : m[2] === 's' ? v * 1000 : v;
  }
  return ms;
}

// durationLabel renders a Go duration compactly: "5m0s" → "5 min", "1h0m0s" → "1 h", "30s" → "30 s".
export function durationLabel(d?: string): string {
  const ms = parseGoDuration(d);
  if (!ms) return d ?? '';
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms % 60_000 === 0) return `${ms / 60_000} min`;
  return `${Math.round(ms / 1000)} s`;
}

// timeAgo renders how long ago an RFC 3339 timestamp was: "42 s ago", "5 min ago", "3 h ago", "2 d ago".
export function timeAgo(iso?: string, now = Date.now()): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

// componentLabel shortens a graph id ("Deployment/payments/payments-api") to "deployment/payments-api".
export function componentLabel(id: string): string {
  const parts = id.split('/');
  return `${parts[0].toLowerCase()}/${parts[parts.length - 1]}`;
}
