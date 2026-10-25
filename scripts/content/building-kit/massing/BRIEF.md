# 덩어리 모형 → 실제 건물 손 도트 (building-kit massing)

저장소(작업 트리): `/home/main/z-project/rpg-zzu-building-kit` — 모든 명령은 여기서. 테스트·gates·git stash 금지. git commit 하지 않는다(감독이 한다).

## 무엇을
`harness-data/building-kit/massing/seed.json` 의 건물(id·이름·덩어리 모형 번호 `massing`·목표 크기 `size`[칸 가로, 세로]·`brief`·`refs`)을
버들항(beodeul_city) 화풍의 16px 3/4 탑뷰 손 도트 건물로 그린다. 결과는 **데이터 두 파일**:
- `harness-data/building-kit/massing/art/<id>.txt` — 글자 하나 = 화소 하나, `.` 투명. 글자 → 색 = `harness-data/building-kit/massing/palette.json` (`legend`, 램프 `ramps`; 견본 `palette.png`).
- `harness-data/building-kit/massing/art/<id>.json` — `{"id","name","massing","material","refs":[버들항 키트 둘],"walk":[칸 행 문자열…], "passages"?:[[x,y]…]}`
  - `walk` 글자: `X` 막힌 벽 칸 · `D` 문 칸(정확히 하나의 문: 한 열, 세로 1~2칸, 아랫칸은 그림 맨 아래 칸 줄) · `*` 사람 뒤로 지나가는 칸(지붕·처마·탑 윗부분 — 그림이 사람 위) · `.` 빈 칸.
  - 땅에 닿는 칸(열마다 가장 아래 그림 칸)은 `X` 또는 `D`. 지나갈 수 있는 통로 바닥(성문 아치·시장홀 기둥 사이)만 `*` 로 두고 `passages` 에 그 칸을 적는다.

## 도구 (`src/harnesses/building-kit/massing_lib.py`)
```python
import sys; sys.path.insert(0, 'src/harnesses/building-kit')
from massing_lib import Canvas, P, RAMPS, kit_part, kit_items, kit_building, load
c = Canvas(9, 8)                     # 칸 단위
rows, fails = kit_building(recipe)   # building-kit 부품 문법(질량 ridge_side/gable_front/lean_to, 깊이 땅)으로 줄 A 부품 조립 바탕
c.paste(rows, x, y)                  # 글자 행 붙이기('.' 건너뜀)
c.rows(x, y, ['ab..c'])              # 행 문자열 찍기
c.tile(x, y, w, h, motif)            # 손으로 그린 motif 반복
c.save('<id>', meta)                 # art 두 파일 + check + 미리보기
```
- `kit_items()` 로 부품 세트·조각(roof.hip, roof.gf.slope, gable.front, gable.step, roof.gf.back, roof.gf.valley, roof.lean.side, roof.spire, wall.timber, wall.stone, wall.storey, band.trim, extra.chimney)을 본다. `kit_part(item, role)` = 그 조각 글자 행.
  레시피 예: `harness-data/building-kit/fantasy-kingdom/seed.json` 의 `buildings` 중 `thouse.r7`·`cottage.r7`·`hall.r7`·`inn.r4`·`bellhouse.r4`.
  **부품 문법은 바탕이다** — 조립한 바탕은 16px 마다 같은 도장이 반복되고 면이 평평하다(사용자: 「버들항 수준은 아니다」). 바탕 위를 손으로 마감한다:
  기와 낱장마다 모양·밝기 변화, 빛 받는 모임 사선 밝은 선, 회벽 고운 점묘, 불규칙한 막돌, 창턱·꽃상자·하늘색 유리 반짝임, 아치 문·징·걸린 간판(글자 없음), 풍화·이끼.
  부품 문법에 없는 덩어리(원통 탑·원뿔/첨탑·총안·아치 아케이드·돔 화덕·풍차 날개)는 같은 재질·명암 규칙으로 직접 그린다.
- 미리보기: `python3 src/harnesses/building-kit/massing.py render <id>` → `qa-runs/harnesses/building-kit/massing/preview/<id>-cmp.png`(덩어리 모형 | 새 그림 3배 | 버들항 기준 3배 둘) · `<id>-1x-cmp.png`(1배 나란히) · `<id>-4x.png`.
  검사: `python3 src/harnesses/building-kit/massing.py check <id>`(FAIL 0 이어야 한다. 통과는 합격이 아니다).
- 그리기 스크립트는 `scripts/content/building-kit/massing/work/<id>/draw.py` 에 둔다(다시 돌리면 같은 그림). `random` 모듈·잡음 함수 금지.

## 기준 (반드시 Read 로 본다)
- 품질 기준 = 버들항: `qa-runs/harnesses/building-kit/massing/beodeul/gallery-2x.png`(2배 묶음) 과 같은 폴더의 키트 1배 PNG(`bd-house-inn.png` 등). **같은 배율로 나란히 놓아 같은 게임으로 보여야 한다.** 화소를 베끼지 않는다 — 눈으로 보고 같은 결로 그린다.
- 구조 기준 = 덩어리 모형: `harness-data/building-kit/massing/refs/<massing>.png`(2배 렌더, 질감 없음 — 질량·지붕 짜임·탑 위치만 따른다. 오른쪽 큰 그림자는 그리지 않는다) · `<massing>-plan.png`(위에서 본 윤곽).
- 부품 문법 + 마감의 앞선 결과: `qa-runs/harnesses/building-kit/_finish-demo.png`(왼쪽 바탕 → 가운데 조립 → 오른쪽 마감).
- 팔레트 견본: `harness-data/building-kit/massing/palette.png`.

## 3/4 탑뷰 규칙 (관문이 본다 — object-gate kind structure, 독립 검수자 둘)
1. 지붕 윗면이 면으로 크게 보인다(1층 건물은 높이의 40~55%, 박공 정면 질량은 지붕이 실루엣 대부분). 지붕이 얇은 띠인 정면 입면도는 불합격.
2. 남쪽 정면만 보인다. 옆벽·아이소 시점 금지(원통은 둥근 앞면 + 위 원뿔/흉벽 윗면).
3. 박공 정면: 삼각벽이 남쪽, 용마루는 북쪽으로 물러나 세로선, 왼쪽 사면 밝고 오른쪽 어둡다. 모임지붕: 처마 모서리→짧은 용마루로 모임 사선.
4. 날개·탑은 본채와 한 채로 붙는다(사이에 땅 없음). 깊이: 물러난 질량은 화면에서 더 높이 선다.
5. 총안·탑 꼭대기는 윗면(걷는 바닥·흉벽 안쪽)이 보이게.
6. 빛 왼쪽 위. 바깥 윤곽은 재질 어두운 단(검은 먹선 금지). 벽은 땅에 바로 닿고 기초는 1~3px 어두운 돌.
7. 문 하나. 사람·글자·상표 금지. 크기는 Actor1(24×32)과 맞게: 문 높이 ≈ 24~32px, 층 높이 ≈ 32px.

## 끝내기 전에
각 건물: check FAIL 0 → `-cmp.png` 와 `-1x-cmp.png` 를 Read 로 보고 버들항 옆에서 어색한 곳(평평한 면, 반복 도장, 지붕 두께, 접지, 색 튐)을 고친다. 최소 3번 고쳐 본다.
마지막 보고: 건물마다 크기·스스로 본 약점 한 줄. 판정·합격 여부는 쓰지 않는다(검수자가 한다).

## 앞선 판에서 배운 것 (감독 메모)
- 정면과 나란한 용마루 지붕을 덩어리 모형처럼 네모 판으로만 그리면 1배에서 납작한 주황 판으로 읽힌다. 버들항 여관처럼 양 끝을 모임 사선(밝은 왼쪽 사선·어두운 오른쪽 사선)으로 닫거나, 박공 끝이면 끝벽 삼각 그늘을 보이게 한다.
- 지붕 아래쪽이 보라빛으로 너무 어두워지지 않게 — 버들항 지붕은 중간 테라코타가 주이고 어두운 단은 기와 줄 그늘에만.
- 막돌은 버들항처럼 작고 촘촘한 연보라·회색 돌(2~4px)로.
- 같은 판에서 잘 된 예: preview/cottage-cmp.png, preview/inn-cmp.png (구조·디테일 밀도 참고).
- 독립 검수자가 떨어뜨린 이유(피할 것): ① 붙은 부분 사이 1px 투명·잔디 틈(날개·별채·탑은 본체와 화소를 맞댄다) ② 정면과 나란한 지붕을 끝이 수직인 네모 판으로 ③ 큰 지붕에 16px 도장 반복(같은 하이라이트 격자) ④ 두 지붕이 만나는 곳에 골·용마루 이음이 없다 ⑤ 벽 속 밝은 세로 줄이 구멍처럼 보인다 ⑥ 흉벽·총안 윗면이 3px 선뿐(5~6px 이상 바닥이 보여야) ⑦ 크고 평평한 어두운 칠.
- 외쪽 지붕(lean-to)을 옆으로 기우는 면(동쪽으로 내려가는 세로 기와 줄)으로 그리면 검수자가 「옆면·따로 노는 판」으로 떨어뜨린다. 붙임채 지붕도 **남쪽(앞)으로 내려가는 사면**이 보이게: 위쪽이 본채 벽에 붙고 처마가 앞쪽 아래, 기와 줄은 가로. 끝은 모임 사선이나 박공 삼각 그늘로 닫고 화폭 끝에서 잘리지 않게 한다. 열린 작업칸·마구간 앞은 어두운 빈 칸이 아니라 안쪽 벽·기둥 그림자·물건으로 채운다. 허공에 매달린 밧줄·자루 금지.
- (2차 감독 메모, argon 검수 원문에서) argon 이 반복해 떨어뜨린 것: ⑧ 바깥 윤곽 전부(용마루 꼭대기·굴뚝 머리·1층 벽 좌우 끝)에 재질 어두운 단 테두리 — 밝은 돌이 잔디에 바로 닿으면 FAIL ⑨ 굴뚝 머리는 위에서 본 윗면(어두운 연기 구멍 + 둘레 갓돌)이 보여야 — 납작한 띠 FAIL ⑩ 박공 처마 아래 모서리의 1~2px 투명 구멍(핀홀) — 처마 끝 화소를 벽과 이어 막는다 ⑪ 반쪽 가새·가로대에 닿지 않고 끝나는 나무 — 가새는 기둥/보에서 보로 이어지게 ⑫ 걸린 간판은 벽에서 나온 쇠 받침대에 매달고 테두리 ⑬ 2층 창은 반목조 기둥 사이에 끼워 넣는다(넓은 회벽 칸 가운데 떠 있는 창 금지) ⑭ 흉벽·총안은 윗면(걷는 바닥) 보이게 ⑮ 원뿔 기와는 꼭대기로 좁아지는 비늘. 끝내기 전 `python3 -c` 로 그림 안쪽 투명 화소(위·아래·좌·우가 그림으로 막힌 .)를 세어 0 인지 본다.
- (3차 감독 메모, argon p7) ⑯ 굴뚝: 머리 윗면(갓돌 고리 + 어두운 연기 구멍)이 보이고, 지붕과 만나는 밑동은 지붕 경사를 따라 비스듬히 — 가로 띠 받침(collar) 금지. 굴뚝 돌은 벽돌 격자 반복 말고 막돌 ⑰ 같은 창·같은 칸을 그대로 복사하지 않는다: 창마다 덧문·커튼·꽃상자·반짝임·창턱 길이를 다르게, 층마다 돌 무늬도 다르게 ⑱ 지붕 기와는 격자 도장이 아니라 줄마다 어긋나고 낱장마다 밝기 다른 손 기와(작게: 버들항 기와 크기) ⑲ 원통 탑: 왼쪽 밝음 → 오른쪽 어두움 세로 명암 단계, 원뿔은 작은 비늘이 꼭대기로 좁아짐 ⑳ 통(barrel) 같은 원통 소품은 위 타원 윗면이 보이게 ㉑ 창턱·간판·도구는 잘리거나 반쯤 끝나지 않게, 1배에서 읽히지 않는 회색 덩어리 금지.
- (4차 감독 메모, argon p8) ㉒ 남북 박공(삼각벽이 남쪽)의 좌우 지붕 사면: 기와 줄은 그 사면의 처마와 나란히(사면을 따라 비스듬히/위아래로) — 남향 가로 기와 줄을 동서 사면에 붙이면 FAIL. 버들항 박공 기준 그림의 사면을 보고 같은 방향으로 ㉓ 용마루에 굵은 세로 나무판 금지(얇은 용마루 기와) ㉔ 지붕창(dormer)은 작은 3/4 지붕 윗면이 보이게, 두 개면 서로 다르게 ㉕ 회벽은 평평한 베이지 금지 — 버들항처럼 촘촘한 점묘 2~3단 ㉖ 옥상 상자·소품도 윗면 ㉗ 같은 굴뚝 둘 금지.
- (5차) ㉘ 맨 아래 줄 몇 화소가 벽과 1px 투명 줄로 떨어져 있으면 argon 이 「바닥 틈」으로 FAIL — 기초 줄은 벽에 붙인다. 꼭대기 장식(피니얼)도 지붕 꼭짓점에 닿게. `massing.py check` 가 이제 바닥 근처 가로 틈을 FAIL, 갇힌 투명 구멍을 경고로 알려 준다. ㉙ 공용 도우미를 고쳐 다른 건물을 다시 그리지 말 것(검수가 무효가 된다) — 맡은 id 만.
- (6차, 2026-10-25 재도전) ㉚ **남북 박공 지붕 규약 하나 = 버들항 `bd-house-h124_0`** (`qa-runs/harnesses/building-kit/massing/beodeul/bd-house-h124_0.png`). 앞(남) 박공 삼각벽 뒤로 지붕이 오각형 실루엣으로 화면 위로 물러나 꼭짓점에서 닫힌다. 기와는 용마루와 나란한 **세로 열**(줄무늬) — 왼쪽 사면은 밝은 세로 열, 오른쪽 사면은 어두운 세로 열, 가운데 용마루는 세로 선, 처마 끝은 비스듬한 어두운 테. 가로 기와 줄·두 겹 계단 박공 금지. 계단 박공(길드 회관·창고)은 앞 박공만 계단으로 하고 지붕은 이 규약 그대로. json `refs` 첫째를 `bd-house-h124_0` 으로 둬서 검수판에 같이 나오게 한다.
- ㉛ 그리기 스크립트는 이제 커밋된다: `scripts/content/building-kit/massing/work/<id>/draw.py`. 고친 뒤 `python3 scripts/content/building-kit/massing/regen.py <id> --check` 가 아니라 `regen.py <id>` 로 다시 쓰고, 맡지 않은 id 의 그림은 바꾸지 않는다(다른 id 도우미를 고치면 `regen.py --check` 로 나머지가 그대로인지 확인).
- (7차, 2026-10-25 이미 들어간 27채 적대 VQA) 원문: `/home/main/z-project/rpg-zzu/qa-runs/bk-vqa/argon-review.md`(건물별 절 `### #NN id`), `sonnet-review.md`(표 + 「Beodeul same-zoom comparison」 정정 절). 이번 판은 거기 MAJOR/FAIL 이유를 고친다. 두 판 안에 못 고치면 번들에서 뺀다.
  ㉜ **덩어리 모형을 지킨다**: 모형에 있는 탑·안뜰(ㄷ자)·십자 날개·트인 아케이드·첨탑·큐폴라를 지우거나 막지 않는다. 모형에 없는 별채를 붙이지 않는다.
  ㉝ **청기와(슬레이트) 지붕 = 버들항 파랑**: 모형이 파랑·회색 지붕이면 버들항 `bd-house-manor`·`bd-house-cathedral`·`bd-house-barracks`(`qa-runs/harnesses/building-kit/massing/beodeul/`)의 지붕 색 분포를 그대로 따른다(밝은 단·중간 단 비율까지 비교). 적갈색·포화 보라·무채 회색 금지. 벽은 버들항 흰 돌(따뜻한 흰 회색 + 연보라 줄눈).
  ㉞ **층 높이**: 한 층 ≈ 26~32px, 문 ≈ 22~28px. 세 줄 창을 다섯 칸에 넣지 않는다.
  ㉟ **같은 8×8 조각 복사 금지**: 다른 건물과 같은 패치(지붕·벽 도장)를 쓰지 않는다. 공용 도우미 결과를 그대로 붙이지 말고 건물마다 색·창·무늬를 다르게.
  ㊱ **walk**: `massing.py check` 가 이제 passages·벽 아래 `*`·벽 줄 홈을 막는다. D 는 그린 문 위에 정확히(문이 두 칸에 걸치게 그리지 않는다).
