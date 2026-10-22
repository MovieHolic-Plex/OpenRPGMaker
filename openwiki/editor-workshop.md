# 에디터 「공방」 — 생성기 넷(object-gen·char-gen·tile-gen·item-gen)을 에디터에서 쓴다

- 들어오는 길: 왼쪽 활동 막대 렌치 「공방」(`src/editor/panels/leftWorkshopPane.ts`).
- **2026-10-21 개편(사용자 결정):** 하네스 목록 카드(「실내 가구·소품 그리기」·「맵 소품 그리기」, 매니페스트 summary·모델 권장 문구)를 뺐다.
  첫 화면은 생성기 카드다 — 정의·상태·견본은 `src/editor/workshop/generators.ts`. 화면 글은 쉬운 말만, 모델 이름 금지.
- **같은 날 2차(「허접하다」 지적 → 상용 수준 재디자인, PR workshop-gens-2):** 쓸 수 있는 카드(물건·캐릭터)는 위에 크게 —
  **실제 견본 도트 띠**(원래 크기 PNG 124×58 를 2배 정수 배율, 견본 바탕 #181b22) + 제목·상태 + 한 줄 소개 + **주 단추 하나**(보조는 글자 단추).
  곧 들어올 카드(아이템)는 「곧 들어올 생성기」 아래 작게, 단추 없음. 견본이 없는 생성기는 그림 띠 대신 「견본은 첫 결과가 나오면 올라와요」 빈 띠를 쓴다. 지형(tile-gen) 카드는 견본을 비워 둔다 — 한때 실었던 풀밭 견본(tile-gen 첫 세션)은 겨냥한 beodeul_city 의 땅·나무·길·물 칸이 EasyRPG 계열이라 그 화풍 흉내가 되어 tile-gen 쪽이 거둬들였고 카드에서도 뺐다(2026-10-21). jp_city·코드 도트 버들항 키트를 겨냥한 결과가 독립 검수를 통과하면 그때 싣는다(카드 띠 모서리 표 `sample.caption` 은 그때 「견본 출력」 등으로 쓴다). 색·간격·모서리는 편집기 토큰(`--accent`·`--success-muted`·`--radius-m` …)만 쓴다.
  견본 출처: object-gen 저장소 `docs/images/hero.png` 에서 고른 기물 3개(같은 조직 1차 그림) · char-gen 은 실제 결과물(2026-10-22 교체):
  데모 캐릭터 상반신(정수 1/7 칸 평균) + char-gen 칩 셋(정수 2배)(Scarloxy People1 바탕, CC BY 4.0 — 저장소에 이미 번들된 팩, 출처 `public/assets/ATTRIBUTION.md`
  「Workshop character card sample」)을 버들항 마당 길 위에 세운 그림(`public/assets/workshop/*-sample.png`). 전 견본(char-gen 더미 바탕 칩
  `examples/bases/dummy_a/b`, 윤곽·명암 없음)은 사용자가 「사람이 어색하다, 고급지게」라고 해서 뺐다.
- **3차 「작업대」 겉모습(2026-10-22, 「공방 UI 를 더 화려하게」):** 그림 조각은 `src/editor/workshop/workshopArt.ts`, 겉모습은 `src/styles/database/workshop/craft.css`(레이어 database, workshop.css 다음) + 작업 줄 몫은 `queue.css` 끝(레이어 밖 시트라 레이어 안 craft.css 로는 못 이긴다 — 같은 선택자를 craft.css 에 두면 조용히 진다).
  - **무대**(`generatorStage`, 카드 `is-card` · 생성기 창·새 물건 폼·빈 화면 머리 `is-hero`): 물건 = `object-gen-stage.png`(견본 기물 셋을 뒷판을 떼어 손 도트 실내 v5 판자벽·마루 위에, 2배) + 가끔 반짝임 · 캐릭터 = `char-gen-stage.png`(견본에서 칩만 뺀 판) 위에 `char-gen-walk.png`(칩 셋 × 1·0·1·2 네 칸, 2배)를 CSS `steps(4)` 로 제자리 걸음 · 지형 = 견본 없음, 16px 모눈 빈 작업대(다른 화풍 흉내 그림을 싣지 않는다). 견본 정의는 `generators.ts` `sample.walkers`·`sample.twinkles`. 무대 PNG 를 다시 만들 때 칩 자리(114,40)(154,40)(194,40)는 `char-gen-sample.png` 와 픽셀이 같게 맞췄다(칩 첫 칸을 무대에 얹으면 옛 견본과 차이 0).
  - **불씨 막대**(`craftBar`): 2px 틈의 도트 칸 + 위·가운데·아래 세 단 불씨색, 그리는 중이면 빛이 칸씩 지나간다(`is-hot`), 줄 서는 중·계정 대기면 끝을 모르는 덩이(`is-idle`). 공방 머리 진행·작업 줄 줄·왼쪽 물건 카드가 같은 것을 쓴다. 큰 화면 막대는 작업 줄 진행(`itemView().progress`)을 읽는다 — 장 수만 세면 다 될 때까지 0 이었다.
  - **그리는 중 카드** = 화로 불빛 + 오르는 불씨 도트(`is-forging`), 줄 서는 중 = 불 꺼진 작업대(`is-waiting`). **드러남**(`revealPhase`·`markReveal`): 열 때 아직 그림이 없던 카드에 그림이 처음 나온 순간 한 번 — 아래에서 위로 8줄 닦아내기 + 놋쇠 테 + 불똥. 작업 줄 줄·알약은 고를 차례가 된 순간 한 번. 고른 카드 = 놋쇠 테 + 모서리 체크 도트.
  - 움직임은 transform·opacity·background-position 만, 다시 그려도 튀지 않게 `animationPhase`(시계에 맞춘 음수 지연). `prefers-reduced-motion` 이면 전부 멈춘다. 편집기는 밝은 테마 하나뿐이라 무대·막대 바탕(먹색)은 일부러 어두운 진열면이다.
  - 성능(2026-10-22, 부하 30~50 기기, 작업 셋을 돌리며 작업 줄 판을 연 채 맵에 4초 칠하기 rAF): 바뀌기 전과 같은 범위(p50 16.7ms, 긴 작업 수 들쭉날쭉 — 기기 부하). 영상 캡처 `scripts/qa/workshop-ui-video.mjs`(가짜 그리기·판정, 숨긴 반려 표본은 색으로 가려낸다).
- **부탁 글 칸(2026-10-22):** 글칸에는 사람이 읽는 부탁만 보이고, 「생성기 판」 줄(git 명령·커밋)은 복사할 때 붙는다(`requestBox`). 글칸 위 이름표는 「내 AI 에이전트에게 보낼 부탁」, 판은 복사 단추 풀이말에만. 사람 화면이 열려 있는 동안 작업 줄 알약은 숨는다(공방 큰 화면과 같게).
- **사람 묶음 미리 보기(2026-10-22, `castPreview.ts`):** `content.characters` 가 있는 묶음은 파일을 늘어놓지 않고 사람 하나에 한 칸 —
  앞모습(아래 방향)을 정수 3배로 걷게(1·0·1·2, 190ms, reduced-motion 이면 멈춤) + 짝 얼굴 48×48 정수 2배 + 「얼굴·초상 N장 · 표정 N개」.
  작업 줄 작은 그림은 앞모습 머리~허리 2배(칸 아래 가장자리에 붙임)(밝은 바탕 `.wq-thumb.is-cast`). 전에는 시트(288×256)를 통째로 0.8배 흐리게 줄이고
  700px 초상도 흐리게 줄여 물건용 갈색 바닥에 올렸다 — 그림이 아니라 보여 주기가 싸 보인 원인. 캡처 `scripts/qa/workshop-people-capture.mjs`.

| 카드 | 생성기 | 상태 | 하는 일 |
|---|---|---|---|
| 물건·가구 | object-gen | 여기서 바로 | 「새 물건 그리기」= 아래 공방 실행기(사용자 자기 AI 계정). 넣을 곳 전환: 실내 가구(`interior-props`, 손 도트 실내 칩셋) · 지금 맵 칩셋(`map-objects`). 「만든 묶음 가져오기」= object-gen `pack` 폴더 가져오기 |
| 캐릭터 | char-gen (비공개 — 2026-10-21 바뀜, `MovieHolic-Plex/char-gen`. 설치 링크를 내지 않는다) | 내 컴퓨터에서 | 파이썬 도구라 브라우저에서 못 돈다. 「부탁하고 가져오기」(`genWorkspace.ts`)가 ① 무엇·몇 명 → 사용자 AI 에이전트에 붙여 넣을 부탁 글(언어별, `charGenRequest`) ② `char-gen pack` 폴더 가져오기 → 미리 보기 → 이 게임에 넣기 |
| 지형·바닥 | tile-gen (비공개, `MovieHolic-Plex/tile-gen`) | 내 컴퓨터에서 | **지형 생성기**(2026-10-21 다시 만듦): 이음매 없는 바닥 채우기, 47칸 자동 타일 가장자리(풀↔흙·길·카펫), 물가·움직이는 물, 숲(숲 바닥 오토타일 + 편집기가 놓는 나무 — tile-gen PR #4 부터 그룹에 `composer` `{kind:"trees", layers:[4,3,2], sprites t4·t3a·t3b·t2 와 그늘판 d}` 가 붙고 옛 trunk_* 줄 칸은 없다, 붓이 칠하면 `autotileEngine` → `composeTreesAround` 가 2~4층에 나무를 짠다), 절벽·단. 물건·기물·건물은 object-gen 만 — tile-gen 을 물건 생성기로 소개하지 않는다(`tile-gen new --mode prop` 은 거절하고 object-gen 을 가리킨다). 화면: ① 종류(`TERRAIN_MODES`: floor·autotile·water·forest·cliff) 또는 재질 프리셋(`TERRAIN_PRESETS`: lava·swamp·poison·deep_water·beach = 물 계열, snow·ice·sand·road·cobble·meadow = 자동 타일 계열 — CLI `--mode <프리셋>`, tile-gen PR #3)·어떤 지형·참고 칸 `x,y`(선택) + 「지금 맵 칩셋 그림 받기」 → 부탁 글(`tileGenRequest`: `tile-gen auto` → 로컬 `tile-gen pick` → `tile-gen pack`) ② 묶음 가져오기. 묶음 = `oprn-store-pack/1` tileset 하나 + `autotileGroups`(256 이웃 키 `variantMap` + **`phaseVariants`** `{w:16,h:16,maps:[256 표]}` — 채움 변형 4~6·바깥 변형 1~6 을 칸 위치로 고른다, `autotileVariantForMask` 가 붓·채우기·길에서 따른다. 바닥도 phaseVariants. 옛 `interiorVariants` 는 tile-gen PR #3 에서 없어졌다) + 물은 멤버 칸마다 `animationStrips`(3~4프레임). 멤버 칸이 수백 개(물 시험 묶음 372칸·띠 372개). `content.objects`·ObjectSpec 킷은 없다. 가져오기는 타일셋을 통째로 옮겨(`applyPackToProject` 의 `mapStrings`) 이 칸들을 그대로 둔다 — 2026-10-21 tile-gen 시험 묶음(`examples/demo` 정해진 답, 물+바닥)으로 저장·다시 열기 뒤 phaseVariants·animationStrips 가 똑같이 남는 것을 SQLite 로 확인, 숲 시험 묶음(740칸)으로 `composer` 를 포함한 그룹 JSON 이 저장·다시 열기 뒤 바이트 그대로인 것도 확인 — 이때 저장 검사가 `composer.overhangOnGroups`(사람이 읽는 이름, 엔진은 `overhangOnTiles` 만 본다)를 필수로 요구해 400 으로 저장이 막혔다, 지금은 있을 때만 검사 — 넣은 뒤 안내에 자동 타일 벌 수를 보인다. 견본 그림은 비워 둔다(위 「견본」 줄 참고). 한계: 새 지형은 **새 칩셋**으로 들어가 그 칩셋을 쓰는 맵에서만 칠한다(지금 맵 칩셋에 합치기는 아직 없다), 절벽 면 줄은 붓이 아직 안 놓는다. 숲 그림은 아직 사람 검수를 통과한 것이 없다 |
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

## 새 기물은 object-gen 흐름 그대로 그린다 (2026-10-21)

사용자: 「조수가 object-gen 을 쓴다면서 왜 이렇게 못 그리나」. 실측해 보니 공방은 object-gen 의 참고 그림 단계만 옮겼고, 그 뒤(그리는 에이전트의 미리보기 고치기, 견본 묶음, 숨긴 반려 표본을 섞은 블라인드 판정 3판 다수결, 다시 그리기, 고르기 3판 다수결)는 공방 자체 한국어 지시문 한 번씩이었다. 그래서 새 기물(맵 기물 전부, 손 도트 실내의 `isNew`)은 object-gen(`MovieHolic-Plex/object-gen` `objectgen/flow.py`)의 단계·지시문·견본을 그대로 쓴다. 시트에 있는 그림을 고치는 판은 예전 흐름 그대로다.

- **원문 사본, 갈래(fork) 없음** — 지시문·판정 문장·고르기 문장·참고 지시문은 gen-kits 생성물 `src/harnesses/_core/workshop/genKits/object-gen.json`(lock 고정 커밋의 원본 모듈 상수 + 견본 묶음 `set.json`)에서 읽고, 견본·반려 PNG 는 `public/assets/gen-kits/object-gen/anchors/<set>/`. 다시 뽑기·올리기: `npm run gen-kits:sync`(아래 「생성기 저장소 고정」). 손 사본 `objectGenKit.json` 과 그 추출 스크립트는 2026-10-22 에 지웠다. 바꾼 것은 「그림판 파일을 Read 로 열라」는 JUDGE 첫 문단 한 곳(대화에는 그림이 붙는다)과 ANSWER 의 PNG 갈래뿐이다(원본 drawer.WORKFLOW 가 ANSWER 를 덮듯 「How to answer in this run」 절로 덮는다). 원본 문장이 바뀌어 그 자리를 못 찾으면 던진다.
- **단계** (`objectGenFlow.ts`, 실행기 갈래 `referenceCount`·`referenceStyleNote`·`maxAttempts`·`looks`·`lookMessage`·`review` — 기물마다 다를 수 있다 `PerItem`):
  1. 참고 그림 **2장**(장마다 시점 검사 4번까지) → 판 기록 `round.reference`(+`more`, 붙인 견본 `anchor`). 견본(실행기 `referenceAnchor`)을 붙일 때만 원본 `STYLE_NOTE`(「붙인 그림은…」)를 덧붙인다 — 2026-10-22 전에는 그림 없이 그 문장만 갔다.
  2. 그리기: 원본 `draw_brief`(방향 A 칩셋 충실 · B 지시 충실 = 후보 둘, VIEW·RECIPE·6칸 이상이면 LARGE, 팔레트 단 요약 `ramps_of`), 칩셋 물체·참고 그림 2장·견본 묶음(oprn-interior-v5-large) 그림.
  3. **미리보기 고치기** 최대 3번(원본 drawer 의 `j.dry` + preview.png 고리): 8배·1배·2배 + 기계 검사(`ogCheck` = 원본 checks 의 SIZE·EMPTY·TOPPAD·GROUND·BG·STRAY·FOOTPRINT 는 막고, TONES·SPECKLE·INK·TOP 은 알린다) → 고친 격자 또는 `{"keep": true}`.
  4. **블라인드 판정**: 원본 JUDGE, GOOD/BAD 견본 6배+1배, 숨긴 반려 표본(flat/noise/foreign 중 하나 + slab + 견본 반려 하나)을 섞는다. 표본을 빠뜨리거나 반려 표본을 통과시킨 판은 무효, **유효 3판 다수결**(무효는 2번까지 더). 후보 하나씩 판정한다(원본은 그 판 후보 전부를 한 판에).
  5. 불통과는 판정 이유를 주고 **한 번 다시 그린다**(시도 2번).
  6. 「알아서 고르기」: 원본 picker PROMPT + 견본 그림, 꼬리표를 섞어 **3번 묻고 다수결**(`picker.ts` `pickerMajority`).
- **배경 = object-gen `rules`** — 기물 정의의 `setting`(칩셋 → 「현대 일본 도시」 …)을 원본 job `rules` 입구로 넘긴다(`ogRules`): 그리기 지시문의 「Drawing rules for this set」 절과 고르기 문장의 `rules_part`(원본 picker.prepare 문장). 내용은 「그 배경에서 실제로 보는 모양으로, 설명이 다른 나라 모양이면 배경 쪽으로」. 참고 그림 지시(`workshopRefDescribe`)와 조수 도구 `description` 설명도 같은 뜻을 적는다. 까닭: 시험 2 에서 조수가 jp_city 공중전화 부스를 「빨간 철제 몸체에 격자 유리창」(영국 K6)으로 적었고, 원본 CLI·공방 둘 다 그대로 K6 을 그렸다(VQA FAIL).
- **같은 물건 A/B 실측**(2026-10-21, 벌통·일본 공중전화 부스·금붕어 어항): 원본 CLI(`python3 -m objectgen run`, 그리기·판정·고르기 Opus 5.5 medium) 고른 것 vs 공방(같은 모델) 고른 것을 새 Opus 블라인드 비교 4번×3건 = 12판 — 공방이 낫다 5 · 원본이 낫다 7(최종 그림인 판정 3·4 만 보면 원본 4/6), 진 쪽이 「clearly worse」인 것은 공방 0 · 원본 1, 나머지는 모두 「on par」. 원본과 같은 품질 층이지 더 낫지는 않다. 엄한 적대 VQA(8건, 문화·시점·1배를 따로 묻는 지시문)는 PASS 4 · WEAK 3 · FAIL 1 로 예전 공방 흐름(대조)과 똑같다 — 벌통이 1배에서 상자로, 혼천의 고리가 가늘게, 「빨간 옛날식 부스」는 배경 규칙 뒤에도 영국식으로 읽힌다. 보고서 `~/claude-viz/objectgen-assistant-2.html`.

## 자연물은 도형 금지 — 버들항 나무 견본 (2026-10-22)

사용자: 2×3 사과나무가 「도형을 너무 많이 씀」(달걀 수관·고른 테두리·네모 줄기·격자 2×2 네모 사과). 원인은 그리기 단계와 판정이었다. 참고 그림은 잎 덩이가 불규칙해 괜찮았다.
- 그리기 지시문은 가구용 VIEW·RECIPE·LARGE(윗면 3줄·받침·결)를 받았고, 견본은 실내 v5 가구(침대·옷장)였다.
- 판정 GOOD 견본도 가구였다. 판정 기준에 도형을 막는 항목이 없어 통과했다.
- 팔레트는 무관했다.

고친 곳은 object-gen 원본이다(PR #10, lock 갱신). 공방은 gen-kits 로 그대로 따른다.
- **자연물 판정** `isOrganicObject`(= `footprint.is_organic`): 다음 중 하나면 자연물이다. 설명 글은 읽지 않는다(「나무 아래 벤치」는 자연물이 아니다).
  - 3/4 관문 종류가 `organic`
  - 크기 사전 종류가 tree·plant
  - 머리 낱말이 자연물(나무·덤불·꽃·바위·사과·동물…)
  - 자연물 더미(「돌무더기」「rock pile」. 「자루 더미」는 아니다)
  - 덤으로 `COMPOUNDS` 를 더해 「flower bed」가 침대가 아니라 식물로 간다.
- **그리기**: `VIEW_ORGANIC`·`RECIPE_ORGANIC` 가 가구 지시를 대신하고, LARGE 는 넣지 않는다.
  - 금지: 원·타원·돔 수관, 네모·평행 줄기, 같은 점 격자, 채운 사각형
  - 요구: 덩이 4~8개의 들쭉날쭉한 윤곽, 덩이마다 모인 밝음·그늘, 끊긴 테두리, 가늘어지는 줄기와 뿌리, 크기가 다르고 잎에 반쯤 가린 열매
- **견본 묶음** `oprn-beodeul-organic`(`ogStyleSetFor`): 실행기 `anchorsFor(env, item)` 가 물건마다 고른다.
  - GOOD·견본: 버들항 손 도트 활엽수·덤불(#3223·#3229 `scripts/content/beodeul-redraw/art`)
  - BAD: 반려된 달걀 사과나무
  - 숨긴 반려: 같은 색의 도형 넷(막대사탕 나무·돔 덤불·점 꽃밭·타원 돌)
  - 고르기 견본(`assistantObjectGen` `ogPickerExtras`)도 같은 묶음이다.
- **판정**: JUDGE 에 Q7(자연물의 도형 = FAIL)과 view34 문구를 더했다. 수관·더미는 윗면 판 대신 덩이 위가 밝으면 된다.
- **고르기**: 손으로 뭉친 쪽을 고르라는 문장이 들어갔다.
- **기계 검사 `GEOMETRIC`**(`silhouetteGeometry` = `checks.geometry`): 윤곽 좌우 가장자리가 들어갔다 나왔다 꺾이는 수(줄당)가 0.12 미만이고, 넓은 띠의 타원 IoU 가 0.88 초과이면 걸린다. 20줄 이상이면 FAIL, 그보다 작으면 경고다.
  - 버들항 나무·덤불: 0.25~0.45 / 0.82~0.87
  - 반려 나무: 0.085 / 0.92
- **잎 색과 대칭 (2026-10-23)**: 지시문을 고친 뒤에도 Opus 적대 검수가 네 판 내리 「다른 세트에서 붙여 넣은 것 같다」로 떨어뜨렸다.
  - 원인 1: 참고 그림 색 몫(`referenceColors`)이 생성 그림의 밝고 누런 초록을 잔디 키로 옮겼다. 그래서 자연물은 색 몫을 열매·꽃 색에만 쓴다.
  - 원인 2: 팔레트 단만 주니 그리는 쪽이 올리브 잔디 키(#3a582e·#426a2e)로 잎을 칠했다. 팔레트에는 견본 잎 단(#497f3c·#296535·#104c2f…)이 들어 있었다.
  - 그래서 지시문에 `leafRampLine`(= `prompts.leaf_ramp_line`)을 넣는다. 견본 잎 단 `ORGANIC_LEAF_RAMP` 에 가장 가까운 팔레트 키와 몫을 이름으로 준다.
  - 기계 검사 셋을 더했다(원본 `checks.geometry_issues` 와 같은 값, gen-kits 로 읽는다). 모두 FAIL 이다.
    - `SYMMETRIC`: 크기 사전 종류가 tree 이고 32줄 이상이며, 수관 띠 좌우 거울 IoU 가 0.88 을 넘을 때. 버들항 나무 0.80~0.85, 반려 클로버 0.91~0.93. 덤불은 둥글어(좋은 덤불도 0.93) 빠진다.
    - `LEAFHUE`: 잎 초록 200화소 이상이고, 평균 (빨강−파랑)이 6 을 넘을 때. 견본 −9~−4, 반려 +15~+23.
    - `LEAFLIGHT`: 같은 조건에서 명도 60 미만 몫이 0.25 미만일 때. 견본 0.28~0.38, 반려 0.13~0.22.
    - `LEAFFLAT`: 이웃 잎 화소 명도 차 평균이 11.5 미만일 때(덩이 없이 한 그라데이션). 견본 12.3~17.9, 반려 8.1~11.4, 돔 반려 6.3.
    - `LEAFBAND`: 잎 명도와 높이의 상관이 −0.56 보다 작을 때(위 ⅓ 밝고 아래 띠 어두움). 견본 −0.44~−0.53, 반려 −0.58~−0.64.
    - `LEAFHUE` 한도는 덤불 +0.6 도 「위 올리브·아래 청록」으로 떨어져 −1 로 조였다.
    - `LEAFSPECK`: 가장 밝은 잎 색 화소 중 같은 색 이웃이 없는 몫이 0.2 를 넘을 때(뿌린 점 하이라이트). 견본 0~0.12, 반려 0.24~1.0. 지시문의 「1~2px 반점」이 원인이어서 「윗왼쪽 덩이에만 2~4px 획」으로 고쳤다.
    - `FLATBASE`: 잎 덩이(잎 200화소 이상)의 맨 아랫줄 폭이 가장 넓은 줄의 0.5 를 넘을 때(땅을 따라 평평하게 잘린 밑). 견본 0.08~0.28, 반려 덤불 0.75, 돔 0.87.
  - 돌무더기: 「베개 같은 둥근 네모 돌을 벽처럼 쌓고 이끼를 줄눈처럼 넣었다」로 떨어졌다. 지시문을 「큰 모난 돌 하나에 작은 돌이 기대고, 이끼는 밝은 윗면에 덩이로」로 바꿨다.
  - 윤곽·그늘 검사 넷을 더했다(모두 FAIL).
    - `CROWNFULL`(나무): 수관 면적 / 볼록 껍질 면적이 0.9 를 넘을 때. 견본 참나무 0.86~0.89, 「막대 위 달걀」 0.91~0.93.
    - `BLOBBY`(덤불 등): 같은 값이 0.92 를 넘을 때. 견본 덤불 0.89~0.91, 원판 덤불 0.93~0.94. 「둥글게」라는 주문도 원이 아니라 홈 파인 더미로 그린다.
    - `NODEEP`: 20줄 이상인 자연물에서 명도 45 미만이 8% 미만일 때. 견본 14~20%, 바랜 돌무더기 0~4%.
    - `LEAFHOLES`: 수관 안쪽 어두운 구멍이 잎 100화소당 2.2 개 미만일 때. 견본 2.7~3.3. 큰 덩이마다 초승달 그늘 하나뿐인 「구름 선반」은 0.8~2.0.
  - 「덩이 단위(밝은 머리·몸·아래 구멍)」 글자 그림은 지웠다. 큰 덩이를 층층이 쌓게 만들어, 두 검수자가 따로 「양배추·구름 선반」이라고 했다.
  - 판정 Q7 에 적대 검수가 잡은 실패를 적었다. 뿌린 점 하이라이트, 달걀 윤곽, 줄 맞춰 쌓은 베개 돌, 정면 담 같은 꽃밭, 그늘 쪽이 없는 것이다. 공방 판정에서 먼저 떨어져 다시 그린다.
  - 마지막 수단: 설명과 검사만으로는 덤불이 발톱 자국·줄무늬가 됐다. 그래서 견본 글자 그림의 4~8px 조각을 잘라 새 윤곽 안에 다시 배치하게 한다. 숫자 n 은 「Leaf greens」 목록의 n 번째 키다. 같은 칩셋 작가의 잎 질감이라 화풍이 맞는다.
  - 지시문에 덩이 단위(밝은 획·몸·바로 아래 어두운 구멍) 글자 그림을 넣었다.
  - 꽃밭: 블라인드 판정이 두 후보 모두 Q7 로 떨어뜨렸다(같은 크기 돌 상자·되풀이한 십자 꽃). 지시문에 「잎 더미가 고르지 않은 가장자리를 넘친다·한 색 꽃 무리·꽃 모양 글자 그림」을 넣었다.
  - 이 값들은 버들항 견본 묶음에서 잰 것이다. 다른 칩셋의 자연물 견본 묶음을 만들면 다시 잰다.
- **object-gen CLI 그리기 도우미**: `drawlib.fill` 은 자연물에서 2px 넘는 사각형을 거절한다. 원·타원 도우미는 일부러 없다.
- **시험(2026-10-22~23)**: 사과나무 2×3·덤불 2×2·꽃밭 2×1·돌무더기 2×2. 실제 입력창 경로를 썼고, 조수 대역은 Sonnet 5.5 high, 공방 중계는 Opus 이다. 보고서는 `~/claude-viz/objectgen-organic-1.html`.
  - 사과나무 9판. 3판부터 적대 검수의 「도형인가?」 물음에 수관·사과·줄기가 「아니다」로 나왔다. 반려 이유(달걀 수관·고리 테두리·네모 줄기·격자 네모 사과)는 사라졌다.
  - 그래도 매판 새 Opus 적대 검수가 잎 질감·윤곽에서 major 1~3을 찾았다. 같은 그림을 두 검수자가 보면 1개·2개로 갈렸고, 「더 밝다/더 어둡다」처럼 서로 반대로 말하기도 했다.
  - 덤불·꽃밭은 공방 블라인드 판정이 두 후보 모두 떨어뜨렸다. 돌무더기는 판정은 통과했지만 Opus major 2였다. **네 물건 모두 major 0 미달**이라 object-gate 위임 허용은 하나도 기록하지 않았다.
  - 반려된 옛 사과나무 위임 허용(b49084d1…)은 `supersede-holds` 로 물렸다.
  - 남은 한계: 그리는 모델(Opus 5.5 medium, 시도 2번)은 견본 같은 잎 덩이 질감을 안정적으로 못 찍는다. 검사를 하나 맞추면 다른 검사에 걸린다(LEAFFLAT 를 고치면 CROWNFULL 등). 후보가 하나도 안 남는 판이 늘었다.
  - QA 구동기(`scripts/qa/objectgen-assistant/real-input.mjs`)는 「후보를 그리지 못했어요」 때 판(시도마다 걸린 검사와 그림)을 `<id>-nocand-N.json` 으로 남긴다. 다시 그려도 없으면 45분을 기다리지 않고 끝낸다.

## 새 기물 그리기 품질 — 참고 그림 단계 · 크기·윗면 · 1배 읽힘 · 3/4 관문 조언 (2026-10-21)

> 아래 크기·윗면 숫자(`sizeProblems`·`topShareGate`)와 한국어 검수 지시문(READ·CONTEXT·looks_like)은 이제 **시트 그림을 고치는 판**에만 쓴다. 새 기물은 위 object-gen 흐름이다.

조수 「없는 기물」 시험 1(`~/claude-viz/objectgen-assistant-1.html`)에서 그린 소품이 앞면만 크고 윗면이 얇았고, 1×1 로 부탁한 벌통이 두 칸 높이로 나왔다. 새 기물(공방 폼·조수 카드) 판에 아래를 더했다. 있는 그림을 고치는 판은 그대로다.

- **참고 그림 단계** — object-gen(`MovieHolic-Plex/object-gen`, `objectgen/reference.py`)의 ref 단계를 옮겼다. 지시문 VIEW·NEGATIVE·TOP_WORDS, 이름 거부 IP_TERMS, 시점 검사 VIEW_PROMPT·`view_ok`(top34 + 윗면 ≥35%, 벽 앞 키 큰 가구·벽 걸이 15%), 시도 3번은 원본 문장 그대로다(`src/harnesses/_core/workshop/referencePrompt.ts` — 고치려면 원본부터).
  - 엔진 `makeReference`(판마다 한 번, 후보 셋이 같이 쓴다): 실행기 `referenceDescribe(item)`(바닥 무늬·벽 걸이는 없음) → `env.referenceImage(prompt)` → 512px 로 줄여 `workshop-review` 로 시점 검사 → 통과한 한 장을 그리기 지시문에 「참고 그림(모양만 — 참고용, 설치 안 됨)」으로 붙인다. 따라 그리기·줄이기·색 뽑기는 지시문이 금한다. 모든 화소는 모델이 팔레트 키로 찍는다.
  - **견본·비율·크기(2026-10-22, 사용자 「참고 그림이 너무 못 그려졌다」)**: 블라인드 A/B(Opus 판정, 같은 6요청: 짐마차·분수·나무·노점·상자·벤치)에서 새안 N 13점 > 옛 편집기 E 11 > 견본만 F 8 > object-gen 옛 띠 견본 O 4.
    원인 넷 — (a) 지시문은 「붙인 그림」을 말하는데 붙인 그림이 없었다, (b) 그림 경로 답의 절반이 투명 바탕 RGBA 이고 투명 칸 밑에 어두운 찌꺼기가 있어 알파를 버리는 쪽에는 검은 바탕·후광으로 보였다, (c) 「약 W×H 픽셀」 문장은 사람 척도가 없어 벤치 3.4:1·상자가 화면 가득, (d) object-gen 의 한 줄 띠 견본(약 4.6:1)을 붙이면 답도 그 비율이라 짐마차가 평면도·노점이 정면으로 나왔다.
    고친 것: 실행기 `referenceAnchor` 가 **물체 비율 캔버스**(`objectGenFlow.aspectSheet`, 원본 `reference.aspect_sheet` — wide 1536×1024 · tall 1024×1536 · square 1254²)에 이름이 맞는 칩셋 물체 ≤2 + object-gen 견본을 깔아 `env.referenceImage(prompt, signal, {image})` 로 붙인다(`pixels.ts` → `generateAiImage({referenceImages})`). 이름이 안 맞는 칩셋 물체는 넣지 않는다(아무 화분을 붙였더니 나무가 화분을 베꼈다). 크기 문장은 원본 `SIZE_NOTE`(칸 수 + 사람 1×2칸), 윗면 낱말은 크기 결정의 종류별 `top`. 답은 `flattenImage` 로 회색(원본 `BACKGROUND` 200,200,200) 바탕에 합성한 뒤 줄여 보관·검사한다. object-gen 쪽 고침(aspect_sheet·flatten·SIZE_NOTE·footprint.py)은 PR #4·#5, lock 8d894eb.
  - **견본 고르기·색(2026-10-22 VQA 2·3회차)**: 칩셋 물체는 이름이 맞는 것 → 크기 사전 종류가 같은 것(`classObjects` — 「건초 짐마차」↔「covered wagon」) → 칩셋의 여러 칸 물체 순이고, object-gen 실내 견본(침대·옷장)은 칩셋이 없을 때만 붙인다(야외 짐마차·분수 견본에 침대가 붙어 있었다).
    맵 기물 팔레트(`paletteFromImages`, 48색)는 빈도 순 36색 뒤에 **칩셋에 있는데 빠진 진한 색상**(색상 24칸 × 채도 2단, 칸마다 어두운·가운데·밝은 하나)을 채운다 — 빈도만 보면 버들항의 금빛 노랑(#dcaa4c, 빈도 62위)·빨강이 땅·돌 색에 밀려 빠졌고, 건초 짐마차가 1배에서 베이지 덩어리로 읽혔다(VQA major).
    그래도 그리는 쪽은 「참고 그림은 모양만」이라는 말에 색을 바래게 칠했다 — 그래서 첫 참고 그림의 물체 화소를 가장 가까운 팔레트 키로 옮긴 몫(`engine.referenceColors` → `round.reference.colors` → `DrawContext.referenceColors`)을 그리기 지시문 References 절에 한 줄로 넣고 「진한 부분을 베이지·회색으로 바래지 말 것」을 붙인다(화소를 베끼라는 뜻은 아니다).
  - 참고 그림은 **판 기록(`round.reference`, IndexedDB)에만** 둔다. 검수·3/4 조언·굽기·스토어는 보지 않는다. 칩셋에 들어가는 것은 격자뿐.
  - 그림 계정: 사용자 자기 생성형 이미지 계정(용도 `object-form-reference`, `src/ai/imageRoute.ts`, `pixels.ts` `referenceImage`). 계정이 없거나(`companionCredentialMissing`) 실패하면 참고 없이 그리고 카드에 「참고 그림 없이 그림 — 이유」를 적는다. 우리 주소·키·유료 대체 경로 없음.
  - dev QA: `window.__oprnWorkshopImage(prompt)` 가 있으면 그것으로 만든다(시험 구동기가 자기 경로를 env 로 잇는다 — 주소는 저장소에 없다). `window.__oprnWorkshopNoReference = true` 면 참고 단계를 끈다(있음/없음 비교). `engine.startRound(item, { reference: false })`.
- **크기·윗면 숫자**(`objectShape.ts`, 두 실행기 공용) — 지시문이 칠할 폭·높이(px)와 윗면 행 수(칠한 높이의 25~33%, 16px → 4~5행)를 숫자로 준다. 깨짐 검사 `sizeProblems` 가 높이 < 요청−10px 또는 폭이 한 칸 모자라면 돌려보내 다시 그리게 한다. 판정 `topShareGate`/`mapObjectGate` 가 검수자가 잰 윗면 행 수 하한 미달을 불합격(THIN)으로 본다. 조수 도구 `rise` 기본은 0(발밑 칸 안에 다 들어감), 공방 폼은 종전대로 16.
- **1배 읽힘·문화 맥락** — 정의에 `setting`(칩셋 → 「현대 일본 도시」「서양 판타지 중세 항구 마을」…, `objectGenTool.ts` `objectSetting`)을 싣고, 검수에 1배·2배 그림을 8배보다 먼저 보인다. 검수는 「1배에서 무엇으로 보이나(looks_like)」를 먼저 적고 READ(무엇인지 안 읽힘)·CONTEXT(이 배경에 안 맞음, 예: jp_city 의 영국식 부스)·SIZE·THIN 코드를 쓴다. 카드에 「검수 눈엔: …」로 보인다.
- **알아서 고르기 = 블라인드 검수 → 고르기** — 조수 카드의 「알아서 고르기」는 검수 통과 후보가 둘 이상이면 object-gen picker(`objectgen/picker.py`)를 옮긴 고르기 호출 한 번(`picker.ts`)으로 고른다. 사람 선택(`review.pick`)이 아니다.
- **3/4 관문 조언 배지** — 다 그린 후보마다 object-gate 와 같은 지시문(`OBJECT_GATE_RUBRIC`)·기준 그림(`public/assets/harnesses/object-gate/view34-*.png`)·측정 글(`facts.ts`)로 판정자 1번을 부르고 `decideObjectGate` 로 pass/refer/fail(`gateAdvice.ts`, `run.gate`). 배지 `gateBadge(run)`(`src/editor/workshop/gateBadge.ts`, 「3/4 통과 / 애매 / 미달 · 윗면 N행」). **넣기를 막지 않는다** — 미보정 1표라 object-gate 영수증이 아니다. 굽기는 설명서 `review.vqa`(`judge: workshop-object-gate-advice/<kind>`, `calibrated:false`)에 적는다. 공방 그림은 여전히 「3/4 관문 미통과」이고 스토어·공용은 접두사로 막힌다.


## 작업 줄 — 여러 개를 함께 그리기 (2026-10-21)

모든 생성 작업(공방 물건 폼 · 조수 `generate_missing_object` · char-gen/tile-gen/object-gen 묶음 가져오기)이 **한 줄**에 선다. 다운로드 관리자처럼 오른쪽 아래 알약(「공방 작업 · N개 진행」)을 누르면 판이 열리고, 편집은 그대로 계속한다.

- 코드: `src/editor/workshop/queue/` — `jobModel.ts`(순수: 상태·진행·남은 시간·멈춤 이유), `jobStore.ts`(IndexedDB `oprn-workshop-jobs`: 작업 + 묶음 그림 바이트, 못 열면 메모리), `workshopQueue.ts`(일정·멈춤·넣기, 싱글턴 `workshopQueue()`), `queueDock.ts`(알약·판), `chatHooks.ts`(모델 호출 앞뒤 고리). CSS `src/styles/database/workshop/queue.css`. 셸에 붙이는 곳 `editor.ts` `renderEditor`.
- **작업 하나 = 사용자가 기다리는 결과 하나**: 물건 한 판(후보 1~3장) 또는 묶음 하나. 물건 작업의 단계는 엔진 판에서 읽는다(정본은 판, `oprn-workshop`). 보이는 상태: 줄 서는 중 · 참고 그림(다른 작업자의 object-gen 참고 그림 단계가 판에 `reference` 를 달면) · 그리는 중 · 검수 중 · 고를 차례(묶음은 넣을 차례) · 넣는 중 · 넣음 · 못 그림 · 멈춤 · 그만둠.
- **동시 수**: 작업 1~10개(기본 10, `oprn:workshop-queue-limit`, 판·공방 머리의 「동시에」). 엔진 장 동시 수는 작업 수×3(엔진 상한 30, `MAX_ENGINE_CONCURRENCY`).
- **한도·로그인·연결 끊김**: 엔진이 장 오류에 `errorKind`(quota·rate·auth)를 단다(`runErrorKind`). 작업 줄은 막힌 장이 나온 작업을 멈추고 이유·풀리는 때를 보인다(공급자 「Resets in 61h28m」 또는 엔진 글 「약 2분 뒤 풀림」, 없으면 30분 · 몰림은 2분부터 두 배 30분까지 · 로그인은 사람이 다시 로그인하면). **계정 막힘 동안 다른 작업은 공급자를 부르지 않고 `chatHooks.before` 에서 기다린다**(두드리지 않기) — 때가 되면 작업 하나만 「탐침」으로 다시 해 보고, 통하면 모두 푼다. 연결 끊김(`Failed to fetch`)은 계정과 상관없어 그 작업만 20초부터 두 배(5분까지) 뒤 다시 그리고, 4번 넘으면 「못 그림」. 고를 후보가 이미 있으면 작업을 멈추지 않고 끊긴 장만 다시 그린다.
  - 실측(2026-10-21): 이 기기에서 크로미움이 `net::ERR_NETWORK_CHANGED`(Tailscale)로 도는 요청을 한꺼번에 끊는다(47건, 두 번). 고치기 전에는 10개 중 8개가 「못 그림」으로 끝났고, 고친 뒤에는 모두 저절로 이어 그렸다. `chatHooks.before` 를 기다리지 않던 버그(대기·시험 고장 둘 다 무효)도 이 시험에서 찾았다.
- **넣기는 맵 소유권을 지킨다**: 굽기(`workshopBake.ts`)·묶음 넣기(`genPackImport.ts`)를 `installOwnership.ts` `withInstallOwnership` 로 감싼다 — 그 칩셋을 쓰는 맵을 조수 실행과 같은 `editorAiMapRuns` 로 잠깐 잡고(칩셋을 쓰는 맵이 없으면 프로젝트 전체), 조수가 그 맵에서 일하는 중이면 `WorkshopInstallBusy` → 「넣는 중(기다림)」으로 두었다가 소유권이 풀리면 다시 넣는다.
- **저장·새로 고침**: 작업은 IndexedDB 에 남는다. 탭을 닫거나 새로 고치면(`pagehide`) 엔진을 dispose 해 도는 장을 「끊김」(queued)으로 남기고, 다시 열면 이어 그린다. 결과(칩셋에 넣은 것)는 프로젝트 정본(`project.sqlite`)에 들어간다.
- **느려짐 고침**: 장마다 칩셋 시트를 다시 풀던 것(버들항 23,936칸 시트를 수십 번 동시에 → 편집기가 2분 멈춤)을 `pixels.ts` `tilesetSource` 캐시 + `sheet.ts` 의 시트 조각·색 세기 WeakMap 캐시로 한 번만 한다. 첫 판에서 큰 시트를 처음 풀 때 한 번 3~5초 멈춤은 남아 있다.
- **시험 고리(dev 또는 localStorage `oprn:workshop-queue-qa=1`)**: `window.__oprnWorkshopQueue` — `snapshot()`, `fault429(jobId, "0h2m")`(다음 호출에 한도 막힘을 던진다).
- **실모델 시험(2026-10-21)**: 빌드 + `node scripts/oprn-serve.mjs --project-dir <폴더>`(정본 SQLite), 도트·검수 모델 Opus 5.5 medium(openai-compat 끝점), 폼으로 10개를 16초에 넣음 → 10개 동시 → 한도 흉내 → 2분 뒤 탐침으로 풀림 → 작업 줄에서 고름 → 저장·새로 고침 뒤 줄·넣은 결과가 남음. 증거 `verify-shots/workshop-queue/`.

- **참고 그림 단계 읽기**: 엔진은 참고 그림을 만드는 동안 `round.reference` 를 비워 두고 장을 모두 `queued` 에 둔다(끝나면 `{status: ok|none|failed}` 를 한 번 쓴다, pending 상태 없음). 작업 줄은 「reference 없음 + 모든 장 queued」를 「참고 그림」 단계로 보인다(`jobModel.referencePending`).
- **알아서 고르기**: 조수 요청 작업이 고를 차례가 되고 사용자가 「알아서 고르기」를 켰으면 작업 줄이 `assistantObjectGen.chooseAutoPick`(검수 통과 둘 이상이면 고르기 3번 다수결)으로 골라 굽는다. 고른 까닭은 피드백·카드 문구에 남는다. 3/4 관문 조언(`run.gate`)은 굽기 `review.vqa` 로 넘긴다.

## 생성기 저장소 고정 — `npm run gen-kits:sync` (2026-10-21)

공방이 생성기 저장소의 **어느 커밋**을 따르는지 lock 파일로 못 박는다(선례: 월드맵 키트 `worldmap-kit:sync`).

- **현재 상태(2026-10-22)**: 새 물건(object-gen 흐름)의 그리기·고치기·검수·고르기·참고 그림 글은 모두 `genKits/object-gen.json`(lock 고정 커밋에서 뽑은 원문 상수 + 견본 `set.json`)에서 읽는다(`objectGenFlow.kitValue`·`referencePrompt.ts`·`picker.PICK_RUNS`). 손 사본 `objectGenKit.json`·`scripts/content/extract-objectgen-kit.py` 는 지웠다. **그래서 object-gen 저장소를 고치고 lock 을 올리면(`-- --bump object-gen`) 다음 빌드부터 공방 지시문·판정 기준이 그 커밋 것이 된다.** 남은 예외: 시트에 이미 있는 그림을 고치는 옛 판(`interior-props/editor/prompts.ts`·`map-objects/editor/prompts.ts`)은 모노레포 하네스 글이고 object-gen 과 무관, 견본 없는 실행기용 짧은 `picker.PICKER_PROMPT` 는 편집기 자체 문장. char-gen·tile-gen(비공개)은 글을 공개 모노레포로 옮기지 않는다 — 지시문·판정 기준은 사용자 컴퓨터의 그 저장소 안에서 돈다. 대신 부탁 글 끝에 lock 커밋을 적어(`generators.generatorPinLine`) 사용자 에이전트가 같은 판으로 맞추게 하고, `fingerprint` 파일(char-gen `prompts.py`·`judge.py`·`quality.py`·`verify.py`, tile-gen `prompts.py`·`vqa.py`·`checks.py`·`gate.py`)의 sha256 지문을 `kits.json` 에 남겨 lock 을 올릴 때 「지시문·판정 기준이 바뀌었다」가 diff·`--drift` 에 보이게 한다.
- lock: `tiledata/gen-kits.lock.json` — 저장소마다 `repo`·`visibility`·`branch`·`commit`(40자)·`contract`(파일별 꼭 있어야 할 글·CLI 동사)·`vendor`(공개 저장소만: 뽑을 파이썬 모듈 상수·글 파일·그림).
- `npm run gen-kits:sync` — `.gen-kits/<kit>.git`(bare, gitignore)에 받고 `git show` 로 읽는다. object-gen(공개)은 모듈 상수(`scripts/lib/gen-kits-extract.py`, ast 로 대문자 상수만)·글 파일을 `src/harnesses/_core/workshop/genKits/object-gen.json` 으로, 기준 그림을 `public/assets/gen-kits/object-gen/` 로 뽑는다. 비공개(char-gen·tile-gen)는 계약만 검사하고 **글을 뽑지 않는다**(공개 모노레포로 새지 않게 — 비공개에 vendor 를 달면 거절). 요약 `genKits/kits.json`.
- `-- --check`(생성물이 lock 과 같은지·계약, 다르면 exit 1) · `-- --drift [--json] [--strict]`(lock 과 각 저장소 main 의 차이: 커밋 목록·편집기가 따르는 파일·상수 이름 차이·main 에서 계약이 깨지는지) · `-- --bump <kit>`(main 으로 올리되 계약이 깨지면 안 올림).
- 읽는 쪽: `src/harnesses/_core/workshop/genKits/index.ts` — `objectGenKit`, `kitConstant`, `kitText`, `kitFile`, `parseRamps`, `genKitPins`. 상수가 고정 커밋에 없으면 던진다(옛 글로 조용히 돌지 않는다).
- **드리프트 막기**: `npm run gen-kits:check` = `--check --only object-gen --max-behind 10` — 생성물이 lock 과 다르거나 lock 이 object-gen main 보다 10커밋 넘게 뒤처지면 exit 1, 1~10 이면 큰 경고(GitHub Actions `::warning::`). ci-fast 「생성기 고정판 (object-gen)」 단계가 돌린다(호스티드 러너는 비공개 저장소를 못 받아 object-gen 만). 편집기 빌드(`vite build`)는 `scripts/lib/genKitsDrift.mjs` 가 네트워크 없이 생성물 커밋 ≠ lock, 그리고 받아 둔 `.gen-kits/<kit>.git` main 보다 lock 이 뒤처진 수를 큰 느낌표 띠로 경고한다(`OPRN_GEN_KITS_STRICT=1` 이면 빌드 실패).
- 2026-10-22: object-gen lock → `7ebb92a`(main, 예제 추가뿐 — 상수 차이 없음). tile-gen 은 main 보다 11커밋 뒤(`cli.py`·`pack.py` 바뀜) — 담당자가 확인 뒤 `--bump tile-gen`.
- drift 실측(2026-10-21): object-gen = main 과 같음 · char-gen 1커밋 뒤(`d5f2639` 얼굴 상자 머리카락) · tile-gen 2커밋 뒤(`bf53597` 채우기 변형·지형 프리셋, `cli.py`·`pack.py` 바뀜). 둘 다 main 에서 계약이 맞아 `--bump` 로 올렸다(char-gen `d5f2639`, tile-gen `bf53597`).
