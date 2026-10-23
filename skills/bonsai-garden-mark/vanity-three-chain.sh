#!/bin/bash
# ---
# id: 01M3BS43MG559908XR5HB4QMW7
# ---
# Chain vanity-three.mjs chunks across one bash call, resuming from
# vanity-three-state.json. Exits when a hit is written to fuji-shin-three.json,
# or after a deadline.
#
# Usage: ./vanity-three-chain.sh [deadline-seconds]

set -e
case "${1:-}" in
  -h|--help)
    echo "usage: ./vanity-three-chain.sh [deadline-seconds]   (default 38; CHUNK=<nonces per chunk> in the environment, default 65000000)"
    echo "  chains vanity-three.mjs chunks, resuming from vanity-three-state.json, until fuji-shin-three.json holds a hit or the deadline passes (exit 3)"
    exit 0 ;;
esac
cd "$(dirname "$0")"

DEADLINE_SECS=${1:-38}   # stop before the bash call hits its 45s timeout
CHUNK=${CHUNK:-65000000} # ~36s per chunk at 1.8M/s
T0=$(date +%s)

while true; do
  if [ -f fuji-shin-three.json ]; then
    echo "Found! See fuji-shin-three.json"
    exit 0
  fi
  ELAPSED=$(( $(date +%s) - T0 ))
  REMAINING=$(( DEADLINE_SECS - ELAPSED ))
  if [ $REMAINING -le 5 ]; then
    echo "Deadline approached (${ELAPSED}s elapsed). Stopping."
    exit 3
  fi

  START=0
  if [ -f vanity-three-state.json ]; then
    START=$(python3 -c "import json; print(json.load(open('vanity-three-state.json'))['nextStartN'])")
  fi

  echo "─── chunk startN=$START chunk=$CHUNK ─────────────────────────"
  set +e
  set -o pipefail
  node vanity-three.mjs --base fuji-shin --a 富 --b 士 --c 身 \
       --workers 4 --startN "$START" --chunk "$CHUNK" 2>&1 | tail -3
  RC=${PIPESTATUS[0]}
  set +o pipefail
  set -e
  echo "  (node exit=$RC, total elapsed $(( $(date +%s) - T0 ))s)"
  if [ "$RC" -eq 0 ] && [ -f fuji-shin-three.json ]; then
    echo "Found! See fuji-shin-three.json"
    exit 0
  fi
done
