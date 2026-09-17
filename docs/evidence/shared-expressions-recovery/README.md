# Common expression recovery — 2026-09-17

Restored 75 missing character sets from preserved user attachments alongside the existing blue traveler: 76 sets / 1216 expressions.
The deleted temporary worktree is not the storage location for these recovered assets; they are now included in this repository.
Source mapping and hashes: `scripts/shared-face-expression-sources.json`.

Validation:
- Preparation checked all 76 master SHA-256 hashes and sampled individual cells to 48×48 without interpolation.
- `node scripts/slice-faceset-sheets.mjs --verify`: 1328 faces / 83 sheets passed, including 112 base/generated faces.
- `npm test -- test/facesetFaceAssets.test.ts test/databaseResourcePickerDialog.test.ts`: 16 tests passed.
- `npm run gates -- --only typecheck`: exit 0, zero errors.
- Playwright against local Vite: all 76 character options selected; each had 16 successfully loaded 48×48 images; each inspector selection resolved its expected resource id. See receipt and screenshot.

This is local source/UI validation, not evidence of a production deployment.
