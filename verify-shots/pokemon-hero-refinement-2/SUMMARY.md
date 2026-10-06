# Hero refinement v14

The single hero has been refined from v12 and saved to the original canonical project. Inspect `media/display-4x.gif`, `media/comparison.png`, `quality/native-contact.png`, and `runtime/walking-down-idle.png` first. Source: `scripts/asset-gen/pokemon-characters/hero.py`. Durable authoring: `/home/main/z-project/pokemon-hero-refinement-2/`.

## What changed

Aligned the two frontal eye rows at x5/x10; the previous lower right pupil was at x9. Connected cap highlights and red shading, shortened the rear hair to reveal the nape, simplified the chin and shirt planes, redrew the backpack as tan/brown leather planes with a lower red pocket, and added red shoe uppers and one-pixel cream soles. Every pixel is authored as Python rows at native 16×32 resolution. No raster art was reduced and no reference pixels were imported.

Actual Emerald and FireRed reference sheets inspected during the preceding revision remain the comparison baseline; sources and hashes are in `../pokemon-hero-reference-revision/reference-inspection.json`. Original Nintendo images and comparison sheets containing them remain outside Git/shared/shipped assets.

## Art review and motion evidence

The frozen rubric and gate implementation are unchanged. Independent same-model agent review: 87. Separate root review: 88. Both satisfy every axis minimum and zero critical failures; the current hash-bound quality gate passed. Separate agent roles do not constitute a decorrelated model or a human judgment. These judgments do not guarantee user acceptance or official-art equivalence.

All twelve poses and the four decoded GIF frames were inspected. Native GIF crops match the atlas exactly; actual browser GIF playback sampled fourteen frames at each of native and 4× display, recognized all three native poses, and recorded no errors. The 4× display GIF preserves native RGB colors exactly. Remaining limitations: simple profile face and arm cloth planes; bright one-pixel soles at enlargement. V13 is an unreviewed draft with no invented score.

Standard native import → preview → review → gate → build and shared registration completed. Native 48×128 maps into editor 72×128 using transparent padding only. All 219 non-hero producer PNGs and 138 other shared PNGs remain byte-identical. Only the hero slot in shared cast1 changed.

## Canonical persistence

Project id: `fca4b134-ed34-4365-9021-450c7ee24894`. Host project: `649482df-81ca-4af9-806b-2613f7d7bebb`.

Canonical folder: `/home/main/.local/share/oprn/web-workspace/.oprn-projects/649482df-81ca-4af9-806b-2613f7d7bebb`.

After the existing host repeatedly disconnected, a temporary official project host opened this same folder on port 18584. Official assets.put/CAS save/backup and a fresh connection load/media comparison proved revision 32, document SHA `56f30909dff986ff42183f0e96a7d882778fb702b34fd4b56aed1c19ed500c45`. Reloaded hero cast SHA `2ab6dc8f85990adb7966243a1cb1c853512029f335c90fb9f67d1274668e190d`. The temporary host was stopped after proof; existing shared hosts were not stopped. No direct SQLite writes, new project, or legacy remote writes.

`canonical-receipt.json` and `preparation-receipt.json` record this. Single-hero preparation verified 64,512 pixels outside the hero slot and every other project field/asset unchanged. Raw project documents remain outside Git.

## Standalone player and delivery

The freshly exported standalone player passed 39/39 focused checks, 8/8 Enter pages, and zero browser errors/failed resource requests. Checks cover four actual input directions, the 0/1/2/1 gait and idle 1, drawn native RGBA pixels, transparent adapter padding, fifteen-color union, camera zoom, opening BGM continuity, reduced motion, and cleanup. The existing QA telemetry places the hero in original authored event-free corridors to isolate gait; this is not full natural campaign completion. Runtime QA never passed through the editor shell.

No engine JS/CSS source changed, so the previously compiled and verified player was reused. All seven JS/CSS files remain byte-identical (`player-artifact-reuse.json`). The exporter checks every retained asset cache SHA against the freshly reloaded canonical project. The entire verified export was copied exactly to the public game directory; see `shipping-receipt.json`. Earlier game and report versions remain archived.

Report: `http://mdc-server:18301/emerald-hero-reference-report.html`.
Play: `http://mdc-server:18301/monster-expedition/player.html?build=hero-refinement-v14`.

Public delivery evidence is recorded separately in `delivery/`: raw HTTP byte identity for project/player/GIF, unmodified public player canvas boot, report layout at 960/320 pixels, loaded GIF images, and working pause/resume. The 39-check runtime suite was run once on the verified export; no duplicate public 39-check claim is made for this revision.

No full gates, Vitest, typecheck, or stash was run. Prior negative controls remain valid because the gate/rubric implementation is unchanged. Stored runtime JSON replaces inline data URLs with hashes and character counts; corresponding relevant PNGs remain.
