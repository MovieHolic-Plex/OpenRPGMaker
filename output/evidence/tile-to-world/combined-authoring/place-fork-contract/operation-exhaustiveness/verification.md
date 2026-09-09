# Integration-owned operation exhaustiveness correction

This addendum supersedes the diagnostic attribution in the earlier `../verification.md`; prior evidence is retained unchanged. Comparing before/after the draft-copy correction on the already integrated tree did not establish that all five errors predated the integration. The missing `edit-connection` arm is integration-owned, not inherited from UI1.

## Narrow correction

Added only `case "edit-connection":` to `handleController`'s existing accepted-operation group in `test/spatialPlaceActions.test.ts`. As with `edit` and the mock's other ordinary operations, it records the request and issues a preview of the supplied draft without implementing production mutations. The refresh-only check and exhaustive `default: assertNever(request.operation)` remain intact. All original assertions, prior draft-fork correction, and actual-controller evidence remain unchanged. This test double is not a replacement for production connection-edit semantics.

## Qualified baseline comparison

The reproducible `scoped-types.mjs` compiler probe loads the exact original test and direct `src/editor/spatial/authoringTypes.ts` contract from UI1 commit `1efacf9765412fcf51a255eaea21ea2049280307` into an in-memory compiler host. Other transitive dependencies, TypeScript version, and compiler options remain current; this is a source/direct-contract replay, not a full historical-checkout build.

Original UI1 blob SHA-256 values:

- Test: `dff1c8fc901c8350befaa5817cf7fab9c827ef24a35fb66d049377aa6c138383`
- Contract: `36079df50ad1a548919931bb0504b429d539534c5da8e45824e1494fe6083227`

UI1 has no `edit-connection` operation variant. The replay reproduces exactly four TS2339 diagnostics for `lastRequest` at lines 353, 354, 360, and 367, and no TS2345. These four errors therefore reproduce in the original UI1 test/direct contract independently of the integration's new variant; no claim is made that the entire historical tree was typechecked.

## Validation results

All compiler/Vitest validation acquired the shared lock with blocking `flock`, waiting for the parent-held lock without polling. No test/hook timeout was changed.

| Evidence | Result |
| --- | --- |
| `types-before.log` | UI1 replay: 4 TS2339; integrated current: those 4 plus integration-owned TS2345 at line 174. Exit 1. |
| `types-after.log` | UI1 replay: same 4 TS2339; corrected current: only 4 TS2339, shifted to lines 354, 355, 361, 368. TS2345 resolved. Exit 1, remaining errors unsuppressed. |
| LSP on corrected test | Same four TS2339 diagnostics; no TS2345. |
| `tests.log`, `tests.json` | Original test file run once after correction: 15 passed, 1 file passed, exit 0. |
| `test-fix.patch` | Exactly one added switch arm relative to the parent-staged test. |

Commands, each inside `/home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock`:

```sh
node output/evidence/tile-to-world/combined-authoring/place-fork-contract/operation-exhaustiveness/scoped-types.mjs
node scripts/run-vitest.mjs run test/spatialPlaceActions.test.ts \
  --configLoader bundle --maxWorkers=1 --no-file-parallelism \
  --reporter=verbose --reporter=json \
  --outputFile.json=output/evidence/tile-to-world/combined-authoring/place-fork-contract/operation-exhaustiveness/tests.json
```

The compiler probe's final exit 1 is intentional reporting of the remaining real errors, not a passing typecheck. The shell records that exit separately from the test exit and itself exits 1. The prior 16-test combined run and real-controller first-place transaction evidence were not overwritten or rerun in this follow-up.

## Integrity, review, and cleanup

`source-before.sha256` / `source-after.sha256` record the source fence. Corrected test SHA-256: `66b0f9abef5b0dbf43f62c017b9b107161514066b79d7b751582e208c92ccaba`. Paired index hashes match, as do paired product-worktree diff hashes: parent staging and product worktree are preserved. `git diff --check` for the test exited 0. No stage/commit or other git mutation occurred.

Architectural review: responsibility remains the place-action test double; the added label restores exhaustive discrimination without casts or suppression. No new boundary, defensive layer, helper, parameter, negative name, logging, timing-dependent test, or redundant production verification was introduced. The compiler's before/after error is the regression proof for this type-contract correction; all runtime assertions remain unchanged and pass. The original file is 457 pure LOC (one added line); its inherited size is retained under the explicit one-arm scope rather than expanded into an unrelated refactor. The standalone diagnostic replay is 38 pure LOC and only reads historical/current sources and emits diagnostics.

No temporary checkout or baseline source file was created: historical sources exist only in the compiler host's memory. Finite validators exited and released their lock descriptors. No app build, browser, database, provider, product edits, or changes to prior evidence were performed.
