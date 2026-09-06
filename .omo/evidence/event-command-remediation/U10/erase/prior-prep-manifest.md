# U10 RED preparation

- Task: st_01a0769c; parent/root: 01a07596-cae4-78dd-be1b-f0bfcd260950.
- Worktree: `/home/main/.herdr/worktrees/rpg-zzu/worktree-brave-valley-f078-event-remediation-0906-event-remediation-u10`.
- Verified execution base: `5c117f0ef993a6cca4bf916dbafe7b361c929be7`.
- Scope: two new tests/fixture files and this evidence directory only. No production changes, staging, commit, browser/server, build, full suite, gates, database access, installs, or extra agents.
- State: RED-only; production remains blocked on H0, U07, U08, U09 and same-task GREEN authorization.

## Delivered files

- `test/eventCommandRemediation/U10.fixture.ts`
- `test/eventCommandRemediation/U10.test.ts`
- `.omo/evidence/event-command-remediation/U10/red.json`
- `.omo/evidence/event-command-remediation/U10/red.log`
- `.omo/evidence/event-command-remediation/U10/prep-manifest.md`

The test files are untracked/unstaged. `.omo` evidence is ignored by repository rules but exists on disk; nothing was force-added.

## Verification

Executed exactly once, without retries or pipelines masking the exit status:

```sh
npm test -- test/eventCommandRemediation/U10.test.ts --maxWorkers=2 --reporter=verbose --reporter=json --outputFile=.omo/evidence/event-command-remediation/U10/red.json
```

Stdout/stderr were redirected to `red.log`; `U10_DIRECT_EXIT_CODE=1` was appended after the process exited. Vitest 3.2.4 reported 26 tests: 18 failed, 8 passed, 0 pending. All tests labeled PASS control passed. All tests labeled RED failed on contract assertions, not import/render/setup failures.

| Finding | RED | Passing controls |
| --- | ---: | ---: |
| G1-F1 | 4 | 3 |
| G3-F19 | 9 | 1 |
| G3-F20 | 5 | 4 |

LSP diagnostics were requested for both files. An intermediate fresh-diagnostics request timed out for both; the final requests after the test run each returned `No diagnostics found`. No build or separate typecheck was run.

## Finding coverage and observed failures

### G1-F1: selected Erase Event

- Real dialog body, real picker change callback, staged command, Confirm, page replacement, project serialization, reopen and Cancel.
- Confirm saves `eventId=selectedOther`; actual `runCommands` -> interpreter -> scene erase consumer instead destroys `host`, removes its sprite-map entry, and leaves selectedOther in runtime views.
- Common-event calls with a host repeat the wrong-host mutation. Standalone common calls leave the explicit selected target visible.
- Unknown selected ID is retained on edit, but runtime incorrectly erases host.
- Passing controls: staged Confirm/reopen/Cancel roundtrip; deliberately selecting the existing current-event option erases only host; standalone current-event with no host changes no event.
- Temporary erase is checked separately from persistent removed-event state.

### G3-F19: Spawn Event identity

- Real body renders before control assertions. Existing catalog field controls are discovered by field-key test-ID prefix, not invented new control IDs.
- New-instance control is currently SELECT, expected INPUT; template control is currently INPUT, expected SELECT. The controls are separately located.
- New-command defaults are deterministic but empty after real Confirm. Blank runtime instance ID creates an empty-key instance even when the conventional template-derived ID is already occupied.
- Authored collisions with host, template, and a remote authored event mutate event locations/spawn records/runtime views. Runtime-instance collision overwrites the existing clone's map and coordinates.
- Real draft validation accepts a fresh ID (control) but also accepts collision with host (RED).
- Passing runtime control uses two clones on different destination maps, a third map for the template, and verifies template graphic inheritance, real blocking lookup, action-trigger lookup, executing the clone's commands, and unchanged template view/location.

### G3-F20: Remove Event identity and owner map

- Real form cannot accept a previously authored Spawn command's runtime ID when creating a Remove command: only authored records are available.
- Unknown IDs survive Confirm/reopen/Cancel and serialization; real draft validation emits no command diagnostic for the unknown ID (RED).
- Selecting the authored remote event and executing its saved command writes removal to HOME instead of AWAY. The target remains visible before and after actual save/load.
- The remote-map test's additional soft `toContain` assertion receives undefined for the absent AWAY list. This is redundant evidence of the same missing owner-map state; independent view, wrong-map, and restored-view assertions also fail in that test.
- Omitting a target removes host despite no explicit current-event mode. Blank selection is a passing no-mutation control.
- Unknown runtime ID creates a removal tombstone/runtime event entry instead of preserving identity state (RED).
- Passing controls include explicit authored host removal, remote spawned-instance removal, save/load after removal, and delete/recreate under the same ID.

## Fixtures, boundaries, and limits

- HOME `map_intro`: host at (2,2), selectedOther at (4,2).
- AWAY `map_12`: otherMapEvent at (7,5).
- LIBRARY `map_templates`: templateA at (1,1), bundled graphic, action trigger, switch-setting page command.
- spawnA at (4,3), second clone on AWAY, unknownEvent, and u10_common are distinct identities. Session randomness uses seed 10; IDs/coordinates/assertions do not depend on time or random generated map IDs.
- `installFakeDom` supplies only the DOM boundary. Native select value restrictions are explicitly checked before dispatch, preventing arbitrary unknown-value injection into a select from producing a false pass.
- Scene fixture supplies graphical sprite destroy hooks, dialogue registry methods, and surface-refresh no-ops. It does NOT mock interpreter execution, erase/remove mutation, sprite-map deletion, runtime views, collision lookup, trigger lookup, project IO, or save slots.
- Sprite pixels and a real Phaser renderer are not exercised. Spawn graphic inheritance is asserted through runtime views; Erase sprite destruction/deletion is exercised through the actual scene consumer.
- No sleeps, polling, skipped tests, prose assertions, or custom mutation replicas. Async scene commands are awaited directly with Vitest's bounded test timeout.
- The existing Erase picker explicitly encodes current-event as empty; that actual encoding is used only after deliberately selecting its existing current-event option. Remove's blank picker option is not treated as current-event. No new Remove target-mode field/control/sentinel was invented. Explicit authored-host deletion is covered; a future distinct Remove current-event UI mode and missing-host visible validation remain for GREEN implementation/authorization.
- New Spawn/Remove UI contract tests intentionally stop at their failing rendered-control assertions; downstream authored input/Confirm behavior is not claimed as currently passing.

## Artifact hashes (SHA-256)

```text
d1d95685f907e7fae160da873abbf6ed8a092f8b4ef1ea91930563a54cc2c842  test/eventCommandRemediation/U10.test.ts
6e3ca0bc140a7a00bac89619c88da4a715d3f4d732d0b3864ed63483bb7751aa  test/eventCommandRemediation/U10.fixture.ts
8e0d1c82d4aa62c711161a424e2a336a8152c21aa0330722ec9b4d34572751c6  .omo/evidence/event-command-remediation/U10/red.json
c6c817db4572119d6bb6cd0c23f309421a9d5170d21deb7fb49375168f66f518  .omo/evidence/event-command-remediation/U10/red.log
```
