# Task6 complete: disabled automatic XP no longer blocks harvesting

## Outcome and identity

Crop, rock, tree, fish and seasonal-forage rewards succeed when skill progression is disabled or omitted. Automatic XP alone is skipped. Explicit XP APIs, enabled invalid-reward rollback, energy/capacity refusal and fishing minSkill qualification retain their existing contracts.

- Task `st_01a07653`; parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree `/home/main/z-project/rpg-zzu-life-full-harvest-xp`; branch `agent/life-full-harvest-xp`.
- Base HEAD `e33c93afbd1b0d8824f273c62d234d66c8802323`; base tree `bb854c6938045c387d94ddd7f69aec02acb50868`.
- **Verified implementation commit `48195f5753556572db0c13e40f6945b9547bbea3`**, tree `4e3da6ec2b8811d24fb1f13ef5d1d92429aa5678`.
- Commit command (exit0): `git commit -m "fix(life): keep harvesting independent of disabled skill xp"`. Only the three source files and new test were staged in this increment. This evidence-only follow-up records that actual committed HEAD/tree; it does not modify verified code.
- Task4 VERIFY confirms zero mandatory fixes; `b7b02d97` is an actual ancestor (exit0). Corrected Phase2 review approves scoped readiness; `d84001e8` is an actual ancestor (exit0).
- **Path correction:** initial dispatch allowed nonexistent `src/project/farming.ts`. Parent explicitly authorized actual owner `src/player/farming.ts` in its place before the farming edit. This was the originally intended task6 boundary, not expanded scope. The initial blocked summary is preserved as `PARTIAL-SUMMARY.md`; all partial RED/results remain intact.

## Scoped implementation

- `src/player/farming.ts`: `awardInteractionXp` returns an empty award receipt when `system.skillSystem?.enabled !== true`.
- `src/project/fishing.ts` and `src/project/seasonalForage.ts`: automatic XP calls require that same existing enablement contract.
- `src/project/lifeSkillProgress.ts` is unchanged. No catch, explicit-API redefinition, qualification bypass, session/save/time/maker edit, or tool/regrowth change.
- `test/lifeSkillDisabledHarvest.test.ts`:49 deterministic tests invoke the actual public crop/rock/tree/fish/forage transactions. Existing tests/assertions are unchanged. No sleeps, polling, skips, timers or transaction mocks.

Tests use real item drops, non-null plot/placeable/spot owners, retained XP99, enabled XP level transitions, switch/recipe invalid-reward rollback, full-session/RNG energy/capacity rollback, explicit award/change API disabled errors, and failed/earned fishing minSkill qualification. Rock/tree use actual axe/pickaxe definitions and owned inventory, never seeds as tools. Forage is generated through `advanceSeasonalForage` rather than a reimplemented success body. Seasonal-forage collection has no energy cost; energy refusal covers the four actual energy-consuming paths.

## Final verification

All heavy commands ran serially under `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, using `timeout --signal=TERM --kill-after=15s`:300s for diagnostics/tests/probe/typecheck and600s for build. Each exact invocation is in `<name>.command.txt`, full unmodified stdout/stderr in `<name>.txt`, actual exit in `<name>.exit.txt`. Final tests ran once after the farming correction. No timeout increases, retry-to-green, dependency installs or full13k-suite run.

| Receipt | Actual final result |
| --- | --- |
| `final-diagnostics` | exit0; zero TypeScript compiler-API syntactic/semantic diagnostics for all three changed source files and the new test. Executed BEFORE final typecheck/build. |
| `green` | exit0;7 files /126 passed /0 failed /0 skipped, including all49 new regression tests. |
| `final-public` | exit0;30 independently constructed public transactions spanning all five rewards.15 full-state-equal refusal records; all30 actual owners non-null. |
| `final-typecheck` | `npm run typecheck:app`, exit0. |
| `final-build` | `VITE_CACHE_DIR=.omo/evidence/life-full-20260906/6/build-cache npm run build`, exit0; app/player/SDK/standalone complete. Mixed static/dynamic imports, unresolved-at-build runtime assets and large-chunk warnings remain visible. |
| scoped Git checks | `git diff --check`, `git diff --cached --check` for production/test commit, and protected session/XP API/wiki/baseline comparisons: exit0. |

Exact related suite:

```sh
npm test -- test/lifeSkillDisabledHarvest.test.ts test/p0LifeSkillProgress.test.ts test/p2LifeRuntime.test.ts test/p2HostileAudit.test.ts test/farmingRuntime.test.ts test/seasonalForage.test.ts test/p0RuntimeIntegration.test.ts --maxWorkers=2 --no-file-parallelism
```

Final passing output:

```text
Test Files 7 passed (7)
Tests 126 passed (126)
Duration 25.59s
```

## Preserved failure chronology

| Historical receipt | Actual result and classification |
| --- | --- |
| `red` | exit1;19 failed/30 passed. Real disabled-XP failures plus9 malformed crop-fixture failures (missing `stages`). Not credited as valid crop RED. |
| `corrected-red` | exit1;12 failed/37 passed BEFORE any production edit. Crop fixture corrected to `stages:[{days:1}]`; disabled/omitted settings reject all five rewards plus two earned fishing cases. Enabled and rollback controls pass. This is the meaningful RED. |
| `diagnostics` | exit1; two readonly `minSkillLevel` assignment errors in the new test, zero production diagnostics. |
| `corrected-diagnostics` | exit0 after replacing immutable fishing configuration in fixture setup; no suppressed errors. |
| `scoped-partial` | exit1;120 passed/6 failed. Only disabled/omitted crop/rock/tree still fail while farming ownership is blocked. Those six assertions remain unchanged and pass in final GREEN. |
| `partial-public` | exit0;12 fish/forage public transactions. Entire original state output preserved in `partial-public-state.json`. |
| `typecheck`, `build` | exit0 on the partial fishing/forage revision, not substituted for final runs. |

Representative original failure (complete original text in corrected-red.txt):

```text
AssertionError: expected { kind: 'ignored', x: 1, y: 1, ... } to match object { kind: 'harvested', ... }
AssertionError: expected { ok: false, reason: 'xp' } to match object { ok: true, itemId: 'item_trout' }
Test Files 1 failed (1)
Tests 12 failed | 37 passed (49)
```

## Public proof versus native gameplay

`public-probe.mjs` builds independent minimal blank-project fixtures rather than importing the test fixture. It imports actual `interactWithFarmPlot`, `attemptFishingCatch`, `advanceSeasonalForage` and `collectForageAt` via middleware-only Vite. Final invocation has no selector arguments and executes all five domains. `public-state.json` contains full owner/before/result/after records for30 transactions: disabled, omitted, enabled, invalid reward and capacity for all five; energy for crop/rock/tree/fish; minSkill refusal for fish. Full-state equality covers RNG and all other session fields on failure, not only the affected inventory or XP.

This is public-module/entrypoint execution, **not native player input or browser gameplay**. No browser, screenshot, authored51-feature journey, save/resume journey or remote persistence is claimed. Task18 still owns the full native journeys. Current whole-project regression status remains unknown: Phase2's two original1200s full-Vitest timeouts and six matched existing surface failures remain disclosed and were not rerun, hidden or absorbed into baselines.

## Cleanup and scope audit

`final-cleanup.json` records removal of only this resumed run's generated `dist`, absent owned probe/build caches, port42359 unbound and zero tracked changes after the implementation commit. Prior cleanup is retained in `cleanup.json`. Middleware-only Vite closes in finally; no HTTP server/browser/context was started. No shared/tracked cache was removed. No remote DB/content write, push, PR, merge, amend, dependency, root state, shared wiki or INDEX change. The final evidence commit stages only `.omo/evidence/life-full-20260906/6/`.

Tooling failures remain distinguished from RED: broad initial environment discovery exit2 included absent optional tsx (installed Vitest/tsc/Vite were used); the first malformed new-file patch exited2 without creating a file. All source/test/evidence-code changes used `/tmp/apply_patch`. `verification-manifest.json` records verified source hashes and every receipt hash/size; evidence is not regenerated from assertions or success-only prints.

Evidence-only `git diff --cached --check` returned exit2 for preserved tool-output whitespace (Vite reporter trailing spaces and test/typecheck blank EOF lines). Production/test diff checks passed. Raw logs are intentionally retained byte-for-byte rather than stripped or the check suppressed; this is not a typecheck, test or build failure.

## Exact wiki update proposal (parent-serialized)

In `openwiki/runtime-sessions.md`, replace the paragraph beginning `- Farm interactions simulate` with:

> - Farm interactions simulate the full target area on a session draft, then charge `ceil(successfulTiles * energyMultiplier)`. When `system.skillSystem?.enabled === true`, they award 10 XP per successful crop harvest, rock mine, or tree chop to the matching authored life skill. Disabled/omitted skill progression skips only automatic XP, without blocking valid farm, fishing, or seasonal-forage rewards. Explicit XP APIs retain their disabled failures. Enabled invalid progress or reward references still roll back the entire transaction, including inventory, energy, owners and RNG. Fishing minSkill qualification is unchanged. `system.itemUpgrades[].capability` supplies the equipped upgraded tool's centered `areaWidth` / `areaHeight` and energy multiplier; legacy/no-capability tools remain 1x1 / 1.0. `system.craftRecipes[].requiresUnlock:true` gates both `canCraft` and `craftRecipe` on `session.unlockedRecipeIds`.

## Parent lossless raw-log packaging

Eight tool-output files with trailing whitespace or terminal blank lines are
stored byte-for-byte in `raw-log-archive.json`. Original path, byte length,
SHA256 and Git blob identity are recorded for every entry. Paths in the
historical summaries and `verification-manifest.json` refer to these original
outputs; decode the matching entry before checking its bytes. No failure,
warning, assertion, or output byte was rewritten. The source scripts are
historical producers, not a reason to overwrite these archived results.
