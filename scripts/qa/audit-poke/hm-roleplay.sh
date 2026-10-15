#!/usr/bin/env bash
# 조수 대용 역할극 1판(슬라이스 3 요청: 「1번 도로에 바위 비전머신·시야선 트레이너·절벽」) — 도구만 보고 일한다.
set -e
cd "$(dirname "$0")/../../.."
P=${1:-qa-runs/poke-fix-p/rp1.json}; B=${2:-/tmp/pfp2.mjs}
rm -rf "$P" "$P.history" "$B"
run(){ echo "\$ $1"; node scripts/oprn-tools.mjs --project "$P" --bundle "$B" --write "$@" 2>&1 | grep -E '"ok"|"summary"|"code"|같은 id' | head -4 | cut -c1-260; }
node scripts/oprn-tools.mjs --new --project "$P" --bundle "$B" --write build_monster_game '{"mode":"create","gymCount":1}' >/dev/null 2>&1
# 1번길 y=16 줄에 울타리 바위 줄(타일 641) — 가운데 15,16 한 칸만 비전머신 바위(덩굴 나무)
run paint_tiles '{"mapId":"mx_map_meadow","layer":"upper","mode":"rect","tile":641,"from":{"x":0,"y":16},"to":{"x":14,"y":16}}'
run paint_tiles '{"mapId":"mx_map_meadow","layer":"upper","mode":"rect","tile":641,"from":{"x":16,"y":16},"to":{"x":23,"y":16}}'
run place_field_obstacle '{"mapId":"mx_map_meadow","x":15,"y":16,"kind":"tree","id":"ev_hm_tree_1"}'
run place_field_obstacle '{"mapId":"mx_map_meadow","x":15,"y":10,"kind":"rock","id":"ev_hm_rock_1"}'
run place_chest '{"mapId":"mx_map_meadow","x":10,"y":26,"contents":{"itemId":"item_hm_cut"},"id":"ev_hm_chest_cut"}'
run place_chest '{"mapId":"mx_map_meadow","x":12,"y":26,"contents":{"itemId":"item_hm_shove"},"id":"ev_hm_chest_shove"}'
