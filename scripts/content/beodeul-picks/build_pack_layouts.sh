#!/usr/bin/env bash
# 장소 팩에 완성 배치도를 합친다. 배치도 정의 = tiledata/beodeul-variants/<slug>/layouts/*.json (pack-layout-replay.mts 형식).
#   build_place_packs.py 를 먼저 돌린 뒤: scripts/content/beodeul-picks/build_pack_layouts.sh [slug...]   (없으면 배치도가 있는 장소 전부)
set -euo pipefail
cd "$(dirname "$0")/../../.."
slugs=("$@")
if [ "${#slugs[@]}" -eq 0 ]; then for d in tiledata/beodeul-variants/*/layouts; do [ -d "$d" ] && slugs+=("$(basename "$(dirname "$d")")"); done; fi
for slug in "${slugs[@]}"; do
  rm -rf "build/place-packs/$slug/layouts-out"; mkdir -p "build/place-packs/$slug/layouts-out"
  for f in tiledata/beodeul-variants/"$slug"/layouts/*.json; do
    bun scripts/qa/pack-layout-replay.mts "$slug" "$f" "build/place-packs/$slug/layouts-out/_last.png" --scale 1 --kit-out "build/place-packs/$slug/layouts-out" --verify
  done
  rm -f "build/place-packs/$slug/layouts-out/_last.png"
  python3 scripts/content/beodeul-picks/merge_pack_layouts.py "$slug"
done
