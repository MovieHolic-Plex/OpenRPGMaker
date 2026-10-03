# 현대 도시 — 건물 조립 (키트·문 앞·겹침 순서·변형)

tilesetId `modern_city` · 그림 `public/assets/modern-city/modern-city-chipset.png`(텍스처 `tex_modern_city`, **9998칸**, 16px 칸, 시트 768×3344px, 한 줄 **48칸** — 번호 n 의 칸은 열 n%48, 행 n÷48(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-modern` — 버들항(`oprn-atlas`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

## 키트가 정하는 것
- 건물 한 채 = 키트 하나(`mc-bld-<계열>-<글자>[-<벽색>][-roof-<지붕색>]`). 칸 번호는 **3층(upperTiles)** 이고 1층은 비어 있다 — **찍는 자리의 땅(보도)을 그대로 둔다.**
- 키트 원점 = 왼쪽 위 칸. 앵커 = 왼쪽 아래 칸 = 건물 발(밑변). 건물 그림은 칸 경계에 맞춰져 있어 스냅이 없다(폭은 16의 배수, 위쪽에 투명 패딩 칸이 있을 수 있다).
- **칸 통행**: 키트의 모든 칸이 막힘(문 칸 포함, 지붕 옥상 설비 포함). 윗면까지 한 장이라 ★ 칸이 없다.
- **문**: `parts[kind: entrance]` 가 문 칸을 준다(키트 안 `dx`, `dy = 높이-1`, 폭 `w`). 문 칸 자체는 막힘이고, **문 앞 접근 칸 = 키트 바깥 한 줄 아래** (`(원점x + dx .. dx+w-1, 원점y + 높이)`). 연립처럼 문이 여럿이면 문마다 접근 칸 묶음이 있다.
  문 그림·문 앞 접근 칸·출입구 이벤트는 서로 다르다: 문 그림 = 키트 안 칸(고정), 접근 칸 = 키트 밖 보도 칸(비워 둠), 출입구(전이·상호작용) 이벤트 = 이 문서 범위 밖(예제 도시에는 이벤트가 없다).
- 반복 가능/고정: 건물 키트는 **전부 고정**(`repeatability: fixed`) — 늘리거나 가로로 이어 붙이지 않는다. 늘려도 되는 것은 도로 구간 키트뿐이다.
- 좌·우 마감 키트·안/밖 모서리 키트는 건물에 없다. 폭이 다른 건물은 다른 키트(글자 A~C)다.

## 앞줄과 뒷줄 (겹침 우선순위)
- 땅 먼저: 보도·도로는 1층에서 이미 깔렸다. 그 위 3층에 건물 키트를 **뒷줄(밑변 y 가 작은 것)부터 앞줄(밑변 y 가 큰 것) 순서로** 찍는다. 앞줄 건물의 지붕·윗부분이 뒷줄 건물의 아래쪽을 덮는다.
- 예제의 겹침은 7쌍(겹친 줄 수 최소 1·최대 4줄). 불투명한 앞줄 칸은 뒷줄 칸을 3층에서 덮어쓰고(예제 28칸), 반투명한 칸(가로등·간판처럼 가장자리가 투명한 칸)은 3층이 이미 찼을 때 **4층**에 얹는다(예제 39칸).
- 앞줄을 먼저 찍으면 뒤 건물이 앞 건물 위로 올라온다 — 오류 `back-over-front`(→ `mc-errors-overview`).
- 땅 규칙: 밑변 줄의 땅 칸은 전부 보도(`7`/`8`)여야 한다. 도로·연석·횡단보도·공원 위에 건물을 얹지 않는다(`building-on-nonwalk`).
- 문 앞: 앞줄 건물 문 앞 접근 칸에서 도로 쪽으로 보도가 이어지는 줄 수(예제 앞줄 19채): 10줄 7채, 12줄 7채, 16줄 5채. 접근 칸 자체는 **반드시** 비운다(자동 검사 `door-access-blocked`). 접근 칸 양옆 한 칸도 가급적 비운다 — 원본 생성 규칙은 문 폭 ±8px 비움이고, 칸에 맞추는 과정에서 예제는 소품 발 8곳이 바로 옆 칸에 붙었다.

## 변형 id 규칙 (총 259종 = 기본 77 + 벽색 변형 53 + 지붕색 변형 129)
- 기본: `mc-bld-<계열>-<글자>` (원본 벽·원본 지붕). 벽색 변형: `…-<벽색>` (벽만 바꿈, 지붕은 기본). 지붕색 변형: `…-roof-<지붕색>` (지붕만 바꿈, 벽은 기본, 색은 teal·navy·brick·sage·lgray).
- **벽색 × 지붕색 조합 키트는 없다.** 필요한 색이 사전에 없으면 가장 가까운 키트를 쓰고(그림이 달라질 수 있다) 새 조합은 시트에 구워 넣어야 한다(`bake_tileset.py`, 칸 번호는 덧붙이기 전용).
- 계열 표(건물 키트 사전 문서 `mc-bld-<슬러그>`에 키트마다 칸 배열·문·접근 칸):

| 계열 | 사전 문서 | 이름 | 크기(칸) | 글자 | 키트 수 | 벽색 변형 | 지붕색 변형 |
|---|---|---|---|---|---|---|---|
| `bld_tower10` | `mc-bld-tower10` | 유리 오피스 타워(10층) | 6×13 | A,B,C | 12 | cream | brick,navy,sage,teal |
| `bld_tower10b` | `mc-bld-tower10b` | 벽돌 주거 타워(10층) | 6×13 | A,B,C | 12 | slate | brick,lgray,navy,sage |
| `bld_mid4` | `mc-bld-mid4` | 민트 4층 사무·상가 | 6×9 | A,B,C | 12 | sage | brick,lgray,sage,teal |
| `bld_low3` | `mc-bld-low3` | 3층 상가주택 | 6×8 | A,B,C | 12 | gray | lgray,navy,sage,teal |
| `bld_hotel` | `mc-bld-hotel` | 호텔(7층) | 7×11 | A,C | 8 | cream | lgray,navy,teal |
| `bld_conv` | `mc-bld-conv` | 편의점 | 5×5 | A,B,C | 13 | rose,sage | brick,navy,sage,teal |
| `bld_row` | `mc-bld-row` | 2층 연립주택(4호) | 8×6 | A,B,C | 12 | cream,ochre,plum | - |
| `bld_parking` | `mc-bld-parking` | 주차 건물 | 6×8 | B | 1 | - | - |
| `bld_shop` | `mc-bld-shop` | 상점(2층) | 5×7 | A,B | 8 | tan | lgray,sage,teal |
| `bld_office` | `mc-bld-office` | 사무소(4층) | 6×7 | A,B | 8 | rose | lgray,navy,teal |
| `bld_apartment` | `mc-bld-apartment` | 아파트(5층) | 7×9 | A,B,C | 12 | ochre | brick,navy,sage,teal |
| `bld_house` | `mc-bld-house` | 단독주택(2층) | 4×6 | A,B,C | 12 | cream,gray,rose | - |
| `bld_cafe` | `mc-bld-cafe` | 카페(2층) | 5×6 | A,B | 8 | - | brick,lgray,sage,teal |
| `bld_mid6` | `mc-bld-mid6` | 6층 중층 건물 | 7×10 | A,B,C | 12 | rose | lgray,navy,sage,teal |
| `bld_bank` | `mc-bld-bank` | 은행 | 7×8 | A,B,C | 12 | - | brick,lgray,navy,sage,teal |
| `bld_school` | `mc-bld-school` | 학교 | 9×7 | A,B,C | 11 | - | brick,navy,sage,teal |
| `bld_hospital` | `mc-bld-hospital` | 병원(6층) | 7×10 | A,B,C | 10 | - | brick,lgray,navy,sage |
| `bld_dept` | `mc-bld-dept` | 백화점(5층) | 8×9 | A,C | 4 | - | brick,sage |
| `bld_warehouse` | `mc-bld-warehouse` | 창고 | 8×6 | A | 1 | - | - |
| `bld_apt_balcony` | `mc-bld-apt-balcony` | 발코니 아파트(8층) | 6×11 | A,B | 6 | - | lgray,navy,teal |
| `bld_house_modern` | `mc-bld-house-modern` | 현대식 주택 | 5×6 | A,B,C | 9 | - | brick,navy,sage,teal |
| `bld_izakaya` | `mc-bld-izakaya` | 이자카야 | 5×6 | A,B,C | 9 | slate | brick,navy,sage |
| `bld_office_wide` | `mc-bld-office-wide` | 대형 오피스(7층) | 8×10 | A,B,C | 9 | - | brick,lgray,sage,teal |
| `bld_slim` | `mc-bld-slim` | 슬림 빌딩(9층) | 4×11 | A,B | 6 | plum | lgray,sage,teal |
| `bld_bakery` | `mc-bld-bakery` | 빵집 | 4×6 | A,B | 6 | - | lgray,navy,teal |
| `bld_police` | `mc-bld-police` | 경찰서 | 7×8 | A,B | 6 | - | brick,navy,teal |
| `bld_fire` | `mc-bld-fire` | 소방서 | 8×8 | A | 3 | ochre | navy |
| `bld_post` | `mc-bld-post` | 우체국 | 6×7 | A,B,C | 9 | - | brick,lgray,sage,teal |
| `bld_gas_v2` | `mc-bld-gas-v2` | 주유소(대형 캐노피) | 10×6 | A,B | 2 | - | - |
| `bld_fire_escape` | `mc-bld-fire-escape` | 비상계단 아파트(5층) | 6×10 | A,B | 6 | - | lgray,navy,teal |
| `bld_balcony2` | `mc-bld-balcony2` | 발코니 아파트(5층) | 7×11 | A,B | 6 | ochre | navy,teal |
| `bld_parking_v2` | `mc-bld-parking-v2` | 주차 건물(4층) | 5×8 | A,C | 2 | - | - |

## 완전한 조립 예제 (예제 도시에 실제로 놓인 키트)
입력(키트 id·원점) → 3층 정답 배열 → 그림. 배열은 `tiles[행][열]`, -1 = 빈 칸(그 칸은 땅이 보인다). 문 칸은 `door.cells`(열 범위)와 `dy`, 접근 칸은 `access`(키트 원점 기준 dx,dy; dy = 높이 → 키트 바깥 한 줄 아래).

### `mc-bld-conv-C` — 편의점 C
입력: `mc-bld-conv-C` 를 원점 (55,52) 에 3층으로 찍는다(예제 도시). 그림: `mc-img-bld-kit-conv-c`(키트) · `mc-img-bld-map-conv-c`(도시에 놓인 모습).
```json
{"kit":"mc-bld-conv-C","w":5,"h":5,"variant":{"wall":null,"roof":null},"door":[{"cells":[1,3],"dy":4}],"access":[[1,5],[2,5],[3,5]],"tiles":[[994,995,996,997,998],[999,1000,1001,1002,1003],[1004,1005,1005,1005,1006],[1007,1008,1009,1010,1011],[1012,1013,1014,1015,1016]]}
```

### `mc-bld-low3-C-gray` — 3층 상가주택 C · 회색 벽
입력: `mc-bld-low3-C-gray` 를 원점 (41,23) 에 3층으로 찍는다(예제 도시). 그림: `mc-img-bld-kit-low3-c`(키트) · `mc-img-bld-map-low3-c`(도시에 놓인 모습).
```json
{"kit":"mc-bld-low3-C-gray","w":6,"h":8,"variant":{"wall":"gray","roof":null},"door":[{"cells":[2,3],"dy":7}],"access":[[2,8],[3,8]],"tiles":[[4665,773,774,775,776,4666],[4667,779,780,781,782,4668],[4669,4670,4671,4670,4672,4673],[4674,4675,4676,4677,4678,4679],[4680,4681,4682,4683,4684,4685],[4686,4687,4688,4689,4690,4691],[4692,4693,4694,4695,4696,4697],[4698,4699,4700,4701,4702,4703]]}
```

### `mc-bld-tower10b-B` — 벽돌 주거 타워(10층) B
입력: `mc-bld-tower10b-B` 를 원점 (54,22) 에 3층으로 찍는다(예제 도시). 그림: `mc-img-bld-kit-tower10b-b`(키트) · `mc-img-bld-map-tower10b-b`(도시에 놓인 모습).
```json
{"kit":"mc-bld-tower10b-B","w":6,"h":13,"variant":{"wall":null,"roof":null},"door":[{"cells":[2,3],"dy":12}],"access":[[2,13],[3,13]],"tiles":[[392,393,394,395,396,397],[398,399,400,401,402,403],[404,405,406,407,408,409],[410,411,411,411,411,412],[413,414,415,416,414,417],[418,419,420,421,419,422],[423,424,425,426,424,427],[428,429,430,431,429,432],[433,434,435,436,434,437],[438,439,440,441,439,442],[443,444,445,446,447,448],[449,450,451,452,453,454],[455,456,457,458,459,460]]}
```

### `mc-bld-row-C` — 2층 연립주택(4호) C
입력: `mc-bld-row-C` 를 원점 (0,51) 에 3층으로 찍는다(예제 도시). 그림: `mc-img-bld-kit-row-c`(키트) · `mc-img-bld-map-row-c`(도시에 놓인 모습).
```json
{"kit":"mc-bld-row-C","w":8,"h":6,"variant":{"wall":null,"roof":null},"door":[{"cells":[0,1],"dy":5},{"cells":[2,3],"dy":5},{"cells":[4,5],"dy":5},{"cells":[6,7],"dy":5}],"access":[[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6]],"tiles":[[1111,1112,1113,1114,1115,1116,1117,1118],[1119,1120,1121,1122,1123,1124,1125,1126],[1127,1128,1129,1130,1131,1132,1133,1134],[1135,1136,1137,1138,1139,1140,1141,1142],[1143,1144,1145,1146,1147,1148,1149,1150],[1151,1152,1153,1154,1155,1156,1153,1157]]}
```

## 실행 순서 (건물 하나)
1. 놓을 칸의 땅이 보도인지 본다(밑변 줄 전체 + 문 앞 접근 줄).
2. 이미 놓인 건물과 겹치면 겹친 칸 중 밑변이 큰(앞줄) 건물이 나중이 되게 순서를 정한다.
3. 키트를 3층에 찍는다. 4. 문 앞 접근 칸(반드시)과 양옆 한 칸(가급적)을 비워 둔다. 5. 그림자(2층)는 소품·건물 규칙대로 따로 깐다(→ `mc-order`).
6. 자동 검사(`building-on-nonwalk`·`back-over-front`·`door-access-blocked`)가 0 인지 본다.
