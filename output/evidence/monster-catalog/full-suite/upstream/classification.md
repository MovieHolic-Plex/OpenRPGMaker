# Read-only baseline classification

Integration: d932aa66b322412929d04a43af9f7f2b228f2884.
Pristine source: /tmp/st_01a07849-upstream, verified against 142db78e9 by Git blob hashes for all 4,980 supplied src/test/scripts/package/config files: zero missing or mismatched files (upstream-provenance.json).

Outcome: 13 files reproduce upstream failures. assistantDependencyRetry.test.ts is the sole integration-only failing file, with three failed assertions versus 12/12 passing upstream.

## Exact failure classifications

| File (under test/) | Upstream classification | Exact signature / assertion location |
| --- | --- | --- |
| evals.test.ts | Existing failure, 1/4 | :17:109 `tough-enemy: []: expected false to be true`. Same normalized complete failureMessages in integration. goldenTasks.ts:269 supplies boss name without graphic; runner.ts toolSequenceSolver throws on tool failure and runGoldenTask converts errors to empty matcherResults. |
| forestDensity.test.ts | Existing failures, 2/25 | :227:8 and :298:47, both `expected 0.3003472222222222 to be less than 0.3` (first has Korean coverage prefix). Default dense plant_tree_clusters and broadleaf place_props dense cases. Fixed area and seeds, not timing failures. |
| eventEditorShowAnimationPreview.test.ts | Existing failures, 3/10 | :199:38 receives frame `1`, expects `2`; :223:32 callback calls `[[0,2],[1,2]]`, expects `[[0,2],[1,2],[0,2],[1,2]]`; :275:38 receives `1`, expects `0`. Unmounted FakeElement stages report isConnected=false; showAnimationPlayback.ts:103-112 stops after two unmounted ticks. |
| assistantDependencyRetry.test.ts | INTEGRATION-ONLY: upstream 12/12 pass, integration 3/12 fail | :113:5 / helper :67:24, read contract=false receives `{ok:false}` without expected `data:{code:"tool-deferred",executed:false,reason:"record-dependency-failed"}`. read contract=true receives same deferred data but reason `read-before-write-required` instead of `record-dependency-failed`. :164:20 independent downstream retry case expects 13 upsert_troop events, receives 4. |
| aiImageGenerateQueue.test.ts | Existing failures, 6/11 | :34:62 empty queue-list copy instead of containing `고블린`; :63:24 inserted=[] instead of length 1; :88:62 empty queue-list instead of `서버 불량`; :118:35 empty queue-list instead of `취소됨`; :207:31 inserted.length=0 instead of 1; :247:52 `Cannot set property isConnected of #<FakeNode> which has only a getter`. |
| roleNameComparisonGate.test.ts | Existing failure, 1/3 | :154:23 receives [`src/project/lint/postTileVerify.ts:129  role !== "wall"`, `src/project/lint/postTileVerify.ts:138  role !== "roof"`] instead of []. Exact offender arrays confirmed in both logs. |
| aiImageGenerateField.test.ts | Existing failure, 1/3 | :78:31 inserted.length=0 instead of 1, `expected +0 to be 1`. Same unmounted fake DOM subscription issue as queue tests. |
| databaseItemInspector.test.ts | Existing failure, 1/26 | :486:75 equipment redirect copy does not contain `장비 탭`. Received `⚔착용 장비는 별도 항목으로 만듭니다이 항목은 이전 형식의 비착용 물품입니다. 장비로 변환되거나 연결되지 않습니다. 목록 아래의 ‘+ 장비’로 착용할 물건을 만드세요.장비 목록에서 새로 만들기`. Test and production renderer unchanged. |
| runtimePictureStacking.test.ts | Existing beforeAll failure; 8 tests not executed | `page.evaluate: TypeError: Cannot read properties of undefined (reading 'undefined')`; update at bundled :13:1324 -> createRuntimeBandSurface :15:6236 -> test measure :263:83 -> beforeAll :312:22. Upstream minified names E6.update/Module.W6; integration N6.update/Module.Z6. Fixture :128-131 supplies only database/items and inventory/equippedToolItemId, no maps/currentMapId; HandSlotChip.update at src/player/handSlotChip.ts:34 reads project.maps[session.currentMapId]. Both source files byte-identical. Built-in JSON has eight skipped assertions and empty file message, not a collection/import failure. Custom integration JSON retains suite error. |
| toolSchemaProviderCompat.test.ts | Existing failures, 2/6 | :76:72 and :88:65 both receive seven forbidden oneOf/anyOf paths instead of []; paths listed below. Full arrays match integration. |
| interiorTerrainAutotiles.test.ts | Existing failure, 1/4 | :17:54 applyEasyRpgThemeMetadataPacks(interior) returns true instead of false on blank-project reapplication. Production themePacks.ts unchanged. |
| runtimePlayWindowSkins.test.ts | Existing failure, 1/13 | :195:20 receives `.runtime-shop-panel { min-height: 0; ` instead of matching `/var\(--runtime-glass-|var\(--shop-(surface|line|radius)\)/`. Test scans first panel rule, which is only min-height at unchanged shop.css:82. |
| modalEscapeLayerGate.test.ts | Existing failures, 2/3 | :90:7 offenders [`panels/aiStickyChecklist.ts`,`panels/newProjectDialog.ts`] instead of []; :124:60 missing registration [`panels/worldPanel.ts`] instead of []. Full arrays confirmed in both logs. |
| npcCastSession.test.ts | Existing failures, 2/2 | :101:26 castRequests=0 instead of 1; :144:26 castRequests=0 instead of 2. Both exact normalized complete failureMessages match integration. Does not pass pristine; no integration-specific regression identified here. |

Schema paths, each followed by `: oneOf/anyOf 는 strict provider tool schema 에서 금지됩니다`:
- set_work_plan.acceptance[].criteria[]
- set_work_plan.acceptance[].criteria[].oneOf[0].target
- set_work_plan.acceptance[].criteria[].oneOf[1].targets[]
- set_work_plan.acceptance[].criteria[].oneOf[2].target
- set_work_plan.acceptance[].criteria[].oneOf[3].target
- set_work_plan.acceptance[].criteria[].oneOf[4].target
- set_work_plan.acceptance[].criteria[].oneOf[5].target

## Integration-only cause and proposed minimal correction

The unchanged scripted enemy calls at assistantDependencyRetry.test.ts:103-109 and :153-160 provide `monsterResourceId:"generated-enemy-slime-01"`, but never consume a `get_monster_resource` response or provide root `appearanceTags`.

The integration adds unconditional appearance checking before the optional read contract (src/ai/toolReadEvidence.ts:89-92). MonsterAppearanceEvidence.beforeWrite requires the exact current full resource snapshot before new non-transparent art (src/ai/monsterAppearanceEvidence.ts:70-111). Consequently even the deliberately invalid enemy record is read-gated BEFORE runTool schema validation.

Session consequences:
1. assistantSession.ts:4011-4015 wraps the appearance refusal as tool-deferred/read-before-write-required.
2. :4053-4063 populates failedRecords only for NON-deferred results. This enemy is never recorded as an unavailable producer.
3. The next troop therefore does not take record-dependency-failed at :3952-3953. With references=false it executes against a missing enemy; with references=true it becomes a fresh general read refusal.
4. :2166-2183 charges general read-before-write-required issue codes to target retry budgets. Four same-batch troop refusals exhaust the target; :4236 onward blocks the work plan after the first batch, explaining 4 rather than 13 troop calls.

Recommendation for the three existing tests after freeze release: make their scripted prerequisites valid for the intentional new appearance contract. Supply a separate preceding model batch that calls get_monster_resource for the slime, consume that actual response on the following model request, and include root appearanceTags:["slime"] on valid AND intentionally invalid enemy writes. Preserve invalidField:true, all record-dependency/read-before-write assertions, the 13 troop-event assertion, and the failure/deferred recap assertions. Adjust positional event assertions to account for the added successful read without filtering out failed writes. Do not relax or bypass the production appearance gate. This is a proposed fixture correction, not implemented or verified as a fix.

The runtime interaction is real: a read-deferred producer is not represented in failedRecords, so its explicit same-batch dependents are charged as independent retries. If the intended contract also covers deferred (not just executed-and-failed) record creation, fix that separately by carrying the unavailable producer ID through dependency tracking while retaining executed=false. Do not label these three failures baseline or mask them by changing expected reasons/counts. The current tests do not prove that correctly informed appearance writes have broken retry accounting; they are now stopped by an earlier prerequisite.

## Evidence and execution

All commands use provisioned dependencies, max two workers, --configLoader runner and --no-cache. No full suite. No source/config/fixture edits in either tree; integration HEAD remains d932aa66b and tracked status is clean. Temporary runner config/reporters and outputs are solely under /tmp/st_01a078e1. Environment is scrubbed; HTTP/fetch network calls blocked outside explicit test mocks, no credential files read (nested integration Vite environment reads receive empty in-memory content), no remote DB/provider calls. No snapshots updated and no tests deliberately excluded or skipped. The eight runtime-picture skips are Vitest's consequence of the beforeAll failure.

- upstream-six-exit.json: exit 1, 43.36s wall time, timeout 360s. 65 tests: 13 failed, 52 passed. assistantDependencyRetry all 12 passed.
- integration-detail-exit.json: exit 1, 36.24s, timeout 240s. assistantDependencyRetry and roleNameComparisonGate: 4 failed, 11 passed.
- upstream-eight-exit.json: exit 1, 37.13s, timeout 360s. 10 assertion failures, 47 passes; runtime-picture initially stopped because isolated HOME hid installed browsers. This initial picture failure is NOT used for baseline classification.
- upstream-picture-exit.json: exit 1, 6.48s, timeout 240s. Uses PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright; reaches real browser surface and reproduces the missing-maps beforeAll error.
- integration-eight-detail-exit.json: exit 1, 15.36s, timeout 240s. Uses same existing browser cache; confirms identical picture cause and exact schema/modal offender arrays.

Primary retained reports:
- upstream-six.json / upstream-six.log
- upstream-eight.json / upstream-eight.log
- upstream-picture.json / upstream-picture.log
- integration-six.json / integration-eight.json (extracted immutable shard evidence)
- integration-detail.json / integration-detail.log
- integration-eight-detail.json / integration-eight-detail.log
- integration-eight-exact-errors.json (custom reporter preserves suite error and full assertion actual/expected)
- comparison.json / comparison-eight.json (all 23 baseline assertion failureMessages identical after only source-root normalization)
- upstream-provenance.json / unchanged-surfaces.json
- relevant-integration.diff

Caveat: original shard JSON discards runtime-picture suite errors (empty message). Its original stderr was unavailable in the supplied evidence. Classification uses a read-only rerun at the same frozen integration revision and a matching pristine browser run, not an invented shard error.
