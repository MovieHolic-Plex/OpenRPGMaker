#!/usr/bin/env bash
# 공유 목록에서 과제를 하나씩 차지해(mkdir 원자성) 돈다. 일꾼 여럿을 띄우면 병렬이 된다.
# 사용: scripts/qa/ai-stress/worker.sh <outDir> <caseId>...
out="$1"; shift
mkdir -p "$out/.claims"
for id in "$@"; do
  mkdir "$out/.claims/$id" 2>/dev/null || continue
  echo "$(date +%T) start $id (worker $$)" >> "$out/queue.log"
  timeout 3000 node scripts/qa/ai-stress/run-case.mjs "$id" "$out" > "$out/$id.log" 2>&1
  echo "$(date +%T) end $id rc=$?" >> "$out/queue.log"
done
