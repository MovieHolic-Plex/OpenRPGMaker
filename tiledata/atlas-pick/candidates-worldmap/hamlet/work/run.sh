#!/bin/bash
# usage: run.sh slug X  (work/X.art -> wv7-X.pxg, 검사·맥락)
R=/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
S=$R/tiledata/atlas-pick/candidates-worldmap/$1
python3 $R/tiledata/atlas-pick/candidates-worldmap/hamlet/work/wv7-build.py $S/work/$2.art $S/wv7-$2.pxg "$1 wv7-$2" || exit 1
cd $R
python3 scripts/content/atlas-pick/worldmap_check.py tiledata/atlas-pick/candidates-worldmap/$1/wv7-$2.pxg
python3 scripts/content/atlas-pick/worldmap_context.py tiledata/atlas-pick/candidates-worldmap/$1/wv7-$2.pxg >/dev/null
python3 -c "
import json;d=json.load(open('$S/wv7-$2.check.json'));print('HARD',d['hard']);print('WARN',d['warn']);print(d.get('lint'))"
