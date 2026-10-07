# 타일셋 구현 하네스 (`tileset-authoring`)

2026-10-02. 버들항(`beodeul_city`)을 만든 순서를 테마에 상관없이 되풀이할 수 있게 묶은 것. 그리기는 테마별 레시피가, 하네스는
**계약·검사·번호 등록부·굽기·배선·검증**을 맡는다. 생성 이미지는 쓰지 않는다 — 모든 픽셀을 좌표로 찍는다(사용자 결정 2026-09-30).

## 위치

| 무엇 | 경로 |
|---|---|
| 매니페스트 | `src/harnesses/tileset-authoring/harness.ts` (레지스트리 `src/harnesses/_core/registry.ts`) |
| 단계 실행기 | `src/harnesses/tileset-authoring/harness.py` (`node/cli.ts` 가 넘긴다) |
| 도트·오토타일 도구 | `src/harnesses/tileset-authoring/lib/px.py` |
| 테마 레시피 | `src/harnesses/tileset-authoring/recipes/<테마>.py` (+ `_demo.py` 로 작은 맵 그림) |
| 테마 계약(시드) | `harness-data/tileset-authoring/<테마>/seed.json` |
| 후보 산출물 | `qa-runs/harnesses/tileset-authoring/<테마>/<run>/` — `candidate.png` `tiles.json` `demo.png` `sheet-3x.png` (gitignore) |

## 단계

`status` · `spec` · `study` · `draw`(+자동 검사) · `compare` 는 구현됨. `pick` · `bake` · `wire` · `verify` 는 사용자가 후보를 고른 뒤에 만든다(아직 없음).

## 오토타일 규약 (이 하네스가 지키는 것)

- 엔진 비트 N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128 (`src/project/defaults/autotileEngine.ts` `AUTOTILE_DIR`). `neighborhood: 8`.
- 그림은 **47변형**(대각은 두 이웃 변이 모두 이어졌을 때만 의미 — `px.canon`). `px.variant_map256` 이 원시 마스크 256개 → 칸 번호 표를 만든다.
- 가장자리 흔들림은 변 이름 + 16 주기 함수라 이웃 칸과 이어진다. `px.seam_report` 가 실제 맵에서 일어날 수 있는 모든 이웃 조합에서
  맞닿는 열·행의 안/밖 모양을 비교한다(구조만 — 질감 연속은 눈으로 본다).
- 물은 변형마다 4프레임이 한 행 안에 연속한다(`animationStrips` baseTile+frames).

## 검사가 보증하는 것 / 못 하는 것

보증: 계약 역할이 시트에 있다 · 변형 그림이 서로 다르다 · 이음새 구조가 맞다 · 불투명 색 ≤72 · 바닥 칸에 투명이 없다.
**못 한다**: 3/4 시점이 맞는지, 화풍이 한 판으로 보이는지 — 사람이 `demo.png` 를 본다. 「검사 통과」는 합격 보증이 아니다.

## 첫 테마 — `pokemon-overworld`

젠3 문법(잔디 벌판·키큰 풀·흙길·점프 턱·물가·울타리·둥근 나무·붉은 지붕 집)을 **원본 도트**로. 포켓몬 게임 그림·팔레트 샘플링 금지.
엔진에 이미 있는 `tileset.ledgeDirections`(한 방향 턱)를 턱 칸에 줄 예정(`bake` 단계).
알려진 약점(2026-10-02 첫 판): 턱 그림이 약하다, 키큰 풀이 어둡다, 지붕이 납작하다.

## 기준 팩을 닮게 만들기 (`study` → `draw` → `compare`, 2026-10-02)

「이 팩 같은 느낌의 타일셋」을 만들 때의 순서. 기준 그림은 `seed.json` 의 `reference`(시트 경로 + 구역 좌표)로 가리킨다.

- `study`: 기준 구역마다 팔레트 램프·윤곽색·1px 잡음 비율·같은 색 덩이 크기·경계 밀도·채도·빛 방향을 잰다 → `harness-data/<테마>/style.json`
  (**측정값만 저장, 픽셀은 저장하지 않는다**). `lib/study.py`.
- `draw`: 레시피(`recipes/<테마>.py`)가 모든 픽셀을 좌표로 찍는다. 질감은 16 주기(`px.clumps`·`px.voronoi`)라 이웃 칸과 이어진다.
- `compare`: 후보의 같은 역할 구역을 같은 잣대로 재서 기준과 나란히 놓는다 → `<run>/compare.html`.
  **한계**: 팔레트를 기준에서 가져오면 팔레트 항목은 당연히 100% 이고, 평균 수치는 돌 크기·나무 윤곽 같은 눈에 보이는 차이를 못 잡는다. 판단은 사람이 그림으로.

두 번째 테마 `monster-overworld`(기준 = 저장소에 번들된 Scarloxy 몬스터 수집 팩, CC BY 4.0): 덩이진 풀·바위 고리·그물 물결·3단 나무.
첫 테마 `pokemon-overworld`(젠3 평면)는 기준 없이 그린 것이라 화풍이 다르다 — 참고용으로만 남긴다.

## 관문 (gates) — 「검사 통과」가 합격이 아니던 문제의 해결 (2026-10-02)

실측: `compare` 의 평균 지표(팔레트 포함·덩이 크기·경계 밀도)는 브로콜리 같은 나무도 전부 ok 로 통과시켰다. 그래서 `draw` 가 기준 화풍·3/4 조명을
**강제**하지 못했다. 이제 `seed.json` 의 `gates` 가 구조 지표로 후보를 판정하고, 하나라도 걸리면 `draw` 가 실패(exit 1, `<run>/GATE-FAIL.txt`)해 `pick` 으로 못 간다.

- 물체(나무) 지표: 빛 반대쪽(오른쪽·아래) 가장자리의 최암 비율, 빛 쪽 가장자리의 윤곽 비율(0 이면 번진 것), 최암 중 안쪽(틈 선) 비율, 같은 톤 덩이 수·크기,
  가장자리 울퉁불퉁함, 톤 비중(L1 거리), **밝은 톤의 무게중심이 위쪽인가(3/4 조명)**. 범위는 기준 그림(양성 대조)에서 유도 → `gates.json`.
- 바닥 칸 지표: 색 수·1px 잡음·덩이 크기·경계 밀도·**이 역할 기준 색 안에 든 픽셀 ≥90%**.
- **자기 검증**: 관문마다 양성 대조(기준 그림은 통과해야 함)와 음성 대조(`recipes/controls.py` 의 옛 불합격작은 불합격해야 함)를 매번 돌린다.
  대조를 못 가르면 「관문 자체 결함」으로 실패한다 — 약한 관문이 조용히 통과시키지 못한다.
- **생성이 관문을 쓴다**: `pick_by_gate` 가 씨앗을 샘플링해 통과작만 시트에 넣는다(거절 샘플링). 못 채우면 불합격작을 섞지 않고 `draw` 가 실패한다.
- 한계(굿하트): 지표를 맞추도록 파라미터를 탐색하므로 지표에 과적합될 수 있다. 관문은 「확실한 이탈」을 막을 뿐 합격 보증이 아니고, 최종 판단은 비교판을 보는 사람이다.

## 건물 관문 — 처마·그림자·벽·창·문 (2026-10-02)

사람이 건물을 보고 「문·처마 아래 그림자·지붕·벽 색·창이 지저분하다」고 짚은 것을 **역할 좌표별 지표**로 만들었다(`lib/building.py`).
전체 평균 지표는 이 문제를 못 잡았다(벽 경계 밀도 기준 0.21 대 옛 박공 집 0.77, 창 안쪽 밝기 폭 139 대 22 처럼 역할별로 재야 갈린다).

- **역할 좌표(roles)**: `roof_ramp`·`roof_ymax`·`wall`(깨끗해야 하는 평면)·`openings`·`windows`·`doors`·`frame_zone`(+`frame_ramp`/`glass_ramp`). 기준 그림은 `seed.json` 의
  `building_roles` 에 손으로 단 사각형, 후보는 레시피가 그리면서 `roles` 인자로 내보낸다(`LM_ROLES` → `landmark_roles()`).
- **지표**: 벽 색 수·외톨이·경계 밀도 / 처마 밑 그림자 이어짐(`eave_shadow`) / 튀어나온 것 바로 아래 한 칸이 그림자색인가(`drop_shadow_miss`) /
  지붕 외톨이·경계·가로 칸막이(`roof_hband`) / 창 안쪽 색 수·밝기 폭·유리 밝기·줄무늬·턱 그림자 / 문 색 수·아치 / 틀 비중(`frame_share`).
- **음성 대조 동결**: 사람이 불합격시킨 옛 그림을 `harness-data/.../negatives/*.png`(`gable_v1`·`center_v1`·`gym_v1`·`house_v1`)로 얼려 `seed.building_negatives` 에 건다.
  관문이 옛 그림을 못 거르면 `draw` 가 「관문이 약하다」로 멈춘다 — 체육관·센터가 실제로 멈춰서 틀 비중·가로 칸막이 지표를 추가했다.
- **건물별 건너뛰기**: `building_gates.<이름>.skip` 으로 그 건물에 뜻 없는 지표를 뺀다(체육관·센터는 `door_taper`·`drop_shadow_miss`).
- **재작 규칙**(기준에서 잰 것): 벽은 크림 두 톤뿐(균열·점·목조 장식 금지) · 튀어나온 것 바로 아래 한 칸은 그림자색(`landmarks._drop_shadow` 가 일괄) ·
  창은 틀 3칸+테+유리 2×2(하늘빛 2줄+밝은 줄) · 문은 아치 틀+판자+손잡이 · 지붕 줄눈은 자기 톤보다 한 단 어둡게.
- **한계**: 센터 관문은 거르는 항목이 적다(벽 색 수·칸막이·분홍 비중). 문 아치의 맵시·지붕 비늘 결·센터 벽돌 무늬는 사람이 본다.
  평지붕 집 5종은 기준과 같은 「문 1+창 1」 구성만 쓴다(a/d 동형, c/e 좌우 반전).

### 적대 검수 루프 (2026-10-02, 2차)

관문 통과만으로는 사람이 짚은 결함(문 아래 그림자, 지붕 명암)이 남았다. 그래서 **기준 대 후보를 원본 8~16배로 나란히 놓고** 건물별로 적대 검수자(서브에이전트)에게
「남은 결함 6개씩」을 뽑게 했다. 검수자의 좌표·색은 눈대중이라 **반드시 픽셀 덤프로 재확인**한 뒤 고친다(재확인 없이 따르면 이미 고친 것을 또 고친다).
이 루프에서 나온 측정 규칙: 지붕은 세로 줄무늬 주기 8(몸통 6 + 골 2, 골은 한 단 어둡게)·세로로 안 변함 / 박공 왼쪽 면 톤 비중 [0,.02,.15,.48,.35], 오른쪽 [0,.14,.49,.37,0] /
평지붕 집 행 구조(윤곽1·벽돌4×2·용마루 8행·줄눈1·벽돌 8행·가장자리 3행) / 처마·보 밑 그림자 2칸 / 창 칸 아래 주황 턱 / 문은 아치 윗패널+세로선+짙은 손잡이 고리.
관문 추가: `eave_depth`·`win_sill_px`·`roof_dark_share`·`roof_light_share`.

### 문 (2026-10-02, 3차)

「문 그림자를 직선으로 깔다 문의 개념에서 벗어났다」는 지적이 근본 원인이었다. 문은 그림자 한 줄이 아니라 **층 구조**다(`landmarks._arch_door`).
나무 문: 틀 고리(윤곽 1+몸 2+안쪽 윤곽 1, 윗면 하이라이트) → 문짝(널빤지 3칸+줄 1칸) → 아치가 문짝 위 4~5행에 드리운 그림자(널빤지 몸 m→b, 줄 b→d, 양옆이 한 행 더 길다) →
걷어차기 판(밝은 주황 2행, 3칸씩 끊김) → 바닥선 → 다리 사이 2행 빈 틈. 건물 맨 아래 2행은 기둥·문 다리만 남는다(바닥 보 5행 b·o·m·m·d 이후).
유리 문(센터): 어두운 회색 윤곽 1 | 흰 하이라이트(왼쪽·위) | 밝은 회색 2 | 남색 윤곽 | 유리(윗부분 엠블럼 그림자·청록 2행·하늘 2행) | 남색 선 | 열린 바닥.
관문 `door_lintel_dark`·`door_kick_light`·`door_gap`(기준 1.0 이므로 최소 0.9)이 나무 문 개념을 강제하고, 옛 박공 집은 이 세 항목에서 불합격한다.
**주의**: 처음 문을 기준에서 옮겨 적은 글자 배열로 그렸다가(1:1 복제) 규칙 기반 생성(원호 폭·널빤지 주기·그림자 행 수)으로 다시 썼다. 문 구조 수치는 측정값이고 배열은 옮기지 않는다.
손잡이는 벽 그림자 처리(`_drop_shadow`)가 끝난 뒤에 찍는다(크림 점이 그림자색으로 바뀌는 문제).

## 건물 변주 키트 (4차)

`recipes/kit.py` — 평지붕 집을 뼈대로 종류를 늘린다. `seed.houses` 한 항목이 한 건물이다:
`kind`(house·house2·shop·cabin) · `roof`(지붕 램프) · `n`(칸 수) · `plan`(`["D"|"W"|"S", x]` 문·창·쇼윈도) · 2층은 `upper` · 가게는 `accent`(차양색).
- 집 게이트 `gates.house.auto_houses: true` 이면 `load_seed` 가 후보·배치·허용 지붕색(`extra_ramps`)을 `houses` 에서 펼친다. 집을 추가하면 자동으로 같은 건물 관문(`house_flat` 기준)을 받는다.
- 창이 없는 건물은 창 지표를 못 잰다 — 모든 건물에 창을 하나 이상 둔다.
- 가게는 차양 때문에 벽 면이 좁다. 벽 사각형(`_walls`)을 차양 아래·문 옆에 따로 잡아야 `win_frame_contrast` 의 기준 밝기가 맞는다.
- 새 지붕 램프: roof_teal · roof_slate · roof_orange · roof_pink. 확인용 비교판: `/tmp/viz/mkvar.py` → `pokemon-house-variety.html`.

## 굽기(bake)와 엔진 통행 검증 (5차, 2026-10-02)

`harness.py bake --run <run>` → `<run>/bake/{tileset.json, objects.json, semantic.json, sheet.png}`. 관문 불합격 run 은 굽지 않는다.
- **의미는 칸 이름에서 규칙으로 유도**한다(`lib/bake.py`, 규칙표 `seed.bake`): 바닥=통행, 키 큰 풀=지형 태그 5(프로젝트 `database.terrains` 다섯째 기록 필요),
  고원 오토타일=이웃 없는 변 막힘(`edge_pass`), 물=막힘+태그 1+4프레임 애니메이션, 턱=`ledgeDirections`(남 `down`·동 `right`·서 `left`),
  건물 칸=막힘이고 입구 칸(roles 의 `doors` 중앙·맨 아랫줄)만 열림, 불투명 칸은 1층·투명이 낀 칸은 3층, 울타리·간판은 `layerBacking`=풀.
- 오토타일 그룹 3개(길·고원·물)는 `variantMap` 256개를 `px.variant_map256` 이 채운다.
- `node/verify.mts <bake 폴더>`: 구운 정의를 **엔진의 `canMove`·`shapeAutotile`·`terrainTagAt`** 로 시험한다(건물마다 입구·벽·지붕, 턱 방향, 고원 가장자리, 물, 울타리, 소품). 한 건이라도 어긋나면 종료 코드 1. 실행: `npx tsx`.
- `node/showcase.mts` + `lib/render_map.py`: 구운 시트로 실제 마을 맵을 칠해 그림으로 확인한다(`pokemon-baked-town.html`).
- 아직 안 한 것: `wire`(번들·defaultAssets·참고문서·`database.terrains` 기록), 문 이벤트·밀기/자르기 이벤트 자리, 실내·동굴·지역 테마, 소품 관문(바위·덤불은 기준 대조 없이 직접 찍은 것 — 눈으로 판정).

## 동굴 한 벌 (6차, 2026-10-02)

`recipes/cave.py` — 기준 팩(Scarloxy)에 동굴이 없어서 **기준 대조 관문이 없다**(화풍 규칙만 가져옴: 램프 4~5톤·윤곽은 그 재료의 최암·빛은 왼쪽 위·1px 잡음 없음). 같은 시트(`monster-overworld`)에 구역으로 붙는다.
- 바닥 4종(`cave_floor0~3`, 관문 `cave_floor` — 기준 모래·풀의 질감 지표를 양성 대조로 쓴다) · 그림자 바닥(`cave_floor_s`, 남쪽 앞면 바로 아래) · 벽 오토타일 47변형(`cave_wall_at*`, 윗면 + 남쪽이 열린 칸은 앞면 12px 지층) ·
  구멍(`hole_down`)·사다리(`ladder_up`)·석순(`stalag` 1×2)·동굴 바위(`cave_boulder`)·깨지는 바위(`cracked_rock`)·야외 동굴 입구(`cave_mouth` 3×3, 입구 칸 `bake.entrances`).
- 램프: `cave_floor`·`cave_wall`(seed.palette). 색 수 87(상한 96) — 더 넣으려면 램프를 공유할 것.
- bake: 벽=막힘·지형 태그 4(돌), 바닥·구멍·사다리=통행(구멍·사다리는 이동 이벤트를 올릴 자리), 바위=막힘. verify.mts 에 동굴 시나리오(벽 세 방향 막힘·바닥 통행·입구 앞→입구) 포함, showcase.mts 가 `verify-cave.json`(동굴 맵)을 쓴다 — `MAPFILE=verify-cave.json lib/render_map.py`.
- 알려진 약점: 벽 윗면이 어두운 한 덩어리로 보인다, 동굴 물·크리스털·종유석(천장)·얼음·용암 없음, 야외 입구는 기존 바위 램프(주황) 언덕이라 동굴 내부 톤과 연결감이 약하다.

## 동굴 7차 — 원작 실측으로 문법 교체 (2026-10-02)

앞선 6차까지는 원작 동굴을 기억에 의존해 「어두운 허공 + 밝은 돌띠」로 만들었고, 실제와 반대였다. pret 디컴파일 저장소
(`pokefirered`·`pokeemerald` 의 `data/layouts/*/map.bin` + `tilesets/*/{tiles.png,metatiles.bin,palettes}`)를 직접 조립해(Mt. Moon 1F 768×640 = Bulbapedia 공식 크기와 일치)
측정했다. 학습용이며 저장소에 넣지 않는다. 원작 문법:
- 걸을 수 없는 암반은 **바닥보다 밝은 고원 윗면**(한 톤 면 + 물결 두 줄)이고 어두운 건 테두리 띠뿐이다.
- 테두리는 **물결치는 둥근 3톤 띠**(옆 약 12px, 윗변 약 5px, 남쪽 앞면 한 칸). 돌 한 개마다 윤곽선을 두르지 않는다.
- 덩어리는 폭 2칸 이상의 알약형 섬·벽에서 뻗은 능선. 바닥은 조용한 가로 결. 채도는 낮다(우리는 Scarloxy 주황 계열로 옮김 — 마을과 한 게임으로 보이게).
`recipes/cave.py` 가 이 문법으로 다시 쓰였다(`wall_cell`: 윗면 `_top_tex` + 옆 띠 `<` 비늘 + 앞면 `_face_px` 톱니·다이아몬드 비늘, `void_tile`: 맵 바깥 단색).
`lib/cave_preview.py` 로 알약 섬 오토타일을 큰 배율로 본다. 독립 적대 검수가 지적한 남은 것: 앞면 비늘이 원작보다 규칙적, 외곽 벽이 한 칸이라 액자처럼 읽힘, 맵 바깥 모서리에 바닥색 점 새어 나옴, 소품(석순·구멍)이 원작 문법과 다름.

### 동굴 8차 (소품·모래·외곽·입구)
- 구멍 = 검은 원 + 아래로 가는 사다리, 사다리 = 바닥 위 사다리 하나(원작 소품 모양). 석순은 원작에 없어 쇼케이스에서 뺐다(시트에는 남아 있음).
- `cave_pebbles0/1`(통행 불가 장식, 돌마다 윤곽), `cave_sand0/1`(노란 모래 구역·terrain sand, 칸 단위 계단 경계), `cave_void`(맵 밖 단색, 통행 불가), `cave_wall_oc{38,76,19,137}`(맵 바깥 네 모서리 — 바깥이 어둠 단색이라 바닥색 점이 새지 않는다).
- 외곽은 어둠 1칸 + 벽 2칸. 야외 입구 `cave_mouth` 는 같은 문법(고원 윗면·3톤 띠·톱니 앞면·검은 문).

## 실내·체육관·퍼즐 (9차, 2026-10-02) — 10~12차에서 전부 교체됨
(옛) `recipes/interior.py`(그림, 12차에서 삭제) + `node/showcase_interior.mts`(방 6개) + bake 규칙. 원작 센터·상점·집·체육관·퍼즐 방은 pret 디컴파일(`/tmp/viz/orig/g/rg.py` 로 조립, 저장소에 안 넣음)에서 눈으로 읽었다.
- 실내: 바닥 3종(마루·센터 크림 타일·상점 파랑)+벽 아래 그늘판, 뒷벽 두 칸(`int_wall_up/dn` + 좌우 모서리판), 옆벽 띠(투명), 검은 여백 `int_void`, 문 매트 `int_mat`, 계단 아래 `int_stairs_down`. 가구 14종은 물체(`counter` 3×2 `shelf` `shelf_wide` `table` `chair` `bed` `plant` `tv` `pc` `machine` `stairs_up` `rug` `window_pair` `statue`) — 가구·계단·창은 막힘(prop), 깔개 `rug` 는 걸을 수 있다(`decor`).
- 체육관 바닥 4종(`gym_teal/diamond/dirt/brick`), 퍼즐 칸: `spin_{u,d,l,r}` `spin_stop` `warp_pad0/1` `gym_switch` `gym_pit`(밟을 수 있고 이벤트 자리), `elec_h/v`(막힘), 올린 칸막이 오토타일 `puzzle_block_at{47}`(kind `block`, 막힘).
- 시트 색 한도는 seed.limits.max_colors(이 테마 200). 통행 시험 280건.
- wire 때 할 일: 회전·정지는 지형 태그 6~10(위·아래·왼·오른·정지) 기록이 필요하다(엔진 미지원 — 이벤트로 미끄러짐을 구현하거나 엔진에 태그를 추가). 번들·참고문서·조수 시험은 미구현.

## 10~12차 — 「맵 퀄리티가 너무 낮다」 재작업 (2026-10-02)

원작 조립본(옛 `lib/pret_ref.py` — **2026-10-07 저작권 정리로 도구·캐시·렌더 전부 삭제**. pret 디컴파일 `layouts.json`·`map.bin`·`metatiles.bin`·`tiles.png`·JASC 팔레트를 받아 맵 한 장으로 조립, `~/.cache/oprn-pret-ref/` 캐시,
**학습용이며 결과 그림은 저장소에 넣지 않는다**)과 우리 렌더를 나란히 놓고 독립 적대 검수 세 건(마을·실내·체육관)을 받은 뒤 다시 그렸다.
판단 기준: 낱장 그림(벽돌 지붕·둥근 센터 지붕·외톨이 나무·바위 고리 둑·그물 물)은 기준 팩 Scarloxy 화풍을 유지하고, **맵 문법과 빠진 타일 종류**는 원작을 따른다.

- **야외 10차** — `recipes/forest.py`(숲 벽 9조각 `forest_{tl..br}.x.y`: 2×2 수관 격자, 아래 나무 수관이 위 나무 밑동을 8px 덮고, 줄기는 맨 아랫줄만, 사이는 숲 그늘),
  `recipes/outdoor2.py`(키 큰 풀 = 외곽선 포기 넷, 가는 「~」 턱 + 동서 턱, 외곽선 꽃 두 송이, 우편함·나무/금속 표지판, 투명 바탕 바위·덤불(위층), 밝은 공터 풀 오토타일 `clear_at{47}`).
  원작 마을은 흙길이 아니라 **밝은 땅이 걷는 바닥이고 짙은 풀이 섬(집·밭 자리)** 이다 — 쇼케이스 `node/showcase.mts` 의 `Field.forest()` 가 그루 이웃으로 9조각을 고른다(맵 밖은 숲으로 본다).
  `verify-map.json`(마을 34×26) · `verify-route.json`(도로 24×32).
- **실내 11차** — `recipes/interior2.py`. 뒷벽은 방마다(`i2_wall_{center,mart,house}_{up,dn}[_l|_r]`, 32px 가로 띠 골격), 옆·아래는 검은 여백 + 흰 천장 끝 띠(`i2_edge_*`),
  바닥 3톤 규칙 무늬(`i2_fl_*` + 벽 아래 8px 그늘 `_s`), 센터 몬스터볼 문양 `c_emblem` 3×3, 매트는 아래 벽선에 걸친다(`i2_mat_*` + `i2_edge_mat`).
  가구 30종(`FURNITURE`)은 `F.done()` 이 진남회 외곽선 1px 과 반투명 그림자(오른쪽 2·아래 3px)를 붙인다. 큰 가구는 벽에 붙여 위 칸이 벽을 덮는다.
- **체육관 12차** — `recipes/gym2.py`. 올린 칸막이는 **두 줄**(윗면 칸 + 남쪽이 빈 칸이 앞면 칸) 오토타일 `g2_pb_{teal,elec}_at{47}`:
  `_virtual()` 이 이웃 8칸의 벽 픽셀을 함께 그려 외곽선·안쪽 모서리 홈을 정한다(이음새 검사 통과 조건: 앞면 칸 맨 아랫줄은 바닥, 안쪽 모서리는 2px 홈).
  체육관별 뒷벽·바닥(청록 격자·노랑 마름모·흙·나무단), 장치(회전 판·정지 돌기 판·기둥 `g_pylon`+아크 `g2_arc*`·번개 스위치·흙 구멍·돌), 관장 자리 3종, 석상.
  `node/showcase_interior.mts` 의 `solve()` 가 회전(미끄러짐·정지)·스위치(A/B 묶음 토글) 규칙으로 BFS 해 **장치로는 관장에게 가고, 장치 없이는 못 간다**, 죽은 화살표·안 쓰이는 정지 칸 0, 바위 체육관은 가운데 틈이 막히면 못 간다를 확인한다.
- 한 바퀴 명령: `bash src/harnesses/tileset-authoring/cycle.sh <run>` (draw → bake → verify(343건) → 쇼케이스 → `/tmp/viz/*.png`).
- 색 한도는 320(실내·체육관이 방마다 색을 따로 쓴다) — 배포 시트는 구역별로 나눈다.

## 13차 — 한계 손질 + 엔진 미끄럼 바닥 (2026-10-02)

- 풀 바닥: 어두운 점(g0·g1)을 빼고 밝은 두 톤 덩이만 — 원작처럼 조용하다. 동굴 모래: `px.inside_mask(radius<0)` = 칸 전체 사분원
  (중심은 맞은편 모서리, 반지름은 흔들림 최소 깊이에서 멈춰 이음매가 안 바뀐다) + 쇼케이스는 사각 합 대신 흔들린 타원 덩이(한 칸 돌기 제거).
  회전 체육관 오른쪽 위 빈 바닥 → 섬 칸막이 + 화살표 셋.
- **엔진 `tileset.slideTiles`** (`src/project/slideTiles.ts`, `types/base.ts SlideRule`): 칸 번호 → `up|down|left|right|ice|stop`.
  화살표는 그 방향으로 일반 바닥에서도 벽·정지 칸까지, 얼음은 얼음 위에서만 들어온 방향을 잇고, `stop` 은 멈춘다.
  `playSceneMovement` 가 걸음이 끝날 때마다 `slideAfterStep` 으로 다음 칸을 정해 저절로 걷게 한다(탈것·맵 이동·막힘이면 멈춤). 굽기가 `g2_spin_*`·`g2_spin_stop` 에 채운다.
  퍼즐 해석기(`showcase_interior.mts`)·kitlib 도달 검사가 **같은 함수**로 미끄러진다.
- **전기 문(스위치)은 엔진 타일 기능이 아니라 이벤트다.** 아크 칸(`g2_arc*`, 막힘)은 위층에 찍고, 스위치 칸(`g2_switch`)에 「밟으면」 이벤트로
  게임 스위치를 뒤집어 A/B 묶음의 아크 이벤트 페이지(그림 = 아크 칸, 통행 막힘 / 빈 페이지)를 바꾼다. 해석기는 이 규칙(A 가 켜지면 B 가 꺼짐)을 그대로 BFS 한다.

## 14차 — 지역 시트 (2026-10-02)

본 시트는 마을·도로·동굴·실내·체육관 3관을 담는다(약 2200칸·253색). GBA 가 「기본 + 지역 보조 타일셋」으로 나누듯 **지역마다 시트를 따로** 굽는다.
작업자 계약은 `src/harnesses/tileset-authoring/REGIONS.md`(절대 규칙·화풍·기반 사용법·완료 기준).

- **시드 상속** `seed.extends`(사전 재귀 병합, 목록 교체, `null` = 키 삭제) — 지역 시드는 다른 것만 적는다. 안 그리는 공통 절의 관문은 `null` 로 지운다.
- **절 선택** `monster_overworld.build(seed, parts)`(`SECTIONS`: ground·ledges·clearing·sandpath·plateau·water·fence·trees·forest·outdoor_props·cave·houses·landmarks·interior·gym).
  본 시트는 바이트 동일(리팩터 후 `candidate.png`·`tiles.json`·`tileset.json` 대조).
- **굽기 확장**(`lib/bake.py`): `seed.bake.rules`(정규식 → 통행·지형·라벨·미끄럼·턱·층, 첫 일치가 이긴다), 오토타일 항목 넷째 칸 옵션
  `{terrain, label, slide, edgeConnects, connectGroups}`, 종류 `edge`(가장자리 막힘), `bake.backing`(투명 낱칸 받침).
  `edgeConnects` = 맵 밖을 이어진 이웃으로(바다가 맵 끝에서 모래 테를 안 그린다), `connectGroups` = 다른 그룹 칸도 이웃으로(모래길이 바다 쪽에 풀 테를, 포장길이 부두 앞에 연석을 안 그린다).
- `harness.py` 는 `recipes/<테마_밑줄>.py` 를 자동으로 찾는다(데모 없어도 됨). `node/kitlib.mts`(Kit/Field — 엔진 오토타일·`canMove`·턱·`slideAfterStep` 도달 검사, `maps.json`),
  `cycle_theme.sh <테마> <run>`(테마별 `/tmp/viz/<테마>/`), `lib/section_view.py`(절 확대).
- **`monster-coast`**(감독): `recipes/coast.py` — 바다(물결 줄 1px 흔들림 4프레임), 해변 물가 `shore_at`·부두 벽 `quay_at`(땅이 북쪽이면 7px 앞면) 4프레임 오토타일,
  포장길 `pave_at`(8px 판), 잔교·기둥, 얕은 물·깊은 바다, 해변·항구 소품 20종. `recipes/city.py` — 평지붕 여러 층 건물(백화점·아파트·사무실·회관).
  견본: 항구 도시 34×28, 해변 바닷길 26×34(109번 도로 문법), 큰 도시 광장 32×21, 도감.
- 병렬 작업자 다섯(각자 워크트리 `rpg-zzu-th-<x>`, 브랜치 `agent/th-<x>`): `monster-climate`(눈·얼음·사막·화산재), `monster-dungeon`(얼음 동굴·용암·유령 탑·아지트·유적·해저),
  `monster-rooms`(연구소·학교·박물관·백화점·배·사천왕), `monster-gyms`(8관), `monster-wild`(숲 미로·절벽·늪·꽃 정원·강). 공유 파일은 고치지 않고 새 파일만 — 감독이 병합한다.

## 15차 — 공용 번들 배선·참고문서·풀숲 만남 (2026-10-02)

- **배선 `harness.py --theme <테마> --run <run> wire`**(`lib/wire.py`): 관문 통과한 굽기 → `public/assets/monster-kit/<테마>.png`, `src/assets/monsterKit/<테마>.json`
  (TilesetDef 모양 + 구조 킷 `mk-<테마>-<물체>` + 참고문서), `index.json`, `src/project/defaults/monsterKitSheets.generated.ts`(정적 import 표 — 손으로 고치지 않는다).
  `src/assets/monsterKitAssets.ts` 가 번들 칩셋 목록(`bundled.ts`)·칸 수·열 수에 끼우고, `src/project/defaults/monsterKit.ts` 가 새 프로젝트(`bundledEasyRpgTilesetBase`)와
  기존 프로젝트(`ensureBundledTilesets` → `ensureMonsterKitTileset`)에 심는다. 계열은 `oprn-monster`(2026-10-06, 그 전 사본은 `oprn-atlas` 그대로 — 기존 프로젝트는 손대지 않는다). 에메랄드 재채색은 `oprn-monster-emerald`. 칸 수가 바뀌면(다시 구움) 칸 표를 통째로 번들 것으로, 같으면 빠진 `mk-` 킷만 더한다.
- **참고문서**(`lib/refdocs.py`, `tiledata/AI-REFERENCE-CONTRACT.md`): 용도 `mk-<테마>` 하나에 안내(읽는 순서·레시피와 `DOC_MODULES` 머리말의 장소 문법·칠하는 법·견본 목록·도달 검사·정상/오류 쌍),
  칸 사전(0기준 번호·라벨·통행·홈 층·지형 태그·오토타일 full 번호·물체), 물체 전체 배열, 견본마다 전체 배열 + 원본 해상도 그림(`public/assets/monster-kit/references/<테마>/`).
  오류 그림은 `kitlib.negative(f, code, 설명, 망가뜨리기, 시작, 목표)` — 엔진 도달 검사가 **실제로 잡은** 망가진 맵만 남는다. 견본 설명은 `kitlib.describe` 또는 레시피 `MAP_NOTES`.
  번들 용도는 번들이 소유: `ensureMonsterKitTileset` 이 빠진 용도를 더하고, 다시 구워 달라진 용도(설명·문서 길이·그림 id 지문)는 같은 id 자리에서 바꾼다. 저자 용도·일부러 비운 배열(`[]`)은 건드리지 않는다.
  확인: `npx tsx src/harnesses/tileset-authoring/node/wire_check.mts`(번들 목록·칸 수·그림 크기·validateTileset·문서 길이·그림 파일·새/옛 프로젝트 심기·저자 보존·재굽기 교체·비움 존중).
- **굽기 속 변형**: `<접두>in<단>_<v>`(물은 `_f0..f3`) 칸을 `interiorVariants` 로 묶는다 — 0단 = 가장자리 2칸 안, 1단 = 더 깊은 곳(해안의 깊은 바다·포장 판 변형). 엔진 `shadeAutotileInterior` 가 고른다.
  오토타일 옵션은 고원·벽·칸막이도 `label`·`terrain` 을 받고, 물 종류는 `"terrain": "none"`(용암·낭떠러지)을 허용한다.
- **풀숲 만남**: 만남 조건 `terrainId`(DB 지형 기록 `terrain_tall_grass`「풀숲」, 지형 태그 5) — 그 지형 칸에서만 만난다. `src/player/encounters.ts`·`playSceneMovement.ts`·`sceneTestRunner.ts`,
  편집기 맵 속성 「지역에서만」, 조수 도구 스키마(`mapTools.ts`, 없는 id 는 `terrain-not-found`). 시험 `test/encounterTerrainCondition.test.ts`(작성만 — 이 세션에서 돌리지 않았다).
- **해안 2차**(적대 검수 QA1 반영): 끊긴 물결 줄·깊은/얕은 바다 속 변형, 갓돌 5px·앞면 7px·물 그늘 띠의 부두, 따뜻한 포장 + 돌계단 `pave_steps`, 위에서 본 파라솔·3/4 선베드·천막,
  뾰족한 나룻배·버섯 계선주·둔덕 바위·잠긴 바위·비치볼·양동이·바구니·그물 더미, 재료 윤곽(`_outline_mat` — 이웃 칠 색 램프의 최암 톤). 도시 건물 지붕 2.5칸(난간·계단실·물탱크·실외기), 3층까지.
  항구: 항구 물(quay)과 바다(shore)를 `connectGroups` 양쪽으로 이어 항구 입구를 만들고, 방파제 끝에 등대, 잔교 끝에 배, 울타리 시장 마당, 문 앞 길.
- 병합: rooms·climate·gyms·dungeon·wild 다섯 지역 시트를 감독 브랜치에 합쳤다(각자 새 파일만). 적대 검수 → 작업자 수정 → 재배선 순서로 돈다.

## 16차 — 일곱 시트 전부 배선 + 검수 회차 (2026-10-02)

- 번들에 실린 시트: `monster-overworld`(2192칸) · `monster-coast`(2448) · `monster-climate`(2048) · `monster-dungeon`(1200) · `monster-rooms`(1040) · `monster-gyms`(1568) · `monster-wild`(1664).
  `src/assets/monsterKit/index.json` 의 `run` 이 배선한 굽기다. 확인 `npx tsx src/harnesses/tileset-authoring/node/wire_check.mts` → 「시트 7장 ok」.
- **kitlib 관문 추가**: 물체 겹침(stamp·낱칸 up 이 다른 물체 칸을 덮으면 실패 — 「야자가 파라솔 반을 지움」「수건이 집 벽을 뚫음」을 잡았다; 숲 stamp 는 제외, 의도적 겹침은 `{overlap:true}`),
  `noSpecks(f, 그룹, 이웃그룹)`(낱칸 물 구멍·땅 티끌), `onWater(f, 접두들, 그룹들)`(바다 바위 등은 물 칸 위에만). 굽기 옵션 `connectTiles`(정규식 낱칸을 이웃으로 — 옹벽 칸 위아래 포장·모래가 테를 안 그린다).
- 해안 3차: 바다를 본 시트 연못과 같은 그물 물결로(같은 게임의 물), 부두 갓돌 방향별 줄눈·물 쪽 갈색 밑돌 테, 높은 포장 옹벽 `seawall_*` + 끊은 자리 돌계단 `seawall_steps_*`,
  도시 건물 동마다 다른 지붕·정면(`city.tower(..., v)`), 작은 마트 `mart_s`, 원뿔 바다 바위·2×2 잠긴 바위·모래 바위·에어매트·항아리·동상.
- 검수 회차(적대 검수 → 작업자 수정): 해안 2회(점수 4.5/5.5/4/6 → 5.5/5.5/6/6.5, 3차 수정 후 미검수), 실내 2회(평균 약 5 → 6.9, 이후 한 번 더 수정), 체육관·던전·야생·기후 1회.
  남은 한계(보고 페이지 `lib/viz_regions.py` 의 LIMITS): 던전 용암 웅덩이 직각, 야생 산 절벽이 가는 띠, 체육관 장치는 이벤트 자리 칸, 본 시트 마트는 센터 색 바꿈.
- 번들 무게: `src/assets/monsterKit/*.json` 3.2MB(참고문서 포함, 정적 import), 그림 2.6MB. 에디터 첫 로드에 더해진다 — 늘어나면 참고문서를 지연 로드로 떼어 낼 것.


## 통합 I6 이어 작업 (2026-10-03)

Claude 중단 시점(I5)의 보고서 네 장을 `harness-data/tileset-authoring/integ-qa/QA-I5-*.md`에 보존했다.
던전 작업 브랜치의 `8d987d8524` WIP(용암 가장자리 자국·동굴 옆면 밝기·유적 판석 그늘)를 감독 워크트리에서 이어 수정하고 공용 번들까지 갱신했다.

- `node/wild_round.mts`의 `roundFace`는 고원 그룹 목록을 받는다. 윗면·옆벽에 붙은 어깨와 오목 모서리는 원래 앞면을 유지하고 열린 발끝을 둥글게 한다. 본·야생·기후 쇼케이스 모두 같은 함수를 쓴다.
- 본 마을은 22×20. 4×4 건물 넷의 문·남북 출구·화단 도달을 작성 단계에서 확인한다. 도로 장치 주머니의 위 벽은 수관으로 채우고 `item_capsule`(보상 이벤트 자리)을 둔다. 캡슐 그림은 기존 빨강·금속 램프로 직접 그린다.
- 용암 가장자리 자국은 `dungeon_cavern.lava_cell` 정본. 던전과 체육관에 곧은 변 세 벌을 굽고 `node/lava_edges.mts`로 섞는다. 열 테·4프레임 애니메이션·통행 막힘을 유지한다. 변형 칸은 양쪽 시드의 `connectTiles`에도 넣어 이웃 용암을 끊지 않는다.
- `cycle.sh`·`cycle_theme.sh`·`integ.sh`는 `set -euo pipefail`로 실패한 단계에서 멈춘다. 이전 파이프의 마지막 명령 종료 코드만으로 성공을 보고하지 않는다.
- 시각 자료: `lib/integration_review.py --out verify-shots/tileset-i6`. 현재 배선 목록의 run을 읽어 맵 원본·맵 모음·모든 맵 4배 격자 조각·모든 구조 물체와 사용 중 낱칸 소품·바닥 3×3·I5 전후 비교·같은 이름 칸의 바이트 대조를 생성한다. `changed_cells`는 칸 이름 차이, `changed_render_pixels`는 최종 RGBA 차이다. 수치를 시각 점수로 환산하지 않는다. 원작 학습 그림은 증거 폴더에 복사하지 않는다.
- 배포 run: 본 `d100` · 해안 `c107` · 기후 `k103` · 던전 `u101` · 실내 `r102` · 체육관 `g103` · 야생 `w197`. 제작 단계 통합 종료 0, 본 시트 통행 확인 337건/실패 0, 공용 배선 7장 확인. 정상 맵 54장과 구조 킷 437개를 재검토한 **I6 자체 시각 검수**에서 맵 모두 8점, 치명·중 0. 독립 검수 결과로 설명하지 않는다. 상세 `harness-data/tileset-authoring/integ-qa/QA-I6.md`와 물체별 읽힘 `QA-I6-objects.md`.
- `lib/viz_progress.py`는 증거 폴더의 `assessment.json`·`manifest.json`을 읽어 `~/claude-viz/pokemon-tiles-progress.html`을 생성한다. 현재 번들과 두 자료의 run·시트·견본 픽셀 해시가 다르면 생성을 거절한다. 전후 비교와 54맵 필터·확대를 제공하고, 원작 학습 그림은 넣지 않는다. 실제 브라우저 필터·확대 결과와 화면은 `verify-shots/tileset-i6/progress-page*`.
- 전체 gates·Vitest·typecheck는 사용자 요청 없이 돌리지 않는다. 이번에는 타일 제작 단계의 draw/bake/showcase/wire와 시각 검수만 진행했다.

## Emerald native variants 7종 (2026-10-04)

- 원본 `monster_*`는 유지한다. 새 `emerald_monster_{overworld,wild,coast,climate,rooms,dungeon,gyms}`와 `tex_` 접두 텍스처를 공용 번들에 추가했다. 16px/16열, 칸 수 2192/2048/2528/2560/1136/1920/2144(합계 14528), 원본 번호·통행·priority·terrain·home layer·오토타일·animation slots·킷·턱·미끄럼을 깊은 복제로 유지한다.
- 소스는 `recipes/emerald_monster.py`와 `harness-data/tileset-authoring/emerald-monster-*/seed.json`. 원본 native recipe를 조합하되 새 팔레트/잔디 덩이/수평 물결/큰 수관 덩이/넓은 지붕 기와를 좌표로 다시 그린다. 모래·눈·재·용암·청회 연구소·리그 테마를 전역 초록 필터로 바꾸지 않는다. 비교용 Scarloxy 색 지표는 새 스타일에 쓰지 않고 원본 native 씨앗을 명시한다.
- `python3 scripts/content/prepare-emerald-monster.py`는 DB 없이 공용 PNG, 칩셋 index, 참고문서 JSON, 54개 정상 전체 배열의 새 그림과 전후 그림, preservation manifest를 만든다. 배 뱃머리의 물이 프레임마다 같은 그림이 되어도 원본 native enumeration/예약 슬롯을 고정한다. 이름 없는 원본 native 슬롯도 보존한다. 출력은 `public/assets/emerald-monster/{tiles,references}`.
- `emeraldMonsterKitAssets.ts` → `bundled.ts`/`bundledChipsetGeometry.ts`, `defaults/emeraldMonsterKit.ts` → `defaultAssets.ts` 새/기존 경로에 배선한다. 파생 시트가 참조 포인터를 가지면 새 문서가 가려지므로, 한 홉 `referenceSourceTilesetId` 대신 각 변형이 정본에서 읽은 원본 전체 배열+새 스타일 안내와 표본을 직접 소유한다. 의도적으로 비운 `[]`와 저자 용도는 보충 때 보존한다.
- 공용 자료 정본은 `tiledata/emerald-monster/`: 현재 정본에서 읽은 75 MD/92 이미지 포인터의 source JSON, 7 MD 안내, prepare source와 README. 배포 JSON은 82 MD/92 이미지 포인터(바이트 내장 없음). 원본색 오류 그림 38장은 동일 구조의 진단 자료이며 새 스타일 그림이라고 주장하지 않는다.
- 허용된 집중 검증 `npx tsx scripts/qa/emerald-tile-preservation.mts`: 7 PNG 실제 경계·등록 geometry·12개 구조 필드·새/기존 프로젝트·저자/비움·보충 멱등성을 확인한다. 전체 gates/Vitest/typecheck를 돌리지 않았다. 원본 배열 렌더/데이터 비교는 이벤트 실행·미적 동등성·SQLite 저장의 증거가 아니다. root 프로필의 map retarget와 정본 저장/런타임 QA는 별도 통합 소유다.

## GBA 2세대 결로 다시 그리기 (2026-10-07)

사용자 판단: 「포켓몬스터풍인데 왜 기본 칩셋 같냐」 → (나) 원작 디테일 쪽으로 다시 그리기, 비교판에서 **새 그림 + 길 B(흙색)** 를 골랐다.
타일 이름·순서·캔버스는 그대로라(`tiles.json`·`roles.json` == 이전 run) **맵 72장은 손대지 않고** 그림만 바뀐다.

- 바닥: 민트 풀(`grass`) + 1px 점(`monster_overworld.grass_tex`, 점끼리 맨해튼 거리 >2). 공터·마을 길 `grass_light` 는 흙색 램프(길 B).
- 키 큰 풀: 칸마다 외곽선 있는 작은 풀 다발 넷을 벽돌처럼 엇갈려(`outdoor2.TUFT_GBA`). 잎끝 `tall_fringe_*`·둥근 귀는 이제 빈 칸(옛 맵 호환으로 이름만 남김, 홈 층 위).
- 나무: 덩이 일곱을 왼쪽 위 빛으로 겹친 둥근 수관(`forest.crown`, 옛 것은 `crown_scarloxy`). 잎결 잡음은 좌표 해시 `_hh` — 선형 식은 사선 줄무늬가 됐다.
- 건물: 외곽선·크림 벽·돌 기초·흰 틀 창·나무 문(`buildings.wall_kit`, kit·landmarks 공용). 다리·통나무는 따뜻한 갈색 `trunk`.
- 기후: 사막 오아시스 풀은 `oasis_grass`(따뜻한 녹색 — 민트는 모래 위에서 청록으로 뜬다, `climate_desert.init`).
- 관문: Scarloxy 화풍 관문(tree·grass·house·center·gym·gable)은 고른 방향과 반대라 `seed.retired_gates` 에 이유와 함께 은퇴. 구조 검사(통행·배치·입구·야생 정본 바이트 대조)는 그대로 돈다.
  야생 사본 sha1 대조(`agent/th-wild`)는 소스가 main 에 합류해 끔. 자르기 나무 대조는 같은 정본 그림 + 그 시트 바닥 그늘(`cut_shadow`).
- 굽기: `bake.py` 는 이름 있는 빈 칸도 위층으로 둔다(아래층이면 땅에 구멍). 배포 절차는 `src/harnesses/tileset-authoring/redeploy.sh <run> <테마…>`
  (draw → bake → 옛 run 의 견본 맵 `verify-*.json`·`showcase.json` 복사 → wire). 견본을 안 옮기면 참고문서 견본 맵이 0장이 된다.
- 다시 굽지 않은 시트: gyms·rooms·dungeon(바뀐 공용 조각이 없다). 실내(센터·마트·집 = 본 시트 `interior2.py`)·계단·2층은 별도 작업.

