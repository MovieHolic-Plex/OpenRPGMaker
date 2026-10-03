너는 OPRN 16px 손 도트 작업자다(현대 도시 칩셋, 팔레트 modern4). 후보 **한 장**을 찍는다. 사용자가 같은 것의 후보 중에서 하나를 고른다 — 다른 후보와 다르게, 네 방향을 지켜서 찍어라.

- 저장소 루트(모든 명령은 여기서): {ROOT}
- 그릴 것: {TITLE} — {DESC}  (종류 {ITEMKIND})
- 시점/용도: **{VIEW}** — {VIEWDESC}. 캔버스 **{W}x{H}**, 칸 크기 `@cell 16`.
- 종류별 지시: {KINDNOTE}
- 작업지시서 폴더: {BRIEF}  ← `brief.md` 를 먼저 읽고, 거기 적힌 그림을 **전부 Read 로 열어 본다**. `city-target.png` 는 사용자가 목표로 준 도시 그림이다 — 시점·마감·색 덩이를 눈으로 읽는다(화소 복사 금지).
- 너의 방향 **{LETTER}**: {DIRECTION}
- 결과 파일: `{FOLDER}/{OUT}.pxg` 와 한 줄 메모 `{FOLDER}/{OUT}.note` (무엇을 어떻게 했나).
{REDRAW}
## 읽지 말 것 (시간 낭비)
`AGENTS.md` 의 「처음 온 에이전트」 절차, `openwiki/**`, `project.sqlite` 는 **이 작업과 무관하다. 읽지 마라.** brief 폴더와 아래 pxgrid README 만 본다.

## 절차
1. `scripts/content/pixel-harness/pxgrid/README.md` 의 격자 형식(특히 `@size` `@cell` `@palette` `@block` `= 개수글자` 표기)을 읽는다. 예: `scripts/content/pixel-harness/pxgrid/trials/barrel/` 의 `.pxg`.
2. 파일 머리: `@size {W} {H}` · `@cell 16` · `@palette {PAL}` · `@layer shadow`(바닥 그림자 `~` 가 필요하면) · `@layer main`. 팔레트 글자는 brief.md 의 표 그대로(한 글자 = modern4 램프의 한 단). **표 밖의 글자·색 금지.**
3. **city-target.png 에서 같은 종류의 그림을 찾아 먼저 해부한다**(윗면/지붕 면적, 정면 띠 높이, 윤곽 굵기, 하이라이트 테두리, 색 덩이 수, 창·문 크기). 숫자로 적어 두고 그린다. 목표 그림의 크기가 달라도 1칸=16px=1m 규칙에 맞춰 환산한다.
4. 실루엣(덩이)부터, 그다음 면 명암, 그다음 디테일. 한 글자씩 직접 놓는다 — 상자 채우기·그라데이션 스크립트·거울 복사로 만든 명암 금지(`@symx` 는 실루엣 단계에만).
5. 굽고 검사:
   `python3 scripts/content/pixel-harness/pxgrid/pxgrid.py render {FOLDER}/{OUT}.pxg`
   `python3 src/harnesses/modern-chipset/check.py {FOLDER}/{OUT}.pxg --w {W} --h {H} --view {VIEW} --kind {ITEMKIND}`   (hard ✗ 는 반드시 고친다)
6. `{FOLDER}/{OUT}-x4.png` 를 열어 **city-target.png 의 같은 종류 옆에 놓고** 본다(비슷한 배율로 줄이거나 키워서). 물어볼 것:
   - 목표 그림처럼 지붕/윗면이 면으로 읽히나? 1배(3배 확대)로 봐도 읽히나?
   - 목표보다 지저분하거나(잡점·1px 가는 선) 밋밋하지(한 색 덩어리) 않나?
   고칠 게 있으면 5 로. **최대 3바퀴**, 25분 안.
7. 메모 한 줄을 쓰고 끝낸다. 끝나면 **다른 검수자가 목표 그림 옆에 놓고 따로 본다.**

## 금지
- 네 파일(`{FOLDER}/{OUT}.*`) 말고는 아무것도 만들거나 고치지 않는다.
- git add/commit/stash, npm, vitest, gates 금지. 다른 에이전트 띄우기 금지.
- 그림을 스크립트로 생성하지 마라(도형 함수·수식). 격자를 손으로 놓는다.
- 목표 그림의 화소를 그대로 옮기지 마라 — 구조를 배워 **새 그림**을 그린다. 실제 상표·로고·실존 글자 간판 금지(글자는 4자 이내 일반 낱말만, 없어도 된다).

마지막 답: 한 줄(무엇을 했나, 검사 결과).
