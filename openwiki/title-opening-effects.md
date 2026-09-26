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
  glow = `source`, camera = 모양 없음. `intensity` 0..2.

## 프리셋

`TITLE_OPENING_PRESETS`: `forestMorning`(숲 아침 햇살+바위에 꽂힌 칼+강+산 안개), `moonlitCastle`, `snowyVillage`, `mistyRuins`.
프리셋마다 이미지 프롬프트의 구도(`layout`, 그림 퍼센트)와 효과 좌표·로고/메뉴 질감을 함께 들고 있다.

## 런타임

- `src/player/titleEffects/shader.ts`(GLSL 300 es 한 패스) + `renderer.ts`(캔버스 수명·유니폼 인코딩).
  `titleScreen.ts` 가 배경 위·로고 아래에 `.rm-title-effects` 캔버스(testid `title-effects`)를 끼운다.
- 캔버스 dataset: `titleEffectsRenderer` = pending | webgl | unavailable, `titleEffectsCount`, `titleEffectsAnimated`,
  `titleEffectsSignature`. 서명이 같으면 다시 그릴 때 캔버스를 재사용한다(메뉴 이동마다 WebGL 을 새로 만들지 않는다).
- WebGL2 가 없으면 `unavailable` 로 남기고 효과 없이 타이틀만 보인다. `prefers-reduced-motion: reduce` 면 t=0 한 장만 그린다.
  캔버스 긴 변 상한 `TITLE_EFFECTS_MAX_CANVAS_EDGE` 1920.

## 저작 경로

- 편집기: 자료집 → 시스템 → 타이틀의 「오프닝 연출」 필드셋(testid `db-title-opening`) — 프리셋·효과 목록·로고/메뉴 질감,
  AI 버튼 `db-title-opening-ai-generate` 가 키아트까지 만든다.
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
  - 세기 슬라이더는 `change` 에서만 커밋한다(드래그마다 undo 가 쌓이지 않게). 0..2 로 자른다.

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

## 범위 밖 (이번에 안 한 것)

- 오프닝 컷신(`system.opening`) 과 이벤트 컷신에 같은 효과 층을 얹는 것. 효과 모델이 그림 좌표 기준이라
  스틸 한 장짜리 오프닝 장면에는 그대로 붙일 수 있지만, 배선·편집 UI 는 아직 없다.
- **효과 좌표 편집 UI 가 없다.** 편집기에서는 효과별 켜기/끄기·세기·삭제만 된다. 좌표(`source`/`toward`/`line`/`region`)와
  색·속도 같은 매개변수는 프리셋, AI 비전 맞춤, `set_title_screen` 도구로만 바뀐다.
  `TITLE_EFFECT_GEOMETRY` 는 위치 오버레이·드래그 핸들용으로 남아 있지만 아직 아무도 쓰지 않는다.
- 세기 슬라이더의 실시간 미리보기(놓아야 반영된다).
