# 에디터 「공방」 — 하네스를 에디터 안에서 돌린다

- 들어오는 길: 왼쪽 활동 막대 렌치 「공방」(`src/editor/panels/leftWorkshopPane.ts`) → 큰 화면(`src/editor/workshop/workshopWorkspace.ts`, body 오버레이).
- 어떤 하네스가 보이나: `workshopHarnesses(genre)` — 매니페스트 `entrypoints.editorUi` 가 true 이고 `workshop` 로더가 있고 장르가 맞는 것. 에디터는 하네스 폴더를 직접 import 하지 않는다.
- 실행기: `src/harnesses/_core/workshop/engine.ts`. 한 판 = 후보 3장(방향 앞에서부터 3개, 2026-10-07 에 5장→3장). 한 장 = 그리기 → 깨지면 고치기 ≤2 → (실행기가 `selfCheckMessage` 를 주면 자기 점검 1 — 실내 기물은 2026-10-07 에 뺐다, 「너무 오래 걸린다」) → 독립 검수(vision) → `runner.gate` → 불통과면 다시(시도 ≤3). 3번 다 불통과여도 사람이 볼 수 있게 「검수 불통과」로 남긴다. 동시 기본 3(1~6, `oprn:workshop-concurrency`), 429 면 하나 줄이고 기다린다, 401·403 이면 멈추고 AI 설정으로 안내.
- 모델: 표면 `workshop-draw`(감독 티어, 16384 토큰) · `workshop-review`(vision 역할, 4096). `src/ai/assistantEndpoint.ts` 표 한 줄씩. 사용자 자기 계정·조수와 같은 엔드포인트. 권장 모델(화면에도 표시, `WORKSHOP_MODEL_ADVICE`): GPT-6.1 Sol(medium) 또는 Claude Sonnet 5.5 이상.
- 속도(2026-10-07, 실제 Claude Sonnet 5.5·옷장·동시 3): 옛 설정(5장·자기 점검) 한 판 6.8분·호출 35번 → 3장·자기 점검 뺌 4.9분·15번 → 아래 헛걸음 셋을 고친 뒤 1.8분·8번(두 번 재서 112초·108초, 고치기 호출 0). 호출 하나가 30~60초라 시간은 호출 수가 정한다. 잰 스크립트는 저장소에 없다 — 엔진+실행기를 esbuild 로 묶어 node 에서 프록시(`ANTHROPIC_BASE_URL`)로 부르고 `onChange` 로 판을 받는다.
  - 헛걸음 1 귀퉁이 검사: 「칠한 귀퉁이 ≥2 = 배경」이 번들 91종(옷장 포함)을 틀리게 막았다 → 지금 그림에서 비어 있던 귀퉁이가 칠해졌을 때만(새 기물은 네 귀퉁이 다).
  - 헛걸음 2 줄 폭: 모델이 16칸 줄을 17칸으로 세고, 고치려고 JSON 안에 `"…"[0:16]`·`.replace(…)`·`"A" if False else "B"` 를 남긴다 → `repairStringExpressions` 가 값으로 풀고, 그래도 폭이 틀린 줄이 8개 이하면 그 줄만 `{"rows":{"7":"…"}}` 로 다시 받는다(`rowsNeedingFix`·`applyRowFix`).
  - 헛걸음 3 키릴 「о」: 라틴과 똑같이 생긴 글자는 legend 의 라틴 글자로 읽는다(`LOOKALIKE`).
- 답 형식: 팔레트 키 격자 JSON `{"legend":{"a":"wood:6"},"rows":[…],"note","topRows"}`(`grid.ts`). pxg 아님.
- 저장: 이 기기 IndexedDB `oprn-workshop`(`store.ts`), 범위 키 = `conversationScopeKey`. 그림은 저장하지 않고 격자만. 문서·내보내기와 무관. 정본에 들어가는 것은 아래 「칩셋에 굽기」 결과뿐.
- 새 하네스 입주: 하네스 폴더에 `editor/runner.ts`(`WorkshopRunner`) + 매니페스트에 `workshop: () => import("./editor/runner").then(…)` + `editorUi: true`. 공용 화면은 지금 실내 기물 문구가 들어 있다(제목·버리기 이유) — 둘째 하네스가 들어올 때 실행기 쪽으로 옮긴다.
- QA: `BASE=http://127.0.0.1:<포트> node scripts/qa/workshop-capture.mjs` — dev 빌드의 `window.__oprnWorkshopChat` 가짜 채팅으로 모델 없이 찍는다. 결과 `verify-shots/workshop/`. 이 기기에서는 크로미움이 `net::ERR_NETWORK_CHANGED` 로 백지가 될 수 있다 — dev 서버와 스크립트를 `unshare -rn` 안에서 `ip link set lo up` 한 뒤 함께 띄운다(콜드 부팅 60~70초).
- 설계·계획: `docs/superpowers/specs/2026-10-02-workshop-editor-design.md`, `docs/superpowers/plans/2026-10-02-workshop-editor.md`.

## 칩셋에 굽기 (2단계, 2026-10-07)

- 들어오는 길: 판 화면에서 후보를 고르면 머리 아래에 「고른 X 를 프로젝트 칩셋에 넣기」(`workshopRoundView.ts` → `src/editor/workshop/workshopBake.ts`). 되돌리기 한 번으로 뺀다(`recordProjectSnapshot`).
- 굽기(`src/project/workshopTiles.ts`): 격자를 16px 칸으로 잘라 빈 칸을 빼고 30칸 폭 시트 PNG 한 장 → 업로드 자산 `workshop_<해시>` → 손 도트 실내 칩셋 `atlas_biome_interior` 의 `tileGrafts` 로 번들 칸 뒤(행 맞춤)에 덧붙인다. 생성 건물 시트(`installGeneratedBuildingSheet`)와 같은 방식이고, 번들 칸 번호는 하나도 안 바뀐다.
- 통행·층: floor·wall 은 발밑 줄(`footRows`, 새 기물은 「세로 칸(발밑)」) 막힘 + 그 위 솟은 줄 ★, hang 은 모두 ★, flat 은 밟음·아래 그리기. 번들 가구 칸과 같은 규칙이다.
- 물체: 구조 킷 `learnedFrom: "workshop"`, id `workshop:<기물 key>`(새 기물은 `new:` 를 뺀 이름). 태그에 `hand:<종류>`·`foot:`·`rise:`·`grid:<격자 해시>`·`use:` — 같은 격자를 다시 넣으면 아무것도 안 늘고, 다른 후보를 넣으면 킷만 새 칸을 가리킨다(옛 칸은 남아 이미 놓인 맵은 옛 그림 그대로).
- 조수가 쓰는 길: `list_tileset_objects`·`stamp_tileset_object`(팩 물체와 함께 나온다) · `list_hand_interior_parts`·`build_hand_interior_room`(`workshopHandObjects` 가 손 도트 사양 꼴로 섞는다, 분류 `workshop`).
- **번호 이주:** 번들 시트를 새로 구우면 칸이 끝에 덧붙어 공방 칸과 겹칠 수 있다. `ensureAtlasBiomeInteriorCurrent` 가 정의를 새로 고치기 전에 공방 칸·킷을 떼어 두고(`detachWorkshopTiles`, 행 맞춤 빈 칸은 이름표 「공방 칸 자리」로 알아본다) 새 번들 끝 뒤에 다시 붙인다(`attachWorkshopTiles`). 번호가 바뀌면 그 칩셋을 쓰는 맵의 네 층과 킷을 함께 고쳐 쓴다. 평소 불러오기에서는 떼었다 붙여도 번호가 같아 바뀌는 것이 없다.
- 조수 카드와 잇기: 「없는 타일」 카드의 「직접 그려 줘」(지금 맵이 손 도트 실내일 때)가 `openWorkshop("interior-props", { newItem })` 로 새 기물 폼을 채워 열고, 굽기가 내는 `oprn:workshop-baked`(`workshopEvents.ts`)를 한 번 듣고 후속 요청을 보낸다 — `openwiki/asset-store.md` 「조수와 스토어」.
- QA(2026-10-07, netns·가짜 채팅): 카드 → 폼 채움 → 후보 5장 → B 고름 → 넣기 → 칩셋 6557→6580(이식 4칸, 킷 2×2) · 후속 요청 문장 · `stamp_tileset_object`·`build_hand_interior_room` 이 새 id 로 성공 · 맵에 그림이 그려짐. 번호 이주는 node 스크립트로 확인(옛 정의에 구운 칸 6530 → 새로 고친 뒤 6578, 맵 칸도 따라 바뀜).
