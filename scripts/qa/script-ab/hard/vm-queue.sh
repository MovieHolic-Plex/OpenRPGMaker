#!/bin/bash
# Hard-logic battery — VM queue:  vm-queue.sh <out-root> <job> [...]     job = <arm>:<id>:<rep>  (arm stage|opus|haiku)
#   Runs jobs through the suite build gate (remote-gate.sh) with at most HARD_PAR (default 3) of ours at once.
#   cwd = the VM release copy. Runs are linked under suite/runs/<batch>/ so the shared gate counts them.
set -u
ROOT=$1; shift; HERE=$(cd "$(dirname "$0")" && pwd); WT=$PWD
S=/home/ubuntu/z-project/assistant-whole-game/suite; GATE=$S/remote-gate.sh; B=$(basename $ROOT)
for j in "$@"; do IFS=: read a m r <<< "$j"; if [ $a = stage ]; then G=$ROOT/checkpoints/$m; else G=$ROOT/$a/$m-$r; fi; mkdir -p $G $S/runs/$B/$a; ln -sfn $G $S/runs/$B/$a/$m-$r; done
printf '%s\n' "$@" | xargs -P ${HARD_PAR:-3} -I{} bash -c 'IFS=: read a m r <<< "{}"; if [ $a = stage ]; then G='$ROOT'/checkpoints/$m; else G='$ROOT'/$a/$m-$r; fi; grep -q finished= $G/RUN.txt 2>/dev/null && exit 0; '$GATE' $G 5 34; cd '$WT' && '$HERE'/vm-run.sh $a $m $r '$ROOT' > $G/run.log 2>&1'
echo "queue done $* $(date -u +%FT%TZ)" >> $ROOT/.queue-done
