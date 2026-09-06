# U05 genuine new production-owner blocker

Task st_01a076b2; parent/root 01a07596-cae4-78dd-be1b-f0bfcd260950. HEAD remains 9c14cfdefbcfc9a71c5ba1149f35600f413777fc. No commits.

## Authorized driver corrections implemented

- U05 visible-control driver reads actual option indexes; clicks rich segment buttons with source-defined amount keys (=set, +=inc, -=dec); opens enhanced select trigger/popover; uses native selectOption only for actually visible selects. No force or direct DOM value assignment.
- Shared test/e2e/eventCommandRemediationHarness.ts openDatabaseCommand now expands System/common or Monster/troop group before clicking hidden tabs. Local duplicate removed. No other shared helper edits.
- Original hidden-select and collapsed-group failures retained as driver-hidden-select-red.json and driver-collapsed-group-red.json.
- Runner owns normal Node Vite + child lifecycle, records full list/JSON output and copies artifacts before cleanup. No child outer deadline. Prior exit-null was my SIGTERM interruption, not an inferred deadline.
- One Vite dependency preflight (`vite optimize`, process completion, same owned cache) eliminates the reproduced cold-start readiness failure without a fixed wait or test retry. Vite emits its deprecation notice; it is retained in logs. No application build/full gate.

## Proven browser actions

`editor-visible-map.log` / report: corrected visible 092 target/actor/command controls, incomplete actor Confirm rejection, Confirm -> map Apply, actual target hero+retained slots, and reopening passed. The first subsequent failure is EXP inactive-source restoration, not hidden controls or boot.

`editor-state-proof.log` / report: both real Firefox missing-state cases passed in one run (2/2): empty and missing_state survive, operation-only edits do not select poison, Confirm rejects unresolved states, explicit sleep chip preserves set, map Apply succeeds and modal closes. Page action subscriptions are established before inputs. No remote writes observed.

## Exact new host scope needed

File: src/editor/panels/eventEditor/commandEditDialog.ts, function shouldRerenderCommandForm, existing changeExp branch around lines312-318.

That branch returns true on amount source, operation, or party/individual mode changes. replaceCommand calls renderEditor, which removes the entire form and reconstructs it using only the active VariableOperand. The owned changeExpBody already updates its own source visibility and preview and retains inactive values locally. Host remount discards reward and numeric31 and destroys the focused/control nodes.

Smallest extension: allow the mounted changeExp form to own these ordinary field transitions by returning false for same-kind changeExp. Do not change other command kinds or host APIs. A form-only cache would not satisfy the stable-node requirement and would hide rather than fix the ownership mismatch. No host edit made without approval.

## RED evidence for host correction

- exp-mounted-draft-browser-red.json: real source segment clicks number31 -> variable produce empty variable picker, expected reward. Page errors []; 092 map save trace succeeded before this failure.
- editor-visible-map-report.json: full Playwright code1/signalnull, real locator/actions and stack.
- Added one deterministic follow-through test in owned U05.test.ts, appended after all original tests. It asserts identical numeric/source nodes, reward restoration and numeric31 restoration.
- Ran filtered new test once: npm test -- test/eventCommandRemediation/U05.test.ts --maxWorkers=2 -t 'mounted inactive EXP drafts'. Result: one failed test with four assertion failures (two node identities; empty vs reward; 0 vs31), no import/timeout error. Other 56 cases were deselected by -t, not deleted or marked .skip. Original 88 assertions/cases were not weakened. Full required suite must run after host fix.
- Log: exp-mounted-draft-unit-red.log.

## Diagnostics and cleanup

- Final scoped compiler: 9 production/test/helper files, zero syntactic/semantic diagnostics (diagnostics-owner-blocked.log). LSP clean for changed helper/spec/test. Scenario node --check and git diff --check pass.
- Owned ports39957/33951/46513 processes exited; per-run cleanup receipts present. No owned QA server remains. Temporary root contains only fixtures and Playwright artifacts, no Vite cache directories. Browser contexts closed by completed Playwright workers.
- Player scenario is implemented and syntax-checked but not executed: final editor-map wire export is intentionally unavailable while real editor acceptance fails. No claim of player GREEN or five-case editor GREEN.

## Unapplied wiki amendment

U05 remains incomplete. Original 47 behavioral RED failures plus9 controls retain their provenance; required88-case unit command previously passed. Corrected visible-driver 092 map save/reopen and two real unresolved-state authoring cases now pass. A newly covered EXP inactive-source transition exposes a host remount defect: reward becomes empty and numeric31 becomes0, with control node replacement. Correction requires same-kind changeExp remount-policy ownership in commandEditDialog.ts. No finding closure or verified commit until that fix, full editor five-case run and dedicated player outcomes pass.
