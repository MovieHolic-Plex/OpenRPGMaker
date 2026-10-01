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
| 가구 | 381종 | 발밑 칸 = 막힘 x, 솟은 칸·걸이 = ★, 바닥 무늬·계단 = o. 움직이는 칸은 12프레임 `animationStrips`(10fps) |
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
  부품 찾기는 `src/editor/handInterior/parts.ts`(아래 「가구 메모·방 표」).
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
- 건너뛰는 것: 선택 없음·v5 유지, 크기를 바꾸라는 메모 뒤 새 크기 후보를 아직 고르지 않은 것(마법서 독서대), 애니메이션 기물. 목록은 `tiledata/hand-interior/pick/out/baked.json`.
- 3/4 재작도 후보(w90·w91, 54종)는 아직 고르지 않아 들어가지 않았다. 고른 뒤 `python3 scripts/content/hand-interior/build_tileset.py && bun scripts/content/hand-interior/prepare-references.mts` 를 다시 돌린다.

