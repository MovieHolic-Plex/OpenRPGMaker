# 버들항 v6·v7 — 로마풍 항구 도시를 편집기 맵·공용 타일셋으로 (beodeul_city)

## 2026-10-05 건물 반려와 사람의 허용/거절 대기열

사용자는 아래 `beodeul_forms`의 ㄱ자집·여관·대장간·창고 4종을 반려했다. 검사 통과를 미적 승인으로 쓰지 않는다. `beodeulForms.ts`는 새/기존 공용 선택 목록에서 이 4종의 본체·그림자·기초 키트를 제거하며, 기존 저장 지도의 칸·그림·통행은 보존한다. 관련 공용 참고문서는 반려를 명시한 과거 기록이다. 긴 민가와 좁은 이층집의 키트만 남긴다.

사용자가 새 지붕·창문·벽 질감으로 10종 저작과 개별 허용/거절을 요청했다. [beodeul-building-review](harnesses/beodeul-building-review.md) 하네스는 원본 도트 부품과 명시한 좌표로 비공개 후보를 만들고, 독립적인 질감·구조 Visual QA 및 숨긴 반려 표본 검사에 모두 통과한 그림만 공개한다. `http://mdc-server:18317/`에서 갤러리·고정 메모/결정 패널로 검수하고 확대/격자/잔디·기존 집/나무와 비교한다. 새 형태 필터 `?ui=3&new=1`도 제공한다. round 3은 타 게임의 시설 표식·실루엣 원리를 조사해 용도별 간판과 지붕 색·높이·몸체가 다른 10종을 추가하며, 기존 10종과 인간 선택은 보존한다. 결정/메모는 저장소 밖 SQLite에 PNG 해시와 함께 저장한다. 미선택·거절은 다운로드 팩에서 제외한다. 새 후보는 사람 선택 전까지 공용 기본값이나 정본 마을에 넣지 않는다. 원본 시트 보정 계약은 기존 beodeul-architecture 경로를 따른다.

2026-09-28. Python 손 도트 합성 그림이던 버들항 v6(100×100, 16px, 세 단)을 **그림 그대로** 편집 가능한 맵과 공용 번들 타일셋으로 옮겼다.
조수(에디터 AI)가 이 타일셋의 참고문서만 보고 「버들항 비슷한 도시」를 깔 수 있는지도 실제 모델로 시험했다(아래 「조수 시험」).
2026-09-29 라운드 2(v7): 오토타일·새 키트·원본과 다른 예시 배치 둘·배치 자를 더하고 조수를 「원본 복제 금지」 과제로 다시 시험했다(아래 「라운드 2」).
같은 날 라운드 3(v8): 「만들다 만」 결과를 고치려고 블록 키트 41종·길 위계·작업 순서·빈 바닥 자를 더했다(아래 「라운드 3」).

2026-10-04 집 출입 실모델 시험: 실제 편집기 조수가 `stamp_object`의 문 좌표 → `build_hand_interior_room`의 별도 실내 → `create_transfer_pair`의 양방향 출입을 저작했다. SQLite 저장·닫기·재로드 후 전용 `player.html`에서 시작점부터 걸어 입장·실내 이동·퇴장과 착지 후 40프레임 유지까지 5비트 전부 통과했다. 참고 이미지 조회에서 선택 필드 `offset:0`을 거부하던 도구 오류를 수정한 뒤 재실행한 결과다. 한 채에 대한 시험이며 모든 키트의 출입을 보증하지 않는다. 정본 id·폴더·해시·실제 스크린샷은 `verify-shots/assistant-house-entry/README.md`, 조수 호출 원문은 `verify-shots/assistant-beodeul-village/door-entry-fixed/e7d2-house-entry/`.

같은 날 사용자가 직접 도트로 문 열림을 그려 GIF로 보여 달라고 요청했다. `scripts/content/build-beodeul-door.py`가 살림집 원본 문(5743/2333)과 같은 문틀에 왼쪽 경첩·안쪽 열림 16×32 8단계를 찍는다. 공용 `beodeul_door`/`tex_beodeul_door` 시트(8열·16칸), 기본 프로젝트 배선과 기존 프로젝트 참고문서 보충은 `defaults/beodeulDoor.ts`/`defaultAssets.ts`; 참고문서 원본 `tiledata/beodeul-door/README.md` → `prepare-beodeul-door-references.mjs` → `beodeulDoorReferences.json`. GIF는 자산 시안이며 기존 출입 이벤트 재생을 연결하지 않았다. 시안 `public/assets/beodeul-door/house-door.gif`, 확대 `door-detail.gif`. 저장·재로드 및 새/기존 프로젝트 등록 근거 `verify-shots/beodeul-door/storage-proof.json`.

후속 공용 적용(2026-10-04): `apply_beodeul_door_animation({mapId,eventId,frameMs?})`을 조수 레지스트리와 안내에 등록했다.
같은 살림집 문 전용이며 시트 16칸을 현 칩셋에 이식한다. 열기 뒤 원래 transfer, 실내 조건부 auto 이벤트가 야외 문을 복원하고 귀환 뒤 야외 auto 이벤트가 닫기 6→0을 맡는다.
일반 맵 이벤트는 transfer에서 끝나므로 뒤에 명령을 붙이는 초안을 수정했다. SQLite revision 4 저장·재로드, 반복 적용 불변, 실제 게임 렌더 0→7→0과 출입 5비트 확인은 `verify-shots/beodeul-door/applied/README.md`.
밝은 잔디 737 원본을 유지하는 접지·꾸밈 공용팩 `beodeul_ground`(48칸, 15레시피)을 추가했다.
`dress_beodeul_ground({mapId,style:"living"|"natural",seed?})`가 2층 그림자·낙엽·흙, 4층 기초·밑동·풀/꽃·살림 소품을 덧그린다.
집 h101 기초의 벽 줄은 ★로 원래 벽 통행을 따르고 문 열은 완전 투명이다. 수관 3×3 나무 두 종류는 밑동, 기존 줄기 3×4 나무는 아래층 그림자를 보강한다.
다른 집에는 전용 기초를 강제하지 않고 집 곁 소품만 배치한다. 정확한 범위/전체 배열/정상·오류 그림은 `tiledata/beodeul-ground/README.md`와 `CATALOG.md`.
공용 그림·정의·용도 `beodeul-ground-dressing`은 새/기존 프로젝트 양쪽에 등록한다. 채팅/Pi 공통 정책은 `promptPolicies.ts`.
`author_beodeul_town`은 river/coast/city 완성 뒤 같은 도구로 마감하고, desert/snow/swamp는 건너뛴다. 재시공 때 이전 이 팩의 덧그림만 제거하고 다시 마감한다.
기존 맵 꾸미기에는 재시공하지 않는다. 실제 조수가 MD 전 페이지와 이미지 2장을 읽고 적용한 후 SQLite revision 5로 저장·재로드했고 키트 출처·반복 메타데이터 보충 후 revision 6을 재로드했다(맵/문 동일).
기초/뿌리 범위와 통행 보존, 실제 플레이 근거: `verify-shots/beodeul-ground/README.md`.

### 나무 연결 보정과 집 5채 작은 마을 (2026-10-04 후속)

첫 접지 판은 3×3 수관 마지막 줄의 투명 여백과 다음 줄 밑동 사이가 끊겨 보였다.
`bdg-tree-neck`을 source 41에 추가해 수관 마지막 행 가운데에 좁은 줄기와 잎을 겹친다.
기존 source 0~40은 유지하며 현재 팩은 48칸 슬롯·42개 그림·16레시피다. 연결 칸은 ★로 원래 수관 통행을 따른다.
`dress_beodeul_ground`는 이미 꾸민 맵에서도 빠진 밑동·연결만 보충하고 다른 꾸밈을 중복하지 않는다.

`author_beodeul_town({houseCount:5,name,seed})`는 별도 40×30 밝은 잔디 마을을 만든다(3~5채 지정 가능).
`beodeulSmallVillage.ts`가 원본 키트 h101_0·h104_0·h112_0·h109_1·h107_0으로
별채 박공·넓은 이층·돌벽 박공·ㄱ자·낮은 집을 배치한다. 굽은 큰길 2칸과 샛길 1칸,
우물 마당, 집 곁 살림과 나무를 배치한 뒤 공용 꾸밈을 적용한다. seed는 꾸밈 변주에 쓰며 이 작은 배치의 집 좌표는 고정이다.
새 마을 요청에는 mapId를 생략해 원래 맵을 보존한다. 이 모드는 외장 전용이며 실내·출입 이벤트는 별도 저작한다.
houseCount 생략 시 기존 기후/도시 생성 경로다. 포구·사막·눈·늪 요청에는 해당 경로를 쓴다.

공용 참고문서에 `SMALL-VILLAGE.md`의 집 전체 배열과 `small-village-example.json`의 네 층 전체 배열,
실제 표본 그림을 추가했다. 생성은 기본 ground 스크립트 뒤 `bun scripts/content/prepare-beodeul-small-village-references.mts`;
기본 참고문서 재생성도 이미 있는 작은 마을 자료를 보존한다. 용도는 현재 MD 4개·이미지 3개이며 새/기존 프로젝트 공통이다.
실제 편집기 조수가 기존 두 나무를 보정하고 ‘버들쉼터’ 집 5채를 만든 뒤 화면을 보며 녹지를 보강했다.
SQLite revision 7 저장·재로드와 전용 플레이어 8비트(모든 집 문 앞 도보 이동·우물 복귀)의 근거는
`verify-shots/beodeul-small-village/README.md`. 기존 문 이벤트·실내·통행은 보존됐다.

## 민가·성당 외장: 원본 보존 보정 (2026-10-04 사용자 정정)

사용자 조건은 모든 집의 기초, 창문 다양화, 문 하나, 집별 벽 콘셉트 하나와 교회다.
측면은 필수가 아니다. 원래 버들항 지붕 면·집 윤곽을 유지한다. 후속 사용자 정정에 따라 기와 변경을 철회하고 원본 픽셀로 복원했다. 지적 대상은 stone 지붕 아래 박공 벽이다.
이전 투영 면 전체 재저작(revision 8)은 사용자가 과도한 변경으로 거부했다.
공용 `beodeul_architecture`는 원본 h101_0/h104_0/h112_0/h109_1/h107_0/cathedral을 조립한 뒤
중복 문 제거, 원본 창틀 안의 창문, 돌벽 색조와 stone 박공 벽/중앙 원형창을 허용 영역에서 고친다. 원본 알파 윤곽과 지붕 면 배치는 유지한다.
성당은 원본 푸른 첨탑·지붕을 쓰고 위층 중복 문만 원본 창문으로 바꾼다.
하네스 `beodeul-architecture build → validate → review`는 원본/보정본/변경 픽셀과 시트 배열을 대조한다.
기계 통과는 시각 합격이 아니며 측면 폭·면적을 합격 조건으로 삼지 않는다.

source는 16px/16열/336칸이며 기존 칸 배정을 유지하고 필요한 원본 조각만 추가한다.
`ensureBeodeulArchitectureTileset`는 기존 source count/통행/우선순위를 갱신한다.
`installBeodeulArchitecture`는 현재 source의 통행·우선순위를 기존 graft에도 반영한다.
`author_beodeul_town({houseCount:5})`는 원본 보존 5종, `church:true`는 폭 54칸으로 성당 마당을 연결한다.
`refine_beodeul_village`는 원본 또는 이전 공용 키트의 정확한 전체 배열만 같은 자리에서 바꾼다.
기존 키트 정의를 설치 전에 보관해 이전 시안을 알아보고, 이벤트 집과 점유된 칸은 보호한다.
길·나무·꾸밈·기존 출입 시험/실내를 보존한다.

공용 ground는 기존 48슬롯을 유지한 112칸/21레시피다. 보정 집도 sourceKit별 원본 기초 레시피를 적용한다.
문 열은 투명하고, ★ 기초는 벽 통행을 유지하며 바쁜 꾸밈 칸을 건너뛴다.
공용 참고문서는 5 MD/5 이미지에 원본 보존 사전·정상/지붕 재칠 오류·5채 표본·전체 네 층/사용 graft를 담는다.
사용 graft만 기록해 문서 120,000자 상한을 지킨다.
저장·재로드·화면 근거는 `verify-shots/beodeul-native-restoration/README.md`.
이전 거부 시안 기록은 `verify-shots/beodeul-building-refinement/README.md`에 보존한다.

## 원본 유지 일광·길 경계·잔디 보정 (2026-10-04)

광원/접지 조사 후 사용자가 적용을 지시했다. 원본 건물·나무·기초/소품 도트와 원점, 두 출입 시험 맵은 보존한다.
공용 source beodeul_ground는 앞의 112칸을 그대로 두고 304칸으로 확장한다. 추가 44레시피는 집 6종/수관 3종의 짧은 일광·접촉 그림자, 4×3 저대비 잔디/흙 변화 3종, 원본 길 오토타일 16종의 연석 대비를 낮춘 변형 2개씩이다.
`harmonize_beodeul_daylight({mapId})`는 기존 맵만 보정한다. 그림자/잔디는 2층 빈칸에 넣고 기존 2층 그림과 높이를 보존한다. 길 보정은 원본 형태와 통행을 유지한 1층 graft이며 원래 길 오토타일 connectTileIds에 연결한다. memberTileIds는 바꾸지 않는다. 반복 적용은 중복하지 않는다.
작은 마을 houseCount 시공은 마지막에 자동 적용하고 큰 기후 마을에는 강제하지 않는다. 공통 조수 프롬프트와 참고문서 읽기 계약에 등록한다. 하네스 build/validate/review, 공용 신규/기존 source 등록과 실제 마을 전후·그림자만 비교·정본 저장·재로드·통행 근거는 verify-shots/beodeul-light-ground. 전체 게이트는 실행하지 않는다.

## 기본 타일셋 (2026-09-30)

버들항이 **새 프로젝트의 기본 타일셋**이다. `DEFAULT_TILESET_ID = "beodeul_city"`(`src/project/defaults/constants.ts`, 문자열 리터럴 —
7MB `beodeulCityTileset.json` 을 constants 가 import 하지 않게 하려는 것이라 `DEFAULT_TILESET_NAME` 은 `bundled.ts` 항목 이름과 같아야 한다).

- 새 프로젝트: `createBlankProject` 의 시작 맵 `createBlankMap(..., DEFAULT_TILESET_ID)`, 타일셋 목록 맨 앞이 버들항(`defaultTilesets`, `defaultResourceProfiles` 도 기본 프로필을 앞으로).
- 빈 맵 채움: `createBlankMap` 은 버들항이면 잔디 737(`BEODEUL_PLAIN_GRASS_TILE`), 아니면 `TILE.GRASS`. **`TILE.*` 상수는 합본 마을 칸 번호다.** 버들항에서 240 은 벽이다 — 버들항 맵에 `TILE.*` 를 쓰지 마라.
- 합본 마을은 번들에 그대로 남는다. 합본 마을 칸 번호에 의존하는 코드·테스트(`createStarterMap`, `createLogCabinShowcaseMap`, `createFarmingDemoProject`, `scripts/natural-village/build.ts`, 테스트 약 540곳)는 `COMBINED_TOWN_TILESET_ID/NAME/TEXTURE_KEY`(같은 파일)와 `combinedTownTileset()` 를 명시한다. "기본"을 뜻하는 곳만 `DEFAULT_TILESET_*`.
- 기존 프로젝트는 이관하지 않는다. 합본 마을 맵은 그대로 합본 마을 팔레트로 그려진다(`verify-shots/beodeul-default/bd-existing-combined-town.png`).
- 조수(2026-10-01 변경): `defaultOutdoorTilesetId`(`forestHarmony.ts`)는 **프로젝트에 버들항이 있고 모든 맵이 버들항이면(= 새 프로젝트) 버들항**, 그 밖(합본 마을·숲마을 맵이 섞인 기존 프로젝트)은 예전처럼 `forest_harmony` 가 있으면 그것이다. 보는 맵의 계열은 `toolRunner.ts` 60~100행의 계열 규칙이 지킨다. 「마을 만들어 줘」는 버들항 프로젝트에서 `author_beodeul_town` 으로 간다 — 아래 「조수 마을 경로」.
- 계열(2026-10-01): 버들항의 `family` 는 **`"oprn-atlas"`(생성 칩셋)** 이다. 시트 JSON 은 `"easyrpg"` 라 숲마을과 같은 계열로 묶였고, 계열 검사(`toolRunner.rejectTilesetFamilyChange`)가 버들항 맵에서 숲마을 새 맵으로 가는 것을 막지 못했다. `createBeodeulCityTileset` 이 덮어쓰고 `ensureBeodeulCityTileset` 이 옛 사본을 고친다.
- `create_map`(2026-10-01): 버들항이면 잔디 737 로 채운다(`plainGrassTileFor`, `defaultMaps.ts`). 예전엔 `isCombinedTownCompatibleTileset` 이 거짓이라 빈칸(-1)이었다.
- 시작 마을(2026-10-01): 「예제로 시작」(`projectStartSeed.ts`)과 첫 실행 안내 「작은 마을 추가하기」(`firstRunGuide.ts`)는 `createBeodeulStarterMap`(`src/editor/content/beodeulStarterMap.ts`) — `author_beodeul_town` 40×30 seed 7(주택가·시장 둘·저택) 뒤 오른쪽 남는 띠를 비우고 첫 띠 아래 길(2줄)을 동쪽 끝까지 잇는다. 첫 구간 뼈대가 (가로-1, 시작 y)에 다음 맵 문을 달기 때문이다. 시작 칸 (3, 13). 첫 실행 안내는 시작 맵이 버들항일 때만 쓰고, 옛 칩셋으로 시작한 프로젝트는 합본 마을 `createStarterMap` 그대로(계열을 섞지 않게). `createStarterMap` 자체와 샘플 모험(`createDefaultProject`)은 합본 마을 칸 번호로 꾸민 것이라 그대로다.
- 몬스터 수집 도로(2026-10-01): `author_wild_route` 가 버들항 맵도 깐다(`wildRouteBeodeul.ts`) — 합본 마을 경로와 같은 길 계획(`planRouteCorridor`)을 포석·짙은 잎 풀(11628)·버들항 나무 키트로. **버들항엔 키큰 풀이 없어 풀숲은 짙은 잎 풀 대용이다** — 손 도트 키큰 풀을 시트에 더하는 일은 남았다. 이것이 없던 동안(#1789~) 새 프로젝트의 몬스터 수집 첫 구간 뼈대(AI 인터뷰 시작·예제로 시작)는 이 도구에서 멈췄다.
  - 2026-10-06 다시 손봄(「1번 도로가 엉망진창」): 시내 포석 → **`버들항 모랫길`** 오토타일, 잡음 경로의 계단 대각선 → **꺾임 비용 경로**(`routePathStraight`, 방향을 상태에 넣은 다익스트라) + 경유점까지 갔다 되돌아온 막다른 가지 잘라 내기(`pruneLoops`),
    풀숲에 잘려 남은 4칸 이하 모랫길 토막은 풀밭으로. 숲은 2칸 격자 흩뿌림(덤불 점박이) → **숲 벽**(`plantBeodeulForestWall`): 크기로 나눈 나무(3×3 수관·3×4 줄기 나무·2×2 덤불)를
    위에서 아래로 벽돌처럼 엇갈려 붙이고, 아래가 트인 앞줄엔 줄기 나무, 맵 하나에 수관·줄기 한 종씩. 길섶엔 깊은 숲길 세트 1칸 소품(`dressBeodeulVerge`).
    도구가 맵에 `mapRole: "field"` 를 붙이고, `stamp_object` 는 필드 맵에 마을·항구·농장 소품(bd-house·block·harbour·garden…, bd-pick-fishing-port·riverside-mill·vineyard·walled-market·wheat-roman 등)을 `settlement-prop-on-route` 로 거부한다(`routePropPolicy.ts` — 조수가 1번 도로에 통발·건조대·밀단을 찍었다).
    남은 것: 수관 사이 풀밭 이음매(키트끼리 겹칠 수 없다), 키큰 풀 그림. 계약 `test/wildRouteBeodeul.test.ts`.
- 계열 규칙(`isCombinedTownCompatibleTileset`)은 합본 마을 계열 기준 그대로다.

### 빠른 집·도로 도구 (2026-10-03)

높이 도구의 「집」은 버들항에서 반목조 집 3종(붉은 꽃/초록 창틀/불 켠 창)과 통나무 집 3종(초록/파랑/붉은 문)을 기본 카드로 보여 준다.
`src/editor/beodeulQuickHouse.ts`가 공용 `bd-mpart-*` / `bd-out-*` 부품의 실제 윗층 배열로 조립한다.
근거는 타일 참고문서 「저택·외곽」의 `bd-manor-kits.md` / `bd-outskirts-kits.md`와 부품 그림이다.
드래그 너비는 반목조 최소 7칸/통나무 최소 5칸, 최대 24칸. 반목조 새 집은 `bd-mpart-gable` 원본 5×4 박공을 중앙에 올린 4행 지붕이 기본이다. 「지붕 형태」에서 3행 모임 지붕도 고른다. 통나무 집은 원래 3행 지붕을 쓴다. 층은 2행짜리 띠를 온전히 반복한다(최대 9층).
「지붕만」 모드는 벽 너비/층수를 유지하며 지붕 너비와 반목조 집의 형태를 바꾼다. 기존 생성 집은 지붕에서 끌어 벽·창·문 월드 좌표를 유지한 채 조절한다. 기본 「기존 형태 유지」는 너비만 바꾸며, 명시한 형태 변경은 지붕 높이에 맞춰 스탬프 원점을 옮긴다. 너비는 벽 이상~24칸이다. 옛 kit ID/그림은 유지하고 새 박공 ID에 `_joined_gable`을 붙여 구분한다. 직접 덧칠/다른 배치와 겹친 집은 보호한다.
박공의 양쪽 사선 C칸이 지붕 중앙 M칸과 겹칠 때는 `bd-manor-small` 원본 (3,2)/(7,2)의 합성된 upper 칸을 쓴다. 투명한 박공 C칸만 대입하면 셀 전체의 뒤 지붕을 지워 봉우리 양옆에 구멍이 난다. 좁은 집에서 C칸이 지붕 끝 L/R 안에 있으면 해당 합성 M칸을 끼워 넣지 않는다.
AI `place_terrain_house` / `resize_terrain_house_roof`의 `roofForm: "gable" | "hip"`도 같은 조립기를 쓴다. 지붕 수정 보호는 최종 배치를 재조립해 비교하므로 형태 변경을 허용해도 벽 수정 예외가 생기지 않는다. 근거: `scripts/qa/gabled-roof-audit.mts`, `verify-shots/gabled-roof/SUMMARY.md`.
초록 고스트와 확정은 같은 계획을 쓰며 문 앞까지 빈 평지를 검사한다. 저장된 기존 집은 원래 크기로 고를 수 있다.
아래층은 비워 두어 기존 잔디를 유지하고, 새 그림이나 타일 번호를 만들지 않는다. 숲마을 그림으로 대체하지 않는다.
「도로」는 버들항 길 포석 `beodeul_road_autotile`(몸통 3221)을 먼저 고른다. `TILE.DIRT`나 다른 칩셋의 길 번호를 쓰지 않는다.
실제 새 프로젝트 기본 선택, 3종 크기 드래그, 포석 교차로, 시야 ON/OFF, 출하 플레이어와 SQLite 재로드 증거는 `verify-shots/beodeul-building/`.
계약·조작은 [지형 도구 모음](terrain-design-suite.md#빠른-집과-도로).

### 팔레트 실측 (2026-09-30, 헤드리스 chromium, dev 서버, 1600×900)

| | 버들항(빈 새 프로젝트) | 합본 마을 |
|---|---|---|
| 팔레트 첫 타일 (페이지 부팅 포함, 콜드 dev) | 약 19~20초, 992칸으로 시작 | 약 18~22초, 195칸 |
| 팔레트 DOM `.chipset-tile` | 23,936 (패널 24,036 노드, #app 24,754) | 195 (패널 308, #app 약 1,020) |
| 필터(분류) 전환 | 0.74~2.3초 | 65~126ms |
| 타일 클릭 | 171~525ms | 약 72ms |
| 전체 채움 | 배치 128칸×`setTimeout(0)` 로 약 60초 | 즉시 |

**가상화 적용 후 (2026-10-01, 같은 조건, `perf/palette-virtual`).** `tilePaletteVirtual.ts` 가 보이는 창 + 위아래 18행·좌우 1열만 DOM 에 둔다(칸 수 512 초과인 커스텀 팔레트만; 이하는 예전 전체 렌더).

| | 이전 | 이후 |
|---|---|---|
| 팔레트 DOM `.chipset-tile` / 패널 노드 | 23,936 / 24,036 (측정 4,705~8,545 은 지연 채움 도중) | 969 / 970 |
| 필터(분류) 전환 | 1.1~1.5초 | 42~100ms (`refreshPaletteFilter`: 툴바·보조 패널 재빌드 생략, 목록만 교체) |
| 타일 클릭 | 약 295ms | 39~75ms(부하 잡음 큼) |
| 스크롤 프레임 p50 / p95 | 67ms / 495ms | 약 19ms / 64~80ms — **16ms 목표 미달** |
| 합본 마을 | (기준) | 같은 값(가상화 문턱 미만, 경로 불변) |

스크롤은 유휴 프레임 비용이 칸 수가 아니라 **격자 전체 높이**에 비례했다(헤드리스 소프트웨어 래스터 추정; contain·will-change·content-visibility 무효). 스크롤 중 추가 비용은 칸 추가·제거 시 스타일 재계산이며 행 버퍼를 늘릴수록 줄어든다(1행 360~520ms/s → 18행 약 80~160ms/s). 측정 스크립트·전후 JSON·스크린샷은 `verify-shots/palette-virtual/` (`bench.mjs`, `behavior.mjs`, `pdiff.py`). 기본 화면 픽셀 diff 는 두 타일셋 모두 0.

분류 보정(코드): `tileMeta` 에 role 이 없는 타일셋은 「지형」이 0칸이었다 → 태그(grass·road·plaza·sand·walk·cliff…)로 usage 추정(`tilePaletteFilter.ts inferTerrainUsage`), 버들항 지형 2,482칸. **「물」 10,719칸은 그대로다** — 무늬 없는 일반 물칸 10,591개가 `water` 태그를 다 갖는다(`beodeulCityTileset.json` 데이터). 고치려면 `python3 scripts/content/build-beodeul-city.py --no-render` 로 JSON 을 다시 만들 때 일반 물칸 태그를 `water-plain` 등으로 나눠야 한다(이번엔 재생성하지 않음). 잔디·광장·오토타일 앞쪽 고정 구역은 미구현.

앞쪽 배치: 잔디 737 은 5행, 광장 8~22행. 그러나 길·물·모래 **오토타일 본체는 맨 끝**(길 23015~, 물 23025~23152, 모래 23160~, 179~181행)이고, `지형` 필터는 0칸, `물` 필터는 10,719칸(과대 분류)이다. 구조물 키트 286종은 팔레트 칸이 아니라 `stamp_object`/구조 보조로 찍는다. 후속: 자주 쓰는 칸 고정 구역, 지형 분류 수정, 가상화.

## 무엇이 어디에 있나

| 무엇 | 위치 |
|---|---|
| 그리기 파이프라인 (Python) | `scripts/content/lib/city_v6/` — 입구 `city6.py`, 키트 `city6_kits.py`, 소품 `city6_props.py`, 렌더 `city6_render.py`, 움직임 `city6_anim.py`, 메타 `meta.json`, QA `qa-v6.json`. 출력 폴더는 `CITY6_OUT`(기본 `/tmp/j8city6`). 바탕 칩셋 사본 `assets/jungle-chipset-v6.png`(v6 를 그릴 때의 정글 시트, 뒤에 바뀐 번들 시트와 달라 고정), 잔디·물 견본 `assets/lawn16.png`·`water16.png` — **이제 `/tmp`·홈 폴더를 읽지 않는다**(옛 `addons2.py` 가 `/tmp/j8city` 를 경로 맨 앞에 넣어 모듈 13개가 거기서 읽혔다) |
| 편집기 쪽 추가 출력 | `city6_render.py` 가 같은 실행에서 `city6_ground.png`(물체 전 땅), `city6_grid.json`(점유·단·절벽·물·문·계단·다리·잔교), `city6_objects.json`+`objects/*.png`(물체마다 투명 그림), `city6_houses.json`, `city6_people.json`(주민) 을 더 쓴다. `CITY6_NO_PEOPLE=1` 이면 주민 그림만 빼고 그린다(주민은 이벤트가 된다) |
| 칸 자르기 | `python3 scripts/content/build-beodeul-city.py` (`--no-render` = 렌더 다시 안 함) → `public/assets/beodeul-city/beodeul-city-chipset.png`(v7: 2048×2992, 128열, 23,936칸), `src/assets/beodeulCityTileset.json`, `src/assets/beodeulCitySheet.json`, `tiledata/beodeul-city/map.json` |
| 원본 렌더 사본 | `tiledata/beodeul-city/render/`(주민 없음, 칸을 자른 원본) · `render-full/`(주민 포함 = `/tmp/j8city6/city6.png` 와 화소 0 차이) |
| 타일셋 정의 | `src/project/defaults/beodeulCity.ts` `createBeodeulCityTileset` / `ensureBeodeulCityTileset`(칸 수가 다른 옛 사본의 칸 표·키트·오토타일과 같은 id 번들 용도를 새것으로) / `ensureBeodeulCityReferences`(빠진 용도 추가) |
| 공용 배포 | `src/assets/bundled.ts` 한 줄(`tex_beodeul_city`) + `bundledChipsetGeometry.ts`(128열) → `defaultAssets.ts` `ensureBundledTilesets` 가 새 프로젝트·기존 프로젝트 모두에 만든다. `tilesetHarness/combinedTown.ts` 의 RM2k3 투명 칩 표에서 뺐다(칸 층은 렌더에서 잘랐다) |
| AI 참고문서 | `python3 scripts/content/prepare-beodeul-city-references.py` → `src/assets/beodeulCityReferences.json`(v7: 용도 6 · MD 24 · 그림 44 · JSON 218KB · 그림 3.4MB(128색 팔레트 PNG); v6 는 용도 4 · MD 17 · 그림 21, 그림은 `/assets/beodeul-city/references/*.png` 경로 — 바이트 없음) + MD 사본 `tiledata/beodeul-city/references/*.md` + 변조 검사 결과 `tiledata/beodeul-city/qa-tamper-checks.json` |
| 정본 저장 | `node scripts/content/save-beodeul-city.mjs` → v7 `.oprn-projects/beodeul-city-r2-20260929`(git 밖, 맵 `beodeul_v7`), 증거 `tiledata/beodeul-city/storage-proof-r2.json` (v6: `beodeul-city-20260928`, `storage-proof.json`) |
| 예시 배치·배치 자 | `bun scripts/content/author-beodeul-layouts.mts [--only hilltop\|estuary]`(배치 정의 `scripts/content/lib/beodeul-layout-specs.ts`, 자 `scripts/content/lib/beodeul-metrics.ts`) → `verify-shots/beodeul-layouts/<id>/`(render·recipe·metrics·map·변조 그림 `err-layout-*.png`·`tampers.json`). 배치 하나 약 3분 |
| v7 그림 추가분 | `scripts/content/lib/city_v6/terrain7.py`(오토타일 16변형) · `road_fix7.py`(두 번째 길 감사) · `kits7_common.py`/`kits7_manor.py`/`kits7_outskirts.py` → `tiledata/beodeul-city/kits7/*.json·up.png·lo.png`(저택 40·외곽 55 키트) |
| 재로드 렌더·화소 비교 | `bun scripts/content/render-beodeul-city.mts` → `verify-shots/beodeul-assistant/reloaded-render.png`, `pixel-diff.json`, `diff-*.png` |
| 조수 시험 | `bun scripts/qa/beodeul-assistant-run.mts --project <폴더> --label fresh|existing --map <id> --new 100x100` → `verify-shots/beodeul-assistant-r2/<label>/`(라운드 1 결과는 `verify-shots/beodeul-assistant/`). 빈 폴더면 편집기 「새 프로젝트」와 같은 빈 프로젝트에서 시작 |
| 증거 페이지 | 라운드 1 `~/claude-viz/beodeul-assistant-proof.html`, 라운드 2 `~/claude-viz/r2-beodeul.html`, 라운드 3 `~/claude-viz/r3-beodeul.html` (http://mdc-server:18301/r3-beodeul.html) |
| 블록 키트 (v8) | `build-beodeul-city.py` 의 v8 절(`_Canvas`·`block_*`·`BLOCKS`) → 번들 키트 `bd-block-*` 41종 + 표 `tiledata/beodeul-city/blocks-v8.json`(문 앞 칸·가장자리 출구) |
| 조수 스킬 | `assistant-skills/city-block-assembly/SKILL.md` — 이 브랜치에는 스킬 번들러(`bundle-assistant-skills.mjs`, agent/atlas-policy)가 없어 스킬 본문은 아직 못 읽는다. 대신 **참고문서 `bd-work-order`(번들 소유)와 `author_beodeul_town` 도구 결과·노트가 같은 절차를 조수에게 준다** |

## 칸 자르기 규칙

- 칸마다 **아래층 = 땅 렌더**(포석·판석·물면·절벽·다리 상판·바닥 키트), **윗층 = 최종 그림이 땅과 다른 화소**(집·성·나무·소품·처마·연기·날개·배)를 불투명으로.
- 원본 한 바퀴 24장면(물 8·풍차 8·연기 12·배/분수/깃발 4)을 칸마다 계산해 주기 p(1·2·3·4·6·8·12·24)로 줄이고, p>1 이면 p칸을 이어 붙여 `animationStrips {baseTile, frames:p, fps:8}` 한 줄. 1,699줄. 한 줄은 시트의 한 행 안에 둔다.
- 같은 그림(같은 장면열)·같은 층·같은 통행은 한 칸을 같이 쓴다. 통행은 칸마다 다를 수 있어 키에 넣었다.
- 통행은 Python 점유 격자에서: 길·광장·성벽길·성문·다리·계단·잔교·풀밭(절벽 가장자리 포함) = 걸음, 물·절벽면·담·건물·소품·나무 = 막힘.
  계단은 절벽면 위, 다리는 물 위에 있으므로 계단·다리·성문·성벽길은 먼저 걸음으로 판정한다(이걸 빠뜨려 처음엔 문 앞 72곳 중 다수가 끊겼다).
  윗층 칸은 그 칸이 걸음이면 ★(사람 위에 그려짐, 처마·굴뚝·나무 윗부분), 막힘이면 y 정렬되는 막힌 물체.
- 시트는 오토타일이 없다(원본 자리에서 잘린 칸). 그래서 조수용 재료는 **키트**다: 구역 8(왕성·저택·포룸·성당 언덕·풍차 들·강/다리·서쪽 항구·항구, 두 층 채움), 건물 70(이름 있는 건물 12 포함)·소품 34·나무 8 조각(물체의 투명 그림을 원래 칸 오프셋 그대로 잘라 새 칸으로, 아래층 -1).
  `stamp_object({objectId:'kit:beodeul_city/<id>'})` 로 찍힌다(`sharedDesignCatalog.ts` `kitObjects`). 땅 재료 네 가지(`버들항 풀밭`·`길 포석`·`광장 판석`·`물`)는 오토타일 아닌 면 채우기 그룹이다.
- tileMeta 는 칸 23,936개가 모든 프로젝트에 실리므로 짧게(이름표·한 줄 설명·층·통행) 했다. 번들 JSON 6.5MB.

## 정본 저장·재로드 (2026-09-28)

- project id `ad468208-0287-4f27-a50e-20d10536a0cd`, `.oprn-projects/beodeul-city-20260928`, revision 1. 맵 `beodeul_v6` 100×100, 주민 이벤트 122.
- 재로드 `isDeepStrictEqual` 프로젝트·맵·타일셋 모두 true. 편집기 통행(`isPassable`) 대 Python 점유 격자 10,000칸 중 불일치 0(걸음 2,907칸).
- 재로드 맵을 저장소 렌더러(`scripts/qa-game/render.mts` → `editor/mapTileDraw`, 각 띠 0번 장면)로 그려 비교:
  주민 없는 원본과 **0화소 차이**, 주민 포함 `city6.png` 와 29,508화소(1.15%) 차이 — **전부 주민 122명 그림 상자 안**(상자 밖 0). 주민은 타일이 아니라 NPC 이벤트로 옮겼기 때문이다.
- 기존 프로젝트: 저장된 `saltflat-fields-20260928` 를 읽어 `ensureBundledTilesets` 를 돌리면 `beodeul_city` 와 참고문서 4용도가 생기고, 참고문서를 지운 사본은 4용도가 다시 채워진다.

## 조수 시험 — 「버들항 비슷한 로마풍 항구 도시를 깔아줘」

`scripts/qa/beodeul-assistant-run.mts`: 정본 SQLite 프로젝트를 읽고(편집기 로드처럼 `ensureBundledTilesets`), 100×100 `beodeul_city` 맵을 만든 뒤
Pi 런타임(`runPiAgent`, 채팅 패널과 같은 도구·참고문서 읽기 게이트)을 실제 모델로 한 번 돌리고, 결과를 같은 저장소에 저장·재로드·렌더한다.

- 모델: `klb/claude-opus-5.5`(생각 high). klb 는 번들 모델 목록에 없어 `~/.omp/agent/models.yml` 의 공급자 정의로 모델 객체를 만든다 —
  `piAgentRuntime.ts` `RunPiAgentOptions.model` 을 더했다(없으면 예전처럼 목록에서 정확히 찾는다). 키는 증거에 남기지 않는다.
- 도구 노출: 채팅 패널은 의도 선언(LLM)으로 쓸 만한 도구를 고른 뒤 core + 발견 도구 + 그 도구를 보낸다(`plainTurn.ts` → `buildSessionRegistryTools`).
  헤드리스에서는 선언을 지도 시공용으로 고정했다(33개). 전체 275개(약 600KB)를 매 호출 싣지 않기 위해서다. `find_tools` 로 넓힐 수 있다.
- 결과·도구 호출·판정은 `verify-shots/beodeul-assistant/{fresh,existing}/summary.json`·`trace.json`·`render.png` 와 증거 페이지에 있다.

### 결과 (2026-09-28, 두 번)

| | 새 프로젝트 | 기존 프로젝트(소금 평원 필드 사본) |
|---|---|---|
| project id / 폴더 | `2b631748-…` `.oprn-projects/beodeul-assistant-fresh-20260928` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-existing-20260928` |
| 시간 · 턴 · 도구 호출(실패) | 24분 · 40 · 178(2) | 24분 · 43 · 171(2) |
| 참고문서 | list 5 · read 27, 4용도 모두(문서·그림 22종) | list 5 · read 23, 4용도 모두(20종) |
| 구역 키트 | 8/8, 모두 원본 원점 | 8/8, 모두 원본 원점 |
| 새로 찍은 건물 · 소품 · 나무 | 23 · 10 · 31 | 27 · 16 · 33 |
| 문 앞 도달(큰길 62,33 에서) | 23/23 | 27/27 |
| 원본과 같은 칸 | 65.1% | 64.8% |
| 구역 밖 물체 칸(원본 1,855) | 1,069 | 1,232 |
| 저장 후 재로드 동일 | true | true (로드 때 `beodeul_city` 가 새로 생김, 기존 맵 5장 그대로) |

판정: 조수는 도구로 참고문서를 읽고 **버들항과 비슷한 도시를 깔았다.** 그러나 절반 이상은 구역 키트를 원본 좌표에 찍은 복사이고,
스스로 설계한 가운데 마을은 원본보다 성기고(물체 칸 58~66%), 길은 오토타일이 없어 포석 대표 칸 사각형이다.
강 윗줄기(33~36열 0~23행, 74칸)는 어느 구역 키트에도 없어 두 결과 모두 빠졌고, 기존 프로젝트 결과는 가운데 운하 72칸을 덮었다.
실패 2회는 두 번 모두 첫 `fill_region` 이 `layer is not defined` 로 죽은 편집기 버그(`constructionTools.ts` 결과 data 의 없는 변수)였다 — 고쳤다.
다음에 고칠 것: 강 전체를 한 키트로, 길 포석·물가에 오토타일, 문서의 「원본 좌표 = 정답」을 「원본은 예시, 새 배치 규칙」으로.

## 라운드 2 (2026-09-29, v7) — 원본이 아닌 도시를 가르치기

라운드 1 조수는 구역 키트를 원본 좌표에 찍어 원본의 65%를 복사했다. 라운드 2 의 목표는 **같은 조각으로 다른 배치**를 깔게 하는 것.

### 무엇을 더했나
- **오토타일 셋**(`terrain7.py`, 16변형 N=1 E=2 S=4 W=8): `버들항 길 포석`(연석 2px) · `버들항 물`(돌 둑, 8장면) · `버들항 모랫길`(잔디 가장자리).
  `edgeConnects`+`outsideConnects` 둘 다 켰다 — `shapeAutotileGroupAround` 는 앞의 것, `fill_region` 이 쓰는 `resolveAutotile` 은 뒤의 것만 본다.
  맵 가장자리는 이어진 것으로 봐서 길·강이 맵 밖으로 나가는 모양이 된다.
- **강·폭포·다리·항구 키트 10**: 라운드 1 에서 어느 키트에도 없던 윗 강 74칸(`bd-river-upper`), 곧은 강·운하·굽이, 아치 다리, 폭포 둘, 호수 항구(83×15), 항구 광장.
- **귀족 저택 4 + 정원 2 + 부품 34**(`kits7_manor.py`), **성 밖 목조집·우물 광장·장작 + 부품 49**(`kits7_outskirts.py`). 부품 조립표는 `tiledata/beodeul-city/kits7/*.json` 의 `assembly`.
- **잔디 무늬 조각 6**(`bd-ground-lawn-*`): 원본엔 6×6 빈 풀밭이 없어서(빈 칸 738개가 전부 틈) 밝기가 같은 잔디 칸 10종을 고정 난수로 섞어 만든다.
- **구역 키트 가장자리 정리**: 이웃 집·지붕 꼭지를 잘라 내고(그림자 칸은 같은 종류의 그림자 없는 칸으로), 왕성 양 끝 성벽 기둥·저택 옆 강 한 줄 → 잔디, 해자 양 끝은 물 오토타일 막힌 끝.
- **v6 잔결함**: 나무 변형·색조, 빨랫줄 5줄, 밀 색(`wheat7`, 칩셋 색만), 두 번째 길 감사(`road_fix7.py`), 넷째 다리, 잔교를 땅으로.
- **그리기 파이프라인이 /tmp 를 읽던 마지막 구멍**: `pj_demo.py` 가 `sys.path` 맨 앞에 `/tmp/j8city` 를 넣어, 그 뒤 모듈(shapes·pi·pz·roman·sheet2)이 전부 /tmp 사본에서 왔다.
  v7 의 밀·빨래 색 수정이 렌더에 안 들어간 이유가 이것이었다. 고친 뒤 렌더 차이 7,055화소(밀·건초·빨래), 칸 번호는 그대로.
  확인법: `python3 -c "import sys;sys.path.insert(0,'.');import palette;palette.apply();import pv,shapes;print(shapes.__file__)"` (lib/city_v6 에서) → lib 경로여야 한다.

### 예시 배치 둘과 배치 자
`scripts/content/author-beodeul-layouts.mts` 가 편집기 도구만으로 「언덕 위 성읍」(`hilltop`)과 「강어귀 항구」(`estuary`)를 깔고,
`beodeul-metrics.ts` 로 잰다. 둘 다 원본과 같은 칸 0.45%·0.53%, 결함 0, 문 43·52곳 모두 포장 길망 도달.

배우며 찾은 도구 함정:
- `fill_region` 은 칠한 칸 옆 **한 칸 틈**(벽 사이 잔디)을 메운다(요약의 「벽 틈 메움 N칸」). 키트 둘레에 잔디 칸이 있는 포룸·풍차 옆에 거리를 나중에 칠하면
  짧은 길 토막이 생긴다 → 그 거리를 먼저 칠하고 키트를 찍은 뒤, 출구 칸만 다시 칠해 연석을 맞춘다.
- 칸별 이웃 수로 막다른 길을 재면 2칸 폭 거리의 끝(이웃 2)은 안 보인다 → `deadEndStreets`(끝 줄 2~3칸 검사).
- 잔디 무늬 조각은 땅 키트라 「키트가 소유한 칸」에서 뺀다(뺐더니 그 위에 깐 막다른 길이 보였다).
- 변조 4종(문 앞 궤짝 · 막다른 곁길 · 같은 집 셋 · 다리+둑길 빠짐)을 같은 자로 검출해 참고문서의 오류 그림으로 쓴다.

### 참고문서 (v7)
용도 6 · MD 24 · 그림 44. 「도시 한 장 조립」을 「원본은 예시」로 다시 썼고, 「배치 규칙」(구역 키트 17종 출구 칸 표·거리 끝 규칙·집 줄·다리 갑판 행·물),
예시 배치 둘(도구 순서·100×100 역할 격자·렌더), 「자동타일과 강·폭포·다리·항구」, 「귀족 저택과 성 밖 목조 마을」 용도를 더했다.
그림은 128색 팔레트 PNG 그대로 저장한다(RGB 로 되펴 저장하던 것을 바꿔 9.0MB → 3.4MB). 번들 JSON 220KB, 이미지 바이트 없음.
옛 시트(칸 수가 다른) 사본은 `ensureBeodeulCityTileset` 이 칸 표와 **같은 id 의 번들 용도**를 새것으로 바꾼다(칸 번호가 옛 시트 것이라). 저자 용도는 그대로.

### 정본 (v7)
project id `6f86ae29-f2a4-4c06-a396-511f972cea52`, `.oprn-projects/beodeul-city-r2-20260929`, 맵 `beodeul_v7`, revision 2.
재로드 deepEqual 프로젝트·맵·타일셋 true, 통행 불일치 0/10,000(걸음 2,943), 재로드 렌더 대 주민 없는 원본 0화소 차이.

### 조수 재시험 (klb/claude-opus-5.5, 「원본 좌표에 찍지 말고 새로 설계, 예시도 베끼지 말 것」)
`bun scripts/qa/beodeul-assistant-run.mts … --label fresh|existing --map beodeul_like --new 100x100`, 증거 `verify-shots/beodeul-assistant-r2/{fresh,existing}/`.

| | 새 프로젝트 | 기존 프로젝트(소금 평원 필드 사본) |
|---|---|---|
| project id / 폴더 | `ecb372c8-…` `.oprn-projects/beodeul-assistant-r2-fresh` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-r2-existing` |
| 시간 · 턴 · 도구 호출(실패) | 50분(Pi 실행 상한 3000초에서 멈춤) · 38 · 192(0) | 42분(스스로 끝냄) · 40 · 224(1 — 참고문서 선행 읽기 게이트) |
| 참고문서 | list 7 · read 41 | list 7 · read 29 |
| 원본과 같은 칸 | **0.45%** (라운드 1: 65.1%) | **0.43%** (라운드 1: 64.8%) |
| 예시 배치와 같은 칸(대부분 빈 잔디) | 언덕 위 10.2% · 강어귀 14.4% | 8.0% · 12.8% |
| 구역 키트(원본 원점에 찍음) | 성·저택·포룸·성당·풍차 5/5 + 호수 항구, 원점 일치 0 | 5/5 + 호수 항구, 원점 일치 0 |
| 새 키트 쓴 것 | 저택 1, 목조집 11, 다리 4, 항구 광장 | 저택 1 + 정원 2, 목조집 5, 다리 4, 잔디 무늬 23 |
| 집 · 나무 · 소품 | 40 · 26 · 7 | 53 · 36 · 6 |
| 문 → 육지 / 포장 길망 | 50/50 · 50/50 | 58/58 · 58/58 |
| 막다른 칸 / 막다른 넓은 거리 / 물에 끝남 / 막힌 문 앞 / 같은 조각 일렬 | 1 / 1 / 1 / 0 / 0 | 2 / 1 / 0 / 0 / 0 |
| 저장 후 재로드 | 맵 동일 true, 저장소 두 번 읽기 동일 | 맵 동일 true, 저장소 두 번 읽기 동일 |

「새 프로젝트」는 도중에 키트 가장자리 정리 전 번들(반쪽 이웃 집이 붙은 포룸 등)로 돌았다 — 실행 중에 번들을 고쳤다. 「기존 프로젝트」는 정리 후 번들이다.
프로젝트 전체 deepEqual 은 두 결과 모두 false 로 기록됐다: 실행 결과 객체 대 저장소 재로드의 차이는 기존 프로젝트에서 `database`(actors·classes…)·`system.titleScreen`,
즉 저장소가 옛 데이터를 읽으며 채우는 기본값이다. 맵은 칸까지 같고, 저장소를 두 번 읽은 결과끼리는 deepEqual true·sha 같음.
판정: 원본 복제는 사라졌고(같은 칸 0.4%), 구역 배치·강 흐름·다리·집 줄을 스스로 설계했다. 약점은 격자처럼 고른 거리망, 막다른 길 한두 곳, 강의 꺾임 한 번, 빈 잔디.

## 라운드 3 (2026-09-29, v8) — 블록 키트로 빈 풀밭 없애기

감독 실측: 라운드 2 두 결과 모두 맵의 31~33%가 빈 잔디, 20×15 화면 35개 중 11~16개가 40% 넘게 빔. 같은 폭 바둑판 거리, 블록마다 집 한 줄 + 뒤는 빈 잔디.
원인은 조립 단위가 **집 한 채**였던 것(찍기 96~136번, 시간 상한). 라운드 3 은 단위를 **블록 하나**로 바꿨다.

### 무엇을 더했나
- **블록 키트 41종** `bd-block-<종류>-<가로>x<세로>[-b|-c]`: 주택가·상가(13칸은 집 두 줄 + 6행 뒷골목, 8칸은 한 줄 + 뒷마당),
  시장, 정원 저택(a 작은·b 탑·c 담쟁이), 성 밖 목조, 항구 창고(b 야적장), 성당 앞. 크기 10/14/20 × 8/13/17.
  원본 좌표를 옮기지 않고 조각을 틀에 새로 조립한다(`_row`·`_scatter`·`_topup` — 뒷마당 빈 잔디 20% 이하까지 소품).
  문은 모두 블록 아래 변. 표: 문 앞 칸 x, 블록 안 문 앞(골목), 가장자리 포장 칸 N/S/W/E.
- **빈 바닥 자** `emptinessOf`(beodeul-metrics): `open` = 물건 없는 걷는 비포장 땅(감독 실측에 가장 가깝다), `lawn` = 물건 없는 기본 잔디.
  20×15 화면마다 비율, 40% 초과 수. 라운드 2 를 같은 자로 다시 재면 open 34.7%·11/35, 29.7%·10/35.
  옛 예시 배치도 비어 있었다: 언덕 위 50.0%·24/35, 강어귀 35.7%·16/35 — 조수가 예시에서 빈 도시를 배우고 있었다.
- **블록 반복 자** `blockRepeats`: 같은 줄·열에서 20칸 안의 같은 블록 id, 한 맵 3번 이상.
- **예시 배치 `blocks`**: 대로 4칸 2줄(가장자리 줄에 가로등·가로수) · 거리 2칸 · 골목 1칸 격자, 블록 34개(31종, 이웃 반복 0),
  공원 대각선 거리(3칸 가로 조각을 줄마다 비껴 칠함), 호수 항구 + 부두 길. 빈 바닥 10.8%·0/35, 문 120 모두 길망.
- **참고문서 용도 `beodeul-city-blocks`**(작업 순서·시간 예산, 길 위계·굽은 길, 블록 표, 그림 3). 작업 순서를 새 용도에 둔 이유:
  라운드 3 이전 프로젝트엔 이 용도가 통째로 없으니 `ensureBeodeulCityReferences` 가 빠진 용도로 심는다(있는 번들 용도는 다시 쓰지 않는다).
  같은 칸 수 사본에는 `ensureBeodeulCityTileset` 이 없는 배포 키트만 id 로 덧붙인다(기존 프로젝트 시험에서 블록 키트·용도가 로드 때 붙는 것 확인).
  7용도 · 28문서 · 48그림, JSON 248KB, 그림 4.1MB(이미지 바이트 없음).

### 배우며 찾은 것
- **블록을 찍은 뒤 거리 전체를 다시 칠하면 안 된다.** `fill_region` 의 벽 틈 메움이 블록 가장자리 한 칸 잔디를 모두 길로 만들어 블록에 톱니가 생긴다
  (첫 예시: 막다른 칸 47·넓은 거리 28). 뒷골목 끝 바깥 한 칸만 다시 칠한다.
- `lay_path` 는 한 칸 폭 8방향 선이라 두 줄을 나란히 그어도 계단 두 줄이다. 넓은 굽은 길은 행마다 가로 조각을 비껴 `fill_region`.
- **참고문서 무게가 곧 시간이다.** 첫 라운드 3 시험은 29번 읽고(선행 읽기 게이트가 용도의 그림을 전부 요구, 블록 용도 그림 10장) 턴당 입력 약 13만 토큰,
  22턴 50분 중 30분이 계획 → 블록 0개로 시간 상한(빈 바닥 45%). 블록 용도 그림 10 → 3, 블록 표 역할 배열 삭제, 블록 예시 문서의 100×100 격자 삭제 뒤 다시 돌렸다.
  증거 `verify-shots/beodeul-assistant-r3/fresh-try1/`.

### 조수 재시험 (klb/claude-opus-5.5, 라운드 2 과제 + 「블록 키트로」, 블록 25종 번들)
`bun scripts/qa/beodeul-assistant-run.mts --project … --label fresh|existing --map … --new 100x100`(기본 `--round r3`), 증거 `verify-shots/beodeul-assistant-r3/`, 표 `compare.json`.

| | r2 새 | r2 기존 | **r3 새** | **r3 기존** |
|---|---|---|---|---|
| 시간 | 50분(상한) | 42분 | **42분(스스로 끝냄)** | 50분(상한, 도시는 거의 다 깔림) |
| 도구 호출(찍기/칠하기) | 192(96/32) | 224(136/32) | 189(85/46) | 173(86/42) |
| 블록 키트 | 0 | 0 | 20 | 20 |
| 빈 바닥 open · 40% 넘는 화면 | 34.7% · 11/35 | 29.7% · 10/35 | **15.1% · 0/35** | **14.1% · 0/35** |
| 원본과 같은 칸 | 0.45% | 0.43% | 0.33% | 0.52% |
| 막다른 칸+넓은 거리 / 물에 끝남 | 2 / 1 | 3 / 0 | 0 / 3 | 12 / 0 |
| 같은 블록 가까이 반복 | — | — | 5 | 0 |
| 문 → 길망 | 50/50 | 58/58 | 73/73 | 72/72 |
| project id | `ecb372c8-…` | `dc69bd7c-…` | `0243f842-…` `.oprn-projects/beodeul-assistant-r3-fresh` | `dc69bd7c-…` `.oprn-projects/beodeul-assistant-r3-existing` |

저장 후 재로드 맵 동일(두 결과 모두). 적대적 시각 QA(새 서브에이전트): 빈 풀밭은 해소, 「만들다 만」 느낌이 일부 「복사해 붙인」 느낌으로 바뀜 —
새 프로젝트는 같은 블록이 한 열에 2~4번(시장·저택 교대, 목조 4연속), 기존 프로젝트는 동서 가로수 대로가 생겨 길 위계가 처음으로 보임.
공통으로 남은 것: 성 아래 절벽 조각·성 옆 잔디 테두리, 운하가 항구 앞 난간에서 끊김, 호수 항구 키트의 넓은 수면·짙은 녹색 사각형·막다른 길, 시장 3곳 과다.
QA 뒤 변형 16종·반복 자·반복 금지 규칙(이웃 금지·맵당 2번)·물길/잔디 테두리/나란한 길 규칙을 더했다 — **이 뒤로는 조수를 다시 돌리지 않았다.**

### 정본 (v8)
project id `ad9dadcc-3b40-40ed-93c2-64393550de06`, `.oprn-projects/beodeul-city-r3-20260929`(`BEODEUL_ROUND=r3` 기본), 맵 `beodeul_v7`(맵은 v7 그대로, 타일셋에 블록 키트·새 용도),
revision 1. 재로드 deepEqual 프로젝트·맵·타일셋 true, 통행 불일치 0/10,000, 재로드 렌더 대 주민 없는 원본 0화소 차이. 증명 `tiledata/beodeul-city/storage-proof-r3.json`.

## 다음 방향 (보류 — 이번에는 다시 그리지 않음)

사용자가 다음 판 참고로 준 그림 세 장. 저장소에 두었다.

1. `tiledata/city-refs/noble-manor-forest-house-rmxp.jpg` — **귀족 저택**: 반목조 흰 벽, 붉은 비늘 기와 지붕과 지붕창, 창가 꽃상자,
   좌우 대칭 정형 정원과 자갈 십자 길, 화분 속 사이프러스, 가로등.
2. `tiledata/city-refs/outskirts-wooden-houses.png` — **성 밖 외곽 나무집**: 통나무·널판 집, 가파른 나무 너와 지붕, 모랫길, 우물 있는 자갈 광장.
3. `tiledata/city-refs/itch-structure-ref.jpg` — **조립 구조 참고**(화풍이 아니라 짜임): 저택·빅토리아풍 집을 재사용 부품의 쌓음으로 본다.
   - 부품: 지붕(가파른 모임·망사드 + 평평한 머리, 너와 줄, 밝은 용마루·어두운 처마) / 박공·지붕창 / 층 띠(처마돌림 선반으로 나뉨) /
     모서리·칸 사이 붙임기둥 / 되풀이되는 아치 창 칸 / 기단(주춧돌 줄).
   - 변형은 같은 부품에서: 민짜 / 덩굴(이끼·담쟁이가 지붕 끝·기둥을 타고 흘러내림, 밑동 덤불) / 부서짐.
   - 옆 탑: 둥근·팔각 탑에 원뿔 지붕, 본채에 붙는다.
   - 입구는 따로: 기둥 박공 현관, 꼭지 장식 기둥 사이 앞으로 나온 계단(계단은 걸음, 기둥은 막힘).
   - 낱개 소품: 담쟁이 아치, 낮은 돌 난간·담, 산울타리 덩이, 돌 사당·묘비.
   - 1px 어두운 외곽선, 왼쪽 밝은 면·오른쪽 그늘 면, 지붕 처마·선반 그림자로 깊이.
   → **버들항의 저택·귀족 구역을 이 부품 조립(지붕/박공/층 띠/붙임기둥/창 칸/탑/현관/계단)으로 옮기고 부품마다 덩굴 변형을 둔다.**
   지금 저택은 한 장짜리 그림(`bd-house-manor` 13×11)이라 부품으로 나뉘어 있지 않다.

## 남은 것

- (v7 에서 해결) 땅 재료 오토타일 없음 → 길·물·모랫길 오토타일. v6 잔결함(막다른 길·물띠 줄무늬·일렬 반복·원색 밀밭) → 고침.
- 왕성 키트 아래 절벽 양 끝은 잘린 단면이다(끝 마감 그림 없음). 예시 배치는 나무 무리로 가린다.
- 원본 정본: 북쪽 절벽이 x≈55 에서 풀밭 한가운데서 끝난다(단 차가 동쪽으로 이어지지 않음, v7 적대적 QA 중대 1).
- 바닥 풀밭은 한 가지 칸이라 넓게 비우면 여전히 납작하다(잔디 무늬 조각은 옅다).
- 23,936칸 tileMeta 가 프로젝트마다 실린다(타일셋 JSON 약 7MB).
- (라운드 3) 호수 항구 키트 자체의 결함(짙은 녹색 사각형·안쪽 막다른 길·연꽃 넓은 수면)은 키트 안이라 조수가 고칠 수 없다. 구역 키트의 블록 맞춤판(성·포룸 가장자리를 판석으로 닫은 판)은 아직 없다.
- (라운드 3) 참고문서 선행 읽기 게이트가 용도의 그림·문서를 전부 요구해 물·구역 키트 용도(그림 13·8장)를 건드리면 턴당 입력이 커진다 — 판 하나로 묶는 것이 다음 일.


## 조수 마을 경로 (2026-10-01) — 「마을 만들어 줘」가 버들항으로 안 가던 원인과 수리

원인 세 가지(수리 전): ① 바깥 새 맵 기본이 숲마을(`forestHarmony.ts::defaultOutdoorTilesetId`) ② `author_village` 는 버들항을 `village-tileset-mismatch` 로 거절 ③ 의도 노트·도구 노출·마을 계약(`villageContract.ts`, `plainTurn.ts`)·`formatPiVillageNote`(`executionRoute.ts`)가 전부 `author_village` 한 방 숲 경로로만 몰았고 블록 키트·`check_city_form`·참고문서는 안내하지 않았다.

- 도구 `author_beodeul_town`(`src/editor/tools/authorBeodeulTown.ts`): **`theme:"city"` 일 때** 블록 키트 `bd-block-*`(+`bd-harbour-lake`)를 열·띠로 조립한다(2026-10-01 오후부터 기본 theme 은 마을 문법 `river` — 아래 「마을 문법」 절). `mapId`(기존 버들항 맵은 잔디로 지우고 통째 재조립)·`name`·`id`·`width`·`height`(기본 60×60)·`seed`·`harbour`(폭 83 이상). 원작 배치를 베끼지 않는다. 오프라인 검증 `scripts/qa/beodeul-town-offline.mts`: 빈 바닥 7.5~10.3%, 문 앞 전부 도달, 결함 0.
- `author_village` 는 대상이 버들항이면 `author_beodeul_town` 으로 **되돌려 보낸다**(`authorVillageToolDef.ts::rerouteToBeodeulTown`). 넘길 때 인자 글(이름·groundTheme)에서 theme 을 고른다: 도시·로마·블록 → city, 사막·오아시스 → desert, 설원·겨울 → snow, 늪·습지 → swamp, 항구·포구·바다 → coast, 그 밖 river. 「city」 낱말은 tilesetId `beodeul_city` 에도 있어 보지 않는다.
- 노트: `src/ai/piAgent/beodeulTownRoute.ts::beodeulTownTargetFor` 가 LLM 의도가 `author_village`/`author_beodeul_town` 를 고르고 대상 맵(없으면 프로젝트 바깥 기본)이 버들항일 때만 버들항 노트를 만든다. `executionRoute.ts` 는 이 노트를 `formatPiVillageNote` 보다 먼저 쓰고, `plainTurn.ts`·`villageContract.ts` 는 버들항 마을이면 **마을 계약을 건너뛴다**(12채·강변촌 굳히기 방지).
- 노출: `sessionToolExposure.ts::schemasForIntent` 가 두 마을 도구에 `check_city_form`·`check_reachability` 를 짝지어 노출한다. `TILESET_REFERENCE_WRITERS`(`tilesetReferenceTools.ts`)에 `author_beodeul_town` 포함 → 참고문서 용도를 먼저 읽어야 한다.
- 실모델 시험 `scripts/qa/beodeul-village-plain.mts`(증거 `verify-shots/assistant-beodeul-village/`): 새 프로젝트 「마을 만들어 줘」 → `author_beodeul_town` 1회 → `check_city_form`·`check_reachability` → 소품 `stamp_object`. 기존 합본 마을 프로젝트는 옛 경로 유지.
- 함정: `list_tileset_references` 에 없는 `categoryId` 를 주면 「용도를 찾을 수 없습니다」만 돌려줘 모델이 14번 반복했다 → 가능한 용도 id 를 함께 돌려주도록 수리(`unknownIdMessage`).

## 고른 장소 조각 (2026-10-01) — 변형 20곳에서 사용자가 고른 것을 공용 시트로

버들항 변형 20곳(마을·기후 마을·던전·특수 던전·필드 각 4곳, `tiledata/beodeul-variants/<장소>/`)은 데모 렌더였고 시트에 칸이 없었다.
사용자가 고르기 화면(`scripts/content/beodeul-pick/pick_server.py`, 정본 `~/.local/share/oprn/beodeul-pick/picks.sqlite`)에서 BEFORE/AFTER 를 고른 조각을 **공용 버들항 번들**에 구웠다.

| 단계 | 명령 | 결과 |
|---|---|---|
| 1. 고른 세트 설치 | `python3 scripts/content/beodeul-picks/install_picks.py [--dry]` | `tiledata/beodeul-variants/<장소>/parts/*.png`·`render-1x.png` 를 고른 판으로 바꾼다(옛 사본 지움). `picks.json`(스냅숏) + `MANIFEST.md`(항목별 판정) |
| 2. 굽기 | `python3 scripts/content/beodeul-picks/bake_picks.py [--dry]` | 시트 꼬리 칸 · 키트 `bd-pick-*` · 참고문서 용도 `beodeul-picks-*` · 그림 `public/assets/beodeul-city/references/picks/` |

판정 규칙(설치): `after` → 변형 워크트리(`~/.t3/worktrees/rpg-zzu/beodeul-var<n>`)의 현재 파일, `before` → `before/var<n>/` 사본, 안 고름 → AFTER, `redo`(둘 다 별로) → 뺀다.
`redo` 뒤 다시 그려져(파일 mtime > 고른 시각) 아직 안 고른 것도 뺀다. **var6 은 재작업 중이라 통째로 뺐다.** 2026-10-01 실측: 545항목 = after 338 · 안 고름 151 · before 45 · redo(다시 그림, 재선택 대기) 11.

### 칸·키트
- 칸: 도시 시트 0~23,935 는 그대로, **23,936~27,647**(행 187~215)이 고른 조각 칸. `BEODEUL_CITY_BASE_COUNT = 23936`(`beodeulCity.ts`) / `BASE`(`bake_picks.py`).
  514조각(같은 그림 합쳐 439종) → 3,708칸 사용, 시트 2048×3456. 같은 그림·같은 층·같은 통행 칸은 한 칸을 같이 쓴다.
- **덧붙이기 전용 등록부** `tiledata/beodeul-variants/pick-cells.json` + `pick-cells.png`: 칸마다 (그림 해시·층·우선·통행) 열쇠. 다시 돌려도 같은 열쇠는 같은 번호,
  새 조각은 뒤에 붙고 빠진 조각의 칸도 지우지 않는다 — 그 칸을 찍은 맵이 바뀌지 않게. `build-beodeul-city.py` 로 도시 시트를 다시 자르면 끝에서 `bake_picks.py` 를 자동으로 다시 돌린다
  (도시 칸 수가 23,936 이 아니면 돌리지 않는다 — 그때는 두 BASE 상수를 함께 고친다). `prepare-beodeul-city-references.py` 는 `beodeul-picks-*` 용도를 지우지 않고 보존한다.
- 조각 → 키트 `bd-pick-<장소>-<파일 이름>`(같은 그림이 여러 장소면 첫 장소 id 하나, themes·tags 에 모든 장소). 이름은 `parts.md` 설명의 앞부분(없으면 사전 대체).
  분류 `ai.themes` = village·coast·desert·mine·snow·swamp·dungeon·landmark·volcano·field·forest·mountain + 한글.
- 자리 맞춤: 물체는 **왼쪽 아래**(변형 스크립트 `img(X,Y)` = 왼쪽 아래 칸 규약), 바닥 표본은 왼쪽 위. 칸에 안 맞는 폭·높이는 투명으로 채운다.
- 층·통행(종류는 파일 이름으로 판정, `classify`):

| 종류 | 예 | 층 | 통행 |
|---|---|---|---|
| 물체 | 집·좌판·제단·등대 | 윗층(아래층 -1) | 아래 N줄 막힘(1~2칸 높이·폭 1·나무 = 1줄, 그 밖 = 높이의 절반 이상·최소 2), 위는 ★ |
| 나무 | 전나무·야자·올리브·맹그로브 | 윗층 | 밑동 1줄 막힘, 수관 ★ |
| 바닥 표본 | `ground-*`·`floor_*`·모자이크·깔개 | 불투명 = 아래층, 투명 낀 칸 = 윗층(우선 lower) | 걸음 |
| 물·용암 | `water_*`·`ground-water/hot/bog/tail`·용암 | 아래층 | 막힘. 용암 2종은 칸마다 4장면 띠(fps 4) |
| 벽·절벽·천장 | `face_*`·`ground-cliff/tcliff`·`ceiling*` | 아래층 | 막힘 |
| 걸음 구조물 | 잔교·널다리·다리·계단·나선 계단 | 불투명 = 아래층, 투명 낀 칸 = 윗층 우선 lower(사람 아래, 통행 표시 `o`) | 걸음 |
| 바닥 소품 | 헤더·고사리·들꽃·자갈·뼈·조개 | 윗층 우선 lower | 걸음 |

  우선 lower 윗층 칸은 `characterDepth.mapUpperTileDepth` 에서 `o` 로 하층 깊이에 그려진다(★ 는 사람 위). 당시 문 칸 위치는 키트에 없었다. 현재 입구가 있는 키트는 `entrances` 메타데이터를 갖고 `stamp_object`가 절대 좌표를 반환한다(2026-10-04 확인). 문 이벤트는 별도로 연결한다.

### 기존 프로젝트
`ensureBeodeulCityTileset` 은 칸 수가 23,936 이상인 도시 시트 사본(`beodeul_road_autotile` 있음)을 갈아엎지 않고 **꼬리만 덧붙인다**:
23,936번 뒤 칸 표(통행·우선·terrain·tileMeta)와 그 구간 애니메이션 띠를 번들 것으로, `bd-pick-*` 키트는 번들 것으로 바꾸거나 더하고(번들에서 빠진 것은 뺀다), 다른 키트·그룹·앞 칸은 그대로.
번들보다 꼬리가 긴(더 새 빌드가 저장한) 사본은 줄이지 않는다. 용도는 `ensureBeodeulCityReferences` 가 빠진 `beodeul-picks-*` 를 더한다(문서·그림 id 가 `bd-` 라 번들 소유).
회귀 계약 `test/beodeulPickedParts.test.ts`(이 브랜치에서는 실행하지 않았다).

### 참고문서 (조수)
용도 5 — `beodeul-picks-village`(포구·방앗간·포도원·장터) · `climate-village`(사막·광산·설원·늪) · `dungeon`(하수도·카타콤·바다 동굴·신전) · `special`(곶 등대·난파선·화산 동굴·마법사의 탑) · `field`(해안 절벽길·숲길·산길·밀밭).
각 용도: 안내 문서(작업 순서 7단계·층/통행 규칙·검사 범위·없는 소재) + 장소마다 문서(plan.md 앞부분·조각 표·키트별 역할 글자와 아래층/윗층 전체 배열) + 그림 `<장소>-map`(고른 맵 렌더 — **Python 데모 렌더, 엔진 출력 아님**, render 가 redo 면 뺀다) · `<장소>-parts`(시트 칸으로 그린 키트 판, 번호 = 표 번호).
마을 용도에만 오류 그림 `err-layer`(윗부분 칸을 아래층에 칠해 투명 부분이 검게 빈 것 / 정답). 25문서 · 41그림, 문서 17만 자, 그림 5.6MB(긴 변 ≤820px·128색, 번들 JSON 에는 경로만).
MD 사본 `tiledata/beodeul-city/references/bd-pick-doc-*.md`.
조수 안내: 시스템 프롬프트(`systemPrompt.ts` 버들항 줄)와 `author_beodeul_town` 설명에 「로마풍 도시가 아닌 장소는 `bd-pick-*` 키트를 `stamp_object` 로」를 더했다. 조수 실모델 시험은 이번에 하지 않았다.

### 화면 증거
`verify-shots/beodeul-picked-parts/`(`drive.mjs`, `report.json`): 새 프로젝트(`?blankProject=1`) — 칸 27,648 · 키트 725(고른 439) · 용도 5, 「내 구조물」 선반에서 키트 3개를 찍음.
기존 프로젝트 — 고른 조각 전 사본(23,936칸, 키트 287, 옛 키트로 그린 맵, 저자 키트 1)을 `store.loadFallbackProject`(로드 정규화)로 열면 27,648칸 · 키트 726 · 용도 5, 맵 칸과 앞 칸 통행은 그대로, 저자 키트 유지 → 키트 3개를 찍음.

### 남은 것
- var2·var4(재선택 대기 11항목)·var6(재작업 중)이 끝나면 `install_picks.py` → `bake_picks.py` 를 다시 돌린다(칸 번호는 등록부가 지킨다).
- 현재 입구 메타데이터는 `stamp_object` 결과의 `entrances`로 조회한다(2026-10-04 확인). 실내 연결은 별도 출입 이벤트가 필요하다. 큰 건물의 박공별 통행 세부와 막힘 줄 수는 크기 규칙으로 정했다(그림마다 손으로 맞춘 것이 아니다).
- 땅 표본은 오토타일이 아니다(이어 찍는 2×2·3×3 표본). 조수가 이 키트로 장소를 까는 실모델 시험은 아직 없다.

## 마을 문법 (2026-10-01 오후) — 「마을 만들어 줘」가 바둑판이 아니라 고른 변형 마을처럼

r1 시험(`verify-shots/assistant-beodeul-village/r1/fresh`)은 「마을」에 블록 격자 도시(60×59)를 깔았다. 사용자가 고른 변형 넷(포구·방앗간·포도원·장터)의 배치 문법을
`author_beodeul_town` 이 직접 짓게 했다 — `src/editor/tools/beodeulVillage.ts::buildBeodeulVillage`, `theme`: `river`(기본)·`coast`·`desert`·`snow`·`swamp`, `city` = 종전 블록 격자.

- 순서·수치 정본은 참고문서 `bd-pick-doc-village-grammar`(`tiledata/beodeul-city/references/bd-pick-doc-village-grammar.md`) — 물 앞섬 → 굽은 큰길(폭 2, 12~16칸마다 smoothstep 열쇠점, 이웃 높이 차 ≤ 거리/6, 다리 앞뒤 곧게 + `bd-bridge-arch`) → 뒷길·이음길 고리 → 큰길 남쪽 광장(판석 46칸 안팎)과 맞은편 앵커 → 길 북쪽 띠에 문이 길을 보는 집(물러앉음 0/1, 간격 1·2·마당) + 이음길 양옆 집 → 일터 덩이 → 집 옆 살림 → 밭·숲 덩이 → 큰 빈 덩이에만 덤불·풀꽃 → 한 칸 혹 정리(`analyzeCityForm` 같은 계산)·문 앞 BFS.
- 계획 격자(`occ`)와 실제 덮임(`cover`, 키트 투명 귀퉁이 제외)을 따로 든다. 길·물·광장을 모두 정한 뒤 칠하고(길 → 광장 → 물 순서 — `fill_region` 이 「벽」과 1칸 틈을 메우므로 물이 먼저면 물가에 혹이 생긴다), 그다음 찍는다.
- 집·앵커는 `appendStructurePlacement` 로 `map.structurePlacements` 에 남긴다 → `check_city_form` 이 키트 `parts.entrance` 로 문 앞을 알고 막다른 길로 세지 않는다. 고른 조각 건물 67종의 문 칸은 `scripts/content/beodeul-picks/find_pick_doors.py`(그림 맨 아래 띠에서 벽 색과 가장 다른 칸, 신호가 약한 통나무 벽은 가운데) → `tiledata/beodeul-variants/pick-doors.json` → 번들 키트 `parts`. `bake_picks.py` 가 다시 구울 때 붙인다.
- 고른 조각 바닥 표본 중 `ground-road/path` 는 태그 `road`, `ground-plaza/deck` 는 `plaza`(floor 유지) — 기후 마을의 길·광장을 도시 형태 자와 빈 바닥 지표(`beodeul-metrics.ts::emptinessOf`, 태그로도 「지은 칸」)가 읽는다.
- `cityForm.ts` 운하 판정: 축 길이 60% 미만만 걸치는 물(바닷가 띠·연못)은 운하로 보지 않는다(포구·사막에 「운하가 곧다」 거짓 경고가 났다).
- 시작 맵(`beodeulStarterMap.ts`)은 블록 격자의 columns/bands 를 쓰므로 `theme:"city"` 를 명시한다.
- 조수: 노트(`beodeulTownRoute.ts`)·시스템 프롬프트가 말에서 theme 을 고르게 하고, 36×30 보다 작은 빈 시작 맵(새 프로젝트 20×15)이면 mapId 대신 새 맵을 만들게 한다.
- 참고문서 `read_tileset_reference`·`list_tileset_references` 는 빈 문자열 id 를 없는 것으로 본다(엄격 스키마 모델이 `imageId:""` 를 채워 보내 12번 실패하고 멈췄다).

검증(LLM 없음): `bun scripts/qa/beodeul-village-offline.mts [--2x] [theme:seed[:WxH] …]` → `verify-shots/assistant-beodeul-village/offline-village/`.
5 theme × seed 3·11·29 + 88×56: 문 앞 도달 전부, `check_city_form` 경고 0, 20×15 화면 빈 바닥 최대 river 0.33·coast 0.33·swamp 0.37·desert 0.46·snow 0.60(얼음 못이 걸음 바닥으로 세어짐).
실모델(`scripts/qa/beodeul-village-plain.mts --round r2`, opencodex/gpt-6-astra, 「버들항 느낌으로 강가 마을 하나 만들어 줘」): `author_beodeul_town` theme river 88×56 1회 → `check_city_form` 이상 없음 → 도달 전부. 증거 `verify-shots/assistant-beodeul-village/r2/`(attempt1 = 빈 id 실패, attempt2 = 곧은 길 경고 2건 → 수리 전).

남은 약점:
- 집은 늘 길의 북쪽에만 선다(문이 남쪽). 큰 맵(88×56)은 남쪽 3분의 1이 밭·숲으로 남는다 — 뒷길을 한 줄 더 내는 일은 하지 않았다.
- 늪 집은 기둥 위가 아니라 진흙 섬에 선다. 설원은 얼음 못 화면이 빈 바닥 40% 를 넘는다. 바닥 표본은 오토타일이 아니라 경계가 칸 단위로 각지다.
- 조수는 문법 문서를 읽지 않고 도구를 바로 불렀다(도구가 문법을 지니므로 결과는 같다). 마을 이름·NPC·출입구 이벤트는 짓지 않는다.
- 버들항 던전·필드 문법 도구는 없다(던전은 참고문서 beodeul-picks-dungeon 을 읽고 키트를 찍는다, 필드 길은 `author_wild_route` 의 버들항 시공).

## 작은 마을 길·마당 구도 보정 (2026-10-04)

`naturalize_beodeul_hamlet({mapId})`는 공용 소규모 집 3~5채의 전체 배열/원점을 먼저 확인하고 원본 집·나무·출입을 보존한 채 큰길/광장과 흙 접근로/마당을 구분한다. 옛 순환 포석 샛길과 흩어진 작은 풀 장식은 정리한다. 텃밭·빨래 마당·식생 군락은 빈 칸과 문 앞 도달성을 확인하고 배치한다. 임의 배치 마을/높이 있는 맵에는 사용하지 않는다. 새 houseCount 시공은 이 구도 후 일광을 자동 적용한다. 공용 source beodeul_ground 368칸(기존304 불변), 문서 tiledata/beodeul-ground/HAMLET.md, 정상/오류 및 full 네 층 예제는 참고문서 beodeul-ground-dressing. SQLite와 플레이어 근거 verify-shots/beodeul-lived-village.


## 우물 공동마당으로 원본 마을 재배치 (2026-10-04)

`compose_beodeul_courtyard_village({mapId})`는 인식된 54×30 예제의 원본 민가 5채+교회를 그대로 옮겨 54×34 공동마당 마을로 만든다. 북쪽 세 집은 우물·빨래 마당을 공유하고 남쪽 두 집은 숲/텃밭 가장자리에 둔다. 교회 길과 외곽 숲 입구를 연결한다. 이벤트/높이/다른 맵의 전이 도착점이 없는 예제만 허용하며 기존 배치 변경을 명시적으로 요청했을 때 사용한다. 단순 꾸밈에는 사용하지 않는다. 원본 건물 전체 배열, 시작점(18,17), 다른 두 출입 시험 맵을 보존. 공유 참고문서 COURTYARD.md + courtyard-example.json 전체 네 층/graft 규칙 + 실제 PNG를 새/기존 city·ground 양쪽에 배포한다. 재생성은 scripts/content/prepare-beodeul-courtyard-references.mts, 근거 verify-shots/beodeul-shared-village. 이 도구는 출입 이벤트를 새로 만들지 않는다.


## 공동마당 식생·울타리/돌벽 보정 (2026-10-04)

refine_beodeul_courtyard_vegetation({mapId})는 인식된 54×34 예제의 건물/나무 전체 배열을 확인하고 집·길·마당·시작점을 유지하며 흩어진 나무/덤불을 수관이 앞뒤로 겹친 공용 숲 8덩어리로 교체한다. 높이 있는 풀은 숲 밑동에만 겹치고 줄기의 X를 상속하는 ★다. 짧은 문틈 울타리 두 조각을 제거하고 실제 텃밭 3변을 연속 레일/수직선/모서리로 연결한다. 북쪽은 큰길에서 들어오는 면이다. stone 박공은 정면 돌벽과 같은 원본 질감으로 통일한다. 원본 지붕/알파/창문/문 개수/집 위치를 유지한다. 이벤트/높이/다른 이벤트의 전이 도착점/수정된 나무·별도 지형/기물은 거부, 반복은 no-op. source WOODLAND.md, build 하네스가 이전368칸을 보존한다. 공용 문서/정확한 4층 예제/전체 graft 규칙은 새·기존 city/ground 모두 배포하며 각 MD 12만자 이하로 분리한다. 전용 player.html과 SQLite 재로드 근거 verify-shots/beodeul-depth-fix.

## 기와 복원 · stone 박공 벽/중앙 창 (2026-10-04 사용자 정정)

revision 16 기와 변경은 사용자 지적을 오해한 것이며 철회했다. 민가 5종/성당의 기와를 원본 픽셀로 복원했다. stone 지붕 아래 삼각형 벽의 일부 회벽 색만 덮던 보정 때문에 기존 목재 기둥/사각창이 남아 새 창과 겹쳤다. gable.py는 전체 박공 벽과 계단형 가장자리만 같은 돌 질감으로 채우고 원형창 하나를 중앙 (31,53)에 둔다. 원래 지붕/문/하단 벽/위치/통행/맵은 유지한다. 원본 기와 픽셀 대조, revision 15 대비 stone 박공 밖 픽셀 불변, 공용 참고문서와 새/기존 프로젝트, 실제 저장·재로드/화면은 verify-shots/beodeul-gable-fix.


## 물굽이 조밀한 마을 표본 (2026-10-04)

사용자가 제공한 구도 그림을 큰길/골목/공유 마당/물길로 나뉜 구역 관계로 옮겼다. 새 맵 `map_beodeul_river_town`(버들 물굽이 마을, 76×70)에 민가/회관/주막/대장간/교회 41동과 원본 아치 다리 3개를 배치한다. `scripts/content/lib/beodeul-river-town.mts::buildBeodeulRiverTown`은 물 예약, 원본 전체 건물, 길과 접근로, named 물 오토타일, 전체 다리, 숲/기물, 공용 기초/접점 그림자 순서로 만든다. 원본 기와와 이전 stone 박공 보정을 사용한다. 기존 맵은 바꾸지 않는다. 출입 이벤트/실내/NPC는 이 외장 표본에 포함하지 않는다.

공용 학습 정본 `tiledata/beodeul-ground/RIVER-TOWN.md`, `river-town-example.json`, 전체 네 층 배열/사용 키트/전체 source graft 규칙/실제 정상·갑판 누락 오류 그림을 `prepare-beodeul-river-town-references.mts`가 번들 `beodeulGroundReferences.json`에 넣는다. 기본 ground 참고문서 생성기도 fragment를 보존한다. 새/기존 city·ground 모두 같은 지침을 받는다. 저장은 `scripts/qa/beodeul-river-town-proof.mts`가 기존 맵 불변·41개 실제 문앞/6개 다리 둑의 저작된 길만 사용하는 canMove를 확인한 뒤 SQLite 저장 후 별도 프로세스 `scripts/qa/beodeul-river-town-reload.mts`에서 재로드해 새·기존 맵 전체 층/이벤트와 공용 참고문서를 대조한다(저장 캐시와 재로드 snapshot을 동시에 보유하지 않는다). 전용 player.html은 세 다리를 지나 회관·교회·공방과 우물 복귀를 확인한다. 근거 `verify-shots/beodeul-river-town/`.

## 색 역할 정리 · 따뜻한 황록 확정 (2026-10-05)

사용자는 집 옆에서 형태/뿌리/그림자를 고정한 색상만의 비교 중 warm(따뜻한 황록)을 선택했다. `tiledata/beodeul-ground/PALETTE-STANDARD.md`, `palette-standard/standard.json`은 나뭇잎의 전체 RGBA 치환표와 기존 밝은 잔디737/기와·목재/건물별 벽 역할을 묶는다. 일부 대표색은 실제 픽셀 분포의 표본이며 모든 그림을 세 색으로 줄이는 제한이 아니다. 기존 기와·윤곽·3/4 시점은 원본 기준이다. 현재는 확정 색과 조수 지침 등록이며 게임 아틀라스 자체를 바꾸는 단계는 아니다.

`prepare-beodeul-palette-standard.mjs`가 공용 source 전체/색 사전/정상·palette-scope-leak 실제 변조를 `beodeulGroundReferences.json`으로 배포한다. 기본 참고문서 재생성도 fragment를 보존한다. 새 city/ground와 기존 프로젝트 두 타일셋을 확인하며 정본 저장/별도 재로드 근거는 `verify-shots/beodeul-palette-standard/`. 맵/출입/시작점/통행은 유지한다. 후속 그림 보정은 tree body 영역만 정확한 사전으로 치환하고 공용 아틀라스와 생성 코드·조립/통행 검수·정본 저장을 함께 수행해야 한다.

## 황록 마을 50×50 · 실제 선택 색 적용 (2026-10-05)

`buildBeodeulVillage50` (`scripts/content/lib/beodeul-village50.mts`)는 별도 맵 `map_beodeul_village50`에 민가·회관·주막·대장간·교회 18동, 두 아치 다리, 우물 마당과 공유 흙마당을 저작한다. 기존 기와·윤곽·stone 박공을 그대로 조립한다. 포석 길은 교회 앞에서 굽어 남쪽 다리로 이어지고, 좁은 접근로가 실제 문 앞을 연결한다. 나무 수관은 일부 길 위로 드리울 수 있지만 밑동의 blockingCells는 길·문 앞 여유를 막지 않는다. 전체 나무·그림자가 지도 안에 들어올 때만 배치한다.

선택한 warm 나무를 공용 `beodeul_warm_trees` / `tex_beodeul_warm_trees` (16px·8열·328칸)로 배포했다. `build-beodeul-warm-trees.py`는 색 비교 시안과 정확히 같은 3종 본체 및 기존 숲 4종의 RGBA 치환표를 패킹한다. 알파·줄기·뿌리·숲 겹침·그림자·원본 잔디/건물 시트는 보존한다. `bundled.ts`·공통 기하·`defaultAssets.ts`가 새/기존 프로젝트에 등록하며 참고문서 owner는 `beodeul_city`다.

학습 정본 `tiledata/beodeul-ground/VILLAGE50.md`, `village50-example.json`, `warm-trees-catalog.json`; `prepare-beodeul-village50-references.mts`가 전체 네 층·사용 키트·모든 graft 통행/우선순위·정상/갑판 누락 오류 그림을 공용 city/ground 참고문서에 넣는다. 기본 참고문서 재생성도 fragment를 보존한다. 저장 시 참고문서만 병합하며 일반 ground ensure의 우선순위 갱신을 별도로 호출하지 않는다. 모든 기존 맵을 대조하고 18개 문 앞·네 다리 둑까지 저작된 길만 쓰는 canMove 경로를 확인한다. SQLite 저장·별도 재로드, 전용 player.html 도보 검수, 실제 그림 근거는 `verify-shots/beodeul-village50/`. 이 맵은 외장/길 표본이며 새 실내·전이 이벤트는 포함하지 않는다.

### 포석길 끊김 정정 (2026-10-05)

남쪽 포석길의 스케치가 (15,41)의 민가와 겹쳐 지워졌다. 기존 검사는 교회에서 북쪽 다리를 돌아 남쪽 다리로 갈 수 있어 통과했으며 남쪽 포석길 자체의 단절을 놓쳤다. `repairBeodeulVillage50Roads`는 교회 앞 (9,44)→남쪽 다리 서쪽 (22,37)을 y≥37의 건물 전체 영역을 피하는 실제 자유 지면 경로로 잇고, **포석만 사용하는 canMove**로 다시 확인한다. 실제 기존 맵 보정은 1층 지면만 변경하고 건물·나무·소품·그림자·이벤트를 대조한다. 흙/포석/다리 갑판은 같은 road union으로 N/E/S/W 마스크를 계산해 재료 접점의 잔디 틈도 제거한다. 공용 예제/전체 배열/정확한 수정 좌표와 재로드·실제 도보 근거를 함께 갱신한다 (`verify-shots/beodeul-village50-road-fix/`).

## RPG 시설과 생활 역할 (2026-10-05)

`src/assets/beodeulFacilitiesPlans.ts`의 32개 시설 조립안을 `beodeulFacilities.ts`가 `bd-facility-*` 구조물 키트로 합성한다. 여관/주막/장비점/약초·연금/예배당/길드/치안/회관/은행/마구간/나루/창고/생산/학자·특별한 민가를 포함한다. 기존 승인 건물을 전체 배열로 복사하고 작업 마당 소품을 조립하며 기와·벽·윤곽 픽셀을 재저작하지 않는다. 같은 원본 건물을 사용하는 역할이 있다. `createBeodeulCityTileset`와 `ensureBundledTilesets`의 기존 city 경로에 배선하여 새/기존 프로젝트 모두 키트를 받는다. 건물 보정 시트는 `translateTiles`로 기존 graft를 재사용하며 source 통행·우선순위를 유지한다. 반복 적용은 no-op이다.

공용 참고문서 owner는 city의 `beodeul-facilities`. 정본 `tiledata/beodeul-facilities/`와 준비기 `scripts/content/prepare-beodeul-facilities-references.mts`, 번들 `src/assets/beodeulFacilitiesReferences.json`, 정적 그림 `public/assets/beodeul-facilities/`다. 문서 17쪽에 32개 완전한 source 키트/입구/실제 통행표·네 층 표본·전체 마을 네 층·source 이식표를 제공한다. 그림은 실제 엔진 조립 8개 도안 판/마을/blocked-facility-entrance 변조를 담는다. 원본 그림을 새로 그린 시설이나 판매/회복/은행/의뢰 시스템으로 설명하지 않는다. 실내와 시설 기능은 별도 저작이다.

`dressBeodeulVillageFacilities`는 저장된 50×50의 기존 18동을 유지하고 약초사 집(3,6), 발명가 집(42,7), 술집(28,20), 항구 창고(14,30), 나루터 사무소(28,39)를 기물과 작업 마당으로 구분한다. 나루터 널판 3×3은 (25,46)에 놓아 물가 경계칸까지 실제로 덮는다. (28,47) 육지→(27,47)→(26,47) 잔교가 canMove로 이어져야 한다. 건물·나무·기존 소품/그림자/이벤트, 이전 네 맵과 기존 칸 통행을 대조한다. 모든 18개 문 앞/다리 둑, 남쪽 포석만의 연결, 다섯 시설/잔교 실제 player.html 도보와 SQLite API 저장·별도 프로세스 재로드 근거는 `verify-shots/beodeul-facilities/`에 남긴다.

## 서로 다른 건축 구조의 강변 마을 (2026-10-05 초안 기록 · 4종 반려)

소품 교체 32종에서 실제 몸체/지붕 6계열로 확장했다. `beodeul_forms`(tex_beodeul_forms, 16px/16열/544칸)는 가로 긴 민가·좁은 2층·ㄱ자 별채·현관/다락창 여관·낮은 작업장/굴뚝 대장간·하역 차양 창고를 보유한다. 원본 city/기존 보정 건물은 보존한다. `beodeul-architecture build|validate|review`의 forms.py가 조립/검사/검수 판을 담당한다.

공용 배선은 bundled.ts/geometry/defaultAssets/createBeodeulCityTileset/ensureBundledTilesets와 `beodeulForms.ts`다. source 본체6/그림자6/기초6 도장을 city에 translateTiles로 이식하며 새·기존 프로젝트 양쪽에서 참고문서 `beodeul-forms`를 갖는다. 그림자2층→본체3층→기초4층을 같은 원점에 놓고 각각의 벽 접점을 따른다. 기초/그림자의 통행 ★가 벽 X를 덮지 않는다. 길1층은 별도로 연결한다. 조수는 같은 실루엣3개를 나란히 놓지 않고 폭/높이/용마루/별채가 다른 몸체를 조합한다.

새 지도 `map_beodeul_forms_village`는 50×50/16동/아치 다리2개다. 이전 다섯 지도와 기존 사용 칸의 통행을 보존한다. 전체16개 문앞과 다리 둑까지 실제 canMove 도로 경로를 확인한다. 여관 입구(35,13)를 anvil로 막은 실제 변조는 true→false로 검출한다. 50×50 재현 `scripts/content/lib/beodeul-forms-village.mts`, 자료 준비 `prepare-beodeul-forms-references.mts`, 정본 API 저장·별도 프로세스 재로드·전용 player.html 화면 `verify-shots/beodeul-forms/`. 외장 저작이며 실내/거래/문 전이 이벤트를 추가한 것은 아니다.
