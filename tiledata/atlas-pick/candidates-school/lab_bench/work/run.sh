#!/bin/bash
# usage: run.sh slug script
R=/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
python3 $R/tiledata/atlas-pick/candidates-school/lab_bench/work/$2 || exit 1
cd $R
python3 scripts/content/atlas-pick/check_candidate.py tiledata/atlas-pick/candidates-school/$1/s5-{A,B,C}.pxg
for x in A B C; do python3 scripts/content/atlas-pick/school_context.py tiledata/atlas-pick/candidates-school/$1/s5-$x.pxg >/dev/null; done
python3 tiledata/atlas-pick/candidates-school/lab_bench/work/sheet.py $1
