#!/bin/bash
# Finder and the dragged-file Terminal fallback both start in the checkout.
set -e
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 24 LTS is required. Install it (including npm) from https://nodejs.org, then reopen Terminal.' 'No system tools were installed.' >&2
  exit 1
fi
exec node "./scripts/mac-launch.mjs" "$@"
