# Security Policy

mirops-headlamp-plugin is a Headlamp plugin that renders mirops upgrade-readiness reports in the
browser. We take its security seriously and appreciate responsible disclosure.

## Supported versions

Security fixes land on the latest released version. We recommend always running the most recent
release.

| Version | Supported |
| --- | --- |
| latest release | ✅ |
| older releases | ❌ (please upgrade) |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through either channel:

- **GitHub private vulnerability reporting** — *Security → Report a vulnerability* on the repository.
  This opens a private advisory visible only to the maintainers.
- **Email** — [security@mirops.com](mailto:security@mirops.com).

Please include a description of the issue and its impact, steps to reproduce, and the affected
version(s) and environment.

### What to expect

- **Acknowledgement** within a few business days.
- An assessment and, if confirmed, a fix timeline shared with you.
- Credit in the advisory once a fix is released, unless you prefer to remain anonymous.

## Scope notes

The plugin holds **no credentials of its own** — it reads `report.json` through the Kubernetes API
server proxy, using the viewer's existing Headlamp session. Treat rendered reports as **sensitive**:
they enumerate workloads, namespaces, and versions. Secure access to Headlamp and to any remote report
destination accordingly.

Thank you for helping keep mirops and its users safe.
