#!/usr/bin/env bash
# 조선 칩셋 전체 재생성 한 줄: 마을 20호 + 국내성 → 번들 시트·타일셋 → 참고문서 → 임시 폴더 저장·재로드 증명 → 장소 카드.
#   bash scripts/content/rebuild-joseon.sh                       # 기본 입력 위치
#   GUNGNAE_DIR=/다른/경로/tiledata/joseon-gungnae bash scripts/content/rebuild-joseon.sh
#   JOSEON_REPORT_ONLY=1 bash scripts/content/rebuild-joseon.sh  # 새 국내성 맵을 처음 합칠 때: 실패를 멈춤 없이 전부 보고
# 합칠 때 `…__s1` 변형 경고가 나오면 두 시트의 같은 이름 조각 그림이 다르다는 뜻이다(변형은 기준 조각의 통행 보정을 이어받는다. 모양이 달라졌으면 piece-walk-overrides.json 을 새 그림에 맞게 고친다).
# 입력(맵 빌더 산출): tiledata/joseon-village20/{chipset.png,pieces.json,map.json,extra.json}, $GUNGNAE_DIR/{joseon-gungnae-chipset.png,pieces.json,map.json,extra.json}
# 사용자의 실제 프로젝트 폴더·LegacyDb/Supabase·공용 DB 에는 쓰지 않는다. gates/vitest 를 돌리지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../.."
V=tiledata/joseon-village20
G="${GUNGNAE_DIR:-tiledata/joseon-gungnae}"
RELOADED="${JOSEON_EXPORT_RELOADED:-/tmp/joseon-reloaded.json}"
# 0) 마을 20호를 지금 조각 카탈로그로 다시 굽는다(같은 시드라 화면은 그대로, 기준 시트의 조각 그림이 국내성 시트와 같아져 합칠 때 변형이 안 생긴다).
#    이미 최신이면 SKIP_VILLAGE_REGEN=1 로 건너뛴다(약 40초).
if [ "${SKIP_VILLAGE_REGEN:-0}" != "1" ]; then
  (cd scripts/content/lib/joseon && JS_PROFILE=village20 JS_SEED=7 python3 demo20.py --candidate | tail -1)
fi
python3 scripts/content/build-joseon-tileset.py \
  --sheet "$V/joseon-village20-chipset.png" --pieces "$V/pieces.json" \
  --sheet "$G/joseon-gungnae-chipset.png" --pieces "$G/pieces.json" \
  --map "joseon_v20:$V/map.json:$V/extra.json:조선 마을 20호:0" \
  --map "gungnae:$G/map.json:$G/extra.json:국내성:1"
python3 scripts/content/prepare-joseon-baram-references.py
rm -rf "${JOSEON_SAVE_DIR:-/tmp/oprn-joseon-baram-proof}"
JOSEON_EXPORT_RELOADED="$RELOADED" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=7000}" node scripts/content/save-joseon-baram.mjs
node scripts/content/prepare-joseon-regions.mjs "$RELOADED"
