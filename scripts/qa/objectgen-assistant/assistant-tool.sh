#!/usr/bin/env bash
# 조수 대용 역할극의 도구 호출 하나 — oprn-tools.mjs --assistant 로 실제 도구·실행기를 돌리고, 부른 것과 결과를 trace 에 남긴다.
#   CASE_DIR=<과제 폴더(project.json·trace.jsonl)> MAP=<지금 보는 맵> assistant-tool.sh <tool> '<args-json>'
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
tool="$1"; args="${2:-{\}}"
write=""
[ "${READ_ONLY:-0}" = "1" ] || write="--write"
result="$(cd "$REPO" && node scripts/oprn-tools.mjs --project "$CASE_DIR/project.json" --bundle "${HEADLESS_BUNDLE:-/tmp/ogt/headless.mjs}" --assistant --current-map "$MAP" $write "$tool" "$args" 2>&1 || true)"
node -e '
const [tool, args, result] = process.argv.slice(1);
let parsed; try { parsed = JSON.parse(result); } catch { parsed = { ok: false, summary: result.slice(0, 2000) }; }
require("fs").appendFileSync(process.env.CASE_DIR + "/trace.jsonl", JSON.stringify({ at: new Date().toISOString(), tool, args: JSON.parse(args), ok: parsed.ok, summary: parsed.summary, data: tool === "generate_missing_object" ? parsed.data : undefined }) + "\n");
' "$tool" "$args" "$result"
printf '%s\n' "$result" | head -c 60000
