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
  spawn ID. Actual Supabase reload preserved attack, stats, rewards and both
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
  targeted delete succeeded, and the actual Supabase reload retained attacks,
  database records, existing IDs and `chase:false`.
- App typecheck, regenerated tool catalog and final full build passed.
  See `spawn-validation.json`.

Compatibility is intentional: omitted `spawnMode` retains legacy upsert/append.
New AI guidance uses explicit modes. This is not a claim that legacy omission is
duplicate-proof or that deliberately repeated enemies are forbidden.
