---
title: "Where things live"
type: note
---

# Where things live

Configuration lives in `~/.config/bonsai/`. The daemon binds
`http://localhost:5052`. Scripts resolve the repository root from
`$GARDEN_ROOT`, or by walking up to the marker file - never by counting
parent directories, because a script that moves must still find its home.

Signed material goes under `<repo>/rituals/`, relative to the root.
