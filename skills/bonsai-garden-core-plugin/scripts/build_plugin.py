#!/usr/bin/env python3
# ---
# id: 01M3BS43FFZN3YTSVSZPTXP8X5
# ---
"""TOMBSTONE — build_plugin.py folded into the one builder (the one builder, 2026-09-24).

It mirrored the whole core repo into bonsai-garden-core.plugin, with no stamp, no manifest and
no seal. The core plugin is now a configuration of core's one builder, and builds from a checkout
of core alone (2026-10-17):

    python3 skills/bonsai-garden-core-plugin/scripts/package.py

    config: skills/bonsai-garden-core-plugin/assets/core-plugin.json
    output: .build/bonsai-garden-core.plugin (an UNSEALED LOCAL BUILD unless the owners name --salts)

This file stays so the old address is found. It packages nothing.
"""

import sys

sys.exit(__doc__)
