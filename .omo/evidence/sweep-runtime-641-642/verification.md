# PR641 + PR642 local merge candidate

Task: st_01a07614. Assigned tree: `/home/main/z-project/rpg-zzu-sweep-runtime-641-642`.

## Inputs and integration

- Base: `647b000e`.
- PR641 snapshot: `f24dca425b490d5a0d75fa4acdec4b740d3dae7d`.
- PR642 snapshot: `88f2116d2994d5d34aeb074cccda99758df6f2ea`.
- First verified merge: `ef9b6ff2` (PR641). Both merges were clean: no textual conflicts or manual resolutions.
- No additional production-code fixes were necessary in the tested seams. Existing snapshot tests cover actual promotion lineage, qualified requirements, reset protection, permanent versus reversible skills, battle authority, save parsing/restoration, and custom equipment slots.
- PR642 changes no growth, save, equipment-rule, or battle implementation after the PR641 verification. Its production changes are the shop DOM/parts and shop CSS.
- Base-to-candidate diff checks confirmed no changes to `src/project/equipmentSlots.ts`, `src/styles/runtime/battle`, `src/styles/runtime/battle-skins`, `src/player/player.ts`, or `src/project/shopPrice.ts`.
- Known out-of-scope issues remain: quantity limits can stay stale after transactions; equipment default-price lookup can fall back to zero because it consults the item catalog. Explicit stock prices remain the safe QA fixture path. Neither issue is claimed fixed.

## Executed validation

Every test command below was run once, with a 180-second process bound and `--maxWorkers=2`. Batches ran sequentially. No test failures, skips, or weakened assertions were introduced. Total: **46 test files, 550 tests passed**.

`npm run typecheck:app` passed both after PR641 and on the combined candidate. `git diff --cached --check` passed. LSP diagnostics could not run: Biome is not installed. No dependency was installed to alter the environment.

Logs remain in this assigned tree under `output/evidence/sweep-runtime-641-642/` (gitignored):

- `typecheck-growth.log`: exit 0.
- `growth.log`: 7 files, 150 tests, exit 0.
- `boundaries.log`: 12 files, 206 tests, exit 0.
- `studio-save.log`: 8 files, 56 tests, exit 0.
- `typecheck-combined.log`: exit 0.
- `shop.log`: 11 files, 76 tests, exit 0.
- `runtime-save.log`: 8 files, 62 tests, exit 0.

Exact test batches, from the assigned tree:

```bash
timeout 180 npm test -- test/growthTrees.test.ts test/growthIntegrated.test.ts test/growthIntegratedBoundaries.test.ts test/growthIntegratedFixes.test.ts test/growthConnectedPresets.test.ts test/growthPresets.test.ts test/phase8aGrowthRuntime.test.ts --maxWorkers=2

timeout 180 npm test -- test/customEquipmentSlots.test.ts test/playerEquipmentRules.test.ts test/battleRewardsToSession.test.ts test/battleLevelUp.test.ts test/battleSessionLevel.test.ts test/battleEventsExhaustive.test.ts test/battleActiveSlotsEvents.test.ts test/battleCommandCss.test.ts test/playerCinematics.test.ts test/cinematicSettings.test.ts test/playerSaveSlotLoadGuard.test.ts test/playerSaveSlotLegacyFace.test.ts --maxWorkers=2

timeout 180 npm test -- test/growthIntegratedStudio.test.ts test/growthConnectedStudio.test.ts test/growthPresetStudio.test.ts test/growthTreeArtSurfaces.test.ts test/saveAndReferences.test.ts test/autosave.test.ts test/saveSkipLocation.test.ts test/screenSaveRestore.test.ts --maxWorkers=2

timeout 180 npm test -- test/shopRuntimeUx.test.ts test/shopFeedbackJuice.test.ts test/shopMerchantGold.test.ts test/shopProcessingCommand.test.ts test/shopHaggleRuntime.test.ts test/shopPrice.test.ts test/shopEconomyValidationAndKey.test.ts test/shopkeeper.test.ts test/playerInputCss.test.ts test/runtimeDomTitleGuard.test.ts test/equipmentCatalogRuntimeAxes.test.ts --maxWorkers=2

timeout 180 npm test -- test/battleRuntime.test.ts test/battleRuntimeDb.test.ts test/actionCombatMath.test.ts test/actionCombatMpCost.test.ts test/actionSkillSlots.test.ts test/p0SessionPersistence.test.ts test/p1SessionPersistence.test.ts test/p2SessionPersistence.test.ts --maxWorkers=2
```

The first three batches ran before the shop-only merge; the last two and combined app typecheck ran after it. Source equality was checked for the previously tested growth/save/battle implementations after PR642.

## Parent-owned validation: not executed here

No full build, full gates, browser, DB operation, remote comment/push, or authored content write was performed. Incoming PR screenshots and reports are historical snapshot evidence, **not** this candidate's browser verification. Parent owns final runtime and visual validation.

### Safe local growth QA

From the assigned tree:

```bash
GROWTH_QA_BROWSER=firefox timeout 300 node scripts/qa/growth-tree-runtime.mjs
```

Inspected, not executed here. This existing runner creates a temporary engine-contract fixture, starts the dedicated player QA server, blocks non-loopback write requests, exercises keyboard growth investment/promotion/refund, and cleans up its fixture. It does not run the connected persistence script. The original runner covers legacy current-class tree behavior, not the complete new connected-lineage browser flow.

**Do not run** `scripts/qa/growth-connected-persistence.mts`: it writes to Supabase. `growth-connected-runtime.mjs` requires that script's persisted proof and reloaded project; it is not a standalone local-fixture command and was not used here.

### Safe local shop presentation QA without build or remote writes

The following parent-only command uses the inspected existing glass-ui fixture/scenario, dedicated player server, and a fresh output directory. It blocks every non-loopback browser request, uses no editor shell, and does not modify fixtures or incoming PR evidence. The scenario exercises opening/closing the shop and its visible list, not the full quantity/equipment transaction matrix.

```bash
timeout 300 node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { firefox } from '@playwright/test';
import { startPlayerQaServer, runRuntimeQa } from './scripts/lib/runtimeQaRun.mjs';
import scenario from './scripts/qa/runtime/glass-ui.scenario.mjs';
const server = await startPlayerQaServer();
let browser;
try {
  browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const blocked = [];
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.origin === server.url) {
      await route.fallback();
    } else {
      blocked.push(`${route.request().method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
    }
  });
  const page = await context.newPage();
  const report = await runRuntimeQa(page, scenario, {
    serverUrl: server.url,
    outDir: resolve('output/evidence/sweep-runtime-641-642/parent-shop-local'),
  });
  assert.deepEqual(blocked, []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.beats.flatMap(beat => beat.failures), []);
} finally {
  await browser?.close();
  await server.close();
}
JS
```

This command is supplied for the parent and was not executed here. Read its `SUMMARY.md` before opening selected PNGs. The harness replaces its output directory on rerun.

The incoming `scripts/qa/runtime/ingame-shop-report.mjs` is **not** a no-build command: it builds the player and overwrites the incoming report/fixture files. It was intentionally not executed in this task.
