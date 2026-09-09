# Grok UI fix — tasks 45 and 46

- **Model:** `PI_MODEL=grok-4.6` (`PI_PROVIDER=xai`)
- **Worktree / branch:** `/home/main/z-project/rpg-zzu-life-full-receipt-ui-grok` `agent/life-full-receipt-ui-grok-fix`
- **Base:** `0e2af2591f33bab3e1f56f1847e499a1cce0681f`
- **Diagnosis preserved:** `.omo/evidence/life-full-20260906/model-routing/grok-ui-diagnosis/` (not rewritten)
- **Native:** Firefox 151, `http://127.0.0.1:39932/player.html`, fixture `easyrpg-picture-cloud` (not charset)

## Task 45 — catalog picture renderer

`loadBundledAssets` now queues only spatial-referenced EasyRPG pictures under the catalog id. `resolveSpatialGraphicTexture` maps that id for farm/decoration overlays; `resolveEventSpriteTexture` still returns null for pictures.

Live after GREEN:

| Shot | `textures.exists("easyrpg-picture-cloud")` | `__MISSING` sprites | Cloud sprites | Session placements |
| --- | --- | --- | --- | --- |
| earned-product | true | none | 4 | home1, home2, cumulative, repeated |
| resumed-unassigned | true | none | 3 | home2, cumulative, repeated |
| cumulative-recovered | true | none | 2 | home2, repeated |

Visual: EasyRPG Cloud.png (white cloud, magenta sheet background) at those footprints. Not Phaser `__MISSING`. Pixels do not prove receipt/Save5.

## Task 46 — capture path

Owned `public-player-green.mjs` calls `refreshRuntimeSurfaces` after public mutations and subscribes to Phaser `postrender` before each screenshot. `refreshRuntimeEntities` product meaning unchanged. Three PNG hashes differ; 4→3→2 matches session.

## Commands and exits

| Step | Exit |
| --- | --- |
| RED `npm test -- test/spatialCatalogPictureRender.test.ts` (before loader/resolver) | 1 (3 failed / 2 passed — catalog id not loaded / resolved) |
| GREEN same file + related overlay/charset/warmup tests | 0 (22 passed / 5 files) |
| Compiler API diagnostics on changed TS | 0, 0 diagnostics |
| `npm run typecheck:app` | 0 |
| Native `public-player-green.mjs` | 0, `pass=true`, `errors=[]`, `writes=[]` |
| First `npm run build` | 1, sparse missing `community-site/package.json` (then sparse-checkout add) |
| `npm run build` after sparse add | 0: app 1364 modules, player 529, SDK 7 files +45 assets, standalone 531. Warnings retained (missing optional AI keys, circular re-export, mixed static/dynamic imports, large chunks). |

## Source SHA256

- `src/assets/bundled.ts` `ddb6af223e92d6c6cf1d6c897794c92b50895aef162b0d7de488a0344e1d2688`
- `src/player/eventSpriteResources.ts` `7ec273fd3c851e3ef8f8ed914850d576206f16784eb05215e3394162c5ccf72d`
- `src/player/playScenePlaceables.ts` `b07d6177ef14accff0eee7e6ec5e3ff6ca81f48670e947d275cb999b07925b9a`
- `test/spatialCatalogPictureRender.test.ts` `d9f3f524361fe7b1c722b606c7dd4e7f6cb1bc7731391cff14618aecb8973e6e`

## Cleanup

Owned shm `/dev/shm/st_01a078c5-ui-fix` (vite, tmp, dist) removed. Port 39932 free. Dist was an owned symlink to shm, not a config edit. No other resources deleted.
