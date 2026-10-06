# Native shipping shop QA — final r25

**PASS:** actual new game and walking into home mart; collector skin; buy2/sell2; native keyboard tab switching; quantity/confirm/cancel visible at960×720 and390×640; Escape returns to field. Browser errors0. Own static port18569 stopped. Original0G run retained in parent folder.

Artifact `7915c1ebc20e18af`, source `51a50abb8dfe23a7`; canonical revision r25 / root-reported SHA `4811a4afff1e1a6508e810ff25ddeb2245b08b4e8f007d4e028d1d62cb288937`.
Pristine `final-export-repaired/player.html` used its own shipped BOOT. No QA flag/debug hook (`undefined`), teleport, state injection, edited fixture, canonical writes or save. All game actions used native keyboard. Screenshots/DOM observations only.

| Transaction | Player gold | Owned capture orbs | Merchant gold |
|---|---|---|---|
| Before |1600G|0|100G|
| Buy2 ×80G |1440G|2|260G|
| Sell2 ×40G |1520G|0|180G|

Purchase quantity selected with ArrowRight1→2, nativeEnter executed exactlyone2-item purchase. Actual Tab→ArrowRight→Enter switched buy→sell. ShiftTab returned to owned item, ArrowRight selected2, Enter executed80G sale. ArrowLeft→Enter switched back to buy; own count0 was visible. Esc twice closed the shop to field. No extra trade occurred.

Rectangles of quantity input, confirm and cancel were inside the viewport and center-hit-test true for both sizes. Desktop item description is clear; inappropriate equipment text/button are absent. Mobile detail has an icon only: title/description exist in DOM but remain clipped by compact side layout; the selected list label, price, own count, quantity and action buttons are readable. Do not claim complete mobile detail readability. Offscreen rows in the scrolling inventory list have hit=false until navigated; that is not an action-button failure.

## Immediately inspect

- `05-buy-quantity2-960.png`: original160G purchase preview and desktop controls.
- `06-buy-quantity2-390.png`: mobile buy quantity2 and visible actions; detail limit.
- `07-buy-after-390.png`: actual1440G / own2.
- `09-sell-quantity2-390.png`: mobile80G sale preview/actions.
- `10-sell-quantity2-960.png`: desktop40G unit /80G total / detail.
- `11-sell-after-960.png`: actual1520G / empty owned sale list.
- `12-buy-return-owned0-960.png`: explicit own0 in buy list.
- `13-exited.png`: Escape back to field.

`proof.json` contains exact exportSHA values, raw measured counters and rectangle checks. `actions.json` contains complete native key history. Only home mart was visited; other eight shops were not individually traversed.
