#!/bin/bash
# Script A/B PoC — VM watchdog: vm-watchdog.sh <out-root> [cap-min=35]
# Backstop for the per-run cap: a run still building CAP+1 min after it started gets its session process group
# (setsid'ed wholeGameSession → host, browser) and its python driver stopped; RUN.txt gets «timeout». Only touches
# processes whose pid files live in <out-root> (started by this experiment).
ROOT=$1; CAP=${2:-35}
while :; do
  for d in $ROOT/*/*; do
    [ -f $d/RUN.txt ] || continue; grep -q -e finished= -e timeout= $d/RUN.txt && continue
    st=$(grep -o 'started=[^ ]*' $d/RUN.txt | head -1 | cut -d= -f2); [ -n "$st" ] || continue
    age=$(( ($(date +%s) - $(date -d "$st" +%s)) / 60 ))
    [ $age -ge $((CAP + 1)) ] || continue
    p=$(cat $d/driver.pid 2>/dev/null); echo "timeout=$(date -u +%FT%TZ) age_min=$age" >> $d/RUN.txt
    [ -n "$p" ] && kill -TERM -$p 2>/dev/null
    for q in $(pgrep -f "python3 - $d/session"); do kill -TERM $q; done
    # the session may ignore TERM while a turn is in flight: escalate, and stop its host (own process group)
    ( sleep 20; [ -n "$p" ] && kill -KILL -$p 2>/dev/null
      for q in $(pgrep -f "oprn-serve.mjs --project-dir $d/project"); do kill -KILL -$(ps -o pgid= $q | tr -d ' ') 2>/dev/null; done ) &
    echo "$(date -u +%T) cap: stopped $d (age $age min)" >> $ROOT/watchdog.log
  done
  sleep 30
done
