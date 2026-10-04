#!/bin/bash
# 도트 측면 뼈대 위 창 모양 7종을 출하 player.html 로 찍는다(4인 파티, 1024×768).
cd "$(dirname "$0")/../.."
P=verify-shots/battle-ui-default/probe.mjs
O=verify-shots/battle-ui-default/themes
mkdir -p $O
for s in retro2003 ff chrono octopath bravely goldensun rm2003; do
  node $P --skin $s --out $O/$s > $O/$s.log 2>&1 && echo "$s ok" || echo "$s FAIL"
done
echo THEMES-DONE
