# PR #614 snapshot integration (2026-09-06)

## Scope and result

- Task: `st_01a07552`; assigned locked tree: `/home/main/z-project/rpg-zzu-all-pr-event-614`.
- First parent: `1d89d74d3f84bda42863bd1a88809740cc9267dd`.
- PR head / second parent: `78d2631dd7b7c0425b6ec2a2864598d32a2c5bc0`.
- The current user explicitly authorized merging incomplete/Draft snapshots now. This supersedes the historical approval/phase holds in `PLAN.md` and `INTEGRATION_NOTES.md`; those remain historical producer records, not current merge blockers.
- Read the complete production/test/script/documentation diff and parsed the complete audit manifest. All 110 recorded source hashes match its declared baseline `32ef1bcd`, not the merged tree.
- Three-way merge completed without textual conflicts. The only production file changed on both branches is `src/project/types/events.ts`: keep the current `ActorEquipmentSlot = string` contract and add the PR's draft-write metadata independently.
- No extra production fixes: focused verification found no integration regressions. Imported behavior covers page-local command history/selection/batch clipboard, popup ownership, linked authored-write staging, and exact validation navigation.
- Corrected the imported wiki's stale claim that validator projection was still awaiting integration and its missing contract-document link. Regenerated `openwiki/INDEX.md`, including already-stale baseline coordinates.
- Current player/runtime, house-protection tools/guards, System UI, styles, monster UI and battle-command studio source files are unchanged relative to the first parent. Shared common/troop command-list behavior is covered by focused tests.
- No push, PR comment, DB write, full build, full gate or browser execution. Final build/gates/browser acceptance belong to the parent.

## Verification

`npm run typecheck:app`: **exit 0** (`tsc --noEmit -p tsconfig.app.json`).

Focused tests ran once against the integrated tree:

```sh
npm test -- \
  test/eventCommandInteractionContract.test.ts \
  test/eventCommandSharedHostContract.test.ts \
  test/eventDraftProjectionIntegration.test.ts \
  test/eventDraftTransactions.test.ts \
  test/eventDraftValidator.test.ts \
  test/eventValidationFakeNavigation.test.ts \
  test/eventValidationNavigationContract.test.ts \
  test/pageConditionValidationTargets.test.ts \
  test/storeEventDraftPreserve.test.ts \
  test/fieldMonsterTemplate.test.ts \
  test/eventDrafts.test.ts \
  test/eventDraftVault.test.ts \
  test/eventDraftVaultPersistDebounce.test.ts \
  test/eventCommandDeleteSafety.test.ts \
  test/eventCommandHistoryDrag.test.ts \
  test/eventCommandReorder.test.ts \
  test/eventEditorValidationBell.test.ts \
  test/eventEditorModal.test.ts \
  test/eventEditorTrustLoop.test.ts \
  test/databaseCommonEventCommandListAdapter.test.ts \
  test/pageConditionAuthoringIntegrity.test.ts \
  test/pageConditionsGuarantee.test.ts \
  test/databaseBattleCommandStudio.test.ts \
  test/databaseBattleCommandCatalogIds.test.ts \
  test/databaseBattleCommandDuplicateRows.test.ts \
  test/databaseBattleCommandStaleClass.test.ts \
  --maxWorkers=2
```

Result: **exit 1; 25 files passed / 1 failed; 269 tests passed / 4 failed (273 total)**. All imported new/changed test files passed. No assertion was skipped or weakened.

The failed file is `test/eventEditorTrustLoop.test.ts`. An isolated `git archive 1d89d74d` baseline inside the assigned tree ran `npm test -- test/eventEditorTrustLoop.test.ts --maxWorkers=2`: **exit 1; 41 passed / the same 4 failed**. Machine comparison confirmed identical test names and first error lines:

| Test | Exact error |
| --- | --- |
| routes quick command 'command-add-show-animation' to the active page | `ReferenceError: window is not defined` |
| navigates fatal event-position and schedule issues to editable controls | `AssertionError: expected <span tabindex="-1"></span> to be null // Object.is equality` |
| restores focus to the parent editor when a subdialog opener rerenders away | `ReferenceError: KeyboardEvent is not defined` |
| restores focus, caret, open details, and scroll across reactive rerenders | `Error: expected event editor interaction surfaces` |

Local full output: `.omo/pr614-typecheck.log`, `.omo/pr614-tests.log`, `.omo/pr614-baseline-trustloop.log` (session-local, not shipped evidence). The old trust-loop file also retains a pre-existing zero-delay wait and prose assertions; it is unchanged, not represented as newly deterministic coverage.

Per-file LSP checks reported no errors for changed source/tests/scripts except two fresh-diagnostics timeouts: `src/project/types/events.ts` and `test/eventCommandSharedHostContract.test.ts`. The former is covered by passing app typecheck; the latter's four runtime tests passed. Directory LSP probes were capped at 50 files and exposed unrelated baseline test typing errors (`authMode`, farm capacity union narrowing, removed `getChatDock`, condition indexing and unknown bridge values); they are not treated as a clean full-repository typecheck.

`node --check` passed for both imported QA scripts, the transaction QA script and `verify-manifest.mjs`. Browser scripts were not executed. `git diff --check` passed.

## Snapshot limitations and parent QA

- Missing parameter forms for `changeLifeSkillExp`, `spawnFieldEnemy` and `despawnFieldEnemy` remain deliberately unfinished. Parameterless `openSaveMenu` is not the same defect.
- Historical Phase 2 shop serialization / malformed-load findings and Phase 3 picker/preview candidates remain audit findings, not a claim of current-tree failure or repair. This merge does not broaden into them or revert current IO/runtime fixes.
- `manifest.json` and its strict validator describe the older baseline. The merged tree adds `pageConditionLayout.ts` and changes recorded source hashes, so running that historical validator against the merged tree is not a valid current inventory PASS. Initial/final audit classifications were not relabeled without new evidence.
- Imported browser scripts have fixed historical ports (controls `19842`, validation `40853`, transactions `33675`); do not blindly reuse another tree's server. Parent QA must use its own explicit port, frozen final source and actual store identity.
- Useful selectors: `event-editor-modal`, `event-editor-apply`, `event-editor-cancel`, `event-character-display-name-input`, `evt-rail-meta-npc`, `event-command-toolbar-undo`, `event-command-toolbar-redo`, `event-command-toolbar-cut`, `event-command-empty-line`, `event-command-context-menu`, `event-draft-validation-summary`, `event-draft-validation-issue-*`, `event-editor-inspector`, `event-view-toggle-{list,storyboard,preview,flow}`, `field-monster-template-clear-switch`, `field-monster-template-apply`.
- Exercise real Ctrl/Cmd+K insertion then local undo; select-all/cut/paste with nested branches and one undo; native text undo; page-switch selection reset; context-menu and bell Escape ownership; cross-page validation from every view with search clearing; staged name/switch Apply versus Cancel; common/troop batch operations.
- Exact navigation targets include `.cmd-list [data-cmd-path="[0,-5,0]"] > .cmd-head`, `event-page-switch2-condition-picker-open`, `event-page-advanced-condition-item-0-1-0-picker-open`, and `[data-custom-select-for="event-page-season-condition-input"]`.

## Changed paths relative to first parent

```text
.omo/evidence/wish-event-audit/CLASSIFICATION.md
.omo/evidence/wish-event-audit/INTEGRATION_NOTES.md
.omo/evidence/wish-event-audit/PLAN.md
.omo/evidence/wish-event-audit/PR614_MERGE.md
.omo/evidence/wish-event-audit/manifest.json
.omo/evidence/wish-event-audit/verify-manifest.mjs
openwiki/INDEX.md
openwiki/editor-event-authoring.md
scripts/qa/wish-event-controls.mjs
scripts/qa/wish-event-validation.mjs
src/editor/eventDraftActions.ts
src/editor/eventDraftValidator.ts
src/editor/eventPages.ts
src/editor/panels/databaseCommandListAdapter.ts
src/editor/panels/eventEditor/commandClipboard.ts
src/editor/panels/eventEditor/commandInspector.ts
src/editor/panels/eventEditor/commandList.ts
src/editor/panels/eventEditor/commandListContextMenu.ts
src/editor/panels/eventEditor/commandToolbarHistory.ts
src/editor/panels/eventEditor/content.ts
src/editor/panels/eventEditor/fieldMonsterTemplateDialog.ts
src/editor/panels/eventEditor/memoryOpeningTemplate.ts
src/editor/panels/eventEditor/modal.ts
src/editor/panels/eventEditor/pageConditionLayout.ts
src/editor/panels/eventEditor/pageConditionModel.ts
src/editor/panels/eventEditor/pageProps.ts
src/editor/panels/eventEditor/types.ts
src/editor/panels/eventEditor/validationBell.ts
src/project/eventDraftAuthored.ts
src/project/eventDrafts.ts
src/project/types/events.ts
test/e2e/event-draft-transactions.qa.mjs
test/eventCommandInteractionContract.test.ts
test/eventCommandSharedHostContract.test.ts
test/eventDraftProjectionIntegration.test.ts
test/eventDraftTransactions.test.ts
test/eventDraftValidator.test.ts
test/eventValidationFakeNavigation.test.ts
test/eventValidationNavigationContract.test.ts
test/fakeDom.ts
test/fieldMonsterTemplate.test.ts
test/pageConditionValidationTargets.test.ts
test/storeEventDraftPreserve.test.ts
```
