# party-pixel — 비인간형 파티원 9칸 전투 시트

retro2003 로스터 2차(src/assets/retroRoster.ts)의 beast·vehicle·monster 칩 전투 시트. 규격은 src/assets/pixelEnemySheets.ts 머리 주석과 같고
(셀 48|64, 3열×3행 idle a·b·c / windup move attack / recover hit dead, 바닥 기준선 cell-4, 알파 0/255, ≤16색), 왼쪽(적 쪽)을 본다.
산출은 public/assets/generated/party-pixel/<chip>.png, 규격 값(cell·motion·idleFrameMs)은 각 묶음 파일의 partyPixel.

- pp_lib.py 사족보행 리그(b1 Animal). mon_lib.py 몬스터형 리그(b3 Monster1·b5 Monster3): 사람형 IK 몸 humanoid() + 자유 그리기, build() 가 좌우 반전·검사·검수판을 만든다.
- 종마다 <chip>.py 하나. 오른쪽을 보는 좌표계에서 그리고 빌드가 칸마다 반전한다. 걷기 칩 원본은 색·디자인 기준으로만 보고 픽셀은 수식으로 찍는다.
- 확인판: python3 scripts/asset-gen/party-pixel/review_board.py b1|b3|b5 → .omo/r2w5/<묶음>/party-board-*.png(대기·windup·attack·hit·dead 4배), party-stage-*.png(가상 무대).
- 검사: 크기·알파·≤16색·빈 칸·칸끼리 다름·칸 경계(가로 1px, 바닥 cell-3). 실패하면 종료 코드 1.


## b4 Monster2 15칸 재작업 (pp4, 2026-09-29)

- 빌더 pp15_pp4.py, 칩 파일 monster2-0..7.py. 셀 64·3열×5행(행 3 시전 3단, 행 4 도약·강화·필살기), 그림이 처음부터 왼쪽을 본다(반전 없음).
- Monster2 칩의 행 순서는 RM2k 관례(0 위 · 1 오른쪽 · 2 아래 · 3 왼쪽)다. 대기 칸 밑그림은 행 3 가운데 칸을 ≤13색으로 합친 뒤 EPX 2배로 키운 것이고,
  2배로 두꺼워진 외곽선 안쪽 절반을 안쪽 색으로 되돌려 1px 외곽선을 만든다. 칩 × 2 보다 키우지 않는다(8명 모두 몸 높이 23~29px → 셀 64).
- 나머지 칸은 칩에서 오린 부위(팔·날개·꼬리·머리·칼)를 관절 축으로 돌리고 몸은 행 밀기(기울임·호흡·웅크림)로만 바꾼다. 효과(칼날·기·불길·먼지)는 캐릭터별 효과색 3색.
- 확인판: .omo/pp4/board-a-*.png(칩 4배·8배 | 15칸 4배), .omo/pp4/board-b-size.png(actor1-0 과 대기 칸 같은 배율), 검사는 각 칩 파일 실행 출력과 .omo/pp4/<chip>/validation.json.

