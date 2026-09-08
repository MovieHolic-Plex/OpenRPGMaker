# T17-AV-4 completed under the explicit parent decision

This completion report supersedes the blocked status in `RESULT.md`. That historical report, original RED, rejected patch, and candidate inspection remain unchanged.

Decision: `parent-decision.md`, copied from `/home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/room-alias-decision.md`.
Decision SHA-256: `063c7f2d21a78c759b4b6c30571d7873b6496cdd8f62351bd81599fca8227419`.
Parent task: `st_01a0822e`.
Pre-fix regression commit: `26c39118444bbc919198e1b5566b48b83fa8ee74`.
Worktree: `/home/main/z-project/rpg-zzu-tile-to-world/.omo/worktrees/spatial-room-qualifier-fix`.

## Delivered behavior

- `canonicalRoomAlias` requires the requested atlas. Exact canonical IDs are resolved first, including layout-context IDs; the existing binder still rejects an explicit foreign-atlas ID.
- Short discovery considers only active spaces on the requested atlas that are receipt-mapped originals or non-legacy canonical sources. Unmapped legacy layout contexts are exact-ID-only. Deleted originals are not revived from remaining contexts or archived JSON.
- The existing `PLACE_ALIASES` table was moved unchanged into `interiorPlaceAliases.ts` and shared by legacy and canonical selection, avoiding a circular import. No second table was invented. An active receipt matching the shorthand's atlas/bundle/room tuple preserves existing compatibility precedence, including `bedroom -> [house, bedroom]`. Without that active qualified original, normal qualified discovery applies.
- Normal discovery unions label, tag and receipt matches through the active candidate list, so each canonical ID appears once. Multiple eligible IDs reject with `spatial-ambiguous`; mapped records do not hide native label/tag collisions.
- `bindCanonicalInteriorPlan` passes its requested/default atlas into the resolver. Geometry, layout transformation, room/path identity, facility lookup, source conversion, schema and other legacy functions are unchanged.

## Failing-first proof

Original evidence is preserved: `red-monitor.log` has **7 failed / 6 passed**, and `green-monitor.log` records the rejected naive-filter attempt (**6 failed / 30 passed**). Neither historical result is relabeled as a pass.

`decision-red-monitor.log.gz`: **20 failed / 26 passed**, exit 1, 27.95 seconds. The raw log is losslessly gzip-compressed because Vitest source excerpts include trailing whitespace; those original bytes were preserved rather than edited to satisfy the patch whitespace check. This ran after the behavior-neutral table extraction but before changing the resolver. The expanded regression had 20 failures; all 14 unchanged `interiorConceptRoutes` tests passed, verifying that extraction retained legacy behavior.

New RED observations include:
- native/mapped collisions returned successfully instead of rejecting;
- deleted originals rebound to their remaining context copy;
- reversed default bedroom receipts chose farmhouse instead of house;
- an earlier native label stole an exact canonical ID query.

## Narrow GREEN

`decision-green-monitor.log`: **55 passed / 0 failed**, three files, exit 0, 51.35 seconds, one execution.

- `test/spatialRoomQualifier.test.ts`: **32 passed**.
- `test/spatialLegacyTools.test.ts`: **9 passed**, including the unchanged ordinary-interior bedroom test.
- `test/interiorConceptRoutes.test.ts`: **14 passed**, unchanged.

Both test runs used the existing asynchronous `authoring-monitor.mjs`, the shared `validation.lock`, timeout 120s, and one Vitest worker. No timeout increase, sleeps, polling, suppression, skipped assertion, or broad suite was introduced.

Exact GREEN invocation from the worktree:

```sh
node /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/authoring-monitor.mjs 'flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock timeout 120s npm test -- test/spatialRoomQualifier.test.ts test/spatialLegacyTools.test.ts test/interiorConceptRoutes.test.ts --maxWorkers=1 --no-file-parallelism'
```

The regression calls the actual `bindInteriorConceptPlan` entry with the original converted two-atlas fixture, not a resolver mock. It asserts the exact expected original-room ID for both atlas record orders. Additional controls cover name/tag/receipt queries; duplicate mapped originals; user/AI/builtin native collisions and unique aliases; exact layout-context access; deleted originals; reversed default shorthand; name/tag/receipt ID deduplication; exact-ID precedence; explicit wrong atlas; default-atlas wing binding; source immutability and geometry retention. Related suites exercise real registered interior routes, including pipeline preparation and refurnishing.

## Diagnostics and review

- LSP: no diagnostics on four changed files. `interiorConceptPlan.ts` freshness timed out twice at the tool's fixed 3000ms limit.
- Fallback: scoped TypeScript compiler API diagnostics on all five changed files, **0 diagnostics**, exit 0. Exact executable command is preserved in `changed-file-diagnostics.command.txt`; output is `changed-file-diagnostics.log`. This was also run under the same monitor/lock and 120s bound. It checks changed-file syntax/semantics plus compiler options, not a full application typecheck/build.
- `git diff --check`: passed.
- Pure LOC: `interiorConceptPlan.ts` 97; shared alias table 8; `legacyConcepts.ts` 124; `legacyInteriorPlan.ts` 28; regression test 144. All below 200.
- Architectural review: responsibilities remain compatibility selection, alias data, and binding regression. Existing checked-document/receipt parsing owns boundary validation. No new tagged-variant dispatcher, type escape hatch, defensive layer, one-off helper, parameter bloat (>3), negative naming, logging, or redundant destructive verification. Shared data has two real consumers; both test helpers have multiple callers. New behavior is locked by observed RED-to-GREEN tests.

## Scope, limitations and cleanup

No broad old80 test rerun, full build, browser/UI, provider invocation, product schema, SQL/grants, DB writes, push, PR, merge, or extra worker. Browser/full-provider acceptance is not claimed; this is scoped offline compatibility verification through the actual binder and related tool tests.

Other legacy functions remain separately owned and unmodified. The existing `spatialLegacyTools` and `interiorConceptRoutes` test files are byte-unchanged. Original source fixtures and independent evidence were read only. Temporary journal removed before commit; no temporary script/server/listener was introduced in this continuation. The adopted worktree's standard ignored dependency link/environment setup remains. Every monitored child exited without timeout or cancellation.

## Verified source SHA-256

| File | SHA-256 |
| --- | --- |
| src/editor/interiorConceptPlan.ts | 23a3cc2d67f6544f31de17c48f6888f750bf5deea0d1aca8cf7508e660721f15 |
| src/editor/interiorPlaceAliases.ts | 59c502408d6ab48c65a115aba43af349227e5d0e96ba720c927c95310a8e2071 |
| src/editor/spatial/legacyConcepts.ts | 041e2a85db980674caa9244c53b069661fb9b74f6474ae09f5bab95dd461ee6b |
| src/editor/spatial/legacyInteriorPlan.ts | 976d4ec14c7ed590fe61d48c7b2d4f2bc922e53501c400c8e017c0caa4dc8983 |
| test/spatialRoomQualifier.test.ts | 8812c963d7a4954ad888270bd269fed99743bcdf69438d232dc1bd72bd79784b |
