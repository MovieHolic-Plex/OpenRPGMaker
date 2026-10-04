#!/bin/bash
# 실제 지리(style real) 지역 프리셋 스윕 — 지역마다 미리보기 + 여정 검사 한 줄, 4개씩 나란히.
#   bash kit/tools/sweep_real.sh [지역,지역…(기본 전부)] [출력폴더=/tmp/wm-real] [테마=fantasy] [여정=fantasy-5act]
KIT="$(cd "$(dirname "$0")/.." && pwd)"
OUT=${2:-/tmp/wm-real}; THEME=${3:-fantasy}; JOURNEY=${4:-fantasy-5act}
mkdir -p "$OUT"; cd "$KIT"
REGS=${1:-$(python3 -c "import sys; sys.path.insert(0,'lib'); import kit_realgeo as R; print(','.join(R.REGIONS))")}
one() {
  r=$1
  echo "{\"schema\":\"worldmap-terrain/1\",\"id\":\"real-$r\",\"base\":\"generate\",\"ops\":[{\"op\":\"continents\",\"style\":\"real\",\"region\":\"$r\"}]}" > $OUT/$r.json
  python3 build_world.py --theme $THEME --journey $JOURNEY --terrain $OUT/$r.json --out $OUT/$r --preview > $OUT/$r.log 2>&1
  printf "%-16s rc=%s tries=%s %s\n" $r $? $(grep -c "배치 .* 실패" $OUT/$r.log) "$(grep -E '여정 검사|입력 오류' -A1 $OUT/$r.log | tail -1 | cut -c1-120)"
}
export -f one; export OUT THEME JOURNEY
echo ${REGS//,/ } | tr ' ' '\n' | xargs -P 4 -I{} bash -c 'one {}'
