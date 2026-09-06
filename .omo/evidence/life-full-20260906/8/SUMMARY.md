# Task8 - authored tool-rule parity

Task8's assigned editor, resolver and farming changes are implemented and verified. This summary and the owned source/tests/evidence are delivered together in the containing commit. Parent verification/integration is separate; this is not a task10 or native-player completion claim.

## Authority and immutable inputs

- Worktree: `/home/main/z-project/rpg-zzu-life-full-tools`.
- Branch: `agent/life-full-tools`.
- Base HEAD, checked before edits: `675a3b2fd0952143ec8887b1b204789ec0dfe035`; initial worktree clean.
- Read the confirmed handoff before editing. Its exact copy is `handoff.json`: task=8, status=confirmed, port=35209.
- `git merge-base --is-ancestor <commit> HEAD` returned 0 for task7 `9cb85be84746d84789497a1d4297d0c8416d86c8`, task6 `48195f5753556572db0c13e40f6945b9547bbea3`, and task9 `27db0af0021fb49414723b64141a0e1c568b8069`. Their checked-in VERIFY records say confirmed / mandatory corrections 0. Task7's full required VERIFY was read before editing.
- Read the approved plan, AGENTS, quickstart, wiki INDEX/ownership and focused editor/runtime/testing guidance, and the installed TypeScript skill reference. CLAUDE.md was not read.
- Source/test SHA256 and git blob IDs are in `source-manifest.json`. The staged verification tree before this summary and final accounting files was `528e21ed500ad2f781826b0a8b6102bee5782291`. The containing commit's final HEAD/tree are reported by the child delivery; no self-referential commit hash is fabricated here.

## Implementation

1. First custom-table creation copies the four actual defaults and prepends the new row as one undoable edit. Existing nonempty tables remain ordered complete replacements; subsequent adds append without merging. New rows do not accidentally bind the first item in the database.
2. Item ID retains precedence over a contradictory kind within a rule. Matching rules retain their order. Empty conditions match held/inventory valid non-consumable farm tools, never seeds, consumables, unknown items or a different item behind an occupied hand.
3. The editor and resolver share the effective farmable default. Checkbox edits retain explicit false. Project serialization/normalization already preserves that boolean, so no sibling load/save boundary needed editing.
4. Integer bounds, terrain and static occupancy remain mandatory. Region-free till/water/harvest works only on safe cells; chest, building, nonblocking decoration, unrelated placeable and overlapping-target refusal preserve state. Wide-tool cells are filtered for safety and energy refusal remains atomic. Seeds still require a farmable planting region.
5. Held tools consume authored per-tile till/water/harvest actions, while materialized defaults retain the hoe's legacy no-auto-plant behavior. Authored harvest rules authorize mature-crop harvesting; absent harvest rules retain legacy harvesting. Task6 XP and task7 regrowth/zero-yield logic remain unchanged.

Only three production files and two test files changed, plus this evidence directory. No fishing/forage input routing, housing, clock, session/save schema, shared wiki, INDEX, dependencies or remote content was edited.

## Verification commands and exits

All heavy checks run in this worktree through `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`. Focused tests, diagnostics, typecheck and browser/public probes have fixed `timeout 300s`; build has fixed `timeout 600s`. `check.mjs` records actual child exits, command arrays, cwd and HEAD in each named JSON receipt, with raw stdout/stderr in the matching TXT. No timing retry loops, sleeps, polling waits, timeout increases, skipped tests or baseline changes were introduced.

| Check | Command after flock/timeout | Exit and evidence |
| --- | --- | --- |
| Initial RED | `npm test -- test/toolActionAuthoringParity.test.ts test/databaseLifeCraftingView.test.ts` | 1, `red.txt`: 13 failures, including two diagnosed fixture-reference mistakes |
| Corrected-fixture RED | `npm test -- test/toolActionAuthoringParity.test.ts` | 1, `red-corrected-fixture.txt`: 21 failures / 31 cases before production edits |
| Held-intent RED | same focused command | 1, `red-hand-intent.txt`: materialized hoe auto-planted; fixed at per-tile action resolution |
| Overlap RED | same focused command | 1, `red-overlap.txt`: two tree/rock-over-chest failures; fixed without exempting other assets |
| Final related suite | command below | 0, `green-final.{json,txt}`: 269 tests in 15 files; 44 task8 parity cases |
| Changed-file diagnostics | `node .omo/evidence/life-full-20260906/8/diagnostics.mjs` | 0, `diagnostics-final.{json,txt}`: syntactic/semantic diagnostics empty for all five changed TS files; executed before typecheck/build |
| App typecheck | `npm run typecheck:app` | 0, `typecheck.{json,txt}` |
| Native editor | `node .omo/evidence/life-full-20260906/8/editor.mjs` | 0, `editor-ready-final.{json,txt}` and `editor-state.json` |
| Full build | `npm run build` with `VITE_CACHE_DIR=/home/main/z-project/rpg-zzu-life-full-tools/.vite-cache/task8-build` | 0, `build.{json,txt}`; app, export-player, SDK and standalone bundle |
| Actual public modules | `node .omo/evidence/life-full-20260906/8/public.mjs` | 0, `public.{json,txt}`, `public-state.json` |
| Evidence script syntax | `node --check` on editor.mjs, public.mjs, check.mjs and diagnostics.mjs | all 0 |
| Source/scripts/docs/JSON whitespace | scoped `git diff --cached --check` | 0 |
| Raw captured output whitespace | unfiltered `git diff --cached --check` | 2, `raw-whitespace.txt`; terminal color/diff output and Vite reporter whitespace preserved verbatim, not cleaned to hide the result |

Final related suite:

```sh
npm test -- test/toolActionAuthoringParity.test.ts test/databaseLifeCraftingView.test.ts test/farmingRuntime.test.ts test/stardewAuthoringTools.test.ts test/p0ToolCapability.test.ts test/cropRegrowthContract.test.ts test/lifeSkillDisabledHarvest.test.ts test/serializeCompact.test.ts test/p0ProjectSchema.test.ts test/toolsLifeEconomy.test.ts test/p0SessionPersistence.test.ts test/p2SessionPersistence.test.ts test/p2LifeRuntime.test.ts test/lifeAuthoringReferences.test.ts test/makerClockIntegration.test.ts
```

## Browser and module proof boundaries

- An owned explicit Vite server awaited `listen()` on 127.0.0.1:35209, rooted in this worktree with an exclusive cache. The real editor shell used `?blankProject=1`; remote persistence was observed false and no Supabase write request occurred. This is a minimal code-test fixture, not delivered game content or proof of remote saving.
- Native Firefox controls: keyboard add; Ctrl+Z/Y creation; Space checkbox false; Ctrl+Z/Y checkbox; keyboard End selects harvest; serialization to a fixture-owned local Storage key, deserialize/store replacement and displayed false; another add appends without default merging. Exact store subscriptions are installed before mutations. Boot uses the actual `perf-metrics-json.initialEditRenderMs` completion signal, not an early toolbar mount.
- Existing group headers are pointer-only divs. Navigation into the Life group used its real pointer control; the authored controls and undo/redo used native keyboard input. No sibling navigation redesign was attempted.
- `editor-1440.png` and `editor-1024.png` capture the actual surface; `editor-state.json` includes the displayed precedence explanation and measured card bounds. This model could not decode images (the read tool explicitly reported that limitation), so screenshots are supplied for parent visual review; no pixel-level visual approval is claimed.
- Public-module evidence imports actual authorities, executes till/plant/water/growth/harvest, checks wrong-hand rollback, executes chop/mine, Project4 false roundtrip and occupancy refusal, and checks fish resolver eligibility/refusal. No native player gameplay is claimed.
- Fish **input/catch wiring belongs to task10**, per the approved plan's task8 boundary. This commit verifies and supplies its shared resolver behavior only; `attemptFishingCatch` and the native action router remain untouched. Live-body placement safety belongs to task12; this change reuses existing static placement authority rather than editing those sibling owners.

## Preserved failures and limits

- `apply_patch` was not on PATH. The first shell attempt made no edits and inadvertently ran only the existing database test (exit0); `setup-no-patch.*` is retained and is explicitly not RED evidence. All actual patches used the installed `/home/main/.codex/tmp/arg0/codex-arg0EjygCZ/apply_patch`.
- Initial fixture removal of animal events broke references; events were retained. The first GREEN attempt then exposed fixture consumable defaults and a demo rug at the intended empty tile. Fixtures now explicitly define non-consumable tools and remove unrelated starting placements; tests still prove real occupied tiles refuse. `green-attempt1.*` retains all seven failures. No refusal assertions were weakened.
- Initial diagnostics found the fixture's invalid item type `normal`; corrected to the existing `normalGoods` union value. Both diagnostic outputs are retained.
- Browser setup failures are retained: pointer-only group incorrectly driven as a keyboard button; early boot blank timeout; Chromium `ERR_NETWORK_CHANGED` with failed dynamic imports (documented host network-interface issue); a probe mistakenly reading Project `schemaVersion` instead of `version`; and interacting with an early toolbar that boot subsequently replaced. Corrections were explicit harness/environment changes, not timing retries. The successful run used installed Firefox and the true editor-ready mutation signal, with unchanged timeouts. The first editor receipt filename collided with the command-receipt filename; its log and PNG remain, while later state receipts use distinct filenames.
- Successful editor run has no page errors. Raw console warnings remain: optional local assistant bridge CORS, Firefox WebGL fallback to Canvas, existing unreachable-code warning, and expected offline fixture autosave messages. Local Storage/ProjectIO roundtrip is not online-save success.
- Build warnings about unresolved generated starter assets, mixed dynamic/static imports and large chunks are retained in `build.txt`.
- Full-project gates were not claimed or rerun by this scoped child. Inherited Phase2 full-suite/gate limits and parent integration verification remain separate.

## Wiki, cleanup and delivery

### Task12 caller dependency (parent midpoint inspection)

`interactWithFarmPlotSingle` in `src/player/farming.ts` now calls `canOccupySpatialFootprint` before operating on the target plot. The current `src/project/spatialOccupancy.ts` implementation deliberately does not inspect `session.farmPlots`. When task12 adds farm-plot occupancy to prevent spatial placement over crops, it must preserve farming access to its own current plot; otherwise valid water/harvest actions would reject themselves as occupied. Task12 should verify both placement-over-plot refusal and continued farming water/harvest access. The parent will carry this actual caller constraint into task12. This note asserts no current failure or new mandatory task8 fix, and no task12 implementation is included here.

`wiki-proposal.md` supplies exact focused additions for editor-database/runtime-sessions/testing and parent INDEX regeneration. Shared wiki and INDEX remain untouched.

`cleanup.json` records closed browsers and server receipts, port35209 no listener, removed owned dist (1,981 files / 244,569,348 bytes) and three newly created edit-activity files, and absent/removed exclusive probe caches. Original `.vite-cache/deps`, node_modules symlink, shared caches and `.env.local` were preserved. No process or worktree belonging to another task was stopped or removed.

Owned changes are committed without push, PR, merge, amend or remote writes. The child delivery reports the actual commit/tree and verifies a clean worktree after committing. Parent verification is the next node's prerequisite, not something this implementation substitutes for.
