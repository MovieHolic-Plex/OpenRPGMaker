# Phase 2 protected terrain fill

- Task: `st_01a07408`, 2026-09-06.
- Worktree: `/home/main/z-project/rpg-zzu-house-protection-p2-fill`.
- Branch: `agent/house-protection-p2-fill` (no upstream configured).
- Base: `e238eb1908b0f6fcdc32011d6e2419797f442704` (Phase 1 / PR608).
- Verified atomic implementation + tests commit:
  `552ee4d83a2919a7af2edfe52ab87aa5e7946e20`
  (`fix(ai): preserve completed houses during terrain fill`).
- This evidence-only follow-up records the immutable implementation hash.

## Delivered contract

Only `src/editor/tools/v3/constructionTools.ts` and
`test/houseProtectionFill.test.ts` changed in the implementation commit.
All file edits used `apply_patch`. No shared helper signature, Phase 1 final
invariant, forest, village, wiki, schema or human-brush changes.

`protectedHouseCells` excludes metadata-owned cells before passage previews,
painting, upper clearing and neighboring autotile writes. Empty/passable cells,
both tile layers, ordered stacks and absent/empty stacks remain exact. The
existing fill-only structure-role fallback now inspects both layers; it does not
create house metadata. The existing optional `resolveAutotile` write predicate
blocks protected writes without removing connectivity inputs.

Receipt interpretation: `filled` retains its existing permitted-paint-cell
meaning. New `mutatedCells` counts distinct final changed cells across either
layer, including unprotected reshaped neighbors, not intermediate write attempts.
`skipped.structure` includes metadata-house and role-fallback candidates, each
once; protected neighbors outside the candidate set are not reported as skipped
requested cells. An all-protected request reports zero fill/mutations/reshapes
and a no-change summary, without a force/selection exemption.

## RED / GREEN

1. Before production changes: `npm test -- test/houseProtectionFill.test.ts`
   exited 1: **15/15 failed**. Real transactions rejected straddling fills with
   `protected-house-write`; direct definitions corrupted protected cells;
   upper-only roof fallback changed lower `240 -> 395`; neighbor reshaping
   changed protected sand `424 -> 393`. Log: `/tmp/p2-fill-red.log`.
2. After implementation: the same command exited 0, **15/15 passed**.
   Log: `/tmp/p2-fill-green.log`.
3. Expanded coverage: **136/136 passed across 11 files**, exit 0, 41.10s:

   ```sh
   npm test -- test/houseProtectionFill.test.ts \
     test/fillRegionPreservesContent.test.ts test/constructionToolsV3.test.ts \
     test/houseProtection.test.ts test/toolHouseProtection.test.ts \
     test/rmTypeExpanderV3.test.ts test/constructionContracts.test.ts \
     test/constructionHarness.test.ts test/materialHintFillable.test.ts \
     test/constructionOutcome.test.ts test/constructionActivityOutcome.test.ts \
     --maxWorkers=4
   ```

   Log: `/tmp/p2-fill-focused.log`. Existing tests were not modified.
4. Final fixture type corrections added required `defaultLayer` fields; the
   final new suite passed **20/20**, exit 0, 24.52s:
   `npm test -- test/houseProtectionFill.test.ts --maxWorkers=4`.
   Log: `/tmp/p2-fill-final-tests.log`.

Coverage includes water/sand, upper/lower, clearUpper defaults and overrides,
rect/ellipse/circle, wall-gap expansion, zero-work receipts, both-layer role
fallback, protected neighbor connectivity, unprotected neighbor mutation counts,
human placement serialize/deserialize, and real authored roof-deck houses.
No mocks, sleeps, polling waits, prose assertions or weakened existing tests.

## Additional verification

- Both changed TypeScript files: final LSP diagnostics **none**.
- `npm run typecheck:app`: exit 0 (`/tmp/p2-fill-typecheck.log`).
- Scoped test + imported production graph: TypeScript `createProgram` with
  `tsconfig.json` options and roots `src/vite-env.d.ts` and
  `test/houseProtectionFill.test.ts`: **0 diagnostics**, exit 0.
- `npm run build:app`: exit 0, 40.49s (`/tmp/p2-fill-build.log`). Rollup warned
  about record-picker circular reexports, mixed static/dynamic imports and large
  chunks. These warnings were not suppressed or fixed in this lane.
- Independent `vite-node` smoke: real `createBlankProject -> author_house ->
  serialize/deserialize -> runTool(fill_region)` for each material, with exact
  `captureHouseProtection` equality and positive committed tile changes:

  | Material | Requested | Protected skipped | Filled | Mutated | Reshaped |
  | --- | ---: | ---: | ---: | ---: | ---: |
  | Water | 90 | 64 | 26 | 26 | 0 |
  | Sand | 90 | 64 | 26 | 26 | 26 |

  Both preserved the full bbox, north ridge and recorded ladder. Log:
  `/tmp/p2-fill-smoke.log`. Reproducible committed equivalents are the two
  `accepts ... real authored, saved and reloaded roof-deck house` tests.
- `git diff --check`: clean before commit; implementation contains only the two
  named source/test paths. New tests are 176 nonblank/noncomment lines. Existing
  construction module size was retained rather than performing an out-of-scope
  refactor. No new type assertions, error suppression or bypasses.

Exploratory validator setup failures were corrected, not treated as passes:
initial scoped TypeScript omitted the ambient Vite declaration and exposed the
two missing fixture fields; combining every app root with Vitest types instead
reported TS2322 timer conflicts in unchanged `customSelect.ts:362` and
`showAnimationPlayback.ts:138`. Separate app and correctly scoped test checks
above pass. The first smoke invocation could not load a temporary script outside
Vite's filesystem allowlist; a temporary explicit-root/allowlist config fixed
that invocation without repository changes.

Full repository gates, player/standalone builds, integrated village cases and
browser QA remain supervisor-owned per the Phase 2 contract. No push, PR or main
merge was performed. These are pure editor-code tests, not authored shared DB
content; no remote project was created or changed.
