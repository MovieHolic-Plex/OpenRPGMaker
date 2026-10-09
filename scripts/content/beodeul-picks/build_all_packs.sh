#!/usr/bin/env bash
# 장소 팩 전체 재빌드: 공용 시트 굽기 → 공용 장소 팩 → 팩 전용 굽기+팩 → 완성 배치도 합치기 → 스토어 매니페스트 검증.
set -euo pipefail
cd "$(dirname "$0")/../.."
cd "$(git rev-parse --show-toplevel)"
python3 scripts/content/beodeul-picks/bake_picks.py | tail -1
python3 scripts/content/beodeul-picks/build_place_packs.py --all > /dev/null
scripts/content/beodeul-picks/bake_pack_only.sh | tail -16
scripts/content/beodeul-picks/build_pack_layouts.sh
npx tsx store-server/scripts/placePacks.ts --dry | grep -vc " OK" || true
