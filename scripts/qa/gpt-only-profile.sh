#!/usr/bin/env bash
# GPT 만 구독한 사용자 프로필 — 이 PC 의 ChatGPT(Codex CLI) 로그인 하나만 가진 깨끗한 홈을 만들고, 그 안에서 명령을 돌린다.
#
# 왜(2026-11-05 gpt-only-game 레인): 오너 목표는 「GPT 6.1 Terra 만 가지고도 게임을 만들게」다. 개발 PC 에는 Claude·Gemini·
# omp·oc 키가 다 있어서, 그냥 돌리면 다른 자격이 섞여 측정이 거짓이 된다. 윈도 초보가 새 설정 마법사로 얻는 상태
# (Codex CLI 설치 + ChatGPT 로그인, 그 밖에 아무 것도 없음)를 그대로 재현한다.
#
# 쓰기:
#   scripts/qa/gpt-only-profile.sh <프로필 폴더> check            # 무엇이 보이는지 점검(값은 찍지 않는다)
#   scripts/qa/gpt-only-profile.sh <프로필 폴더> run -- <명령...>  # 그 프로필 환경으로 명령 실행
#
# 지키는 것:
#   - 홈은 새 폴더다. ~/.codex/auth.json 만 복사한다(0600). Claude·Gemini·omp·oprn 저장소·API 키 환경 변수는 없다.
#   - PATH 에는 node·npm·npx·bun·git·codex 만 있다(claude·gemini 실행 파일 없음).
#   - 원래 로그인은 건드리지 않는다(복사본만 쓴다, 로그아웃하지 않는다). 토큰 값은 어디에도 찍지 않는다.
#   - 브라우저 엔진(Playwright)은 자격이 아니라 실행기라 원래 캐시 경로를 가리킨다.
set -euo pipefail

ROOT=${1:?usage: gpt-only-profile.sh <profile-dir> check|run -- cmd}
MODE=${2:?usage: gpt-only-profile.sh <profile-dir> check|run -- cmd}
shift 2
SRC_CODEX_HOME=${SRC_CODEX_HOME:-$HOME/.codex}
REAL_PLAYWRIGHT=${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}

P_HOME="$ROOT/home"
P_BIN="$ROOT/bin"
P_TMP="$ROOT/tmp"

if [ ! -f "$P_HOME/.codex/auth.json" ]; then
  mkdir -p "$P_HOME/.codex" "$P_BIN" "$P_TMP"
  chmod 700 "$P_HOME" "$P_HOME/.codex"
  if [ ! -f "$SRC_CODEX_HOME/auth.json" ]; then echo "no ChatGPT (codex) login at $SRC_CODEX_HOME" >&2; exit 2; fi
  # 복사본이 토큰을 새로 고치면 refresh 토큰이 돌아 원래 로그인이 끊긴다 — 접근 토큰이 하루 넘게 남았을 때만 복사한다.
  node -e 'const t=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).tokens.access_token.split(".")[1];const e=JSON.parse(Buffer.from(t,"base64url")).exp*1000;process.exit(e-Date.now()>864e5?0:3)' "$SRC_CODEX_HOME/auth.json" \
    || { echo "ChatGPT access token expires within 24h; refresh the original login first (codex) instead of the copy" >&2; exit 3; }
  install -m 600 "$SRC_CODEX_HOME/auth.json" "$P_HOME/.codex/auth.json"
  # 모델 목록 캐시는 공개 정보다(설정 화면 모델 목록). 없어도 고정 목록으로 돈다.
  [ -f "$SRC_CODEX_HOME/models_cache.json" ] && install -m 600 "$SRC_CODEX_HOME/models_cache.json" "$P_HOME/.codex/models_cache.json"
  for tool in node npm npx bun git codex; do
    target=$(command -v "$tool" || true)
    [ -n "$target" ] && ln -sf "$(readlink -f "$target")" "$P_BIN/$tool"
  done
  # npm·npx 는 node 옆 lib 를 찾으므로 실제 경로 대신 원래 껍데기를 가리킨다.
  for tool in npm npx; do target=$(command -v "$tool" || true); [ -n "$target" ] && ln -sf "$target" "$P_BIN/$tool"; done
fi

profile_env=(
  env -i
  HOME="$P_HOME"
  USER="${USER:-gpt-only}"
  PATH="$P_BIN:/usr/bin:/bin"
  LANG="${LANG:-C.UTF-8}"
  TMPDIR="$P_TMP"
  CODEX_HOME="$P_HOME/.codex"
  OPRN_OH_MY_PI_AUTH_PATH="$P_HOME/.oprn/oh-my-pi-auth.json"
  OPRN_DISABLE_OMP_AUTH_REUSE=1
  OPRN_BUN_PATH="$P_BIN/bun"
  PLAYWRIGHT_BROWSERS_PATH="$REAL_PLAYWRIGHT"
)
[ -n "${DISPLAY:-}" ] && profile_env+=(DISPLAY="$DISPLAY")
# 공용 콘텐츠 카탈로그(타일셋·캐릭터 번들 DB)는 자격이 아니라 앱 자료라 원래 파일을 읽기 전용 원본으로 넘긴다(하네스가 과제마다 사본을 뜬다).
profile_env+=(OPRN_SHARED_CONTENT_SQLITE="${OPRN_SHARED_CONTENT_SQLITE:-$HOME/.local/share/oprn/shared-content.sqlite}")
for passthrough in HARNESS_DIST_DIR VITE_CACHE_DIR OPRN_CAP_BOOT_TIMEOUT_MS NODE_OPTIONS; do
  [ -n "${!passthrough:-}" ] && profile_env+=("$passthrough=${!passthrough}")
done

case "$MODE" in
  check)
    "${profile_env[@]}" bash -c '
      echo "home=$HOME"
      for f in .claude .claude.json .gemini .omp .oprn .config/gh; do [ -e "$HOME/$f" ] && echo "UNEXPECTED $f" || echo "absent $f"; done
      for b in claude gemini omp; do command -v $b >/dev/null && echo "UNEXPECTED binary $b" || echo "absent binary $b"; done
      env | cut -d= -f1 | grep -E -i "api_key|token|anthropic|openai|gemini|deepseek" && echo "UNEXPECTED key env" || echo "no key env"
      codex --version
      codex login status 2>&1 | head -1
    '
    ;;
  run)
    [ "${1:-}" = "--" ] && shift
    exec "${profile_env[@]}" "$@"
    ;;
  *) echo "unknown mode $MODE" >&2; exit 2 ;;
esac
