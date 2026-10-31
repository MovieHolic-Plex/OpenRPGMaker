#!/bin/bash
# Assistant cost A/B — on this box: pull finished VM runs, walk new ones in the shipped player (≤3 at once),
# judge each arm against the base arm (both orders, Opus 5.5 — ab2/judge.py), then print measure.py.
#   collect.sh <batch> <base-arm> <arm> [<arm>…]      e.g. collect.sh cost1 base freeze
#   WALK_REPO = checkout whose dist/ is the walk player (default: this checkout) — one player for every arm.
set -u
B=$1; BASE=$2; shift 2; ARMS="$BASE $*"
L=$HOME/z-project/assistant-whole-game/suite/script-ab/$B; H=$(cd "$(dirname "$0")" && pwd); AB2=$H/../script-ab/ab2
REPO=${WALK_REPO:-$(cd $H/../../.. && pwd)}; [ "$(cat $REPO/dist/.built-from 2>/dev/null)" ] || { echo "walk player $REPO has no dist"; exit 1; }
. ~/z-project/assistant-whole-game/suite/remote/config.sh
RRSYNC="env LD_LIBRARY_PATH=$RBASE/sys/usr/lib/aarch64-linux-gnu:$RBASE/sys/lib/aarch64-linux-gnu $RBASE/bin/rsync"
mkdir -p $L/walk $L/judge
rsync -a -e "ssh ${SSHO[*]}" --rsync-path="$RRSYNC" --exclude='shared-content.sqlite*' --exclude='snapshots/' --exclude=frozen --exclude=checkpoints $VM:$RBASE/script-ab/$B/ $L/ || echo "pull failed (VM unreachable?)"
todo=""
for a in $ARMS; do for d in $L/$a/*; do
  [ -f $d/RUN.txt ] && grep -q finished= $d/RUN.txt || continue
  r=$(basename $d); m=${r%-*}
  [ -f $L/walk/$a-$r/walk.json ] || todo="$todo $a:$m:$r"
done; done
echo $todo | tr ' ' '\n' | grep . | xargs -r -P 3 -I{} bash -c 'IFS=: read a m r <<< "{}"; cd '$REPO' && timeout 1500 node scripts/qa/script-ab/walk.mjs --project-dir '$L'/$a/$r/project --request $m --bind '$AB2'/bind/$m.json --out '$L'/walk/$a-$r --netns > '$L'/walk/$a-$r.log 2>&1; echo "walk $a-$r: $(tail -1 '$L'/walk/$a-$r.log)"'
for m in escape village dungeon; do for r in $(ls $L/$BASE 2>/dev/null | sed -n "s/^$m-//p" | sort -n); do for x in "$@"; do
  [ -f $L/walk/$x-$m-$r/walk.json ] && [ -f $L/walk/$BASE-$m-$r/walk.json ] && [ ! -f $L/judge/$m-$r-$x-$BASE.json ] && echo "$m $r $x $BASE"
done; done; done | xargs -r -P 6 -L 1 bash -c 'python3 '$AB2'/judge.py '$L' $0 $1 $2 $3 > /dev/null 2>> '$L'/judge.err && echo judged $0 $1 $2 $3'
python3 $H/measure.py $L $BASE "$@"
