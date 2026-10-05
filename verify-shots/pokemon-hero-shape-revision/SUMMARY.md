# Full native hero silhouette and gait rewrite

The v14 hero was rejected by the user. Its historical 87/88 records remain preserved but do not establish user acceptance or a usable art baseline. The current v18 is a new native pose construction, saved into the original project and shipped in the standalone player.

Inspect first: `media/display-4x.gif`, `media/comparison.png`, `quality/native-contact.png`, `runtime/walking-down-idle.png`, and `delivery/report-320.png`. Source: `scripts/asset-gen/pokemon-characters/hero.py`. Durable workspace: `/home/main/z-project/pokemon-hero-shape-revision/`.

## Why the preceding approval was insufficient

A reference-grounded independent critique found v14's thirteen head rows over an eight-row lower body, narrow shoulders, exposed profile neck, undersized shoe contacts, and profile phases dominated by whole-body bobbing and disappearing toe pixels. The current user rejection takes precedence over the earlier recorded PASS. Those records have not been silently rewritten or used to relax the rubric.

Actual Emerald and FireRed source sheets were inspected outside Git/shared/game assets; sources/hashes remain in `../pokemon-hero-reference-revision/reference-inspection.json`. Only our own original pixels appear in the committed old/new comparison. Native final-resolution row grids are independently authored; no reference pixels imported, no image tracing, no generated raster reduction.

## Current pose construction and judgments

The hero's complete native head/face/collar/torso/hip/leg/shoe clusters were rewritten with explicit x coordinates and row strings. Each arm and lower-body phase is separately authored, as are both profile views. No implicit row centering or generated arm line remains. The ten-row head and fuller connected dressed torso have shorter neck/chin transitions, dark substantial shoes, a larger curved side bag with a pocket, and connected vest/shirt planes.

A side step now traces the near leg from its hip through the bent knee to forward planted contact x10..13/y31, then backward planted contact x3..6/y31; the opposite shoe ends y30. Arms oppose the leg phase. Front/back hip row27 and upper leg row28 also change, so movement is not limited to toe pixels. The head remains fixed rather than translating the whole body. Coordinates are observations of this hero, not new automatic artistic thresholds.

Rejected current-turn candidates: v15 provisional 68 with CF3 (same planted profile foot), v17 80 with no confirmed CF but incomplete hip motion, striped side bag and stepped collar. V16 is an unreviewed draft with no fabricated score. Their actual art and findings are retained under `rejected/` and `draft-v16/`.

V18 received independent 85/root 85 under the unchanged frozen rubric, all axis minima and zero confirmed critical failures. The independent review had one metadata field corrected from report writer to actual artist root; scores and observations were not changed. Formal current-byte quality gate passed. Independent reviewer is another native-model agent: an attempted alternate provider failed before task delivery, so no cross-model review is claimed. Artistic judgments do not guarantee user satisfaction or official-art equivalence. Residual limitations: geometric face/cloth treatment, close dark shades, restrained fixed-height gait.

All twelve poses and all four decoded 140ms GIF frames were inspected. Sixteen native/GIF crops match exactly. Actual HTML image playback samples fourteen captures at both native and 4× display and observes all three poses without errors or pixel changes. The display GIF also preserves all native RGB pixels. Standard native import → preview → review → gate → build and shared registration completed. Native 16×32 fits the editor 24×32 container through transparent padding only. All 219 other producer PNGs and 138 other shared PNGs are identical; only cast1 and hero artifact PNGs changed.

## Canonical store proof

Project id: `fca4b134-ed34-4365-9021-450c7ee24894`. Host project: `649482df-81ca-4af9-806b-2613f7d7bebb`.
Canonical folder: `/home/main/.local/share/oprn/web-workspace/.oprn-projects/649482df-81ca-4af9-806b-2613f7d7bebb`.

An owned temporary official host opened this same folder on port18584. Official assets.put/CAS save/backup followed by a fresh connection open/load/media comparison proved revision33, document SHA `136e7fedd09380e7bc346060d01e0c4afd78bbd40f1fbc37130da8075b60b13d`, changed asset `oprn_emerald_field_cast_1` with reloaded PNG SHA `e9c9dc0f61d04f71e9cfe685b70f6db9812782bac3c1b779e8449ffe2bd15941`. Only the owned temporary host was stopped afterwards. No direct SQLite writes, new project, or legacy remote write. `canonical-receipt.json` and `preparation-receipt.json` retain the evidence. Preparation proved 64,512 outside hero pixels and every other project field/asset unchanged. Large raw project documents remain private.

## Standalone play and public delivery

The fresh export passed 39/39 actual standalone-player checks, 8/8 Enter pages, and zero errors/failed resource requests. Checks include the actual four-direction input and frame controller, 0/1/2/1 gait, idle1, exact native drawing, fifteen-color union, transparent adapter padding, camera zoom, opening BGM continuity, Enter repeat behavior, reduced motion and cleanup. Existing private QA telemetry moves the character into original authored event-free corridors to isolate walking; this is not a natural full-campaign completion claim. Runtime QA never used the editor shell.

No engine JS/CSS source changed. The previous verified compiled engine was reused, with seven JS/CSS files checked byte-identical. Export verifies retained portable media against freshly loaded canonical asset hashes. The entire export was copied exactly to the public directory (`shipping-receipt.json`). Separate public delivery checks verify raw HTTP project/player/GIF bytes, an unmodified public canvas boot, loaded images, 960/320px report layouts without overflow, and GIF pause/resume. Only one 39-check runtime run was performed on this verified export; no duplicate public39 claim.

Comparison: `http://mdc-server:18301/emerald-hero-reference-report.html`.
Play: `http://mdc-server:18301/monster-expedition/player.html?build=hero-shape-v18`.
The previous v14 report/media and game remain separately archived.

No full gates, Vitest, typecheck or stash ran. Existing negative controls were not repeated because the frozen rubric and gate code are unchanged. Inline data URLs in committed runtime JSON are replaced with hashes and character counts; relevant screen images remain.
