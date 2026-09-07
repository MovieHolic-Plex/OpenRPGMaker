# Last 11 files: pristine baseline classification

## Outcome

- 10 files: all integration failures are pre-existing, with 19 exact matching assertion failureMessages (including complete reported stacks) after only source-root normalization.
- 1 file, `emberQuestToolReplay.test.ts`: genuine regression; both integration failures pass on pristine source. All 5 tests in this file pass on pristine.
- `elementRatesPartialAccept.test.ts` additionally fixes one pristine failure.

## Verification

Pristine supplied source: `/tmp/st_01a07849-upstream`; 4,982 src/test/scripts/package/config files hash-match Git revision `142db78e9eb3cd762bacd63cb0324c709392f6ed`. All 11 test files are byte-identical between pristine and frozen integration revision `d932aa66b322412929d04a43af9f7f2b228f2884`. Frozen integration evidence is shard-13.json through shard-16.json, not quarantined attempt-1. Integration source was not executed.

One existing-test command ran all 11 complete test files with JSON plus exact-error reporters, runner config loader, cache disabled, two workers, scrubbed environment, and owned `/dev/shm/st_01a078fc/tmp`. Exit 1 in 117.80s: 123 tests, 103 passed, 20 failed, no skipped/pending tests or suite/collection errors. Selected integration reports contain 123 assertions and 21 failures.

One additional baseline unhandled rejection is preserved by the custom reporter: `TypeError: matching.matches is not a function`, originating at `tilesetAiWorkspaceAccessibility.ts:25:29`, through `runTilesetAiReview` / `openTilesetAiWorkspace`, in `tilesetAiWorkspaceModal.test.ts:151:5`. The frozen standard JSON does not expose unhandled errors, so no exact integration comparison is claimed for that extra rejection. The named tileset test assertion itself matches exactly.

No ENOSPC, ENOENT, missing asset provisioning, network-block, or credential-read errors in selected integration reports or baseline run. No Git-blob asset provisioning was needed. No source/config/fixture/DB/credential changes; diagnostic config, reporters, evidence, and temporary runtime files are confined to this owned namespace.

## Per-file exact comparison

### aiAssistantSession.test.ts - BASELINE
Frozen source report: shard-16.json.

- Assertion: AssistantSession 툴콜 루프 검수 응답이 raw 툴콜 마크업이면 원문 노출 없이 1회 재투입한다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected '완료 검증이 아직 미완성입니다.\n- 이 작업을 단계로 진행해줘. …' to be '타이틀 변경을 제안했습니다.' // Object.is equality`
  - Assertion location: `test/aiAssistantSession.test.ts:1434:34`.
- Assertion: AssistantSession 툴콜 루프 검수가 미이행을 발견하면 실행 모델로 한 번 재투입한 뒤 감독 모델이 최종 응답한다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected '완료 검증이 아직 미완성입니다.\n- 이 작업을 단계로 진행해줘. …' to be '길과 꽃을 모두 제안했습니다.' // Object.is equality`
  - Assertion location: `test/aiAssistantSession.test.ts:1389:34`.
- Assertion: AssistantSession 툴콜 루프 쓰기 툴이 시작되면 이후 호출은 실행 모델로 전환하고 검수는 감독 모델로 돌아온다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected 'error' to be 'final' // Object.is equality`
  - Assertion location: `test/aiAssistantSession.test.ts:1334:34`.
- Assertion: AssistantSession 툴콜 루프 오케스트레이션에서 변경 기대 요청이 0건 비질문으로 끝나면 한 번 재킥해 실행한다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected 'error' to be 'final' // Object.is equality`
  - Assertion location: `test/aiAssistantSession.test.ts:1537:34`.
- Assertion: AssistantSession 툴콜 루프 자가수정: 커밋/검증 실패 → issues 반환 → 재시도 → 성공
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected 'error' to be 'final' // Object.is equality`
  - Assertion location: `test/aiAssistantSession.test.ts:1205:34`.
- Assertion: AssistantSession 툴콜 루프 집 3채 NPC 5명 요청에서 집 1채만 제안되면 검수가 완료라고 답해도 missingWarnings로 재투입한다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected [ 'plan', 'execute', 'execute', …(2) ] to deeply equal [ 'plan', 'execute', 'review', …(2) ]`
  - Assertion location: `test/aiAssistantSession.test.ts:1489:20`.
- Assertion: 하네스 관측 오케스트레이션 주입 원문이 감사 로그에 남고 턴 종료 라인에 출력 토큰이 붙는다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected undefined to be 'status' // Object.is equality`
  - Assertion location: `test/aiAssistantSession.test.ts:1802:27`.

### aiEditorCapabilityParity.test.ts - BASELINE
Frozen source report: shard-13.json.

- Assertion: AI editor capability parity returns full database record fields when include=full
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: 'upsert_enemy' 실행 실패: enemy.monsterResourceId: "패리티 슬라임"에 확실히 맞는 외형이 없습니다. list_resources(kind:"monster", query:"*")로 확인한 리소스 ID를 enemy.monsterResourceId에 지정하세요. 사용 가능한 monster 리소스 예시: generated-enemy-slime-01, generated-e…: expected false to be true // Object.is equality`
  - Assertion location: `test/aiEditorCapabilityParity.test.ts:56:41`.

### aiEditorFullToolCoverage.test.ts - BASELINE
Frozen source report: shard-15.json.

- Assertion: AI assistant editor-wide project mutation coverage changes project identity, terms, display, resources, and battle defaults
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: 'upsert_enemy' 실행 실패: enemy.monsterResourceId: "설정용 적"에 확실히 맞는 외형이 없습니다. list_resources(kind:"monster", query:"*")로 확인한 리소스 ID를 enemy.monsterResourceId에 지정하세요. 사용 가능한 monster 리소스 예시: generated-enemy-slime-01, generated-ene…: expected false to be true // Object.is equality`
  - Assertion location: `test/aiEditorFullToolCoverage.test.ts:181:37`.

### elementRatesPartialAccept.test.ts - BASELINE (plus one fixed assertion)
Frozen source report: shard-14.json.

- Assertion: elementRates 부분 수용 DB에 없는 속성 키만 버리고 유효한 등급은 유지한다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected false to be true // Object.is equality`
  - Assertion location: `test/elementRatesPartialAccept.test.ts:25:23`.
- Assertion: elementRates 부분 수용 속성 타입을 speciesId로 잘못 보낸 신규 적도 종 참조만 제외하고 생성한다
  - Pristine: failed; integration: passed; complete root-normalized failureMessages equal: False.
  - Signature: `AssertionError: [{"severity":"error","code":"monster-graphic-required","message":"enemy.monsterResourceId: \"불꽃 정령\"에 확실히 맞는 외형이 없습니다. list_resources(kind:\"monster\", query:\"*\")로 확인한 리소스 ID를 enemy.monsterResourceId에 지정하세요. 사용 가능한 monster 리소스 예시: generated-enemy-slime-01, generated-enemy-bat-01, generated-enemy-golem-01"}]: expected false to be true // Object.is equality`
  - Assertion location: `test/elementRatesPartialAccept.test.ts:48:54`.

### emberQuestToolReplay.test.ts - REGRESSION
Frozen source report: shard-13.json.

- Assertion: emberQuestToolReplay 모든 툴 호출이 성공한다(커밋 게이트 통과)
  - Pristine: passed; integration: failed; complete root-normalized failureMessages equal: False.
  - Signature: `AssertionError: expected [ Array(3) ] to deeply equal []`
  - Assertion location: `test/emberQuestToolReplay.test.ts:170:76`.
- Assertion: emberQuestToolReplay 스펙 카운트가 일치한다(맵5/NPC12/몬스터5/아이템8/전투블로커5)
  - Pristine: passed; integration: failed; complete root-normalized failureMessages equal: False.
  - Signature: `AssertionError: expected 4 to be 5 // Object.is equality`
  - Assertion location: `test/emberQuestToolReplay.test.ts:176:53`.

### questGraph.test.ts - BASELINE
Frozen source report: shard-15.json.

- Assertion: quest graph 전투 승리 write site는 manualHint set 폴백으로 생성한다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected false to be true // Object.is equality`
  - Assertion location: `test/questGraph.test.ts:195:92`.

### refactorTools.test.ts - BASELINE
Frozen source report: shard-13.json.

- Assertion: prune_unused 미참조 아이템/트룹을 발견한다(보고 모드)
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected [] to include 'tr_orphan'`
  - Assertion location: `test/refactorTools.test.ts:63:27`.
- Assertion: prune_unused 어떤 트룹도 참조하지 않는 적을 미사용으로 잡는다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected [] to include 'en_lonely'`
  - Assertion location: `test/refactorTools.test.ts:85:28`.

### softConfirmUxFixes.test.ts - BASELINE
Frozen source report: shard-14.json.

- Assertion: soft-confirm UX fixes second identical place_props in a turn is skipped (no double scatter)
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected 'error' to be 'final' // Object.is equality`
  - Assertion location: `test/softConfirmUxFixes.test.ts:85:32`.

### tilesetAiWorkspaceModal.test.ts - BASELINE
Frozen source report: shard-13.json.

- Assertion: AI tileset workspace three-step flow shows the summary step with a confirmed list and applies to the project
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `TypeError: matching.matches is not a function`
  - Assertion location: `test/fakeDom.ts:242:9)`.

### webExportBattleDependencies.test.ts - BASELINE
Frozen source report: shard-15.json.

- Assertion: export runtime-selected party battle dependencies embeds actual party render dependencies in the standalone asset table
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected null not to be null`
  - Assertion location: `test/webExportBattleDependencies.test.ts:28:23)`.
- Assertion: export runtime-selected party battle dependencies keeps a runtime-selected uploaded back sprite through preparation
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected undefined to deeply equal { …(5) }`
  - Assertion location: `test/webExportBattleDependencies.test.ts:66:50`.
- Assertion: export runtime-selected party battle dependencies ships the static and idle URLs actually rendered by rm2000
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected null not to be null`
  - Assertion location: `test/webExportBattleDependencies.test.ts:28:23)`.

### worldAiExclusion.test.ts - BASELINE
Frozen source report: shard-16.json.

- Assertion: 세계관 AI 컨텍스트·경고 배제 세계관이 있어도 villageInfoDocuments는 기존 발췌 경로를 그대로 쓴다
  - Pristine: failed; integration: failed; complete root-normalized failureMessages equal: True.
  - Signature: `AssertionError: expected '당신은 브라우저 기반 2D RPG 에디터의 개발 어시스턴트입니다.\…' to contain '## 게임 스타일 문서(발췌)'`
  - Assertion location: `test/worldAiExclusion.test.ts:125:20`.

## Regression details and evidence limit

`emberQuestToolReplay` has these exact new failures:

1. `모든 툴 호출이 성공한다(커밋 게이트 통과)`: pristine passes; integration reports `AssertionError: expected [ Array(3) ] to deeply equal []` at `test/emberQuestToolReplay.test.ts:170:76`.
2. `스펙 카운트가 일치한다(맵5/NPC12/몬스터5/아이템8/전투블로커5)`: pristine passes; integration reports `AssertionError: expected 4 to be 5 // Object.is equality` at `test/emberQuestToolReplay.test.ts:176:53`.

Reading the unchanged test establishes that line 176 counts `ev_blk_` battle-blocker events, not enemies or maps. Line 170 aggregates unsuccessful runTool calls from the complete replay. Thus integration rejects three tool calls and creates four rather than five battle blockers, whereas pristine accepts the sequence and all five file assertions pass. Frozen standard JSON truncates the three issue objects as `[ Array(3) ]`; their exact payloads and which calls failed cannot be recovered from these reports. This classification does not invent those payloads or rerun changing integration source.

## Evidence paths

All paths below are relative to `/dev/shm/st_01a078fc/`:

- `comparison.json`: full test names, both statuses, both complete raw failureMessages, and exact-match boolean for each changed/failed assertion.
- `baseline.json`, `baseline.log`, `baseline-exact-errors.json`: actual pristine run and expanded baseline actual/expected values, including unhandled rejection.
- `baseline-exit.json`: exact command, sanitized environment, duration and exit.
- `integration-eleven.json`: target-only frozen evidence, with shard number per file.
- `shard-13.json` through `shard-16.json`: copied immutable raw inputs.
- `provenance.json`, `test-provenance.json`: Git-blob verification.
- `environment-audit.json`: environmental-error audit.
- `classification.md`: this report.
