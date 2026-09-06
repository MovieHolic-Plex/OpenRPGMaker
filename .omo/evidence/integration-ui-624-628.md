# PR624 + PR628 local integration

Base: `4c7cf588`. Sidebar head: `4bd71a61f317bc97d2512bf68b5f22a168da916c`.
CSS head: `29304f22b63f0ebfa189369fb02273c2b927750f`.
Worktree: `/home/main/z-project/rpg-zzu-integration-ui-624-628`.

## Merge and preservation

- Both normal merges completed without textual conflicts. The verified sidebar merge is `21f78f72`.
- Upstream assistant #634 and System #627 implementations remain unchanged. No PR626 code was merged here.
- PR628's existing inventory was rechecked against `4c7cf588` and the combined source with PostCSS: exactly 118 deletions in eight files, 16 resulting empty rules, all later same-selector/property owners still unconditional and importance-safe in the current import/source order. Surviving ASTs match the base after only inventory deletions. The troop slice contains comments only and its sole import was removed.
- This includes retaining upstream species-selection notices in `11-life-authoring.css`, the System navigation removal in `light-theme.css`, and the retired type-chart rule removal in `modern-controls.css`.
- No test, skip, gate baseline or allowlist was modified during integration. Initial tracked worktree status was clean; existing ignored environment/cache files were not replaced.

## Executed checks

After PR624, all 119 tests in 16 files passed in one run (54.65s):

```sh
npm test -- --maxWorkers=2 test/sidebarModeWorkflow.test.ts test/basicLeftRail.test.ts test/basicTilePalette.test.ts test/editorUiMode.test.ts test/leftDockPanels.test.ts test/sidebarKeyboardNav.test.ts test/sidebarFocus.test.ts test/editorLayoutPersist.test.ts test/editorMenuSidebarIa.test.ts test/tileToolbar.test.ts test/tileToolbarAria.test.ts test/tileToolbarOverflowDismiss.test.ts test/tileToolbarOverflowReach.test.ts test/tileToolbarToolAffordance.test.ts test/tileToolbarMapModeClickWiring.test.ts test/tileToolbarMapModeParity.test.ts
```

After PR628, all 70 tests in seven files passed in one run (39.84s), including the sidebar/Studio intersection:

```sh
npm test -- --maxWorkers=2 --cache=false test/databaseStudioV2.test.ts test/databaseSidebarCss.test.ts test/databaseLightTheme.test.ts test/databaseSystemStudio.test.ts test/aiStudioShell.test.ts test/aiStudioOpacityPersistence.test.ts test/sidebarModeWorkflow.test.ts
```

`npm run typecheck:app`, `npm run gates:css`, and `git diff --cached --check` passed for each merge increment. Final CSS gates: 266 budget files, zero regressions, 268 graph files all reachable, zero missing imports, 973 protected live classes / 7644 attributes retained. Existing graph allowances and 119 reported unstyled classes were not changed.

All 12 changed TypeScript files (six production, six tests including E2E) returned clean individual LSP diagnostics. CSS LSP is unavailable because Biome is not installed. The local audit helper's initial run rejected duplicate identical sidebar overflow declarations; line-based disambiguation corrected the helper and its complete rerun passed. Its initial LSP was clean, final fresh LSP timed out; `node --check` and execution passed. This was an audit-tool issue, not a failing product test. The helper remains local/ignored at `.omo/evidence/css-refactor/integration-624-628-audit.mjs`; no new product test layer was added.

No build, full gates, surface suite, server or browser run was performed here. These remain parent-owned. Earlier PR browser/build evidence is historical, not verification of this combined tree. No push, PR comment or content/DB write was performed.

## Parent browser entry

Use a verified-free dedicated port, never the inherited `.env.local` port 9841 without checking ownership. From the final merged parent tree, for example:

```sh
ss -ltnp 'sport = :29887'
DEV_SERVER_PORT=29887 VITE_CACHE_DIR="$PWD/.vite-cache/integration-ui-qa" E2E_FREEZE_DEV_SERVER=1 E2E_RETRIES=0 npx playwright test test/e2e/left-sidebar-adversarial.spec.ts --workers=1
```

The existing spec has its own Node GET relay, covers all three modes at three desktop sizes, and verifies real keyboard selection/focus and map-list/palette geometry. No new E2E assertions were added here.

### Paint/undo replay availability

`output/evidence/mode-ux-after-audit/REPORT.md:90` documents `audit-lifecycle.mjs`, exporting `runLeadQa(artifact)` where `artifact(name)` resolves a fresh output path. It records eight physical paint/undo scenarios. However, that module is **not tracked in PR624 and is absent in this worktree**; the corresponding path and `mode-ux-after/lead-qa.mjs` are also absent in shared main. The PR includes the report, screenshots and `.omo/evidence/sidebar-mode-ux-actions.json`, not an executable paint/undo replay. Do not present the documented replay snippet as currently runnable. The existing `sidebarModeWorkflow` unit test verifies real history undo, but does not replace parent browser painting QA.
