# Interior catalog review — 2026-09-13

Project: `rpg-zzu-house-template-gallery` (호수 마을).
Remote CAS save and exact full-project reload succeeded: `3ed88a534db4fb92ba4c7b6b3b384f1f498a2e34bf2d411d82b82370d9e596d9`.
No raw project JSON or credentials are included in this evidence directory.

| Audit | Before | After |
|---|---:|---:|
| Interior spaces | 93 | 101 |
| Failed builds | 15 | 0 |
| Hard cluster errors | 9 | 0 |
| Omitted objects | 20 | 0 |
| Unreachable passable floor cells | 20 | 0 |

The final catalog passes all 101 builds with seeds 20260913, 7 and 31.
Before sheets cover all 93 old definitions, including build failures; after sheets
cover all 101 reviewed definitions. Images use the native renderer and project
atlas. `new-interiors.png` shows the eight new physically divided small spaces.

The three house floor sources now have 8×6 floors and two physical rooms.
Eight saved indoor maps were refreshed via the real AI editing tool. Twelve
unrelated maps and project start were preserved. Existing larger canvases retain
empty padding; the playable floor is compact. New whole interiors are 9×6 or 10×7.
The editor QA fresh-loaded the remote project, compared the saved cottage map,
and opened the new family/shop/workshop/clinic space designs. Writes were blocked
in the QA browser; publication was performed by the CAS save script.

## Validation

- `npm run gates -- --only typecheck --json`: exit 0, no regressions.
- Focused suite: 125 passed. `interiorConceptAssemblies.test.ts` has 57 failures;
  all 57 also reproduce against the pre-change HEAD source, using a Vite load
  override isolated under the ignored `.codex/` directory. Existing failures concern
  legacy facility map-replacement warnings, not the stored-space compiler.
- Seven new tests cover snap/role retention, correct wall raster, reachable wall
  investigation, frozen recompilation after live kit edits, old snapshots, explicit fixed anchors and outdoor layer preservation.
- New/source spaces were previewed through `get_spatial_design` and
  `preview_spatial_build`; registration is idempotent.
- LegacyDb save/reload proof: `legacy-db-proof.json`.

## Deliberate boundaries

Legacy imported object identities and event/loot/sleep chips are preserved while
compact graphics replace unsuitable large assemblies. Destinationless transfer
chips on space slots become explicit connectable stair ports; no self-transfer
is fabricated. The old inn's complete facility connection graph is not authored
by this space-catalog review. The saved 3/4-floor house places retain their actual
stair and exterior connections.

## Runtime result

Fresh dedicated player sessions pass all 12 inn beats and 15 workshop beats,
including real door entry, each bedroom, ascending every stair, and descending
back outside. Both reports have zero runtime errors. No editor play shell was used.

An initial combined scenario passed the inn but failed 12 later workshop beats:
debug teleport immediately after the previous exit interfered with ongoing route/
transition state (the player remained outside). This is retained as
`runtime-initial-combined.md`. The final scenario uses one fresh session per house
(`QA_INTERIOR_HOUSE=inn-3f` or `workshop-4f`); it does not weaken position assertions
or teleport past a door/stair. Native contact sheets and the real editor supply
visual evidence separately from these movement gates.
