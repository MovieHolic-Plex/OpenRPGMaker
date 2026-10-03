#!/usr/bin/env bash
# jp_shopstreet16 시트·카탈로그를 이식본(scripts/content/jp-city/lib)으로 다시 굽는다. 저장소 밖 파일은 읽지 않는다.
#   scripts/content/jp-city/rebuild-source.sh                 # 시트·카탈로그 굽기 + 검사(픽셀 일치·팔레트·ACCESS·DOORBLOCK·DECOCLASH) + 레시피 미리보기
#   ... --districts                                           # 지구 PNG 6장도 tiledata/jp-city/districts/ 에 다시 조립(행인 없음)
#   ... --twice                                               # 한 번 더 임시 폴더에 굽고 바이트가 같은지 확인(PYTHONHASHSEED 도 바꿈)
#   ... --orig <원본 chipset 폴더>                            # 원본(행인 포함)과 비교해 m0-report.json 에 기록 (예: ~/gv3-work/chipset)
# 시트·카탈로그는 tiledata/jp-city/sources/ 로 나간다. JPCITY_OUT / JPCITY_DISTRICTS_OUT 으로 바꿀 수 있다.
set -euo pipefail
cd "$(dirname "$0")/../../.."
LIB=scripts/content/jp-city/lib
DISTRICTS=0; TWICE=0; ORIG=""
while [ $# -gt 0 ]; do case "$1" in --districts) DISTRICTS=1;; --twice) TWICE=1;; --orig) ORIG="$2"; shift;; --no-people) ;; *) echo "알 수 없는 옵션 $1" >&2; exit 2;; esac; shift; done
OUT="${JPCITY_OUT:-tiledata/jp-city/sources}"; export JPCITY_OUT="$OUT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
python3 $LIB/make_checks.py --no-people --json "$TMP/checks.json"        # 굽기(bake_source.export) + 검사
python3 $LIB/preview_recipes.py
ARGS=(--checks "$TMP/checks.json")
if [ "$TWICE" = 1 ]; then
  mkdir -p "$TMP/b"; PYTHONHASHSEED=777 JPCITY_OUT="$TMP/b" python3 $LIB/bake_source.py --no-people
  if cmp -s "$OUT/jp_shopstreet16.png" "$TMP/b/jp_shopstreet16.png" && cmp -s "$OUT/jp_shopstreet16.catalog.json" "$TMP/b/jp_shopstreet16.catalog.json"; then
    echo "TWICE: 바이트 동일"; echo '{"twoBakesByteIdentical": true, "hashSeeds": ["default", "777"]}' > "$TMP/twice.json"
  else echo "TWICE: 다름!" >&2; echo '{"twoBakesByteIdentical": false}' > "$TMP/twice.json"; exit 1; fi
  ARGS+=(--twice "$TMP/twice.json")
fi
if [ -n "$ORIG" ]; then
  python3 $LIB/verify_source.py --orig "$ORIG" --json "$TMP/src.json" > /dev/null && echo "원본 비교(시트·카탈로그): 통과" || { echo "원본 비교 실패" >&2; cat "$TMP/src.json"; exit 1; }
  ARGS+=(--source_compare "$TMP/src.json")
fi
if [ "$DISTRICTS" = 1 ]; then
  python3 $LIB/build_districts.py
  if [ -n "$ORIG" ]; then
    python3 $LIB/verify_districts.py --orig "$ORIG" --json "$TMP/dist.json" > /dev/null && echo "원본 비교(지구 6장, 행인 상자 밖 차이 0): 통과" || { echo "지구 비교 실패" >&2; cat "$TMP/dist.json"; exit 1; }
    ARGS+=(--districts_compare "$TMP/dist.json")
  fi
fi
python3 $LIB/m0_report.py "${ARGS[@]}"
