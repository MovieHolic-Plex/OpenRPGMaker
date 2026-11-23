#!/usr/bin/env bash
set -euo pipefail

install_args=(ci)
if [[ "$IGNORE_SCRIPTS" == true ]]; then install_args+=(--ignore-scripts); fi
if [[ "$RUNNER_ENVIRONMENT" != self-hosted ]]; then
  npm "${install_args[@]}"
  exit
fi

# The completion hook clears _temp and keeps _tool. Each runner executes one job
# at a time. Cache copies keep job writes out of subsequent jobs' dependencies.
cache="$(dirname "$RUNNER_TEMP")/_tool/oprn-ci"
mkdir -p "$cache"
export npm_config_cache="$cache/npm" NPM_CONFIG_CACHE="$cache/npm"
export XDG_CACHE_HOME="$cache" ELECTRON_CACHE="$cache/electron"
printf '%s\n' "OPRN_CI_CACHE=$cache" "npm_config_cache=$cache/npm" "NPM_CONFIG_CACHE=$cache/npm" \
  "XDG_CACHE_HOME=$cache" "ELECTRON_CACHE=$cache/electron" "BUN_INSTALL_CACHE_DIR=$cache/bun-cache" >> "$GITHUB_ENV"

key=$( { sha256sum package.json package-lock.json; node -p '[process.version, process.arch, process.platform].join(":")'; npm --version; } | sha256sum | cut -d ' ' -f 1)
slot="$cache/deps-$IGNORE_SCRIPTS"
if [[ $(cat "$slot/key" 2>/dev/null || true) == "$key" && -d "$slot/node_modules" ]]; then
  echo "mdc2 node_modules cache hit ($key)"
  cp -a --reflink=auto "$slot/node_modules" .
else
  echo "mdc2 node_modules cache miss ($key)"
  npm "${install_args[@]}"
  # Keep one entry per install mode. The staging directory is published only
  # after a successful install and copy, including when a job is cancelled.
  staging=$(mktemp -d "$cache/.deps.XXXXXX")
  trap 'rm -rf -- "$staging"' EXIT
  cp -a --reflink=auto node_modules "$staging/"
  printf '%s\n' "$key" > "$staging/key"
  rm -rf -- "$slot"
  mv -T "$staging" "$slot"
fi
