# RM2K3 Fidelity Contract

Status: frozen baseline for the RM2K3 fidelity overhaul.

This contract defines the target shape for later implementation waves. It is a functional and presentation fidelity contract for an RM2K3-style web RPG maker. It is not an asset pack, clone, binary importer, or compatibility promise.

## Runtime Presentation

- Play mode uses a 320x240 logical surface with integer nearest-neighbor scaling. The editor can remain modern and resizable, but runtime screenshots, browser QA, and sample-game acceptance must verify the retro play surface.
- Map rendering uses RM2K3-shaped 16x16 tile resources. Lower tiles, upper tiles, event graphics, pictures, screen effects, menu, save, title, game-over, and battle transitions render through runtime/session state.
- Runtime presentation must not mutate authoring `Project` data. Switches, variables, timers, map overrides, transfer position, picture state, audio state, battle result, and save-slot data live in session or save state.
- Editor topology must expose lower, upper, and event layers; map tree; chipset palette; database; resources; edit/play switching; and project export surfaces.

## Resource Profiles

- ChipSet-style map resources slice 16x16 tiles and carry passability, priority, terrain, lower-layer, and upper-layer metadata.
- CharSet resources slice 24x32 character frames for actors and map events. Transparent-color metadata is required for imported raster resources.
- BattleCharSet resources describe side-view actor battle frames. BattleWeapon, Monster, Battle/Backdrop, System2, and Battle Animations are separate profiles.
- Title, Game Over, System, System2, Picture, FaceSet, Music, Sound, BGM, BGS, ME, and SE resources are typed and validated by profile.
- Imported resources must produce actionable validation messages for unsupported dimensions, missing metadata, missing references, and media that cannot be used by browser runtime surfaces.

## Database Contract

The database must cover these tabs and minimum fields:

- Actors: name, class, level range, parameters, equipment slots, initial equipment, skills learned by level, charset, and battle charset.
- Classes: parameter curves, usable equipment, skill learning, and state or effect rates where modeled.
- Skills: name, description, cost, scope, target, success rate, power or formula fields, element or state effects, animation, and usable context.
- Items and Equipment: name, description, price, scope, consumable flag, stat changes, skill or effect hooks, and equip type.
- Enemies: stats, rewards, drops, monster graphic, actions, and state or element rates.
- Troops: enemy placements, battle background, battle Event pages, victory behavior, and defeat behavior.
- States: restrictions, priority, duration or chance, stat modifiers, messages, and recovery conditions.
- Battle Animations: frame list, targets, timings, sound, flash, and placeholder support.
- Tilesets, Common Events, System, Terms, Switches, and Variables: range editing, search, references, delete safeguards, and full command editing where applicable.

Actors, Classes, Skills, Items, Equipment, Enemies, Troops, States, Battle Animations, Tilesets, Common Events, System, Terms, Switches, and Variables are all in scope.

## Event Pages And Commands

- Event pages are first-class data. Each page owns conditions, graphic, trigger, priority, autonomous movement, options, and commands.
- Page resolution uses deterministic highest-number valid page semantics. Page resolution reevaluates after commands that affect switches, variables, items, actors, timers, battle results, or other page conditions.
- Event triggers include action, player touch, event touch where modeled, autorun, and parallel.
- Event commands include messages, choices, switches, variables, conditional branches, loops, breaks, labels, goto label, wait, input wait, timer, transfer, set event location, move route, change tile, call common event, pictures, screen effects, audio, battle processing, shop, inn, game over, and return to title.
- Command data must be structured, typed data rather than stringly typed blobs.

## Battle Contract

- Battle mode is Side-view and is wired to database records. It must not be a detached demo or generic first-person combat.
- Battle presentation uses actor BattleCharSet sprites, enemy Monster graphics, battle background resources, animations, commands, and database-driven stats.
- Battle runtime handles turn or gauge progression, attack, skill, item, equipment effects, states, EXP and leveling, enemy defeat, party defeat, escape where modeled, and troop event triggers.
- Battle processing from an event suspends the map interpreter and resumes with victory, defeat, escape, or abort branches.

## Migration And Recovery

- Persistence advances to SCHEMA_VERSION = 3.
- v1 and v2 projects must migrate into valid v3 data or fail with actionable validation messages while preserving original data.
- Migration, destructive import, and bulk resource import must create a recoverable backup before changing project data.
- Failed migration or import must prove backup restore behavior in tests.
- Invalid references to maps, Actors, Enemies, Skills, Items, Troops, switches, variables, common events, resources, or command targets are rejected at the load/import boundary.

## Runtime Concurrency

- Autorun events block player movement while active and resume input only after completion or an explicit suspension point.
- Parallel events run on a deterministic scheduler with per-event wait state and stable ordering across frames.
- Common events have recursion limits, bounded reentrancy, and clear diagnostics.
- Transfer, battle processing, menu, save, game over, and return to title explicitly suspend and resume interpreter state.
- Runtime overrides live in session/save state and never in the authoring `Project`.

## Must NOT

- Must NOT copy official RPG Maker RTP assets, copied logos, proprietary sample data, exact proprietary dialog layouts, or trademark-confusing names.
- Must NOT claim `.lmu`, `.ldb`, `.lmt`, or RM2K3 binary compatibility.
- Must NOT bundle official content, official names as bundled assets, or binary-compatible project readers.
- Must NOT rewrite the app away from the current TypeScript, Vite, and Phaser stack.
- Must NOT declare later implementation complete from tests alone; editor, play, battle, and sample-game claims require real browser or artifact evidence.

## Parity Matrix Fixture

The machine-readable parity matrix lives at `test/fixtures/rm2k3-fidelity-matrix.json`. It is the implementation checklist seed for later waves and must keep these top-level sections at minimum: `battle`, `database`, `eventPages`, `resourceProfiles`, `runtimePresentation`, `migration`, `concurrency`, and `legalGuardrails`.
