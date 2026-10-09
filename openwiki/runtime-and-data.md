# Runtime and Data

Use this index to find the right topic page before changing play mode, event execution, battle behavior, save/session state, project schema, persistence, or migration behavior. The old monolithic page was split for agent readability.

## Topic pages

- **[runtime-pre-edit-routing.md](runtime-pre-edit-routing.md)** — Read first. Pre-edit routing (PlayScene, interpreter, battle, title/load surfaces, project schema/persistence) and agent cautions (authored vs runtime split, battle DOM, play stage geometry).
- **[runtime-battle.md](runtime-battle.md)** — Turn-based battle rules, turn flow, damage, rewards, battle events, snapshots, monster collection, capture, type chart, and equipment effects.
- **[runtime-action-combat.md](runtime-action-combat.md)** — Real-time action-combat package: activation contract, pure rule modules (`src/battle/action/`), scene integration, player actions (swing buffer, dodge, guard, skill slots), enemy patterns (windup, dash, projectile, stagger, knockback, kiting), HUD, and grid-movement design.
- **[runtime-sessions.md](runtime-sessions.md)** — Session state, save slots, checkpoints, farming, friendship/gifts, calendar/time system, NPC schedules, lighting, weather, field spawns, followers, and RNG.
- **[runtime-project-schema.md](runtime-project-schema.md)** — Authored project schema, story flags, terms, quests, endings, worldview, world graph, web export, migration, save performance, and persistence boundaries.
- **[runtime-m2-flow-controls.md](runtime-m2-flow-controls.md)** — M2 runtime flow controls (End Event, Erase, setEventGraphicPattern, Wait, Movement, checkpoint, killPlayer, triggerEnding, scroll, camera, cutscene, lighting, weather, animation, picture, spawn/remove event) and the scene test runner.
- **[state-system.md](state-system.md)** — State system end-to-end: authored `StateRecord` definition, `StateOntology` engine template, runtime `PlaySession.actorStateIds` application, editor DB view surface, and the definition-vs-application distinction users trip over.

## Quick routing

- **PlayScene** / player movement / event triggering / overlays: runtime-pre-edit-routing.md
- **interpreter** / command execution / branching / waits: runtime-pre-edit-routing.md + runtime-m2-flow-controls.md
- **battle** / turn flow / damage / rewards / snapshots: runtime-battle.md
- **action combat** / real-time hitboxes / dodge / guard / enemy patterns: runtime-action-combat.md
- **session** / save slots / switches / variables / inventory: runtime-sessions.md
- **src/project** schema / migration / persistence / serialization: runtime-project-schema.md

## For AI agents

Before editing runtime or project code, read the topic page matching your change area, then inspect the named source files. Keep authored project data and runtime session data separate. Schema changes must include migration, validation, fixtures, and save/load verification.
