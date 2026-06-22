# RPG ZZU Design System

## 1. Atmosphere & Identity

RPG ZZU is a compact game-making workbench: dense, precise, and readable under repeated use. It should feel like a practical RPG Maker 2003-era editor brought into a browser, not a landing page, not a toy, and not a clone of proprietary RPG Maker art, logos, icons, or exact chrome. The signature is a pixel-true canvas surrounded by restrained utility panels: the work surface is crisp and game-like, while the editor chrome is quiet, stable, and optimized for scanning.

The system assumes the existing Vite, TypeScript, and Phaser browser app architecture: DOM panels and controls around Phaser-rendered edit/play surfaces, with no framework or runtime change implied by this document.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/app | `--surface-app` | `#ECE7DA` | `#181A1F` | Full app background |
| Surface/workbench | `--surface-workbench` | `#F8F5EC` | `#20232A` | Main editor shell |
| Surface/panel | `--surface-panel` | `#FFFDF7` | `#282C34` | Left palette, right tabs, dialogs |
| Surface/recessed | `--surface-recessed` | `#D8D0BE` | `#121418` | Canvas wells, tile bins, preview wells |
| Surface/selected | `--surface-selected` | `#D9E8F6` | `#243D55` | Selected row, tile, map, tab |
| Text/primary | `--text-primary` | `#232323` | `#F4F0E8` | Main labels and values |
| Text/secondary | `--text-secondary` | `#5C5B57` | `#BBB5AA` | Hints, metadata, muted labels |
| Text/inverse | `--text-inverse` | `#FFFFFF` | `#111318` | Text on strong fills |
| Border/default | `--border-default` | `#9D988C` | `#4C5360` | Panel frames, controls, tabs |
| Border/strong | `--border-strong` | `#5F5B52` | `#78808E` | Active canvas and modal borders |
| Accent/primary | `--accent-primary` | `#2E6F9E` | `#6DA9D4` | Primary action, focus, active mode |
| Accent/secondary | `--accent-secondary` | `#7C5E22` | `#D4A94F` | Warnings, unsaved state, paint target |
| Accent/editor | `--accent-editor` | `#4C7A43` | `#86B878` | Valid placement, passable path |
| Status/error | `--status-error` | `#A33A32` | `#F07A70` | Invalid input, destructive confirmation |
| Status/warning | `--status-warning` | `#B4761E` | `#E7B45B` | Autosave warning, asset size warning |
| Status/success | `--status-success` | `#327A4E` | `#73C891` | Saved state, valid import |
| Pixel/grid | `--pixel-grid` | `#00000033` | `#FFFFFF26` | Tile grid and overlay strokes |
| Pixel/hitbox | `--pixel-hitbox` | `#C43A3A99` | `#FF6D6D99` | Collision and blocked tile overlay |
| Pixel/event | `--pixel-event` | `#7C4FD699` | `#B89BFF99` | Event placement overlay |

### Rules

- Use these tokens for all UI chrome. Extend this table before introducing a new color.
- Pixel-art assets keep their source palette. Do not recolor imported or generated sprites to fit the chrome.
- Accent colors are semantic, not decorative: primary means mode/focus/action, editor means valid map interaction, secondary means attention or pending state.
- Never use RPG Maker proprietary logos, exact icons, default RTP character likenesses, or trademarked asset reproductions. Original, permissively licensed, or user-imported assets are acceptable.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| App title | `18px` | 700 | 1.2 | 0 | Project name in topbar |
| Panel title | `14px` | 700 | 1.25 | 0 | Palette, map tree, database section titles |
| Control | `13px` | 600 | 1.25 | 0 | Buttons, tabs, segmented controls |
| Body | `13px` | 400 | 1.45 | 0 | Form labels, editor copy, table cells |
| Body/sm | `12px` | 400 | 1.35 | 0 | Metadata, status line, tile coordinates |
| Pixel label | `11px` | 600 | 1.2 | 0 | Canvas badges, tile index labels |
| Mono | `12px` | 500 | 1.35 | 0 | IDs, coordinates, command summaries |

### Font Stack

- UI: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Mono: `"Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace`
- Pixel display: use bitmap/pixel fonts only inside play/dialogue surfaces when bundled locally or loaded without layout shift.

### Rules

- This is a tool UI. Avoid hero-scale text, decorative headings, marketing prose, and oversized empty states.
- Body text should not go below `12px`; interactive controls should remain readable at compact desktop widths.
- Use mono text for coordinates, tile IDs, switch IDs, variable IDs, asset IDs, and command summaries.

## 4. Spacing & Layout

### Base Unit

All editor spacing derives from 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Icon gap, dense separators |
| `--space-2` | `8px` | Control groups, row padding |
| `--space-3` | `12px` | Panel padding, tab groups |
| `--space-4` | `16px` | Modal padding, toolbar groups |
| `--space-5` | `20px` | Large panel interior spacing |
| `--space-6` | `24px` | Major workbench gutters |

### Workbench Grid

- Root layout: `topbar / body / statusbar`.
- Topbar height: `40px` minimum, single row, no wrapping. It contains project title, mode switch, save/load/import/export, database, resources, and play controls.
- Body layout on desktop: left sidebar, center Phaser surface, right inspector. Use resizable columns with stable minimums.
- Left sidebar: `240px` default, `180px` minimum, `340px` maximum. It holds tool palette, tile palette, layer selector, and map tree.
- Center work area: fills remaining width and centers the Phaser canvas in a recessed well. Canvas controls must not change canvas dimensions.
- Right inspector: `300px` default, `240px` minimum, `420px` maximum. It uses tabs for Map, Event, Database, Resources, and Debug/Status when needed.
- Statusbar height: `24px` minimum. It shows selected layer, tile coordinate, current map, zoom, autosave state, and validation errors.

### Compact And Mobile Constraints

- At widths below `1024px`, side panels collapse into icon-triggered drawers. The center canvas remains the primary surface.
- At widths below `720px`, use one visible panel at a time: Canvas, Palette, Tree, Inspector, Database, or Resources. Preserve the same controls, but move them into tabs or drawers.
- Do not scale editor text with viewport width. Use layout changes, drawers, and wrapping rows instead.
- Maintain a minimum target size of `32px` for touch controls and `24px` for dense desktop icon buttons.

## 5. Components

### Editor Topbar

- **Structure**: left project identity, central mode segmented control, right file and run actions.
- **Variants**: Edit mode, Play mode, dirty state, saving state.
- **States**: default, hover, active, focus-visible, disabled, pending.
- **Rules**: icon buttons need accessible names and tooltips. Text labels are used only for primary commands or ambiguous icons.

### Left Palette And Map Tree

- **Tool palette**: pencil, fill, collision, event, erase, selection, and layer controls. Use icons with tooltips and a visible active state.
- **Tile palette**: tile chips are fixed `32px` preview cells for `16x16` source tiles shown at 2x. The selected tile has a strong border and does not resize.
- **Layer selector**: Lower, Upper, Event as a segmented control. Non-active layers render dimmed on the canvas, not hidden unless explicitly toggled.
- **Map tree**: hierarchical rows with expand/collapse, active map, parent/child indentation, add/rename/delete actions, and drag target affordances.

### Center Pixel Surface

- **Map editor**: Phaser canvas renders map tiles on a `16x16` logical grid. Use `image-rendering: pixelated` on DOM canvas wrappers and nearest-neighbor rendering in Phaser.
- **Grid**: grid lines are overlays, never baked into tile assets. Grid visibility is toggleable and defaults on in Edit mode.
- **Overlays**: collision, event, start position, selection, and hover overlays must be visually distinct and use tokenized colors.
- **Zoom**: integer zoom steps only: 1x, 2x, 3x, 4x, 6x, 8x. No fractional pixel scaling.

### Right Tabs

- **Map tab**: name, dimensions, tileset, start position, layer visibility, map notes.
- **Event tab**: trigger, condition, sprite, move route, command list, and nested command editor.
- **Database tab**: Switches, Variables, Common Events, Tilesets, Terms, and future battle records in sub-tabs.
- **Resources tab**: bundled and uploaded tilesets/sprites, import actions, preview, metadata, replacement safety warnings.
- **Debug/Status tab**: validation messages, save state, schema version, selected IDs, and play-session state when relevant.

### Database Panels

- Database panels are utilitarian split views: list on the left, form/details on the right.
- Tables use stable row height, visible selected row, keyboard navigation, and search/filter input.
- Switches and variables display stable numeric or string IDs plus editable names. Names are labels; IDs are references.
- Tileset editing must show passability, priority, terrain, and source image preview without changing the original image pixels.

### Resource Panels

- Resource previews use checkerboard or recessed neutral backgrounds when alpha matters.
- Imported tilesets and sprites must show dimensions, logical frame/tile size, source type, and validation warnings.
- Deletion is disabled for bundled defaults and confirm-gated for uploaded assets referenced by maps or events.

### Play Presentation

- The play viewport is `320x240` logical pixels by default, matching the target era's presentation. It may scale only by integer factors with nearest-neighbor filtering.
- Center the play surface in a neutral well. Letterbox with `--surface-recessed`; never stretch to fill arbitrary aspect ratios.
- Dialogue and choice overlays align to the `320x240` logical grid. They may use DOM for accessibility, but must visually align with pixel scaling.
- Character sprites use a `24x32` logical frame convention unless a resource explicitly declares another size.

### Side-View Battle Surface

- Future battle UI uses the same `320x240` logical play viewport and integer scaling.
- Default structure: enemy group upper/mid field, party/status command area in the lower band, command window anchored to the bottom or right depending on available width.
- Battle sprites must be original or permissively licensed. Do not reproduce RM2K3 battlers, animations, icons, or window graphics.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | `80-120ms` | `ease-out` | Button press, hover, active row |
| Standard | `140-220ms` | `ease-in-out` | Drawer open, tab switch, popover |
| Canvas feedback | `0-80ms` | `linear` | Tile hover, placement preview |

### Rules

- Pixel surfaces prioritize immediate response. Avoid animated zooms that introduce blurred intermediate frames.
- Animate only `transform`, `opacity`, and `filter`. Do not animate layout properties.
- Every interactive element must have hover, active, disabled, and focus-visible states.
- Respect `prefers-reduced-motion` by disabling non-essential panel and drawer transitions.
- Keyboard workflows must cover tool selection, tab changes, map tree navigation, command list navigation, and play mode input.

## 7. Depth & Surface

### Strategy

Use a mixed strategy: editor chrome uses crisp borders and slight tonal shifts; pixel canvases sit in recessed wells; transient overlays may use small shadows only when they need to float over dense content.

| Depth Role | Token/Value | Usage |
|------------|-------------|-------|
| Border/default | `1px solid var(--border-default)` | Panels, toolbar groups, inputs |
| Border/strong | `1px solid var(--border-strong)` | Active canvas, selected tile, focused modal |
| Recessed surface | `var(--surface-recessed)` | Canvas wells, preview wells |
| Floating shadow | `0 8px 20px rgba(0, 0, 0, 0.22)` | Modal and popover only |

### Data Test ID Policy

- Stable `data-testid` attributes are required for user-facing workflows, not decorative wrappers.
- Use domain-scoped names: `topbar-play-toggle`, `map-canvas`, `tile-palette-cell`, `map-tree-node`, `inspector-event-tab`, `database-switch-row`, `resource-import-button`, `play-canvas`, `battle-surface`.
- Dynamic IDs append stable record IDs, never visible names: `map-tree-node-town01`, not `map-tree-node-Forest Village`.
- Do not rename or remove existing test IDs without updating the test or QA scenario that depends on them.
- Prefer accessible queries for tests when possible; keep `data-testid` for canvas surfaces, repeated grid cells, and controls whose visible label changes by localization.

### Accessibility Baseline

- All toolbar buttons, tabs, menu items, map tree rows, database rows, and modal controls must be keyboard reachable.
- Canvas-only actions need a mirrored accessible control or command path in the surrounding UI.
- Focus must remain visible on light and dark surfaces with `--accent-primary`.
- Text and UI chrome should meet WCAG AA contrast. Pixel assets are exempt as artwork, but labels and overlays are not.
- Imported asset errors, save failures, and destructive confirmations must be announced through visible text and an accessible live region.
