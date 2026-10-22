#!/usr/bin/env bash
# Re-colour every shipped Beodeul tree/forest sheet after a leaf-ramp change in palette.json (shapes and cell numbers stay).
# Order matters: city trees first (restyle owns the kits it relights, recolour_city_trees the other placed cells), then the
# canopy autotile, then the tree studies -> warm lookup -> palette studies -> woodland groups -> warm trees.
# Do not run build-beodeul-ground.py (stale, destructive).
#   bash scripts/content/beodeul-redraw/rebuild_colours.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
mkdir -p verify-shots/beodeul-tree-variants verify-shots/beodeul-tree-palette
(cd scripts/content/beodeul-redraw && python3 draw_trees_a.py >/dev/null && python3 draw_trees_b.py >/dev/null)
python3 scripts/content/restyle-beodeul-foliage.py | tail -1
python3 scripts/content/beodeul-redraw/recolour_city_trees.py | cut -c1-60
python3 scripts/content/append-beodeul-forest-canopy.py | tail -1
node scripts/content/beodeul-tree-studies.mjs >/dev/null
python3 scripts/content/beodeul-redraw/warm_lookup.py >/dev/null
node scripts/content/beodeul-tree-palette-studies.mjs >/dev/null
python3 scripts/content/beodeul-redraw/rebuild_woodland.py
python3 scripts/content/build-beodeul-warm-trees.py 2>/dev/null
python3 scripts/content/beodeul-redraw/measure_forest_contrast.py
