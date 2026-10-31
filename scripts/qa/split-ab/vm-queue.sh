#!/bin/bash
# Lead/worker split battery — VM queue:  vm-queue.sh <out-root> <arm>:<task>:<rep> [...]
#   cwd = the VM release copy. At most SPLIT_PAR (default 3) of ours at once, each through the suite build gate,
#   and only while /var keeps ≥ SPLIT_MIN_FREE_GB (default 12) free. Runs are linked under suite/runs/<batch>/.
set -u
ROOT=$1; shift; HERE=$(cd "$(dirname "$0")" && pwd); WT=$PWD
S=/home/ubuntu/z-project/assistant-whole-game/suite; GATE=$S/remote-gate.sh; B=$(basename $ROOT)
for j in "$@"; do IFS=: read a t r <<< "$j"; mkdir -p $ROOT/$a/$t-$r $S/runs/$B/$a; ln -sfn $ROOT/$a/$t-$r $S/runs/$B/$a/$t-$r; done
printf '%s\n' "$@" | xargs -P ${SPLIT_PAR:-3} -I{} bash -c 'IFS=: read a t r <<< "{}"; G='$ROOT'/$a/$t-$r; grep -q finished= $G/RUN.txt 2>/dev/null && exit 0
  while [ $(df --output=avail -BG /var | tail -1 | tr -dc 0-9) -lt ${SPLIT_MIN_FREE_GB:-12} ]; do echo "$(date -u +%T) waiting for disk" >> '$ROOT'/.disk-wait; sleep 60; done
  '$GATE' $G 5 34; cd '$WT' && '$HERE'/vm-run.sh $a $t $r '$ROOT' > $G/run.log 2>&1'
echo "queue done $* $(date -u +%FT%TZ)" >> $ROOT/.queue-done
