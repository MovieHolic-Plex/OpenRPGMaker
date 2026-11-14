#!/bin/bash
# One game build by a coding agent (default: opencodex/gpt-6.1-terra, thinking high) under a hard cap.
#   build-one.sh <game dir> <prompt text file> <title>
# env: GF_REPO (checkout, default this repo)  GF_CAP_MIN (90)  GF_MODEL  GF_EFFORT  GF_FOLLOWUP (text, empty = none)
#      GF_FOLLOWUP_MIN_LEFT_SEC (480)  OPRN_OPENAI_COMPAT_PATH (endpoint store; never printed)
# Writes <game dir>/RUN.txt (key=value lines the dispatcher reads), host-ready.json, host-calls.jsonl,
# agent-*.jsonl, final.json (stored-revision receipt) and check/project.json. Exit 0 = agent finished inside the cap,
# 124 = cap reached (did not finish), other = failure. Every process started here is torn down on exit.
set -u
G=$(mkdir -p "$1" && cd "$1" && pwd); PROMPT_FILE=$2; TITLE=$3
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${GF_REPO:-$(cd "$HERE/../.." && pwd)}
CAP_MIN=${GF_CAP_MIN:-90}
MODEL=${GF_MODEL:-opencodex/gpt-6.1-terra}
EFFORT=${GF_EFFORT:-high}
export PATH=/home/main/.bun/bin:$PATH
export OPRN_OPENAI_COMPAT_PATH=${OPRN_OPENAI_COMPAT_PATH:-$HOME/.oprn-suite/openai-compat-endpoints.json}
mkdir -p "$G/work"
echo "model=$MODEL effort=$EFFORT cap_min=$CAP_MIN repo=$REPO dist=$(cat "$REPO/dist/.built-from" 2>/dev/null) started=$(date -u +%FT%TZ)" >> "$G/RUN.txt"
T0=$(date +%s); RC=1
teardown() {
  if [ -n "${HOSTPID:-}" ] && kill -0 "$HOSTPID" 2>/dev/null; then
    kill -TERM -"$HOSTPID" 2>/dev/null; kill "$HOSTPID" 2>/dev/null
    for _ in $(seq 1 10); do kill -0 "$HOSTPID" 2>/dev/null || break; sleep 1; done
    kill -9 -"$HOSTPID" 2>/dev/null; kill -9 "$HOSTPID" 2>/dev/null
  fi
  # the editor host (oprn-serve) and agent children are bound to this game dir; nothing else is
  for p in $(ps -eo pid,args | grep -F "$G/" | grep -v grep | grep -v build-one.sh | awk '{print $1}'); do kill -9 "$p" 2>/dev/null; done
  sleep 1
  local left; left=$(ps -eo pid,args | grep -F "$G/" | grep -v grep | grep -v build-one.sh | wc -l)
  echo "teardown leftovers=$left wall_sec=$(( $(date +%s) - T0 )) finished=$(date -u +%FT%TZ)" >> "$G/RUN.txt"
}
trap teardown EXIT INT TERM
cd "$REPO" || exit 2
if [ ! -f "$G/project/project.sqlite" ]; then
  bun src/harnesses/assistant-capability/node/wholeGamePrepare.ts "$G" "$TITLE" > "$G/prepare.log" 2>&1 || { echo "state=failed reason=prepare" >> "$G/RUN.txt"; exit 3; }
fi
PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')
rm -f "$G/host-ready.json"
ADE_NO_VIEW=1 HARNESS_DIST_DIR=dist setsid nohup node "$HERE/agent-host.mjs" --project-dir "$G/project" --out "$G" --port "$PORT" > "$G/host.log" 2>&1 < /dev/null &
HOSTPID=$!
for _ in $(seq 1 180); do [ -f "$G/host-ready.json" ] && break; kill -0 "$HOSTPID" 2>/dev/null || break; sleep 2; done
[ -f "$G/host-ready.json" ] || { echo "state=failed reason=host" >> "$G/RUN.txt"; tail -c 1500 "$G/host.log" >> "$G/host-fail.txt"; exit 4; }
echo "host_ready_sec=$(( $(date +%s) - T0 )) port=$PORT" >> "$G/RUN.txt"
cp "$HERE/agent-kit/README.md" "$HERE/agent-kit/oprn" "$G/work/"; chmod +x "$G/work/oprn"
{ printf '# 사용자 요청\n\n'; cat "$PROMPT_FILE"; printf '\n'; } > "$G/work/TASK.md"
SKILL=$REPO/assistant-skills/oprn-game-building-rules/SKILL.md
mkdir -p "$G/work/skills/oprn-game-building-rules" "$G/work/.claude/skills/oprn-game-building-rules"
for f in "$G/work/AGENTS.md" "$G/work/CLAUDE.md" "$G/work/skills/oprn-game-building-rules/SKILL.md" "$G/work/.claude/skills/oprn-game-building-rules/SKILL.md"; do cp "$SKILL" "$f"; done
END=$(( T0 + CAP_MIN * 60 - 120 ))
export OPRN_PORT=$PORT ADE_WT=$REPO
cd "$G/work" || exit 1
OM=(omp -p --mode json --model "$MODEL" --thinking "$EFFORT" --auto-approve --session-dir "$G/omp-session" --cwd "$G/work")
timeout $(( END - $(date +%s) )) "${OM[@]}" "TASK.md 의 요청을 이 편집기 프로젝트에 만들어라. 방법은 README.md 에 있다." > "$G/agent-1.jsonl" 2> "$G/agent-1.err" < /dev/null
A1=$?; echo "turn1 exit=$A1 at=$(( $(date +%s) - T0 ))" >> "$G/RUN.txt"
CAPPED=0; [ $A1 -eq 124 ] && CAPPED=1
LEFT=$(( END - $(date +%s) ))
if [ $CAPPED -eq 0 ] && [ -n "${GF_FOLLOWUP:-}" ] && [ $LEFT -gt "${GF_FOLLOWUP_MIN_LEFT_SEC:-480}" ]; then
  timeout $LEFT "${OM[@]}" --continue "$GF_FOLLOWUP" > "$G/agent-2.jsonl" 2> "$G/agent-2.err" < /dev/null
  A2=$?; echo "turn2 exit=$A2 at=$(( $(date +%s) - T0 ))" >> "$G/RUN.txt"; [ $A2 -eq 124 ] && CAPPED=1
fi
echo "agent_sec=$(( $(date +%s) - T0 ))" >> "$G/RUN.txt"
curl -s -m 900 -X POST "http://127.0.0.1:$PORT/final" > "$G/final.json"
curl -s -X POST "http://127.0.0.1:$PORT/quit" > /dev/null
for _ in $(seq 1 30); do kill -0 "$HOSTPID" 2>/dev/null || break; sleep 2; done
cd "$REPO" || exit 1
mkdir -p "$G/check"
node -e "import('./src/harnesses/assistant-capability/node/editorDriver.mjs').then(m=>m.writeRuntimeProject('$G/project','$G/check/project.json'))" > /dev/null 2>&1
if [ $CAPPED -eq 1 ]; then echo "state=capped" >> "$G/RUN.txt"; RC=124
elif [ $A1 -ne 0 ]; then echo "state=failed reason=agent-exit-$A1" >> "$G/RUN.txt"; RC=5
else echo "state=finished" >> "$G/RUN.txt"; RC=0; fi
exit $RC
