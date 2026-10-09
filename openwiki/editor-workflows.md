# Editor Workflows

Use this index to find the right topic page before changing editor-facing behavior. The old monolithic page was split for agent readability.

## Topic pages

- **[editor-pre-edit-routing.md](editor-pre-edit-routing.md)** — Read first. Pre-edit routing (editor UI mode, map canvas, tile palette, event/database/resource routing) and agent cautions.
- **[editor-event-authoring.md](editor-event-authoring.md)** — Event authoring, event pages, event commands, move routes, command dialogs, cutscene/horror/puzzle tools, and 2026-07-15 hostile-review command fixes.
- **[editor-database.md](editor-database.md)** — Database editor: tabs, record views, battle database records, utility records, references, common-event command editing, and record mutation.
- **[editor-workflows-misc.md](editor-workflows-misc.md)** — Other editor workflows: map/event search, audio test, help modal, themed dungeons, resource manager, village pipeline, AI chat panel, AI proposals, and tool exposure.
- **[editor-validation.md](editor-validation.md)** — Validation expectations: openwiki:verify, Playwright evidence, and focused test guidance.
- **[editor-interior-room-harness.md](editor-interior-room-harness.md)** — Interior Room Session Harness (villager-room-v1): start session, advance build per layer, evaluate, and self-repair loop.
- **[editor-storage-chest.md](editor-storage-chest.md)** — Storage chest authoring tool and its distinction from place_chest treasure reward presets.

- **[editor-genre-packs.md](editor-genre-packs.md)** — Shared-schema genre-pack registry, welcome starter mapping, vocabulary, and readiness contracts.

## Quick routing

- **map** / tile / canvas: editor-pre-edit-routing.md (map canvas, tile placement, brush, autotile) + editor-workflows-misc.md (dungeons, village)
- **event** / command / trigger / page: editor-event-authoring.md
- **database** / record / item / actor / enemy / class: editor-database.md
- **resource** / tileset / asset: editor-pre-edit-routing.md (resource manager section) + editor-workflows-misc.md
- **src/editor** module ownership: each topic page names the owning source files.

## For AI agents

Before editing editor code, read the topic page that matches your change area, then inspect the named source files. Keep authored project data and runtime session data separate.
