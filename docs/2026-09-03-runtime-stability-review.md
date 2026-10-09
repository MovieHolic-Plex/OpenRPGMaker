# 2026-09-03 런타임 안정성 리뷰 — 「될 때도 있고 안 될 때도 있는」 이동의 원인과 수정

- 범위: `src/player/` 런타임(편집기 테스트 플레이 창 · 내보낸 플레이어 · 실행형 HTML 공통)
- 방법: 코드 정독으로 후보를 좁힌 뒤, 출하 경로(`player.html`, 런타임 QA 서버)에서 브라우저 프로브로
  **재현·계측**하고, 같은 프로브로 고친 뒤를 다시 잰다. 프로브: `scripts/qa/probe-runtime-stability.mjs`.
- 계측 훅: `__oprnPerf()`(`src/player/runtimePerfCounters.ts`) — 타일 재생성·이벤트 계층 재생성·카메라
  `startFollow` 횟수. QA 계측 부팅에서만 붙는다.

## 한 줄 요약

이동 불안정의 실체는 세 가지였다. **① 짧게 탭한 방향키가 프레임 사이에서 사라진다**(입력 래치 없음),
**② 인터프리터 스텝마다 맵 타일 1~2만 개를 파괴·재생성하고 카메라를 강제 스냅한다**(대화 1회 = 6번,
100ms 병렬 이벤트 = 초당 8번), **③ 걷기 주기가 칸마다 처음으로 돌아가 세 번째 패턴이 안 나오고 칸 사이에
유휴 프레임이 낀다.** 셋을 고치고 회귀 테스트·e2e·프로브로 잠갔다.

## 전후 실측 (프로브, headless Chromium · SwiftShader · 30×30 픽스처)

| 측정 | 고치기 전 | 고친 뒤 |
|---|---|---|
| `keyboard.press`(keydown 직후 keyup) 4회 → 걸음 | **1칸** | 4칸 |
| 훅 `dir(down)→dir(null)` 같은 태스크 4회 → 걸음 | **0칸** | 4칸 |
| 30ms/120ms 유지 탭 4회 → 걸음 | 4칸 | 4칸 |
| NPC 대화 1회: 타일 재생성 / 만든 GameObject | **6회 / 10,944개** | 0회 / 0개 |
| NPC 대화 1회: 카메라 `startFollow`(스크롤 스냅) | **6회** | 0회 |
| 100ms 병렬 이벤트, 정지 3초: 타일 재생성 / GameObject | **24회 / 43,776개** | 0회 / 0개 |
| 같은 조건, 걷는 동안 카메라 scrollY 프레임 델타 | 1px 걷다 **6~9px 점프 5회/89프레임** | 최대 2px, 점프 0회 |
| 60fps 에서 160ms 걸음 6칸 소요(단위 테스트) | 6.6칸 시간(칸마다 유휴 1프레임) | 6.0칸 시간 |
| 걷기 패턴(단위 테스트) | 0·1 만 반복 | 0·1·2·1 순환 |

## 원인과 수정

### 1. 방향키 탭 소실 — `src/player/input.ts`
- 원인: `Input.update()` 는 매 프레임 「지금 눌려 있는」 방향만 읽는다. keydown→keyup 이 한 프레임 안에
  끝나면(짧은 탭, 또는 프레임이 늘어진 기계에서의 보통 탭) 한 번도 관측되지 않는다. QA 헬퍼가
  `press()` 대신 900ms 유지를 써야 했던 이유이기도 하다.
- 수정: `RuntimeKeyHoldTracker` 에 **방향 엣지 래치**(`tappedDirections`)를 두어 마지막 소비 이후 눌린
  방향은 한 번은 눌림으로 친다. 걷는 중이면(`deferTaps`) 소비하지 않고 정지 프레임에 넘겨 「걷는 중 한
  번 누른 키 = 정확히 한 걸음」. 입력이 닫히거나(`setEnabled`) 메뉴가 열린 동안의 탭은 버린다.
  자동화 주입(`injectDirection`)도 같은 계약을 따른다(눌림은 `injectedDir` 만 든다 — 눌림 집합에 더하면
  놓을 길이 없어 영원히 걷는다, 프로브 실측).

### 2. 전면 재생성·카메라 스냅 폭풍 — `playSceneMapRuntime.ts` `playSceneCamera.ts`
- 원인: `refreshRuntimeSurfaces` 가 `runCommands` 시작·끝, 모든 `resumeAfterSurface`/`resumeWithValue`,
  병렬 프로세스의 비차단 스텝마다 불리고, 그 안의 `renderTiles` 는 맵 전체 타일 GameObject 를
  파괴·재생성했다(주석 실측 15.9~26ms/호출). 같은 자리의 `applyStoredCameraState` → `startFollow` 는
  Phaser 가 scrollX/Y 를 대상 좌표로 **하드 설정**하므로 0.2 러프가 죽고 화면이 튄다.
- 수정 A: `renderTiles` 에 **타일 계층 서명**을 두어(맵·타일셋·텍스처 키 정체성, 하/상층 타일 내용
  해시, 밭·설치물·공간 배치 JSON, 작물 자료) 같으면 타일을 두고 이벤트 계층만 다시 그린다. 타일이
  실제로 바뀌는 경로(changeTile → applyMapOverrides, 맵 이동, 밭 갈이)는 해시·정체성이 달라져 그대로
  다시 그린다.
- 수정 B: `followCameraTarget` 은 카메라가 이미 같은 대상을 따르면 `startFollow` 를 부르지 않는다.
- 수정 C: 이벤트 스프라이트를 다시 만들 때 걷는 중인 NPC 는 목적지가 아니라 **보간 위치**에 놓는다 —
  이벤트가 열려 이동이 멎은 순간 NPC 가 한 칸 앞으로 튀던 현상.

### 3. 걷기 연속성 — `playSceneMovement.ts`
- 원인: 걸음 시작마다 `walkFrame/walkTimer` 를 0 으로 되돌려 160ms 걸음에서는 패턴 0·1 만 반복됐고,
  걸음이 끝난 프레임의 남은 시간을 버려 칸마다 유휴 프레임이 꼈다(60fps 에서 160ms → 176.7ms).
- 수정: 걷기 주기는 **멈출 때만** 되돌린다. 걸음이 끝난 프레임에 키가 여전히 눌려 있고 접촉
  이벤트·인카운터가 시작되지 않았으면 남은 시간으로 다음 걸음을 바로 이어 붙인다(프레임당 1회).

### 4. 편집기 게임 잠재우기 — `editor/panels/editorGameSuspension.ts`
- 원인(구조): 테스트 플레이 창은 편집기 위의 모달이라 뒤의 EditScene 이 자기 RAF 루프로 맵을 계속
  그리고, 편집기 게임의 KeyboardManager 가 창 전역 키를 계속 받는다. WebGL 컨텍스트 둘이 GPU·메인
  스레드를 나눠 쓴다.
- 수정: 창이 열리면 편집기 게임 `loop.sleep()` + 키보드 매니저 비활성, 닫히면 `wake(true)`(seamless)
  + `scale.refresh()`. 잠든 사이 파괴된 게임은 깨우지 않는다. 접근자는 `app/mode.ts` 가 주입한다.
  e2e 는 `test-play-window[data-editor-game-suspended]` 와 `window.__oprnEditorGameSuspended` 로 본다.

### 5. 자동 실행 이벤트 대기의 잠복 결함 — `player/registryReady.ts`
- 원인: `dialogue` 는 게임 생성 뒤 처음 넣는 registry 키라 Phaser DataManager 가 `setdata` 를 내는데
  `changedata` 하나만 기다렸다. 지금은 부팅 순서상 도달하지 않지만 순서가 바뀌면 자동 이벤트가 영원히
  발화하지 않는다.
- 수정: 값이 있으면 즉시, 없으면 `setdata`/`changedata` 둘 다 듣고 한 번 콜백. 씬 종료 시 해제.

## 내보내기(export) 점검
- 위 수정은 편집기 테스트 플레이·내보낸 웹 플레이어·실행형 HTML 이 **같은 런타임**을 쓰므로 전부 적용된다.
- `npm run build:standalone -- --project test/fixtures/projects/editor-authored-demo-v3.json` 로 실행형
  HTML 을 만들어 `node scripts/qa-standalone-boot.mjs` 로 `file://` 부팅: 타이틀 → 진입 → 방향키 이동
  모두 통과, 네트워크 실패 0 · 콘솔 에러 0.
- 계측 훅(`__oprnPerf`)은 QA 계측 부팅에서만 설치된다. 계수기 자체는 정수 증가만 하므로 출하 비용은 없다.
- 실행형 HTML 빌드가 「읽지 못한 에셋 24개」(`enemy-art-06.png` …)를 냈다. 몬스터 리소스 id `…-enemy_extra_06`
  의 숫자를 그대로 파일명에 붙였는데 디스크 파일은 `enemy-art-001…120.png`(세 자리)다 — 예전 프로젝트·픽스처의
  두 자리 id 는 전투에서 몬스터 그림이 404 였다. `generatedAssetResourceResolver` 가 세 자리로 채운다
  (`test/generatedAssetResourceResolver.test.ts`). 고친 뒤 빌드: 에셋 142 → 166개, 못 읽은 에셋 0.

## 검증
- 단위: `test/runtimeMovementStability.test.ts`(16) · `test/editorGameSuspension.test.ts`(6) — 고치기 전
  코드에서 8건이 빨갔다. 런타임 관련 vitest 부분집합 121파일: 기준선(HEAD) 과 실패 **집합** 동일(기존 4건).
- e2e: `test/e2e/test-play-runtime-stability.spec.ts` 신규 통과(즉시 탭 4/4, 편집기 게임 잠듦/깨어남,
  대화 중 타일 재생성 0·카메라 스냅 0). 기존 이동·NPC·대화 e2e 7종은 기준선과 실패 집합 동일
  (편집기 부팅 타임아웃 4건, 부하 환경).
- 런타임 QA 게이트(`npm run qa:runtime:gate`): 실패 3건(battle-flash-map ×2, battler-idle-animation)은
  전투 표현 계층으로 이 변경과 무관하며 기준선에서도 같은 항목이 실패한다.

## 후속 탐색 (같은 날, PR #454 추가 커밋)

출하 플레이어에서 접촉·문 전이, ESC 메뉴, 저장, 타이틀 복귀, 재시작 3회를 돌며 콘솔 에러·document
키 리스너 수를 기록했다: 에러 0, 리스너 수 일정(누수 없음). 편집기 테스트 플레이 창에서는 **런타임 디버그
패널 입력창**에서 결함을 재현했다.

- 디버그 패널은 접힌 `<details>` 로 시작한다 — 접힌 채로는 안의 입력창에 포커스가 가지 않는다. 처음 프로브가
  「숫자가 안 들어간다」로 본 것의 절반은 이것(포커스가 툴바 버튼에 남아 게임에 키가 갔다)이었다.
- 패널을 열고 숫자 입력창에 치면: `player.ts` 의 손 슬롯 숫자키 핸들러가 `preventDefault` 로 글자를 삼키고,
  `Input` 은 w/a/s/d·방향키를 걸음으로, Escape 는 게임 메뉴 토글로 받았다. Phaser 의 KeyboardManager 는
  이벤트 대상을 보지 않아 커서 키 상태도 남는다.
- 수정: 런타임 키 계약(`keyBindings.isTextEntryTarget`)에 「텍스트 입력 컨트롤(텍스트형 input·textarea·
  select·contentEditable)이 대상이면 게임 키가 아니다」를 두고, `Input`(keydown 무시·포커스 중 Phaser 커서
  상태 무시, keyup 은 어디서 와도 처리)·`player.ts onKeyDown`·대사창/선택지 `onKey` 가 따른다. 체크박스·
  라디오·버튼은 글자를 받지 않으므로 게임 키로 둔다(「타이틀 건너뛰기」 체크박스를 누른 뒤 Space/Enter 가
  씹히는 새 함정을 막는다). 편집기 쪽 같은 규칙은 `editor/hotkeys.ts §isTextEditingElement` — 출하 번들이
  편집기 코드를 끌어오지 않도록 따로 둔다.
- 검증: `test/runtimeInputEditableTargets.test.ts` 6건(대사창 케이스는 고치기 전 코드에서 빨강 확인),
  e2e `test-play-runtime-stability.spec.ts` 두 번째 테스트(패널 열기 → 57 타이핑 → 값 확인, 포커스 중
  방향키·w·Escape 무반응, 포커스 해제 뒤 걸음 복귀).
- e2e 함정: Playwright 가 직접 띄운 콜드 dev 서버에서는 편집기 첫 적재가 60~120초 안에 끝나지 않고 백지가
  남는 일이 반복됐다(같은 기계의 네트워크 인터페이스 요동, `ERR_NETWORK_CHANGED`). 미리 띄운 서버에
  붙이면(`DEV_SERVER_PORT` 재사용) 같은 스펙이 33초에 통과한다 — 결함이 아니라 환경이다.
