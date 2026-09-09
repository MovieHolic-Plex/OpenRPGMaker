# Sidebar brush C8/B1 delta gate review

recommendation: APPROVE

blockers: []

## Scope and originalIntent

Review only the correction of C8/B1 in the supplied locked checkout (identified by the task as HEAD 5a85fd68). The user expects a custom source selection to place its authored tile IDs on their authored layers, rather than reinterpret those IDs as bundled trees. Previously, selecting upper 285/286 and lower 289/290 on a four-column custom atlas produced upper 285/260 and lower 289/290.

## desiredOutcome

The multi-cell source stamp places upper 285/286 and lower 289/290 exactly. The preservation exception must not disable ordinary brush or single-cell stamp tree repair. C1-C7 and the other previously approved C8 paths are not reopened.

## userOutcomeReview

C8/B1 is closed by the inspected code and behavior receipt:

- `src/editor/TilePaintEngine.ts`, `applyPaletteStamp`: `single` is derived from `stamp.cells.length === 1`; the bulk paint call supplies `preservePattern: !single`. Each cell retains its authored layer, ID, and coordinate offset. The ordinary paint branch supplies only `autoConnect`, not the preservation flag.
- `src/editor/tileActions.ts`, `paintTilesBulk`: both terrain shaping and tree-pair repair are gated by `!options.preservePattern`. With the flag omitted or false, their existing predicates still apply and the `repairTreePairsOnMap` call remains active. Thus ordinary brushes and single-cell stamps do not acquire this bypass. This is a source-level conclusion, not a separately reproduced runtime tree test.
- `test/tileBrushState.test.ts`, `preserves mixed-layer source cells instead of repairing them as bundled trees`: uses the real paint engine and map store with the four-column custom fixture and checks the four actual layer slots against `[285, 286, 289, 290]`. Tile mutation and tree repair are not mocked.
- `scripts/qa/sidebar-brush.mjs`, `C8-mixed-layers`: creates the custom atlas metadata, performs mouse selection from source tile 285 to 290, checks selected IDs/layers, clicks the map, and asserts actual upper/lower map slots. It does not install the stamp directly or overwrite the placement result. The expected 286 would reject the former 260 substitution.
- `output/evidence/sidebar-brush-fixes/mixed-isolated/results.json`: the mixed case records PASS with source IDs `[285,286,289,290]`, layers `[upper,upper,lower,lower]`, and placed IDs `[285,286,289,290]`. The accompanying all-lower C8a case also records PASS. The receipt contains `errors: []` and `cleanup: true`; the inspected script records cleanup after awaiting context closure.

## Direct skill-perspective checks

`remove-ai-slops` and `programming` were not made available within the expressly permitted artifact scope. Their supplied criteria were applied directly to the B1 production and test portions.

- No deletion-only, removal-presence, prose-pinning, or tautological assertions in the mixed regression case.
- Hard-coded tile IDs encode the reported collision with bundled tree repair, rather than mirror an implementation algorithm. The unit assertion observes real map mutation; the browser assertion independently includes real source selection. These cover different integration boundaries and are not useless duplicates.
- The B1 action contains no fixed sleep or polling-delay workaround. It awaits browser actions and inspects the resulting state.
- The production correction adds a targeted option and guards the existing post-processing decisions; it does not introduce extraction, parsing, normalization, or an unrelated abstraction. No maintenance-burden or scope-drift blocker was found in this delta.
- Confirmation that the earlier code review explicitly applied the same skill/overfit criteria is unavailable: that report is outside this task's permitted inspection list. This is an evidence limitation, not a demonstrated failure of C8/B1.

## Checked artifact paths

All paths below are relative to `/home/main/.herdr/worktrees/rpg-zzu/worktree-quiet-valley-be3d-sidebar-review`:

- `src/editor/tileActions.ts` — paint options and bulk-paint post-processing guards.
- `src/editor/TilePaintEngine.ts` — ordinary paint and stamp routing.
- `test/tileBrushState.test.ts` — mixed-placement regression and adjacent source-variant case.
- `scripts/qa/sidebar-brush.mjs` — C8 source-drag/placement assertions and receipt handling.
- `.omo/evidence/sidebar-brush-mixed.md` — supervisor narrative, treated as reported rather than independently executed evidence.
- `output/evidence/sidebar-brush-fixes/mixed-isolated/results.json` — inspected behavior receipt.

## Exact evidence gaps and approval limits

No commands, tests, builds, browser sessions, child tasks, or general repository exploration were performed, as explicitly required. No standalone diff or git identity was inspected; checkout identity is task-supplied. The reported prior RED, 82 tests across five suites, clean diagnostics, typecheck, and full build were not reproduced and are not certified by this verdict. No new runtime ordinary-tree receipt was present in the permitted artifacts; retained behavior is established here by the unchanged default branch and single-cell flag value. The earlier gate/code-review artifacts and any external notepad were not inspected because they were outside the explicit read scope. No image or pixel approval is claimed.

These limitations do not prove a failure of the stated B1 delta criterion. Approval is confined to the exact mixed-stamp correction and preservation of ordinary repair routing; full-repository gates remain supervisor-owned.
