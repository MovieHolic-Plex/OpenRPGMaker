# U05 RED preparation manifest

- Task: st_01a0764a; parent/root session: 01a07596-cae4-78dd-be1b-f0bfcd260950.
- Worktree: /home/main/.herdr/worktrees/rpg-zzu/worktree-brave-valley-f078-event-remediation-0906-event-remediation-u05
- Execution base / unchanged HEAD: c66f5a8ac2f61005833783807c40477d045b2b35.
- Status: RED prepared; production remains untouched. Resume this SAME task for GREEN after H0, U02, U03 integrated commits.
- Deliverables: test/eventCommandRemediation/U05.test.ts, test/eventCommandRemediation/U05.fixture.ts, and this directory's red.json, red.log, prep-manifest.md.
- Tests are untracked/unstaged. Evidence is present under the repository's ignored .omo tree; nothing was staged or committed.

## Execution and diagnostics

Executed once:

```sh
npm test -- test/eventCommandRemediation/U05.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U05/red.json
```

- Direct process exit: 1 (also recorded at the end of red.log).
- Vitest 3.2.4: 56 tests, 47 failed, 9 passed, 0 pending; one failed test file.
- Duration reported by runner: 37.44 seconds; test execution 12.73 seconds.
- All failureMessages are AssertionError entries. No import, fixture, parser/schema, timeout, or unhandled-runtime failures occurred in this run.
- Both test files received clean LSP diagnostics before execution. A scoped TypeScript check initially found three fixture/type issues (optional battle progress maps and overly broad M2 fields); these were corrected BEFORE the single test execution. No test retry was needed.
- No product fixes, staging, commits, installs, browser/server runs, database access, full tests, builds, gates, new product APIs, H0 implementation, or extra agents.

## Finding coverage and observed RED

| Finding | Failed / passed | Mechanism and observed result |
| --- | --- | --- |
| G2-F1 | 4 / 1 | Real 092 dialog saves target=actor instead of hero, retains slots, leaves hero commands unchanged and creates actorBattleCommands.actor. Direct old target=actor+actorId execution also creates the actor runtime key. Existing target=hero reopens as party with empty picker; selecting an actor does not synchronize mode. The next real battle command panel has no item control. Deliberate party and unrelated-command targeting are passing controls. |
| G2-F4 | 2 / 1 | Actual changeExp form, operation and actor changes, Confirm, serialize/deserialize, reopen, interpreter. VariableOperand becomes numeric zero: other EXP stays 40 instead of 15; second execution stays 80 rather than reaching lower bound zero. The rendered form has no numeric/variable source choice. Cancel preserves the original operand. |
| G2-F6 | 3 / 0 | Both 014 and 021 switch variable to numeric 10 and Confirm correctly, then reopen as variable because reward remains. A subsequent operation edit rewrites source=variable: attack bonus becomes -92 rather than -3, HP reaches 100 rather than 70 with reward=99. Damage preset 25 executes correctly before reopen but reopens as variable. Untargeted actor values remain checked. |
| G2-F7 | 6 / 1 | Empty/missing state displays and commits first poison chip after operation-only edits. Immediate Confirm accepts invalid IDs. set/toggle display as add and are rewritten to add after an explicit chip choice. Explicit sleep selection and other-actor state preservation pass. |
| G2-F8 | 32 / 6 | Five identity forms plus native learnSkill and EXP traverse real map/common/troop command-list double-click entry and Confirm. Invalid individual selection closes the dialog and persists; identity/EXP runtime assertions show other actor changed. Five identity forms and EXP lack explicit party choices after rendering. Draft validator allows missing actor targets for all five identity commands. Explicit hero identity and learnSkill controls pass with other actor unchanged. |

## Fidelity and boundaries

- happy-dom is the existing unit-test DOM environment, not a launched browser. Production renderCommandBody is reached through openEventCommandEditDialog; callbacks stage real commands and the real Confirm handler decides persistence.
- Map entry uses renderEventEditorDynamic and production page-command actions/store updates. Common/troop entries use their production renderDatabaseCommandListEditor adapter and real command-array replacement. These are command Confirm boundaries, not outer database-modal OK, server, or map Apply tests.
- Missing intended source/party controls are asserted only after the actual form renders. They inspect machine-consumed select option values, not Korean/English prose and not guessed future selectors/APIs.
- Runtime uses createInterpreter with a seeded real session. EXP additionally crosses serialize/deserialize. The battle menu uses createBattleRuntime and commandPanel with deterministic RNG and session battle-command overrides.
- No mocked product forms, validators, interpreter, or replacement actions. No sleeps, polling, skipped tests, or prose assertions. Soft assertions retain independent saved-field and runtime observations in the same RED test.
- Fixtures add distinct hero/other actors and preserve the blank project's existing referenced records. Reward is 25 for EXP and 99 for source discrimination; actor EXP, HP, bonuses, states, names, and command slots are distinct.
- Existing legacy empty-party semantics are not globally changed or treated as invalid persisted data: the tests distinguish intentional legacy support from clearing an individual picker or selecting individual mode with no actor.
- Unexercised follow-through for later GREEN: full browser/visual layout, outer database modal persistence, explicit party/source interactions for currently absent controls, empty-state-database behavior, and the complete inactive EXP numeric/variable draft restoration sequence. These are not claimed as verified here.

## Test artifact SHA-256

```text
501e9eda684f6f8b5396f567611be2837cde202d6707b98e64a2dfa434604614  test/eventCommandRemediation/U05.test.ts
c5fe0bc0cc9f10d9f0332695e1511550096f24b39b142077e803722d960dae41  test/eventCommandRemediation/U05.fixture.ts
```
