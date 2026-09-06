# Corrected crop-purity baseline comparison

## Finding

All three corrected crop-purity cases **pass on unchanged baseline production source**:
graphicStages omitted, explicit [], and authored frame0/editor label. These cases preserve
existing behavior; they are not evidence that task14 fixed a crop data-mutation defect.
The original `TypeError: render is not a function` in ../red.txt is a harness import error,
not behavioral RED. That file and its original exit receipt remain unchanged.

The full corrected suite was run once. Result: **exit1, 8 failed / 6 passed / 14 total**.
The eight bounds/name failures remain valid baseline regressions; the three crop cases and
three legacy-characterization cases pass. No tests were skipped, deleted or weakened and
no current product code was altered to manufacture a failure.

## Exact identity and method

- Baseline commit: `966f414c07729e7d9474c568cbaf19a94d2bc740`.
- Baseline tree: `6ff79d95e11ba95ae47a9db97e106936728088fa`.
- Corrected test/current product commit: `be63008fa143fef11f7843cac3e01a81dd05cfbe`.
- Corrected test: `test/lifeAuthoringBounds.test.ts`.
- Corrected test blob: `7a960dfcfa64ca16bb5f45a51f086adde191857f`.
- Corrected test SHA256: `1133a8c47e56606ee67fb994db00d96ae1e8eaa3d303d248febd233987cc7c86`.
- Baseline crop module blob: `d1f05075ced0e5fdd5748b0eb63ae8a3187c2d77`.
- Baseline crop module SHA256: `5a36bd6137560592fd2314b7eb5158e9654580e46639293366e4842eab20e1c9`.

This is the requested equivalent non-mutating source comparison, not a second worktree.
`baseline.config.mjs` loads verbatim git-show baseline bytes at the original Vite module
ids for **every one of the eight differing production files**. All other tracked src
files are identical to baseline; there are no untracked src files. No runtime authority
is mocked. `identity.json` records each baseline/current hash and baseline git blob;
`loaded-sources.json` proves all eight replacements were actually consumed. Source
snapshots are retained under source/. The corrected test file is used without edits.

The original Vitest configuration matches baseline. Only a task-owned cache, source-load
plugin and single-worker scheduling are added. Test15000ms/hook90000ms deadlines remain
unchanged. configLoader runner avoids bundled-config writes into shared node_modules.

## Command and output

Executed from the assigned authoring-bounds tree:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s 300s \
  node .omo/evidence/life-full-20260906/14/run.mjs crop-baseline/result \
  node scripts/run-vitest.mjs run --configLoader runner \
  --config .omo/evidence/life-full-20260906/14/crop-baseline/baseline.config.mjs \
  test/lifeAuthoringBounds.test.ts
```

Actual child and outer exits are1 (`result.json`, `lock-command.exit`). `result.txt` and
`console.txt` retain complete output, including all eight failing assertion bodies.
The run took140.92s, completed inside its bound and did not retry. No nested lock was used.

## Characterization fixture correction

`characterization-fixture-diff.json` parses the two original failed whole-wire assertions
from ../characterization.txt and records identical semantic differences in both:

- `system.titleScreen.titleGraphic`: removed by existing load normalization.
- `system.timeSystem.forceSleep`: absent -> false.
- `system.timeSystem.minutesPerRealSecond`: absent ->1.
- `system.timeSystem.dayEndHour`: absent ->26.
- `system.timeSystem.dayStartHour`: absent ->6.

The original fixture returned a freshly assembled blank project and compared it to its
first normalized deserialize. The corrected fixture returns deserialize(serialize(project))
before the test begins, establishing the existing load contract. The render and repeated
roundtrip assertions stay intact. This comparison confirms all three corrected legacy
characterizations pass on baseline, not just on the implementation.

The crop fixture also uses the real renderCropTab export and valid CropRecord shape
(stages:[{days:2}], harvestCount:1). Object-wrapped parameter rows ensure [] is tested as
an explicit empty graphics array rather than being interpreted as zero test arguments.

## Cleanup and scope

`cleanup.json` confirms all source/test hashes are unchanged and the dedicated cache was
removed. Baseline snapshots and evidence are retained. No build, browser, dependency,
shared cache cleanup, remote write, source/test/wiki change or extra service was needed.
Only this evidence subdirectory and the task14 summary are changed by this correction.
