#!/usr/bin/env bash
# 조선 칩셋 전체 재생성 한 줄: 마을 20호 + 국내성 → 번들 시트·타일셋 → 참고문서 → 임시 폴더 저장·재로드 증명 → 장소 카드.
#   bash scripts/content/rebuild-joseon.sh                       # 기본 입력 위치
#   GUNGNAE_DIR=/다른/경로/tiledata/joseon-gungnae bash scripts/content/rebuild-joseon.sh
#   JOSEON_REPORT_ONLY=1 bash scripts/content/rebuild-joseon.sh  # 새 국내성 맵을 처음 합칠 때: 실패를 멈춤 없이 전부 보고
# 합칠 때 `…__s1` 변형 경고가 나오면 두 시트의 같은 이름 조각 그림이 다르다는 뜻이다(변형은 기준 조각의 통행 보정을 이어받는다. 모양이 달라졌으면 piece-walk-overrides.json 을 새 그림에 맞게 고친다).
# 입력(맵 빌더 산출): $GUNGNAE_FULL_DIR/{joseon-gungnae-full-chipset.png,pieces.json,map.json,extra.json}(200×208 원작 규모, 세 번째 시트·맵), tiledata/joseon-village20/{chipset.png,pieces.json,map.json,extra.json}, $GUNGNAE_DIR/{joseon-gungnae-chipset.png,pieces.json,map.json,extra.json}
# 장소 카드는 14장(마을 20호·국내성 둘·사냥터·동굴·실내 6·궁 내부 3).
# 사용자의 실제 프로젝트 폴더·LegacyDb/Supabase·공용 DB 에는 쓰지 않는다. gates/vitest 를 돌리지 않는다.
set -euo pipefail
cd "$(dirname "$0")/../.."
V=tiledata/joseon-village20
G="${GUNGNAE_DIR:-tiledata/joseon-gungnae}"
F="${GUNGNAE_FULL_DIR:-tiledata/joseon-gungnae-full}"
RELOADED="${JOSEON_EXPORT_RELOADED:-/tmp/joseon-reloaded.json}"
# 0) (선택) 마을 20호를 지금 조각 카탈로그로 다시 굽는다: REGEN_VILLAGE=1. 기본은 건너뛴다 — 기준 시트(마을 20호)가 바뀌면
#    이미 배포된 칸 번호(기준 시트 번호는 불변)가 전부 달라지기 때문이다. 새 시트의 새 조각·변형은 합치기 규칙이 꼬리에 덧붙인다.
if [ "${REGEN_VILLAGE:-0}" = "1" ]; then
  (cd scripts/content/lib/joseon && JS_PROFILE=village20 JS_SEED=7 python3 demo20.py --candidate | tail -1)
fi
# 시트·맵 목록(시트순번 = 목록 순서). 앞 3 장(마을 20호·국내성·국내성 원작 규모)은 동결 장부(frozen-layout.json)가 칸 번호를 지킨다 —
# 뒤의 새 판(사냥터·동굴·실내 6·궁 3)은 그 뒤에 덧붙고 앞 칸 번호는 한 칸도 안 바뀐다(build-joseon-tileset.py 가 해시로 확인한다).
SHEETS=("$V/joseon-village20-chipset.png:$V/pieces.json" "$G/joseon-gungnae-chipset.png:$G/pieces.json" "$F/joseon-gungnae-full-chipset.png:$F/pieces.json")
MAPS=("joseon_v20:$V/map.json:$V/extra.json:조선 마을 20호:0" "gungnae:$G/map.json:$G/extra.json:국내성:1" "gungnae_full:$F/map.json:$F/extra.json:국내성 원작 규모:2")
add_map() {   # add_map <맵id> <폴더> <파일 머리> <이름>  — 시트순번은 지금까지 쌓인 시트 수
  SHEETS+=("$2/$3-chipset.png:$2/pieces.json")
  MAPS+=("$1:$2/map.json:$2/extra.json:$4:$(( ${#SHEETS[@]} - 1 ))")
}
add_map joseon_field "${FIELD_DIR:-tiledata/joseon-field}" joseon-field "조선 사냥터"
add_map joseon_cave "${CAVE_DIR:-tiledata/joseon-cave}" joseon-cave "조선 동굴"
IB="${INTERIOR_B_DIR:-tiledata/joseon-interior-b}"
add_map joseon_in_house_b "$IB/joseon_in_house_b" joseon-in-house-b "조선 민가 실내"
add_map joseon_in_inn_b "$IB/joseon_in_inn_b" joseon-in-inn-b "조선 주막 실내"
add_map joseon_in_smith_b "$IB/joseon_in_smith_b" joseon-in-smith-b "조선 대장간 실내"
add_map joseon_in_pharmacy_b "$IB/joseon_in_pharmacy_b" joseon-in-pharmacy-b "조선 약방 실내"
add_map joseon_in_school_b "$IB/joseon_in_school_b" joseon-in-school-b "조선 서당 실내"
add_map joseon_in_office_b "$IB/joseon_in_office_b" joseon-in-office-b "조선 관아 동헌 실내"
PI="${PALACE_INT_DIR:-tiledata/joseon-palace-int}"
add_map joseon_in_throne "$PI/joseon_in_throne" joseon-in-throne "조선 궁 정전 어좌 홀"
add_map joseon_in_corridor "$PI/joseon_in_corridor" joseon-in-corridor "조선 궁 회랑"
add_map joseon_in_bedchamber "$PI/joseon_in_bedchamber" joseon-in-bedchamber "조선 궁 침전"
ARGS=()
for s in "${SHEETS[@]}"; do ARGS+=(--sheet "${s%%:*}" --pieces "${s#*:}"); done
for m in "${MAPS[@]}"; do ARGS+=(--map "$m"); done
python3 scripts/content/build-joseon-tileset.py "${ARGS[@]}" ${JOSEON_BUILD_ARGS:-}
if [ "${JOSEON_STOP_AFTER_BUILD:-0}" = "1" ]; then exit 0; fi   # 시트·타일셋·맵 JSON 까지만(참고문서·저장 증명·장소 카드는 건너뜀)
python3 scripts/content/prepare-joseon-baram-references.py
rm -rf "${JOSEON_SAVE_DIR:-/tmp/oprn-joseon-baram-proof}"
JOSEON_EXPORT_RELOADED="$RELOADED" NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=7000}" node scripts/content/save-joseon-baram.mjs
node scripts/content/prepare-joseon-regions.mjs "$RELOADED"
# 목록 축소본(catalog-thumbs) — 없으면 장소·칩셋 목록이 원본으로 넘어가며 오류 로그를 남긴다. build-catalog-thumbs.py 와 같은 함수를 쓴다.
python3 - <<'PY'
from importlib.machinery import SourceFileLoader
from pathlib import Path
from PIL import Image
m = SourceFileLoader("bct", "scripts/content/build-catalog-thumbs.py").load_module()
import re
src = Path("src/project/joseonPlaceReferences.ts").read_text()
names = re.findall(r'"preview": "/assets/region-references/([^"]+)\.png"', src)
assert len(names) >= 14, names   # 마을 20호·국내성 둘·사냥터·동굴·실내 6·궁 내부 3
for n in names:
    with Image.open(f"public/assets/region-references/{n}.png") as im:
        m.write_long_edge(im, Path(f"public/assets/catalog-thumbs/region-references/{n}.png"))
dest = Path("public/assets/catalog-thumbs/sheets/joseon-baram/joseon-baram-chipset.png")
dest.parent.mkdir(parents=True, exist_ok=True)
with Image.open("public/assets/joseon-baram/joseon-baram-chipset.png") as im:
    f = im.convert("RGBA")
    c = f.crop((0, 0, min(48, f.width), min(64, f.height)))
    c.thumbnail((32, 40), Image.Resampling.BOX)
    c.save(dest, "PNG", optimize=True)
PY
