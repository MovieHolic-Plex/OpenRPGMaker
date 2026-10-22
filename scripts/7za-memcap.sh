#!/bin/sh
# electron-builder 는 7za -mx=9 를 코어 수만큼 띄운다. 스레드가 많으면
# LZMA 사전이 메모리를 넘긴다. 7-Zip memuse 는 압축 레벨을 유지한 채 스레드만 줄인다.
# 실측: -mmemuse=2g 에서 RSS 가 0.8GB 에 머물렀다. 기본 상한은 8g.
# 호스티드 러너(16GB)는 SEVENZIP_MEMUSE=2g 로 돌린다.
set -eu
limit=${SEVENZIP_MEMUSE:-8g}
real=$(find "$HOME/.cache/electron-builder" -type f -name 7zz -perm -111 2>/dev/null | head -n 1)
if [ -z "$real" ]; then
  echo "7za-memcap: ~/.cache/electron-builder 아래에 7zz 가 없다" >&2
  exit 127
fi
cmd=${1:-}
if [ "$cmd" = "a" ] || [ "$cmd" = "u" ]; then
  shift
  for arg in "$@"; do
    case "$arg" in
      -mmemuse*) exec "$real" "$cmd" "$@" ;;
    esac
  done
  exec "$real" "$cmd" "-mmemuse=$limit" "$@"
fi
exec "$real" "$@"
