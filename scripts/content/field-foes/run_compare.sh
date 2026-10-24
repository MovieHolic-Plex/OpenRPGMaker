#!/usr/bin/env bash
# 변형마다 추격 체크포인트를 찍는다(1배 영상 포함). 변형은 ?fieldFoeLook= 로 고르므로 동시에 돌려도 된다(셋씩).
#   bash scripts/content/field-foes/run_compare.sh /tmp/ff base a b c d
# --project 는 러너가 요구할 뿐 ?demo= 경로에서는 읽지 않는다(아무 프로젝트 JSON).
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; WORK="$1"; shift
FIXTURE="${FIXTURE:-$ROOT/dist/demos/chrono-bell.play.json}"
run() {
  local v="$1"; rm -rf "$WORK/video/$v"
  (cd "$ROOT" && FIELD_FOE_LOOK="$v" QA_RECORD_VIDEO="$WORK/video/$v" timeout 900 npm run qa:runtime -- --scenario field-foes \
    --checkpoint-set fallen-star --checkpoint forest-chase --project "$FIXTURE" --out "$WORK/qa-$v" --netns > "$WORK/qa-$v.log" 2>&1)
  echo "$v exit $?" >> "$WORK/compare.log"
}
n=0
for v in "$@"; do run "$v" & n=$((n+1)); if (( n % 3 == 0 )); then wait; fi; sleep 3; done
wait
