#!/bin/bash
# Script A/B 2 — on this box: pull finished VM runs, walk the new ones (≤3 at once), judge complete pairs, rewrite measure.json.
#   collect.sh [batch=sab2]    (idempotent; run it every few minutes)
set -u
B=${1:-sab2}; L=$HOME/z-project/assistant-whole-game/suite/script-ab/$B; H=$(cd "$(dirname "$0")" && pwd)
# Every arm is walked with ONE player build (WALK_REPO, pinned to the newest build, 4b65b60) so runtime fixes do not differ by arm.
REPO=${WALK_REPO:-$HOME/z-project/rpg-zzu-sab2-new-4b65b60}; [ "$(cat $REPO/dist/.built-from 2>/dev/null)" ] || { echo "walk player $REPO has no dist yet"; exit 1; }
rsync -a $H/../ $REPO/scripts/qa/script-ab/
. ~/z-project/assistant-whole-game/suite/remote/config.sh
RRSYNC="env LD_LIBRARY_PATH=$RBASE/sys/usr/lib/aarch64-linux-gnu:$RBASE/sys/lib/aarch64-linux-gnu $RBASE/bin/rsync"
rsync -a -e "ssh ${SSHO[*]}" --rsync-path="$RRSYNC" --exclude='shared-content.sqlite*' --exclude='snapshots/' --exclude=frozen $VM:$RBASE/script-ab/$B/ $L/ || echo "pull failed (VM unreachable?)"
mkdir -p $L/walk
todo=""
for d in $L/main/* $L/off/* $L/v1/* $L/new/*; do
  [ -f $d/RUN.txt ] && grep -q finished= $d/RUN.txt || continue
  a=$(basename $(dirname $d)); r=$(basename $d); m=${r%-*}
  [ -f $L/walk/$a-$r/walk.json ] || todo="$todo $a:$m:$r"
done
echo $todo | tr ' ' '\n' | grep . | xargs -r -P 3 -I{} bash -c 'IFS=: read a m r <<< "{}"; cd '$REPO' && timeout 1500 node scripts/qa/script-ab/walk.mjs --project-dir '$L'/$a/$r/project --request $m --bind '$REPO'/scripts/qa/script-ab/ab2/bind/$m.json --out '$L'/walk/$a-$r --video --netns > '$L'/walk/$a-$r.log 2>&1; echo "walk $a-$r: $(tail -1 '$L'/walk/$a-$r.log)"'
# judge: every arm pair with both games walked, both orders, once
for m in escape village dungeon; do for r in 1 2; do for pair in main:off v1:main v1:off new:main new:off new:v1; do
  x=${pair%:*}; y=${pair#*:}
  [ -f $L/walk/$x-$m-$r/walk.json ] && [ -f $L/walk/$y-$m-$r/walk.json ] && [ ! -f $L/judge/$m-$r-$x-$y.json ] && echo "$m $r $x $y"
done; done; done | xargs -r -P 6 -L 1 bash -c 'python3 '$H'/judge.py '$L' $0 $1 $2 $3 > /dev/null 2>> '$L'/judge.err && echo judged $0 $1 $2 $3'
echo "walk player: $(cat $REPO/dist/.built-from)" > $L/walk/PLAYER.txt
python3 $H/measure.py $L
