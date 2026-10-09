#!/usr/bin/env bash
# 팩 전용 장소(waves.json "packOnly")를 공용 시트와 따로 굽고 장소 팩을 만든다.
#   scripts/content/beodeul-picks/bake_pack_only.sh [slug...]   (없으면 packOnly 전부)
# 공용 src/assets·public/assets 는 건드리지 않는다. 결과: build/pack-scratch/(굽기), build/place-packs/<slug>/(팩).
set -euo pipefail
cd "$(dirname "$0")/../../.."
S=build/pack-scratch
rm -rf "$S"; mkdir -p "$S"
cp src/assets/beodeulCityTileset.json src/assets/beodeulCityReferences.json "$S"/
cp src/assets/beodeulCitySheet.json "$S"/
cp public/assets/beodeul-city/beodeul-city-chipset.png "$S"/
BEODEUL_PACK_SCRATCH="$PWD/$S" python3 scripts/content/beodeul-picks/bake_picks.py
BEODEUL_PACK_SCRATCH="$PWD/$S" python3 scripts/content/beodeul-kits/contract.py apply
if [ "$#" -gt 0 ]; then python3 scripts/content/beodeul-picks/build_place_packs.py --scratch "$S" "$@"; else python3 scripts/content/beodeul-picks/build_place_packs.py --scratch "$S" --all; fi
