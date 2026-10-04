# jp-city — 일본 도시 칩셋(jp_city) 그림 후보 하네스

번들 타일셋 `jp_city`(modern3 팔레트, 16px 칸, 3/4 시점)에 넣을 **주택가·역·공원·신사** 그림을 사람이 후보 중에서 고르게 한다.
타일셋마다 하네스를 따로 둔다는 규칙에 따라 `modern-chipset`(modern4)을 복제해 만들었다. 생성 이미지가 아니라 pxgrid 로 한 글자씩 놓는 손 도트다.
**이 하네스는 `pick` 결과를 `harness-data/jp-city/picked/` 에 남기는 데까지만 한다.** 시트에 굽는 일(`bake`)은 하지 않는다 — 굽기는
`scripts/content/jp-city/bake_jp.py` 가 고른 후보를 블록으로 읽어서 한다(자리 키 핀이라 번호 안정). 계획서: M5 절.

## 흐름
```
draw <항목> [--n 5] ─► 판 j<MMDD-HHMMSS> (qa-runs/harnesses/jp-city/<판>/, gitignore)
   Sonnet 5.5 high × 5 (A 목표 충실 · B 큰 면 · C 일본식 디테일 · D 이웃 정합 · E 자유)
   → check.py (기계 검사)  불합격이면 이유 들고 다시 그림
   → 독립 검수자(review.md): 참고 그림 옆에서 8배·3배·맥락으로 PASS/FAIL  FAIL 이면 다시 그림(최대 3번)
sheet ─► ~/claude-viz/jp-<판>.html (자체완결: 참고 그림·후보 6배·맥락/조립 3배)   사용자가 고른다
pick ─► harness-data/jp-city/picked/<항목>.pxg|png (+ palette.pal 사본) + ledger.json   ← 여기까지
```
감독자는 고르지 않는다. 검수 ✓ 는 보증이 아니다 — 사용자가 고른 것만 정본. 통과율 숫자를 근거로 쓰지 마라.

## 명령 (`python3 src/harnesses/jp-city/harness.py …` 또는 `npm run harness -- jp-city …`)
| 명령 | 뜻 |
|---|---|
| `palette` | `harness-data/jp-city/{palette.pal,mats.txt}` 다시 쓰기 |
| `validate` | 시드 점검(크기·슬롯·칸·조립 예·참고 그림이 풀리는가) |
| `list [--wave houses\|station\|park\|shrine]` | 시드 항목 목록, 고른 것은 ★ |
| `anchors` | 시드 anchors 크롭을 `harness-data/jp-city/anchors/` 에 써서 눈으로 확인 |
| `draw <항목> [--n 5] [--note …] [--fg]` | 판을 열고 백그라운드로 그린다(판 id 출력) |
| `status [판]` · `sheet <판>` · `review <판>` | 현황 · 고르기 시트 · 다시 검수 |
| `pick <판> <글자>` · `reject <판> <글자> --why …` | 사용자가 고름 · 버림(다음 판 「하지 말 것」) |

환경 변수: `JP_HARNESS_MODEL`(기본 `claude-sonnet-5-5`)·`JP_HARNESS_EFFORT`(high)·`JP_HARNESS_ATTEMPTS`(3)·`JP_HARNESS_TIMEOUT`(초, 2400).

## 파일
| 경로 | 역할 |
|---|---|
| `src/harnesses/jp-city/harness.py` | 명령줄 본체(brief 만들기·작업자/검수자 호출·시트) |
| `palette.py` | modern3 램프 → `palette.pal`(`@rampc` 28줄)·`mats.txt`(`@mat 글자 램프 기본단`, 글자 a–z A B) |
| `check.py` | 기계 검사. 시점은 수치로 대신하지 않는다 |
| `anchors.py` | 시드 `refs` 해석기(`anchor:` `prop:` `cand:` `img:`) |
| `prompt.md` · `review.md` | 작업자·검수자 지시문 |
| `style-common.md` · `style-<kind>.md` · `criteria-<kind>.md` | 화풍 계약(brief 에 붙음) · 검수 판정 순서(review 에 붙음) |
| `harness-data/jp-city/seed.json` | 항목 40개·anchors·context(땅 칸)·계약 |
| `harness-data/jp-city/picked/` | 사용자가 고른 그림(bake_jp.py 입력) · `ledger.json`(pick/reject 이력) |

## 시드 항목 (kind: `building-part` 건물 외형 · `prop` 소품 · `tilesheet` 바닥 타일 · `kit` 여러 칸 부품 + 조립 예)
항목 하나 = 한 가지 그릴 것. 크기는 칸×16px, 통행 의도 `walk`(solid 막힘 · walk 걸음 · star 위로 지나감 · mixed 칸마다).
- **houses (12)** `house_gable_kawara` `house_gable_slate` `house_hip_kawara` `house_garage_modern`(5×5) · `apartment_wood2`(5×5) · `blockwall_kit`(5×2, 담·모서리·철문 2칸·우편함) · `bike_parking` · `garbage_station` · `utility_pole`(1×4) · `wire_overlay`(4×1 투명 칸) · `vending_pair` · `garden_props`
- **station (8)** `station_building`(8×5) · `platform_tiles`(3종) · `platform_roof_kit` · `platform_bench` · `platform_door_kit` · `ticket_gate_kit`(기계+통로) · `ticket_vending`(1×2) · `station_signs`(3종)
- **park (9)** `pond_edge_kit`(호안 8+징검돌 4) · `stone_lantern`(1×2) · `sakura_tree`(3×4) · `petal_overlay`(3종) · `playground_set` · `public_toilet`(4×3) · `azumaya`(4×4) · `drinking_fountain` · `park_fence_kit`
- **shrine (11)** `torii_kit`(3칸·5칸 조립) · `komainu_pair` · `shimenawa_kit` · `saisen_box` · `ema_rack` · `omikuji_rack` · `haiden`(6×5 가라하후) · `honden`(4×4) · `stone_stairs`(3×3) · `temizuya_roofed`(3×3) · `cedar_tree`(2×4)
- 석등 한 쌍은 park 의 `stone_lantern` 재사용, 참배길 자갈은 기존 `jp-gravel-lawn` 이라 제외.

시드 필드: `kind` `wave` `title` `desc` `size[칸w,칸h]` `walk`(+`walk_note`) `brief`(작업자 지시) `refs` `ground`(검수 맥락 바닥: context 키) `flags` · 슬롯 있는 소품 `slots[{id,x,y,w,h,walk}]` · 타일 `seamless_cells`+`seam_axes` · 키트 `cells{이름:{x,y,walk,repeat,opaque}}`+`examples{이름:{grid,base}}`.
flags: `overlay`(투명 덧칠: 윤곽·접지·귀퉁이 검사 제외) · `thin`(1px 선 허용) · `bleed`(귀퉁이 불투명 허용) · `multi` · `no_outline`.

## 기계 검사 (check.py) — 깨짐만 거른다
공통: `@cell 16` 선언 · 크기 = 칸×16 · `#` 잔존·마커색 #e040c0 화소 · **modern3 밖의 색** · **반투명 화소** · 빈 그림.
오브젝트: 귀퉁이 투명 · 가장자리 80% 이상이 램프 단 0~1(또는 sumi) 윤곽 · 맨 아래 접지 · 한 덩어리 · (건물) 맨 아래 줄 윤곽 60%.
슬롯: 빈 슬롯 · 슬롯 밖 화소(COVER) · 슬롯마다 접지. 타일: 꽉 찬 불투명 · 반복 이음(시드 축). 키트: 빈 부품 · 이름 없는 칸의 화소 · opaque 칸 · repeat 칸 이음.
시점·일본식 디테일·읽힘·통행 일치는 독립 검수자가 눈으로(`criteria-*.md` 코드: FRONT TOPDOWN FLAT STICKER HOLE NARROW WINDOW SEAM JOIN THROUGH …).

## 함정
- **154색은 한 글자 한 색으로 못 담는다.** pxgrid 램프 격자(`@mat` → `@mblock` 재료, `@tblock` 단, `@tadj` 단 옮김)를 쓴다. 작업자가 `mats.txt` 28줄을 파일 머리에 붙인다. 선례 `tiledata/atlas-pick/candidates-jp/*/`.
- `candidates-jp/` 옛 후보는 **옛 jp.pal 색**이다. 구조·비율만 참고(`cand:` 참고 그림에 경고가 붙는다), 색·화소 금지. 기존 시트(`prop:`)·지구 그림(`anchor:`)도 눈으로만.
- 사람·행인·글자(한자·가나·알파벳)·상표 금지(Actor1 은 번들에서 빠졌다). 간판·편액·역명판은 색 판으로 비운다. 한자 간판 글리프는 시트 쪽(`glyphs.json`)에만 있다.
- 키트(여러 칸) 항목은 칸 표·조립 예가 검수 대상이다. 가로 반복 칸은 좌우 이음, 세로 반복은 상하 이음이고 이음 높이(윗선 y 등)를 brief 가 정한다. 도리이·개찰구·문 칸은 위→아래로 걸어 지나갈 수 있어 보여야 한다(통행 지도 `kit-x3.png`).
- 검수 맥락 바닥은 시드 `context` 의 기존 시트 칸(`st.sw` `st.lawn` `st.sando` …, 카탈로그 `tiledata/jp-city/sources/jp_shopstreet16.catalog.json` 의 이름 → 칸 번호, 16열)이다. 카탈로그 이름이 바뀌면 `validate` 가 먼저 잡는다.
- 한 판의 시트 HTML 은 `~/claude-viz/jp-<판>.html`. 같은 판을 다시 열면 덮어쓴다.
- `qa-runs/` 는 gitignore 다. 고른 것만 `picked/` 에 커밋된다 — 고르지 않은 후보 그림은 남지 않는다.

## pick 절차 (사람)
1. 항목 하나를 `draw` → 판 id → 시트 주소를 사용자에게 준다(감독자가 대신 고르지 않는다).
2. 사용자가 글자를 고르면 `pick <판> <글자> [--note]`, 버릴 후보는 `reject <판> <글자> --why …`.
3. `picked/<항목>.pxg|png` 가 생긴다(+`palette.pal` 사본, 상대 경로로 다시 렌더 가능). 다음 `draw` 의 brief 는 picked 전부를 「이웃 정합」 기준(방향 D)으로 붙인다.
4. 한 묶음(wave)이 끝나면 `bake_jp.py` 가 `picked/<id>.png` 와 시드(`kind`·`cells`·`slots`·`examples`·`walk`)를 읽어 블록으로 굽는다.

## 복제에서 바꾼 점 (modern-chipset 대비)
팔레트 modern4 문자 풀 → modern3 램프 격자 · 탈것 시점(side/front/back) 제거 → 항목 하나 · kind `vehicle` → `building-part` `prop` `tilesheet` `kit`(+슬롯·조립 예·통행) · 검사: modern3 밖 색·반투명·`@cell 16`·슬롯 COVER·키트 이음 추가, 탈것 바퀴·대칭 제거 · 검수 맥락: 기준차 대신 도시 화풍 목표(`anchor`)·이웃 조각(`prop`) · `bake`·codex 백엔드 제거 · 사람 눈금(Actor1) 대신 사람 없는 눈금 그림.
