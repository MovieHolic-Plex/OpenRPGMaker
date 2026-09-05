# Monster studio: editor UI evidence

The first database redesign slice replaces the monster card columns with a central
animated preview and action editor, alongside Basic / Appearance / Combat / Rewards
inspector tabs. The existing database window and other collections remain the next
stages of the larger workspace proposal.

| Evidence | Viewport | Surface |
| --- | --- | --- |
| [Before](before-1680.png) | 1680 × 1050 | Original monster form |
| [After](after-1680.png) | 1680 × 1050 | Preview and inspector beside one another |
| [Compact](after-1280.png) | 1280 × 800 | Stacked editing surface |
| [Desktop floor](after-1024.png) | 1024 × 768 | Stacked editing surface |

The screenshots use the existing fresh-project editor fixture. No game content was
authored or saved remotely. These are editor screenshots, not runtime visual QA.
The browser test scrolls every property group into view and checks actual pointer
hit targets, overflow, and unchanged modal geometry at each size.

Reproduce with a dedicated Vite cache (worktrees share node_modules):

```sh
VITE_CACHE_DIR=/tmp/enemy-studio-vite E2E_FREEZE_DEV_SERVER=1 npm run dev:worktree -- --port 19843
DEV_SERVER_PORT=19843 npm run test:e2e -- test/e2e/database-enemy-studio.spec.ts --trace off
npm test -- test/enemyBattleTest.test.ts test/databaseEnemySpeciesPanel.test.ts test/databaseEnemyResourceSlot.test.ts test/databaseEnemyFactionPanel.test.ts test/databasePanelGridClasses.test.ts test/databaseRecordPartialRender.test.ts test/testPlayRunControls.test.ts
npm run typecheck:app
VITEST_MAX_FORKS=4 VITEST_MIN_FORKS=1 VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 npm run gates
```

The interaction test covers live values and names, pause state across deferred
refreshes, keyboard tabs, per-record selection, reference navigation, and returning
from a disposable test battle without modifying the authored project.
