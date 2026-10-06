# Final compact collector detail — native shipping QA

PASS at390×640 and960×720. Real immutable shipping export `final-export-compact/player.html`; artifact `4162d202d42e72f5`, source `678d5a937a2fee64`, canonical revision25. Project bytes SHA `10b303aead3f3d7cc4f349560094427113d2de17fbe405c95434f0820ae18a17` equal prior r25 export.

Native new-game Enter, cinematic Esc, home dialogue Enter, actual arrow-key walk to mart and Enter conversation reached actual buy view. No QA flag/debug hook (`undefined`), teleport, game state injection, fixture/content/source edit, CSS preview injection or canonical save. No transaction repeated. Browser errors0. Own static18569 stopped.

| Visible detail | 390×640 | 960×720 |
|---|---|---|
| Name 포획 구슬 |4/4 nonspace characters|4/4|
| Entire description 약해진 몬스터를 포획하는 기본 구슬입니다. |19/19|19/19|
| Owned 보유0 |3/3|3/3|
| Quantity input / confirm / cancel |All inside viewport, center-hit true|All inside viewport, center-hit true|

Each nonspace text character was measured using native DOM Range bounding rectangle, checked against viewport, each ancestor with overflow clipping, and actual elementFromPoint center hit. No clipped character remained. Screenshot visually confirms mobile title, complete three-line description and owned count. Quantity input24×24, confirm40×27, cancel40×27 on mobile are visible. Other inventory rows scroll; full inventory simultaneous visibility was not required.

## Immediately inspect

- `03-buy-390.png`: full compact title/description/owned plus quantity and actions.
- `02-buy-960.png`: desktop title/description and controls.

Raw per-character failures(claimed none), clipping ancestor rectangles and controls in `buy-390.json` / `buy-960.json`; compact combined `proof.json`; native action history `actions.json`. Prior pricing and mobile clipping failure evidence remains unchanged in parent folder and final-r25. This run only verifies compact layout; native buy/sell accounting already verified on identical r25 project in final-r25.
