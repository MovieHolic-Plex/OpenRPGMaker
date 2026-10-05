# Distinct NPC bodies: correction evidence

## Cause and correction

The first six candidates shared Brendan's body and gait. Head pixels and palette changes did not provide different bodies. Those packages are preserved as producer withdrawals, not user Deny decisions.

The current six candidates adopt different original Emerald sources without resizing or repainting: Wally, May, Hiker, Sailor, Camper, and Expert male. These are original Nintendo/Game Freak/Creatures game sprites, not newly independently drawn art. Source URLs and SHA pins are in `src/harnesses/pokemon-character-casting/references/sources.json`.

The review page adds paired color/silhouette comparisons, retains native GIF and twelve-pose review, and requires a fifth human observation for distinguishing body and clothing without color. No aesthetic approval is inferred from automated checks.

## Focused evidence

- **First inspect:** `six-distinct.png` for all six bodies and silhouettes; `overview-1100.png` for the actual review UI.
- `decoded-all-gifs.png`: decoded four-direction walk frames for all six candidates.
- `diversity.json`: all 15 pairs pass. Highest full silhouette IoU: 0.901; highest body/leg IoU: 0.936; clone threshold: 0.985. Exact palette-label partitions also reject recolors. Recolor and head-only negative controls were rejected.
- `APPROVAL-QA.md` / `approval-record.json`: 23 focused lifecycle, package, persistence, build, duplicate-body and UI checks; completed before the fifth observation was added.
- `UI-QA.md` / `ui-record.json`: 21 checks on the final five-observation UI and API contract, six GIFs, archive behavior, silhouette comparisons, mobile overflow and browser errors.
- `overview-320.png`: narrow mobile layout.

## Stored state and scope

Live review: http://mdc-server:18316/. Durable harness SQLite: `~/.local/share/oprn/pokemon-character-casting/casting.sqlite`.

Six current candidates are pending; six earlier candidates are withdrawn with their packages retained. Real user decision count remains zero. QA wrote zero production decisions; approval attempts were isolated in disposable copied stores. Game assets and canonical project content were not changed by this correction. Placement screenshots are mockups, not runtime play evidence. Battle portraits are outside this walking approval scope.
