# T17-AV-4: blocked regression handoff (not a completed fix)

Base: `fc5c56e3f1f22164c12f20dc430aa281a8be72c7`.
Worktree: `/home/main/z-project/rpg-zzu-tile-to-world/.omo/worktrees/spatial-room-qualifier-fix`.
Task: `st_01a0822e`.

## Delivered

- `test/spatialRoomQualifier.test.ts` promotes the actual `bindInteriorConceptPlan` fixture from `independent/lookup-probes.mts`.
- Both atlas record orders, name/tag/receipt queries, exact-ID controls, default-atlas wings, and genuine duplicate imported source aliases are covered without mocks, sleeps, skipped assertions, or timeout changes.
- Expected source ID is derived from the input tuple, not the returned binding.
- Product files are restored to base. The minimal attempted fix is preserved only as `rejected-atlas-filter.diff`; it is NOT shipped as production code.

## RED

`red-monitor.log`: exit 1, **7 failed / 6 passed**.

Foreign-first label/tag/receipt queries fail with `Unsupported atlas: easyrpg_chipset_world`. Local-first queries and exact-ID controls pass. Same-atlas ambiguity assertions fail because the first foreign source is selected instead. This is product RED, not a missing import or harness failure.

Command (from this worktree):

```sh
node /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/authoring-monitor.mjs 'flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock timeout 120s npm test -- test/spatialRoomQualifier.test.ts --maxWorkers=1 --no-file-parallelism'
```

## GREEN attempt failed: do not treat this as green

`green-monitor.log`: exit 1, **6 failed / 30 passed** across 36 tests.

The attempted patch threaded the requested/default atlas into `canonicalRoomAlias`, retained exact-ID precedence, filtered aliases before selecting, and rejected multiple eligible candidates with `spatial-ambiguous`.

Results:
- `spatialRoomQualifier.test.ts`: 5 failures (label/tag binding in both orders, default-atlas wings), all `spatial-ambiguous`.
- `spatialLegacyTools.test.ts`: 1 failure, `binds ordinary interior rooms to canonical selections`, also `spatial-ambiguous`.
- `interiorConceptRoutes.test.ts`: 14 passed.

Command was the same monitored/locked command with these explicit targets:

```sh
npm test -- test/spatialRoomQualifier.test.ts test/spatialLegacyTools.test.ts test/interiorConceptRoutes.test.ts --maxWorkers=1 --no-file-parallelism
```

All monitored children exited normally (no cancellation or timeout). The existing monitor reports its inherited description `task11 scoped validation`; this run belongs to task 17, as identified by the command, worktree and paths. The monitor uses `TerminalRuntimeSession` and awaits its exit asynchronously; no polling monitor was introduced.

## Blocking runtime evidence

`candidate-inspection.log` is a successful offline execution of the unchanged original conversion fixture. The exact temporary inspection source is preserved in `candidate-inspection.mts.txt` (run from worktree root as `.room-candidates.mts`).

Contrary to the report's shorthand "two Shared Room spaces", actual conversion produces **four** spaces:

| Atlas | Receipt-backed original | Unmapped layout context |
| --- | --- | --- |
| interior | `[interior, qualified-facility, place, bedroom]`, width 7 | `[interior, qualified-facility, place-context, [qualified-facility,1,0]]`, width 8 |
| world | `[world, qualified-facility, place, bedroom]`, width 7 | `[world, qualified-facility, place-context, [qualified-facility,1,0]]`, width 8 |

The table abbreviates atlas names and JSON tuples for readability; the log preserves exact IDs, source keys, provenance and dimensions. Both same-atlas rooms have `name = Shared Room`, with distinct canonical IDs and dimensions. Atlas filtering alone leaves two candidates. The exact-ID control picks the receipt-backed width-7 original.

The default canonical `bedroom` receipt alias independently maps to both `house` and `farmhouse` on the interior atlas. Rejecting genuine same-atlas ambiguity therefore changes the existing ordinary-interior test's expectation. Its assertion was neither edited nor suppressed.

## Decision required

The requested successful converted-label binding and strict same-atlas ambiguity rejection need an explicit rule distinguishing the conversion's original room from its layout-context room. Selecting receipt-backed named candidates ahead of unmapped candidates is one possible policy, but silently adding it would establish a precedence rule beyond atlas qualification and could hide collisions with native canonical rooms. Parsing opaque IDs/provenance or changing layout conversion was explicitly out of scope.

Recommendation: have the canonical source/alias owner define that distinction using an existing authoritative relation (or explicitly authorize receipt-backed alias precedence), then complete this regression. Separately reconcile the existing default `bedroom` test with the requested ambiguity contract, preferably by using the exact intended house-room ID in its canonical fixture. This lane does not own that test.

No GREEN claim or merge-ready production fix is made.

## Verification and cleanup

- LSP diagnostics: no diagnostics in the new test or either attempted product file.
- `git diff --check`: passed on attempted production diff.
- Pure LOC: test 80; attempted legacyConcepts 115; legacyInteriorPlan 28. No oversized file or new abstraction.
- Architecture review: test owns qualified room binding; uses real conversion and public binder; inputs cross the existing checked-document boundary; no new tagged-variant dispatch, type escape hatch, defensive layer, one-off helper (both helpers have multiple callers), parameter bloat, negative naming, logging or redundant destructive verification. Existing product exception patterns were retained in the rejected experiment.
- No broad old80 tests, build, browser/UI, provider, product schema, SQL/grants, DB writes, push, PR, merge, or extra workers.
- Temporary inspection script and journal removed before handoff. Standard ignored adoption setup (node_modules link, .env.local, allocated port 9841) remains. No server/listener was started.
- Original independent evidence and source were read only. SHA-256:
  - `AdversarialVerify.json`: `4de4506728ea809d2ebd2ee676ee7f949f77d744f8b9258a7e2e930d2c9a31a0`
  - `lookup-probes.mts`: `5a0efd9dbc27a01d3d1d67669945e0862570bb570d1e23237e5e7519c9db4238`
