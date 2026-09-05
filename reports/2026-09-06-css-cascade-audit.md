# CSS cascade audit

## Scope and method

This audit covers the stylesheet graph, with implementation focused on database
CSS. The starting revision is `0eb0a06c`. Two independent read-only audits were
followed by a source-level architecture review. Suggestions are not treated as
proven safe until the actual selectors, consumers, cascade and browser agree.

The existing visual design is the contract. This is not a token redesign,
runtime reskin, or replacement of the editor's DOM primitives.

## Findings

1. **Database ownership is distributed across successive override sheets.**
   `src/styles/index.css:35-70` loads desktop, record shell, light theme,
   sidebar, record list, controls, Studio theme, workspace primitives,
   collection refinements and Studio v2 in that order. A filename such as
   `modern` does not establish final ownership. `record-list-modern.css:6-105`
   contains values superseded by identical selectors in `studio-v2.css:357-410`.
   Removing those earlier declarations is safer than moving their surviving
   rules across intervening sheets.

2. **The declared layer list is not an enforced stylesheet architecture.**
   `src/styles/index.css:2` declares layer names, but ordinary imports are not
   automatically placed in them. Unlayered rules outrank normal layered rules.
   Converting the whole application to layers would change precedence and is
   not an equivalent cleanup.

3. **Generic modal rules have consumers outside the database.**
   `tabs-a.part-1.css:307-319` and `desktop.css:2-4` are not safe to delete merely
   because `sidebar.css:69-76` controls the database window. That later rule is
   conditional on `.db-shared-workspace`; AI and other work windows reuse the
   generic class. Docked, floating and maximized modes are intentional variants.

4. **Some theme overrides remain load-bearing.**
   `studio-theme.css:386-389` still controls record-number typography through
   `!important`; `studio-theme.css:431-445` controls thumbnail dimensions and the
   actor portrait exception. Studio v2's later normal declarations cannot
   defeat these. Removing all `!important` declarations based on file order
   would change the UI.

5. **The global small-button rule lacks a clear component owner.**
   `tabs-b-resource-manager.css:134-138` assigns global font, padding and flex
   behavior to `.btn.small`; `workspace-modern.css:17-22` cancels its growth in
   shared windows. The source filename does not prove that only resource
   controls need these values. A source-scoping fix requires a reproduced
   consumer defect and separate preservation checks, not a guessed selector.

6. **An empty dependency remains in the troop wrapper.**
   `troops.part-1.css` contains only a historical block comment. Its wrapper
   import adds no presentation. Remove the empty dependency while retaining
   `troops.part-2.css` in exactly the same cascade position.

7. **Existing gates measure debt growth, not cascade simplicity.**
   The CSS budget ratchet and graph allowlists intentionally allow historical
   debt. The live-class gate covers selected editor surfaces rather than every
   DB selector. The size-invariant browser spec walks a hand-maintained tab
   array, which omits newer world tabs; it is not an exhaustive registry audit.

## Accepted approach

Prune only provably overridden declarations while keeping live rules and import
positions intact. Use exact selector/property/importance evidence, then compare
actual browser geometry and computed styles before and after. Do not replace
entire historical sheets because some of their values are overridden.

## Baseline

`npm run gates -- --only css` passed with exit 0, budget 0 and graph 0. Browser
characterization and final validation evidence are recorded under
`output/evidence/css-refactor/` and summarized below when complete.

## Implemented cleanup

The selected scope is **118 declarations in eight database UI files**, plus
16 resulting empty rules. The empty troop slice and its import were removed.
The CSS diff is deletion-only: 173 lines across 10 files.

| Owner | Removed declarations |
|---|---:|
| `desktop-record-shell/11-life-authoring.css` | 15 |
| `desktop-record-shell/14-party-ux-fixes.css` | 8 |
| `light-theme.css` | 21 |
| `sidebar.css` | 10 |
| `record-list-modern.css` | 10 |
| `modern-controls.css` | 3 |
| `workspace-modern.css` | 49 |
| `modern/troops.css` | 2 |

The full exact-selector audit found 254 candidates. The implementation excludes
assistant/global-shell/resource candidates, externally reused stylesheets,
custom properties, conditional rules and the `100vh`/`100dvh` fallback.
This removes six color literals, five important declarations and one CSS file;
it does not claim to eliminate the repository's accumulated CSS debt.

The per-declaration inventory is
[`.omo/evidence/css-refactor/declarations.json`](../.omo/evidence/css-refactor/declarations.json).
Each record identifies the old declaration and its later owner at the starting
revision. Independent lead verification parsed the original Git blobs with
PostCSS, removed exactly the inventory entries in memory, and compared the
resulting AST with the actual files. All eight files matched; all surviving
declarations, selectors, conditions and order were preserved, and every later
dominator still existed. No new cascade layer, token or selector was introduced.

## Verification notes

- Unchanged-code characterization: 33 tabs at 1024x768 and 1440x900, nine
  1280x800 interaction/docking/maximize states, and the closed editor at both
  desktop sizes. Full deduplicated measurements:
  `output/evidence/css-refactor/before-metrics.json`.
- Focused guards passed before and after: three files, 25 tests.
- Changed-tree CSS gates passed with no regressions.
- Changed-tree app typecheck and editor build passed.
- Browser comparison covered 75 DB states and two closed-editor states.
  Geometry, classes and measured styles matched in 74 DB states; a cached
  body testid changed after reopening but its layout and style did not.
  The remaining 1024px village state had different image-loading timing:
  replaying all removed declarations on the same warmed DOM produced exactly
  the same geometry and styles as the pruned CSS. Both closed-editor states
  matched, including the topbar, sidebar and assistant.
- Initial full-frame PNG comparison found 56 of the 66 tab images exactly
  identical. The remaining images include runtime artwork/rail-state changes;
  these are not reported as zero-difference images. Full measurements and
  screenshots remain under `output/evidence/css-refactor/`.
- The configured CSS language server could not run because Biome is not
  installed. PostCSS AST validation, CSS gates and Vite parsing were used;
  no LSP-clean claim is made.
- Image attachments are unsupported in the available model contexts. The
  screenshots are real browser captures, but were not visually interpreted by
  a model. PNG decoding, browser geometry/computed-style and pixel comparisons
  must be distinguished from a human visual review.

## Existing issues outside the deletion-only change

- In a narrow dock, group headers are hidden while tabs in collapsed groups
  remain hidden. The ordinary group-click navigation therefore cannot reveal
  another group. Mode characterization selects the target before docking;
  it does not claim this behavior is fixed.
- The pre-existing `databaseRadioCustomGuard` failure concerns
  `growth-tree.css`'s bare-input focus selector. That file is outside this
  deletion set.
- The starting branch includes unrelated chipset-label work. The PR must be
  based on upstream main with only this CSS increment replayed, not include
  those inherited changes.
