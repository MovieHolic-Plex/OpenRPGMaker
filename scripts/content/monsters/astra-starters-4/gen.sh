#!/usr/bin/env bash
# usage: gen.sh <line> <n>   -> ~/astra-starters-wip/s4/raw/<line>-<k>.png  (8091 god-tibo, 1536x1024)
set -u
D=$(cd "$(dirname "$0")" && pwd); L=$1; N=${2:-3}; OUT=~/astra-starters-wip/s4/raw
for k in $(seq 1 "$N"); do
  [ -f "$OUT/$L-$k.png" ] && continue
  cat "$D/prompts/_common.txt" "$D/prompts/$L.txt" > "/tmp/astra-s4-$L.txt"
  python3 "$D/../astra-starters-3/gen.py" "/tmp/astra-s4-$L.txt" "$OUT/$L-$k.png" 1536x1024 &
done
wait
