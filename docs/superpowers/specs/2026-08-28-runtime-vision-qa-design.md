# 런타임 전용 비전 QA 하네스 설계

- 작성일: 2026-08-28
- 브랜치: `worktree-runtime-vision-qa` (베이스 `3a55fde6`)
- 상태: 승인됨 (감독자가 섹션 1 승인 후 자율 진행 위임)

## 문제

에디터 QA 와 런타임(실제 게임) QA 를 같은 경로로 하고 있다. 지금 런타임 QA 는
`index.html` → `[data-testid="mode-play"]` 클릭이라서 세 가지 비용을 낸다.

1. **스크린샷 오염** — `src/app/mode.ts` 의 `enterMode` 는 play 모드에서도
   `renderTopbar()` 를 호출한다. 톱바가 모든 샷에 남는다.
2. **부팅 비용** — 에디터 번들·DB 연결·welcome 게이트를 전부 태운다.
3. **표면 불일치(정확성 문제)** — 에디터 play 모드는 실제 `@/project/store` 를 쓰고,
   출하되는 내보내기 플레이어는 `exportProjectStoreShim` 을 쓴다. 즉 **지금 런타임 QA 는
   출하물을 검증하지 않는다.**

## 결정

| 축 | 결정 | 근거 |
|---|---|---|
| 용도 | 개발 중 반복 플레이테스트(속도 우선) | 감독자 선택 |
| 표면 | player config 를 dev serve 한 `/player.html` | 에디터 크롬 0 + shim 경로 = 출하 경로 |
| 검증 모델 | 하이브리드 — 기계 게이트 + 선택적 비전 | 컨텍스트 오염 최소화 |
| 픽스처 | `oprn-sample-v3.json` 기본 + `--project` 로 교체 | 저작 비용 0, 테스트가 이미 유지 |
| 패키징 | 얇은 lib + CLI/스펙 두 프런트 | `horror-browser-evidence` 선례와 동형 |
| 스코프 | `scripts/` + `test/` + 새 vite config 만 | `src/` 무수정 → 동시 워크트리 42개와 충돌 0 |

### 실측으로 확인한 전제

`vite --config vite.player.config.ts` serve 에서 shim alias 가 적용된다:

```
/src/player/player.ts →
  import { startPlayGame } from "/src/player/exportAppModeShim.ts"
  import { store }        from "/src/player/exportProjectStoreShim.ts"
```

### 폐기한 가정

`src/` 에 RNG 시드 훅을 새로 만들어야 한다고 봤으나 **이미 있다.**
`window.__oprnDebug.setSeed(seed)` 가 `reseedSessionRng` 를 호출하고
`readState().rng` 가 상태를 노출한다. 훅은 `playSceneTestHooks.ts` 에서
**항상 활성**(dev 게이팅 없음)이라 내보내기 플레이어에서도 동작한다.
따라서 난수 의존 요소를 재현 가능하게 고정할 수 있고, 기계 게이트가
예상보다 넓게 커버한다.

메모리에 있던 `__rpgzzuInput` 은 실재하지 않는다. 실제 입력 훅은 `__oprnInput`.

## 섹션 1 — 표면과 서버

새 파일 `vite.player-qa.config.ts` 가 `vite.player.config.ts` 를 `mergeConfig` 로 확장한다.
**출하 빌드 설정은 건드리지 않는다** (다른 에이전트와의 충돌 회피). `cacheDir` 은
vite CLI 플래그가 없어 config 파일이 불가피하다.

| 항목 | 값 | 근거 |
|---|---|---|
| `cacheDir` | `VITE_CACHE_DIR` ?? `.vite-cache/player-qa` | `vite.config.ts:350-354` 에 기록된 실측 사망 — 워크트리가 `node_modules/.vite` 를 공유해 "Failed to scan for dependencies" 로 서버 사망 3회. player config 엔 이 가드가 없다 |
| `server.fs.allow` | `vite.config.ts:372` realpath 확장 로직 복제 | 워크트리 `node_modules` 가 정션이라 기본 allow 로는 403 |
| 포트 | 부팅 시 빈 포트 자동 할당 | 고정 포트 예약 없음 → 워크트리 42개와 경합 불가 |

lib 이 서버를 직접 띄우고 내린다. `reuseExistingServer` 는 쓰지 않는다(남의 워크트리
서버에 붙는 사고 방지). 기동 ~270ms 실측, 의존성 최적화는 전용 `cacheDir` 덕에 첫 실행만 지불.

## 섹션 2 — 픽스처 주입

`exportEntry.ts` 는 `window.__OPENRPG_BOOT__.projectUrl` 을 읽고 없으면
`project.json` 을 상대 경로로 fetch 한다. 하네스는 **파일시스템에 쓰지 않고**
두 단계로 주입한다.

1. `page.addInitScript` — `__OPENRPG_BOOT__ = { projectUrl, saveNamespace }` 설치
   + `localStorage.clear()` (이전 실행의 세이브 슬롯이 타이틀 화면을 바꾸는 것 방지)
2. `page.route(projectUrl)` — 픽스처 바이트로 fulfill

`addInitScript` 는 페이지 스크립트보다 먼저 돌므로 `exportEntry` 의 최상위
`void bootExportedPlayer(app)` 보다 앞선다.

이점: 서버 트리를 오염시키지 않고, 실행마다 임의 프로젝트를 넣을 수 있고,
CLI/스펙 양쪽에서 같은 코드가 동작한다.

`--project` 값: 기본 `test/fixtures/projects/oprn-sample-v3.json`, 또는 임의 파일 경로.

## 섹션 3 — 시나리오 계약

시나리오는 타입이 붙은 `.mts` 모듈이 배열을 export 한다(JSON 아님 — 타입 안전 + 헬퍼 사용).

```ts
type RuntimeQaOp =
  | { kind: "seed";     seed: number }
  | { kind: "dir";      dir: Dir | null }
  | { kind: "face";     dir: Dir }
  | { kind: "action" } | { kind: "attack" } | { kind: "skill" }
  | { kind: "key";      key: string; times?: number; delayMs?: number }
  | { kind: "teleport"; mapId: string; x: number; y: number }
  | { kind: "wait";     ms: number };

type RuntimeQaExpect = {
  mapId?: string; x?: number; y?: number; gold?: number;
  testidPresent?: readonly string[];
  testidAbsent?: readonly string[];
  playerSpriteResourceNonEmpty?: boolean;
};

type RuntimeQaBeat = {
  id: string;              // kebab-case, 파일명에 쓰인다
  note?: string;           // 비전이 읽을 "이 샷의 의도"
  ops?: readonly RuntimeQaOp[];
  expect?: RuntimeQaExpect;
  shot?: boolean;          // 기본 false — 샷은 옵트인
};
```

`shot` 기본값이 `false` 인 것이 컨텍스트 정책의 핵심이다. 저자가 명시적으로
켠 비트만 이미지를 남긴다.

## 섹션 4 — 게이트 신호 (기계, 결정적)

| 신호 | 취득 |
|---|---|
| 런타임 에러 0 | `page.on("pageerror")` + `console` error 수집 |
| 시드 고정 | 비트 실행 전 `__oprnDebug.setSeed()` |
| 맵·좌표·골드·스위치 | `__oprnDebug.readState()` |
| 스프라이트 누락 | `__oprnPlayerSprite().resourceId` 비어있지 않음 |
| UI 구조 | `[data-testid=...]` 존재/부재 |

하나라도 깨지면 어느 비트에서 깨졌는지와 함께 비영점 종료.

## 섹션 5 — 비전 산출물 계약

출력: `verify-shots/runtime-qa/<scenarioId>/`

| 산출물 | 내용 |
|---|---|
| `SUMMARY.md` | **에이전트가 먼저 읽는 것.** 비트별 통과/실패 표 + "이미지를 볼 이유" 열 |
| `manifest.json` | 기계 기록 전체(비트별 ops·state·errors·expect 결과·샷 경로) |
| `NN-<beatId>.png` | `shot: true` 비트만 |

뷰포트 1024×768 고정 — 기존 런타임 전용 선례(`test/e2e/_player-movement-proof.spec.ts`)와 동일.

**컨텍스트 규칙:** 텍스트(SUMMARY)를 먼저 읽고, 게이트가 표시한 행이나 명시적으로
시각 확인이 필요한 행의 PNG 만 연다. 전량 열람은 금지.

## 파일 배치

테스트가 소비하는 lib 는 이 레포의 확립된 관례(`.mjs` + `.d.mts`,
`playerDeploymentManifest` 와 동형)를 따른다. `.mts` lib 은 `.mts` 스크립트에서만
임포트되는 별개 관례라 vitest 에서 쓰지 않는다.

| 파일 | 역할 |
|---|---|
| `vite.player-qa.config.ts` | dev 전용 player 서버 설정 |
| `scripts/lib/runtimeQa.mjs` / `.d.mts` | 순수 판정·정규화·리포트 렌더 |
| `scripts/lib/runtimeQaRun.mjs` / `.d.mts` | 서버 기동 · 브라우저 구동 · 디스크 쓰기 |
| `scripts/runtime-qa.mjs` | 반복 작업용 CLI (`npm run qa:runtime`) |
| `scripts/qa/runtime/smoke.scenario.mjs` / `.d.mts` | 부팅·렌더·맵 전환 시나리오 |
| `scripts/qa/runtime/dialogue.scenario.mjs` / `.d.mts` | 대사·선택지 시나리오 |
| `test/runtime/smoke.spec.ts` | 게이트 프런트 — 두 시나리오 모두 실행 (`npm run qa:runtime:gate`) |
| `playwright.runtime.config.ts` | 게이트 전용 설정(webServer 없음, testDir 분리) |
| `scripts/_export-charset-fixtures.mjs` | 진단용 — 픽스처별 캐릭셋 텍스처 로드 대조 |
| `scripts/_dump-event-tiles.mjs` | 진단용 — 이벤트 실제 배치 좌표 덤프(시나리오 작성용) |

게이트를 기본 e2e 스위트에서 분리한 이유: `playwright.config.ts` 의 `webServer` 는
`npm run dev`(에디터 셸 + 메인 vite config)를 띄우는데, 메인 config 는 `VITE_CACHE_DIR`
없이는 공유 `node_modules/.vite` 를 쓴다. 런타임 QA 는 자체 서버를 전용 cacheDir 로
띄우므로 그 서버가 불필요하고, 켜면 공유 캐시만 흔든다.

## 구현 중 설계가 바뀐 지점 (실측 기반)

| 발견 | 조치 |
|---|---|
| `vite.player.config.ts` 의 `publicDir: false` 를 그대로 dev 서빙하면 번들 텍스처(`assets/easyrpg-*.png`, `public/assets/` 34개)가 전부 404 → **조용한 검은 스크린샷** | QA config 에서 `publicDir` 을 되살린다 |
| 실패한 비트에 샷이 없어 "게이트 실패 + 열어야 할 샷 0개" 가 나왔다 — 정작 비전이 필요한 순간에 볼 것이 없다 | `shouldCaptureShot`: 옵트인 **또는 실패** 시 캡처 |
| 고정 키 횟수로 대사를 소진하려 하자 대사가 닫힌 뒤 남은 Enter 가 NPC 를 재발동시켜 선택지가 다시 열렸다 | `waitFor` / `pressUntil` op 추가. `pressUntil` 은 매 입력 후 조건을 확인해 초과 입력이 구조적으로 불가능 |
| `playerSpriteResourceNonEmpty` 는 통과하는데 Phaser 는 `__MISSING` 플레이스홀더(초록 와이어프레임)를 그렸다 — 기계 게이트가 비전이 잡은 것을 놓쳤다 | `playerSpriteTextureLoaded` 축 추가(`textureKey !== "__MISSING"`) |
| 훅 설치 전(타이틀 화면) 상태 기대치를 조용히 통과시키면 게이트가 거짓말한다 | `state === null` 이면 명시적 실패 |
| op 이 던지면 런 전체가 raw 스택으로 죽고 **리포트도 샷도 남지 않았다** — 정작 진단할 증거가 0 | op 예외를 그 비트의 실패로 기록하고 계속 진행 |
| 기본 픽스처(`oprn-sample-v3`)가 플레이어 스프라이트를 `__MISSING` 으로 그려 시각 검증이 상시 오염 | 기본 픽스처를 `editor-authored-demo-v3` 로 교체 |

## 열린 발견 (이 브랜치에서 고치지 않음)

### 1. `oprn-sample-v3.json` 픽스처에서 플레이어 캐릭셋이 `__MISSING` 으로 그려진다

내보내기 플레이어에서 **픽스처만 바꿔가며** 측정했다
(`scripts/_export-charset-fixtures.mjs`, 재현 가능):

| 픽스처 | `__oprnPlayerSprite().textureKey` |
|---|---|
| `oprn-sample-v3.json` | `__MISSING` ❌ |
| `editor-authored-demo-v3.json` | `tex_easyrpg_charset_actor1` ✅ |
| `fable-village-snapshot.json` | `tex_easyrpg_charset_actor1` ✅ |
| `dew-village-demo.json` | `tex_easyrpg_charset_actor1` ✅ |

네 픽스처 모두 `resourceId` 는 `easyrpg-charset-actor1` 로 동일하고, 실패 요청은 0건이며
`assets/easyrpg/charset/People1.png` 는 200/10358B 로 정상 서빙된다. 즉 **내보내기 플레이어
전반의 결함이 아니라 이 픽스처에 국한된 데이터 의존**이다. 3/4 가 정상이므로 로더 자체는
동작하고, 이 픽스처만 프리로드를 유발하는 선언이 빠져 있다.

원인 규명은 별개 과제다. 이 설계에서는 기본 픽스처를 정상 렌더되는
`editor-authored-demo-v3.json` 으로 옮겨 시각 검증이 오염되지 않게 했고,
`playerSpriteTextureLoaded` 축으로 이 부류를 기계 게이트가 잡게 했다.

**앞선 초안에서 "에디터 vs 내보내기 비교로 출하 경로 전용 결함"이라고 적었던 판정은
철회했다.** 그 비교는 에디터 쪽에 픽스처 주입이 실패해(에디터가 기존에 열려 있던
`map_lake_village` 프로젝트의 시연 오버레이를 띄웠다) **서로 다른 두 프로젝트를 비교**한
것이었다. 무효 증거와 스크립트는 삭제했다.

### 1-b. 시나리오 작성 제약 (둘 다 실측)

- **같은 맵 안 `__oprnDebug.teleport` 는 플레이어 스프라이트를 옮기지 않는다.**
  `playSceneTestHooks.ts` 의 teleport 는 `mapId` 가 현재 맵과 같으면 `loadMap` 을 부르지 않고
  `tileX/tileY` 만 쓴다. 상태(`readState`)는 (11,18) 로 바뀌는데 스프라이트 픽셀 좌표는
  그대로였다. 위치 지정 수단으로 쓸 수 없다. 맵 간 이동은 정상 동작한다.
- **`movement` 가 `fixed` 가 아닌 NPC 는 같은 세션 안에서 움직인다.**
  `editor-authored-demo-v3` 의 elder/healer 는 두 번 덤프 사이에 픽셀 좌표가 이동했다.
  고정 좌표 인접을 전제한 상호작용 비트는 근본적으로 취약하다.

이 두 제약 때문에 시나리오를 픽스처 특성에 맞춰 둘로 나눴다:

| 시나리오 | 픽스처 | 담당 |
|---|---|---|
| `smoke` | `editor-authored-demo-v3.json` | 타이틀 · 새 게임 · 시작 위치 · **스프라이트 텍스처 로드** · 맵 전환 |
| `dialogue` | `oprn-sample-v3.json` | 대사창 · 선택지 열림/닫힘 (NPC 가 `fixed` 이고 **스폰 시점에 이미 인접**) |

### 2. `vite.config.ts` 의 `fs.allow` 가 `.claude/worktrees/*` 레이아웃을 커버하지 않음

`fs.allow` 는 `../rpg-zzu/node_modules`(구 형제 디렉터리 워크트리 `rpg-zzu-*` 전용)를 넓히는데,
`.claude/worktrees/<name>` 에서는 존재하지 않는 `.claude/worktrees/rpg-zzu/node_modules` 로 풀린다.
결과: **이 레이아웃의 워크트리에서 에디터 dev 서버가 phaser 를 403 으로 막는다.**

```
The request url ".../node_modules/phaser/dist/phaser.min.js" is outside of Vite serving allow list.
```

이 설계의 `vite.player-qa.config.ts` 는 `realpathSync("./node_modules")` 로 정션 실경로를
직접 넓혀서 레이아웃과 무관하게 동작한다 — 같은 방식이 메인 config 의 올바른 일반화다.
공유 config 는 다른 워크트리와 충돌하므로 이 브랜치에서 손대지 않았다.

### 3. `.vite-cache/deps/*` 가 git 추적 중

`.gitignore:4` 에 `.vite-cache/` 가 있는데 `_metadata.json`·`package.json` 2개가
규칙보다 먼저 커밋돼 추적된 상태다. 기존 흠집이며 이 작업과 무관하다.

## 검증 전략

`npm test` 전체 그린은 이 작업의 게이트가 될 수 없다 — 베이스라인이 이미
사전 실패 상태다(main `3a55fde6` 갓 체크아웃 워크트리에서 테스트 파일 80 실패 /
테스트 169 실패 / 에러 180, 우리 변경 0줄). 따라서 게이트는 **신규 추가분 표적 검증**:

1. lib 순수 함수(시나리오 검증, 매니페스트/SUMMARY 생성) 단위 테스트
2. `scripts/runtime-qa.mts` 실행이 실제 브라우저에서 스모크 시나리오를 통과
3. `test/e2e/runtime-smoke.spec.ts` 통과
4. `npm run typecheck:app`
