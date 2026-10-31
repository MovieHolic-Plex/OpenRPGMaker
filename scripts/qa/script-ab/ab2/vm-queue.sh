#!/bin/bash
# Script A/B 2 — VM queue:  vm-queue.sh <out-root> <arm>=<VM release copy> [...]   e.g. main=/var/tmp/.../rpg-zzu-sab2-0ea6a8369b off=same
#   Every (arm, mechanic, rep 1..2) run, arms interleaved. Each run passes the suite build gate (remote-gate.sh: ≤5 builds,
#   cgroup anon) — our runs are linked under suite/runs/<batch>/ so the gate (ours and the suite's) counts them.
#   SAB_MECHS / SAB_REPS override the job list; SAB_PAR = parallel workers (default 6, the gate still caps builds).
set -u
ROOT=$1; shift; HERE=$(cd "$(dirname "$0")" && pwd)
S=/home/ubuntu/z-project/assistant-whole-game/suite; GATE=$S/remote-gate.sh; B=$(basename $ROOT)
declare -A WTS; ARMS=""; for kv in "$@"; do WTS[${kv%%=*}]=${kv#*=}; ARMS="$ARMS ${kv%%=*}"; done
jobs=""; for rep in ${SAB_REPS:-1 2}; do for m in ${SAB_MECHS:-escape village dungeon}; do for a in $ARMS; do jobs="$jobs $a:$m:$rep:${WTS[$a]}"; done; done; done
for j in $jobs; do IFS=: read a m r w <<< "$j"; mkdir -p $ROOT/$a/$m-$r $S/runs/$B/$a; ln -sfn $ROOT/$a/$m-$r $S/runs/$B/$a/$m-$r; done
echo $jobs | tr ' ' '\n' | xargs -P ${SAB_PAR:-6} -I{} bash -c 'IFS=: read a m r w <<< "{}"; G='$ROOT'/$a/$m-$r; grep -q finished= $G/RUN.txt 2>/dev/null && exit 0; '$GATE' $G 5 34; cd $w && '$HERE'/vm-run.sh $a $m $r '$ROOT' > $G/run.log 2>&1'
echo "queue done $(date -u +%FT%TZ)" >> $ROOT/.queue-done
