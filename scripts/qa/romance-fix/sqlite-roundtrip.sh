#!/bin/bash
# 시험용 SQLite 프로젝트 폴더에만 저장하고 다시 읽어 맵·이벤트 수·JSON 일치를 확인한다(정본 프로젝트·LegacyDb 에 쓰지 않는다).
#   scripts/qa/romance-fix/sqlite-roundtrip.sh <project.json> <label>
set -e
SRC=$1; LABEL=$2
DIR=/tmp/romance-fix-sqlite/$LABEL
rm -rf "$DIR"; mkdir -p "$DIR"
node scripts/oprn-store.mjs init "$DIR" >/dev/null
node scripts/oprn-store.mjs import-json "$DIR" --json "$SRC" >/dev/null
node scripts/oprn-store.mjs export-json "$DIR" --out "$DIR/reloaded.json" >/dev/null
node scripts/oprn-store.mjs info "$DIR" | head -12
python3 - "$SRC" "$DIR/reloaded.json" <<'P'
import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
def sig(p): return {"maps":len(p["maps"]),"events":sum(len(m["events"]) for m in p["maps"].values()),"start":p["startMapId"],"tilesets":sorted({m["tilesetId"] for m in p["maps"].values()}),"switches":len(p.get("switches",[])),"endings":[e["id"] for e in p.get("endings",[])],"friendship":p.get("session",{}).get("friendship")}
sa,sb=sig(a),sig(b); print("source :",sa); print("reload :",sb); print("MATCH" if sa==sb else "MISMATCH")
sys.exit(0 if sa==sb else 1)
P
