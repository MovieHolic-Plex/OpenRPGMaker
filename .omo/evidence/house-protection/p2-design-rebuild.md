# Existing-map design rebuild regression

- Task: st_01a074ab
- Base: 60e8b49fca89d57ca07e789a9a5a8c9b578ce86c
- Worktree: /home/main/z-project/rpg-zzu-house-protection-p2-design-rebuild
- Date: 2026-09-06

## Reproduction and cause

The unchanged `villageDesign.test.ts` existing-map test failed before production
edits with `ToolError: Village structural QA failed.`, code `village-qa-failed`,
map `map_village_7_50x50`. The direct facade reproduction retained the full
error/stack and real builder metrics in `.omo/design-rebuild-probe-red.json`.

The exact fixture uses the default design-test preset, four amber-wood houses,
no edge trees or interiors, one story, 50x50 and seed 7, then revision 2 and
`author_village` on the existing map with `fullMap:true`, `countPolicy:exact`.

| Metric | First build | Rebuild RED | Rebuild GREEN |
| --- | --- | --- | --- |
| Newly built houses | 4 | 4 | 4 |
| Doors connected / intact | 4 / 4 | 4 / 4 | 4 / 4 |
| External road components | 1 | 1 | 1 |
| Ridge invaded | 0 | 1 | 0 |
| Reachability critique | pass | pass | pass |
| Previously completed houses preserved | n/a | yes | yes |

The new `village_house_7` inherited lower road 393 at (19,38), under upper roof
cap 354. Its wing gaps also retained old road values 395/423/453 at (19,44..46).
These values were present before rebuilding and unchanged afterward. This was
not a road-component problem: the stamper leaves transparent caps and wing gaps
untouched, and early completion sealed the inherited streets before road work.

## Fix and controls

Seven added production lines in `village/houses.ts` clear remaining lower road
tiles across only a newly built house's bbox plus ridge. Cleanup runs only after
successful real stamping and door validation, before house completion/sealing.
Candidate exclusion still protects old houses and human stamps. No audit, count,
connectivity, Phase 1 guard, metadata deletion or full-map bypass changed.

The new public-runner test proves revision 2 acceptance, four old plus four new
houses, retained old metadata, accepted road-valued human edits and layer stacks,
and exact completion snapshots after serialize/deserialize. Controls reject a
real disconnected external island and old-house damage atomically.

Supervisor review caught premature cleanup on rejected candidates. A real
invalid-wing-width test, without runner rollback or fake stamp results, failed
RED with streets changed to grass. Moving cleanup after stamp success made it
GREEN; the whole rejected-candidate map is unchanged.

## Verification

- RED original: `.omo/design-rebuild-red-existing.log` (one expected failure).
- RED public regression: `.omo/design-rebuild-red-new.log` (one failure, two controls pass).
- RED failed candidate: `.omo/design-rebuild-red-failed-candidate.log`.
- Final GREEN: `.omo/design-rebuild-green-final.log`, exit 0, **105 tests / 7 files**.
- Command: `npm test -- test/villageDesign.test.ts test/villageDesignRebuild.test.ts test/houseProtectionLifecycle.test.ts test/villageOwnedRoadClassification.test.ts test/villageHouseSigns.test.ts test/villageHouseProtection.test.ts test/houseProtection.test.ts --maxWorkers=2 --minWorkers=1`.
- Final TypeScript LSP: no diagnostics in the changed production and test files.
  Markdown LSP is unavailable; wiki was reviewed directly.
- Final `npm run typecheck:app`: exit 0 (`.omo/design-rebuild-typecheck-final.log`).
- Final `npm run build:app`: exit 0 (`.omo/design-rebuild-build-final.log`).
  Vite reports large chunks; these warnings are not silenced.
- Full `npm run build` also exited 0 before the final cleanup-order correction.
  That full build reported unresolved runtime asset references as well as large chunks.
- Final executable reproduction: `node_modules/.bin/vite-node .omo/design-rebuild-probe.mts`,
  exit 0; `.omo/design-rebuild-probe.json` has no error, unchanged old houses,
  no inherited roads in new houses, and structural QA passing.
- `git diff --check`: clean; the original regression test is unchanged.

Two broader related runs passed all 140 assertions but exited 1 with Vitest
`[vitest-worker]: Timeout calling "onTaskUpdate"`; these are not claimed GREEN.
They included the long-running facade suite. The final required focused run
above has no unhandled errors. An early full-gates attempt exceeded the 600-second
execution limit and produced no report; it is not claimed verified. Per supervisor
steering, full repository gates belong to the parent and were not relaunched.
The supplied immutable baseline report contains 169 failing tests and no design
failure; the supplied Phase 2 candidate report contains 162 failures including
the exact design regression. Unrelated baseline failures were not changed.

This is engine code plus minimum test fixtures, not authored remote game content.
No Supabase write, push, PR or merge was performed.
