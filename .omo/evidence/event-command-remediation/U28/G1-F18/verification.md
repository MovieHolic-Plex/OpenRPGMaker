# G1-F18 verified slice

Scope: G1-F18 only, on `agent/event-remediation-text-tools`, base `a9dcbf32c`.
All other U28 raw findings remain open. No runtime grammar, migration, database
content, shared H0 harness, dependency or global snapshot changes.

## Outcome

The name/value tools defer insertion until the existing picker selects a record.
`Other` and `Reward` produce `Hello\n[2]\v[2] world`, retaining the caret at 15,
speaker Narrator and emotion happy. The real downloaded native payload renders
`HelloOther29 world` in dedicated `player.html`, not First Hero or 11.

Final executable gate:

```sh
U28_TEXT_STANDALONE=1 bun run test/e2e/event-command-remediation-U28-text.spec.ts
```

Direct exit **0**, `surface-final.log`. Final evidence: `surface-Ilc39i/`.
Two editor cases passed, plus player title/three beats and two deliberately wrong
target observations rejected. No retries or polling loop is in the runner.

## Coverage and receipts

- `surface-Ilc39i/native/editor-observations.json`: selected range replacement,
  picker Cancel with range/focus intact, visibly disabled `legacy_reward` and
  shadowed `v2` with inline reasons, actual picker creation of Fresh reward in
  canonical empty `var_0003`, then Other/Reward insertion. Native actor ordinal 2
  is Other, distinct from First Hero. Variables 1/2 are 11/29.
- Both native and raw209 cases: visible command Confirm -> parent Apply -> reopen
  -> different body edit -> Cancel -> parent Apply. Entire canonical project
  equality proves unrelated data and metadata retained. Actual menu download of
  `.oprn`, actual filechooser import, then reopen and Cancel.
- `surface-Ilc39i/raw209/boot.json`: input is the raw M2-209 wrapper; the actual
  editor boot's ProjectStore.load produces native text and preserves speaker,
  emotion and `autoAdvance: true`. Only saved canonical data is reimported.
  **No claim of raw209 immediate-import normalization.**
- M2-001's real command picker produces native text in the inherited U28 unit
  test; no stored M2-001 wrapper compatibility behavior is changed.
- `surface-Ilc39i/player-inputs.json`: entire original native command is retained
  unchanged in the QA program. Separate setVariable commands establish 11/29,
  READY/DONE commands are explicit barriers, and only the QA host trigger changes
  to existing `auto`. No mock interpreter result or editor play mode.
- `surface-Ilc39i/player-observations.json`: pre-trigger H0 subscriptions establish
  READY/11/29, `HelloOther29 world`, then DONE. `player-negative.json` rejects
  First Hero with correct value and Other with first value independently.
- Editor receipts and `player-geometry.json`: 1024x768, 1280x800, 1440x900;
  horizontal overflow false, positive in-viewport action/dialogue/canvas bounds,
  textarea/picker focus recorded, observations released. Final editor and player
  page-error arrays and remote-write arrays are empty.

## Reused verification, pinned to unchanged bytes

The four source/test blobs in `lead-handoff.json` matched before takeover and
again after the surface run. They are unchanged by this verifier.

| Gate | Evidence | Result |
| --- | --- | --- |
| Original insertion RED | red.json | 2 genuine failures before picker selection |
| Availability RED | availability-red.json | 4 failures, 8 passes |
| U28 unit GREEN | edge-green.json | 12 passed, 0 failed |
| Nine-file adjacent target | adjacent.json | 51 passed, 0 failed |
| App typecheck | lead-handoff.json | inherited direct exit 0 |
| App build | lead-handoff.json | inherited direct exit 0, 38.05 seconds |
| New spec/scenario diagnostics | tool results, recorded in source-manifest.json | no diagnostics |
| Scenario syntax | node --check scripts/qa/runtime/event-command-remediation-u28-text.scenario.mjs | exit 0 |
| Patch whitespace | git diff --check | exit 0 |
| Final combined surface entry | surface-final.log | direct exit 0 |

The original RED receipts, unsuccessful basic-green receipt, corrected fixture
receipt and lead handoff are retained. No unchanged unit target or app build was
rerun merely because responsibility moved to this verifier.

## QA corrections and limitations

1. Attempt 1: boot observation timed out before the original catch boundary;
   no page-error evidence was captured. Cause unconfirmed; not a product RED.
   The catch boundary was widened to retain future boot failures.
2. Attempt 2: a text-tool testid existed in both inspector and dialog. Scoped the
   test locator to the actual command dialog; no production change.
3. Attempt 3: real boot normalized 20 canonical variable slots. The picker reused
   the empty slot 3, visibly named Fresh reward, instead of appending at index 22.
   Corrected the observation's array position, retaining the exact ID/name/token
   assertions. Failure capture also records the pre-existing absent local AI
   companion CORS noise; it is not a project-write or page exception.
4. Attempt 4: both editor cases passed but the outer tool's 360-second deadline
   killed the process during player verification. No successful direct exit is
   claimed for that attempt. Its owned orphan cache/input directories were removed.
5. Isolated player attempt `player-only-KiUjXL`: actual player rejected QA-only
   `autorun` with its allowed-trigger error. Corrected to existing `auto`; the
   unchanged editor-exported text was not altered. `player-only-sx7Kpv` then
   passed with direct exit 0. The final combined run also passed with direct exit 0.

Browser navigation is explicitly bounded at 120 seconds, independently of the
15-second action timeout; all observations are armed before their triggering
input. Wrong-target timeouts are intentional negative tests, not sleeps.

Read explicitly reported that this model cannot view PNG pixels. Screenshots
exist locally but are not committed; **no pixel-level visual PASS, Lighthouse
score, cross-browser claim or independent visual review is asserted**.

## Post-write review and cleanup

New QA files own editor verification and player verification respectively,
197 and 118 pure LOC. The inherited fixture is 52 LOC; U28.test.ts is 216 LOC
(warning band: split before extending beyond this slice). The inherited
commandBodyCore/recordPickerPanel modules are 1179/384 LOC; structural refactoring
is outside this explicitly narrow authorization and their verified bytes were
preserved. New QA helpers are reused, have at most three inputs, add no type
assertions/non-null assertions, no tagged-union fallback, no production defensive
layer, no parameter reassignment, no negative-form domain names and no logging
changes in production. File import uses the real package parser; player input
must pass the real player codec. There are no mocked business outcomes or test
imports of ignored evidence modules. The final narrative exercises real observable
outcomes rather than implementation prose. Cleanup calls trust their contracts;
no destructive-action re-query was added to product code.

Final server/browser cleanup: `surface-Ilc39i/editor-cleanup.json` and
`player-cleanup.json` (ports 43877/35271). Owned runtime input/cache directories
were removed by finally. The interrupted-run directories and inherited
`/tmp/event-remediation-text-tools-build` plus its cache path were removed with
exit 0 (`cleanup.log`). A final socket check found no listeners on final,
interrupted or isolated-player owned ports. Only explicit required receipts are
force-added; screenshots, downloaded packages, large exported fixture copies,
Vite caches and temporary runtime fixtures remain outside the commit.
