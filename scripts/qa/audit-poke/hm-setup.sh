#!/usr/bin/env bash
# Phase 2 검증용 프로젝트: 원정 1관 + 1번길 들판 y=16 줄을 바위로 막고 가운데 한 칸(15,16)을 덩굴 장애물(절단형)로 둔다. 기술 서(HM)는 들판 남쪽 상자에.
set -e
cd "$(dirname "$0")/../../.."
P=${1:-qa-runs/poke-fix-p/hm1.json}; B=${2:-/tmp/pfp2.mjs}
rm -f "$B" "$P" "$P.history" -r
run(){ node scripts/oprn-tools.mjs --project "$P" --bundle "$B" --write "$@" 2>&1 | grep -E '"ok"|"summary"|"message"|"code"' | head -6; }
node scripts/oprn-tools.mjs --new --project "$P" --bundle "$B" --write build_monster_game '{"mode":"create","gymCount":1}' > /dev/null 2>&1
run paint_tiles '{"mapId":"mx_map_meadow","layer":"upper","mode":"rect","tile":641,"from":{"x":4,"y":16},"to":{"x":14,"y":16}}'
run paint_tiles '{"mapId":"mx_map_meadow","layer":"upper","mode":"rect","tile":641,"from":{"x":16,"y":16},"to":{"x":19,"y":16}}'
run place_field_obstacle '{"mapId":"mx_map_meadow","x":15,"y":16,"kind":"tree","id":"ev_hm_tree_1"}'
run place_chest '{"mapId":"mx_map_meadow","x":10,"y":26,"contents":{"itemId":"item_hm_cut"},"id":"ev_hm_chest"}'
