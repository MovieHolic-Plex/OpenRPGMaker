# Re-review 1 — export-evidence only

- **Verdict:** APPROVE (export criterion only)
- **Product HEAD:** `78197cd54db57f01a5730d08bddcb1f532785efa` (unchanged)
- **Model:** `PI_MODEL=grok-4.6`
- **Out of scope:** all other already-approved task 45/46 findings (native, capture, Phaser `__MISSING`, magenta/transparency). Not reopened.

## Original failure (kept on disk, not rewritten)

`export-decoration.json` remains `ok: false`. `commands.json` `focusedCheck.exit` remains `1`. `check-export-decoration.mjs` is unchanged.

That run failed because the harness asserted `blankHasCloud === false`. The payload already showed `export.blankHasCloud: true` with `load.blankProjectLoadsCloud: false`. The extra assertion contradicts the existing image `resourceProfiles` export contract in `webExportAssets.ts` (catalog image rows are walked; audio rows are not). The failure is a bad reviewer assertion, not a product miss of referenced Cloud.png.

## Corrected contract

| Layer | Policy | Result |
| --- | --- | --- |
| Phaser `loadBundledAssets` | Blank / no spatial graphic must **not** preload Cloud | Pass |
| Export `collectWebExportAssets` | Blank **may** include Cloud via default image profiles | Pass (`blankDefaultMayExportCloud: true`) |
| Export without that fallback | A valid project can omit the Cloud profile row; referenced spatial graphics must still put `assets/easyrpg/picture/Cloud.png` on the zip path | Pass |

Schema allows omitting Cloud from `resourceProfiles`: `validateResourceProfiles` only requires `kind`+`name`. `collectResourceIds` always adds every `EASYRPG_RTP_ASSETS` id, so `graphicResourceId: easyrpg-picture-cloud` stays a known resource. `deserialize(serialize(...))` of that project succeeds and still omits the profile. Editor `ensureBundledResourceProfiles` would re-inject on store load; that is not schema/export deserialize.

## Corrected run

- Harness: `check-export-rereview1.mjs`
- Result: `export-rereview1.json` (`ok: true`)
- Exit: `rereview1-exit.txt` = `0`
- Raw stdout/stderr: `rereview1-stdout.txt`, `rereview1-stderr.txt` (stderr is only the existing edit-activity URL warning)

`prepareWebExport` on a decoration project with Cloud graphic and **no** Cloud profile still ships `assets/easyrpg/picture/Cloud.png`. The same is true for a left-facing-only decoration variant and farm-building **level 2**. A profile-stripped blank with no spatial Cloud reference does **not** export Cloud, so inclusion is not only default-profile coverage.

Two earlier harness crashes (incomplete decoration fixture; assuming blank already had decoration types) are preserved as `rereview1-invalid-fixture-*` and `rereview1-blank-missing-types-*`. They are not product failures.

No source edits, no product-test changes, no native rerun.
