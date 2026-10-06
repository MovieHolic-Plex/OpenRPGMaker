# Actual Pokemon chipset comparison and hero correction

Current result: v12 hero applied to the original SQLite project and public standalone player. This fixes one hero; other NPC/trainer/species art was not redrawn or approved.

Inspect first: `media/display-4x.gif`, `quality/native-contact.png`, `runtime/walking-down-idle.png`, `delivery/report-320.png`. Source at `scripts/asset-gen/pokemon-characters/hero.py`; durable working directory `/home/main/z-project/pokemon-hero-reference-revision/`.

## Reference and art judgments

Actual Emerald Brendan/May/professor/woman and FireRed Red/Green/woman walk sheets were inspected outside Git. Reference URLs/file hashes and findings: `reference-inspection.json`. Nintendo-containing comparison sheets/originals remain outside Git/shared/shipped game assets. All shipped pixels were independently drawn as Python rows on the final 16×32 grid; no reference pixels imported or raster art shrunk.

The user's rejection prompted a real reference-grounded reassessment: unchanged v4 historical 85 was withdrawn, now 61/REDO. Frozen rubric SHA 2cf097d80cc9d8f17110fcebd21b7493b7320bc101596126cebd5cff66dcd5ec and 85 threshold/axis minima stayed unchanged. Formal failed candidates: v5=72, v7=71, v8=79, v10=81, v11=83. v6/v9 are unreviewed drafts with no invented scores. V12 received independent 85/root 85, all axis minima and zero critical failures. See rejected/ and quality/; preserve the earlier historical v4 record too. Independent reviewer is a separate same-model agent, not a decorrelated model family or authenticated human. Artistic judgments and hash-bound evidence do not guarantee official-art equivalence or user acceptance.

Main corrections: deeper cap and face rows18..22/shoulder row24 placement; compact connected dressed hips/shoes; dark compact eyes and warm ear/cheek/chin shadows; no hooked profile mouth; tapered continuous rear hair plane; outlined sleeve-hand connection; diagonal profile forearm with visible gray cuff; distinct overlapping idle toe/heel shapes. Residual limitations: simple vest/pack planes, large stylized rear hair and economical profile anatomy.

Current source PNG SHA 83ba4ccc11d62b6c2179e0355cd620bc7eee6f36d44311fd667db111c6774440. GIF SHA b88f1ce94a24e1e3fff18e3865746294796c6a62c5d324a23b2eec2004009caa. All 12 poses and all 4 decoded GIF frames inspected at native/integer enlargement. Exact 16 native/GIF crops, uniform 140 ms, loop 0. Actual HTMLImageElement GIF playback: 14 samples each 1x/4x, 3 distinct native poses, exact decoded pixels, no errors. Explicit indexed palette 4x GIF decode preserves every native RGB pixel.

## Shared and canonical integration

Mandatory current quality gate, native import→preview→review→gate→build and all-role shared registration completed. Native 48×128 source maps to 72×128 editor container using only 4 transparent pixels each side. All 219 other producer PNGs and 138 other shared PNGs remain byte-identical. Only shared cast1 PNG changed; source-preservation.json and shared-preservation.json.

Project id: fca4b134-ed34-4365-9021-450c7ee24894. Host project: 649482df-81ca-4af9-806b-2613f7d7bebb. Canonical folder: `/home/main/.local/share/oprn/web-workspace/.oprn-projects/649482df-81ca-4af9-806b-2613f7d7bebb`. Existing official host currently opens that folder directly; private identity bridgeProject:'' avoids incorrectly scoping it as a workspace. No direct SQLite or legacy remote writes.

Official host assets.put/CAS save/backup and fresh connection open/load/media compare proved revision 31, document SHA 11dba70df8398df812fe2179672e08c523b4da91e44b53574ba9cea23b808c39. Changed asset oprn_emerald_field_cast_1, exact reloaded PNG 7aff1eb12a25580fe96b2fa8c1078137fe2e9525a3c4a662ef9045a3282315db. Single hero preparation compared 64,512 outside hero pixels unchanged and all other project fields/assets equal. Canonical receipt and preparation receipt included; raw 108 MB project documents stay private.

## Actual player and public delivery

Private compiled standalone 39/39 checks, 8/8 Enter pages, 0 errors/failed requests. Public same 18301 server through loopback 39/39 checks, 0 errors/failed requests. Four direction engine input/frame controller checks verify actual 0/1/2/1 gait, idle 1, native RGBA pixels, 15 color union, transparent 24×32 padding and camera zoom. Opening Enter/WASD/BGM continuity, reduced motion and cleanup remain valid. Walking QA uses existing telemetry to teleport onto original event-free authored corridors; no map/collision/speed/pose/state patch. This is gait isolation, not natural full campaign completion. Runtime QA never passes through editor shell.

The artifact reuses the previously compiled, verified player because no engine JS/CSS source changed; seven compiled JS/CSS files are byte-identical. Export derives the game from freshly reloaded canonical and verifies every retained asset cache SHA. Public exact verified copy: 3292 files, shipped project SHA 1a3641104074b7cd5f595944974c900fb5725b5e71ca77c4eb9c51a2bbfe9ac5. Prior public game retained at `/home/main/claude-viz/monster-expedition-before-hero-reference-v12`. Raw HTTP player/project/GIF exact; unmodified mdc-server page boots canvas without errors. Loopback runtime interception follows the documented Chrome address space limitation; browser security was not disabled.

Report: `http://mdc-server:18301/emerald-hero-reference-report.html`. Play: `http://mdc-server:18301/monster-expedition/player.html?build=hero-reference-v12`. Report 960/320 has no horizontal overflow, native 68×32 GIF with 272×128 CSS display, all images load, pause/resume works. Previous reports gain a banner explicitly withdrawing v4's current art approval.

No full gates/vitest/typecheck executed. Gate implementation and frozen rubric unchanged; prior negative control suite retained rather than rerun without a new risk. Committed runtime JSON compacts inline data URLs to hashes; relevant PNG proof remains.
