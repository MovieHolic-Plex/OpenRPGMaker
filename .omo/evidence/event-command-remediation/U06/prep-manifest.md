# U06 RED preparation

- Task: st_01a07671; parent/root: 01a07596-cae4-78dd-be1b-f0bfcd260950.
- Worktree: /home/main/.herdr/worktrees/rpg-zzu/worktree-brave-valley-f078-event-remediation-0906-event-remediation-u06
- Execution base: 8a89876212ef031f927e5f66f9b2157f09d37d96.
- Scope: new tests, fixture, and evidence only. No product edits, staging, commits, installs, DB access, browser/server launch, full suite, build, gates, or extra agents.
- Product implementation is deferred to same-task GREEN resumption after H0, U02, and U05 dependencies. These tests do not import H0 or add browser APIs.

## Deliverables

- test/eventCommandRemediation/U06.test.ts
- test/eventCommandRemediation/U06.fixture.ts
- .omo/evidence/event-command-remediation/U06/red.json (native Vitest JSON reporter output)
- .omo/evidence/event-command-remediation/U06/red.log (stdout/stderr and directly captured exit)
- .omo/evidence/event-command-remediation/U06/prep-manifest.md

The test/fixture files are untracked and unstaged. Evidence is under the repository's ignored .omo directory and is also unstaged; delivery must preserve those on-disk files explicitly.

## Read and exercised seams

- Read exact existing addFollowerBody and removeFollowerBody in src/editor/panels/eventEditor/commandBodyAdvanced.ts.
- Traced openEventCommandEditDialog -> renderCommandBody/renderAdvancedCommandBody -> actual form change callbacks -> staged replaceCommand -> actual Confirm/onApply or Cancel.
- Confirmed commands are written to the fixture event and passed through production serialize/deserialize before replay/reopen.
- Player-side execution uses production createInterpreter -> commandCatalog -> real follower session functions, with production startSession and giveMonster setup.
- DOM execution uses the installed happy-dom Vitest environment and real dialog/controls/custom selects; no product modules or callbacks are mocked. Checkbox input uses click; text/select changes dispatch their actual change events synchronously. No sleeps, polling, skip markers, or prose assertions.
- Every dialog test verifies the actual form body rendered before locating the intended controls. Teardown closes the real dialog through Cancel and verifies the modal stack is empty.
- This is an existing-form/session integration test, not a browser-rendered Player proof. No browser pixels or visual appearance were verified.

## Fixture decisions and corrections

- Alice uses actor_hero; Bob uses actor_u06_bob, a clone of the real default actor record. Reusing one actor ID would replace the first follower and invalidate the removal test.
- M is created by the real giveMonster interpreter command from species_wild_slime, not a fabricated RuntimeFollower. Tests verify actor/monster kinds and distinct IDs before execution.
- charsetB is an uploaded sprite with a valid three-pixel PNG and three 1x1 frames. EventPageGraphic uses sprite: { type: "uploaded", id: "charsetB" }, direction: "left", pattern: 2, transparent: false. Raw frame 2 belongs to uploaded mode; bundled graphics compute sheet indices through charsetFollowerGraphic instead.
- Default actor graphic comparison uses the actor's actual characterResourceId and charsetFollowerGraphic, not guessed asset IDs or frame arithmetic.
- Runtime nuance: followerFromInput already prefers an actor's default character graphic over command.graphic. Therefore G5-F5 is RED on saved graphic deletion and reopened checkbox state, not on actor appearance. The actor-default session assertion passes; a separate graphic-only follower characterization proves that the custom graphic survives serialization and is usable by the real follower session.
- No post-run fixture/test corrections were needed. Type diagnostics and the sole requested test execution used the delivered test/fixture content.

## Verification

LSP diagnostics: no diagnostics found on either U06.test.ts or U06.fixture.ts.

Executed exactly once:

```sh
npm test -- test/eventCommandRemediation/U06.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U06/red.json
```

stdout/stderr were redirected directly to red.log; `$?` was captured immediately after npm returned, appended as `DIRECT_EXIT=1`, and propagated by the shell. No tee/pipeline exit substitution.

Result: 10 tests, 3 failed, 7 passed; direct exit 1. All failures are the intended U06 findings, not missing controls, imports, fixture initialization, or teardown errors.

## G5-F3: faithful RED

Both empty string and three spaces in visible name mode:

- Expected no applied command; received [{ kind: "removeFollower", all: true }].
- Expected persisted command not to have all:true; received { kind: "removeFollower", all: true } after serialization/reload.
- Expected unchanged followers Alice/Bob/M after rejected Confirm; real interpreter execution of the incorrectly accepted command left only M (monster:monster_1), removing both actors.
- Expected the dialog to remain connected for correction; received false because Confirm closed it.
- The same-dialog Bob correction tail is consequently not reached on RED. It remains executable for GREEN. Independent passing coverage confirms trimmed Bob round-trips as one named target and removes only Bob while preserving Alice and M.
- Passing edge coverage: explicit all removes only actors and preserves M, monsterParty and monsterInstances; reopening reports all mode; Cancel after invalid name does not persist; Cancel after staging all preserves the prior named removal.

## G5-F5: faithful RED

After unchecking an existing custom graphic and Confirm:

- Expected { kind: "addFollower", actorId: "actor_hero", name: "Hero" } with no graphic property.
- Received the same actor/name plus graphic: { sprite: { type: "uploaded", id: "charsetB" }, direction: "left", pattern: 2, transparent: false }.
- Expected reopened use-graphic checkbox false; received true.
- Passing edge coverage: edited inactive draft survives off -> unrelated name edit -> on in the same dialog (charsetB, direction up, frame 1); initially absent graphic stays absent; Cancel preserves the original command; unchanged custom graphic round-trips and drives a graphic-only follower.

## Handoff

Both finding IDs have faithful RED. Preserve the seven passing characterizations. No product fix or GREEN claim is included. Resume this same task for GREEN only after dependency clearance.
