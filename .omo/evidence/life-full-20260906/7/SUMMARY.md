# Task 7 - zero crop yield and exact regrowth countdown

## Outcome

Implementation and scoped verification are complete. Parent verification/integration remains a separate prerequisite; no parent VERIFY is claimed here.

A successful harvest respects `harvestCount: 0`, grants no items, and still follows existing energy and automatic XP rules. Only successful regrowing harvests initialize `regrowDaysRemaining`. Living, in-season, watered growth ticks decrement it to zero; initial growth cannot shorten it. Initial and legacy plots have no inferred harvest history. Non-regrowing harvests and clearing remove the crop state normally.

The countdown controls maturity and the existing stage projection. Both persisted stage/growthDays on qualifying ticks and the overlay's stage selection use the countdown, reserving the mature graphic until zero. Longer regrowth stays at the earliest growth stage until the existing initial-growth stages can represent the remaining days. Short regrowth preserves its previous stage appearance. No arbitrary regrowth cap or second farming model was added.

The optional field is a non-negative safe integer at the existing save boundary. Invalid values are rejected by existing lossless reconciliation rather than silently dropping plots. Save5/Project4 and recovery/atomicity contracts are unchanged. `farmModel.ts` already preserves zero through `normalizeCropRecord`; tests execute that authority, so it needs no edit. `saveSlots.ts` already clones complete plots through writer/read/apply; the real remaining-seven roundtrip proves no serialization projection edit is necessary.

## Exact authority and ownership

- Confirmed handoff read before any edits: `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/ulw-execute/phase3-handoffs/task7.json`, task=7, status=confirmed.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-crop-regrowth`
- Branch: `agent/life-full-crop-regrowth`
- Verification HEAD/base: `43817f4a32610fc5f833354d0e20cf1487e50355`
- Base tree: `60897226bac516b0e440debedd32aeb39b4fc86c`
- Verified source/test index tree before adding this evidence: `86678cfc12ff0daaaa3af4e10abf40a0ad52f499`. Evidence-only additions change the eventual commit tree, not these verified source/test blobs. The containing commit is the implementation/test/evidence commit; `git show --format=fuller --stat` and `git rev-parse HEAD^{tree}` identify its final head/tree after creation.
- Required task6 ancestor `48195f5753556572db0c13e40f6945b9547bbea3`: `git merge-base --is-ancestor <commit> HEAD`, exit 0. Read `.omo/evidence/life-full-20260906/6/VERIFY.md`: confirmed, mandatory corrections 0.
- Integrated task9 ancestor `27db0af0021fb49414723b64141a0e1c568b8069`: same ancestor check, exit 0.
- Port 46557 was not used; no HTTP listener or browser was started.
- Owned edits: four source files plus `test/cropRegrowthContract.test.ts` and this evidence directory. No sibling source, wiki, INDEX, dependency, baseline, remote content, or worktree-management changes.
- Read the complete approved plan, root AGENTS, quickstart, INDEX, PROJECT_WIKI, runtime routing, relevant sessions/schema/testing/worktree sections, and TypeScript programming guidance under `/home/main/.omo/binary-runtime/0.0.0-omob.fd1d0db.bc01464/plugin/skills/programming/`. No CLAUDE.md was read.

## Verification

All heavy commands below use the required shared `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`. Focused tests, diagnostics, public execution, and app typecheck use a fixed 300-second execution budget; build uses 600 seconds. No timing retries, increased budgets, skipped tests, or baseline changes.

- Behavioral RED: 23/23 tests fail on the unmodified product, including zero-at-capacity refusal, regrowth finishing early, ignored countdown maturity, and accepted invalid countdowns. `red.txt` preserves the failures; exit 1.
- Initial GREEN: 241/241 tests in 12 files, exit 0. Added coverage for empty-inventory zero yield, automatic XP on zero yields, extra growth/cursor independence, dead watered crops, and later-day-stage rollback, without further product changes.
- Final GREEN: 248/248 tests in the same 12 files, including all 30 crop-regrowth tests, exit 0 in one run. Existing farmingRuntime, farm overlay/sprites, task6 harvest XP, explicit XP, task9 maker clock, weather day transition, Save5, recovery and session persistence cases remain intact.
- Changed-file syntactic/semantic diagnostics: all five source/test files have zero diagnostics; exit 0. The TypeScript compiler API uses the app configuration and explicitly includes the new test.
- `npm run typecheck:app`: exit 0.
- `npm run build`: exit 0. Raw output retains unresolved runtime asset references, dynamic/static import chunking notices, a circular reexport warning in the existing editor record picker, and large-chunk warnings. These were not suppressed or repaired outside scope.
- Actual public API execution: 19 recorded scenarios, exit 0. `public-probe.mjs` imports real farm/date/normalization/save authorities via Vite SSR, uses native Node 24 file-backed `Storage` (not a mock), plants/waters/advances/harvests through real transactions, and writes/reads/applies remaining seven. Each of ten watering ticks records countdown/readiness/stage. Capacity, energy and invalid enabled XP refuse both initial and regrown harvests with full cloned-state equality. Dry/duplicate-date/out-of-season/dead and later date-stage failure preserve the countdown. Malformed wire countdowns preserve raw bytes. Four zero-yield cases cover empty/full inventory and regrowing/non-regrowing crops. `public-state.json` contains the observations.
- Public evidence is not native player keyboard/gameplay evidence; native player end-to-end coverage belongs to the parent's later integration task. Renderer frame selection is exercised through the actual `renderFarmOverlays` in the focused tests, with only its graphics factory represented by a recording scene.
- Pre-evidence `git diff --check`: exit 0. Full staged evidence `git diff --cached --check`: exit 2 solely for original terminal-log whitespace (trailing spaces/blank EOF), preserved in `raw-whitespace.txt`. Raw logs are intentionally byte-preserved, not reformatted. The scoped source/test/scripts/JSON/summary whitespace check is recorded separately in `scoped-whitespace.*`. `node --check` on both public probe versions and the diagnostics script: exit 0. Exact receipts are in `cleanup.json`.

### Preserved execution failures

The first two patch attempts did not create the test: `apply_patch` was absent from PATH, and `/tmp/apply_patch` expected standard unified diffs rather than Begin/End Patch syntax. Their patch-specific exit codes were not captured; the error messages were observed in the tool transcript. Their subsequent focused test commands correctly exited 1 with no test found. Both test outputs remain as `setup-failure.*` and `setup-format-failure.*`; neither is counted as behavioral RED. Successful edits use standard unified diffs through `/tmp/apply_patch`.

The first public probe exited 1 because Node's strict comparison saw an existing null-prototype inventory dictionary versus its plain-object `structuredClone`, despite equal entries. Its complete original script/log/output are preserved in `public-prototype-failure*`. The corrected probe compares the same structured-clone representation before and after, retains every value/state assertion, and passes. No product change or test suppression was used. Node's experimental native Web Storage warning is retained.

### Exact commands and exits

**setup-failure - exit 1**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s npm test -- test/cropRegrowthContract.test.ts
```

**setup-format-failure - exit 1**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s npm test -- test/cropRegrowthContract.test.ts
```

**red - exit 1**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s npm test -- test/cropRegrowthContract.test.ts
```

**green - exit 0**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s npm test -- test/cropRegrowthContract.test.ts test/farmingRuntime.test.ts test/playSceneFarmOverlay.test.ts test/farmingSprites.test.ts test/lifeSkillDisabledHarvest.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/customSeasonSave.test.ts test/makerClockIntegration.test.ts test/p0LifeSkillProgress.test.ts test/p1DayTransitionIntegration.test.ts
```

**final-green - exit 0**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s npm test -- test/cropRegrowthContract.test.ts test/farmingRuntime.test.ts test/playSceneFarmOverlay.test.ts test/farmingSprites.test.ts test/lifeSkillDisabledHarvest.test.ts test/lifeSaveVersion.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/customSeasonSave.test.ts test/makerClockIntegration.test.ts test/p0LifeSkillProgress.test.ts test/p1DayTransitionIntegration.test.ts
```

**diagnostics - exit 0**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s node .omo/evidence/life-full-20260906/7/diagnostics.mjs
```

**typecheck - exit 0**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s npm run typecheck:app
```

**build - exit 0**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 600s npm run build
```

**public-prototype-failure - exit 1**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s node --experimental-webstorage --localstorage-file=.omo/evidence/life-full-20260906/7/native-storage .omo/evidence/life-full-20260906/7/public-probe.mjs
```

**public - exit 0**

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout 300s node --experimental-webstorage --localstorage-file=.omo/evidence/life-full-20260906/7/native-storage .omo/evidence/life-full-20260906/7/public-probe.mjs
```

## Focused wiki proposal (parent-serialized; not applied here)

Insert the following subsection in `openwiki/runtime-sessions.md` immediately before `## Session state & life-sim`:

```markdown
## Exact crop regrowth and zero yields (2026-09-06)

A crop harvest with `harvestCount: 0` succeeds with zero items and retains the normal energy and automatic-XP transaction rules. `FarmPlotState.regrowDaysRemaining?: number` is absent until a successful regrowing harvest. Only living, in-season, watered growth ticks decrement it; zero means ready regardless of initial growthDays/stage. Initial growth and old plots retain their previous behavior without inferred harvest history. Refused harvests never initialize or reset the countdown. Clearing and non-regrowing harvests remove it with the crop.

The existing growth stages project `max(0, totalInitialGrowthDays - regrowDaysRemaining)`, so a growth2/regrow10 crop matures only on its tenth qualifying tick. `cropStageForPlot` supplies the same countdown-derived stage to `renderFarmOverlays`; the final graphic remains reserved for maturity. Save writer/read/apply preserve remaining seven exactly, with no inferred regrowth on legacy plots. The existing extra-growth command and calendar cursor semantics are unchanged. Regression: `test/cropRegrowthContract.test.ts` plus the farming, save, XP and day-transition suites.
```

Insert the following paragraph in `openwiki/runtime-project-schema.md` under `## Life ownership in Save5`, after its existing paragraphs:

```markdown
Farm plots optionally retain `regrowDaysRemaining` as a non-negative safe integer. The existing lossless plot validation rejects malformed countdowns without trimming plots or rewriting saved bytes. Zero is retained as a ready regrowing crop; omission preserves legacy initial-growth behavior, never an inferred prior harvest. The writer, Storage reader and apply path retain the complete plot record. Save5 keys and Project4 are unchanged; see `test/cropRegrowthContract.test.ts` for remaining-seven roundtrip and malformed-value refusal.
```

Parent should regenerate INDEX with the unchanged `npm run openwiki:index`, then run `npm run openwiki:index -- --check` and `npm run openwiki:verify`. These shared-document commands were not run here because no shared documents were edited.

## Cleanup and delivery

`cleanup.json` records removal of only this task's generated `dist` and native Storage file. The task's Vite SSR server closed in `finally`; its configured probe-cache path is absent. The parent-created `.vite-cache` and shared node_modules/cache remain untouched. No HTTP server, browser, remote write, push, PR, merge, amend, or new worktree was performed.

`verification-manifest.json` records exact source/test git blob IDs, source/test tree, every command exit, predecessor ancestor checks, and SHA-256 hashes of raw evidence. All verified owned code/tests/evidence are delivered in the containing scoped commit. Final commit HEAD/tree and clean status are reported after commit creation; parent verification is separate.
