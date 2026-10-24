#!/usr/bin/env bash
# 변형마다 구운 데모를 바꿔 끼우고 추격 체크포인트를 찍는다(1배 영상 포함). 끝나면 원본을 되돌린다.
#   bash scripts/content/field-foes/run_compare.sh /tmp/ff base a b c d
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"; WORK="$1"; shift
BAKED="$ROOT/dist/demos/chrono-bell.play.json"
cp "$BAKED" "$WORK/chrono-bell.orig.play.json"
trap 'cp "$WORK/chrono-bell.orig.play.json" "$BAKED"' EXIT
for v in "$@"; do
  cp "$WORK/fx/$v.play.json" "$BAKED"
  rm -rf "$WORK/video/$v"
  (cd "$ROOT" && QA_RECORD_VIDEO="$WORK/video/$v" timeout 900 npm run qa:runtime -- --scenario field-foes --checkpoint-set fallen-star \
    --checkpoint forest-chase --project "$WORK/fx/$v.play.json" --out "$WORK/qa-$v" --netns > "$WORK/qa-$v.log" 2>&1)
  echo "$v exit $?" >> "$WORK/compare.log"
done
