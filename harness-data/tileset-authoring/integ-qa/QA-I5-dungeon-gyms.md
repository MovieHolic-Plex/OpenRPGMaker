# I5 통합 적대 검수: 던전 monster-dungeon u100, 체육관 monster-gyms g102

- **대상.**
  - 렌더 시각은 10-03 06:58~06:59 이다. u100(06:58:38)·g102(06:59:03) 의 `candidate.png` 와 같은 회차다.
  - 던전 6맵: `/tmp/viz/monster-dungeon/{ghost_tower,hideout,ice_cave,lava_cave,ruins,sea_cave}.png`
  - 체육관 8관과 `_after` 6장: `/tmp/viz/monster-gyms/gym_*.png`
  - `-err-`·`cmp_`·`v2_`·`z*`·`sheet*`·`all*` 은 채점하지 않았다.
- **방법.**
  - 3배 렌더를 1배로 되돌린 뒤 5배로 잘라, 분홍 16px 격자와 칸 좌표를 얹어 Read 로 모두 봤다(`q_<맵>_N.png`).
  - 격자 없이 2~4배로 본 그림: 용암, 동굴 벽 긴 줄, 유적, 화염관 김 구멍.
  - 용암 6×6 반복 시험은 두 가지로 했다. 변형마다 따로 깐 것(`lava_6x6_single_each_2x.png`)과 변형을 섞어 깐 것(`lava_6x6_mixed_4x.png`)이다.
  - 원작 대조: `sbs_lava_vs_orig.png`(magma), `orig_seafoam_edge_2x.png`·`orig_icefall_edge_2x.png`(동굴 벽), `orig_saffron_crop.png`(에스퍼관).
  - 본 시트 대조: `/tmp/viz/cave_map.png` 를 `wall_side_main_vs_lava_4x.png`·`side_run_main_sea_lava_ice_3x.png` 에 나란히 놓았다.
  - u98→u100, g100→g102 의 칸 화소를 비교했다(`diffsheet.py`·`chg.py`).
    - **던전에서 바뀐 것.**
      - 용암 `lv_at*`·`lv_atin*`·`lv_crust*` 전부.
      - 유적 담 `ru_pb_at*` 13칸, `ru_sand_e/se`, 새 칸 `ru_sand_c`.
      - 동굴 벽 `*_wall_top110_1/2`. 새 칸 `*_wall_side55_1/2`·`*_wall_side205_1/2` 12칸. `*_wall_top110_0` 은 빠졌다.
      - 다른 칸은 화소가 그대로다.
    - **체육관에서 바뀐 것.**
      - `gy_lava_*` 전부, `gy_vent(_s)(_f0)`, `gy_psyv*` 4칸, `gy_turn_v`, `gy_dark_l*`(도장 어둠 테).
      - 새 칸 `gy_turn_h_w`·`gy_turn_v_n`.
- **그림 위치.** `/tmp/viz/integ5/dungeon-gyms/`
- **근거로 쓰지 않은 것.** 관문 통과, 작업자 보고, 지난 점수.
- **등급 기준.** 감독자가 문자 그대로 읽은 기준을 따랐다.
  - 오독은 [중] 이상이다.
  - 눈에 보이는 반복·격자, 원작 배치 문법 위반, 빛 방향 오류는 [중]이다.
  - [경]은 1~3px 다듬기와 배치 취향뿐이다.

## 0. 지난 회차(QA-I4) 지적 판정

| # | 판정 | 근거 |
|---|---|---|
| W1 [중] 용암 「^」 16px 격자 | **고쳐짐** | 공통 「^」·사선 결이 없어졌다. 바탕은 납작한 주황이다. 변형마다 다른 자리에 잔물결 1~2개와 기포 쌍이 성기게 있다(`lava_variants_8x.png`). 섞어 깐 6×6(`lava_6x6_mixed_4x.png`)과 맵 2·4배 무격자(`lava_2x_nogrid.png`, `lava_4x_nogrid.png`)에서 16px 줄이 서지 않는다. f0~f3 은 잔물결이 1px 씩 흔들린다(`lava_frames_6x.png`). 「평평한 빨간 바닥」이 아니라 용암으로 읽힌다. 근거는 셋이다: 잔물결, 떠 있는 껍질 덩이, 노란 열 테. 다만 가장자리 칸이 비어 있다(새 결함 V2). |
| W2 [중] 세로 회전문 팔 그림자가 왼쪽 | **고쳐짐** | `gy_turn_v` 의 그림자가 팔 오른쪽 2px 와 발 밑으로 옮겨졌다. 축 `gy_turn_pivot_v` 와 방향이 같다(`turn_tiles_10x.png`, `grass_turn_6x.png`). |
| W3 [경] 회전문 한쪽 끝에만 기둥 | **고쳐짐** | `gy_turn_h_w`·`gy_turn_v_n` 이 생겼다. gym_grass (7,14)·(9,14), gym_grass_after (8,13)·(8,15) 양 끝에 기둥과 발이 있다. |
| W4 [경] 김 촉이 납작한 뚜껑 | **고쳐짐** | `gy_vent_f0`·`gy_vent_s_f0` 의 김이 두 가닥이다. 낮은 가닥 하나와 1px 위로 뜬 가닥 하나이고, f1 로 이어진다(`vent_tiles_10x.png`). 2배 무격자에서 「구멍에서 피어오르는 김」으로 읽힌다(`fire_vents_2x_nogrid.png`). |
| W5 [경] 유적 리벳 반복 | **고쳐짐** | 위 줄 리벳은 16px 간격, 아래 줄은 8px 간격이고 서로 엇갈린다(`ruins_pb_6x.png`). 2배 무격자에서 16px 격자가 아니라 촘촘한 징 박힌 판 결로 읽힌다(`ruins_2x_nogrid.png`). |
| W6 [경] 유적 담 끝 그늘이 「ㄱ」 이 아님 | **고쳐짐** | (6,10)~(6,12) 와 (19,7)~(19,9) 의 오른쪽 그늘 기둥이 아래 띠와 L 자로 이어진다. 모서리는 `ru_sand_c` 다. |
| W7 [경] 도장 어둠 테 | **대부분 고쳐짐** | 위 테 (1~12,8) 의 디더가 고르다. (12,8)·(12,9) 오른쪽만 디더가 아니라 굳은 선이다 → V3 [경]. |
| W8 [경] 에스퍼관 세로 벽이 홈처럼 보임 | **고쳐짐** | `gy_psyv` 를 올린 벽으로 다시 그렸다. 흰 윗면, 오른쪽 보라 옆면과 바닥 그늘, 최암 윤곽이다. 가로 벽 윗선과 T 자로 이어진다(`psychic_wall_7x.png`, `psychic_wall_bottom_7x.png`, `psyv_tiles_10x.png`). 홈이 아니라 칸막이 벽으로 읽힌다. 원작 Saffron 칸막이와 같은 자리이고 오독은 없다. |
| (지시) 동굴 벽 정본 top/side 변형과 해시 번갈이 | **구조는 정본, 색 램프는 새 결함** | `*_wall_side55/205_1/2`·`top110_1/2` 등 10종 모두 본 시트 `cave_wall_*` 와 밝기 순위 상관 1.000 이다. 가로 긴 줄(윗면 윗선, 앞면 돌무더기)에는 점선이 없다(`wall_front_runs_3x.png`). 세로 긴 줄은 용암·바다 동굴에서 점선 사슬로 보인다 → V1 [중]. |

## 1. 지적 목록

### 던전 (V2 는 체육관과 함께)

#### V1. [중] 용암·바다 동굴의 세로 벽 옆면 구슬이 밝은 8px 점선 사슬로 보인다

- **위치**
  - lava_cave: x=1 (1~17행, 바깥 가장자리), x=26 (1~17행), x=2 (6~10행), x=25 (6~15행)
  - sea_cave: x=1 (1~16행), x=20 (2~15행). 1칸 폭 벽이라 양쪽 구슬이 나란히 선 두 줄 사슬이다.
  - 칸: `lv_/se_wall_at55`·`at205`·`side55_1/2`·`side205_1/2`
- **그림:** `side_run_main_sea_lava_ice_3x.png`(왼쪽부터 본 시트·바다·용암·얼음, 3배 무격자), `wall_side_main_vs_lava_4x.png`, `wall_side_ice_sea_4x.png`, `wall_variants_6x.png`
- **문제**
  - 구조는 본 시트 `cave_wall_side*` 와 같다(순위 상관 1.000). 색 램프가 다르다.
  - 옆면 구슬 최대 밝기 ÷ 윗면 중앙값은 다음과 같다. 본 시트 1.65, 얼음 1.65, 용암 **2.81**, 바다 **2.93**.
  - 그래서 본 시트와 얼음에서는 「낮은 바위 턱」으로 가라앉는 구슬이, 용암·바다에서는 어두운 윗면 위에 밝은 주황/회색 알이 8px 마다 늘어선 점선이 된다. 3배 원 렌더 `lava_cave.png`·`sea_cave.png` 에서도 맵 양옆 전체 높이로 보인다.
  - 바다 동굴 x=1·x=20 은 두 줄 사슬이라, 바위 벽이 아니라 사다리나 난간처럼 읽힌다.
  - 채점표 8점 조건 「칸 반복·격자 티가 안 난다」와 「같은 재료는 같은 램프」를 어긴다.
- **원작 근거**
  - 원작 Seafoam·Icefall 은 맵 바깥 테도 바위 능선으로 감싼다. 그래서 바깥 테에 옆면을 그리는 문법 자체는 맞다(`orig_seafoam_edge_2x.png`, `orig_icefall_edge_2x.png`).
  - 다만 원작의 옆면 덩이는 크기와 명암이 제각각이고 윗면과 명도 차이가 작다. 같은 크기의 밝은 알이 일정 간격으로 줄을 서지 않는다.
- **고침**
  - 공유 그림은 건드리지 않는다. `lv_`·`se_` 팔레트 인자만 바꾼다.
  - 옆면 구슬의 가장 밝은 두 톤을 윗면 중앙값의 1.6~1.7배로 낮춘다(목표 휘도: 용암 약 68, 바다 약 80). 지금은 용암 116, 바다 143 이다.
  - 구슬 사이 최암 톤은 그대로 둔다.
  - 고친 뒤 `side_run_main_sea_lava_ice_3x.png` 와 같은 조건으로 다시 찍어, 본 시트 열과 밝기 대비가 같아지는지 확인한다.
- 얼음 동굴은 비율이 본 시트와 같아서 지적하지 않는다.

#### V2. [중] 용암 가장자리 칸에 무늬가 하나도 없어, 웅덩이마다 1칸 폭의 민무늬 띠가 생긴다. 2칸 폭 수로는 통째로 평평한 주황 바닥이 된다 (던전·체육관 공통, 정본 `lava_cell`)

- **위치**
  - gym_dragon / gym_dragon_after: 왼쪽 수로 (1~2, 2~6), 오른쪽 수로 (16~17, 2~6). 이 수로는 모두 `gy_lava_at55`/`at205`/`at38`/`at76` 이다.
  - 큰 웅덩이 가장자리 줄 전부. 예: (1,7~13) `at55`, (2~17,13) `at155`.
  - gym_dragon 의 용암 칸 105개 가운데 68개가 무늬 없는 가장자리 칸이다.
  - lava_cave: 웅덩이 윗줄 (6~11,7)·(16~19,6), 아랫줄 (5~12,13)·(16~18,13) 등.
- **그림:** `dragon_lava_2x_nogrid.png`, `dragon_channel_plain_5x.png`, `dragon_lava_left_4x_grid.png`, `lava_frames_6x.png`(셋째·넷째 줄 `lv_at155`·`lv_at110` 은 4프레임 모두 민바탕), `lava_2x_nogrid.png`
- **문제**
  - 잔물결과 기포는 속 칸(`atin*`)에만 있다. 가장자리 47변형에는 열 테만 있고 무늬가 없다.
  - 그래서 모든 웅덩이에서 무늬 구역이 테에서 정확히 16px 안쪽에서 끊긴다. 웅덩이 모양을 따라 칸 경계가 드러난다.
  - gym_dragon 위쪽 2칸 수로는 처음부터 끝까지 민무늬다. 2배에서 「노란 테를 두른 주황 카펫/바닥」으로도 읽힌다.
  - 감독 질문 「평평한 빨간 바닥으로 읽히지 않는가」에 대해: 속 칸은 통과, 가장자리와 수로는 실패다.
  - lava_cave 는 웅덩이가 넓어 덜 띄지만, 아랫줄과 윗줄의 민무늬 띠는 2배에서 보인다.
- **원작 근거.** 원작 magma 용암은 기포 쌍이 가장자리 칸에도 똑같이 성기게 있다. 물가에서 무늬가 칸 단위로 끊기지 않는다(`sbs_lava_vs_orig.png` 아래).
- **고침**
  - `lava_cell(P,mask,f,key)` 에서 mask≠255 인 가장자리 칸에도 속 칸과 같은 해시 규칙으로 잔물결 0~1개와 기포 쌍 0~1개를 찍는다. 자리는 테(열 테와 윗턱)에서 4px 이상 떨어진 안쪽 사각형으로 제한한다.
  - 곧은 가장자리 `at55/205/110/155` 는 무늬가 들어가면 반복이 생긴다. 그래서 키 해시 변형을 2~3벌 둔다(동굴 벽 `side55_1/2` 와 같은 방식).
  - f0~f3 도 속 칸처럼 1px 씩 흔든다.
  - 정본이라 체육관 `gy_lava_*` 도 함께 바뀐다.

#### V4. [경] 유적 위 왼쪽 담 끝 (9,4)~(9,5) 의 오른쪽 그늘이 바로 옆 돌문 바닥 (10,4)~(10,5) 에 지지 않는다

- 그늘이 모래 위 (10,6) 의 L 모서리에만 있다. 다른 담 끝은 오른쪽 2px 그늘 기둥이 있다.
- **고침.** `ru_fl0/2` 왼쪽 2px 에 같은 반투명 그늘을 얹은 변형을 그 두 칸에만 쓴다.

### 체육관

#### V3. [경] 도장 어둠 오른쪽 테 (12,8)~(12,9) 만 디더가 아니라 굳은 어두운 선이다

- (12,10)~(12,15) 의 체크 디더와 이어지지 않는다(`dojo_right_rim_5x.png`). 칸은 `gy_dark_l3s0` 계열이다.
- **고침.** 두 칸의 오른쪽 4px 에 아래 칸과 같은 2px 체크 디더를 쓴다.

(V2 는 위 던전 절을 보라. gym_dragon·gym_dragon_after 에 [중]으로 나타난다.)

## 2. 「같은 게임」 정본 대조 (화소 비교, 이번 회차에 다시 돌림)

| 물체 | 비교 | 결과 |
|---|---|---|
| 용암 | 체육관 `gy_lava_*` ↔ 던전 `lv_*`(f0) | 350쌍 가운데 285쌍은 화소가 같다. 65쌍은 모서리 바깥 받침 바닥색만 다르다(체육관 회색 돌, 동굴 갈색. `gym_vs_dungeon_lava_edges_7x.png`). 체육관에만 있는 속 변형 `atin0_5/0_6/1_6` 도 같은 그림 규칙이다(`gym_lava_interior_6x.png`). |
| 동굴 벽(세 동굴) | `ic_/lv_/se_wall_{side55_1/2, side205_1/2, top110_1/2, at55, at205, at110, mid0}` ↔ 본 `cave_wall_*` | 밝기 순위 상관 모두 1.000 이다. 구조는 같다. 램프 대비는 V1 에서 다룬다. |
| 밀 바위·묘비·얼음 판·얼음 바위·풀·모래·자르기 나무·김 구멍·워프·정지·깨는 바위 | | u98→u100·g100→g102 에서 이 칸들은 화소가 바뀌지 않았다. I4 대조(100% 또는 같은 그림에 바닥만 다름)가 유효하다. |

「같은 게임」 검사 결과: 구조는 통과. 용암·바다 동굴 옆면 램프만 V1 로 남는다.

## 3. 물체 「무엇으로 읽히나」 (바뀐 것과 새로 본 것)

| 맵 | 물체 → 읽힘 |
|---|---|
| lava_cave | 용암 속 → 잔물결과 기포가 있는 용암이고 격자가 없다. 가장자리 → 민무늬 띠(V2). 껍질 덩이 → 떠 있는 굳은 껍질. 가운데 자갈 둑 → 용암을 가르는 바위 둑. 분기공 → 김 기둥. 벽 옆면 → 밝은 점선 사슬(V1). |
| sea_cave | 1칸 벽 x=1·x=20 → 구슬 두 줄 사다리처럼 보임(V1). 섬·사다리 구멍·물·산호·조개는 I4 와 같다. |
| ice_cave | 벽 윗면 → 조약돌 깔린 얼음 바위, 옆면 → 본 시트와 같은 대비의 낮은 턱. 얼음 판·바위·고드름·결정은 정본이다. |
| ruins | 담 → 징 박힌 청록 돌판. 리벳은 엇갈린 결이다. 그늘 → L 자. 기둥·항아리·제단·돌문·바위는 I4 와 같다. |
| ghost_tower · hideout | 칸이 바뀌지 않았다. 묘비·향로·촛대·회전 화살표·정지·워프·기계는 I4 와 같다. 고스트탑 바닥 지그재그는 원작 Pokémon Tower 바닥과 같은 문법이다. |
| gym_grass / _after | 회전문 → 양 끝 기둥이 있는 줄무늬 팔과 가운데 축. 그림자가 모두 오른쪽 아래로 진다. |
| gym_fire / _after | 김 구멍 → 열 테 두른 구멍과 두 가닥 김. |
| gym_psychic | 세로 칸막이 → 흰 윗면을 올린 벽. 워프 판·수정구·원형 단은 I4 와 같다. |
| gym_dojo / _after | 어둠 → 디더 테를 두른 어둠. 입구 (2,8) 는 빛이 새고, 깨진 판 둘레는 등불 원이다. 깨진 판 → V 자로 쪼개진 판. |
| gym_dragon / _after | 용암 → 용암. 수로 2칸 폭은 민무늬(V2). 메운 돌 → 네 변이 뜨거운 돌판. 다리 → 용암 위 돌다리. |
| gym_water(_after)·gym_ice·gym_ghost(_after) | 칸이 바뀌지 않았다. I4 와 같고 오독이 없다(`gyms_unchanged_a_2x.png`, `gyms_unchanged_b_2x.png`). |

- **크기 비례.** 사람 16×32, 문 1칸, 나무 2×2 에 견주어 벗어나는 물체가 없다.

## 4. 맵별 점수

### 던전 monster-dungeon (u100)

| 맵 | 점수 | 한 줄 이유 |
|---|---|---|
| ghost_tower | **8** | 바뀐 칸이 없고 오독이 없다. |
| hideout | **8** | 바뀐 칸이 없다. 회전·정지·워프가 정본이다. |
| ice_cave | **8** | 벽이 본 시트 구조이고 램프 대비도 같다. 얼음·바위가 정본이다. |
| lava_cave | **7** | 용암 「^」 격자는 사라졌다. 남은 것: 옆면 구슬 점선 사슬(V1 [중]), 가장자리 민무늬 띠(V2 [중]). |
| ruins | **8** | 리벳이 엇갈린 결이 되었고 그늘이 L 자다. V4 는 [경]이다. |
| sea_cave | **7** | 1칸 벽 양옆의 밝은 구슬 두 줄이 사다리처럼 읽힌다(V1 [중]). |

등급 합계(던전): 치명 0 · 중 2 (V1, V2) · 경 1 (V4)

### 체육관 monster-gyms (g102)

| 맵 | 점수 | 한 줄 이유 |
|---|---|---|
| gym_water | **8** | 바뀐 칸이 없다. |
| gym_water_after | **8** | 줄이 부표에서 끝나고 그 사이에 돌이 솟았다. |
| gym_fire / _after | **8** | 김이 두 가닥이고(W4 고쳐짐), 구멍 쌍이 겹치지 않는다. |
| gym_ice | **8** | 바뀐 칸이 없다. 정본 얼음이다. |
| gym_ghost / _after | **8** | 문양 → 빛 다리가 읽힌다. |
| gym_psychic | **8** | 세로 칸막이가 올린 벽으로 읽힌다(W8 고쳐짐). |
| gym_grass | **8** | 회전문 양 끝에 기둥이 있다(W3 고쳐짐). |
| gym_grass_after | **8** | 세로 팔 그림자가 오른쪽에 진다(W2 고쳐짐). |
| gym_dojo | **8** | V3 는 [경]이다. |
| gym_dojo_after | **8** | 깨진 판이 쪼개진 판으로 읽힌다. |
| gym_dragon | **7** | 용암 격자는 사라졌다. 위쪽 2칸 수로와 가장자리 띠가 민무늬 주황 바닥으로 읽힌다(V2 [중], 정본 공유). |
| gym_dragon_after | **7** | gym_dragon 과 같다(V2). 메운 돌은 좋다. |

등급 합계(체육관): 치명 0 · 중 1 (V2, 정본 공유) · 경 1 (V3)

## 5. 이번에 만든 그림 (`/tmp/viz/integ5/dungeon-gyms/`)

- **사분면 격자:** `q_<맵>_N.png` (20맵 × 4)
- **용암**
  - `lava_variants_8x.png`, `lava_6x6_single_each_2x.png`, `lava_6x6_mixed_4x.png`, `lava_frames_6x.png`
  - `lava_2x_nogrid.png`, `lava_4x_nogrid.png`, `sbs_lava_vs_orig.png`
  - `dragon_lava_2x_nogrid.png`, `dragon_lava_left_4x(_grid).png`, `dragon_channel_plain_5x.png`
  - `gym_lava_interior_6x.png`, `gym_vs_dungeon_lava_edges_7x/8x.png`
- **동굴 벽**
  - `wall_variants_6x.png`, `wall_side_main_vs_lava_4x.png`, `wall_side_ice_sea_4x.png`
  - `side_run_main_sea_lava_ice_3x.png`, `wall_side_runs_3x.png`, `wall_front_runs_3x.png`
  - `orig_seafoam_edge_2x.png`, `orig_icefall_edge_2x.png`
- **유적:** `ruins_2x_nogrid.png`, `ruins_pb_6x.png`
- **체육관 물체**
  - `turn_tiles_10x.png`, `grass_turn_6x.png`
  - `vent_tiles_10x.png`, `fire_vents_6x.png`, `fire_vents_2x_nogrid.png`
  - `psyv_tiles_10x.png`, `psychic_wall_7x.png`, `psychic_wall_bottom_7x.png`, `orig_saffron_crop.png`
  - `dojo_top_rim_6x.png`, `dojo_right_rim_5x.png`, `dojo_bottom_6x.png`
  - `gyms_unchanged_a_2x.png`, `gyms_unchanged_b_2x.png`

합격(monster-dungeon): 아니오 — 남은 치명 0 · 중 2 (V1 용암·바다 동굴 옆면 구슬이 밝은 점선 사슬, V2 용암 가장자리 칸 민무늬 띠) · 8 미만 맵 [lava_cave, sea_cave]. 지난 W1(용암 「^」 격자)·W5·W6 은 고쳐졌다. 용암 속은 6×6 에서 격자 없이 용암으로 읽힌다. 동굴 벽 가로 줄에는 점선이 없다.
합격(monster-gyms): 아니오 — 남은 치명 0 · 중 1 (V2 정본 lava_cell 공유: gym_dragon 2칸 수로·가장자리 민무늬) · 8 미만 맵 [gym_dragon, gym_dragon_after]. W2·W3·W4·W7·W8 은 고쳐졌다(도장 오른쪽 테 두 칸 V3 [경]만 남음).
