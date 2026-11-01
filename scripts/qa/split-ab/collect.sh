#!/bin/bash
# Lead/worker split battery — on this box: pull finished VM runs (then free the VM copy, keeping RUN.txt), walk logic
# requests in the shipped player (≤3 at once), judge every run (judge.py), capture + judge event-list readability, measure.
#   collect.sh [batch=split1]     env VIEWER_URL = dev server of this checkout (default http://127.0.0.1:9992), WALK_REPO
set -u
B=${1:-split1}; L=$HOME/z-project/assistant-whole-game/suite/script-ab/$B; H=$(cd "$(dirname "$0")" && pwd); REPO=${WALK_REPO:-$(cd $H/../../.. && pwd)}
AB2=$H/../script-ab/ab2
. ~/z-project/assistant-whole-game/suite/remote/config.sh
R=$RBASE/script-ab/$B
RRSYNC="env LD_LIBRARY_PATH=$RBASE/sys/usr/lib/aarch64-linux-gnu:$RBASE/sys/lib/aarch64-linux-gnu $RBASE/bin/rsync"
mkdir -p $L/walk $L/judge
# 1. pull finished runs, then free the VM copy
fin=$(timeout 60 ssh "${SSHO[@]}" $VM "cd $R && grep -l finished= */*/RUN.txt 2>/dev/null | grep -v '^checkpoints/' | xargs -r -n1 dirname" < /dev/null)
for g in $fin; do
  { [ -f $L/$g/.pulled ] || [ -f $L/$g/.moved ]; } && continue
  mkdir -p $L/$g
  rsync -a -e "ssh ${SSHO[*]}" --rsync-path="$RRSYNC" --exclude='shared-content.sqlite*' --exclude='snapshots/' --exclude=bin $VM:$R/$g/ $L/$g/ && grep -q finished= $L/$g/RUN.txt && touch $L/$g/.pulled \
    && timeout 60 ssh "${SSHO[@]}" $VM "cd $R/$g && find . -mindepth 1 -maxdepth 1 ! -name RUN.txt -exec rm -rf {} +" < /dev/null && echo "pulled $g"
done
# 2. walk the logic requests (lock/shop/plates) in the shipped player
todo=""
for d in $L/*/*/.pulled; do d=$(dirname $d); a=$(basename $(dirname $d)); r=$(basename $d); t=${r%-*}; n=${r##*-}
  w=$(python3 -c "import json;P=json.load(open('$H/prompts.json'));print([x['walk'] or '' for x in P['tasks'] if x['id']=='$t'][0])")
  [ -n "$w" ] && [ ! -f $L/walk/${a}__${t}__$n/walk.json ] && todo="$todo $a:$t:$n:$w"
done
echo $todo | tr ' ' '\n' | grep . | xargs -r -P 3 -I{} bash -c 'IFS=: read a t n w <<< "{}"; cd '$REPO' && timeout 1500 node scripts/qa/script-ab/walk.mjs --project-dir '$L'/$a/$t-$n/project --request $w --bind '$AB2'/bind/$w.json --out '$L'/walk/${a}__${t}__$n --netns > '$L'/walk/${a}__${t}__$n.log 2>&1; echo "walk $a $t $n: $(tail -1 '$L'/walk/${a}__${t}__$n.log)"'
# 3. judge (after its walk, if any)
for d in $L/*/*/.pulled; do d=$(dirname $d); a=$(basename $(dirname $d)); r=$(basename $d); t=${r%-*}; n=${r##*-}
  [ -f $L/judge/${a}__${t}__$n.json ] && continue
  w=$(python3 -c "import json;P=json.load(open('$H/prompts.json'));print([x['walk'] or '' for x in P['tasks'] if x['id']=='$t'][0])")
  [ -n "$w" ] && [ ! -f $L/walk/${a}__${t}__$n/walk.json ] && continue
  echo "$a $t $n"
done | xargs -r -P 4 -L 1 bash -c 'python3 '$H'/judge.py '$L' $0 $1 $2 2>> '$L'/judge.err'
# 4. readability: event-list shots of changed events with this checkout'"'"'s editor, then the Opus judge (ab2/readability.py)
python3 $H/measure.py $L > /dev/null
URL=${VIEWER_URL:-http://127.0.0.1:9992}
if curl -s -o /dev/null -m 5 $URL/; then
  python3 $H/shots_prep.py $L
  for d in $L/shots/*/; do t=$(basename $d); [ -f $d/events.json ] || continue; [ "$(cat $d/events.json)" = "[]" ] && continue
    if ! ls $d/*.png >/dev/null 2>&1 && [ "$(cat $d/.tries 2>/dev/null || echo 0)" -lt 3 ]; then
      echo $(( $(cat $d/.tries 2>/dev/null || echo 0) + 1 )) > $d/.tries
      (cd $REPO && PW=$REPO/node_modules/playwright/index.mjs timeout 1200 node $AB2/capture-event-lists.mjs --base $URL --project $d/run.json --events $d/events.json --out $d > $d/capture.log 2>&1); echo "shots $t: $(ls $d/*.png 2>/dev/null | wc -l)"
    fi
    # judge readability as soon as its shots exist (in the background, ≤4 at once)
    if ls $d/*.png >/dev/null 2>&1 && [ ! -f $L/readability/$t.json ]; then
      while [ $(jobs -r | wc -l) -ge 4 ]; do sleep 5; done
      (IFS=, read a m r <<< "$(echo $t | sed "s/__/,/g")"; python3 $H/readability.py $L "$a" "$m" "$r" 2>> $L/readability.err) &
    fi
  done; wait
else echo "viewer $URL down — readability skipped"; fi
python3 $H/measure.py $L
