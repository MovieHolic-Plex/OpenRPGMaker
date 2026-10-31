# 스크립트 샌드박스 (TypeScript 이벤트 스크립트)

이벤트 명령과 **같은 자리에서** TypeScript 로 로직을 쓰는 층. 이벤트 명령은 그대로 지원하고, 스크립트는 그 옆의
대등한 수단이다(2026-10-31 결정: 「AI NATIVE 에디터로 탈바꿈」 — 실험 게이트 없이 도입). 조수(Opus 등)는 조건·공식·
반복이 얽힌 로직(조합 퍼즐, 할인 공식, 시간대 반응)을 명령 수십 줄 대신 스크립트 한 덩이로 쓴다.

읽는 순서: TL;DR → 파일 지도 → 실행 다리(bridge) → 한도·격리 → 저장/불러오기 → 컴파일·분석 → 검증기 → API 행 추가 절차 → 조수 도구 → 실조수 데모 → 알려진 한계.

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
| `src/project/script/effects.ts` | **검증기·그래프용 effects 읽기**: `scriptCommandEffects`·`expandScriptEffects`(`@lib` 전이 병합)·`scriptWrites/Reads/Calls`·`scriptHasDynamic`·`dynamicRefKinds`·`forEachProjectScript`·`projectScriptUsage`·`scriptRefersTo`. `game.cmd` id 필드 표(`SCRIPT_CMD_ID_FIELDS`)도 여기 — 분석기가 같이 쓴다 |
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

## 검증기 (validators)

스크립트가 쓴 스위치를 「켜는 곳 없음」으로, 스크립트가 부른 공통 이벤트를 「안 쓰임」으로 보지 않도록 검증기·그래프가
`effects` 를 읽는다. **`effects` 를 직접 읽지 말고 `src/project/script/effects.ts` 를 거친다** — 그래야 다음 셋이 한 곳에서 맞는다.

- `@lib/<id>` import 는 그 모듈의 effects 를 **전이적으로** 합친다(순환·중복은 한 번만).
- `effects` 가 없는데 `compiled` 가 있는 스크립트(effects 이전에 저장된 것)는 **모든 종류가 dynamic** 이다(api `*`). `compiled` 가 비면 아무것도 안 한다.
- 스위치·변수 ref 는 이름일 수 있다 → `resolveScriptRefId` 가 id 로 바꾼다(검증기는 id 로 센다).

접근별 의미: `writes` = 설정(스위치는 켤 수 있다고 본다 — 켜는지 끄는지는 정적으로 모른다), `reads` = 읽기,
`calls` 의 `commonEvent` = 호출 간선, `map` = 이동 간선(착지 좌표는 모름), `troop` = 전투, `library` = import.
`dynamic` 의 api 이름은 `dynamicRefKinds` 가 SCRIPT_API `refs` 표와 `cmd.<kind>.<field>` 로 (종류, 접근) 쌍으로 바꾼다.
비리터럴 `game.cmd(x)` 와 `*` 는 전부다. 그 종류·접근에 dynamic 이 있으면 「없음」 판정은 **증명할 수 없으므로** 막힘/경고를 info 로 낮추고
「스크립트가 계산된 id 를 써서…」 안내를 붙인다(`SCRIPT_DYNAMIC_NOTE`).

| 검증기 | 파일 | 스크립트 반영 |
|---|---|---|
| 진행 검사(켜는 곳 없는 스위치·엔딩 조건·셀프 스위치·엔딩 호출) | `src/qa/gameCheck/progression.ts` | `collectSwitchWrites` 에 스크립트 쓰기. dynamic 스위치 쓰기면 `page-switch-never-set`·`ending-switch-never-set` 을 info 로. 스크립트가 있는 이벤트는 셀프 스위치 판정 생략. 스크립트 소스에 `kind:"triggerEnding"` 이 있으면 `no-ending-trigger` info·`ending-uninvoked` 생략 |
| 맵 그래프·도달성 | `src/qa/gameCheck/mapGraph.ts` | `via:"script"` 간선(x/y NaN, 좌표 검사 안 함). 없는 맵이면 `script-transfer-missing-map` 경고. dynamic 이동이면 `unreachable-map` info |
| 완성 구조 가드(조수) | `src/ai/gameStructureGuard.ts` | 위 그래프를 그대로 쓴다. dynamic 이동이면 고립 맵을 막지 않는다. 스크립트 엔딩 호출 인정 |
| 이벤트 삭제 시 고아 스위치 | `src/editor/tools/strandedSwitches.ts` | 스크립트 쓰기도 「다른 곳이 켬」. 남는 스크립트가 dynamic 스위치 쓰기면 거절 안 함 |
| 서사 플래그 사용 색인(lint·퀘스트·DB 화면) | `src/project/storyFlagUsage.ts` | 스크립트 사이트(`commandPath:"script"`) + `scriptDynamic` 표. `projectLint` 의 read-without-write / write-without-read 는 dynamic 이면 생략하고 `story-flag:script-dynamic` info 한 줄 |
| 퀘스트 그래프 막다른 노드 | `src/project/quest/questGraph.ts` | dynamic 쓰기면 `quest-graph:dead-end-node` 를 error→info |
| 셀프 스위치 잠금 페이지 | `src/project/eventPageShadow.ts` | `script` 를 외부 제어 이전으로 취급(셀프 스위치 쓰기는 effects 에 안 남는다) → 판정 생략 |
| 월드 그래프 transfer 정합 | `src/project/worldGraph/lint.ts` | 출발 맵 스크립트가 그 맵으로 transfer 하면 `world-transfer-missing` 없음. dynamic 이면 info |
| 스크립트 참조 누락 | `src/project/lint/projectLint.ts` | `script-reference-missing` **경고**(아이템·배우·스킬·공통 이벤트·맵·적 그룹·애니메이션·라이브러리). 로드 검증(`commandReferenceValidation`)은 통과 — 스크립트 참조로 프로젝트가 안 열리면 안 된다 |
| 공통 이벤트 순환 호출 | `src/editor/eventDraftValidator.ts` `checkCallDepth` | 스크립트의 `callCommonEvent` 도 호출 간선 |
| 삭제 가드 | `src/editor/databaseReferences.ts`·`databaseRecordReferences.ts` | 스크립트·라이브러리가 리터럴로 부르는 공통 이벤트·배우·스킬·아이템·적 그룹·애니메이션·스위치·변수는 삭제 차단(`scriptRefersTo`). `projectCommonEventReferenceMessage` 는 순수 함수 |
| 맵 삭제 영향 | `src/project/mapDeletion.ts`·`src/editor/mapDeleteConfirm.ts` | `incomingScriptCount` — 스크립트는 고치지 않고 남는다고 확인창에 적는다 |
| 조수 고리 끊김 보고 | `src/ai/v2/gameChecks.ts` `lostLinks` | 스크립트의 쓰기·읽기·공통 이벤트 호출 |

의도적으로 안 건드린 것: 로드 검증(`commandReferenceValidation`, 위 이유), `gameCheck/commands.ts`(스키마가 없는 kind 는 필드 검사 대상 아님),
`autoPlay`(실제 인터프리터로 스크립트를 돌리지 않는 시뮬레이션), 전투 이벤트(스크립트는 트룹 페이지에서 안 돈다).
회귀: `test/scriptEffectsValidation.test.ts`.

## API 행 추가 절차

1. `apiSpec.ts` 에 행 추가(영문 doc, `ko`, 필요하면 `refs`, `awaits`). 2. `hostApi.ts` 에 구현 — 빠지면 컴파일 오류.
3. 새 타입이 필요하면 `dts.ts` 머리 부분. 4. `test/scriptSandbox.test.ts` 에 행동 고정. `HOST_API` 키 = `SCRIPT_API` 이름 테스트가 이미 있다.
5. 이 문서와 조수 스킬 문서(`assistant-skills/…`)의 표.

명령 kind 를 새로 만들 때 `script` 가 걸린 목록(같은 checklist): `commandKindRegistry`, `types/events.ts`, `commandGuaranteeRegistry`,
`runtimeSupport`, `shapeCommandFields`, `commandReferenceValidation`, `battleEvents`, `commandCatalog`, `eventCommandFactory`,
`eventDraftValidator`, `storyScript`, `commandPreview`, `commandSummary`, `options.ts`, 테스트 고정 목록 3곳 + `commandContracts/script.contract.test.ts`.

## 조수 도구 (Assistant tools)

`src/editor/tools/scriptTools.ts` 의 9개(도메인 event). 모델에게 가는 글(설명·결과·오류)은 영어다. 컴파일러와 QuickJS 는 각 도구의
`prepare` 가 기다린다(`run` 은 동기) — 실행기(`prepareTool`·Pi `toolAdapter`)가 `run` 앞에서 부른다.

| 도구 | 모드 | 하는 일 |
|---|---|---|
| `check_script` | read | 컴파일·타입 검사만. `ok`, `formatScriptDiagnostics` 진단(`L줄:열 error: …`), effects, 요약 |
| `author_script` | write | 대상(`mapId`+`eventId`+`pageIndex?` 또는 `commonEventId`) 최상위 목록의 `index`(기본 끝)에 새 `script` 명령. 컴파일 오류면 `ToolError`(코드 `script-compile-error`) + 영어 진단, 프로젝트 불변. 경고는 `warnings` |
| `edit_script` | write | 기존 스크립트를 `commandPath`(다른 이벤트 도구와 같은 `[index, branch, index…]`) 또는 `name` 으로 찾아 소스 교체·재컴파일. 페이지에 하나뿐이면 주소 생략 가능 |
| `dry_run_script` | read | 프로젝트 **사본**에서 헤드리스 실행(`startSession` + `createInterpreter`, 이벤트면 `currentEventId`·맵·좌표). `source`(즉석 컴파일) / 주소로 기존 스크립트 / 대상만 주면 페이지 전체. 답: `choices`·`numbers`·`battleResults`(기본 0·0·victory), 미리 놓기: `switches`·`variables`(닫힌 `{id,value}` 배열)·`gold`·`items`, `maxSteps`(기본 200, 최대 1000). 결과 `transcript`·`changes`(스위치·변수·글 변수·셀프 스위치·돈·아이템 전후)·`log`(`onScriptLog`)·`errors`·`endedBy` |
| `get_script_api` | read | `buildGameApiDts(scriptDtsIds(project, mapId))` — 이 프로젝트 id 가 리터럴 타입인 `.d.ts`. `format:'cheatsheet'` 는 `scriptApiCheatSheet()` |
| `upsert_script_module` | write | `@lib/<id>` 공용 모듈 만들기·교체(`libraryId` 로 컴파일). 바꾼 모듈을 import 하는 스크립트 목록을 경고로 |
| `list_script_modules` | read | 모듈 id·import 경로·export 이름·fresh, `includeSource` |
| `read_event_as_script` | read | 페이지 명령 목록 → TypeScript(`src/editor/script/eventToScript.ts`). 대사·선택지·단순 조건 분기·스위치/변수/돈/아이템(+=)·대기(프레임 정수)·이동·전투(결과 분기)·공통 이벤트·loop/breakLoop 는 직접 호출, 나머지와 추가 필드가 붙은 명령은 `await game.cmd({…정확한 JSON…})`. 출력은 그대로 컴파일된다(테스트 고정) |
| `write_event_as_script` | write | 페이지(또는 공통 이벤트) 명령 전체를 스크립트 하나로 교체. `confirm:true` 필수, 컴파일 오류면 거부 |

- **손으로 쓴 `{kind:"script"}` 거부**: 일반 이벤트 도구의 단일 관문 `validateLowLevelCommandArray`(`src/editor/tools/commandArgs.ts`,
  `upsert_event`·`patch_event_page`·`add_event_page`·`upsert_common_event`·트룹 페이지)가 모든 깊이의 `script` 명령에
  `scriptCommandProblem` 을 적용한다 — `compiled` 가 비었거나 `sourceHash !== scriptSourceHash(source)` 면 `script-not-compiled`
  로 거부하고 author_script/edit_script/write_event_as_script 를 안내한다. 빈 스크립트(소스·코드 둘 다 없음)는 통과,
  `get_event` 로 읽은 스크립트를 그대로 다시 보내는 것도 통과(해시가 맞는다).
- 노출: 레지스트리·별칭(`스크립트·타입스크립트·코드로·공식·퍼즐 로직…`)·라벨·능력 색인 레시피 `event-scripts`. v2 는
  `game.ts` `SCRIPT_TIER`(로직 낱말: 레버·비밀번호·조합·공식·할인·확률·시간대…)가 맞으면 `get_script_api`·`check_script`·`author_script`·
  `dry_run_script` 를 처음부터 싣고(`V2_UP_FRONT`), 나머지는 `load_tools`/이름 호출. `GAME_CARD` 와 v1 시스템 지시문에
  「조건·계산·반복·여러 갈래 로직은 스크립트 하나로, 단순 대사는 명령」 규칙, 확률은 `game.random` 스크립트로.
- **끄기 스위치(시험 전용)**: 조수 루프 프로세스 env `OPRN_V2_SCRIPTS=0` 이면 조수에게 스크립트 도구 9개(`getTool`·`activeTools` 에서 빠짐 — 이름으로 불러도 없다)·스킬 `event-scripts`·v1/v2 지시 줄·`SCRIPT_TIER` 카드를 모두 숨기고, GAME_CARD 난수 줄은 스크립트 이전 글(순서 돌리기)로 돌아간다(`src/ai/scriptsSwitch.ts`). 런타임·편집기의 `script` 명령은 그대로. 스크립트 켬/끔 A/B 용 — 제품 설정 칸이 아니다. 확인: `OPRN_V2_SCRIPTS=0 bun scripts/qa/script-ab/exposure.mts`.
- 스킬: `assistant-skills/event-scripts/SKILL.md`(언제 쓰나·API 표·규칙·고리·레버 퍼즐/할인 상점(@lib)/시간대 경비 예제) →
  `npm run assistant-skills:bundle` 로 `src/assets/assistantSkills.json`.
- 테스트: `test/scriptTools.test.ts`.
- 한계: `dry_run_script` 는 게임 시각을 미리 놓지 못한다(프로젝트 시작 시각). `author_script` 는 최상위 목록에만 넣는다(분기 안은 `edit_script`·`write_event_as_script`).

## 실조수 데모 (2026-10-31)

빈 프로젝트(`wholeGamePrepare`)에 v2 조수(Opus 5.5 medium, 로컬 CLI 엔진, `wholeGameSession --v2`)가 자연어 세 줄로 지었다 —
요청에 「스크립트」라는 말은 없었다.

- 레버 4개 조합 퍼즐: 레버마다 `author_script`(같은 판정 코드, `N` 만 다름) → `run_scene_test` 33/33.
- 포션 상인: `upsert_script_module{id:"pricing"}` + `import { discountedPrice } from "@lib/pricing"` → `dry_run_script` 세 번(평판 0·10·50, 돈 부족).
- 경비병: 시간대는 페이지 조건(`timePhase`)으로, 밤의 밀어내기·비켜서기는 `game.event`/`game.passable`/`game.moveEvent` 스크립트로.
  첫 시도는 `game.player().facing` 으로 컴파일 오류 → 진단을 보고 고쳐 다시 넣었다(필드는 `direction` — 치트시트에 타입 절을 붙인 이유).

출하 플레이어 QA: `node scripts/runtime-qa.mjs --scenario ts-sandbox-demo --browser firefox --netns --whole-game <project>` —
21비트 통과(틀린 순서 원위치·진행 0, 맞는 순서 스위치·평판 10, 창고·상자, 80G 안내·220G, 07/18/22시 반응·한 칸 밀림·비켜섬).
시계는 새 op `setClock`(`__oprnDebug.setClock(hour, minute)` = Set Time 명령 경로)으로 옮긴다.

## 알려진 한계 / 다음 단계

- 스크립트 라이브러리(`@lib`) 전용 편집 화면은 없다 — 조수 도구 `upsert_script_module`·`list_script_modules` 로 만든다. 명령 편집 칸(코드·진단·요약·4개 언어)은 있다.
- 셀프 스위치 쓰기(`game.setSelfSwitch`)와 명령 kind(`game.cmd({kind:"triggerEnding"})`)는 effects 에 남지 않는다 — 셀프 스위치는 판정을 생략하고, 엔딩은 소스 글을 본다(주석에도 속는 어림셈, 검사기가 조용해지는 쪽으로만 틀린다).
- 컴파일 결과의 줄 번호는 TS 원본과 대체로 같지만 정확히 같지는 않다(오류는 `compiled line N`). 소스맵은 없다.
- 라이브러리 모듈은 최상위 `await` 를 못 쓴다(동기 `new Function` 으로 평가).
- 조수 할 일 검사 `talk`(`src/ai/v2/todo/checks.ts`)는 스크립트의 `game.showMessage("리터럴")` 줄도 대사로 센다(변수·감싼 함수로 넘긴 글은 못 본다). 데모에서 이게 없어 상인 스크립트 앞에 평범한 대사 한 줄이 덧붙었다.
- 끝맺음 게임 검사(`src/ai/v2/gameChecks.ts`)는 흔들기·번쩍·효과음·BGM 을 스크립트 소스의 `game.shake/flash/playSe/playBgm` 호출로도 인정한다(글 검색 — 주석에도 속는다).
