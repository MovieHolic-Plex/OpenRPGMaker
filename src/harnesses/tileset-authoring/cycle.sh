#!/bin/bash
# 감독용 한 바퀴: draw → bake → verify → 쇼케이스 → 미리보기 PNG(/tmp/viz). 사용: bash cycle.sh <run>
set -euo pipefail
cd "$(dirname "$0")/../../.."
R=qa-runs/harnesses/tileset-authoring/monster-overworld/$1
python3 src/harnesses/tileset-authoring/harness.py --theme monster-overworld --run $1 draw > /tmp/viz/draw.log 2>&1 || { tail -15 /tmp/viz/draw.log; echo "draw 실패 — 중단"; exit 1; }
grep -v "^나무" /tmp/viz/draw.log | tail -3
python3 src/harnesses/tileset-authoring/harness.py --theme monster-overworld --run $1 bake >/dev/null
npx tsx src/harnesses/tileset-authoring/node/verify.mts $R/bake | tail -8
npx tsx src/harnesses/tileset-authoring/node/showcase.mts $R/bake
npx tsx src/harnesses/tileset-authoring/node/showcase_interior.mts $R/bake
MAPFILE=verify-cave.json python3 src/harnesses/tileset-authoring/lib/render_map.py $R/bake /tmp/viz/cave_map.png 0 0 34 22 3
MAPFILE=verify-map.json python3 src/harnesses/tileset-authoring/lib/render_map.py $R/bake /tmp/viz/town_b.png 0 0 22 20 3
MAPFILE=verify-route.json python3 src/harnesses/tileset-authoring/lib/render_map.py $R/bake /tmp/viz/route_b.png 0 0 24 32 3
for n in center:15:11 mart:13:10 house:13:9 gymspin:18:18 gymelec:11:20 gymrock:15:17; do IFS=: read a w h <<<"$n"; MAPFILE=verify-room-$a.json python3 src/harnesses/tileset-authoring/lib/render_map.py $R/bake /tmp/viz/room_$a.png 0 0 $w $h 4; done
