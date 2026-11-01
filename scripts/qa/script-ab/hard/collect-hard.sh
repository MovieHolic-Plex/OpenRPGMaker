#!/bin/bash
# Hard-logic battery — on this box: pull finished VM runs (then shrink them on the VM to RUN.txt only), walk new ones
# (≤3 at once, this checkout's player build), judge fidelity, capture + judge readability, rewrite measure.json.
#   collect-hard.sh [batch=hard1]     env VIEWER_URL (dev server of this checkout, default http://127.0.0.1:9981)
set -u
B=${1:-hard1}; L=$HOME/z-project/assistant-whole-game/suite/script-ab/$B; H=$(cd "$(dirname "$0")" && pwd); REPO=$(cd $H/../../../.. && pwd)
. ~/z-project/assistant-whole-game/suite/remote/config.sh
R=$RBASE/script-ab/$B
RRSYNC="env LD_LIBRARY_PATH=$RBASE/sys/usr/lib/aarch64-linux-gnu:$RBASE/sys/lib/aarch64-linux-gnu $RBASE/bin/rsync"
# 1. pull only finished runs, then free the VM copy (keep RUN.txt so the queue skips it)
fin=$(timeout 60 ssh "${SSHO[@]}" $VM "cd $R && grep -l finished= opus/*/RUN.txt haiku/*/RUN.txt 2>/dev/null | xargs -r -n1 dirname" < /dev/null)
for g in $fin; do
  [ -f $L/$g/.pulled ] && continue
  mkdir -p $L/$g
  rsync -a -e "ssh ${SSHO[*]}" --rsync-path="$RRSYNC" --exclude='shared-content.sqlite*' --exclude='snapshots/' $VM:$R/$g/ $L/$g/ && grep -q finished= $L/$g/RUN.txt && touch $L/$g/.pulled \
    && timeout 60 ssh "${SSHO[@]}" $VM "cd $R/$g && find . -mindepth 1 -maxdepth 1 ! -name RUN.txt -exec rm -rf {} +" < /dev/null && echo "pulled $g"
done
mkdir -p $L/walk
# 2. walk
todo=""; for d in $L/opus/* $L/haiku/*; do [ -f $d/.pulled ] || continue; a=$(basename $(dirname $d)); r=$(basename $d); [ -f $L/walk/$a-$r/walk.json ] || todo="$todo $a:$r"; done
echo $todo | tr ' ' '\n' | grep . | xargs -r -P 3 -I{} bash -c 'IFS=: read a r <<< "{}"; m=${r%-*}; cd '$REPO' && timeout 1800 node scripts/qa/script-ab/hard/walk-hard.mjs --project-dir '$L'/$a/$r/project --mech $m --stage-root '$L'/checkpoints --out '$L'/walk/$a-$r --video --netns > '$L'/walk/$a-$r.log 2>&1; echo "walk $a-$r: $(tail -1 '$L'/walk/$a-$r.log)"'
# 3. fidelity judge
for w in $L/walk/*/walk.json; do t=$(basename $(dirname $w)); [ -f $L/judge/$t.json ] || echo $t; done | xargs -r -P 4 -I{} bash -c 'IFS=- read a m r <<< "{}"; python3 '$H'/judge-hard.py '$L' $a $m $r 2>> '$L'/judge.err'
# 4. readability (event list shots with this checkout's editor, then the Opus judge)
python3 $H/measure-hard.py $L > /dev/null
URL=${VIEWER_URL:-http://127.0.0.1:9981}
if curl -s -o /dev/null -m 5 $URL/; then
python3 - "$L" <<'PY'
import json, sys, os
L = sys.argv[1]
for r in json.load(open(f"{L}/measure.json"))["rows"]:
    if r["status"] != "done" or not r.get("shape"): continue
    tag = f'{r["arm"]}-{r["mech"]}-{r["rep"]}'; os.makedirs(f"{L}/shots/{tag}", exist_ok=True)
    if os.path.exists(f"{L}/shots/{tag}/events.json"): continue
    ev = []
    for c in r["shape"]["changed"]:
        k = c["key"].split(":", 2)
        if k[0] == "map": ev.append({"mapId": k[1], "eventId": k[2]})
        elif k[0] == "common": ev.append({"commonEventId": k[1]})
    p = json.load(open(f'{L}/{r["arm"]}/{r["mech"]}-{r["rep"]}/check/project.json')); p["tilesets"] = {}
    json.dump(p, open(f"{L}/shots/{tag}/run.json", "w"), ensure_ascii=False)
    json.dump(ev[:20], open(f"{L}/shots/{tag}/events.json", "w"), ensure_ascii=False)
PY
for d in $L/shots/*/; do t=$(basename $d); ls $d/*.png >/dev/null 2>&1 && continue
  (cd $REPO && PW=$REPO/node_modules/playwright/index.mjs timeout 1200 node $H/capture-event-lists.mjs --base $URL --project $d/run.json --events $d/events.json --out $d > $d/capture.log 2>&1); echo "shots $t: $(ls $d/*.png 2>/dev/null | wc -l)"; done
for d in $L/shots/*/; do t=$(basename $d); ls $d/*.png >/dev/null 2>&1 || continue; [ -f $L/readability/$t.json ] || echo $t; done | xargs -r -P 4 -I{} bash -c 'IFS=- read a m r <<< "{}"; python3 '$H'/readability-hard.py '$L' $a $m $r 2>> '$L'/readability.err'
else echo "viewer $URL down — readability skipped"; fi
python3 $H/measure-hard.py $L
