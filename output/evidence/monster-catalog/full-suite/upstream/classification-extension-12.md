# Final extension: shards 09-12

All 12 added files reproduce their decisive failures on pristine 142db78e9. Combined with classification.md, 25 of 26 requested files are upstream failures; assistantDependencyRetry.test.ts remains the only integration-only failing file. No code was changed in either tree.

## Decisive assertions

| File under test/ | Upstream failures / tests | Exact decisive failure | Debt classification |
| --- | --- | --- | --- |
| eventValidationNavigationContract.test.ts | 1/18 | :190:43 modalStackEntryCountForTest() is 2, expected 0 immediately after cancel click. | Existing rendered-modal lifecycle assertion failure. Not evidence of a new integration regression. |
| aiSpecGateHardening.test.ts | 1/21 | :319:27 second[0]?.ok is undefined, expected false on the next user turn. | Existing scripted-session failure; no second collected tool result. |
| assistantSessionIntent.test.ts | 2/12 | :110:34 gets `완료 검증이 아직 미완성입니다.\n- 집 하나 만들어줘: Missing or malformed criteria: repair_acceptance required\n`, expects `야외 집으로 진행합니다.`. :257:23 tool names include forbidden `set_type_chart`. | Existing acceptance-fixture/routing assertions. Exact actual acceptance text matches. Tool-list lengths differ 202 upstream / 204 integration ONLY by adding get_monster_resource and list_monster_resources; set_type_chart is already present upstream. |
| houseProtectionForest.test.ts | 1/16 | :149:27 `TypeError: Cannot read properties of undefined (reading 'type')`; stack is isWorldTileset (worldCoastMapping.ts:28) <- isLakeAutotileTile (lakeAutotile.ts:98) <- Array.filter. | Test callback-signature debt: `map.lowerTiles.filter(isLakeAutotileTile)` passes the array index as the optional tileset argument. A nonzero index reaches tileset?.image.type with image undefined. Not a forest-protection product regression. |
| mapSurfaceFocus.test.ts | 1/7 | :99:43 historyHotkeyOwnedByPanel() false, expected true for mounted modal. | Fake DOM selector debt: hotkeys.ts:143 asks `[data-testid='event-editor-modal']:not([hidden])`; fakeDom.ts:534-557 only handles whole simple attribute selectors and a limited tag:not(:disabled), not this compound selector. |
| aiWorkItemStall.test.ts | 3/5 | :133:26 and :193:57 `in_progress` instead of `blocked`; :175:34 receives `완료 검증이 아직 미완성입니다.\n- 연못 만들기: Missing or malformed criteria: repair_acceptance required\n` instead of containing `막혔습니다`. | Existing scripted acceptance/stall failures. Repeated-tool stall checks before :175 pass in case a-2; the failing assertion is final acceptance text, not that stall detection disappeared. |
| databaseSkillAnimationStage.test.ts | 1/10 | :143:38 frameIndex `1`, expected `2`. | Detached fake DOM fixture: mount() at :111 appends the stage to a detached div, never document.body; shared showAnimationPlayback stops after two never-mounted ticks. |
| interiorBench.test.ts | 1/39 | :292:62 `t3-floor composite: expected 0.9333333333333332 to be greater than or equal to 0.999`. | Existing benchmark canonical-answer/score disagreement. Missing upstream PNG provisioning resolved without changing fixtures in either tree; exact integration assertion then reproduced. |
| showPictureForm.test.ts | 1/12 | :190:43 replacement-call count is 0, expected >0 after image generation. | Existing detached fake DOM/image-queue subscriber fixture issue; same already-traced aiImageGenerateField detach handling. |
| aiMapContextPassabilityWiring.test.ts | 1/2 | :100:21 last user payload is originalContext JSON, does not contain `pass:`. | Existing context-location fixture assertion: reverse().find(role=user) selects the appended original-context payload in both versions. Both selected region payloads have keys mapId,mapName,grid,legend,events,water and lack the pass: sentinel. |
| databaseAnimationPreview.test.ts | 1/2 | :71:41 aria-pressed is `false`, expected `true` immediately after rendering. | Detached fake DOM fixture: panel is never mounted; databaseAnimationPreview start() at :265 checks isDisconnected(panel). |
| gen1DemoContent.test.ts | 1/3 | :55:84 `TypeError: actual value must be number or bigint, received "undefined"` for a species-linked skill's optional maxPp compared to >0. | Existing authored-content/schema mismatch; this classification does not invent which skill lacks maxPp. |

For 14 of these 15 failed assertions, complete failureMessages are byte-identical after replacing only the source-root directory. The remaining assertion is assistantSessionIntent's tool-list display: 202 -> 204 tools; exact list comparison verifies only the two new monster read tools were added, and the prohibited set_type_chart membership already failed upstream.

## Provisioning corrections (not test fixes)

1. First twelve-file command failed at startup (exit 1, 0.57s), because Vite could not load the external custom reporter from the upstream default config. Node import separately verified the file exists/loads. Reusing an external config in the reporter directory, importing unchanged upstream settings, allowed the run. This startup failure is retained in upstream-twelve.log / upstream-twelve-exit.json and is not a test classification.
2. The successful 12-file process exited 1 in 63.67s, bounded at 420s, two workers. It reported 147 tests, 125 passing and 22 failing. Seven excess failures plus the masked canonical-score failure were caused by the supplied upstream source-only tree lacking public/assets/easyrpg-chipset-interior-transparent.png. These ENOENT errors are not baseline classification.
3. Extracted only that PNG from git show 142db78e9 into /tmp/st_01a078e1, verified Git blob 1e040e242684d2e5a4b5817d24a1b8142f68beaf and SHA256 144ac330fb866e54632f39701062ba044e8112e5a4c32abad4230b29fc3abbd3. Bytes also equal integration's asset. A Node fs.readFile mapping supplies those exact bytes to Jimp without adding anything to the upstream or integration trees. Single-file interiorBench run exits 1 in 6.18s, bounded at 240s: 38 pass, exact existing t3-floor assertion fails. No other tests changed.
4. Integration intent/passability detail run exits 1 in 15.76s, bounded at 180s: preserves exact actual payloads and tool arrays in a custom JSON reporter, confirming the incidental tool-count delta is not a new failure cause.

Effective pristine results for these 12 files after asset provisioning: 132 pass, 15 failed assertions, same failing test identities as integration.

## Artifacts

- upstream-twelve-run.json / upstream-twelve-run.log: full initial collected baseline run.
- upstream-twelve-exact-errors.json: assertion actual/expected and stacks, including complete model-facing payload.
- upstream-interior.json / upstream-interior.log / upstream-interior-exact-errors.json: definitive interiorBench baseline with exact upstream PNG.
- interior-asset-provenance.json: immutable asset identity.
- integration-twelve.json: exact extracted shard-09 through shard-12 results.
- integration-intent-detail.json / integration-intent-detail.log / integration-intent-exact-errors.json: exact integration routing/context failures.
- intent-exact-comparison.json: exact two-tool list delta and selected-context comparison.
- comparison-twelve-final.json: definitive comparisons; supersedes interiorBench's provisional ENOENT entry in comparison-twelve.json.
- *-exit.json: actual process codes, commands, wall times, and timeout bounds.

No full-suite execution, remote database/provider calls, snapshots refreshed, or assertion/exclusion/skip changes. No source/config/fixture writes in either tree. Integration was rechecked at d932aa66b322412929d04a43af9f7f2b228f2884 with clean tracked status after these runs.
