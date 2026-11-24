#!/usr/bin/env bash
# 영역 지시 능력 표를 다시 낸다. 「전」 병합기는 레시피 도입 직전 커밋의 mergeMapBundles 다.
set -euo pipefail
out="${1:?출력 폴더}"
base="${REGION_DIRECTIVES_BASE:-6e47e7d11}"
mkdir -p "$out"
old="$out/oldMapBundle.ts"
git show "$base:src/ai/piAgent/mapBundle.ts" > "$old"
bun scripts/qa/region-directives/capability.ts "$out" "$old"
