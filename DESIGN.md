# RPG ZZU Design System

## Worldbuilding document workspace (2026-09-06)

This slice follows the existing Database Studio primitives and tokens. It is a
writing workspace, not a dashboard: a compact item browser, a white document,
and a collapsible property inspector. No new theme, decorative hero, or card
wall. This section overrides generic database control sizing only inside the
worldbuilding workspace.

- Typography: document title 26px/1.3, prose 16px/1.65, controls 13px/1.5,
  metadata 12px/1.5, section headings 14px/600; all use `--font-ui`.
- Color: `--db-studio-surface`, `--db-studio-canvas`, `--db-studio-inset`,
  `--db-studio-text-1/2`, `--db-studio-border-subtle/default`,
  `--db-studio-accent/soft/border`. Secondary text uses text-2, not pale text-3.
- Geometry: 4/8/12/16/24/32px spacing; 6px controls, 8px document corners;
  36px toolbar controls; 256px item list; 272px expanded properties.
  The document editor is at least 320px high and grows with its text.
- Scroll ownership: modal header/footer stay fixed. Item list and document
  have independent vertical scrolls; an expanded property pane owns its scroll.
  The document textarea grows instead of introducing a nested prose scrollbar.
- Below 800px available workspace width, list and document are alternate views,
  never two short stacked scroll boxes. A persistent list button returns to
  browsing without losing the draft. Properties become an in-workspace overlay
  below 1100px; Escape closes properties and restores their opener.
- Reused primitives: `workspaceShell`, `sectionCard`, `segmentedControl`,
  existing card media, markdown renderer, reference and relation editors.
  Shared world document properties provide closed/open/focused states.
  Item rows have default/hover/focus/selected/locked states; the optional gallery
  uses the same item data and selection path.
- Empty states distinguish no items, no search matches, and no selection.
  Creation and search reset are explicit actions. Global lint is a separate
  disclosure, not the first content in an empty document.
- Filter changes clear out-of-filter reading selections. An active draft stays
  open with an explicit out-of-filter marker. Relation navigation selects the
  target's category and clears search. Search DOM and IME focus are preserved.
- The main modal save remains the persistence authority. The document action is
  labeled `편집 완료`, not a competing remote save. Draft discard and lock guards
  retain their existing contracts.
- World overview separates draft/confirmed status from public/secret visibility.
  Legacy `status: secret` loads as a secret draft. AI inclusion remains explicit:
  world overview fields plus the first 600 body characters; codex name/summary
  only. The inspector can show the actual world overview prompt projection.
- Accessibility: native buttons/inputs/details, visible indigo focus, associated
  labels, no focus stolen while typing; 1024/1280/1440 desktop acceptance matrix.
  No runtime/mobile-editor expansion is included.

> **Status note:** The editor chrome is a cool white studio with one indigo accent. Runtime game surfaces keep their retro/pixel window presentation. The event-command editor is a cream-studio command editor: the event-command list, canvas, and every command form use cream tokens (`src/styles/tokens.css`), Korean-first modern labels, human sentences (named flags, no `Sw[0001]` / `◆` / `ON` / raw `\c[1]` chip walls), and the `cream form` field pattern — no RM2K3 retro command-list presentation. Shell tokens live in `src/styles/tokens.css` (single source of truth, imported first in `src/styles/index.css`) with `html { color-scheme: light; }` (`src/styles/index.css:75`); legacy names are aliased in `src/styles/editor/core.part-1.css`, `src/styles/database/tabs-b-shell-layout.css`, and `src/styles/shell/figma-editor/01-shell-topbar-team.css`. Warm cream elevation is `canvas < inset < base < surface < raised < overlay`. Previous dark values live in git history only. When the code changes, update this file — it is the source of truth, not an aspirational target.

## 1. Atmosphere & Identity

### Equipment slot management

Equipment uses a native labelled slot select so project-defined slots do not expand the fixed
inspector header. The add/rename/remove disclosure lives in the scrolling inspector body, above
the equipment cards. It uses existing Database Studio surface, border and text tokens, 12px
control text, 8px corners and 12px internal spacing. Management rows keep the name and action
together; the reason for a disabled delete spans the row. Built-in and referenced slots expose
that reason as visible text. Each committed catalog operation is one undoable project edit.

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

**One accent, measured (2026-08-27).** The event editor ships several CSS generations at once (`event-editor.part-*`, `.mockup`, `.modernize`, `.modern/*`, `.balanced`), and the mockup sheet used to redeclare `--mk-accent: #d9a441` (brass) after `event-editor.css` had aliased it to `var(--gold)`. The visible result was two accents on one screen: a brass `+ 명령` toolbar primary against an indigo `저장하고 닫기` footer primary. `--mk-accent` / `--mk-accent-ink` / `--mk-accent-wash` now resolve to `--accent` / `--on-accent` / `--accent-muted`, so both primaries measure `rgb(74, 87, 214)`. Brass hexes (`#d9a441`) are allowed in event-editor sheets only as the `var(--warning, …)` fallback, never as an accent value. Keyboard focus inside the editor is a real ring: `--focus-outline` (2px `--accent`) on `:focus-visible` for the event name field and the editor's text inputs — a background swap alone is not a focus indicator. Guard: `scripts/qa-event-editor-ux.mjs` (criterion C1/C6) reads the computed background of both primaries, the resolved `--mk-accent`, and the focused input's outline width.

**One grammar, measured (2026-09-03).** The same editor measured on main `dd11c568` showed 26 button style signatures, 8 font sizes (10–18px, 41–70% of text at 11px or smaller), 10 corner radii, 43 glyph-character icon buttons and 37 text nodes under 4.5:1 on one screen (`docs/proposals/2026-09-03-event-editor-ux-redesign.html` §2). The fix is a single "문법 고정" section at the end of the cascade winner `src/styles/editor/event-editor.balanced.css` — no new sheet, no `!important`:

| Rule | Value |
|------|-------|
| Type scale | 12px 보조(종류 · 힌트 · 번호 · 칩) · 13px 컨트롤(버튼 · 탭 · 레일 · 폼 값) · 14px 읽는 글자(요약 · 값 · 인스펙터 입력 — 아래 follow-up) · 15px 제목(인스펙터 · 칼럼 머리) · 18px 이벤트 이름. Form controls set `font-size: 13px` explicitly (UA default is 13.333px). |
| Radius | 6px 바깥(카드 · 입력 · 버튼 · 필드셋) · 4px 안쪽(칩 · 알약 · 배지 · 아이콘 상자) · 50% 만 점(dot)에. No 999px pills inside the event editor. |
| Contrast | `--text-3` only on pure white at 12px+; secondary text on tinted surfaces uses `--text-2`. The choice token is `--warning` on `--control-bg` (5.6:1), not on a warning tint (3.67:1). |
| Buttons | Six groups: filled (`.btn.primary`, toolbar `.event-editor-command-tool.primary`, `.ai-event-btn.primary`) · bordered (`.btn`, toolbar tools, page tabs and page actions — white, `--border-strong`, 30px) · ghost (`.btn.ghost`, view toggle, segments, empty line) · icon (28×28: close, fullscreen, inspector close, storyboard row actions, picker favorite) · danger text · chip (`.ai-event-example`, 24px). Rail group headers reset the UA button face explicitly. |
| Icons | One SVG set, `src/editor/panels/eventEditor/editorIcons.ts` on the repo builder `buildSvgIcon` (22×22, 1.8 stroke, currentColor), 16px in place. Glyph characters (↑ ↓ ✎ ✕ ⛶ ❝ ◇ ➤ ¤ ★ △ …) are not icons; `data-glyph` stays only as a compatibility attribute and its `::before` is switched off. |
| Category colors | `--cmdcat-*` is six colors: dialogue `--accent`, flow `--warning`, reward `--success`, map `#0F7490`, screen/sound `#7A3E9D`, system/battle/actor/modern `--text-3`. Used on rails, icons and palette chips only — never on text. |

Guards: `scripts/qa-event-editor-ux.mjs` C7 (≤ 12 button signatures), C8 (font sizes ⊆ {12, 13, 14, 15, 18}), C9 (radii ⊆ {6px, 4px, 50%}), C10 (0 glyph icon buttons), C11 (0 text nodes under 4.5:1), C12 (toolbar popover closes on outside pointerdown). Escape closes only the top layer; the close-guard dialog names the real footer buttons (「적용」 · 「저장하고 닫기」). The header shows map name · coords, hides the NPC chip when nothing is linked, and no longer repeats the page count. Command summaries and the move-route target resolve event IDs to display names (`eventNameForSummary`); branch-end marker rows (「분기 끝」) are gone.

**Reading text and decoration (2026-09-03, follow-up).** After the grammar fix the editor still read badly, and the measurement said why: the command summary — the text an author reads most — was 12px (72–78% of visible characters in the list), every row carried two four-sided boxes (row border + category pill, 32 boxes for 14 rows), label / value / body competed in three colors of equal weight, and nested rows were indented 18px with marker rows set like ordinary text. The fix is one more section (「가독성」) at the end of `src/styles/editor/event-editor.balanced.css`:

| Rule | Value |
|------|-------|
| Reading text | 14px / 20px, `--text-1`: command summary body and values, choice chips, story detail, inspector title, inspector inputs and textareas. Long dialogue clamps at 2 lines instead of truncating at 1. |
| Decoration | 12px, `--text-2`: step numbers (600), category labels (600), branch markers (700), hints. The command label (「문장 표시」) is decoration — `--text-2` 500 — so the body and value carry the weight. |
| Rows are lines | White list surface (`--bg-raised`), no row border or tint, 34px min height. The 3px category bar and 28px indent guides say the structure. States are backgrounds: hover `--bg-hover`, selected `--accent-muted` + inset 3px accent. The category label is text with a colored icon, not a bordered pill. Chips and badges are borderless tints. |
| Branch markers | 12px 700 `--text-2`, standing at the child indent, with a 2px tone tick (fork `--accent`, choices `--warning`, shop `--success`) at the head of the indent guide. Markers and rows are `flex: 0 0 auto` — the list is a flex column and shrinking rows clipped the markers. |

Guards: `scripts/qa-event-editor-ux.mjs` C13 (character-weighted median font size in the command list ≥ 14px), C14 (≥ 80% of characters at 7:1 or better), C15 (≤ 0.3 four-sided boxes per command row), C16 (indent ≥ 24px per depth, markers ≥ 600 and not italic); C8 now allows 14px as the reading size. Measured on a 14-row event with choices and a conditional branch: median 12 → 14px, 7:1 share 43% → 98%, boxes 2.29 → 0 per row, indent 18 → 28px.

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

The Database > Battle Animations editor is preview-first: the current graphic's catalog name and choose/change action precede a full-width dark stage, with playback and status in their own light transport row. Frame, cell, timing and sheet authoring follow in clearly titled studio sections. The existing detail form owns vertical scrolling; only wide cell tables and pattern strips own horizontal scrolling. At supported desktop sizes (1024×768, 1280×800, 1440×900) the stage is at least 280px high, rather than sharing its width with an inspector. Controls use the existing 32px / 8px-radius studio grammar, 13px text and indigo focus ring; labels/status use 12px text-2. The graphic name wraps, including long imported names. An unset graphic has an explicit choose action; unavailable graphics never manufacture an effect. Pattern thumbnails are read-only, not inert buttons. Existing RM animation tokens below remain legacy stage-only tokens, not control colors. No new motion or playback lifecycle is introduced. Independent visual approval is required; geometry alone is not a visual verdict.

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
| App title | `13px` | 700 | Project name = the project menu trigger in the studio bar (`.studio-project-button`, ellipsis at 200px) |
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
- **Topbar (studio bar, 2026-09-03)**: **one 48px row** in every edit mode (`.oprn-menu-bar.studio-bar`, a 3-column grid: file/asset cluster | command palette | run/view/session cluster). The expert-only second toolbar row (`classic-toolbar`, 67px, 14 of 15 buttons duplicating menu items) is gone; the only extra row is the play-mode 「편집」 return row (`data-ui-density="play"`). Below `1280px` the brand text and the palette label collapse; below `1120px` tool-button labels collapse to icons. Owner sheet: `src/styles/shell/studio-bar.modern.css` (last speaker, tokens only).
- **Body**: with empty storage, the map/tile/event tool sidebar is the left docked column and the 감독 workspace defaults to **float** over the canvas. The saved `chatDock` value is honored on later boots: **side** remains available as a user toggle and adds a docked AI track without replacing the tool sidebar. The canvas must retain the widest usable work area.
- **Left drawer**: the docked tool column beside the canvas, never a row under the agent log. Empty events are one line (`이벤트 없음 · 더블클릭으로 추가`). Map tree still uses `map-tree-node-*` testids. Beginner substitutes its 72px direct-action rail and opens a requested flyout rather than auto-opening the tile flyout.
- **Center work area**: fills remaining width, centers the Phaser canvas in a recessed well. Canvas controls must not change canvas dimensions.
- **Database and Resources**: opened from the topbar as work windows. The Database window has an explicit dock toggle and may become a contained docked panel; Resources remains a modal work window.
- **Authoring journey**: a 32px checklist icon at the canvas bottom-left (`authoring-journey-toggle`). The project/map/event/data/test checklist opens as a popover; it must not reserve a full-width bottom row or shrink the canvas.

### Desktop support floor

- The editor is desktop-only. `1024px` is the minimum supported viewport width; `1024×768`, `1280×800`, and `1440×900` are the shell acceptance matrix. Below `1024px` is not a mobile support target, even if legacy collapse styles remain present.
- Maintain ≥ `32px` targets for touch and ≥ `24px` for dense desktop icon buttons. Do not scale editor text with viewport width — use layout changes instead.

## 5. Components

### Editor topbar

- **Structure (studio bar)**: left `✦ brand · [project name ▾] (menu-project: 새 프로젝트/열기/저장본 다시 불러오기/예제 ▸/가져오기/내보내기 3종) · 💾 save (toolbar-save, autosave dot: saved=success · pending/saving=warning · error=danger) · [자료집] [소재] (toolbar-database / toolbar-resource-manager, standard+expert only) · tools` — standard shows 「도구 ▾」 (menu-tools: 세계관/음악·효과음/맵·이벤트 찾기), expert (`toolStrip`) shows the same three as inline icon buttons (toolbar-world / toolbar-sound-test / toolbar-search) and has **no** 도구 menu; beginner has no 자료집/소재 buttons and its 도구 menu carries them instead. Center: command palette chip `명령 · 맵 이동  Ctrl K` (workspace-command-palette-button). Right: run group `[▶ 테스트 | ⚔]` (mode-play + topbar-battle-test), 「스튜디오」, 「보기 ▾」 (workspace-panels-button: 패널 toggles + 편집 모드 radios 초보/표준/전문가 with one-line hints — **no 밀도 group**, it was the same axis under another name), then the icon cluster ? (menu-help) · 기록 · 신원 · ⚙ AI 설정 (topbar-ai-settings) · ⤢ 전체화면. One home per action: there is no 게임 menu, no 맵 menu, no authoring-task chips, no 툴바 접기, no classic toolbar row. The selected-event test moved to the event editor's 「테스트」 button and the event-layer context menu 「이 이벤트 테스트」 (event-layer-test-event).
- **Shortcuts**: F5/F6/F7 layers, 1–7 tools, +/- zoom, Ctrl+S save, Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste (see `src/editor/hotkeys.ts`). Hotkeys are disabled while a form control or modal has focus. Ctrl+K opens the integrated palette covering tools, layers, Test Play, save, Database, World, Resources, 음악·효과음, 맵·이벤트 찾기, current-map PNG, build-palette toggle, panel open/close/move, 편집 모드 (`editor-ui-mode-*`), Help, and map navigation. The old 「밀도」 and dock-preset commands are gone with the surfaces they mirrored.

### AI assistant — the deck (2026-09-03)

The float assistant is **one glass instrument**, `div.ai-deck` inside the transparent `aside.ai-chat-panel` (canvas-wide, `inset:0`). Owner CSS: `src/styles/database/tabs-b-assistant-panel/18-assistant-deck.css` (shell · rail · transcript · timeline · composer · popovers · pill) and `19-assistant-cards.css` (receipt card · autonomous checklist · wide viewer). The five stacked layers 13–17 are gone; do not add a 20th "repair" layer — edit 18/19.

- **Geometry**: anchored bottom-right (`right:12px; bottom:14px`), radius 20, glass `color-mix(--bg-raised 90%)` + `blur(20px) saturate(1.08)`, three-layer shadow. Idle/empty/unfocused = composer only at `--ai-float-compact-width` 480; focus/turn/conversation = `--ai-deck-open-width` 760 (640 under 1300px). Saved width `--ai-float-bar-width` (`oprn:ai-panel-size`) overrides. Transcript `max-height: min(660px, 62vh)`, scrolls inside. Log-height axis and `− 100% +` zoom stepper were deleted; font size lives in settings and Ctrl+wheel.
- **Rail** (`.ai-deck-rail`, 38px, always present when open): status dot + `조수` + `· <map>` + status sentence + icon slot (context %, new chat, history, preferences, more, collapse). State is one value on `panel[data-ai-state]` / rail / pill: `idle | run | attention | done | error` — accent / warning / success / danger tokens; running paints a 2px sweeping hairline on the deck's top edge.
- **Transcript**: `.ai-command-row` keeps the two-track grid contract (04), but the `@>` prefix is hidden; user turns are right-aligned `--accent-muted` bubbles (max 78%), assistant turns are left-aligned sans prose 14px/1.55, system rows are 12px meta. Mono only for coordinates.
- **Work timeline** (`.ai-tool-activity`): a card with header `작업 N단계` (open while running) / `작업 N단계 · 라벨 → 라벨` (collapsed when the turn ends) / `조회 N건`. Rows are `map chip 46×32 · Korean label (aiToolLabels) / summary · ✓`. Map chips crop the touched region from the project (aiMapChip → renderRegionSnapshot). Function names are `title` only.
- **Receipt card** (`.ai-change-card`): badge `적용됨`, title `우물 1 · 상인 2 · 바닥 9칸`, chips, `지금 → 적용 후` pair with tag labels on the shots, footer `넓게 보기` / `되돌리기`.
- **Composer**: borderless textarea 14.5px + one 36px row: mode segment `지시 / 질문 / 계획` (ask/plan append one `[컨텍스트]` line), context pins (map · selection), undo pill, model chip (standard/expert only), 34px round send (indigo) that becomes a black round stop while running. Suggestions render **inside** the deck above the composer: `맵 진단` hint + three sentence rows (ranked by the brief). No detached popover box, no key-hint text (it is the textarea `title`).
- **Menu** `⋯`: 248px, icon + label + right meta (context %, tool count, model), opens **upward** from the rail. The idle-screen choice (`ai-command-temperature-*`) lives in the settings modal section `대기 화면`, not in the menu.
- **Collapsed pill** (`.ai-collapsed-restore`, 44px): dot + `조수` + state sentence + pending-count badge; carries the same five states.
- **Locks kept**: no face, no header plate, single float dock, popovers are `hidden` when closed (no transparent full layers), glass alpha ≥ .78, saturate ≤ 1.08, secondary text on glass uses `--text-2`.

### Left palette & map tree

- **Tool palette**: pencil, fill, eyedropper, pan, select, collision, event, erase. Icon buttons with tooltips and visible active state.
- **Tile palette**: chipset bands (terrain/water·road/building/props) with category tabs; fixed preview cells. Selected tile has a strong border.
- **Layer selector**: surfaced under the tool row as 바닥/덧그림/이벤트 segmented buttons (labels from `uiCopy`: `layerLower` / `layerUpper` / `layerEvent`). Lower/Upper/Event are the three layers. Single selection is `aria-current`, not `aria-pressed`.
- **Map tree**: hierarchical rows with expand/collapse, active map, parent/child indentation, drag-and-drop reparenting (`mapList.ts`), and a parent-select fallback. Context menu: add-child, duplicate, set-start, delete, screenshot.

### Center pixel surface

- **Map editor**: Phaser canvas on a 16×16 logical grid; `image-rendering: pixelated`, nearest-neighbor.
- **Grid**: grid lines are overlays (`--pixel-grid`), toggleable, default on in Edit mode.
- **Overlays**: collision, event, start position, hover preview — tokenized, visually distinct.
- **Zoom**: integer steps only: `1, 2, 3, 4, 6, 8` (`EDITOR_ZOOM_LEVELS`). One canvas stepper (`−` / current / `+`) plus a menu of `editor-zoom-*` marks. The classic toolbar no longer duplicates `1x 2x 4x 8x`. Beginner docks the stepper in `--editor-canvas-chrome-top`. Standard/expert keep map-save/build behind the ⋯ gate.

### Database & resource modals

- **Topbar actions**: Resources (소재) opens `resourceModal`; Database (DB) opens `databaseModal`. They are the canonical editor paths for asset and database work.
- Map properties and Event editing are not dock tabs: event editing lives in the left palette when the event layer is active and opens as a modal; map properties are edited via the map tree context menu / database.
- **Database**: 15 tabs — 주인공/직업/스킬/아이템·장비/몬스터/적그룹/상태/전투애니메이션/타일셋/공통이벤트/시스템/용어/스위치/변수 (`db-tab-*`). Navigation follows the mode chrome contract: Beginner shows the `common` subset, Standard groups the navigation, and Expert exposes `all`.
- **Event editor**: cream-studio command editor. Tree-style nested command list with **drag-to-reorder** (⠿ handle), up/down/delete buttons, command picker, per-page tabs, fork/choices branches.
- **Event editor top/page controls**: cream-studio modal chrome. Page tabs show named condition sentences; validation is a titlebar bell whose summary carries the severity words `오류 N · 경고 N · 안내 N` alongside the count badge (hidden when clean), not a bare number and not `검사 !1 △1` — severity must be readable without opening the popover, because a colour-only signal fails WCAG 1.4.1 and an error (blocks commit) costs nothing like an info. Footer is `이벤트 삭제` pinned to the left cell, then `변경 있음/없음 · 취소 · 적용 · 저장하고 닫기` in the right cell. The destructive action never sits inside the save cluster, and its label names its target so it cannot be confused with the page toolbar's `페이지 삭제`. Bare `Delete` never deletes the event from anywhere in the modal; the labelled footer button is the only entry point. The titlebar name field edits the **active page's** name (`GameEvent` has no `name`); the event's display name is derived by `eventDisplayName()` from the last named page, so the field is labelled `페이지 N 이름`, never `이벤트 이름`. The view segment (`목록/스토리/미리보기/플로우`) is a `tablist` with `aria-selected` and one roving tab stop, matching the page tab strip — never `aria-pressed` toggles, which read as independent switches. Rail section headers are `언제 보이나요` / `반응 방식` / `움직임` (not `출현 조건` / `트리거·우선순위` / `이동/기타`). Event-card identity is name + coordinates; padded `ID 0001` is gone. Extra control-code chips (`\$` `\!` `\.` `\|` `\>` `\<` `\^` `\_` `\s[n]`) live behind closed `고급`. Density control stays and is labeled `간단히` (not `간단히 보기`). Picture summaries are a human sentence, never a raw slot/path dump as the scan line. Keep controls compact enough for scanning; avoid display-scale button typography inside the modal. Chrome uses cream tokens from `src/styles/tokens.css`; do not reintroduce `--rm2k3-event-page-*` or classic-gray `#eeeeee`/`#f4f4f4` fieldsets.
- **Event editor sizing**: the event editor is a desktop-default work window at wide widths, but it must remain usable down to roughly `800px` viewport width. It opens with settings and a dominant command canvas; the command inspector is contextual and appears only after command selection. Wide layouts allocate it a fixed right track, while compact layouts overlay it on the right so the canvas does not permanently lose width. Around `900px` and below, the modal clamps to the viewport and compresses the left settings/conditions column while keeping the command contents as a second column; do not stack settings above commands unless the viewport is narrower than the supported editor width.
- **Event editor resizing**: users can resize both the modal window and the settings/command split. The vertical separator between settings and command contents adjusts the left settings column; the bottom-right grip adjusts the whole event editor window. Keep both handles visible and keyboard-focusable, and keep resize behavior bounded to the viewport.
- **Event editor stylesheet cascade (measured 2026-09-02)**: the modal is styled by **56 sheets / ~21,200 lines**, and the winner is decided by source order, not by name. `src/styles/index.css:2` declares `@layer tokens, base, components, shell, editor, database, map, runtime, resources, overrides`, but **every `event-editor.*` sheet is unlayered**, so all of them outrank anything inside a layer — including `editor/storyboard.css`, which wraps itself in `@layer editor` and therefore loses to `event-editor.balanced.css` on every shared selector. Within the unlayered set the order is `event-editor.css` (which chains `part-1 → part-2 → part-4 → part-3 → modern/* → command-preview → modernize → commerce → p1-* → blocks → mockup → windowing → custom-select`, and the chain comments say do not reorder) then `event-editor-rich-forms.css`, `event-editor-ai.css`, `storyboard.css`, `event-editor-help.css`, `event-editor-follower-preset.css`, and finally **`event-editor.balanced.css` (`index.css:91`) — the last word**. Put layout corrections there; a rule added to `part-*.css` for a selector a later generation also sets is dead on arrival. Do not "fix" this by assigning the sheets to a layer: every layer loses to unlayered, so layering them demotes the whole modal below unrelated unlayered chrome and needs a full visual regression pass first. Dead-rule and budget guards are `npm run gates:css` (`check-css-budget` / `check-css-graph` / `check-css-live-classes`).
- **Event move-route dialog**: custom autonomous movement opens a cream-studio route editor, not a desktop RM-era work window. Named per-step pickers replace the shared `매개변수` box; frequency is `아주 드묾 … 아주 자주` (values 1–8 stay). No `$>/@>` prefixes, no always-on frequency radios, no three-column RM command grid, no `확인/취소/도움말` footer. Unsupported movement commands should render disabled rather than pretending to save runtime behavior.

### First run and online save

- The first required screen speaks in user concepts: **작업**, **온라인 저장**, **작업 선택**. Do not expose `DB`, `Supabase`, `Anon key`, `Project ID`, or `.env` in the default path.
- `작업 열기` is a card-first picker. Each card shows the work title, preview, map/tileset counts, and last-saved time; selecting a card immediately opens it. Connection credentials stay inside a closed `연결 문제 해결` disclosure.
- The required first-run picker cannot be dismissed until a work opens. Loading, empty, offline, and error states use recovery copy that tells the user what to do next without dumping provider errors.
- The status bar says `온라인 저장`; help, save, reload, and recovery copy use the same vocabulary. Provider names and raw credentials are reserved for internal implementation and the advanced troubleshooting disclosure.
- At compact widths the picker becomes a single-column scroll surface with full-width actions. Technical fields remain keyboard reachable only after the disclosure is opened.

### Database panels

- **Unified inventory catalog (2026-09-05):** one `아이템·장비` rail entry (`db-tab-items`), one search across both unchanged storage collections, All/Items/Equipment filter buttons with `aria-pressed`, and one compact subtype/slot select. Counts distinguish visible matches from the whole catalog. Search/filter changes retain the selected type-specific inspector, even when its row is outside the result; a selection notice can reveal it. Add actions explicitly name the collection. Existing guarded delete, duplicate, AI item generation, and gallery/list remain available. The list-detail spatial pattern uses `databaseWorkspace` primitives, 260px list + fluid inspector at supported 1024/1280/1440 desktops. Search, filters and actions are fixed; `.db-catalog-rows` owns list scroll and the existing `.db-ws-detail-body` owns inspector scroll. Modal geometry remains solely in `sidebar.css`. Tokens and focus treatment remain Database Studio v2; no new animation or palette. Legacy `equipment` navigation resolves to the same catalog with its remembered equipment selected. This is an editor-only projection, not a migration or an item-to-equipment conversion.

- **Party record hierarchy (2026-09-05).** Actors, classes, skills, items, and equipment keep a visibly inset list pane, an indigo active rail, stronger record headers and name fields, and neutral read-only summaries. The final section of `studio-v2.css` scopes these rules to those five tabs; its local `--db-record-pane-bg` override passes through the existing Studio theme without another important declaration. At compact desktop widths the actor inspector may shrink within the fixed modal rather than extend beyond it.
- **Database Studio v2 (2026-09-03) — one grammar for all 30 tabs.** `src/styles/database/studio-v2.css` is imported last among database sheets and restyles the classes every tab already emits (no new class vocabulary): the window is one white surface where rail | list | detail are divided by hairlines only; group cards inside the detail pane are `--db-studio-canvas` (light gray) with no border, title `600 13px` + hint `12px text-3`; every `.db-field` is a property row (label left in `minmax(min(96px, 38%), max-content)`, value right, labels **wrap — never ellipsis**), except dense numeric grids (`.db-enemy-stat-grid`, `.db-item-grid`, `.db-state-runtime-panel`, `.db-terrain-quick-row`) which stack label above value; list rows with a sub chip wrap the chip to a second line instead of truncating either the name or the chip; children of `.db-ws-detail-body` never flex-shrink (an `overflow:hidden` stats strip otherwise collapses to 2px); inputs/selects/textareas share one chrome (32px, 8px radius, `--db-studio-border-default`, accent ring on focus; `select` keeps the 24px chevron band via longhand padding); number steppers are one flex box `28px | 1fr | 28px` whose buttons fold under 120px (the fold rule is restated at v2 depth because `@container` adds no specificity); heroes (`.db-ws-hero`, `.db-record-hero`, item/equipment inspector headers) are 52px media + `700 18px` title + 11.5px Korean eyebrow + pills, and name inputs inside them render as the title (border only on hover/focus). The header shows `데이터베이스 | 그룹 › 탭` (`database-modal-crumb`, fed by `subscribeDatabaseActiveTab`), window controls are SVG (`database-modal-icon`), and the footer status is a 28px pill with a status dot, not a full-width band. Type scale: 11.5 badge · 12 label · 13 body/input/row · 13/600 card title · 15 list title · 18 hero title. No `!important`, no hex, no font-stack literals in the sheet (`test/databaseStudioV2.test.ts`); earlier layers' `!important` rules were re-valued in place (`studio-theme.css`, `sidebar.css`). English eyebrows/chips (`ELEMENT`, `GAME OVERVIEW`, `LIVE PREVIEW`, `GAUGE` …) are Korean.
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
- Database battle-animation previews loop from the first frame on entry and record change once the graphic loads. Reduced motion starts on the selected editing frame with manual Play available. Stop and frame selection restore/preserve that editing frame; ordinary form rerenders and delayed parent-modal refreshes retain the stopped intent on the same record. Missing or unusable graphics show a nonplaying empty state, never a fabricated effect. Genuinely cached tabs pause while detached and resume only their prior playback intent; cache eviction and modal close release playback resources.
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

- Beginner, Standard, and Expert are desktop density presets, not separate products or permission levels. First visit is **Beginner**. The mode switch lives in the studio bar's 「보기 ▾」 menu as three radio rows with hints (`workspace-ui-mode-*`) and in Ctrl+K; there is no top-level mode toggle and no separate 밀도 control. Beginner uses the 72px direct-action rail (tool / layer / panel groups with Korean layer labels 바닥·덧그림·이벤트, one tab stop per group with arrow-key movement), does not auto-open the tile flyout on every 칠하기 activation (only when no usable tile is selected yet), keeps 자료집/소재 in the 도구 menu (no topbar buttons), and limits Database navigation to the grouped rail. Standard exposes the full palette and map tree, the 자료집/소재 topbar buttons and a 「도구 ▾」 menu. Expert keeps the same single-row bar but denser (12.5px labels, tighter gaps), technical jargon, all six zoom levels, and inlines 세계관·음악·찾기 as icon buttons (`toolStrip`) instead of the 도구 menu — the RM-era second toolbar row no longer exists. The chrome contract is carried by `mapTree`, `toolStrip`, `canvasChromeDense`, `helpMenu`, `paletteRail`, `leftPanelMaxWidthPx`, `layerTermStyle`, `prominentTestPlay`, `coachMarks`, `standardWelcome`, `statusbarDensity`, `databaseNav`, `eventBeginnerChrome`, and `jargonStyle`. The same project, history, camera, and AI session continue across mode changes.
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

- **Nav:** 220px labeled rail at `>=800px` container (`container-type: inline-size` on `.database-modal-window`; media fallback at 799px), 56px icon+tooltip below. Group headers (`파티/몬스터/전투 규칙/생활/세계/시스템`) visible as 11px uppercase `text-3`. Tab icons are inline SVG (`databaseTabIcons.ts`, `svg.db-tab-icon`, 22×22 viewBox / `stroke: currentColor` 1.8 — the `tileToolbarIcons.ts` house spec), never CSS `content` glyphs: the old per-testid glyph list covered 24 of 29 tabs and `system-studio.css` could out-specify it away entirely. Count badge via `[data-count]` quiet pill. Selected = `accent-soft` + 2px left accent bar. Search placeholder `탭 검색` full-width readable.
- **List:** name first (`flex:1`, ellipsis), muted trailing `#n` (`#${visibleIndex}`), 24px thumb, pill sub. Selected = `accent-soft` + border ring. CSS order puts name before number; markup order matches display order.
- **Inspector:** sticky header (`top:0; z-index:2` on `.db-record-hero` / modal header) and sticky footer; former equal-weight Win95 fieldsets become hairline sections (top border only, `text-3` 12px uppercase labels).
- **Footer:** `닫기` is ghost (`transparent` + `border-default`), `지금 저장` is filled accent — enforced by `[data-testid]` selectors in `studio-theme.css` even if `.primary` class is on the other button.
- **Empty:** card + one filled CTA on studio surface, never a cream void.
- **Dirty / G006 / testids / AI dock / gallery toggle:** unchanged — chrome only.
