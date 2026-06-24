# RPG ZZU Design System

> **Status note:** This document describes the editor chrome **as actually shipped** in code (single theme: RM2K3 retro light). It was reconciled with `src/styles.css` and `src/editor/` after the v3 editor-experience pass. When the code changes, update this file — it is the source of truth for designers and contributors, not an aspirational target.

## 1. Atmosphere & Identity

RPG ZZU is a compact game-making workbench: dense, precise, and readable under repeated use. It aims to feel like a practical RPG Maker 2003-era editor brought into a browser — not a landing page, not a toy, and not a clone of proprietary RPG Maker art, logos, icons, or exact chrome. The signature is a pixel-true canvas surrounded by restrained utility panels: the work surface is crisp and game-like, while the editor chrome is quiet, stable, and optimized for scanning.

The system is a Vite + TypeScript + Phaser browser app: DOM panels and controls wrap Phaser-rendered edit/play surfaces. No framework, no CSS-in-JS — all chrome styles live in one `src/styles.css`.

## 2. Color

### Single active theme — RM2K3 retro light

There is **one shipped theme** (the RM2K3 retro light palette). A modern-dark palette is also defined in the first `:root` block as a baseline, but the app renders the light theme. Dark mode is **not** wired (no `prefers-color-scheme` / `data-theme` toggle); do not assume dual values.

### Primary token set (what the UI is actually built from)

These tokens are defined in `:root` and used throughout the chrome. This is the canonical set — extend it before introducing new color.

| Token | Value (light) | Usage |
|------|-------|-------|
| `--bg` | `#ece7da` | Full app background, surface-app alias |
| `--bg-panel` | `#d4d0c8` | Panel chrome, frames |
| `--bg-panel-2` | `#f0f0f0` | Inset surfaces, buttons (`--surface-button` alias) |
| `--bg-elev` | `#e5e5e5` | Elevated cards (actor/battle nodes) |
| `--bg-recessed` | `#d8d0be` | Canvas wells, preview wells |
| `--border` | `#808080` | Default borders, controls |
| `--border-soft` | `#b8b4aa` | Soft separators |
| `--text` | `#111111` | Primary text |
| `--text-dim` | `#3c3c3c` | Secondary/dimmed text |
| `--text-muted` | `#666666` | Hints, metadata |
| `--accent` | `#0a246a` | Primary action, focus, active mode (`--accent-blue` alias) |
| `--accent-hover` | `#1e4f9a` | Hover state of primary action |
| `--accent-soft` | `rgba(10,36,106,0.14)` | Accent tint backgrounds |
| `--danger` | `#9d1f1f` | Destructive, errors (`--status-error` alias) |
| `--ok` | `#1f6f38` | Saved, valid (`--status-success` alias) |
| `--gold` | `#7c5e22` | Warning, secondary accent (`--accent-secondary` alias) |

### Semantic aliases (also defined — keep them in sync)

These map to the primary set and exist so domain-specific CSS reads semantically:

| Alias | Resolves to | Semantic role |
|------|------|------|
| `--surface-app` | `--bg` | App background |
| `--surface-workbench` | `#f8f5ec` | Workbench surface |
| `--surface-panel` | `#fffdf7` | Panels, dialogs |
| `--surface-recessed` | `#d8d0be` | Canvas/preview wells |
| `--surface-selected` | `#d9e8f6` | Selected row/tile/tab |
| `--surface-button` | `--bg-panel-2` | Button surfaces |
| `--accent-secondary` | `--gold` | Warnings, unsaved, paint target |
| `--accent-editor` | `#3a6b32` | Valid placement, passable path |
| `--accent-blue` | `--accent` | Blue focus/action |
| `--status-error` | `#a33a32` | Invalid input, destructive |
| `--status-warning` | `#b4761e` | Autosave/asset warnings |
| `--status-success` | `--ok` | Saved, valid import |
| `--pixel-grid` | `rgba(0,0,0,0.2)` | Tile grid overlay stroke |
| `--text-primary` | `#232323` | (legacy surface-system text) |
| `--text-secondary` | `#5c5b57` | (legacy surface-system text) |
| `--text-inverse` | `#ffffff` | Text on strong fills |
| `--border-default` | `#9d988c` | (legacy surface-system border) |
| `--border-strong` | `#5f5b52` | Active canvas/modal borders |
| `--accent-primary` | `#2e6f9e` | (legacy surface-system accent) |

> If you add chrome color, **define a token in `:root` and use it** — do not reference an undefined `var(--x)`. Undefined-variable usages silently produce broken color and were a recurring source of visual bugs.

### Rules

- Use these tokens for all UI chrome. Extend the primary table before introducing a new color.
- Pixel-art assets keep their source palette. Do not recolor imported or generated sprites to fit the chrome.
- Accent colors are semantic, not decorative: `--accent`/`--accent-blue` = mode/focus/action, `--accent-editor` = valid map interaction, `--accent-secondary`/`--gold` = attention/pending, `--danger`/`--status-error` = destructive.
- Never reproduce RPG Maker proprietary logos, exact icons, default RTP character likenesses, or trademarked assets. Original, permissively licensed, or user-imported assets only.

## 3. Typography

There are **no typography utility classes**; sizes are set per-component with literal px. Treat the values below as the intended scale when adding new chrome, and keep root `font-size: 14px` (`styles.css`).

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| App title | `12–14px` | 600 | Project name in topbar (`.topbar .title`) |
| Panel title | `11px` | 700 | Section headers (`.panel-section h3`) |
| Control | `13px` | 600 | Buttons (`.btn`), tabs |
| Body | `13px` | 400 | Form labels, cells |
| Body/sm | `12px` | 400 | Status, metadata, right-tabs |
| Pixel label | `11px` | 600 | Canvas badges, tile index |
| Mono | `12px` | 500 | IDs, coordinates, summaries (`var(--mono)`/`--font-mono`) |

### Font stacks

- UI: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Mono (`--font-mono` / `--mono` alias): `"Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace`
- Pixel display: bitmap/pixel fonts only inside play/dialogue surfaces when bundled locally, without layout shift.

### Rules

- This is a tool UI. Avoid hero-scale text, marketing prose, and oversized empty states.
- Body text should not go below `11px`; interactive controls stay readable at compact desktop widths.
- Use mono text for coordinates, tile IDs, switch/variable IDs, asset IDs, and command summaries.

## 4. Spacing & Layout

### Base unit

All spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Icon gap, dense separators |
| `--space-2` | `8px` | Control groups, row padding |
| `--space-3` | `12px` | Panel padding, tab groups |
| `--space-4` | `16px` | Modal padding, toolbar groups |

### Workbench grid (actual values)

- Root layout: `topbar / body / statusbar` (column).
- **Topbar**: a stacked RM2K3 chrome — an `rm2k3-menu-bar` (22px) plus one or two `rm2k3-toolbar-row`s. It is **multi-row**, not a single 40px bar.
- **Body**: left sidebar, center Phaser surface, right inspector; left sidebar is resizable, right inspector is flex-driven.
- **Left sidebar**: `268px` default and min, `380px` max (`editor.ts` resizer clamps). Holds tool palette, tile/chipset palette, layer selector, and map tree. Collapsible via the toolbar.
- **Center work area**: fills remaining width, centers the Phaser canvas in a recessed well. Canvas controls must not change canvas dimensions.
- **Right inspector**: `min-width: 240px`, `max-width: 420px`; width is flex-driven (no fixed default). Holds the **two** right-dock tabs: Resources and Database.
- **Statusbar**: `22px` (`.editor-statusbar`). Shows layer, tile coordinate, current map, zoom, autosave/validation state.

### Compact / mobile

- Below `1024px` (`RESPONSIVE_BREAKPOINT`), the left panel collapses; the canvas remains the primary surface.
- Maintain ≥ `32px` targets for touch and ≥ `24px` for dense desktop icon buttons. Do not scale editor text with viewport width — use layout changes instead.

## 5. Components

### Editor topbar

- **Structure**: RM2K3 menu bar (프로젝트/맵/도구/게임/도움말) + toolbar rows (title + mode badge, file/undo/DB actions, layer + zoom controls).
- **Shortcuts**: F5/F6/F7 layers, 1–7 tools, +/- zoom, Ctrl+S save, Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste (see `src/editor/hotkeys.ts`). Hotkeys are disabled while a form control or modal has focus.

### Left palette & map tree

- **Tool palette**: pencil, fill, eyedropper, pan, select, collision, event, erase. Icon buttons with tooltips and visible active state.
- **Tile palette**: chipset bands (terrain/water·road/building/props) with category tabs; fixed preview cells. Selected tile has a strong border.
- **Layer selector**: surfaced in the toolbar as 하위/상위/이벤트 segmented buttons. Lower/Upper/Event are the three layers.
- **Map tree**: hierarchical rows with expand/collapse, active map, parent/child indentation, drag-and-drop reparenting (`mapList.ts`), and a parent-select fallback. Context menu: add-child, duplicate, set-start, delete, screenshot.

### Center pixel surface

- **Map editor**: Phaser canvas on a 16×16 logical grid; `image-rendering: pixelated`, nearest-neighbor.
- **Grid**: grid lines are overlays (`--pixel-grid`), toggleable, default on in Edit mode.
- **Overlays**: collision, event, start position, hover preview — tokenized, visually distinct.
- **Zoom**: integer steps only: `1, 2, 3, 4, 6, 8` (`EDITOR_ZOOM_LEVELS`). No fractional scaling.

### Right inspector

- **Two dock tabs**: Resources (소재) and Database (DB), rendered as `right-tab-resources` / `right-tab-database`. Map properties and Event editing are **not** right-dock tabs: event editing lives in the left palette when the event layer is active and opens as a modal; map properties are edited via the map tree context menu / database.
- Database and Resources are also available as full modals (`databaseModal`, `resourceModal`); the right dock is suppressed while a modal is open.
- **Database**: 15 tabs — 주인공/직업/스킬/아이템/장비/몬스터/적그룹/상태/전투애니메이션/타일셋/공통이벤트/시스템/용어/스위치/변수 (`db-tab-*`).
- **Event editor**: tree-style nested command list with **drag-to-reorder** (⠿ handle), up/down/delete buttons, command picker, per-page tabs, fork/choices branches.

### Database panels

- Utilitarian split views: list on the left, form/details on the right (`db-detail-form`).
- Switches and variables display stable IDs plus editable names; names are labels, IDs are references.
- Tileset editing shows passability/priority/terrain and a source-image preview without altering original pixels.
- State and Animation tabs show reference panels / pixel previews rather than bare stubs.

### Resource panels

- Resource previews use a recessed neutral background when alpha matters.
- Imported tilesets/sprites show dimensions, frame/tile size, source type, and validation warnings.
- Deletion is disabled for bundled defaults and confirm-gated for uploaded assets referenced by maps/events.

### Play presentation

- Play viewport is `320×240` logical pixels (`PLAY_WIDTH`/`PLAY_HEIGHT`), scaled only by integer factors with nearest-neighbor.
- Centered in a neutral well; letterbox with the recessed surface, never stretched.
- Dialogue/choice overlays align to the 320×240 grid (DOM for accessibility, visually pixel-aligned).
- Character sprites use a `24×32` logical frame convention for charsets (`CHARSET_FRAME_*`); generic sprites may be `32×32`.

### Side-view battle (built)

- `battle-scene` testid; enemy group (upper) + party (lower) + command panel.
- **Commands**: 공격 / 스킬 / 아이템 / 방어 / 도주, with skill and item submenus. Actor battle sprites render from the actor's `battleCharacterResourceId`; enemy sprites from `monsterResourceId`.
- Battle is database-driven: actor stats from parameter curves, enemy stats/rewards from records, skill effects (damage/healing/support/switch), agility-derived ATB charge, defense + defend halving.
- Battle sprites must be original or permissively licensed. Do not reproduce RM2K3 battlers, animations, icons, or window graphics.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | `80–120ms` | `ease-out` | Button press, hover, active row |
| Standard | `140–220ms` | `ease-in-out` | Drawer, tab switch, popover |
| Canvas feedback | `0–80ms` | `linear` | Tile hover, placement preview |

- Pixel surfaces prioritize immediate response; avoid animated zooms that blur intermediate frames.
- Animate only `transform`, `opacity`, `filter` — not layout properties.
- Every interactive element needs hover/active/disabled/focus-visible states.
- Respect `prefers-reduced-motion`.
- Keyboard workflows cover tool selection, tab changes, map-tree navigation, command-list navigation, and play input.

## 7. Depth & Surface

| Depth role | Value | Usage |
|------------|-------|-------|
| Border/default | `1px solid var(--border)` | Panels, toolbar groups, inputs |
| Border/strong | `1px solid var(--border-strong)` | Active canvas, focused modal |
| Recessed surface | `var(--bg-recessed)` / `var(--surface-recessed)` | Canvas wells, preview wells |
| Floating shadow | `0 8px 20px rgba(0,0,0,0.22)` (`--shadow-popover`) | Modal and popover only |

## 8. Data-testid policy

Stable `data-testid` attributes use the app's **own** kebab-case vocabulary, scoped by domain. The actually-shipped conventions (use these; do not assume the legacy names below them):

- Mode/play: `test-play-window`, `main-menu-button`, `mode-play`/`mode-edit`
- Canvas: `edit-canvas`, `editor-canvas-scroll-shell`, `play-canvas`
- Tiles: `tile-palette`, `quick-tile-grid`, `tool-*`, `layer-*`, `toolbar-zoom-*`
- Map tree: `map-tree`, `map-tree-node-${mapId}`
- Right dock: `right-tab-resources`, `right-tab-database`
- Database: `db-tab-*` (per collection), `db-detail-form`, `db-field-*`, `db-picker-*`
- Battle: `battle-scene`, `battle-party`, `battle-actor-${recordId}`, `actor-command-*` (attack/skill/item/defend/escape), `battle-enemy`

> The earlier design doc named testids like `topbar-play-toggle`, `map-canvas`, `tile-palette-cell`, `inspector-event-tab`, `database-switch-row`, `battle-surface`. **Those names were never implemented** and are deprecated; follow the conventions above.
- Dynamic IDs append stable record IDs, never visible names: `map-tree-node-town01`, not `map-tree-node-Forest Village`.
- Do not rename or remove a testid without updating the test that depends on it.
- Prefer accessible queries when possible; keep `data-testid` for canvas surfaces, repeated grid cells, and controls whose label changes by localization.

## 9. Accessibility baseline

- All toolbar buttons, tabs, menu items, map-tree rows, database rows, and modal controls must be keyboard-reachable.
- Canvas-only actions need a mirrored accessible control or command path.
- Focus stays visible via `--accent`.
- Text and UI chrome should meet WCAG AA contrast. Pixel assets are exempt as artwork; labels and overlays are not.
- Save failures, import errors, and destructive confirmations must be announced via visible text and an accessible live region (`toast`).
