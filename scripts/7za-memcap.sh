#!/bin/sh
# electron-builder 는 7za -mx=9 를 코어 수만큼 띄운다. 스레드가 많으면
# LZMA 사전이 메모리를 넘긴다. 7-Zip memuse 는 압축 레벨을 유지한 채 스레드만 줄인다.
# 실측: -mmemuse=2g 에서 RSS 가 0.8GB 에 머물렀다. 기본 상한은 8g.
# 호스티드 러너(16GB)는 SEVENZIP_MEMUSE=2g 로 돌린다.
set -eu
limit=${SEVENZIP_MEMUSE:-8g}
cached=$(find "$HOME/.cache/electron-builder" -type f -name 7zz -perm -111 2>/dev/null | head -n 1 || true)
system=$(command -v 7zz || command -v 7z || command -v 7za || true)
cmd=${1:-}
# 압축만 캐시된 7zz 에 메모리 상한을 붙인다. 첫 추출은 7zz 가 아직 없어서 시스템 7z 를 쓴다.
if { [ "$cmd" = "a" ] || [ "$cmd" = "u" ]; } && [ -n "$cached" ]; then
  shift
  for arg in "$@"; do
    case "$arg" in
      -mmemuse*) exec "$cached" "$cmd" "$@" ;;
    esac
  done
  exec "$cached" "$cmd" "-mmemuse=$limit" "$@"
fi
real=${cached:-$system}
if [ -z "$real" ]; then
  echo "7za-memcap: 7z 가 없다" >&2
  exit 127
fi
exec "$real" "$@"
