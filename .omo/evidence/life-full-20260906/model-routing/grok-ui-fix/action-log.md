# Action log (written before typecheck/build/native)

- Model: `PI_MODEL=grok-4.6` / `PI_PROVIDER=xai`
- Worktree: `/home/main/z-project/rpg-zzu-life-full-receipt-ui-grok` branch `agent/life-full-receipt-ui-grok-fix`
- Native URL: `http://127.0.0.1:39932/player.html`
- Fixture: owned `project.json` plus probe-authored `easyrpg-picture-cloud` (not a charset workaround)
- Probe: `public-player-green.mjs` — `refreshRuntimeSurfaces` after mutations; Phaser `postrender` subscribed before each screenshot

## Commands

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s 180s \
  npm test -- test/spatialCatalogPictureRender.test.ts test/playScenePlaceableOverlay.test.ts \
    test/p2SpatialPlayIntegration.test.ts test/generatedMonsterFieldSprites.test.ts \
    test/bundledAssetWarmup.test.ts

flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s 180s npm run typecheck:app

flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s 360s \
  env TMPDIR=/dev/shm/st_01a078c5-ui-fix/tmp VITE_CACHE_DIR=/dev/shm/st_01a078c5-ui-fix/vite \
  node .omo/evidence/life-full-20260906/model-routing/grok-ui-fix/public-player-green.mjs
```
