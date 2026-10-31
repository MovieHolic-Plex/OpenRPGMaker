#!/bin/bash
# Assistant cost A/B — VM queue:  vm-queue.sh <out-root> <arm>=<VM release copy>[=ENV1,ENV2…] [...]
#   e.g. vm-queue.sh $RBASE/script-ab/cost1 base=$RBASE/z-project/rpg-zzu-cost-abc=OPRN_CLI_TOOL_FREEZE=0 freeze=$RBASE/z-project/rpg-zzu-cost-abc
#   Every (arm, mechanic, rep) run starts from the frozen stage checkpoints in <out-root>/checkpoints (script A/B 2 stages) and sends only
#   the logic request — runs reuse scripts/qa/script-ab/ab2/vm-run.sh (Opus 5.5 medium local CLI, 15-min cap). ENV pairs are exported for
#   that arm only (feature switches), so two arms can share one build. Each run passes the suite build gate (remote-gate.sh).
#   COST_MECHS / COST_REPS override the job list; COST_PAR = parallel workers (default 3 — share the VM with other measurements).
set -u
# non-interactive ssh has no suite env (python3, playwright browsers, TMPDIR) — without it every run dies at once and still says finished=.
[ -f "$HOME/.oprn-suite/vm-env.sh" ] && . "$HOME/.oprn-suite/vm-env.sh"
ROOT=$1; shift; HERE=$(cd "$(dirname "$0")" && pwd)
S=/home/ubuntu/z-project/assistant-whole-game/suite; GATE=$S/remote-gate.sh; B=$(basename $ROOT)
jobs=""
for rep in ${COST_REPS:-1 2}; do for m in ${COST_MECHS:-escape village dungeon}; do for kv in "$@"; do
  a=${kv%%=*}; rest=${kv#*=}; w=${rest%%=*}; envs=""; [ "$rest" != "$w" ] && envs=${rest#*=}
  jobs="$jobs $a:$m:$rep:$w:${envs:--}"
done; done; done
for j in $jobs; do IFS=: read a m r w e <<< "$j"; mkdir -p $ROOT/$a/$m-$r $S/runs/$B/$a; ln -sfn $ROOT/$a/$m-$r $S/runs/$B/$a/$m-$r; done
echo $jobs | tr ' ' '\n' | grep . | xargs -P ${COST_PAR:-3} -I{} bash -c 'IFS=: read a m r w e <<< "{}"; G='$ROOT'/$a/$m-$r; grep -q finished= $G/RUN.txt 2>/dev/null && exit 0; '$GATE' $G 5 34; [ "$e" = - ] || { for x in ${e//,/ }; do export "$x"; done; echo "env=$e" >> $G/RUN.txt; }; cd $w && scripts/qa/script-ab/ab2/vm-run.sh $a $m $r '$ROOT' > $G/run.log 2>&1'
echo "queue done $(date -u +%FT%TZ)" >> $ROOT/.queue-done
