#!/bin/bash
# merge-loop.sh <worktree> <branch:pr>… — 근거를 이미 읽고 올린 PR 을 차례로 머지한다. main 을 합칠 때 INDEX.md 말고 다른 충돌이 나면 멈춘다.
WT=$1; shift
cd "$WT" || exit 1
for pair in "$@"; do
  BR=${pair%%:*}; PR=${pair##*:}; ok=0
  for try in 1 2 3 4 5; do
    git fetch -q origin main "$BR" || { echo "$PR fetch fail"; break; }
    git checkout -q "$BR" 2>/dev/null || git checkout -q -b "$BR" "origin/$BR" || { echo "$PR checkout fail"; break; }
    git reset -q --hard "origin/$BR"
    if ! git merge -q origin/main > /tmp/merge-loop-$PR.txt 2>&1; then
      other=$(git diff --name-only --diff-filter=U | grep -v '^openwiki/INDEX.md$' | grep -v '^openwiki/assistant-v2.md$')
      if [ -n "$other" ]; then echo "$PR STOP: 다른 충돌 $other"; git merge --abort; break; fi
      # 위키 날짜 절은 양쪽 다 남긴다(둘 다 같은 자리 앞에 새 절을 더한 충돌).
      if git diff --name-only --diff-filter=U | grep -q '^openwiki/assistant-v2.md$'; then
        python3 -c "
import re;p='openwiki/assistant-v2.md';s=open(p,encoding='utf-8').read()
s=re.sub(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', lambda m:m.group(1)+m.group(2), s, flags=re.S);open(p,'w',encoding='utf-8').write(s)" && git add openwiki/assistant-v2.md
      fi
      # INDEX.md: main 이 아직 갖고 있고 이 브랜치가 무시하지 않으면 main 것을 받는다. 2026-11-11 부터는 커밋하지 않는 생성 파일이라 지운 쪽을 따른다.
      if git cat-file -e origin/main:openwiki/INDEX.md 2>/dev/null && ! git check-ignore -q --no-index openwiki/INDEX.md; then
        git checkout --theirs openwiki/INDEX.md 2>/dev/null; git add openwiki/INDEX.md
      else
        git rm -q --cached openwiki/INDEX.md 2>/dev/null
      fi
      git -c core.editor=true commit -q --no-edit
    fi
    oprn-push > /tmp/merge-loop-$PR-push.txt 2>&1 || { echo "$PR push fail"; tail -3 /tmp/merge-loop-$PR-push.txt; break; }
    sleep 25
    node scripts/merge-pr.mjs "$PR" > /tmp/merge-loop-$PR-merge.txt 2>&1
    if [ "$(gh pr view "$PR" --json state -q .state)" = "MERGED" ]; then echo "$PR MERGED (try $try)"; ok=1; break; fi
    echo "$PR try $try 실패: $(tail -2 /tmp/merge-loop-$PR-merge.txt | tr '\n' ' ' | cut -c1-200)"
    grep -q "conflict\|충돌" /tmp/merge-loop-$PR-merge.txt || break
  done
  [ $ok = 1 ] || { echo "$PR 멈춤"; break; }
done
git checkout -q --detach origin/main
echo LOOP-DONE
