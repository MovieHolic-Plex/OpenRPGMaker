#!/bin/bash
# jp-inaka 미리보기 — 저장소에 굽지 않고(3/4 관문 재보정 전 굽기 보류) 그림·구성기를 스크래치 체크아웃에서 굽고 쇼케이스 6장을 렌더한다.
#
#   scripts/content/jp-city/inaka/preview_r6.sh [출력폴더] [지도접두(01..06)]
#
# 스크래치 체크아웃: $INAKA_PREVIEW_DIR (기본 ~/.cache/oprn/inaka-preview — 저장소 밖, /tmp 는 이 박스에서 지워진다).
#   없으면 지금 HEAD 로 `git worktree add --detach` 하고 node_modules 를 메인 체크아웃으로 심링크한다.
#   스크래치는 그림 소스(scripts/content/jp-inaka/*.py)와 구성기(inakaCountrysideComposer.ts)만 매번 덮어쓰고, 나머지는 만든 시점의 HEAD 다.
#   다른 파일(굽기 스크립트·엔진)이 바뀌었으면 `git -C "$INAKA_PREVIEW_DIR" checkout --detach <커밋>` 으로 맞추거나 폴더를 지우고 다시 만든다.
# 출력: 칩셋 미리보기 시트 <출력폴더>/sheet.png 와 6장 PNG + summary.json. 저장소의 tiledata·src/assets·public 은 건드리지 않는다.
set -euo pipefail
W="$(cd "$(dirname "$0")/../../../.." && pwd)"
P="${INAKA_PREVIEW_DIR:-$HOME/.cache/oprn/inaka-preview}"
OUT="${1:-$HOME/.cache/oprn/inaka-preview-out}"
ONLY="${2:-}"
MAIN="$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir)")"   # 메인 체크아웃(node_modules 정본)
if [ ! -d "$P/.git" ] && [ ! -f "$P/.git" ]; then
  mkdir -p "$(dirname "$P")"
  git -C "$W" worktree add -q --detach "$P" HEAD
  [ -e "$P/node_modules" ] || ln -s "$MAIN/node_modules" "$P/node_modules"
fi
mkdir -p "$OUT"
cp "$W"/scripts/content/jp-inaka/*.py "$P/scripts/content/jp-inaka/"
cp "$W/src/editor/jpCity/inakaCountrysideComposer.ts" "$P/src/editor/jpCity/"
cd "$P"
# 스크래치 안에서만 굽는다(미리보기). 저장소 굽기는 bake_inaka.py --bake 이고 그쪽은 3/4 관문(require_gate)이 막는다 — 여기서 그 관문을 대신하지 않는다.
python3 scripts/content/jp-inaka/bake_inaka.py --sheet-out "$OUT/sheet.png" 2>&1 | grep -E '문제|Error|error' | head -5
python3 -c "import sys; sys.path[:0] = ['scripts/content/jp-city', 'scripts/content/jp-inaka']; import bake_jp; print(bake_jp.bake('$P', dry=False)['report']['tiles'])" 2>&1 | tail -2
timeout 900 bun scripts/qa/jp-inaka-showcase.mts --out "$OUT" ${ONLY:+--only "$ONLY"} 2>&1 | grep -E 'stamped|rror' | head -12
