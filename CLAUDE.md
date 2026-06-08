# mirops-ui

Plugin de Headlamp para el operator mirops.

## Contexto

mirops es un Kubernetes operator que analiza clusters para upgrades.
Genera dos CRDs:
- `UpgradeAnalysis` — análisis de readiness con score 0-100 y decisión SAFE/WARNING/BLOCK
- `RemediationPlan` — acciones propuestas por AI para corregir problemas

## Lo que hace este plugin

1. Vista de `UpgradeAnalysis` — muestra score, decisión, AI reasoning y el reporte completo
2. Vista de `RemediationPlan` — checkboxes por acción (skip), botones "Ejecutar todo" y "Ejecutar seleccionadas"

## Reporte JSON

El operator sirve los reportes via HTTP en:
http://mirops-operator-reports.<namespace>.svc:8084/reports/<analysis-name>.json

## Stack

- Headlamp plugin SDK (@kinvolk/headlamp-plugin)
- React + TypeScript

## CRDs relevantes

- apiVersion: mirops.mirops.io/v1
- kinds: UpgradeAnalysis, RemediationPlan