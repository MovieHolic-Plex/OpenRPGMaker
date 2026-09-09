# T17-AV-1: full canonical projection boundary

Task: st_01a0822b. Base: `fc5c56e3f1f22164c12f20dc430aa281a8be72c7`.
Worktree: `/home/main/z-project/rpg-zzu-tile-to-world/.omo/worktrees/spatial-ai-projection-fix`.
Adopted using the repository worktree tool (port 9841); no server started.

## Result

`assertSpatialToolChange` now calls the existing `validateSpatialProject` with the
checked document and the actual proposed project, before the unchanged-document
return. Both `commitChangeset` and `assertSpatialToolAcceptance` already call this
seam before baseline lint subtraction or history/store writes. No caller edit was
needed. The patch is one import, one validation call and an explanatory comment.

The domain's `checkedDocument` checks schema/references but intentionally lacks the
full mapConnection projection check. Previously, lint only observed the latter
through deserialize, and baseline subtraction could waive its identical error atom.
The new call preserves the existing authority/fingerprint checks and unrelated
legacy lint tolerance. It validates the output, not the broken input, allowing
actual repairs rather than permanently blocking a damaged project.

## Original evidence (read only, not modified)

Directory: `../independent/` in the `spatial-ai-tools` worktree.

- `AdversarialVerify.json`, finding `T17-AV-1`:
  SHA256 `4de4506728ea809d2ebd2ee676ee7f949f77d744f8b9258a7e2e930d2c9a31a0`.
- Exact public-runner probe `followup-probes.mts`, `registered-connection-preexisting-projection-error`:
  SHA256 `aefe78365d8ba5b99b35afd9e027d8510644422d823d6b5bcee518821eda3e00`.
- Compiler fixture/control probe `overview-probes.mts`:
  SHA256 `9dc120cd4eb0c785271b5078194305303bf2e3dd4704e6814ff8c88cc367ad5d`.

No original source, fixture, compressed snapshot or evidence was rewritten.
The permanent test regenerates the actual compiler fixture instead of copying an
opaque snapshot: `compileSpatialOccurrence(geographyFixture("region", 109),
{ occurrenceId: geographyRoot })`. Each case first proves this compiler output
deserializes, then explicitly adds its corruption.

## RED

`red.log`, monitor `mon_TDQHWXAQNYW2V6TR`, exit **1**, not timed out.

Command under the shared asynchronous monitor:

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock timeout 120s npm test -- test/spatialToolProjectionBoundary.test.ts --maxWorkers=1 --no-file-parallelism
```

**3 failed, 4 passed (7).** The exact registered `upsert_map_connection` NPC toggle
on an already-invalid named entry returned `runner=true`, `accepted=true`,
`spatialUnchanged=true`, `undo=true`, `undoNpcEnabled=true`, `redo=true`,
`redoExact=true`. Published deserialize failed:

```text
spatialAuthoring.overviewEntries.spatial-enter:23:geography-contract-root:55:port:40:child:23:geography-contract-root4:west:05:entry.mapConnection: missing exact enabled projection
```

The independently issued invalid entry and return acceptance cases also failed.
Clean-baseline rejection, missing-event control, genuine repair and unrelated
start-position lint tolerance already passed. This is not a claim that the bug
corrupts an initially clean baseline: the existing invalid name is explicit setup.

## GREEN and validation caveat

`green.log`, monitor `mon_FD2NWSGS54Q26NV2`:

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock timeout 120s bash -lc "npm test -- test/spatialToolProjectionBoundary.test.ts test/spatialToolAcceptance.test.ts test/spatialTools.test.ts --maxWorkers=1 --no-file-parallelism && npm run typecheck:app"
```

**27 passed (27), 3 files passed**, in one Vitest execution after the patch:
7 new boundary regressions, 7 existing shared-acceptance tests, 13 existing spatial
tool tests. The `&&` advanced to typecheck, proving the test command exited zero.
The new regression now rejects the same public write without changing draft/store
or creating history; the valid repair publishes reloadable data with exact undo
and redo. The separate acceptance cases issue proof with the real begin/seal
helpers to model an old-runner proposal; they do not claim a provider can forge
private proof. The exact public-runner test uses no private proof setup.

**The compound command exited 124**, not zero: tests took 85.28 seconds and the
shared 120-second budget expired during the following app typecheck. The raw log
is retained, not represented as an entirely successful compound run. No tests were
rerun, no assertions suppressed, and no timeout increased.

`typecheck.log`, monitor `mon_PQZF1ZCAYWYSHGAP`, then completed **exit 0** using the
same 120-second bound, separated from the completed test command:

```sh
flock /home/main/z-project/rpg-zzu/.omo/ulw-execute/tile-to-world/validation.lock timeout 120s npm run typecheck:app
```

LSP diagnostics on both changed TypeScript files returned no diagnostics.
Pure LOC: production file **78**, regression file **132** (both below 200).

## Scope, review and cleanup

- Single responsibility: spatial proposal integrity; test file owns its boundary regression.
- Existing project parser owns the input boundary; no new untyped data passes inward.
- No new tagged-variant dispatch, assertions/casts, unchecked null access, defensive
  layers, parameter bundles, negative names, logging or one-off helpers in production.
- Test helpers are reused; tests use real compiler, registry, runner, acceptance,
  serializer and in-memory store/history. No mocks of the asserted integration.
- No fixed sleeps, polling, timer changes, DB writes, schema/SQL/grant changes,
  UI/CSS/images, legacy adapter edits, new workers, push, PR or merge.
- Remote persistence is explicitly disabled and Supabase env inputs blanked in tests.
  This is offline backend evidence, not real-provider, browser or persisted-DB proof.
- No full legacy/old80 suite or build was run. Parent integration/build and the other
  adversarial findings remain outside this change.
- Monitor processes exited; no debug server or instrumentation was created.
  The temporary root journal is removed; adopted ignored worktree setup is retained.

Validated source SHA256:
- `src/editor/tools/spatialToolState.ts`: `2097c1fce2672db70c3dba04bb592aef143490f7acd5c70f62683af0accaf79d`
- `test/spatialToolProjectionBoundary.test.ts`: `b5a2e46098c41b8fc981e1da048f5d470e7c1163382e0a920e35f164b99865e2`

Raw log SHA256:
- `red.log`: `91eed9c7985c6ea40ffbdf374bbb64c455b56eb0fd9c54d012e1d98d089783d7`
- `green.log`: `9ee3308f3bbf924420579757e1fb18a213c09d80fb6e4e95baf4372ee98b5703`
- `typecheck.log`: `177ab8532cdfb662a6234725ac60dfb62b64aa242795498d6a7877de6e58169f`
