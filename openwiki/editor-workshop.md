# 에디터 「공방」 — 생성기 넷(object-gen·char-gen·tile-gen·item-gen)을 에디터에서 쓴다

- 들어오는 길: 왼쪽 활동 막대 렌치 「공방」(`src/editor/panels/leftWorkshopPane.ts`).
- **2026-10-21 개편(사용자 결정):** 하네스 목록 카드(「실내 가구·소품 그리기」·「맵 소품 그리기」, 매니페스트 summary·모델 권장 문구)를 뺐다.
  첫 화면은 생성기 카드다 — 정의·상태·견본은 `src/editor/workshop/generators.ts`. 화면 글은 쉬운 말만, 모델 이름 금지.
- **같은 날 2차(「허접하다」 지적 → 상용 수준 재디자인, PR workshop-gens-2):** 쓸 수 있는 카드(물건·캐릭터)는 위에 크게 —
  **실제 견본 도트 띠**(원래 크기 PNG 124×58 를 2배 정수 배율, 견본 바탕 #181b22) + 제목·상태 + 한 줄 소개 + **주 단추 하나**(보조는 글자 단추).
  곧 들어올 카드(아이템)는 「곧 들어올 생성기」 아래 작게, 단추 없음. 견본이 없는 생성기는 그림 띠 대신 「견본은 첫 결과가 나오면 올라와요」 빈 띠를 쓴다. 지형(tile-gen) 카드는 견본을 비워 둔다 — 한때 실었던 풀밭 견본(tile-gen 첫 세션)은 겨냥한 beodeul_city 의 땅·나무·길·물 칸이 EasyRPG 계열이라 그 화풍 흉내가 되어 tile-gen 쪽이 거둬들였고 카드에서도 뺐다(2026-10-21). jp_city·코드 도트 버들항 키트를 겨냥한 결과가 독립 검수를 통과하면 그때 싣는다(카드 띠 모서리 표 `sample.caption` 은 그때 「견본 출력」 등으로 쓴다). 색·간격·모서리는 편집기 토큰(`--accent`·`--success-muted`·`--radius-m` …)만 쓴다.
  견본 출처: object-gen 저장소 `docs/images/hero.png` 에서 고른 기물 3개(같은 조직 1차 그림) · char-gen 저장소 자체 더미 칩 `examples/bases/dummy_a/b` 와 그 편집 결과
  (`public/assets/workshop/*-sample.png`). char-gen 갤러리 그림은 Scarloxy(제3자) 바탕이라 쓰지 않았다.

| 카드 | 생성기 | 상태 | 하는 일 |
|---|---|---|---|
| 물건·가구 | object-gen | 여기서 바로 | 「새 물건 그리기」= 아래 공방 실행기(사용자 자기 AI 계정). 넣을 곳 전환: 실내 가구(`interior-props`, 손 도트 실내 칩셋) · 지금 맵 칩셋(`map-objects`). 「만든 묶음 가져오기」= object-gen `pack` 폴더 가져오기 |
| 캐릭터 | char-gen (공개, `MovieHolic-Plex/char-gen`) | 내 컴퓨터에서 | 파이썬 도구라 브라우저에서 못 돈다. 「부탁하고 가져오기」(`genWorkspace.ts`)가 ① 무엇·몇 명 → 사용자 AI 에이전트에 붙여 넣을 부탁 글(언어별, `charGenRequest`) ② `char-gen pack` 폴더 가져오기 → 미리 보기 → 이 게임에 넣기 |
| 지형·바닥 | tile-gen (비공개, `MovieHolic-Plex/tile-gen`) | 내 컴퓨터에서 | **지형 생성기**(2026-10-21 다시 만듦): 이음매 없는 바닥 채우기, 47칸 자동 타일 가장자리(풀↔흙·길·카펫), 물가·움직이는 물, 숲 덩어리, 절벽·단. 물건·기물·건물은 object-gen 만 — tile-gen 을 물건 생성기로 소개하지 않는다(`tile-gen new --mode prop` 은 거절하고 object-gen 을 가리킨다). 화면: ① 종류(`TERRAIN_MODES`: floor·autotile·water·forest·cliff) 또는 재질 프리셋(`TERRAIN_PRESETS`: lava·swamp·poison·deep_water·beach = 물 계열, snow·ice·sand·road·cobble·meadow = 자동 타일 계열 — CLI `--mode <프리셋>`, tile-gen PR #3)·어떤 지형·참고 칸 `x,y`(선택) + 「지금 맵 칩셋 그림 받기」 → 부탁 글(`tileGenRequest`: `tile-gen auto` → 로컬 `tile-gen pick` → `tile-gen pack`) ② 묶음 가져오기. 묶음 = `oprn-store-pack/1` tileset 하나 + `autotileGroups`(256 이웃 키 `variantMap` + **`phaseVariants`** `{w:16,h:16,maps:[256 표]}` — 채움 변형 4~6·바깥 변형 1~6 을 칸 위치로 고른다, `autotileVariantForMask` 가 붓·채우기·길에서 따른다. 바닥도 phaseVariants. 옛 `interiorVariants` 는 tile-gen PR #3 에서 없어졌다) + 물은 멤버 칸마다 `animationStrips`(3~4프레임). 멤버 칸이 수백 개(물 시험 묶음 372칸·띠 372개). `content.objects`·ObjectSpec 킷은 없다. 가져오기는 타일셋을 통째로 옮겨(`applyPackToProject` 의 `mapStrings`) 이 칸들을 그대로 둔다 — 2026-10-21 tile-gen 시험 묶음(`examples/demo` 정해진 답, 물+바닥)으로 저장·다시 열기 뒤 phaseVariants·animationStrips 가 똑같이 남는 것을 SQLite 로 확인 — 넣은 뒤 안내에 자동 타일 벌 수를 보인다. 견본 그림은 비워 둔다(위 「견본」 줄 참고). 한계: 새 지형은 **새 칩셋**으로 들어가 그 칩셋을 쓰는 맵에서만 칠한다(지금 맵 칩셋에 합치기는 아직 없다), 숲 줄기·절벽 면 줄은 붓이 아직 안 놓는다 |
| 아이템 아이콘 | item-gen | 준비 중 | 저장소가 없다(2026-10-21 조직·홈 확인). `scripts/asset-gen/generate.mjs`(agy CLI, 사람 고르기 없음)만 있어 가짜로 채우지 않았다 |

- AI 미연결: 물건 카드 주 단추가 「내 AI 연결하기」, 가져오기는 글자 단추. 호스트가 AI 를 껐으면 안내 글 + 가져오기가 주 단추(죽은 버튼 없음).
- **물건 화면 단계 띠**(`workshopWorkspace.ts` `stepper`): ① 무엇을 그릴지 적기 ② 후보 그리기 ③ 한 장 고르기 ④ 칩셋에 넣기 ⑤ 맵에 놓기 — 지금 단계는 폼·`itemState`·`isWorkshopPickBaked` 로 정한다(칩셋에 넣으면 data-step=5 가 지금 할 일). 한 장도 못 그린 판(`itemState` = `stopped`, 「멈춤」 — 계정 한도·로그인 막힘)은 ②에 노란 「멈춤」 표로 머문다(고를 차례로 보이지 않는다). 막힘·경고 문구는 머리줄이 아니라 그 아래 한 줄 띠(`workshop-alert`)에 — 긴 문구가 「닫기」를 밀어내던 것(실화면). 카드 오류는 짧게: 한도 = 「계정 사용 한도 소진 · 약 N시간 뒤 풀림」(`quotaRunError`, 공급자 「Resets in 61h28m」에서), 401·403 = 「로그인 만료 · AI 설정에서 다시 로그인」. 다시 그리기 장 수 = 지난 판 장 수(폼에서 2장이면 2장). 「맵에 놓기」는 붓을 들고 창을 닫으며 토스트로 「맵에서 놓을 곳을 누르세요」.
  그리는 동안 진행 막대(`roundProgress`, 「후보 n/m장 다 그림 · 약 k분 남음. 창을 닫아도 계속 그려요」). 칩셋에 넣은 뒤 주 단추는 **「맵에 놓기」**(`armWorkshopStamp`: 기물 탭과 같은 `activePaletteStamp` + 칠하기 도구, 공방을 닫는다 → 맵을 클릭하면 놓인다). 지금 맵이 그 칩셋을 안 쓰면 이유를 보인다.
  안의 단추·입력은 `.workshop button` 한 모양, 주 단추는 `.workshop-primary`. 비교 띠(지금 그림 vs 후보)는 지금 그림이 있을 때만.
- **묶음 가져오기**(`src/editor/workshop/genPackImport.ts`, 화면 `genWorkspace.ts` `importStep`): 큰 **끌어 놓기 칸**(폴더를 놓으면 `webkitGetAsEntry` 로 하위 폴더까지 읽는다, 누르면 `<input webkitdirectory>`). 묶음을 읽으면 칸이 한 줄(「다른 묶음 폴더…」)로 줄고 미리 보기·「이 게임에 넣기」가 나온다.
  미리 보기: 한두 장이면 크게(정수 배율 ≤4배, 360×220 상자), 그보다 많으면 같은 칸(128×104) 격자에 통째로 — 12장 넘으면 11장 + 「나머지 N장도 같이 들어가요」(캐릭터 묶음 38장이 높이 제한 상자에 잘려 보이던 것). 큰 그림은 칸에 맞게 줄인다. 단계가 하나뿐이면 번호를 달지 않는다.
  **캐릭터 묶음 가져오기 오류(2026-10-21 고침):** 짝 초상이 든 char-gen 묶음이 「reading 'characterAppearances'」로 죽었다 — `prepareStoreItem` 의 미리 돌려 보기 빈 문서에 `database` 가 없었다(`openwiki/asset-store.md`).
  `oprn-store-pack/1` 폴더(manifest.json + blobs/<sha256>): `validateManifest` · blob 은 sha256 을 다시 재서 이름과 맞는 것만 · 스토어 넣기와 같은 `prepareManifestItem`(storeApply.ts 에서 떼어 냄) + `applyPreparedStoreItem`.
  slug 는 `local-<생성기>-<blob 해시 12>`(같은 묶음을 다시 넣으면 덮어쓴다), 출처 `store = local:<생성기>`. 되돌리기 한 번으로 뺀다. 크레딧(CC BY 바탕 등)은 출처에 남는다.
- **공용 출구는 막는다:** `storePublishBlockReason` 이 `workshop_` 그림(3/4 관문 영수증이 아직 공방에 배선되지 않음)과 `local:` 출처 묶음을 스토어 올리기에서 막는다.
  공용에 올리는 길은 생성기 자신의 검사·submit(3/4 관문 포함)이다. 공방 그림은 이 프로젝트에만 들어간다(판 화면 「공용에 올리려면 3/4 시점 검사…」 안내).
- 물건 목록은 내가 만든 물건 + 판·고른 것이 남은 번들 기물(옛 다시 그리기 기록)만. 손대지 않은 번들 기물 목록은 뺐다 — 저장소(`oprn-workshop`)는 그대로라 옛 판·고른 것은 계속 열린다.
  목록이 비면 폼부터 연다. 폼(`workshopItemForm.ts`) = 무엇 · 어떻게 생겼나 · 가로/세로 칸 · 놓는 방식 · 후보 수(1~3, `engine.startRound({count})`) → 「후보 그리기」가 저장하고 바로 판을 시작한다.
- 「없는 타일」 카드 「직접 그려 줘」는 그대로 `openWorkshop(harnessId, { newItem })` 로 이 폼을 채워 연다.
- 영어 활동 막대에서 「Workshop」 이 48px 막대보다 넓어 잘리던 것 → 영어에서만 그 이름표 9.5px(`18-assistant-deck.css`).
- 그림 생성은 전부 사용자 계정: 편집기 안은 조수와 같은 동반 서비스 경로(`chat.ts`, OAuth — 편집기 AI 설정은 apiKey 저장값을 OAuth 로 승격한다), char-gen·object-gen 은 사용자 컴퓨터의 CLI 로그인. 우리 키·스토어 크레딧·유료 대체 경로 없음.
- 남은 일: 지형 묶음을 지금 맵 칩셋에 합치기(지금은 새 칩셋), tile-gen 견본 그림, 데스크톱(Electron)에서 char-gen·object-gen 을 직접 띄우기(지금은 부탁 글 + 묶음 가져오기), item-gen 실체, 공방 굽기에 3/4 관문 영수증 배선.

## 공방 실행기(물건·가구 카드 안)

- 실행기: `src/harnesses/_core/workshop/engine.ts`. 한 판 = 후보 3장(방향 앞에서부터 3개, 2026-10-07 에 5장→3장). 한 장 = 그리기 → 깨지면 고치기 ≤2 → (실행기가 `selfCheckMessage` 를 주면 자기 점검 1 — 실내 기물은 2026-10-07 에 뺐다, 「너무 오래 걸린다」) → 독립 검수(vision) → `runner.gate` → 불통과면 다시(시도 ≤3). 3번 다 불통과여도 사람이 볼 수 있게 「검수 불통과」로 남긴다. 동시 기본 3(1~6, `oprn:workshop-concurrency`), 429 면 하나 줄이고 기다린다(≤5번, 20·40·…초). **계정 한도 소진 429**(공급자 문구 quota·RESOURCE_EXHAUSTED·upgrade your plan)는 기다려도 안 풀리므로 다시 시도하지 않고, 429 로 끝난 장이 있으면 `blocked` = 「내 AI 계정의 사용 한도에 걸렸어요…」로 줄을 멈춘다(2026-10-21 실측: Google 계정 「Individual quota reached … Resets in 101h」 에 카드가 몇 분씩 「그리는 중」으로 남았다). 401·403 이면 멈추고 AI 설정으로 안내. 「다시 그리기」가 멈춤을 푼다.
- 모델: 표면 `workshop-draw`(AI 설정 「도트 저작 모델」(`pixelModel`)이 저장돼 있으면 그 텍스트 모델, 없으면 옛 그대로 감독 티어 — 2026-10-16, 16384 토큰) · `workshop-review`(vision 역할, 4096). `src/ai/assistantEndpoint.ts` 표 한 줄씩. 사용자 자기 계정·조수와 같은 엔드포인트. 화면에 모델 이름·권장 문구는 없다(1차 개편에서 `WORKSHOP_MODEL_ADVICE`·`WORKSHOP_DISPLAY` 를 지웠다). 왼쪽 공방 창은 `AI_CONNECTION_STATUS_CHANGED_EVENT` 로 연결 안내를 다시 그린다.
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
- 조수 도구와 잇기(2026-10-21): `generate_missing_object` 가 낸 요청을 조수 카드(`aiObjectGenCard.ts`)가 받아 공방 폼 없이 바로 판을 돌리고, 사람이 고르거나 「알아서 고르기」(검수 PASS 첫 후보, 설명서 `review.pick` 없음·출처 `/auto-pick`)로 굽는다 — `openwiki/editor-ai-tools.md` 「없는 기물 그리기」.
- QA(2026-10-07, netns·가짜 채팅): 카드 → 폼 채움 → 후보 5장 → B 고름 → 넣기 → 칩셋 6557→6580(이식 4칸, 킷 2×2) · 후속 요청 문장 · `stamp_tileset_object`·`build_hand_interior_room` 이 새 id 로 성공 · 맵에 그림이 그려짐. 번호 이주는 node 스크립트로 확인(옛 정의에 구운 칸 6530 → 새로 고친 뒤 6578, 맵 칸도 따라 바뀜).
