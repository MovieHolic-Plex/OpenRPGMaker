#!/bin/bash
# 사용: src/harnesses/tileset-authoring/redeploy.sh <run> <theme...>  — draw → bake → 옛 run 견본 맵 복사 → wire (몬스터 칩셋 GBA 다시 그리기)
set -e
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
RUNN=$1; shift
H=src/harnesses/tileset-authoring/harness.py; R=qa-runs/harnesses/tileset-authoring; OLD=${OLD_RUNS:-/home/main/z-project/rpg-zzu-tileset-harness/$R}   # 견본 맵이 든 옛 run 폴더(qa-runs 는 저장소에 없다)
declare -A RUN=([overworld]=d100 [wild]=w197 [coast]=c107 [climate]=k103 [gyms]=g103 [rooms]=r102 [dungeon]=u101)
for t in "$@"; do (timeout 900 python3 $H --theme monster-$t --run $RUNN draw > /tmp/${RUNN}_$t.log 2>&1 || true; echo "draw $t: $(tail -1 /tmp/${RUNN}_$t.log)") & done; wait
for t in "$@"; do
  th=monster-$t; [ -e $R/$th/$RUNN/GATE-FAIL.txt ] && { echo "GATE-FAIL $t"; cat $R/$th/$RUNN/GATE-FAIL.txt; exit 1; }
  timeout 900 python3 $H --theme $th --run $RUNN bake | tail -1
  o=$OLD/$th/${RUN[$t]}/bake; n=$R/$th/$RUNN/bake
  for f in $(cd $o && ls); do [ -e $n/$f ] || cp -r $o/$f $n/; done
  timeout 600 python3 $H --theme $th --run $RUNN wire | tail -1
done
