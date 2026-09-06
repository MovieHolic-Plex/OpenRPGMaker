#!/bin/bash
# Finder and the dragged-file Terminal fallback both start in the checkout.
set -e
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js 24 LTS와 npm이 필요합니다. https://nodejs.org 에서 직접 설치한 뒤 터미널을 다시 여세요.' '시스템 도구를 자동으로 설치하지 않았습니다.' >&2
  exit 1
fi
exec node "./scripts/mac-launch.mjs" "$@"
