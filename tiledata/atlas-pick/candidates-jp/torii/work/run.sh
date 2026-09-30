#!/bin/bash
# usage: run.sh slug [letters]  -> 생성 스크립트 실행, 검사, ctx, 시트
cd /home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick
S=$1; D=tiledata/atlas-pick/candidates-jp/$S
python3 $D/work/j3-gen.py || exit 1
for k in A B C; do python3 scripts/content/atlas-pick/check_candidate.py $D/j3-$k.pxg 2>&1 | grep -v '^1/1'; python3 scripts/content/atlas-pick/context.py $D/j3-$k.pxg >/dev/null 2>&1; done
python3 tiledata/atlas-pick/candidates-jp/torii/work/sheet.py $D j3-A j3-B j3-C
