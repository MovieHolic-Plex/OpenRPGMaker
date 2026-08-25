#!/usr/bin/env bash
# 블라인드 시트를 codex(GPT)와 agy(Gemini)에게 판독시킨다.
#
#   bash scripts/se/run-reviewers.sh [병렬도=4] [시작시트=1] [끝시트=16]
#
# 결과는 dist/se-staging/review/<tool>-<n>.txt. 프롬프트는 옆의 reviewer-prompt.txt.
# 병렬도는 인자로 받는다(기본 4). 이미 결과 파일이 있으면 건너뛴다 — 재실행 가능.
set -u
W="C:/Users/USER/.herdr/worktrees/rpg-zzu/worktree-green-river-7183"
S="$W/dist/se-staging"
R="$S/review"
PROMPT="$(cat "$(dirname "$0")/reviewer-prompt.txt")"
PAR="${1:-4}"
FROM="${2:-1}"
TO="${3:-16}"
mkdir -p "$R"

run_codex() {
  local n="$1" out="$R/codex-$n.txt"
  [ -s "$out" ] && return 0
  printf '%s' "$PROMPT" | timeout 900 codex exec -s read-only --skip-git-repo-check \
    -i "$S/blind-sheet-$n.png" > "$out.part" 2>&1
  printf 'EXIT=%s\n' "$?" >> "$out.part"
  mv "$out.part" "$out"
  echo "DONE codex-$n"
}

run_agy() {
  local n="$1" out="$R/agy-$n.txt"
  [ -s "$out" ] && return 0
  # agy 는 이미지를 그냥 보지 않고 python 으로 여는 쪽을 시도하다가 헤들리스 권한 게이트에 마힌다
  # (실제로 6장이 그렇게 다섬다). 도구 사용을 명시적으로 긌다.
  timeout 900 agy --model gemini-3.7-flash-medium --add-dir "$W/dist" \
    -p "이미지 $S/blind-sheet-$n.png 를 직접 보고 판독하라. 명령어·python·새 도구 실행은 하지 마라 — 그림을 보고 바로 답하면 된다. 답은 끝까지 생략 없이 모든 타일을 출력하라. $PROMPT" > "$out.part" 2>&1
  printf 'EXIT=%s\n' "$?" >> "$out.part"
  mv "$out.part" "$out"
  echo "DONE agy-$n"
}

for n in $(seq "$FROM" "$TO"); do
  run_codex "$n" &
  run_agy "$n" &
  while [ "$(jobs -rp | wc -l)" -ge "$PAR" ]; do sleep 2; done
done
wait
echo ALL_REVIEWS_DONE
