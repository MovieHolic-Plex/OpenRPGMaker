# Monster catalog evidence

## Source coverage

- Source baseline: `b9dec50fb`.
- Canonical inventory: 162 unique resource IDs, 162 decoded source files, 161 unique image hashes.
- Two king-slime IDs share identical bytes and retain separate IDs with identical metadata.
- `visual/manifest.json` records every resolver URL, file hash and contact-sheet position.
- `visual/verification.json` and `visual/pixel-verification.json` cover the complete inventory and exact source-to-sheet placement.
- A fresh read of user project `oprn-e98456e1d8` found no monster uploads or monster profiles outside this catalog. That project was not modified.

## Actual image observation

The native session image tool omitted attachments because this session's model metadata did not support images. It was not used as evidence of sight.

The existing editor companion also had a separate, confirmed bug: `openaiToContext` discarded image_url content. Early HTTP200 descriptions were hallucinated and have been discarded. They are not evidence that the artwork disagrees with its filename.

Commit `a364b0951` preserves actual image bytes. Lead verification:

- `bun test test/ohMyPiVision.bun.test.ts`: 24 passed, 0 failed, exit0.
- Corrected worktree companion on11941, provider google-antigravity, actual model gemini-3.1-pro: solid-red PNG -> `red`; solid-blue PNG -> `blue`.
- Actual slime and goblin source PNGs were correctly distinguished as green jelly and green club-bearing humanoids.
- `vision-proof.json` preserves sanitized HTTP headers, model/response IDs, source hashes and these controls.

Every original PNG was then sent individually without its filename or existing resource name. All162 requests returned successfully, and source hashes were checked before submission. `visual/observations-01.json` through `observations-07.json` retain every response.

The lead read all162 returned names/tags/descriptions/uncertainties and corrected the authored data. This is tool-assisted visual inspection through a verified image model plus lead editorial review, not a claim of native direct image visibility. The data is stored in `src/assets/monsterCatalogData.json`; the portable source-hash manifest is `src/assets/monsterCatalogReview.json`.

The three-arm giant, goblin equipment and gray dragon's scaled body received an additional check using actual gemini-3.7-flash-tiered image inference. A Claude alternative returned quota429; it is not counted as verification.

## Editorial decisions

- Descriptions cover visible anatomy, colors, equipment and pose, not inferred powers, habitat or lore.
- Names are artwork labels; existing enemy gameplay names, resource IDs, stats and image bytes are untouched.
- Removed misleading tags, including `slime` from a drooling carnivorous plant and insect classification from a centipede.
- Removed an uncertain lava-material claim; kept only visible orange light.
- The resource with a bone-dragon ID visibly has scales, so its metadata says gray/white dragon rather than inventing a skeleton.
- Existing Korean lookup aliases remain supported. The cave-bat alias is retained as an existing catalog lookup term, not a claim that a cave is visible in the artwork.
- User-defined overrides can replace names/tags/descriptions independently; future uploads remain unreviewed rather than inheriting a reviewed badge from their filename.

## RED to GREEN

1. Before catalog data: `monsterCatalogCoverage.test.ts` failed twice. Catalog keys were empty versus162 independently registered IDs; resource flags were fallback/unreviewed.
2. Initial data uncovered five existing lookup/autofill failures. Restored relevant Korean synonyms and cave-bat lookup alias without modifying existing assertions.
3. Final run:

```sh
npm test -- --maxWorkers=2 --minWorkers=1 \
  test/monsterCatalogCoverage.test.ts test/monsterGraphicReliability.test.ts \
  test/aiGraphicAutofill.test.ts test/monsterResourceCatalog.test.ts \
  test/resourceSearch.test.ts test/complexMonsterAuthoring.test.ts
```

**Six files,127 tests passed; CATALOG_GREEN_EXIT=0.**

Both changed TypeScript files have clean diagnostics. JSON artifacts were parsed; catalog/review counts are both162 with zero missing IDs, extra IDs, empty metadata fields or hash mismatches.

`npm run typecheck:app && npm run build:app` passed with CATALOG_BUILD_EXIT=0; the app build completed in1m32s. Final UI/AI integration, full player/standalone build, real-browser remote persistence, ultrabrain review and merge are separate gates; this catalog evidence does not claim those have finished.
