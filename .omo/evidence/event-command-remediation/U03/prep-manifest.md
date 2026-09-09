# U03 / G1-F20 RED preparation

- Task: st_01a07642; parent/root: 01a07596-cae4-78dd-be1b-f0bfcd260950.
- Worktree: /home/main/.herdr/worktrees/rpg-zzu/worktree-brave-valley-f078-event-remediation-0906-event-remediation-u03
- Execution base: c66f5a8ac2f61005833783807c40477d045b2b35.
- Phase: RED only. Product source unchanged; no staging or commit.
- H0 is pending in another tree. No H0 imports or new browser helpers.

## Source and integration

Read renderTransferPicker/applyDraft in transferPlayerDialog.ts and transferBody in
commandBodyAdvanced.ts. Traced commandList.ts -> commandEditDialog.ts ->
renderCommandBody -> transferBody -> live picker. The real dialog stages a clone;
same-kind transfer edits update its preview without remounting the form. The picker
compares to the opening command and emits a new object without transition.

The test opens the real command dialog, operates real map/radio/canvas handlers,
uses its real staged command and outer Confirm/Cancel, and commits through
replaceEventPageCommandAt. Persistence uses the actual serialize/deserialize.
The fixture exports buildFixture for later player QA.

Actual type: TransferTransition = "fade" | "mosaic" | "blinds". The authored
fixture uses transition: "fade". Transfer has no duration/time-parameter field at
this base; no invented parameter is included. Initial A is mapA/(2,3)/left/black.

## Harness boundaries

Existing fakeDom is installed with manual animation frames. Image decoding alone
is replaced with a resolved canvas; drawTransferMapPreview remains real and is
spied on before actions. Tests await its exact returned promises under Vitest's
bounded test/hook timeouts. No sleeps or polling. Native radio-group selection is
supplied because fakeDom does not implement that default action. Canvas layout is
supplied at half intrinsic size with an offset; production code converts the click
to map coordinates. No rendered pixels, browser layout, player execution, or full
surface behavior is claimed. No preview/picker/staging/IO implementation mirrors.

## Single requested run

```sh
npm test -- test/eventCommandRemediation/U03.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U03/red.json
```

Run exactly once. stdout/stderr redirected directly to red.log; shell captured
`$?` immediately (no pipeline) and appended DIRECT_EXIT_CODE=1.
Vitest 3.2.4: 9 tests, 7 passed, 2 failed, 0 pending. Six assertion failures.

1. G1-F20 restores A after A->B->A, then Confirm and reload retain A and transition:
   stored and reloaded mapId expected "mapA", received "mapB"; both transition
   values expected "fade", received undefined. Other target values remain
   x=2, y=3, direction="left", fade="black". Four assertion failures.
2. G1-F20 patches a direction edit without losing untouched target, fade, or transition:
   direction="up" and untouched target/fade assertions pass; stored and reloaded
   transition expected "fade", received undefined. Two assertion failures.

Passing characterization: fixture roundtrip validity; mapB/(7,6)/right/white
nondefault edit; one outer Confirm authority and Cancel isolation; no-op open and
Confirm; incomplete empty-map seeding; missing-map fallback to first map; empty
map collection with no rows and inert canvas. Empty-map characterization does not
serialize an invalid empty project or prescribe a new validation policy.

Both added TypeScript files returned no LSP diagnostics. No missing import,
fixture-shape error, timeout, or unhandled-error failure appears in the run.
No tests were suppressed, skipped, or rerun. No product source edits, servers,
browser runs, build, full suite, gates, DB operations, installs, or extra agents.

## Artifacts (SHA-256)

- `test/eventCommandRemediation/U03.test.ts`: `d5f45c1a10defce31c3c6ed79366814fc0b832b136257cf31e32210e95c4f8f8`
- `test/eventCommandRemediation/U03.fixture.ts`: `ab40ce8238e8c200a9ac38b4e2fb8cf29b8c9916191340231234d7a0f984dbfb`
- `.omo/evidence/event-command-remediation/U03/red.json`: `9ee7aea4697b24f37016038724215857d48d478681aa0eec30bd6c898726868f`
- `.omo/evidence/event-command-remediation/U03/red.log`: `da1dddf7c7519e8bf22b8bf12f215a2786adaed0fe53114405c83c776db0b891`

## Resume boundary

RED proof is complete. GREEN/product remediation and full-surface verification
remain pending lead resumption of this same task after H0's disjoint files arrive.
All delivered files are unstaged; .omo evidence follows the existing ignored path.
