#!/bin/bash
# 시험용 SQLite 프로젝트 폴더에만 저장하고 다시 읽어 연애 루프 필드(socialLoop·HUD·장르 잠금·기한 엔딩 공통 이벤트)가 살아남는지 확인한다(정본·LegacyDb 에 쓰지 않는다).
#   scripts/qa/romance-fix/sqlite-roundtrip-loop.sh <project.json> <label>
set -e
SRC=$1; LABEL=$2
DIR=/tmp/romance-fix-sqlite/$LABEL
rm -rf "$DIR"; mkdir -p "$DIR"
node scripts/oprn-store.mjs init "$DIR" >/dev/null
node scripts/oprn-store.mjs import-json "$DIR" --json "$SRC" >/dev/null
node scripts/oprn-store.mjs export-json "$DIR" --out "$DIR/reloaded.json" >/dev/null
python3 - "$SRC" "$DIR/reloaded.json" <<'P'
import json,sys
a=json.load(open(sys.argv[1])); b=json.load(open(sys.argv[2]))
def sig(p):
    s=p["system"]
    ce=[c for c in p.get("commonEvents",[]) if c["id"]=="ce_deadline_ending"]
    npcs=[(e["name"],e.get("characterId"),e.get("talkFriendship")) for m in p["maps"].values() for e in m["events"] if e.get("talkFriendship")]
    return {"socialLoop":s.get("socialLoop"),"genreLock":(s.get("genreLock") or {}).get("preset"),"timeSystem":s.get("timeSystem"),"hud":[(w["id"],w["source"],w["shape"]) for w in (s.get("fieldHud") or {}).get("widgets",[])],"title":(s.get("titleScreen") or {}).get("backgroundResourceId"),"deadlineEvent":len(ce),"onDayEnd":(s.get("timeSystem") or {}).get("onDayEnd"),"endings":[e["id"] for e in p.get("endings",[])],"talkNpcs":npcs}
sa,sb=sig(a),sig(b)
for k in sa: print(k.ljust(14), sa[k], "" if sa[k]==sb[k] else f"  !! reload: {sb[k]}")
print("MATCH" if sa==sb else "MISMATCH"); sys.exit(0 if sa==sb else 1)
P
