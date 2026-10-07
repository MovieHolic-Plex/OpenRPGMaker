#!/bin/bash
# 지역 시트 한 바퀴: draw → bake → node/<테마_밑줄>.mts(쇼케이스+검사) → bake/maps.json 의 맵을 /tmp/viz/<테마>/ 에 그린다.
# 사용: bash cycle_theme.sh <테마> <run>     예) bash cycle_theme.sh monster-coast c01
# 여러 에이전트가 동시에 돌아도 미리보기가 섞이지 않게 출력은 테마별 폴더다.
set -euo pipefail
TH=$1; RUN=$2; MOD=${TH//-/_}
WT=$(cd "$(dirname "$0")/../../.." && pwd)
cd "$WT"
R=qa-runs/harnesses/tileset-authoring/$TH/$RUN
V=/tmp/viz/$TH; mkdir -p "$V"
python3 src/harnesses/tileset-authoring/harness.py --theme "$TH" --run "$RUN" draw > "$V/draw.log" 2>&1 || { tail -20 "$V/draw.log"; echo "draw 실패 — 중단"; exit 1; }
tail -3 "$V/draw.log"
python3 src/harnesses/tileset-authoring/harness.py --theme "$TH" --run "$RUN" bake > "$V/bake.log" 2>&1 || { tail -20 "$V/bake.log"; echo "bake 실패 — 중단"; exit 1; }
npx tsx "src/harnesses/tileset-authoring/node/$MOD.mts" "$R/bake" || { echo "쇼케이스·검사 실패"; exit 1; }
python3 - "$R/bake" "$V" <<'EOF'
import json, os, subprocess, sys
bake, v = sys.argv[1], sys.argv[2]
for m in json.load(open(f"{bake}/maps.json")):
    name = m["file"][len("verify-"):-len(".json")]
    env = dict(os.environ, MAPFILE=m["file"])
    subprocess.run(["python3", "src/harnesses/tileset-authoring/lib/render_map.py", bake, f"{v}/{name}.png", "0", "0", str(m["w"]), str(m["h"]), str(m["scale"])], env=env, check=True)
    print(f"그림 {v}/{name}.png")
EOF
cp "$R/candidate.png" "$V/sheet.png"
