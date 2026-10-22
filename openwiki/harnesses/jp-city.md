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
- 사람·행인·상표·로고 금지(Actor1 은 번들에서 빠졌다). **간판·편액·역명판의 일본어 글자(한자·가나)는 허용**(2026-10-20 사용자) — 실제 회사·상표 이름은 금지, 1배에서 읽히는 크기. 글자는 `glyphs.json`(jiskan16, 퍼블릭 도메인) 글리프로만 찍는다.
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
그림 판(R4 PR-A, 사용자 결정 전 머지 보류):
- 이끼 돌담 `inaka-mossy-stone-wall` 은 양옆 윤곽을 두르지 않고, 돌 줄 높이를 6·7·6px 로 고정한다. 이음 토막 `inaka-mossy-stone-wall-mid`(새 키트, 칸 덧붙이기만)는 같은 줄 높이에 돌 폭·엇갈림·이끼만 다르다 — 긴 담은 둘을 번갈아 놓아 4칸마다 검은 세로 이음매·같은 돌 무늬가 되풀이되지 않게 한다. 윗길 풀포기는 윤곽 없는 풀잎(검은 가시로 읽히던 OL 끝 제거).
- 논 바닥 3종(물논·여름·황금)은 포기 줄 사이에 한 단 어둡거나(벼) 밝은(물에 비친 하늘) 가로 결을 넣어 1배에서도 줄무늬로 읽힌다. 모 끝은 물보다 두 단 밝게.
- 논 북쪽 둑 가장자리 바닥 3종 `inaka-paddy-{water,summer,golden}-bank`(새 바닥 그룹): 논 맨 윗줄에 한 줄 깔아 논두렁 둑 앞면·그늘이 흙과 논 사이 칼 경계를 대신한다.
죽담 판(R4 PR-B, #3026 대숲 문법 결정에 묶인 초안):
- `inaka-bamboo-fence-gate` 는 建仁寺垣 판 — 3px 쪼갠 대를 빈틈없이 세우고(줄기마다 윤곽 없음·마디 높이 엇갈림), 갓대 윗면 3줄 + 앞 그늘 1줄, 누름대 2줄과 검은 종려 끈 매듭. 실루엣에만 윤곽. 마디가 한 줄에 맞춰지고 가로대 3줄이면 사다리로 읽힌다(R4 지적). 줄기 문법 `bamboo_culm` 은 #3026 의 jp_regions_pack 과 같은 규칙을 이나카 팩에 사본으로 둔다.
- 대숲 스탬프 12개 중 5개를 #3026 의 `jp-rg-bamboo-grove-b`(3×6)·`jp-rg-bamboo-clump`(2×4)로 바꿔 같은 덩이가 기둥처럼 되풀이되지 않게 한다(#3026 없이는 이 키트가 없다).
남은 그림 결함(돌담 이음매·논 가장자리·죽담 사다리꼴)은 그림 화소를 바꾸므로 object-gate 영수증 상태를 PR 본문에 적고 사용자 결정까지 머지하지 않는다.

## 일본 시골(jp-inaka) R5 — 버들항 수준 재작화 (2026-10-20)

R4 의 PR-A(#3054)·PR-B(#3056)를 대체한다(그 두 가지를 이어받아 #3026 대숲 포함). 그림 판이라 사용자 결정 전 머지 보류.
- **모듈 분리:** `scripts/content/jp-inaka/` 가 `inaka_art_ground.py`(바닥·오토타일) · `inaka_art_walls.py`(돌담·죽담·수문 등) · `inaka_art_houses.py`(건물 10) · `inaka_art_props.py`(소품·탈것 15)로 나뉘고 `bake_inaka.py` 가 묶는다. 키트 id·크기·통행은 그대로, 칸 번호는 덧붙이기만(pins).
- **화풍 도우미 `inaka_style.py`:** `tint_outlines(c)` 는 그림을 다 그린 뒤 근흑 윤곽(sumi·OL)을 닿은 재질의 어두운 톤(허용 팔레트 안)으로 바꾼다. `ground_shadow(...)` 는 알파 0/255 규칙 때문에 투명 칸에만 체커 디더 그늘을 깐다. 새 이나카 그림은 둘 다 부른다.
- **대조판 `render_kit.py --ids a,b --out <폴더>`:** 저장소에 쓰지 않고 [기준선(R5 시작 커밋) | 지금 | 버들항 같은 종류] 를 풀밭 위 같은 배율로 그리고 칸당 색 수·5×5 평면 비율·근흑 윤곽 비율을 찍는다.
- **바닥 = 이나카 전용 8방 오토타일 6종**(`jp-inaka-at-{grass,dirt,stream,paddy-water,paddy-summer,paddy-golden}`, 재료 이름 「시골 풀밭·시골 흙길·시골 개울·시골 물논·시골 여름 논·시골 황금 논」). 가장자리는 재료 쪽 칸에 그린다: 흙길은 풀이 흙 위로 삐죽 덮고 북·서 풀 테 밑 그늘 한 단, 개울은 북쪽 흙 둑 앞면·젖은 선·둑 밑 물 그늘, 논은 논두렁 둑(풀 어깨·다진 흙·풀 어깨)이 저절로 생긴다. 그래서 R4 의 `inaka-paddy-*-bank` 그룹은 지웠다. 옛 단일 칸 그룹 10개(번호 유지)는 새 몸통으로 다시 칠했다.
  - 풀밭은 버들항 풀처럼 거의 단색 면 + 드문 그늘 덩이·점 무리 변형이다. 1px 점 노이즈·황토빛(moss) 점은 사포·흙처럼 읽혀서 뺐다(Argon 3차).
  - 논은 8px 마다 한 이랑(잎끝 실루엣·몸 4줄·밑동·고랑)이다. 4px 줄은 1배에서 블라인드 무아레가 된다.
  - 넓은 면 벽지는 몸통 변형을 5개(b1~b5)로 늘려 깬다. `painted()` 가 build_set 의 b1·b2 뒤에 덧붙인다.
  - 엔진은 5×5 가 다 이어진 칸에만 몸통 변형을 쓴다 → 2칸 폭 흙길 몸통에는 눈에 띄는 돌을 두지 않는다(16px 마다 같은 돌이 줄 선다).
- **구성기:** 6장 모두 바닥이 「시골 풀밭」이고, 흙 마당·논·개울은 위 재료로 깐다. 신사·역 자갈은 그대로 둔다.
- **적대 검수:** Argon(gemini-4-argon-high) 3회. 6장, 6장, 논 2장을 버들항 2장 옆에 두고 보였다(`argon_judge.py`, 키는 출력하지 않는다). 남은 지적 중 jp_city 재사용 부품은 다시 그리지 않고 보고만 한다: 삼나무·벚나무·느티나무 「고무풍선」+근흑 윤곽, 전봇대 갓·검은 전선, 무늬 없는 아스팔트, 콘크리트 수로 깊이, 생울타리 반복, 측면 흰 승용차, 통근 열차 밀도, 역 간판 글씨.
- **3/4 관문:** PR 본문과 보고서에 영수증을 그대로 적는다. 프로필은 rejected(미보정)라 영수증에 효력이 없다. 바닥은 3/4 반쪽은 통과하고, 화풍 반쪽은 「칸 정보량」에서 떨어진다. 버들항 바닥 칸은 고유색이 수십 가지인데 계약 팔레트 안에서는 그 수에 닿지 못한다. 기준은 낮추지 않았다.

### R6 — 세로(남북) 깊이 (2026-10-20)
사용자: 「공간 깊이가 가로로만 있다. 건물도 세로 깊이가 있어야 한다. 비닐하우스는 세로로 아주 길어야 한다.」
3/4 탑뷰에서 남북 깊이는 화면 세로 길이로 보인다. 지붕·윗면이 실제 깊이에 비례하는 줄 수를 차지하고, 그 아래에 앞벽 높이가 온다(버들항 집은 지붕 면이 그림 높이의 45~60%).
- **키트 발판:** 고민가·기와 농가 6×7, 토장 4×5, 막과자 5×6, 간이역 7×6, 물레방아간 4×5, 함석 헛간 4×5, 대합실 3×4, 지장 사당 3×3, 경트럭 4×3, 트랙터 4×4.
- **비닐하우스는 3×7 남북 터널**이다. 앞 아치 끝(문)이 보는 사람을 향하고, 늑재가 위로 물러난다. 여러 동은 옆으로 나란히 놓는다.
- **그리는 방법:** 몸채를 옛 좌표 그대로 D px 아래로 내려 그리고(`_below`·`_shift`), 지붕만 전체 캔버스에서 처마를 D 만큼 내린다.
- **탈것**은 3/4 차량 문법을 따른다. 차 폭(남북)은 윗면 10~14px, 옆면은 그보다 낮게 그린다. 캡 지붕·짐칸 바닥·보닛·캐노피·바퀴 트레드 윗면이 보여야 한다.
- **구성기**는 키트가 아랫줄을 고정한 채 위로 자라도록 y 를 옮긴다. 지도 05 는 집 지붕이 위 가장자리에 잘리지 않게 길 아래 전체를 2줄 내렸다.
- **굽기:** 3/4 관문 재보정 전에는 저장소에 굽지 않는다. 미리보기는 `scripts/content/jp-city/inaka/preview_r6.sh [출력] [01..06]` 이다. 저장소 밖 스크래치 체크아웃 `~/.cache/oprn/inaka-preview`(`$INAKA_PREVIEW_DIR`, `/tmp` 는 지워진다)에 그림·구성기를 복사해 거기서 굽고 6장을 렌더한다. 깊이 적대 판정은 같은 폴더의 `argon_judge.py argon-depth-prompt.md <기준> <지도…>` 로 한다. 따라서 이 판의 저장소 칩셋 PNG·JSON 은 아직 R5 그림이고, 구성기 발판과 다르다. 굽기 전에는 지도에 쓰지 말 것.
- **Argon 깊이 판정:** 시골 건물·비닐하우스·헛간·대합실·지장 사당은 PASS. 트랙터·채소 판매대·망루는 FAIL, 경트럭은 판정이 엇갈림. 빌려 쓴 jp_city 건물·버스·승용차도 같은 기준에서 FAIL 이다(보고만).

### R7 — 지붕 높이 상한·투영 밑그림 (2026-10-20)
사용자 판정: 파일럿(고민가·비닐하우스·트랙터) OK, 「지붕이 세로로 너무 길어지는 경우만」 고친다.
- **지붕 비율 = 지붕 꼭대기~처마 밑선 ÷ 건물 높이(그림자 제외), 정면 벽 열에서 잰다.** 버들항 실측: 통나무 긴 집 60%, 오두막 약 52%, 판자집 약 54%, 작은 오두막 약 41%, 2층 저택 약 45%. 시골 경사·초가 지붕은 **55% 이하**(40% 로 잘라 보니 모두 정면도로 읽혀 폐기). 줄을 덜어 내고 질감을 누르지 않는다. 비닐하우스는 터널이라 예외.
- **투영:** 점 (x, y=북, z=위) → sx = x, sy = 바닥 − 0.65·y − z. 남북 반원통(비닐하우스)의 갈비대는 하나하나가 남쪽 아치와 같은 온전한 ∩ 로 찍혀 위로 쌓인다(「얕은 북쪽 호」는 틀린 그림). 동서로 놓인 탈것 바퀴는 온전한 원, 남북으로 놓인 바퀴는 세로 띠가 된다.
- **밑그림 도구:** `scripts/content/jp-city/inaka/tunnel_underdraw.py`(반원통), `box_underdraw.py`(상자·원기둥·각뿔 — 경트럭·망루·자전거·트랙터 모형), `underdraw_composite.py`(판정 시트: 위에 [밑그림 | 최종] 4배, 아래 pilot_sheet 줄). 기하가 까다로운 조각은 밑그림 위에 손 도트로 찍고, 판정자에게 밑그림을 함께 보여 준다 — 비닐하우스는 기준 그림 없이 물으면 3/3 NO(「사일로」), 함께 주면 3/3 YES.
- **판정 묶음:** `argon-final-prompt.md`(끝에 VERDICTS 한 줄), `argon-underdraw-prompt.md`(밑그림 줄 추가). 판정자는 같은 그림에도 YES/NO 가 뒤집히므로 3회 이상 세어 쓴다.
- **크기 변경(구성기 반영, 아랫줄 고정):** 고민가 6×6, 기와 농가 6×5(下屋 없는 단층), 물레방아간 4×4, 비닐하우스 4×7, 자전거 2×2. 지도 04 는 비닐하우스 윗줄 세 동·아랫줄 두 동을 흙 고랑 1칸 사이로 세우고 다랑논을 16칸 폭으로 줄였다.
- **R8(사용자 결정): 지붕은 건물 높이의 약 25%.** 55% 상한은 폐기. 낮은 지붕이 정면도로 읽히지 않게 용마루 밝은 띠→처마로 한 방향 명암, 위가 좁은 사다리꼴 윤곽·우진각 모서리선, 벽에 4줄 처마 그림자, 벽을 키워 건물 높이 유지. 판정 질문 `argon-r8-prompt.md`(25% 고정, 「지붕을 높여라」 금지), 밑그림 `box_underdraw.py house-<kit>`(낮은 우진각·박공 집 모형). 3회: 기와 농가·간이역 3/3, 함석 헛간 2/3, 나머지 다섯은 다수결 NO.
- **남은 것:** 트랙터(사용자 승인본)는 Argon 0/5(「바퀴 옆 원판」), 3/4 관문(object-gate)은 미보정이라 영수증 없음, 저장소 굽기 보류.

### R14 — 손 도트 유지·Opus 독립 VQA 관문·굽기 (2026-10-21)
사용자: 「건물에서의 object gen 은 포기하고 진행해라」. R13b 손 도트 건물을 그대로 두고, 이 팩이 굽는 새 그림 전부를 Opus 5.5 medium 독립 적대 VQA 로 관문을 거친 뒤 굽는다.
- **관문 그림 = `bake_inaka.gate_items()`**: 키트 31 · 바닥 그룹 16장(그룹 칸을 8열로 이어 붙인 판) · 함께 바뀐 jp_regions_pack 대나무 3. 종류는 `GATE_KIND`(건물·구조·담 → structure, 우물 → container, 탈것·소품 → other, 꽃 → organic, 기둥 → column, 디딤돌 → terrain). `python3 scripts/content/jp-inaka/bake_inaka.py --gate-out <폴더>` 가 PNG 와 `object-gate enqueue` 용 items.jsonl 을 쓴다.
- **굽기 관문:** `bake_inaka.py --bake` 는 `require_gate()` 로 50장 전부를 `object_gate.require_all(context='bundle')` 에 통과시킨 뒤에만 `bake_jp.bake` 를 부른다. 우회 없음. 미리보기(`preview_r6.sh`)는 스크래치 체크아웃 안에서 `bake_jp.bake` 를 직접 부르므로 관문을 대신하지 않는다.
- **판정:** 계약은 object-gate 최종 판정 지시문(`final.mts` FINAL_SYSTEM, 3/4 charge 1-7 · 화풍 8a-8d) + 건물은 jp_city 지붕 문법(지붕 몫 30-36%·처마 순서·위 1~2줄만 4px 줄눈·鬼瓦·寄棟 세로 줄 삼각면·초가 불규칙 짚결·함석 12행 이음새). 같은 칩셋 기준 그림은 jp_city 건물·소품·탈것. 4판(gate1~4)에서 떨어진 20장을 다시 그렸다 — 경트럭·트랙터·자전거는 대각선 자세를 버리고 동쪽 옆모습, 전봇대는 닫힌 머리 판, 우물은 4행 이상 물 안쪽, 볏단 걸이는 가로대 윗면, 허수아비는 윤곽·삿갓 챙 타원, 죽담은 갓 윗면 7행, 바닥 4장은 격자 무늬 제거, 건물은 지붕 몫 33~35%·위 2줄만 줄눈·切妻 네모 윤곽·鬼瓦 블록 고정, 간이역은 제 지붕 없는 시계 박공을 뺐다. 판정 기록은 `harness-data/jp-inaka/vqa-r14/`.
- **허용:** 18323 대기열 묶음 `inaka-handpixel-r14`. 허용은 사용자가 감독에게 위임한 것이며(2026-10-21) 결정 기록의 note 에 「delegated by user to supervisor; Opus VQA receipt <경로>」를 적었다. 검토 화면 API 는 기록에 `by: human` 을 박으므로 decidedBy 를 `supervisor (delegated by user 2026-10-21)` 로 두어 사람 선택이 아님을 남긴다.
- **#3098 도시 깊이 그림은 굽지 않았다:** main 에 소스만 들어오고 18323 허용 전인 #3098 (houses/catalog·shop_parts·parts_vehicles·cars·heavy·glyphs)은 이번 굽기에서 그 직전 판으로 굽었다. 그래서 이번 굽기의 jp_city 차이는 이나카 팩과 대나무뿐이다. 그 그림을 허용받은 뒤 다음 굽기가 넣는다. main 의 `bake_interior_spec`(rooms.py 에 'study' 종류 없음)은 이 판과 무관하게 이미 깨져 있어 실내 사양은 다시 굽지 않았다.

## 대나무(대숲) 재작화 — R4 적대 VQA (2026-10-20)

사용자: 「대나무가 끔찍하다」. 지역 팩 `scripts/content/jp-city/blocks/jp_regions_pack.py` 의 대숲은 4~5px 굵은 기둥에 10px 마다 검은 마디 띠, 활엽수와 같은 둥근 덩이 수관이라 「초록 철창 위 브로콜리」로 읽혔다. 산길(21)에서는 이 4×6 덩이 하나만 되풀이해 같은 꼴이 쌓였다.

- **대나무 문법(공용 함수, 다른 팩은 import 해서 쓴다 — 다시 그리지 말 것):** `bamboo_culm(c, x, top, bot, w, depth, seed, lean)` 줄기 2~3px(왼쪽 빛·몸·오른쪽 그늘, 줄기마다 윤곽선 없음), 마디 7~9px 간격·줄기마다 어긋남, 마디 위 2줄 턱 그늘, 끝 6px 가늘어짐, 위로 갈수록 휘는 `lean`. `bamboo_spray(t, x, y, ln, lv, bias)` 아래로 처지는 笹 잎 부채(밑동 2px → 끝 1px). `bamboo_plume(...)` 엇갈린 격자로 뿌린 잎 부채 무리(그늘 쪽부터 칠해 밝은 잎이 위). `bamboo_grove_art(...)` 3/4 발치 이끼 둔덕 타원 + 마른 댓잎 + 오른쪽 아래 그늘, 가장자리가 늦게 시작하는 숲 속 그늘, 뒤 줄기 → 잎 무리 → 앞 줄기 → 잔가지 잎 → 죽순 원뿔 순서.
- **키트:** `jp-rg-bamboo-grove`(4×6, 같은 id·같은 발 칸·같은 칸 번호 — 24칸을 제자리에서 다시 칠함, 저장 지도 번호 불변) + 새 `jp-rg-bamboo-grove-b`(3×6, 발 1칸) · `jp-rg-bamboo-clump`(2×4, 발 2칸) — 새 칸 26개는 끝에 덧붙음(17027~17052, 이동 0).
- **구성기:** `src/editor/jpCity/regionComposer.ts` 숲 채움이 대숲을 고를 때 넓은 덩이 50% · 좁은 덩이 32% · 작은 무리 18% 로 섞는다(`bambooVariant`). 나무 판별·지역 허용 목록에 두 변형을 더했다. 같은 x 에 밑동 차 6칸 미만으로 앞뒤 쌓던 나무(세로 기둥처럼 줄 서던 것)는 그 자리를 옆으로 어긋난 후보에 넘긴다(`clashesWithPlaced`).
- **3/4 관문(정직):** `object-gate review` 영수증 3장(`a86b1cdfecfc` grove · `d6dec45328d6` grove-b · `9c8958739874` clump) — 3/4 반쪽 통과(4/4), **화풍 반쪽 불합격(4/4, 「칸 정보량이 기준보다 훨씬 낮음」)**, 프로필 `ee216f0de5822996` 미보정 → **관문 미통과**. 옛 대숲(`91fb2352ed07`)·기존 `rg-sugi`(`68c36e6d6582`)도 같은 반쪽에서 불합격이다(옛 대숲 「평면 채움·질감 없음」, 이 두 영수증은 비교용이라 저장소에 넣지 않았다). 원인은 측정됐다: 버들항 나무 기준 그림은 16px 칸당 고유색 중앙값 약 100, jp_city 팔레트 계약(재료당 5단)의 대숲 칸은 8(최대 15)이다 — 계약 색을 지키는 한 이 지표로는 통과할 수 없다. 기준을 낮추지 않았다. 병합은 사용자 판단 대기(jp_city 화풍 기준 그림을 따로 둘지).
- jp-inaka(`inaka_art_props.py` 죽담·허수아비 대)도 이 함수를 import 해서 쓰기로 했다(같은 대나무 두 화풍 방지).
- 남은 것(이 판에서 안 고침): 쇼텐가이 아치의 실제 한자 「商店街」(글자 금지 규칙과 충돌 — 예전 판에서 사용자가 받아들인 그림이라 그대로 둠), 삼나무도 같은 화풍 반쪽 불합격(곰솔·단풍은 판정 안 함).

## 3/4 깊이 지붕·탈것 윗면 (2026-10-20, 사용자 「가로 공간감만 있다」)
건물 카탈로그(`scripts/content/jp-city/houses/catalog.py`)의 주택 전부·파출소·창고·작은 역사·우체국은 `houses/depth34.py` 의 위에서 본 지붕을 쓴다:
`hip_top`(寄棟: 용마루 = 윗선, 바깥선 직사각형 + 위 귀퉁이 사선, 얇은 옆 쐐기) · `gable_top`(平入り) · `gable_front_top`(妻入り: 남북 용마루, 앞뒤 끝 Λ, 앞 박공벽) ·
`shed_top`(片流れ 한 장 면) · `flat_top`(陸屋根: 뒤 난간 안쪽 면, 옥상 설비는 윗면+남쪽 면 상자). `depth34.deepen(r)` 이 옛 레시피 지붕을 바꾸고 지붕 높이를 벽 높이에 맞춘다(그림 높이의 40~50%).
간판 글자는 원래 레시피의 일본어 가게 이름을 그대로 쓴다(2026-10-20 허용, 상표 금지 — 우체국 `郵便局`, 역 `さくら駅`, 가상의 `喫茶ルナ`·`酒のヤマ` 등). 탈것: `vehicles/heavy.py` 버스 옆 프레임(지붕 윗면 22줄·어깨 띠·휠 아치), `vehicles/cars.py` 승용·경차·트럭(두 상자 모형: 지붕 윗면과 보닛·트렁크 윗면이 같은 12줄 깊이, 옆창 띠 6줄, 앞·뒷유리는 기운 면, 몸체 옆면 14줄 한 단 어둡게, 바퀴 아래 절반만 · 옆 프레임 48 높이, 2톤 트럭 56 · 기준 = 경찰차),
정지 소품 `lib/parts_vehicles.py` 의 `car()`·`bus()` 는 같은 그림을 부른다. 비교판: `scripts/content/jp-city/qa/depth_pilot.py OLD_DIR OUT_DIR`. 굽기·관문은 별도(gate_kinds 우회 금지).

**상점가 화풍(2026-10-20, 사용자 참고 그림 — 저장소 밖 연구용, 커밋 금지):** `houses/depth34.py` `townify()` 가 상점·식당 전부(入母屋 제외)와
`house_hip2` 를 妻入り(`gable_front_top`, 박공벽은 맨 위층 벽 재질·무늬 위상을 그대로 잇는다)로, 평지붕은 사방 난간 + 塔屋·실외기·화분·물탱크·빨래
데크(`flat_top(rail=True, floor=…)`)로, `house_nisetai` 는 난간 옥상으로 바꾼다. 寄棟은 `house_hiraya`·`house_hip2_wide` 만 남긴다.
지붕 높이 상한 `cap_roof()`: 지붕 면 깊이 절대 36줄(`ROOF_DEPTH`, 妻入り는 박공벽 제외 · 파출소 35·창고 32 기준, 2026-10-20 적대 VQA) + 낮은 집은 비율(경사 ≤40%, 평지붕·片流れ ≤35%), 단층은 최소 24줄. 기와는 한 계열(kawara −3 흑갈), 평지붕 난간 갓은 민무늬, 片流れ 명암은 디더 없이 골 단위 3단. 기와 단은 처마에 맞춘다(`_anchor`).

## 나무 composer 숲 `jp_forest_r4` (2026-10-20, PR #3058 — 활엽만, 굽기 보류)

- 사용자 판정(2026-10-20): r4 나무 단위 방식은 「괜찮다」. 다만 색은 jp_city 잔디·땅과 어울려야 한다 → r5 색 맞춤.
- 붓으로 칠하는 것은 1층 숲 바닥 오토타일 `jp-forest4-bl`(모든 마스크가 같은 바닥 칸, solidfloor)이다. 그룹의 `composer`(타입 `TreeComposerDef`, `src/project/types/base.ts`)가 있으면
  엔진 `shapeAutotileGroupAround` 가 끝에 `src/project/defaults/treeComposer.ts` 의 `composeTreesAround` 를 부른다 — 편집기 붓·지우개·채우기, 조수 지형 도구(mapTools·terrainBrush), forestPainter 모두 같은 경로다.
  1층 층 뷰는 `autotileLayerView(map, 1)` 이 `composeTarget` 으로 맵을 함께 넘긴다(없으면 2~4층을 못 고친다).
- 규칙: 밑동 칸 (x, y) 에 나무가 서는지는 그 칸 해시와 이웃 몇 칸만으로 정해진다(짝수 줄 또는 숲 남쪽 끝 줄, 줄마다 위상이 다른 3칸 간격, 5% 비움, 모양 T4/T3/T2 해시, 숲 속 나무는 그늘판).
  칸마다 덮는 조각을 깊이(남쪽 = 앞)로 줄 세워 앞에서부터 4·3·2층에 둔다(이웃 수관이 겹친다). 수관은 `overhangOnTiles`(굽기가 잔디 그룹 `jp-lawn-dirt`·`jp-gravel-lawn` 멤버로 풀어 둔다) 위로만 넘친다. 2~4층에 남의 칸이 있으면 비킨다.
  그래서 붓질은 국소이고 결정적이다 — 붓질을 쌓은 결과 = 한 번에 짠 결과(`scripts/content/jp-city/forest/ts_compose_check.mts`, 모양 5종 차이 0).
- 원형(파이썬, 해시까지 같다): `forest_r4_compose.py` 의 `anchor_at`·`cell_stack`. 그림 `forest_r4.py`, 장면 `forest_r4_scenes.py`, r5 색 비교 `forest_r5_compare.py`, 상태 쪽 `forest_r4_viz.py`.
- r5 색: jp 잔디 3281(색상 122°·채도 0.41·명도 0.52)에 버들항 나무/잔디 관계(나무 명도 중앙값 = 잔디 ×0.77)를 옮긴 램프 `pine_bamboo/keyaki_g1·g2·h1·h2·leafhi_g`, `aged_cedar/bark_g`(paletteContract.ts).
- 지역 생성(jpRegionTool): paint_forest 는 활엽 칸에 숲 바닥만 칠하고, 키트를 다 찍은 뒤 `composeJpForestR4` 로 한 번에 세운다(집 위로 수관이 넘치지 않게).
- 알려진 한계: 숲 옆에 길·물을 새로 칠해도 숲 그룹 재성형이 안 불리므로 이미 넘친 수관은 그대로다(숲 쪽을 한 번 다시 칠하면 맞춰진다).
- **r6 접지**(사용자 「떠 보인다」, 2026-10-20): 버들항 실측 — 숲 그림자는 나무와 따로 땅에 깔린 두 단 반투명 덩이(잔디 ×0.83 · ×0.70), 보이는 쪽은 오른쪽 아래.
  jp 는 알파 0/255 계약이라 잔디 무늬를 같은 비율로 어둡게 한 칸(계약 램프 `pine_bamboo/lawn_shade`)을 깐다. `TreeComposerDef.ground`(선택, 칩셋마다): 숲 칸은 1층 `floorTiles[code]`(64 변형, 오토타일 멤버),
  숲 밖 잔디(`apronBases` 3281~3283)는 `apronLayer`(2층) 덧칸, 그 칸의 나무는 2층을 비운다. 그늘 코드 = 가운데·북·서·북서·동·북동 칸이 「그늘 덮개」(그림 맨 아래 `shadeRows`=2 줄을 30%/밑줄 15% 넘게 덮은 칸)인가.
  그늘 모양 `forest_r6_ground.py`(덮개 칸을 (+2,+3) 민 속 · 오른 3·아래 5 넓힌 가, 원판 다수결로 둥글림). 밑동: 들쭉날쭉 파고드는 아랫선·앞 뿌리·밑동 타원(×0.55)·풀 술(`forest_r4.py` GROUND=r6).
  `ground` 가 없는 composer(예: #3122 버들항 `composeTreesInMask`)는 예전 그대로 나무만 짠다. 접지 검수 `argon_ground_judge.py`: r5 2.0/2.33 → r6 4.0/3.33(덩이/연못·길·집, 3번 평균).
- Argon 적대 검수(r3 와 같은 설정): jp 활엽 6.6, **버들항 bd-tree 를 같은 composer 에 넣어도 6.6** — 이 판별 설정은 기준 그림도 0 을 못 만든다.
- 굽기: `blocks/jp_forest_r4.py`(BLOCK_ORDER 끝), 임시 `--out-root` 로만 확인(23,459칸). 3/4 관문 미통과 — 보정 대기.

## 붓으로 칠하는 숲 오토타일 `jp_forest_r3` (2026-10-20, PR #3058 — 그림 머지 보류)

- r1/r2 숲 팩(키트를 흩뿌리고 머리·하늘선·줄기 띠를 손으로 찍는 방식)을 대신하는 r3. 종마다 오토타일 하나 `jp-forest3-<bl|bb|sk|sg|mp|mh>`(활엽·대숲·벚·삼나무·단풍·섞인 숲 삼나무+활엽).
- 칸 그림 = 8방 마스크(정규화 47) × 칸 위치 위상. 엔진 `AutotileGroup.phaseVariants {w,h,maps}`(`src/project/defaults/autotileEngine.ts` `autotileVariantForMask(group, mask, x, y)`)를 더했다.
  편집기 붓(`shapeAutotileGroupAround`)·조수 지형 도구·`forestPainter.paintJpForestR3` 가 같은 표를 쓴다. 위상을 모르는 호출자는 `variantMap`(위상 0,0)으로 떨어진다.
- 위상 주기: 여섯 종 모두 6×4. jp 시트 4096px 한도(24576칸) 때문에 `jp_forest_pack` 은 한 그루 나무 키트만 남기고(`TREES_ONLY`), 소나무 단독·소나무+단풍 섞인 숲은 뺐다(임시 굽기 실측 합계 23232 / 24576).
- 섞인 숲은 그 자체가 오토타일 `mh`(한 수관 밭 안에서 수관마다 삼나무 원뿔/활엽 돔). 코드 6 소나무·7 신사·8 산비탈을 모두 `mh` 로 칠한다. 다른 오토타일끼리 맞닿으면 서로 숲 밖으로 보아 사이에 풀 틈이 남는다.
- 1칸 띠(가로 1줄·세로 1칸)는 칸마다 작은 나무 한 그루(`_small_tree`, 크기·치우침은 위상 해시). 대숲은 잎 다발 + 마디 있는 대줄기 결(`_bamboo_tex`), 단풍은 등롱 호박색 노란 잎을 섞는다.
- 그림 `scripts/content/jp-city/forest/forest_r3.py`(버들항 역설계 `tiledata/jp-city/forest-r3/SPEC.md`), 장면·붓 시험 GIF `forest_r3_scenes.py`, 적대 검수 `argon_r3_judge.py`·`argon_r3_round.py`(종 6 × 모양 5 + 맞닿음, 활엽을 옆에 두고 1× 가시성 순위), 상태 쪽 `forest_r3_viz.py` → `~/claude-viz/jp-forest-kit-1.html`.
- 상태: Argon 적대 검수 10판 모두 NO-SHIP(장면당 막는 결함 7~8). 가장 보이는 결함은 주기 반복(6칸)·남쪽 줄기 줄·직선 가장자리. object-gate 프로필 미보정. **저장소 굽기 금지** — `BLOCK_ORDER` 에는 올렸지만 관문 보정 뒤에 굽는다.

## 이어지는 숲 팩 `jp_forest_pack` (2026-10-20, PR #3058 — 그림 머지 보류)

- 진단(r1): 옛 숲은 한 그루짜리 키트(rg-sugi·rg-pine·대숲)를 `regionComposer` 가 흩뿌렸다. 시트에 수관끼리 이어지는 칸이 없어 스티커 무리가 됐고, 키트 5~6칸이 전부 숲 구획 안이어야 해서 폭 3~4칸 숲 띠는 비었다.
- **그림**(`scripts/content/jp-city/forest/forest_kit_proto.py`, 코드 손 도트, 위치 해시, 계약 확장·하위 램프만): 종류 다섯 — `bl` 활엽(느티나무·잡목) · `bb` 대숲 · `sk` 벚나무 숲(`sakura_petal+`) · `sg` 삼나무 숲(`pine_bamboo+`, 원뿔 수관) · `mp` 단풍 숲(`autumn_maple+`, 가을 지역). 종류마다
  수관 8방 오토타일 `jp-forest-<k>`(canon 47 + 몸통 변형 12/대숲 4, 3층 막힘) · 곧은 가장자리 변형 그룹 `jp:forest-<k>-edge-<n|s|w|e>` · 수관 머리 `jp-forest-<k>-head-*`(3층 불투명) · 머리 덧그림 `-headx-*`(4층, 대숲 없음) · 하늘선 `-sky-*`(윗줄 ★ 4층) · 줄기 띠 `-band-<L|M|R|one>-*`(활엽 1칸·대숲 2칸) · 한 그루 `-tree-*`(활엽 t2x3·t3x4·t4x4, 삼나무 s2x4·s2x5·s3x5).
  **한 그루 느티나무·벚나무는 그리지 않는다** — `jp_street_trees`(modern-tiles-r1, 사용자 승인 3×4 가로수)를 쓴다.
- **몸통은 공을 줄 세우지 않는다**: 몸통 칸 = 어두운 덤불 결(3~5px 잎 뭉치, 점묘 없음)이고 칸 테두리 2px 가 모든 변형에서 같다. 밝은 덩이는 전부 머리 키트(투명 덧그림 + 몸통 위 합성)라 칸 경계를 넘는다 — 몸통에 16px 마다 같은 공을 두면 Argon 이 「달걀판」으로 본다(r4).
- **칠하기**(`src/editor/jpCity/forestPainter.ts` `paintJpForest`): 마스크(칸마다 종류 코드) → 수관 오토타일 → 하늘선 → 머리(3층, 큰 키트부터) → 머리 덧그림(4층, 엇갈림) → 줄기 띠. 수관 = 아래로 띠 높이만큼 같은 숲이 이어지는 칸, 그 밑 줄이 띠 — 띠가 숲 구획 안에 들어가 폭 3~4칸 얕은 띠도 칠해진다. 맵 밖은 숲이 이어진다고 본다.
- **구성기**(`regionComposer.paintForestZones` → 단계 `paint_forest`, 실행 `jpRegionTool`): 숲 구획에서 키트·길·물·비움 칸과 그 둘레 1칸을 빼고, 폭 1칸 기둥·6칸 미만 자투리를 지운다. 덩이마다 수종(신사·절·산 → 삼나무 55%, 봄 → 벚나무, 성·공원 → 벚나무 25%, 가끔 대숲, 가을 활엽 → 단풍), 대숲 산길은 서쪽 대숲·동쪽 삼나무. 칩셋에 숲 팩이 없으면 옛 흩뿌리기로 돌아간다.
- **굽기 보류**: `BLOCK_ORDER` 끝에 `jp_forest_pack` 를 붙였지만 저장소 시트에는 굽지 않았다(3/4 관문 보정 전 저장소 굽기 보류). 미리보기는 임시 굽기 —
  저장소 `public/assets/jp-city/jp-city-chipset.png`·`src/assets/jpCity*.json`·`tiledata/jp-city/{pins,kit-index}.json` 을 `/tmp/root` 같은 곳에 복사한 뒤 `bake_jp.bake('/tmp/root')` → `bun scripts/qa/jp-forest-preview.mts --mode regions|inaka --root /tmp/root --out <폴더>`(번호는 덧붙기만, 기존 17,053칸 이동 0).
- **관문(정직)**: 대표 13장 `object-gate review` — 3/4 통과 13/13, 화풍 불합격 13/13(「칸 정보량이 기준보다 훨씬 낮음」), 프로필 `ee216f0de5822996` 미보정(rejected) → **3/4 관문 미통과 — 보정 대기**. 판정 PNG·목록 `tiledata/jp-city/blocks/jp_forest_pack/_gate/`.
- **적대 VQA**: Argon(`gemini-4-argon-high`, 판정 스크립트 `forest/argon_judge.py`, 버들항 숲 크롭 기준 4배 사분면) r0~r7, 점수 기록 `tiledata/jp-city/forest-proto/argon-rounds.json`. 1.5~2 → 2~3. 끝까지 남은 지적: 줄기 띠의 「울타리」 리듬, 머리 덩이의 「콜리플라워」 결, 얕은 띠의 16px 계단.

## 대나무(대숲) 재작화 — R4 적대 VQA (2026-10-20)

사용자: 「대나무가 끔찍하다」. 지역 팩 `scripts/content/jp-city/blocks/jp_regions_pack.py` 의 대숲은 4~5px 굵은 기둥에 10px 마다 검은 마디 띠, 활엽수와 같은 둥근 덩이 수관이라 「초록 철창 위 브로콜리」로 읽혔다. 산길(21)에서는 이 4×6 덩이 하나만 되풀이해 같은 꼴이 쌓였다.

- **대나무 문법(공용 함수, 다른 팩은 import 해서 쓴다 — 다시 그리지 말 것):** `bamboo_culm(c, x, top, bot, w, depth, seed, lean)` 줄기 2~3px(왼쪽 빛·몸·오른쪽 그늘, 줄기마다 윤곽선 없음), 마디 7~9px 간격·줄기마다 어긋남, 마디 위 2줄 턱 그늘, 끝 6px 가늘어짐, 위로 갈수록 휘는 `lean`. `bamboo_spray(t, x, y, ln, lv, bias)` 아래로 처지는 笹 잎 부채(밑동 2px → 끝 1px). `bamboo_plume(...)` 엇갈린 격자로 뿌린 잎 부채 무리(그늘 쪽부터 칠해 밝은 잎이 위). `bamboo_grove_art(...)` 3/4 발치 이끼 둔덕 타원 + 마른 댓잎 + 오른쪽 아래 그늘, 가장자리가 늦게 시작하는 숲 속 그늘, 뒤 줄기 → 잎 무리 → 앞 줄기 → 잔가지 잎 → 죽순 원뿔 순서.
- **키트:** `jp-rg-bamboo-grove`(4×6, 같은 id·같은 발 칸·같은 칸 번호 — 24칸을 제자리에서 다시 칠함, 저장 지도 번호 불변) + 새 `jp-rg-bamboo-grove-b`(3×6, 발 1칸) · `jp-rg-bamboo-clump`(2×4, 발 2칸) — 새 칸 26개는 끝에 덧붙음(17027~17052, 이동 0).
- **구성기:** `src/editor/jpCity/regionComposer.ts` 숲 채움이 대숲을 고를 때 넓은 덩이 50% · 좁은 덩이 32% · 작은 무리 18% 로 섞는다(`bambooVariant`). 나무 판별·지역 허용 목록에 두 변형을 더했다. 같은 x 에 밑동 차 6칸 미만으로 앞뒤 쌓던 나무(세로 기둥처럼 줄 서던 것)는 그 자리를 옆으로 어긋난 후보에 넘긴다(`clashesWithPlaced`).
- **3/4 관문(정직):** `object-gate review` 영수증 3장(`a86b1cdfecfc` grove · `d6dec45328d6` grove-b · `9c8958739874` clump) — 3/4 반쪽 통과(4/4), **화풍 반쪽 불합격(4/4, 「칸 정보량이 기준보다 훨씬 낮음」)**, 프로필 `ee216f0de5822996` 미보정 → **관문 미통과**. 옛 대숲(`91fb2352ed07`)·기존 `rg-sugi`(`68c36e6d6582`)도 같은 반쪽에서 불합격이다(옛 대숲 「평면 채움·질감 없음」, 이 두 영수증은 비교용이라 저장소에 넣지 않았다). 원인은 측정됐다: 버들항 나무 기준 그림은 16px 칸당 고유색 중앙값 약 100, jp_city 팔레트 계약(재료당 5단)의 대숲 칸은 8(최대 15)이다 — 계약 색을 지키는 한 이 지표로는 통과할 수 없다. 기준을 낮추지 않았다. 병합은 사용자 판단 대기(jp_city 화풍 기준 그림을 따로 둘지).
- jp-inaka(`inaka_art_props.py` 죽담·허수아비 대)도 이 함수를 import 해서 쓰기로 했다(같은 대나무 두 화풍 방지).
- 남은 것(이 판에서 안 고침): 쇼텐가이 아치의 실제 한자 「商店街」(글자 금지 규칙과 충돌 — 예전 판에서 사용자가 받아들인 그림이라 그대로 둠), 삼나무도 같은 화풍 반쪽 불합격(곰솔·단풍은 판정 안 함).
