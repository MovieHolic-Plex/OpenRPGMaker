#!/usr/bin/env bash
# mdc2 공유 박스에서 무거운 잡을 시작하기 전에 박스 여유 메모리를 기다린다.
# 같은 박스에 win11 VM 과 다른 러너가 있어, MemAvailable 이 낮을 때 vitest 샤드가 붙으면 박스가 스왑·스로틀에 빠진다
# (2026-11-23 run 45232304512: MemAvailable 8GB·load 711). 기다리다 시간을 넘기면 잡을 실패시킨다.
# 사용: scripts/ci-wait-mem.sh [최소 GB=30] [최대 분=90]
set -euo pipefail
min_gb=${1:-30}
max_min=${2:-90}
deadline=$(( $(date +%s) + max_min * 60 ))
while :; do
  avail=$(awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo)
  load=$(cut -d' ' -f1 /proc/loadavg)
  if (( avail >= min_gb )); then
    echo "MemAvailable ${avail}GB >= ${min_gb}GB (load ${load}) 시작"
    exit 0
  fi
  if (( $(date +%s) >= deadline )); then
    echo "::error::MemAvailable ${avail}GB 가 ${max_min}분 동안 ${min_gb}GB 아래였다 (load ${load})"
    exit 1
  fi
  echo "MemAvailable ${avail}GB < ${min_gb}GB (load ${load}) 기다림"
  sleep 30
done
