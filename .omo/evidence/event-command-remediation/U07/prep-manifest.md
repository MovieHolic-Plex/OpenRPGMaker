# U07 RED preparation manifest

- Task: st_01a0767a. RED-only; production awaits H0 and U05 plus same-task GREEN authorization.
- Worktree: /home/main/.herdr/worktrees/rpg-zzu/worktree-brave-valley-f078-event-remediation-0906-event-remediation-u07
- Execution base: 69d77ffeb3c1e2e440409342f3450753cae859b3.
- Deliverables: test/eventCommandRemediation/U07.test.ts, U07.fixture.ts, and this directory's red.json, red.log, prep-manifest.md.
- No production edits, staging, commits, installs, additional agents, browser/server, build, full suite, gates, paid API, or DB operations.

## Final evidence

Command (direct exit, no pipeline masking):

```sh
npm test -- test/eventCommandRemediation/U07.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U07/red.json
```

- Exit: 1. Final report: 22 tests, 17 failed, 5 passed, 0 pending/skipped.
- red.json is the native Vitest JSON report; red.log contains verbose stdout/stderr and the direct exit code.
- LSP diagnostics on test/eventCommandRemediation after final edits: 5 TypeScript files scanned, 0 errors, 0 diagnostics (includes both U07 files).
- Preparation required two earlier executions to correct fixture assumptions; those are not claimed as valid RED evidence. The final corrected test source was executed once to produce the delivered reports.
- Corrections: SVG uploads are rejected by safeUploadedResourceUrl, so fixtures now contain valid dimensioned RGB PNGs. The real dialog redirects native-select focus to its custom trigger, whose identity/focus is asserted. Bust previews use CSS background-image with role=img. happy-dom selectedOptions caches stale state across value assignments, so assertions inspect live option.selected / selectedIndex without altering native selection behavior.

## Finding-to-test mapping (shared tests are not counted twice)

| Finding | Exact test-title fragment / parameter | Final evidence |
| --- | --- | --- |
| G2-F9 | charset/faceset late-registered picker result survives Confirm and reopen; faceset AI result uses real queue, insertion, store and staged callback | 3 RED tests: native ID and confirmed/staged value become empty; preview loses the selected image. |
| G3-F22 | backdrop late-registered picker result survives Confirm and reopen; backdrop AI result uses real queue, insertion, store and staged callback | 2 RED tests: value and resourceId become empty despite successful real registration. |
| G2-F15 | G2-F15/G3-F24/G4-F11 resource A->B->A->B updates name and image without remount | 1 shared RED test: saved/native ID is B but name, preview resourceId and image remain A. |
| G3-F24 | Shared resource test above; command 203/74 map card follows record and survives unrelated zero edit; recordPickerWithPreview retains missing actor through unrelated resource change | 4 tests including the shared one: map card remains A; missing actor has no explicit option and its staged target becomes empty. |
| G4-F11 | Shared resource and map tests above; valid variableId/switchId resolves authored record on first render | 5 tests including shared ones: valid authored records initially render as missing; unchanged fields survive subsequent x=0. |
| G4-F13 | labels target unique mounted controls in simultaneous forms, parameters slotId-input, message-textarea, durationMs-input, restoreOnGameOver-checkbox, variableId-record-open, mapId-record-select | 6 RED tests: label.control is not the input/trigger, IDs are empty/nonunique, checkbox label activation does not toggle/stage false. |

These map all six finding IDs to meaningful failures; no entire finding is classified nondefective.

## Passing edge evidence

- Three actor graphic/face/parallax tests retain explicit missing saved resource options and discard staged selection on Cancel.
- Two generic resource tests retain the explicit empty or missing option, missing preview state, and confirmed ID.
- In failing shared resource/map tests, focused trigger identity and native select identity survive changes; final saved B and unrelated x=0/y=9 assertions run and pass. Failures are stale local presentation, not a required form remount.
- Baseline old resources resolve and display before late registration; new assets resolve through the real store and appear in the real resource picker before onConfirm. Unknown resources are separate, deliberately absent fixture IDs.

## Boundary and fixture fidelity

- Actual product form renderer, dialog staging/Confirm/reopen/Cancel, resource picker buttons and onConfirm, native selects, name elements and preview renderers are used.
- AI forms are mounted in document.body before generation. The fixture subscribes to the exact replaceCommand staging boundary before clicking Generate and awaits that callback with a 3-second rejection bound. No sleeps, polling, isConnected override, fake selection handler, or detached-host workaround.
- Only AI image-generation HTTP is faked. Real queue, image response parser, insertGeneratedPictureAsset, store.update, resource profile registration, and onInserted run. The expected generated ID is read from the single actual newly registered asset, not predicted or mocked.
- Distinct IDs: u07-map-04/u07-map-12; u07-reward-17; u07-switch-23; separate charset/faceset/backdrop old/new IDs. Old/new PNG pixels differ. Charset PNGs are 288x256; other PNGs are 48x48.
- Assertions compare machine IDs, selected native options, authored record names, resolved image src/background-image, label.control, unique IDs, and staged fields. No prose/prompt wording is pinned.
- Resource-kind policy remains domain-owned (U14/U18). Shared-control regressions are represented by actual commands 102, 203, 074, 207, 217, 213, 214, plus actor 024/025 and parallax 069; this is not an exhaustive all-command surface sweep.
- Player/runtime smoke, browser keyboard/focus behavior, full form-surface audit, and production fixes remain unverified/deferred by the RED-only scope. No claim of runtime repair or GREEN readiness.
