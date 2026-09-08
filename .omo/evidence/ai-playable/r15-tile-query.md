# R15: bounded tile_query selectors and label filtering

Base: `fe3a6d88a91b8f2600b8992f198cf0eb0604adac`.
Worktree: `/home/main/z-project/rpg-zzu-ai-tile-query-boundaries-0907`.
Task: `st_01a07750`.

## Scope and mechanism

Read the exact R13-R16 review in
`rpg-zzu-ai-playable-adversarial-0906/.omo/evidence/ai-playable/review-round3.md`
and its actual `output/evidence/ai-playable-final/round3/final-harness.json`.
The recorded similar call at lines 3553-3575 injected nonexistent `tiles_default`.
The floor write at lines 3813-3842 explicitly requested `material:"모래"`.
This change does not reinterpret stone, change passage, relabel assets, broaden
semantic matching, alter completion gates, or repair any authored game.

The live path is `AssistantSession -> runTool -> registry tile_query -> legacy
query implementation`. Both affected branches now use the existing resolver:
explicit tileset, otherwise explicit target map, otherwise start map, otherwise
the existing `DEFAULT_TILESET_ID` fallback. An explicit tileset takes precedence;
when a map selector is used it must exist. Blank explicit selectors cannot fall
through to browsing. `labels` only runs the unfiltered fallback for a normalized
empty query, not for an unmatched nonempty query.

## Failing first

With only the new tests added and production still at the base:

```text
npm test -- test/tileQueryBoundaries.test.ts --maxWorkers=2
exit 1
Test Files  1 failed (1)
Tests       26 failed | 17 passed (43)
```

Both map-targeted and start-map `similar`/`unclassified` failed with:
`타일셋을 찾을 수 없습니다: tiles_default`.
Existing shared-resolver branches accepted missing maps/blank tilesets; the
unmatched-filter assertion received 40 unrelated labels rather than `[]`.
No mocks, sleeps, polling, prose pins, or new type/non-null assertions were used.

## Green verification

```text
npm test -- test/tileQueryBoundaries.test.ts test/tileQueryTool.test.ts test/findSimilarTiles.test.ts test/tileMetadataTools.test.ts test/tileVocabularyV3.test.ts --maxWorkers=2
exit 0: 5 files, 82 tests passed (single run)

npm run typecheck:app
exit 0

git diff --check
exit 0
```

LSP diagnostics: none for `src/editor/tools/tileQueryTool.ts` and
`test/tileQueryBoundaries.test.ts`. Markdown LSP is unavailable, not a pass.
The programming skill's unchanged no-excuse checker reported
`No violations in 2 file(s).` It was copied temporarily into this worktree to
resolve repository TypeScript 5; running it from the skill directory first hit
its explicit global-TypeScript-7 environment error. No gate was changed.

## Read-only replay on actual round3 evidence

Executed a temporary `vite-node --config vitest.config.ts` script before and
after the fix. It loaded `before-followup-project.json` through `deserialize`,
called the real registered `runTool`, and asserted serialized in-memory project
equality before/after all calls. No saved input or DB was written.

| Call | Before | After |
| --- | --- | --- |
| similar, map_blank_start, tileId 320 | tileset-not-found: tiles_default | ok; easyrpg_chipset_combined_town |
| same call with explicit actual tileset | ok | identical candidates |
| unclassified, map_blank_start, limit 3 | tileset-not-found: tiles_default | ok; tiles [3,4,5], total 272 |
| same call with explicit actual tileset | ok; [3,4,5], total 272 | identical result |
| labels, query not-a-material-st01 | 40 labels | 0 labels |
| labels, empty query, limit 3 | 3 labels | 3 labels |
| labels, map_missing | ok; 40 labels | map-not-found |

The similarity candidates remained
`[319,318,440,381,290,350,322,260,323,289,291,349]`.
The underlying `suggestMaterialsByLabel` returned zero unmatched candidates both
before and after, isolating the leak to the wrapper. Both replays reported
`projectUnchanged=true`. Separate minimal unit fixtures distinguish start,
target, and explicit tilesets and test blank/missing selectors across all five
resolver consumers, omitted/empty/whitespace browsing, and description-only
browsing fallback.

## Limits

R1-R12 and their integration-test repairs are untouched. `.env.local`, occupied
9841, DB, saved games, catalog and passage files are untouched. Temporary debug
scripts/snapshots/logs are removed after promoting this evidence.
No build/full gates, stronger-model generation, live UI turn, remote reload,
full player journey, or ultrabrain approval is claimed here; those remain parent
owned. R6/R16 are not closed, no approval exists, and PR653's external merge is
not goal completion. No push, PR, merge, or main-branch edit is part of this task.
