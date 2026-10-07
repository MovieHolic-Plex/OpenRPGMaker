#!/bin/sh
ip link set lo up
cd /home/main/z-project/rpg-zzu-jp-city-jp-houses
npm run dev:worktree > /tmp/jpi/dev-ns.log 2>&1 &
DEV=$!
for i in $(seq 1 120); do
  if curl -s -o /dev/null http://127.0.0.1:9928/; then break; fi; sleep 1
done
timeout 900 node scripts/content/jp-city/qa/editor-place.probe.mjs http://127.0.0.1:9928
RC=$?
# 이 netns 안의 프로세스만 정리(같은 PID 공간이라 pkill 은 남의 것까지 죽인다)
ME=$(readlink /proc/self/ns/net)
for p in $(ls /proc | grep -E '^[0-9]+$'); do
  [ "$p" = "$$" ] && continue
  [ "$(readlink /proc/$p/ns/net 2>/dev/null)" = "$ME" ] && kill $p 2>/dev/null
done
exit $RC
