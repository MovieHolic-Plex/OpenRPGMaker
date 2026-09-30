# 손 도트 실내 칩셋 v4·v5 원본 (2026-09-28 세션)

`/tmp/j8v4`, `/tmp/j8v5` 에만 있던 손 도트 실내 칩셋 작업 폴더를 그대로 옮긴 사본이다(`/tmp` 는 지워진다 — 2026-09-28 에 `/tmp/j8*` 가 한 번 통째로 사라졌다).
- `v5/interior-atlas.png` (640×1760) + `v5/interior-meta.json`(기물 381·오토타일·바닥·벽·천장 메타) = 최신판. 빵집(가게·굽는 방·밀가루 창고)·약국·저택 등 건물 10곳 + 새 실내 15곳.
- 스크립트: `kit5.py`·`meta5.py`·`b_*.py`(건물)·`room*.py`·`anim*.py`. 스크립트 안 경로는 `/tmp/j8v5` 기준이다 — 이 폴더에서 돌릴 땐 경로를 바꿔라.
- 결과 페이지 사본: `interior-v3/v4/v5.html`, `interior-objects.html` (http://mdc-server:18301/interior-v5.html).
- 방법론: `~/.claude/skills/interior-chipset-authoring/SKILL.md` 0c~0e 절.
- **기물 후보 고르기 하네스 (2026-09-30)**: `pick/` — 작업자 여럿이 v5 기물마다 후보 A·B·C 를 pxgrid 16px 로 찍고(`pick/WORKER.md`), 사용자가 http://mdc-server:18302/ 에서 고른다(`pick/picks.json`). 도구는 `scripts/content/hand-interior-pick/`. v5 벽·바닥은 그대로, 기물만 바꾼다.
