#!/bin/bash
# Script A/B 2 — VM watchdog: vm-watchdog.sh <out-root>
# Backstop for the per-run cap (cap_min in each RUN.txt): a run still going cap+2 min after it started gets its session
# process group and its python driver stopped; RUN.txt gets «timeout». Only touches processes whose pid files /
# paths live in <out-root> (started by this experiment). Exits when <out-root>/.watchdog-stop exists.
ROOT=$1
while [ ! -f $ROOT/.watchdog-stop ]; do
  for d in $ROOT/*/* ; do
    [ -f $d/RUN.txt ] || continue; grep -q -e finished= -e timeout= $d/RUN.txt && continue
    st=$(grep -o 'started=[^ ]*' $d/RUN.txt | tail -1 | cut -d= -f2); cap=$(grep -o 'cap_min=[0-9]*' $d/RUN.txt | tail -1 | cut -d= -f2)
    [ -n "$st" ] && [ -n "$cap" ] || continue
    age=$(( ($(date +%s) - $(date -d "$st" +%s)) / 60 ))
    [ $age -ge $((cap + 2)) ] || continue
    p=$(cat $d/driver.pid 2>/dev/null); echo "timeout=$(date -u +%FT%TZ) age_min=$age" >> $d/RUN.txt
    [ -n "$p" ] && kill -TERM -$p 2>/dev/null
    for q in $(pgrep -f "python3 - $d/session"); do kill -TERM $q; done
    ( sleep 20; [ -n "$p" ] && kill -KILL -$p 2>/dev/null
      for q in $(pgrep -f "oprn-serve.mjs --project-dir $d/project"); do kill -KILL -$(ps -o pgid= $q | tr -d ' ') 2>/dev/null; done ) &
    echo "$(date -u +%T) cap: stopped $d (age $age min)" >> $ROOT/watchdog.log
  done
  sleep 30
done
