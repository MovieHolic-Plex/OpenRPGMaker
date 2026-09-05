# Interior concept bundles and inn inspection

Open `index.html` in a browser. All 55 furniture definitions, the 480-tile atlas,
and the lodging screenshots are embedded in the HTML. Search, filtering, and
image enlargement work without a server.

## Scope

- Route standalone rooms, linked houses, and village interiors through the
  project's authored concept bundles.
- Keep nonrectangular room geometry and complete furniture assemblies intact.
- Build a three-floor inn with distinct guest rooms and linked stairs.
- Correct reviewed tile meanings: jar 235, stone stairs 141/111/171,
  independent descent tile 474, entrance 176, excluded tiles 408/409/410,
  flue 209/239, and the 3x3 stone hearth.
- Expose unlit/lit hearth variants and their descriptions to AI authoring tools.
  Only bottom-center 463 changes to animated fire 124/154/184/214.

## Evidence

| Scenario | Artifact | Observed |
| --- | --- | --- |
| Saved definitions and unchanged inn geometry | `supabase-proof.json` | Supabase save and application reload; no QA map added |
| Real player fire animation | `animation-proof.json` | Four frames in order, cold hearth remains 463 |
| Paid and exact-price lodging | `lodging-proof.json` | 100 to 80G and 20 to 0G; HP/MP restored |
| Insufficient funds and cancellation | `lodging-proof.json` | 19G, 0G, No, and Escape preserve state |
| Report at 1440, 900, and 390px | `browser-proof.json` | All cards and tiles decoded; filters and keyboard zoom pass; no page overflow |
| Tile exclusion and complete assembly matches | `audit.json` | Unknown tiles absent from generated furniture and saved inn maps |

Screenshots named inside the JSON records are embedded in `index.html`; the
full working evidence directories remain under `output/evidence/`.
The remote content project is `rpg-zzu-inn-exploration-v4`. It is separate from
the shared village project because that project's concurrent autosaves replaced
the earlier inn definitions.

Focused test suites, `npm run typecheck:app`, and `npm run build:app` passed
during implementation. The repository-wide gate has pre-existing failures and
previous attempts exceeded the 30-minute execution limit; it is not claimed green.
The PR records the final focused check result separately.

Commit-gate verification: all 18 changed/new test files passed in one single-worker
run (320 tests, exit 0). App typecheck and the post-fix app build also exited 0.
Four additional exterior facade-test failures were reproduced unchanged against
baseline `3ab8ebb5`.

These are authored-definition and behavior checks, not an independent visual
approval of every inherited tile label. The report distinguishes user corrections,
existing definitions, and unknown tiles.

The commit gate additionally found and fixed the linked-house connector overwriting
stone stair cells and adding a second descent instead of connecting the authored
one. The public `author_house` regression test now checks both tile layers, one
descent per upper floor, the entrance marker, passable landings, and a round trip.

A nonblocking review finding remains: rerolling furniture in a connected reception
room can be rejected with `transfer-impassable` because an existing inbound transfer
still points to the earlier furniture layout. The rejected operation preserves the
original project. This PR does not claim that workflow is fixed.

## Regeneration

With the configured Supabase connection:

```sh
npx vite-node --script scripts/inspect-inn.mts
node scripts/qa/inn-lodging.mjs
node scripts/report-inn-inspection.mjs
node scripts/qa/inn-inspection-report.mjs
```

The commands above read the saved project and create local evidence. Remote
writes are separate explicit operations in `scripts/build-explorable-inn.mts`
and `scripts/sync-stone-hearth.mts`; do not invoke their save flags merely to
inspect this PR.
