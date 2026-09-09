# Integrated UI validation — canonical tasks 45 and 46

- **Verdict (45/46 only):** PASS with limits
- **Not claimed:** Phase 4 complete, all 51 tasks, remote merge, overall goal
- **Model:** `PI_MODEL=grok-4.6` (`PI_PROVIDER=xai`)
- **Frozen tree:** `/home/main/z-project/rpg-zzu-life-full-p4` HEAD `3df665bf28c3eb4f87252a4acb6260d25589850c` (`agent/life-full-p4`)
- **HEAD moved?** No. Start and end HEAD match the freeze. Tracked `git diff` empty. Source/test/config not edited or committed.
- **UI bytes vs 78197:** exact match on the four product/test files (diff empty; SHA256 below)
- **This run:** new integrated input on the parent merge tree, not a repeat-to-green of the producer worktree (producer/reviewer worktrees were archived and removed)

## Policy and prior evidence (read, not rewritten)

- Canonical plan tasks 45/46 in wish-html `.omo/plans/life-systems-full-implementation.md`
- `.omo/evidence/life-full-20260906/model-routing/policy.json` (`ui.model=xai/grok-4.6`)
- `model-routing/grok-ui-fix/REPORT.md` (producer summary; incomplete raw command receipts)
- `model-routing/grok-ui-diagnosis/` (preserved RED)
- `grok-spatial-ui-review/{REPORT.md,ADDENDUM.md}`
- CLAUDE.md ignored

## Source SHA256 (integrated tree = 78197)

- `src/assets/bundled.ts` `ddb6af223e92d6c6cf1d6c897794c92b50895aef162b0d7de488a0344e1d2688`
- `src/player/eventSpriteResources.ts` `7ec273fd3c851e3ef8f8ed914850d576206f16784eb05215e3394162c5ccf72d`
- `src/player/playScenePlaceables.ts` `b07d6177ef14accff0eee7e6ec5e3ff6ca81f48670e947d275cb999b07925b9a`
- `test/spatialCatalogPictureRender.test.ts` `d9f3f524361fe7b1c722b606c7dd4e7f6cb1bc7731391cff14618aecb8973e6e`

## Failing-first evidence

**Unit-RED raw output is unavailable.** Producer grok-ui-fix REPORT summarizes `npm test -- test/spatialCatalogPictureRender.test.ts` before loader/resolver as exit 1 (3 failed / 2 passed) but did not retain complete argv/cwd/stdout/stderr. No recovered unit-RED log exists under archived P4 evidence. That summary is not treated as a manufactured raw receipt.

**Preserved pre-change browser RED** (not rewritten; failing-first visual):

- Dir: `.omo/evidence/life-full-20260906/model-routing/grok-ui-diagnosis/red/`
- `earned-product.png` and `resumed-unassigned.png` md5 `6e3a91570e2494955e7a7d54f2b24fb6`, sha256 `1b5ae22ac50cbe7f2527ab6262fcf86113f70d8bb22daba877f2ea0c2a126be3`
- Opened `red/earned-product.png` in this session: four Phaser `__MISSING` black/green-X tiles (including 2-wide home1) on grass; player charset and day-2 HUD present. Catalog Cloud.png was not drawn.

Diagnosis of stale overlays vs missing picture load is left in `grok-ui-diagnosis/REPORT.md`.

## Focused tests (actual count, not assumed)

Selected paths (overlay / charset field sprites / warmup + catalog picture):

1. `test/spatialCatalogPictureRender.test.ts`
2. `test/playScenePlaceableOverlay.test.ts`
3. `test/p2SpatialPlayIntegration.test.ts`
4. `test/generatedMonsterFieldSprites.test.ts`
5. `test/bundledAssetWarmup.test.ts`

| Receipt | Exit | Result |
| --- | --- | --- |
| `receipts/focused-tests` | 1 | Harness only: vitest 3.2.4 rejected unknown `--cacheDir`. Tests did not run. Raw stderr retained. |
| `receipts/focused-tests-run` | **0** | Actual run. **Test Files 5 passed (5). Tests 22 passed (22).** Duration 9.68s. |

Per-file counts from `focused-tests-run.stdout.txt`: bundledAssetWarmup 2, playScenePlaceableOverlay 5, spatialCatalogPictureRender 5, p2SpatialPlayIntegration 3, generatedMonsterFieldSprites 7. Sum 22.

cwd `/home/main/z-project/rpg-zzu-life-full-p4`. Full argv in `receipts/focused-tests-run.json`.

## Diagnostics → typecheck → build

Order held. Compiler API on the four changed files **before** `typecheck:app` and one full `npm run build`.

| Step | Exit | Notes |
| --- | --- | --- |
| diagnostics (`diagnostics.mjs`) | 0 | `count: 0`. stdout: `No syntactic or semantic diagnostics on changed product/test files.` |
| `npm run typecheck:app` | 0 | `tsc --noEmit -p tsconfig.app.json` |
| `npm run build` | 0 | app **1364** modules; player **529**; `sdk-manifest: 7 files + 45 runtime assets`; standalone **531**. Warnings retained in `receipts/build.stderr.txt` (missing optional AI keys, circular re-export, mixed static/dynamic imports, large chunks, unresolved `/assets/...` runtime URLs). Dist was an owned symlink to tmpfs, then removed. |

## Native player.html / export shim

Owned probe: `public-player-green.mjs` (import path adapted to this evidence depth only). Fixture IDs reused: `easyrpg-picture-cloud` authored onto farm buildings from `.omo/evidence/life-full-20260906/5/project.json`. No charset workaround. No injected successful pixels.

Surface: Playwright Firefox **151.0**, isolated context, `http://127.0.0.1:39941/player.html`, `vite.player-qa.config.ts`, `exportProjectStoreShim`. `refreshRuntimeSurfaces` after mutations; Phaser `postrender` armed before screenshots and before surface refresh. Native Z via `performObservedAction`.

| Receipt | Exit | Result |
| --- | --- | --- |
| `receipts/native` | 1 | Harness only: `XDG_CACHE_HOME` pointed Playwright at empty shm browsers. No install. JSON saved as `receipts/native-env-miss-lifecycle.json`. |
| `receipts/native-run` | **0** | `PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright`. `pass=true`, `errors=[]`, `writes=[]`, `head=3df665bf28c3eb4f87252a4acb6260d25589850c`. |

Live inspect (`native/public-lifecycle.json`):

| Shot | `textures.exists("easyrpg-picture-cloud")` | `__MISSING` sprites (`missingLike`) | Cloud sprites | Session placements |
| --- | --- | --- | --- | --- |
| earned-product | true | [] | 4 (32×16 home1 + three 16×16) | home1, home2, cumulative, repeated |
| resumed-unassigned | true | [] | 3 | home2, cumulative, repeated |
| cumulative-recovered | true | [] | 2 | home2, repeated |

`textures.exists("__MISSING")` is true (Phaser builtin). Unintended missing sprites: none.

PNG sha256: earned `4e692d23512f5bd2f929cfa5d2b8d0ed5c226a888535ce629ab7b53c894e492e`; resumed `b9b760f3c011da2e0cd9f64b373c2e803f239bc380f8ce30b9e5f6a2ce09931e`; cumulative `edb07d98fa469484adb3393b7bbb29c50386bf327e0730746fd443ebb1e6ffe5`.

Visual (images opened): EasyRPG Cloud.png (white cloud, pink/magenta sheet) at those footprints. Pink sheet is the existing raw-picture contract, not `__MISSING` and not a new art task. 4→3→2 matches demolition then content-change recovery of cumulative. Hidden receipt/Save state is **not** proven by pixels.

## Limits

- Scope is canonical tasks 45 and 46 on this integrated HEAD only.
- Decorations were not on the housing native fixture (same limit as the spatial UI review).
- Unit-RED raw stdout is unavailable; browser RED is the preserved failing-first artifact.
- Two harness receipts (unknown `--cacheDir`; Playwright path via `XDG_CACHE_HOME`) are not product failures.
- No nonvisual 242 suite, no broad gates, no installs, no remote writes.

## Cleanup

Owned `/dev/shm/st_01a07924-ui-val` removed. Owned `dist` symlink removed. Port 39941 free. Diagnosis tree left in place. No other resources deleted. Parent tracked tree unchanged at `3df665bf28c3eb4f87252a4acb6260d25589850c`.
