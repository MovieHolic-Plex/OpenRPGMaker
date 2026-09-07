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
