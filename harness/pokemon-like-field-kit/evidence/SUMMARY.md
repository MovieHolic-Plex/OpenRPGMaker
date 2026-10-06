# Field kit wave 1 — candidate evidence

## Scope

Independent candidate harness, **not canonical game integration**. All production decisions are pending. No original-game save data was mutated.

## Art

Native32×32 field monster,96×128 atlas.4direction GIFs with4frames each,150ms per frame. Original template SHA, protected foot indices,8colors including transparency checked. Every decoded GIF pixel equals the integer-scaled authored frame. Source/derivative comparison and decoded sheet were visually inspected. Human aesthetic decision pending.

## UI / audio browser

- Real browser GIF loads:5/5. Browser/HTTP errors:0.
- Keyboard Enter/↑↓/Escape navigation, party, bag and shop.
- Demo healing HP24→38, potions5→4; purchase money1600→1520, orbs10→11. These are preview state, not game transactions.
- Town BGM source start count stays1 through menu transitions. Pause/resume preserves offset.
- Native route playback crosses30.968s loop at33.059s with the same source, then changes menu without restarting.
- Both new tracks and previous town track decode/play. No model listening claim.
- New BGM peak0.78; PCM join-step0; short menu cues peak0.234. These figures do not establish musical quality.
- Mobile390px: document width390px, no horizontal overflow.

## Approval / portability

Operational runtime is an independent directory outside the editor repository. A second disposable copy verifies unchecked Allow rejected, stale hash rejected, cross-origin POST rejected, Deny blocks export, Allow/Deny survive restart, all current Allows permit export, changed bytes block export. Synthetic receipts remain in the temporary copy; production receipt count0.

## Immediate visual review

- menu.png / party.png / bag.png / shop.png
- desktop.png / mobile.png
- ../site/assets/comparison.gif
- ../site/assets/decoded.png

Detailed machine receipts: browser.json, loop.json, receipts.json. No whole-repository test suite was run.
