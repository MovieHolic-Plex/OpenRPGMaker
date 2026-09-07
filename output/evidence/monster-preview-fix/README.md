# Monster preview containment fix

Base: 83e017af0 on agent/monster-ui-0907. Only the preview CSS and existing QA driver changed, plus this narrow evidence. The integration worktree was not edited.

## Reproduction and result

The parent reported RED on integration cc09b9ddb at 1440x900: frame 601.33x160, IMG 601.33x601.33, following ID top 301.75.

This worktree independently ran the new assertion before changing CSS. It failed with `catalog-375: selected generated-enemy-goblin-scout: image bottom outside frame`: frame 317x160 at y342, IMG 317x317 at y342, ID top 501.75.

The fix gives the shared preview grid explicit minmax(0, 1fr) tracks in both axes and its IMG min-width/min-height of zero. It does not add clipping or change object-fit: contain. The same component supplies list thumbnails.

The complete Firefox driver passed after the fix. Goblin scout is explicitly selected through its actual catalog row, not an injected image. At 1024x768, 1280x800 and 1440x900 the decoded 384x384 resource has a 601.3333x160 image box contained in the same-size frame. Contain fitting renders the full square artwork without distortion. The ID boundary has only 0.25px font-box rounding, within the asserted 1px allowance. Goblin thumbnails have 22x22 images inside 24x24 bordered frames. Additional 375x900 and 768x900 captures pass. All 35 search/name/tags/description/apply/reset/close hit tests pass. Existing keyboard selection, dirty cancellation, validation, apply, undo/redo, reset and project replacement checks also pass.

The committed desktop PNGs await parent visual inspection; the child verified PNG signatures/dimensions and browser geometry, not visual content. `verification.json` includes measured geometry and screenshot SHA-256 hashes.

## Commands and gates

Run from this worktree:

```
MONSTER_QA_BROWSER=firefox MONSTER_QA_PORT=11945 MONSTER_QA_OUT=output/evidence/monster-preview-fix/green node scripts/qa/monster-metadata.mjs
npm test -- test/databaseMonsterMetadata.test.ts test/databaseMonsterSpeciesView.test.ts
npm run typecheck:app
npm run gates:css
node scripts/check-css-graph.mjs
node scripts/check-css-live-classes.mjs
npm run build:app
node --check scripts/qa/monster-metadata.mjs
git diff --check
```

- UI tests: 19/19 passed in one run; typecheck and build:app passed.
- CSS graph and live-class gates passed. PostCSS parsed the changed stylesheet successfully.
- CSS budget fails at cssFileCount 268 > baseline 267. An in-memory substitution of the unchanged HEAD stylesheet reproduces the identical failure and metrics; no baseline was updated and no stylesheet was added.
- JS LSP: no diagnostics. CSS LSP unavailable (Biome not installed); no dependency was added.
- Build warns about existing circular/dynamic chunk imports and bundle sizes; no build failure.
- Browser has zero page errors, HTTP errors and remote writes. Local bridge /v1/browser/hello CORS failures and disabled-persistence autosave messages occur in both RED and GREEN and remain recorded, not suppressed.
- One initial GREEN process was interrupted by the external 300-second command timeout after all five catalog captures. The full unchanged driver then completed with a 900-second command allowance. No sleeps or polling delays were added; image loading and decoding use real events with a bounded deadline.
- Owned Vite server stopped after completion; port 11941 was not used.

Raw red/green results, extra screenshots and validator logs remain beside this file in the worktree (uncommitted to keep evidence narrow).
