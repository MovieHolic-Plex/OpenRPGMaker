# Thirty distinct house exteriors — 2026-09-12

Created by exactly three `gpt-6-astra` agents at `xhigh`, ten houses each. These are
new reusable exterior objects assembled from the project's wall and roof tiles.
Visible floor counts do not imply authored interiors or navigation events.

| Group | Scope | Agent commit | Isolated LegacyDb project |
|---|---|---|---|
| 01–10 | Small and single-storey houses | `bd6a4496c3f0a5186a19559a209a2b4a74f71671` | `rpg-zzu-house-30-a-20260912` |
| 11–20 | Two-storey houses | `3ad5ab794ce45d9784821d85fcaf83fdc5ef36da` | `rpg-zzu-house-30-b-20260912` |
| 21–30 | Large houses, courtyards, two to four storeys | `595df8323` | `rpg-zzu-house-30-c-20260912` |

Worktrees, development ports (19851/19852/19853), Vite caches and DB projects were
isolated. Each workspace was created through insert-only canonical publication and
reloaded before authoring; each agent also saved/reloaded its ten finished objects.
The supervisor integrated only their recipe/review commits and published the combined
catalog serially to **`rpg-zzu-house-template-gallery`**. No credentials are included.

## Result

- 30 new objects, searchable with `집 형태 30종 20260912`.
- Three gallery maps: `map_house_30_a_20260912`, `map_house_30_b_20260912`,
  `map_house_30_c_20260912`. Existing maps and start position remain intact.
- Existing designs, kits, built occurrences and the legacy-import receipt were compared
  independently after publication and remain unchanged (`preservation-proof.json`).
- `legacy-db-proof.json`: successful canonical save, mirror synced, full-project
  deep-equal reload and a SHA256 of the saved library. Per-agent receipts are also included.
- `houses-30.png`: overview; `houses-a.png` / `houses-b.png` / `houses-c.png`: group boards.
  `index.html`: standalone gallery with group filters and click-to-enlarge. All pixels
  come from the actual editor `mapTileDraw` using the LegacyDb-reloaded project.
  Group boards retain one-times tile scale; overview cards fit the available space.

## Validation

- Supervisor's `test/house30Authoring.test.ts`: **5/5 passed**. Checks the real thirty
  recipes and rejects forbidden chips, a severed roof, a blocked courtyard approach,
  and a material-only duplicate.
- Supervisor reran `review-house30-b.mts`: ten houses, eleven upper facades, two-cell
  side slopes, eave/corner preservation; **30 damaged controls rejected**.
- Supervisor reran `review-house30-c.mts`: all upper facades, eave corners and two-cell
  side slopes preserved; **20 damaged controls rejected**.
- B visual corrections: narrow wall sliver, upper-window spacing, extended front
  silhouette and opaque backing beneath transparent roof corners. C visual corrections:
  narrow front fragment and two courtyard layouts that were too similar.
- Cross-review of the final combined render and reloaded maps found thirty unique
  silhouettes and material-normalized geometries, thirty connected roofs, thirty-seven
  door approaches reaching the exterior, and zero forbidden chips.
- Saved-object AI tool check: **30/30 preview + apply passed**, resulting raster cells
  match every original kit. `tool-build-proof.json` records the registered tool route;
  this is not a live LLM-provider conversation.
- Gallery browser check: 30 cards, group filters, enlarged image dialog, zero page errors.
- Supervisor ran `npm run gates -- --only typecheck` in all three worktrees: pass,
  no baseline regression. OpenWiki verification and diff whitespace checks: pass.

Full supervisor `npm run gates` was **not green**: app typecheck and CSS passed,
Vitest reported 516 failures / 23,041 passes across 166 failing files, and surface
snapshots still failed. The new house suite passed all five tests in that full run.
The 45 failing-file additions against the older tracked baseline were identical to
the preceding run. Failure counts vary; this comparison does not prove every
unrelated failure is pre-existing. See `gates-proof.json`.

The six excluded chips remain 196, 197, 226, 227, 256, 257. No balcony mansion was
added. This slice supplies exterior objects; the earlier connected 3/4-floor examples
are preserved separately and have their own runtime evidence.

## Reproduction

Set the existing LegacyDb connection and project id in `.env.local`; never put keys
in the command line or committed evidence. These commands run from the repository:

```sh
npx tsx scripts/publish-house30.mts --batch all             # read-only preview
npx tsx scripts/publish-house30.mts --batch all --apply     # authorized CAS save + reload
node scripts/capture-house30.mjs --batch all --base http://127.0.0.1:19841
npx tsx scripts/verify-house30-builds.mts
npm test -- test/house30Authoring.test.ts
npx tsx scripts/review-house30-b.mts
npx tsx scripts/review-house30-c.mts
```

The publisher loads current authority and refuses a mismatched target. Repeated
registration preserves revisions. All raster assembly precedes the sealed tool
proposal; no direct mutation is inserted between its upsert calls.
