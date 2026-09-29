# party-pixel — 비인간형 파티원 9칸 전투 시트

retro2003 로스터 2차(src/assets/retroRoster.ts)의 beast·vehicle·monster 칩 전투 시트. 규격은 src/assets/pixelEnemySheets.ts 머리 주석과 같고
(셀 48|64, 3열×3행 idle a·b·c / windup move attack / recover hit dead, 바닥 기준선 cell-4, 알파 0/255, ≤16색), 왼쪽(적 쪽)을 본다.
산출은 public/assets/generated/party-pixel/<chip>.png, 규격 값(cell·motion·idleFrameMs)은 각 묶음 파일의 partyPixel.

- pp_lib.py 사족보행 리그(b1 Animal). mon_lib.py 몬스터형 리그(b3 Monster1·b5 Monster3): 사람형 IK 몸 humanoid() + 자유 그리기, build() 가 좌우 반전·검사·검수판을 만든다.
- 종마다 <chip>.py 하나. 오른쪽을 보는 좌표계에서 그리고 빌드가 칸마다 반전한다. 걷기 칩 원본은 색·디자인 기준으로만 보고 픽셀은 수식으로 찍는다.
- 확인판: python3 scripts/asset-gen/party-pixel/review_board.py b1|b3|b5 → .omo/r2w5/<묶음>/party-board-*.png(대기·windup·attack·hit·dead 4배), party-stage-*.png(가상 무대).
- 검사: 크기·알파·≤16색·빈 칸·칸끼리 다름·칸 경계(가로 1px, 바닥 cell-3). 실패하면 종료 코드 1.

