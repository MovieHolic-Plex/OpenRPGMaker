# Frozen 66-file assertion-level baseline classification

Frozen integration: `d932aa66b322412929d04a43af9f7f2b228f2884`. Pristine baseline: `142db78e9eb3cd762bacd63cb0324c709392f6ed`.

## Outcome

All 66 selected files have terminal execution receipts and assertion-name/message comparisons. There are 140 frozen failed assertions: **134 exact message matches**, **2 preexisting clock-only message differences**, and **4 explicitly inconclusive environment-dependent assertions**. No introduced assertion is confirmed. This is **not** proof that all frozen failures predate the integration.

- The primary 11 batches ran 746 tests: 608 passed, 138 failed, 0 pending; 65 failed files and 1 passed file. All 11 processes exited 1. No batch timed out.
- A separate two-file configured control reproduced three additional exact messages and the previously unmatched clean-flush spy failure (apart from its ISO timestamp). Its process also exited 1.
- Twelve unhandled rejections were captured separately; all are `TypeError: list.insertBefore is not a function` in `agentBlueprintTurnEnd.test.ts`. They are not erased by the JSON assertion totals.

## Method and immutable inputs

1. Compared the supplied 66-file list with the frozen aggregate. All 66 test files are byte-identical between the two Git revisions (`frozen-test-diff.patch` is empty).
2. Audited the shared pristine tree against Git, then ran an isolated byte-identical mirror in `/dev/shm/st_01a079-existing/pristine`. The shared source and integration were never executed with a changing command. Post-run audits verify 4,982 source/script/test/config files in both pristine locations with no missing or modified files.
3. Provisioned missing docs/public/HTML/Vite build inputs using 2,591 exact Git blobs (312,967,136 bytes). `asset-read-mapping.json` records every logical path, blob SHA, size and read mapping. Asset/docs mappings are symlinks to verified blob bytes; top-level config/HTML files are materialized byte-identically to preserve import.meta.url build paths. No synthetic asset content.
4. Used two concurrent batches, six test files per batch, at most two Vitest workers per batch. Each has its own `/dev/shm` TMPDIR. Runner config only relocates cache/env inputs and disables test cache; original tests, assertions, timeouts and exclusions are unchanged.
5. Used a fresh HOME, no inherited credential environment, and a preload guard that blocks actual network and credential-file reads. Existing test-owned fetch mocks still execute. The one `.env.local` read attempt was blocked before reading bytes. No source-write attempts were recorded. Generated test output stays in the owned mirror/TMPDIR.
6. Compared fullName plus complete error-message text after source-root normalization. Stack frames are compared separately and retained. No count/file-only equivalence, no global timestamp stripping, and no filtering of failures. `exceptions.json` includes every initial non-exact comparison and any configured-control message.

## Exceptions and minimal cause/correction

### storePersistence.test.ts: initially integration-only clean-flush failure is preexisting

`Project store remote persistence skips remote flush when there are no unsaved changes` initially passed pristine, but failed in the configured control with the same one-call spy payload as frozen: POST `/__oprn/edit-activity`, scope `system`, label `프로젝트 정규화 (1종)`, field `bundledTilesets: true`. Only `entries[0].at` differs. This is not a new Supabase write.

Cause: prior load/reconnect normalizes bundled tilesets (`store.ts:1289-1326`), calls `recordChangeActivity`, then `recordEditActivity` queues a debounced mirror (`editActivityLog.ts:421-441`). The timer calls whichever global fetch is current; test teardown resets modules/globals but does not drain/cancel that old module timer. The clean `flush()` branch (`store.ts:888-908`) itself does not fetch. These paths are unchanged between baseline and frozen revisions; the only store diff adds saved-response monster-metadata reconciliation, which the clean branch does not reach.

Minimal test correction: await the real edit-activity mirror completion while the originating test mock is installed, before resetting modules/globals, and distinguish remote persistence requests from the unrelated disk-mirror endpoint. Use the existing flush/reset lifecycle hooks, not sleeps or timing retries. No production monster-metadata fix is supported by this failure.

The earlier `does not write to Supabase before the canonical project has loaded` failure is also identical except its ISO timestamp: its spy incorrectly includes an edit-activity POST in the no-Supabase-call assertion.

The configured control uses only literal `test-anon-key`, `http://dbserver:8100`, and the test-owned project-id value. It reproduces exact frozen TypeErrors for `always creates a new fresh project instead of reloading local dev overrides` and `saves and reloads local edits for dev showcase projects without Supabase`. The primary run instead failed earlier with `DbConnectionRequiredError` because it had no inherited DB config.

### Four inconclusive assertions: retain, do not call preexisting or fixed

1. `storePersistence.test.ts` / `reports why DB persistence is unavailable for local dev showcase projects`: frozen throws `SupabaseProjectSyncError` with `Invalid authentication credentials`; pristine throws the explicit network-block guard error. The unchanged test supplies DB config but no fetch mock, so exact server behavior is not comparable.
2. `unsavedChangesGuard.test.ts` / `devProject 모드: 변경→true, flush(로컬 기록)→false`: frozen reaches `expected saved to be saved-local`; pristine fails earlier with `DbConnectionRequiredError: 온라인 저장 설정이 필요합니다.`
3. `unsavedChangesGuard.test.ts` / `freshProject(저장 스킵) 모드: flush가 saved-local이어도 미저장으로 남는다`: same downstream-vs-configuration difference.
4. `regionAiHouseTreeNpc.probe.test.ts` / `live region task LLM: 집과 나무 1개 npc 배치`: frozen has `expected false to be true`; pristine has native status passed only because the test returns at its missing-credentials branch. No live LLM behavior was exercised. This is the only frozen failed test name without a demonstrated pristine failure after the configured control.

For the three persistence cases, the minimal underlying setup problem is visible in pristine: `devProjectFactory` defaults to null (`store.ts:205-208`); only app boot installs `createDevShowcaseProjectForLocation` (`src/app/mode.ts:85`). These tests import store directly after module reset, so URL flags alone cannot select the local showcase path (`store.ts:260-285`). Proposed correction: install the production dev-project factory explicitly in tests after reset and before load, with isolated storage and precise offline network mocks. This explains why the baseline already fails but does not establish equality of the unavailable downstream assertions.

For the live region assertion, the frozen stack points to `test/regionAiHouseTreeNpc.probe.test.ts:211`, specifically `expect(result.ok).toBe(true)`. The frozen JSON does not retain the underlying `runRegionTask` error or LLM response, so its actual cause is unknown, not proven environmental or preexisting. Use an explicit opt-in live test or a deterministic recorded-response fixture while preserving the authored placement assertions. Attribution to the integration remains unverified; no production correction can be justified from this result alone.

### uxcEditorShell.test.ts: same preexisting assertion, configuration-dependent excerpt

The primary error excerpts differ only in footer status: configured `저장 준비` versus unconfigured `저장소 미설정`. The control reproduces the exact frozen error. The asserted missing `새 이벤트 (저장 전)` string is the same failure. `modal.ts:719,745,757` supplies the two footer states and is unchanged between revisions.

### Preserved unhandled errors

All 12 baseline unhandled rejections come from `aiStickyChecklist.ts:134` calling `list.insertBefore`, absent from the unchanged fake DOM. The call chain is checklist update -> aiChatPanel.showAcceptance -> aiTurnRunner.executeTurn; the associated 12 assertions time out awaiting terminal activity-log persistence. The checklist and fake-DOM files are identical across both revisions. The minimal correction is to make the fake DOM implement the required DOM insertion behavior, not to ignore unhandled errors or relax the terminal-log assertions. Frozen native JSON does not expose unhandled-error counts; no equality/zero claim is made for those integration errors.

## Per-file coverage

`P` = exact primary signature; `C` = exact configured-control signature; `T` = clock-only difference; `DB` = inconclusive DB environment; `LIVE` = unexercised live assertion.

| File | Frozen failed assertions | Classification | Primary report |
|---|---:|---|---|
| `test/actionDebounceFootprint.test.ts` | 2 | P: 2 | `batch-01.json` |
| `test/actorCombatCommandBodies.test.ts` | 3 | P: 3 | `batch-01.json` |
| `test/agentBlueprintTurnEnd.test.ts` | 12 | P: 12 | `batch-01.json` |
| `test/aiAssistantAfterUx.test.ts` | 2 | P: 2 | `batch-01.json` |
| `test/aiAutonomousRunSmoke.test.ts` | 3 | P: 3 | `batch-01.json` |
| `test/aiChatPanelUxRepairs.test.ts` | 2 | P: 2 | `batch-01.json` |
| `test/aiPlacementCutsceneCheckpoint.test.ts` | 2 | P: 2 | `batch-02.json` |
| `test/aiProposalCardUxd.test.ts` | 2 | P: 2 | `batch-02.json` |
| `test/appStorageMigration.test.ts` | 1 | P: 1 | `batch-02.json` |
| `test/authorHouseFacade.test.ts` | 4 | P: 4 | `batch-02.json` |
| `test/autosaveStatus.test.ts` | 1 | P: 1 | `batch-02.json` |
| `test/autotileGroupPersistence.test.ts` | 3 | P: 3 | `batch-02.json` |
| `test/battleElementAdversarialFixes.test.ts` | 1 | P: 1 | `batch-03.json` |
| `test/changeExpCommandBody.test.ts` | 3 | P: 3 | `batch-03.json` |
| `test/changePartyCommandBody.test.ts` | 1 | P: 1 | `batch-03.json` |
| `test/clusterRulePlacement.test.ts` | 5 | P: 5 | `batch-03.json` |
| `test/commandContracts/evolveMonster.contract.test.ts` | 1 | P: 1 | `batch-03.json` |
| `test/commandKindCoverage.test.ts` | 3 | P: 3 | `batch-03.json` |
| `test/commentCommandBody.test.ts` | 2 | P: 2 | `batch-04.json` |
| `test/databaseKoreanRtpDefaults.test.ts` | 1 | P: 1 | `batch-04.json` |
| `test/defaultAdventureGame.test.ts` | 3 | P: 3 | `batch-04.json` |
| `test/defaultDatabase.test.ts` | 1 | P: 1 | `batch-04.json` |
| `test/defaults.test.ts` | 1 | P: 1 | `batch-04.json` |
| `test/demoTeach.test.ts` | 1 | P: 1 | `batch-04.json` |
| `test/detsukuruBrandStrings.test.ts` | 1 | P: 1 | `batch-05.json` |
| `test/devShowcaseProjects.test.ts` | 2 | P: 2 | `batch-05.json` |
| `test/emberQuestGame.test.ts` | 1 | P: 1 | `batch-05.json` |
| `test/eventEditorCommandLabels.test.ts` | 1 | P: 1 | `batch-05.json` |
| `test/eventEditorCommitProbe.baseline.test.ts` | 2 | P: 2 | `batch-05.json` |
| `test/eventEditorFormSurface.baseline.test.ts` | 1 | P: 1 | `batch-05.json` |
| `test/eventEditorInteractionSurface.baseline.test.ts` | 1 | P: 1 | `batch-06.json` |
| `test/eventEditorTrustLoop.test.ts` | 4 | P: 4 | `batch-06.json` |
| `test/eventEditorUiDensity.test.ts` | 5 | P: 5 | `batch-06.json` |
| `test/genrePackReceiptCli.test.ts` | 1 | P: 1 | `batch-06.json` |
| `test/houseLotTools.test.ts` | 2 | P: 2 | `batch-06.json` |
| `test/interiorAutotile.test.ts` | 1 | P: 1 | `batch-06.json` |
| `test/interiorWallFrameQuarterComposition.test.ts` | 2 | P: 2 | `batch-07.json` |
| `test/io.test.ts` | 1 | P: 1 | `batch-07.json` |
| `test/koreanLocalizationDefaults.test.ts` | 1 | P: 1 | `batch-07.json` |
| `test/layerRouting.m1.test.ts` | 1 | P: 1 | `batch-07.json` |
| `test/mapEditCommands.test.ts` | 2 | P: 2 | `batch-07.json` |
| `test/modeTransitions.test.ts` | 1 | P: 1 | `batch-07.json` |
| `test/monsterCollection.test.ts` | 2 | P: 2 | `batch-08.json` |
| `test/monsterEvolutionTypeChart.test.ts` | 1 | P: 1 | `batch-08.json` |
| `test/pkmnBalanceB6.test.ts` | 7 | P: 7 | `batch-08.json` |
| `test/playerRuntimeCss.test.ts` | 1 | P: 1 | `batch-08.json` |
| `test/pokemonChipsetPreset.test.ts` | 1 | P: 1 | `batch-08.json` |
| `test/quickAuthoringPreviewIdentity.test.ts` | 2 | P: 2 | `batch-08.json` |
| `test/regionAiHouseTreeNpc.probe.test.ts` | 1 | LIVE: 1 | `batch-09.json` |
| `test/regionTaskCssTokens.test.ts` | 2 | P: 2 | `batch-09.json` |
| `test/rm2003DatabaseUtilityRecords.test.ts` | 2 | P: 2 | `batch-09.json` |
| `test/scarloxyPokemonDemo.test.ts` | 1 | P: 1 | `batch-09.json` |
| `test/scatterObject.test.ts` | 6 | P: 6 | `batch-09.json` |
| `test/setGroupLayout.test.ts` | 1 | P: 1 | `batch-09.json` |
| `test/storePersistence.test.ts` | 7 | T: 2, P: 2, C: 2, DB: 1 | `batch-10.json` |
| `test/teamWorkflowUi.test.ts` | 1 | P: 1 | `batch-10.json` |
| `test/tileFlowApprovalExpansion.test.ts` | 2 | P: 2 | `batch-10.json` |
| `test/tileGrafts.test.ts` | 1 | P: 1 | `batch-10.json` |
| `test/tileLayerClassification.test.ts` | 2 | P: 2 | `batch-10.json` |
| `test/tilesetHarness.test.ts` | 1 | P: 1 | `batch-10.json` |
| `test/tilesetPaletteT1a.test.ts` | 3 | P: 3 | `batch-11.json` |
| `test/tilesetWave2Undo.test.ts` | 1 | P: 1 | `batch-11.json` |
| `test/toolCatalog.test.ts` | 1 | P: 1 | `batch-11.json` |
| `test/unsavedChangesGuard.test.ts` | 2 | DB: 2 | `batch-11.json` |
| `test/uxcEditorShell.test.ts` | 1 | C: 1 | `batch-11.json` |
| `test/viteConfig.test.ts` | 1 | P: 1 | `batch-11.json` |

## Evidence index

- `assertion-classification.json`: all 66 files, all 140 names, frozen/pristine message and stack signatures, final decisions, control signatures, and unhandled errors.
- `exceptions.json`: the nine primary non-exact comparisons, with control evidence.
- `batch-01.json` ... `batch-11.json`, corresponding `-exit.json`, `-errors.json`, `.log`, and `-audit.jsonl`: native reports, actual terminal receipts, exact errors, logs and guard audits.
- `configured-control.json`, `configured-control-exit.json`, `configured-control-errors.json`: synthetic-config control, not a retry-to-green.
- `exits.json`, `runner.log`, `run.py`, `run-configured-control.py`: batch plan and reproducible commands.
- `final-provenance.json`, `pristine-audit.json`, `frozen-test-diff.patch`, `asset-read-mapping.json`, `provision.py`: byte identity and exact Git input provisioning.
- `frozen-aggregate.json`, `frozen-66-failures.json`, `files.json`: immutable selected frozen evidence.

No implementation changes, baseline refresh, DB access, credential reads, subagents, or commits were performed. The deliverable is classification evidence, not a passing gate.
