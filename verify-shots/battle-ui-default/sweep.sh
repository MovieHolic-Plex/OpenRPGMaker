#!/bin/bash
# retro2003 기본 전투에 다른 전투 옵션을 하나씩 켜고 실화면을 찍는다(출하 player.html).
cd "$(dirname "$0")/../.."
P=verify-shots/battle-ui-default/probe.mjs
O=verify-shots/battle-ui-default/sweep
run() { node $P --skin retro2003 --system "$2" --out $O/$1 > $O/$1.log 2>&1 && echo "$1 ok" || echo "$1 FAIL"; }
mkdir -p $O
run limit '{"limitGauge":{"enabled":true}}'
run resource2 '{"resource2":{"enabled":true,"start":30}}'
run partygauge '{"partyGauge":{"enabled":true}}'
run rolling '{"battleRollingHp":true}'
run atb-active '{"atbMode":"active","atbSpeed":6}'
run formation '{"battleFormationRoll":true}'
run weakness '{"weaknessExtraAction":true}'
run gen1 '{"battleModel":"gen1"}'
run hit-light '{"battleHitFeel":"light"}'
run all-gauges '{"limitGauge":{"enabled":true},"resource2":{"enabled":true,"start":30},"partyGauge":{"enabled":true}}'
echo SWEEP-DONE
