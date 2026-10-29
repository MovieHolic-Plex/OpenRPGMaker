#!/bin/bash
# 이 워크트리에서 바뀐 파일만 신기루 VM 의 rpg-zzu-isekai 사본(69d3fb00e3 하드링크 사본)으로 보낸다.
# 하드링크 원본을 덮지 않게 tar 는 --unlink-first 로 풀어 링크를 끊고 새 파일을 쓴다(VM 에 rsync 가 없다).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
VM=ubuntu@100.123.182.78
R=/var/tmp/oprn-suite/z-project/rpg-zzu-isekai
BASE=69d3fb00e3
{ git diff --name-only --diff-filter=ACMR "$BASE"; git ls-files --others --exclude-standard; } | sort -u | while read -r f; do [ -f "$f" ] && echo "$f"; done > /tmp/ig-sync-list.txt
gone=$(git diff --name-only --diff-filter=D "$BASE" | tr '\n' ' ')
tar cf - -T /tmp/ig-sync-list.txt | ssh -o BatchMode=yes "$VM" "cd $R && tar xf - --unlink-first"
[ -n "$gone" ] && ssh -o BatchMode=yes "$VM" "cd $R && rm -f $gone" || true
echo "synced $(wc -l < /tmp/ig-sync-list.txt) files"
