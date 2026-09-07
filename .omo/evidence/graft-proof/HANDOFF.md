# GRAFT-1 / P1 strict graft-image evidence handoff

## Candidate

- Worktree: `/home/main/z-project/rpg-zzu-ai-full-context-graft-proof`
- Branch: `agent/ai-full-context-graft-proof`
- Base adopted: `eaf579bc1593b9bf747863b7e6ca27a34bec1d64`
- Verified repair commit: see `git rev-parse HEAD` on `agent/ai-full-context-graft-proof` (recorded after commit as COMMIT.txt).

- Implementation root (functional integration, do not use for this fix proof): `52894a442` at `/home/main/z-project/rpg-zzu-ai-full-context` — image/graft modules left byte-identical there; lead composes this commit.
- Scope: strict atlas readiness for assistant visual evidence (`toolImageCanvas` /
  `toolImageRenderer` consumers, `tileGraftImageCache`, `tilesetImage` base URL
  split). No `assistantSession` or functional-acceptance edits.
- Defect baseline (unbaked base certified): review-p2
  `.omo/final-eaf-review/graft-observation.json` — same PNG
  `b08965b8d0fd6116f813a8c961e2b8afb3e36f245377785406b7e03d06b813d6` while held,
  `authority: true`.

## Repair summary

1. `awaitGraftedTilesetImageUrl` awaits a complete bake keyed by base URL +
   `count` + `tileSize` + `tilesPerRow` + graft suffix. Incomplete/missing
   sources resolve to `null` (not a partial atlas). In-flight bakes are shared;
   optional `AbortSignal` fails closed without leaving a cached success.
2. `loadTilesetImage` (evidence path) uses `tilesetBaseImageUrl` + await bake.
   Active grafts with no complete bake throw
   `tileset-graft-rendering-unavailable` (propagates through
   `toolImageRenderer`). Ordinary editor `tilesetImageUrl` still falls back to
   the ungrafted sheet while bake is pending.
3. Raster test DOM gained `clearRect` so the existing graft canvas bake can run
   under pngjs. Duck-typed image dimensions avoid `HTMLImageElement` globals in
   node evidence DOM.
4. Regression: `test/toolImageGraftReadiness.test.ts` — held source stays
   pending (no base receipt), release yields a changed PNG and live session
   authority; failed source load stays unapproved; unknown chipset path fails
   closed at the renderer.

## Commands and counts

```sh
npm run typecheck:app
# exit 0

npm test -- test/toolImageGraftReadiness.test.ts \
  test/toolImageEventRender.test.ts \
  test/assistantTilesetVisualReview.test.ts \
  test/mapVisualTilesetDependency.test.ts \
  test/toolImageEventAcceptanceSession.test.ts \
  test/assistantBackgroundReview.test.ts \
  --maxWorkers=2
# 6 files / 26 passed / 0 failed (see focused-related-final.log)
```

Focused graft readiness alone: **4 passed / 0 failed**
(`graft-readiness-vitest.log`).

## PNG / observation proof

| Artifact | Role |
| --- | --- |
| `before-base.png` | Warm ungrafted region (SHA-256 `b08965b8…813d6`, same as defect base) |
| `after-graft.png` | Exact bake after interior tile 100 → target 0 (SHA-256 `27d5a9e7…3dcb61`) |
| `png-export.json` / `png-pixel-inspect.json` | byte + tile-0 pixel diff (1024/1024 tile-0 pixels changed) |
| `held-release-renderer.json` | held → pending; release → different PNG |
| `session-held-release.json` | while held: no reviews / no authority; after release: imageCount≥1, approved, authority true |
| `session-failed-source.json` | load failure → imageCount 0, changes_requested, authority false |
| `source-hashes.txt` | SHA-256 of owned repair sources |

## Source hashes (owned files)

See `source-hashes.txt`. Primary paths:

- `src/assets/tileGraftImageCache.ts`
- `src/ai/toolImageCanvas.ts`
- `src/editor/tilesetImage.ts`
- `src/assets/tileGrafts.ts` (dimension duck-typing only)
- `src/assets/chipsetTransparency.ts` (dimension duck-typing only)
- `test/toolImageGraftReadiness.test.ts`
- `test/toolImageRasterDom.ts` (`clearRect`)
- `openwiki/editor-ai-panel.md` (focused contract note)

## Limitations

- No live DB/user content, provider purchases, cache deletion, push/PR/merge, or
  full gates/build.
- `assistantSession` unchanged; Astra7c4d owns functional integration on newer main.
- Optional bake `AbortSignal` is wired in cache/canvas helpers; the session does
  not yet thread turn abort into `renderImages` (same class of limit as other
  Image loads). Failed/cancelled bakes still admit no receipt.
- `test/tileGrafts.test.ts` serialize round-trip
  (“두 모드 graft…왕복 무손실”) fails on this tree due to unrelated
  `titleGraphic` drop on deserialize — pre-existing vs graft readiness; not
  modified here.
- Browser UI / desktop GUI not used; proof is real renderer + public
  `AssistantSession` + decoded PNG bytes under the existing raster DOM.

## Parent next step

Combine with functional integration; ultrabrain re-review of the immutable
repaired commit (this handoff’s HEAD after commit).

## Follow-up (nonblocking pending + abort)

Committed separately after the initial await-based repair.

- Evidence path **fail-closes immediately** while a complete bake is not ready:
  `loadTilesetImage` peeks `peekGraftedTilesetImageUrl`, schedules via
  `graftedTilesetImageUrl`, and rejects `tileset-graft-rendering-unavailable`
  without awaiting held source I/O. Session turns no longer hang on held grafts.
- Public Session abort regression: held source stays unreleased, turn abort
  settles `stoppedReason: "aborted"` with zero image receipts and no authority;
  completing the bake afterward cannot revive authority
  (`session-held-abort.json`).
- Geometry cache identity regression: changing `tilesPerRow` drops the ready
  peek; a new bake URL is distinct (`geometry-cache-bind.json`).
- Raster fixture now installs `HTMLImageElement` / `HTMLCanvasElement` as the
  pngjs doubles; production `instanceof` dimension helpers restored (no
  duck-typing workaround). Hold/fail gates are typed exports without
  `as unknown as` in the new test code.
- Still no `assistantSession` edits. Optional unused AbortSignal removed from
  the evidence load path.

Commands:

```sh
npm run typecheck:app
npm test -- test/toolImageGraftReadiness.test.ts \
  test/toolImageEventRender.test.ts \
  test/assistantTilesetVisualReview.test.ts \
  test/mapVisualTilesetDependency.test.ts \
  test/toolImageEventAcceptanceSession.test.ts \
  test/assistantBackgroundReview.test.ts \
  --maxWorkers=2
# 6 files / 28 passed
```

