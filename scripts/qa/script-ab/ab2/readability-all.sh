#!/bin/bash
# Script A/B 2 — readability for every finished run: screenshot the event lists of the events the run created/changed
# (runs[].changedEvents in measure.json, map + common events, ≤20) with ONE viewer build, then the Opus judge.
#   readability-all.sh [batch=sab2]   env VIEWER=<checkout with #4146+ and a running `npm run dev:worktree`>, VIEWER_URL
set -u
B=${1:-sab2}; L=$HOME/z-project/assistant-whole-game/suite/script-ab/$B; H=$(cd "$(dirname "$0")" && pwd)
V=${VIEWER:-$HOME/z-project/rpg-zzu-sab2-viewer}; URL=${VIEWER_URL:-http://127.0.0.1:9994}
M=$HOME/claude-viz/script-editor-live/measure.json
python3 - "$M" "$L" <<'PY'
import json, sys, os
M, L = sys.argv[1:3]
for r in json.load(open(M))["runs"]:
    if r["status"] != "done" or r.get("changedEvents") is None: continue
    tag = f'{r["arm"]}-{r["mech"]}-{r["rep"]}'; os.makedirs(f"{L}/shots/{tag}", exist_ok=True)
    if os.path.exists(f"{L}/shots/{tag}/events.json"): continue
    ev = []
    for c in r["changedEvents"]:
        k = c["key"].split(":", 2)
        if k[0] == "map": ev.append({"mapId": k[1], "eventId": k[2]})
        elif k[0] == "common": ev.append({"commonEventId": k[1]})
    p = json.load(open(f'{L}/{r["arm"]}/{r["mech"]}-{r["rep"]}/check/project.json')); p["tilesets"] = {}
    json.dump(p, open(f"{L}/shots/{tag}/run.json", "w"), ensure_ascii=False)
    json.dump(ev[:20], open(f"{L}/shots/{tag}/events.json", "w"), ensure_ascii=False)
PY
for d in $L/shots/*/; do
  t=$(basename $d); ls $d/*.png >/dev/null 2>&1 && continue
  (cd $V && PW=$V/node_modules/playwright/index.mjs timeout 1200 node $H/capture-event-lists.mjs --base $URL --project $d/run.json --events $d/events.json --out $d > $d/capture.log 2>&1); echo "shots $t: $(ls $d/*.png 2>/dev/null | wc -l)"
done
ls -d $L/shots/*/ | while read d; do t=$(basename $d); [ -f $L/readability/$t.json ] || echo $t; done | xargs -r -P 6 -I{} bash -c 'IFS=- read a m r <<< "{}"; python3 '$H'/readability.py '$L' $a $m $r 2>> '$L'/readability.err'
python3 $H/measure.py $L
