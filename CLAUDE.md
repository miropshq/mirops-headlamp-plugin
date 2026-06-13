### Risk vs Readiness — two different scales, label them
- The cluster headline `status.totalScore` / report `scores.total` is a READINESS
  score: 0-100, HIGHER IS BETTER (100 = ready). Label it "Readiness Score", green ring.
- Per-component `graph.nodes[].risk` and `risk.byNamespace[].risk` are RISK: 0-100,
  HIGHER IS WORSE. Render as CVSS-style severity badges, NOT as a /100 number next
  to the readiness score:
    0 → None (green) | 1-39 → Low | 40-69 → Medium | 70-89 → High | 90-100 → Critical (red)
- Rationale: this mirrors Microsoft Secure Score / Wiz (global score higher=better,
  per-item severity higher=worse). The two must look visually distinct so users
  don't compare them directly.