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
