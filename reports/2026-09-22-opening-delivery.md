# Opening delivery repair and verification

PR #1126; reviewed initial HEAD 074d7bfc1, repaired after integrating main 05c1f14d8.

## Outcomes

- The new-project seed receives the user's title before generating its title card.
- Default opening adoption is creation-only. Actual store load preserves absence and enabled:false.
- Generated pack IDs join canonical resource validation, editor/AI search and URL resolution.
- Catalog regeneration emits a real typed array and safely handles multiline prompts.
- Pack installation validates a pinned archive and every extracted regular file before replacing the previous pack, with lock, cleanup and failure exit status.
- CDN images are downloaded into local ZIP paths; attribution uses export/inline URL mapping.
- Shipped-player CSS explicitly permits the license button; its dialog owns keyboard input.
- Removed incorrect mandatory `generated/opening/*.png` entries. Those pictures are selected through the project's resource usage; SDK build no longer looks for nonexistent public paths.

## Assets and evidence

19 accepted tibo Imagen images, native 1376×768 JPEG, 7,178,097 bytes; archive 7,193,600 bytes.
Archive SHA256: `25fcd864e5243a574a73ce7ef5c75fbc19f31038b95e2fff27ea400dcafe2d0a`.
Release: https://github.com/MovieHolic-Plex/rpg-zzu/releases/tag/stills-v1

Generated 20/32 planned images before provider quota exhaustion. Rejected modern-04
for baked-in English narration after viewing the contact sheet. The catalog and
release contain only 19 accepted files; 13 prompts remain pending. The earlier 18
bundled stills remain. No claim of a thousand-image library is made.

Supabase save and reload receipts:

| Project ID | Save HTTP | Reload |
| --- | --- | --- |
| oprn-opening-winter-1126 | 200 | equal opening + stored hash |
| oprn-opening-ocean-1126 | 201 | equal opening + stored hash |

Local evidence: `verify-shots/opening-examples/{persistence,playback,export-proof}.json`,
`winter.gif`, `ocean.gif`, `winter-export-license.png`, `ocean-export-license.png`.
Capture scripts use the dedicated shipped-player route, never editor play mode.
The real ZIPs contain four used pack images each. The ZIP-only server is mounted at
`/games/<theme>/player.html`, has no fallback assets and blocks the simulated CDN.
All four image scenes and title card played, then map entry completed; attribution
was retrieved below that subdirectory, and Escape closed it without starting play.

## Checks and boundaries

- `npm run typecheck:app`: pass after fixing five inherited type errors in
  protocol.ts, agentPreviewRenderers.ts and dungeonGeneration/expedition.ts.
- Focused Vitest: 163 existing opening/dialog/export/title cases + 5 delivery cases
  + 44 player-manifest cases + 7 pointer-blocker cases passed.
- `node --test test/openingStillPack.test.mjs`: 4/4 (syntax, install/repair,
  incomplete archive preserving old installation, checksum/unsafe/duplicate names).
- `npm run build:player`: Vite + SDK manifest succeed, 68 mandatory runtime assets.
- Local manual archive installation and actual Release download into a separate
  root both verify 19/19. Separate-root command is the installer's normal gh path.
- Runtime examples verify narration, five scene IDs, image HTTP 200 responses,
  map entry, attribution interaction and no page errors. GIF encoding additionally
  checks duration >15s and >100 frames; capture frame directories are cleaned to
  prevent old resolutions causing ffmpeg to emit only a final segment.

Whole CSS/surface gates are not green. The tracked baseline predates substantial
main changes. A separate `git archive origin/main` snapshot reproduces the same
CSS budget (hex 1679, important 616, undefined vars 47), unreachable
`tileset-ai-workspace.css`, and missing `.ee-icon` margin-top. Our initial four new
hex literals were replaced with existing tokens, and new-project- classes were
registered to the components owner. CSS winner differences include intended new
controls, so the global baseline was not blindly rewritten.

The broader surface gate reports stale event-editor face-catalog/picker/choice
snapshots and database render-walk differences. It was recorded as failed, not
reported as passing. No full Vitest suite was claimed. Relevant focused tests and
actual runtime/export behavior were verified separately.

CI originally died at Node's ~2GB default heap. The workflow now explicitly gives
typecheck 6GB and groups push/PR by branch to avoid duplicate runs competing for
the same CI slice. No check is disabled, no baseline lowered.
