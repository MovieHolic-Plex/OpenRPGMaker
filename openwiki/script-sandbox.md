# 스크립트 샌드박스 (TypeScript 이벤트 스크립트)

이벤트 명령과 **같은 자리에서** TypeScript 로 로직을 쓰는 층. 이벤트 명령은 그대로 지원하고, 스크립트는 그 옆의
대등한 수단이다(2026-10-31 결정: 「AI NATIVE 에디터로 탈바꿈」 — 실험 게이트 없이 도입). 조수(Opus 등)는 조건·공식·
반복이 얽힌 로직(조합 퍼즐, 할인 공식, 시간대 반응)을 명령 수십 줄 대신 스크립트 한 덩이로 쓴다.

읽는 순서: TL;DR → 파일 지도 → 실행 다리(bridge) → 한도·격리 → 저장/불러오기 → 컴파일·분석 → API 행 추가 절차 → 알려진 한계.

## TL;DR

- 데이터: 명령 `{ kind: "script", source, compiled, name?, summary?, effects?, sourceHash?, apiVersion? }` 와
  프로젝트 `scriptLibrary?: ScriptModule[]`(공용 모듈, `import { x } from "@lib/<id>"`). 정본은 `current_json`(SQLite) 안 —
  별도 테이블이 없다. `compiled` 를 저장하므로 **게임은 TypeScript 컴파일러 없이 돈다**.
- 런타임: QuickJS-wasm(`quickjs-emscripten-core` + `@jitl/quickjs-singlefile-browser-release-sync`, wasm 내장 약 0.5MB).
  스크립트가 있는 프로젝트만 동적 import 로 받는다(`src/player/script/engine.ts`). 편집기 플레이·내보낸 플레이어·헤드리스가 같은 경로.
- API: `game.*` 한 표(`src/project/script/apiSpec.ts` `SCRIPT_API`)가 단일 진실이다. `.d.ts`(편집기·조수 타입 검사),
  런타임 구현(`hostApi.ts`, 행마다 구현 강제), 정적 분석(`refs`), 문서 표가 모두 이 표를 읽는다.
- `await` 하는 호출(대사·선택지·대기·전투·이동·연출·`game.cmd`)은 **보통 이벤트 명령으로 바뀌어 자식 프레임으로 돈다** —
  그래서 pause·resume·세이브·연출이 명령과 똑같다. 동기 호출(스위치·변수·아이템·조회)은 즉시.
- 오류는 게임을 멈추지 않는다: `[Script error] …` 대사 한 번 + 로그(`scriptLog.ts`, `globalThis.__oprnScriptLog()`) 뒤 다음 명령.

## 파일 지도

| 파일 | 역할 |
|---|---|
| `src/project/script/types.ts` | `ScriptModule`·`ScriptEffects`·한도·`scriptSourceHash`·`scriptCompiledIsFresh` |
| `src/project/script/apiSpec.ts` | **`SCRIPT_API` 단일 진실**(이름·그룹·매개변수·반환·awaits·영문 doc·`refs`·한국어 요약 동사). `SCRIPT_RESULT_VARIABLE` |
| `src/project/script/dts.ts` | `.d.ts` 생성(`buildGameApiDts(scriptDtsIds(project, mapId))` — 프로젝트 id 를 리터럴 유니온으로), `scriptApiCheatSheet()`(모델용 영문 목록) |
| `src/project/script/library.ts` | `normalizeScriptLibrary`(관대한 로드 정규화)·`findScriptModule`·`libraryIdFromSpecifier` |
| `src/player/script/engine.ts` | wasm 지연 로더 `preloadScriptEngine()`·`projectUsesScripts(project)` |
| `src/player/script/scriptRun.ts` | 실행 1회 = QuickJS 런타임 1개. prelude(`game` 동결, Math.random·Date 교체, `require("@lib/…")`), 시간·메모리 한도, 핸들 정리 |
| `src/player/script/hostApi.ts` | `HOST_API` — 행마다 동기 구현 또는 「명령 계획(AwaitPlan)」. 매핑 타입이 누락·종류 불일치를 컴파일 오류로 잡는다 |
| `src/player/script/scriptLog.ts` | 개발자 로그 링 버퍼(200줄) |
| `src/player/interpreter/scriptCommand.ts` | `script` 명령 실행·재진입·오류 표시·`disposeScriptRuns` |
| `src/editor/script/compile.ts` | `compileScript`(transpile + 타입 검사 + 분석), `formatScriptDiagnostics`, `scriptCommandFields` |
| `src/editor/script/analyze.ts` | 읽기/쓰기 추출·dynamic 기록·경고(모르는 id+제안, await 누락, transfer 뒤 호출)·한 줄 요약 |
| `src/editor/script/tsEnv.ts` | TypeScript 5(`typescript5` 별칭 — 저장소 `typescript` 는 JS API 없는 TS7)와 ES2022 lib 지연 로드 |
| `src/editor/script/tsLibSources.generated.ts` | lib.es2022 참조 폐포 57파일을 문자열로 담은 생성 모듈(약 470KB, `node scripts/content/generate-script-ts-libs.mjs`). 편집기·Bun 컴파일 조수 워커(node_modules 없음)·테스트가 같은 방법으로 읽는다 |

부팅 시 미리 받기: `createPlayGame`(편집기 플레이·내보낸 플레이어 공통), `exportEntry.prepareFirstScreen`, 도구
`play_walkthrough`·`run_scene_test` 의 `prepare`. 늦게 실행되면 `script` 명령이 16ms `wait` 로 최대 약 10초 기다린다.

## 실행 다리 (interpreter bridge)

인터프리터는 동기다. 스크립트는 `async function(require, exports, module){ <compiled> }` 로 감싸 실행하고, 다음을 반복한다.

1. `rt.executePendingJobs()` 로 스크립트를 다음 `await` 까지 돌린다.
2. 큐에 game 호출 계획이 있으면 → 스크립트 프레임의 `pc -= 1` 후 그 명령들을 **자식 프레임**으로 push(`runSchedule` 과 같은 재진입).
   자식이 끝나면 `advanceCompletedFrame` 이 `pc += 1` 해 같은 `script` 명령으로 돌아오고, 그 프레임의 살아 있는 실행
   (`state.scriptRuns: Map<Frame, ScriptRun>`)이 promise 를 결과로 풀고 1로 간다.
3. promise 가 끝나면 런타임을 버리고 다음 명령. 거절되면 오류 처리.

- 결과값: 선택지는 각 가지에 `setVariable(__script_result)` 를 넣고, 숫자 입력은 그 변수에 쓴다. 읽은 즉시 지운다(세이브에 남지 않음).
  전투 결과는 `session.battleResult`.
- `await` 안 한 호출도 **호출 순서대로** 큐에서 돈다(분석기는 경고). 동기 호출은 즉시이므로 앞선 미대기 호출보다 먼저 일어난다.
- 동기 쓰기는 버리는 프레임 위 `executeCommand` 로 실행 — 퀘스트 징글·호감 미러·동료 따라오기 같은 명령 부작용이 같다.
- `game.transfer` 는 Transfer 명령처럼 **이벤트를 끝낸다**(`continueAfterTransfer` 실행기만 이어 간다). 숫자 입력 취소도 이벤트를 끝낸다.
- 전투 이벤트(트룹 페이지)에서는 실행하지 않는다(`battleEvents.ts` 미지원 로그, `commandGuaranteeRegistry` troop partial).

## 한도·격리

| 항목 | 값 | 넘으면 |
|---|---|---|
| 힙 | 16MB (`rt.setMemoryLimit`) | `out of memory — scripts may use at most 16 MB` |
| 스택 | 512KB | `stack overflow` |
| 한 조각(game 호출 사이) CPU | 500ms (`SCRIPT_SLICE_LIMIT_MS`) | 「infinite loop?」 오류 |
| 실행 전체 CPU | 3000ms (플레이어 기다림 제외) | 오류 |
| 대기 안 한 호출 큐 | 1000 | 오류 |
| 소스 / 컴파일 결과 | 64,000 / 192,000자 | 컴파일 오류 |

- 실행마다 새 QuickJS 런타임. 전역에 DOM·fetch·XMLHttpRequest·storage·타이머·process·WebAssembly 가 없다(테스트가 고정).
  `game` 은 동결, `__host` 는 prelude 가 지운다. `require` 는 `@lib/<id>` 만.
- 결정성: `Math.random`·`game.random` = 세이브되는 게임 난수(`nextSessionRandom(session, "misc")`).
  `Date` = 2000-01-01 + 플레이 시간(세이브마다 같다).
- **QuickJS 한계(실측)**: 메모리 한도 근처에서 GC 가 몰려 `new Array(100000).fill()` 반복 같은 경우 중단까지 3~4초 걸린다
  (인터럽트 처리기가 네이티브 루프 안에서는 불리지 않는다). 보통 객체 반복은 0.3~0.6초 안에 메모리 오류로 끝난다.
- 핸들: 만든 핸들을 모두 버린 뒤 `vm.dispose()` — release wasm 은 남은 핸들이 있으면 `rt.dispose()` 에서 abort 한다.
  인터프리터 `finish()` 가 `disposeScriptRuns`, 끝나지 않고 버려진 인터프리터는 `FinalizationRegistry` 가 정리(실행 객체는
  호출 중에만 상태를 쥐어 순환 참조로 막히지 않는다).

### CSP

- Electron 편집기: `electron/main/protocols.ts` script-src 에 `'wasm-unsafe-eval'` 추가(wasm 컴파일만 허용, JS eval 은 그대로 막힘).
- 데스크톱 내보내기(시스템 브라우저 file://)는 CSP 없음.
- **스토어 게임**: `OpenRPGMaker-store` `gamePlayerCsp` 의 script-src 에 `'wasm-unsafe-eval'` 이 없으면 스크립트가
  「The script engine could not load」 오류 대사를 낸다 — 스토어 저장소 PR·배포가 따로 필요하다.

## 저장/불러오기

- 지역 변수·스크립트 진행 위치는 **세이브되지 않는다**. 스크립트 도중 세이브(예: `game.cmd({kind:"openSaveMenu"})`)를 불러오면
  그 이벤트는 처음부터 다시 돈다 — 저장이 필요한 값은 스위치·변수·글 변수에 둔다(`.d.ts` 머리말에도 적혀 있다).
- 스크립트가 바꾼 스위치·변수·아이템·타일은 명령과 같은 세션 필드라 그대로 세이브된다.

## 컴파일·분석

- `compileScript(source, { project, mapId, libraryId?, typeCheck? })` — 동기, `prepareScriptCompiler()` 뒤.
  - transpile: CommonJS/ES2022 (`import` → `require("@lib/…")`, 최상위 `await` 는 감싼 async 함수 안에서 그대로).
  - 타입 검사: 메모리 위 프로그램 `/game.d.ts` + `/lib/<id>.ts` + `/script.ts`(끝에 `export {}` — 줄 번호 불변).
    lib 은 ES2022 만(DOM·Node 없음 → `document`·`fetch`·`setTimeout` 은 타입 오류). lib SourceFile 은 캐시 — 첫 검사 약 1.7초, 이후 수십 ms.
  - `ok` = 오류 없음(경고 허용). 구문 오류면 `compiled` 가 빈다. 타입 오류만 있으면 `compiled` 는 나오지만 `ok:false`.
- 분석: `game.X("리터럴")` → `refs` 표대로 reads/writes/calls, `game.cmd({ kind, …Id })` 객체, `@lib` import.
  계산된 id 는 `effects.dynamic`(검증기가 못 본다는 표시). 경고: 모르는 id(+「Did you mean」), await 누락, transfer 뒤 호출.
  스위치·변수 id 는 **이름**도 받는다(런타임도 이름 → id 로 푼다).
- 한 줄 요약(`summary`): 쓰는 호출의 한국어 동사 + 쓰는 id 몇 개 — 이벤트 목록 `commandSummary` 에 보인다.

## API 행 추가 절차

1. `apiSpec.ts` 에 행 추가(영문 doc, `ko`, 필요하면 `refs`, `awaits`). 2. `hostApi.ts` 에 구현 — 빠지면 컴파일 오류.
3. 새 타입이 필요하면 `dts.ts` 머리 부분. 4. `test/scriptSandbox.test.ts` 에 행동 고정. `HOST_API` 키 = `SCRIPT_API` 이름 테스트가 이미 있다.
5. 이 문서와 조수 스킬 문서(`assistant-skills/…`)의 표.

명령 kind 를 새로 만들 때 `script` 가 걸린 목록(같은 checklist): `commandKindRegistry`, `types/events.ts`, `commandGuaranteeRegistry`,
`runtimeSupport`, `shapeCommandFields`, `commandReferenceValidation`, `battleEvents`, `commandCatalog`, `eventCommandFactory`,
`eventDraftValidator`, `storyScript`, `commandPreview`, `commandSummary`, `options.ts`, 테스트 고정 목록 3곳 + `commandContracts/script.contract.test.ts`.

## 알려진 한계 / 다음 단계

- 편집기 코드 편집기·라이브러리 화면·4개 언어(후속 PR), 조수 도구 `author_script`·`edit_script`·`check_script`·`dry_run_script`(후속 PR),
  검증기(고아 스위치·도달성·gameCheck·mapGraph)의 `effects` 반영(후속 PR).
- 컴파일 결과의 줄 번호는 TS 원본과 대체로 같지만 정확히 같지는 않다(오류는 `compiled line N`). 소스맵은 없다.
- 라이브러리 모듈은 최상위 `await` 를 못 쓴다(동기 `new Function` 으로 평가).
