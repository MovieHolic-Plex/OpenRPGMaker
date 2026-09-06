# Grok UI diagnosis — missing textures and identical receipt screenshots

- **Inspector:** `PI_MODEL=grok-4.6` (`PI_PROVIDER=xai`)
- **Worktree:** `/home/main/z-project/rpg-zzu-life-full-receipt-ui-grok` @ `0e2af2591f33bab3e1f56f1847e499a1cce0681f` (sparse, canonically adopted; `node_modules` → `/home/main/z-project/rpg-zzu/node_modules`)
- **Original tree not modified:** `/home/main/z-project/rpg-zzu-life-full-housing-receipts` (native-verified PNGs still md5 `6e3a91570e2494955e7a7d54f2b24fb6`)
- **Product/test/config:** read-only. No commits/pushes/PRs.
- **Surface:** Firefox 151.0, `http://127.0.0.1:39931/player.html`, `vite.player-qa.config.ts`, export shim. Isolated context. Fixture GET `/__task11/project.json` only. `errors=[]`, `writes=[]`, `pass=true`.
- **Command (logged before run):** `commands.json`. Exit 0 under flock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock` and `timeout 360s`. Caches on `/dev/shm/st_01a078c5-receipt-ui-grok` (removed). Root disk was 100% / ~2.5G free; ENOSPC avoided via shm + sparse checkout.

Pixels are not treated as proof of receipt rows, claims, gold, inventory, or Save5.

## Causes (from live Phaser + session, not from black pixels alone)

### 1. Black tiles = Phaser `__MISSING` for a valid catalog picture id

Owned fixture (same as the original probe) authors farm-building `graphicResourceId: "easyrpg-picture-cloud"`. That id is a real EasyRPG picture (`src/assets/easyrpgRtp.ts`, file `public/assets/easyrpg/picture/Cloud.png`, 1657 bytes). The editor default is the same id (`src/editor/panels/databaseFarmSpatialView.ts`).

Live PlayScene after native Z sleep:

| Texture key | `textures.exists` |
| --- | --- |
| `easyrpg-picture-cloud` | **false** |
| `tex_easyrpg_picture_cloud` | **false** |
| `easyrpg-charset-object2` | false |
| `tex_easyrpg_charset_object2` | true (loaded, unused by these buildings) |
| `tex_easyrpg_chipset_combined_town` | true (grass) |
| `__MISSING` | true |

`failedAssetLoads` was `[]` — the picture was never requested. `loadBundledAssets` (`src/assets/bundled.ts`) loads chipsets/charsets/crops/emotes, not pictures.

`addSpatialSprite` (`src/player/playScenePlaceables.ts`) calls `resolveEventSpriteTexture(project, resourceId, 0)` then `scene.add.sprite(..., resolved?.texture ?? resourceId)`. `resolveEventSpriteTexture` only understands `assets.sprites`, uploads, and **charset texture keys** (`tex_easyrpg_charset_*`), so a picture catalog id returns `null` and Phaser is given `"easyrpg-picture-cloud"`.

Four `__MISSING` sprites matched the four placements (TILE_SIZE 16, origin 0.5/1):

| Sprite (x,y,dw×dh) | Session placement |
| --- | --- |
| 96,144 32×16 | home1 shed lv2 (5,8) footprint 2×1 |
| 152,96 16×16 | home2 shed lv1 (9,5) |
| 200,144 16×16 | cumulative (12,8) |
| 232,144 16×16 | repeated (14,8) |

Not a screenshot compositor hole: grass (`tex_easyrpg_chipset_combined_town` ×300) and the player charset rendered. Not a bad fixture path to a missing file: Cloud.png is on disk; the player never loads pictures as Phaser textures and does not map catalog ids → texture keys.

**This is a product renderer defect for valid authored graphics.** RED preserved. Product code not edited.

Smallest needed source correction (not applied):

1. Map farm/decoration `graphicResourceId` from catalog `asset.id` to bundled `textureKey` (and load pictures by RTP `path` when the category is `picture`).
2. Do not pass a raw catalog id into `scene.add.sprite` when `resolveEventSpriteTexture` returns null.
3. Call sites: `src/player/playScenePlaceables.ts` (`addSpatialSprite`), `src/player/eventSpriteResources.ts`, `src/assets/bundled.ts` (`loadBundledAssets` / `projectBundledTextureKeys`).

A fixture-only swap to `tex_easyrpg_charset_object2` would hide `__MISSING` without fixing catalog picture ids; that workaround was not applied.

### 2. Byte-identical originals = stale tile overlays, not a capture-too-early of a later different frame

Original probe calls `refreshRuntimeEntities` after placements/demolish/recovery. That function only rebuilds the **event** layer (`src/player/playSceneMapRuntime.ts`). Farm buildings are drawn in `renderPlaceableOverlays` inside `renderTiles` / `refreshRuntimeSurfaces`.

Sleep happens to rebuild tiles (day transition), so the first screenshot already shows four `__MISSING` buildings. Later session mutations do not rebuild overlays.

Reproduction with postrender subscribed **before** each shot:

| Shot | md5 | `__MISSING` count | Session placements |
| --- | --- | --- | --- |
| `red/earned-product.png` | `6e3a91570e2494955e7a7d54f2b24fb6` (same as original native-verified trio) | 4 | home1, home2, cumulative, repeated |
| `red/resumed-unassigned.png` | **identical** | still 4 | home1 **gone** (stale 32×16 sprite remains) |
| `refresh/resumed-unassigned.png` after `refreshRuntimeSurfaces` | `1b5f35320c0bf09c648ba67d2704e716` | 3 | 32×16 home1 sprite gone |
| `red/cumulative-recovered.png` (entities only, after the previous surfaces rebuild) | same as refresh/resumed | still 3 | cumulative **gone** in session, sprite remains |
| `refresh/cumulative-recovered.png` after surfaces | `edefd0c1f901148eeee28d5156b914d5` | 2 | home2 + repeated only |

Waiting for Phaser `postrender` without `refreshRuntimeSurfaces` did **not** change the first two RED frames. Identical originals are a **missing tile rebuild in the capture/probe script**, plus HUD/player already on day 2 at (2,2). They are not three legitimately identical world states.

HUD/inventory still cannot show receipt recovery; do not read hidden Save5 from pixels. After a correct rebuild, the **visible** difference is only which `__MISSING` footprints remain.

Owned capture correction (applied only in `diagnose.mjs`): subscribe `postrender`, then `refreshRuntimeSurfaces` for the `refresh/` set. Original `public-player-verified.mjs` in the housing-receipts tree was not changed.

## Visual inspection (image read, not JSON)

- `red/earned-product.png` and `red/resumed-unassigned.png`: readable day-2 HUD (`1년 봄 2일 12:00`, `빈 손`, `Z 조사`), player upper-left, four black/green-X tiles including the 2-wide home1. Same frame as the preserved original trio.
- `refresh/resumed-unassigned.png`: 2-wide tile gone; three 1×1 missing tiles remain (home2, cumulative, repeated).
- `refresh/cumulative-recovered.png`: two 1×1 missing tiles (home2 and repeated). Cumulative footprint gone. Still Phaser missing texture, not Cloud.png or a charset.

## Limits

- No product edit; charset-key GREEN not run (would mask the catalog-id bug).
- Wiki INDEX / Astra behavior tests out of scope.
- Sparse worktree omitted `verify-shots` / `docs` / `reports` due to root ENOSPC; player `src` + `public` assets were present.
- Owned Vite cache, Firefox, port 39931 closed. shm tree removed. No other resources cleaned.
