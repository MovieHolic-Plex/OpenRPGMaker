# RPG ZZU Design System

## In-game shop trade counter (2026-09-06)

Runtime only: this is not the shop-command editor. `runtime/shop.css` owns a
single inset glass counter, with a single-column stock list and a generous
selected-item display. The existing DOM slots, authored item resources, currency,
quantity, affordability and keyboard/gamepad controller remain authoritative.
No merchant artwork is inferred from the player's party: the brand uses the
existing purse emblem; actual party faces remain explicitly labelled as party.

- Local `--shop-*` aliases inherit `--runtime-glass-*` surface, inset, card,
  text, muted, hairline, accent, shadow and radius tokens. No global game reskin.
  Category display washes derive from glass accent (equipment), success
  (consumable), warning (material), and glass muted (special); labels carry the
  identity as well as color. These are material lighting, not rarity claims.
- Local geometry scale: 4/8/12/16/24/32px spacing; 1px hairlines, 2px focus,
  shared 4/6px corners. Local screen-pixel type: 12 metadata, 14 body, 16 section,
  24 item heading, 32 entry heading; compact 10/12/14/16. Font remains the authored
  `--runtime-ui-font`. Numeric values use tabular figures.
- Local size tokens: stock art 48px (compact 32px, minimum viewport 24px),
  display art 224px (compact 96px, minimum viewport identity strip 24px), party
  art 32px, control 32px (minimum viewport 24px); display column 38%. The display uses
  recessed glass, category light and a fine inset frame, not additional cards.
- Buying/selling has a persistent explicit label even for one-mode shops. Price
  leads owned count in stock rows; quantity-mode totals remain next to confirm.
  Unaffordable items retain readable art/text and selectable rows; lock and price
  color express the restriction. Selected rows use a solid leading rule and ring,
  never movement, hover or pointer-only cues.
- Overlay stays outside `.play-stage` scale. At 1280x960 the display and inventory
  share the counter. At 640x480 they remain side by side with compact art. At
  320x240 the display becomes a compact identity/description strip; secondary
  party and equipment stats give way to stock, wallet, quantity and controls.
  List scrolling remains controller-owned; no multi-column item navigation.
- No new motion lifetime: existing entry fade and transaction feedback remain,
  with reduced-motion support. Validate through shipping `player.html`, not the
  editor shell; supervisor owns final screenshots and visual acceptance.

## Database CSS ownership (2026-09-06)

- `studio-v2.css` owns shared DB shell spacing, ordinary 12.5px captions,
  32px controls, cards, list rows and shared CRUD chrome. Domain sheets own
  composition, not another copy of these roles. `sidebar.css` owns rail geometry;
  `workspace-modern.css` owns the shared section navigation primitive.
- A shared number stepper is one 32px border box, 8px radius, with a single
  outer hover/focus treatment. The inner input has no border, radius or shadow.
  Its 28px side buttons collapse at the existing 120px container threshold.
  Native input/change timing, labels, bounds and disabled behavior remain intact.
- Equivalent section tabs use the workspace underline grammar (34px, 13px/600).
  Add/Duplicate/Delete share 32px, 12.5px/600 targets: neutral add/duplicate,
  danger-text delete; explicit primary submit actions remain filled.
- `animation-editor.css` owns animation authoring scroll and preview-first
  composition, with stage height at least 280px. Classes/Troops detail forms
  each own their main vertical scroll; useful inner lists/tables remain scrollable.
- World document 36px controls, System 32–36px targets, the 36px actor portrait,
  tileset art geometry and runtime/project-font previews are retained variants.
  UI fonts resolve through role tokens, including component-loaded shorthand.

## Weighted outcome worksheet (2026-09-06)

- `m2-211-weighted-branch` uses a task-first `확률로 결과 뽑기` form; the catalog retains `가중 분기` for discovery. Outcomes precede the destination variable. Each repeated row composes a labelled name, direct percent input, single-accent proportional meter, and `저장값` number. No instructional card, duplicated legend, raw table or automatic action-branch promise.
- Editing one percent redistributes the remaining chance proportionally among other rows; if all other rows are zero, split the remainder equally. A compact `나머지 자동 조정` label makes that behavior explicit. One remaining outcome stays at 100%. Add assigns an equal share to the new row while retaining existing relative chances; remove renormalizes remaining rows. Named zero-percent rows persist and remain editable after Confirm/reopen, but have no stored result value because runtime ignores them. Removing the last positive row is disabled rather than enabling zero-chance rows. Authored all-zero tables remain unchanged and visibly block Confirm until a chance is set; a lone zero row can be repaired to 100%.
- Native labelled controls, existing `databasePicker` and `editorIcons`, existing draft update path. Inputs remain mounted while typing; composition commits only when complete. Add focuses the new name, delete focuses the nearest remaining name. Invalid percentages show a local 0–100% error and leave persisted values unchanged. A Weighted Branch-only Confirm guard keeps the modal open and focuses the invalid control; other command forms are unaffected. The empty variable trigger is an explicit selection action; no variable is auto-picked.
- Existing cream-form tokens only: `--bg-raised/inset`, `--text-1/2`, `--accent`, `--border-default`, `--danger`, `--focus-outline`; `--font-ui/mono`, 12px metadata, 13px controls, 14px names; `--space-1/2/3/4/6`, `--radius-s`, 32px minimum targets. Row meter is 4px, result-value chip uses the 4px inner radius. Fluid name track and wrapping destination retain the existing modal scroll owner, no new nested scroller or motion.
- Persistence remains `table` + `resultVariableId`. Open and variable-only edits preserve authored table bytes. Name edits preserve numeric precision; storage-safe names replace equals with fullwidth equals and line breaks with spaces. Numeric parsing mirrors the runtime's first numeric field, including blank names/extra separators. Tiny positive percentages use significant digits rather than integer rounding; near-100% counterparts retain enough decimals to avoid false certainty (100% only within floating-point epsilon).
- Personas: first-time author, keyboard/IME author, existing-project author. No extra theme, runtime change or dependency. Lead owns full build/gates and browser accessibility/geometry acceptance at 1024/1280/1440; unit DOM tests alone are not visual approval.

## Walk encounters from a rectangle (2026-09-06)

- Primary action: `걸을 때 적 만나기`. Use the existing left-drag selection tool,
  then the visible selection chip. Explanation: `포켓몬 풀숲처럼, 이 안에서 걷다
  보면 전투가 시작됩니다.` No tile painting, new schema, or runtime overlay.
- Native modal-stack worksheet: named enemy artwork/checkbox search, selected
  count, frequency presets, then `완료`. Reuse subdialog, `btn`, thumbnail and
  labelled native controls; advanced weights/conditions use `details`.
  Personas: first-time author, existing-table author, keyboard-only author.
- Studio tokens (`--bg-raised`, `--bg-inset`, `--text-1/2`, `--accent`,
  `--border-soft`), --font-ui 13px/1.5, help 12px/1.5, 32px minimum controls,
  4/8/12/16/24 spacing, 6px controls and 8px groups. No decorative motion.
  Width at most 760px; bounded scrolling body, fixed action footer. Desktop
  acceptance 1024x768, 1280x800, 1440x900; controls wrap rather than shrink.
- Canvas has a persistent labelled region-list button and translucent indigo
  rectangle outlines; list entries identify coordinates and enemy names. Edit,
  delete, reuse last settings and replace bounds from a fresh selection are
  explicit actions. Identical rectangles form one editable group; overlaps mix
  eligible entries according to relative weights, never an exclusive layer.
- Frequency is map-wide. Preserve a positive rate until explicitly changed;
  zero defaults to normal. Existing legacy encounters require an explicit
  keep-everywhere or replace-with-regions choice. Other table entries survive.
- Fields are local drafts. Cancel/Escape write nothing. Apply validates bounds,
  references, conditions, locks, project identity and encounter-state freshness,
  then records one project snapshot and one labelled store mutation including
  generated troops. Delete removes rules, not tiles/troops. Empty catalog/search,
  invalid input, stale state and lock errors have visible recovery text.
  No fake loading. Real browser review is supervisor-owned.

## System settings workspace (2026-09-06)

Database > System is a settings worksheet in the existing cool-white, slate and
indigo Studio, not a dashboard. Shared modal header, rail, footer and save stay
unchanged. Vanilla DOM, databaseControls, databaseWorkspace sections and resource
pickers remain the component system; no dependencies or theme are added.

- Ten native navigation buttons occupy a fixed single-line horizontal reel.
  Container/button classes are distinct; selected is aria-current, focus indigo.
  All sections stay mounted and inactive sections hidden. Navigation is history-free.
- `.db-system-sections` owns vertical scrolling in the bounded form; only the
  type matrix owns horizontal content scrolling. Structural references:
  [scroll-body-shell](https://github.com/changeroa/StyleGallery/blob/main/patterns/viewport-shell/scroll-body-shell.md)
  and [reel](https://github.com/changeroa/StyleGallery/blob/main/patterns/in-line-grouping/reel.md).
- Controls: --font-ui, 13px/1.5, 32–36px targets; help 12px/1.5; headings 18px/1.5.
  Aligned label/help/control rows, 6px controls, 8px sections, 4/8/12/16/24px spaces.
  Chrome uses existing --db-studio-* tokens. No gradients, glyph icons or lifts.
  Rows stack below 600px available content width, never by shrinking text.
- Overview is a searchable index for all nine editing destinations with authored
  summaries, no-results/reset, subordinate progress links and play-test. Optional
  initial troop and day-end event are not warnings. Title summary includes resume
  and explains its runtime autosave condition rather than claiming a live preview.
- Party uses four numbered face/selector rows and explicit empty slots. Removal
  compacts the roster while preserving order/session sync. Display has presets,
  bounded pixel dimensions, ratio frame and actual map/tile analysis. Fonts pair
  each selector with Korean/Latin/numeric specimens and keep the default reset.
- Resources show named assets, choose/change/clear and real empty/failure states;
  legacy title linkage is explained. Startup groups battle/audio/rewards and
  explains automatic active slots at zero. Features retain legacy action-combat
  details, support-ended context, monster care and linked data counts.
- Time reports the configured day, not a live clock. Disabling sets enabled:false
  and preserves authored configuration (normalizer supports it); this deliberately
  fixes the audit's destructive off/on reset. Undo remains available.
- Type-chart direct entry has a visible action and F2 on each editable cell,
  Escape and focus restoration. Cycling, diagonal and 0–4 semantics stay intact.
- Title composition plus display/menu/audio/effects preserve every field/hook.
  Coordinates remain proportional to legacy 320×240. Resume is previewed under
  an explicit autosave-available assumption. Layer parallax remains preserved.
  Text typing updates derived preview nodes without replacing the focused input;
  structural edits restore focus/scroll where the control survives.
- Accessibility: native labels, explicit disabled reasons, readable Korean and
  keyboard-complete actions. Personas: new author, dense-data author, keyboard
  author. Verify Firefox at 1440×900/1024×768 and populated/empty/edit/undo/reopen.
  Chromium fails ERR_NETWORK_CHANGED here; no Lighthouse score or pixel visual
  approval is claimed. Independent visual review is owned by the supervisor.

## Monster role clarity (Phase 1)

- Visible tabs are `전투 몬스터` (`enemies`) and `포획·성장 종족` (`monsterSpecies`); IDs and testids remain stable.
- Battle monsters own fixed encounter stats, actions and rewards. Species own capture, growth and base values. Linking does not continuously inherit stats or appearance.
- Keep role guidance in the existing hero subtitle and local section hints, not new banners/cards. Reuse `detailHero`, `sectionCard`, native controls and `db-ws-btn`; Studio tokens, typography, focus behavior, scroll ownership and modal geometry remain unchanged.
- Effective links expose open-linked-species; creation without a link names the enemy as source. Linked creation explicitly replaces the link with a new species, preserving the old record, with the existing confirmation and atomic undo.
- Creation copies enemy name/appearance/fixed stats once into species name/appearance/base values, not equal stats at the same level. Appearance copying names species-to-enemy direction and resource/hue/transparency/flying fields; stats remain unchanged.
- The readiness strip is project-wide. Explicit-link counts and selected-species usage exclude same-ID compatibility links and say so. Destination labels distinguish a whole tab from a selected record and the first spawn map from all maps.
- Browser acceptance remains 1024x768, 1280x800 and 1440x900: local guidance/actions must wrap and remain reachable in existing scroll containers, without horizontal overflow or focus regressions.

## Species search and related-record reveal (Phase 2)

- Species search updates only list rows, count and selection notice. Keep the same mounted native search input (focus/caret) and inspector (draft controls, skill-row identity, preview level and scroll); filtering never changes the selected record or writes project data.
- A selected species outside the results is identified in the existing list filter slot. `검색 지우고 보기` clears the search and scrolls its active row into view; no-results `검색 지우기` offers the same recovery without replacing the inspector. Return focus to the retained search input when the recovery button disappears.
- Related enemy/species links clear the destination search, select the destination and reveal its active row in the same Database panel. Enemy reveal retains virtualization and uses measured uniform row/card heights, inner-grid gaps and padding for both spacers and target scrolling. Responsive gallery columns are applied before measurement; ordinary tab returns retain their scroll restoration. Evolution-referrer actions rerender immediately through the existing callback; species add, duplicate and creation from an enemy reveal the new selection.
- Reuse the current workspace, session and switch-tab functions. Keep Phase 1 project-wide destination wording and selected-species explicit-link usage; no bulk workflow, schema, runtime, data or undo semantics change. Search recovery uses existing Studio controls and the species-only stylesheet rule for wrapping the notice. The desktop acceptance matrix remains 1024x768, 1280x800 and 1440x900.

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

### Concept-first Map authoring — phase 1 (2026-09-05)

- Database **맵** has two primary destinations: **개념 꾸러미** (`scratchConcepts`) and
  **타일셋** (`tilesets`). There is no tileset folder or hidden legacy rail. **공용 이벤트**
  belongs to System. All original tab IDs remain routable and searchable, including retired names.
- Context actions sit above the workspace: concepts → **부품 보관함**, **기존 방 규칙**,
  **기존 마을 설계**; villages → **공통 생성 기본값**; tilesets → **지형 효과**.
  Children have a parent return button, retain shared tileset/concept selection, highlight their
  primary root, and include their ancestors in the modal breadcrumb.
- Concepts use a compact tileset selector, illustrated facility choices from referenced artwork,
  place cards, and a thing inspector. Place selection only inspects things in that place. Selecting
  or painting a thing selects its containing place; graphic-editor close returns to that selection.
  References, saves, local graphic history, and catalog-copy behavior remain intact.
- Tilesets have one internal navigation: **통행·지형 / 자동 연결 / 타일 설명**. Existing modes
  and the unlabeled filter remain. Legacy autotile/unlabeled jumps open matching modes but highlight
  the tileset primary. Child return retains the mode instead of restoring stale DOM. Other Database
  tab caches and animation playback intent are unchanged.
- Existing CSS owners and cool-white tokens govern the layout. Actions wrap; on narrow desktop
  containers the concept inspector follows the places instead of squeezing them. Target widths:
  1024, 1280, 1440px. No dependency, schema, migration, or authored-content changes.
  `structureKits`, `interiorRoomKinds`, `scratchConceptBundles`, terrains and villages coexist;
  room migration and village composition remain future phases, not shipped capabilities.

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
- **Left drawer**: the docked tool column beside the canvas, never a row under the agent log. Empty events are one line (`이벤트 없음 · 더블클릭으로 추가`). Map tree still uses `map-tree-node-*` testids. Beginner uses a 288px persistent labeled painting panel; only Maps opens a requested flyout.
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

- **Geometry**: anchored bottom-right (`right:12px; bottom:14px`), radius 20, glass `color-mix(--bg-raised var(--ai-background-opacity, 82%))` + `blur(20px) saturate(1.08)`, three-layer shadow. Idle/empty/unfocused = composer only at `--ai-float-compact-width` 480; focus/turn/conversation = `--ai-deck-open-width` 760 (640 under 1300px). Saved width `--ai-float-bar-width` (`oprn:ai-panel-size`) overrides. Transcript `max-height: min(660px, 62vh)`, scrolls inside. Log-height axis and `− 100% +` zoom stepper were deleted; font size lives in settings and Ctrl+wheel.
- **Rail** (`.ai-deck-rail`, 38px, always present when open): status dot + `조수` + `· <map>` + status sentence + icon slot (context %, new chat, history, preferences, more, collapse). State is one value on `panel[data-ai-state]` / rail / pill: `idle | run | attention | done | error` — accent / warning / success / danger tokens; running paints a 2px sweeping hairline on the deck's top edge.
- **Transcript**: `.ai-command-row` keeps the two-track grid contract (04), but the `@>` prefix is hidden; user turns are right-aligned `--accent-muted` bubbles (max 78%), assistant turns are left-aligned sans prose 14px/1.55, system rows are 12px meta. Mono only for coordinates.
- **Work timeline** (`.ai-tool-activity`): a card with header `작업 N단계` (open while running) / `작업 N단계 · 라벨 → 라벨` (collapsed when the turn ends) / `조회 N건`. Rows are `map chip 46×32 · Korean label (aiToolLabels) / summary · ✓`. Map chips crop the touched region from the project (aiMapChip → renderRegionSnapshot). Function names are `title` only.
- **Receipt card** (`.ai-change-card`): badge `적용됨`, title `우물 1 · 상인 2 · 바닥 9칸`, chips, `지금 → 적용 후` pair with tag labels on the shots, footer `넓게 보기` / `되돌리기`.
- **Composer**: borderless textarea 14.5px + one 36px row: mode segment `지시 / 질문 / 계획` (ask/plan append one `[컨텍스트]` line), context pins (map · selection), undo pill, model chip (standard/expert only), 34px round send (indigo) that becomes a black round stop while running. Assistant preset/suggestion promotions are not mounted (including focus, empty chat, studio briefing and quick-reply chips). Explicit choices remain readable in the transcript. Live blueprint, ghost and work-plan chrome ends with its owner turn; independently pending region approvals keep their preview. No key-hint text (it is the textarea `title`).
- **Menu** `⋯`: 248px, icon + label + right meta (context %, tool count, model), opens **upward** from the rail. The idle-screen choice (`ai-command-temperature-*`) lives in the settings modal section `대기 화면`, not in the menu.
- **Collapsed pill** (`.ai-collapsed-restore`, 44px): dot + `조수` + state sentence + pending-count badge; carries the same five states.
- **Background opacity (2026-09-06)**: native labelled range `배경 농도` in the existing settings Display section beside font size, 78–100%, step 1, default 82%; larger numbers mean more opaque. A readable percent output follows the slider. `aiPanelLayout` owns `oprn:ai-background-opacity`; `--ai-background-opacity` on the panel feeds the existing `--ai-deck-glass` for both deck and collapsed pill. Input/change apply and persist immediately, including settings opened from the topbar; reload restores the same value. Never apply element opacity to foreground text. Slider uses existing `--accent`, `--focus-outline`, `--radius-s`, and 8px spacing tokens, with no new theme or row on the deck.
- **Scroll and quiet chrome**: `.ai-chat-log` remains the single vertical conversation scroller and is keyboard focusable with a name. Its translucent `--border-strong` thumb strengthens to `--text-2` on hover/focus-within; focus uses the existing indigo outline. Wide code/tables retain their own horizontal scroll, composer stays outside the log. Remove redundant map decoration; remaining action glyphs use `deckIcon` SVGs with existing accessible names.
- **Minimum-glass foregrounds (2026-09-06)**: `18-assistant-deck.css` owns local `--ai-deck-secondary` = `color-mix(in srgb, var(--text-2) 85%, var(--text-1))`, scoped to float outside studio/history. Glass labels, metadata, reasoning and tile captions reuse it; opaque contexts fall back to `--text-2`. Global tokens do not change. At 78% over black, unmodified `--text-2` is only 4.477905733201011:1, and the mode segment's 6% ink tint lowers it further. Rail warning/success/error and pill warning/error text use 60% of the existing semantic token + 40% `--text-1`, preserving hue and the existing tinted backgrounds; status dots are unchanged. Primary text stays `--text-1`. The enabled turn-rewind action keeps opacity 1 at rest and during interaction; its nested user-bubble/control tints require a quieter-than-primary mix of 60% `--text-2` + 40% `--text-1` rather than foreground fading. Evidence uses browser-computed foregrounds and composited ancestor backgrounds, with unrounded 4.5:1 decisions and screenshot-background corroboration: `output/evidence/p2-contrast/`.
- **Locks kept**: no face, no header plate, single float dock, popovers are `hidden` when closed (no transparent full layers), glass alpha ≥ .78, saturate ≤ 1.08, secondary text on glass uses the local minimum-glass foreground rule above.

- **Navigation ownership (2026-09-06)**: the named conversation region and its descendants own arrows, page/endpoints and Space through `data-editor-navigation-owner`. Save, tool and history routing is unchanged. A real map pointer action releases conversation/text focus without synthetic keyboard events, so navigation returns directly to the canvas.
- **Studio appearance**: studio entry clears float geometry through `applySize()`, not the panel's complete inline style. Density and font scale survive enter/exit, studio-enabled boot and collapse; changes made while studio is active remain current.
- **Ambiguous answer links**: local foreground is 75% `--gold-deep` + 25% `--text-1`, retaining the existing underline, hover tint and chooser action. Minimum-density rest, hover and keyboard-focus text must meet 4.5:1.

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

- **Connected growth presets (2026-09-06; supersedes Phase 2 cover-first collection).** Both studios mount a clearly labelled, detached preset graph immediately, below the primary authored workspace. The 264px preview region has its own native-size 180×98 semantic-art nodes, contained graph scrolling, separate zoom row and scrollable condition summary. Default zoom is 100%; never fit the entire graph by shrinking text. A native preset selector chooses three connected roles or the three legacy entries appropriate to that studio; skill mode also selects among all five nonempty class trees. The header's Presets action expands the same selection into an in-studio graph/condition ledger, with compact catalogue buttons rather than covers consuming the first screen. Escape restores the opener. Preview selection, zoom, scrolling and inspection have no project/dirty/history effects; destination allocation runs only on explicit Apply, failures preserve the graph, and success is one undo boundary. Existing budgets including zero, records and actor curves remain unchanged.
- **Growth graph navigation and density.** Cross-tree prerequisites are dashed, named portal nodes with real edges and required rank, plus an explicit source-tree/node link in the condition summary; activation opens that exact tree/node, not a new import. Authored coordinates remain 0–10000 even when a presentation-only portal gutter is present. Added bundles expose same-import links between both studios and a separate actor-start-class route that never assigns automatically. Preserve native focus, modal undo/save and independently scrolling inspectors. Use the existing 18px heading, 12–14px control/node typography, 32px targets, 4/8/12/16px spacing and Studio tokens; no new theme or dependency. Compact toolbar labels prevent wrapping from starving the 1024px authored graph. Personas are first-time authors learning from nodes, existing-project authors retaining their work, and keyboard authors. Objective Firefox acceptance at 1024×768, 1280×800 and 1440×900 is recorded by `scripts/qa/growth-connected-studio.mjs` (private port 9897). Image loading, geometry, focus, apply/navigation/undo are measured; subjective visual approval and final player/DB evidence remain lead-owned.

- **Integrated growth controls (2026-09-06).** Inheritance is a native labelled checkbox in tree settings. Qualified prerequisites use tree/node selects and a bounded rank input; promotion requirements reuse these controls beside skill ownership and historical tree-point requirements. Keep them in the existing independently scrolling white inspector, using growth sections/buttons and the current type/spacing/focus tokens; no CSS layer or new theme. Both studios offer read-only runtime simulation with separate actual-promotion actions and an explicitly labelled arbitrary-reclass selector. Runtime blockers are visible text, and referenced deletes fail before the undo boundary. Connected-tree navigation uses the existing Database tab switch and preserves the selected tree. Connected preset previews use the detached, default-visible region above.
- **Party growth trees (2026-09-05).** `growth-tree.css` keeps promotion and skill trees in the same indigo selection/focus language: neutral list pane, recessed graph, white toolbar and inspector, and inset 700-weight inspector group headers. Zoom/arrange controls occupy their own bottom grid row, never the scrollable node area; buttons are at least 32px square. Graph names clamp to two lines within the existing fixed node geometry, while full names remain in the accessible label and wrapping inspector title. No graph coordinates, controls, or persistence behavior change.
- **Growth art, Phase 1 (2026-09-05).** Existing bundled semantic role icons populate graph emblems, catalog rows, selected inspector heroes, and runtime growth entries. Classes distinguish warrior/mage/healer/ranger/rogue/guardian; skill effects and all six parameters have meaningful symbols. No raw animation sheets, new art fields, preset UI, or global theme changes. Keep the current token source (cool-white/indigo despite historical cream wording), 180×98 graph nodes, existing typography, and independent pane scrolling. Catalog art uses 32px slots/24px images; inspector art uses 48px slots/32px images, expressed through the existing spacing scale and radius tokens. Images are decorative and non-draggable; failed editor loads restore a text badge while adjacent names and accessible labels remain intact. Runtime reuses the existing single-image icon contract and keyboard-only controls. Browser acceptance at 1024×768 and shipped export coverage remain part of surface proof, not inferred from DOM unit tests.
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

### Cinematic playback (2026-09-06)

- Shared opening/game-over playback uses the existing logical play stage, native
  image/video/text elements and runtime typography, never editor Studio chrome.
  Black letterboxing preserves image/video aspect ratios; narration is 14 logical
  pixels/1.5 with 8px padding and an 80% black caption backing. Keyboard hints are
  9px/1.5; the fullscreen overlay has 16px inset content and 8px gaps.
- Authored image motion is transform/opacity only: fade 0..1, pan -3%..3% at
  1.1 scale, zoom 1..1.12. Duration comes from the authored scene (8s for a manual
  scene), plays once and holds its last frame. Reduced motion removes all three.
  These are authored slideshow motions, not interface spring transitions.
- States are ready/loading/playing/blocked/error. Blocked media exposes R retry
  and confirm continuation; missing/broken media still permits continuation in
  an unskippable sequence. There are no pointer controls or native title tooltips.
- Game-over labels retain the current terminal cursor menu and system graphic;
  the optional authored background fills the stage beneath it at 65% opacity.

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

- Beginner, Standard, and Expert are desktop density presets, not separate products or permission levels. First visit is **Beginner**. The mode switch lives in the studio bar's 「보기 ▾」 menu as three radio rows with hints (`workspace-ui-mode-*`) and in Ctrl+K; there is no top-level mode toggle and no separate 밀도 control. Beginner uses a 288px persistent painting panel (labeled tools, visible undo, 바닥·덧그림·이벤트 layers, selected tile/search and shared atlas grid; one roving tab stop per group and grid), keeps only Maps in a nonmodal flyout, keeps 자료집/소재 in the 도구 menu (no topbar buttons), and limits Database navigation to the grouped rail. Standard exposes daily painting tools with labeled More, the full palette and map tree, the 자료집/소재 topbar buttons and a 「도구 ▾」 menu. Expert adds direct labeled inspector/rule-audit/history controls without duplicating them inside More. Expert keeps the same single-row bar but denser (12.5px labels, tighter gaps), technical jargon, all six zoom levels, and inlines 세계관·음악·찾기 as icon buttons (`toolStrip`) instead of the 도구 menu — the RM-era second toolbar row no longer exists. The chrome contract is carried by `mapTree`, `toolStrip`, `canvasChromeDense`, `helpMenu`, `paletteRail`, `advancedSidebarControls`, `leftPanelMaxWidthPx`, `layerTermStyle`, `prominentTestPlay`, `coachMarks`, `standardWelcome`, `statusbarDensity`, `databaseNav`, `eventBeginnerChrome`, and `jargonStyle`. The same project, history, camera, and AI session continue across mode changes.
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

## 12. Elements editor redesign contract (2026-09-05, implemented; independent visual review passed)

**Brief:** make an element recognizable from its game artwork, put the editable rule before reference counts, and show what each authored percentage means without pretending to run a battle. Scope is Database > 전투 규칙 > 속성, vanilla DOM/TypeScript. Preserve `DatabaseElementRecord`, all authored IDs/names/order/rate labels, default content, persistence, and the battle engine. Baselines, asset inventory, source caveats and binary implementation gates: [design evidence](output/evidence/battle-rules-ux/design.md).

**People and direction:** a first-time Korean-speaking author needs to distinguish Ice from Fire without reading every row; an experienced balance author needs A-E, signed percentages and immediate numeric consequences; a keyboard/low-vision author needs stable focus, text outcomes and a usable 1024px layout. The signature is an illustrated element ledger beside a compact rule worksheet, not a decorative battle arena or another dashboard. Keep the project's font choice and cool-white/indigo studio; do not add a font, theme, gradient, letter badge, particle animation or fake KPI.

### System and composition

- Compose `workspaceShell`, `listPane`, `listSearch`, `listRow`, `listToolbar`, `detailPane`, `detailHero({ media })`, `sectionCard`, and `field` from `databaseWorkspace.ts` / `databaseControls.ts`. Keep their `db-ws-*` / `db-field` DOM grammar, existing testids and native controls. No framework or new parallel component system.
- Use `--db-studio-*` for every chrome color, `--font-ui` / `--font-mono` for type, `--space-1..6` for spacing, `--db2-control-h` / `--db2-radius-control` / `--db2-radius-card` for control and card geometry, and `--focus-outline` for keyboard focus. Use Studio v2's existing 12/13/15/18px hierarchy through the primitives, not per-element type styles. Artwork keeps its original palette and aspect ratio.
- List thumbnails use the existing 32px thumbnail size; hero media stays in the existing 52px Studio v2 slot. A selected-grade example may show the same image in a 96px square, derived from `3 * --space-6`; this is a rule example, not an additional editable resource. Gaps are `--space-2`, section padding `--space-3`, section separation `--space-4`. No new color or global typography tokens are required.
- The Database window keeps its sole geometry owner in `sidebar.css`. Never resize/reposition it from an elements selector. Retain separate list/body scroll ownership and the fixed hero and shell footer. No empty fixed-height tracks or equal-height filler cards.

### Individual element artwork, not kind badges

The 17 shipped IDs get 17 distinct existing game images. Use an editor-local ID-to-resource map; do not add `iconResourceId` to the schema or mutate the defaults. Resolve through `resolveAssetResourceUrl(id, { project })`, reuse the existing thumbnail/chroma-key/failure behavior, and display the same resolved identity in list, hero and rule example.

| Element ID | Existing resource ID | Meaning of the image |
|---|---|---|
| `sword` | `cc0-jetrel-gen-sword-bronze` | Cutting weapon |
| `spear` | `cc0-jetrel-gen-spear-iron` | Piercing weapon |
| `hit` | `cc0-jetrel-gen-hammer-war` | Blunt impact |
| `bow` | `cc0-jetrel-gen-bow-short` | Bow attack |
| `fire` | `cc0-jetrel-fire-bomb` | Fire source |
| `ice` | `cc0-jetrel-ice-shard` | Ice shard |
| `thunder` | `cc0-jetrel-thunder-stone` | Lightning stone |
| `water` | `cc0-jetrel-water-flask` | Water vessel |
| `earth` | `cc0-jetrel-earth-ore` | Earth/ore |
| `wind` | `cc0-jetrel-wind-feather` | Wind feather |
| `holy` | `cc0-jetrel-holy-water` | Holy water |
| `dark` | `cc0-jetrel-gen-scythe-reaper` | Dark/reaper motif |
| `atk` | `cc0-jetrel-book-sword` | Attack manual |
| `def` | `cc0-jetrel-iron-shield` | Defense motif |
| `int` | `cc0-jetrel-book-magic` | Magic manual |
| `agi` | `cc0-jetrel-boots` | Agility motif |
| `absorb` | `cc0-jetrel-fang` | Drain motif |

These are illustrative motifs, not new mechanical behavior: an ATK image does not grant an attack buff; an Absorb name does not make a positive multiplier heal. Registry provenance marks these selected files as generated, despite the `cc0-jetrel` prefix; do not relabel generated art as third-party CC0. No new/downloaded art is needed.

For an unknown/custom ID, use the first matching skill with a resolvable animation in authored database order, via `recordListThumbnail("skills", skill, project, size)`, and disclose that it is linked-skill art. If no such link resolves, show the existing neutral SVG image placeholder with an honest no-linked-art caption; never assign a random built-in image by ordinal, name substring or physical/magical kind. Existing built-in ID motifs remain stable after renaming. A missing/broken URL is a distinct image-load-failed state using `markDatabaseImageFailed`, not silent substitution with a slime or a letter. Decorative repetitions beside a visible name are hidden from assistive technology; the example's meaningful image has a descriptive accessible name. Asset resolution must never dirty the project.

### Edit hierarchy and responsive reading order

1. **Identity:** illustrated `detailHero` with live authored name and short kind metadata. The name field remains the single editable name in the compact 기본 section, followed by the existing 물리/마법 radios and a model-aware explanation. Stable ID appears once as secondary metadata. Typing updates hero/list without replacing the focused control or losing the caret.
2. **Rule:** put 대미지 배율 immediately after identity, before usage. Keep all five A-E percentage inputs, explicit percent units, calculated outcomes, and the existing reset action. Grade letters are stable keys, not letter artwork. Outcome descriptors are computed from the percentage, not fixed labels such as E=무효 when E was changed to 150%.
3. **Consequence:** inside that rule section, show the selected grade's artwork and equation, with an editor-only grade selector and reference-damage input. Focus on a grade input also selects that example. Initially select C, never silently change the target's authored grade. Keep all five results visible for comparison; do not require five clicks to see the rule.
4. **Connections:** compact usage section after the rule, from real project references. Include skills, first attack element on equipment, equipment elemental defense, and explicit actor/enemy/class rate entries. Label class entries as authored references, not guaranteed runtime application. Absence of explicit grades is not proof the element is unused. Use real names/counts; zero usage is neutral, not an error. No decorative metric cards or fake links. If navigation is added, select the actual destination record and use `switchDatabaseActiveTab` in the same modal.

At **1024x768** and **1280x800**, use a single content-sized detail column: identity, rule example + A-E worksheet, then connections. Keep art compact; never shrink type to fit. A grade row may wrap its bar/result to the next line rather than overflow; all five controls remain reachable by body scroll. At **1440x900**, only if the detail body's available width permits two usable columns, place the A-E worksheet beside the illustrated equation within the rule card; identity stays above and connections below. Use available pane width, not viewport alone, so the AI dock and floating/docked modes cannot squeeze a fixed grid. The first viewport at every target size must contain identity, the example and the start of A-E editing; usage must not push the main task below the fold.

### Meaningful preview and mechanical honesty

The preview is explicitly **속성 배율 예시**, not a battle simulator. Reference damage is the amount immediately before this isolated percentage is applied. Compute `round(referenceDamage * percentage / 100)` with the current authored integer percentage; preserve the existing reference range 1..9999 and multiplier clamp -9999..99999. Show the equation and outcome: reference 100 at 150% yields 150 피해; at 0%, 피해 없음; at -50%, 50 회복. A negative percentage remains labeled absorption even when rounding produces zero. Formatting and bars must not imply that absorption is positive damage.

Use one shared scale across the five rows, `max(100, ...abs(percentages))`, with a labeled 100% baseline. Positive/negative direction and explicit 피해/회복/무효 text communicate sign; semantic color is supplementary. Do not cap every value above 200% to an indistinguishable full bar. The example updates in place after name, kind, grade, reference and percentage changes. Reference/grade selection never records a snapshot, writes the store, saves to the project, or changes runtime/session state. Percentage/name/kind/reset edits keep the existing coalesced/structural snapshot paths.

Disclose excluded factors in one concise note: defense, skill power, type chart/STAB, equipment, critical hits, variance and HP caps are not simulated. The source authority is `battleDamage.ts::usesMagicalDefense`: only `system.battleModel === "gen1"` uses mental defense for magical elements; RM2k3 retains its existing defense formula. Use that predicate/model context for helper copy rather than the current unconditional mental-defense claim. Runtime `elementMultiplierFor` also distinguishes an absent explicit grade from C and applies equipment reduction only after a valid explicit grade; do not invent a simplified final-damage formula or repair the engine in this UI work.

### Empty, custom and interaction states

- Empty `elements` collection: no fake Ice row or numeric preview; `emptyState` explains the link between skills and resistances. The existing list-toolbar 추가 is the primary creation path; maximum count remains secondary. Do not create records while rendering. At the 99-record limit, disable 추가 with a reason rather than silently selecting the old last row.
- Empty search: preserve collection, selection and detail; show a local no-match state with a clear-search action. Do not turn a filter miss into a no-record state. Search typing must preserve focus/caret across filtered-list refreshes.
- Custom names, including empty names, Unicode and very long IDs: preserve their stored values; use the existing unnamed display fallback, wrapping metadata and title/accessible full names. Never translate or normalize authored content for presentation.
- Keep native radio keyboard behavior, labelled percentage/reference inputs, text outcomes, visible token focus, and existing modal Escape/focus-trap behavior. Derived outcome announcements are polite and coalesced, not five competing live regions. Re-render only structural edits; preserve selection and scroll when possible.
- Static art is sufficient. Use `--transition-fast` only for hover/focus or optional opacity changes; no layout/width animations and no autoplay particle stage. Respect reduced motion. All labels/control text must meet AA; screenshot-only inspection cannot certify keyboard or screen-reader behavior.

**Delivery boundary:** the elements implementation now uses `databaseElementsClassic.ts`, editor-only `databaseElementPresentation.ts`, the existing shared image thumbnail helper, and element-scoped rules in `modern/utility-records.css`. It retains a single content-sized worksheet column at all three supported sizes; the optional wide two-column arrangement is not needed to expose the example and first grade before the fold. No schema, runtime, default-content or states implementation changes. Focused DOM/browser tests and app build evidence are recorded in `output/evidence/battle-rules-ux/verification.md`. Independent visual/CJK review passed for all seven captured states in `output/evidence/battle-rules-ux/st_01a07318-manual-qa.md`; this is a separate reviewer verdict, not this implementation agent's image assessment. Supervisor comparison found all 26 newly flagged test files also fail on unchanged `32ef1bcd`; narrow reruns of five load-sensitive files yielded 39 passes, one known base failure and zero new failure names. No new unit regression was found. Supervisor also confirmed the unchanged-base surface gate has the same five files, six failures and 107 passes; scoped implementation/QA requirements are satisfied, with final review and PR owned by the supervisor.

## 13. Battle-command placement studio (2026-09-05)

- Audience: Korean-first game authors, including keyboard-only authors. Catalog palette and the selected class menu board stay alongside each other at the desktop floor (1024x768, 1280x800, 1440x900). The existing detail body owns scrolling; no document horizontal overflow. Long names wrap inside zero-minimum grid tracks.
- Compose existing `workspaceShell`, `detailPane`, `sectionCard`, `listToolbar`, and DB buttons. Reuse cool-white `--db-studio-*`, 4px spacing tokens, shared radii and 12/13px type. No theme or runtime styling changes.
- Catalog cards have a visible drag handle and a keyboard `메뉴에 추가` button. Catalog editing stays below the placement surface, directly reachable from each card, with all existing field testids visible and fillable. Catalog order is explicitly not class runtime order; placed rows copy values and preserve catalog IDs, never synchronize existing overrides silently.
- The class selector is editor-only. The board displays the exact authored array, numbered insertion gaps, up/down/remove buttons, and a fixed trailing switch reason. Six editable rows is the authoring limit; full and duplicate actions explain why they are disabled. Empty menus explicitly describe runtime fallback rather than claiming no actions exist.
- Drag states: idle, dragging (grab/grabbing), insertion target (accent line plus insertion text), rejected (polite live status). Malformed, stale, cross-class, duplicate and full drops are no-ops with no undo snapshot. Native dragging and keyboard buttons share the same mutation authority. Successful mutations snapshot once and use labeled store updates; focus returns to the affected row or selector after rendering.
- Runtime preview is read-only and calls `battleCommandsForActor` for the selected class, including fallback, capture and switch gating. A switch-availability preview toggle is editor-only. Explain that this is resolution, not an executable battle, and that monster-owned/custom UI command behavior can differ. No battle/schema changes.

### Battle-command custom CSS

- A separate full-width section below placement edits project-wide menu styling, not the selected class. The existing detail body remains the only outer scroll owner; the code textarea owns its text overflow.
- Reuse studio section cards, labeled buttons, 4px spacing, shared radius and monospace code text. The preview is explicitly a style sample, not a simulated battle. The runtime resolver supplies its labels.
- CSS has a deliberately small vocabulary: `.menu`, `.command`, `.label`, `.command:focus-visible`, `.command:disabled`. Only visual properties are accepted; no URLs, external resources, arbitrary selectors, at-rules, positioning or scripts. Valid edits preview immediately. Invalid drafts keep the last valid preview and disable Apply with a visible error.
- Apply makes one undoable project change. Revert restores the saved text; reset removes the override. A preset is only a draft until Apply. Scoped runtime styles are mounted and removed with each command panel; they never target editor chrome or other game windows.

## AI acceptance sticky note (2026-09-06)

- A read-only session note lives outside the chat deck, aligned to the measured
  `--editor-left-safe` canvas edge plus `--space-3`. It never covers the 288px
  palette. Its top clears the measured canvas toolbar; fallback is 112px.
  Width is 272px, bounded by remaining viewport space; maximum height is 480px
  and the viewport remainder. New local geometry tokens own these dimensions.
- Reuse vanilla `el`, `deckIcon`, native button/details and the Studio palette:
  raised white paper, subtle border, indigo top rule, `--shadow-pop`, radius-m,
  `--font-ui`, 12px metadata, 13px body, 14px goal, line-height 1.5 and existing
  4/8/12/16px spacing tokens. No yellow paper, rotation, emoji or new dependency.
- Fixed header (goal, verified/total, collapse) and a single scrolling body follow
  StyleGallery scroll-body-shell. Each keyed disclosure retains its open state
  and keyboard focus across updates; expected/observed/reason are plain text.
  Map actions resolve current project maps and use `focusEditorRegion`.
- Pending, working, verifying, verified and blocked are backend truth, not editable
  checkboxes. Status text accompanies every icon/color. Only verified counts.
  Current activity is subordinate to the goal; a completed note remains after
  turn completion while existing work-plan/book chrome keeps its ephemeral life.
- Collapse becomes a compact goal/count chip. At <=1100px width or <=700px height
  default to compact, without overriding a manual expansion/collapse choice.
  New chat, history/rewind, project/reset and teardown clear note and preference.
- Motion adapts beui checkbox/raw: a short check-stroke reveal only on entry to
  verified, using `--transition-med`; reduced motion removes it entirely. No
  looping animation. Native keyboard actions, `--focus-outline`, overflow wrapping
  for long Korean/IDs, and opaque text-1/text-2 backgrounds serve novice authors,
  keyboard authors and dense-project authors. Body owns editor navigation keys.
- Backend owns `AcceptanceSnapshot`, acceptance events and refresh on store/undo.
  UI never synthesizes verification or persists snapshots into project/history.
  Browser matrix: 1024x768, 1280x800, 1440x900 plus narrow component showcase.
  Independent final visual review and integrated backend typecheck are lead-owned.
