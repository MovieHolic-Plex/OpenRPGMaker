# Placed-place adapter verification

Task: st_01a082dd. Base: 1efacf9765412fcf51a255eaea21ea2049280307.
Worktree: spatial-placed-place-edit, adopted with the repository worktree helper.

## Delivered boundary

Association-based child move/add/delete proposals, actual frozen child/drill read model,
exact placed deletion impacts, and clone proposal selection data. Existing place draft
movement and duplicate selection now use these seams. No compiler operations/types,
connection cleanup, shared session/build, space adapter, canvas/inspector/CSS, DB,
provider, publication, browser, push or merge changes.

The adapter requires an explicit compile request. Tests supply the known village root;
the parent supplies its shared authoringScope result during UI binding. Scope membership
validation is not an alternate scope resolver. Connection edit API receipt 3f774c76 was
read but neither copied nor needed by this child lifecycle implementation.

## Causal evidence

- `red-move.log`: real compiled square remained at 2,3 after the frozen slot moved to
  6,9. `green-move.log`: actual coordinates, compiled rectangle and one undo passed.
- `red-lifecycle.log`: add/delete/floor read scenarios failed at the absent adapter
  function after constructing real compiled fixtures. `green-lifecycle-implemented.log`
  passed all three with the real controller/compiler/store/history.
- `red-association-edges.log`: explicit movement back to unchanged template coordinates
  left actual 8,10 untouched; compiling an unrelated subtree incorrectly returned ok.
  `green-association-edges.log` passed both corrected behaviors.
- `red-command-selection.log`: real Duplicate left the old occurrence selected, and a
  remembered created source replaced an explicit instance card. The matching green log
  passed both actual panel-command/session regressions.
- `red-boundaries.log`: placed deletion returned no occurrence impact, and clone proposal
  identity API was absent. Both passed in `green-boundaries.log`. Its two floor cases
  already rejected via canonical validation; their original expectation of a new
  `detail:floor-limit` code was incorrect. Tests now assert the existing machine contract
  `kind:error,code:invalid`, retaining full no-write/history assertions. No duplicate floor
  guard or suppressed assertion was introduced.

## Final execution results

All runs use authoring-monitor.mjs and the shared tile-to-world validation.lock. Tests
use one Vitest worker, no file parallelism and unchanged per-test deadlines.

- `final-tests.log`: **34 passed in 7 files**, exit 0, 63.04 seconds. Six new focused
  files plus unchanged `spatialPlaceActions.test.ts`. Includes empty actual composition,
  deleted gaps, transitive override/sibling preservation, opaque IDs, explicit levels,
  missing/ancestor/conflicting sources, incomplete associations, manual-raster ownership
  and clone/read-model/impact behavior.
- Scoped TypeScript validation included all app source plus `test/placedPlace*.test.ts`.
  `types.log` is **incomplete**: monitor expired without compiler output. After the lock
  was observed unheld, `types-after-queue.log` ran and reported two TS2322 fixture-union
  errors, not product errors. Both fixtures now narrow with canonical association APIs;
  there are no assertions, ignores or suppressions.
- `typed-fixtures-validation.log`: scoped **TypeScript exit 0**, followed by **11 tests
  passed in the three changed test files**, overall exit 0, tests 36.15 seconds. Product
  source blobs are unchanged from the 34-test pass, so the other passing files were not
  repeated.
- `connected-boundary-validation.log`: scoped **TypeScript exit 0** and **6 boundary
  tests passed**, overall exit 0, 14.34 seconds. This tests-only extension proves actual
  compiled transfer deletion plus novel-root/shared-descendant frozen closure insertion.
  There are **36 distinct passing tests** across the final focused evidence; the broad
  34-test command was not repeated after these test-only additions.
- `adapter-build.log`: focused browser ESM dependency bundle through installed esbuild,
  exit 0. Output sent to /dev/null, no generated product artifact. This is not the parent's
  combined Vite build or browser acceptance.
- LSP diagnostics returned no diagnostics for each changed source/test file; the later
  actual TypeScript check caught the fixture errors above. `git diff --check` passed.

The failed `green-lifecycle.log` is retained honestly: a rejected apply_patch invocation
left the function absent before that run. It is not counted as green or hidden.

## Source binding

Verified product Git blob IDs:

| Path | Blob |
| --- | --- |
| src/editor/spatial/placedPlaceEdits.ts | 52847c1f6e54c0f6f95b7555b6d2a9d9a8c0bc3e |
| src/editor/panels/spatialPlaceCommands.ts | d98ae299c11572246c8de63721435bef5f30249b |
| src/editor/panels/spatialPlaceDraft.ts | d5661f1a274e707cad31be1a58619e0fa241dfc9 |
| src/editor/panels/spatialPlaceQuery.ts | e184ca5f0ceaa96d2e67d07be2657993e3c62e39 |

## Review and cleanup

Single responsibility: placed-place proposals; canonical project parsing owns boundaries.
New variant dispatch is exhaustive; no type escapes or error suppression. Identity checks
are at request/read boundaries. Helpers are reused. No function added or changed takes
more than three parameters. Tests establish causal red/green and actual compiler output.
No redundant destructive verification, negative-form naming or new logging was added.

Pure source LOC: adapter 134, Commands 210, Draft 230, Query 87. The inherited Commands
and Draft are in the warning band; further growth should separate lifecycle commands
from source-design helpers rather than exceed the ceiling. No touched file exceeds 250.

The temporary scoped tsconfig and journal are removed before commit. No debugger,
browser/server or DB process was created. All source edits used apply_patch backed by
git apply because this machine has no standalone apply_patch executable.

## Pending UI acceptance

Parent must bind the actual row/destination and typed lifecycle proposals through its
shared authoring session/scope, render exact impacts, and exercise real pointer/keyboard
floor/add/delete/drill/back and connected room behavior. Ordinary connection controls
must consume the separately verified edit-connection API; this lane never edits those
graph rows or bindings. Combined build, browser acceptance and publication remain
parent-owned and are not claimed complete here.
