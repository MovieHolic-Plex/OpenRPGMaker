#!/usr/bin/env bash
# Renders every style's north-facing cliff with these reverse pieces through the real renderer (probe-any.mts face n),
# then writes probe/<style>.png (1x) and probe/<style>-3x.png (3x crop of the cut band).
set -e
D="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$D/../../../../.." && pwd)"
mkdir -p "$D/probe"
for s in grass-steps sand-steps snow-steps peat-steps cave-steps; do
  (cd "$ROOT" && RAMP_PIECES="$D/pieces.json" bun scripts/experiments/bbox-village/stairs/probe-any.mts "$s" n "$D/probe/$s.png" >/dev/null)
  rm -f "$D/probe/$s.json"
done
python3 - "$D" <<'PY'
import sys
from PIL import Image
D = sys.argv[1]
for s in ["grass-steps", "sand-steps", "snow-steps", "peat-steps", "cave-steps"]:
    im = Image.open(f"{D}/probe/{s}.png").convert("RGB")
    c = im.crop((0, 88, im.width, 208)); c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(f"{D}/probe/{s}-3x.png")
PY
python3 "$D/crops.py"
echo ok
