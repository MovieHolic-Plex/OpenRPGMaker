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
- 남은 일: tile-gen 견본 그림 (캐릭터·새로 그리는 지형은 이제 호스트가 직접 띄운다 — 아래 「한 번에 만들기」), item-gen 실체, 공방 굽기에 3/4 관문 영수증 배선.

## 한 번에 만들기 — 「딸깍」 공방 (2026-10-23)

사용자: 「공방이 졸라 불편하다. 딸깍 하고 나오는 수준이어야」. 왼쪽 공방 창 첫 화면이 이제 **입력 한 줄 + 「만들기」 하나**다
(`src/editor/workshop/oneClick/oneClickPanel.ts`, 창 `leftWorkshopPane.ts`). 위 생성기 카드·5단계 폼·부탁 글 복사는 뒤로 물러났다
(폼은 「후보 보고 고르기」·「없는 타일」 카드에서 그대로 열리고, 「만든 묶음 가져오기」는 글자 단추로 남았다).

- 탭 셋: 물건(object-gen) · 캐릭터(char-gen) · 지형. 예시 칩(「낡은 우물」「검은 머리 여고생」「용암 바닥」…)을 누르면 입력이 찬다. 빈 입력으로 누르면 첫 예시.
- **알아서 정하는 것:** 크기·놓는 방식·발밑(물건 = 조수 `request_object_art` 와 같은 `buildObjectGenRequest`, 크기 사전) · 넣을 칩셋 = 지금 맵 칩셋 ·
  후보 = 1장 · 고르기 = 블라인드 판정 통과 + 3/4 관문 영수증 PASS(아래 「2차」) · 칩셋에 굽기 · 다 되면 토스트 하나 「…완성! 맵에 놓기」 → 붓을 든다(맵 한 번 클릭).
  캐릭터는 프로젝트 캐릭터 목록(업로드 시트)에 들어가고 「맵에 놓기」 → 다음 맵 클릭 칸에 그 칩으로 NPC(`oneClick/place.ts`, `src/editor/mapPickHook.ts` 한 번 클릭 갈고리).
  `place_npc` 의 그래픽 해석기는 번들·공용 칩만 알아(업로드 시트 id 는 「textureKey 를 해석하지 못했습니다」) 기본 칩으로 세운 뒤 그 이벤트 페이지 그림을
  `{sprite:{type:"uploaded", id}}` 로 바꾸고 기본 칩용 얼굴(changeFace)은 뺀다. 타일 층에서는 이벤트가 「E」 배지로만 보이므로 놓은 뒤 이벤트 층으로 옮겨 그 NPC 를 고른다.
  지형은 지금 맵 칩셋에 새 자동 타일 그룹으로 들어가고 「맵에 놓기」 → 그 그룹 붓(이웃 연결 켬, 아래층).
- **「자세히」 안에만:** 후보 수 · 가로/키 · 「후보를 내가 직접 고르기」(물건), 몇 명(캐릭터), 방법·종류·후보 수(지형).
- **사람에게 관문·보류를 넘기지 않는다(2026-10-23 사용자 규칙).** 이 흐름에는 사람이 3/4 관문이나 보류를 판정하는 단계가 없다 — 통과 후보가 없으면
  물건은 판정 고칠 점(verdict.fix)으로 한 번 더 그리고(`ONE_CLICK_REROLL_NOTE`), 그래도 없으면 「못 그림」(이유 한 줄 + 「다시 만들기」)으로 끝낸다. 「그래도 넣기」 없음.
  지형 새로 그리기도 독립 검수 PASS 만 넣고, 없으면 실패. 후보를 사람이 고르는 길은 「자세히 → 직접 고르기」를 켠 경우뿐이다.
- 진행 카드 하나(닫아도 작업 줄에서 계속, 불씨 막대·그만두기) → 다 되면 썸네일 + 「맵에 놓기」.
  시간은 카운트다운이 아니라 **보통 범위**(물건·캐릭터 2~6분, 새로 그린 지형 20~30분, 넘기면 「평소보다 오래 걸리고 있어요」) — 남은 분을 세면 모델 호출마다 1→6→11→1분으로
  늘었다 줄었다 했다(적대 UX 검수 1차). 사람 차례로 읽히는 낱말도 뺐다: 이 흐름의 상태 이름은 「고를 차례」 대신 「마무리 중」, 「검수 중」 대신 「확인 중」(`jobStateLabel`). 같은 완성 알림이 두 번 뜨던 것(넣는 중에 판 화면 동기화가 같은 사건을 또 쏨)은
  `workshopQueue` 의 판 동기화가 `installing` 중인 작업을 건너뛰게 해 고쳤다.

### 캐릭터 = 호스트가 고정판 char-gen 을 띄운다
- 브라우저 → 동반 서비스 `POST /v1/workshop/gen`(상태 `GET ?jobId=`, 취소 `/v1/workshop/gen/cancel`) → `scripts/lib/workshopGen.mjs` 가
  `tiledata/gen-kits.lock.json` 의 커밋을 `~/.cache/oprn/gen-kits/<kit>-<커밋12>` 에 풀어(`.gen-kits/<kit>.git` 에서 `git archive`; 없으면 `npm run gen-kits:sync` 안내)
  사용자 컴퓨터의 에이전트 CLI(조수 엔진 설정 `oprn:assistant-engine` 의 CLI·모델, 없으면 깔린 첫 CLI)로 `cli.py draw … --backend agent` → `cli.py pack` 을 돈다.
  묶음(manifest + base64 blob)을 돌려주면 브라우저가 sha256 을 다시 재고(`hostGen.ts` `packFromHost`) 묶음 가져오기와 같은 길로 넣는다.
  vite dev·`oprn-serve`·Electron 이 같은 미들웨어(`ohMyPiHttp.mjs`)를 쓰므로 세 곳 다 된다. 키는 어디에도 없다(사용자 CLI 로그인).
- **왜 브라우저로 옮기지 않았나:** char-gen(파이썬 약 7,500줄 — 마스크·검사기)·tile-gen 을 TS 로 옮기면 갈라진 사본이 되고 비공개 프롬프트가 공개 저장소로 샌다.
  호스트에서 고정판을 그대로 띄우면 생성기 저장소의 수정이 lock 갱신만으로 들어온다. 바탕은 글 낱말로 고른다(`chooseCharBase`: 여자·소녀·아이·농부/노인·기본, Scarloxy People1 0~6).
- 실측(Sonnet, 같은 글 「검은 머리 여고생」 1명): CLI 직접 5분 37초(1차 행 폭 25 로 검사 탈락 → 2차 통과), 편집기 「만들기」 → 완성 토스트 4분 29초 · 1분 27초(첫 시도 통과).
  남은 시간은 호스트 어림(`expectMs`, 1명 5분)에서 센다 — 작업 줄 평균으로 「약 2분」이라 했다가 4분 반 걸렸다.

### 지형 = 빠르게(기본) 또는 새로 그리기(「자세히」)
- **빠르게(`src/project/workshopQuickTerrain.ts` + `oneClick/quickTerrain.ts`, 몇 초, 모델 없음):** 지금 맵 칩셋의 자동 타일(물·운하 / 길 포석 / 모랫길)을 하나 골라
  (물 같은 재질은 물 그룹, 돌은 길, 그 밖과 **「바닥·땅·길」이라고 한 글**은 모랫길 — 「용암 바닥」이 벽돌 둑 운하로 나왔다는 UX 검수 뒤),
  **칸 모양(가장자리 변형·움직이는 프레임)은 그대로 두고 재질 색만** 글에 맞게 바꾼 새 그룹으로 같은 칩셋에 덧붙인다. 재질 색 = 그 그룹 속 칸(모든 프레임)의 색,
  가장자리 칸에서는 그 색(과 RGB 거리 24 안)만 바꾸고 물가의 풀·돌은 원본 그대로. 색은 밝기 순 누적 비율 → 글의 색 단계 5단(용암·독·늪·핏물·깊은 물·얼음·눈·모래·돌·풀·흙·물 + 색 낱말).
  그림 = 업로드 자산 `wsterrain_<해시>`(16칸 폭) → `tileGrafts`(번들 끝·다른 이식 끝 뒤 새 줄, `sourceTileSize/sourceTilesPerRow` 를 적는다) + 그룹 `<원본 id>@wt-<해시8>`(연결은 자기 칸만) + `animationStrips`.
  같은 글·같은 원본이면 다시 늘지 않는다. 이음매·가장자리 판정은 원본 그룹과 같다(같은 칸 모양).
  **왜:** 고정판 tile-gen 으로 처음부터 그리면(Opus 그리기·판정) 2026-10-23 실측 세 번 — 용암 24분 SEAM·READ 탈락, 이끼 돌바닥 15분 READ 탈락(3차는 답 형식 오류), 눈 24.5분 2벌 중 A 통과.
  「딸깍」에는 맞지 않아 기본을 빠르게로, 새로 그리기는 「자세히」로 내렸다.
- **새로 그리기:** 호스트가 tile-gen 을 돈다(`tilegen new --candidates A[B]` → `auto --drawer <cli> --model opus --judge <cli> --judge-model opus` → `status` → 「checked + vqa PASS」 첫 글자를
  `tilegen.pack.write` 로 묶음). Sonnet 그리기는 권한을 묻고 JSON 을 안 내 실패해서 claude 기본 모델을 opus 로 둔다. 넣은 묶음은 새 칩셋으로 들어간 뒤
  `src/project/workshopTerrain.ts` `mergeTerrainIntoTileset` 이 **지금 맵 칩셋에 합친다**(칸 k → base+k 이식, 그룹의 variantMap·phaseVariants·interiorVariants·composer·animationStrips 를 같은 만큼 민다, 다시 합치면 그대로).
- 한계: 이식 칸은 `ensureBundledTilesets` 의 공방 칸 떼었다 붙이기(`workshop_` 접두사) 밖이라, 번들 칩셋이 칸을 늘리는 판본 갱신이 오면 겹칠 수 있다(다른 비공방 이식과 같은 한계).
  번들 칩셋에서 이식 칸의 움직임이 도는지는 그 칩셋 렌더러를 따른다.

### 물건 — 첫 결과 시간 줄이기
- 판정: 블라인드 판정 첫 두 번을 함께 돌리고, 둘 다 유효하고 판정이 같으면 거기서 끝(`aggregateJudge(results, 2)` — 셋 중 다수결과 같은 결과). 갈리면 세 번째(최대 다섯 번 안에서 유효 셋).
- 미리 보기 고치기(look): 「한 번에 만들기」 판은 1번(object-gen 기본 3번, `WorkshopRound.looks`).
- 조수 엔진이 내 PC CLI 면 참고 그림 단계를 건너뛴다(그림 계정 경로가 없어 401 「AI 연결이 끊겼습니다」 알림만 떴다).
- 내 PC CLI 경로의 요청 수명 10분(`LLM_LOCAL_CLI_TIMEOUT_MS`, 다른 공급자는 180초 그대로) — Sonnet high 그리기가 180초 504 로 잘려 한 장도 못 그렸다.
- 모델이 팔레트 줄 이름표를 키에 붙여 쓰면(「grey:7」) 하나로만 읽힐 때 고쳐 읽는다(`grid.ts` `resolvePaletteKey`: 같은 접미사 키가 하나뿐이거나 `#rrggbb` 가 팔레트 색과 같을 때). 전에는 세 번 다 「팔레트에 없다」로 떨어졌다.
- 실측(빈 프로젝트, oprn-serve SQLite, Sonnet 5.5 high **조수 대용**(local-cli:claude) — 사용자 계정 OAuth 경로가 아니다): 「낡은 우물」 「만들기」 → 완성 토스트 2.5~7분(아래 실화면 시험). 목표 2분은 이 대용 경로로는 못 맞췄다(CLI 호출 하나가 프로세스 기동 + 생각으로 1~3분).

### 실화면 시험
- `scripts/qa/workshop-oneclick-e2e.mjs`(생성기 하나당 1배 영상 + 단계 스크린샷 + 클릭 수·첫 결과 시간): `oprn-serve` 빈 프로젝트에서 「만들기」 → 토스트 「맵에 놓기」 → 맵 클릭/칠하기 → Ctrl+S → 새로고침 → 다시 찍기.
  정본 확인은 프로젝트 폴더 `project.sqlite` 를 읽기 전용으로(칩셋 본문은 `tileset_blobs` 의 `$blob` 해시).
- 클릭 수(맵 클릭 포함): 전 = 물건 폼 5단계(카드 → 새 물건 → 이름·설명·칸·방식 입력 → 후보 그리기 → 고르기 → 칩셋에 넣기 → 맵에 놓기) 9~12번, 캐릭터·지형 = 부탁 글 복사 → 내 에이전트에 붙여 넣기 → 묶음 폴더 끌어 놓기 → 이 게임에 넣기(편집기 밖 단계 포함).
  후 = 탭(필요할 때) + 예시/입력 + 「만들기」 + 토스트 「맵에 놓기」 + 맵 클릭 = 4~5번, 편집기 밖 단계 없음.
- 첫 결과까지(「만들기」 → 완성 토스트, Sonnet 5.5 high 조수 대용, 부하 15~38 인 공용 기기): 지형(빠르게) 4~7초 · 캐릭터 1.5~6.5분 · 물건 2.5~7분.
  같은 글로 여러 번 쟀고 폭은 기기 부하와 첫 시도 검사 통과 여부가 정한다. 물건 2분 목표는 이 대용 경로로는 못 맞췄다.
- 화면 함정: 공방 창(`.left-workshop-pane`)은 높이가 정해진 grid 라, 결과 카드가 붙어 창을 넘치면 grid 가 `overflow:hidden` 머리 그림 줄(자동 최소 높이 0)을 줄여
  작업대 그림이 잘렸다(116→104px). `grid-auto-rows: max-content` 로 줄을 내용 높이에 두고 창이 스크롤한다 — 아이템에 `flex-shrink:0` 은 grid 에서 듣지 않는다.
- 새로고침 뒤 물건 완성 카드는 판 기록이 아직 안 열려 그림이 비었다 — 카드가 그 하네스 묶음을 열고(`getWorkshopSession`) 다시 그린다.
- 새로고침 뒤 놓은 NPC 는 타일 층에서 「E」 표시로만 보인다(의도, 이벤트 층에서 그림). 시험은 층 단추 `layer-event` 로 바꿔 찍는다.
- 2회차에 남았던 작은 것들은 아래 「2차」 절에서 고쳤다. 「×」(닫기, 작업은 계속)와 「그만두기」 구분은 그대로다.

### 2차 (2026-10-23): 3/4 관문 배선 · 물건 속도 · 작은 것
- **물건은 3/4 관문(object-gate) 영수증으로만 들어간다.** 「한 번에 만들기」 판(`WorkshopRound.gate = "receipt"`)은 블라인드 판정 통과 뒤
  호스트 `POST /v1/workshop/gate`(`scripts/lib/workshopGate.mjs` → `judge.mts workshop`, 판정자는 프로필 그대로 — `openwiki/harnesses/object-gate.md` 「공방 단계」)를 부른다.
  관문은 블라인드 판정과 **동시에** 시작하고(판정이 떨어지면 멈춘다) 통과 장만 기다린다. PASS → 굽기 · REFER → 같은 판정자 새 적대 검사 한 번이 정함 · FAIL → 관문 근거(`fix`)로 한 번 다시 그리고, 그래도 아니면 「못 그림」.
  사람에게 관문을 보이지 않는다. 관문을 돌릴 수 없는 컴퓨터(bun·Claude Code 없음, 판정 모델 한도)는 그 자리에서 「그림을 확인하지 못해 넣지 않았어요」로 끝낸다 — 관문 없이 넣지 않는다.
  굽기 기록 `spec.gate` 에 판정·화소 해시·프로필 해시가 남는다. 이 판은 관문이 결과를 정하므로 옛 관문 조언 호출(`gateAdvice`)은 건너뛴다.
- 그리기 지시문(`ogDrawBrief`)에 관문 기준을 미리 적고(`DrawContext.gated` — 칩셋 소품 수준 명암: 칸당 보이는 색조 약 17~20, 재질당 5~6단), 기계 검사에 경고 `THIN`(칸당 보이는 색조 < 17, 풀·바닥 종류 제외)·`FLAT`(5×5 평면 > 20%)를 달았다.
  측정은 관문과 같은 `styleFacts`(`src/harnesses/object-gate/node/facts.ts`). 통과 판정에는 쓰지 않는다(경고만). 실측: 이 경고 전 낡은 우물 두 장이 모양은 맞았는데 「색조 14 vs 기준 20, 지붕이 납작」으로 4/4 탈락했다.
- 다시 그리기 경쟁 상태: 끝난 장이 아직 실행 목록(`running`)에 있을 때 들어온 `redrawRun` 을 조용히 버려 판이 멈췄다 → 끝나는 즉시 이어서 다시 그린다(`redrawAfter`). 자동 고르기가 같은 판을 두 번 부르는 것도 서명으로 막았다.
- 속도(물건 「낡은 우물」, Sonnet 5.5 high 조수 대용, 빈 프로젝트): 전 555.7초(그리기 162 · 전체 다시 그리기 104 · 시도 2 그리기 133 · 미리 보기 106 …) → 후 304.8초(관문 포함, 그리기 170 · 행 고치기 27·8 · 미리 보기 61 · 판정 11 ∥ 관문 25).
  줄인 곳: (1) 모델이 깨진 JSON 뒤에 「Wait — final answer」로 온전한 JSON 을 한 번 더 내면 마지막 온전한 것을 읽는다(`grid.ts` `jsonObjectCandidates`) — 전에는 90~100초 전체 다시 그리기였다.
  (2) 내 PC CLI 긴 호출을 undici 300초 머리 대기 대신 `node:http` 로(`ohMyPiPiAi.mjs` `postLongJson`) — 300.7초에 「fetch failed」 500 으로 판이 죽었다. (3) 관문 한 장 호출 20 → 11(눈 판정 답 공유), 블라인드 판정과 병렬. 품질 기준은 그대로.
  관문 FAIL 로 다시 그리면 한 장에 5~7분이 더 든다(같은 날 다른 시험: 두 장 다 화풍 FAIL → 16분 뒤 「못 그림」).
- 작은 것: 실행 중 캔버스 위 검은 띠·오른쪽 아래 검은 모서리는 **헤드리스 크로미움(SwiftShader) 합성 결함**으로 판명 — 캔버스를 숨기면 사라지고(`PROBE=1` 시험의 `*-3-done-nocanvas.png`),
  자리가 정확히 지도 도구 띠 그림자(위 8px)·스크롤 모서리다. Phaser 는 그 자리에 아무것도 그리지 않는다(`fillRoundedRect`·화면 고정 그림 없음). main 영상에도 같은 띠가 있다(공방과 무관). 도구 띠 흐림(`backdrop-filter`)을 빼 봤지만 그대로라 되돌렸다. GPU 브라우저에서는 재현하지 못했다(이 기기에 없음).
  진행 카드가 1초마다 견본 그림까지 새로 만들던 것 → 배치가 같으면 글자(시간)만 고친다(`refreshOneClickCard`).
  Ctrl+S 저장 토스트 중복 → 진행 중 저장은 같은 약속을 돌려주고(`saveProjectNow`), 결과 토스트는 한 키로 하나만, 키 반복은 무시.
  빠른 지형 결과 카드 → `localStorage` `oprn:workshop-oneclick-quick:<프로젝트>`(그룹이 칩셋에 있을 때만 되살림). 지형 탭 견본 = `public/assets/workshop/terrain-quick-stage.png`(버들항 물·포석·모랫길 칸, `scripts/content/workshop/build-quick-terrain-stage.ts`).
  NPC 놓기 커서 = 그 캐릭터 정면 첫 칸(`mapPickHook` `placeMapPickGhost`, `oneClick/place.ts` `characterGhost`). 용암 질감 = 원본 칸의 밝기 단계를 그대로 두고 재질 색 단계에 옮긴다(`quickTerrainShadeSteps`: 원본 색을 밝기 단(간격 10)으로 묶어 가장 흔한 단 → 재질의 기준 단, 나머지는 단 차이만큼; 용암 7단).
  「공방 작업 모두 끝남」 알약 → 진행·대기·완성 대기가 없으면 6초 뒤 숨는다(`queueDock` `pillWanted`, 못 그린 것은 「N개 못 그림」으로 함께 적고 알약을 붙잡지 않는다).

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
