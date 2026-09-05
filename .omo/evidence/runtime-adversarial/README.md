# Runtime adversarial QA — 2026-09-05

The shipping `player.html` path was exercised through the dedicated runtime QA server. Manual browser play covered title selection, walking and releasing movement keys, talking to an NPC, dialogue cancellation isolation, nested item/skill/system menus, saving, loading, returning to title and reopening menus. Test setup uses detached copies of existing test projects; this is an engine/UI change.

## Reproduced defects and fixes

| Defect | Evidence / resulting behavior |
| --- | --- |
| Holding confirm traversed multiple screens and used an item; holding cancel reopened the menu. | Real keyboard repeat reduced potion inventory 5 → 4 without a second deliberate press. Confirm/cancel repeats now stop at the input boundary; arrow repeats still navigate. The title-return confirmation also requires another deliberate press. |
| Full-HP actors could not receive state cures/buffs, books or seeds. | The target screen only checked HP/MP recovery. It now uses the same active effects and actor/class eligibility as the mutation path. Books/seeds request a recipient even with stored scope `none`. Previewing does not advance RNG or consume items. |
| A switch item with a retained ally scope opened an unusable actor target screen. | A regression reproduced the dead end. Switch items now execute directly, and the browser flow verifies the switch remains on after save/load. |
| Ordinary goods entered a stale recovery/target screen. | The menu now projects effects for the current item type before choosing a screen, keeping unusable goods on the list with the existing refusal message. |
| Reopening the menu after loading selected “System” visually but confirmed “Load”. | The controller retained the hidden leaf command. Reopening and returning to the rail now normalize selection to the visible rail entry and reset stale group state. |
| Title load rendered logical pixels directly as screen pixels. | At 960×720 its window was only 264×131, with 11px text, while the game used 3× scale. Load now shares the game stage; its list scrolls within the stage, retaining the header and Back action. |

## Visual evidence

- [Load before](before-load.png) / [load after](after-load.png): the same 960×720 viewport. The after image also stresses long map names.
- [State target before](before-state-target.png): every full-HP actor was unavailable despite an applicable state effect.
- [Effects after](after-effects.png): one buff, one seed and one switch item used through keyboard target selection; the browser test verifies their effects in the saved and reloaded session.
- [Corrupt/incompatible save scrolling](load-errors-scroll.png): keyboard selection reaches the last slot while the header and Back action remain inside the stage.

## Verification

- Focused unit suites: **50 passed**, including eight new regressions that failed before their fixes.
- Runtime menu browser regressions: **3 passed in Firefox**. Real keyboard navigation verifies deliberate item consumption, state/seed/switch effects, save → load → save persistence, title confirmation, and load geometry at 640×480, 960×720 and 1280×800.
- Broader shipping runtime suite: **12 passed in Firefox** (`smoke`, `dialogue`, hit/critical battle flashes, dialogue nameplate geometry, instrumentation boundary, pointer exclusion on dialogue/shop/name entry/ending/battle).
- The corrupt/incompatible save scroll stress case passed separately: all error rows remain in a scrolling list, the third slot is fully visible when selected, and Escape returns to title.
- `npm run typecheck:app`: exit 0. CSS gates: exit 0.
- Full repository gate results are recorded after the final run below. An initial full run received SIGTERM before emitting a report. A later run was deliberately stopped when the switch defect was found; the final run includes that fix and limits Vitest to eight workers using its existing environment options.

Chromium manual play produced the before screenshots and exposed the input defects. The initial broad Chromium run passed hit/critical-flash checks but repeatedly lost module requests to host-level `ERR_NETWORK_CHANGED`; those boot timeouts are not evidence of game logic failures. Firefox is used for the repeatable browser checks, even where the default Playwright project label says `chromium`. The old `_enemy-anchor-probe` also fails on intentional idle sprite motion because it demands identical image rectangles; it does not establish an anchor regression in this change.
