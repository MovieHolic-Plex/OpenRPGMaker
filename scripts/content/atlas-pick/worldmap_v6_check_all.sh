#!/bin/bash
# v6-A 후보만 전부 검사(합격/불합격 요약). 사용: bash worldmap_v6_check_all.sh [slug...]
cd "$(dirname "$0")/../../.."
D=tiledata/atlas-pick/candidates-worldmap
slugs=("$@"); [ ${#slugs[@]} -eq 0 ] && slugs=($(ls $D))
for s in "${slugs[@]}"; do
  f=$D/$s/v6-A.pxg; [ -f "$f" ] || continue
  echo "== $s"; python3 scripts/content/atlas-pick/worldmap_check.py "$f" 2>&1 | grep -v -i deprecat | grep -v '^[0-9]*/[0-9]* 합격'
done
