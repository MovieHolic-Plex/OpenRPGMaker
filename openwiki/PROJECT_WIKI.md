# RPG ZZU Project Wiki

This is the AI-facing wiki entry point for this specific editor project. It is meant to be read before modifying the codebase, especially by coding agents that need to understand how to safely operate on the editor.

## Purpose

The wiki exists to make AI work project-aware:

- Each project keeps its own `openwiki` directory.
- Agents read the local wiki before edits instead of relying on memory from another repo.
- The wiki captures ownership boundaries, high-risk flows, and validation expectations.
- The wiki is updated when the project changes, so future agents inherit current context.

This is not the in-app user manual. It is the pre-edit context layer for agents.

## Required pre-edit read order

1. Read this file.
2. Read `openwiki/quickstart.md` for the repo shape and first files to inspect.
3. Read the focused page for the area being changed:
   - Editor UI, map tools, events, database, resources, save/import/export: `openwiki/editor-workflows.md`
   - Castle / keep map modules (`map_castle_keep` gold): `openwiki/castle-map.md`
   - Large river/market village generation (bbox → houses → roads): `openwiki/large-village-generation.md`
   - Runtime, interpreter, battle, save/session behavior, project schema: `openwiki/runtime-and-data.md`
   - Boot flow, mode switching, module boundaries: `openwiki/architecture.md`
   - Test and evidence strategy: `openwiki/testing.md`
   - CPEN/OpenWiki refresh behavior: `openwiki/cpen-openwiki.md`
4. Inspect the actual source files named by the focused page before editing.

## Project identity

RPG ZZU is a browser-based top-down tile JRPG maker/editor. It combines:

- An editor mode for maps, events, resources, database records, and project save/import/export.
- A play mode for testing authored projects.
- A project data model shared by editor, player, persistence, and tests.
- RM2k3-inspired authoring and runtime behavior.

## Main ownership boundaries

- `src/app` owns app boot, mode switching, shell setup, and Phaser game lifecycle coordination.
- `src/editor` owns authored-content editing. It should update project data, not runtime session state.
- `src/player` owns play-mode UI, runtime scene wiring, dialogue, title/load surfaces, and scene interaction.
- `src/battle` owns battle state, rules, turn flow, command resolution, rewards, and battle snapshots.
- `src/project` owns canonical project data, defaults, migrations, validation, persistence, and remote/local storage boundaries.
- `src/assets` owns bundled/generated asset resolution, slicing, transparency, and preview helpers.
- `src/styles` owns visual presentation. Avoid moving behavior into CSS-only workarounds.
- `test` and `test/e2e` are part of the contract. Update or add focused tests for changed behavior.

## How an AI should use this wiki

Use this checklist before editing:

- Identify the feature area and read the matching wiki page.
- Name the source files that own the behavior before opening random files.
- Preserve the authored-project versus runtime-session split.
- Keep persistence and migration changes deterministic and backward compatible.
- For UI work, verify through the browser surface and save screenshots or logs under `output/evidence` or `evidence`.
- If the change reveals stale wiki guidance, update the wiki as part of the same work.

## Supabase DB mandatory (see root `AGENTS.md`)

Root `AGENTS.md` hard rule: **do not finish map/event/demo/content work without Supabase save + reload proof.**  
`blankProject` / `freshProject` / `dev-showcase` skip remote persistence — never treat those sessions as a complete deliverable.  
Engine-only code changes and narrow unit-test fixtures are the only default exceptions.

## Per-project wiki structure

For each project that uses this pattern, keep:

- `AGENTS.md` at repo root: tells AI systems where the local wiki lives and what to read first.
- `openwiki/PROJECT_WIKI.md`: project-specific AI entry point.
- `openwiki/quickstart.md`: repo shape and common starting files.
- `openwiki/architecture.md`: ownership boundaries and boot/runtime structure.
- `openwiki/editor-workflows.md`: editor-specific change map.
- `openwiki/runtime-and-data.md`: runtime, data, persistence, migration, and schema map.
- `openwiki/testing.md`: verification contract.
- Optional focused pages for large subsystems.

Do not share one wiki across unrelated projects. Cross-project memory should be explicit links or copied guidance that has been reviewed for the target project.

## Staleness rule

If source behavior disagrees with the wiki, the source wins for the immediate fix. Then update the wiki so the next agent does not repeat the stale assumption.
