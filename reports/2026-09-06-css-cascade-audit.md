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
Each record identifies the old declaration and its later owner at upstream
`e07cd4f8`; the initial local characterization revision is retained separately.
The same eight source files and all 118 dominators were verified against both
bases. Independent lead verification parsed the original Git blobs with
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
  identical. The remaining frames were not pixel-identical and are not
  reported as zero-difference images. Full measurements and
  screenshots remain under `output/evidence/css-refactor/`.
- The configured CSS language server could not run because Biome is not
  installed. PostCSS AST validation, CSS gates and Vite parsing were used;
  no LSP-clean claim is made.
- Image attachments are unsupported in the available model contexts. The
  screenshots are real browser captures, but were not visually interpreted by
  a model. PNG decoding, browser geometry/computed-style and pixel comparisons
  must be distinguished from a human visual review.

## Final PR verification

The CSS-only branch is `refactor/database-css-cascade`, based on upstream
`e07cd4f8`. Its code commit is `5127fe62`. It excludes the starting branch's
unrelated chipset-label changes.

For the final browser check, the actual upstream-main Vite CSS was captured
before applying the commit. On the PR's real editor page, each of 33 tabs was
opened at 1024x768 and 1440x900. The existing main style element was switched
between those two actual compiled CSS versions while keeping DOM, selection,
scroll, component sheets and accordion state fixed.

**All 66 DB comparisons matched exactly in measured geometry and computed
styles.** The closed editor's topbar, sidebar and assistant also matched at
both sizes. Per-state element counts and matching SHA-256 hashes are in
[browser-verification.json](../.omo/evidence/css-refactor/browser-verification.json).
The full measurements are retained locally at
`output/evidence/css-refactor/pr-metrics.json`.

Of the 68 final screenshot pairs, 61 are pixel-identical; seven are not.
All dimensions and alpha channels match. These differences are retained in
[pixel-verification.json](../.omo/evidence/css-refactor/pixel-verification.json),
not hidden behind a permissive threshold or presented as visual certification.
The declaration-level AST proof and exact DOM comparison are the preservation
evidence; the full-frame pixel results are reported separately.

| Check on the PR tree | Result |
|---|---|
| Exact deletion AST check | Passed: 8 files, 118 declarations, 16 empty rules |
| `npm run typecheck:app` | Exit 0 |
| Focused Studio v2 / sidebar / light-theme tests | 25 passed in 3 files |
| `npm run build:app` | Exit 0 |
| `npm run gates -- --only css` | Exit 0; no regressions |
| `npm run gates -- --only surface` | Exit 1 on both clean main and PR: identical 6 failures, 107 passes; CSS live-class axis passes both |
| `npm run gates` | Inconclusive: Vitest exceeded the 30-minute execution limit; no JSON result was produced |

The full-suite timeout is a validation limitation, not a passing gate and not
proof that every unrelated test passes. No test, warning or baseline was
suppressed or weakened. The earlier full run on the inherited branch was
cancelled when the final PR target was isolated; it is not counted as a pass.

The surface failures were independently reproduced in a detached, unmodified
worktree at `e07cd4f8`: the same six assertions fail in five event-editor test
files, with 107 passing tests on both trees. No baseline was changed. Exact
failure identities, command results and cleanup receipts are recorded in
[validation.json](../.omo/evidence/css-refactor/validation.json).

Cleanup: both browser contexts and the browser process were closed. Owned
Vite sessions on 19841 and 19842 were terminated; `ss -ltnp` confirmed both
ports unbound. The unrelated process on 9841 was untouched.

## Existing issues outside the deletion-only change

- In a narrow dock, group headers are hidden while tabs in collapsed groups
  remain hidden. The ordinary group-click navigation therefore cannot reveal
  another group. Mode characterization selects the target before docking;
  it does not claim this behavior is fixed.
- The pre-existing `databaseRadioCustomGuard` failure concerns
  `growth-tree.css`'s bare-input focus selector. That file is outside this
  deletion set.
- The starting branch includes unrelated chipset-label work; it was excluded
  by replaying only this increment onto the upstream-main PR branch.
