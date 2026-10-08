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
| 탁상 물건 | 119 | 가구 윗면 4층, 막힘 x |
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
  - 가구(`furnish.ts`·`placeTemplateItems`): 붙어 있는 가구 덩이(식탁+의자 등)를 덩이째 가까운 벽 기준으로 옮기고, 한 점씩 넣어 보며 오류·닿지 못한 바닥 증가·문 앞 칸·무늬 겹침이면 뺀다(집 한 채 0.5~0.9초).
  - 결과 `data.layout.picture`(방 글자 그림)·`rooms`(견본·심은 수)·`rebuild`(rooms·connect·exit·objects… — 가구를 고쳐 replace:true 로 넘긴다). 다른 배치 `layout.variant`, 다른 견본 `layout.seed`.
  - 실내 빈 바닥 피드백(`layoutQuality.ts` `interior`)은 「흩뿌려 메우지 말고 방을 줄여라 / layout 으로 다시」다(옛 문구는 「덩이를 놓아라」뿐이라 상자 집에 서재 코너를 채웠다).
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
