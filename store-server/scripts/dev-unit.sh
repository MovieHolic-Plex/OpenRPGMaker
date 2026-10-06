#!/usr/bin/env bash
# 로컬 확인용 임시 스토어(일회용 Postgres + 첫 진열 팩)를 systemd --user 임시 유닛으로 띄우고 내린다.
#   store-server/scripts/dev-unit.sh start [포트]   /  stop
# 프로세스를 이름(pkill -f)으로 찾지 않는다 — 명령줄에 같은 글자가 든 자기 셸까지 죽인다.
set -euo pipefail
export XDG_RUNTIME_DIR="/run/user/$(id -u)" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"
here="$(cd "$(dirname "$0")/.." && pwd)"
unit=oprn-store-dev
case "${1:-start}" in
  stop) systemctl --user stop "$unit" 2>/dev/null || true ;;
  start)
    port="${2:-18391}"
    systemctl --user stop "$unit" 2>/dev/null || true
    systemctl --user reset-failed "$unit" 2>/dev/null || true
    (cd "$here" && node scripts/build.mjs >/dev/null)
    log="/tmp/$unit.log"
    systemd-run --user --unit="$unit" --working-directory="$here" --property=StandardOutput="truncate:$log" --property=StandardError="append:$log" \
      node dist/local.mjs --port "$port" --seed >/dev/null
    for _ in $(seq 1 120); do grep -q "READY\|failed\|exited" "$log" 2>/dev/null && break; sleep 1; done
    cat "$log"
    ;;
esac
