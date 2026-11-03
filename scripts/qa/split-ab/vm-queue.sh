#!/bin/bash
# Lead/worker split battery — VM queue:  vm-queue.sh <out-root> <arm>:<task>:<rep> [...]
#   cwd = the VM release copy. Several queues may run at once: a slot lock keeps at most SPLIT_PAR (default 3) of OUR runs
#   building across all of them (counted by live driver.pid under <out-root>), each also passes the suite build gate, and a
#   run starts only while /var keeps ≥ SPLIT_MIN_FREE_GB (default 12) free. Runs are linked under suite/runs/<batch>/.
set -u
ROOT=$1; shift; HERE=$(cd "$(dirname "$0")" && pwd); WT=$PWD
S=/home/ubuntu/z-project/assistant-whole-game/suite; GATE=$S/remote-gate.sh; B=$(basename $ROOT)
for j in "$@"; do IFS=: read a t r <<< "$j"; mkdir -p $ROOT/$a/$t-$r $S/runs/$B/$a; ln -sfn $ROOT/$a/$t-$r $S/runs/$B/$a/$t-$r; done
export ROOT HERE WT GATE
one(){
  IFS=: read a t r <<< "$1"; G=$ROOT/$a/$t-$r; grep -q finished= $G/RUN.txt 2>/dev/null && return 0
  exec 8>$ROOT/.slot.lock; flock 8
  while :; do
    n=0; for f in $ROOT/*/*/driver.pid; do [ -f "$f" ] || continue; d=$(dirname $f); grep -q finished= $d/RUN.txt 2>/dev/null && continue; p=$(cat $f 2>/dev/null) && kill -0 $p 2>/dev/null && n=$((n+1)); done
    free=$(df --output=avail -BG /var | tail -1 | tr -dc 0-9)
    [ $n -lt ${SPLIT_PAR:-3} ] && [ $free -ge ${SPLIT_MIN_FREE_GB:-12} ] && break
    sleep 30
  done
  $GATE $G 5 34
  (cd $WT && $HERE/vm-run.sh $a $t $r $ROOT > $G/run.log 2>&1) &
  local pid=$!
  for i in $(seq 1 60); do [ -f $G/driver.pid ] && break; sleep 5; done
  flock -u 8; exec 8>&-
  wait $pid
}
export -f one
printf '%s\n' "$@" | xargs -P ${SPLIT_PAR:-3} -I{} bash -c 'one {}'
echo "queue done $* $(date -u +%FT%TZ)" >> $ROOT/.queue-done
