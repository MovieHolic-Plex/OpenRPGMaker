> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Architecture

- `src/main.ts` boot flow:
  - imports global CSS, reads feature flags from the URL into `body` classes, finds `#app`, then calls `bootApp(app)` from `src/app/mode.ts`.
  - after boot, it conditionally registers PWA support and can open a classic event-editor capture path for special debug params.
  - Shared tile references and the remaining catalog normally load after the shell. First-generation interview requests use `projectInterviewBootPreparation.ts` to join those same loads and apply reference refresh **before** save and immutable AI-base capture. The remaining catalog starts inside that preparation when needed, avoiding a wait on `bootApp()` returning. Ordinary editing still boots with only the default catalog; stale-base rejection is unchanged.

- **부팅 스플래시와 계측 (2026-10-15):** 편집기 첫 화면은 `index.html` 의 `#oprn-boot-loader`(`data-testid="boot-loader"`)다 —
  인라인 CSS·마크업만으로 첫 프레임에 그려지고(외부 자원·이미지 없음, 로고는 인라인 SVG), 단계 표시(4칸 이산: 앱 → 공용 자료 → 프로젝트 → 도구)·
  10초/60초 안내(지연 CSS 애니메이션이라 JS 없이 뜬다)·실패 화면(「다시 시도」 = `<a href="">`)·언어 분기(ko/en/ja/zh,
  `navigator.language` 규칙은 `src/i18n/locale.ts` 와 같다)는 `public/boot-splash.js`(외부 클래식 스크립트 — Electron `app://` CSP 가 인라인
  스크립트를 막고, 번들 로드가 실패해도 먼저 돌고 있어야 실패를 말할 수 있다)가 맡는다. 번들은 `src/app/bootLoader.ts` 의 `reportBootStage`·
  `failBootLoader`·`dismissBootLoader` 로 `window.__oprnBootSplash` 에 사실만 넘긴다(퍼센트 없음). 편집기 i18n 계층에 의존하지 않는다 —
  `data-i18n-skip` 으로 DOM 번역기를 비킨다(화면 글자 역참조 금지 계약, `openwiki/i18n.md`). 기존 `#oprn-boot-loader`·`boot-loader` testid·
  `data-leaving` 은 그대로라 e2e/캡처 스크립트의 «로더가 사라질 때까지 대기» 가 유효하다.
  계측: `src/util/bootMarks.ts` 의 `bootMark` 가 `performance.mark("oprn:boot:<이름>")` 을 새긴다(html · js-eval-start · js-ready · prepare · shared ·
  project · project-read · project-normalized · project-loaded · editor · shell-mounted · settled · failed-*). 콘솔에서 `__oprnBoot()`(요약)·
  `__oprnBoot(true)`(표). 스플래시 표시와 같은 신호다.
  첫 페인트 경로의 두 함정(실측): ① vite 가 head 에 심는 스타일시트(main.css 2.1MB)는 렌더 차단이라 `scripts/lib/deferStylesheets.mjs` 가 빌드 산출물에서
  body 끝으로 옮긴다(지연 모듈 스크립트는 차단 스타일시트가 다 올 때까지 실행되지 않으므로 FOUC 없음). ② 호스트가 head 끝에 심던 `bridge.js` 는
  modulepreload 수십 개 뒤라 HTTP/1.1 연결을 기다려 첫 화면을 늦췄다 — `electron/serve/runtime.ts` 가 `<meta charset>` 바로 뒤에 심는다.
  Electron 창은 `backgroundColor: #F7F8F8`(스플래시 바탕색)이고 `ready-to-show` 가 첫 프레임 뒤라 흰 화면이 안 보인다. 시작 화면(`start-screen.html`)도 인라인 로고 뼈대를 먼저 그린다.

- **웜 부팅 시간 줄이기 (2026-10-15, 웜 = 표식이 맞는 두 번째 부팅. 정상 상태 CPU 프로필로 큰 것부터):** 다섯 가지와, 해 보고 버린 것.
  ① 저장 기준본(`store.load` 의 `baselineFrom`)은 부팅 정규화를 건너뛰는 문서(표식 일치 · 대기 중인 얼굴 시트 보정 없음)에서만 타일셋·업로드 자산
  항목을 공유한다(`projectWithoutEventDraftsSharingSharedDictionaries`, 복제 1.5s 절약) — 정규화기가 돌 문서는 예전처럼 통째 복제한다(정규화기는 항목을 제자리에서 고친다).
  ② `installReferenceOwners` 는 번들 타일셋 44개를 전부 만들지 않고 물은 id 하나만 `bundledTilesetById` 로 만든다(참고문서는 둘이 JSON 동일, 0.6s).
  ③ `scripts/lib/jsonParseModules.mjs`(빌드 전용 플러그인)가 20k 글자 이상 JSON 모듈을 `export default JSON.parse("…")` 로 내보낸다 — 롤다운의
  `json.stringify` 는 큰 JSON 에 먹지 않아 `bundled-data` 가 34M 글자 객체 리터럴이었다(모듈 평가 시작 1.0s 빨라짐, gzip 크기는 +1.6%). JSON 모듈은 기본 내보내기 하나로만 쓴다.
  ④ `vite.config.ts` manualChunks 는 8MB 넘는 JSON(버들항·일본 도시 타일셋)만 자기 청크로 나눈다 — 한 스크립트는 한 스레드가 읽고 컴파일하므로 병렬로 풀린다.
  **더 잘게(1MB 기준 11덩이) 나누면 modulepreload 가 46개로 늘어 첫 페인트(스플래시)가 0.15s → 0.35s 로 늦어진다 — 첫 페인트가 이 최적화보다 우선이다.**
  ⑤ 자료집 미리 읽기(`scheduleDatabaseModalPrefetch`)는 첫 화면 뒤(`afterBootSettled`)에 시작한다(0.5s).
  첫 방문 전송량: `/__oprn/shared-content?scope=…&dedup=1` 은 같은 긴 글(캐릭터 256명이 각자 품은 같은 참고 시트·라이선스, defaults 28.4MB 중 15.2MB)을 한 번만 싣는
  전송 형식이다(`src/project/sharedContentDedup.ts`, 클라이언트가 같은 글로 되돌린 뒤 IndexedDB 캐시·설치로 보낸다. 요청에 `dedup=1` 이 없으면 예전 형식, gzip 13.1MB → 3.7MB).
  버린 것(근거): 브라우저는 http 에서 brotli 를 받지 않아(9888 은 http) 서버 brotli 는 이득이 없다 · `crypto.subtle` 도 비보안 컨텍스트(http://mdc-server)에는 없어 순수 JS sha256 을 못 바꾼다 ·
  색 키 반복문 손질은 67→40ms 라 되돌렸다 · Phaser 텍스처 만들기(약 1s, 첫 화면 뒤)·업로드 캐릭터 시트 변환은 동작이 바뀌어 건드리지 않았다.
  남은 가장 큰 비용: 빌드마다 첫 부팅(표식이 안 맞음)은 전 문서 요약 두 번 + 정규화기로 +10~15s(`src/project`·`src/assets` 가 바뀌는 배포마다 한 번).

- **데스크톱 시작 속도 (2026-10-20, 측정기 `scripts/perf/startup-bench.mjs`):** 앱을 켜서 시작 화면 카드가 눌리기까지 4.9~6.4s → 약 1.1~1.6s(박스 부하 40, 같은 부하의 빈 Electron 이 data: 한 장 띄우는 데 0.9~1.1s).
  ① 메인 번들(main.cjs)이 83MB 였다 — `loadRepair`·`io/serialize` 가 소유 참고문서 복원 때문에 번들 타일셋 전부를 끌고 왔다. `scripts/build-electron.mjs` 가 두 모듈을
  `dist-electron/project-core.cjs`(`electron/main/projectCore.ts`)로 떼고, 메인 번들 안에서는 «처음 읽힐 때 require 하는» getter 대역으로 바꾼다(소스·테스트·oprn-serve 는 그대로 원래 모듈).
  편집기가 프로젝트를 읽은 뒤 메인이 2.5s 쉬면(`app://`·IPC 요청 없음, 늦어도 60s) `preloadProjectCoreWhenIdle()` 가 미리 읽는다 — 편집기 부팅은 이 모듈을 안 쓰고 첫 저장이 쓴다. 시작 화면에서 미리 읽으면 1.7s 동기 require 가 카드 클릭→편집기 문서 요청과 겹쳐 편집기가 약 1s 늦어졌다(실측). Node 번들의 큰 JSON 은 `JSON.parse("…")` 문자열이다. 메인 단계 시각은 `globalThis.__oprnMainTiming`(`electron/main/startupTiming.ts`).
  ② 시작 화면 번들이 `@/project/io`·`@/player/oprnGameFile` 를 정적으로 가져와 묶음 청크 65MB 를 실었다 — 둘은 «게임 파일 열기» 안에서 동적으로 받고, accept 값은 `src/project/packageFormat.ts`.
  `vite.config.ts` 의 `HOME_SCREEN_JSON`(bundledConcepts.json)은 `bundled-data` 묶음에서 뺀다 — 시작 화면이 작은 JSON 하나 때문에 44MB 묶음을 싣지 않게. **시작 화면에 정적 import 를 더할 때는 묶음 청크가 끌려오지 않는지 `dist/start-screen.html` 의 modulepreload 를 확인한다.**
  ③ 편집기 진입 번들이 대표 데모 빌더(`@/project/flagship`, 예제 그림 약 18MB)와 이벤트 편집 모달→조수 도구 목록을 정적으로 품었다 — 데모는 `?demo=`·메뉴·환영 카드에서만 동적으로 받는다(`prepareDevShowcaseProjectFactory`). 정적 JS 93MB → 67MB.
  ④ `app://` 은 `codeCache` 권한(V8 컴파일 결과 재사용)을 갖고, HTML 이 아닌 정적 파일은 `net.fetch(file:)` 로 흘린다(메인의 readFileSync 복사 대비 2배, asar 안에서도 동작 확인, 실패하면 예전 길).
  ⑤ 공용 자료 304 는 본문을 만들기 전에 판본(SELECT)만으로 판정한다 — 새 호스트 프로세스(데스크톱은 매 실행)의 첫 요청이 304 로 끝날 일에 읽기·gzip 1s 를 쓰던 것.
  ⑥ 창 닫기는 창을 바로 숨기고 저장을 60s 까지 기다린다 — 예전 10s 상한이 새 빌드 첫 실행 뒤의 큰 자동 저장(71MB 프로젝트 13~16s)을 끊어, 다음 실행이 또 «첫 부팅»(+10~15s)이 됐다.
  남은 것: 편집기 진입은 여전히 번들 타일셋 JSON 67MB 를 동기로 싣는다(정규화·소유 참고문서 복원이 동기로 쓴다) — 지연 로드는 부팅 경로 비동기화가 필요하다. 웜 부팅 편집기 입력 가능까지 클릭 뒤 약 5~7s(부하 40).
- **게임 플레이어 로딩 (2026-10-23, 측정기 `scripts/qa/perf/game-load.mjs`·`export-formats.mts`·`editor-demo-load.mjs`):** 대표 데모(`player.html?demo=<id>`·런처 「플레이」 `/index.html?demo=<id>&play=1`)가
  브라우저에서 `createFlagshipDemoProject` 로 모든 맵을 지었다 — 타이틀까지 chrono-bell 134s(메인 스레드 131s)·shitamachi 33s·first-love 23s·emerald 11s, 편집기 「플레이」 chrono-bell 142s.
  이제 `npm run build` 의 `bake:demos`(`scripts/content/bake-flagship-demos.mts`)가 빌드 때 한 번 지어 `dist/demos/<id>.play.json`(웹 내보내기와 같은 투영)과
  `<id>.project.json`(편집기용 전체)을 쓰고, 출하 플레이어는 에셋 기준 주소(`exportAssetBase.ts`)의 `demos/` 를 읽는다. 빌더 import 는 `import.meta.env.DEV`(QA dev 서버) 분기에만 남아
  플레이어 번들에서 데모 빌더 청크가 빠졌다(dist/export-player 124MB → 65MB = 모든 웹 내보내기 zip). 굽기는 vite.config 를 타므로 `OPRN_ASSUME_ALL_BGM_INSTALLED=1`(입구 `.mjs` 가 넣는다)로 BGM 설치 define 을 끈다.
  **편집기 데모 열기 (2026-10-24):** 편집기 메뉴(샘플)와 컨셉 피드 오버레이의 데모 「열기」·「플레이」도 같은 구운 `demos/<id>.project.json` 을 읽는다 — 공용 입구 `src/editor/flagshipDemoLoader.ts` 의 `openFlagshipDemo`(앱 기준 주소 `document.baseURI` 상대 fetch, 진행 토스트, 이중 호출 방지). 구운 파일이 없을 때(dev 서버)만 브라우저 빌더로 물러난다. 「열기」는 `store.replaceProject` 로 호스트 프로젝트를 덮어쓰지 않고 새 프로젝트 폴더(`createProjectFolderWithSeed`)를 만든 뒤 리로드해 편집·저장이 남게 하며(브리지가 없을 때만 이 탭 메모리), 「플레이」는 저장 없이 메모리에서 시연 창을 연다.
  데모 타이틀까지(루프백) 5~7s. **형식은 원인이 아니었다:** 같은 게임을 웹 ZIP(정적 호스트) 5~6s, 실행형 HTML 7.5~10.5s(100~230MB 한 장 파싱), 50Mbps 회선에서 웹+gzip 7~8s·웹 무압축 17~22s·HTML 14~42s.
  남은 비용은 모든 게임이 받는 플레이어 묶음 청크 약 50MB(번들 타일셋 정의 JSON — tileMeta 설명·이름표가 대부분, gzip 2.8MB)와 project.json 파싱이다. 호스트는 gzip 이 필수다.
  같이 고친 것: 칩셋 카탈로그 행(resourceProfiles kind chipset)을 «사용»으로 세지 않는다 — 저작권 정리로 지운 합본 마을 칩셋 행 때문에 빈 프로젝트까지 웹·HTML 내보내기가 실패했다.
  실행형 HTML 은 iife 의 `import.meta.url`(`{}.url`) 때문에 «Invalid base URL» 로 빈 화면이었다 — `vite.standalone.config.ts` 가 상수로 define 한다.
- **시작 스플래시·입구 분리 (2026-10-21):** 아이콘을 누르면 app ready 직후 작은 스플래시 창(`electron/main/splash.ts` — data: 문서, 앱 아이콘·이름·진행 막대, 번들·프리로드 없음)이 뜬다.
  `dist-electron/main.cjs` 는 이제 가벼운 입구 `electron/main/boot.ts`(12KB, 빌드가 200KB 상한 검사)다 — 스킴 권한·한 번만 실행 잠금·링크 받아 두기를 하고, ready 에서 스플래시를 띄운 뒤(그려지길 최대 400ms 기다림) 본체 `app.cjs`(옛 main.ts, `startApp(boot)`)를 require 한다. 본체를 먼저 평가하면 ready 가 약 0.3s 늦었다.
  큰 창은 숨긴 채 만들고(`fullscreen` 은 보일 때 건다 — 리눅스는 생성자 fullscreen 이면 show:false 여도 창을 띄워 빈 화면이 스플래시를 덮었다), 시작 화면이 카드를 그린 뒤 `oprn:start.screenReady`(preload `startScreenReady`)를 보내면 보이고 스플래시를 닫는다. 신호는 rAF 없이 바로 보낸다(숨은 창은 프레임이 안 돈다). 신호가 없으면 문서 로드 6s 뒤 그래도 보인다.
  숨은 동안 문서 실패(did-fail-load·응답 4xx/5xx·렌더러 종료·preload 오류)는 스플래시에 원인과 「다시 시도」(#retry)·「닫기」(#quit)로 보인다. QA 진입점(OPRN_SMOKE_PAGE·OPRN_OPEN_PROJECT_DIR)과 Playwright 실행은 스플래시가 기본으로 꺼진다(`app.firstWindow()` 가 앱 창이어야 해서) — `OPRN_SPLASH=1` 로 켜고 `0` 으로 끈다(측정기는 켠다).
  스플래시 창은 만들자마자 보인다(`show: true`, 첫 프레임 = 문서와 같은 바탕색 `#111214`) — 2026-10-25 전에는 `ready-to-show` 까지 숨겨 스플래시 렌더러 기동(평소 0.3~0.4s, 부하 59 에서 1.2s) 동안 화면이 비었다. 메인 단계 `firstPixel` = `splashCreated`. 실측(부하 54~55, 4회 중앙값, `~/sa-audit/tools/bench.sh`): 처음 보이는 것 1.34s → 0.77s.
  `OPRN_STARTUP_TRACE=1` 이면 메인 단계를 stderr 에 찍는다. 실측(부하 64~72, 중앙값): 처음 보이는 것 1.41s → 0.72s, 카드 있는 시작 화면 1.52s → 1.46s. 남은 큰 비용은 렌더러 프로세스 기동(큰 창 생성 → 첫 페인트 약 0.45s)과 최근 목록 요약(project 행의 `current_json` 뒤 열을 읽느라 수 MB 넘침 페이지를 훑는다 — 디스크가 차가우면 프로젝트당 수백 ms).
- **편집기 열기 2단계 (2026-10-20): 번들 타일셋 정의 JSON 지연 로드.** 카드 클릭 → 편집기 settled 5.3s → 4.3s, JS 실행 시작 1.4s → 0.7s, 프로젝트 읽기 끝 3.9s → 2.4s(6회 교대 중앙값, loadavg 약 31).
  큰 칩셋 16종의 정의(`src/assets/*Tileset.json`, 약 43MB)는 `src/project/defaults/bundledJson.ts` 하나로만 읽는다(`bundledJson(key)` 동기 · `preloadBundledJson(keys)` 비동기).
  출처는 기본이 정적(`bundledJsonSources.ts` — 테스트·tsx·헤드리스·Electron 메인·플레이어는 예전 그대로)이고, **`vite.config.ts` 의 `bundledJsonLazyPlugin` 이 브라우저 변환(SSR 아님)에서만** `bundledJsonSources.lazy.ts`(`?url` 원본 JSON 자산 → fetch, 못 읽어 둔 것을 동기로 물으면 동기 XHR + 콘솔 경고)로 바꿔 끼운다. `resolve.alias` 로 걸면 같은 설정을 읽는 vite-node(`npm run harness`·`store`·`qa:export` …)까지 지연 출처를 타서 `XMLHttpRequest is not defined` 로 죽는다(#3103 회귀) — alias 로 되돌리지 말 것.
  열기에는 정의가 필요 없다: 저장본에서 뺀 번들 참고문서를 되돌릴 때 `bundledReferenceDocumentsById`(defaultAssets.ts)가 정의 없이 참고문서만 만든다(`createX().referenceDocuments` 와 같은 값 — 44종 대조 `scripts/perf/bundled-definitions-check.mts`).
  정의를 읽는 곳: 첫 부팅 정규화 직전(`store.normalizeCurrentProject` — 표식이 맞는 웜 부팅은 안 읽는다), 빈 폴더 새 프로젝트·전체 초기화 직전(`preloadAllBundledTilesetDefinitions`, 다 읽혀 있으면 null 이라 await 하지 않는다), 첫 화면 뒤 한가할 때 맵이 쓰는 칩셋 것만(`preloadBundledJsonForProject`, main.ts).
  **새 번들 칩셋을 더할 때:** 정의 JSON 이 크면 `bundledJsonSources.ts`·`.lazy.ts`·`bundledJson.ts` 의 `TEXTURE_KEYS` 에 함께 넣고 모듈은 `const data = () => bundledJson("…")`, 칸 수·줄 폭은 `*Sheet.json` 에서 읽는다. 참고문서 전용 함수(`xBundledReferenceDocuments`)를 `REFERENCE_DOCS_WITHOUT_DEFINITION` 에 등록하지 않으면 열 때마다 동기 XHR 로 정의를 읽는다.
  남은 진입 묶음 `bundled-data` 약 21MB = 참고문서 JSON(열기 때 복원에 필요)·몬스터 수집 시트·카탈로그.

- Phaser app split:
  - `src/app/mode.ts` owns the single active mode (`edit` or `play`), the shared Phaser game handle, and the DOM shell for topbar/main.
  - `bootApp()` loads the project store, seeds editor state from `startMapId`, renders the topbar, and enters edit mode.
  - If canonical project load fails with a validation/integrity error, `src/app/mode.ts` renders a recovery screen whose primary actions load a sample or blank fallback project through `store.loadFallbackProject()`. That path keeps remote/local saved data intact and disables remote persistence until the user explicitly reconnects or exports.
  - `enterMode()` tears down the previous mode, clears the main area, and lazily imports either the editor or player renderer.
  - `startEditGame()` and `startPlayGame()` build separate Phaser games with different scenes/resolution; `destroyGame()` is the shared cleanup path.
  - Game startup is generation-guarded: each tracked starter captures `++gameGeneration` before awaiting, and a game that finishes after `destroyGame()` or a newer start destroys itself instead of being adopted. An adopted game also destroys the previously tracked one. Without this, an orphaned game's `KeyboardManager` keeps listening on `window` and a second `EditScene` answers the same `Ctrl+Z` — one press undid two history entries. `src/player/exportAppModeShim.ts` mirrors the same contract for the export player, and `EditScene.handleKeyDown` additionally ignores keys when its canvas is detached from the document.

- `src/editor` responsibilities:
  - `src/editor/panels/editor.ts` is the editor shell: layout, panel mounting, resize handling, subscriptions, and canvas host creation.
  - It starts the edit Phaser game, refreshes the palette/map/tool/status UI, and exposes editor-specific teardown/toggles.
  - Most other editor files are feature modules for actions, panels, map/tile tooling, event editing, locking, and persistence UI.

- `src/player` runtime:
  - `src/player/player.ts` is the player shell: title screen, load UI, status menu, dialogue overlay wiring, and start/stop of play sessions.
  - It creates the play surface, starts `PlayScene`, bridges UI events to scene/session actions, and handles save-slot restore.
  - `src/player/PlayScene.ts` is the actual in-game runtime: map loading, movement, events, overlays, battle entry, and test hooks.
  - `src/player/playSceneTime.ts` owns calendar ticking, day/night tint, HUD snapshot state, and sleep transitions at the scene boundary; pure date math stays in `src/project/gameTime.ts`.
  - Session-only retry checkpoints are owned by `src/player/checkpoints.ts` and are restored through `PlayScene`; they must stay outside project JSON and save-slot persistence.

- Web player export boundary:
  - `player.html` and `src/player/exportEntry.ts` are the Vite player-only entry. They fetch sibling `project.json`, set the exported project store shim, configure the export save namespace, and start the normal player shell without booting the editor.
  - `vite.player.config.ts` builds `dist/export-player` with exact aliases for editor-only boundaries such as `@/app/mode`, `@/project/store`, `@/project/io`, `@/editor/tilesetImage`, `@/editor/cutscene`, and `@/project/eventCommands/m2Catalog`.
  - Player shims under `src/player/export*Shim.ts` must stay minimal and runtime-facing. Do not import AI, LegacyDb, editor panels, or generated-asset provenance/validation JSON into the export bundle.
  - `scripts/lib/playerArtifactContract.mjs` is the base artifact API facade. Its bounded seams are `playerContractCore.mjs` (paths/digests/errors), `playerArtifactInventory.mjs` (filesystem inventory/secret scan), and `playerManifestAtomicWriter.mjs` (value-free typed atomic replacement). `playerDeploymentManifest.mjs` is the deployment writer facade over `playerDeploymentContract.mjs` and `playerViteClosure.mjs`.
  - `src/player/runtimeAssets.json` is the single runtime-public-asset inventory. Both Node build validation and browser export validate its schema, normalized ordinal ordering, and case-insensitive collision freedom.
  - `src/project/playerDeploymentManifest.ts` is the browser API facade. Parsing/digests, fetch/hash loading, paths/runtime inventory, Vite closure, errors, and types live in focused `playerDeployment*` / `playerViteDeployment.ts` modules. `src/project/webExport.ts` is the packaging facade over `webExportAssets.ts`, `webExportZip.ts`, and `webExportTypes.ts` used by the editor menu and the headless `check_export_readiness` read tool (old name `export_game` still runs, deprecated).
  - Web export is fail-closed: no `player.js` fallback is allowed, every declared artifact/runtime byte is verified before ZIP creation, and Unicode 15 default full-casefold path collisions are rejected across manifest and generated ZIP entries. Browser and Node share the `unicodeCaseFold.js` facade over `unicode15Normalize.js`; the normalizer performs pinned NFKC → full casefold → NFKC without host `normalize`/casing calls. `unicode15Data.json` contains compact tables derived from digest-pinned Unicode 15 `UnicodeData.txt`, `CaseFolding.txt`, and composition-exclusion data, and malformed envelopes/streams fail during module initialization.
  - Community installation and play routing are reserved for the archived private [OpenRPGMaker-community](https://github.com/MovieHolic-Plex/OpenRPGMaker-community) extraction. The editor exports a pinned player artifact; it does not import the community app, its database, or its deployment code.

- `src/project` data/persistence:
  - `src/project/store.ts` is the canonical project store. It loads the project, normalizes defaults, emits updates, autosaves, and flushes to local or remote persistence.
  - Store subscribers receive a `ProjectChangeDescriptor` alongside the project. Omitted descriptors fall back to `scope: "project"` for full-refresh compatibility; editor map/tile paths use narrower map/database scopes to avoid unnecessary Phaser and panel redraws.
  - Persistence can come from LegacyDb, browser overrides, or dev-showcase overrides depending on environment/config.
  - Local dev `?blankProject=1` means a true blank project. `?freshProject=1` keeps its legacy meaning (sample adventure, no persisted override) because 32+ e2e specs and playtest drivers depend on it; example flags `sampleAdventure=1`/`defaultAdventure=1`/`defaultAdventureVisual` also remain.
  - `src/project/types.ts` defines the shared project schema used by editor, player, and battle systems, including authored ending definitions and optional `system.timeSystem` consumed by the player interpreter.

- `src/battle` boundary:
  - `src/battle/runtime.ts` is the battle state machine and should be treated as the core battle boundary.
  - It builds battlers and events from project data, advances turns, resolves commands/results, and returns battle snapshots/results.
  - Keep scene/UI code in `src/player/playSceneBattle.ts` and related player modules; keep battle rules and resolution logic inside `src/battle`.

- Layer dependency discipline: `app → {editor, player} → battle → project → {assets, util}`. No reverse imports.
  - `project` must not import from `editor`, `player`, or `ai`. Exception: `src/project/playerDeploymentPaths.ts` imports `runtimeAssets.json` from player (build-time data, not code).
  - `battle` must not import from `player`.
  - AI dependencies in `project` (editorIdentity, tileMetadataDb) use injectable setters wired at boot (`src/app/mode.ts`), not direct imports.
  - Event command catalog (`m2Catalog`, `runtimeSupport`) lives in `src/project/eventCommands/` — it describes what commands are, not how the editor renders them.
  - Content builders (showcase maps, village generation) live in `src/editor/content/`; `project/defaults/` re-exports them through a barrel for backward compatibility.
  - Action combat math modules live in `src/battle/action/` (moved from `src/action/`).
- **Genre packs** (`src/editor/genrePacks.ts`) are editor-only authoring metadata over the one `Project` schema and one runtime. `src/project/genrePackId.ts` is the canonical five-ID SSOT shared with later phases; welcome/card ids are mapped to blank-project system-preset recipe ids, not persistence aliases or authored-game promises. `src/project/genrePresets.ts` applies shared `system.*` fields. Welcome cards may optionally build an AI enhancement prompt; the confirmed manual path uses `store.loadNewRemoteProjectTransactionally` and does not dismiss or switch local state until flush + explicit-target save + reload verification succeed. Static `configured` checks never imply `playable`; readiness remains `unverified`/false until Phase 4 owns runner-backed evidence. Player/runtime code must not branch on genre.

- Source paths:
  - `src/main.ts`
  - `src/app/mode.ts`
  - `src/editor/panels/editor.ts`
  - `src/player/player.ts`
  - `src/player/PlayScene.ts`
  - `src/project/store.ts`
  - `src/project/types.ts`
  - `src/battle/runtime.ts`
