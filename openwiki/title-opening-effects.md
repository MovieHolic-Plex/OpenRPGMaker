# 타이틀 오프닝 효과 (2026-09-25)

타이틀 화면 키아트 위에 빛내림·빛 알갱이·칼날 반사광·물결·안개·잎 그림자·불빛·카메라 호흡을
WebGL 한 장으로 얹는다. 그림은 이미지 모델로 만들고, 생성 뒤 비전 모델이 그림을 보고 효과 좌표를 맞춘다.

## 데이터

- `system.titleScreen`(`src/project/types/database.ts` `TitleScreenSettings`)에 선택 필드가 붙는다:
  `effects?: TitleEffect[]`, `backgroundFit`(cover|contain|stretch), `backgroundRendering`(smooth|pixelated),
  `logoStyle`(plain|metal|gold|stone|glow), `logoSubtitle`, `menuStyle`(window|plain).
- 순수 모델은 `src/project/titleEffects.ts` 하나다. 정규화·상한(`MAX_TITLE_EFFECTS` 12, 영역 꼭짓점 8, 알갱이 96)·
  프리셋·한국어 이름을 편집기·도구·런타임이 같이 쓴다. normalize 는 **omit-when-default** — 레거시 JSON 에는 필드가 생기지 않는다.
- **좌표는 배경 그림 전체 기준 0..1** 이다(화면이 아니다). cover 로 4:3 가운데를 잘라도 효과가 그림에 붙어 있다.
  빛 근원은 그림 밖(-0.5..1.5)도 허용한다.
- 효과 모양: godRays/motes = `source`+`toward`(motes 는 `region` 도 가능), glint = `line`, water/mist/dapple = `region`,
  glow = `source`, camera·parallax = 모양 없음. `intensity` 0..2. parallax 는 선택 필드 `depthResourceId`(깊이 지도 리소스)를 더 갖는다.

## 프리셋

`TITLE_OPENING_PRESETS` 10종: `forestMorning`(숲 아침 햇살+바위에 꽂힌 칼+강+산 안개), `moonlitCastle`, `snowyVillage`, `mistyRuins`,
`sunsetHarbor`, `crystalCave`, `volcanicFortress`, `blossomShrine`, `desertOasis`, `skyIslands`.
편집기에는 여기에 **「자유」** 칩(`TITLE_OPENING_FREE_PRESET = "free"`, `titleOpeningEditor.ts`)이 더 붙는다 — 프리셋 없이
장면 설명(필수, 4자 이상)만으로 그리고, 비전 모델이 그림을 보고 효과 종류와 좌표를 고른다(`runTitleArtGeneration(undefined, …)`).
맞춤이 실패하면 효과는 `camera` 하나만 남는다. 「지금 그림에 효과만 입히기」는 자유 모드에서 숨긴다.
프리셋마다 이미지 프롬프트의 구도(`layout`, 그림 퍼센트)와 효과 좌표·로고/메뉴 질감을 함께 들고 있다.

## 런타임

- `src/player/titleEffects/shader.ts`(GLSL 300 es 합성 + 입자 계산 패스) + `renderer.ts`(캔버스 수명·유니폼 인코딩).
  `titleScreen.ts` 가 배경 위·로고 아래에 `.rm-title-effects` 캔버스(testid `title-effects`)를 끼운다.
- 캔버스 dataset: `titleEffectsRenderer` = pending | webgl | unavailable, `titleEffectsCount`, `titleEffectsAnimated`,
  `titleEffectsSignature`. 서명이 같으면 다시 그릴 때 캔버스를 재사용한다(메뉴 이동마다 WebGL 을 새로 만들지 않는다).
- WebGL2 가 없으면 `unavailable` 로 남기고 효과 없이 타이틀만 보인다. `prefers-reduced-motion: reduce` 면 t=0 한 장만 그린다.
  캔버스 긴 변 상한 `TITLE_EFFECTS_MAX_CANVAS_EDGE` 1920.

## 저작 경로

- 편집기: 자료집 → 시스템 → 타이틀. 오른쪽 칸 맨 위 바로가기(`db-title-workbench-jump`: 오프닝 효과/글자·배경/메뉴/연출/소리),
  그다음 「오프닝 효과」 필드셋(testid `db-title-opening`)이 두 단계로 나뉜다.
  - ① 분위기 칩(프리셋 10 + 자유) → 장면 설명 → AI 버튼 `db-title-opening-ai-generate`(primary)가 키아트까지 만든다.
  - ② 효과 다듬기(`src/editor/panels/titleOpeningEditor.ts`): 켜진 효과 목록 + 고른 효과의 인스펙터.
  로고/배경/메뉴 질감 선택은 각각 「글자·배경」「메뉴」 묶음으로 옮겼다.
- **무대 손잡이**(`mountTitleEffectOverlay`): 무대 위 SVG(`viewBox 0 0 100 100`, `preserveAspectRatio=none`)에
  `TITLE_EFFECT_GEOMETRY` 로 고른 효과의 `source`/`toward`/`line` 끝점과 `region` 꼭짓점 손잡이(`g.db-title-effect-handle[data-handle]`)를 그린다.
  그림 밖(-0.5..1.5) 근원은 무대 가장자리에 붙여 점선(`.outside`)으로 보인다. 끌기 리스너는 `window` 에 단다 —
  끄는 동안 오버레이를 다시 그려 대상 요소가 바뀌기 때문이다.
- **인스펙터 실시간 조절**: 세기(0..2)·속도(0..4)·퍼짐 슬라이더와 색(+「기본색」)은 `input` 마다 반영한다.
  되돌리기는 `updateTitleScreen(mutator, "system:title-screen:effect-<i>-<이름>")` 키로 합쳐져 한 번에 한 단계만 쌓인다.
  끌기·슬라이더는 `host.liveEffects()` → `refreshTitleEffectsLayer` 로 **효과 canvas 만** 갈아 끼우고(`renderer.ts`
  `updateTitleEffectsCanvas`), 추가·삭제만 패널 전체를 다시 그린다. `SystemRefresh("effects")` 도 같은 뜻이다.
- CSS 함정: database CSS 는 전부 `layer(database)` 안이고, 일반 규칙
  `.database-modal-backdrop .database-modal-window .database-modal-body .db-field`(클래스 4개)가 이긴다.
  인스펙터 한 줄 슬라이더·primary 버튼 규칙은 같은 접두어를 붙여야 먹는다(`title-workbench.css`).
- AI 도구:
  - `set_title_screen` 에 `openingPreset` + `effects` 등 새 필드. 명시한 `effects` 가 프리셋 효과를 이긴다.
  - `generate_title_art(preset, prompt?, title?, logoSubtitle?)` (`src/editor/tools/titleArtTools.ts`). 헤드리스 `run` 은
    `ui-required` 만 돌려준다. 실제 생성은 조수 세션(`sessionTools.ts` 의 세션 쓰기 도구)이
    `generateTitleArt`(`src/editor/titleArtGeneration.ts`)로 한다: 기존 `generateAiImage` 경로(컴패니언 `/v1/images/generations`)
    → 비전 맞춤 → `titleArtToolCalls` = `upsert_resource`(kind title) + `set_title_screen`.
- **비전 맞춤**(`src/editor/titleArtFitting.ts`): 이미지 모델은 구도 지시를 대략만 따른다
  (실측: 칼이 70–78% 지시에 72–86%, 강이 52–63% 지시에 40–60%). 생성된 그림을 `chatCompletion` 에 image_url 로 보여 주고
  효과마다 앵커 JSON 을 받는다. `applyTitleArtFit` 은 순수 함수로 범위를 검사·절단하고, 못 받은 효과는 프리셋 좌표를 쓴다.
  맞춤 실패는 던지지 않는다(취소만 던진다).
- 편집기 미리보기 무대(`src/styles/database/title-workbench.css`)는 런타임 타이틀을 거울로 흉내 낸다 —
  효과 캔버스 전면, 왼쪽 정렬 제목, 로고 질감(`data-logo-style`)·부제·메뉴 스타일·첫 항목 선택, `titleMenuTop`.
  무대는 `container-type: inline-size` 이고 크기는 런타임 px ÷ 320 의 cqw 다.
  **무대에 `rm-title-screen` 계열 클래스를 붙이지 마라** — runtime 레이어가 database 레이어를 이겨 편집기 배치가 깨진다.
- 편집 안전장치(`databaseSystemView.ts`):
  - 프리셋 적용은 효과가 이미 있으면 확인창을 띄운다(효과·로고·메뉴 스타일·배경 맞춤을 덮는다).
  - 배경 그림을 바꾸면 효과가 옛 그림 좌표이므로 「효과를 지울까요」를 묻고, 예면 같은 갱신에서 `effects` 를 지운다.
  - AI 버튼은 실행 중 「생성 취소」로 바뀌어 `AbortController` 로 끊는다. 기존 배경·효과가 있으면 덮기 전에 묻는다.
    결과 문구는 비전 맞춤 성공과 「맞춤 실패, 프리셋 좌표 사용」을 구분하고, 취소는 「바뀐 것은 없습니다」로 끝낸다.
  - 슬라이더는 합치기 키로 undo 를 한 단계로 묶는다(위 「인스펙터 실시간 조절」). 세기는 0..2 로 자른다.

## 표본과 검증

- 표본 생성: `scripts/content/generate-title-art-samples.mts` — 네 프리셋의 키아트와 맞춘 효과를
  `verify-shots/title-opening/art/<preset>.jpg` / `.effects.json` 에 남긴다. 헤드리스라 맞춤은 컴패니언 `/v1/chat/completions` 를 쓴다.
- 런타임 QA: `npm run qa:runtime -- --scenario title-effects` (다른 프리셋은 `TITLE_FX_PRESET=moonlitCastle` 등).
  픽스처 `scripts/qa/runtime/title-effects-fixture.mts` 는 표본 그림으로 **편집기와 같은 도구 호출**(`titleArtToolCalls` → `runTool`)을
  돌려 프로젝트를 만든다 — player.html + export shim 까지 저작 데이터가 도달하는지 보는 것이다.
  결과는 `verify-shots/runtime-qa/title-effects/SUMMARY.md`(다른 프리셋은 `title-effects-<preset>/`) 부터 읽는다.
- 타이틀 DOM testid: 글자 제목 `title-text`(`h1.rm-title-screen-title`, `data-logo-style`), 그림 로고 `title-logo`,
  부제 `title-logo-subtitle`. 메뉴는 `.rm-title-menu[data-menu-style]`.
- 메뉴: 조작 힌트 줄(「방향키로 고르고…」)은 없다. 저작자 표기는 하단 한 줄 대신 **크레딧** 메뉴 항목
  (testid `title-credits`, 라벨 `menuLabels.credits`, 기본 「크레딧」)이 창으로 연다. 크레딧은 숨길 수 없다 —
  CC BY 계열 에셋 표기의 유일한 입구다.
- 배경 맞춤 기본값은 **stretch** 다(`backgroundFit` 생략 = stretch). 타이틀 배경·효과 셰이더·서명이 같은 기본값을 쓴다.
- CSS 함정: `src/styles/database/tabs-b-title-screen.css` 의 `.rm-title-menu-button.selected::before` 가 border 삼각형(17px/10px)을 준다.
  plain 커서는 `border: 0` 등으로 전부 덮어야 한다 — 안 덮으면 커서가 24px 마름모로 부푼다.
  금속 로고는 `background-clip: text` 라 상자를 넘친 글자는 칠해지지 않는다 → `width: max-content`.

## 입장 시퀀스 · 로고 반짝임 · 「새 게임」 전환 (2026-09-26)

- 데이터: `TitleScreenSettings.sequence?`(`fadeMs`·`push`·`sweep`·`logoAtMs`·`logoReveal` bloom|rise|fade|wipe·`menuAtMs`),
  `logoShine?`(none|once|loop), `transition?`(`kind` flash|fade|zoom|mist, `durationMs`). **필드가 없으면 그 기능은 꺼짐**이다 —
  `sequence: {}` 는 「켜짐 + 전부 기본값」(`resolveTitleOpeningSequence`: 암전 1600ms, 밀기 0.08, 로고 1100ms, 메뉴 +1100ms).
  전환 기본 길이는 `TITLE_TRANSITION_DEFAULT_MS`(flash 700·fade 800·zoom 1000·mist 1100). 프리셋 10종이 셋 다 값을 들고 있고
  `set_title_screen` 의 `preset` 도 같이 채운다.
- 런타임(`titleScreen.ts` `applyTitleOpeningSequence`): 검은 막 → 배경 페이드+카메라 밀기 → 빛 쓸기 → 로고 등장 → 메뉴 항목 차례.
  전부 CSS 애니메이션이고 이름이 `rm-title-seq-` 로 시작한다. 루트 `data-seq-state` = playing|done.
  **첫 입력(키·클릭)은 메뉴를 확정하지 않고 시퀀스만 끝낸다**(해당 이름의 애니메이션만 `finish()`).
  최초 진입(`playIntro`)에만 재생하고 방향키 이동 재렌더에는 재생하지 않는다.
- 로고 그래픽은 이미 `transform: translate(-50%,-50%)` 를 쓰므로 등장 애니메이션은 개별 속성(`scale`·`translate`)만 움직인다.
- 전환: `player.ts` `confirmTitleThen(…, true)` 가 「새 게임」에서 `playTitleTransition` 을 불러 `.rm-title-transition` 막을 얹고,
  돌려준 ms 만큼 기다린 뒤 맵으로 넘어간다. 설정이 없으면 기존 짧은 확정 연출 그대로.
- AI 로고(`src/editor/titleLogoGeneration.ts`): 모델이 투명 배경을 약속하지 않아 **흰 바탕에 그리게 하고**, 가장자리와 이어진
  밝은 무채색만 flood fill 로 지운 뒤(글자 속 흰색은 남는다) 6px 여백으로 자른다. 등록은 키아트와 같은 도구 묶음
  (`upsert_resource` kind title → `set_title_screen titleGraphic graphic`).
- 편집기: 「오프닝 효과」 ① 에 「로고 그림 만들기」(`db-title-opening-logo-generate`, 상태 `db-title-opening-logo-status`,
  다시 누르면 취소). ③ 입장·전환(`db-title-opening-entrance`)에 입장 연출 켜기/끄기·로고 등장·로고 반짝임·새 게임 전환 선택.
  **편집기 무대 미리보기는 효과만 그리고 시퀀스를 재생하지 않는다.** 「오프닝 다시 보기」(`db-title-opening-preview`)가
  `preloadRuntimeStyles()` 뒤 `.player-layout.system-shell` 안에 `renderTitleScreen(…, {playIntro:true})` 를 그대로 띄운다.
  런타임 `.title-screen` 은 부모의 100% 라 셸을 320×240 으로 고정하고 transform 으로 키운다. 「새 게임」은 전환을 재생한 뒤 처음으로 되감는다.
  **크기는 인라인으로 못 박는다**(셸 `display:block`, 타이틀 320×240). `title-workbench.css` 는 `layer(database)` 로 들어가고
  런타임의 `.player-layout.system-shell { display:grid }` 는 뒤 레이어(`runtime`)라 CSS 로는 못 이긴다 — CSS 만 고치면 타이틀 폭 0 인 빈 창이 된다(실측).
  창은 `document.body` 에 붙어 자료집 `.btn` 색을 못 받으므로 아래 막대 버튼(「처음부터」·「닫기」)은 어두운 바탕용으로 직접 칠한다.

## 깊이 시차 `parallax` (2026-09-26)

한 장의 키아트를 여러 겹처럼 움직이는 2.5D 카메라. 레이어를 손으로 자르지 않는다.

- **깊이 지도**: 흑백, 흰색=가까움·검정=멂. `src/editor/titleDepthGeneration.ts` `generateTitleDepthMap` 이 키아트를 참조 그림으로
  `generateAiImage` 에 넘겨 같은 구도의 깊이 그림을 받고, 명도 한 채널로 바꿔 0..255 로 늘린 PNG 로 만든다.
  편집기(`databaseSystemView.ts` `attachTitleDepthMap`)는 이를 `kind:"title"` 리소스로 `upsert_resource` 하고 켜진 parallax 효과의 `depthResourceId` 에 건다.
- **셰이더**(`shader.ts` kind 9): 두 번째 텍스처 유닛 `uDepth` 를 읽는다. 카메라가 약 27.3초 주기로 원을 그리며,
  픽셀마다 깊이 k 만큼 밀고 `1-0.03k` 로 확대한다. 변위가 깊이에 의존하므로 고정점을 5회 반복으로 푼다(가까운 물체 가장자리가 찢어지지 않게).
  `uHasDepth` 가 0 이면 `smoothstep(0.25,1.05,q.y)` — **「아래쪽이 가까움」 기본 기울기**로 움직인다. 지도가 없거나 못 읽어도 멈추지 않는다.
- **렌더러**: `createTitleEffectsCanvas({ depthUrl })` 가 TEXTURE1 로 싣고 dataset `titleEffectsDepth` = `loaded` 를 남긴다.
  `titleScreen.ts` 가 `depthResourceId` 를 URL 로 풀고, `resourceReferenceValidation.ts` 가 참조를 검사한다.
- **프리셋 10종 모두** `{kind:"parallax", intensity:0.8}` 를 포함한다. 효과가 한 번에 하나만 의미 있으므로 `applyTitleArtFreeFit` 은 camera 처럼 중복을 버린다.
- **저작**: 효과 인스펙터에 세기·속도와 깊이 지도 상태(`db-title-opening-depth-status`), 「키아트로 깊이 지도 만들기」(`-depth-generate`), 지우기(`-depth-clear`).
  카메라·시차는 색을 안 쓰므로 모양 `none` 효과에는 색 칸을 그리지 않는다. 「이 분위기로 키아트 만들기」 뒤 parallax 가 켜져 있으면 깊이 지도를 **자동으로 이어서** 만든다(실패해도 키아트는 유지).
- **함정(실측)**: `defaultTitleEffect` 에 새 종류 case 를 빠뜨리면 undefined 를 돌려 「효과 추가」 순간 편집 창 전체가 흰 화면이 된다. 새 kind 를 넣을 때 `defaultTitleEffect`·`applyTitleArtFreeFit`·인스펙터 색 기본값 세 곳을 같이 본다.
- 표본: `scripts/content/generate-title-depth-samples.mts` → `verify-shots/title-opening/art/*.depth.png`, 움직임 비교 webp(깊이/평면/전체) → `verify-shots/title-opening/parallax/`.

## 범위 밖 (이번에 안 한 것)

- 오프닝 컷신(`system.opening`) 과 이벤트 컷신에 같은 효과 층을 얹는 것. 효과 모델이 그림 좌표 기준이라
  스틸 한 장짜리 오프닝 장면에는 그대로 붙일 수 있지만, 배선·편집 UI 는 아직 없다.
- 시퀀스 타이밍(ms)은 편집기에서 숫자로 고치지 않는다(프리셋·도구 인자만). 스크러버·비전 채점·소리 박자 맞춤은 다음 단계. 깊이 시차는 한 장 변형이라 가려졌던 뒤쪽을 새로 그리지 않는다(세기 2 근처에서 가장자리 번짐).
- 효과 추가는 목록의 종류 선택으로만 한다. 무대에서 영역 꼭짓점을 새로 찍거나 지우는 것은 아직 없다(옮기기만 된다).

## 소프트웨어 WebGL 입자 계산 분리 (2026-09-28)

- `shader.ts`의 `moteData`는 기존 GLSL 해시·궤적·시간식을 그대로 쓴다. JS의
  `Math.sin`으로 옮기면 `fract(sin(n)*43758.5453)`가 작은 정밀도 차이를 위치 차이로
  증폭하므로 CPU 계산으로 대체하지 않는다.
- `renderer.ts`는 `EXT_color_buffer_float`와 framebuffer completeness를 확인하고,
  프레임마다 작은 RGBA32F 텍스처에 입자 값을 계산한다. TEXTURE2/3, 각각 최대 96×12,
  36KiB를 한 번 할당한다. MRT로 입자마다 한 번 계산해 두 texel에 위치/반경/수명과 반짝임을 나눠 담아
  기존 `smoothstep * sin(life*PI) * (0.4+0.6*tw)`의 곱셈 순서를 보존한다.
  활성 입자/효과 범위만 scissor로 그리고, 입자가 없으면 보조 패스를 생략한다.
- 색 패스는 원래 효과 순서와 입자 누적 순서를 유지한다. 반경 밖에서만 입자 계산을,
  합계가 정확히 0일 때만 cone boost를 생략한다. water/mist/dapple은 영역 마스크가
  **정확히 0**일 때만 noise/굴절을 생략한다. feather를 줄이거나 작은 값을 잘라내지 않는다.
- 부동소수 렌더 타깃을 지원하지 않거나 보조 프로그램 준비가 실패하면 기존 GPU 입자
  계산 경로를 사용한다(반경/마스크 조기 생략은 적용). 프레임 루프에 CPU readback은 없다.
  freeze/reduced-motion의 고정 시각, live update, resize, detach 시 context 해제 계약은 그대로다.
- 재현: `npx tsx --tsconfig tsconfig.app.json scripts/bench/title-effects.mts`.
  편집기 셸 없이 실제 렌더러를 Chromium SwiftShader에서 실행한다. 정적 구버전
  `test/fixtures/titleEffects/legacy{Shader,Renderer}.ts`와 3종 fit × 4시각 × 2효과 묶음의
  RGBA를 비교한다. 비어 있는 프레임은 실패다. readPixels로 완료를 기다린 전후 시간이며
  화면 제시 간격(rAF)과 같은 지표가 아니다. 출력은 `/tmp/shader-results.json`.
- 회귀: `test/titleEffectsShader.browser.test.ts`는 픽셀 오차 ≤1/255, 실제 GL 보조 패스 횟수,
  resize, detach, float-extension 미지원 + reduced-motion을 검사한다.
  `TITLE_EFFECT_BENCH_IMPLEMENTATION=legacy`는 현재 구현 자리에 구버전을 주입하는
  음성 대조다. 픽셀은 같지만 보조 패스가 없어 실패해야 한다.

실측(Chromium 149 SwiftShader, 320×240, forestMorning 7효과/입자 70개, 합성 배경,
2026-09-28): 3회 × 워밍업 4/측정 24프레임, 구·신 구현을 프레임마다 번갈아 실행했다.
readPixels 완료까지 중앙값은 **90.8→73.7 / 98.4→76.5 / 88.2→77.9ms**.
3개 중앙값의 중앙값은 90.8→76.5ms(15.7% 감소). 24개 픽셀 비교는 RGBA 바이트 차이 0.
공유 머신 loadavg 121.58/77.35/45.29, 실제 GPU/60fps 달성을 뜻하지 않는다.
블록 단위 교대 측정에는 한 회 역전(89.3→95.3ms)도 있어 성능 수치를 일반화하지 않는다.
브라우저 전용 테스트는 `--config vitest.browser.config.ts`로 파일 하나만 실행한다.
# 첫 제작의 필수 타이틀·오프닝 (2026-10-04)

첫 플레이 제작(`firstPlay` 계약)은 핵심 행동 → 장소 → 첫 조작 안내 → 작품 타이틀/오프닝 → 이미지 검수 순서다.
`scripts/lib/piTeamRuntime.ts`의 마지막 제작 단계는 24턴 + 보수 12턴 예산과 전용 도구를 가진다.
맵 담당의 예산 소진으로 타이틀을 생략하지 않는다. `system.opening`을 기본으로 끄던 지침을 제거했다.

- `scripts/lib/piPresentationTools.ts`: Pi의 `generate_title_art`·`generate_opening_image`를 실제 생성으로 대체한다.
  사용자의 독립 이미지 제공자/모델 설정을 상속하고 자격은 Node 동반 서비스에서 해결한다.
  생성 호출은 exclusive 쓰기이며 읽기 전용/마을 계약에서는 금지한다. 등록·연결 실패 시 전체 작업을 되돌리고,
  성공한 변경은 기존 체크포인트/SQLite 저장 경로를 따른다. 이미지 바이트를 텍스트 기록에 넣지 않는다.
- 타이틀 생성은 기존 16:9/중앙 4:3 안전 구도 프롬프트와 비전 효과 맞춤을 재사용한다.
  제공자의 상위 이미지 지침도 장면 그림에 단색 배경을 강제하지 않는다. 두 이미지 제공자의 취소 신호를 전달한다.
  원화의 smooth 설정은 효과 캔버스에도 적용한다. 확대되는 게임 무대의 실제 부모 크기로 그리며
  GPU 해상도 상한과 소프트웨어 GPU 0.5 배율은 유지한다. 오프닝 정지 그림도 cover로 화면을 채운다.
  서술은 keep-all로 한국어 낱말을 보존하며, 한 낱말이 화면보다 길 때만 anywhere로 나눈다.
- `firstPresentation.ts`: 작품 전용 등록 배경, 제목, 로고 스타일, 등장 순서, 전환, cover 맞춤을 요구한다.
  오프닝은 활성화·장면 그림/영상·짧은 서술·건너뛰기·각 양수 durationMs와 전체 12초 이내를 요구한다.
  기본 마을에 제목만 바꾼 결과와 꺼진/빈/글뿐인 오프닝은 거부한다.
- `show_title_opening`: 현재 연결된 타이틀/오프닝의 실제 원화와 설정을 모델에 전달한다.
  검수 완료는 전체 맵 이미지와 모든 연결 원화의 전달 및 5축 근거를 요구한다. 원화 교체도 검수 서명을 만료시킨다.
  SQLite 자산이 dataUrl 대신 내용 주소 ref를 가지면 브라우저 자산 브리지에서 실제 그림을 읽어 512px PNG로 전달한다.
  원화 검수는 실제 재생의 증거가 아니다. 정본 저장 후 재로드 및 내려받은 전용 플레이어에서 자연 재생을 별도로 확인한다.

회귀 계약: `test/piFirstPlay.test.ts`, `test/piFirstPresentation.test.ts`.
세션의 테스트 실행 제한을 따른다. 유닛/전체 게이트를 실행하지 않았을 때 통과로 보고하지 않는다.

## 시네마틱 장면 연출과 백그라운드 준비 (2026-10-04)

RPG 일곱 작품 공식 자료 조사/적용의 범위는 [rpg-opening-research.md](rpg-opening-research.md).
`system.opening.scenes`의 image 장면은 선택 `direction`을 저장한다. camera.from/to는
[초점x,초점y,배율](좌표0..1, 배율1..1.6), transition은 cut/dissolve/fade/flash와 0..1000ms,
최대4개 effects(godRays/motes/mist/glow), soundResourceId, narrationDelayMs(0..2000)를 지원한다.
`cinematicDirection.ts`가 파일 로드와 도구의 엄격한 계약을 공유한다. 틀린 좌표·효과 앵커·미지 필드는 버리지 않고 거부한다.
기존 none/fade/pan/zoom 장면은 그대로 읽는다. 편집기 이미지→이미지 교체는 direction을 보존하고
텍스트/영상으로 바꾸면 지운다. 움직임 변경은 기존 camera를 해제한다. 전환은 편집기에서도 선택할 수 있다.

`generate_opening_image`는 원경을 강제하지 않는다. `referenceResourceId`가 있으면 정본 그림을 읽어
512px PNG 참조로 이미지 모델에 실제 전달한다(브라우저·Bun 양쪽). 참조 읽기 실패는 생성 실패이며
참조 없이 다른 그림을 만들고 성공했다고 하지 않는다. 첫 제작 계약은 세 컷/실제 그림2장 이상/총12초이고,
`show_title_opening`으로 모든 연결된 원화를 검수한다. 단일 확대 스틸은 첫 제작 합격 조건을 충족하지 못한다.

`cinematicAssets.ts`는 플레이어 셸이 소유하는 2병렬·완료8항목 이미지 준비 캐시다. HTTP 그림을 blob URL로
공유해 컷 전환에서 같은 요청을 반복하지 않는다. 타이틀 첫 페인트 뒤 첫 두 컷을 준비하고 재생 중 다음 두 컷을 앞서 읽는다.
빠른 새 게임 입력은 첫 그림의 decode까지 타이틀을 유지한다. 그림 장면의 시간·카메라·효과·음성은
그림을 읽은 뒤 시작한다. 다음 그림을 기다릴 때 이전 프레임을 유지하고 실패에는 R 재시도/Enter 진행/Esc 건너뛰기를 제공한다.

엔진 모듈을 미리 읽되 게임 세션·Phaser 씬을 먼저 만들지 않는다(오프닝 중 자동 이벤트/게임 음악/입력 선행 금지).
기존 번들 워밍은 사용된 업로드 이미지·조사 아이콘도 포함하며 2병렬 low priority다. 오프닝 그림은 별도 캐시로 준비한다.
마지막 오프닝 프레임은 맵 준비 동안 배경으로 이어진다. Phaser 텍스처 생성/맵 구성까지 백그라운드로 완료하는 것은 아니다.
새 게임 취소/셸 종료는 타이머·미디어·WebGL·캐시를 정리한다. reduced motion은 카메라 이동/섬광/애니메이션을 비활성화한다.

시각 QA 보강: 다음 컷을 읽는 동안 이전 WebGL은 `freezeTitleEffects`로 rAF만 멈춘다.
디졸브가 끝나거나 이전 컷이 제거된 뒤 `stopTitleEffects`로 문맥을 해제한다. 화면에 남은
캔버스에 loseContext를 먼저 호출하면 Chromium이 흰 lost-context 그림을 합성할 수 있다.
출하 플레이어 촬영은 animations:allow로 실제 카메라·전환을 보존하고 이전 컷 대신
현재 `.cinematic-shot:not([data-previous-shot])`의 원화를 검사한다.

배경 엔진 준비에서도 `ensurePhaser()` → `import(PlayScene)` 순서를 지킨다. `PlayScene`은 모듈 평가 때 `getLoadedPhaser()`를 읽으므로 둘을 `Promise.all`로 병렬화하면 빠른 스킵에서 부팅이 실패한다. 로딩 QA는 Phaser 응답을 잡아 둔 채 Esc를 누른 뒤 해제해 이 의존성을 실제 출하물에서 확인한다.

## 글자·장면 오프닝 연출 (2026-10-04)

모든 `CinematicScene`(text/image/video)에 선택 `presentation`을 저장한다. 없는 기존
프로젝트는 기존 연출을 유지한다. `cinematicPresentation.ts`의 같은 엄격 파서가 프로젝트
로드와 조수 도구 입력을 검사한다. 스키마 버전·SQL 변경은 없다. 꺼진 장면과 게임오버
시퀀스에도 보존하며 종류 변경은 공통 연출을 유지하고 이미지 전용 direction만 분리한다.

- 기본형 `subtitle`/`prologue`/`chapter`/`memory`/`credits` + 선택 덮어쓰기.
- `text`: layout(center/bottom/left/credits), font(serif/sans/pixel), size(무대 8~64px),
  color(#RRGGBB), animation(none/fade/rise/typewriter/blur/scroll), delayMs/revealMs/exitMs(0~10000).
- `transition`: enter(cut/fade/dissolve/wipe/iris/flash), enterMs/exitMs(0~5000).
- `backgroundColor`(#RRGGBB), `letterbox`(상하 각각 0~20%).

시간은 durationMs 안에 포함된다. 짧은 장면은 등장·읽기·퇴장 예산으로 제한한다.
0ms는 수동 진행이므로 자동 퇴장/스크롤을 하지 않는다. 이미지는 direction 카메라·빛·SE를
함께 쓰며 presentation 전환과 글자 지연이 기존 direction 전환/자막 지연보다 우선한다.

플레이어 `cinematicText.ts`는 Intl.Segmenter grapheme 단위로 한국어·결합 문자·이모지를
안전하게 보인다. textContent만 사용한다. 1200자를 넘으면 전체 블록 페이드로 제한한다.
확인 첫 입력은 등장 중인 글자를 모두 표시하고 다음 입력은 장면을 넘긴다. Esc/중단/
미디어 재시도/장면 변경에서 타이머·애니메이션을 해제한다. 다음 그림 디코딩 중에는 이전
합성 프레임을 고정한다. reduced-motion은 전체 문장을 즉시 표시하고 크레딧도 정지된
스크롤 가능한 가운데 글로 보여 준다. 첫 프레임을 두 번의 requestAnimationFrame으로 정착시킨 뒤 장면/글자 시간을 시작한다.
마지막 이미지의 퇴장은 플레이어 셸이 소유한다: 맵 준비 중 마지막 그림을 유지하고 준비 완료 후
저작된 exitMs로 실제 맵을 드러낸다. 미리보기와 마지막 텍스트 장면은 장면 내 암전을 재생한다.

DB 「오프닝」/「게임오버」 장면 폼에서 기본형·글자·장면 전환·독립 퇴장 시간·색·띠를
직접 고른다. 새 편지/영화형/크레딧 시퀀스 프리셋은 같은 프로젝트 레코드를 쓰며 미리보기도
같은 재생기를 쓴다. AI set_opening/edit_opening은 presentation을 노출한다. 첫 제작은
사용자가 글자 중심을 요청한 경우 서로 다른 기본형으로 저작한 2개 이상의 text 장면도
인정한다. 기본 그림형은 최소 3개 이야기 장면과 서로 다른 실제 그림 2장 이상을 유지한다.

근거: `verify-shots/opening-typography/README.md`(실제 조수 → 정본 저장·재로드 →
수정하지 않은 UI 내보내기 → 출하 player.html 재생/GIF). 기능별 fixture는 실제 게임
저작과 구별하여 `features/SUMMARY.md`에 기록한다. vitest/전체 typecheck/게이트는
세션 실행 제한 때문에 실행하지 않는다. 회귀 계약은 `test/cinematicPresentation.test.ts`.

## 스토리보드·독립 그림 모션·원곡 BGM (2026-10-04 후속)

앞의 세 컷/12초 첫 제작 제한은 폐기했다. 그림 중심 기본은 서로 다른 실제 배경 5장 이상,
5~8컷/25~45초 권장·최대90초·자동진행·건너뛰기다. 의도적인 글자 중심의 기존 계약은 유지한다.
`firstPresentation`과 `firstScene` 두 검사 및 일반 context/capability 지침을 같이 바꿨다.

`direction.layers` 최대4개의 독립 그림을 저장한다. `cinematicLayers.ts` 엄격 파서가 SQLite 로드,
도구, 편집기 쓰기에 공통이다. width(무대 너비 비율0.05..1.5), depth(background/foreground),
easing(linear/ease-in-out/ease-out), frames2..8(at0..1,x/y-0.5..1.5,scale0.1..3,opacity0..1,rotation-180..180).
at은0 시작/1 끝·엄격히 증가한다. 각 그림은 배경 카메라와 별도로 WAAPI 이동/회전/등장한다.
reduced motion은 가장 선명한 저작 지점의 정지 구도로 바꾸고, 다음 컷 대기에는 실제 위치/불투명도까지
동결한다. 마지막 컷의 그림 조합은 canvas로 평탄화하여 맵 준비 중 유지한다(교차 출처 캔버스 실패는
기존 배경 인계로 복구). 효과 캔버스의 동적 빛/글자 자체는 평탄화하지 않는다.
편집기 기존 장면 카드의 「독립 그림」 아래에서 너비와 각 동작 지점을 네이티브 입력으로 수정한다.
`generate_opening_image(role:foreground)`는 투명 단일 대상을 실제 이미지 모델로 생성한다.
실제 투명 픽셀과 불투명 대상 픽셀을 검사하여 가짜 체커보드·전부 투명·불투명 배경을 거부한다.
512px 참조·원화 검수에 레이어도 포함되며, 없는 그림 참조는 도구와 파일 로드에서 거부한다.

음악은 `recommend_bgm` 후보의 전체 설명을 비교한다. 없으면 `generate_original_bgm`에 조수가
직접 쓴 4/4 악보(tempo40..160, bars4..32, tracks1..5, 전체512음표 이내)를 전달한다.
piano/bell/strings/bass, gain/pan과 MIDI pitch36..96·beat·duration·velocity를 지정한다.
`originalMusic.ts`의 순수 합성기가 실제 22.05kHz/16bit/stereo WAV를 만든다. 피크0.8 상한,
짧은 방 잔향·시작/끝 페이드가 있다. 외부 오디오 모델·음원 샘플을 쓰지 않는 악보 작곡+내장 합성이다.
끝 페이드 때문에 완전 연속 루프는 아니며, 복잡한 관현악/보컬은 지원하지 않는다. 일반 write 도구로
업로드 music과 프로젝트 설명을 등록하고 실제 체크포인트/SQLite/웹 내보내기 경로를 따른다.
음악이 없으면 첫 제작 완료 검사는 실패한다. 메타데이터 조회·WAV 생성 성공은 청취 검수의 증거가 아니다.

셸의 기존 이미지2병렬/lookahead2 캐시에 전경 그림도 포함한다. BGM은 별도 취소 가능 HTTP→blob
캐시에서 타이틀 표시 후 미리 받아 오프닝 재생 때 같은 URL을 재요청하지 않는다. 다음 컷 이미지/
전경을 준비하는 동안 현재 컷 시간·모션은 유지하고, 디코드 완료 후 새 컷 시계가 시작된다.
기존 시작 맵 이미지와 엔진 모듈 워밍은 유지한다. Phaser 씬/텍스처 등록 자체는 실제 시작 때 수행한다.
회귀 계약 `test/openingProduction.test.ts`; 이 세션의 vitest/전체 게이트 실행 제한을 따른다.
