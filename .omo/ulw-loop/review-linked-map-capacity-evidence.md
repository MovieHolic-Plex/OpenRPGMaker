# Linked-map review capacity followup

Task `st_01a078d4`, followup on `7ee3ad75aa296990daac490c6dd42dfcebeb95bb`.
Worktree `/home/main/z-project/rpg-zzu-ai-full-context-r6`, branch
`agent/ai-full-context-r6`. This commit is additive to the previous integration
fix; it does not repeat the R5 cherry-pick.

## Cause and focused correction

The previous fix still used whole old/new map or world-collection values as
review reference roots. In addition, the extractor queued every referenced
map's complete contents, recursively following unchanged transfer/call commands.
A rename therefore traversed a chain or star of unchanged maps even without
test presets. The capacity guard correctly rejected the bloated evidence.

- `changedReferenceValues` now descends only into changed values. Unchanged array
  members are cancelled with multiplicity before descending into changed
  records/commands, preserving insertion, reorder and duplicate-add semantics.
- Changed objects retain their local `mapId`, `startMapId`, `commonEventId` and
  world `refs` context. Thus coordinate-only changes still include the unchanged
  destination identity; a changed world NPC retains its own references without
  expanding unrelated sibling entities.
- Explicit review roots include a map's complete evidence but do not queue its
  unchanged contents for further map expansion. Changed common-event calls still
  resolve through record/call cycles to the needed maps.
- Default writer extraction still queues referenced map contents. Its complete
  authored seed/preset/map/common-event closure, immutable originals and paging
  remain unchanged.
- `reviewChanges`, serialized before/after authored values, model windows and
  the complete-evidence capacity guard are unchanged. No count cap or truncation.

Only two production files change: root selection in `independentReview.ts` and
the review-versus-writer traversal condition in `originalContext.ts`. No session,
UI, image, persistence or content-authoring changes.

## RED before the production correction

Added `test/independentReviewLinkedMaps.test.ts` against `7ee3ad75` first:

```sh
cd /home/main/z-project/rpg-zzu-ai-full-context-r6
timeout 150s npm test -- /home/main/z-project/rpg-zzu-ai-full-context-r6/test/independentReviewLinkedMaps.test.ts \
  --maxWorkers=1 --minWorkers=1 --testTimeout=60000
```

**Exit 1: all 10 initial cases failed.** Both no-preset chain and star cases
asserted exactly the target map, observed all six maps in both projections, and
then hit the real `buildIndependentReviewRequest` guard:

```text
expected ['/maps/map_0', ... , '/maps/map_blank_start']
to deeply equal ['/maps/map_blank_start']
independent-review-window-exceeded: complete evidence does not fit; no approval
```

Added/changed world NPC cases also expanded unchanged sibling maps and overflowed.
Changed-transfer/call cases exposed unrelated sibling/downstream map expansion.
Raw log: `/tmp/st_01a078d4-linked-red.log`.

This is independently executed evidence. The lead's initial JavaScript syntax
error is not counted as a runtime result; its corrected probe motivated these
tests.

## Final focused verification

All commands executed from the assigned worktree with explicit `cd`.

```sh
cd /home/main/z-project/rpg-zzu-ai-full-context-r6
timeout 240s npm test -- \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/originalContext.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/assistantOriginalContext.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/independentReviewMapDeltas.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/independentReviewReferenceScope.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/assistantIndependentReviewCapacity.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/independentReview.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/assistantIndependentReview.test.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/test/independentReviewLinkedMaps.test.ts \
  --maxWorkers=1 --minWorkers=1 --testTimeout=60000
```

**Exit 0: 115 tests / 8 files passed in one run, 82.41 seconds.**
Log: `/tmp/st_01a078d4-linked-final-tests.log`.

The new file has 11 cases: chain/star rename with exact map membership, added and
changed/reordered world NPCs, transfer destination/coordinate/nested-coordinate
changes, dialogue insertion before unchanged transfers, duplicate transfer
addition, changed common-event calls through cycles, and changed common-event
commands with unchanged siblings. Delivered changed values are checked intact.

The previous preset-cycle test was updated to the explicitly revised mode
contract: review stops at the changed preset map, while a separate default
writer extraction must retain the downstream map, common event, item reference
and cycle deduplication. Its old downstream-item review expectation initially
failed in the expanded batch; that assertion was moved to writer mode, with
explicit absence asserted for the unrelated review reference. No test was
deleted, skipped or suppressed. Existing oversized-required-map rejection and
writer original/paging tests remain green.

## Reproducible real-module probe

```sh
cd /home/main/z-project/rpg-zzu-ai-full-context-r6
timeout 120s node_modules/.bin/vite-node \
  --config /home/main/z-project/rpg-zzu-ai-full-context-r6/vitest.config.ts \
  /home/main/z-project/rpg-zzu-ai-full-context-r6/.omo/ulw-loop/review-linked-map-capacity-probe.ts
```

Exit 0. Both fixtures have a 20x15 current map, five unchanged 256x256 maps,
unchanged transfer links and no presets. Only the current map name changes.

| Topology | Changed path | Review maps per projection | Evidence characters | Tokens including reserve |
| --- | --- | ---: | ---: | ---: |
| Chain, last map loops to current | `/maps/map_blank_start` | 1 | 322,067 | 97,164 |
| Star, current links to every large map | `/maps/map_blank_start` | 1 | 322,835 | 97,356 |

Actual default reviewer: `gemini-3.7-flash`, unchanged window **1,048,576** tokens.
Counts come from the actual built request text after duplicate read receipts
are removed. The probe asserts exact map membership before invoking the guard,
not merely that the request happens to fit. No SSR server is started.
Log: `/tmp/st_01a078d4-linked-probe.log`.

## Types, diagnostics and build

- LSP returned no diagnostics for the changed application/tests when available;
  later fresh requests for `independentReview.ts` and the new test timed out at
  the tool's 3-second deadline. The probe is outside the normal tsconfig include
  roots, so its inferred LSP project did not resolve `@/` aliases.
- Configured compiler fallback: `ts.getPreEmitDiagnostics` with repository
  tsconfig options, its ambient declarations and all five changed TypeScript
  roots (including the probe): **0 diagnostics / exit 0**, with no filtering or
  suppressions. Log: `/tmp/st_01a078d4-linked-diagnostics.log`.
- `timeout 120s npm run typecheck:app`: **exit 0**.
  Log: `/tmp/st_01a078d4-linked-typecheck.log`.
- `timeout 240s npm run build:app`: **exit 0**, built in 25.44 seconds.
  Vite mixed-import/large-chunk warnings were left visible.
  Log: `/tmp/st_01a078d4-linked-build.log`.
- `git diff --check`: **exit 0**.

Pure Astra logic/data work throughout; no delegation, external models, DB,
browser/UI work, authored user content, push, PR or merge. Main and GROK
worktrees were not modified. The lead retains final integration gates and
independent approval; full repository gates were not run by this worker.
