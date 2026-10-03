#!/bin/bash
# ship.sh <id> "<한글 설명>" — 저장소로 들여오고 커밋, intake, 검수 시작
set -e
id=$1; desc=$2
cd ~/z-project/rpg-zzu-worldmap-iconsets
rm -rf tiledata/worldmap-kit/iconsets/$id
python3 ~/wmi-sets/import_set.py $id 2>&1 | tail -3
git add tiledata/worldmap-kit/iconsets/$id
git commit -qm "feat(worldmap-kit): $desc

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
cd src/harnesses/worldmap-icons
python3 harness.py intake --set $id 2>&1 | tail -2
setsid nohup python3 harness.py review --set $id > /tmp/wmi-review-$id.log 2>&1 < /dev/null &
echo started
