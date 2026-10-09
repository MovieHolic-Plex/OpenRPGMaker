# Shared item catalogue artwork

This catalogue belongs to the application defaults. Every new blank, example, or genre project receives 1,000 item records; equipment remains a separate collection of 86 records. No project ID, remote database write, or import action is required.

## Data ownership

- Existing 228 item IDs and 86 equipment IDs remain stable.
- `scripts/content/prepare-shared-item-catalog.mjs` authors 772 additional items with Korean names, descriptions, prices and supported engine effects. It emits `src/project/defaults/sharedItemCatalog.json` and `src/assets/sharedItemIconAssets.json`.
- `sharedItemCatalog.ts` normalizes those records during the new-project seed only. Asset/profile convergence does not restore deleted item records in an existing project.
- 예제 픽스처 동기화(`fixture:sync`)는 이슬 마을 예제와 함께 2026-10-07 저작권 정리로 지웠다.

## Artwork contract

The user approved the red potion reference and matching eight-item preview on 2026-10-01. `style-reference.png` is the original generated reference. It guides every subsequent generation; it is not a gameplay sheet.

Final gameplay PNGs use a 32×32 canvas, transparent background, binary alpha, at most 32 opaque colours, centred silhouettes with their longest visible side at most 26 pixels, dark warm contours and lighting from the upper left. Consumers can enlarge them with nearest-neighbour sampling.

All replacement artwork is produced by the built-in image generation tool. Historical `cc0-jetrel-*` IDs and paths are retained to preserve saved references; their new illustrations have `generated` provenance. The original Jetrel attribution elsewhere in the repository applies to original assets, not these replacement illustrations.

`art-requests.json` describes 1,054 files: 282 existing icon replacements and 772 new icons. All 1,054 have been generated, saved and visually accepted. Several existing item records share a picture. `generation-manifest.json` records actual source SHA-256, output SHA-256, dimensions, palette size and visible pixel count for each generated file. Registration alone does not prove generation is complete.

## Reproducible authoring

1. Run `node scripts/content/prepare-shared-item-catalog.mjs` to emit the authored data.
2. Run `node scripts/content/plan-shared-item-art.mjs` to find artwork whose final file does not match a completed manifest entry. The resulting prompt set is in `output/item-catalog/pending-art-jobs.json`.
3. Generate each job with built-in imagegen using the reference image, then pass its saved source to `node scripts/content/normalize-shared-item-icon.mjs --id ID --source SOURCE --destination DESTINATION`.
4. Run normalization serially: each call updates the shared manifest with an atomic replacement, so a simultaneous reader sees a complete JSON document. Sources are archived in the ignored `output/item-catalog/sources/` directory. Final files live under `public/assets/`.
5. Inspect native subjects and the final 32px contact sheets. Correct failures before considering the manifest complete.
6. Export the common seed with `vite-node --script scripts/content/export-default-item-catalog.mts`. Inspect the actual blank/example factories with `vite-node --script scripts/content/inspect-shared-item-defaults.mts`.

The task is unfinished while any requested artwork is missing or has not been reviewed. Generation state is saved under `output/item-catalog/`; there are no fabricated placeholder images.

When several independent built-in requests return together, `save-shared-item-art-batch.mjs` accepts one JSON argument with `jobs` (the planned jobs plus their returned `source` paths), `baseCompleted`, `batchTotal`, `failed`, and `running`. It archives each exact prompt/source association, calls normalization one file at a time, and saves the batch status. Use a single helper process; parallel image generation does not permit parallel manifest writes.

## Recorded integration evidence

`verify-shots/shared-item-defaults/report.json` records the live new-project editor: 1,086 combined records, 1,000 in the item filter, the new healing item found by name, its 32×32 images loaded, and no page errors. `output/item-catalog/default-factory-report.json` additionally checks the real blank/example factories, all six genre presets, supported growth effects, and all skill/state/animation/switch references. It saves a complete new-project wire document and reads it through the production deserializer: all 1,000 item rows remain identical. Removing a row and repeating the wire roundtrip keeps it deleted. These checks prove the shared default integration; artwork completeness remains a separate check.

After `art-inspection.json` reports complete, the editor capture also loads every manifest image from the live public URL in groups of 32, with the current SHA in its cache key. The report's `artworkLoads` gives the number checked and any failed or incorrectly sized images. While artwork remains pending, that full-image step is deferred and `artworkStillInProgress` remains true.

`vite-node --script scripts/content/inspect-shared-item-export.mts` reads that saved document and runs the production web export asset collector. `output/item-catalog/export-assets-report.json` confirms that all 1,054 registered icon paths are included as public export dependencies and their resource IDs resolve to the registered paths. Generated file counts and bytes are reported separately from export registration; pending artwork is still unfinished.

### Contact sheet review

`python scripts/content/render-shared-item-review.py --out output/item-catalog/review-current` renders only the assets whose current SHA has no visual review yet. Each cell includes the actual 32px image, a nearest-neighbour enlargement, and its Korean catalogue name. The accompanying `-entries.json` freezes the exact file hashes shown in that sheet; accept only those hashes after inspecting it. This script creates diagnostic evidence and does not edit gameplay images. `--after N --limit 32` can select a previously reviewed range for comparison.

`node scripts/content/inspect-shared-item-art.mjs` decodes every completed PNG and checks its actual hash, canvas, binary alpha, palette, silhouette extent and centring. It also rejects duplicate request IDs or output paths, unexpected manifest entries, and reviews whose exact hash, subject acceptance or style acceptance is missing.

## Completion evidence

`completion-report.json` records the final factory, serialization, artwork, export and browser evidence with the catalogue and artwork ledger hashes. Both blank and example factories produce 1,000 uniquely named item records and 86 equipment records; all six genre presets retain 1,000 items. Serialization preserves every item and does not restore a deleted row. Every item and equipment record has a registered, completed illustration. Every item has a name, description and nonnegative price.

The full PNG inspection reports 1,054 completed and accepted images, no pending images and no issues. The real new-project editor shows 1,000 items, and all 1,054 public image URLs load at 32×32 without page errors. The production export collector includes all 1,054 icons with no unresolved or missing paths. The generated gameplay PNGs total 1,235,714 bytes. Final screenshots and the browser report are in `verify-shots/shared-item-defaults/`.

## Balanced shared seed (2026-10-02)

The shared seed now has 627 executable effect configurations (previously 404), including 50 party medicines, percentage healing, compound cures, profession-specific books, and 48 dedicated item skills. The default actor curve grows from 514 HP / 43 MP to 5,140 HP / 430 MP. Recovery amounts and costs use this scale. `defaultItemBalance.ts` prices all 1,000 new-project items; loading saved projects does not change authored effects or prices. The catalogue preparation script also runs `prepare-shared-item-prices.mts` so authored JSON agrees with the common seed.

`balance-report.json` records the pricing, actual actor growth, skill targeting/reference checks, and neutral damage previews through the production damage calculator. Equal executable effects have equal prices, and no pure HP medicine is dominated by a cheaper peer over the shipped actor/class HP curves. Detailed role/economy policy is in `openwiki/shared-item-balance.md`.
