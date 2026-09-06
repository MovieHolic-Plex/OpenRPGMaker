# U07 final verified manifest

Base: `4c619edc7dfde3a3c8214fd6b6f19fffd85c52ff`.
Status: **all six owned findings GREEN**, with explicitly authorized uploaded-player resolver
and loader extensions. Full integrated build/gates remain lead-owned and were not run.

## Delivered behavior and ownership

The five original owned editor files now preserve late picker/AI values before reading native
selection, update local selected names/images/cards without remounting focused controls, resolve
initial switch/variable names, retain empty/missing IDs, and associate labels with unique actual
controls. U05 remains authoritative: unresolved individual actors cannot Confirm or become party.

Two additional owners were explicitly authorized only after concrete player RED:
`src/player/playerSpriteResources.ts` accepts valid uploaded charset IDs while preserving bundled
aliases and wrong-kind/missing fallback. `src/assets/bundled.ts` preloads referenced uploaded
charsets via the canonical URL, reuses canonical frame registration, preserves alpha and bundled
color-key/texture ownership. No PlayScene, other runtime, media policy, shared H0, wiki or Design
source was edited. No paid API, remote authored content or extra agents were used.

## Exact validation accounting

| Receipt | Tests / outcomes | Exit |
| --- | --- | --- |
| Original retained RED | 22: 17 failed, 5 passed, 0 skipped | 1 |
| Refreshed RED on base, before production edits | 22: 17 failed, 5 passed, 0 skipped | 1 |
| Initial related GREEN including U05 | 101 passed, 0 failed | 0 |
| New resolver blocker RED | 2: 1 failed, 1 bundled control passed | 1 |
| Strengthened resolver RED | 13: 1 failed, 12 passed | 1 |
| Resolver extension GREEN | 114 passed | 0 |
| Real-loader RED | 4: 3 failed, 1 wrong-kind control passed | 1 |
| Corrected preload-observer toggle RED | 4: 3 failed, 1 passed | 1 |
| Real-loader GREEN with alpha/ownership/repeat controls | 7 passed | 0 |
| Final focused + adjacent command (10 files) | **130 passed, 0 failed, 0 skipped** | **0** |
| Editor real surface | **17 flows, 2 image-generation HTTP calls, 51 viewport/focus records** | **0** |
| Dedicated player real surface | **3 scenarios, 11 H0 beats, 9 viewport records, real walk/idle proof** | **0** |

Original test/fixture constructors, assertions and positive controls are byte-identical;
`original-inputs.sha256` verifies both files and all three retained receipts. `original/` also
contains lossless source copies. No failure was skipped or suppressed in the final suite.

## Finding-to-surface evidence

| Finding | Editor/unit outcome | Actual player outcome |
| --- | --- | --- |
| G2-F9 | Late charset/faceset picker callbacks and AI face IDs survive Confirm/Apply/reopen/codec | Uploaded texture exists under u07-charset-new; idle down25, actual right-walk12 -> idle13 are 24x32. Manual and generated faces appear on battle HUD. Untargeted party actor keeps its real command-established graphic/face. |
| G2-F15 | Battleback A->B->A->B updates native ID/name/image without control replacement | Actual battle backdrop becomes u07-backdrop-new at the troop action boundary. |
| G3-F22 | Late/AI backdrop retains resourceId and value through saving and import | Exact manual/generated parallax override records; intentionally no claim of live parallax rendering before U15. |
| G3-F24 | 026/203/204/207 resource/map/event cards follow A/B; missing actor stays explicit | Selected B removal and recorded vehicle graphic match; spawn/region runtime semantics remain their owners' contracts. |
| G4-F11 | 027/028/029/074/217 initial/current names correct; unrelated x=0 preserved | Chosen variable receives playerX=2; escape-location record is map B/x=0/y=9. No immediate system BGM/SE playback claim. |
| G4-F13 | Six original simultaneous-form association cases pass; real label input/checkbox activation works | Checkpoint record has restoreOnGameOver=false after label activation and real export/import. |

## Portable receipts

- `final-green.json`, `final-green.log.gz`: 130/130, direct exit 0.
- `refresh-red.json/log.gz`, `red.json/log.gz`, `prep-manifest.md`, `original-inputs.sha256`.
- `runtime-blocker-red.json/log.gz`, `runtime-extension-{red,green}.json/log.gz`.
- `loader-red.json/log.gz`, `loader-preload-toggle-red.json/log.gz`, `loader-green.json/log.gz`.
- `editor-attempt8.log.gz`; `surface-utyQuE/editor-{observations,exit,cleanup}.json`.
- `surface-utyQuE/editor-exported.json.gz`, `editor-export.oprn.gz`: the actual downloaded package
  was parsed, compared, imported through the real file chooser, and reopened.
- `player-final.log.gz`; `surface-utyQuE/player-{map,battle,ai-battle}/manifest.json` and SUMMARY.md.gz.
- `surface-utyQuE/player-inputs.json`, `player-observations.json`, `player-*-loaded.json`,
  `player-walk.json`, `player-negative.json`, `player-failures.json` (empty), `player-cleanup.json`.
- `diagnostics.json`, `cleanup.json`, `source-hashes.sha256`, `file-sizes.txt`, and packaging guide.

All AI queue/parser/insertGeneratedPictureAsset/store/profile/onInserted paths execute for real;
only image-generation HTTP is replaced. Selected assets come from actual store registration,
not injected native options. Runtime observations call original Phaser methods unchanged and
read its real texture/frame/session objects; they never fabricate a texture or frame. Walking
subscribes to the exact setFrame transition before keydown/keyup, with a bounded deadline.

## Attempt accounting and limitations

All failed attempts remain receipts, not claimed GREEN. The loader's first preload observation
wrapped LoaderPlugin.image, which Phaser installs per instance; it was corrected to the actual
addFile boundary and the preload fix was toggled off to capture genuine refreshed RED. The
registration/alpha RED was genuine throughout. A later setup-only attempt hit an SSR-transformed
dynamic import; Vitest marked seven cases skipped because beforeAll failed. That attempt is
preserved, the browser import boundary was corrected, and the final run has zero skipped tests.
Earlier editor/runner and troop-action/canvas-locator corrections are recorded in historical
BLOCKER.md and attempt logs; no original assertion/input was changed to accommodate them.

Read explicitly omitted image attachments. Screenshots exist locally but **no pixel approval**
is claimed. Geometry, focus, actual image URLs, loaded textures, pixel alpha and frame values
were verified mechanically. The editor is desktop-only at the requested 1024/1280/1440 widths.

Architectural review: new helpers have concrete multiple callers, no new production type escapes,
no new error swallowing/logging or >3-parameter API. Trusted project data stays typed; canonical
URL validation remains at the asset boundary. No form remount, first-record fallback, schema
change, arbitrary-image admission or speculative loader fallback was added. Pre-existing source
monoliths and the unchanged 258-LOC retained test are documented in file-sizes.txt rather than
refactored outside this focused task. New support files remain below 250 pure LOC.

Cleanup closes owned contexts/servers, removes temporary fixtures/caches and leaves only scoped
source/tests plus deliberately selected evidence. Raw logs remain unchanged and are staged only
as lossless gzip copies. No screenshots, videos or credentials are committed. The concise wiki
amendment is supplied as evidence for the lead's shared wiki lock.

The initial staged diff check caught trailing blank lines in four native failed-player summaries.
All native SUMMARY.md receipts were preserved losslessly as SUMMARY.md.gz rather than edited;
the corrected staged check passes. Working-tree raw summaries remain available locally.
