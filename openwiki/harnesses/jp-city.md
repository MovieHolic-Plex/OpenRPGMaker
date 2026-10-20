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

## 거리 구성기 조화 검수 — 적대 시각 QA 한 판 (2026-10-13)

`planJpCityStreet`(`src/project/jpCityStreetComposer.ts`)로 거리를 짜면 3/4 관문(object-gate)은 **그림 한 장**만 본다. 그림이 다 합격해도 **배치·바닥·소품 조화**는 따로 깨진다
(잔디 한 판·떠 있는 옥상 간판·소품 겹침·길 한가운데 뜬 회색 막대). 그래서 구성기 규칙을 고친 뒤에는 **적대적 시각 QA 를 정확히 한 판** 돈다.

1. 씨앗 3·7·11(+조수 지도 한 장)을 `bun scripts/qa/jp-street-probe.mts --out <폴더> --from N --seeds N [--w 64 --h 56 | --style residential]` 로 원해상도 렌더한다
   (`NOMARK=1` 이면 시작 칸 표식을 안 그린다 — 예전 QA 가 이 표식을 「커서 사각형」 결함으로 적었다. 한 장에 2~3분).
2. 독립 검수자가 결함을 상자 좌표·원인 줄과 함께 적고 0~10 점을 매긴다. 원인은 구성기 줄 번호까지 찍는다(`/tmp/harmony-qa.md` 형식: 결함 표 + 순위 수정 목록).
3. **그 목록을 위에서부터 한 번 고친다.** 다시 검수 루프를 돌리지 않고, 같은 씨앗을 다시 렌더해 전·후 쌍으로 확인만 한다. 점수는 정직하게 다시 읽는다.
4. 고쳐야 할 것 중 그림(키트)을 다시 그려야 하는 것은 `object-gate review` 영수증을 새로 받기 전에는 굽지 않는다(`bake_jp.py` 가 거절한다). 구성기 규칙으로 풀 수 있으면 그림은 건드리지 않는다.

이 판에서 굳은 구성기 규칙(되돌리지 말 것):
- 대지 바닥은 **한 지도에 하나**(자갈 참배길). 잔디는 담·생울타리로 둘러싼 **앞마당 줄**(폭 4+ 이고 나무가 설 때)에만 — 띠 전체·구획 전체 잔디 금지.
- 광장(판석) 띠의 빈터는 잔디 대신 나무+벤치/화분/돌등롱으로 꾸민다. 판석 위 풀 조각 금지.
- 옥상 간판 띠(`roofsign.*`)는 3층+·폭 6+ 건물, 구획당 하나, 반드시 글자(`rtext.*`)를 얹는다. 노랑 판은 안 쓴다.
- 노면 「30」 은 동쪽행 `road0`, 서쪽행 `road1-1` (키트가 側溝·흰 선 줄을 자기 가장자리 줄에 품고 있다).
- 겹침 정리는 둑·다리 소품(`bank`/`bridge`)도 같이 보고, 소품끼리 한 칸 여백을 둔다. 가로등·전봇대는 나무·주차장 빈터·건물 좌우 한 칸에 서지 않고, 전선으로 이어지지 않은 전봇대는 안 세운다.
- 잔디 오토타일(`jp-lawn-dirt`)의 바깥 질감은 맨흙이 아니라 대지 자갈이다(자갈·판석과 닿는 곳의 갈색 테두리 제거).
- 조수가 구성기 밖에서 건물을 손으로 놓을 때의 약점(문 앞 보도 없음·옥상 간판이 지붕보다 넓음)은 구성기가 못 막는다 — 조수 지침: 건물은 `compose_jp_city_street` 띠 안에만, 옥상 간판은 `head` 를 비워 둔다.

## 일본 시골(jp-inaka) 쇼케이스 적대 VQA R4 (2026-10-20)

조립기 `src/editor/jpCity/inakaCountrysideComposer.ts`, 렌더 `bun scripts/qa/jp-inaka-showcase.mts --out <폴더>`(**`--out` 을 꼭 준다** — 빼면 보고서 폴더 `claude-viz/jp-inaka-countryside-1/` 의 6장을 덮어쓴다), 그림 `scripts/content/jp-inaka/`.
배치만 고친 판(그림 화소 변경 없음)에서 굳은 규칙:
- 전선 키트(`jp-wire-L`) 윗줄은 **그 줄에서 쓰는 전봇대 키트의 높이**로 정한다(`jp-pole-wood` 9칸, `jp-pole` 10칸). 예전엔 늘 10칸으로 계산해 나무 전봇대 줄의 전선이 애자보다 1칸 위 허공에 떴다.
- 2×4 소방 망루 같은 키 큰 소품은 전봇대 열(키트 x..x+2) 3칸 안에 두지 않는다(4층 전봇대 완목이 망루 다리를 덮는다).
- 다랑논: 논 → 흙 논두렁 1줄 → 이끼 돌담 2줄 → 아랫단 논. 논과 돌담의 동쪽 끝을 같은 열에 맞추고, 돌담 줄이 중간에 한 칸 꺾이지 않게 한다.
- 개울(연못 오토타일)은 큰 사각 웅덩이 6개가 아니라 2줄 높이 띠를 1칸씩 비켜 쌓는다. 4~6칸 개울에 6칸 어선(`jp-rg-fishing-boat`)을 띄우지 않는다.
  띠를 한 방향으로만 1칸씩 계속 비키면 계단 운하가 된다(R4 2차) — 좌우로 굽이치게 번갈아 비킨다. 1줄 띠는 연못 테가 삼키므로 띠는 2줄 이상.
- 세워 둔 자전거 등 작은 소품은 전봇대 키트 열(x..x+2) 안에 두지 않는다(기둥이 소품 한가운데를 가른다).
- 숲은 발 행 순서로 찍고, 위아래 이웃 나무는 종류를 바꾸며 1~2칸 비킨다(세로 기둥 줄 금지). 전봇대는 石垣 축대 앞면을 가리지 않는다.
남은 그림 결함(돌담 이음매·논 가장자리·죽담 사다리꼴)은 그림 화소를 바꾸므로 object-gate 영수증 상태를 PR 본문에 적고 사용자 결정까지 머지하지 않는다.

## 숲 키트 시제품 r1 — 이어지는 수관 오토타일 (2026-10-20, 초안·미굽기)

- 진단: 지금 숲은 한 그루짜리 키트(rg-sugi·rg-pine·대숲)를 `regionComposer` 가 흩뿌린다. 시트에 수관끼리 이어지는 칸이 없어서 빽빽하게 깔아도 스티커 무리가 되고 잔디가 비친다. 키트 5~6칸이 전부 숲 구획 안이어야 해서 폭 3~4칸 숲 띠는 비어 버린다. 수관은 `disc()` 5단 동심원이라 「동글동글」하다.
- 시제품 `scripts/content/jp-city/forest/forest_kit_proto.py`(코드 손 도트, 위치 해시): 수관 8방 오토타일(canon 47 + 몸통 변형 4×2 + 위 가장자리 변형 4), 몸통 위 수관 머리 키트, 하늘선 키트, S 가장자리 밑 줄기 띠(활엽 1칸·대숲 2칸), 한 그루 나무 3종으로 이루어진다. 활엽·대숲 두 벌이고 계약 재료 + 보조 램프 ki·kokuban 만 쓴다. 비교 페이지는 `forest_kit_viz.py` → `~/claude-viz/jp-forest-kit-1.html`, 그림은 `tiledata/jp-city/forest-proto/`.
- 상태: **시트에 굽지 않았고 regionComposer 도 바꾸지 않았다.** object-gate 3/4 는 통과했지만 화풍이 FAIL 4/4 다(칸 정보량, 프로필 ee216f0de5822996 미보정). 사람이 방향을 고르기 전에는 번들에 넣지 않는다.

## 대나무(대숲) 재작화 — R4 적대 VQA (2026-10-20)

사용자: 「대나무가 끔찍하다」. 지역 팩 `scripts/content/jp-city/blocks/jp_regions_pack.py` 의 대숲은 4~5px 굵은 기둥에 10px 마다 검은 마디 띠, 활엽수와 같은 둥근 덩이 수관이라 「초록 철창 위 브로콜리」로 읽혔다. 산길(21)에서는 이 4×6 덩이 하나만 되풀이해 같은 꼴이 쌓였다.

- **대나무 문법(공용 함수, 다른 팩은 import 해서 쓴다 — 다시 그리지 말 것):** `bamboo_culm(c, x, top, bot, w, depth, seed, lean)` 줄기 2~3px(왼쪽 빛·몸·오른쪽 그늘, 줄기마다 윤곽선 없음), 마디 7~9px 간격·줄기마다 어긋남, 마디 위 2줄 턱 그늘, 끝 6px 가늘어짐, 위로 갈수록 휘는 `lean`. `bamboo_spray(t, x, y, ln, lv, bias)` 아래로 처지는 笹 잎 부채(밑동 2px → 끝 1px). `bamboo_plume(...)` 엇갈린 격자로 뿌린 잎 부채 무리(그늘 쪽부터 칠해 밝은 잎이 위). `bamboo_grove_art(...)` 3/4 발치 이끼 둔덕 타원 + 마른 댓잎 + 오른쪽 아래 그늘, 가장자리가 늦게 시작하는 숲 속 그늘, 뒤 줄기 → 잎 무리 → 앞 줄기 → 잔가지 잎 → 죽순 원뿔 순서.
- **키트:** `jp-rg-bamboo-grove`(4×6, 같은 id·같은 발 칸·같은 칸 번호 — 24칸을 제자리에서 다시 칠함, 저장 지도 번호 불변) + 새 `jp-rg-bamboo-grove-b`(3×6, 발 1칸) · `jp-rg-bamboo-clump`(2×4, 발 2칸) — 새 칸 26개는 끝에 덧붙음(17027~17052, 이동 0).
- **구성기:** `src/editor/jpCity/regionComposer.ts` 숲 채움이 대숲을 고를 때 넓은 덩이 50% · 좁은 덩이 32% · 작은 무리 18% 로 섞는다(`bambooVariant`). 나무 판별·지역 허용 목록에 두 변형을 더했다. 같은 x 에 밑동 차 6칸 미만으로 앞뒤 쌓던 나무(세로 기둥처럼 줄 서던 것)는 그 자리를 옆으로 어긋난 후보에 넘긴다(`clashesWithPlaced`).
- **3/4 관문(정직):** `object-gate review` 영수증 3장(`a86b1cdfecfc` grove · `d6dec45328d6` grove-b · `9c8958739874` clump) — 3/4 반쪽 통과(4/4), **화풍 반쪽 불합격(4/4, 「칸 정보량이 기준보다 훨씬 낮음」)**, 프로필 `ee216f0de5822996` 미보정 → **관문 미통과**. 옛 대숲(`91fb2352ed07`)·기존 `rg-sugi`(`68c36e6d6582`)도 같은 반쪽에서 불합격이다(옛 대숲 「평면 채움·질감 없음」, 이 두 영수증은 비교용이라 저장소에 넣지 않았다). 원인은 측정됐다: 버들항 나무 기준 그림은 16px 칸당 고유색 중앙값 약 100, jp_city 팔레트 계약(재료당 5단)의 대숲 칸은 8(최대 15)이다 — 계약 색을 지키는 한 이 지표로는 통과할 수 없다. 기준을 낮추지 않았다. 병합은 사용자 판단 대기(jp_city 화풍 기준 그림을 따로 둘지).
- jp-inaka(`inaka_art_props.py` 죽담·허수아비 대)도 이 함수를 import 해서 쓰기로 했다(같은 대나무 두 화풍 방지).
- 남은 것(이 판에서 안 고침): 쇼텐가이 아치의 실제 한자 「商店街」(글자 금지 규칙과 충돌 — 예전 판에서 사용자가 받아들인 그림이라 그대로 둠), 삼나무도 같은 화풍 반쪽 불합격(곰솔·단풍은 판정 안 함).
