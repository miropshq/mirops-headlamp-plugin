# Contributing to mirops-headlamp-plugin

Thanks for your interest in the mirops Headlamp plugin — the React/TypeScript UI that visualizes
mirops upgrade-readiness reports inside [Headlamp](https://headlamp.dev). Contributions of all kinds
are welcome: bug reports, features, and docs.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## The ecosystem

mirops is a few repositories that work together:

| Repo | What it is |
| --- | --- |
| **mirops** | The operator (Go, controller-runtime) — collector, mirror engine, scoring, decision. |
| **mirops-headlamp-plugin** (this repo) | The Headlamp plugin (React/TS) that visualizes the report. |
| **mirops-cli** | CLI to run/enforce an analysis in CI. |
| **helm-charts** | The `mirops-operator` Helm chart. |
| **mirops-compat** | The community add-on ↔ Kubernetes compatibility matrix. |

Scoring/decision logic lives in the **operator**; this repo only renders what the report carries.

## Getting started

Prerequisites: Node.js (see `package.json`) and npm.

```bash
npm install
npm start        # run the plugin against a local Headlamp
npm run tsc      # typecheck (tsc --noEmit)
npm run lint     # eslint (fails on any warning)
npm run build    # production bundle
```

Run `npm run tsc` and `npm run lint` before pushing — CI fails on type errors or lint warnings.

## Making a change

1. **Fork** and branch from `main` (`feat/…`, `fix/…`).
2. Keep the change focused. The report shape is defined in `src/types.ts` — match the operator's
   `report.json`; don't invent fields the operator doesn't emit.
3. Run `npm run tsc && npm run lint && npm run build`.
4. Open a PR.

### Commit & PR conventions

This project uses **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
feat: …      # a new feature (minor)
fix: …       # a bug fix (patch)
docs: …      # documentation only
refactor: …  # no behavior change
chore: …     # tooling/CI
```

A breaking change adds a `!` (`feat!: …`) or a `BREAKING CHANGE:` footer (major).

## Reporting bugs & requesting features

Open an issue with what you expected, what happened, and a screenshot if it's a UI issue. For security
issues, **do not** open a public issue — see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the project's
[Apache License 2.0](LICENSE).
