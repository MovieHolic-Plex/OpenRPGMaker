#!/bin/bash
# usage: w72-run.sh slug A [wall]
cd /home/main/z-project/rpg-zzu-interior-v34b
S=tiledata/hand-interior/pick/candidates/$1
python3 scripts/content/hand-interior-pick/check_candidate.py $S/w72-$2.pxg | head -3
if [ "$3" = wall ]; then python3 scripts/content/atlas-pick/interior_view34_audit.py --wall-tall $S/w72-$2.png; 
elif [ "$3" = obj ]; then python3 scripts/content/atlas-pick/interior_view34_audit.py --object $S/w72-$2.png; fi
python3 scripts/content/hand-interior-pick/context.py $S/w72-$2.pxg | tail -1
cd tiledata/hand-interior/pick && python3 w72-view.py /tmp/w72-$1.png 10 candidates/$1/w72-$2.png
