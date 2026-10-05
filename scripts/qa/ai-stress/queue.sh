#!/usr/bin/env bash
# 과제들을 동시 N 개로 돌린다. 사용: scripts/qa/ai-stress/queue.sh <outDir> <N> <caseId>...
out="$1"; max="$2"; shift 2
mkdir -p "$out"
for id in "$@"; do
  while [ "$(jobs -rp | wc -l)" -ge "$max" ]; do sleep 10; done
  echo "$(date +%T) start $id" >> "$out/queue.log"
  ( timeout 3000 node scripts/qa/ai-stress/run-case.mjs "$id" "$out" > "$out/$id.log" 2>&1; echo "$(date +%T) end $id rc=$?" >> "$out/queue.log" ) &
  sleep 20
done
wait
echo "$(date +%T) all done" >> "$out/queue.log"
