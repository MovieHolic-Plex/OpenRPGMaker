#!/usr/bin/env bash
# 조선 칩셋 전체 재생성 한 줄: 마을 20호 + 국내성 → 번들 시트·타일셋 → 참고문서 → 임시 폴더 저장·재로드 증명 → 장소 카드.
#   bash scripts/content/rebuild-joseon.sh                       # 기본 입력 위치
#   GUNGNAE_DIR=/다른/경로/tiledata/joseon-gungnae bash scripts/content/rebuild-joseon.sh
#   JOSEON_REPORT_ONLY=1 bash scripts/content/rebuild-joseon.sh  # 새 국내성 맵을 처음 합칠 때: 실패를 멈춤 없이 전부 보고
# 합칠 때 `…__s1` 변형 경고가 나오면 두 시트의 같은 이름 조각 그림이 다르다는 뜻이다(변형은 기준 조각의 통행 보정을 이어받는다. 모양이 달라졌으면 piece-walk-overrides.json 을 새 그림에 맞게 고친다).
# 입력(맵 빌더 산출): $GUNGNAE_FULL_DIR/{joseon-gungnae-full-chipset.png,pieces.json,map.json,extra.json}(200×208 원작 규모, 세 번째 시트·맵), tiledata/joseon-village20/{chipset.png,pieces.json,map.json,extra.json}, $GUNGNAE_DIR/{joseon-gungnae-chipset.png,pieces.json,map.json,extra.json}
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
# 새 장소 12장(사냥터·동굴·실내 방 6·궁 내부 4)은 시트순번 3 이후로 덧붙인다 — 기준 시트 번호·기존 세 맵의 번호는 그대로(꼬리 덧붙이기).
FLD="${JOSEON_FIELD_DIR:-tiledata/joseon-field}"
CAV="${JOSEON_CAVE_DIR:-tiledata/joseon-cave}"
INT="${JOSEON_INTERIOR_DIR:-tiledata/joseon-interior}"
SHEETS=(--sheet "$V/joseon-village20-chipset.png" --pieces "$V/pieces.json"
        --sheet "$G/joseon-gungnae-chipset.png" --pieces "$G/pieces.json"
        --sheet "$F/joseon-gungnae-full-chipset.png" --pieces "$F/pieces.json"
        --sheet "$FLD/joseon-field-chipset.png" --pieces "$FLD/pieces.json"
        --sheet "$CAV/joseon-cave-chipset.png" --pieces "$CAV/pieces.json")
MAPS=(--map "joseon_v20:$V/map.json:$V/extra.json:조선 마을 20호:0"
      --map "gungnae:$G/map.json:$G/extra.json:국내성:1"
      --map "gungnae_full:$F/map.json:$F/extra.json:국내성 원작 규모:2"
      --map "joseon_field:$FLD/map.json:$FLD/extra.json:조선 사냥터:3"
      --map "joseon_cave:$CAV/map.json:$CAV/extra.json:조선 동굴:4")
SI=5
for r in "house:조선 민가 실내" "inn:조선 주막 실내" "smith:조선 대장간 실내" "pharmacy:조선 약방 실내" "school:조선 서당 실내" "office:조선 관아 실내" \
         "throne:조선 궁 어좌전" "corridor:조선 궁 회랑" "bedchamber:조선 궁 침전" "library:조선 궁 서고"; do
  id="${r%%:*}"; nm="${r#*:}"; D="$INT/joseon_in_$id"
  SHEETS+=(--sheet "$D/joseon_in_$id-chipset.png" --pieces "$D/pieces.json")
  MAPS+=(--map "joseon_in_$id:$D/map.json:$D/extra.json:$nm:$SI")
  SI=$((SI + 1))
done
python3 scripts/content/build-joseon-tileset.py "${SHEETS[@]}" "${MAPS[@]}"
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
import json
for n in [k.replace("_", "-") for k in json.load(open("tiledata/joseon-village/build-stats.json"))["maps"]]:
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
