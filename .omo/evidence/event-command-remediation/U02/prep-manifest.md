# U02 RED preparation

- Task: st_01a0763a. Base: c66f5a8ac2f61005833783807c40477d045b2b35.
- Status: RED prepared; no production changes, staging, commits, H0 imports, browser specs, installs, or remote DB operations.
- Files: test/eventCommandRemediation/U02.test.ts and U02.fixture.ts.
- Final run: 31 tests, 22 RED, 9 passing characterizations; exit 1. Both final files have clean LSP diagnostics.
- Command: `npm test -- test/eventCommandRemediation/U02.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U02/red.json`.
- Evidence: red.json, red.log, red.exit, red-command.txt (command and final file hashes); red-G1-F*.json extracts retain each finding's complete assertion failures.

| Finding | RED / pass | Observed failure |
| --- | --- | --- |
| G1-F4 | 4 / 2 | Text loses speaker/emotion/autoAdvance; latest child and sibling changes revert; nested break hides outer warning; no full child editor. |
| G1-F5 | 8 / 0 | Target picker restores >=10 rather than <=50; switch/actor reset false to true; all/any/not repeat loss; eval data stays false; another dialog imports value 917. |
| G1-F13 | 2 / 3 | Timer identity edit adds seconds=60 and resets remaining17 to60; stop seconds editor remains active. |
| G1-F14 | 4 / 1 | Nonempty branch disappears without consent; deleting A retains choice2 and runs C rather than B; focus not restored; deleting B silently removes cancel destination. |
| G1-F15 | 4 / 3 | Rendering selects first; Confirm applies and closes for empty/missing destination, including an actually empty variable catalog. |

## Seams and corrections

- Real happy-dom forms/dialogs, real staged callbacks, existing parser/interpreter contract harness; only host action recording uses spies.
- F5 original runtime other=40 cannot distinguish >=10 from <=50. Also execute other=5, which produces ELSE incorrectly. Preview independently uses start-session zero values.
- F14 remove-1 is one-based and deletes A. Identity/focus cases empty A's branch to isolate them from the separate nonempty-branch consent case. Interpreter receives an already resolved index; real Escape is not exercised.
- F4 full child editing stops at the correctly missing intended control. Child cancel, complete nonempty deletion accept/cancel, explicit new resume control, and browser/player surfaces remain for post-H0 work, not claimed as verified.
- Initial capture had an invalid native comment fixture (later LSP caught it) and a false empty-catalog setup (store restores definitions from session). Final fixture uses a valid text marker and clears session variables, asserting catalog emptiness.
- Initial digit-chip failure was happy-dom label MouseEvent activation: minimal reproduction calls both chip3 and chip1. red-happy-dom-label.log records it. Final test dispatches Event(click) to the real chip callback; digits/target/parser/input-resume characterization passes.
- red-initial.* and red-second.* are historical diagnostics, not acceptance evidence; red.json is authoritative. Three runs reflect diagnosed fixture/platform corrections, not timing retries. No sleeps or polling were added.
- Requested monitor and apply_patch were unavailable in this child. Used bash process capture and installed patch utility for test creation; targeted edits used edit.
- Evidence directory is ignored by git; files exist locally and remain unstaged. Resume this same task for GREEN only after lead integrates H0.
