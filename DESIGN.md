# RPG ZZU Design System

> **Status note:** The editor chrome is a cool white studio with one indigo accent. Runtime game surfaces keep their retro/pixel window presentation. The event-command editor is a cream-studio command editor: the event-command list, canvas, and every command form use cream tokens (`src/styles/tokens.css`), Korean-first modern labels, human sentences (named flags, no `Sw[0001]` / `◆` / `ON` / raw `\c[1]` chip walls), and the `cream form` field pattern — no RM2K3 retro command-list presentation. Shell tokens live in `src/styles/tokens.css` (single source of truth, imported first in `src/styles/index.css`) with `html { color-scheme: light; }` (`src/styles/index.css:75`); legacy names are aliased in `src/styles/editor/core.part-1.css`, `src/styles/database/tabs-b-shell-layout.css`, and `src/styles/shell/figma-editor/01-shell-topbar-team.css`. Warm cream elevation is `canvas < inset < base < surface < raised < overlay`. Previous dark values live in git history only. When the code changes, update this file — it is the source of truth, not an aspirational target.

## 1. Atmosphere & Identity

RPG ZZU is a compact game-making workbench. The user directs an agent named **감독**; the pixel map is the stage; the chrome is a warm cream tool shell. Korean-first labels. The signature is a faceset plate (name + presence + a one-line brief of map/layer/selection) plus an `@>` command log that defaults to a **float** over the canvas, a map/tile/event tool sidebar docked as the left column, and a recessed cream canvas well as the stage. The empty start surface is the map briefing (`지금 이 맵`) plus at most three next-move rows. Composer modes are **지시 / 질문 / 계획**. The left drawer uses a tab strip that reweights `left-map-root` / `left-palette-root` without hiding those testids. There is no theme toggle.

The system is a Vite + TypeScript + Phaser browser app: DOM panels and controls wrap Phaser-rendered edit/play surfaces. No framework, no CSS-in-JS. General chrome styles live in `src/styles.css`; Database tileset chrome is split into `src/styles.databaseTilesets.css` and `src/styles.databaseTilesetsTerrain.css` so the large tileset editor stays readable and under the module-size ceiling.

## 2. Color

### Active editor shell — cool white studio

There is **one shipped editor shell theme**: cool white + slate + indigo `#4A57D6` in `src/styles/tokens.css`. Ladder: `canvas/inset #EEF1F4 < base/surface #F7F8F8 < raised/overlay #FFFFFF`. Text `#0F172A/#475569/#64748B`. Legacy `--gold` is an indigo alias. `color-scheme: light`. No theme toggle.

### Cream shell tokens (SoT: `src/styles/tokens.css`)

Defined in `src/styles/tokens.css` (`src/styles/index.css:75` sets `color-scheme: light`). New chrome uses these names. Legacy `--editor-*` / `--bg` / `--surface-*` aliases in the three bridges resolve to the same values so existing rules keep working.

| Token | Value | Usage |
|------|-------|-------|
| `--bg-base` / `--bg-surface` | `#F7F8F8` | App shell + panels |
| `--bg-raised` / `--bg-overlay` | `#FFFFFF` | Cards, dialogs, popovers |
| `--bg-inset` / `--bg-canvas` / `--bg-well` | `#EEF1F4` | Wells + canvas tray |
| `--text-1` | `#0F172A` | Primary |
| `--text-2` | `#475569` | Secondary |
| `--text-3` | `#64748B` | Hint |
| `--accent` / `--gold` | `#4A57D6` | Send, accept, selection |

### Primary token set (what the UI is actually built from)

These legacy tokens are still defined in `:root` and used by older chrome and RM-style surfaces. For the main editor shell, prefer the modern editor shell tokens above.

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

### Event command editor tokens (cream studio)

The event-command content surface — list, gutter, hover/selected states, and type coloring — uses the cream studio tokens. There is no retro theme.

| Token | Token alias | Value | Usage |
|------|-------------|-------|-------|
| `--text-1` / `--accent` | (`--rm2k3-command-blue` alias) | `#4A57D6` | Command kind prefix and flow labels on cream (`@>`-style lines are retired) |
| `--gold` | (`--rm2k3-command-orange` alias) | `#8A6B2F` | Attention / reward-affecting summaries on cream |
| `--success` | (`--rm2k3-command-teal` alias) | `#18764F` | Picture/audio summaries on cream |
| `--bg-hover` | (`--rm2k3-command-row-alt` alias) | `rgba(42,37,33,0.06)` | Subtle row stripe / hover wash |
| `--accent-muted` | (`--rm2k3-command-selected` alias) | `rgba(74,87,214,0.12)` | Selected/focused command row fill (`--accent-border` for the ring) |

Retired literal RM blues/teals (`#004bff` / `#f07f00` / `#008c8c` / `#e8f2f7` / `#0080ff`) must not be reintroduced. Old `--rm2k3-command-*` names remain only as cream aliases during the CSS consolidation wave (see `.omo/evidence/event-editor-modern/DESIGN.md`). The single scan-aid palette going forward is `--cmdcat-*` (unified from `--cmdcat` / `--pick-cat` / `--lg-cat`).

### Database state editor tokens

The Database > States editor uses RM2K3-style colored A-E rate grades and a small status-animation preview swatch. Keep these scoped to the States editor rather than reusing them for general status semantics.

| Token | Value | Usage |
|------|-------|-------|
| `--rm2k3-state-rate-a` | `#df4057` | A-grade state rate marker |
| `--rm2k3-state-rate-b` | `#d36b20` | B-grade state rate marker |
| `--rm2k3-state-rate-c` | `#209842` | C-grade state rate marker |
| `--rm2k3-state-rate-d` | `#4437b6` | D-grade state rate marker |
| `--rm2k3-state-rate-e` | `#a020a8` | E-grade state rate marker |
| `--rm2k3-state-preview-a` | `#87c7cd` | State animation preview checker tone |
| `--rm2k3-state-preview-b` | `#bde5e2` | State animation preview checker highlight |
| `--rm2k3-state-preview-c` | `#9bd5d4` | State animation preview checker base |

### Database battle animation editor tokens

The Database > Battle Animations editor follows the RM2003 animation editor composition: a black target stage, green center guides, red cell selection, and teal pattern strip. Keep these scoped to the animation editor.

| Token | Value | Usage |
|------|-------|-------|
| `--rm2k3-animation-stage` | `#000000` | Battle animation target preview well |
| `--rm2k3-animation-strip-bg` | `#87b5b5` | Bottom animation-pattern strip background |
| `--rm2k3-animation-grid` | `#009020` | Preview crosshair guide lines |
| `--rm2k3-animation-selection` | `#ff1010` | Selected animation cell outline |

### Runtime shop tokens

The Shop Processing play overlay follows the blue RM-era shop windows rather than the editor's light chrome. These tokens are scoped to `.runtime-shop-*` UI only.

| Token | Value | Usage |
|------|-------|-------|
| `--rm2k3-shop-blue-hi` | `#1d57c9` | Top edge of runtime shop panels |
| `--rm2k3-shop-blue` | `#1944ac` | Primary runtime shop panel fill |
| `--rm2k3-shop-blue-deep` | `#173282` | Lower/deeper runtime shop panel fill |
| `--rm2k3-shop-highlight` | `#2b65db` | Selected runtime shop row/menu option |
| `--rm2k3-shop-highlight-deep` | `#12318a` | Selected row/menu depth |
| `--rm2k3-shop-highlight-ring` | `rgba(255, 255, 255, 0.45)` | Selected row inner highlight |
| `--rm2k3-shop-panel-shade` | `rgba(0, 0, 0, 0.08)` | Subtle lower panel shading |
| `--rm2k3-shop-cyan` | `#8ee8ff` | Bright shop panel bevel |
| `--rm2k3-shop-shadow` | `#061034` | Deep shop panel bevel and text shadow |
| `--rm2k3-shop-text` | `#e8f4ff` | Runtime shop text |
| `--rm2k3-shop-muted` | `#a9b9dd` | Runtime shop secondary text |
| `--rm2k3-shop-font-size` | `8px` | Runtime shop bitmap-scale type |
| `--rm2k3-shop-gap` | `3px` | Panel separation inside the 320x240 game stage |
| `--rm2k3-shop-top-height` | `28px` | Top message/status band height |
| `--rm2k3-shop-menu-height` | `74px` | Bottom menu/prompt band height |
| `--rm2k3-shop-side-width` | `132px` | Right-side party/stat/gold panel width |
| `--rm2k3-shop-row-height` | `13px` | Menu and item row height |
| `--rm2k3-shop-party-height` | `48px` | Party preview panel height |
| `--rm2k3-shop-owned-height` | `48px` | Owned/equipped panel height |
| `--rm2k3-shop-sprite-*` | component colors | CSS pixel party sprites in shop preview |

### Runtime pixel font and window skin tokens

Runtime game surfaces use a separate retro presentation layer from the modern editor shell. These tokens are defined in `src/styles/runtime/system.css` and are scoped by usage to player/runtime DOM surfaces, not editor workbench chrome.

| Token | Value | Usage |
|------|-------|-------|
| `--runtime-pixel-font` | `"Galmuri11", "Galmuri9", ...` | Dialogue, choices, title/load, main menu, battle HUD, shop/inn, game-over, and name input |
| `--runtime-font-size-9` | `9px` | Compact Galmuri9 native-size labels and dialogue text on the 320×240 stage |
| `--runtime-font-size-11` | `11px` | Standard Galmuri11 native-size menu/HUD text |
| `--runtime-font-size-18` | `18px` | 2× Galmuri9 display text and compact runtime headings |
| `--runtime-font-size-22` | `22px` | 2× Galmuri11 title text |
| `--runtime-window-skin` | `url("/assets/ui/windowskin-default.png")` | Shared 9-slice skin for runtime game windows |
| `--runtime-window-slice` | `24 fill` | `border-image-slice` value for the 96×96 default skin |
| `--runtime-window-border` | `8px` | Standard runtime window border width |
| `--runtime-window-border-tight` | `6px` | Compact nested runtime window border width |

### Runtime title-screen tokens

The default game title screen is an editorial story opening on the authored 320×240 stage: left-aligned kicker `A NEW ADVENTURE`, display title, subtitle `이야기가 시작되는 곳`, and a text menu with a single indigo selected rail. Size type in logical stage pixels, never viewport `vw`, because the stage is scaled. Do not restore the oversized crest, saturated RM menu window, or technical key-help wall. Legacy `--rm2k3-title-*` names remain only for load-window and older chrome.

| Token | Value | Usage |
|------|-------|-------|
| `--oprn-title-text` | `#f8fafc` | Editorial title and menu text |
| `--oprn-title-shadow` | `rgba(5,12,28,0.72)` | Soft title depth, not a hard pixel outline |
| `--accent` | `#4A57D6` | Selected menu rail |
| `--rm2k3-title-window-shadow` | `#061038` | Load-window text depth only |
| `--rm2k3-title-highlight-ring` | `rgba(255,255,255,0.86)` | Keyboard focus ring on load slots |

### Runtime battle tokens

The side-view battle overlay follows the blue RM-era game window style rather than the editor's light chrome. These tokens are scoped to `.battle-*` UI only.

| Token | Value | Usage |
|------|-------|-------|
| `--rm2k3-battle-blue-hi` | `#2659c8` | Top edge of runtime battle windows |
| `--rm2k3-battle-blue` | `#123996` | Primary runtime battle window fill |
| `--rm2k3-battle-blue-deep` | `#0a1f5e` | Lower/deeper runtime battle window fill |
| `--rm2k3-battle-window-light` | `#8fb7ff` | Bright bevel edge for command/status windows |
| `--rm2k3-battle-window-shadow` | `#041139` | Dark bevel edge and text shadow |
| `--rm2k3-battle-text` | `#f5f8ff` | Runtime battle text |
| `--rm2k3-battle-muted` | `#b9c7ef` | Disabled/secondary battle text |
| `--rm2k3-battle-backdrop-top` | `#7990b6` | Fallback battleback sky tone |
| `--rm2k3-battle-backdrop-mid` | `#9b9a82` | Fallback battleback horizon tone |
| `--rm2k3-battle-backdrop-ground` | `#5d684b` | Fallback battleback ground tone |

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
| Body/sm | `12px` | 400 | Status, metadata, modal tabs |
| Pixel label | `11px` | 600 | Canvas badges, tile index |
| Mono | `12px` | 500 | IDs, coordinates, summaries (`var(--mono)`/`--font-mono`) |

### Font stacks

- UI: `system-ui, -apple-system, "Segoe UI", sans-serif`
- Mono (`--font-mono` / `--mono` alias): `"Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace`
- Pixel display: Galmuri is bundled locally and is used only inside runtime game surfaces through `--runtime-pixel-font`, with `font-display: block` to avoid fallback-gothic FOUT.

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

- Root layout: `topbar / body` (column). There is no persistent bottom statusbar.
- **Topbar**: a stacked RM2K3 chrome — an `rm2k3-menu-bar` (22px) plus one or two `rm2k3-toolbar-row`s. It is **multi-row**, not a single 40px bar.
- **Body**: with empty storage, the map/tile/event tool sidebar is the left docked column and the 감독 workspace defaults to **float** over the canvas. The saved `chatDock` value is honored on later boots: **side** remains available as a user toggle and adds a docked AI track without replacing the tool sidebar. The canvas must retain the widest usable work area.
- **Left drawer**: the docked tool column beside the canvas, never a row under the agent log. Empty events are one line (`이벤트 없음 · 더블클릭으로 추가`). Map tree still uses `map-tree-node-*` testids. Beginner substitutes its 48px direct-action rail and opens a requested flyout rather than auto-opening the tile flyout.
- **Center work area**: fills remaining width, centers the Phaser canvas in a recessed well. Canvas controls must not change canvas dimensions.
- **Database and Resources**: opened from the topbar as work windows. The Database window has an explicit dock toggle and may become a contained docked panel; Resources remains a modal work window.
- **Authoring journey**: a 32px checklist icon at the canvas bottom-left (`authoring-journey-toggle`). The project/map/event/data/test checklist opens as a popover; it must not reserve a full-width bottom row or shrink the canvas.

### Desktop support floor

- The editor is desktop-only. `1024px` is the minimum supported viewport width; `1024×768`, `1280×800`, and `1440×900` are the shell acceptance matrix. Below `1024px` is not a mobile support target, even if legacy collapse styles remain present.
- Maintain ≥ `32px` targets for touch and ≥ `24px` for dense desktop icon buttons. Do not scale editor text with viewport width — use layout changes instead.

## 5. Components

### Editor topbar

- **Structure**: RM2K3 menu bar (프로젝트/맵/도구/게임/도움말) + the three-button `editor-ui-mode-toggle` (초보/표준/전문가). Inactive mode buttons stay visible at every supported desktop width; only brand text and the beginner test-play label may collapse below `1320px`. Toolbar rows follow (title + mode badge, file/undo/DB actions, layer + zoom controls).
- **Shortcuts**: F5/F6/F7 layers, 1–7 tools, +/- zoom, Ctrl+S save, Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste (see `src/editor/hotkeys.ts`). Hotkeys are disabled while a form control or modal has focus. Ctrl+K opens the integrated palette covering tools, layers, Test Play, Database, World, Resources, current-map PNG, build-palette toggle, map/tile/event drawers, explicit mode selection and mode cycling, AI side/float dock toggle, Help, map navigation, and AI skills.

### AI director plate

- Header plate (`data-testid="ai-director-plate"`): 48px faceset crop of `easyrpg-faceset-actor1` index 0 (standard 4×4 / 48px cell) + name `조수` + one-line `idlePresenceLine`.
- Face is `role="img"` `aria-label="조수"`, pixelated, no emoji. Name is the header `h2`. Line is `data-testid="ai-director-line"`.
- Tokens: name `--text-1` 13px/600, line `--text-2` 12px/400, gap `--space-2`, face well `--studio-inset` / `--studio-line` (or `--bg-inset` / `--border-subtle` aliases). No 지시/질문/계획 chips on the plate.
- Presence line is idle copy unless a turn is running. Collapsed restore `aria-label` is `조수`. Primary actions (보내기, 이 맵에 넣기) and `@>` use `--gold`, not indigo.

### AI conversation column — Cursor 3-band (locked 2026-08-25)

Glass/side assistant is three bands only:
1. **Plate** — faceset + `조수` + one status. Overflow (`⋯`) holds dock/new-session/settings. No `+` / dock word / detach on the plate.
2. **Stream** — conversation and tool rows. This band owns scroll. Empty stream may show a one-line hint + at most two chips. No visual gallery.
3. **Composer** — inset well + indigo `전송`, always at the bottom.
Proposal cards float over the map (imposter), not inside these three bands.

### AI conversation column (2026-08-25)

Spatial contract (StyleGallery `scroll-body-shell` + `media-object` + `feed` + `imposter`):
- The assistant is a cream **conversation column**, not a watery 260px billboard. Glass overlay is `360px` (`min(360px, 34%)`), left-inset `12px`. Side dock keeps the same column language at `minmax(320px, 36%)`.
- **Scroll owner**: `.ai-chat-log` (or `.ai-glass-log` on glass). Header plate and composer stay put. Do not scroll the whole card.
- Header is a `media-object`: 40px faceset + stacked `조수` / one-line presence. Actions are a 32px icon cluster (dock / more / collapse). No sentence-length dock labels on the plate.
- Log is a `feed`: user turns sit in an inset well; assistant turns sit on `--bg-raised` with a 1px `--studio-line`. Tool/system rows stay `@>` mono. No indigo, no three-card visual gallery as the boot empty surface.
- Composer is an inset well (`--bg-inset`) with a gold filled `보내기`. Focus ring uses `--gold`, not indigo.
- A pending proposal does **not** stay a thin strip inside the 380px column. It floats as an `imposter` over the canvas: `min(520px, 92vw)` cream card, gold filled `이 맵에 넣기`, map ghost still visible around it. Tile-changing proposals (including `author_house`) always show a **지금 / 적용 후** pair.

### AI idle hints

- Quiet Gold idle on glass/side shows at most two `@>` hint rows (`ai-idle-hints`). Click sends. Composer chips stay empty.
- Placeholder is `formatComposerPlaceholder(readAgentBrief())`.
- Ink Only hides gold hint color. Map First hides the card and keeps one command line, left-offset by `--editor-left-safe`.
- The overlay empty kit (`ai-start-visual-gallery`, `ai-empty-cta`, start-history stack) is not the boot empty surface.

### Left palette & map tree

- **Tool palette**: pencil, fill, eyedropper, pan, select, collision, event, erase. Icon buttons with tooltips and visible active state.
- **Tile palette**: chipset bands (terrain/water·road/building/props) with category tabs; fixed preview cells. Selected tile has a strong border.
- **Layer selector**: surfaced in the toolbar as 하위/상위/이벤트 segmented buttons. Lower/Upper/Event are the three layers.
- **Map tree**: hierarchical rows with expand/collapse, active map, parent/child indentation, drag-and-drop reparenting (`mapList.ts`), and a parent-select fallback. Context menu: add-child, duplicate, set-start, delete, screenshot.

### Center pixel surface

- **Map editor**: Phaser canvas on a 16×16 logical grid; `image-rendering: pixelated`, nearest-neighbor.
- **Grid**: grid lines are overlays (`--pixel-grid`), toggleable, default on in Edit mode.
- **Overlays**: collision, event, start position, hover preview — tokenized, visually distinct.
- **Zoom**: integer steps only: `1, 2, 3, 4, 6, 8` (`EDITOR_ZOOM_LEVELS`). One canvas stepper (`−` / current / `+`) plus a menu of `editor-zoom-*` marks. The classic toolbar no longer duplicates `1x 2x 4x 8x`. Beginner docks the stepper in `--editor-canvas-chrome-top`. Standard/expert keep map-save/build behind the ⋯ gate.

### Database & resource modals

- **Topbar actions**: Resources (소재) opens `resourceModal`; Database (DB) opens `databaseModal`. They are the canonical editor paths for asset and database work.
- Map properties and Event editing are not dock tabs: event editing lives in the left palette when the event layer is active and opens as a modal; map properties are edited via the map tree context menu / database.
- **Database**: 15 tabs — 주인공/직업/스킬/아이템/장비/몬스터/적그룹/상태/전투애니메이션/타일셋/공통이벤트/시스템/용어/스위치/변수 (`db-tab-*`). Navigation follows the mode chrome contract: Beginner shows the `common` subset, Standard groups the navigation, and Expert exposes `all`.
- **Event editor**: cream-studio command editor. Tree-style nested command list with **drag-to-reorder** (⠿ handle), up/down/delete buttons, command picker, per-page tabs, fork/choices branches.
- **Event editor top/page controls**: cream-studio modal chrome. Page tabs show named condition sentences; validation is `오류 N · 경고 N · 안내 N` (hidden when clean), not `검사 !1 △1`. Footer is `닫기 / 반영하고 계속 / 반영하고 닫기` (`취소` is gone). Rail section headers are `언제 보이나요` / `반응 방식` / `움직임` (not `출현 조건` / `트리거·우선순위` / `이동/기타`). Event-card identity is name + coordinates; padded `ID 0001` is gone. Extra control-code chips (`\$` `\!` `\.` `\|` `\>` `\<` `\^` `\_` `\s[n]`) live behind closed `고급`. Density control stays and is labeled `간단히` (not `간단히 보기`). Picture summaries are a human sentence, never a raw slot/path dump as the scan line. Keep controls compact enough for scanning; avoid display-scale button typography inside the modal. Chrome uses cream tokens from `src/styles/tokens.css`; do not reintroduce `--rm2k3-event-page-*` or classic-gray `#eeeeee`/`#f4f4f4` fieldsets.
- **Event editor sizing**: the event editor is a desktop-default work window at wide widths, but it must remain usable down to roughly `800px` viewport width. It opens with settings and a dominant command canvas; the command inspector is contextual and appears only after command selection. Wide layouts allocate it a fixed right track, while compact layouts overlay it on the right so the canvas does not permanently lose width. Around `900px` and below, the modal clamps to the viewport and compresses the left settings/conditions column while keeping the command contents as a second column; do not stack settings above commands unless the viewport is narrower than the supported editor width.
- **Event editor resizing**: users can resize both the modal window and the settings/command split. The vertical separator between settings and command contents adjusts the left settings column; the bottom-right grip adjusts the whole event editor window. Keep both handles visible and keyboard-focusable, and keep resize behavior bounded to the viewport.
- **Event move-route dialog**: custom autonomous movement opens a cream-studio route editor, not a desktop RM-era work window. Named per-step pickers replace the shared `매개변수` box; frequency is `아주 드묾 … 아주 자주` (values 1–8 stay). No `$>/@>` prefixes, no always-on frequency radios, no three-column RM command grid, no `확인/취소/도움말` footer. Unsupported movement commands should render disabled rather than pretending to save runtime behavior.

### First run and online save

- The first required screen speaks in user concepts: **작업**, **온라인 저장**, **작업 선택**. Do not expose `DB`, `Supabase`, `Anon key`, `Project ID`, or `.env` in the default path.
- `작업 열기` is a card-first picker. Each card shows the work title, preview, map/tileset counts, and last-saved time; selecting a card immediately opens it. Connection credentials stay inside a closed `연결 문제 해결` disclosure.
- The required first-run picker cannot be dismissed until a work opens. Loading, empty, offline, and error states use recovery copy that tells the user what to do next without dumping provider errors.
- The status bar says `온라인 저장`; help, save, reload, and recovery copy use the same vocabulary. Provider names and raw credentials are reserved for internal implementation and the advanced troubleshooting disclosure.
- At compact widths the picker becomes a single-column scroll surface with full-width actions. Technical fields remain keyboard reachable only after the disclosure is opened.

### Database panels

- Utilitarian split views: list on the left, form/details on the right (`db-detail-form`).
- **Human-owned tileset knowledge**: Database > Tilesets keeps the selection/template/passage/layer/group editor visible as the default Knowledge surface. AI never replaces or collapses this manual editor. A bottom `AI 타일셋` action opens a separate workspace and leaves the normal editor dimmed underneath.
- **Conversational AI tileset workspace**: the modal occupies `min(94vw, 1440px)` by `min(88vh, 900px)` and uses a `58 / 42` atlas-to-conversation split. The atlas shows confirmed, questioned, and unclassified regions with thin semantic outlines; the active question and its region share the warning color and question index. The conversation pane contains prior AI/user turns, one current AI question, quick replies, a freeform answer composer, and a next-question preview.
- **Draft/apply boundary**: whole-atlas analysis, AI questions, user answers, and staged confirmations remain detached from project data. An answer may confirm the current inferred group inside the workspace, but only `확정된 N개 적용` records one project snapshot and persists those groups. Human-authored groups and locked metadata remain protected, and stale analysis must be rerun.
- **Workspace states and accessibility**: `idle`, `analyzing`, `ready`, `partial`, `offline`, `error`, `stale`, `saving`, and `saved` remain visible text states. The modal uses `role=dialog`, `aria-modal=true`, a labelled title, visible focus, Escape close, polite status updates, and `aria-busy` during analysis/apply. Below compact widths the split stacks without hiding either the atlas or conversation.
- Switches and variables display stable IDs plus editable names; names are labels, IDs are references.
- Tileset editing shows passability/priority/terrain and a source-image preview without altering original pixels.
- State and Animation tabs show reference panels / pixel previews rather than bare stubs.
- Troops (`적 그룹`) uses a classic RM2003-style two-column composition: fixed left record rail, top name/configuration strip, large battle placement preview, member/terrain controls under the preview, and battle event pages in the right editor column. Its dedicated surface lives in `src/editor/panels/databaseTroopRecordView.ts` with `src/styles.databaseTroops.css`.

### Resource panels

- Resource previews use a recessed neutral background when alpha matters.
- Imported tilesets/sprites show dimensions, frame/tile size, source type, and validation warnings.
- Deletion is disabled for bundled defaults and confirm-gated for uploaded assets referenced by maps/events.
- The Resource Manager modal follows the classic RM2K3 resource window composition: left category list, center resource list, right command/format/preview rail, and bottom close/help controls.
- Resource Manager clone metrics live as local `--rm-resource-*` CSS variables on `.resource-modal-window`; use those variables for pane widths, row height, command button height, preview height, and footer button width rather than scattering one-off dimensions.

### Play presentation

- Play viewport is `320×240` logical pixels (`PLAY_RESOLUTION.width`/`PLAY_RESOLUTION.height`), then scaled by the largest whole-number factor that fits inside the test-play/player shell with nearest-neighbor rendering.
- The test-play window uses the full available browser window; the runtime surface stays 4:3 and centered, appearing at `2x` (`640×480`) or larger when space allows without cropping or distortion.
- The editor's map canvas may remain pixel-grid constrained.
- Dialogue/choice overlays align to the 320×240 grid (DOM for accessibility, visually pixel-aligned).
- Zone feedback is a compact, pointer-transparent runtime layer for transient banners, checkpoint toasts, incomplete objective chips, and one facing interaction prompt. It reuses the runtime window tokens, respects reduced motion, and disappears under modal dialogue, battle, menu, commerce, chest, and ending surfaces; it is not a minimap or a persistent HUD.
- Character sprites use a `24×32` logical frame convention for charsets (`CHARSET_FRAME_*`); generic sprites may be `32×32`.

### Side-view battle (built)

- `battle-scene` testid; battle field on top, then a compact bottom HUD with message window, command panel, and party status. Avoid extra analysis panels in the shipped play UI.
- **Commands**: 공격 / 스킬 / 아이템 / 방어 / 도주, with skill and item submenus. The command panel should contain commands only; active actor stats live in party status. Actor battle sprites render from the actor's `battleCharacterResourceId`; enemy sprites from `monsterResourceId`.
- Target selection keeps field brackets, a short target prompt, key hints, and clickable target rows. Victory/result uses a compact reward summary only.
- Battle is database-driven: actor stats from parameter curves, enemy stats/rewards from records, skill effects (damage/healing/support/switch), agility-derived ATB charge, defense + defend halving.
- Battle sprites must be original or permissively licensed. Do not reproduce RM2K3 battlers, animations, icons, or window graphics.

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | `80–120ms` | `ease-out` | Button press, hover, active row |
| Standard | `140–220ms` | `ease-in-out` | Drawer, tab switch, popover |
| Canvas feedback | `0–80ms` | `linear` | Tile hover, placement preview |

- Pixel surfaces prioritize immediate response; avoid animated zooms that blur intermediate frames.
- Tileset AI analysis uses a stateful action transition (`idle → analyzing → ready|partial|error|offline`) with text and opacity feedback only; reduced motion removes the pulse. Each user answer moves the conversational workspace to the next uncertain region only after the refreshed proposal is available. Manual tile range selection remains immediate in the underlying human editor and is unaffected by opening or closing the AI workspace.
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
- Tiles: `tile-palette`, `quick-tile-grid`, `tool-*`, `layer-*`, `editor-zoom-*`, `editor-zoom-stepper`
- Map tree: `map-tree`, `map-tree-node-${mapId}`
- Topbar modals: `toolbar-resource-manager`, `toolbar-database`, `resource-modal`, `database-modal`
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

## 10. Desktop UI integration truth (2026-08-11)

- Beginner, Standard, and Expert are desktop density presets, not separate products or permission levels. First visit is **Beginner**. The mode toggle is text weight/underline, never a filled plan-picker. Beginner uses the 48px direct-action rail (tool / layer / panel groups with Korean layer labels 바닥·장식·이벤트), does not auto-open the tile flyout, and limits Database navigation to the common subset. Standard exposes the full palette and map tree with simplified chrome and grouped Database navigation. Expert adds the classic toolbar, dense canvas controls, and all Database navigation; every visible expert toolbar button is actionable, while unsupported legacy stubs remain hidden. The chrome contract is carried by `mapTree`, `classicToolbar`, `canvasChromeDense`, `helpMenu`, `gameMenuLabel`, `paletteRail`, `leftPanelMaxWidthPx`, `layerTermStyle`, `prominentTestPlay`, `coachMarks`, `standardWelcome`, `statusbarDensity`, `railLabels`, `databaseNav`, `eventBeginnerChrome`, and `jargonStyle`. The same project, history, camera, and AI session continue across mode changes.
- With empty storage, the AI assistant boots **open** and its dock defaults to **float** over the canvas; the map/tile/event tool sidebar remains the left docked column. A stored `chatDock` of **float** or **side** is honored, and the side dock remains a user toggle. A user who collapses AI keeps that choice; a turn that started collapsed re-collapses after idle, but an already-open panel stays open. The header is an agent plate (faceset crop + name `조수` + one-line presence). Empty layout defaults the dock to **glass** and temperature to Quiet Gold. The work log uses RM-style `@>` command rows, not chat bubbles. A pending proposal mounts an inline decision card (이 맵에 넣기/취소). The collapsed restore control is a 48px button (`aria-label="조수"`) showing the same face and a status dot — no `AI` wordmark, no vertical hangul, and no emoji. Restoring returns the persistent panel and composer without discarding a draft or leaving the desktop viewport. Default agent mode is **chat** (one turn at a time). Slash skill rows show Korean names. Unconnected send shows a 연결하기 card instead of dumping the settings form.
- Event-editor ownership is the desktop matrix `1586×992`, `1280×900`, `1024×768`, and `960×900`. Its top strip, two-column workbench, conditions, command list, and footer stay in normal non-overlapping flow, and coachmarks are suppressed while it is open.
- Test Play uses whole-number fit-without-crop scaling: the `320×240` runtime stays centered, 4:3, fully visible, and nearest-neighbor sharp. Title options expose one roving Tab stop; arrow navigation, keyboard confirmation, and trusted pointer activation share the same selected-option path.
- Shared `showConfirm`/`showAlert` dialogs expose programmatic title/message relationships, focus the first action deterministically, trap Tab/Shift+Tab, route Escape through the top `modalStack` entry, and restore only an opener that is still attached.
- Modern Exteriors asset packaging, custom-atlas layers, seeding, remote persistence, and the Modern remote diagnostic remain blocked pending repository-visible redistribution rights. Those workstreams have no local-fixture or DB-write substitute.

## 11. Database Studio (2026-08)

The Database modal is a neutral cool studio scoped to `.database-modal-backdrop` via `src/styles/database/studio-theme.css` (imported after `system-studio.css`). Tokens are `--db-studio-*`; the rest of the editor stays warm cream (`src/styles/tokens.css`, `color-scheme: light`). No gradients, no heavy shadows, no Inter.

### Tokens

| Token | Value | Role |
|-------|-------|------|
| `--db-studio-canvas` | `#F7F8F8` | modal body / page bg (replaces cream well) |
| `--db-studio-surface` | `#FFFFFF` | cards, header, footer, sidebar |
| `--db-studio-inset` | `#F1F5F9` | search wells, hover, list well alt |
| `--db-studio-well` | `#EEF2F6` | secondary inset |
| `--db-studio-text-1` | `#0F172A` | primary text |
| `--db-studio-text-2` | `#475569` | secondary |
| `--db-studio-text-3` | `#94A3B8` | muted / placeholder |
| `--db-studio-border-subtle` | `rgba(15,23,42,.08)` | hairline section divider |
| `--db-studio-border-default` | `rgba(15,23,42,.10)` | card/input border |
| `--db-studio-border-strong` | `rgba(15,23,42,.18)` | emphasis |
| `--db-studio-accent` | `#4A57D6` | primary (kept hue, Linear feel vs cream) |
| `--db-studio-accent-soft` | `rgba(74,87,214,.08)` | selected row tint |
| `--db-studio-accent-border` | `rgba(74,87,214,.16)` | selected border |
| `--db-studio-shadow` | `0 1px 3px rgba(15,23,42,.08)` | raised |
| `--db-studio-shadow-pop` | `0 4px 16px rgba(15,23,42,.10)` | modal/popover |

Legacy `--db-light-*` / `--bg-*` / `--db-modern-*` aliases remap to these inside the modal so older rules keep working without a second theme.

### Contracts

- **Nav:** 220px labeled rail at `>=800px` container (`container-type: inline-size` on `.database-modal-window`; media fallback at 799px), 56px icon+tooltip below. Group headers (`파티/전투·몬스터/생활/맵/시스템`) visible as 11px uppercase `text-3`. Count badge via `[data-count]` quiet pill. Selected = `accent-soft` + 2px left accent bar. Search placeholder `탭 검색` full-width readable.
- **List:** name first (`flex:1`, ellipsis), muted trailing `#n` (`#${visibleIndex}`), 24px thumb, pill sub. Selected = `accent-soft` + border ring. CSS order puts name before number; markup order matches display order.
- **Inspector:** sticky header (`top:0; z-index:2` on `.db-record-hero` / modal header) and sticky footer; former equal-weight Win95 fieldsets become hairline sections (top border only, `text-3` 12px uppercase labels).
- **Footer:** `닫기` is ghost (`transparent` + `border-default`), `지금 저장` is filled accent — enforced by `[data-testid]` selectors in `studio-theme.css` even if `.primary` class is on the other button.
- **Empty:** card + one filled CTA on studio surface, never a cream void.
- **Dirty / G006 / testids / AI dock / gallery toggle:** unchanged — chrome only.
