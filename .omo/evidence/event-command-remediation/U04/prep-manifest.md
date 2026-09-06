# U04 RED preparation

- Task: st_01a0763b. Base: c66f5a8a. Tests/fixtures only; source unchanged, nothing staged or committed.
- Files: test/eventCommandRemediation/U04.test.ts and U04.fixture.ts.
- Execution: `npm test -- test/eventCommandRemediation/U04.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U04/red.json`.
- One run: exit 1, 28 tests, 14 failed / 14 passed. Both test files returned no LSP diagnostics.
- Evidence: red.json (full machine report), red.log (verbose output and exit code), red-summary.json (finding-to-test mapping and test file hashes).
- G3-F10: 6 failed / 6 passed. Coordinate changes lose authored true AND false at durations 500 and 0; saved/deserialized commands omit waitForPicture and interpreter steps carry undefined. Untouched transforms, omitted cases, parser/interpreter baselines, and Cancel pass. Two additional RED cases require the absent wait control.
- G5-F2: 8 failed / 8 passed. Omitted wait and skippable each open off despite interpreter defaults true. Resource changes and explicit selections lose false in all three combinations containing false; deserialized interpreter steps incorrectly resolve those fields to true. The true/true combination, parser/interpreter baselines, Cancel, and media URL preservation pass.
- Seam: real openEventCommandEditDialog -> native form callbacks -> staged replaceCommand -> real Confirm -> serialize/deserialize -> real dialog reopen/Cancel -> createInterpreter. Only onApply is a spy; no production module mocks, H0 dependencies, sleeps, polling, browser specifications, or runtime scenarios.
- Scenario correction: supplied # selectors are existing data-testid selectors, not DOM IDs. Native segmented controls are exercised through their real segment buttons/change handlers. show-picture-wait-select and its segments are the intended new control API, following movie/animation conventions; no picture wait control exists at this base.
- Media fixture embeds the existing shipped sample-movie.webm bytes in two independent resource IDs rather than using truncated fake WebM bytes. URL round-trip is tested, not browser decoding.
- Deferred to lead after H0: actual picture transition/sentinel timing; movie wait:false continuation, Escape/non-skippable behavior, ended/error/abort cleanup, browser media decoding and PLAYER_ENTRY. Interpreter resume here is explicit and is not evidence of player timing.
- Adjacent test warning: test/playMovieEditorBody.test.ts currently expects false omission; it was read but not changed or run under this RED-only scope.
- Tool limitation: tool.monitor and tool_schema/eval are not exposed to this child. The exact requested test command ran through functions.bash with pipefail/tee and its exit code recorded. apply_patch was available at /tmp/concept-first-tools/apply_patch.
