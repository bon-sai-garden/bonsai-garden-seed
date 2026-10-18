---
title: "Script inventory"
type: report
---

# Script inventory

| script | where it runs |
|---|---|
| `resign-all.sh` | `/Users/orma/dev/garden/tools/` |
| `deploy-site.sh` | `/Users/orma/dev/garden/site/` |
| `observability-sync.sh` | `atelier-01.lan`, under launchd |

The daemon listens on `atelier-01.lan:5052`. A second copy lives at
`/Users/orma/Library/CloudStorage/OneDrive-Farrow/garden` and must never
be written to.
