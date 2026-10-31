#!/usr/bin/env bash
# Regenerate the four styles' cut pieces and their probe renders. Run from anywhere; renders need the repo root as cwd.
#   bash run.sh            nocut probes (sampling) -> pieces.py -> probes with the pieces (both width sets) -> crops
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$D/../../../../.." && pwd)"; cd "$ROOT"
STYLES="sand-steps snow-steps peat-steps cave-steps"
mkdir -p "$D/probe"
for s in $STYLES; do PROBE_NOCUT=1 bun "$D/probe.mts" "$s" s "$D/probe/$s-nocut.png" >/dev/null & done; wait
python3 "$D/pieces.py"
for s in $STYLES; do
  RAMP_PIECES="$D/pieces.json" bun "$D/probe.mts" "$s" s "$D/$s-probe.png" >/dev/null &
  RAMP_PIECES="$D/pieces.json" PROBE_ALT=1 bun "$D/probe.mts" "$s" s "$D/probe/$s-probe-alt.png" >/dev/null &
done; wait
python3 "$D/crops.py"
