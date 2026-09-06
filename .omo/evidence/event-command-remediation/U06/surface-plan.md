# U06 exact surface scenarios (pinned before execution)

## Commands
- Unit/adjacent GREEN: `npm test -- test/eventCommandRemediation/U06.test.ts test/monsterPartyFollowers.test.ts test/followerPresets.test.ts test/eventEditorRichForms.test.ts test/eventEditorStagedState.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U06/green.json` (52 passed, exit 0).
- Editor + player: `U06_STANDALONE=1 bun run test/e2e/event-command-remediation-U06.spec.ts`. The runner creates a uniquely named evidence run directory; strict ephemeral editor port, owned cache directory, Firefox. Player subprocess: `node scripts/qa/runtime/event-command-remediation-u06.scenario.mjs <editor-exported.json> <run-directory>`; standalone player.html via H0.
- Pure fixture: `node node_modules/vite-node/vite-node.mjs --script scripts/prepare-event-command-remediation.mts U06 <owned-directory>`.

## Editor
H0 enterLocalEditor, remote persistence disabled and guarded. Fixture has five command rows in u06-host: named Alice removal; named Bob removal; actor Hero+custom graphic; same with scale2; graphic-only Mascot. Start is on the below-priority action event at2,3.
1. Row0: choose name via visible custom select. Empty then whitespace input; Confirm each must leave dialog connected, focus name, native validity false, canonical project unchanged. Correct to spaced Bob; Confirm->parent Apply saves only name Bob.
2. Row1: choose explicit all with visible select; Confirm->Apply saves all:true.
3. Row2: checkbox off; Confirm->Apply deletes graphic while preserving Hero/actor_hero; reopen checkbox false; discarded rename via Cancel preserves saved command.
4. Row3: edit uploaded frame2->1, directionleft->up; off, edit name Hero->Hero renamed, on. Same DOM input identity and edited inactive controls survive. Confirm->Apply preserves scale2 and all unrelated fields; reopen matches. Cancel after off/name edit leaves saved graphic intact.
5. Row4: unchanged graphic-only Mascot Confirm->Apply retains full graphic. Reopen and Cancel.
Every saved row: geometry/screenshots at1024x768,1280x800,1440x900; no dialog horizontal overflow, Confirm/Cancel within viewport, name focus measurable. Real project menu export download .oprn; parse downloaded package, assert saved payload equality. Actual filechooser imports the downloaded .oprn; reopen every command and check saved values/Cancel again. Do not call editor play.

## Player
Use exact downloaded editor commands with explicit QA-only setup and text barriers. Start by Enter. Action Z creates Alice(actor_hero), Bob(actor_u06_bob), and real giveMonster M, then READY barrier. Subsequent Z executes saved Bob removal -> Alice/M only; saved all -> M only; saved Hero graphic-off -> Hero actor-default/M; explicit QA actor clear then saved graphic-only Mascot -> Mascot custom uploaded graphic/M; explicit clear then saved edited Hero -> Hero renamed actor-default/M. Assert exact followers (IDs/names/kinds/graphics), retaining the same M object. All steps subscribe through H0 before keys, bound 15s (boot120s). Capture each barrier and final player geometry/screens at the three viewports. No editor shell. Wrong-target negative expects Bob after named removal and must reject with actual Alice/M. MonsterParty/monsterInstances deep-preservation is additionally covered by real session integration tests; the H0 runtime-state mirror exposes followers, not those two collections. No fabricated actor custom-override claim: actor defaults take precedence; custom graphic runtime proof uses the graphic-only Mascot.

## Corrections/limitations
Original RED refresh:3fail/7pass. Added unrelated scale discriminator:4fail/7pass, scale2 absent on reload. Two hand-written patch attempts had malformed hunk counts and changed no production bytes; corrected patch applied cleanly. First malformed test patch was followed by an unchanged original10-test execution (red-preservation.*); corrected11-test RED is red-preservation-corrected.*. All receipts retained.
Existing commandBodyAdvanced.ts is oversized. Explicit symbol ownership prohibits restructuring it in U06; no imports/helper/other body edits. Unit file234 pure LOC is in warning band; no further unrelated cases added there.

Browser attempt1 correction: editor-failure.txt shows the parent inspector and modal both render follower controls. The identity assertion used document-global querySelector and compared the modal handle against the inspector. Scope the comparator to event-command-edit-dialog; preserve connected and same-node requirements. Production unchanged. Port41769 closed and owned cache removed.
