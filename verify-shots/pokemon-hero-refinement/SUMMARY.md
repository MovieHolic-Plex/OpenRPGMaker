# One-hero refinement — native art and hostile GIF gate

## Result

One field hero redrawn directly in Python at16×32. Twelve poses,15colors, binary alpha, no imported raster/resampling/quantization. Fixed frozen rubric:85 total, every axis minimum, zero critical failures. Independent read-only reviewer rejected baseline41 and candidates69/73/77; v4 passed85. Root inspected every pose and decoded GIF plus actual browser capture at1x/4x and scored86. Both verdicts bind exact source PNG/GIF bytes to the current observation package. This does not claim original-game quality or authenticated reviewer identity.

Inspect first: `media/hero-display-4x.gif` (display enlargement only), `media/decoded-gif-contact.png` (all4 actual GIF frames), `public-runtime/walking-down-idle.png`, `iterations/quality-gate-audit.md`.

Remaining nonblocking art limits: square torso/shorts, flat back bag, close navy tones. Other NPCs/portraits were preserved; this is not approval of their existing artistic quality.

## Quality gate

- `quality/quality-gate.json`: independent85/root86, zero critical failures; fixed rubric/source/GIF/code/evidence/review SHA checks.
- `quality-controls.json`:26focused controls;1 genuine acceptance and25 malicious inputs rejected. Fixtures never approve art.
- `producer-controls.json`:3additional rejection cases, including omission of authoring/quality and selecting a different hero; shared catalog bytes unchanged on rejection.
- `display-gif-check.json`: all4 display GIF frames decode to exact nearest4x native RGB/alpha; default adaptive palette conversion was rejected and replaced by explicit indexing in `scripts/qa/runtime/pokemon-hero-display-gif.py`.
- `browser-gif.json`: actual HTMLImageElement GIF,14screenshots at each1x/4x, exact decoded pixel match, all3 distinct poses observed,0browser errors. No canvas substitute animation.
- Native GIF68×32,4frames140ms, [0,1,2,1], loop0,16direction/phase matches, four transparent separator columns.
- Audit found missing gutter checks, overlapping contacts, arbitrary prepared evidence, weak identity-string checks and missing observation declarations. Fixed before shipping. Hashes cannot authenticate watching or prove artistic truth; coordinated fabricated judgments remain outside the gate's guarantees.

## Preservation and actual persistence

`source-preservation.json`:219nonhero source PNGs byte-identical, final v4PNG/GIF bytes equal the independently reviewed draft.
`shared-preservation.json`: all other shared cast assets unchanged.
`preparation-receipt.json`: exact current official host cast1 fetched; only slot0 (72×128 transport) changed;64,512outside pixels match. Every other project field, map/event, asset and session is deeply equal.
`canonical-receipt.json`: projectId fca4b134-ed34-4365-9021-450c7ee24894, existing project folder `/home/main/.local/share/oprn/web-workspace/.oprn-projects/649482df-81ca-4af9-806b-2613f7d7bebb`, officialCAS save revision30 then fresh-connection document/media-byte reload.
Canonical SHA db9910fa16aef5ca87aaaa1d74813d96f5e22afc5f1e1024b35f64a8ae63bd35; changed cast1SHA a55e8127328c4bd44f5ddfdc52f59120685bdc2013718653c2ffa5f43cab3d56. `final-canonical-read.json` independently loads the same revision/SHA after subsequent preparation.
Shared9888 host was auto-restarting and unreachable. An official loopback-only18584 service opened this exact existing project folder; no new project, direct SQLite writes, legacy remote writes or shared9888 restart. Private bridgeProject='' selects direct-folder scope while recording original hostProject identity. Temporary service stopped after final read.
`idempotent-preparation.json`: reapplying the registered current adapter produces identical cast SHA and still preserves every outside field/pixel. No second save needed.

## Actual exported player / public delivery

`runtime/SUMMARY.md`:39actual compiled standalone player checks,8opening pages,0browser/resource errors. Four-direction0/1/2/1 gait, each native pixel preserved inside transparent24×32 adapter, camera zoom preserved, native Enter progression and BGM continuity/WASD behavior, reduced motion and skip cleanup.
`public-runtime/SUMMARY.md`:same39checks pass against the published18301 server using127.0.0.1,0errors and0failed requests. Opening uses native input; walking explicitly teleports QA into authored collision-free corridors and advances engine Input/frames. It is not a natural-route or whole-campaign completion claim.
`public-qa-interception-failure/`: initially intercepting HTML at http://mdc-server produced Chrome local-address-space CORS denial forJS/CSS. `public-unmodified-boot.json` and titlePNG show that actual mdc-server page without interception loads normally. Same public server on trustworthy loopback origin allows the existing QA instrumentation without disabling browser security or replacing runtime/asset code. Initial failed run is retained and is not counted as passing.
`shipping-receipt.json`:all3292copied export files match verified private export; previous published game preserved at `/home/main/claude-viz/monster-expedition-before-hero-quality-v4`. Export project SHA73b3626ff83c0359aaa7fcdb0261f3465b9cd88691a7596ea4279bf749b86988.
`public-receipt.json`: actualHTTP player/project andGIF/contact bytes checked, report960/320px layouts pass, all9images loaded, GIF native68×32 / CSS4x272×128,0errors.

Play: http://mdc-server:18301/monster-expedition/player.html?build=hero-quality-v4
Report: http://mdc-server:18301/emerald-hero-quality-report.html

## Reproduction / limits

Source `scripts/asset-gen/pokemon-characters/hero.py`; gate `src/harnesses/pokemon-character-motion/node/quality_gate.py`; frozen rubric `harness-data/pokemon-character-motion/hero-quality-rubric.json`. Commands and review schema in `openwiki/harnesses/pokemon-character-motion.md`. Durable complete source/candidates/quality/browser selection: `/home/main/z-project/pokemon-hero-refine/`. Committed records preserve original absolute-path references and SHA; relocating artifacts requires a newly prepared observation package and reviewer metadata rebinding. Re-read all source/evidence bytes and make an independent artistic judgment before approving a changed hero.

Player/app and official Electron bridge builds completed; existing Vite chunk-size warnings remain. Focused requested gate controls and browser QA ran. No fullgates/vitest/typecheck/stash, version bump, monster-candidate approval or trainer/NPC redraw occurred.
