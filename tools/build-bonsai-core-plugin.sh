#!/usr/bin/env bash
# ---
# id: 01M3BS43XSA6ZS9FZ56D3118H5
# ---
# TOMBSTONE — tools/build-bonsai-core-plugin.sh folded into the one builder (the one builder, 2026-09-24).
#
# It packaged Bonsai's seed plugin by hand-picked copy, with no stamp, no manifest and no seal.
# The core plugin is now a configuration of core's one builder:
#
#   python3 skills/bonsai-garden-core-plugin/scripts/package.py \
#       --list <pot>/builds/package-list.json --only bonsai-garden-core
#
#   config: skills/bonsai-garden-core-plugin/assets/core-plugin.json
#
# This file stays so the old address is found. It packages nothing.
echo "tools/build-bonsai-core-plugin.sh is a tombstone. Use:" >&2
echo "  python3 skills/bonsai-garden-core-plugin/scripts/package.py --list <pot>/builds/package-list.json --only bonsai-garden-core" >&2
exit 2
