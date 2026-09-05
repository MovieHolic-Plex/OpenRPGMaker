# Battle command studio verification

## Scope

The existing class-specific drag placement studio is extended with project-wide
`system.battleCommandCss`. This is editor/engine code, not authored game content.
All browser projects used for verification are isolated test fixtures.

## Regression evidence

- The initial CSS browser test failed because `db-command-css-input` did not exist.
- The initial public serialize/deserialize test failed because CSS was discarded.
- The draft-preservation browser regression failed with expected CSS text and
  received `""` after the preview toggle rerendered the editor.
- The unapplied-preset reset DOM regression failed before the reset handler
  cleared the draft. The corrected CSS and studio DOM suite passed 43 tests.
- The five-file focused suite passed 61 tests after draft preservation. The later
  two-file 43-test run also covers the unapplied-preset reset fix.
- The seven-test editor browser suite passed before the draft regression was
  added. The expanded CSS browser case then passed, including valid and invalid
  drafts surviving a rerender and package export/import.
- A deterministic animation-frame test reproduced the shared focus helper
  stealing focus back from the author's next textarea. Restoration now yields
  to another live control, and a newer restoration supersedes pending frames.

## Repository gates and baseline comparison

`npm run gates` completed with app typecheck exit 0, CSS budget/graph exit 0,
Vitest 13,130 passed / 210 failed, and surface 107 passed / 6 failed.
The full suite is not green.

The 31 files newly reported against the older tracked baseline were rerun on
both this tree and an isolated original-base worktree at `32ef1bcd`. The current
run had 31 failing test names; the original-base run had 36. Every current
failure name also failed on the original base. Five timing-sensitive failures
appeared only on the base run; they are not claimed as fixes.

The surface gate was independently rerun on `32ef1bcd`: the same 6 tests in
the same 5 files failed, with 107 passed. No snapshots, expectations, or
baseline files were changed to hide these failures.

Machine reports: `.omo/battle-command-css-current.json` and
`../wish-ui-ux-custom-css-3-css-baseline/.omo/battle-command-css-base.json`.

## Direct final UI observations

Firefox was driven against this worktree at `http://127.0.0.1:19841`.
The server was frozen with `E2E_FREEZE_DEV_SERVER=1` to prevent HMR from replacing
the project/store while a test was running.

| Viewport | CSS section width | Section scroll width | Document width | Overflowing text/control nodes | Textarea font |
| --- | ---: | ---: | ---: | ---: | --- |
| 1024 x 900 | 718 | 718 | 1024 | 0 | 13px |
| 1280 x 900 | 974 | 974 | 1280 | 0 | 13px |
| 1440 x 900 | 1134 | 1134 | 1440 | 0 | 13px |

Measured nodes were `p`, `button`, and `label` descendants of the CSS section.
Keyboard Tab reached the Skill preview button, matched `:focus-visible`, and
computed `background-color: rgb(74, 87, 214)`.
Resetting an unapplied preset left the textarea empty. Applying the preset
persisted its exact CSS in the store. Invalid global selectors disabled Apply.
Resetting a saved override removed both the stored field and mounted style.

## Shipped-player execution

`DEV_SERVER_PORT=19841 node scripts/qa-battle-command-css.mjs` passed after the
focus restoration fix. The script uses real editor controls to place and reorder
commands, applies CSS, serializes the project, and loads that file through the
dedicated `player.html` QA harness.

- Authored IDs: `cmd_skill`, `cmd_attack`, `cmd_item`.
- Runtime button IDs: `actor-command-skill`, `actor-command-attack`,
  `actor-command-item`, in the same order.
- Root menu, direct single-skill target, and item submenu retained the authored
  color `rgb(232, 240, 255)`; command/target radius was `8px`.
- Keyboard navigation entered the skill target shortcut and item submenu, then
  selected and confirmed Attack. A MutationObserver registered before confirmation
  observed enemy HP change from `220/220` to `152/220`.
- The four runtime harness beats passed with zero runtime errors.

Artifacts: `output/evidence/battle-command-css/result.json`,
`runtime/SUMMARY.md`, `runtime-item.png`, `runtime-target.png`, and
`runtime-action.png`. The eight-file focused suite passed 69 tests; adjacent
faction/enemy panel tests passed 17 tests.

Final checks after the focus fix: the editor browser suite passed all 7 tests
with retries disabled (2.1 minutes); `npm run build` exited 0 and produced the
editor, player, SDK, and standalone bundles. The strengthened focus-only suite
passed all 3 deterministic cases.

Screenshots are local, uncommitted evidence in
`output/evidence/battle-command-css/manual-{1024,1280,1440}.png` and
`manual-keyboard-focus.png`.

## Review limitations

Both OpenCodex visual reviewers and the parent image tool reported that this
model cannot read images. No perceptual or pixel-level visual approval is claimed.
The screenshots, real browser interactions, computed styles, and geometry
measurements are available; subjective visual/CJK glyph review remains unverified.
Lighthouse scores were not measured. Some LSP requests returned stale diagnostics
or freshness timeouts; compiler checks are the type gate.
