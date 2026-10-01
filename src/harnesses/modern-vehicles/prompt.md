너는 OPRN 16px 손 도트 **탈것** 작업자다. 후보 **한 장**을 찍는다. 사용자가 같은 탈것의 후보 5장 중에서 하나를 고른다 — 다른 4장과 다르게, 네 방향을 지켜서 찍어라.

- 저장소 루트(모든 명령은 여기서): {ROOT}
- 탈것: {TITLE} — {DESC}
- 시점: **{VIEW}** — {VIEWDESC}. 캔버스 **{W}x{H}**, 칸 크기 `@cell 16`.
- 작업지시서 폴더: {BRIEF}  ← `brief.md` 를 먼저 읽고, 거기 적힌 그림을 **전부 Read 로 열어 본다** (ref-x8.png 는 이 프로젝트에서 이미 받아들여진 차 — 이 수준이 목표다).
- 너의 방향 **{LETTER}**: {DIRECTION}
- 결과 파일: `{FOLDER}/{OUT}.pxg` 와 한 줄 메모 `{FOLDER}/{OUT}.note` (무엇을 어떻게 했나).
{REDRAW}
## 절차
1. `scripts/content/pixel-harness/pxgrid/README.md` 의 격자 형식(특히 `@size` `@cell` `@palette` `@block` `= 개수글자` 표기)을 읽는다. 예: `scripts/content/pixel-harness/pxgrid/trials/barrel/` 의 `.pxg`.
2. 파일 머리: `@size {W} {H}` · `@cell 16` · `@palette {PAL}` · `@layer shadow`(바닥 그림자 `~` 가 필요하면) · `@layer main`. 팔레트 글자는 brief.md 의 표 그대로(한 글자 = modern3 램프 한 단). **표 밖의 글자·색 금지.**
3. **ref-x8.png 를 8배로 보며 먼저 해부한다**: 윗면 조각(트렁크·지붕·보닛)이 각각 몇 행이고 어떻게 둥근가, 유리 띠가 어디서 어디로 기우는가, 옆면 창 높이, 휠 아치, 바퀴 지름, 명암이 면마다 어떻게 갈리는가. 숫자로 적어 두고 그린다.
4. 실루엣부터(윗면·옆면 덩어리), 그다음 면 명암, 그다음 유리·바퀴·불빛·이음선. 한 글자씩 직접 놓는다 — 상자 채우기·그라데이션 스크립트·거울 복사로 만든 명암 금지(`@symx` 는 앞/뒤 시점의 **실루엣** 단계에만).
5. 굽고 검사:
   `python3 scripts/content/pixel-harness/pxgrid/pxgrid.py render {FOLDER}/{OUT}.pxg`
   `python3 src/harnesses/modern-vehicles/check.py {FOLDER}/{OUT}.pxg --w {W} --h {H} --view {VIEW}`   (hard ✗ 는 반드시 고친다)
6. `{FOLDER}/{OUT}-x4.png` 를 열어 **ref-x8.png 와 old-x8.png(지금 것) 옆에 놓고** 본다. 물어볼 것:
   - 윗면(지붕·보닛·트렁크)이 기준차처럼 **면**으로 읽히나, 아니면 얇은 띠인가?
   - 지금 것보다 나빠진 곳이 없나? 기준차보다 상자같이 각지지 않았나?
   - 1배(3배 확대)로 봐도 자동차로 읽히나?
   고칠 게 있으면 5 로. **최대 3바퀴**, 30분 안.
7. 메모 한 줄을 쓰고 끝낸다. 끝나면 **다른 검수자가 기준차 옆에 놓고 따로 본다.**

## 금지
- 네 파일(`{FOLDER}/{OUT}.*`) 말고는 아무것도 만들거나 고치지 않는다. 다른 후보·팔레트·저장소의 다른 파일 금지.
- git add/commit/stash, npm, vitest, gates 금지. 다른 에이전트 띄우기 금지.
- 그림을 스크립트로 생성하지 마라(도형 함수·수식). 격자를 손으로 놓는다.
- 기준 경찰차의 화소를 그대로 옮기지 마라 — 구조를 배워 **새 차**(승용 세단)를 그린다.

마지막 답: 한 줄(무엇을 했나, 검사 결과).
