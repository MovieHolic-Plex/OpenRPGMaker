# Independent UI review — tasks 45 and 46

- **Verdict:** APPROVE
- **Scope:** canonical tasks 45 and 46 only. Not Phase 4, not all 51, not remote, not overall goal.
- **Model:** `PI_MODEL=grok-4.6` (`PI_PROVIDER=xai`). Image/UI review, not Astra.
- **Reviewed HEAD:** `78197cd54db57f01a5730d08bddcb1f532785efa` (`agent/life-full-receipt-ui-grok-fix`)
- **Base:** `0e2af2591f33bab3e1f56f1847e499a1cce0681f`
- **Producer:** `/home/main/z-project/rpg-zzu-life-full-receipt-ui-grok`
- **Locked review tree:** `/home/main/z-project/rpg-zzu-life-full-spatial-ui-grok-review` (detached, locked; parent owns archival/removal)
- **Policy:** `.omo/plans/life-systems-full-implementation.md` (adopted into this tree) and `policy.json` (`ui.model=xai/grok-4.6`)
- **CLAUDE.md:** ignored as instructed

## Verdict

APPROVE the catalog-picture renderer and versioned capture path at HEAD `78197cd54`. Farm and decoration catalog ids, including the editor default `easyrpg-picture-cloud` and level/orientation variants, are selected, loaded, and resolved. Event charset mapping is unchanged. Native player art is Cloud.png (not Phaser `__MISSING` sprites) and visible placement count is 4→3→2. Capture uses `refreshRuntimeSurfaces` with `postrender` armed before the action. `refreshRuntimeEntities` remains event-only.

## What was inspected (diff and callers, not labels)

Commit `78197cd54` product files:

- `src/assets/bundled.ts` — `loadBundledAssets` queues `EASYRPG_PICTURE_ASSETS` only when `projectBundledTextureKeys` contains the catalog id. Keys come from `spatialGraphicResourceIds`: every farm-building **level** `graphicResourceId` plus `orientationGraphicResourceIds`, and the same fields on **home decorations**. Unrelated pictures are not queued. SHA256 `ddb6af223e92d6c6cf1d6c897794c92b50895aef162b0d7de488a0344e1d2688` (matches producer REPORT).
- `src/player/eventSpriteResources.ts` — new `resolveSpatialGraphicTexture`. Pictures return `{ texture: catalogId, frame: "__BASE" }`. `resolveEventSpriteTexture` is unchanged and still returns null for `easyrpg-picture-cloud`. SHA256 `7ec273fd3c851e3ef8f8ed914850d576206f16784eb05215e3394162c5ccf72d`.
- `src/player/playScenePlaceables.ts` — `addSpatialSprite` uses `resolveSpatialGraphicTexture`. Buildings and decorations already shared this helper; both pick `orientationGraphicResourceIds[orientation] ?? graphicResourceId`. Placeable rocks/gems still call `resolveEventSpriteTexture`. SHA256 `b07d6177ef14accff0eee7e6ec5e3ff6ca81f48670e947d275cb999b07925b9a`.
- Callers of `resolveEventSpriteTexture` left on the event path: `playSceneMapRuntime.ts`, `playSceneFollowers.ts`, `editSceneEventMarkers.ts`, `playSceneAutonomousRouteEffects.ts`.
- `test/spatialCatalogPictureRender.test.ts` SHA256 `d9f3f524361fe7b1c722b606c7dd4e7f6cb1bc7731391cff14618aecb8973e6e`.
- Wiki: one sentence in `openwiki/runtime-sessions.md`.

Editor default remains `DEFAULT_GRAPHIC = "easyrpg-picture-cloud"` in `databaseFarmSpatialView.ts` for new buildings **and** decorations. Catalog row: `src/assets/easyrpgRtp.ts` id `easyrpg-picture-cloud` → `assets/easyrpg/picture/Cloud.png` (100×100 palette PNG, 1657 bytes). It is the only EasyRPG picture in this tree.

## Task 45

| Criterion | Result | Evidence |
| --- | --- | --- |
| Valid catalog / default Cloud id selected and loaded | Pass | `loadBundledAssets` + producer unit test; independent decoration/level/orientation check `export-decoration.json` |
| Farm buildings **and** decorations, including level/orientation variants | Pass | Source walks both type tables and all levels/facings. Producer test covers building default + one facing. Independent vite-node: decoration default, decoration facing-only Cloud, building **level 2** Cloud; overlay draws Cloud for a live decoration |
| Event charset / texture-key / upload consumers unchanged | Pass | `resolveEventSpriteTexture(project, CLOUD, 0) === null`; rocks still use charset texture keys |
| Unrelated pictures not preloaded into Phaser | Pass | Blank project does not `load.image` Cloud. There is only one RTP picture, so no second picture exists to leak |
| Shipping collection, not only the QA dev server | Pass with limit | `vite.player-qa.config.ts` has `publicDir`; shipping player is `publicDir: false`. `src/player/runtimeAssets.json` has **45** paths and **zero** `easyrpg/picture` entries (matches producer “SDK … +45 assets”). `collectWebExportAssets` resolves catalog ids through `resolveAssetResourceUrl` → `assets/easyrpg/picture/Cloud.png`. Independent run: decoration and level-2 building projects include that zipPath; other picture paths none. Blank projects also include Cloud because `defaultResourceProfiles()` registers every `EASYRPG_RTP_ASSETS` image row (existing catalog-export contract, same comment as facesets in `webExportAssets.ts`). Phaser still does **not** load Cloud unless a spatial graphic field references it |
| Native intended art, not just `__MISSING` counts | Pass | Opened RED and GREEN PNGs as images. RED: four black/green-X tiles. GREEN: white clouds on pink sheets at the same footprints. Phaser `textures.exists("__MISSING")` is true because it is the engine builtin; `missingLike` sprite walks are `[]`. Cloud sprite counts 4 / 3 / 2 match session placements |

### Magenta / pink sheet

Cloud.png palette index 0 is RGB `(255, 103, 139)` = `#FF678B`, 4390/10000 pixels. That is `STANDARD_COLOR_KEYS[1]` in `src/assets/transparentColorKey.ts` (“마젠타(#FF00FF) 와 연보라(#FF678B) 를 항상 키아웃”).

Existing contracts in this codebase:

- Charset/chipset **map** textures: `createTransparentColorKeyCanvas` keys those colors.
- Event **showPicture** HUD: raw `<img src>` via `resolvePictureSource` — no color-key.
- New spatial picture path: Phaser `load.image` of the PNG, no color-key canvas.

The pink rectangles in GREEN shots are the unkeyed RTP sheet, not a compositor hole and not Phaser `__MISSING`. That matches the existing **picture** contract, not the charset overlay contract. This review does not invent a picture color-key policy. Visible art is still Cloud.png; 4→3→2 is readable without treating pixels as Save5/receipt proof.

Pink-key pixel counts in the 1280×960 shots (tolerance 8): GREEN earned 8576, resumed 5136, cumulative 3424 (exact 3× and 2× a 1712-pixel 1×1 sheet). RED earned/resumed: pink 0, near-black 17184, identical SHA256 `1b5ae22ac50cbe7f2527ab6262fcf86113f70d8bb22daba877f2ea0c2a126be3`.

## Task 46

Owned `public-player-green.mjs`:

- After public mutations it still calls product `refreshRuntimeEntities` (event layer only).
- Tile rebuild is a separate `rebuildTiles` that **subscribes `game.events.once("postrender")` first**, then `import("/src/player/playSceneMapRuntime.ts").refreshRuntimeSurfaces`.
- `shot()` also arms `postrender` before `page.screenshot`.
- No `sleep`, input retries, or pixel writes. Native Z uses `performObservedAction`.
- Product `refreshRuntimeEntities` in `playSceneMapRuntime.ts` is still `renderEventLayer` + routes/effects/camera/triggers — no `renderTiles`. Comment still says event-only.

GREEN visual vs session:

| Shot | Cloud sprites | Session |
| --- | --- | --- |
| earned-product | 4 (32×16 home1 + three 16×16) | home1 lv2, home2, cumulative, repeated |
| resumed-unassigned | 3; 32×16 gone | home1 demolished |
| cumulative-recovered | 2; former cumulative cell empty | cumulative type removed |

Opened all three GREEN PNGs. Hashes match `public-lifecycle.json`. `pass=true`, `errors=[]`, `writes=[]`.

## Preserved original failures (truthful)

- Diagnosis RED remains on the **producer disk** at `.omo/evidence/life-full-20260906/model-routing/grok-ui-diagnosis/` (gitignored; **not** in commit `78197cd54`). md5 of `red/earned-product.png` and `red/resumed-unassigned.png` is still `6e3a91570e2494955e7a7d54f2b24fb6`. Opened RED PNG: four `__MISSING` tiles.
- Native GREEN `public-lifecycle.json` records `head: 0e2af2591f33bab3e1f56f1847e499a1cce0681f` because the probe ran on a dirty tree **before** the fix commit. Committed source SHA256s match that dirty tree / this HEAD.
- First producer `npm run build` failed: sparse checkout missing `community-site/package.json`; second build after sparse add exited 0. Not re-run here.
- Root disk at review start was **684MiB** free (later ~369MiB), not ~1GiB. tmpfs ample. Sparse review tree used to avoid ENOSPC.

## What this review did not do

- No product/test/config edits, commits, merges, pushes, or PRs.
- No dependency install. Focused vite-node used producer `node_modules` symlink already present.
- No second native Firefox run (GREEN PNGs + JSON were sufficient).
- No full gates / duplicate nonvisual 242 suite.
- Diagnosis tree was not copied into git (gitignored; left in place on producer).

## Limits

- Decorations were not on the native housing fixture; decoration proof is source + one vite-node, not a second player.html capture.
- Export proof is `collectWebExportAssets` zipPath membership, not a rebuilt `dist/export-player` zip (disk). Runtime inventory of 45 paths was read from `runtimeAssets.json`.
- Pink sheet vs charset color-key is documented, not treated as a task-45/46 blocker.
- `.omo/evidence/*` is gitignored; this report lives on disk in the locked tree for parent archival.

## Cleanup

Owned `/dev/shm/st_01a078fa-ui-review` removed after copying `export-decoration.json`. Producer temp script dir removed. Ports 39931/39932 free. Review worktree left locked. No other resources deleted.
