#!/usr/bin/env bash
# 과제 하나를 백그라운드로 띄우고 PID 를 파일에 남긴다(pkill -f 는 부르는 셸까지 죽인다).
# 사용: scripts/qa/ai-stress/launch.sh <caseId> <outDir>
set -euo pipefail
case_id="$1"; out="$2"
mkdir -p "$out"
nohup timeout 3000 node scripts/qa/ai-stress/run-case.mjs "$case_id" "$out" > "$out/$case_id.log" 2>&1 &
echo $! > "$out/$case_id.pid"
echo "started $case_id pid=$(cat "$out/$case_id.pid")"
