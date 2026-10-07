#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
H=src/harnesses/tileset-authoring
bash $H/cycle.sh d100 > /tmp/integ-d100.log 2>&1; echo "overworld $(grep -cE '실패 [1-9]' /tmp/integ-d100.log) $(tail -1 /tmp/integ-d100.log)"
for t in coast:c107 climate:k103 dungeon:u101 rooms:r102 gyms:g103 wild:w197; do th=${t%%:*}; r=${t##*:}
  bash $H/cycle_theme.sh monster-$th $r > /tmp/integ-$th.log 2>&1
  echo "$th $(grep -E '쇼케이스' /tmp/integ-$th.log | tail -1)"
done
H=src/harnesses/tileset-authoring
for t in overworld:d100 coast:c107 climate:k103 dungeon:u101 rooms:r102 gyms:g103 wild:w197; do th=${t%%:*}; r=${t##*:}; python3 $H/harness.py --theme monster-$th --run $r wire 2>&1 | tail -1; done
npx tsx $H/node/wire_check.mts 2>&1 | tail -1
