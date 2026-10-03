# Cinematic desktop start screen — 2026-10-03

The shipping `start-screen.html` Vite entry renders a full-width cinematic lobby.
First visits use the existing bundled castle/village/forest scene images. Returning
visits use the most recent visible project's cover and a real Continue button.

## Evidence

- `01-first-visit.png`: 1440×1000, first visit, scene selector and three creation paths.
- `02-first-visit-1024.png`: 1024×768 supported desktop floor, all primary controls visible.
- `03-returning.png`: 1280×800, authored title and project cover, recent-project section.
- `04-create-en.png`: existing example creation form remains reachable after the new lobby.
  Existing untranslated seed content in that form is outside this change; new lobby chrome
  was inspected in English, Japanese and Chinese.
- `browser-evidence.json`: 29 browser observations, no uncaught browser errors.

The browser inspection used an isolated `window.oprn.start` stub against the actual
Vite entry on worktree port 9812. Editor navigation was intercepted; no SQLite project
was created or modified. This proves renderer routing and handoff arguments, not a
native folder dialog or canonical save/reload. Persistence and IPC implementations
are unchanged.

Observed paths: background selection; pause and reload persistence; live OS reduced
motion; example selection; AI planning; blank creation with the selected folder/mode;
keyboard Continue; canceled folder selection; missing-folder and team-join errors;
recent-list failure; hidden entries staying out of the primary Continue action;
authored titles not being translated. Widths 1440, 1280, 1024 and 390 had no horizontal
overflow. New lobby chrome translated in en/ja/zh.

`npm run build:app` completed successfully. Existing large-chunk warnings remain.
Vitest, full typecheck and repository gates were not run, per the session rule in AGENTS.md.
