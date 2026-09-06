# Village producer compatibility: st_01a07302

Base: `45921baf3192e42de2e3fa832ccfbd78333826f8`.
Scope: 17 added production lines in `src/editor/tools/placementTools.ts`.
No runner/invariant, road, palette, parser, or database changes.
Terminal logs retain all results and warnings; ANSI colors and trailing whitespace
are removed for review.

## Mechanism and fix

`author_village -> buildVillageDomain -> placeVillageDecor -> placePropsCount ->
placePropsOnDraft -> runScatterObject -> paint/setLower` planted conifer canopy
260 at `map_existing (28,8)` over house lower 76. Trunk 290 at `(28,9)` replaced
lower grass 240 and erased upper fence 409. `scrubPlacementConflicts` then removed
the canopy because its underlying wall was impassable, but left the trunk.
At the completion boundary the protected cell was lower=76, upper=-1, both stacks
absent. Global runner repair recreated upper=260; the invariant correctly rejected
that change. `producer-trace-red.log` contains the exact write stacks and values.

The producer now excludes recorded house geometry regardless of `avoidProtected`,
and reserves occupied upper / impassable ground cells over the whole tree candidate.
The existing footprint planner rejects the whole tree before paint. Canopies can
still overlap existing lower trunks. No restoration or refreshed snapshot is used.
Village completion/registration stays at its Phase-1 boundary; this is not broad
Phase-2 early sealing or environmental-tool coverage.

## RED/GREEN

- `facade-red.log`: requested narrow existing seeded facade test failed RED at
  `(28,8)` before production changes.
- `final-regression-red.log`: both final new test files run against base production:
  **10 failed, 2 passed**. Snow case reproduces `(72,42)`. The two valid forest
  overlap controls already pass RED.
- `final-regression-green.log`: same 12 tests, **12 passed**, with the exact final
  producer patch restored. Rejection tests call the producer directly and compare
  the entire map before cleanup; rollback cannot conceal a partial object write.
- An initial new stack fixture assumed retired overlay stacks affect collision.
  `mapOverlayTiles.ts` explicitly ignores them; the final fixture records house
  ownership and proves its existing stack values remain untouched instead. No
  pre-existing test was modified. The final corrected fixture is included in RED.

## Focused baseline comparison

`final-report.json` / `final-tests.log`: **186 passed, 2 failed, 188 total** across
13 files; no unhandled errors. `comparison.json` identifies **zero new failures**
and 25 newly failing review assertions now passing (excluding assertions already
red in the immutable baseline). Both original forest-density failures remain:
`forestDensity.test.ts:227` and `:298`, actual `0.3003472222222222`, expected `<0.3`.
The review's canonical village cases, scope gate, authoring data, lake two maps,
farm hard gate, facade forest cases, mixed `(14,20)` request, and snow city pass.

Command:

```sh
npx vitest run test/authorVillageFacade.test.ts test/authorVillageScopeGate.test.ts test/forestDensity.test.ts test/lakeVillageTwoMaps.test.ts test/villageAuthoringData.test.ts test/villageBuilder.test.ts test/villageFirstPlanHardGate.test.ts test/villageBuilderSeam.test.ts test/villageTreePlacement.test.ts test/villageProducerProtection.test.ts test/placePropsAdversarialHardening.test.ts test/naturalScatterToolIntegration.test.ts test/toolHouseProtection.test.ts --maxWorkers=1 --pool=threads --reporter=default --reporter=json --outputFile=.omo/evidence/village-producer/final-report.json
```

Exit 1 is solely the two baseline assertions. Earlier default-fork runs reported
worker `onTaskUpdate` RPC timeouts during synchronous generation; those runs are
not the final gate. The explicit single-worker thread pool completed without that
transport failure. No timeout suppression, test skips, or production timing edits.

## Product API, types, diagnostics, build

- `node .omo/evidence/village-producer/smoke.mjs`: exit 0; real `runAuthorVillage`
  with no generation mock, observed before the unchanged runner postprocessor.
  50x50: 4 houses / **191** protected cells. 100x100 snow: 20 houses / **1026**
  protected cells. Exact layer/stack snapshots survive accepted output and JSON
  roundtrip plus another repair. Both `(28,8)` and `(72,42)` remain lower=76,
  upper=-1. In-memory only, no store/DB writes. See `smoke.log`.
- `npm run typecheck:app`: exit 0 (`typecheck.log`).
- LSP diagnostics: no diagnostics for production file, both new test files, and
  smoke script. TypeScript checks repeated after final test fixtures were read.
- `npm run build`: exit 0 (`build.log`); unresolved asset URL and bundle-size
  warnings remain visible in the log.
- `git diff --check`: clean.

No browser/UI changes or browser QA in this worker. Supervisor integrated full
gates/browser review remains separate from this focused producer increment.
