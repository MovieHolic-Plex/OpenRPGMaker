#!/bin/bash
# usage: run.sh <slug> [under-slug]  -- build, check, ctx, trio
R=/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
C=$R/tiledata/atlas-pick/candidates-worldmap
S=$1; U=${2:-plains}
(cd $C/$S/work && python3 build.py) || exit 1
for X in A B C; do
  python3 $R/scripts/content/atlas-pick/worldmap_check.py $C/$S/w2-$X.pxg 2>&1 | tail -3
  python3 $R/scripts/content/atlas-pick/worldmap_context.py $C/$S/w2-$X.pxg --under $U=$C/${3:-plains_base}/w2-$X.png >/dev/null
done
python3 $C/plains_base/work/trio.py $C/$S
