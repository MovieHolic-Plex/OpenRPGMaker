#!/bin/bash
# Script A/B PoC — VM queue: vm-queue.sh <out-root> <parallel> — runs every (prompt, rep, arm) build, A/B interleaved.
# Each build passes the suite build gate (remote-gate.sh: other builds + cgroup anon) before it starts.
set -u
ROOT=$1; PAR=${2:-4}; HERE=$(cd "$(dirname "$0")" && pwd); WT=$(cd $HERE/../../.. && pwd)
GATE=/home/ubuntu/z-project/assistant-whole-game/suite/remote-gate.sh
mkdir -p $ROOT
jobs=""; for rep in 1 2; do for p in escape village dungeon; do for a in A B; do jobs="$jobs $a:$p:$rep"; done; done; done
echo $jobs | tr ' ' '\n' | xargs -P $PAR -I{} bash -c 'IFS=: read a p r <<< "{}"; G='$ROOT'/$a/$p-$r; mkdir -p $G; [ -f $G/RUN.txt ] && grep -q finished= $G/RUN.txt && exit 0; '$GATE' $G 5 34; cd '$WT' && '$HERE'/vm-run.sh $a $p $r '$ROOT' > $G/run.log 2>&1'
echo "queue done $(date -u +%FT%TZ)" > $ROOT/.queue-done
