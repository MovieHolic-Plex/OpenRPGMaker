# Action authoring data integrity

Base: `f22d64f7c2d95247189e8dacbffecc90dd0721d7`.

Scope: preserve authored enemy attacks on partial edits, reject malformed tool
arguments without mutation, and distinguish explicit spawn creation, update and
targeted removal without banning intentional multiple spawns.

The historical browser reproduction is recorded in the prior fun-review
evidence. This change reproduces the failures on current main before modifying
production code. It does not claim that action-mechanics checks establish fun.

Execution journal: `/tmp/ulw-20260907-191135.jJiUQp.md`.

## Profile preservation and argument rejection

- RED: `profile-red.json` / `profile-red.log` / `args-red.log`: 32 tests,
  22 passed, 10 failed. Omitted fields disappeared; malformed nested arguments
  returned success.
- GREEN: `profile-green.json` / `profile-green.log` / `args-green.log`:
  the same 32 tests passed.
- Real browser AI sent exactly `actionProfile: {aggroRange: 7}` with the existing
  spawn ID. Actual LegacyDb reload preserved attack, stats, rewards and both
  existing spawn IDs, changing only the requested profile field and target area.
- The real `applyToolToStore` boundary rejected quoted attack keys, unknown
  attack kinds and invalid movement values with no serialized store change.
  See `profile-surface.json`.
- `npm run typecheck:app` and the full `npm run build` exited 0.
  Test-file LSP diagnostics were clean. Source-file fresh diagnostics timed out
  at the tool's 3000 ms limit; compiler/build evidence is recorded separately,
  not misreported as an LSP pass. See `profile-validation.json`.
- QA project: `oprn-1a8ac23163`. The initial genre preset had already added an
  unrelated slime spawn; preservation checks include that existing spawn rather
  than pretending the target was the only map entry.

## Explicit spawn mutation

- RED: `spawn-red-confirmed.json` / `spawn-red.log`: 12 behavior failures after
  correcting the test fixture's map-tree shape. The initial fixture-error run is
  not counted as proof.
- Explicit add/update, missing-ID rejection, map identity, targeted removal,
  roguelike-reference protection and published-schema tests now pass.
- The non-default `chase:false` fixture also exposed an omitted-setting reset.
  A diagnostic run identified unconsumed `width`/`height` aliases in the stored
  area. The writer now preserves omitted chase and stores canonical Rect fields;
  assertions were retained. See `spawn-alias-red.log`.
- `spawn-final-green.json` / `spawn-green.log`: 98 related tests passed.
- `spawn-surface.json`: actual browser store operations rejected unknown update,
  duplicate add and invalid mode with no mutation; explicit add, update and
  targeted delete succeeded, and the actual LegacyDb reload retained attacks,
  database records, existing IDs and `chase:false`.
- App typecheck, regenerated tool catalog and final full build passed.
  See `spawn-validation.json`.

Compatibility is intentional: omitted `spawnMode` retains legacy upsert/append.
New AI guidance uses explicit modes. This is not a claim that legacy omission is
duplicate-proof or that deliberately repeated enemies are forbidden.

## Final real-surface proof

`browser-surface.mjs` drives actual Chrome against the editor and the dedicated
player. It reads the real LegacyDb row and AI conversation, not fabricated
responses. The recorded AI call used `spawnMode:"update"` and only
`actionProfile:{aggroRange:7}`. The reloaded attack, stats and rewards matched
the prior saved values; the target retained its ID and `chase:false`.

In a normal new game, Enter and directional movement produced a live projectile
count of 1 with the authored QA enemy present. No HP, position, time or victory
mutation was used. See `final-browser-surface.json`. Local screenshot paths are
included there. This proves mechanics preservation, not fun or aesthetic quality.

The in-kernel browser connection became unavailable during the final pass.
Independent Node/Chrome with unchanged-response forwarding completed the same
surface. Six connection refusals were for the optional local browser bridge at
127.0.0.1:17831; editor/player page errors were zero and actual DB calls succeeded.
The driver now records transport error codes rather than potentially sensitive
request-header dumps.

## Whole-gate results and baseline control

The lead ran `npm run gates -- --json`. App typecheck and CSS passed. The whole
suite recorded 17,896 passed / 296 failed; the surface gate also failed.
This is not reported as a green whole-repository run.

The run exposed one new registration omission: `remove_field_spawn` lacked an
explicit activity narration family. It was registered in the existing map-edit
family, without weakening its test. The final related run passed **107/107**.
The final full build, including app typecheck and all player bundles, exited 0.

New failure-file candidates plus surface axes were run on clean base
`f22d64f7c2d95247189e8dacbffecc90dd0721d7`: 896 passed / 91 failed, with 88
candidate assertion failures reproduced. Remaining candidates were rerun and
then the seven residual resource-sensitive files were compared under identical
single-worker settings: **108/108 passed on both base and the fix**. No test
timeout or skip was added. See `gate-comparison.json`, the isolated reports, and
`narration-red-green.json`. Existing whole-gate failures remain outside this
scoped authoring fix.

Catalog regeneration also reconciles pre-existing registry/document drift;
`remove_field_spawn` is the only new tool introduced here.

## Cleanup and review

The lead reviewed the complete source/test diff and scoped staged changes.
Final changed TypeScript files had no LSP errors. No separate `ulw-plan` review
gate was triggered.

Owned browsers, servers, temporary Chrome profile and dedicated Vite caches
were stopped/removed. The clean baseline-control worktree was removed. The
delivery worktree, remote QA project and evidence remain intentionally available.
See `browser-cleanup.json` and `cleanup-receipt.json`.
