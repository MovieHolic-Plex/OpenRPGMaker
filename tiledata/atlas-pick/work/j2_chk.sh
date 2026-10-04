#!/bin/bash
# usage: j2_chk.sh slug [K]
cd /home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
for f in tiledata/atlas-pick/candidates-jp/$1/j2-?.pxg; do python3 scripts/content/atlas-pick/check_candidate.py $f 2>&1 | grep -E "합격|불합격|✗" | head -3; done
cd tiledata/atlas-pick && K=${2:-8} python3 work/j2_view.py $1
