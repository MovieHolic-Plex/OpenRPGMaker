# Task6 partial implementation - BLOCKED on stale file ownership

## Identity and blocker

- Task `st_01a07653`, parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree `/home/main/z-project/rpg-zzu-life-full-harvest-xp`; branch `agent/life-full-harvest-xp`.
- Entry/current HEAD `e33c93afbd1b0d8824f273c62d234d66c8802323`.
- HEAD tree `bb854c6938045c387d94ddd7f69aec02acb50868`.
- Task4 VERIFY is confirmed, mandatory fixes0; `b7b02d97` is an actual ancestor (exit0).
- Corrected Phase2 review approves scoped readiness; `d84001e8` is an actual ancestor (exit0).
- **Parent must authorize `src/player/farming.ts` instead of nonexistent `src/project/farming.ts`.** Actual `interactWithFarmPlot` and `awardInteractionXp` live in the player file. The child was explicitly told to report unexpected shared-file needs rather than editing them. That file remains byte-unchanged. The minimal missing fix is `if (project.system.skillSystem?.enabled !== true) return {};` at the start of `awardInteractionXp`.
- Task6 is NOT complete, and no final GREEN or commit is claimed. Changes remain unstaged for parent continuation; a clean committed worktree cannot honestly be delivered while the scoped acceptance suite remains red.

## Implemented within current grant

`src/project/fishing.ts` and `src/project/seasonalForage.ts` now require the existing `system.skillSystem?.enabled === true` contract before automatic XP awards. Disabled/omitted XP no longer rejects those otherwise valid transactions. No catch, explicit-API redefinition, qualification bypass, RNG change, session/save/time/maker edit, or tool/regrowth change.

New `test/lifeSkillDisabledHarvest.test.ts` invokes actual crop/rock/tree/fish/forage transaction functions. It covers real items, actual non-null plot/placeable/spot owners, retained XP99, enabled XP/rewards, switch/recipe invalid-reward rollback, full-session/RNG energy/capacity rollback, explicit award/change APIs, and both failed and earned fishing minSkill qualification. Rock/tree use actual axe/pickaxe definitions and inventory, never seeds as tools. Forage comes from real daily spawning. Existing tests and assertions were not edited.

## Commands and results

Exact command lines are in each `<name>.command.txt`, untouched combined stdout/stderr in `<name>.txt`, and actual process status in `<name>.exit.txt`. Heavy commands ran serially under `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock` with `timeout --signal=TERM --kill-after=15s`:300s for tests/diagnostics/typecheck/probe and600s for build. No dependency installs, retries of unchanged tests, timeout increases, or full13k suite.

| Receipt | Actual result |
| --- | --- |
| `red` | exit1,19 failed/30 passed. Contains real disabled-XP failures plus9 malformed crop-fixture failures (missing `stages`). Not counted as valid crop RED. |
| `corrected-red` | exit1,12 failed/37 passed, before any production edit. Crop fixture corrected to `stages:[{days:1}]`; all five reward paths reject disabled/omitted XP, plus two earned fishing qualification cases. Enabled and rollback controls pass. This is the meaningful RED. |
| `diagnostics` | exit1; production files zero diagnostics; new test has two readonly `minSkillLevel` assignment errors. Preserved, not suppressed. |
| `corrected-diagnostics` | exit0, zero syntactic/semantic TypeScript compiler-API diagnostics for farming/fishing/forage/new test. Test setup now replaces immutable fishing configuration. Run BEFORE typecheck/build. |
| `scoped-partial` | exit1;7 files,120 passed/6 failed. All six failures are the disabled/omitted crop/rock/tree cases in the unmodified farming owner. Six existing related files pass. No case skipped/deleted/weakened. |
| `partial-public` | exit0;12 independent actual public transactions for fish/forage, no transaction mocks. Full original owner, before state, result and after state in `partial-public-state.json`. |
| `typecheck` | `npm run typecheck:app`, exit0. |
| `build` | `VITE_CACHE_DIR=.omo/evidence/life-full-20260906/6/build-cache npm run build`, exit0. App/player/SDK/standalone complete. Warnings retained in full output. |

Related suite command:

```sh
npm test -- test/lifeSkillDisabledHarvest.test.ts test/p0LifeSkillProgress.test.ts test/p2LifeRuntime.test.ts test/p2HostileAudit.test.ts test/farmingRuntime.test.ts test/seasonalForage.test.ts test/p0RuntimeIntegration.test.ts --maxWorkers=2 --no-file-parallelism
```

Remaining failure output:

```text
FAIL crop automatic harvest XP > keeps the real reward when skillSystem is disabled/omitted
FAIL rock automatic harvest XP > keeps the real reward when skillSystem is disabled/omitted
FAIL tree automatic harvest XP > keeps the real reward when skillSystem is disabled/omitted
AssertionError: expected { kind: 'ignored', x: 1, y: 1, ... } to match object { kind: 'harvested', ... }
Test Files 1 failed | 6 passed (7)
Tests 6 failed | 120 passed (126)
```

## Proof boundary and outstanding verification

The standalone Vite SSR probe constructs its own minimal blank-project fixtures, imports the actual public modules, and records complete live before/after states. It independently exercises disabled/omitted/enabled XP, active invalid reward, inventory capacity, fishing energy and minSkill failures. `public-probe.mjs` supports the eventual all-five default run; the executed command explicitly selected only `fish forage` while farming ownership was blocked. `public-state.json` and the preserved `partial-public-state.json` contain that same partial run. No native player input, browser gameplay, screenshots, authored51-feature journey, or remote persistence is claimed. Task18 still owns full native journeys.

Current Phase2 full-project regression status remains unknown: the two original1200s full-Vitest timeouts and six matched existing surface failures remain disclosed in the corrected review; they were not rerun or absorbed into baselines here.

After parent corrects the file grant, the farming guard, fresh changed-file diagnostics, full related GREEN, all-five public probe, app typecheck/build and a verified scoped commit remain required. The current source/tests have not been committed as a completed task.

## Cleanup and tooling notes

`cleanup.json` records removal of only this run's generated `dist` and GNU patch `.orig` backups; no tracked/shared cache was removed. Task6 probe/build cache directories were absent at cleanup. Middleware-only Vite closed in finally, no HTTP listener or browser started, port42359 was checked before execution and remains unbound. No remote DB access, server, push, PR, merge, commit, root state, shared wiki or INDEX edits.

Initial broad environment discovery returned exit2 because optional `node_modules/.bin/tsx` is absent (the actual installed Vitest/tsc/Vite binaries exist); no installation was performed. The first new-test apply_patch had an incorrect line count and exited2 without creating a file. A correctly generated unified patch then created it. Both are tooling failures, not behavioral REDs. All product/test/evidence-code edits used `/tmp/apply_patch` (the installed wrapper around `patch -p1 --forward`).

## Exact wiki proposal (parent-serialized, after full task6 completion)

In `openwiki/runtime-sessions.md`, replace the farm XP paragraph beginning `- Farm interactions simulate` with:

> - Farm interactions simulate the full target area on a session draft, then charge `ceil(successfulTiles * energyMultiplier)`. When `system.skillSystem?.enabled === true`, they award10 XP per successful crop harvest, rock mine, or tree chop to the matching authored life skill. Disabled/omitted skill progression skips only automatic XP, without blocking valid farm, fishing, or seasonal-forage rewards. Explicit XP APIs retain their disabled failures. Enabled invalid progress or reward references still roll back the entire transaction, including inventory, energy, owners and RNG. Fishing minSkill qualification is unchanged. `system.itemUpgrades[].capability` supplies the equipped upgraded tool's centered `areaWidth` / `areaHeight` and energy multiplier; legacy/no-capability tools remain1x1 /1.0. `system.craftRecipes[].requiresUnlock:true` gates both `canCraft` and `craftRecipe` on `session.unlockedRecipeIds`.
