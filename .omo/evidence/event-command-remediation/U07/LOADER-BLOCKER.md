# Historical U07 loader blocker (resolved; see MANIFEST.md)

The loader owner was subsequently authorized. The following is the preserved discovery receipt,
not the final status. Canonical loading/frame registration and real walking proof are now GREEN.

The earlier resolver blocker in BLOCKER.md is fixed under the explicit narrow authorization.
`src/player/playerSpriteResources.ts` now accepts only actual uploaded `kind: charset`, uses the
existing uploaded asset-id texture convention from eventSpriteResources/charsetCatalog, and
reuses the existing charset idle/walk helpers. Bundled IDs/texture aliases remain first; missing
and picture/faceset/backdrop/monster/generic-sprite uploads retain the original fallback.

## New concrete loader RED

`PlayScene.preload()` (`src/player/PlayScene.ts:205`) calls `loadBundledAssets` in
`src/assets/bundled.ts:109`. That function never queues project uploaded charsets.
`PlayScene.create()` (`src/player/PlayScene.ts:234`) calls `registerBundledFrames`, whose
`registerEasyRpgCharsetTextures` loop only covers `BUNDLED_EASYRPG_CHARSET_ASSETS`.
No texture exists for the uploaded asset-id that the corrected resolver selects.

Real Firefox player evidence, **not inferred from resolver output**:

```json
{
  "resourceId": "u07-charset-new",
  "textureKey": "__MISSING",
  "textureExists": false,
  "frame": {"name":"__BASE","x":0,"y":0,"width":32,"height":32},
  "frames": [{"id":24,"missing":true},{"id":25,"missing":true},{"id":26,"missing":true}]
}
```

Paths: `surface-utyQuE/player-battle-loaded.json`, `player-ai-battle-loaded.json`,
`player-map/manifest.json`, and `player-extension-attempt1.log.gz`. The map's original
`playerSpriteTextureLoaded` assertion now fails directly; the battle/AI assertions also fail
on `__MISSING`. Overall exit **1**, 3 scenario failures. The registered PNG is 288x256.
The exact underlying sprite, texture manager and frame table were read using a temporary
read-only wrapper around Phaser's original Sprite.setTexture; it calls the original method,
captures the actual scene and restores the method immediately. No texture or frame is mocked.

The next required authorization is **src/assets/bundled.ts**, its uploaded charset preload and
registration path, with adjacent loader tests. It should reuse the existing
`registerCharsetTextureFrames` geometry, not invent keys or slice arithmetic. No loader or
PlayScene edit has been made. Full player proof, including walking frames and untargeted actor
state, remains pending; the current receipt's untargeted actor has no M2 mutation, but the
attempted project.session override setup is not retained by New Game and is not claimed as
complete untargeted-state verification.

## Verification after extension

- `runtime-extension-red.json/log.gz`: **13 tests, 1 failed / 12 passed, exit 1**.
- `runtime-extension-green.json/log.gz`: **114 tests, 114 passed, exit 0**, 7 files.
  Includes original U07 22, U05 59, original adjacent 20, added resolver cases 10 and existing
  playerSpriteResources cases 3. Original U07 assertions/inputs/controls remain byte-identical.
- LSP: no diagnostics on playerSpriteResources.ts, U07/playerSprite.test.ts,
  U07/playerObservation.mjs and the runtime scenario after extension.
- The successful **17-flow editor export remains valid**: no further editor behavior changes.
- New player run retains real face/battleback/record-only assertions. Do not substitute its
  selected resource ID for a loaded-texture/frame proof.
- Owned Firefox contexts, server and temporary player cache/fixtures closed/removed in finally;
  latest port 33163 recorded in player-cleanup.json. No commit/push/PR; no partial GREEN claim.

Preserve prior BLOCKER.md and receipts as history. This file supersedes its current-status and
resolver-ownership paragraphs. Add this file, runtime-extension-{red,green}.json/log.gz,
player-extension-attempt1.log.gz, U07/playerObservation.mjs, and loaded-player JSON receipts to
the deliberate future evidence selection in PACKAGING.md. No screenshots or credentials.
