#!/bin/bash
# usage: run.sh <slug> <X>
R=/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
cd $R/tiledata/atlas-pick/candidates-worldmap/$1
python3 $R/scripts/content/atlas-pick/worldmap_check.py wv5-$2.pxg 2>&1 | tail -8
python3 $R/scripts/content/atlas-pick/worldmap_context.py wv5-$2.pxg | tail -1
