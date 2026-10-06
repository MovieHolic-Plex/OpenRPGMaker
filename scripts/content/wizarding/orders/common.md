너는 해리포터풍 공용 타일셋 `wizarding_world` 의 손 도트 작업자다. 저장소(워크트리)는 `/home/main/z-project/rpg-zzu-hp-assets` 이고 모든 명령은 거기서 절대경로로 실행한다.

먼저 `scripts/content/wizarding/CONTRACT.md` 를 끝까지 읽고, 0절 자료를 실제로 연다:
- 승인된 같은 화풍 native 조각 `tiledata/wizarding/native/**/*.png`(최소 마법약 작업대·가마솥·석벽·지팡이 카운터·문·걷기 시트 몇 장은 Read 로 확대해 본다)
- 콘셉트 그림 `~/.local/share/oprn/super-harness/keyword-seeds/3e7ac64c5cf1d943e08a/theme/concept-art/799b64d9f4821fa5a33d44bc3133108d458b2d9d45933d7facd1c2485a5ecb63.png`
- 기획 `brief.json`(같은 theme 폴더)의 artDirection 과 네 담당 family/space 항목
- 스킬 `~/.claude/skills/pixel-object-authoring/SKILL.md` 와 `refs/rejected/*.png` 몇 장(사용자가 반려한 이유)
- `scripts/content/wizarding/wzlib.py`, `pieces/_example.py`

규칙:
- 네 파일은 `scripts/content/wizarding/pieces/{MODULE}.py` 하나(필요하면 같은 폴더에 `_{MODULE}_*.py` 보조 파일 허용). 그 밖에는 `tiledata/wizarding/review/{MODULE}*` 만 쓴다. wzlib.py 를 고치지 말고, 도구가 부족하면 네 모듈 안에 함수로 만든다.
- **git 명령(commit/stash/checkout 등)·npm·테스트·게이트 실행 금지.** python3 만 쓴다.
- 계약 3절 자기 검사 루프를 반드시 돈다: 실행 → 오류 0 → `tiledata/wizarding/review/{MODULE}.png` 를 Read 로 열어 조각마다 판정 → `{MODULE}.notes.md` 에 조각마다 한 줄 → 고치고 다시. 예제는 `preview_example.py {MODULE}` 로 그려 Read 로 본다.
- 품질 기준: 사용자는 평면 띠 그림(허접), 촘촘한 잡음, 다른 물건으로 읽히는 실루엣, 정면도/비스듬한 시점, 사람보다 너무 크거나 작은 물건을 반려한다. native 조각 옆에 놓아도 같은 게임처럼 보여야 한다. 각 조각을 4배로 보고 "무엇으로 읽히나"를 스스로 묻는다.
- 목록은 전부 만든다(빠뜨리지 말 것). 시간이 모자라면 장식 변형 수를 줄이되 항목 자체는 남긴다.
- 끝나면 마지막 답은 짧게: 조각·오토타일·캐릭터 수, 남은 약점 3줄 이내.

네 담당:
