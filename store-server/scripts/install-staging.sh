#!/usr/bin/env bash
# 스테이징(테일스케일 안) 설치: 빌드 결과를 ~/apps/oprn-store 로 복사하고 systemd --user 유닛을 건다.
#   store-server/scripts/install-staging.sh [--seed]
# 워크트리는 사라질 수 있으므로 실행 파일은 복사본에서 돈다. 데이터(Postgres·blob)는 ~/.local/share/oprn-store.
# 개발 로그인이 켜져 있으므로 테일스케일 주소에만 묶는다 — 공개 인터페이스(0.0.0.0)에 묶지 말 것.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$here/.." && pwd)"
app="$HOME/apps/oprn-store"
data="$HOME/.local/share/oprn-store"
port="${STORE_STAGING_PORT:-18320}"
host="${STORE_STAGING_HOST:-$(tailscale ip -4 | head -1)}"
name="${STORE_STAGING_NAME:-mdc-server}"
node_bin="$(command -v node)"
export XDG_RUNTIME_DIR="/run/user/$(id -u)" DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u)/bus"

npm --prefix "$here" run build >/dev/null
mkdir -p "$app" "$data"
rsync -a --delete "$here/dist/" "$app/dist/"
rsync -a --delete "$here/migrations/" "$app/migrations/"
rsync -a --delete "$here/public/" "$app/public/"
rsync -a --delete --exclude esbuild --exclude @esbuild --exclude typescript --exclude @types "$here/node_modules/" "$app/node_modules/"
cp "$here/package.json" "$app/package.json"

if [[ "${1:-}" == "--seed" ]]; then
  # 첫 진열 팩은 편집기 public/ 의 그림이 필요하다. 한 번 올리면 blob 으로 남으므로 이후 실행에는 필요 없다.
  systemctl --user stop oprn-store-staging.service 2>/dev/null || true
  "$node_bin" "$app/dist/local.mjs" --data "$data" --port "$port" --host 127.0.0.1 --public-url "http://$name:$port" --seed --public-dir "$repo/public" > /tmp/oprn-store-seed.log 2>&1 &
  seeder=$!
  for _ in $(seq 1 240); do grep -q '^READY ' /tmp/oprn-store-seed.log && break; sleep 1; done
  kill "$seeder"; wait "$seeder" 2>/dev/null || true
  grep -E '^\[seed\]|^READY' /tmp/oprn-store-seed.log || { cat /tmp/oprn-store-seed.log; exit 1; }
fi

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/oprn-store-staging.service" <<UNIT
[Unit]
Description=OPRN asset store staging (tailscale only)
After=network-online.target tailscaled.service

[Service]
ExecStart=$node_bin $app/dist/local.mjs --data $data --port $port --host $host --public-url http://$name:$port --admin admin@openrpgmaker.com
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now oprn-store-staging.service >/dev/null
systemctl --user restart oprn-store-staging.service
for _ in $(seq 1 60); do curl -fs "http://$name:$port/healthz" >/dev/null && break; sleep 1; done
curl -fs "http://$name:$port/healthz" && echo && echo "staging: http://$name:$port"
