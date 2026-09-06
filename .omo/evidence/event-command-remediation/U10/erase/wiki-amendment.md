## Selected Erase Event handoff (2026-09-06, G1-F1)

Suggested location: `openwiki/runtime-m2-flow-controls.md` (lead owns the shared wiki lock).

`commandBodyM2.eraseEventCommandBody` already saves `fields.eventId`, retaining unknown target options and unrelated fields. `commandCatalog.executeM2Command` must pass that selected ID to the `eraseEvent` step, falling back to the current host only for the existing empty/omitted current-event encoding. The scene consumer temporarily erases that ID and destroys its sprite; it does not persist a Remove Event tombstone. Unknown IDs do not erase another event. A map reload restores temporary erasure.

Regression: `test/eventCommandRemediation/U10.erase.test.ts` retains the original seven G1-F1 assertions, including real `runCommands` scene consumption, selected targets in common frames with and without a host, explicit empty/current-host, and no-host safety. Real Firefox editor proof uses Confirm -> parent Apply -> reopen -> changed draft -> Cancel -> file export/import. Dedicated `player.html` runs the exact exported erase payload and proves actual sprite presence/absence plus the following marker; common-host, current-host and unknown-target cases are included. This does not add or promise editor context plumbing or parallel/common scheduler support.

Replay: `node node_modules/vite-node/vite-node.mjs --script test/eventCommandRemediation/U10/replay.mts`. No remote persistence or authored DB content. G3-F19/G3-F20 remain pending and outside this source change.
