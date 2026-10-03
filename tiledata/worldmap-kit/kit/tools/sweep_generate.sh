#!/bin/bash
# 생성 구조 미리보기 스윕 — style × seed (× count) 마다 여정 검사 결과 한 줄.
#   bash kit/tools/sweep_generate.sh peninsula,river-continent,arc-islands 1,2,3,4 [count] [출력폴더=/tmp/wm-sweep]
# 출력: <폴더>/<style>-<seed>[-c<count>]/schematic.png · world.json · terrain.txt. tries = 배치 재시도 횟수.
KIT="$(cd "$(dirname "$0")/.." && pwd)"
OUT=${4:-/tmp/wm-sweep}; mkdir -p "$OUT"
cd "$KIT"
for st in ${1//,/ }; do for sd in ${2//,/ }; do
  cnt=${3:-}
  extra=""; [ -n "$cnt" ] && extra=",\"count\":$cnt"
  d=$OUT/$st-$sd${cnt:+-c$cnt}
  echo "{\"schema\":\"worldmap-terrain/1\",\"id\":\"sw-$st-$sd\",\"base\":\"generate\",\"ops\":[{\"op\":\"continents\",\"style\":\"$st\",\"seed\":$sd$extra}]}" > $d.json
  t0=$(date +%s.%N)
  python3 build_world.py --theme fantasy --journey fantasy-5act --terrain $d.json --out $d --preview > $d.log 2>&1
  rc=$?
  t1=$(date +%s.%N)
  tries=$(grep -c "배치 .* 실패" $d.log)
  printf "%-16s seed %-3s cnt %-3s rc=%s tries=%s %.1fs %s\n" $st $sd "${cnt:--}" $rc $tries $(echo "$t1-$t0"|bc) "$(grep -E '여정 검사|입력 오류' -A1 $d.log | tail -1 | cut -c1-150)"
done; done
