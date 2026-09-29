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

## 2026-09-29 b3 재작업(pp15_pp2.py) — 15칸, 칩 2배 밑그림

- monster1-0~3(슬라임·붉은 악마·꼬마 오거·유령)은 `pp15_pp2.py` 가 그린다. 종 파일 `monster1-<n>.py` 는 그 빌더를 부르는 얇은 진입점.
- 밑그림 = 걷기 칩 Monster1.png 의 **행 3(왼쪽 보기) 가운데 칸**(칩 행: 0 위·1 오른쪽·2 아래·3 왼쪽). 외곽선을 벗기고 Scale2x 로 정수 2배 → 부위(머리·몸·팔·다리) 층을 돌리고 옮김 → 새 1px 외곽선 → 왼쪽 위 빛 한 단계. 반전하지 않는다.
- 셀: 슬라임 48(칩 13×9 → 26×18). 악마 52px·오거 44px·유령 40px+부유 4px 는 칩 × 2 가 48 에 안 들어가 64.
- 오거 칩은 49색이라 칩에서 고른 15색(OGRE_PAL)으로 옮긴 뒤 2배. 삼지창·몽둥이·불덩이·바위는 칩에 없어 스킬 칸에만 수식으로 그린다.
- 검사는 빌드마다: 크기 (cell·3)×(cell·5), 알파 0/255, ≤16색, 빈 칸·같은 칸, 바닥선 cell−4(공중 칸 제외), 칸 경계 1px, 외톨이 픽셀.
- 확인판: `python3 scripts/asset-gen/party-pixel/pp15_pp2.py board` → `.omo/pp2/board-<chip>.png`(칩 4배 | 15칸 4배), `size-compare.png`(actor1-0 과 대기 칸 같은 배율).
- 주의: 사람 전투 시트(charset-battlers)는 칩 **1배**(몸 24px)다. 칩 2배 규칙을 따르면 화면에서 b3 몬스터가 사람 아군의 약 2배 키로 선다.

## b3 재작업 4명(monster1-4 해골병 · 1-5 좀비 · 1-6 사신 · 1-7 수인 전사) — 15칸, 칩 비율 유지 (2026-09-29)

- 리그 pp15_pp3.py: 걷기 칩 왼쪽 보기 가운데 칸(행 3·열 1 — Monster1.png 칩 블록의 행은 0 위·1 오른쪽·2 아래·3 왼쪽)을
  캐릭터 팔레트(≤16색)로 줄이고 Scale2x 로 정수 2배. 부위(머리·팔·다리…)를 칩 좌표 사각형으로 잘라 관절 기준 이동·회전·가로 기울임(lean)만 한다.
  회전 부위는 Scale2x 8배 표본(RotSprite 식)으로 계단을 줄인다. 합성 뒤 왼쪽 위 밝은 한 단·오른쪽 아래 그늘 한 단·1px 외곽선.
  대기 칸 = 칩 × 2 그대로라 원래 칩과 같은 실루엣이다. 그림은 처음부터 왼쪽을 본다(반전 없음).
- 셀: 칩 키 × 2 + 외곽선이 48 안에 드는 해골병만 48, 좀비(칩 25px)·사신(24px, 떠 있음)·수인(30px)은 64.
- 무기(해골병 뼈 몽둥이·사신 낫·수인 도끼)와 효과는 수식으로 찍는다. 사신은 dead 만 바닥, 나머지 칸은 hover 높이.
- 생성: python3 scripts/asset-gen/party-pixel/monster1-{4..7}.py → 시트 + .omo/pp3/board-<chip>.png(칩 4배·칩 2배 옆 15칸 4배).
  검사·크기 비교판: python3 scripts/asset-gen/party-pixel/review_pp3.py → .omo/pp3/size-compare.png(대기 칸 4배 + 사람 actor1-0).
- 주의: 사람 전투 도트(charset-battlers)는 칩 × 1(키 23px)을 48 칸에 담고, 파티원 시트도 cell × 2 상자로 뜬다.
  그래서 칩 × 2 규칙의 몬스터 파티원은 무대에서 사람 파티원보다 약 2배 크다. 규칙을 바꾸면 리그의 scale2x 한 번만 빼면 된다.
