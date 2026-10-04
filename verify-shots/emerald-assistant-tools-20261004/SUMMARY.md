# Emerald assistant production slice — 2026-10-04

## Actual evidence

Isolated source: `/home/main/z-project/rpg-zzu-tileset-harness-emerald-assistant-20261004`.

- `npm run build:app`: exit0, 1m3s after lazy factory loading. Main chunk10,848kB;
  generator/art moved to a separate11,513kB chunk. Earlier static factory import
  produced22,361kB main. Existing CSS/circular chunk/dynamic import warnings remain.
- `node_modules/.bin/vite-node --script scripts/qa/emerald-monster-authoring.mts`:
  exit0. Actual registered Pi tool shape/async prepare generated72maps,60species,
  8badges,12objectives,9shops. Branch-inclusive command inventory contains279
  transfers and94battleProcessing commands (not distinct authored route/trainer count).
- Final actual structure/resource review: no issues. All front/back art, types,
  skills/PP/evolution/ecology and authored references checked.480×320/camera2.
- Unprepared synchronous creation refused with `monster-builder-not-prepared`;
  Pi tool uses exclusive scheduling and native prepare/admission path.
- Recreating an authored campaign without replace:true refused. Repair preserved
  exact session, authored start and map lower/upper raster values.
- Production inspector rejected settings-only/no-final-review states. The actual
  client rejected remaining monster campaign and game-system receipt issues.
- Ordinary Korean creation route selected single whole-game production tools;
  user read-only remained read-only. English polite Pokemon request recognized;
  explicit Pokemon Black request did not acquire the default Emerald route.
- `git diff --check`: exit0.

Raw local logs: `output/emerald-assistant-20261004/final-probe.log` and `build.log`.
They contain no canonical project bytes or credentials and are local build artifacts.
The reproducible focused probe is checked in under scripts/qa.

## Supervisor handoff

Use the ordinary request `포켓몬 같은 게임 만들어` or
`Make a Pokemon-like game` from a real blank canonical project. Routing itself
requires no `/pi` or explicit opening phrase. The same worker production contract
activates from the ordinary text and registered build receipt.

Expected actual sequence: read_monster_game/read_game_systems →
configure_monster_style(reference:emerald) → build_monster_game(mode:create) →
show_opening_image for each connected actual image → final read_monster_game,
review_monster_game, review_game_systems and review_opening. An existing campaign
uses mode:repair; explicit opening replacement uses replaceOpening:true.

The in-app model is instructed to report reuse of the original campaign honestly.
The production receipt always keeps playbackVerified:false. This probe is offline:
no real model request, browser gameplay/visual QA, perceptual art or music rating,
normal-difficulty all-campaign clear, SQLite write/reload or published export was
performed by this slice. Root owns those integration proofs. No gates, Vitest,
full typecheck, stash or LegacyDb write was executed.
