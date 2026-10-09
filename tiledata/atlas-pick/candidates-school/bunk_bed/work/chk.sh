#!/bin/bash
# usage: chk.sh slug...   -> 검사+맥락 그림
cd /home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
for s in "$@"; do
  for X in A B C; do
    f=tiledata/atlas-pick/candidates-school/$s/s3-$X.pxg
    [ -f $f ] || continue
    python3 scripts/content/atlas-pick/check_candidate.py $f | head -3 | grep -v '^1/1'
    python3 scripts/content/atlas-pick/school_context.py $f >/dev/null 2>&1
  done
done
