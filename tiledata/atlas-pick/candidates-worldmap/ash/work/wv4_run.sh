#!/bin/bash
# usage: wv4_run.sh <slug> <A|B|C>...  (worktree root 에서)
slug=$1; shift
for v in "$@"; do
  f=tiledata/atlas-pick/candidates-worldmap/$slug/wv4-$v
  python3 scripts/content/pixel-harness/pxgrid/pxgrid.py render $f.pxg -o $f.png >/dev/null
  python3 scripts/content/pixel-harness/pxgrid/pxgrid.py tile $f.pxg $f-tile.png 3 >/dev/null
  python3 scripts/content/atlas-pick/worldmap_check.py $f.pxg 2>&1 | tail -25
  python3 scripts/content/atlas-pick/worldmap_context.py $f.pxg 2>&1 | tail -2
done
