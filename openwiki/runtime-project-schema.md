> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

## 강하게 다시 하기·장 표시 선택 필드 (2026-09-26)

`SystemRecords.newGamePlus?: { enabled; label?; carry: ("levels"|"skills"|"equipment"|"inventory"|"gold")[] }` 와
`SystemRecords.chapter?: { variableId; labels: Record<정수 문자열, 이름> }` 는 추가형 선택 필드다. `normalizeSystemRecords`
화이트리스트가 `normalizeNewGamePlusSettings`/`normalizeChapterSettings` 로 거르고, 꺼져 있고 이름·이월이 없으면(또는 이름표가 없으면)
필드를 생략해 옛 JSON 바이트를 지킨다. `validateSystem` 이 모양을 검사한다. `TitleScreenMenuLabels.newGamePlus?` 도 선택이다.
`EndingCondition` 에 `{ kind: "newGamePlus"; value: boolean }` 이 더해졌고 `validateEndings`·참조 검증이 받아들인다.
편집 도구: `set_project_settings({ newGamePlus, chapter })`(chapter.variableId 는 기존 변수여야 한다), `define_ending` 조건.
버전 증가·마이그레이션 없음. 런타임 계약은 [runtime-sessions.md](runtime-sessions.md) 의 같은 날짜 절.

## 높이 지형 `map.relief` — 선택 필드 (2026-09-26)

`GameMap.relief?: ReliefData` — `{ width, height, levels: number[], baked?: boolean }`(행 우선, 칸마다 0~14단). `baked` 는 절벽을 하위 층 타일로 구웠다는 표시(2026-09-27, `editor/tools/village/reliefBake.ts`) — 편집기가 덧그림을 그리지 않는다. `normalizeRelief`·`remapExtraLayers` 가 보존한다. **없으면 평지**이고 옛 맵은 바이트 단위로 그대로다.
권위 코드는 `src/project/relief/`(`types`·`edit`·`ops`·`check`·`render`).

- 불러오기: `io/shape.ts` `normalizeProjectRelief` 가 `normalizeRelief` 로 맵 크기에 맞추고 0~14 로 자른다. 전부 0 이거나 모양이 틀리면 필드를 **지운다**.
- 쓰기 규칙: 결과가 전부 0 이면 `relief` 를 지운다(붓·조수 도구 모두). 빈 `relief` 를 남기지 않는다.
- 크기 바꾸기·밀기·자르기: `mapLayers.ts` 의 `ExtraLayerFields` 에 `relief` 가 들어가 `cloneExtraLayers`/`remapExtraLayers` 가 같은 칸 번호로 옮긴다.
- 렌더: 편집기 `EditScene` 이 `renderRelief(effectiveHeights(h), {transparentGround:true})` 로 절벽 벽면·45° 대각선을 그려 1층과 3층 사이에 깐다.
- **한계(아직):** 덧그림 칩셋에서 높이는 그림만 바꾼다(구운 칩셋은 절벽 타일이 1층에 있어 통행·런타임에 그대로 나온다). 윗단 위 타일·이벤트·통행·런타임 플레이어 높이는 relief 를 모른다. 런타임(`player.html`) 렌더도 아직 없다.

## 맵 칸 2층·4층·그림자 — 선택 필드 (MZ식 4층 PR ①, 2026-09-24)

설계: `docs/superpowers/specs/2026-09-24-mz-four-layer-design.md`. `GameMap` 에 선택 필드 셋이 붙었다.
스키마 버전은 올리지 않았다(없는 맵 = 빈칸이라 이관이 없다).

| 필드 | 층 | 빈값 | 길이 |
|---|---|---|---|
| `lowerOverlayTiles?: number[]` | 2층(1층 위, 늘 캐릭터 밑) | `-1` | `width*height` |
| `upperOverlayTiles?: number[]` | 4층(3층 위, 3층과 같은 ★/○/× 규칙) | `-1` | `width*height` |
| `shadowBits?: number[]` | 그림자(2층 위·3층 밑) | `0` | `width*height`, 값 0..15 (bit0 왼위·bit1 오른위·bit2 왼아래·bit3 오른아래) |

- `lowerTiles`=1층, `upperTiles`=3층은 그대로다. 층 번호↔필드 이름은 `src/project/mapLayers.ts` 에만 둔다
  (`layerTileAt`/`setLayerTileAt`/`shadowAt`/`setShadowAt`/`cellLayerTiles`/`cloneExtraLayers`/
  `remapExtraLayers`/`cropExtraLayers`/`compactMapLayers`/`malformedExtraLayerKeys`/`EXTRA_LAYER_KEYS`).
- **쓰는 맵에만 생긴다.** `setLayerTileAt`/`setShadowAt` 은 빈값을 쓸 때 배열을 만들지 않는다.
  **모두 빈값이 되면 키를 뺀다** — 옛 맵과 새 맵의 JSON 이 같다. 정리 지점은 저장 경로가 아니라 칸을 비우는
  변형기 끝이다: `remapExtraLayers`/`cropExtraLayers`(크기 바꾸기·밀기·잘라내기·Pi 증분)는 스스로 정리하고,
  붙여넣기·영역 지우기(`editor/mapClipboard.ts`)는 끝에서 `compactMapLayers` 를 부른다. 목록은 `mapLayers.ts` 머리말.
- **검증:** `validateMaps`(`io/shapeEventFields.ts`) 는 1층·3층 길이를 엄격히 본다(틀리면 던진다).
  선택 필드는 배열이어야 하고, **길이가 틀리면 `console.warn`(맵 id + 필드) 후 그 필드만 버리고 불러온다** —
  선택 층 하나 때문에 프로젝트 전체가 안 열리지 않게. 저장 쪽은 `projectLint` 의 왕복 검사(`serialize-roundtrip`)가
  같은 경우를 **오류**로 보고한다(왕복 자체는 더 이상 던지지 않으므로 따로 센다).
- 저장 경로(`store.update`/`updateMap`/`updateMapTiles`/undo/`duplicateMap`/serialize·deserialize/웹 내보내기/
  `exportProjectStoreShim`)는 필드를 보존한다. `updateMapTiles` 는 `cloneExtraLayers` 로 깊은 복사한다.
- 통행: `collision.ts` — 맨 위(4층)부터 내려가며 빈칸·★ 를 건너뛰고 처음 만난 타일이 칸을 정한다. 1층은 ★ 여도
  그 자체로 정한다. 뜨거운 경로는 배열을 만들지 않는 `passabilityOf(ts,l1,l2,l3,l4)`/`cellPassability(ts,map,i)` 이고
  `layeredPassability(ts, tiles[])` 는 외부·테스트용 같은 규칙이다. 그림자는 통행에 관여하지 않는다.
- 옛 맵 불변 실측(2026-09-24): 번들 장소 참고 67 + `src/project/regionReferences` 41 + 픽스처 프로젝트 파일,
  맵 238개에서 기준 커밋(22121b817)과 HEAD 의 `drawMapTileLayers` 호출 기록·`canMove` 4방향 격자·게임
  `renderTiles` 깊이 기록이 모두 같았다(차이 0).
- 회귀: `test/mapLayers.test.ts`, `test/mapLayersPersistence.test.ts`(저장 왕복·undo·불러오기 버림·lint),
  `test/mapLayersEditing.test.ts`, `test/mapLayersOldMap.test.ts`(옛 맵에 키가 생기지 않는다).

## 이름별 게임 오버 (2026-09-23)

v4 선택 필드: `system.gameOvers?: {id,name,settings:GameOverSettings}[]`, `defaultGameOverId?:string`.
기존 `system.gameOver`는 공통 설정으로 보존한다. 명시한 ID → 프로젝트 기본 ID → 공통 설정 순으로 **ID가 생략된 단계만** 내려간다.
없는 명시적 ID를 다른 정의의 회복 지점으로 대체하지 않는다. `resolveGameOverSettings`가 이 계약의 단일 진입점이다.
고유하고 비어 있지 않은 ID/이름, 최대 64개, 기본 ID/명령 ID의 존재, 각 정의의 모든 미디어 및 귀환 좌표를 검증한다.
정규화·직렬화·웹 export 자원 수집이 이름별 설정도 보존한다. 스키마/앱 버전을 수동 변경하지 않았다.

`GameOverSettings` 추가 필드:
- `outcome?: "menu"|"recover"|"title"` (생략하면 기존 blackout만 recover, 나머지 menu).
- `musicResourceId?:string` (시퀀스 종료 후 결과 화면의 음악).
- `timing?: {fadeOutMs?,silenceMs?,menuDelayMs?,messageHoldMs?}` (정수 0..120000, 생략은 연출별 기본값).
- `gameOver`/`killPlayer` 명령의 `gameOverId?:string`은 특정 정의를 실행하며 명령 스택을 종료한다.

`test/gameOverLibrary.test.ts`에 호환성·저장 왕복·참조 오류·인터프리터 전달·귀환 계약을 추가했다. 이번 세션에서 Vitest/전체 typecheck/gates는 실행하지 않았다.


## 확정된 게임 기획 (2026-09-22)

`Project.gameDesignBrief?: GameDesignBrief`는 새 프로젝트 인터뷰의 저작 메타데이터다.
`version: 1`, 8개 선택지의 `presetId`, experience/activity/progression/detail/scope별
질문·항목명·원문·출처(`user | recommended`), 수정 가능한 확정 `summary`를 보존한다.
정규화는 `src/project/gameDesignBrief.ts`가 소유하고 `io/shape.ts`에서 읽는다. 필드가 없던
기존 프로젝트에는 값을 만들지 않으며, 존재하는 잘못된 값은 조용히 버리지 않고 거절한다.
답변은 각각 1,000자, 요약은 4,000자 한도다. 원문은 요약 수정과 별개로 남는다.
SQLite 및 JSON 저장/내보내기에는 일반 프로젝트 필드로 함께 들어가며 게임 Save 슬롯은 아니다.
문서 스키마·앱 버전을 손으로 올리지 않는다.

선택적 `generationPending`은 메뉴 생성 시 새 폴더 부팅으로 AI 지시를 넘기는 표식이다.
새로 연 프로젝트에서만 삭제·저장한 뒤 전송을 예약한다. 실패하면 같은 프로젝트의 표식을
다시 살리고 보내지 않는다. 확정 기획은 고정 프리셋 분위기보다 우선하지만 선택한 시스템을
바꾸지는 않는다. 구현/UX/검증 범위는 [장르 프리셋 인터뷰](editor-genre-packs.md).

## LegacyDb 잔여 의존 정리 (2026-09-21)

현재 정본은 SQLite다. `tileMetadataDb.ts`의 load/save/clear 공개 함수는 저장소 중립 이름을
사용하며, 호출자가 없던 LegacyDb 별칭을 제거했다. 실제 저장소 선택과 clear의 기존 no-op
동작은 유지한다. 제거 범위·이관 도구의 한계는 [storage-retirement.md](storage-retirement.md).
과거 LegacyDb 필수 지시는 현행 콘텐츠 저장 계약이 아니다. AGENTS의 SQLite 저장+재로드를 따른다.

## 종족 전투 뒷모습 리소스 (2026-09-20)

`MonsterSpeciesGraphic.backResourceId?: string`은 선택적 후면 전투 이미지 참조다. 기존 문서에는 없어도 되며 normalize는 공백 값을 정리한다. IO 참조 검증은 정면과 같은 monster 리소스 계약을 적용하고, 웹 export의 재귀 문자열 수집으로 이미지도 패키징한다. DB 도구 스키마와 종족 그래픽 편집기에 같은 필드를 노출한다. 방향이 back인 파티에서만 선택하며 미지정 시 정면 fallback을 유지한다. 버전 수동 증가는 없다. save/load/export 계약 테스트는 `test/monsterBackSprite.test.ts`에 추가했지만 세션 규칙에 따라 실행하지 않았다.

## 웹 프로젝트 생성과 선택 (2026-09-18)

브라우저 호스트는 기본 폴더의 `.oprn-projects/<uuid>`에 프로젝트별 SQLite를 만든다.
`hostProject` URL과 RPC 헤더/에셋 경로로 탭별 저장 대상을 선택한다. 기본 프로젝트의 팀
권한을 공유하며 생성은 owner 전용이다. 상세는 `team-project-host.md`의 웹 새 프로젝트 생성 절.

## 팀 프로젝트 서비스 (2026-09-18)

현재 저장 경로와 팀 협업 계약은 [team-project-host.md](team-project-host.md)를 먼저 읽는다.
Electron IPC와 브라우저 HTTP가 같은 서비스로 SQLite·에셋을 사용한다. 일반 정적 웹 빌드의
메모리 폴백과 `scripts/oprn-serve.mjs`가 주입하는 브리지 실행 경로를 혼동하지 않는다.
아래 9월 16일의 «웹은 QA 전용», «로컬 단일 작성자라 잠금 없음» 설명은 과거 상태다.

## 로컬 SQLite 정본과 저장소 포트 (2026-09-16)

정본이 "원격 Postgres 프로젝트 행"에서 "사용자가 고른 폴더의 `project.sqlite`"로 옮겨가는 중이다.
설계는 `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md`, P1(포트 추출)은
PR #845, P2(로컬 어댑터·Electron 셸)는 브랜치 `local-store/p2`가 main에 병합된 상태다.

- **포트**: `src/project/persistence/types.ts`의 `ProjectRepository` 하나를 `repository.ts`가
  호출 시점에 고른다 — preload 브리지(`window.oprn`)가 있으면 Electron 어댑터, 없으면
  **메모리 어댑터**. store와 주변 모듈은 더 이상 LegacyDb를 직접 부르지 않는다.
- **로컬 어댑터**: `electron/local-store/`는 `node:sqlite`(`DatabaseSync`)만 쓰는 Node 전용
  라이브러리다. electron을 import하지 않으므로 헤드리스 도구가 같은 폴더를 같은 라이브러리로 연다.
  폴더 모양은 `project.sqlite` + `assets/` + `backups/`(`VACUUM INTO`), 형식 버전은 `meta`에 있다.
  스키마는 10테이블(meta·project·maps·commits·changes·ai_activity_logs·ai_conversations·
  ai_analysis_runs·assets·tileset_blobs)이고, 저장은 단일 트랜잭션 + sha256 CAS + 리비전 증가다.
  PRAGMA는 `journal_mode=WAL`·`synchronous=FULL`·`busy_timeout=5000`·`foreign_keys=ON`.
- **타일셋 접기 (2026-09-27)**: `project.current_json` 의 타일셋 칸은 `{"$blob":"<sha256>"}` 표식이고
  본문(`JSON.stringify(tileset)`)은 `tileset_blobs` 에 내용 주소로 한 번만 있다(`electron/local-store/tilesetFold.ts`).
  **저장 행만 접힌다** — `current_sha256`·`exportSerialized()`·`loadSnapshot()`·렌더러 와이어는 펼친 글 기준이라
  예전과 바이트 단위로 같다. 낡은 행(표식 없음)은 그대로 읽히고 다음 저장에서 접힌다. 펼친 글이 아닌 형식
  (들여쓴 JSON 등)으로 `saveSerialized` 하면 접지 않고 그 글을 그대로 둔다. 저장마다 현재 행이 가리키지 않는 본문은 지운다.
  호스트 맵 패치는 `hostDocument()`(타일셋은 얼린 공유 객체, 바깥 트리는 매번 새 것)를 기준으로 쓰고,
  저장은 객체 신원으로 본문을 재사용해 바뀐 타일셋만 직렬화한다. 실측(82MB 프로젝트): 행 81.6MB → 1.0MB.
  **`current_json` 을 SQL 로 직접 읽는 스크립트는 표식만 본다** — 문서는 `openLocalProjectStore().exportSerialized()`
  또는 `scripts/oprn-store.mjs export-json` 으로 읽는다.
- **가드**: SQLite 드라이버 import는 `electron/local-store/**`만, `electron/**`는 `src/brand.ts`·
  `src/project/types/**`·`src/project/persistence/core/**`만, `src/**`는 `electron/shared/**`만
  import한다. 렌더러 파일 이름에 `sqlite`를 쓰지 않는다. `test/noLocalProjectDb.test.ts`가 이 경계를 지킨다.
- **헤드리스**: `scripts/oprn-store.mjs`(init·info·import-json·import-package·export-json·backup·
  import-legacyDb)와 `scripts/oprn-tools.mjs --project-dir <dir>`가 폴더를 연다.
  계약은 `test/localStore/headlessProjectDir.test.ts`(폴더 열기)와 `test/persistence/*`(공유 계약).
- **패키징(P5 진입, 2026-09-17)**: `electron-builder.config.mjs` + `npm run package`/`package:dir`
  → `release/linux-unpacked`(asar 안에 dist/+dist-electron/). 개발 스모크(`electron:smoke`는
  `dist-electron/main.cjs`를 직접 띄운다)와 다른 경로라 `scripts/qa/verifyPackagedApp.mjs`
  (`npm run qa:package`, 헤드리스는 xvfb-run 필요)가 실제 바이너리로 시작 화면→폴더 열기→
  편집기 캔버스→폴더 영속화를 증명한다.
  - **출하 번들 env 스크럽**: `legacyDbProjectConfig`가 `import.meta.env`를 통째로 직렬화하므로
    `.env.local`의 모든 `VITE_*`(LegacyDb 주소·키, LLM 키 등)가 번들에 박힌다. `package`/`package:dir`는
    `build:packaged`(`vite build --mode packaged`)를 타고 `.env.packaged`가 `.env.local`보다 우선해
    원격·비밀 변수를 빈 문자열로 덮는다 — 패키징 앱의 원격 연결은 사용자가 설정 화면에서 넣는다.
    새 `VITE_*` 비밀을 추가하면 `.env.packaged`에도 빈 값으로 나열해야 한다.
  - **「폴더 열기」의 isNew**: `start:openFolder`가 `project.sqlite` 없는 폴더에 `projectId:null`을
    돌려 시작 화면이 무반응이었다 → `sessions.open`을 무조건 타서 스토어를 만들고 `isNew`만 정보로
    둔다(아래 빈 폴더 채택과 같은 경로로 빈 프로젝트가 열린다).
  실측으로 잡은 패키징 전용 결함 셋:
  - 시작 화면이 폴더를 열어둔 채 부팅해도 첫 방문 게이트가 공용 데모 fetch를 시도해 CSP에
    막혀 로드 실패 화면으로 떨어졌다 → `store.hasAdoptedLocalProject()`를 게이트에 추가
    (`src/app/mode.ts`).
  - 비어 있는 로컬 폴더(새 프로젝트)는 `project.load`가 null을 돌려 "선택한 작업을 찾지
    못했습니다"로 DB 연결 화면에 갇혔다 → `store.load()`가 로컬 대상+빈 문서를 "새
    프로젝트"로 채택하고 dirty로 둬 첫 flush가 폴더에 심는다. 회귀는
    `test/persistence/localFolderBoot.test.ts`.
  - `mapEditLocks`가 `isRemotePersistenceEnabled()`만 보고 원격 REST(`map_edit_locks`)를
    불러 CSP 에러를 냈다 — 로컬 정본은 단일 작성자라 `store.usesLocalProjectFolder()`로
    락 경로 전체를 스킵한다.

### 데스크톱 앱이 실제로 뜬다 (2026-09-16)

P4 셸 코드는 main 에 있었지만 **실행 진입점이 없어서** 아무도 앱을 켤 수 없었다. 이제 있다.

- **실행**: `package.json` 의 `main` 이 `dist-electron/main.cjs` 를 가리키고,
  `npm run electron:dev`(dev 서버 + Electron) · `npm run electron:start`(빌드 렌더러 + Electron) ·
  `npm run electron:package`(electron-builder) 가 있다. 설정은 `scripts/electron-builder.config.mjs`
  가 `src/brand.ts` 상수에서 만든다.
- **세션 재부착**: 시작 화면은 별도 문서(`app://oprn/start-screen.html`)라 사용자가 고른 폴더가
  렌더러 모듈 상태로 넘어오지 않는다. 편집기 부팅이 `electronRepository.openFolderHeldByMainProcess()`
  로 주 프로세스 세션에 다시 붙는다(`src/app/mode.ts` 의 `attachElectronFolderAtBoot`).
  이 한 줄이 없으면 로컬 폴더를 열어 뒀는데도 편집기가 「온라인 저장 설정이 필요합니다」 로 떨어진다.
- **메뉴**: 파일 메뉴의 저장(`CmdOrCtrl+S`)은 메인이 `oprn:lifecycle.save` 를 보내고 렌더러가
  `store.flush()` 로 처리한다. 메인이 직접 쓰면 렌더러의 미저장 변경을 건너뛴다.
- **증거**: `scripts/qa/electronAppBootProbe.mjs` 가 폴더를 연 채 앱을 띄워 편집기 셸·본문 마운트,
  상태 `ready`, DB 연결 화면 부재, 메뉴 저장이 `project.sqlite` 리비전을 올리는 것까지 본다.
  저장·재기동 왕복은 `test/e2e/electronBridge.spec.ts`(playwright.electron.config.ts)가 맡는다.
- **P6 완료 — 부팅 경로에서 LegacyDb 제거 (2026-09-16)**: 브리지 없는 웹 빌드의 폴백이
  **메모리 어댑터**(`createMemoryRepository({ target: null })`)로 바뀌었다. 웹 빌드는 편집 도구가
  아니라 QA 하네스다. 다음 모듈을 삭제했다: `legacyDbProjectSync` · `legacyDbProjectConfig` ·
  `legacyDbProxyPath` · `persistence/legacyDbRepository` · `spatial/persistence` ·
  `spatial/persistenceHttp` · vite의 `/legacyDb` 프록시. `saveRouting` 은 라우팅 오류·권한
  타입만 남기고 재작성했고 `SpatialPersistenceError` 등은 `persistenceTypes` 로 옮깠다.
  맵 편집 잠금(`mapEditLocks`)은 원격 행이 없어 성립하지 않으므로 계약 유지 스텁(idle)으로
  퇴역했다 — `canEditMap` 은 항상 참.
- **결합 경계 가드**: `test/persistence/storageBoundary.test.ts` 가 세 가지를 지킨다 —
  ① `src/**` 어디에도 `/rest/v1` 문자열이 없을 것, ② 퇴역 모듈(`legacyDbProjectSync` 등)이
  부활하지 말 것, ③ 브리지 없는 기본 어댑터가 memory 종류일 것.
- **이관 도구**: `test/support/projectSession.ts` 의 `installMemoryProjectSession()`(스토어·UI 주제),
  `test/support/electronBridgeSession.ts` 의 `installElectronBridgeSession()`(비동기 전송 주제 — 저장을
  붙잡을 수 있어야 "뒤 저장이 앞 저장을 기다린다" 가 증명된다). 이관은
  `node scripts/qa/flip-default-check.mjs <파일>` 로 **양쪽 기본값에서 통과**해야 끝난다.

## 지역 하위 장소의 단일 계약 (2026-09-14)

`RegionDesign.places`는 내부 `space/place` 둘 다 참조할 수 있다. AI 공개 참조는 모두
`kind:place`이고 전역 고유 ID로 원래 저장 위치를 판별한다. 지역 선택→직접 장소 열기→
부모 복귀는 설계·배치 모드에서 원래 선택과 카메라를 보존한다.
개요 지도와 하위 직접 구성은 별도 지도다. 시공 분기는 현재 root의 composition으로 결정하며
하위 설계의 composition 존재만으로 지역·세계 개요를 합치지 않는다.
검증: `spatialPlaceContract.test.ts`(그린 방과 지역 길, save/load/recompile),
`spatialUnifiedPlaces.test.ts`(양 모드 탐색), `spatialMixedComposition.test.ts`(세계 개요와 직접 구성 지역).

## 직접 그린 방을 포함하는 다층 장소 (2026-09-14)

원본 PlaceDesign에 composition이 없는 건물은 자식 방에 composition이 있어도
`compilePlaces`의 층별 시공을 사용한다. `placeLayout`은 직접 구성한 자식 전체를
하나의 표면으로 굽고 내부 projection/ports를 함께 전달한다. 실내는 독립 지도,
야외는 같은 층·타일셋 합성 규칙을 유지한다. 동결 자식의 위치·오브젝트 이벤트·
양방향 transfer·소유권 digest를 보존하며 수동 변경 영역은 재시공 때 거부한다.
회귀: `test/spatialPlaceComposedFloors.test.ts`와 기존 `test/spatialPlaceCompiler.test.ts`.

## 장소 재료의 포함 관계 (2026-09-14)

`composition.members`의 `space`와 `place`는 모두 다른 `space/place`를 포함할 수 있다.
`COMPOSITION_KINDS`가 편집기와 도메인 검증의 공통 허용표다. 전역 ID 고유성·전체 포함 그래프의
순환 검사는 그대로 유지한다. 지역/세계의 상위 종류를 장소에 넣는 것은 거부한다.
저장 구조의 키·ID·스냅샷을 이 변경 때문에 다시 쓰지 않는다. 같은 지도 구성은 동일 타일셋과
0층 조건, 자식의 전체 크기 검사를 통과해야 시공된다. 회귀는 `test/spatialMixedComposition.test.ts`의
중첩 장소 시공→직렬화→재로드→재시공 및 순환 거부 검사다.

## 혼합 하위 재료 구성 (2026-09-13)

공간·장소·지역·세계 설계에 선택적 `composition`을 추가한다. 기존 project v4/spatial v1
레코드의 필드와 absence를 보존하므로 전량 migration이나 SQL 변경은 없다.
형태는 `{tilesetId,width,height,tiles:[{x,y,layer,tile}],members:[{id,source,x,y,level}]}`.
타일은 lower/upper로 분리하며 -1은 명시적 지우기, 셀 없음은 생성 바탕 복원을 뜻한다.
멤버는 엄격히 하위 종류만 허용한다. 기존 Place.children의 동종 장소 계약은 변경하지 않는다.
참조 검증·삭제 영향·snapshot closure·인스턴스 전개·복제 용량 제한은 직접 구성도 포함한다.
타일 좌표/중복/atlas 범위 및 슬롯 ID 충돌을 검증한다.

frozen subtree에 composition이 있으면 `compileMixedComposition.ts`로 한 맵을 시공한다.
루트가 전체 raster/event digest를 소유하고 하위 occurrence는 projection binding을 갖는다.
원본 설계를 바꿔도 기존 snapshot 시공 결과는 변하지 않으며 수작업 맵 변경은 소유권 검사로
보호한다. 같은 atlas, 단일 층만 지원하고 기존 개요 경로가 있으면 오류로 중단한다.
composition 없는 트리는 기존 시공기를 유지한다. `spatialMixedComposition.test.ts`가
serialize→deserialize→재시공 동일성, frozen 불변성, 직접 오브젝트 픽셀, 수동 편집 거부를 검증한다.

# Runtime Project Schema & Persistence

## Truthful migrated-load state (2026-09-07)

`store.normalizeCurrentProject` compares raw project structure before and after
normalization (`structuralJson`: object-key order only; arrays and every field stay
significant). Helper `changed` flags remain diagnostic hints, not evidence that a
revision needs saving: transient pack rewrites can return to the same structure.
This comparison does not deserialize, change canonical hashing, or exclude content.

Real normalization changes set dirty and advance mutation generation before they can
be persisted. Initial load schedules migration autosave only after `loaded=true`;
reload/reconnect capture the remote baseline before normalization and defer saving
through the ordinary autosave/flush path. None clears a migrated revision as clean.
Failure keeps it dirty; edits during migration persistence trigger the existing
local-first catch-up save. Coalescing is scoped to content lineage, so a replacement
migration can save independently of an older held save. Historical responses cannot
clear a replacement flight, dirty state, receipt or autosave status.

The faceset-repair await captures both its project object and content lineage.
If a switch or immutable edit detaches that target, completion cannot mark the
current project dirty or schedule its save. Likewise, synchronous `saving` status
subscribers may replace the project: the old flush rechecks lineage before starting
persistence and returns `disabled` without issuing a write or replacing the new
lineage's flight. This result disables that stale request, not remote persistence.
Same-lineage callback edits and repairs whose target remains current retain their
normal save behavior. Deterministic coverage: `storeLifecycleReentrancy.test.ts`.

Interior group composition and strict cabinet-kit migration are described in
[the room harness page](editor-interior-room-harness.md). Placed map layers without
per-cell provenance are preserved, including deliberate lower-layer props. No schema
bump is needed. Existing accepted-save receipts/proof and `serializeForComparison`
remain unchanged; graphical/both title graphics and nondefault authored content are
still identity-significant. Tests: `interiorLoadConsistency.test.ts`,
`storePersistenceLineage.test.ts`, and the existing persistence-proof tests.
## Explicit publication identity and Save6 (2026-09-06)

Project4 optionally carries `meta.publication`: `gameId`, `versionLabel`, a full
SHA-256 `runtimeTarget`, `saveCompatibilityId`, and directional
`acceptedSaveCompatibilityIds`. `publication.ts` validates without repairing or
generating identity. Only explicit prepare/fork/upgrade operations create IDs.
Rename, ordinary persistence and `.oprn` package round-trips preserve them.
Upgrade preserves game identity and starts a new save lineage; fork changes both.

Identity-bearing snapshots use Save6. Standalone/editor keys remain
`oprn:game:<gameId>:lineage:<saveCompatibilityId>:save-slot:v6:<slot|auto>`;
title, filename and legacy host namespace changes do not change that identity.
Community keys instead begin `oprn:community:<encoded-listing-slug>:game:...`.
`exportEntry` derives `saveIsolationScope` from the actual `/play/<slug>/...` URL,
even for opened/embedded projects; neither project metadata nor a boot
`saveNamespace` override can choose it. `renderPlayer` installs publication and
scope together via `setSavePublication(publication, isolationScope?)`.
Save6 `identity.isolationScope` records the host scope separately from game and
lineage. Manual/autosave readers, writers, blockers and apply reject foreign
scope snapshots. Community boot also skips the global legacy-prefix migration
(`exportStorageBoot.ts`); it must not enumerate, migrate or delete other saves.
Legacy projects still write Save5 and retain the existing Save4/5 read/fallback
rules. Legacy readers do not accept Save6. Save6 without identity is invalid.
`applySaveSnapshot` rejects wrong-game/unaccepted-lineage snapshots before state
restoration. `importSaveCopy` accepts one explicitly named storage key, requires
explicit legacy adoption for Save4/5, validates a separate session, and writes
only an empty destination slot. It never scans storage or changes source bytes.
Tests: `publication.test.ts`, `publicationSaves.test.ts`, `lifeSaveVersion.test.ts`.

The runtime load panel offers copy-and-load controls only for explicitly accepted
predecessor lineage keys **inside the current listing scope**, including their
autosave, into the first empty manual slot. `importSaveCopy` checks the source key
against local current/accepted lineage keys before reading it; uploader-accepted
lineage metadata is compatibility, never cross-listing access authority.
Legacy adoption remains an explicit standalone
`importSaveCopy({sourceKey, adoptLegacy: true, ...})` operation on a known legacy
key, not title/slug discovery or a bypass for community keys.

Cross-listing transfer is a separate player-selected file flow: in the source
load panel export a manual/autosave JSON file, then in the destination select
that file using the copy-and-load control. `importSelectedSaveFileCopy` receives
only those selected bytes (never a discovered storage key), requires compatible
Save6 game/lineage metadata, validates a separate session, rebinds scope, and
writes an empty manual slot. It cannot overwrite a destination or change the
source. Cancel/failure changes no live session. Native file controls and the
existing keyboard cursor menu own selection; no accounts or listing ownership
platform is involved. The UI caps selected files at 8 MiB.

Tests: `communitySaveBoot.test.ts`, `publicationSaves.test.ts`,
`publicationSaveImportPanel.test.ts`, and the real Chrome/PostgreSQL seam
`node --test test/communitySaveIsolation.test.mjs`. Runtime archive/export
operations and browser QA commands are in `editor-workflows-misc.md` under
Versioned publication.

[Spatial overview associations](spatial-overview-associations.md) define the task34
optional route/entry fields, exact ownership checks, unchanged digest semantics,
and the explicit task11 transaction boundary (project v4 / spatial v1).

## Spatial canonical routing (task6 backend increment, 2026-09-07)

`ProjectWriteAuthority` is separate from `Project`: an explicit create intent, a
legacy loaded target, or a canonical loaded/accepted server SHA plus target.
`loadProjectSnapshotFromLegacyDb` returns it; the ordinary load callback carries
it into the store before normalization. Local clones, map edits, AI acceptance
and same-target replacement retain that authority. A null editor baseline never
means insert-only creation. Canonical full/map saves use one publication RPC,
not legacy merge/upsert or a fresh-token retry. New-project transactions retain
typed failure causes and restore authority when local adoption rolls back.

Canonical load, proof, reload/reconnect and picker materials use the same root
snapshot, including an empty library. Present malformed markers fail. Legacy
reads retain their repaired/hybrid loader and child-based preview. A process-local
set remembers canonical targets only to deny legacy writes, never to grant tokens;
the existing server fence is still the cross-process authority.

`store.activateSpatialAuthoring()` / `activateSpatialProjectFromRaw(config)` are
explicit operations: capture raw root plus map rows, convert raw baseline, publish
with ordinary JSON. They never recover raw content from normalized editor state.
Raw-version/SHA limitations fail explicitly. Drafts and newer local edits survive
awaits; late acceptance cannot adopt into another target or replacement lineage.
Ordinary writes still strip event drafts. Accepted SHA/baseline survives mirror
failure, reported separately by `store.getPersistenceRecovery()` (`ready` with
optional mirror warning, or `blocked` with typed error and reload/export-copy
actions). Canonical reset/import marker removal throws `ProjectRoutingError`;
copying to an explicit new target is a separate operation.

The compatibility facade now returns save results and loaded authority; callers
must pass it when saving canonical content. The legacy force-file utility refuses
canonical writes rather than grafting a fresh token onto old file content.
Q7/Q8 local API scenarios use `scripts/qa/spatial-persistence.mts --local-only`;
they prove loopback HTTP/store behavior, not SQL authorization or deployment.
Editor save/error/status controls bind `getPersistenceRecovery()`: a canonical
conflict or migration-required error keeps the dirty draft and offers explicit
reload plus export-copy, never a silent retry with a new token. Mirror failure
stays a warning beside an accepted root save, and does not hide in-flight
`AutoSaveState`. Explicit reload captures the dialog project id and rejects a
live target change across the async import; export-copy preserves the local draft
and active project identity. Activation remains an explicit operation, not an
open-time side effect.

## P1 accepted-save receipts and read-only proof (2026-09-06)

`ProjectFlushResult` keeps its existing variants; `saved` optionally includes a
`ProjectPersistenceReceipt`. A clean flush after load may return `saved` without
a receipt, which isn't proof. After an accepted save, a clean current flush
returns the same receipt without another write.

The frozen, in-memory receipt contains `revisionId`, `projectId`,
`mutationGeneration`, `contentIdentity` and optional `sha256`. Identity is SHA-256
of the existing `serializeForComparison(projectWithoutEventDrafts(...))`
normalization, derived from `result.project ?? submittedProject`, not live
`getCurrent()` after an await. Accepted merged content can differ from the live
editor. The optional wire/server hash alone doesn't establish content equality.
If accepted content can't normalize, saving logs the error and returns no receipt.

`store.verifyPersistedRevision(receipt, { signal?, validate? })` accepts the exact
store-issued object. A private WeakMap holds its captured LegacyDb configuration
and load/adoption lineage; copied or reconstructed tokens fail. `loadProjectForPersistenceProof` reuses the
normalized/hybrid loader with observed `project_id` and cancellation, without
commit-tip hydration. It performs a remote read, not `reloadFromRemote()`: no
live-project replacement, dirty reset, draft change, URL change, or store event.
Manual reload retains its separate contract. The optional trusted synchronous
`validate(project)` callback runs on the canonical read only after target and
normalized content identity match. Returning a diagnostic produces `failed`;
throwing or cancellation cannot produce success. Assistant functional acceptance
uses this hook to re-run immutable gameplay expectations, not to accept worker
scripts or pass flags. The callback does not persist or replace project data.

Results are `verified` with `isCurrent`, `mismatch` with `reason: target | content`,
`disabled`, `cancelled`, or `failed` with a message. Missing rows and read errors
fail. Each verifier call makes a fresh attempt, so a failed receipt can retry.
`isPersistenceReceiptCurrent(receipt)` checks loaded/enabled state, the latest
receipt reference, mutation generation, load/adoption lineage and captured target
configuration. Adoption, successful remote reload and reconnect advance lineage
and clear the current receipt. Saves capture lineage before submission; a late
receipt from an earlier lineage remains available for historical verification,
but can't become current again or overwrite a replacement lineage's receipt.
This separate counter leaves local-edit generation and local-first catch-up saves
unchanged. A matching historical read may return `verified` with `isCurrent:false`;
consumers mustn't promote newer live state from that result and must recheck
currentness when consuming it after an await. Neither save responses nor proof
reads replace newer local edits.

Sources: [store types and methods](../src/project/store.ts) and
[proof loader](../src/project/legacyDbProjectSync.ts). The
[session contract](editor-ai-panel.md) describes completion/retry and optional
apply-commit correlation. [P1 evidence](../output/evidence/ai-harness/p1/README.md)
records real editor and isolated LegacyDb proof. This adds no schema migration,
durable receipt recovery, cross-device guarantee, or P2-P5 implementation.

## 패배 흐름과 엔딩 프레젠테이션 (2026-09-22)

기존 v4 문서에 선택 필드만 추가한다. `system.gameOver.presentation?: "classic"|"horror"|"blackout"`,
`recovery?: {mapId:string,x:number,y:number}`. 좌표는 음이 아닌 안전한 정수이며 참조 검증에서
기존 맵 범위를 확인한다. 미지정은 그대로 미지정으로 왕복한다. blackout은 새 저장 슬롯이나
영구 진행 필드를 만들지 않고 현재 세션에서 회복한다. 체크포인트의 저장 수명은 바꾸지 않는다.

`EndingDef.presentation` 및 `{kind:"ending"}`의 `presentation`은
`{tone?:"warm"|"dark",credits?:string,backgroundResourceId?:string,musicResourceId?:string}`.
미지 필드/잘못된 tone/20,000자 초과 credits를 거절한다. 배경·음악은 기존 리소스 참조 검증 및
내보내기 문자열 수집을 따른다. 엔딩 정규화는 선택 필드를 보존하고 `triggerEnding`의 에필로그
뒤에도 전달한다. 브라우저 편집기에서 recovery 설정의 serialize→deserialize 동등성을 확인했다.
단위 계약은 `test/defeatRecovery.test.ts` (이번 세션에서 테스트 스위트 미실행).

## Opening and game-over cinematic settings (2026-09-06)

`SystemRecords.opening?: CinematicSequence` and `gameOver?: GameOverSettings` are additive, opt-in project-v4 authoring records. No schema bump, server migration, or default/demo content is needed. `src/project/cinematicSettings.ts` owns the mutable authored types and pure normalization; all four types are re-exported through `@/project/types`:

- `CinematicMotion = "none" | "fade" | "pan" | "zoom"`.
- `CinematicScene` is a discriminated union with common `id`, `narration`, optional `narrationAudioResourceId`, and `durationMs`. A `text` scene has no media or motion field; an `image` scene requires `resourceId` and `motion`; a `video` scene requires `resourceId` and has no motion field.
- `CinematicSequence = { enabled: boolean; skippable: boolean; musicResourceId?: string; scenes: CinematicScene[] }`. `musicResourceId` (2026-09-14) is the sequence-wide background music: the player loops it under every scene from sequence start and stops/releases it on completion, skip or abort, independently of the per-scene `narrationAudioResourceId` and of the scene media state machine (a blocked or missing track never stalls the scenes). It is trimmed and omitted when empty by normalization, validated as a non-blank string by `shapeDatabaseFields`, existence-checked by `resourceReferenceValidation`, and collected by the web export string walk like any other resource reference.
- `GameOverSettings` has optional `sequence`, `title`, `message`, `retryLabel`, `titleLabel`, and `backgroundResourceId` fields.

`CINEMATIC_SCENE_LIMIT = 100` and `CINEMATIC_DURATION_MAX_MS = 120000` are exported from the focused module. `normalizeCinematicSequence(sequence: CinematicSequence): CinematicSequence` and `normalizeGameOverSettings(settings: GameOverSettings): GameOverSettings` accept typed records; the `normalizeSystemRecords` whitelist calls them only for present settings. Missing settings stay missing, empty authored records/sequences and disabled content survive, and normalization preserves ordering and exact text (including blank strings and whitespace). IDs are trimmed; optional empty IDs are omitted on typed direct normalization. Normalization does not mutate input and is idempotent; it is not a replacement for wire validation.

`io/shapeDatabaseFields.validateSystem` checks these records before typed cloning/normalization. It rejects non-objects, unknown or variant-inappropriate fields, missing required fields, incorrect field types, blank IDs, duplicate scene IDs (after trimming, scoped to each sequence), more than 100 scenes, and non-finite/non-integer durations outside `0..120000`. Image motion must be one of the four values above. `io/resourceReferenceValidation.validateSystemResources` validates image/video/narration/background IDs through the existing known-resource authority even when a sequence is disabled. This is existence validation, not media decoding or MIME compatibility validation.

The duration contract for playback consumers is: zero means keyboard advance for image/text; videos advance on completion, with a positive duration acting as an authored maximum. Text is stored literally; renderers must use safe native text rendering. This model increment does not implement playback, new-game routing, game-over menus, or editor authoring UI.

`webExportAssets` already traverses nested project strings outside uploaded payloads, so no cinematic asset collector is added. Disabled sequences retain uploaded media in `prepareWebExport`, including narration referenced nowhere else. Uploaded video filenames now use `.mp4`, `.webm`, or `.ogv` for the media types accepted by the existing movie importer (rather than the former `.png` fallback); image/GIF/WebP and audio handling is unchanged. `test/cinematicSettings.test.ts` covers legacy absence, disabled/empty retention, deterministic serialize/deserialize, strict rejection, resource validation, and actual export-entry bytes for image/video/audio/background, with unused uploads pruned.

## 적 전투 이미지 크기 (2026-09-06)

`EnemyRecord.battleScalePercent?: number`는 선택적인 전투 표시 백분율이다. `normalizeEnemyRecord`는 유한 숫자를 반올림해 정수 10~300에 제한하고, 누락·비숫자·비유한 값은 100으로 처리한다. 100은 키를 생략해 기존 프로젝트를 희소하게 유지한다. 기존 editor mutation allowlist와 `upsert_enemy` 정수 스키마에 포함되며 `serialize`/`deserialize`가 비기본값을 보존한다. 기존 로드 정규화를 재사용하는 additive 필드라 스키마 버전 변경이나 SQL migration은 없다. `test/enemyBattleScale.test.ts`가 실제 편집→저장→로드→재저장과 손상된 입력/기본값 복귀를 검증한다. 원격 DB 쓰기 없이 엔진·편집기 코드만 변경한 계약이다.

## Project monster metadata overrides (foundation, 2026-09-07)

`Project.monsterMetadata?: Record<string, Partial<MonsterMetadata>>` stores editor-only
`name`, `tags`, and `description` overrides by raw resource ID. The readonly metadata
value type is exported through `@/project/types`; mutations belong to
`@/project/monsterMetadata`. `setMonsterMetadataOverride(overrides, resourceId, patch)`
returns a new map, trims new input, deduplicates tags, and preserves omitted fields.
Names must be nonblank and <=120 UTF-16 units; descriptions <=4000; tags <=32 entries
of <=64 units. Empty tags/descriptions explicitly clear defaults. Loading validates
stored values without trimming, deduplicating, registering orphan IDs, or backfilling.
`resetMonsterMetadataOverride(overrides, resourceId)` removes the whole resource override
and returns `undefined` when the map becomes empty. Callers delete the optional project
field on that result. Raw IDs such as `terrainTemplates` and `__proto__` retain identity.

`applyMonsterMetadataDelta(base, local, latest)` merges per resource AND per field.
Only locally changed fields replace latest values; local changes win same-field races.
A local reset removes fields present in base, preserving concurrently added remote fields.
Map-patch saves apply this delta; accepted-save reconciliation applies it again using
submitted/current/saved snapshots. The existing content-lineage guard rejects stale
responses after project replacement. Reconciliation preserves live maps and does not
create authored mutation generations or extra history entries. Project snapshots already
support undo/redo; UI Apply/reset must record one snapshot and use labeled `store.update`.

`@/assets/monsterResourceCatalog` owns `listMonsterResources(project)` and
`getMonsterResource(project, rawId)` (missing IDs return `undefined`). Entries expose
`resourceId`, effective metadata, `origin` (`bundled`/`uploaded`/`profile`),
`reviewStatus` (`reviewed`/`unreviewed`), and per-field `sources`
(`project`/`catalog`/`fallback`). Promoted monster artwork includes troop previews;
builtin enemies, EasyRPG, Scarloxy, explicit profiles and uploads are stably deduplicated.
Explicit upload kind overrides prefixes, profiles, and bundled identity. Custom uploads
never inherit catalog review status. Metadata-only IDs do not become resources.
`MONSTER_CATALOG` is an intentionally empty typed scaffold in this independent foundation
increment; the lead must supply original-artwork-reviewed values before final review.
Fallback descriptions are empty and always unreviewed; inferred search tags are not vision evidence.

Monster search (`monsterProject` option) and monster picker enumeration delegate to that
same authority. Non-monster image/picture picking and URL resolution remain unchanged.
`monsterMetadataChanged` counts changed resources for diff/history/commit accounting;
legacy summaries may omit it. Editor JSON, backup and package round trips retain overrides;
playable exports strip them and exclude their text from uploaded-asset usage accounting.
No schema version bump, SQL table, migration, or live-project rewrite is needed.

## Project audio description overrides

`Project.audioDescriptions` is an optional v4 field, defined in
`src/project/types/base.ts` and `src/project/types/project.ts`:

```ts
audioDescriptions?: {
  music?: Record<string, string>;
  sound?: Record<string, string>;
};
```

Keys are raw resource IDs, not `bgm:`/`se:` search IDs, filenames or URLs. A missing key
inherits the catalog default; an own key with `""` explicitly clears it; another string
is project-authored text. Reset removes only the override, pruning empty containers.
An explicit value equal to today's default stays an override.

`src/project/audioDescriptions.ts` is the catalog/DOM/store/player-independent authority.
New writes trim surrounding whitespace and enforce 4,000 UTF-16 code units after trimming,
preserving internal line breaks. `src/project/io/shape.ts` validates stored strings without
rewriting them, rejects malformed partitions/values and overlong strings, and accepts field
absence. Unknown IDs survive loading as metadata but don't become selectable resources.
`src/project/io/serialize.ts` preserves raw dictionary keys even when they resemble a
legacy field name.

Defaults remain in immutable catalogs; overrides aren't duplicated in upload `meta`,
profiles or browser-global localStorage. Existing projects need no default backfill,
schema-version bump, new SQL table or live-project rewrite.

### Concurrent persistence

`applyAudioDescriptionDelta(base, local, latest)` starts from the latest stored descriptions
and applies only kind/raw-ID states that changed locally relative to base. Different-key
edits survive together; a changed local key wins a same-key conflict. Absence is reset,
not clear. Unchanged local keys retain remote edits and remote resets.

`src/project/legacyDbProjectSync.ts` uses this delta for map-patch saves. A project-scoped
description mutation doesn't force a full save: `src/project/store.ts` chooses the save API
from the persisted baseline. After success, the store reconciles descriptions with
`base=submitted`, `local=current`, `latest=saved`. This preserves typing during the request,
adopts remote-only changes and avoids resending stale metadata on the next map save.
It replaces only the necessary root/description state, keeps live maps and mutation-generation
handling, and emits synchronization without counting a new authored edit.

Reconciliation uses the same content-lineage counter as accepted-save receipts.
Full project replacement/reset advances lineage, invalidates current proof and clears
the old persisted baseline, so its next save is authoritative
rather than a merge with the previous project. A late completion from an earlier epoch
cannot reinstall that baseline or copy remote descriptions into the replacement.
Accepted historical saves still issue verifiable, non-current receipts and commit records.
The ownership check runs after receipt hashing and again after synchronization callbacks;
neither boundary may reset a replacement's dirty state.
Ordinary edits and undo within one project keep the per-key reconciliation contract.

### Editor preservation and playable export

Editor JSON, backups and `src/project/package.ts` packages preserve absent, empty, authored
and orphan states. `src/project/webExport.ts` removes the entire field from the playable
export clone before loading/validation, without changing the source project.
`src/project/webExportAssets.ts` excludes the description subtree from usage traversal:
neither a description key nor text equal to an upload ID keeps an unused upload alive.
Real playback references still retain their assets and IDs.

`test/audioDescriptions.test.ts`, `test/audioDescriptionPersistence.test.ts`,
`test/audioDescriptionConcurrentPersistence.test.ts` and
`test/audioDescriptionExport.test.ts` exercise these boundaries. Transport-mocked tests
using real save/load/merge functions aren't evidence of a live LegacyDb write.

## Character/face authoring metadata (2026-09-06)

**2026-09-18:** The character/face editor now uses a host-owned shared catalog outside the project. Existing optional profile fields remain loadable/exportable for compatibility and explicit migration. See `editor-database.md` «캐릭터·얼굴은 프로젝트 밖 공용 자료». Shared catalog writes never rewrite authored actors/events or participate in project undo.

`ResourceProfile` optionally carries standalone-face `graphicAttributes`/`graphicNote`, or charset `characterSlots: [{characterIndex,graphicAttributes,status,faceResourceId,quality,note}]`. Seven independent string axes are kind/age/gender/skin/hair/clothing/role. Sprite names remain in `Project.charsetLabels`; face names use the existing profile name. No parallel asset registry, project version bump, or SQL migration is introduced.

`characterGraphics.validateCharacterGraphicsProject` runs in `validateProjectV4`, rejecting malformed attributes, duplicate canonical sprite slots and unknown mapped face IDs. Non-mapped states require an explicit null face ID; pending/no-face are distinct. Existing projects keep these optional fields absent; display-only literal-label suggestions do not write metadata on load. Texture-key/resource-ID profile aliases resolve to the annotated profile rather than hiding edits. Whole-project serialize/deserialize, packages and LegacyDb current_json retain the fields; the existing missing-only bundled-profile supplementation preserves annotated profiles.

Metadata JSON import validates all v1/v2 rows before a single mutation, retains pending labels and exact supplied face IDs, and never invokes automatic face matching or rewrites authored event commands. V2 exports both independent attribute sets. Focused contracts: `test/characterGraphics.test.ts`, `test/characterGraphicsLoad.test.ts`, `test/databaseCharacterGraphics.test.ts`.
## Character appearance sets v1 (2026-09-06)

`database.characterAppearances?` is an additive v4 catalog of
`{id,name,description,charset?:{resourceId,characterIndex},face?:{resourceId},bust?:{resourceId}}`.
It is independent of social `project.characters` / `characterId`. All graphic
slots are optional; legacy projects keep the catalog absent. Actors and active
event-page graphics reference a set with optional `appearanceId`, retaining their
direct graphic fields for unlink/fallback. Both `actorModel` normalization and
`databaseActions`' actor patch whitelist must preserve that link.

`characterAppearanceValidation.ts` validates shape, unique IDs, slot bounds,
resource kinds and dangling links. Face resources are standalone facesets, busts
are pictures, charsets use the supported 288x256 sheet with eight 24x32-frame
characters. Known mismatched uploaded metadata is rejected; actual decoded
dimensions are checked before runtime frame registration. Built-in bust/full
aliases and promoted portrait metadata match the resource picker. No migration,
SQL table, or save-slot field is added.

`characterAppearances.ts` owns shared projections and usage scanning. Session
actor overrides still win; linked slots override legacy actor/page resources,
and missing slots keep their legacy fallback. The player now uses the selected
charset index rather than always cell zero. Uploaded charsets are loaded and
registered by the existing asset loader and recognized by NPC animation.

An event starts with its active page's set face as default. Explicit `changeFace`,
including clear, takes precedence. The existing command supports optional
`appearanceId` and `presentation:"face"|"bust"`; a missing bust uses that set's
face, then no portrait. Explicit presentation takes precedence over old filename
inference. Names are never used to infer speaker identity.

Contracts: `characterAppearanceSets`, `characterAppearanceRuntime`, and
`characterAppearanceScenario` tests; the dedicated
`scripts/qa/runtime/character-appearance-sets.scenario.mjs` exercises player.html.
`node scripts/qa/appearance-runtime-proof.mjs` uses that same harness with an
isolated Firefox context where Chromium has host-level ERR_NETWORK_CHANGED
asset failures. The scenario removes its temporary fixture on cleanup/exit.

## New-project save/reload verification (2026-09-05)

Persistence regression harness correction (2026-09-08): `test/io.test.ts` compares the complete first-roundtrip wire against the seed with only its redundant text-only `titleGraphic` removed, then requires byte-stable subsequent roundtrips. It does not normalize both expected and actual through the same loader. Storage-key guards parse executable string/template values, not explanatory comments. The no-local-project-DB guard permits `typeof indexedDB` capability inspection for AI-log durability but still rejects IndexedDB access, SQLite and the retired project fallback implementations.

`storePersistence` and `unsavedChangesGuard` wire the real `createDevShowcaseProjectForLocation` through `setDevProjectFactory`, as `bootApp` does; importing `store` alone does not activate URL showcases. Tests block live fetches and distinguish canonical REST writes from edit-activity telemetry. Fire-and-forget commit audit mirroring is isolated from the next case's transport. Cold module transformation belongs in setup, not the save behavior deadline. `persistenceTestSignals.ts` provides real bounded deadlines around pre-registered autosave and request signals; only the actual debounce/backoff contract advances fake time. Race tests hold each response until the next local edit and verify the still-dirty intermediate state before catch-up completes. The mode overlap test subscribes to editor teardown and uses a synchronous player mock, avoiding Vitest's async-mock call-stack bypass on concurrent imports. The editor autosave test uses a DOM implementation with real storage and tears down the rendered editor. Evidence and the non-fabricated historical-item mapping are in `output/evidence/event-command-completion/legacy-persistence/ledger.json`.

`store.loadNewRemoteProjectTransactionally` compares draft-free projects with `serializeForComparison`, not raw wire bytes. The comparison runs both sides through the project loader's normalization and recursively sorts object keys; arrays and authored non-default values remain significant. New blank/preset seeds contain the default `system.titleScreen.titleGraphic = { mode: "text", x: 32, y: 62 }`, which normalization omits, and the farm preset gains `system.timeSystem.forceSleep = false` on load. PostgreSQL JSONB also changes object-key order. These representation differences must not reject a successful save/reload. Wire serialization and SHA-256 persistence remain unchanged; actual mismatches still reject before adopting the new project or changing drafts, config, or URL. `test/transactionalNewRemoteProject.test.ts` exercises all five presets plus blank creation through real save/load functions with a JSONB-like transport, and rejects changed titles, map tiles, and array order.

## Task15 nonvisual economy command contract (2026-09-08)

`craftRecipe` and `applyItemUpgrade` accept optional `resultVariableId: string` in Project4 commands.
Shape validation rejects non-string values; ProjectIO references, event draft validation and variable deletion guards require a declared ID, including nested commerce/battle-result branches.
Omission stays omitted through serialization and creates no result variable. The existing interpreter calls the existing atomic transaction and uses `setVariable` to record success `1` or failure `0` only when requested (missing project also means `0`). Both outcomes advance to the next command; authors must branch explicitly before paying success-only rewards.
The scene runner already uses that interpreter. Nonvisual `previewSimulation.ts` now executes these two commands through the same interpreter on its local preview state, preserving quantity/charges/collection and recipe-unlock state rather than predicting success. It does not mutate the authored project.

`handleShopTransaction` now resolves its sale baseline through `resolveShopSellUnitPrice`: authored buy100/sell90 pays90, table100 is capped at99, explicit0 pays0, omitted table defaults to50. Shipping deliberately continues using `resolveSellPrice` (table100 pays100); undefined shipping allow-list means all database items and `[]` means none. To turn off A from undefined/all, the authoring checkbox consumer must materialize all current item IDs then remove A, retaining B/C. No shipping schema or runtime change is needed for that UI fix.
Bundle reward definitions are validated before mutation, while inventory capacity is checked once by `changeItemsAtomically` against donation followed by reward. Donation1/reward1 of the same item succeeds at `ITEM_QUANTITY_MAX=9_999_999`; reward2 still fails without inventory, gold or completion changes. Existing duplicate-reward rejection and once-only completion remain.
Regression: `test/lifeEconomyConsumerParity.test.ts`. Forms, sale display/offer/haggle UI wiring and native visual QA are separate Task15 work, not verified by this nonvisual increment.

## Independent game Save5 boundary (2026-09-06)

Project `SCHEMA_VERSION` remains 4 (`Project.version`); runtime `SaveSnapshot.schemaVersion` now uses independent `SAVE_SCHEMA_VERSION=5` in `src/player/saveSlots.ts`, even without optional life state. The current reader accepts Save4 and Save5, upgrades Save4 in memory, and explicitly rejects Save3 and future versions. Historical save-v3 statements below do not describe current reader support. `test/fixtures/life-full/saveSlots.phase1.ts` is the byte-identical complete phase1 module from `87de73785d1c309bbbe975636414f70bbc73a4b9`; its real old parser rejects new writer output at the schema comparison. Its unchanged validation imports remain shared; this is a frozen reader, not a whole old application binary.

Manual keys are `oprn:save-slot:v5:1..3` and autosave is `oprn:save-slot:v5:auto`. An export namespace substitutes for `oprn` unchanged. Each reader consults the matching old key only when the new key is absent (`null`), never when it is empty, malformed, or unsupported. Reading/migration performs no writes. Writing touches only the new key; no backup copy or deletion is needed because the original bytes stay at the old key. Failed quota writes preserve the old bytes, previous new slot, and live session. Equipment parsing and the missing-custom-slot load blocker are unchanged. Tests: `test/lifeSaveVersion.test.ts`, `autosave.test.ts`, `customEquipmentSlots.test.ts`.

## Life ownership in Save5 (2026-09-06)

Farm plots optionally retain `regrowDaysRemaining` as a non-negative safe integer. The existing lossless plot validation rejects malformed countdowns without trimming plots or rewriting saved bytes. Zero is retained as a ready regrowing crop; omission preserves legacy initial-growth behavior, never an inferred prior harvest. The writer, Storage reader and apply path retain the complete plot record. Save5 keys and Project4 are unchanged; see `test/cropRegrowthContract.test.ts` for remaining-seven roundtrip and malformed-value refusal.

When saved maker jobs depend on a present clock, writer/parser/apply reject malformed dates rather than dropping the clock while keeping its jobs. Frozen jobs also reject absolute-minute overflow in their original basis. Legacy omitted clocks retain the initial-clock fallback; project-free parsing does not impose the default calendar on legacy jobs. Save5/Project4 versions and key namespaces are unchanged.

Optional `session.lifeRecovery` now crosses writer, manual/auto Storage, parser and apply unchanged after bounded validation. Shared pure life reconciliation runs before known-content filters; incompatible sources are moved to claims or preserved as unpayable original JSON, never silently deleted. Completion/reward tombstones and region/recipe IDs retain dormant rights. Claim quantities/counts, monotonic sequence, 64 KiB raw UTF-8 and 8 MiB total limits are reject-without-trimming boundaries. Duplicate JSON object keys are rejected by both disk readers. Existing Save4 migration and v5 key isolation remain unchanged. Source removal plus claim creation and explicit receipt plus inventory transfer are separate atomic draft transactions. See `runtime-sessions.md` for restoration order, cancellation clocks and task boundaries; regression `test/lifeRecoveryPersistence.test.ts` executes the actual codec.

**Explicit instance-linked animal homes (task11, 2026-09-06):** Project4 adds optional `FarmBuildingTypeRecord.animalHousing: { allowedSpeciesIds: string[] }` and level `animalCapacity`. Every level of an enabled housing type must explicitly author an integer capacity 0..9999; generic `capacity` is unchanged and never supplies animal slots. `FarmAnimalStartInstance` and its runtime state add optional `housingPlacementId`, referencing an actual placement instance, mutually exclusive with legacy `buildingId`. JSON shape validation and direct normalization reject malformed/dual references; project reference validation checks enabled placement, allowed species and each independent capacity. Invalid new references are not silently repaired away. Existing independent animal homes remain supported.

`src/project/animalHousing.ts` is the single derived-home authority: `resolveAnimalHome` reads placement ID, map, coordinates and current level, without matching names, types or nearby coordinates. `reconcileLinkedAnimalHousing` keeps capacity survivors in Unicode code-point ascending instanceId order (not locale or UTF-16 order), unassigns the rest and never relocates them. Missing placement/type, housing disable and species exclusion also unassign, preserving animals and all progress. Runtime assignment is `assignFarmAnimalToHousingPlacement` in `farmAnimals.ts`; explicit reassignment to either home kind removes the other reference and never resets daily care. Unassigned animals can collect already-earned products but cannot feed/pet or advance production through a missing home.

Building construction and upgrades record actual aggregate `paymentReceipt: { gold, items }`; moving preserves it and the instance ID. Receipts are cumulative history: gold is a nonnegative safe integer and each unique nonempty item ID has a positive safe-integer total, not a single wallet/stack or 64-row claim. New costs still independently obey the 64-input-row and wallet/stack transaction limits. Previously validated history is aggregated with the preflighted new payment without passing the concatenation through per-cost limits; unsafe cumulative addition refuses before any spending. Thus 64 historical rows plus a repeated item, 32+33 distinct items, all16 levels of64 items, and repeated full-stack/wallet payments remain intact through Save5. Content recovery splits distinct rows and large same-item totals into the existing bounded claims (64 unique items, ITEM_QUANTITY_MAX per row, 4096 claims, 64 KiB raw and 8 MiB total); insufficient recovery capacity refuses the whole conversion with the source and prior slot unchanged. `test/spatialPaymentReceipts.test.ts` covers these boundaries, exactly-once collection and malformed/unsafe raw preservation. Voluntary demolition is nonrefundable: it atomically removes the placement and clears only its animal housing references, without creating or changing any recovery claim, even when all4096 claim slots are occupied. Animals retain identity, friendship, products and all care/day receipts. Only content-incompatible buildings move proved paid item quantities to existing explicit-collection claims, with original placement/payment JSON (including gold evidence) retained in `unresolved`. This does not add a gold claim/payout schema or infer earlier costs for legacy placements. Save5 validates and preserves active receipts. Writer and apply reconcile persistent plots/placeables/chests, then spatial recovery, then linked homes/animals, then other life transactions and restored-clock processing, before returning the successful draft. A removed linked reference never falls back to an authored legacy start home, including a second save/resume while unassigned. Map deletion clears affected authored linked references only.

`test/linkedAnimalHousing.test.ts` covers independent instances, 2-to-5 upgrade, movement, care/collection, stable shrink selection, demolition/type changes, payment evidence, conflict/cost/species refusals, Project4/Save5 roundtrips and corrupt raw preservation. Task11's native `player.html` probe calls public transaction modules on the real PlayScene session and earns production through native Z sleep; assignment/authoring UI and live player/NPC placement safety remain tasks13/12, not claims of this schema change.

## Placement safety core (task12, 2026-09-06)

`canOccupySpatialFootprint` is persistent-only: terrain, complete oriented building/decor footprints, placeables, chests and actual farm plot records. Farmable areas alone do not reserve space. Save restoration and forage use this same authority. Restoration never reads live actor context; transient player/NPC overlap cannot quarantine an otherwise compatible building or rug. Persistent incompatibility still follows the existing proved-payment recovery contract. Farming removes only its own target plot from the temporary occupancy view, preserving water/harvest and all other occupancy checks.

`spatialOccupancy.ts` exposes the nonpersisted `SpatialLiveActor` (`mapId`, foot-anchor `x/y`, full `footprint`, optional movement `passRows`), `SpatialLiveContext` (`player`, `npcs`) and `SpatialLiveContextReader`. `canPlaceSpatialFootprint(project, session, position, footprint, readLive?, exclude?, blocksMovement=true)` adds full-body collision and refuses closing the last currently available one-step player movement neighbor. Movement uses existing passage/terrain authorities, not global pathfinding; pre-existing confinement or body overhang does not globally prohibit unrelated construction. Nonblocking rugs and plots reserve placement space, not movement space.

All six construction/move/rotate/upgrade public transactions accept the reader as their final optional argument, invoke live preflight before costs, and do not retain it. New records whitelist persistent placement fields rather than spreading arbitrary input. No Project4/Save5 schema change. `adjacentSpatialPosition(player, direction, footprint, orientation)` returns a top-left outside the full body, accounting for rotated dimensions: up `top-H`, down `bottom+1`, left `left-W`, right `right+1`; the other coordinate aligns with the body's left/top.

The live ledger's `spatialEntries` now passes a call-scoped `SpatialLiveContextReader` to all six building/decor placement, movement, upgrade and rotation transactions. `src/player/lifePlacementScene.ts` resolves the player's full body at the scene's logical foot tile and projects NPCs through `runtimeEventViewsForMap` with current session/event positions each time the reader runs, rather than retaining a preview snapshot. Page-less, off-map and erased actors are excluded. The discrete reader includes only same-priority, overlap-forbidden NPCs as walking walls. Separately, `placementBlockedByRenderedBodies` checks the target against visible NPC full bodies, including above/below/pass-through actors and interpolated moving bodies; those actors do not become walking walls. An in-flight player action refuses until the step completes. Fractional rendered anchors are examined only by this UI overlap gate, never forwarded into discrete core geometry. Unrelated NPC movement does not prohibit a nonoverlapping target. Place/move targets use `adjacentSpatialPosition` with the full player body and scene facing; upgrades/rotations retain stored positions. Missing or unusable scene context refuses the live action instead of omitting the reader. Removes are unchanged. Live context is not serialized into sessions, placements or saves. Reader omission still retains legacy/static behavior for nonvisual callers; it is not live-safety verification. Producer-r3 handler receipts report 91 passing tests, including three rendered-body replay regressions. Its native `player.html` receipt uses a newly saved/reloaded 3x3/passRows1 project, with target `(7,9)` from foot `(8,8)`, building placement/upgrade and movement to different coordinates, plot/edge and moving-NPC-origin overlap refusals, rug placement, and menu Save/Load with raw owners. Those r3 decoration move/rotation attempts returned `blocked`, and its last-exit setup allowed another building (`lastExitBlocked:false`); those failures remain historical, not passes. On identical source, producer-r4 uses two separately saved/reloaded, core-preflighted fixtures: a non-square table rotates down to left at `(7,9)`, then moves to `(5,6)` with orientation and recovery item retained in real menu Save slots. In the independent last-exit session, foot `(1,2)` stays stationary while construction at `(0,3)` refuses with gold500, potion8, hoe1 and both starting owners unchanged. The r4 Save receipts prove changed owner properties, not Load restoration from divergent state. Producer-r5 supplies a separate native nonblocking-rug passage and restoration proof on another remotely reloaded 3x3/passRows1 input: DOWN from foot `(8,8)` to `(8,9)` crosses rug cells `(7,9)` and `(8,9)` with passage x7..9/y9. After Save slot1, the live foot moves to `(8,10)` and the rug to `(7,11)`; menu Load restores foot `(8,9)` and rug `(7,9)`. A newly written slot2 matches slot1 for both owner kinds, rug orientation/recovery item, gold and inventory. The old r3 walk label did not intersect the rug with its passage and is not relabeled as traversal. Composite producer evidence does not replace post-commit independent native/visual acceptance. Nonvisual core contract: `test/lifePlacementSafety.test.ts`; scene/handler contracts: `test/lifePlacementSceneUi.test.ts` and `test/lifePlacementRenderedBodyReplay.test.ts`.

Task52 corrects the existing `normalizeSystemRecords` whitelist to retain authored optional `system.playerFootprint` and `system.playerPassRows` independently through public Project serialize/deserialize. Existing footprint and passage normalizers remain the authority; absent keys stay absent and malformed wire geometry is still rejected. Authored 3x3/passRows1 survives roundtrips and resolves as a full 3x3 body with a one-row movement passage, not a 1x1 construction body. Project remains version4 and Save4/5 compatibility is unchanged; this does not invent session-override persistence. Regression: `test/playerBodyProjectPersistence.test.ts`.

## Project-authored equipment slots (2026-09-05)

`ProjectDatabaseRecords.equipmentSlots?: EquipmentSlotRecord[]` is an additive v4 catalog of `{ id, label }`. Omission keeps the five built-ins. `src/project/equipmentSlots.ts` merges built-ins with authored label overrides and custom slots; built-in IDs cannot be removed. IDs are stable ASCII identifiers, not labels. `EquipmentRecord.slot`, `ActorInitialEquipment`, and `changeEquipment.slot` reference these IDs. Actor normalization preserves every slot key; shape/reference validation rejects duplicate/unsafe catalog IDs, empty labels, and dangling equipment/actor/event slot references. No migration or schema bump is needed for catalog-free projects.

Runtime projection and atomic equip transitions enumerate the catalog; custom slots have ordinary one-item occupancy and contribute their authored stats/effects. Only `weapon` and `shield` have dual-wield/two-handed semantics. Save parsing validates every equipment entry (including custom values); missing equipment maps remain legacy-compatible. `snapshotLoadBlocker` refuses a save whose slot catalog is no longer present rather than silently treating that slot as accessory. The project editor prevents removal while equipment records, actor initial equipment, or nested map/common/troop commands (including drafts) reference a slot. External saves are not rewritten on catalog edits; missing-slot saves are explicitly blocked at load.

Contract: `test/customEquipmentSlots.test.ts` covers create/rename/use, initial equipment serialization and reload, menu/event equip, stats/effects, save storage roundtrip, removal protection, invalid slots, and legacy fallback.

## 전투 명령 CSS (2026-09-05)

선택 필드 `system.battleCommandCss?: string`은 프로젝트 공통 메뉴 스타일이다. 기존 프로젝트는 필드 없이 기존 스킨을 유지한다. `validateSystem`은 문자열 타입을 검사하고 `normalizeSystemRecords`는 비어 있지 않은 원문을 보존한다. 버전 증가나 데이터 마이그레이션은 필요 없다. 저장/로드·패키지·출하 플레이어가 같은 프로젝트 필드를 사용한다. 지원 문법 밖의 가져온 문자열은 보존하되 렌더하지 않아 편집기에서 고칠 수 있다. `test/battleCommandCss.test.ts`가 직렬화 왕복·구형 프로젝트·잘못된 타입·CSS 격리를 검증한다.

## 기본 카탈로그 삭제 보존 (2026-09-05)

로드의 `ensureDefaultDatabaseIconResources`는 기존 기본 행의 아이콘 연결만 보정한다. 누락 아이템·장비를 새로 주입하거나 그 종속 스킬·상태를 추가하지 않는다. 신규 생성은 기존 기본 카탈로그를 그대로 사용한다. `test/itemEquipmentAuthoringTrust.test.ts`는 삭제한 기본 행이 serialize→deserialize→부팅 정규화 후에도 없는 것을 확인한다. 종류 필드가 없던 v3 스킬 아이템은 `normalizeItemRecord`가 skillId를 보고 special로 복원한다. 명시된 종류는 추론으로 덮어쓰지 않으며 실제 v3 전투 fixture와 직렬화 왕복으로 검증한다. ItemRecord 종류 전환은 저장 필드를 삭제하지 않고 `itemUsage.activeItemEffects`로 실행만 제한하므로 스키마 버전 변경이 없다.

## 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)

`normalizeTroopRecord`는 옛 길이 기반 생성기가 남긴 중복 페이지 ID를 결정적으로 복구한다. 첫 ID는 보존하고 이후 중복은 사용되지 않은 `_2`, `_3` 등의 접미사로 바꾼다. 입력 전체의 기존 ID도 예약하므로 뒤에 나오는 정상 ID를 빼앗지 않는다. 여러 번 정규화·저장·로드해도 결과가 같다. 옛 모호한 ID를 참조하던 명령은 첫 페이지를 계속 가리킨다. 새 스키마 필드나 버전 증가는 없다.

프로젝트 참조 검증은 각 적 그룹의 편성 수만큼 `enemy-1`…`enemy-N`을 범위화하여 HP 조건에 허용한다. 몬스터 레코드 ID 조건도 기존대로 허용한다. 슬롯 참조를 전역 enemy ID 집합에 넣으면 다른 그룹의 잘못된 슬롯을 통과시키므로 `ReferenceContext.enemySlotIds`로 분리한다.

`test/monsterBattleAuthoringContract.test.ts`는 중복 ID 복구의 충돌 회피·멱등성, serialize→deserialize 반복, 두 번째 중복 몬스터 슬롯의 실제 조건 실행까지 검증한다.


Authored project schema, defaults, validation, migration, references, and persistence boundaries.

생활 스키마 회귀 fixture (2026-09-06): `test/fixtures/life-full/legacyProject.ts`는 새 프로젝트의 중복 `titleScreen.titleGraphic`만 명시적으로 제외한다. 생성기는 `{mode:"text",x:32,y:62}`를 제공하지만 로더는 리소스 없는 text-only 그림을 생략한다. 이 의도된 첫 정상화를 생활 optional 필드 부재/전체 byte-stability 검사와 혼합하지 않는다. fixture 안에서 deserialize를 호출하지 않으며, `p0ProjectSchema`는 새 프로젝트에서 그 한 필드만 없어지는지와 리소스 있는 text/graphic/both 보존을 별도로 검사한다. P0/P1/P2는 원문 동일성과 두 번째 왕복 안정성을 모두 유지한다. 공간 탭의 0개 배지는 공용 UI 계약대로 `data-count`를 생략하며, `p2SpatialEditorAuthoring`는 추가/삭제 확인/undo/redo와 4종 합계를 검증한다. `test/fixtures/life-full/coverage.json`의 51개 기능 및 F01..F13은 후속 완주용 **미실행 명세**이며 PASS 원장이 아니다.

## 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)

`src/project/tilePassabilityComponents.ts` 는 "여기서 저기로 갈 수 있나" 를 미리 계산한 색인이다. 세 가지가 계약이다.

- **1x1 게이트.** 색인 사용 여부를 `pass` 인자의 **유무**로 가르면 안 된다 — `playSceneAutonomous.ts` 가 추격에서 항상 `pass` 를 객체로 넘기므로 모든 추격에서 색인이 죽는다. 판정은 크기로 한다: `passIsUnitRect`(`player/chaseAi.ts:150`)가 1x1 인지 보고, 1x1 이면 색인을 쓴다. 통행 규칙을 복사하지 말고 `passageBounds` 에 물어야 한다.
- **타일셋 통행이 지문에 섞인다.** 지문을 타일 배열만으로 해시하면 안 된다 — `setPassageMark` 는 같은 `TilesetDef` 를 **제자리에서** 바꾸므로 벽을 통행 가능으로 바꿔도 색인이 낡은 "도달 불가" 를 계속 답한다. `mixTilesetPassage`(`:245`)가 4방향 통행 비트와 우선도를 지문에 접는다.
- **`INDEX_SCAN_RATIO = 8`**(`:102`). 훑은 칸이 맵 전체의 1/8 미만이면 색인을 만들지 않는다(`:115`) — 짧은 탐색에 색인 구축 비용을 물리지 않는다. `scannedCells` 를 생략하면 항상 만든다.

## 세계 법칙의 명시적 부재 (2026-09-05)

`worldCanon.laws[kind].present`의 기존 optional boolean 형태를 유지하되 `false`를 압축에서 제거하지 않는다. 키 부재는 미정, false는 없음, true는 있음이다. 기존 빈 프로젝트에 법칙을 만들어 넣지 않으며 버전 마이그레이션은 필요 없다. 과거 저장 시 제거된 false 값은 복구할 근거가 없어 미정으로 남는다. 설명만 있는 법칙은 설명을 보존하며 존재 여부는 미정으로 표시한다. normalize → serialize → deserialize 왕복과 AI의 「신: 없음」 전달을 `test/worldAuthoringRegression.test.ts`에서 검증한다. 이 데이터는 저작/AI 설정이며 게임의 죽음·통화·마법 런타임 규칙을 자동으로 바꾸지 않는다.

## Showcase media save-copy durability (issue #693, 2026-09-08)

`mediaImportPersistence.ts` stages showcase audio/video in a detached candidate.
The shared confirmation explicitly authorizes a NEW LegacyDb project before any
remote write. `loadNewRemoteProjectTransactionally(..., { source: "dev-showcase" })`
does not flush a quota-constrained source: it preserves live edits and previous
local recovery, saves the candidate to a generated target, then uses the existing
proof reader to check target identity and normalized content before adoption.
Cancellation, concurrent source edits/switches, failed writes, mismatched reloads
and local config/selection quota errors leave the source active. A successfully
written but unadopted remote copy may remain; there is no automatic remote delete.

Adoption removes the three showcase boot selectors from the URL so reload opens
the new remote project, not the seed. The original local override stays available
at its original URL. LegacyDb `current_json.assets.uploaded` remains the media
root; `legacyDbResourceCache` remains a cache, not canonical blob storage. No
project schema migration, local DB fallback or new backend is introduced.

Ordinary remote media import awaits store flush before success. A failed remote
flush retains the pending edit and asks the author to restore connection and save;
it does not erase data that other live edits may already reference. Showcase
imports instead publish nothing until the explicit save-copy is verified.
`ProjectStorageQuotaError` classifies native Web Storage quota errors with export/
cleanup guidance; local failures do not start the remote network retry loop.

Transaction ownership is the captured `contentLineage`, authored
`mutationGeneration` and project identity, not root-object reference equality.
A normal source flush may reconcile accepted audio/monster metadata into a new
root without an authored mutation. That synchronization must not reject the
transition. Real edits (even if subsequently saved), same-ID reload/replacement,
and cancellation still invalidate it at flush, target-save and target-reload
boundaries. `transactionalRemoteSourceLineage.test.ts` exercises the actual
flush/reconciliation and save/load pipeline with only the transport replaced.

Focused contracts: `devMediaPromotion.test.ts`, `mediaImportDurability.test.ts`.
Real browser script: `scripts/qa/issue693-media.mjs`; default runs actual showcase
quota/cancel/network-denial paths with all remote writes blocked. Only a lead with
authorization may run `--permit-new-remote-project` to prove an 8 MiB file's exact
bytes after real remote reload and Test Play. The default is not remote proof.

## 공용 첫 방문 데모 — 읽기 전용 저장 계약 (2026-09-14)

첫 방문자가 바로 보는 정본 데모는 전용 LegacyDb 행
`rpg-zzu-first-visit-demo`(「큰 강호 장터 마을」)다. 배포 기본(gallery) 행을 쓰지
않는 이유: 공유 행은 다른 탭의 자동저장이 덮어쓰는 실측 사고가 있다
(`openwiki/large-village-generation.md`).

- **읽기 전용 세션.** `store.loadSharedDemo()` 와 `store.load()`(`?project=` 또는
  작업 선택으로 데모 행을 연 경우) 모두 `writeAuthority = null`,
  `remotePersistenceEnabled = false`,
  `remotePersistenceDisabledReason = "shared-demo"`, `persistedBaseline = null` 로
  끝낸다. 방문자 편집은 메모리에만 머물고 `scheduleAutoSave`·`persistCurrent`·
  `flush`·`reconnectRemotePersistence`·`reloadFromRemote` 는 전부 기존
  `remotePersistenceEnabled` 게이트에서 멈춘다 — 새로운 쓰기 경로를 만들지 않고
  비활성 이유(`DbPersistenceDisabledReason` 에 `"shared-demo"` 추가)만 늘렸다.
- **URL·선택 저장 오염 금지.** `loadSharedDemo` 는 `syncProjectToUrl` /
  `saveLegacyDbSelectedProjectId` 를 호출하지 않는다 — 다음 방문도 첫 방문
  게이트를 다시 타고, 방문자의 기존 작업 선택을 데모가 덮지 않는다.
- **포크만이 유일한 쓰기 출구.** `forkSharedDemoToEditableCopy` →
  `loadNewRemoteProjectTransactionally(project)`. 데모 세션은 flush 할 원격
  원본이 없으므로(`dev-showcase` 와 같은 이유로) 소스 flush 단계를 건너뛰고,
  새 project id 에만 저장·재로드 검증 후 커밋한다. 데모 id 를 대상으로 한
  전환·발급은 `configuration` 오류로 거부된다. 저장 버튼·미디어 가져오기도
  데모 세션에서는 같은 사본 만들기 안내로 연결한다.
- **발행.** `scripts/publish-first-visit-demo.mts` 가
  `buildLargeRiverMarketVillageProject` 산출물을 QA(집 20채·NPC 53·시장·낚시·
  물길) 후 실제 LegacyDb 경로로 저장하고 재로드 일치를 증명한다. 스토어를 거치지
  않으므로 읽기 전용 가드의 영향을 받지 않는다. 증거는
  `output/evidence/first-visit-demo/`(적용 실행은 `{"saved":true,"reloaded":true}`).
- **계약 테스트:** `test/sharedDemoStore.test.ts` — 데모 로드 시 읽기 전용
  상태, dirty flush → `disabled` + 데모 행 무쓰기, 딥링크 경로도 동일,
  트랜잭셔널 포크가 새 id 로 저장·검증·커밋하고 데모 행에는 POST 가 가지
  않음, 데모 id 대상 전환 거부.

## Project schema & persistence

- **Character auto scale (2026-09-21):** optional `EventPageGraphic.scaleMode: "auto" | "manual"`
  survives project serialize/deserialize and is validated on page/graphic inputs. Missing mode plus
  explicit `scale` preserves the legacy absolute value (including 1); neither field means automatic
  integer fit to the current map cell. Explicit auto treats `scale` as a body multiplier. No version
  bump or data rewrite. Editor manual/auto controls and player/NPC/follower rendering share this
  contract; see `tile-geometry.md` «캐릭터 자동 배율» and `test/ioFootprintValidation.test.ts`.
- **Retained map planning items (2026-09-10, OPRN-019):** optional `GameMap.planningItems` is authored, human-readable planning data owned by `src/project/mapPlanningItems.ts`. Each row is `{id, text, status:"active"|"retired", origin:"user"|"spec", createdAt?, updatedAt?, specAssetId?}` with ids of the form `pi_N`, text folded to single spaces and capped at 400 characters, and at most 200 rows per map. The field is **absent** when unauthored, so legacy project JSON stays byte-stable and `SCHEMA_VERSION` is **not** bumped. `validateMaps` in `io/shapeEventFields.ts` is **fail-closed** at the JSON boundary — a non-array, blank id/text, duplicate id, unknown `status`/`origin`, non-string timestamp, or over-limit array rejects the load rather than silently dropping a sentence the user chose to keep. After shape checks, `normalizeProjectPlanningItems` (in `io/shape.ts`, beside `normalizeStoryFlags`) re-normalizes text and deletes the field when nothing survives. `serialize` passes the field through unchanged, so export (`.oprn` / project JSON) → import round-trips it, and LegacyDb load/save need no migration. Editor writes go only through `src/editor/mapPlanningActions.ts` as `{scope:"map", mapId}` updates. This field is authoring metadata for the assistant UX only: no runtime, session, save-slot, spec-gate, approval-policy or validator code reads it, and it must not become mandatory prompt memory — reuse is an explicit per-turn user choice (`openwiki/editor-ai-panel.md`). Tests: `test/mapPlanningItems.test.ts` (roundtrip, empty-field deletion, fail-closed cases), `test/mapPlanningReuse.test.ts` (reload through `store.replaceProject`, per-map scope, deletion).
- **System audio cue authoring (2026-09-08):** M2 027/028 fields add optional concrete `cue` and `operation:"set"|"reset"` (omission means set), preserving `resourceId` precedence over legacy `value` even when empty. New catalog defaults are `{cue:"battle",operation:"set",resourceId:"",volume:100}` for BGM and `cue:"confirm"` for SE. `src/project/systemAudioOverrides.ts` owns the finite cue keys; `volume` is per-track 0..100, not a mixer mutation. Generic forms show a disabled legacy placeholder instead of pretending a cue-less saved command has the new default. Existing project versions need no audio migration: generic M2 fields round-trip unchanged; only the optional runtime/save-slot `systemAudioOverrides` field is added. Its parser rejects unknown families/cues, non-string resources and non-finite/out-of-range volumes. See `runtime-sessions.md` for playback and silence/reset semantics.
- **Map-patch correction of invalid remote references (2026-09-08, task66):** a remote `current_json` can contain linked animals with an empty housing species policy even after the editor restores a valid local policy. Ordinary `deserialize`/LegacyDb load still rejects that row. Patch comparison extracts current-v4 maps/mapTree through shape checks and reference-independent normalization (`readProjectV4MapMergeSnapshot`); it never exposes invalid remote roots as a loadable Project. Reference repair is reserved for ordinary load and the validated complete candidate, not patch projection: repairing against remote roots first can delete concurrent common-event calls, transfers, schedules/living destinations, or rewrite emote targets that local roots/maps restore. This applies even if ordinary remote load would succeed after pruning. The same unpruned projection drives conflict detection, so a command-only remote edit cannot disappear from comparison. Local roots merge with the latest remote maps under the unchanged map/tree conflict rules. The completed candidate must pass reference validation before compatible load normalization, then the existing SHA-conditional write; a failed SHA re-reads and re-merges. Invalid local references, malformed remote shapes/versions, or incompatible merged references produce no write. No full-save fallback, animal-link repair policy, store-flight redesign, or schema migration is introduced. `test/legacyDbMapPatchRecovery.test.ts` uses real parsing/validation and deferred transport barriers for correction, unrelated-map/event payload preservation, restored reference targets, load refusal, same-map command conflicts, SHA races, and zero-write rejection.
- **LegacyDb schema deployment is manifest-driven (2026-08-24):** `scripts/lib/legacyDb-database-ops.mjs` registers every deployable file under `legacyDb/migrations/`; `test/legacyDbDatabaseOps.node.test.mjs` fails when a non-draft SQL file is omitted. Run `npm run db:check` for an anon-key/PostgREST schema probe. An administrator sets `LEGACY_DB_DB_URL` in untracked `.env.local` and runs `npm run db:migrate`; the Bun runner records SHA-256 checksums in the admin-only `rpg_zzu.schema_migrations` ledger, baselines already-complete legacy migrations, rejects partially applied or checksum-changed SQL, reloads the PostgREST schema cache, and finishes with project-scoped `ai_activity_logs`/`ai_conversations` insert→reload→cleanup verification. `DRAFT_*.sql` is never deployable. Do not report DB work complete until `npm run db:verify-ai` passes and the project id is recorded.
- **Missing AI tables are configuration errors, not successful fallbacks:** new activity writes never fall back into `ai_analysis_runs`; that table is read only for historical fallback rows. Missing `ai_activity_logs`, `ai_conversations`, or `user_skills` writes throw `LegacyDbMigrationRequiredError` naming the required migration. The local conversation record (IndexedDB `oprn-ai-records` since 2026-09-03; the old `oprn:ai-conversations` localStorage key is migrated on first access) remains available, but the failed remote mirror is logged instead of silently swallowed. `scripts/list-ai-activity.mjs --remote` loads `.env` plus `.env.local` and scopes both primary and historical queries to `VITE_LEGACY_DB_PROJECT_ID`.
- **Online-save credentials are deployment-owned (2026-08-24):** when a complete Vite LegacyDb URL/Anon pair exists, `legacyDbProjectConfigDraftWithSource` treats it as authoritative over stale browser custom credentials. Product UI never asks a user to enter URL, Anon key, or Project ID. Work selection persists separately as the non-secret `oprn:legacyDb-selected-project`; `loadNewRemoteProject` must not copy deployment credentials into localStorage. Old `oprn:legacyDb-project-config` remains read-only compatibility when deployment env is absent. This is a zero-configuration UX change, not LegacyDb Auth or per-user RLS: the client-visible Anon key is still public application configuration, and user isolation must not be claimed until Auth/RLS is implemented and verified.
- **AI 로그·대화 테이블의 anon 권한은 최소로 유지한다 (2026-08-27):** `20260827000000_ai_log_anon_delete_revoke.sql` 이 `ai_activity_logs` / `ai_conversations` / `ai_analysis_runs` 에서 anon 의 DELETE 를 회수한다. 클라이언트에는 이 세 테이블의 삭제 경로가 없다(`replaceRows` 는 maps/tilesets, `deleteLegacyDbUserSkill` 은 user_skills 만) — 그래서 회수해도 기능 손실이 없고, 공개 anon 키로 남의 프로젝트 로그를 지우는 경로가 사라진다. 권한만 바꾸는 마이그레이션은 컬럼 계약으로 상태를 판정할 수 없으므로 레지스트리가 `revoked-privilege` 계약을 갖고, 적용기가 `information_schema.role_table_grants` 를 읽어 적용 여부를 판정한다(계약 없이 등록하면 SQL 실행 없이 baseline 으로 기록되어 조용히 누락된다). `verifyAiPersistence` 의 프로브 행은 고정 id 로 upsert 되고, anon DELETE 가 거부되면 실패가 아니라 `probeRetained` 로 보고되며 `db:migrate` 가 관리자 DSN 으로 정리한다. Phase8 초안(`DRAFT_20260706_auth_rls.sql`)은 이 세 테이블의 RLS + 4개 동작 정책을 포함해야 하고, `test/legacyDbRlsCoverage.node.test.mjs` 가 등록된 마이그레이션이 만드는 모든 `rpg_zzu` 테이블에 대해 이를 강제한다(신규 마이그레이션의 anon GRANT 도 함께 차단).
- **P2 fishing/forage/collection/museum foundation (2026-08-25):** optional `database.fishSpecies` and `system.fishing`, `system.seasonalForage`, `system.collections`, `system.museum` records are normalized and shape/reference validated by `p2FoundationRecords.ts`, `shapeDatabaseFields.ts`, and `io/references.ts`. Missing P2 fields remain absent for byte-stable legacy project serialization. Fishing spots and forage areas carry bounded map rectangles; fish/item/map/reward references and duplicate ids fail closed. `PlaySession.collections`, `museumRewardAppliedIds`, `forageLastAdvancedDayKey`, generated-forage placeable metadata, and the dedicated `rng.streams.fishing` cursor are optional save-v3 fields handled by the shared manual/autosave/checkpoint writer, parser, and apply path. Load repair removes dangling P2 child rows without weakening museum AND conditions; map deletion reports and removes only definitions on the deleted map.
- **Optional P0 life-sim system records (2026-08-24):** `SystemRecords` accepts additive `energy`, `shipping`, `bundles`, `worldUnlocks`, and `makers` definitions. They are whitelisted by `normalizeSystemRecords`, shape-validated before normalization, serialized only when authored, and therefore leave old project JSON byte-stable. Bundle/world-unlock/maker definition ids and per-definition item rows must be unique. Reference validation fails closed for shipping allow-list items, bundle requirement/reward items and switch/recipe/world-unlock targets, world-unlock switches, maker input/output items, and enabled life-skill reward switch/recipe targets. Duplicate bundle/world-unlock/maker ids are also reported when linting an in-memory project, not only at the wire boundary.
- **P1 weather/animal foundation (2026-08-25):** authored weather is optional `system.dailyWeather { enabled, forecastDays?, seasons }`, where each season maps to bounded weighted `{ kind, weight, intensity? }` rules and `kind` reuses the native `none|rain|storm|snow|fog` union. Animal definitions are optional `database.farmAnimalSpecies`, placed animal-home definitions are `system.farmAnimalBuildings`, and editor-authored starting instances are `project.session.farmAnimals`. The animal-home type is intentionally limited to animal capacity/placement and must not be reused as the future general farm-building/house-placement model. `src/project/p1FoundationRecords.ts` owns direct-write normalization and collection/numeric limits; `shapeDatabaseFields.ts` rejects duplicate ids, unknown enums, unsafe numbers, and over-limit arrays at the JSON boundary. All fields remain absent when unauthored, so legacy project serialization stays byte-stable and no project schema-version bump is required. `src/project/io/references.ts` is the canonical cross-record authority: it validates duplicate species/building/instance IDs, feed/product item IDs, building map/bounds/allowed-species IDs, and start-instance species/building/event compatibility and capacity with exact authored paths. Repair drops species whose required item references are invalid and cascades their instances, prunes dangling allowed species, removes invalid placed homes, and clears invalid/incompatible/overflow home assignments without inventing replacements. Unknown event bindings remain a validation error rather than being silently retargeted.
- `system.craftRecipes[].requiresUnlock` and `system.itemUpgrades[].capability {areaWidth,areaHeight,energyMultiplier}` are additive authoring fields. Wire shape validation requires boolean recipe locks, tool axes in `1..9` with at most 81 affected tiles, and a finite positive energy multiplier; editor clamping and runtime fallback use the same limits. Legacy recipe/upgrade rows omit them unchanged. Sell-price rows used by shipping must have unique nonblank item ids and non-negative integer prices.
- Save schema version remains 3: P0 progress and the previously omitted `PlaySession.lifeSkills` / five shop economy fields are backward-compatible optional snapshot members rather than a project migration. `createSaveSnapshot`, the shared manual/autosave parser, and `applySaveSnapshot` own their only persistence path; checkpoint snapshots call the same writer/apply functions. Gold, loyalty spend, sold/bought counts, and mileage share the `src/project/economyValues.ts` safe-integer `0..GOLD_MAX` contract at writer, wire-parser, and direct-apply boundaries: malformed gold falls back to `0`, while malformed optional ledger rows are dropped without corrupting the whole save. Life-skill progress is restored only for current project IDs, XP is safe/capped to the authored maximum and level is derived from XP. Maker deadlines must be monotonic safe integers. Bundle completion/reward receipts are normalized to one known-ID union so a one-sided receipt cannot reapply rewards. Shipping history is bounded by authored `historyLimit`, and legacy omitted values restore to `startSession` defaults.
- P1 keeps save schema version 3. `PlaySession.dailyWeather` stores only the resolved current day `{dayKey,kind,intensity}`; `src/project/dailyWeather.ts` derives actual weather and tomorrow-first forecasts statelessly from the session seed plus calendar day key, so forecast length/query order never changes persisted RNG streams or the actual result. Forecasts are never serialized. `PlaySession.farmAnimals` is keyed by `instanceId` and preserves identity plus friendship, production progress, ready-product count, and fed/petted/last-advanced day keys. Writer, shared slot/autosave parser, direct apply, and checkpoints use the same bounded sanitizers. A runtime-moved `buildingId` is restored only while the current building exists and allows that species; otherwise apply falls back to the compatible authored start home (or no home). Invalid entries otherwise fall back to the authored start instance, unknown species are not restored, and legacy saves with both optional fields omitted start from `project.session.farmAnimals` with zero progress.
- Calendar wire parsing must not normalize against the default 28-day season because the parser does not yet have a `Project`. `isGameTime` accepts only structurally valid wire dates up to the authored maximum of 99 days and preserves them verbatim; `applySaveSnapshot(project, ...)` performs the calendar-dependent normalization for both `gameTime` and `farmPlotsAdvancedThrough`. This keeps day 40 in a 40-day season while safely clamping it if the current project is later changed to 28 days (`test/customSeasonSave.test.ts`).

- The `src/project` data model is the canonical authored content: maps, database records, tilesets, events, and saveable project metadata. Code that edits project content should update this model, not runtime session fields.
- Optional `system.genre` is limited to the five IDs in `src/project/genrePackId.ts`, is preserved by normalize/serialize/deserialize, and rejects unsupported strings during shape validation. It is editor authoring metadata only: all packs use the same `Project` schema and runtime, and player code must not branch on it. Pack definitions and readiness live in `src/editor/genrePacks.ts`.
- `GameMap.roguelikeRoom?` is additive authored room metadata: `{ roomId?, resetEventState?, encounterSlots?: [{ id, choices: [{ fieldSpawnId, weight?, minFloor?, maxFloor? }] }] }`. Slots reference field spawns on the same map, have unique non-empty ids, require at least one choice, use positive integer weights, and accept floor bounds 1–9999 with `minFloor <= maxFloor`. `resetEventState` defaults to true and scopes authored event self switches plus `Erase Event` state to the current room generation; false opts out. Omission preserves legacy field-spawn behavior and requires no schema-version bump. Runtime run state remains in `PlaySession.roguelikeRun`, not in project JSON.
- **DB-is-truth for database records (2026-07-24):** LegacyDb `current_json` is the canonical source for authored database collections (items, skills, states, battleAnimations, battlerAnimations). `repairLegacyDbCurrentJson` in `src/project/legacyDbProjectSync.ts` no longer backfills missing records from `defaultItemRecords()` / `defaultSkillRecords()` / etc. on load — a sparse DB row loads as-is. JSON defaults only **seed new projects** via `createBlankProject` → `saveProjectToLegacyDb` (a DB write). Local is cache-only; there is no local-JSON-as-truth path (enforced by `test/noLocalProjectDb.test.ts` and the `legacyDb-project-root` ontology contract). Verified by `test/legacyDbProjectSync.test.ts` (no-backfill unit) and `test/legacyDbCanonicalRoundtrip.live.test.ts` (live load→save→reload).
- **번들 기본 카탈로그 보충은 LegacyDb 백필과 다른 층이다 (2026-08-30):** 위의 "보충 금지"는 `repairLegacyDbCurrentJson` 이 **원격 행**에 손대지 않는다는 규칙이다. 그와 별개로 `ensureDefaultDatabaseIconResources()` (`src/project/defaults/defaultDatabaseIconResources.ts`, `store.normalizeCurrentProject` 에서 호출) 는 **번들 기본 아이템과 기본 장비**를 id 기준으로 보충한다 — 없는 id 만 넣고 이미 있는 레코드는 절대 덮지 않는다. 이 층이 필요한 이유는 실측이다: 편집기 기본 예제(`createSampleAdventureProject`)가 동결된 export 픽스처 `src/project/defaults/fixtures/dew-village-demo.json` 를 복제하는데, 그 픽스처에는 아이템 21개·장비 11개만 들어 있다. 아이템만 보충하고 장비는 보충하지 않던 비대칭 때문에 코드의 기본 장비 86종 중 11종만 화면에 보였다. 계약은 `test/defaultEquipmentBackfill.test.ts` 가 고정한다(모든 `defaultEquipmentRecords()` id 존재 + 사용자가 고친 이름 보존). **한계는 그대로 적어 둔다: 사용자가 의도적으로 지운 기본 레코드는 다음 로드에 다시 살아난다.** 보충이 `changed` 를 세우므로 그 부활이 다음 저장에 실려 나갈 수 있다. 아이템 보충이 원래 갖고 있던 성질이고 이번 변경이 만든 것은 아니지만, "보충 금지" 이야기의 유일한 실질 예외라서 명시한다.
- **저장이 스킵되는 세션은 화면이 그렇다고 말해야 한다 (2026-08-30):** `?freshProject=1` / `?blankProject=1` / dev 쇼케이스 위치는 의도적으로 `remotePersistenceEnabled = false` 이고 `isSaveSkippedLocation()` 이면 localStorage 기록조차 스킵한다. 예전에는 이 상태에서 편집해도 자동 저장 표시가 조용해서(또는 `saved` 로 보여서) 사용자가 저장됐다고 믿었고, 다시 열면 추가한 레코드가 사라졌다. 이제 `store` 가 이 조합에서 `{ kind: "error", code: "session-not-persisted" }` 를 세워 톱바 저장 칩(`db-autosave-state`)에 "이 세션은 저장되지 않습니다" 를 띄운다. 저장이 안 되는 것은 의도된 동작이고, 조용했던 것이 결함이었다. 계약은 `test/itemAddPersistence.test.ts` 가 실제 store·실제 `addDatabaseRecord` 경로로 고정한다.
- Runtime item-use charges are optional save/session data for backward compatibility. Missing or malformed charge maps normalize to an empty map; finite-use transitions own inventory/charge conservation. `src/project/itemQuantities.ts` owns the shared `ITEM_QUANTITY_MAX` (9,999,999), safe-integer validation, and result resolution. `changeItem`/`changeItemsAtomically` reject an unsafe current value, delta, or result before touching inventory or charge cursors; shipping, bundles, upgrades, makers, farming, crafting, storage transfers, and shop purchases/sales commit item movement through that contract. Chest save parsing and direct snapshot restore preserve valid chest metadata while dropping zero, unsafe, or over-cap inventory rows. Runtime equipment reads use effective normalized equipment, while user equip/unequip writes go through the strict atomic transition authority and never mint or delete inventory.
- Optional `GameMap.layoutPlan` stores generation bbox design after village/market builds (`MapLayoutPlan` / `MapLayoutRegion` in `types/project.ts`). Helpers: `src/project/mapLayoutPlan.ts` (`findLayoutRegions`, `rankRegionsByCenter`). Do not discard plan after stamping tiles — keep for “move blue house in center” style queries.
- **명명 로케이션 레이어 — `GameMap.locations` (OPRN-OUT-020, 2026-09-10):** 사람이 저작하고
  이벤트·인카운터·조수가 **이름으로** 가리키는 지역 층이다. `MapNamedLocation { id, name, x, y, w, h,
  note?, tags?, color?, origin? }`. optional 이라 **옛 맵은 필드 자체가 없고 마이그레이션도 없다**
  (`test/mapNamedLocations.test.ts` 의 "a legacy builder map with no locations layer is unchanged by
  load/save" 가 byte-stable 을 고정한다). 규칙 원본은 `src/project/mapNamedLocations.ts` 하나뿐이고
  편집기 UI·조수 툴·런타임·lint 가 모두 그걸 지난다.
  - **`layoutPlan.regions` 와 왜 분리했는가:** layoutPlan 은 **빌더 기록**이다. `setMapLayoutPlan` 이
    배열을 통째로 갈아치우고(`village/builder.ts`, `largeRiverMarketVillageBuild.ts`),
    `houseProtection`·`villageEvaluate` 가 `role === "house"` 를 시공 의미로 읽는다. 사람이 그 배열을
    편집하게 하면 (1) 재시공에서 사람 편집이 조용히 사라지고 (2) 사람이 붙인 낱말이 시공 검증기 판정을
    오염시킨다. 관계는 **한 방향뿐**이다 — `adoptLayoutRegionsAsLocations`(조수 툴 `adopt_layout_regions`,
    편집기 「설계 영역을 구역으로 가져오기」)가 복사하고, layoutPlan 은 한 바이트도 바뀌지 않는다.
    승격본은 `origin { kind:"layoutRegion", regionId, planKind? }` 스냅샷을 남기고 멱등이다.
    자동 승격은 없다 — **옛 빌더 맵을 열기만 해서는 아무 일도 일어나지 않는다.**
  - **일괄 이관 도구 — 「설계 영역 이관」 (LOC-ADOPT, 2026-09-10):** OPRN-OUT-020 이 제품
    책임자에게 미뤄 뒀던 「기존 빌더 맵 이관」이 **도구로** 들어왔다. 자동 승격은 여전히 없다 —
    바뀐 것은 사람이 보고 고를 수단이 생겼다는 것뿐이다. 규칙 원본은
    `src/project/mapLocationAdoption.ts`, 편집기 상태는 `src/editor/mapLocationAdoptionState.ts`,
    창은 `src/editor/panels/mapLocationAdoptionPanel.ts`.
    - **조사가 먼저다.** `surveyProjectAdoption(project, {roles})` 은 프로젝트를 한 바이트도 바꾸지
      않고 맵별로 (승격 후보 / 이미 승격 / 재바인딩 가능 / 이름 충돌 / 재시공 고아)를 센다.
      창을 여는 것만으로는 `locations` 필드가 생기지 않는다.
    - **실행은 계획을 받는다.** `adoptLayoutRegionsForMaps(project, {mapIds, roles, regionIds,
      collisionPolicy})`. `mapIds` 가 비면 **아무 일도 하지 않는다** — 프로젝트 전체 자동 적용
      진입점은 존재하지 않는다. `layoutPlan` 은 읽기만 하므로 실행 전후 바이트 동일.
    - **멱등성이 두 겹이다.** `origin.regionId` 뿐 아니라 **같은 사각형(x,y,w,h)** 도 본다.
      빌더는 재시공마다 `regions` 를 통째로 갈아치우고 `uniqueHouseRegionId` 는 그때 살아 있는
      배열만 보고 번호를 매기므로, 같은 자리의 같은 장소가 **새 region ID** 를 받을 수 있다.
      ID 만 보면 그 장소가 두 번 승격된다. 같은 사각형이면 로케이션을 다시 만들지 않고
      `origin.regionId` 만 새 ID 로 **다시 묶는다(rebind)** — 로케이션 ID 는 그대로이므로
      `insideLocation` 조건과 인카운터 참조가 전부 살아 있다.
    - **기본 역할은 `DEFAULT_ADOPTION_ROLES = ["plaza","market"]` 이고, 근거는 코드다.**
      `houseProtection.ts:53` 과 `villageEvaluate.ts:704` 가 `role === "house"` 를 **시공 사실**로
      읽고 한 마을에 집 롯이 20~40개 나온다 — 기본으로 켜면 저작자가 쓴 적 없는 이름 수십 개가
      한꺼번에 사용자-가시 장소가 된다. `river`/`lake`/`forest` 도 지형 기록이다. 반대로
      `villageEvaluate.ts:649` 는 `plaza|market` 을 **마을 공용 생활 공간**으로 묶어 센다 —
      사람이 "광장에서 만나자" 라고 말하는 층이 정확히 그것이다. 나머지 역할은 **숨기지 않고**
      필터에 전부 보이며 `adoptionRoleCaution(role)` 이 왜 껐는지 한 문장으로 화면에 적는다.
    - **이름 충돌은 조용히 해결하지 않는다.** 원시 `adoptLayoutRegionsAsLocations` 는 「상점 2」로
      말없이 피하지만, 일괄 이관에서는 수십 개가 한 번에 들어와 무엇이 밀렸는지 알 수 없다.
      조사가 충돌을 미리 세어 보여 주고, 실행은 정책을 고른다: `suffix`(번호를 붙이되 영수증에
      `renamedFrom` 을 적는다) 또는 `skip`(만들지 않고 목록에 남긴다). **어느 쪽이든 기존
      로케이션의 이름과 ID 는 바뀌지 않는다** — 사람이 쓴 낱말이 항상 이긴다.
    - **되돌림은 한 덩어리다.** 여러 맵을 골라도 `recordProjectSnapshot` 1건 + `store.update`
      1회다. 그리고 **무변경 실행은 되돌리기 칸을 먹지 않는다**: 실행 전에 복제본으로 예행하고
      no-op 이면 스냅샷을 아예 밀지 않는다(브라우저 QA 실측으로 잡힌 결함 — 멱등성을 확인하려고
      두 번째로 누른 사용자가 Ctrl+Z 를 치면 빈 스냅샷이 돌아와 승격이 남았다).
    - **출처 영역이 사라진 승격본(고아)은 조사가 보고만 하고 지우지 않는다.** 사람이 이름을
      고쳤을 수 있고 조건·인카운터가 가리키고 있을 수 있다.
    - 조수 툴도 같은 규칙을 지난다: `survey_layout_adoption`(읽기 전용, 먼저) →
      `adopt_layout_regions`(실행). 실행 툴의 `roles` 기본값은 **「전부」가 아니라**
      `DEFAULT_ADOPTION_ROLES` 이고 `collisionPolicy` 를 받는다. 반환의 `skipped` 는
      `skippedAlreadyAdopted` / `skippedNameCollision` / `rebound` 세 이유로 갈라졌다.
  - **ID 와 표시명은 분리된다.** ID(`loc1`, `loc2` … 맵 안에서만 유일)는 참조가 쓰고, `name` 은 사람과
    조수가 쓴다. 이름을 바꿔도 `insideLocation` 조건과 인카운터 참조가 살아 있다.
  - **참조 지점(실측 전량):** `map.encounterTable[].conditions.locationId`, `Condition` 의
    `{ kind:"insideLocation", locationId, inside }`(fork 조건 트리 + 페이지 출현 조건 + 레거시
    `event.condition`). 조건은 **맵 경계를 넘지 않는다** — 그래서 맵 복사가 안전하다.
  - **겹침은 허용이다**(상점가 안의 좌판). 조회 우선순위는 `topLocationAtPoint` 한 곳이 정한다:
    면적이 작은 것 먼저, 동률이면 저작 순서. 편집기는 정보 배지로만 알린다(차단 아님).
  - **맵 리사이즈·시프트는 로케이션을 클램프하고 절대 삭제하지 않는다**(`clampLocationsToMapSize`,
    `shiftMapLocations`; `editor/actions.resizeMap`·`mapShiftActions.applyMapShift` 가 호출).
    축소로 완전히 밖에 나간 로케이션은 경계 1×1 로 남고 lint 가 `map-location-degenerate` 로 알린다 —
    지우면 조건·인카운터 참조가 조용히 끊긴다.
  - **맵 복사**(`cloneGameMap`)는 `structuredClone` 으로 로케이션을 **같은 ID 로** 옮긴다. 참조가 맵 안에서만
    걸리므로 복사본의 조건·인카운터는 복사본의 로케이션을 가리키고, 한쪽 이름을 바꿔도 다른 쪽은 불변이다.
  - **로드는 맵 밖 사각형을 거부하지 않는다.** 맵 폭이 준 저장본이 열리지 않으면 사용자가 복구할 수단이
    사라진다. 로드는 타입·ID 유일성만 강제하고(`shapeEventFields.validateMapNamedLocations`), 기하 모순은
    편집기 통로 클램프와 lint 진단이 담당한다.
  - **레거시 raw 사각형은 그대로 동작한다.** `EncounterConditions.region` 은 유지되고, 같은 항목에 둘이
    있으면 `locationId` 가 이긴다(`src/player/encounters.ts`). 새 저작은 `locationId` 를 쓴다.
  - **끊긴 참조는 조용히 지우지 않는다.** 로케이션 삭제는 참조를 그대로 남기고
    `projectLint` 가 `map-location-missing-ref`(error) 로 올린다. 복구 경로는
    `repairMapLocationReferences` 하나이고 세 가지다: `remap`(다른 구역으로 재지정) /
    `detach`(구역 조건만 떼기 — 조건이 통째로 그것뿐이던 fork 는 항상-참 `{kind:"all",conditions:[]}` 로
    굳어 then 분기가 사라지지 않는다) / `freezeRect`(인카운터를 예전 사각형의 레거시 raw 구역으로 강등).
    lint 코드 셋: `map-location-missing-ref`(error), `map-location-degenerate`(warning),
    `map-location-duplicate-name`(warning).
  - **런타임 해석은 세션이 아니라 프로젝트에서 온다.** 세션에 사각형 사본을 만들면 저작 편집과 어긋난
    stale 사각형이 세이브에 굳는다. 그래서 `evalCondition(session, condition, host, { map })` 과
    `resolveEventPage(event, session, { locations })` 가 **현재 맵**을 받는다. 못 받으면 해석 불가 =
    **거짓**이고 lint 가 따로 알린다 — 조용한 참으로 통과시키지 않는다(`inside:false` 도 참이 되지 않는다).
    전투 이벤트는 `BattleSessionState.currentMapId/x/y`(전투 개시 시점 필드 위치)로 같은 판정을 내므로
    페이지·맵 fork·전투 세 표면이 일치한다 — `test/conditionEvaluatorParity.test.ts` 의 allowlist 는
    여전히 비어 있다. 세이브 스키마 버전은 그대로다(추가 필드 전부 optional).
  - 회귀(이관 도구): `test/mapLocationAdoption.test.ts`(33건 — 조사 무변경·역할 필터·명시 선택·
    멱등 2회·layoutPlan 바이트 동일·충돌 2정책·재시공 후 재실행·되돌림 1회·무변경 실행이
    되돌리기를 먹지 않음·저장/불러오기 왕복), `test/mapLocationAdoptionPanel.test.ts`(9건, 실제 DOM).
    브라우저 증거: `verify-shots/loc-adopt/`.
  - 회귀: `test/mapNamedLocations.test.ts`(31건 — 스키마 왕복·중복 ID 거부·겹침·리사이즈·시프트·복사·
    승격 멱등·조건 의미·인카운터·레거시 사각형·진단·복구 3종), `test/mapLocationTools.test.ts`(12건),
    `test/mapLocationLayer.test.ts`(7건, 실제 DOM). 브라우저 증거: `verify-shots/oprn-020/`.

- **구역 드나듦 트리거 — `{ kind:"locationTransition", locationId, transition }` (2026-09-10):**
  OPRN-OUT-020 이 「엔진에 걸음마다의 로케이션 변화 훅이 없다」는 이유로 미룬 enter/leave 의
  구현이다. 제품 책임자 승인 후 **기존 트리거 유니온과 기존 디스패치를 확장**했다 —
  새 스케줄러를 만들지 않았다.
  - **왜 기존 경로인가:** 이 트리거는 「auto」와 같은 성질이다(프레임 루프가 아니라 사건 하나가
    실행을 시작한다). 병렬(`parallelProcesses`)은 인터프리터를 프레임마다 조금씩 굴리는 다른
    기계이고, 여기 필요한 것은 «걸음이 끝났을 때 한 번» 이다. 그래서
    `activeRuntimeEvents("locationTransition")` → `runEvent` 를 그대로 쓴다
    (`activeRuntimeEvents` 의 인자 타입을 하드코딩 6종에서 `Trigger["kind"]` 로 넓혔다).
  - **판정의 집은 `src/project/locationTransitions.ts` 하나다.** 드나듦은 「안에 있는가」의
    **시간 미분**이므로 점유 집합(`locationsAtPoint`)의 차집합만 계산한다. 두 번째 내부/외부
    규칙을 만들면 `insideLocation` 조건과 트리거가 서로 다른 답을 내는 순간이 생긴다.
  - **상태는 세션의 `occupiedLocationIds`(mapId → locationId[]) 이고 ID 만 담는다.**
    사각형을 복사해 두면 저작자가 구역을 옮긴 뒤에도 세이브 안의 낡은 사각형이 판정을 지배한다
    (`insideLocation` 이 프로젝트에서 기하를 읽는 것과 같은 이유). optional 이라
    **SAVE_SCHEMA_VERSION 도 SCHEMA_VERSION 도 오르지 않는다.**
  - **호출 지점은 셋뿐이다:** (1) 걸음 완료 — `playSceneMovement.advancePlayerStepFrame` 의 칸
    확정 직후, 접촉 트리거 앞. 보간 중간값에서 판정하면 한 걸음이 경계를 여러 번 가로지른 것으로
    세어진다. (2) 순간이동 완료 — `playSceneMapCommands.transferTo`, 자동 트리거보다 먼저.
    (3) 이벤트 종료 후 재개 — `refreshRuntimeSurfaces` / `refreshRuntimeEntities`.
  - **(3) 이 없으면 가장 흔한 저작이 조용히 죽는다 (브라우저 실측 2026-09-10).** 문(playerTouch)을
    밟아 장소 이동하면 `transferTo` 가 **문 이벤트의 인터프리터 안에서** 불리므로 그 시점
    `scene.running` 이 참이고 `runEvent` 는 즉시 되돌아 나온다. 그래서 실행할 수 없었던 것은
    버리지 않고 **아직 돌리지 못한 이벤트 id** 를 큐에 담아 이벤트가 끝나는 자리에서 뽑는다.
    큐가 사건이 아니라 이벤트 id 를 담는 이유: 사건 → 이벤트 해석을 나중으로 미루면 그 사이 바뀐
    페이지 조건이 «그때 반응했어야 할 이벤트» 를 지운다. 첫 이벤트가 대화를 열면 **꼬리만**
    되돌려 담는다(사건을 통째로 담으면 이미 돌린 것이 두 번 연소한다). 상한 8 — 긴 전투 동안
    지나온 구역 전부를 뒤늦게 연소시키면 다섯 구역의 대사가 한꺼번에 터진다.
    점유 기록은 큐와 **무관하게** 즉시 갱신된다(기록이 발밑과 어긋나면 이후 판정 전부가 틀어진다).
  - **결정된 경계 사례** (전부 회귀 테스트가 있다):

    | 상황 | 계약 |
    |---|---|
    | 같은 칸 재판정 / 구역 안 이동 | 발동하지 않는다(점유 집합이 같다) |
    | 겹친 구역 A 안에서 B 진입 | B 의 enter 만, A 는 유지. 집합 차이라 포함관계를 특별 취급하지 않는다 |
    | 순간이동(중간 걸음 없음) | 출발 맵 점유 전부 leave + 도착 지점 enter. `transferLocationOccupancy` 한 번의 원자적 판정이다 — 두 단계로 쪼개면 「기록 없음 = 기준선」 해석에 도착 enter 가 삼켜진다(실측) |
    | 같은 맵 안 워프 | 같은 구역 안으로 떨어져도 leave + enter 가 **둘 다** 난다(벗어났다 돌아온 것이고 재진입 연출이 다시 돌아야 한다) |
    | 맵을 넘는 leave | 대상 이벤트는 이미 화면에 없다 — 「이벤트는 자기 맵 안에서만 산다」의 따름정리 |
    | 서 있는 채로 구역 삭제·축소 | 다음 판정에서 leave 로 정리된다. 끊긴 참조를 가리키는 이벤트는 발동하지 않고 lint 가 올린다 |
    | 안에서 저장 → 불러오기 | 아무것도 발동하지 않는다(기록이 세이브에 실려 복원된다) |
    | 기록 없는 옛 세이브 | 첫 판정은 **기준선만 심는다**. 불러오는 순간 이벤트가 터지는 것은 저작 의도가 아니다 |
    | 새 게임 시작 지점이 구역 안 | 기준선만 심는다(시작 연출은 auto 트리거의 일이다) |

  - **저작 표면:** 페이지 「시작 방식」 선택기의 **「구역에 드나들면」** + 그 아래 구역·시점
    선택기(`event-page-trigger-location`, `-transition`). 구역은 **이름**으로 고른다 —
    좌표 입력칸이 없다. 표면의 집은 `src/editor/locationTriggerAuthoring.ts` 하나이고 끊긴
    참조 문구는 `mapLocationLabels` 를 재사용한다. `triggerFromKind` 는 이제 `SimpleTriggerKind`
    만 받는다 — 매개변수 있는 이 트리거를 `{ kind }` 만으로 짓지 못하게 타입으로 막는다.
  - **끊긴 참조는 조건과 같은 통로다.** 참조 수집(`collectMapLocationReferences` 의
    `site.kind === "trigger"`) → `projectLint` 의 `map-location-missing-ref`(error) →
    `repairMapLocationReferences`. 트리거의 `detach`/`freezeRect` 는 시작 방식을
    **`action` 으로 강등**한다 — `auto` 로 강등하면 맵에 들어가는 순간 멋대로 돌아버리고,
    명령을 지우면 저작이 사라진다. 편집기 선택기는 삭제된 구역을 「(삭제된 로케이션 …)」 항목으로
    남기고 `eventDraftValidator` 가 `page.trigger.location-missing`(error)로 적용을 막는다.
  - **와이어 검사는 로케이션 실재 여부를 보지 않는다** — 삭제된 구역을 가리키는 저장본이 열리지
    않으면 사용자가 고칠 수단이 사라진다. `transition` 열거와 `locationId` 문자열만 강제한다.
  - 회귀: `test/locationTransitions.test.ts`(25건 — 순수 판정·겹침·삭제·축소·순간이동·세이브
    왕복·byte-stable·진단·복구), `test/locationTransitionRuntime.test.ts`(19건 — 실제 걸음·
    순간이동 `runSceneTest` + running 밀림 회복 3건), `test/locationTransitionAuthoring.test.ts`
    (12건, 실제 DOM). 출하 플레이어 브라우저 증거: `verify-shots/loc-transition/SUMMARY.md`
    (`npm run qa:runtime -- --scenario loc-transition`).

- `ActorRecord.faceResourceId` stores a standalone 48×48 face graphic resource id. `ActorRecord.characterIndex` (0..7) remains an optional sheet cell defaulting to 0 when omitted. `ActorRecord.faceIndex` is removed. Project schema version is bumped to 4 (`SCHEMA_VERSION = 4`); `migrateV3toV4` rewrites stored legacy (sheet id, faceIndex) pairs to standalone face resource ids on load, treating an omitted index as cell 0. Normalization may drop explicit characterIndex 0 to keep legacy JSON compact; editor previews and list thumbnails treat missing characterIndex as 0.
- `SkillRecord.scope` accepts `self | ally | allAllies | enemy | allEnemies`. `allAllies` is an additive value handled by type guards, normalization, references, tools, editor controls, runtime targeting, and serialization; existing scope values and saved projects remain valid, so this addition does **not** require a project schema-version bump or migration. Keep authored scope authoritative instead of deriving target side/cardinality from damage/healing/support effect kind.
- Gen1 battle metadata is additive and optional in schema v3: `SkillRecord.maxPp` (1..99) and `gen1CriticalRate: "normal"|"high"`, `StateRecord.gen1MajorStatus` (`poison|burn|sleep|freeze|paralysis`), `TroopRecord.trainerBattle`, and `ItemCaptureProfile.ballClass` (`poke|great|ultra|master`). Omission keeps the compatibility contract: no authored PP cap, normal critical class, no major-status semantic, wild/non-trainer troop, and the existing capture `multiplier` path. Normalization drops invalid metadata while preserving valid values through load/save, so this optional expansion does **not** bump `SCHEMA_VERSION` or require migration.
- The `monster-collect` genre preset must set the canonical selectors `system.battleParty = "monsters"` and `system.battleFlow = "strict"` in addition to the legacy `monsterBattleParty` compatibility flag, Pokemon battle UI, and `battleModel = "gen1"`. A Pokemon skin/model without the canonical party/flow selectors is not a complete preset.
- Optional `system.playResolution` is the project-authored logical play viewport. Omission remains byte-compatible with the legacy 320×240 default; `normalizePlayResolution` truncates and clamps authored values to 320–1920 × 240–1080 and drops an explicit default. `validateSystem` requires numeric width/height when the field exists, so serialize → deserialize preserves a valid custom viewport without a schema-version bump. `createPlayGame` uses it for Phaser, while `createPlaySurface` publishes matching CSS variables and geometry for title/runtime DOM. Dialogue width, lighting masks, and runtime marker culling derive from the live host/camera rather than fixed 320×240 constants. `calculatePlaySurfaceScale` keeps integer pixel-perfect upscaling when the stage fits at 1× or larger, but uses a fractional contain scale below 1× so a large authored stage never crops inside a smaller host. Battle keeps its separate 640×480 logical stage contract.
- System graphics: `system.titleResourceId` / `titleScreen.backgroundResourceId` drive the title background via `applyTitleScreenBackground` (default `rpg-zzu-title-field` 320×240 llm-provider pixel-art night village + crest logo `rpg-zzu-title-logo-crest` (scripts/generate-system-title-art.mts)). Changing `titleScreen.backgroundResourceId` must not clear `system.titleResourceId`. Optional `titleScreen.titleGraphic` (`mode` text|graphic|both + logo resource/x/y) renders title logo independently of the background. `system.systemResourceId` is the 9-slice windowskin (`applySystemGraphic` → `--runtime-window-skin`). `system.battleSystemResourceId` is the RM2k3 **System2** gauge/number/arrow chrome sheet (80×96 EasyRPG System2A/B/C) — **not** a windowskin and **not** a battle field backdrop. `applyBattleSystemGraphic` chroma-keys the sheet (top-left orange key), sets `--runtime-battle-system2`, and publishes slice CSS vars (`--system2-hp-fill-*`, `--system2-sp-fill-*`, `--system2-at-fill-*` from `src/assets/system2Sheet.ts`) consumed by `.battle-stat-bar` / `.battle-atb-bar`. Battle field art uses `resolveBattleBackdrop` (override → troop `previewBackgroundResourceId` → terrain → `generated-battle-reference-forest`); editor command previews and DB battle-screen labels must use the same fallback and never substitute System2. Runtime UI SFX use short RM2k3 cursor/decision/cancel wavs (`src/player/runtimeJuice.ts`); title can override cursor/confirm SE via `titleScreen.sounds.*SeResourceId` (`soundResourceId` on juice). Avoid long chimes on every menu open. The authored default runtime windowskin ships as `public/assets/ui/windowskin-warm.png`, a warm brown 9-slice painted through the same `--runtime-window-skin` variable (`src/styles/runtime/system.css`) and consumed via `border-image` by the status-menu party cards, detail panel, and command dock; `system.systemResourceId` still overrides it per project.
- Runtime pixel typography: `--runtime-pixel-font` (`src/styles/runtime/system.css`) lists `NeoDunggeunmo` first, ahead of the existing `Galmuri11` / `Galmuri9` / `GulimChe` / `DotumChe` / `"MS Gothic"` / `monospace` fallbacks, so the fallback chain stays intact when the webfont is unavailable. The face is declared with `@font-face` loading `public/assets/fonts/neodgm.woff2` (Neo둥근모, SIL Open Font License; license text kept alongside the file at `public/assets/fonts/LICENSE-neodgm.txt`). Neo둥근모 is wider per glyph than Galmuri at the same authored `font-size`, so runtime surfaces that pack text into fixed-width grid columns must be re-measured after touching this variable rather than assumed safe.
- Title menu options are id-based (`newGame` / `continueGame` / `quit`) and filtered by `titleScreen.menuVisibility` through `listTitleMenuOptions` (newGame always visible). Keyboard (↑↓ / Z·Enter / X·Esc) and mouse/touch click target only visible options. Click handlers live on `titleScreen.ts` options; `playInputBlocker` allows pointer events whose target is a title option (`title-new-game` / `title-load-game` / `title-quit-game`) while still blocking field pointer input. Optional `titleScreen.showInputHint` (default true) toggles the on-screen key hint. E2E should prefer `startNewGameFromTitle` from `test/e2e/runtimeInput.ts` (Enter) for stability; title option clicks are also valid for real users.
- `Project.storyFlags?: StoryFlagDef[]` is authored metadata that gives existing switches/variables stable narrative meaning. It stores `{id, kind:"switch"|"variable", targetId, description, questId?, tags?, retired?}` and must not replace `Project.session` or `PlaySession.switches/variables` as the runtime state machine. `declare_story_flag` registers/renames/retires this metadata; retire is soft deletion and live usage should remain visible through warnings.
- `Project.switches` / `Project.variables` are dynamically sized definition arrays with no configured 1000-record ceiling. New project factories seed one 20-row picker block for immediate command-form usability; editor add/range actions grow beyond it on demand, and `ensureSwitchVariableSlots` only reconciles authored definitions with `ProjectStartState.switches/variables` (it does not impose a minimum or maximum on loaded projects). Preserve legacy projects that already carry 1000 unnamed slots, and keep ids above `sw_1000` / `var_1000` valid through normalize, save/load, and `startSession`.
- `Project.meta.terms` stores optional authored label overrides for the currently wired runtime strings: battle commands (`attack`, `skill`, `item`, `capture`, `back`, `target`), shop labels, inn labels, and common/status labels (`gold`, `goldPrefix`, `level`, `hp`, `mp`). Runtime code should call `resolveTerms(project)` from `src/project/terms.ts` instead of reading raw fields so omitted terms keep default Korean behavior without bloating serialized old saves. Runtime `inn` pauses as a commerce surface (`playInn`); optional `branchOnNotEnoughGold` resumes with value `"notEnough"` into `notEnoughBranch`, while stay path recovers party vitals (`recoverMp` optional) and can `advanceToMorning` through `sleepUntilMorning`.
- `Project.quests` can contain legacy step-compiled quests and graph quests from `define_quest`. Graph quest nodes use `completesWhen` conditions over existing switch/variable targets or storyFlag ids resolved through the registry, plus DAG edges; they are authored metadata only and do not add a new runtime state machine.
- Quest graph static lint lives with `projectLint`: missing write sites for node completion conditions are `quest-graph:dead-end-node` errors, while unreachable-from-start and edge-orphan nodes are warnings. `generate_walkthrough` turns graph nodes into `run_scene_test` JSON by tracing story flag write sites; non-automatic steps use `manualHint` plus the headless-only `set` step.
- `Project.endings` is authored project data. Each ending has `{ id, name, conditions, priority, epilogue? }`; `triggerEnding` either targets an explicit id or selects the satisfied ending with the highest priority. `epilogue` uses the same beat shape as `script_cutscene` and is compiled at runtime before the existing title-return ending step.
- **Faction registry (2026-08-28):** optional `project.factions { defs, relations }` is the runtime faction identity layer, distinct from the authoring-only lore graph in `project.world` (whose `faction` entities and `enemyOf`/`allyOf` relations the runtime does **not** read). `FactionDef` is `{ id, name, worldEntityId?, color?, aggression?, protectedFromNpcs? }`; `FactionRelationDef` is `{ a, b, stance }` with `FactionStance` in `-2 worstEnemy | -1 enemy | 0 neutral | 1 friend | 2 ally` and `FactionAggression` in `0 unaggressive | 1 aggressive | 2 veryAggressive | 3 frenzied`. Membership rides on optional `EnemyRecord.factionId` and optional `FieldSpawnDef.factionId`, where the spawn wins so one enemy record can staff both sides of a fight. `src/project/factions.ts` is the only authority: `normalizeProjectFactions` drops empty/duplicate ids and relations pointing at undeclared factions, and `resolveFactionTable` builds the dense `Int8Array(size*size)` lookup. Two reserved factions `player` and `enemy` always occupy slots 0 and 1 with a built-in `-1` between them, unauthored pairs default to `0`, the diagonal defaults to `2`, and an unknown `factionId` resolves to the reserved `enemy` slot — so a project with no `factions` field behaves exactly as before and a typo stays hostile instead of turning pacifist. All fields are absent when unauthored, `validateFactions` in `io/shape.ts` fail-closes on malformed wire data (`worldEntityId` must be a string when the key exists), and load re-normalizes, so this does **not** bump `SCHEMA_VERSION`. Covered by `test/factionStance.test.ts` (defaults, symmetrization, duplicate-row folding, reserved-slot override, normalization drops, serialize/deserialize roundtrip), `test/factionsFromWorld.test.ts` (world provenance), and `test/factionRuntimePersistence.test.ts` (save overlay).
- **Duplicate authored rows fold to the more hostile value:** `resolveFactionTable` tracks which cells an authored `relations` row has already written (a parallel `Uint8Array` beside the dense `Int8Array`) and resolves a second row for the same pair with `Math.min`, writing both directions. Stance therefore cannot depend on `relations` array order. Nothing dedupes rows before this point: `normalizeProjectFactions` only drops rows whose endpoints are undeclared, and `validateFactions` checks shape, not uniqueness. The editor's stance matrix (`setSparseFactionStance`) and the `set_factions` tool both merge a pair given in either order, so duplicates arrive through hand-edited, machine-merged, or imported JSON — and before folding those resolved to whichever row happened to be last. Folding applies **only between authored rows**: the first row for a pair still overwrites the neutral default fill, the ally diagonal, and the reserved `player`/`enemy` `-1` seed exactly as before, so authoring `player`/`enemy` as allies still produces allies. `Math.min` is the same conservative rule `factionStance` already applies across asymmetric directions, so a peace row can never hide a war row.
- **`worldEntityId` is provenance, not identity:** factions materialized out of the `project.world` lore graph by `planFactionsFromWorld` (`src/project/factionsFromWorld.ts`, driven from the world panel's 전투 진영 변경안 preview in `src/editor/panels/worldManager.ts`) carry the originating `WorldEntity.id`. The planner resolves a lore entity to an existing def by that provenance **before** falling back to the derived combat id (`combatFactionIdFromWorldEntityId` keeps an id that already matches `WORLD_COMBAT_FACTION_ID_PATTERN` and is not reserved, otherwise emits `world_<readable>_<stable hash>`), so renaming a faction's combat id no longer makes the next materialization add a second def for the same lore faction. Stamping provenance onto a def that predates the field is the single write this planner performs on an existing row, and only when the derived id already paired them and `compatibleExistingDef` accepted the pair; name, color, and aggression stay hand-authored, incompatible same-id defs stay blocked in `diff.defs.conflicts`, and no def is ever removed. The stamp rides `diff.defs.changed` and counts toward `hasChanges`, so the preview reports it as `변경 N` and the apply button is not disabled as 적용할 변경 없음 (the apply toast still counts added defs and relations only). Repeat application is idempotent after that one pass.
- Event page movement type `chase` is distinct from `approach`: it uses deterministic A* over `canMove` passability, fixed direction tie-breaks, optional `sightRange`/`giveUpRange`, and `eventTouch` contact to run the page commands. `GameMap.safeZones` is an authored `{x,y,w,h}` tile-rect array; when the player is inside one, chase movers wait outside instead of touching the player.
- Play-mode character collision (RM2K3 same-as-characters): non-`through` NPC movers cannot enter the player's committed tile or mid-move destination (`isPlayerOccupyingTile` in `playSceneAutonomousMapActions.ts`), nor another `priority:"same"` + `overlapForbidden` event tile (`canNpcMove`). Player input already blocked solid events via `findBlockingRuntimeEventAtInMap`; forced player move routes use the same solid check. Move-route `setThrough` / jump still ignore character occupancy.
- Move-route hop commands: `{kind:"jump", dx, dy, heightPx?, durationMs?, se?}` and `{kind:"dropIn", heightPx?, durationMs?, se?, impact?}`. All hop options are optional and absent when unauthored, so this does **not** bump `SCHEMA_VERSION`; `validateMoveCommandShape` type-checks them and the runtime clamps (`0..960px` lift, `60..5000ms`). Defaults: jump peak 12px / 300ms / no impact, and `dropIn` 128px (8 tiles, above a 320×240 screen) / 620ms / impact on. `dx`/`dy` of `0` means "two tiles the way you face"; `dropIn` never changes tiles, so it clears the ground-occupancy question entirely and produces no walk step (no footfall care ticks, poison tick, follower step, or random encounter) — a jump lands as one normal step and does fire touch triggers. Both commands work for the player and for events; the player path lives in `applyPlayerRouteCommand` and only checks `inBounds` (out-of-map jumps are skipped, matching `canNpcMove`'s jump branch).
- `Project.world` is optional authored worldview data. Its canonical shape is `ProjectWorld` in `src/project/world/` (`entities` plus `relations`), normalized through `normalizeWorld` when present and treated as an empty world when absent for legacy projects. Editor UI should commit changes through the project store and keep runtime session state out of worldview records.
- `Project.worldGraph` is optional authored declarative map topology data. Its canonical shape lives in `src/project/worldGraph/`: nodes are `{mapId, role: "town"|"field"|"dungeon"|"interior", label?}` and edges connect `from.mapId/exit` to `to.mapId/entry` with kind `"transfer"` or `"adjacent"` (`"transfer"` default). The graph is normalized on load, permits planned nodes before maps exist as warnings, and `projectLint` includes `lintWorldGraph` for transfer destination/event-overlap errors plus adjacent boundary passability warnings. Actual player travel still uses normal event `transfer` commands; `link_maps`/`build_world` generate those events with stable IDs.
- Web export treats authored project JSON as the source of truth but strips editor-only event drafts and prunes `assets.uploaded` to statically referenced resource ids before writing `project.json`. `prepareWebExport()` must deserialize the serialized JSON once for shape validation before any package/download path reports success.
- **Export resource completeness (2026-09-06):** `src/battle/partySpriteResources.ts` owns party back-view/fallback selection for both battle rendering and export. `webExportAssets` includes derived resources for reserve actors and both fallback slot parities, then adds idle strips from the runtime catalog. Derived uploaded overrides must survive `prepareWebExport` pruning; a party texture key or successful combat result is not proof that its image decoded.
- **Export URL ownership:** `exportEntry` registers the game directory in `inlineAssetStore` before boot. `withInlineAsset` prefers embedded data, then rebases local `assets/` paths for exported players only. Editor paths, external URLs and SVG fragments remain unchanged. Image warmup, minimap tileset URLs and movie fallbacks use the same boundary. Catalog BGM may be fetched from the editor's configured CDN, but is packaged at the player's canonical local fallback path so exported playback needs no CDN setting.
- **Invalid ingredients do not produce success artifacts:** standalone rejects missing/empty/HTML bundle or media bytes; ZIP additional media rejects empty/HTML bytes while its existing manifest/hash checks remain authoritative for the player bundle. `url(#battle-flash-tint)` is a document fragment, not a file to fetch. The standalone CLI delegates to the same exporter.
- Idle and high-resolution sheet URLs also pass through `withInlineAsset`; including a file without rewriting its runtime URL is insufficient. HUD icons, runtime fonts and the fallback window skin use Vite-resolved CSS imports so web bundles use embedded or relative hashed assets; standalone `assetsInlineLimit` embeds imported CSS assets directly. `test/exportBattleAssetUrls.test.ts` exercises the actual producers and CSS build output.
- Loading v3 projects migrates legacy `villageInfoDocuments` into `Project.world` only when world is absent or empty. Each document becomes a `place` world entity linked to its map, while the original `villageInfoDocuments` field is preserved for one-version rollback and repeated deserialize/serialize cycles must not duplicate entities.
- `createBlankProject()` is a true blank authoring seed: one 20x15 default-chipset grass map named `빈 맵`, no events, a valid start position, and a one-actor starting party using the standard default database/system records needed to enter play mode. The sample adventure is intentionally separate as `createSampleAdventureProject()` (loads the editor-authored 《이슬 장터 — 30분》 fixture under `src/project/defaults/fixtures/dew-village-demo.json`, 16 maps) and should be requested explicitly when tests or UI flows need example content.
- **The shipped fixture's default-database tables are a derived artifact, not a hand-frozen snapshot.** `items`, `equipment`, `skills`, `states`, and `battleAnimations` are generated from the code defaults by `npm run fixture:sync` (`scripts/sync-fixture-default-database.mts`, merge rule in `scripts/lib/fixtureDefaultDatabase.mts`); `test/fixtureDefaultDatabaseDrift.test.ts` fails with that recovery command when they drift. The merge replaces default-id rows with the code value and preserves rows whose id is not a code default, so authored records survive. Maps, events, and every other table stay hand-authored — content scripts grow those.
  - Why the gate exists (measured 2026-08-30): content scripts read this fixture, add maps/events, and write it back, so the database froze at whatever it was when first exported. The demo shipped with all 11 equipment rows missing `accuracy`/`criticalRate`, 18 rows pointing at other records' icons (16 items + 2 equipment — `item_hi_potion` → `cc0-jetrel-potion-red`, `item_sword_manual` → a bronze sword instead of a book, `equip_iron_sword` and `equip_steel_sword` → both the bronze sword), empty `attackElementIds`/`stateDefenseIds`, and three stale prices. `ensureDefaultDatabaseIconResources` could not repair it because that pass only fills *empty* icon fields — a wrong value is left alone. `test/sampleAdventureNeedsNoBackfill.test.ts` now pins that the load-time pass finds nothing to do for the shipped demo.
  - Refreshing `items`/`equipment` alone is not valid: their rows reference `anim_gen_*` animations, `state_*` rows, and `skill_item_*` skills, so a partial sync leaves dangling references and `validateProjectReferences` throws. The five tables move together.
  - `test/e2e/author-dew-village-editor-demo.spec.ts` does **not** write this file. It writes a separate 2-map authoring smoke output to `test/fixtures/projects/dew-village-demo.json` and hard-asserts that 2-map shape. The two files share a name but are different artifacts; the earlier "regenerate with that playwright spec" note pointed at the wrong path and is how the shipped fixture went stale unnoticed.
- **`test/fixtures/projects/dew-village-demo.json` is deliberately kept old.** It is the legacy specimen for the three legacy-repair tests in `test/legacyDbProjectSync.test.ts` (imported as `dewVillageDemoLegacySpecimen`), which need a pre-migration project to have anything to repair — `retiredEquipmentItemReplacement` rewrites an existing row and does nothing when the row is absent. Do not "helpfully" refresh it or point those tests at the shipped fixture: the tests would pass vacuously.
- Shop economy session fields `shopLoyaltySpend` / `shopTradeCounts` / `shopMileagePoints` / `shopPawnTickets` / `shopLastRestockDayKey` persist S/A/B shop economy state (loyalty discount, dynamic pricing, mileage). Purchases preflight the player stack, player/merchant gold, and trade counters before committing the item grant; sales likewise preflight inventory, payout capacity, merchant gold, and every shop ledger before checking `changeItemsAtomically` and committing gold/count changes. A full, unsafe, or overflowing value leaves inventory, player gold, trade ledgers, and merchant gold unchanged. Mileage accrues **only on successful purchase** via `mileageRate` and is **deducted on refund** via `refundShopMileage`. Repair/appraisal services gate on `appraisalUnidentifiedPool` — empty pool disables the menu and returns `failed` (no gold is charged). Festival/traveling shops are **condition-gated**: `festivalFlag`/`travelingRouteId` must be wrapped in a `fork`/`condition` event; runtime does not auto-show a closed festival shop.
- `TilesetDef.transparentColor` is an optional authored-project hex color key (`#rrggbb`) set by the editor. It is persisted with the tileset, validated as an optional string, and render-time transparency should prefer it over bundled chipset default color keys.
- `TilesetDef.family` (2026-09-25) is an optional non-empty string naming the chipset art family (예: `"rasak-fantasy"`). Missing on legacy records and bundled sheets — `src/project/tilesetFamily.ts` then follows `referenceSourceTilesetId` to the root, uses `uploaded:<root id>` for uploaded sheets and `tilesetArtStyle()` for bundled ones. Persisted as-is; the assistant runner refuses cross-family chipset changes unless the user approved (`openwiki/teaching-assistant-tilesets.md` 「칩셋 계열 규칙」).
- `TilesetDef.kind` optionally classifies a sheet as `"rpg2k"` or `"custom"`. Legacy records infer uploaded or non-480 sheets as custom; bundled 480-chip sheets remain RPG2K. Editor tileset selectors group both categories. Custom map palettes preserve exact source-cell order (up to ten visible columns) and must not apply Combined Town tile-number/autotile-collapse semantics; explicit tile metadata and priority still control layer routing.
- `TileGroupMetadata.junctions` and `TileGroupMetadata.overlays` are optional authored structural-rule arrays. They are persisted with tile groups for roof/wall boundary omissions/replacements and conditional overlay tiles; keep them backward compatible and validate referenced roles/tiles through tileset semantic checks.
- `TileGroupMetadata.rules` is an optional authored cluster-rule array. `hard` rules map to project lint errors but do not block `commitChangeset`; placement-time enforcement plus lint reporting is the hard-rule contract. `medium` maps to warnings and `soft` maps to info. Current rule kinds are adjacency, spacing, and count, with validation owned by `src/project/lint/clusterRuleValidators.ts`; spacing/count use footprint instances rather than raw occupied cells.
- `TilesetDef.palettePresets` is optional authored tileset vocabulary. Each `PalettePreset` has a `pp_` id, name, origin, optional locked flag, and role slots (`ground/path/wall/water/decor/boundary/roof/furniture`) with tile ids and optional slot weight. Missing `palettePresets` remains absent for legacy projects; deserialize only normalizes present preset ids to the `pp_` prefix. `TileAiMetadata` also accepts numeric `confidence` plus `origin`/`locked` while preserving legacy string confidence/source/userLocked fields.
- `palettePresets` and semantic `tileGroups` are separate persisted contracts. Legacy placement may select `presetId + paletteRole`; v3 construction resolves approved group labels and pattern grammar. `BUILD_PALETTE_GROUP_IDS` contains persisted tile-group ids and `ensureBuildPaletteTileGroups` only normalizes matching groups; it must not create or mutate `palettePresets`.
- Legacy `tileset.terrainTemplates` fields are no longer part of the project schema. `deserialize`/`validateProjectV3` drops them silently for old JSON, and `serialize` must not write them back out. House structure grammar belongs to `src/editor/houseKit.ts`; dirt/sand terrain shaping belongs to `paint_road` autotile paths.
- Human tile-meta corrections mark `TileAiMetadata` as `origin:"user"`, `confidence:1`, and `locked:true` while preserving the legacy `source:"user"`/`userLocked:true` fields. AI tile metadata write paths must treat either `locked` or `userLocked` as protected, skip those tileMeta entries unless the call is explicitly user-confirmed, and return the Korean preserved-count warning line for proposal review.
- `src/project/tilesetPalette.ts` owns the compatibility reads (`tileMetaOrigin`, `tileMetaLocked`, `tileMetaConfidence`) and the canonical confirmation write (`confirmUserTileMetadata`). Do not normalize legacy aliases away during deserialize; old project JSON remains readable while all new human-confirmation paths write both generations consistently.
- Manual knowledge groups may persist `cellLayers` for row-major lower/upper decisions and `sourceBlocks` for coordinate-addressed atlas sub-blocks. `patternGrammar.kind:"repeatable_block"` requires positive `blockWidth`/`blockHeight` and exactly one row-major `repeatBody` tile per block cell; construction expands it by two-dimensional modulo. A 9×9 water atlas is stored as a source rectangle plus nine 3×3 `sourceBlocks`; it is not falsely treated as one generic autotile brush. Directional travel remains canonical in per-tile `TilesetDef.passability` (`up/down/left/right`) and is orthogonal to visual grammar.
- AI `run_lint` combines the existing `projectLint` result with `src/project/world/lint.ts` so world reference errors, unlinked lore warnings, unregistered NPC/item warnings, and guideline info share the same `error`/`warning`/`info` issue shape.
- Story flag static analysis lives in `src/project/storyFlagUsage.ts` and scans authored map events, common events, and troop battle-event pages for switch/variable reads and writes. `projectLint` emits warning-only `story-flag:*` issues for read-without-write, write-without-read, retired target use, and undeclared switch/variable use only once a project has at least one story flag, preserving legacy projects with raw switch usage.
- Combined Town defaults seed conifer/dry-tree/broadleaf hard adjacency plus flower medium and bush soft examples, and expose 흙길/모래/lake-water terrain clusters for palette discovery. Harness re-application preserves an existing harness group as authored state, only backfilling default `rules` when the group has no `rules` property. Deleted Combined Town harness groups are persisted through `TilesetDef.suppressedHarnessGroupIds` tombstones so load/normalize does not recreate them.


## Variable arithmetic & loop runtime (2026-08-07)
- 변수 연산: `session.setVariable`는 `/=`에서 `Math.trunc`(0 방향) + `-9,999,999..9,999,999` 클램프, `0` 나누기는 기존값 유지+경고. `previewSimulation.applyVariableOp` 동일 규격. 프리뷰 값 소스는 시뮬 상태 기준.
- 루프 스택: `stack.breakLoop`는 가장 가까운 `loopOwner`만 끊고, 루프 없으면 스택을 비우지 않고 경고를 반환한 뒤 현재 `breakLoop` 명령을 한 칸 넘긴다. 같은 명령을 재실행해 instruction budget을 소진하지 않는다. `hasLoopFrame` / `maxLoopIterations=100,000` / `maxStackDepth` 가드는 유지.

## Canonical event-draft projection (2026-07-30)
- Open editor drafts may live inside the in-memory `Project`, but they are never canonical authored output. `committedEvents()` excludes `draft.kind:"new"` and projects `draft.original` for edit drafts; `projectWithoutEventDrafts()` applies this to every map. Autosave, LegacyDb writes, package/web export, edit-history project snapshots, and any canonical serialization boundary must use that projection.
- Editor-only map/list/marker/drag surfaces use `editorWorkingEvents()` so new and edited events do not disappear while their canonical projection is hidden. Runtime/project consumers must not switch to this working projection.
- `eventDraftVault.ts` stores project-scoped local recovery copies and reapplies live drafts over incoming remote/replace snapshots. Apply/OK remove draft metadata before canonical persistence; Cancel forgets the vault row and restores the original/removes the new event. The vault is recovery state, not a second authored source of truth and not evidence of a successful remote save.
- When an incoming canonical event still exists but its body differs from `draft.original`, `rebaseOpenEditDraft` keeps the on-screen working body and moves the save baseline to that incoming event. The editor still marks `draft.conflict.kind === "remote-change"`. A missing committed event stays in the editor as `remote-delete`, and `committedEvents` omits it so the next save does not write the pre-edit snapshot back. Contract: `test/eventDraftVault.test.ts`.
- `store.beginReadOnlyProjectSnapshot()` temporarily changes `getCurrent()` for runtime readers while mutations, dirty state, autosave, `flush()`, and LegacyDb persistence continue to use the private canonical `current`; release restores the prior reader snapshot idempotently. Ordinary test play exposes a `projectWithoutEventDrafts()` snapshot after its save flush, while selected-event test exposes the canonical snapshot plus only the selected working body and never flushes. Keep this API scoped to runtime sandboxes and release only after player teardown.

## P2 general buildings and home decorations (2026-08-25)

- Authored definitions are optional `database.farmBuildingTypes[]` and `database.homeDecorationTypes[]`. General building levels carry contiguous `level`, rotated `footprint`, generic `capacity`, optional build/upgrade `cost`, and graphics. Decorations carry `placementItemId`, footprint, `blocksMovement`, allowed orientations, graphics, and optional allowed maps.
- Authored starts are optional `project.session.farmBuildingPlacements[]` and `project.session.homeDecorationPlacements[]`; runtime uses keyed `PlaySession.farmBuildingPlacements` and `PlaySession.homeDecorationPlacements`. These domains are intentionally separate from P1 `system.farmAnimalBuildings` and legacy single-tile `placeables`.
- Limits are centralized in `spatialPlacements.ts`: 256 definitions, 16 levels, 1,024 placements, footprint axes <=16 and area <=128, capacity <=9,999. Normalization is bounded, duplicate IDs are first-wins, costs aggregate duplicate item rows without exceeding `ITEM_QUANTITY_MAX`, and orientations are `down|left|right|up`.
- `shapeDatabaseFields.ts` validates full definitions and `shape.ts` validates authored starts. Old projects with all four fields absent retain the same serialized shape.

## 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)

`src/project/eventDraftVault.ts` 는 `scheduleEventDraftVaultPersist()` 로 250ms
(`PERSIST_DELAY_MS`) 디바운스 저장을 걸고, `persistEventDraftVaultNow()` 로 즉시 저장도 한다.
문제는 즉시 저장이 **대기 중인 타이머를 그대로 두었다**는 것 — `rememberEventDraftVaultEntry()` 가
디바운스를 건 직후 `persistEventDraftVaultNow()` 를 부르면 즉시 1회 쓰고, 250ms 뒤 **같은 내용을
한 번 더** 쓴다(`savedAt` 만 갱신된 중복 쓰기). 같은 파일의 `restoreEventDraftVaultEntries()` 와
`_resetEventDraftVaultForTest()` 는 이미 타이머를 취소하고 있었으므로, 취소는 이 모듈의 기존 규약이다.

지금은 `cancelPendingPersistSupersededBy(projectId)` 가 **projectId 가 일치할 때만** 취소한다.
무조건 취소하면 다른 프로젝트를 겨냥해 대기 중인 저장을 잃을 수 있다 — 그래서 예약 시점의
projectId 를 `persistTimerProjectId` 에 함께 들고 있는다.

왜 눈에 걸렸나: `test/transactionalNewRemoteProject.test.ts` 가 localStorage 스냅샷을 바이트
동일성으로 단언하는데(실제 타이머 사용), 이 중복 쓰기가 단언 앞뒤로 오가며 `savedAt` 만 달라지는
**경합**을 만들었다. 테스트를 느슨하게 하는 대신 중복 쓰기 자체를 없앴다. 계약 테스트:
`test/eventDraftVaultPersistDebounce.test.ts`.

## Boot normalizers must not create dangling references (2026-08-30)

`store.normalizeCurrentProject` 는 부팅마다 13개 정규화기를 돌린다. 그중
`ensureDefaultDatabaseIconResources` 는 이름과 달리 **기본 아이템 카탈로그 187종을 프로젝트에
밀어넣는다.** 그 아이템들은 기본 스킬·상태 테이블(`defaultSkillRecords`/`defaultStateRecords`)을
참조하므로, 자기 스킬·상태 세트가 더 작은 프로젝트(예제 어드벤처 = 이슬 장터: items 21 / skills 21 /
states 5)에 아이템만 넣으면 **프로젝트가 부팅 중에 스스로 참조 무결성을 깬다.**

실측(2026-08-30): 이슬 장터 로드 직후 참조 위반 0건 → 아이템 주입 후 82건. AI 런의 `run_lint` 가
그 54건(런 시점 기준)을 잡아 레이어 검증이 3회 연속 실패하고 런이 죽었다. 게다가 에이전트가 고아
레코드를 `delete_database_record` 로 지우려 하면 커밋 게이트가 **같은 왕복 오류**로 거부해 청소가
불가능한 교착이 됐다.

계약:
- 기본 레코드를 주입하는 정규화기는 주입 대상이 참조하는 기본 스킬·상태를 **같이** 보강한다
  (`ensureItemReferences`). 기본 세트로도 채울 수 없는 참조를 가진 레코드는 주입하지 않는다.
- `state_death` 는 엔진 내장 상태다(`references.stateIdExists`) — 레코드가 없어도 유효하다.
- 검증: `test/bootNormalizerReferenceSafety.test.ts` 가 계약을 고정한다 — 예제 어드벤처·빈
  프로젝트 모두 부팅 DB 정규화(`ensureDefaultDatabaseIconResources` →
  `ensureBundledBattleAnimations`) 후 참조 위반이 **0** 이어야 하고, 주입된 아이템은 없는
  스킬·상태를 가리키지 않아야 한다. 두 정규화기의 선언 순서가 계약의 일부다(아이템의
  animationId 는 뒤따르는 애니메이션 보강이 채운다).
- 커밋 게이트 기준선 대조는 집계 메시지를 줄 단위 원자로 쪼개 비교한다
  (`changeset.issueAtoms`) — 그러지 않으면 위반 하나를 지우는 편집이 "새 오류"로 분류돼 청소가
  영구 차단된다.

## `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)

`.oprn` 은 예전부터 편집기 전용 "프로젝트 파일"이었다. 게임을 남에게 넘기는 경로는 「웹 게임
내보내기」뿐이었고 그 산출물은 `player.html` + `project.json` + 에셋이 흩어진 **여러 파일 ZIP** 이라
압축을 풀고 웹 서버에 올려야 돌아간다. 즉 **파일 하나를 건네 게임을 여는 경로가 없었다.**

계약:
- **컨테이너는 그대로다.** `src/project/package.ts` 의 `createProjectPackage` / `readProjectPackage`
  가 정본이고 확장자는 `OPRN_EXTENSION = ".oprn"`, MIME 은 `application/vnd.openrpg.project+zip`.
  새 포맷을 만들지 않았다 — 이미 단일 파일 ZIP 이고 업로드 에셋도 `assets.uploaded[].dataUrl` 로
  안에 들어 있다.
- **플레이어가 `.oprn` 을 연다.** `src/player/exportEntry.ts` 는 번들 `project.json` 을 못 읽으면
  죽지 않고 `renderOprnGameFilePicker`(`src/player/oprnGameFilePicker.ts`) 를 띄운다. 파일 선택 또는
  드래그&드롭 → `readOprnGameFile` → 기존 `startPlayer` 경로(제목·hostBridge)를 탄다. 단, 파일로 연
  게임의 세이브 네임스페이스는 그 파일의 `exportedProjectId` 로 정한다. 주소에 번들된 게임을 위한
  호스트 `saveNamespace` 나 `/play/<slug>` 를 물려받지 않아 서로 다른 게임의 세이브가 섞이지 않는다.
  번들 게임은 기존 우선순위(호스트 값 → 커뮤니티 slug → 프로젝트 ID)를 그대로 유지한다.
  `?open=1` 로 번들 게임이 있어도 열기 화면을 강제할 수 있다.
- **판정 로직은 DOM 과 분리한다.** `src/player/oprnGameFile.ts` 가 확장자/MIME 판정
  (`isOprnGameFile`), 드롭 목록에서 게임 파일 고르기(`pickOprnGameFile`), 디코드
  (`readOprnGameFile` — 던지지 않고 `{ok:false, message}` 를 준다) 를 소유한다. 그래서 브라우저 없이
  `test/oprnGameFile.test.ts` 로 고정된다.
- **에셋이 왜 따라오는가.** 번들 에셋은 플레이어 앱 안에 있고 저작자가 올린 그림은 프로젝트 JSON 의
  data URL 이다. 그래서 `.oprn` 하나로 화면이 정상 렌더된다 — 별도 에셋 폴더가 필요 없다.
- **플레이어는 `.json` 프로젝트를 받지 않는다.** 편집기 「가져오기」는 레거시 호환으로 `.json` 을
  계속 받지만, 플레이어 열기 화면은 `.oprn`/`.rpgzzu` 만 받는다. 게임 배포 표면을 좁게 유지한다.

검증: `test/e2e/oprn-single-file-game.spec.ts` 가 한 스펙에서 세 구간을 전부 통과시킨다 —
편집기에서 내보낸 `.oprn` 한 개(ZIP 매직 `PK` 확인) → `player.html?open=1` 의 보이는 버튼과 실제
`filechooser`, 이어서 실제 `DataTransfer` 드롭으로 각각 열어 타이틀 화면 기동(`document.title` 이
내보낸 파일명 어간과 일치) → 같은 파일을 빈 프로젝트 편집기로 되가져와 맵 수가 원본과 같아짐.
세이브 네임스페이스의 파일/번들 분기는 `test/oprnGameFile.test.ts` 가 고정한다. 증거 PNG 는
`verify-shots/oprn-single-file-game/`.

## 성장 트리 선택 확장 (2026-09-05)

`Project.growth`는 v4 선택 필드이며 기존 저장본에 자동 생성하지 않는다.
스킬 노드/직업 참조와 DAG는 `growth/validation.ts`, 투자 세이브는 `PlaySession.growthProgress`와
`saveSlots.ts`가 소유한다. 영구 스킬 목록에 투자 효과를 합쳐 저장하지 말 것.
자세한 계약: [성장 트리](growth-trees.md).
## 마을 설계서 (2026-09-05)

v4에 선택 필드 villagePresets[].design, defaultVillagePresetId, maps[].villageDesignSource를 추가했다. 레거시 프리셋은 자동 전환하지 않는다. 설계서·기본 참조는 load validator가 검사하며 JSON 저장/재로드 계약 테스트가 있다. 상세 계약과 경계는 [마을 설계서](village-design.md).
- 2026-09-05 emote recovery: native `showEmote` retains target/emote/durationMs through serialize/deserialize. `repairProjectReferences` (via `pruneDanglingCommandRefs`) recursively converts missing named event targets to `{eventId:""}`; native validation checks icon vocabulary, target shape and numeric duration. No stored project version bump is required for this additive command.


## 공포 게임 제작 기능 (2026-09-05)

선택적 EventPage.interaction 및 movement.pursuit를 검증하며 구버전 기본 동작을 보존한다. 데이터·런타임·저작·검증 계약은 [horror-authoring.md](horror-authoring.md) 참조.

### 저장된 대사 별칭과 맵 오버레이 (2026-09-05)

`oprn-399e312698` 약초상 릴리는 `{kind:"text", text:"..."}`가 저장돼 `body`가 undefined인 채 대화 렌더에 도달했다. `textBodyOf`와 ProjectStore의 로드 후 정규화는 `body`(빈 문자열 포함) → `text` → `lines` → `dialogue.lines` 순서로 원문을 읽는다. 인터프리터도 같은 읽기 함수를 사용해 maps-table 오버레이·기존 세션이 정규화를 건너뛰어도 대사에서 멈추지 않는다. 잘못된 객체는 문자열로 강제 변환하지 않는다. `test/textLegacyLines.test.ts`가 저장→로드 후 정규화→재저장과 원시 명령 실행을 검증한다.

## NPC 표시 이름 (2026-09-05)

GameEvent.name은 선택적 표시 이름이다. place_npc가 저작한 이름을 상태 페이지의 name과 별도로 보존해 재시도 중 중복 생성되지 않게 한다. 기존 이름 없는 이벤트는 페이지 이름을 조회 폴백으로 유지한다. 저장→로드 뒤 동일 NPC 갱신 계약은 test/adventureCompletion.test.ts로 검증한다.

`GameEvent.placementRole?: "npc"` is optional authored placement metadata (2026-09-06).
`place_npc` stamps it independently of sprite names and opt-in social `characterId`.
The existing JSON persistence path preserves it, and `validateEventShape` rejects
unknown role values. No version bump or blanket migration of custom sprites is used:
legacy unknown fixed objects must not become NPCs. Uploaded graphic replacements,
serialized reload, blocked-position lint and `move_event` recovery are covered by
`test/aiBlockedEventRelocation.test.ts`; authored pages and commands remain unchanged.

`set_project_settings({startActorIds})`는 system 메타데이터와 저작 시작 상태 `project.session.partyActorIds`를 함께 갱신한다. 실제 새 게임은 `startStateOf(project)`를 사용한다. 시스템 필드만 변경하고 런타임 파티 인원까지 바뀌었다고 판정하지 않는다.
## 연결 실내 도면의 영속성 (2026-09-05)

집·마을에서 자동 생성한 실내도 기존 `GameMap.roomHarnessPlan`에 개념 오버레이가 포함된 플랜을 저장한다. 새 스키마 필드나 버전 증분은 없다. `createHouseInteriorMap`은 현재 프로젝트의 꾸러미·구조물 그림을 읽고, 재로드 후에는 이 플랜으로 방 세션을 복원할 수 있다. `test/interiorConceptRoutes.test.ts`가 실제 `serialize` → `deserialize` 후 장소·물건 오버레이 보존을 검증한다. 옛 플랜은 실내 재시공 때 꾸러미에 연결된다.

## 개념 장소 형상 (2026-09-05)

`ConceptPlaceRecord.shape?: "rect"|"l"|"alcove"`는 장소의 선택적 바닥 형태다. 생략은 이전 직사각형과 동일하다. cloneConceptBundle·plan 파서·validateTileset·방 하네스 플랜·serialize/deserialize가 보존/검증한다. 모양을 바꾸어도 장소 id나 이벤트 소유 공간이 여러 개로 분할되지 않는다. 구체 도면은 `project/interiorRoomFootprint.ts`의 사각형 합집합으로 해석한다.

## Optional village decoration attachments (2026-09-13)

`VillageDesign.objectVillage.decorations?: VillageDecorationRule[]` persists outdoor space IDs,
placement zones (`house`, `commons`, `market`, `shore`, `road`) and repetition ceilings (1–32).
Historical designs omit the field and retain their previous behavior. `villageDesignIssue` validates
its shape; generation validates referenced spaces and graphics before painting. Ordinary serialize /
deserialize preserves the field and authored spatial library. Generated maps freeze actual space,
object revisions, graphics and placements in `villageDesignSource.resolvedSettings.spaceDecorations`;
this is authored provenance, not runtime state. The shipping player consumes the generated map through
its existing raster/collision path. See `small-village-generation.md` for the attachment contract.

## Optional map climate (Feature16, 2026-09-21)

`GameMap.climate` is optional: `{mode: "inherit" | "indoor"}` or
`{mode: "fixed", weather: "none" | "rain" | "snow" | "storm" | "fog", intensity: number}`.
`project/mapClimate.ts` normalizes modes, clamps intensity to 0..1 (default .5),
and discards unknown mode values. `io/shape.ts` applies it after cloning on the
canonical project load/merge path. Serialization preserves the authored object;
unset legacy maps remain unset. This is additive with no version bump.

`resolveMapWeather` applies fixed/indoor overrides only at `syncWeatherLayer`'s
render boundary. Indoor suppresses precipitation, fog and lightning immediately;
transitions still advance underneath and outdoor maps resume global weather.
Neither map transfers nor fixed climates overwrite `session.m2Runtime.screen.weather`
or the daily-weather calendar. Event weather commands continue to update global
weather even indoors. Save/load stores authored climate in the project and global
weather in the existing session path. Contracts: `test/feature16WorldSchema.test.ts`,
`test/feature16WorldClimate.test.ts`.
## Optional authored combat rules (feature16, 2026-09-21)

`databaseRecordModel.normalizeSkillRecord` and `databaseEnemyTroopRecordModel.normalizeEnemyRecord` preserve formula/crit/cooldown/hit-sequence and conditional drops/AI conditions through normal project deserialize/serialize. Existing schema version is unchanged: omitted optional fields retain old behavior; an absent drop array differs from an explicitly empty array. Bounds and evaluation semantics are in `runtime-battle.md` → Authored combat rules. Editor `updateSkillRecord` whitelist includes all new fields. Roundtrip coverage lives in `test/feature16CombatSchema.test.ts`; project contents are only minimal test fixtures, not authored remote DB content.
## AI 저작 보조 설정의 프로젝트 지속성 (Feature16, 2026-09-21)

`Project.aiAuthoring?`는 `project/aiAuthoring.ts`의 `AiAuthoring`:
`templates: {id,name,tags,body}[]`, `dialogueStyleRules: string`, `maxDialogueChars: number`다.
런타임 전투/대사 실행 의미를 바꾸지 않는 에디터 설정이며 버전 축은 올리지 않는다.
`io/shape.normalizeProjectV4`는 필드가 있는 문서에만 순수 정규화를 적용한다. 구형 문서의
필드 부재는 그대로 두고 UI에서 기본값(빈 목록·빈 규칙·240자)을 제공한다.
잘못된 항목/중복 id는 제외하고 태그를 정리하며 이름/본문/규칙과 글자 수 범위를 제한한다.
표준 `serialize`의 루트 복사와 기존 프로젝트 저장 경로가 필드를 보존한다.
라이브러리/규칙 편집은 undo 스냅샷 및 라벨이 있는 `store.update`로만 기록한다.
일시적 대사 색인·LLM 지적·프롬프트 관측 원문은 프로젝트에 저장하지 않는다.
`test/feature16-ai.test.ts`는 실제 serialize/deserialize의 구형 부재, 저장·수정·삭제 왕복을
검증하도록 작성했다. 테스트와 원격 저장은 작성 세션에서 실행하지 않았다.
## 구름량 optional 필드 (2026-09-21)

`GameMap.cloudShadows.amount?: number`는 0~6단계이며 생략한 기존 데이터는 3으로 렌더한다.
`normalizeCloudShadowParams`에서 반올림·clamp하고 비정상 값은 기본 3으로 복구한다.
기존 맵 직렬화가 필드를 보존하므로 문서 버전 상승이나 원격 데이터 마이그레이션은 없다.
`setMapCloudShadows`와 AI `set_map_properties`가 저작 경로이며 구름량은 진하기/크기와 독립이다.
로컬 편집기 UI 0/1/6 설정 및 `serialize`→`deserialize` 왕복, 옛 데이터 기본값은
`scripts/qa/cloud-amount-editor.mjs`로 브라우저에서 확인했다. 실제 게임 콘텐츠는 변경하지 않았다.

Feature16/main 통합: `syncWeatherLayer`에서 맵 기후를 먼저 해석한 같은 날씨를
렌더러와 `audio.weather.update` 양쪽에 전달한다. 실내는 날씨 소리도 차단하며
전역 날씨 상태는 유지한다.
### Map atmosphere layers (2026-09-21)

`GameMap.atmosphereEffects?: AtmosphereEffect[]` adds optional map-wide visual decoration.
Kinds and bounded amount/speed/size/opacity settings live in `src/project/atmosphere.ts`.
Editor map settings expose a separate 환경 효과 section and save via `setMapAtmosphereEffects`
→ scoped `store.update` (map edit lock and mutation observation preserved). JSON save/load retains
these plain settings; no schema version bump or changes to gameplay WeatherKind are needed.
Old maps without this field have zero atmosphere layers. Rendering presets do not author new maps,
change calendar/fishing weather, or download assets. Local runtime QA fixtures are not project content.

Atmosphere layers additionally accept optional `sound`, `volume`, `tint` settings. The pure model
normalizes missing sound by visual kind, volume to0.35, and only #RRGGBB colors. Genre presets are
engine-owned configuration templates copied through the existing scoped map action, not new game
content or separate remotely authored projects. UI preset application and per-layer sound edits
are covered by browser save/reload receipts (`presets-editor.json`).

The genre catalog now contains exactly30 unique audiovisual presets in six groups of five, using
19 visual primitives (including runes/shades/frost). Group labels are shared between the catalog
and map editor. Every preset retains at least one active sound layer; naturally silent particles
may coexist with audible atmosphere. Existing ten preset IDs remain valid catalog entries.

## 필드 HUD 설정 (2026-09-21)

`system.fieldHud?: FieldHudConfig`의 `widgets?: HudWidget[]`가 데이터 기반 HUD 구성이다. `widgets` 생략은 theme 프리셋을 계산하고 `[]`는 의도적으로 비운 HUD다. 기존 theme/vitals/clock/tools/objective/hideEmpty 필드도 읽는다. 미설정 문서는 저장 바이트에 필드를 추가하지 않고 런타임에서 minimal을 사용한다. DB에서 legacy를 선택하면 이전 HUD로 돌아간다. 스키마 버전 증가는 없다.

`project/fieldHud.ts`는 프리셋과 정규화를 소유한다. 요소는 gauge/clock/slots/text/party/timers/image, 게이지 표현은 bar/vertical/hearts/ring/number다. source/actorId/variableId/maxVariableId/timerId/itemIds가 데이터 연결이고 resourceId는 기존 리소스 ID다. 문자열 표현식이나 사용자 CSS를 실행하지 않는다. IO의 `shapeFieldHud`가 24개 제한, 중복 ID, enum, 유한 정수/범위, hex 색을 검증하며 `references`가 저작된 배우·변수·스위치·아이템·이미지 참조를 검사한다.

`FieldHud`는 HandSlotChip과 수명을 공유한다. `fieldHudData`는 세션만 읽고 `fieldHudRender`는 DOM만 그린다. 액션 스태미나와 플레이어 화면 좌표는 PlayScene의 실제 상태를 전달한다. 조건은 항상/최댓값 미만/25% 이하/양수/액션 맵/스위치/값 변경 후 3초다. 자동 회피 요소는 플레이어가 접근하면 위·아래를 바꾸고 고정 패널과의 겹침을 피한다. 사용자 배치는 뷰포트 경계에 제한한다.

프리셋은 실제 게임에 없는 데이터를 꾸며내지 않는다. 식량 슬롯은 아이템 수량이며 음식 효과/지속 시간 모델을 만들지 않는다. 데이터가 없으면 요소를 숨긴다. 새 HUD가 소유하는 HP/스태미나의 옛 표시만 억제하고 나머지 액션 조작 안내를 유지한다. 메뉴·대화·전투·컷신에서는 HUD가 숨겨진다. 런타임 입력은 기존 숫자키/대괄호 계약이며 드래그/방향키 편집은 DB 미리보기에만 존재한다.

### HUD 장르·서체 확장 (2026-09-21)

`FieldHudConfig.font?: auto|pixel|round|clean`, `menuStyle?: project|field-list|sheet|classic|journal|workbench`를 추가했다.
`HudWidget.showValue`는 생략 시 true, 게이지 `shape: petals`는 `ceil(clamp(value/max)*5)`개의
꽃잎을 그린다. 0에서는 꽃잎이 없고 줄기는 회색이다. IO는 새 enum/boolean도 검사한다.
collector/classic/horror/chase/hearts 프리셋을 추가했다. 기존 미설정 문서는 그대로 minimal이다.
메뉴 스킨 조회는 명시적인 HUD menuStyle(project 제외)을 먼저 읽고 나머지는 기존 menuUiStyle을
사용한다. `field-list`는 독립 메뉴 스킨으로도 저장 가능하고, 단일 열 키보드 이동을 사용한다.
빈 HUD에서도 구성 정규화를 매 프레임 반복하지 않도록 최초 초기화 여부를 별도로 추적한다.
추격형은 상시 액션 HUD와 미니맵도 억제한다. 대화·메뉴·전투 UI는 기존대로 작동한다.


## 타일셋 참고문서 데이터 (2026-09-21)

[타일셋 참고문서](tileset-reference-documents.md): 프로젝트 소유의 용도별 MD·이미지, 파생 타일셋의 원본 공유, Pi/레거시 AI 전달 확인, 저장·내보내기 계약.

## 몬스터 보유 조건 연결 작업 (2026-09-25, 진행 중)

공통 판정 `project/monsterOwnership.ts`의 `ownsMonsterSpecies`는 파티와 박스 ID가
가리키는 인스턴스의 정확한 `speciesId`를 검사한다. 기절 여부는 보유 여부를 바꾸지
않으며, 어느 목록에도 없는 고아 인스턴스와 누락 참조는 보유로 세지 않는다.
이는 현재 소유 여부이며 과거 포획 이력/도감 등록 판정이 아니다.

`Condition`의 `{kind:"monsterSpecies", speciesId, present}`를 추가하고 필드 `evalCondition`,
`io/pageResolution`, 전투 세션→런타임 브리지와 `battleEvents`, IO shape/참조 검증,
조건 레지스트리·AI 스키마, 분기/고급 페이지 편집기와 설명/미리보기에 연결했다.
미리보기는 포획·방생을 시뮬레이션하지 않으므로 판정 불가로 표시한다.
전투 내 판정은 전투 개시 시점의 소유 스냅샷 기준이다. 연결 코드의 Vite 빌드는 통과했다. 격리 에디터 컴포넌트·SQLite 재오픈·전용 플레이어의 박스/파티/페이지/전투 판정까지 확인했다. 운영 배포는 남아 있다.
그 뒤 에디터 AI로 실제 포획 과제를 저작하고 SQLite 저장·재로드를 확인한다.
공통 판정만으로 에디터의 종 보유 조건이 지원된다고 보고하지 않는다.
회귀 사례는 `test/monsterOwnership.test.ts`에 작성했으며 이번 작업에서 실행하지 않았다.
