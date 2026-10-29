# 생성 칩셋 공용 실내 — atlas_biome_interior = 손 도트 실내 v5 (2026-09-29)

사용자 결정(2026-09-29): 「기존 실내칩들 전부 공격적으로 폐기하고 interior-v5 만 반영, 조수들은 이 실내 칩들만 깔 수 있게」.
그래서 `atlas_biome_interior`(family `oprn-atlas`)는 **손 도트 실내 v5 전용 시트**다. 같은 날 오전의 정의(Tibo 실내 칸 번호 0~2159 +
배·던전 블록, 이식 실내 140맵 `abi-*`)는 폐기했다 — git 기록(8e02e8e4e)에만 남는다. 배·던전 블록은 `atlas_biome_dungeon` 으로 떼었다.
스킬 원본: `assistant-skills/interior-room-authoring/SKILL.md`(공통 원칙 → 코딩 에이전트 → 편집기 조수).

## 원본과 칸

원본 손 도트: `tiledata/hand-interior/v5`(Python — `kit4.OBJ` 가구 381종, `room2.render` 구조, `rooms4.B` 건물 25동 26맵, `meta5.py` 메타·아틀라스).
`python3 scripts/content/hand-interior/build_tileset.py` 가 그 모듈을 그대로 불러 칸으로 자른다.

시트 `public/assets/atlas-interior/interior-chipset.png` — **48칸 폭**(12프레임 띠가 줄을 넘지 않게), 6160칸(고른 후보 반영 후, 2026-10-01).

| 블록 | 칸 | 규칙 |
|---|---|---|
| 빈 칸·공허 | 0·1 | 공허 = 벽 속·건물 밖(막힘) |
| 천장 | 기본+7종 × 32 | 비트 1 남쪽 안 · 2 북쪽 안 · 4 서쪽 안 · 8 동쪽 안 · 16 북쪽 공허 |
| 바닥 | 27종 × (열×줄×4) | 표면마다 **짜임 주기**(판자·줄눈 간격, 64px 이상 배수)로 접어 열×줄 위치 × 그림자 4(없음·벽면 밑 접촉·서쪽·둘 다). 사양 `floors[id].cols/rows` |
| 벽면 | 19종 × (열×4) | 윗줄/아랫줄 × 열(기둥·지지목 간격의 배수: 벨벳 80·광산 96·리벳 96·룬 240…) × 서쪽 그림자. 사양 `walls[id].cols` |
| 가구 | 527종(v5 381 + 함께 쓰기 변형 5 + 고른 새 기물, 2026-10-02 굽기 4판) | 발밑 칸 = 막힘 x, 솟은 칸·걸이 = ★, 바닥 무늬·계단 = o. 움직이는 칸은 12프레임 `animationStrips`(10fps) |
| 자동 타일 | 탁자 9(dining·work·desk·display·counter·kcounter·sideboard·tea·felt), 줄 11(깔개 6·선로·울타리·창살·제단 난간·증기관), 단 5 | 줄은 안쪽 모서리가 여럿 겹친 조합까지 |
| 탁상 물건 | 119 | 가구 윗면 4층, ★(2026-10-29 전엔 x — 받침 가구가 막는다) |
| 예제 합성 | 352 | 탁상 물건을 윗면 안 위치까지 얹은 가구·창 빛 바닥(예제 맵만) |

증명(build_tileset.py 가 스스로 검사, `tiledata/hand-interior/v5-maps/check.json`): 예제 26맵 전부 **원본 합성(room4.compose, 같은 접은 표면)과 12프레임 픽셀 차 0**,
정의 통행으로 칸마다 판정한 결과가 원본 정답 격자(`# = X . c u S D ,`)와 **불일치 0**, 엔진 `canMove` 도달 칸 수 = 검사기 도달 칸 수(테스트).
접지 않은 원본(v5 페이지 그림)과 같은 화소 비율은 `sameAsUnfoldedOriginal`(69~98%) — 다른 것은 해시 잡음 무늬(돌 얼룩·결)뿐이고 가구·벽 기둥·줄눈은 같은 자리다.
짜임 주기는 해시 잡음 H 를 상수로 바꿔 구조만 남긴 무늬에서 잰 값(`FLOOR_WEAVE`/`WALL_WEAVE`). 처음(64px 고정)에는 벨벳 금색 기둥·광산 지지목이 옮겨져 좁은 문 통로에 기둥 토막이 섰다(적대적 QA).
원본이 깔개를 벽면·천장 위까지 그린 칸(서재·저택 1층)은 밟는 무늬 칸을 올리면 엔진이 그 벽을 걷게 만든다 → 1층 구조 칸에 구워 막힘(라벨 「벽 위 깔개 끝」). 조립기는 벽·천장 위 밟는 무늬를 오류로 막는다.
정의 크기: 새 프로젝트마다 복제되므로 표면 칸에는 긴 설명을 싣지 않는다(규칙은 타일 그룹 설명). 2.4MB — 빈 프로젝트 41.3MB → 44.0MB(복제 +19%).

층(엔진 판정): 1층 구조 · 2층 바닥 무늬(깔개·단·배수 창살·아래로 가는 계단 구멍) · 3·4층 가구 조각(그리는 순서: 걸이 y·16, 무늬 먼저, 나머지 (y+높이)·16). 셋 이상 겹친 칸은 예제에서 합성 칸.
밟는 무늬·계단 칸은 priority lower(o — 캐릭터 밑, 걸을 수 있음) + 잠근 `defaultLayer: upper`(편집기 붓은 위층에 깐다 — 커스텀 칩셋의 붓 홈은 priority 를 따르므로 `userTileLayerOverride` 로 따로 준다).
RM2k3 투명 칸 자동 보정(`applyCustomChipsetMinimalHarness`)에서 이 시트와 배·던전 시트를 뺀다.

## 코드

- 정의 `src/project/defaults/atlasBiomeInterior.ts`(JSON `src/assets/atlasBiomeInteriorTileset.json`, 기하 `atlasBiomeInteriorSheet.json`). `ensureAtlasBiomeInteriorCurrent`:
  옛 정의(칸 수·가로 칸 수·`hand-interior:` 킷이 아님)는 **통째로 교체**하고 그 칩셋 맵은 그대로 둔 채 `atlasBiomeInteriorReplacementWarnings` + 콘솔 경고. 같은 시트의 새 빌드면(통행·층·잠금 요약이 다르면) 번들 소유 필드만 갱신. 저자가 쓴 참고문서 분류는 옮긴다.
- 조립기 `src/editor/handInterior/builder.ts` — room2.render 와 같은 구조 규칙(예제 1층 칸 번호 일치), 가구·탁자·줄·단·탁상 물건, 오류(겹침·바닥 밖(밟는 깔개 포함)·벽 가구 자리·걸이 줄·계단 자리·윗면 없는 탁상 물건) + BFS 경고(닿지 못한 바닥·쓸 수 없는 가구, 앉는 가구는 옆 가구의 사용 칸).
- 탁상 물건이 앉는 줄(`surfaceRowOf`, 2026-10-29): `surfaceRow`·받침대 표가 없으면 그림의 윗면 상자(`surface`)와 `up` 으로 정한다 — 윗면 가운데가 발밑 줄 위로 솟은 줄(카운터 `up 8`, 윗면 y 2~7 → dy −1)이면 발밑 칸에 준 물건을 그 줄로 올린다. 전에는 카운터 앞면 서랍에 돈통·저울·잔이 그려져 「서랍장으로 읽힘」(방 견본 잡화점·빵집·옷가게 major)이었다. 올린 칸은 카운터 뒤 주인 통로라 탁상 물건 칸(119)을 ★ 로 바꿨다(`build_tileset.py` `pass_of goods` 와 시트 JSON 둘 다) — 탁자·책상 위에서는 받침 가구가 여전히 막는다.
- 도구 `src/editor/tools/handInteriorTools.ts`: `list_hand_interior_parts`, `build_hand_interior_room`(error 면 맵을 만들지 않는다, `links` 로 층 이동). 사양 `src/assets/handInteriorSpec.json`.
- 두 도구는 `tileset:"jp_city"` 로 **일본 집 실내**(사양 `src/assets/jpInteriorSpec.json`, 그림은 jp_city 번들)도 짓는다 — 조립기·규칙은 같고 사양만 다르다. `builder.ts` 의 `HAND_INTERIOR_SPECS`. 상세는 `openwiki/jp-city.md` 「일본 집 실내」.
  부품 찾기는 `src/editor/handInterior/parts.ts`(아래 「가구 메모·방 표」).
- **방 짓기 역할표 `TilesetDef.roomKit` (2026-10-07):** 조립기는 칩셋 id 가 아니라 타일셋 정의의 역할표를 읽는다(`roomSpecOf`).
  `{builtin:"atlas_biome_interior"|"jp_city"}` = 편집기가 들고 있는 사양, `{spec}` = 사양 통째(번들 밖 칩셋용). 번들 두 칩셋은 builtin 을 들고 태어나고
  옛 저장본은 `ensureAtlasBiomeInteriorCurrent`·`ensureJpCityTileset` 이 채운다. 그래서 **스토어 사본(id 가 `store_…` 로 바뀐 것)도 그대로 짓는다**.
  역할표 없는 칩셋은 쓸 수 있는 목록과 「방 짓기 탭에서 만들어 달라」는 안내와 함께 거절한다 — `list_hand_interior_parts` 인자 없이 → `roomTilesets`.
- **역할표 만들기 — 타일셋 「방 짓기」 탭 (2026-10-07, UGC):** 자료집 → 타일 → 칩셋 → 「방 짓기」(`tilesetRoomKitPanel.ts`).
  사람이 시트에서 **바닥 무늬(사각형 1~8칸) · 벽면 위 줄 · 벽면 아래 줄(같은 칸 수) · 천장 칸 하나** 를 끌어 고르면 견본 방(네모·ㄱ자)을 바로 지어 보여 주고,
  저장하면 `src/project/roomKit.ts` 가 변형 칸을 만들어 칩셋 끝 뒤 새 줄에 이식한다(`installRoomKit`, 바닥 통과·나머지 막힘, `tileMeta` 「방 짓기 · …」).
  - 변형 칸: 바닥 칸×그림자 4(벽 밑·서쪽, 곱셈 어둡게) + 벽면 칸×서쪽 2(윗줄은 천장 띠 밑 그늘) + 천장 32(방 안 쪽 변에 어두운 선+밝은 선) + 바깥 1.
  - 사양 id 는 고정: 바닥 `floor` · 벽면 `wall` · 천장 `default`. 도구 enum 에도 이 둘을 넣었다. `spec.picks` 에 고른 칸을 남겨 다시 열면 이어 고친다.
  - 벽 줄을 위·아래 따로 고르는 이유: 마법 학교처럼 벽 4줄을 **가로로 이어 둔 시트**가 있다 — 사각형 두 줄만 받으면 고를 수 없다.
  - 변형 시트 에셋 id = `roomkit_<칸 크기>_<해시>`(스토어 사본은 `store_<slug>__` 앞붙음). `bundledChipsetGeometry` 가 이 id 로 칸 크기·줄 16칸을 안다 —
    업로드 이식 원본은 기본이 16px·30칸이라 32·48px 칩셋 변형 칸이 깨진다. AI 생성이 아니므로 `generatedBy` 를 달지 않는다.
  - 다시 저장하면 새 칸을 덧붙이고 사양만 바꾼다(이미 지은 맵은 옛 칸 그대로). 번들 역할표(builtin) 칩셋은 탭이 「이미 있음」만 보인다.
  - **직접 올린 칩셋(image.type uploaded)만** 만든다. 번들 칩셋에 칸을 덧붙이면 `count > 번들 count` 가 되어 번들 갱신(ensure…)이 멈춘다 — 번들은 굽기 스크립트로 넣는다(아래 마법 학교).
  - **RPG Maker A2(16×12칸)·A4(16×15칸) 시트**를 칸 수로 알아보고(`rpgMakerAutotileSheet`) 블록을 한 번 누르면 이음매 없는 가운데를 뗀다(`rpgMakerBlockPicks`):
    윗면 블록(2×3) = 아래 2×2 칸의 가운데 쿼터 창 → 바닥·천장, A4 벽 블록(2×2) = 반 칸 오른쪽 창의 위·아래 줄 → 벽면 두 줄. 고른 칸은 칸 번호 대신 픽셀 창 `{px,py}` 로 남는다.
    칸을 그대로 고르면 오토타일 테두리가 칸마다 남아 바닥·벽에 격자가 생긴다(2026-10-08 합성 A4 시트로 비교).
  - **AI 초안**: 열·줄 번호를 단 시트(`labeledSheet`)를 `requestTilesetMapping` 으로 보내 `{floor,wallTop,wallBottom,ceiling,reason}` 을 받는다(`roomKitDraftPrompt`·`parseRoomKitDraft` — 코드 울타리·뒷말이 붙어도 첫 JSON 객체를 찾는다).
    오토타일 시트면 AI 가 짚은 칸의 블록 가운데로 바꾼다. 초안은 저장하지 않는다 — 사람이 견본 방을 보고 고친 뒤 저장.
- **가구 = 칩셋 조립 부품 (`kitHandObjects`, 2026-10-08):** 역할표에 가구 표(objects)가 없으면 칩셋의 section 조립 부품을 가구로 쓴다(공방 부품은 따로).
  역할 wall·terrain·fence·roof·building·water 는 뺀다. 발밑 줄 = 네 방향 다 막힌 칸이 처음 나오는 줄부터 아래 끝, 놓는 곳 설명에 「벽에 붙·벽 앞·north-wall」 = 벽 가구, 「벽에 건·걸이」 = 걸이, 막힌 칸이 없고 위층 칸도 없으면 밟는 무늬.
  업로드 칩셋은 자료집 → 오브젝트에서 부품을 등록하면 늘어난다.
- **마법 학교 번들 역할표 (2026-10-08):** `scripts/content/wizarding/roomkit_wz.py` 를 `bake_wz.py` 가 부른다 — 바닥(A·B·C 변형을 한 판으로 묶고 rowShift) 13 · 벽 세트 북벽 아래 두 줄 8 · 어두운 천장 32 + 바깥.
  변형 색은 마법 학교 팔레트 최근접으로 붙인다. 번호는 pins `roomkit/…` 키(기존 칸·예제 불변, 2508 → 2669칸). 사양 `src/assets/wizardingRoomSpec.json`, `roomKit {builtin:"wizarding_world"}`.
  가구는 조립 부품 320종(벽난로 = 벽 가구, 침대 = 바닥 가구). `build_wizarding_space` 는 그대로 네모 공간 생성기다 — 모양 있는 방은 `build_hand_interior_room({tileset:"wizarding_world"})`.
  - 확인(2026-10-07): 역할표 없던 마법 학교 칩셋에 성채 포석·석벽·어두운 천장을 골라 저장 → `__oprnEditorTool("build_hand_interior_room")` ㄱ자 방이 실제 편집기(Phaser)에서 이식 칸으로 그려짐.
- **바닥 깔기 규칙 `floors[].lay` (2026-10-07):** `"rowShift"` 면 줄마다 무늬를 가로로 밀어 깐다(`floorLayX`, jp `ikit.lay_x` 와 같은 식).
  한 판을 바둑판처럼 반복하면 넓은 빈 바닥에서 밝은 널이 같은 자리에 줄 섰다(일본 마루). 가로로만 이어지는 무늬에만 쓴다.
- **방 구성표·배치 후보·견본 가구 `layout` (2026-10-08):** 건물(방이 둘 이상)은 조수가 평면을 그리지 않는다 — `build_hand_interior_room({layout:{program|rooms:[{kind}]}})`.
  - 왜: 실제 조수(Gemini 3.8 Flash) 시험에서 평면을 모델에게 맡기면 「예제 집 통째로 베끼기」 아니면 「보고 있는 맵 크기(24×18)의 큰 네모 하나 + 흩뿌린 가구」로 끝났다.
    견본을 더 주는 것으로는 안 된다(주면 베낀다). 공간 설계(방 크기·배치)를 도구가 맡고 모델은 방 종류만 고른다.
  - 방 견본 `src/assets/interiorRoomTemplates.json` ← `bun scripts/content/interior-templates/extract.mts`: v5 예제 26맵(`tiledata/hand-interior/v5-maps`, 방 이름표 = `notes6.py LABELS`)과
    일본 실내 예제(`tiledata/jp-city/interior/examples/*.json` 의 rooms 사각형)를 방 단위로 잘라 크기·바닥·벽면·가구(방 안 상대 좌표)를 남긴다(v5 101방·jp 35방). 예제 맵별 방 종류 목록 = 방 구성(program).
  - 배치(`src/editor/handInterior/layout.ts`): 방마다 같은 종류 견본 크기를 목표로, 안쪽 사각형을 칸막이 1칸 빼고 면적 비례로 재귀 분할(slicing) 600회 → 점수(목표 크기 차·길쭉함·원하는 이웃·끝방 통과·트는 쌍 이웃) 순.
    출구 방은 늘 맨 아래. 목표보다 큰 칸은 건물 바깥 변을 깎아(ㄱ·ㄷ자 바깥 모양) 큰 빈 방을 막는다. 문은 출구 방에서 중심 방(복도·거실·가게…)을 먼저 거치는 나무, 현관↔복도·부엌↔거실은 기본으로 튼다(`connect.open`).
    견본은 같은 화풍 묶음에서 고른다(`templateStyle`: town·noble·fantasy — 대장간 침실에 엘프 궁정 침실이 들어오던 것).
  - 가구 자리 고치기(2026-10-09, 「줄이는 과정에서 물건 위치가 개판」): 옛 방식은 방이 견본보다 작으면 덩이를 반쪽 기준으로 dw 만큼 통째로 밀어
    덩이끼리 겹치고 방 밖으로 나갔고, 검사에 걸린 조각만 하나씩 빠져 식탁 없는 의자·반쪽 부엌이 남았다(실측: 줄인 부엌 16점 중 10점 빠짐). 지금은 넷.
    1. **방을 견본보다 작게 만들지 않는다** — 짝수 번 시도는 아래에서 위로 짠다(`buildTree`/`placeTree`: 방 크기 = 견본 크기, 둘씩 묶을 때 너비·높이를 더하고 작은 쪽만 늘림).
       홀수 번은 옛 slicing(크기 제한 `maxWidth`·`maxHeight` 용). 점수는 견본보다 작은 방을 큰 방의 두 배로, 깎인 빈 자리가 많거나 길쭉한(1.7 넘는) 건물도 감점.
    2. **방에 들어가는 견본으로 바꾼다** — `fittingTemplate`: 지금 견본이 안 들어가면 같은 종류·화풍에서 들어가는 가장 큰 견본.
    3. **덩이 자리 후보** — `templateClusters`·`clusterShifts`: 벽에 붙은 덩이는 그 벽에 붙인 채로, 떨어진 덩이는 비율 자리, 안 되면 다른 기준·1~3칸 비키기. 후보 여섯 곳 중 가장 많이 들어간 자리.
    4. **덩이 안은 몸통부터** — 가장 큰 가구를 넣고 넣은 가구에 붙은 것만 이어 넣는다. 의자·걸상(`SEAT`)은 씨앗이 못 되고, 탁상 물건은 받침이 들어간 뒤 받침을 따라 비킨다.
       한 점이 문 앞·다른 가구에 걸리면 그 점만 1~3칸 비켜 본다(벽 가구는 옆으로만).
    - 위·아래로 트는 쌍(부엌↔거실)은 `connect.span:3` 으로 가운데 3칸만 튼다 — 통째로 트면 아래 방이 북쪽 벽면을 잃어 TV보드·책장·에어컨이 빠졌다. 트인 칸막이는 문 앞 칸 예약을 하지 않는다.
    - 출구 방 순서: 현관 → 가게·주점·대청 → 복도(여관이 복도로 들어가 주점을 거치던 것).
    - 실측(같은 요청 13개): 빠진 가구 107 → 14점, 일본 집은 0~1점. 집 한 채 0.4~0.9초. 실제 조수 시험(대장간·일본 집)도 layout 한두 번으로 가구가 제자리에 들어갔다.
  - 결과 `data.layout.picture`(방 글자 그림)·`rooms`(견본·심은 수)·`rebuild`(rooms·connect·exit·objects… — 가구를 고쳐 replace:true 로 넘긴다). 다른 배치 `layout.variant`, 다른 견본 `layout.seed`.
  - 실내 빈 바닥 피드백(`layoutQuality.ts` `interior`)은 「흩뿌려 메우지 말고 방을 줄여라 / layout 으로 다시」다(옛 문구는 「덩이를 놓아라」뿐이라 상자 집에 서재 코너를 채웠다).
  - **조수 v2 동사의 방 크기·채우기 계약 (2026-10-28, interior 장부 「방의 배치가 엉망진창」):** `src/ai/v2/builders/interior.ts`·`dressRoom.ts`.
    - 짓고 나서 맨바닥이 35% 넘으면 메우기 전에 방을 줄인다: 넓이 48칸 이상 방을 0.85·0.72·0.62 배로 다시 지어 맨바닥이 5 넘게 준 것을 받고,
      그래도 넘으면 가장 빈 방 하나씩 0.7 배(맨바닥 칸 수가 8 넘게 줄 때만, 최대 다섯 번). 주인공 물건 자리(`min`)·첫 짓기의 바닥/벽 재질은 지킨다. `keep` 방이 있으면 줄이지 않는다.
    - `fillBare` 는 맨바닥 20%까지만 메운다. 탁자 없는 한 벌(화분·상자·통·꽃병)은 벽을 등진 자리에만, 깔개 든 한 벌은 방마다 한 번, 책상·장의자 줄 세 번, 다른 탁자 한 벌 두 번.
      깔개는 깔린 카펫 줄(`lines`)·다른 깔개 위에 놓지 않는다.
    - `dress_room` 은 한 번에 6점, 같은 가구는 방에 이미 있는 것 포함 3점, 깔개는 방마다 1장(120칸 이상 2장). 서는 가구는 벽을 등진 자리에만. 맨바닥 30% 이하 방은
      「이미 충분히 채웠다」로 ok 를 돌려주고 더 채우지 않는다. `purpose` 낱말이 다른 방 쓰임(여관 홀→주점)이면 그 방으로 옮겨 채운다.
    - `stamp_object` 는 손 도트 실내 깔개(flat 물건)를 이미 깔린 깔개·카펫 줄 위에 찍지 않는다(거부 글로 맨바닥을 고르라 한다).
    - 조사 이벤트(퍼즐 사슬)의 물건 낱말(일기장·편지·열쇠·두루마리…)은 `src/ai/v2/examineArt.ts` 가 책상 윗면 탁상 물건(4층)으로 그린다. Object 시트 칩 그림 이벤트는 `fixedGraphic` —
      조사할 때 돌아서 열린 문짝 줄을 보이지 않게.
    - 방 크기는 내용이 정한다(2026-10-28 마법학교 후속): 견본은 가구 한 점당 바닥 12칸 이하인 것만 고르고(있으면), 여러 방 건물의 「large」는 방을 ×1.3 키우지 않는다(방 수로 낸다).
      주인공 물건 최소 크기는 벽면 두 줄+물건+앞 통로(벽 물건 h+4, 서는 물건 h+5). 주인공 물건은 «그 방 안에» 있어야 놓인 것으로 친다(다른 방 견본의 같은 가구는 안 센다).
      배치 나무가 형제 방을 같은 폭으로 늘린 방은 `layout.ts` `trimInner` 가 안쪽 변도 목표 크기까지 깎는다(이웃 맞닿음이 그대로일 때만, 깎인 띠는 두꺼운 벽).
      전체 맨바닥이 괜찮아도 가장 빈 방은 0.7 배로 줄여 본다(방 넓이 40칸 이상, 맨바닥 칸이 8 넘게 줄 때).
      조수 v2 위층(`builders/interior.ts` `buildUpperFloor`)은 배치 후보 넷 × 복도 폭(기본·±1·±2, 7 이상)을 지어 보고 공허 칸(`S.void`, 검은 칸)이 가장 적은 것을, 같으면 방 넓이 비율이 큰 것을 고른다(2026-10-29).
      전에는 넓이 비율만 봐서 객실 둘 + 9칸 복도가 늘 13×16 에 귀퉁이 2×7 공허 덩이를 남겼다(선술집·마법학교 2층 모두, 1배 화면에서 검은 사각형). 지금은 11×16 공허 0.
      다 지은 뒤 맨바닥 30% 넘는 방(위층 포함)은 그 방 쓰임으로 `dressRoom` 규칙대로 채운다 — 쓰임 낱말이 칩셋 표에 없으면 방 종류로 내려간다.
      `dress_room` 은 책상·장의자·탁자 줄만 방 가운데에 세운다(같은 가구와 같은 줄·열에 맞춘다), 다른 서는 가구는 벽을 등진 자리.
      잰 값(같은 인자 다시 돌리기): 마법학교 58×37 맨바닥 45% → 23×31 16%, 방마다 8~29%(입학 홀만 36% — 출구에서 이어지는 통로), 여관 18×18 25%, 할머니 집 13%.
      한 방짜리가 채운 뒤에도 30% 넘으면 한 단계 작은 크기로 다시 지어 보고 나아지면 쓴다. 출구 발깔개는 방 깔개 몫(1장)에 세지 않는다.
      연금술·마법 방의 바닥 장식은 마법진, 작업대·실험대 줄은 방 가운데에 세 개까지(연금술 공방 13×11 맨바닥 42% → 18%).
      3×4 바닥 같은 작은 방(객실·창고)은 두 칸 통로만으로 50% 안팎이 나온다 — 이 자로는 작은 방을 판정하지 않는다.
    - 큰 주인공 물건(`great …`)의 그림 넓이가 방 바닥의 15% 를 넘으면 같은 물건의 작은 그림(great 를 뗀 id)으로 바꾼다 — 13×12 연금술 공방의 큰 굴절 망원경 5×6.
    - 다시 돌리기: `bun scripts/qa/assistant-v2/replay-interior.mts <판 폴더> <출력> --seed N [--all] [--every]` (모델 없이 그 판의 장소 동사를 지금 코드로 다시 돌려 PNG).
  - 시험(같은 요청, 실제 조수): 일본 집·다다미 집·편의점·대장간·여관·올린 칩셋 여관 — 모두 layout 으로 방 크기에 맞는 집을 짓고 예제 방 가구가 들어갔다. 마법 학교는 견본이 없어(예제 맵 없음) layout 이 방만 짓는다 — 다음 할 일.
- **방 목록 입력 `rooms`·`connect`·`exit` (2026-10-08, `src/editor/handInterior/rooms.ts`):** 방이 여럿이면 조수가 `#`·`.` 평면을 손으로 그리지 않고
  방 사각형(바닥 칸 x0..x1·y0..y1, 맨 위 두 줄은 벽면)과 이을 방 쌍만 준다. 사이 1칸 = 칸막이, 0칸 = 트인 한 방(ㄱ·ㄷ자), 2칸 이상 = 두꺼운 벽.
  `connect` 는 위·아래 방이면 1칸 틈, 왼·오른 방이면 3줄 틈(셋째 줄 통로)을 열고, 사양에 door·sidedoor 가 있으면(일본 집) 문 기물을 단다(`door:"none"` = 틈만).
  방별 floor·wall 은 zones 로 바뀐다. 결과 data 에 계산한 `plan`·`openings`.
  - 왜: 실제 조수(Gemini 3.8 Flash) 시험에서 일본 집 1층을 칸막이 0, 바닥 무늬 구역만 바꿔 깔았다 — 다다미방이 마루 한가운데 떠 있었다. rooms 를 연 뒤 jp·v5 빵집·마법 학교·업로드 칩셋 네 시험 모두 rooms 로 칸막이 있는 방을 지었다.
  - 경고 둘: 바닥만 다른 구역이 칸막이 없이 다른 바닥과 둘레 절반 넘게 맞닿으면(출구에 붙은 현관 구역 제외) 「떠 있다」, 평면이 참고문서 예제 평면(칸막이 있는 것만)과 ±3칸 밀어 94% 이상 같으면 「예제 베낌」.
    조수가 「일본 집 1층」에 예제 2층 단독주택 1층을 통째로 넣고, 경고 뒤 가로 1칸만 늘려 다시 낸 것을 잡는다(85% 문턱은 v5 두 칸짜리 가게끼리도 걸려 올렸다).
  - 역할표 id 맞춤(`fitToSpec`): 바닥·벽면·천장이 하나뿐인 사양(업로드 칩셋 역할표)이면 모르는 id(plank·log·wood)를 그 하나로 바꾸고, 가구·탁자·줄·단·탁상 물건 표가 빈 사양이면 그 목록을 빼고 방만 지은 뒤 경고로 알린다.
    시험에서 업로드 칩셋에 v5 이름을 넣어 세 번 거부된 뒤 「칩셋을 바꾸자」고 물었다. 지금은 방을 짓고 가구는 공용 기물 `stamp_object`(그림이 이 칩셋에 이식된다)로 채운다.
  - `tileset` 을 빠뜨리면 다시 지을 맵의 칩셋, 아니면 바닥·벽면 id 를 가진 칩셋이 하나뿐일 때 그 칩셋(`inferTileset`). 예전엔 늘 v5 로 떨어졌다.
  - 시험 경로: `bun scripts/qa/hand-interior-assistant-run.mts --label <l> --task "…" --model google-antigravity/gemini-3.8-flash [--start-tileset jp_city|wizarding_world] [--ugc]` —
    편집기 기본 제공자(OAuth)는 models.yml 이 아니라 편집기와 같은 자격 해석으로 부른다. `--ugc` = v5 시트를 이름표 없이 올리고 방 짓기 탭과 같은 `compileRoomKit`·`installRoomKit` 으로 역할표만 단 칩셋.
- 도구 설명은 「네모 하나로만 그리지 말 것(ㄱ·ㄷ·T·알코브)」과 ㄱ자 평면 예시를 싣는다 — 조수 호출 114번 중 99번이 바깥 모양 네모였다(2026-10-07 qa-runs 집계).
- 폐기된 실내 칩셋 `src/project/retiredInteriorTilesets.ts`: `easyrpg_chipset_interior`·`tibo_interior_expanded`·LPC 가구(32·16). 조수 목록(참고문서·공용 장소/오브젝트·킷)에서 빼고,
  `create_map`·`import_region_reference`·`stamp_object`·참고문서 읽기에서 `retired-interior-tileset` 으로 거부. 공용 장소 중 실내 태그(`공간형태:건물 내부`)인데 v5 칩셋이 아닌 것도 숨긴다.
  방 세션 도구 묶음(`INTERIOR_ROOM_SESSION_TOOLS`, place_concept·get_concept_facility 포함)은 레지스트리에서 deprecated(노출·Pi 해석 제외, `runTool` 실행 호환은 유지).
  **조수 칩셋 정책 전체(생성 칩셋 전용)는 atlas-policy 가 실행기 관문으로 맡는다** — 여기는 실내 칩셋만의 최소 판정이다.
- 정책 한 줄 `src/ai/handInteriorPolicy.ts` → Pi 시스템 프롬프트. 옛 편집기 프롬프트(`contextBuilder`)·의도 노트·능력 색인·계획·장르 프리셋의 실내 경로도 `build_hand_interior_room` 으로 바꾸고, 개념 꾸러미·방 문법 절은 싣지 않는다.
- 킷 소유(`spatialCatalog.isBundledFurniturePackKit`): `hand-interior:` 킷은 공용 오브젝트.

## 참고문서 「손 도트 실내 (v5)」

`bun scripts/content/hand-interior/prepare-references.mts` → `src/assets/sharedHandInteriorReferences.json`(용도 1 · 문서 56 · 그림 34, 그림 `public/assets/hand-interior-references/`, md 사본 `tiledata/hand-interior/v5-maps/refs/`):
읽는 순서·짓는 순서 / 구조 규칙·사용자 판정 / 사전 / 가구 사전 26분류 / 예제 26맵(도구 인자 — 도구 검사 오류 0, 네 층 정답 배열, 그림) / 정상·오류 그림 6종(검사기가 코드·좌표로 잡는다) + 레이어 정정.

## 가구 메모·방 표 (2026-09-29)

조수가 가구 사전 참고문서를 7~9번씩 따로 읽던 원인: 도구가 읽는 사양 `S` 에 설명·태그·놓는 규칙·짝 소품이 없었고, 검색도 id·이름·분류명만 봤다.

- 원본 `tiledata/hand-interior/v5/notes6.py` — `D6`(다시 쓴 설명: 무엇 + 어느 방의 어디에·무엇 옆에·몇 개, 179종. 그림은 아틀라스 좌표로 잘라 확인),
  재고 변형(그릇×상품) 틀, `PAIR6`(짝을 직접 정한 것), `ROOMS`(방 종류 48) + `LABELS`(예제 26맵의 방 → 방 종류), `segment`(평면을 방으로 나눔: 얇은 칸막이의 1~3칸 틈을 자른 4방 연결 성분).
  - `meta5.py` 가 `apply_meta` 로 `interior-meta.json` 의 description·tags·summary·where 를 채운다. 태그 = 분류 태그 + 예제에서 실제로 쓰인 방 이름(집·침실·거실 같은 넓은 분류 태그는 방 이름이 있으면 뺀다, 예제에 없는 크기 변형은 같은 variantGroup 의 방을 물려받는다).
  - `build_tileset.py` 가 `spec_notes` 로 사양 `objects[id]` 에 `desc`(60자)·`tags`(4)·`place`(60자)·`pair`(3), 그리고 `rooms`({kinds, buildings, examples: [맵, 건물, 방 종류, [[id, 개수]]]})를 싣는다.
  - 순서: `python3 tiledata/hand-interior/v5/meta5.py` → `python3 scripts/content/hand-interior/build_tileset.py`(75초) → `bun scripts/content/hand-interior/prepare-references.mts`(가구 사전에 쓰는 방·짝 추가).
- 크기: 사양 105KB → 213KB(+108KB, gzip +21KB). 타일셋 정의 +43KB(타일 설명이 길어짐, 프로젝트마다 복제).
- 도구(`parts.ts`): 검색 = id·이름·분류·태그·설명·놓는 곳·종류 낱말(바닥·벽·걸이·무늬). 여러 낱말이면 **모든 낱말이 맞는 것만**(없으면 가장 많이 맞는 것부터),
  점수 = 필드 가중(id·이름 4, 태그 똑같음 3, 분류·태그 포함 2, 설명 1) → 예제 사용 방 수. 12종 이하면 행에 desc·tags·place·pair, 넘으면 desc 한 줄.
  `room` = 방 종류 key·이름·건물 id·건물 이름·찾는 말 → 예제 방에서 쓰인 가구를 floor·wall·hang·flat·table·line·dais 별로(쓰인 방 수·개수), 건물이면 방마다 목록, 태그만 맞는 소품은 `alsoTagged`.
- 확인: `bun scripts/qa/hand-interior-parts-probe.mts` → `verify-shots/hand-interior-parts/{before,after}.json`. 테스트 `test/handInteriorParts.test.ts`.
- 조수 시험(「빵집 실내를 만들어줘」, 새 프로젝트, klb/claude-opus-5.5): 전 `bakery` 참고문서 read 8 · 도구 28 · 279초 · 입력 98만 토큰 →
  후 `bakery-notes` read 6 · 도구 14 · 125초 · 입력 40만 토큰, 가구 사전(`objects-*`)·사전·오류 문서 읽기 0. 읽기 6 중 1 은 room 요약의 예제 id 가
  `hand-bakery` 로 나와 문서 id 를 잘못 짐작한 실패였다 → 결과에 `exampleDocs`(documentId 그대로)를 싣게 고쳤다(재시험 안 함). 증거 `verify-shots/hand-interior-assistant/bakery-notes/`.
- 함정: 방 분할은 3칸 폭 방도 틈으로 잘랐다(처음) → 틈은 옆 칸이 얇은 칸막이일 때만. 흔한 소품(창·통·바 의자)이 짝으로 먼저 잡혀 자카드 + `PAIR6` 로 바꿨다.

## 예제 맵·정본

예제 26맵(`tiledata/hand-interior/v5-maps/maps.json`, id `hand-<건물>`): 빵집·약국·생선가게·정육점·대장간·예배당·학자·재단사·주점·저택 1·2층·호빗 굴·여관·드워프 홀·엘프 궁정·연회장·알현실·마법사의 탑·지하 감옥·광산·마도 기관실·극장·카지노·마구간·탄광 마을 집·조조.
저택 1층 계단(11~13,3) ↔ 2층 계단 구멍(11~13,3) 이동 이벤트(도착 = 계단 바로 아래 바닥). 지하 감옥 → 성 본채 연결은 묶음 밖이라 없다.
정본 `bun scripts/content/hand-interior/save.mts` → `.oprn-projects/hand-interior-v5-20260929`(재로드 deepEqual, 새 프로젝트 번들·옛 저장본 교체·옛 맵 보존, 증명 `tiledata/hand-interior/v5-maps/storage-proof.json`).

## 검증

- 붓: `DEV_URL=… node scripts/qa/verify-hand-interior-brush.mjs`(실제 마우스 드래그) — 천장 2종·깔개 2종·선로 mask 불일치 0, 편집기 화면 `verify-shots/hand-interior/`(이벤트 레이어 — 편집기는 늘 한 층을 흐리게 그리므로 색 대조는 편집기 그리기 함수로 찍은 조수 시험 그림과 check.json 으로 한다).
- 조수 시험: `bun scripts/qa/hand-interior-assistant-run.mts --label <이름> --task "<요청>"` — 새 SQLite 프로젝트, 칩셋은 조수가 고른다, 노출 도구·참고문서·공용 목록 덤프(visibility.json), 실행기 거부 증거(retired-probe.json), 결과 그림·BFS·재로드. 증거 `verify-shots/hand-interior-assistant/`.
- 테스트 `test/handInteriorTileset.test.ts`.

## 배·던전 — atlas_biome_dungeon

`scripts/content/atlas-dungeon/split-dungeon.mjs` 가 8e02e8e4e 시트의 2160~3299 를 떼어 `public/assets/atlas-interior/dungeon-chipset.png`(30열, 1140칸) + `src/assets/atlasBiomeDungeonTileset.json` 을 만든다.
0~509 배(480~509 옛 Tibo 짐 이식 자리는 비움) · 510~1019 던전(510+480~482 Tibo 이식 비움, 483~488 합친 마을 이식 유지, 지형 오토타일 13) · 1020~1079 지하 입구 조각(뚜껑·벽 틈·돌) · 1080~ 물길·공허 테두리 합성 칸. 예제 맵은 없다.

## 기물 묶음 배치 — vignette (2026-10-29, 사용자 결정)

> **3단계(같은 날, 벤치 room-base/vig/vig2-1029 판정):** 기본 길은 다시 **장소 견본·방 견본**이다 — 견본이 있는 용도(예배당·여관·대장간)는 제작자 구성이 묶음 배치기보다 강했다(terra 평균 기준 91.5 > 묶음 90.2). 묶음 배치기는 **대체 길**: 조수 v2 실내 빌더가 구역마다 (a) `resolveKind` 가 그 용도의 견본을 못 찾아 다른 방 견본으로 떨어졌거나 (b) 고정 크기(keep)에 ±2칸 안으로 맞는 견본이 없을 때만 쓴다(`hints.furnish:"vignette"|"template"` 로 강제). 견본이 없거나 약한 용도는 아래 「손으로 짠 방 견본」으로 채운다.

「방 통째 예시」(장소 견본·방 견본 한 벌 옮겨 심기 + 빈 바닥 메우기) 대신 **기물 묶음 라이브러리 + 결정적 배치기**. 모델은 방 용도(구역 kind)와 원하면 묶음(`zones[].vignettes`: 몸통 기물 id)만 고르고, 자리는 함수가 잡는다.

- 라이브러리 `src/assets/interiorVignettes.json` — `bun scripts/content/interior-vignettes/extract.mts` 가 방 견본 JSON(제작자 예제 방)에서 굽는다. 묶음 = **맞닿은**(틈 0칸) 기물 무리(탁상 물건은 받친 가구와, 걸이는 바로 아래 가구와, 깔개는 깔개끼리). 방 견본 옮겨 심기(`templateClusters`)는 1칸 띄운 것까지 묶어 여관 홀이 통째로 한 덩이(14×10)가 됐다. 필드: 붙는 벽(N/S/W/E, C=가운데)·상자 크기·앞 비울 줄(예제에서 잼, 1~2)·막는 칸·몸통 기물·나온 횟수·한 방 되풀이 수·화풍 묶음. 실측: v5 122방 → 582묶음, jp_city 710, modern_city 948.
- 배치기 `src/editor/handInterior/vignettes.ts` `furnishWithVignettes` — 방마다: 벽에 붙는 가장 큰 묶음(앵커, 가운데 자리부터) → 점수순(나온 횟수·이 방 종류에만 나옴·크기·읽기/계산대/잠 쓰임) 벽 묶음, 가운데 묶음은 바닥 30칸 이상에서만 → 작은 벽 소품(막는 칸 ≤2) 되풀이 → 걸이(북벽 4칸에 하나, 같은 걸이 둘까지). 문 앞 칸·묶음마다 열린 쪽 앞 줄은 비워 두고, 막힌 바닥이 방 바닥의 34% 를 넘으면 멈춘다(빈 바닥은 메우지 않는다 — 방을 줄이는 것은 짓기 쪽). 놓을 때마다 조립기 도달 검사(닿지 못한 바닥이 늘면 뺀다). 북·남 벽 묶음은 좌우 맞은편, 서·동 벽 묶음은 맞은편 벽에 짝(동·서를 보는 기물이 있으면 뒤집지 않는다).
- 연결: `build_hand_interior_room` 의 `layout.furnish:"vignette"`(+ `layout.vignettes:{방 id:[묶음]}`). 조수 v2 실내 빌더(`src/ai/v2/builders/interior.ts`)는 기본이 이 길이다 — 장소 견본(venue)·`fillBare`·`dressEmptyRooms` 를 쓰지 않는다. `hints.furnish:"template"` 이면 옛 길(장소 견본 포함), `hints.venue:true` 면 장소 견본만 허용. 「여관·inn·객잔·주막」은 tavern 방(장소 견본 없이 거실 견본이 되던 것).
- 비교: `bun scripts/content/interior-vignettes/compare.mts --out <dir> [--salt N] [--names 서재,여관,…]` — 조수 자동 짓기와 같은 길(guessPlaceSpec → builder)로 옛/새 길 1배 PNG·맨바닥·닿는 칸. 증거 `~/z-project/assistant-whole-game/suite/ledger/evidence/interior/vignette/`.
- 2판(같은 날, 감독 판정 「성기고 밋밋하다」): **레시피** `vignetteRecipe` — 앵커 1~2(몸통 기물이 서로 다름)·가운데 묶음(탁자 세트·깔개+가구)·보조 2~4·작은 소품(막힘 25% 까지)·걸이. 홀로 선 단품(마네킹·의자)은 벽 줄이나 놓은 가구 옆에만, 같은 묶음은 대칭 짝까지. **밀도**는 예제 방 실측(v5 예제 방 막힘 중앙값 40%·사분위 33~50%) — 상한 45%, 목표 36%. 묶음이 적은 용도는 같은 묶음을 함께 쓰는 가까운 용도(`relatedKinds`)로 마저 채운다. **견본 없는 용도** `PURPOSE_CORES`: 교실·학교·강의 → 서재·서고 묶음 + 칠판·교사 책상·학생 책상 줄(바닥 20칸마다 한 줄). **방 크기**: 조수 v2 실내 빌더가 레시피 발자국 ÷ 36% 로 정하고(`vignetteRoomSize`), 지은 뒤 방마다 막힘(30~44% 밖)·맨바닥(35% 초과)에서 한 번 넓이를 고친다 — 옛 5%p 줄이기 규칙·한 방 downsize 는 견본 길에만.
- 2판 후속(벤치 room-vig-1029 검수 지적): 벽 묶음·단품은 한 방에 한 번만(몸통 기물도 한 번), 맞은편에는 **같은 묶음 복사 대신** 몸통이 다른 같은 벽 묶음(폭 ±1)을 놓는다 — 서재 망원경 세트·연구실 솥/바구니 좌우 복사가 「복붙」 major 였다. 가운데 묶음(탁자 세트)만 두 번까지. 가운데 묶음은 의자가 딸린 것을 먼저(여관 「의자 없는 식탁」), 바닥 20칸부터 가운데 묶음. 넓이 고치기는 맨바닥 30% 초과에서, 줄일 땐 깊이를 먼저(남는 맨바닥은 문 쪽 아래 줄에 모인다), 다시 지어 묶음이 덜 들어가면 줄이지 않는다. 묶음 길은 소금으로 배치 변주(C·D)를 고르지 않는다 — C·D 는 한 방을 가로 +4·사방 +2 칸 키워 발자국 크기를 버렸다(서재 6×6 요청 → 8×8).
- 남은 것: layout 배치기가 요청보다 작은 방(5×6)을 키워 짓는 경우가 있다(그때는 묶음 보충으로 채운다). 다중 방 건물의 방별 묶음 고르기 시험 전.
- **4판 — 서재 조합 길(2026-10-29, 사용자 신고 「서재를 지으라면 매번 같은 방·늘 ㅁ자」):** 고치기 전엔 서재 견본 풀이 손 견본만(authored-study-xs/s/sq/m/l = 귀족 서재 한 설계의 크기 변형)이었고, 고르기에 씨앗이 없어 게임이 달라도 authored-study-sq 였다(15판 중 서로 다른 그림 2장).
  - 견본 길(`hints.furnish:"template"`, 그리고 서재 밖 모든 종류): `templatePool` 이 손 견본 + 같은 종류의 평범한(EXOTIC 아닌) 예제 견본을 함께 후보로(밀도 필터 유지, 한 방짜리 장소는 4×5 같은 곁방 크기를 뺌). `pickTemplate` 은 결정적 열쇠(`PlaceSpec.variety` = make_place 가 넣는 프로젝트 열쇠 + 요청문, 없으면 게임 제목)로 크기 띠 안의 «설계»(`templateDesign` — 손 견본 크기 변형은 한 설계)를 고르고 그 설계의 크기 변형을 고른다. 마법·엘프 설계는 그 낱말이 있을 때만(있으면 크기 띠 밖이라도 먼저). 고른 견본은 layout 에 못 박는다(크기만 주면 layout 이 같은 크기·화풍에서 다시 sq 를 골랐다). `rotateTemplate` 은 같은 설계의 다른 크기보다 덜 쓴 «설계»를 먼저. variety 가 있으면 무작위 salt 대신 그 해시로 변주·layout seed.
  - 조합 길(서재 기본, `COMPOSED_KINDS`): `composeShape` 가 씨앗으로 방 모양(네모·가로로 긴·깊은·ㄱ/ㄴ자 한 귀퉁이·창가 돌출=북쪽 두 귀퉁이·ㅗ자=남쪽 두 귀퉁이·곁방 딸린 2실(서고·연금 구석))과 출구 자리(`layout.exitAt`)·재질(성격별)을 고르고, 바닥 넓이는 크기 낱말 띠(작게 24~32·보통 36~50·크게 56~72칸). 귀퉁이는 `layout.rooms[].notches` 로 넘긴다(방이 받을 만큼 클 때만, 동서 뒤집기면 뒤집음). 꾸미기는 `furnishWithVignettes(…, {seed})` — `composedPool`: 라이브러리 묶음 + 손 견본에서 그 자리에서 뽑은 묶음 + 이웃 용도(서고, 마법사면 연금·실험실), 성격 낱말(`roomCharacters`: 마법·천문·학자·귀족·엘프)이 묶음 점수에 ±, 마법·엘프 묶음은 그 낱말 없으면 뺀다, 장식 계단 뺌. 씨앗이 역할마다 시작 묶음(앵커 앞 5·가운데/보조 앞 4)·벽 자리 시작점·좌우 뒤집기를 정한다. 서재는 책장 든 앵커가 먼저(`COMPOSE_MUST`), 지구의·시계·벽난로 등은 방에 하나(`ONE_PER_ROOM`). 함정: 「bookshelf」 안의 elf 를 엘프로 읽어 책장이 다 빠졌다 — 기물 성격 낱말은 경계(`\belf\b`).
  - 시험 `bun scripts/qa/assistant-v2/studyVariety.mts <out> [--furnish template|vignette] --tag X`(요청 5 × 게임 3). 2026-10-29: 서로 다른 그림 고치기 전 2/15 → A 8/15 → B 15/15, 같은 입력 재실행은 화소 같음. 블라인드 판정(Sonnet 한 번): 평균 A 5.73 · B 6.13, 짝 승 B 8·A 5·무 2, 「같은 방 되풀이」 쌍 고치기 전 69 · A 15 · B 3. 페이지 `~/claude-viz/study-variety-1029.html`. 남은 약점: ㅗ자·큰 방 가운데 맨바닥(25~40%), 판정 점수 자체는 5~8 — 다른 방 종류로 넓히기 전에 이것부터.
- **5판 — 방은 조수가 설계한다(2026-10-29 사용자 결정 「방을 짓는 건 조수여야만 한다」):** 4판 조합 길(B)·견본 고르기(A)는 함수가 가구를 고르고 자리를 잡았다. 이제 모델이 `make_place` 의 `zones[].design`(`src/ai/v2/types.ts` `ZoneSpec.design`, 형식 `src/editor/handInterior/designRoom.ts` `RoomDesign`)에 방 모양(rect·L(corner)·T·bay)·바닥 크기 w×h·문 자리·바닥/벽면 재질·가구 묶음(name·at 벽/모서리/center·pos 0~1·rug·items[{id, dx, dy, count}])을 쓴다.
  - 누가 무엇을 정하나: **모델** = 모양·크기·문·재질·무엇을 몇 개·어느 벽·묶음 안 상대 자리·깔개. **함수**(`furnishFromDesign`) = 칩셋에 없는 이름은 가까운 이름으로 맞추거나 빼기, 묶음 안 겹침 밀기, 책상·탁자와 맞닿은 의자를 그쪽을 보게 돌리기, 벽 가구(책장)·걸이는 북벽 묶음으로 떼기, 방 밖·도려 낸 귀퉁이·문 앞 통로·다른 묶음 겹침·벽면 열 다툼을 피해 가장 가까운 자리(8칸 안)로 밀기, 놓을 때마다 조립기 도달 검사, 끝내 못 놓으면 빼기. 함수는 가구를 더하지 않는다 — 설계 방은 견본 고르기·방 줄이기·빈 바닥 메우기(fillBare·dressEmptyRooms)·빌린 견본 바꾸기·장소 견본을 모두 건너뛴다.
  - 고친 것은 결과 warnings 에 「고침: …」 줄로, 맨바닥이 15% 를 넘으면 「설계 방 …: 맨바닥 N%」 줄로 돌려준다 — 모델이 design 을 고쳐 `edit_place({patch:{mapId, design: 고친 설계 전체}})` 로 한 바퀴 다시 짓는다(`applyPatch` 가 같은 종류 설계 구역을 addZones 로 다시 보낸 것도 바꾸기로 읽는다). `dress_room` 은 설계 방을 거절하고, `dressing` 은 설계 방에 소품을 더하지 않는다. 지도 위치 태그는 `model-designed`(견본 태그 없음).
  - 재료: v2 동사 `room_parts({purpose, query?})` (`src/ai/v2/roomParts.ts`) — 그 용도 기물 이름표 90줄(id·한국어·크기·벽 가구/걸이/바닥·놓는 곳), 바닥·벽면·깔개 id, 같은 용도 손 견본 3개의 바닥 좌표 배치 요약과 견본 1배 그림 2장(따로 지은 사본에서 찍고 프로젝트에는 남기지 않는다). 견본은 참고 — 카드가 「베끼지 않는다」고 적는다.
  - 설계 없이 온 손 도트 실내 `make_place`(마법 학교·전국·현대 화풍과 `mapId` 다시 짓기 제외)는 장소 이름마다 한 번 되돌려 보낸다(`session.designBounced`) — 다시 설계 없이 오면 예전 함수 견본 길로 짓는다. 2026-10-29 실조수 3a 판: 되돌려 보내기 전 설계율 Argon 3/5 · flash 2/5 · terra 5/5.
  - 의자 방향은 묶음을 넘어서도 맞춘다: 방을 다 놓은 뒤 책상·탁자와 맞닿은 의자가 다른 쪽을 보면 그쪽 방향 그림으로 바꾼다(그림이 칩셋에 있을 때만).
  - 설계 읽기는 너그럽다(2026-10-29 Argon 이 `door:{edge:"south"}`·`at` 없는 묶음으로 엄격한 enum 검증에 15번 막혔다): 스키마에 enum·범위를 두지 않고 `normalizeShape/Door/Corner/At` 이 「southeast」「north wall」「북서」「0.5」 같은 말을 읽는다. `at`·`x/y` 가 없는 묶음은 items 의 `dx/dy` 를 바닥 좌표로, 기물 `x/y` 는 `dx/dy` 로, 묶음 `dx/dy` 는 `at` 이 있으면 그 자리에서 민 만큼·없으면 `x/y` 로 읽는다.
  - 되돌려 보내기 답은 「아직 짓지 않았다(실패 아님)」과 함께 room_parts 재료(이름표·견본 배치, 그림 없이)를 싣는다 — 되돌려 보내기를 실패로 읽고 그만둔 모델(flash)이 있었다.
  - **모양 재료(2026-10-29 3d):** 3c 15판의 설계 14개가 rect(ㅁ자)였다 — 모양 이름 한 줄뿐이라 고를 재료가 없었다. 이제 모양 어휘는 rect·L(ㄱ자)·U(ㄷ자)·T(ㅜ자)·bay(창가 돌출)·alcove(알코브)이고(`designRoom.ts` `SHAPE_GUIDE`·`shapeNotches`), `room_parts` 가 모양별 최소 바닥 크기·쓰임(`shapes`), make_place 에 그대로 넣을 수 있는 설계 예시(`shapeExamples`, `roomParts.ts` `SHAPE_EXAMPLES` — 곁방 딸린 2실은 zones 둘)와 **그 예시를 지금 빌더로 실제로 지은 1배 그림**을 돌려준다. 되돌려 보내기 답에도 shapes·shapeExamples 가 실린다.
    - ㄷ자는 북벽 가운데를 도려 낸다 — `HandInteriorNotch.at`(방 서쪽 끝에서 몇 칸, `rooms.ts` `notchRect`)으로 귀퉁이가 아닌 가운데 도려내기를 받는다. 배치 후보 좌우 뒤집기는 `at` 도 뒤집는다(`layout.ts`).
    - 바닥이 그 모양 최소보다 작으면 함수는 크기를 키우지 않고 네모로 지은 뒤 「고침: 모양 U(ㄷ자)은 바닥 8×5 이상에서…」로 알린다.
    - 벽 가구·걸이는 도려 내 내려온 북벽 밑에도 선다(`wallRowOf`) — 창가 돌출 양옆·ㄷ자 가운데·알코브 옆에 책장·벽난로·창.
    - 설계 방의 ㅁ자 경고(`handInteriorTools` 「칸막이·알코브 없는 직사각형」)는 설계 말로 바꿔 돌려준다(shape 바꾸기·곁방 zone) — 3c Argon 귀족 서재는 「알코브·칸막이」만 듣고 같은 네모를 여덟 번 다시 지었다.
  - **긴 묶음은 들어가는 만큼(3d):** 묶음이 벽·방보다 길면(책장 3w×3 을 8칸 북벽에) 묶음째 버리지 않고 뒤 기물부터 덜어 들어가는 만큼 놓고 「묶음 전체(3개)는 … 2개만 놓고 bookshelf 3w 를 뺐다」로 알린다. 묶음이 바닥보다 크면 그 이유를 쓴다.
  - **맨바닥은 모델에게(3d):** 기계 검사 `bare-floor`(`checks.ts`)는 설계 방(`model-designed`)이면 바닥 20칸부터 재고, 고칠 말을 dress_room 이 아니라 「design.w·h 를 줄이거나 묶음을 더해 edit_place 로」로 준다 — 남은 문제가 끝맺음 관문에서 고치기 한 바퀴를 연다. 함수가 방을 줄이거나 채우지 않는다.
  - **진단(3d):** 3c Argon 「마법사의 서재」는 room_parts 한 번 뒤 «도구 호출 횟수 초과»라며 짓지 않았다 — 실행 기록상 도구는 1회·오류 0, 앞 차례는 제공자 첫 응답 시간 초과였다(제한은 없다, 모델이 지어낸 사유). `OPRN_TURN_DIAG` 면 `turn.diag` 에 제공자 오류 글, `tool.size` 에 도구 결과 글자 수·그림 수를 남긴다(`scripts/lib/piAgentRuntime.ts`). 끝맺음 관문의 「아무것도 안 바뀌었다」 글은 «호출 횟수 초과»로 끝내지 말고 make_place 로 지으라고 이른다.
  - 도구 층: `build_hand_interior_room` 의 `layout.designs:{방 id: RoomDesign}`. 설계가 없는 방은 예전 가구 길(견본·묶음) 그대로.

## 남은 것

- `author_house(interior:"linked-interior")`·`author_village` 의 연결 실내는 아직 옛 EasyRPG 실내 파이프라인으로 짓는다(코드 내부 경로라 이번 폐기 범위 밖) — v5 조립기로 옮기거나 관문이 막아야 한다.
- 예제 탁상 물건은 합성 칸이라 도구로 다시 지으면 칸 단위 위치로 조금 달라진다.
- 조수는 room 결과를 받고도 가장 가까운 예제(빵집)를 거의 그대로 옮긴다 — 시험 전후 두 빵집의 평면이 같다. 검색이 좋아져도 「짜임을 배워 새 평면」은 여전히 약점.
- 설명을 다시 쓴 179종 밖(재고 변형 110종은 그릇×상품 틀, 나머지는 옛 설명의 첫 문장/나머지로 나눔)은 그림 대조를 한 번 훑었을 뿐이다.

## 편집기 「새 맵 → 실내」 기본 (2026-10-01)

`src/project/mapCreateSpec.ts` 의 `INTERIOR_TILESET_ID` 는 `atlas_biome_interior` 다(이전: `easyrpg_chipset_interior`). 사람 경로 `createMapFromSpec`(`editor/actions.ts`)는
v5 맵을 바닥 한 칸으로 채우지 않고 `handInteriorStructure` 로 **방 껍데기**를 깐다 — 사방 `#` 테두리, 맨 아래 줄 가운데 출입구 한 칸,
바닥 `INTERIOR_SHELL_FLOOR`(boards)·벽면 `INTERIOR_SHELL_WALL`(plaster)·기본 천장. 벽면 두 줄·천장 띠·그림자는 조립기와 같은 규칙이라 뒤에 build_hand_interior_room(replace) 로 다시 지어도 모양이 이어진다.
옛 EasyRPG 실내 번호가 필요한 파라메트릭 실내·공간 카탈로그 이관은 `EASYRPG_INTERIOR_TILESET_ID`/`EASYRPG_INTERIOR_FLOOR_TILE`(72) 을 쓴다.
회귀: `test/mapCreateSpec.test.ts`. 렌더 확인: `verify-shots/hand-interior-port/`.

## 고른 후보 반영 (2026-10-01)

사용자가 고르는 화면(`http://mdc-server:18302/`, 정본 `~/.local/share/oprn/hand-interior-pick/picks.sqlite`, 내보내기 `tiledata/hand-interior/pick/picks.json`)에서 고른 후보를
`build_tileset.py` 가 **기본으로** 넣는다(`HAND_INTERIOR_PICKS=0` 이면 v5 원본 그대로 — 그때 산출물은 이전 main 과 바이트 같다). 넣는 코드는 `scripts/content/hand-interior-pick/install_picks.py`.
- 크기가 같은 선택(125종): rooms4 import 전에 `kit4.OBJ` 를 바꿔 예제 맵·시트 모두 새 그림.
- 크기를 바꾼 선택(11종, `candidates/<slug>/resize.json` — 왕좌 3×2·설교단 4×3·지휘대 2×2·발깔개 2×1·내려가는 계단 2×2·그물 3칸·벽 지도·다트판·사슴 박제 2칸 등): rooms4 import 뒤에 넣고,
  예제 방의 그 기물을 새 크기로 **다시 놓는다**(원래 자리부터 가까운 순, `room4.check` 이슈가 늘지 않고 방 밖에 그림이 새지 않는 첫 자리). 자리가 없으면 그 방에서 뺀다(알현실 서재의 벽 지도 1건).
  바뀐 방은 META 의 items·정답 격자(`room4.check` grid)를 다시 써서 `tiledata/hand-interior/v5-maps/buildings.json` 으로 내보낸다 — `prepare-references.mts` 가 이것으로 도구 인자를 만든다(예제 도구 오류 0).
  발밑 칸 중 그림이 없는 칸(설교단 계단 귀퉁이)은 `cells` 로 빼서 걷게 둔다.
- 「함께 쓰기」 변형: `<원 id>#2…` 로 가구 표에 더한다(무대 배경판 5개). 가구 381 → 386종.
- 굽기 2판(2026-10-01): 3/4 재작도 64종(v34-redo.json) + 변형 몸통 맞추기 71종(variant-bodies.json) + 새 기물 28종. 사용자가 「3/4 만 지키고 알아서 골라라」로 위임해 감독이 고름(picks 이벤트 client=agent-v34). 386 → 414종, 예제 26곳 BAD 0·예제 도구 오류 0.
- **굽기 3판 — 3/4 전수조사(2026-10-01).** 사용자 「3/4 뷰를 안 지키는 게 계속 생긴다」(기둥·석관·회중석). 시트 414종 전수조사: 명백한 위반(A) 44 · §11-1 수치 미달(B) 114 · 통과 256 — 판정 원본 `tiledata/hand-interior/pick/audit/`, 배정 `v34-audit.json`. 위반 다수는 2판에서 **관문을 통과해 골라진 그림**이었다(관문은 밝은 줄 행 번호만 잰다). A 44종을 다시 그려 구웠다: 작업자 21종 + 감독 직접 23종(`w110-A`, 원통·상자 기하로 찍고 그 기물 팔레트로 양자화). 판정 = 기준 그림(`style-demo-view34/interior-new-*`, `view34_interior_proof2.py`) 8배 대조 + 독립 적대 검수 — **관문은 근거로 안 쓴다**(`modern-style-bible.md` §11-4, 작업자 절차 `WORKER-V34-AUDIT.md`). 414종 유지, 예제 26곳 BAD 0. B 114종(탁자 앞면 3~4px·바구니/궤짝 입구 2~3px)은 몸통 단위로 다음 판.
- 건너뛰는 것: 선택 없음·v5 유지, 크기를 바꾸라는 메모 뒤 새 크기 후보를 아직 고르지 않은 것(마법서 독서대), 애니메이션 기물. 목록은 `tiledata/hand-interior/pick/out/baked.json`.
- **굽기 4판(2026-10-02).** 소품 하네스(`/harness`)에서 고른 새 기물 113종(2층 침대 가로 포함) + 다시 고른 3종(접시·컵 탁자, 세면대, 숫돌). 414 → 527종. 가구 사전 참고문서는 분류가 37개로 늘어 문서 한도(64)를 넘어서, 8종 미만 분류는 20종 넘게 묶어 한 문서로 싣는다(`prepare-references.mts`, 54문서). 증거 `verify-shots/interior-bake-4/new-objects.png`.
- 3/4 재작도 후보(w90·w91, 54종)는 아직 고르지 않아 들어가지 않았다. 고른 뒤 `python3 scripts/content/hand-interior/build_tileset.py && bun scripts/content/hand-interior/prepare-references.mts` 를 다시 돌린다.
- **굽기 5판 — 실내 공통 팔레트 v6(2026-10-03).** 사용자 「몬스터뿐 아니라 타일들도 문제」: 시트가 4041색, 새 기물 팔레트(v5.pal 203색)에 드는 화소는 19.8%. `palette/v6.pal` = v5.pal 그대로 + 시트가 쓰는 색 중 v5 밖의 것을 OKLab 가중 k-means 로 묶은 128색(`@rampc s1…s14`, `build_merged_palette.py`, 시안 `interior-merged-palette.html`) = 331색. `build_tileset.py` 가 시트와 예제 맵 그림을 쓰기 직전 `palette_snap.py`(화소마다 OKLab 최근접, 알파 그대로)로 옮긴다(`HAND_INTERIOR_SNAP=0` 이면 끈다). 픽셀 검사는 옮기기 전 그림끼리라 그대로 BAD 0. 칸 번호·정의 JSON 은 바뀌지 않는다 — 실측: 새 시트 = snap(이전 시트) 화소 차 0, 바뀐 화소 720,337, 평균 OKLab 차 0.0054, 시트 332색. 굽기는 4판의 고르기(`HAND_INTERIOR_PICKS_JSON=<e231100813 의 picks.json>`)로 해서 팔레트만 바뀌었다. 소품 하네스의 공통 팔레트(`common.SHARED_PAL`)도 v6 — 후보 폴더 `palette.pal` 은 v6.pal 이 더 새로우면 다음 판에서 다시 만든다(`brief.ensure_folder`). 작업자가 v5 옛 색을 써도 굽기에서 v6 로 맞춰진다.


## 새 기물 길 (2026-10-01)

v5 381종 밖의 기물을 추가하는 길. 명세 `tiledata/hand-interior/new/items.json`(28종: 무기 진열대·관·지구본·배 선실 소품 등) → `make_jobs.py --prep "<id>"`(투명 캔버스 후보 폴더) →
후보 `candidates/<slug>/wNN-X.pxg`(`check_candidate.py`, `context.py` 가 `contextRoom` 에 임시 한 번 놓아 확인) → 18302 에서 사용자가 고름 → `build_tileset.py` 가 굽는다.
- 코드: `scripts/content/hand-interior-pick/new_items.py`(`register`·`meta_entry`), `common.py`(`load_new_items`·`new_item_object` — v5 메타 모양의 가짜 객체, `atlas.x=-1`), `install_picks.py`(`_NEWS` 분기: rooms4 import 전에 `kit4.OBJ` 등록, `variant_meta` 에서 메타 추가).
- 고른 것만 시트에 들어가고 `handInteriorSpec.json` objects 에 kind·w·h·up·cells·desc·tags·place 가 실린다(예: 지구본·관 모의 굽기에서 386 → 388종(386 = v5 381 + 함께 쓰기 변형 5)). 고른 것이 없으면 산출물 바이트 동일, `HAND_INTERIOR_PICKS=0` 이면 제외.
- 새 분류 ko 이름: `ship`=배 선실, `crypt`=지하묘지(`tiledata/hand-interior/v5/meta5.py` 의 `ko.CAT.update`).
- 새 기물은 resize.json·변형·예제 방이 없다. `prepare-references.mts` 는 v5 메타가 없으면 명세의 desc·place 를 쓰고 「예제 방 없음」을 덧붙인다.
- 한계: `apply_picks.py`(미리보기 아틀라스)는 새 기물을 넣지 않는다(아틀라스 자리 없음).
- **쓰임·방향·상태 짝 (2026-10-01).** `tiledata/hand-interior/v5/use6.py` 가 414종에 `use`(sit·sleep·open·search·read·counter·travel·light·walk·block, 새 기물은 save·heal·switch·push·trap·key·gate·seal 도)·`facing`(이름의 N/S/E/W)을 붙이고 짧던 설명 44종을 보강한다 → `notes6.spec_notes` → `handInteriorSpec` objects → `hand_interior_parts` 결과 행·검색어. 새 기물은 items.json 항목에 `use`·`facing`·`states`(`{group,state,others:{상태: id}}` — 닫힘↔열림 그림 짝)·`place`·`pair`·`refs`(가장 닮은 기존 기물, 하네스가 화풍 기준 맨 앞에 둔다)를 직접 적는다.
- **JRPG 장치(분류 `gimmick`) 11종 시범**: 보물상자 작은·큰, 세이브 수정, 회복의 샘, 벽 레버, 압력판, 밀 바위, 쇠창살 문, 가시 함정, 열쇠 받침대, 봉인석. 둘째 상태(열림·켬·눌림·열린 문·숨은 가시)는 사용자가 첫 상태를 고른 뒤 그 그림을 출발점(`--base`)으로 그리고 `states` 로 묶는다.
- **칸 번호 고정 (굽기 4판, 2026-10-02).** 예전엔 굽기마다 번호가 밀렸다(가구가 하나 늘면 그 뒤 탁자·단·줄·탁상 물건·합성 칸이 통째로 밀려, 이미 깐 사용자 맵의 그림이 어긋났다 — 4판을 그대로 구웠으면 가구 33종 + 탁자·단·줄·탁상 물건 전부가 밀렸다). 이제 `build_tileset.py` 가 쓰기 전에 `pin_ids.py` 로 **디스크의 이전 굽기**(사양·예제 맵·정의·시트)와 자리 키(가구 id+칸 위치, 탁자·줄 조각 키, 단 조각, 탁상 물건, 바닥·벽면·천장 순번, 예제 맵 칸)를 맞춰 같은 자리는 이전 번호를 그대로 쓴다. 다시 고른 그림은 그 번호에서 그림만 바뀌고, 새 칸은 시트 끝에 붙는다(띠는 12칸 정렬). 아무도 안 쓰게 된 옛 번호는 옛 그림·옛 정의를 그대로 남긴다(설명 앞에 「옛 굽기 칸」). `HAND_INTERIOR_REPACK=1` 이면 고정 없이 빽빽하게 다시 싣는다 — 모든 맵을 다시 지을 때만. 4판 실측: 이전 자리 17168개 중 번호가 바뀐 자리 0, 그림이 바뀐 옛 칸 5(다시 고른 3종), 6268 → 6557칸. 편집기 쪽: `isHandInteriorV5Definition` 은 칸 수가 번들 **이하**이면 같은 시트의 옛 빌드로 보고 `ensureAtlasBiomeInteriorCurrent` 가 count·통행·메타·킷과 번들 참고문서 분류를 새로 고친다(맵은 안 건드리고 경고도 없다). 검사: 이전 굽기와 이번 굽기 사양을 `pin_ids.slots` 로 펼쳐 같은 키의 번호가 같은지 본다.

## 소품 하네스 — 여러 명이 찍고 사용자가 고른다 (2026-10-01)

기물 그림을 고칠 때 감독이 직접 고르고 끼워 넣지 않는다(3/4 전수조사에서 감독이 고친 것 다수가 되돌려졌다 — `tiledata/atlas-pick/modern-style-bible.md` §11-4b).
`src/harnesses/interior-props/` 가 판을 연다: 기물 하나에 Sonnet 5.5(effort medium) 다섯 명이 방향 A~E(최소 수정 ×2 · 기준 맞추기 ×2 · 자유)로 후보 `h<판>-<글자>.pxg` 를 한 장씩 찍는다. 한 장마다 깨짐 검사 → 독립 검수자(3/4 시점·「지금보다 나빠졌나」, 8배·방 안)를 거치고 떨어지면 이유를 들고 최대 3번까지 다시 그린다. 그다음
사용자가 고르기 서버의 `/harness` 화면(18302)에서 지금 그림·방 안과 나란히 보고 확정·버림(+이유)·다시 뽑기(+메모)를 한다.
고른 것은 `picks.sqlite` 에 client=web 으로 들어가 다음 판의 화풍 기준(anchors)이 되고, 버린 것·이유·메모는 다음 판 작업지시서에 들어간다.
굽기는 `harness.py bake`. 쓰는 법·함정은 `src/harnesses/interior-props/README.md`.

**파생 모션 굽기(2026-10-04):** 서버 하네스에서 움직임 묶음을 고르면 원본과 별개의 `<원본> ~motion` 기물을 만든다.
첫 프레임과 전체 띠(`.loop.png`·프레임 수/간격/화소 해시를 가진 `.loop.json`)를 재로드한 뒤 같은 공용 실내 번들로 굽는다.
모션의 4프레임·150ms를 보존한다(`animationStrips`의 fps=1000/150). 기존 기물은 12프레임·10fps로 유지된다.
`handInteriorSpec.json`은 방향·상태·움직임의 자식 관계와 `derivationSets`를 함께 배포한다.
띠가 없거나 명세·해시·첫 프레임이 다르면 이유를 남기고 건너뛴다. 선택 전에는 모션 자식을 등록하거나 번들에 설치하지 않는다.


### 서버 하네스의 자동 공용 등록 (2026-10-04)

`/harness`의 확정은 선택 DB 커밋 뒤 공용 SQLite 라이브러리 `oprn-hand-interior-harness`에 자동 게시된다.
현재 앱 번들과 구분되는 예약 타일셋 `shared_hand_interior_harness`로 그림·기물 킷·참고문서를 함께 싣는다.
새 프로젝트와 기존 프로젝트 모두 호스트의 공용 기본 목록을 다시 읽을 때 설치된다.
기물 검색·배치는 `list_spatial_designs`와 `stamp_object`를 사용한다. `build_hand_interior_room`은 앱 번들의 사양이다.
사용자가 고른 단품·방향/상태 자식·모션만 반영하며, 게시 실패는 선택을 지우지 않는다.
대기열·재시도·칸 번호 보존·저장 후 재로드 계약: [하네스 문서](harnesses/interior-props.md#서버-확정--공용-sqlite-자동-등록-2026-10-04).
새 쓰임 `play`(오락기·놀이 기구)는 `use6.USE_KO`의 정식 낱말이다.

## 박물관·배 안·투기장 — interior-plus (2026-10-14)

v5 시트 **끝에 덧붙인** 손 도트 조각(같은 팔레트 v6·같은 램프, Opus 손 도트)과 방 종류 16개. 칸 번호는 덧붙이기만 한다 — 6557 이전 칸은 화소·통행·층·메타가 그대로이고
(굽기가 매번 대조한다), 기존 프로젝트는 `ensureAtlasBiomeInteriorCurrent` 가 정의를 새로 고친다(번들 칸 수 이하 = 같은 시트).

- **그림**: `scripts/content/interior-plus/pieces/{structure,museum,ship,arena}.py`(iplib: 램프·box·cyl·barrel·shadow). 기물 69(박물관 24·배 25·투기장 20) + 바닥 5(deck·hold·parquet·sand·sandstone) + 벽면 4(hull·cabin·gallery·arenawall).
  v5 와 겹치는 것(함포 `ship cannon`·조타륜·해먹·닻·밧줄 더미·흉상·고딕 미술관 조각)은 새로 그리지 않고 v5 id 를 쓴다. 북쪽 벽 포문을 보는 함포(cannon north)·나침반 함·선원 3층 침상 등은 새 것.
- **굽기**: `python3 scripts/content/interior-plus/bake.py` — 핀 `tiledata/hand-interior/plus/pins.json`(키 → 칸 번호, 덧붙이기 전용; `--repack` 은 내보내기 전에만),
  정의·사양을 v5 끝(base)으로 자른 뒤 다시 얹는다. v5 id 와 겹치는 이름은 거부한다(2026-10-14 `orrery` 가 v5 기물을 덮을 뻔했다). `build_tileset.py` 끝에서 자동으로 다시 돈다(`HAND_INTERIOR_NO_PLUS=1` 로 끔).
- **3/4 관문**: `gate_export.py pending` → `npm run harness -- object-gate review --batch tiledata/hand-interior/plus/_gate/pending.jsonl`. 바닥·벽면은 조립 방 4장(`gate_rooms.py`, kind structure)이 그 칸을 화소 그대로 품어 덮는다.
  굽기는 모든 영수증이 PASS 여야 한다(프로필이 미보정이면 현재 프로필 PASS 를 「미보정 임시 통과」로 세고 보고한다 — jp-city `gate_kinds.state` 와 같은 뜻).
  2026-10-14 결과: 처음 78건 중 37건 FAIL(거의 「정면 입면도 · 윗면 0행」) → 다시 그려 기물 69 + 조립 방 4 **모두 현재 프로필 PASS(미보정 임시)**. 끝내 못 넘은 넷(보석·왕관 1칸 유리 진열장, 관람 줄 기둥 하나, 용 두개골)은
  세트에서 뺐고 예제는 v5 `accessory case`·`crown pedestal`·`plinth fossil` 로 바꿨다. 옆 보는 함포 둘은 옆모습이라 넘지 못해 북쪽 벽 포문을 보는 `cannon north` 하나로 바꿨다(포 갑판은 북벽에 포문+함포 줄).
  조립 방 그림은 조립기와 같은 천장 띠(벽 윗면) 칸을 v5 시트에서 그대로 쓴다(`gate_rooms.room_image`). 바닥이 벽과 같은 결이면 판정자가 입면도로 읽는다 — 갑판·짐칸 널은 남북으로, 사암 바닥은 네모 판석으로, 벽 머리에 윗면 띠(선체 덮개널·투기장 갓돌)를 그렸다.
  한 장씩 다시 받기: `python3 scripts/content/interior-plus/gate_some.py <out> "<id,id>"` → `object-gate review --batch <out>/items.jsonl`.
- **방 종류·견본**: `tiledata/hand-interior/plus/plans/*.json`(museum·ship·ship_hold·arena, 방 사각형 입력) → `rooms_json.py`(사양 rooms: 종류 이름·찾는 말·건물·예제 가구 수) ·
  `templates.mts` → `src/assets/interiorPlusRoomTemplates.json`. `templates.ts` 가 v5·전국 견본과 **배열로 이어 붙인다**(같은 칩셋 키를 펼치기로 합치면 v5 견본이 사라진다).
  `layout.ts`: HUB 에 museum_lobby·museum_gallery·ship_crew·ship_gundeck·arena_floor·arena_stands, 출구 순서에 museum_lobby·ship_crew·ship_cargo·arena_armory, 기본 트임 arena_stands↔arena_floor. 화풍 묶음 museum·ship·arena.
- **참고문서**: `prepare-references.mts` 가 같은 용도에 `hand-interior-v5-plus`(경계·방 종류·배치 규칙)와 예제 4장 `hand-interior-v5-map-{museum,ship,ship_hold,arena}`(rooms 입력 + 도구가 만든 평면 + 네 층 배열 + 그림)을 넣는다.
- **조수 경로**: `src/ai/interiorPlusPolicy.ts` — plainTurn 테마 사슬(앞이 잡으면 끝)에서 시대 테마·jp_city 다음, **고딕·해적 군도보다 앞**. 의도 선언 지시문(intentDeclaration)과 HAND_INTERIOR_POLICY_LINE·도구 설명에도 같은 경계를 적었다.
  경계 결정: ① 박물관·미술관·전시실은 호러·고딕·흉가·저택·폐성·유령 낱말이 없을 때만 여기(있으면 gothic_manor `build_gothic_place place:"gallery"`). ② 배 «안»(방 낱말: 선장실·조타실·선실·화물칸·포 갑판·배 주방·배 감방)은 여기,
  해적 항구·섬·난파선 같은 바깥은 pirate_isles. 보고 있는 맵이 pirate_isles 면 배 테마는 잡지 않는다(그 칩셋의 `compose_pirate_isles_map kind ship` 을 지킨다). ③ 투기장·콜로세움·검투사는 여기. 바깥 낱말만 있고 실내 힌트가 없으면 잡지 않는다.
- **조수 실제 실행(2026-10-14, gemini-4-argon · 추론 medium, 실제 입력창 Pi 경로, 새 프로젝트)**: 「박물관 전시실」 7 · 「해적선 선장실과 화물칸」 8 · 「검투사 투기장」 7 · 「배 안 주방과 선실」 7(0~10, 원본 해상도).
  말한 방만 짓기(SUBSET_GUIDE)는 지켜졌다. 지침 개선 1회(다시 짓기 한 번·w·h 만 줄이기·layout 좌표를 손으로 옮겨 적지 않기·벽면을 지나는 통로는 정상 문)로 점수는 같고 짓기 횟수 12→6(투기장 5→1). 옛 gemini-3.8-flash·gpt-6.1-sol 시험(gpt 7/7/5/6, 지침 전)과는 섞지 않는다.
  시험 도구는 /tmp 사본(`assistant-capability` editorDriver 를 그대로 부른다) — 다시 하려면 하네스 `assistant-capability` 로.
- **적대 검수(2026-10-14)**: 9방(전시실·유물실·선장실·배 주방·화물칸·포 갑판·관중석·모래 마당·검투사 방)을 원본 해상도로 새 검수자가 보고 결함 47건(높음 8). 한 번 고친 것:
  그림 액자 한 중심선·관람 줄이 그림을 가리던 것·진열장 윗면 판·쇠창살 문을 벽면 걸이로(모래 위에 서 있던 문)·물통 거치대와 자루가 발밑 칸보다 7px 떠 있던 것·삼베 자루 색·닻 사슬 고리·고패 지렛대·핀 막대·북채(뿔처럼 보임)·허수아비 얼굴 제거·선체 벽 걸레받이·투기장 모래 반복·관중석 좌석 정렬·사다리와 돛대가 한 기둥으로 보이던 것·주방 탁상 물건이 탁자 앞턱에 그려지던 것(2줄 탁자로).
  남은 것: v5 조각(족쇄·짚 더미·화로)이 사암·돌무더기 벽 위에서 잘 안 보인다, 대리석 바닥 광택 줄 반복(v5 바닥), 관중석 계단 단차(층 높이는 이 칩셋 구조 밖).

## 3/4·품질 재검 — 의자 밖 기물 (2026-10-20, props34)

감사 `~/claude-viz/interior-props-34-audit-1.*` 가 이 칩셋 기물 100종을 FAIL 로 냈지만 사유가 분류 틀 문장이라, 의자 4종을 뺀 96종을 4배·8배로
알려진 합격 그림(`tiledata/atlas-pick/style-demo-view34/interior-new-*`, 빵 진열대·옷장)과 나란히 다시 판정했다. 독립 검수(Argon)와 맞춰 본 결과
**실제 위반은 21종**(진열장 재고 변형 13 = 몸통 하나, 투구 선반, 천체 모형, 제어반·슬롯머신(앞면 평칠), 고해실 지붕, 유물 진열장 둘, 선원 침상),
나머지 75종은 오판(벽걸이·거울·인물·기둥·문·무대 배경처럼 윗면 규칙 면제이거나 윗면이 이미 4행 이상). 판정 원본 `tiledata/hand-interior/pick/work/props34/`
(`my_verdicts.json`, `argon_verdicts.jsonl`, `argon_after.jsonl`).

- **전체 재굽기(`build_tileset.py`)는 지금 못 돈다** — 공개 기준 정리(2026-10-09)로 `room2.py` 가 여는 `public/assets/atlas-biomes/jungle-chipset.png` 가 저장소에 없다.
  그래서 고친 그림을 **이미 가진 칸 위에 그대로 덮는다**: `scripts/content/hand-interior/props34/redraw.py`(기준 = `PROPS34_BASE` 커밋의 시트, 다시 돌려도 같다)
  → `rebake_inplace.py`(사양 cells 의 칸, 움직이는 칸은 띠의 k 번째 프레임, 등록 안 된 칸에 그리면 멈춤). 칸 번호·발밑·통행·정의 JSON 은 그대로라
  `ensureAtlasBiomeInteriorCurrent` 를 올릴 일이 없다(기존 프로젝트도 같은 시트 그림을 읽는다).
- 움직이는 기물(제어반·슬롯머신)은 **프레임마다 달라지는 화소는 건드리지 않고** 정지 화소만 고친다(`static_edit`). 천체 모형은 12프레임을 새로 그렸다.
- interior-plus 조각(유물 진열장 둘·선원 침상)은 원본 `scripts/content/interior-plus/pieces/*.py` 를 고치고 같은 렌더를 덮는다 — `interior-plus/bake.py` 는
  판정 프로필이 바뀌어 나머지 70조각의 옛 영수증이 무효라 지금 통째로 막힌다(고친 세 조각은 현재 프로필 영수증 PASS).
- 런타임 확인: `bun tiledata/hand-interior/pick/work/props34/fixture.mts` → `npm run qa:runtime -- --scenario props34-v5-rooms`(이 머신은 `unshare -rn` netns 안에서).
- **관문:** `rebake_inplace.py` 는 그림(프레임 0, 팔레트 v6)에 object-gate 영수증이 PASS 일 때만 덮는다(보정 프로필 PASS, 또는 현재 미보정 프로필의 PASS = interior-plus `gate_rooms.state` 와 같은 임시 통과). 우회 인자 없음.
  2026-10-20 결과: 17종 덮음(진열장 13·슬롯머신·유물 진열장 둘·선원 침상), 4종 보류(투구 선반·천체 모형·제어반 = 3/4 판정 갈림 REFER, 고해실 = 화풍 FAIL) —
  옛 그림 그대로이고 후보 그림은 `tiledata/hand-interior/props34/` 에 있다. 영수증이 PASS 로 바뀌면 `rebake_inplace.py` 를 다시 돌리면 들어간다.

### 2판 — 독립 적대 판정으로 다시 (2026-10-20)

1판 17종은 object-gate 미보정 프로필의 잠정 PASS 만으로 들어갔다(정식 관문 아님). 2판은 21종 전부를 독립 적대 판정자
Gemini 4 Argon(`claude -p --model gemini-4-argon-high`, 8319/cc)으로 3번씩 보고(과반, 3/4 + 품질 기준표, 좋은 기준 빵 선반·옷장·지구본 /
나쁜 기준 안락의자, 프롬프트 `tiledata/hand-interior/pick/work/props34/rv/prompt.txt`) 떨어진 것을 다시 그렸다. 1판 진열장 13종은
윗면만 고쳐 진열품이 「복사한 납작 블록」으로 전부 품질 FAIL 이었다.
- 그림: 진열장 진열품 `props34/r2_cabinet.py`, 투구 선반·천체 모형·제어반·슬롯머신 `props34/r2_misc.py`(redraw.build 가 덮어쓴다),
  유물·넓은 진열장 `interior-plus/pieces/museum.py`. 투표 원본 `props34/argon_r2.json` + `rv/argon_*.out`.
- **굽기 조건은 둘 다**: `rebake_inplace.py` 가 object-gate 현재 프로필 PASS **그리고** `argon_r2.json` 과반 PASS 인 것만 붙인다.
  작업 중 main 의 판정 프로필이 ee216f→1db03a95(규칙 v9, 여전히 rejected)로 바뀌어 21종을 다시 받았다(`gate-review-r3.log`). 같은 그림의 판정이 프로필마다 뒤집힌다(슬롯머신 PASS→화풍 FAIL, 천체 모형 FAIL→PASS).
- 반영 13종: 진열장 11(식빵·둥근빵·파이·물약·시험관·단지·책·보석·병·치즈·장난감), 천체 모형, 넓은 진열장.
- 보류 8종(시트는 #3087 그림 그대로, 후보는 `tiledata/hand-interior/props34/`·`rv/`): Argon 탈락 — 옷감 진열장(천이 16px 에서 천으로 안 읽힘, 0/3)·초 진열장(1/3)·선원 침상(3/4 는 통과,
  1칸 폭이라 침대로 안 읽힘 — 발자국을 2칸으로 바꿀지는 사람 결정, 후보 그림만 `rv/ship_bunk_r5_candidate.png`). object-gate 탈락(Argon 은 통과) — 슬롯머신·고해실(화풍 FAIL),
  투구 선반·제어반·유물 진열장(REFER, 사람 확인 대기 — #3101 의 보류 판정 사람 검토 화면 대상). 유물 진열장 원본 함수는 main 그림으로 되돌렸다(후보 `rv/relic_cabinet_r2_candidate.png`).
- 3판(감독 결정, 2026-10-20): 기존 16×48 선원 침상은 그대로 두고 2칸 폭 새 기물 `ship bunk 2w`(32×48)를 그렸다 — Argon 3/3 통과, object-gate 1db03a95 는 REFER(독립 눈 3/12 「정면 입면」).
  REFER 는 사람 검토(`npm run harness -- object-gate serve-holds` → :18323)에서 허용되기 전에는 굽지 않으므로 조각 등록·배 선실(crew) 예제 교체는 넣지 않았다.
  후보는 `tiledata/hand-interior/pick/work/props34/rv/ship_bunk_2w_candidate.{png,diff}` — 허용되면 diff 를 ship.py 에 붙이고 plans/ship.json 의 (21,12)·(22,12) `ship bunk` 둘을 (21,12) `ship bunk 2w` 하나로 바꾼 뒤
  `rooms_json.py` → `bake.py` → `templates.mts`. 옷감(나선 두루마리 끝)·초(상자 속 심지 점) 마지막 시도는 둘 다 Argon 0/3 이라 중단(`rv/r2_cabinet_r4_attempt.py.txt`, `rv/c10.png`).
- object-gate 는 보정 프로필이 없어(미보정) 정식 영수증이 불가능하다. 보정되면 이 21종을 다시 받아야 한다.

## 퍼즐 방 조각 — interior-plus `puzzle` (2026-10-20)

`scripts/content/interior-plus/pieces/puzzle.py` (카테고리 `puzzle` = 「퍼즐 방」). 칸은 7157부터 덧붙였다(핀 덧붙이기 전용, 옛 칸 0개 변경 — 굽기 대조).

- **무너지는 판자**: `plank bridge` · `plank bridge cracked` · `plank bridge falling 1` · `plank bridge falling 2`(flat, 1칸). 구멍 칸 위에 얹어 쓴다.
- **심연 오토타일** `abyss`(47 마스크, 비트 N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128 = 그 이웃도 구멍, `iplib.pit_reduce` 로 47개로 줄임):
  사양 `pits.abyss = {ko, masks, tiles}`(masks[i] ↔ tiles[i]), 정의 tileGroup `hand-interior:pit:abyss`, 칸은 통행 불가·층 lower·역할 terrain.
  그림: 먼 벽(북이 바닥) 바위 낯 15줄 — 남도 바닥인 한 칸 높이 구멍은 9줄로 눌러 그린다, 옆벽 4px 띠, 가까운 입술(남이 바닥), 안모서리 홈. 바위 램프 `rk` 는 v6 팔레트의 기존 색만 쓴다.
- **저울 추**: `weight stand`(빈 받침, 놋 홈) → `weight stand 1`…`5` 가벼운 순(놋 2 · 쇠 2 · 납 원통 1). 3~5 는 2칸 높이.
- **빙판** `REG.floor('ice')` 8×6 주기(빈틈 없이 이어짐, 눈 매트·대리석과 다른 푸른 유리 결) + 정의 `slideTiles = {칸: 'ice'}`(굽기가 base 아래 키만 남기고 다시 쓴다).
- **경비 등불 빛** `guard lantern light`(flat, 반투명 따뜻한 빛, 줄로 놓으면 이어진다). 끝 조각은 화풍 4회 불합격이라 뺐다.
- **관문 그림**: 기물은 `gate_export.py pending`. 바닥 `ice` 는 지형 조각 그림 `ground-{fid}`(gate_rooms.GROUND, kind terrain)로 덮는다 — 얼음 동굴 방 `room-rock-ice` 는 3/4 불합격이지만
  「다른 통과 그림이 대신 덮음」으로 막지 않는다(그 그림이 덮는 바닥·벽면이 전부 통과 그림에 덮일 때만). 구멍 칸은 `puzzle_scene.PIT_GRIDS` 의 지형 그림(abyss-b 18 + abyss-c 29 마스크)이
  **통과한 그림의 마스크 합집합**으로만 덮인다. 칸을 한 화소라도 다시 그리면 그림 해시가 바뀌어 다시 받아야 한다.
- **재보정 후 영수증 필요(통과 아님)**: 옛 판정 프로필 영수증은 무효다. 현재 프로필 영수증이 없지만 핀 칸의 main 시트 화소와 지금 그림이 같은 조각은 「재보정 후 영수증 필요」 묶음으로 따로 센다(`gate_rooms._shipped_unchanged`). 이미 main 에 실려 있어 굽기는 그 칸을 화소 그대로 다시 쓰고 목록을 `!!` 줄로 크게 찍는다 — 통과·면제로 세지 않고, 다른 그림을 「덮는」 근거로도 쓰지 않는다. 새 것·바뀐 것은 이 묶음에 들 수 없다(현재 프로필 PASS 필요). 2026-10-20 폐지 전에는 「소급 면제」로 셌다.
- 모의 장면·GIF: `python3 scripts/content/interior-plus/puzzle_scene.py <out>` → scene.png · plank.gif · pit47.png · abyss-*.png.

## 천문대 조각 — interior-plus `observatory` (2026-10-21, 사람 허용 대기)

『폴른 스타』 천문대 큰 방(`fs_observatory`)이 「싸구려 방」으로 읽힌다는 사용자 머지 차단 지적으로 그렸다. `scripts/content/interior-plus/pieces/observatory.py`(카테고리 `observatory` = 「천문대」).
v5 의 작은 삼각대 망원경·천체 모형·지구본·1칸 별자리표·서고 사다리는 그대로 쓰고 새로 그리지 않는다.

- `great telescope` 큰 굴절 망원경 5×6(발밑 5×2 막힘, 위 4줄 ★) — 둥근 나무 단·벽돌 돌기둥·놋쇠 집게·나무 경통·놋쇠 띠·이슬막이·파인더. 접안경은 왼쪽 아래 (발밑 왼쪽 칸 바로 위). kind `other`.
- `dome slit` 관측 틈 2칸 걸이(벽면 두 줄) — 돌 문설주 머리가 벽 머리 갓돌을 받아 끝내고, 덧문·별 하늘·초승달·돌 창턱. `wall_mounted`.
- `celestial chart` 별자리 원판 도표 2칸 걸이 · `lens bench` 렌즈 작업대(발밑 3×2) · `observing platform` 관측 발판(발밑 2×2, 다리 틀 위 높은 단 + 기둥 놋쇠 난간 + 앞 사다리, kind `other`).
- 관문: 그림 `tiledata/hand-interior/plus/gate-observatory/*.png`(시트에 들어가는 화소, 팔레트 v6). 묶음 `harness-data/object-gate/queue/fallen-observatory-r3.json`(r1·r2 는 대체됨).
  독립 Opus VQA r1 FAIL 3/5 영수증 `harness-data/object-gate/vqa/fallen-observatory-r1.opus-vqa-r1-fail.json` — 망원경 잔선·떨어진 토막·검정 접안경·`#000` 윤곽, 관측 틈이 한 칸 높아 갓돌·천장 띠를 덮음·바둑 무늬 하늘, 발판이 1배에서 상자로 읽힘·접안경과 4칸 떨어짐, 작업대 실제 발밑 3×2. r2 에서 모두 고쳤다. VQA r2(`vqa/fallen-observatory-r2.opus-vqa-r1-fail.json`)는 망원경·관측 틈·도표·작업대 PASS(화소 고정), 발판만 FAIL(앞면 8px = 무릎 높이 상자, 윤곽 없는 얇은 난간·사다리, 회색 못) → r3 발판: 윗면 10줄 + 다리 틀 앞면 24줄(기둥 셋·X 버팀·밑 그늘), 기둥 박은 난간(윤곽 뒤에 그려 가로대 사이가 빈다), 짙은 윤곽 사다리.
  사람 허용 전에는 `bake.py` 가 막는다. AI 조언은 판마다 갈렸다(발판: 남북 널+못 → 「정면 입면」, 윤곽 기본값 wood 0단 = 거의 검정 → 화풍 NO, 높은 난간 → 「윗끝이 세로 면뿐」).
- **r4 사다리(2026-10-21, 사용자 「사다리가 이상함」):** 옛 사다리는 오른쪽에 붙어 아래로 벌어지고(기둥 폭이 변함) 디딤대가 오른 기둥에 안 닿고 맨 윗단이 단 윗면에 걸쳐 틀에 그린 판자로 읽혔다.
  `_ladder()` 로 다시 그렸다 — 가운데 곧은 소나무 기둥 둘(4px, v5 서고 사다리 짜임), 6줄 간격 디딤대 넷이 두 기둥에 물리고, 머리는 입술 위 3줄 놋쇠 머리, 발은 틀 밑 가로대보다 3줄 앞 바닥 + 바닥 그림자, 틀 앞면에 그늘 한 줄.
  바뀐 칸은 7451~7454 넷뿐(난간 줄 7449·7450·정의 JSON 그대로). 독립 Opus VQA `vqa/fallen-observatory-r4-ladder.opus-vqa-r1-pass.json`(주요 결함 0), 묶음 `queue/fallen-observatory-r4.json`, 18323 위임 허용 후 `bake.py`.
  발판은 여전히 막힌 장식이다(오르지 않는다) — 사다리 발 앞 (12,12) 은 걸을 수 있다.
- 윤곽: `Cv.outline()` 기본은 재질 램프 0단이고 wood·black 0단은 `#000000` 이다. v5 가구 윤곽은 짙은 갈색(`#411e05` = `K('wood',1)`) — `outline(dark=K('wood', 1))` 로 준다.
- 칸(미리보기 굽기에서 잰 값, 핀 덧붙이기 전용): 망원경 7410~7434 · 관측 틈 7435~7438 · 도표 7439~7442 · 작업대 7443~7448 · 발판 7449~7454. 그 앞 7410칸은 화소·정의 변화 0.
- 지도(2026-10-21 판 교체): 옛 「천문대 큰 방」 덧칠 블록과 관측 발판은 쓰지 않는다. 세 방은 `src/project/flagship/fallenStarRooms.ts` 가 평면부터 다시 짓는다(아래 「폴른 스타 방 조각」 절). 망원경·도표·작업대는 그 평면의 objects 로 들어간다.
- **굽기를 지금 막는 다른 것**: `abyss-b`·`abyss-c` 구멍 조립 그림이 옛 프로필 영수증이라 `gate_rooms.check` 가 `pit:abyss` 를 막는다(2026-10-21 실측, 이 조각과 무관). 그 둘도 다시 받거나 사람이 허용해야 `bake.py` 가 돈다.
- 함정: `execTool` 은 맵 객체를 새로 만든다 — 찍은 뒤에 앞에서 잡은 맵의 이벤트를 고치면 버려진 사본을 고친다(`M(ids.…)` 로 다시 잡는다).

## 폴른 스타 방 조각 — interior-plus `fallen` (2026-10-21~22, 위임 허용·굽기 완료)

세 방(천문대·네 화로의 방·옛 별지기의 방)을 다시 지으며 v5 에 없던 조각을 그렸다. `scripts/content/interior-plus/pieces/fallen.py`.

- `cold brazier`(1×1, 7455): 꺼진 화로. v5 `lava brazier` 아래 칸(6442) 사발 몸·삼각대(5~15줄)를 화소 그대로 쓰고, 사발 테를 열린 타원으로·속은 재와 숯·꺼져 가는 불씨로. 퍼즐이 켜면 (x,y-1)=6441·(x,y)=6442, 끄면 (x,y-1)=-1·(x,y)=7455 를 upper 층에 바꿔 낀다.
- `dome slit tall`(2×3 걸이, 7456~7461): 천장 줄 1 + 벽면 2. 놋쇠 돔 레일이 천장 줄 회색 가장자리 선(12~15px)에 걸친다. y = 천장 줄.
- `star lens`(4×2 발밑, 위로 48px, 7462~7481): 돌 원통 받침 + 놋쇠 굴대 + 위를 본 큰 렌즈. 옛 별지기의 방 한가운데·보스 자리 뒤.
- `star seal`(2×2 flat, 7482~7485) / `star seal open`(2×2 flat, 7486~7489): 천문대 서고 바닥의 별 봉인 돌뚜껑(닫힘)과 열린 돌계단. 따뜻한 잿빛(linen) 테두리는 두 상태가 화소까지 같고,
  뚜껑은 봉인석(seal stone)과 같은 black·gold·purple. 열림의 계단은 v5 `stairs down`(3960~3963) 구멍 속 계단을 화소 그대로 옮겨 나무 램프를 linen 으로 바꿔 칠했다 —
  손으로 그린 계단(r4~r6)은 1배에서 환기 창살·화덕으로 읽혀 세 번 FAIL. 별빛 열쇠 갈래(fork item) 끝에서 `rebuildFallenRooms` 가 네 칸 upper 를 열림으로 바꿔 낀다(세션 덮어쓰기).
  Opus VQA r4·r5·r6 FAIL → r7 PASS `vqa/fallen-rooms-r7.opus-vqa-r1-pass.json`, 묶음 `queue/fallen-rooms-r7.json`, 18323 위임 허용 뒤 `bake.py`(7482 앞 칸 화소 변화 0).
  object-gate AI 판정(미보정·조언)은 두 장 모두 「윤곽이 근흑」 FAIL — 뚜껑 재질이 검은 돌이라 생기는 지적이고, 최종 통과는 사람(위임) 허용이다.
- `great brazier`(2×1 발밑 + 위 1줄, 7490~7493) / `great brazier lit`(2×1 발밑 + 위 2줄, 7494~7499): 네 화로의 방 퍼즐 화로. 1칸 `cold brazier` 는 1배에서
  「작은 검은 삼각대·모루」로 읽혀 방 VQA r3·r4 에서 두 번 major — 밝은 마름돌 받침 위 놋쇠 띠 쇠 사발(2칸 폭)로 키웠다. 켜짐은 아래 32px 이 꺼짐과 같고 사발 속만 달아오른 숯,
  위로 높이가 다른 불꽃 혀 셋(v5 lava brazier 불꽃 결). Opus 그림 VQA r8 FAIL(빗살 불꽃·붉은 점) → r9 PASS `vqa/fallen-rooms-r9.opus-vqa-r1-pass.json`,
  묶음 `queue/fallen-rooms-r9.json`, 18323 위임 허용 뒤 `bake.py`(7490 앞 칸 화소 변화 0). object-gate AI: 3/4 둘 다 ok, 켜짐 화풍만 「윤곽 근흑」 조언 FAIL.
- 독립 Opus VQA: r2 FAIL(재 없는 뚜껑 냄비, 천장 위로 삐져나온 틈, 그림자 속 돌결 점 10개) → r3 PASS `harness-data/object-gate/vqa/fallen-rooms-r3.opus-vqa-r1-pass.json`. 묶음 `queue/fallen-rooms-r3.json`, 18323 위임 허용(supervisor, delegated by user 2026-10-21) 뒤 `bake.py`. 7455 앞 칸 화소 변화 0.
- `dome cornice`·`dome shell`·`dome rib`(west·east·top) (7500~7512): 첫 둥근 지붕 시도(칸 조각). 방 VQA r8 에서 「계단식 벽 위 말뚝」으로 읽혀 지금 방에서는 쓰지 않는다(시트에는 남는다).
- `dome vault`(30×8 걸이, 7518~7661): 천문대 큰 방 북쪽 천장 띠 전체를 덮는 한 장짜리 둥근 지붕 안쪽 면. 계단식 벽면(3칸마다 한 줄씩 내려옴) 위에 v5 벽돌(2988/2989)로 이은 드럼 →
  처마 → 위로 갈수록 어두워지는 9단 돌 줄(줄눈·윗변 빛·아랫변 그늘) → 꼭대기로 모이는 나무 갈빗대 넷(놋쇠 띠) → 가운데 경선 관측 틈(하늘·별·초승달)이 북벽 `dome slit tall` 로 이어진다.
  투영은 열마다 해석적으로 (고도, 방위)를 거꾸로 푼다(점 찍기 투영은 줄눈이 점선으로 끊겼다). 밑동 고리는 초타원 → 위로 반구로 섞는다(처마가 박공처럼 꺾이던 r24 지적).
  핀 주의: 조각이 빈 칸을 잃으면 굽기가 「핀에 빈 번호」로 멈춘다 — HEAD 에 없는 조각이면 `pins.json` 의 그 조각 `obj:` 키만 지우고 다시 굽는다. Opus 그림 VQA r19~r25 FAIL → r26 PASS.
- `stone brazier`(1×1 + 위 1줄, 7513~7514) / `stone brazier lit`(위 2줄, 7515~7517): 버들항 돌 화로(beodeul_city 27228/27229)를 화소 그대로 옮긴 것. 꺼짐 = 사발 속 숯·재 + 나란히 눕힌 장작 둘.
  그림 VQA r27(X 표)·r28(사발 위에 얹힘)·r29 FAIL → r30 PASS. 방에서는 큰 돌 화로로 바꿨다(아래) — 1칸은 1배에서 사발 속이 2~3px 라 방 VQA r8~r11 네 번 「검은 말뚝」.
- `great stone brazier`(2×1 + 위 1줄, 7662~7665) / `great stone brazier lit`(위 2줄, 7666~7671): 같은 슬레이트 돌로 두 칸 폭 — 네모 받침·굵은 기둥·깊은 사발(테 타원 13.5×5, 앞 테 밑 그늘, 홈 띠),
  꺼짐 = 차가운 잿빛 숯 위 비스듬히 엇걸린 장작 둘(2px 띠, 바깥 끝 2×2 단면), 켜짐 = 같은 몸 + 달군 숯 + `great brazier lit` 불꽃(테 양 끝은 덮지 않는다 — 대칭).
  색은 실내 팔레트 v6 에 이미 있는 값만 쓴다 — 스냅이 바꾸면 영수증 해시(스냅 전)와 굽는 그림(스냅 후)이 달라 굽기가 「영수증 없음」으로 막힌다(r32→r33).
  그림 VQA r31(석쇠·소시지)·r33(흙 담은 화분) FAIL → r34 PASS, 묶음 `queue/fallen-rooms-r34.json`, 18323 위임 허용.
  꺼짐을 r37 에서 다시 그렸다: 사발 속 = 따뜻한 잿빛 재 바닥 위 검은 숯 덩이·밝은 재 점 + 엇걸린 장작(방 VQA r16~r22 「빈 검은 항아리」).
- `dais riser stone`(가운데)·`dais riser stone L`·`dais riser stone R`(1×1 flat)·`dais steps stone`(2×1 flat): `dais stone` 단 맨 아랫줄 칸에 `stamp_object` 로 덧찍는 앞 턱.
  위 4줄은 투명(단 윗면이 비친다), 그 아래 가장자리 빛·입술·마름돌 앞면 두 켜(8px 간격 엇갈린 이음)·바닥 그림자. 계단은 밝은 디딤판/어두운 챌판이 번갈아 드는 두 단, 양옆 볼은 짙은 줄.
  방 VQA r16~r22 내내 「단이 바닥 무늬로만 읽힌다」 → `rebuildFallenRooms` 의 `riser()` 가 네 화로의 방 (11~20,12)·성소 (10~21,7) 에 찍는다(가운데 두 칸 = 계단).
  그림 VQA r35 FAIL(계단 높이 다름) → r35b PASS 뒤 결 점을 더해 r36 FAIL(점 무늬) → r37 PASS `vqa/fallen-rooms-r37.opus-vqa-r1-pass.json`, 묶음 `queue/fallen-rooms-r37.json`, 18323 위임 허용.
  object-gate AI(미보정·조언)는 계단 「평면 채움」·큰 돌 화로 「윤곽 근흑」 FAIL — Opus 영수증으로 넘겼다. 허용 메모는 길이 제한(약 200자)에 잘리므로 영수증 경로만 짧게 쓴다.
- `star seal` r38: 「바닥 별 판·깔개」로 읽혀(방 VQA r22·r23) 북쪽 이음매에 경첩 굴대 + 뾰족한 2px 쇠띠, 남쪽 빈 띠에 닫힌 쇠고리, 위가 밝은 두 단 돌결·모서리 판돌 이음, 룬 점 넷(좌우 대칭)으로 다시 그렸다.
  홈 테(원)와 룬 점 여덟은 뺐다. 테두리 29px 는 `star seal open` 과 같아야 바꿔 끼울 때 튀지 않는다(반 화소 가운데 맞춤 불가).
  그림 VQA r1~r3 FAIL → r4 PASS `vqa/fallen-rooms-r38.opus-vqa-r4-pass.json`, 18323 위임 허용. 1배 어두운 서고에서는 경첩·고리가 여전히 약하다(방 VQA r28 minor).
- 방: `fallenStarRooms.ts` 의 `rebuildFallenRooms` 가 `build_hand_interior_room`(replace) 로 세 방을 짓고 이벤트 자리·이동 도착 칸을 정한다(좌표는 지어진 맵 기준, 평면 첫 줄 = 맵 0줄).
  천문대 32×23(북쪽 막힌 줄 셋 = 둥근 지붕 띠, 그 아래 동·서·남 세 변이 계단식으로 좁아지는 둥근 관측 홀 + 칸막이 아래 서고·현관·서재. 망원경 (10,10) — 경통 연장선이 관측 틈으로 든다,
  관측 의자 (9,10), 지하 입구 = 서고 바닥 별 봉인 (3~4,19~20), 내려왔다 올라오면 (3,21), 서고 남벽 x1~7 은 21줄이 벽(서고는 (8,21)로 현관과 이어진다),
  망원경 말 거는 칸 (13,11), 하넬 (24,20), 남문 (15,22) 한 칸 틈 — 남쪽 통로를 길게 빼면 아래층 화면 아래가 검은 허공(VQA r21)),
  네 화로의 방 32×19(위 홀 x4~28 — 끝벽을 들여 쌓았다, 북벽 쇠창살 (15~16,1~2), 동쪽 벽감 돌 계단 (25~27,3)→천문대·도착 (26,4), 큰 돌 화로 발밑 왼쪽 (12,8)(18,8)(12,11)(18,11) — 2칸 폭이라 `BRAZIER_W` 만큼 오른쪽 칸에 이벤트 복제,
  룬 비석 (15~16,9), 단 (11~20,7~12) 앞 턱·계단 12줄, 남쪽 불씨 사당은 곁 벽감보다 한 줄 깊다(13~17줄, 화로·봉인석 16줄 — 3×3 칸 격자를 깨려고). 가운데 서쪽 벽감 x3~8),
  옛 별지기의 방 32×27(성소 1~9줄, 성소→본당 통로 (15~16,10~11) 두 칸, 렌즈 칸 (15,5), 단 (10~21,3~7) 앞 턱 7줄, 보스 (15,8), 발렌 출발 = 북서 서가 앞 (3,5) `FS_VALEN_START`, 결정 (10,16),
  납골실·서고는 18줄 바깥쪽이 벽(계단식 남벽), 앞방 x5~26(바깥 네 줄씩 막아 좁혔다 — 30칸 폭은 「가구를 벽에 붙인 복도」로 읽혔다), 출구 (15,26)).
  적 자리: 앞방 식당 (23,24)·납골실 (5,17)·서고 (25,18), 상자 (2,17)·(29,17). 벽이 된 칸에 적을 두면 허공에 뜬 괴물로 읽힌다(VQA r25 major).
  예전 판의 패딩(padMapCentered)·바위 덧칠·먼지 입자·옛 묘소(버들항 칩셋)는 걷었다. 퍼즐 changeTile 은 `rewirePuzzleTiles` 가 화로 2칸×3줄(켜짐 / 꺼짐 + 불꽃 줄 비움)과 쇠창살 열림(벽면 칸 바닥으로 + 7116~7119)으로 바꾼다.
  시나리오 `fallen-rooms`(방 자리별 1배 캡처)·`fallen-audit`·`fallen-late`·`fallen-ceil` 좌표가 이 판을 따른다. 체크포인트 `scripts/qa/runtime/checkpoints/fallen-star.json` 도 같은 좌표를 쓴다.
  방 VQA(매번 새 Opus, 이전 점수를 보지 않는다): r9 6.5/5.5/5.5 → r12 7.5/7.5/7.5 → r16~r27 7.0~8.0 사이를 오갔다(빈 바닥·상자 격자·단 앞면·화로 읽힘) →
  r28 **8.2/8.2/8.1, blocker 0·major 0**(같은 판에서 세 방 모두 8.0 초과 — 종료 조건). 판정문은 `~/claude-viz/fallen-rooms/vqa-rN.md`, 비교 그림 http://mdc-server:18301/fallen-rooms.html.
  반복해서 효과가 있었던 것: 빈 바닥은 가구로 메우지 말고 벽을 들여 방을 줄인다, 칸 격자는 한 띠만 한 줄 어긋나게, 소품 하나하나에 「왜 여기?」 답이 있게.
  짓기 전 확인: 벽 등 가구(서가·찬장·세면대·두루마리 선반·목록 서랍·쇠사슬 서가·통 선반)는 벽면 바로 아래 첫 줄에만 선다. 한 줄 통로에 가구를 잇대면 칸이 닫힌다(「닿지 못한 빈 바닥」).
- 함정: `c.shadow()` 를 먼저 깔면 그 칸이 4-튜플로 차서 `c.get(x,y) is not None` 검사가 통과한다 — 몸에만 결을 넣으려면 `len(c.get(x,y) or ()) == 3`.
||||||| parent of ec9663587f (docs(openwiki): assistant interior capability test vs Fallen rooms)

## 조수 실력 시험 — 폴른 스타 세 방 (2026-10-22)

같은 세 방(별빛 천문대·네 화로의 방·옛 별지기의 지하 방)을 코딩 에이전트는 평면·좌표를 손으로 쓰고 새 조각을 그려 독립 Opus VQA 28바퀴(8.2/8.2/8.1)로,
조수는 실제 입력창에서 자연어 요청 한 번(Sonnet 5.5 high 대용, `local-claude-sonnet-high.json`)으로 지었다. 과제는 space-craft `fallen-*` 세 개.

- 조수 판을 깎은 것 중 도구로 잡을 수 있던 것을 `build_hand_interior_room` 결과 경고로 옮겼다 — `src/editor/handInterior/compositionLint.ts`:
  빈 바닥 >15%(3×3 안에 가구·깔개 없는 바닥, 합격 판 7~15%) · 방 밖 허공 >20% · 평면 '#' 덩이 속 허공(지붕 틈을 홈으로 흉내) ·
  같은 걸이 4번 이상 · 돌 바닥 재질 가족 섞기(flag·grey ↔ dungeon·wetstone ↔ marble) · 빈 큰 단(가구 <20%) · 앞 턱 없는 돌 단 — 경고. 단 위 바닥 무늬(마법진·봉인·앞 턱)는 빌더가 3층으로 올려 단 위에 얹는다(`builder.ts` Entry.base; 줄 자동 타일 깔개는 올리지 않아 v5 예제 26장 결과는 그대로).
  구성기 맵(layout program·청사진)은 빈 바닥을 묻지 않는다.
- 끝 검사(`src/ai/piAgent/layoutQuality.ts`)는 지은 실내(역할표 칩셋 + climate indoor)에 좌우 대칭을 묻지 않는다 — 합격 판도 대칭 3.0·3.1배였고,
  이 권고를 받은 조수가 기둥 넷 중 하나·석상 한 쌍 중 하나를 지워 「누락」 지적을 새로 만들었다.
- 규칙은 참고문서 `hand-interior-v5-rules` 「주인공 물건이 있는 큰 방」 절과 스킬 21~26: 방마다 쓰임 + 앵커 세 점, 주인공 하나(작은 것을 흩뿌리지 않고 단·축·짝으로 키움),
  단 크기, 대칭은 설계, 없는 건축을 평면 홈으로 흉내 내지 않기, 한 돌 가족, 「사당」≠교회 제단, 확인 바퀴(최대 3번).
- 시험 도중 폴른 판 큰 조각이 main 에 들어왔다(#3234: great telescope·dome slit tall·great stone brazier·star lens·star seal·dais riser/steps stone). before·after1·after2 는 그 전 main(6195e4d50c)에서 돌아 1칸 그림 + 단으로 대신했다.
  조수 문서·도구 설명·스킬은 이제 큰 조각 이름을 직접 안내한다. 조명(`set_lighting_volume`)·퍼즐 changeTile 배선은 조수가 하지 않았다(정지 그림 VQA 밖).
- 점수(매번 새 Opus 검수, 축 1·2·6): 전 5/5/5 → 1차 5.5/6/5.5 → 2차 5/6/6 → 3차(#3234 조각 반영 뒤) 5/5/6, 같은 검수자의 폴른 판 7~8.
  3차에서 큰 망원경·별 렌즈·돌 단 앞 턱·별 봉인은 나왔다. 남은 major 는 배치다 — 둥근 홀·지붕 틈이 1배로 안 읽힘, 사당이 현관처럼, 「넓은 가운데 홀」이 곁방만 함, 빈 바닥 25~30%(도구 계산 11~21% 와 검수자 눈이 다르다).
  퍼즐 도구 경로(`author_map_puzzle`)로 지은 화로 방은 큰 화로 대신 1칸 화로를 썼다. 다음 후보: 조수 끝 검수를 「요청 낱말이 1배로 읽히나」로 바꾸기.
- 결과·비교: `~/claude-viz/assistant-rooms-1.html`. 증거 `qa-runs/harnesses/space-craft/fallen-{before,after1,after2}`(저장소 밖으로 커밋하지 않음).

## 조수 실력 시험 2 — 1배 확인 루프·독립 비평 (2026-10-22)

같은 폴른 세 방 + 여관 1층·마법 도서관(`fantasy-magic-library`, 새 과제)·대장간을 실제 입력창으로 다시 돌렸다(Sonnet 5.5 high 대용, SQLite 저장·재로드 일치 확인).
루프 구현은 `openwiki/editor-ai-tools.md` 「요청 특징 확인표 + 1배 확인 루프」「독립 비평가」.

- **검수 그림부터 고쳤다.** space-craft 측정 그림에 편집기 전용 시작 위치(초록 테두리)가 찍혀 있었고, 적대 검수자 둘이 그걸 이동 칸으로 읽어
  「출구가 방 한가운데」 major 를 매겼다. 이제 `measure` 가 시작 표시 없는 `render/<맵>.clean.png` 를 따로 남기고 검수는 그것만 본다.
- 점수(새 Opus 검수자 한 명이 한 묶음을 이름 가리고 한꺼번에, 축 1·2·6. 묶음 안에서만 비교한다 — 같은 r28 판도 묶음마다 7.3~8.0):

  | 방 | 폴른 r28 | #3242 3차 | A 확인표+1배 확인 | B +독립 비평 |
  |---|---|---|---|---|
  | 별빛 천문대 | 7.3 | 7.0 | 7.0 | 7.0 |
  | 네 화로의 방 | 8.0 | 7.7 | 7.0 | 8.0 |
  | 옛 별지기의 방 | 8.0 | 7.7 | 7.0 | 8.0 |
  | 여관 1층 | — | — | 7.0 | 7.7 |
  | 마법 도서관 | — | — | 8.0 | 8.0 |
  | 대장간 | — | — | 7.7 | 7.3 |

  같은 검수 조건(시작 표시 없는 1배 그림)에서는 #3242 의 「조수 5~6 대 코딩 에이전트 8」 격차가 다시 나오지 않았다(3차 판 7.0~7.7). A(확인표 판정만)는 폴른 셋에서 3차보다 나아지지 않았고,
  B(별도 호출 비평가가 major 를 칸 좌표로 짚음)는 폴른 평균 7.7 로 r28(7.8)과 같은 띠다. 다른 묶음(C 묶음)에서 B 를 다시 매기면 7.0/7.3/8.0 — 차이는 검수 흔들림(±0.5) 안팎이다.
- 시간·도구(방 하나, 기계 부하 load 60~110 에서): A 7~16분·도구 20~138회(도서관이 낱개 stamp_object 111번), B 6~19분·도구 11~41회·토큰 1.3~3.7M.
  첫 짓기 전 모델 생각이 3~6분, 다시 짓기 사이 생각이 3~6분이라 10분 목표는 대장간·여관만 맞췄다. 바퀴 수가 아니라 짓기 호출 사이 생각이 시간을 먹는다.
- 효과가 없었던 것: 검증된 방 예제(폴른 r28·v5 예제 인자를 프롬프트에 붙이기)는 묶음 C 에서 B 와 같은 띠(평균 7.45 대 7.55)였고 천문대·도서관은 19~24분으로 더 오래 걸렸다
  (예제의 큰 돔을 따라 하려고 짓기 19번). 폴른 세 요청에는 정답 방 자체가 예제로 뽑혀 일반화 시험도 아니다. 넣지 않았다.
- 판정자·비평가의 한계: 비평가 점수는 그림 한 장 절대 점수라 r28 과 3차를 가르지 못했다(통과는 「major 0」 하나만 본다). 판정자·비평가 호출 비용은 조수 토큰 집계 밖이다(바퀴마다 20~40초).
- **다듬기 모드(D)** — 천문대 하나로 실제 단추를 눌러 봤다(`HARNESS_POLISH=1`): 첫 짓기 15분 뒤 다듬기 8바퀴·21분, 조수 하나가 두 층을 함께 고쳤고 저장·재로드 일치.
  확인표는 수렴하지 않았다(「지붕까지 트인 관측 틈」은 아홉 바퀴 내내 ✗ — dome slit 조각 놓기가 매번 「걸이」 오류). 그래도 같은 검수 묶음에서 다듬은 천문대 7.7, B 천문대 7.0, r28 7.3 — 한 표본이라 흔들림 안이다.
- **모델 A/B(E)** — 같은 B 루프에 조수를 Opus 5.5(`local-claude-opus-high.json`)로: 같은 묶음 점수 폴른 7.0/7.7/5.0(별지기 방은 빈 시작 맵에 지어 빈 바닥 40%+), 다른 실내 8.0/7.7/7.7.
  B(Sonnet) 7.0/7.7/8.0 · 7.7/8.0/7.7 과 같은 띠이고, 시간은 7~25분·도구 16~82회·토큰 1.8~5.2M 로 더 들었다. 격차는 모델이 아니라 루프·검수 조건 쪽이었다.
- 결과·비교: `~/claude-viz/assistant-rooms-2.html`.

## 손으로 짠 방 견본 (2026-10-29)

**2판(같은 날, 실제 게임 판 기준 18장 추가 — 모두 33장):** `survey.mts` 로 게임 판(`suite/runs/vm1-1029`·`vm2-1029` 의 project.sqlite) 실내 맵을 렌더하고 판정·VQA 결함을 모아 본 결과 — 추리 여관은 같은 16×14 통나무 홀만 되풀이되고 객실은 3×4 견본뿐(2층 객실은 침실 견본으로 아래 절반이 휑), 방탈출 서재는 5×6 으로 빽빽하거나 10×9 로 휑했다. JRPG 판은 마을 집·가게에 실내가 없었다. 그래서 견본이 없거나 하나뿐인 용도에 크기·배치 변형을 더했다: 여관 홀 11×8(`tavern-m`), 객실 5×6·6×7·7×7(`inn_room`), 여관 주방 7×7·9×7, 서재 5×6·7×7·9×8, 창고 7×6·8×7, 침실 6×6·7×8, 민가 7×7·9×7(`living`), 무기점 8×8·10×8(`weapon_shop`), 몬스터 연구소 7×7(`laboratory`). 묶음별 파일 `rooms-inn.mts`·`rooms-escape.mts`·`rooms-village.mts`(build 가 `rooms*.mts` 를 모두 모은다, 동시 작업 중엔 `--skip-bad`).
- 검수자는 Sonnet 5.5 high(`review.sh <check 출력 폴더> <id> "<용도>"`, `omp -p --model teamclaude/claude-sonnet-5-5 --thinking high`, 마지막 줄 VERDICT). 프롬프트에 칩셋 그림 약속(북향 의자 등받이가 아래, 발깔개 두 칸 폭, 단서 물건은 나중 이벤트)을 넣었다 — 그래도 검수자가 chair N 을 「책상을 등짐」으로 잡는 일이 있어 그 자리는 옆향 의자·걸상으로 피했다. 방마다 4판 한도: 여관 홀 9×7·13×9, 민가 11×9, 연구소 12×9 는 휑한 바닥·반복으로 떨어져 뺐다.
- `lab bench` 그림에 빨강·흰 공이 그려져 있어 검수자가 몬스터 공(상용 IP)을 닮았다고 짚었다 — 연구소 견본에는 쓰지 않았다.
- 이름: 객실·여관 방·손님 방 → inn_room 먼저(침실은 bedroom 먼저), 무기점 → weapon_shop, 민가·오두막 → living, 가게·상점 → general_store 먼저.

**3판(같은 날, 다른 장르 + 다시 짠 큰 판 — 모두 43장):** 앞 판에서 떨어진 크기를 검수 지적대로 다시 짰다 — 여관 홀 9×8(`tavern-s2`, 계산대 뒤 통로 두 줄·4인 식탁)·13×8(`tavern-l2`), 민가 11×8(`house-l2`, 부엌·식탁·침대 세 구역), 몬스터 연구소 12×8(`laboratory-xl2`, 부화기·우리·먹이 구유). 다른 장르: 진료실 7×7(`clinic_exam`)·간호사실 7×7(`nurse_station`)·지하 영안실 8×7(`morgue`, 관 줄), 다락 6×6·8×7(`attic`), 할머니 집 거실 7×7(`living`)·장롱 있는 방 7×7(`bedroom`). 묶음 파일 `rooms-retry.mts`·`rooms-genre1.mts`·`rooms-genre2.mts`.
- 떨어진 것(4판): 병실 `ward` 6×7·9×7 — `patient bed` 가 벽 기물이라 북벽 줄에만 놓여 아래 절반을 채울 병원 기물이 없다. 빵집·꽃집·옷가게·시골 잡화점 — 계산대 뒤 한 줄이면 「주인 자리 없음」, 두 줄이면 가운데가 휑했고, 계산대 위 탁상 물건이 서랍 앞면에 그려져 「서랍장」으로 읽혔다(탁상 물건 높이는 따로 볼 일). 할머니 집 거실 9×8.
- **가게 4판 다시 짜기(2026-10-29, `rooms-shop.mts`, 새 그림 없음):** 빵집 7×8·9×8(`bakery_shop`), 꽃집 7×8(`flower_shop`), 옷가게 8×8(`tailor_shop`), 시골 잡화점 8×8(`general_store`) — Sonnet high 검수 5장 모두 PASS(빵집 중간·옷가게는 2판). 줄 짜기: 0줄 벽 진열 → 1줄 주인 통로 → 2줄 카운터 윗면(카운터는 윗면이 발밑 위 줄) → 3줄 카운터 앞면(옆은 카운터 2×1·케이크 진열장처럼 윗면 있는 가구로 이어 2×2 맨바닥 덩이를 막는다) → 4줄 손님 줄 → 5줄 문 옆 진열. 계산대 틈은 문 바로 위 일직선을 피한다(옷가게 1판 major). 옷감 선반(`fabric bolt rack`)·옷감 진열장은 책장으로 읽혀 하나만 쓴다. 낱말 옷가게·옷집·양장점 → tailor_shop.
- 손으로 짠 견본의 앵커 같은 종류 묶음(`interior.ts` KIN)에 선반·진열장(shelf·cabinet·약재 서랍)과 궤짝·자루·바구니·도마를 더했다 — room-vig8 healing-store: 시골 잡화점 견본에 「선반」을 벽 진열장 위에 겹쳐 걸고 「나무 상자」를 도마로 계산대 틈에 덧놓았다.
- **TODO 병원 기물(아직 그리지 않음 — 새 도트는 감독 지시가 있을 때 칩셋 하네스·3/4 관문을 거쳐서만).** 이게 들어오기 전에는 병실 `ward` 견본이 없고(침실로 대신), horror-ward 과제는 modern_city 병동 경로로 간다.
  - [ ] 방 가운데 놓는 철제 병원 침대(바닥 기물, 지금 `patient bed` 는 벽 기물)
  - [ ] 링거 걸이 · [ ] 휠체어 · [ ] 들것 · [ ] 의료 카트 · [ ] 커튼 레일 칸막이
  - [ ] 영안실 냉장 서랍장 · [ ] 철제 부검대
  - [ ] 버려진 병원 소품: 판자 댄 창 · 물 얼룩 · 흩어진 서류 · 쓰러진 침대
- `lab bench` 그림(빨강·흰 공 — 몬스터 공을 닮음)은 견본에서 뺐다(칩셋 그림은 그대로). laboratory-m 은 그걸 빼고 다시 받은 검수에서 떨어져 뺐다.
- 이름: 영안실·안치실 → morgue, 병실·병동 → ward(견본 없으면 침실), 진료실 → clinic_exam, 간호사실 → nurse_station, 다락 → attic, 꽃집 → flower_shop(견본 없음 → 잡화점), 장롱 → bedroom. `roomPurpose` 병원 쓰임의 atlas 목록 = ward·clinic_exam·nurse_station·morgue.

예제 맵에 없거나 약한 용도를 칩셋에 이미 있는 기물만으로 짠 방 견본 15장(새 그림 없음): 교실 8×7·10×9·13×10(`classroom`), 잡화점 7×8·9×8(`general_store`), 연구실 9×7·10×8(`laboratory`), 감옥 7×8·11×9(`jail` — 같은 폭 감방 + 간수 자리), 예배당 13×9(`chapel`, 원본 성당처럼 동쪽 독립 제단을 보는 옆모습 회중석), 방탈출 작은 방 서재 6×7·8×8 / 침실 6×7·8×8 / 창고 6×7. 잡화점 11×9·예배당 10×9 는 5판 검수까지 휑한 바닥으로 떨어져 뺐다.

- 원본 `scripts/content/interior-authored/rooms.mts`(글자 그림: hang 줄 + 바닥 줄, 기물 글자는 왼쪽 위 칸에만) → `bun scripts/content/interior-authored/build.mts` → `src/assets/interiorAuthoredRoomTemplates.json`(templates.ts 가 v5·plus 견본에 이어 붙인다). 지도 이름 `authored-<화풍>-<id>` — 화풍(town/noble/fantasy)은 그 종류 견본의 다수 화풍과 맞춰야 짓기가 고른다(침실은 town, 서재는 noble).
- build 는 **그림 겹침 검사**(`lintTemplate`)를 건다 — 사양 cells 의 dx·dy 로 실제 그려지는 칸(키 큰 기물의 위 칸, 건 것의 벽면 두 줄)이 다른 기물과 겹치면 실패. 1판 적대 검수의 겹침(책장 위 창·지도, 두루마리 통이 위 책상을 덮음, 마법진 위 지구본)은 전부 이 종류였다.
- `bun scripts/content/interior-authored/check.mts --out <dir>` — 견본 크기 그대로 짓기 도구(견본 길)로 지어 고른 견본·심은/빠진 가구(`furnishRooms` 의 `perRoom.missing`)·닿지 못한 바닥·맨바닥·1배 PNG. 빠진 가구는 대개 문 앞 칸·감방 틈 앞을 막은 의자, 벽 가구(괘종시계)를 아래 줄에 둔 것, 닫힌 감방(잠긴 문을 끼우면 감방 바닥이 닫혀 창살 덩이가 통째로 빠진다 — 감방은 한 칸 틈으로 둔다).
- 학생 자리는 책상 1×1 + 북향 의자(학생 책상 `school desk` 그림은 의자가 위에 붙어 칠판을 등진다). 계산대는 벽 진열 앞 한 줄을 주인 통로로 비우고 그 앞에.
- build 는 **닿음 검사**(`lintReach`)도 건다 — 문 칸(남벽 x = floor((w-1)/2))에서 모든 바닥과 모든 바닥 기물 옆 칸에 걸어서 닿는가, 문 위 두 줄·발깔개 오른쪽 칸이 비었는가(짓기가 그 칸의 가구를 빼거나 옮긴다 — 예배당 회중석이 옆 열로 밀려 붙었다).
- 채택: 견본마다 Opus 적대 검수 PASS(major 이상 0, 2026-10-29 5판까지) + 두 검사 + check.mts 짓기(빠진 가구 0·닿지 못한 바닥 0). 증거 `~/z-project/assistant-whole-game/suite/ledger/evidence/interior/authored/`.
- 이름: `KIND_WORDS` 에 실험·연구실 → laboratory(「연구」 서재 규칙보다 먼저), 교실·학교 → classroom, 잡화·만물 → general_store, 감옥·jail → jail. `roomPurpose` 의 교실·학교 쓰임(atlas)은 classroom, 가게 쓰임은 general_store 먼저.
- 조수 v2 실내 빌더에서 지은 방이 전부 손으로 짠 견본이면(`layout.rooms[].template` 가 `authored-…`) 줄이기·빈 바닥 메우기·빈 방 꾸미기·한 단계 줄이기를 건너뛴다 — 견본 크기에서 검수·닿음 검사를 통과한 구성이라서다(room-vig3: 잡화점 7×8 견본을 「빈 바닥이 넓다」며 줄여 계산대가 빠졌다). 주인공 물건은 같은 종류(이름 첫 낱말: counter 1x1 ↔ counter 3x1, 또는 탁자·의자·침대·책장·옷장 묶음)가 그 방에 이미 있으면 놓은 것으로 친다. `pickTemplate` 은 손으로 짠 견본을 그 종류의 제 견본으로 쳐서, 작은 교회가 원래 예배당 31×13 대신 13×9 를 고른다.
- **구역 묶음 덮기**(`coverZones`, 2026-10-29): 모델이 감옥을 「감방 셋 + 복도(간수 자리)」 구역으로 쪼개면 방마다 cell·corridor 견본을 골라 감옥 견본을 못 썼다. 장소 이름·테마가 그 용도(감옥)를 말하고, 1층 구역이 둘 이상이며 모두 그 용도의 부분(종류 jail·cell·corridor·guard_room·armory 또는 목적 문장의 감방·간수·경비·복도·철창·죄수)이고, 고정 크기가 없으면 1층을 그 용도 방 하나(jail 견본, 구역 셋 이상이면 큰 판)로 합친다. 표는 `COVERING_USES` — 지금은 감옥 하나. 손으로 짠 견본 방에서는 「탁자」「의자」 같은 주인공 물건이 종류 묶음(dining·desk·display·table… / chair·stool·bench…)으로 이미 있으면 덧놓지 않는다.
- 쓰임 바꾸기에서 kind 이름 조각으로 견본을 고를 때 `shop`·`store`·`room`·`hall` 같은 두루 낱말은 쓰지 않는다 — kind:"shop" 이 가게 쓰임 목록 첫째(general_store)를 두고 tailor_shop 을 골라 모험가 잡화점이 옷가게가 됐다(room-vig5 shop).
- **한 게임 안 반복 금지**(2026-10-29): `build_hand_interior_room` 이 방마다 위치 태그 `template:<견본 id>` 를, 장소 견본으로 지은 맵은 `template:venue-<id>` 위치를 남긴다. 조수 v2 실내 빌더는 짓기 전에 같은 게임의 다른 맵 태그를 모아(`usedTemplates`) — 장소 견본을 이미 쓴 이름(두 번째 여관·선술집)은 장소 견본을 건너뛰고, 방은 그 용도 견본 중 덜 쓴 것(같으면 크기 말이 고르는 견본에 넓이가 가까운 것, 다음 id 순)을 `layout.rooms[].template`(빌더 내부 인자)로 고정한다(`rotateTemplate`). 한 번 짓기 안의 같은 종류 방(객실 둘)도 서로 다른 견본을 쓴다. 그 용도 견본을 아직 안 썼으면 원래 고르기 그대로. 방이 모두 손으로 짠 견본이면 소금 변주(배치 후보 C·D 의 방 넓히기)를 쓰지 않는다.
