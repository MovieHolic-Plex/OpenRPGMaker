# 에디터 「공방」 — 생성기 넷(char-gen·object-gen·tile-gen·item-gen)을 에디터에서 쓴다

- 들어오는 길: 왼쪽 활동 막대 렌치 「공방」(`src/editor/panels/leftWorkshopPane.ts`).
- **2026-10-21 개편(사용자 결정):** 하네스 목록 카드(「실내 가구·소품 그리기」·「맵 소품 그리기」, 매니페스트 summary·모델 권장 문구)를 뺐다.
  첫 화면은 생성기 카드 넷이다 — 정의·상태는 `src/editor/workshop/generators.ts`. 화면 글은 쉬운 말만, 모델 이름 금지.

| 카드 | 생성기 | 상태 | 하는 일 |
|---|---|---|---|
| 캐릭터 | char-gen (공개, `MovieHolic-Plex/char-gen`) | 내 컴퓨터에서 만들어 가져오기 | 파이썬 도구라 브라우저에서 못 돈다. 「만드는 법·가져오기」(`genWorkspace.ts`)가 ① 무엇·몇 명 → 사용자 AI 에이전트에 붙여 넣을 부탁 글(언어별, `charGenRequest`) ② `char-gen pack` 폴더 가져오기 → 미리 보기 → 이 프로젝트에 넣기 |
| 물건·가구 | object-gen | 여기서 만들기 | 「만들기」= 아래 공방 실행기(사용자 자기 AI 계정). 넣을 곳 전환: 실내 가구(`interior-props`, 손 도트 실내 칩셋) · 지금 맵 칩셋(`map-objects`). 「만든 묶음 가져오기」= object-gen `pack` 폴더 가져오기 |
| 타일 조각 | tile-gen (비공개, `MovieHolic-Plex/tile-gen`) | 내 컴퓨터에서 만들어 가져오기 | 이름과 달리 칸 타일(바닥·벽)이 아니라 사용자 타일셋 색에 맞춘 맵 조각(우물·노점 같은 물체)을 그린다. 사람이 로컬 페이지에서 고르고 `tile-gen pack`. 화면: ① 무엇·크기 + 「지금 맵 칩셋 그림 받기」(`WorkshopEnv.tilesetSource` 바탕 시트 PNG — tile-gen 이 색을 잠글 파일) → 부탁 글(`tileGenRequest`) ② 묶음 가져오기 |
| 아이템·아이콘 | item-gen | 준비 중 | 저장소가 없다(2026-10-21 조직·홈 확인). `scripts/asset-gen/generate.mjs`(agy CLI, 사람 고르기 없음)만 있어 가짜로 채우지 않았다 |

- AI 미연결: 물건 카드에 「AI 연결하기」. 호스트가 AI 를 껐으면 안내 글만(죽은 버튼 없음). 묶음 가져오기는 AI 없이 된다.
- **묶음 가져오기**(`src/editor/workshop/genPackImport.ts`): `<input webkitdirectory>` 로 `oprn-store-pack/1` 폴더(manifest.json + blobs/<sha256>)를 고른다.
  `validateManifest` · blob 은 sha256 을 다시 재서 이름과 맞는 것만 · 스토어 넣기와 같은 `prepareManifestItem`(storeApply.ts 에서 떼어 냄) + `applyPreparedStoreItem`.
  slug 는 `local-<생성기>-<blob 해시 12>`(같은 묶음을 다시 넣으면 덮어쓴다), 출처 `store = local:<생성기>`. 되돌리기 한 번으로 뺀다. 크레딧(CC BY 바탕 등)은 출처에 남는다.
- **공용 출구는 막는다:** `storePublishBlockReason` 이 `workshop_` 그림(3/4 관문 영수증이 아직 공방에 배선되지 않음)과 `local:` 출처 묶음을 스토어 올리기에서 막는다.
  공용에 올리는 길은 생성기 자신의 검사·submit(3/4 관문 포함)이다. 공방 그림은 이 프로젝트에만 들어간다(판 화면 「공용에 올리려면 3/4 시점 검사…」 안내).
- 물건 화면(`workshopWorkspace.ts`): 목록은 내가 만든 물건 + 판·고른 것이 남은 번들 기물(옛 다시 그리기 기록)만. 손대지 않은 번들 기물 목록은 뺐다 — 저장소(`oprn-workshop`)는 그대로라 옛 판·고른 것은 계속 열린다.
  목록이 비면 폼부터 연다. 폼(`workshopItemForm.ts`) = 무엇 · 어떻게 생겼나 · 가로/세로 칸 · 놓는 방식 · 후보 수(1~3, `engine.startRound({count})`) → 「만들기」가 저장하고 바로 판을 시작한다.
  분류·쓰임·닮은 기물·솟는 px 칸은 화면에서 뺐다(기본값: 솟는 높이 세우는 것 16px · 거는 것·무늬 0).
- 「없는 타일」 카드 「직접 그려 줘」는 그대로 `openWorkshop(harnessId, { newItem })` 로 이 폼을 채워 연다.
- 그림 생성은 전부 사용자 계정: 편집기 안은 조수와 같은 엔드포인트(`chat.ts`), char-gen·tile-gen·object-gen 은 사용자 컴퓨터의 CLI 로그인. 우리 키·스토어 크레딧·유료 대체 경로 없음.
- 남은 일: 데스크톱(Electron)에서 char-gen·tile-gen·object-gen 을 직접 띄우기(지금은 부탁 글 + 묶음 가져오기), item-gen 실체, 칸 타일(바닥·벽) 생성기, 공방 굽기에 3/4 관문 영수증 배선.

## 공방 실행기(물건·가구 카드 안)

- 실행기: `src/harnesses/_core/workshop/engine.ts`. 한 판 = 후보 3장(방향 앞에서부터 3개, 2026-10-07 에 5장→3장). 한 장 = 그리기 → 깨지면 고치기 ≤2 → (실행기가 `selfCheckMessage` 를 주면 자기 점검 1 — 실내 기물은 2026-10-07 에 뺐다, 「너무 오래 걸린다」) → 독립 검수(vision) → `runner.gate` → 불통과면 다시(시도 ≤3). 3번 다 불통과여도 사람이 볼 수 있게 「검수 불통과」로 남긴다. 동시 기본 3(1~6, `oprn:workshop-concurrency`), 429 면 하나 줄이고 기다린다, 401·403 이면 멈추고 AI 설정으로 안내.
- 모델: 표면 `workshop-draw`(AI 설정 「도트 저작 모델」(`pixelModel`)이 저장돼 있으면 그 텍스트 모델, 없으면 옛 그대로 감독 티어 — 2026-10-16, 16384 토큰) · `workshop-review`(vision 역할, 4096). `src/ai/assistantEndpoint.ts` 표 한 줄씩. 사용자 자기 계정·조수와 같은 엔드포인트. 권장 모델은 이름을 박지 않고 「성능이 높은 AI 모델일수록 결과가 좋아요」 한 줄로만 화면에 표시한다(`WORKSHOP_MODEL_ADVICE`, 2026-10-21 UX 2차 F30). 왼쪽 공방 창(`leftWorkshopPane.ts`)은 매니페스트의 문서용 title/summary 를 건드리지 않고 `WORKSHOP_DISPLAY` 로 쉬운 말 제목·요약을 덮어 보여 주고, 목록 위에 AI 연결 안내 블록(`left-workshop-no-ai`, 「AI 연결하기」 버튼)을 둔다. 서버가 AI 를 껐으면(`hostAiDisabled`) 버튼 없이 관리자에게 요청하라는 문구만 보인다. `AI_CONNECTION_STATUS_CHANGED_EVENT` 로 다시 그린다.
- 속도(2026-10-07, 실제 Claude Sonnet 5.5·옷장·동시 3): 옛 설정(5장·자기 점검) 한 판 6.8분·호출 35번 → 3장·자기 점검 뺌 4.9분·15번 → 아래 헛걸음 셋을 고친 뒤 1.8분·8번(두 번 재서 112초·108초, 고치기 호출 0). 호출 하나가 30~60초라 시간은 호출 수가 정한다. 잰 스크립트는 저장소에 없다 — 엔진+실행기를 esbuild 로 묶어 node 에서 프록시(`ANTHROPIC_BASE_URL`)로 부르고 `onChange` 로 판을 받는다.
  - 헛걸음 1 귀퉁이 검사: 「칠한 귀퉁이 ≥2 = 배경」이 번들 91종(옷장 포함)을 틀리게 막았다 → 지금 그림에서 비어 있던 귀퉁이가 칠해졌을 때만(새 기물은 네 귀퉁이 다).
  - 헛걸음 2 줄 폭: 모델이 16칸 줄을 17칸으로 세고, 고치려고 JSON 안에 `"…"[0:16]`·`.replace(…)`·`"A" if False else "B"` 를 남긴다 → `repairStringExpressions` 가 값으로 풀고, 그래도 폭이 틀린 줄이 8개 이하면 그 줄만 `{"rows":{"7":"…"}}` 로 다시 받는다(`rowsNeedingFix`·`applyRowFix`).
  - 헛걸음 3 키릴 「о」: 라틴과 똑같이 생긴 글자는 legend 의 라틴 글자로 읽는다(`LOOKALIKE`).
- 답 형식: 팔레트 키 격자 JSON `{"legend":{"a":"wood:6"},"rows":[…],"note","topRows"}`(`grid.ts`). pxg 아님.
- 저장: 이 기기 IndexedDB `oprn-workshop`(`store.ts`), 범위 키 = `conversationScopeKey`. 그림은 저장하지 않고 격자만. 문서·내보내기와 무관. 정본에 들어가는 것은 아래 「칩셋에 굽기」 결과뿐.
- 새 하네스 입주: 하네스 폴더에 `editor/runner.ts`(`WorkshopRunner`) + 매니페스트에 `workshop: () => import("./editor/runner").then(…)` + `editorUi: true`. 화면 머리 이름은 `runner.label`. 둘째 하네스 `map-objects`(맵 기물, 2026-10-07)가 들어왔다 — 새 기물 폼은 `session.harnessId` 로 갈린다. 실행기가 프로젝트 칩셋을 봐야 하면 `WorkshopEnv.tilesetSource` 를 쓴다(하네스는 프로젝트를 모른다). `openwiki/harnesses/map-objects.md`.
- QA: `BASE=http://127.0.0.1:<포트> node scripts/qa/workshop-capture.mjs` — dev 빌드의 `window.__oprnWorkshopChat` 가짜 채팅으로 모델 없이 찍는다. 결과 `verify-shots/workshop/`. 이 기기에서는 크로미움이 `net::ERR_NETWORK_CHANGED` 로 백지가 될 수 있다 — dev 서버와 스크립트를 `unshare -rn` 안에서 `ip link set lo up` 한 뒤 함께 띄운다(콜드 부팅 60~70초).
- 설계·계획: `docs/superpowers/specs/2026-10-02-workshop-editor-design.md`, `docs/superpowers/plans/2026-10-02-workshop-editor.md`.

## 칩셋에 굽기 (2단계, 2026-10-07)

- 들어오는 길: 판 화면에서 후보를 고르면 머리 아래에 「고른 X 를 프로젝트 칩셋에 넣기」(`workshopRoundView.ts` → `src/editor/workshop/workshopBake.ts`). 되돌리기 한 번으로 뺀다(`recordProjectSnapshot`).
- 굽기(`src/project/workshopTiles.ts`): 격자를 16px 칸으로 잘라 빈 칸을 빼고 30칸 폭 시트 PNG 한 장 → 업로드 자산 `workshop_<해시>` → 손 도트 실내 칩셋 `atlas_biome_interior` 의 `tileGrafts` 로 번들 칸 뒤(행 맞춤)에 덧붙인다. 생성 건물 시트(`installGeneratedBuildingSheet`)와 같은 방식이고, 번들 칸 번호는 하나도 안 바뀐다.
- 통행·층: floor·wall 은 발밑 줄(`footRows`, 새 기물은 「세로 칸(발밑)」) 막힘 + 그 위 솟은 줄 ★, hang 은 모두 ★, flat 은 밟음·아래 그리기. 번들 가구 칸과 같은 규칙이다.
- 물체: 구조 킷 `learnedFrom: "workshop"`, id `workshop:<기물 key>`(새 기물은 `new:` 를 뺀 이름). 종류·발밑·솟음·격자 해시·쓰임·사람 선택은 **설명서 `kit.spec`(ObjectSpec v1, `openwiki/object-spec.md`)** 에 쓴다(2026-10-20). 옛 저장본의 `hand:`·`foot:`·`rise:`·`grid:`·`use:` 태그는 읽는 쪽이 대신 읽고 불러올 때 설명서로 옮긴다. 같은 격자를 다시 넣으면 아무것도 안 늘고, 다른 후보를 넣으면 킷만 새 칸을 가리킨다(옛 칸은 남아 이미 놓인 맵은 옛 그림 그대로).
- 조수가 쓰는 길: `list_tileset_objects`·`stamp_tileset_object`(팩 물체와 함께 나온다) · `list_hand_interior_parts`·`build_hand_interior_room`(`workshopHandObjects` 가 손 도트 사양 꼴로 섞는다, 분류 `workshop`).
- **번호 이주:** 번들 시트를 새로 구우면 칸이 끝에 덧붙어 공방 칸과 겹칠 수 있다. `ensureAtlasBiomeInteriorCurrent` 가 정의를 새로 고치기 전에 공방 칸·킷을 떼어 두고(`detachWorkshopTiles`, 행 맞춤 빈 칸은 이름표 「공방 칸 자리」로 알아본다) 새 번들 끝 뒤에 다시 붙인다(`attachWorkshopTiles`). 번호가 바뀌면 그 칩셋을 쓰는 맵의 네 층과 킷을 함께 고쳐 쓴다. 평소 불러오기에서는 떼었다 붙여도 번호가 같아 바뀌는 것이 없다.
- 조수 카드와 잇기: 「없는 타일」 카드의 「직접 그려 줘」가 `currentDrawTarget()` 으로 공방을 고른다 — 손 도트 실내 맵은 `interior-props`, 그 밖의 16px 맵은 `map-objects`(그 맵 칩셋에 굽는다, `workshopTargetTileset`). `openWorkshop(harnessId, { newItem })` 로 새 기물 폼을 채워 열고, 굽기가 내는 `oprn:workshop-baked`(`workshopEvents.ts`)를 한 번 듣고 후속 요청을 보낸다 — `openwiki/asset-store.md` 「조수와 스토어」.
- QA(2026-10-07, netns·가짜 채팅): 카드 → 폼 채움 → 후보 5장 → B 고름 → 넣기 → 칩셋 6557→6580(이식 4칸, 킷 2×2) · 후속 요청 문장 · `stamp_tileset_object`·`build_hand_interior_room` 이 새 id 로 성공 · 맵에 그림이 그려짐. 번호 이주는 node 스크립트로 확인(옛 정의에 구운 칸 6530 → 새로 고친 뒤 6578, 맵 칸도 따라 바뀜).
