# Quickstart

This repository is a web-based top-down tile JRPG maker MVP. The app boots from `src/main.ts`, loads the editor by default, and can switch into play mode after the project state is loaded.

For AI/code-agent work, start with `AGENTS.md` and `openwiki/PROJECT_WIKI.md`. This wiki is the project-specific context layer that agents should read before making changes.

## Start here

- `README.md` for the user-facing overview, editor/player controls, and save/load flow.
- `package.json` for available scripts: `npm run dev`, `npm run build`, `npm test`, and `npm run typecheck`.
- `src/main.ts` for startup behavior, URL feature flags, PWA loading, and the classic event editor capture path.

## Wiki map

- `architecture.md` for the system overview and major code areas.
- `PROJECT_WIKI.md` for the AI-facing project entry point.
- `ai-workflow.md` for the pre-edit and post-edit agent workflow.
- `editor-workflows.md` for map editing and event editing flows.
- `runtime-and-data.md` for play mode behavior and project data handling.
- `testing.md` for test guidance and validation steps.
- `cpen-openwiki.md` for CPEN-backed OpenWiki maintenance.

## Code layout

Top-level `src` folders:

- `src/app` — app-mode bootstrapping and screen-level orchestration.
- `src/editor` — map editing, event editing, and editor state/actions.
- `src/player` — runtime play mode and in-game interaction.
- `src/project` — project data model and persistence/store logic.
- `src/battle` — battle systems.
- `src/assets` — generated or bundled asset helpers.
- `src/styles` — global styling.
- `src/util` — shared utilities.

## What to know

- The app uses Phaser plus TypeScript; `README.md` describes the browser editor/play loop and the JSON-based project state.
- `src/main.ts` reads URL flags such as `rm2kShell`, `rm2k3Shell`, `koreanAuthoring`, and `enablePwa` to toggle development or product behaviors.
- Use npm run openwiki:cpen for CPEN-backed OpenWiki maintenance.

## Next places to inspect

- `src/editor` if you are changing map or event editing.
- `src/player` if you are changing play mode interactions.
- `src/project` if you are changing persistence, serialization, or project state.
- `src/battle` if you are changing combat behavior.
