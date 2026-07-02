# RPG ZZU Agent Entry Point

This repository uses a project-local OpenWiki layer so coding agents can understand the editor before changing it.

Before making code changes, read:

1. `openwiki/PROJECT_WIKI.md` - the current project-specific AI map.
2. The focused OpenWiki page for the area you will edit:
   - `openwiki/editor-workflows.md` for editor UI, map editing, events, database, resources, and save/import/export.
   - `openwiki/runtime-and-data.md` for play mode, interpreter, battles, sessions, persistence, and schema changes.
   - `openwiki/architecture.md` for boot flow and ownership boundaries.
   - `openwiki/testing.md` for validation expectations.
   - `openwiki/cpen-openwiki.md` for refreshing wiki content through CPEN/OpenWiki.

Agent rules:

- Treat `openwiki` as working context, not product UI.
- If you change architecture, editor workflows, runtime data shape, persistence, or test strategy, update the matching `openwiki/*.md` page in the same change.
- Keep project-specific knowledge inside this repo's `openwiki` directory. Other projects should have their own `openwiki/PROJECT_WIKI.md` and focused pages.
- Do not store API keys or live credentials in wiki files, scripts, evidence, or commits.
- Prefer focused validation. For UI changes, include browser evidence. For schema/runtime changes, include tests that prove load, migrate, save, and play behavior as relevant.
