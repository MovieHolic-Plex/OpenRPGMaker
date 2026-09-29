# party-pixel — 비인간형 파티원 9칸 전투 시트

retro2003 로스터 2차(src/assets/retroRoster.ts)의 beast·vehicle·monster 칩 전투 시트. 규격은 src/assets/pixelEnemySheets.ts 머리 주석과 같고
(셀 48|64, 3열×3행 idle a·b·c / windup move attack / recover hit dead, 바닥 기준선 cell-4, 알파 0/255, ≤16색), 왼쪽(적 쪽)을 본다.
산출은 public/assets/generated/party-pixel/<chip>.png, 규격 값(cell·motion·idleFrameMs)은 각 묶음 파일의 partyPixel.

- pp_lib.py 사족보행 리그(b1 Animal). mon_lib.py 몬스터형 리그(b3 Monster1·b5 Monster3): 사람형 IK 몸 humanoid() + 자유 그리기, build() 가 좌우 반전·검사·검수판을 만든다.
- 종마다 <chip>.py 하나. 오른쪽을 보는 좌표계에서 그리고 빌드가 칸마다 반전한다. 걷기 칩 원본은 색·디자인 기준으로만 보고 픽셀은 수식으로 찍는다.
- 확인판: python3 scripts/asset-gen/party-pixel/review_board.py b1|b3|b5 → .omo/r2w5/<묶음>/party-board-*.png(대기·windup·attack·hit·dead 4배), party-stage-*.png(가상 무대).
- 검사: 크기·알파·≤16색·빈 칸·칸끼리 다름·칸 경계(가로 1px, 바닥 cell-3). 실패하면 종료 코드 1.

## pp1 재작업(2026-09-29): b1 Animal 8 → 15칸, 칩 비율 유지

- 빌더 `pp15_pp1.py`(b1 전용): Animal.png 왼쪽 보기(방향 행 3 — 이 칩셋은 0 위·1 오른쪽·2 아래·3 왼쪽) 가운데 칸 24×32 를 Scale2x 로 2배 밑그림을 만든다.
  실루엣 외곽선 1px, 위·아래 안쪽 한 줄에 칩 팔레트 안의 한 단계 빛·그늘. 칩 1배 좌표 사각형으로 머리·몸·앞다리·뒷다리·꼬리(수탉은 다리·날개)를 갈라 자세표대로 돌린다.
  색은 칩 원본 색만 쓴다(≤16). 셀 48 = 개·고양이·수탉·양, 64 = 젖소·말·호랑이·사자, 모두 칩 × 2 그대로.
- 종 파일 `animal-<i>.py` 는 부위 사각형·중심점·눈·입 자리만 적는다. 실행하면 시트 + 검사 줄 + `.omo/pp1/board-<칩>.png`(칩 4배·8배 옆 15칸).
- 크기 비교판: `python3 -c "import sys;sys.path.insert(0,'scripts/asset-gen/party-pixel');import pp15_pp1 as L;L.board_lineup([('animal-%d'%i,48 if i<4 else 64) for i in range(8)])"` → `.omo/pp1/lineup.png`.
- `review_board.py` 는 3×3 시트 전제라 b1 15칸 시트에는 맞지 않는다.
