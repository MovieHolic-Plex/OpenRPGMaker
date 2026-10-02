#!/bin/bash
# 사용: run_town.sh <seed> [출력 폴더(기본 /tmp/city)] — 합격 에셋 JSON 3개를 병합해 도시 PNG 한 장을 만든다.
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"; OUT="${2:-/tmp/city}"; mkdir -p "$OUT"; R=v1002
cd "$HERE" && python3 compose_town.py --out "$OUT/t5_$1.png" --ground $R-121948:A --green $R-184242:A --props $R-182800:A \
  --car $R-085924:A,$R-085924:B,$R-085924:C,$R-085924:D,$R-085924:E --car-front $R-184143:A,$R-184143:C --car-back $R-184145:A,$R-184145:B,$R-184145:C \
  --assets "$ROOT/harness-data/modern-chipset/town_assets.json" --seed "$1"
