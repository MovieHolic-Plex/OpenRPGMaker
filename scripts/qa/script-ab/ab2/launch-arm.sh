#!/bin/bash
# Script A/B 2 — from this box: build one arm's release dist in its own worktree, sync it to the VM, start its queue.
#   launch-arm.sh <arm> <commit> [batch=sab2]        e.g. launch-arm.sh new 1a2b3c4d5e
#   Worktree ~/z-project/rpg-zzu-sab2-<arm>-<sha7> (created at <commit>; the harness dir ab2/ is taken from ~/z-project/rpg-zzu-sab2).
#   If the build lacks wholeGameSession --deadline-ms, the PoC 4-line patch is applied (harness only, not in dist).
#   The queue on the VM uses the harness in the main-arm copy and the arm's own copy as cwd (= its build).
set -eu
ARM=$1; C=$2; B=${3:-sab2}; H=$HOME/z-project/rpg-zzu-sab2; W=$HOME/z-project/rpg-zzu-sab2-$ARM-${C:0:7}
[ -d $W ] || (cd $HOME/z-project/rpg-zzu && node scripts/agent-worktree.mjs create sab2-$ARM-${C:0:7} --base $C)
cd $W; git checkout -q --detach $C
grep -q deadline-ms src/harnesses/assistant-capability/node/wholeGameSession.mjs || git -C $H diff $(git -C $H merge-base origin/main HEAD) HEAD -- src/harnesses/assistant-capability/node/wholeGameSession.mjs | git apply
mkdir -p scripts/qa/script-ab && rsync -a $H/scripts/qa/script-ab/ scripts/qa/script-ab/
HC=$(git rev-parse --short=10 HEAD)
if [ "$(cat dist/.built-from 2>/dev/null)" != "$HC" ]; then
  NODE_OPTIONS=--max-old-space-size=12000 npm run build:fast && npx vite build --config vite.player.config.ts --configLoader runner && npm run build:electron && echo $HC > dist/.built-from
fi
cd ~/z-project/assistant-whole-game/suite/remote; . ./config.sh
MAINCOPY=$RBASE/z-project/rpg-zzu-sab2-$(cut -c1-10 $H/dist/.built-from)
rsh "cd $RBASE/z-project && [ -d $(basename $W)-$HC ] || { cp -al $MAINCOPY $(basename $W)-$HC.part && mv $(basename $W)-$HC.part $(basename $W)-$HC; }"
SUITE_LOCAL_WT=$W ./setup-vm.sh repo deps
rsh ". ~/.oprn-suite/vm-env.sh; cd $MAINCOPY && SAB_PAR=${SAB_PAR:-6} setsid nohup scripts/qa/script-ab/ab2/vm-queue.sh $RBASE/script-ab/$B $ARM=$RBASE/z-project/$(basename $W)-$HC > $RBASE/script-ab/$B/queue-$ARM.log 2>&1 < /dev/null & echo queued $ARM"
