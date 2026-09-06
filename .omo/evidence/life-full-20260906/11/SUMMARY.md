# Task11 - explicit instance-linked animal housing

Task11 is implemented and scoped verification passes in `/home/main/z-project/rpg-zzu-life-full-housing`, branch `agent/life-full-housing`. This is the engine/schema/save lifecycle increment, not completion of tasks12/13, the all51 life-system goal, or the parent-owned full repository gates.

## Identity and approved scope

- Task: `st_01a07801`; parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Source base HEAD: `966f414c07729e7d9474c568cbaf19a94d2bc740`; base tree: `6ff79d95e11ba95ae47a9db97e106936728088fa`.
- Read the complete canonical plan, AGENTS, quickstart, INDEX, PROJECT_WIKI, runtime routing, focused schema/session/testing material, and Phase3 `VERDICT.md`. No CLAUDE.md was read.
- The verdict's exact reviewed HEAD `bd81a933cbecfeb8b25ef15bf57bc24911011aa8` is an ancestor, actual `git merge-base --is-ancestor` exit0. `source-manifest.json` records the check and all changed source/test/wiki SHA256 values.
- Verified code/tests/wiki staged Git tree before adding evidence: `3ae60b4c128faa3d7494db08bb86a561e9d13640`. The delivering commit is the commit that adds this summary; resolve with `git log -1 --format=%H -- .omo/evidence/life-full-20260906/11/SUMMARY.md`.
- No UI, live player/NPC placement safety, characterProfiles/dailyWeather/skillModel, playSceneGift/Interpreter, WISH.md, dependency/service, remote content, main checkout, push, merge or PR changes. INDEX was regenerated because the assigned schema wiki changed; unrelated content was retained.

## Delivered contracts

1. Project4 optional `animalHousing.allowedSpeciesIds`, explicit per-level `animalCapacity` integer0..9999, and animal `housingPlacementId`. Generic capacity is independent. Shape/normalization/reference boundaries preserve valid fields and refuse malformed/dual/new dangling refs rather than silently erasing them.
2. `src/project/animalHousing.ts` is the canonical derived-home module. `resolveAnimalHome(project, state, animal)` uses actual placement instance/map/x/y/current level. `reconcileLinkedAnimalHousing` handles missing/type-removed/disabled/species-incompatible homes and stable Unicode code-point capacity selection, without automatic relocation.
3. `assignFarmAnimalToHousingPlacement` is the new public runtime assignment entry point. Existing `assignFarmAnimalToBuilding` remains the independent legacy-home entry point. Both preserve progress and daily-care receipts and remove the other reference only on successful explicit reassignment.
4. Move keeps placement ID and payment receipt. Upgrade preserves animals while increasing 2 to5 slots or unassigning a shrinking level's overflow. Demolition retains every animal/progress/product/care cursor, removes only its home link, and keeps non-refundable paid-cost evidence. Unassigned collection works; unassigned care refuses with zero side effects.
5. New building transactions record actual aggregate paid gold/items. Demolition moves its receipt into an unpayable `demolished-no-refund` recovery record atomically; claim-capacity failure refuses the whole demolition. Content incompatibility recovers only proved paid items and retains original placement/payment JSON including gold evidence. **No gold claim/payout schema was added**, and no legacy historical costs are inferred. The approved existing claim schema only pays item quantities; paid gold remains evidence, not an invented item or refund.
6. Save5/new-key/raw-preservation boundaries remain. Parser/writer/direct apply refuse dual refs and invalid receipts. Persistent occupancy is restored before spatial recovery, then linked homes/animals, then remaining life reconciliation and restored-clock processing. Missing explicit housing never falls back to an authored legacy home, including repeated unassigned save/resume. Map deletion clears only affected authored home links. Special animal record keys and non-BMP sorting are covered.

## RED/GREEN and exact validators

All JSON receipts retain the actual command, exit, stdout and stderr; no pipe exit is substituted.

| Receipt | Actual result |
| --- | --- |
| `setup-failure.json` | Initial shell lacked `apply_patch`; test file was not created, so no-test-files exit1. Not behavioral RED. Located the installed native apply_patch executable and retained this failed setup receipt. |
| `legacy.json` | Before product changes, `npm test -- test/linkedAnimalHousing.test.ts`: legacy characterization **1/1**, exit0. Real independent-home assignment/care/production/collection with duplicate-care equality. |
| `red.json` | Same exact command: **1 failed /1 passed**, exit1. Normalization drops `animalHousing` and both `animalCapacity` fields; full expected/received diff retained. Intended regression, not import/type/setup failure. |
| `development.json` | Expanded lifecycle suite **17/17**, exit0 before additional adversarial cases. |
| `green.json` | Final required command `npm test -- test/linkedAnimalHousing.test.ts`: **19/19**, one run, exit0, no skipped tests. |
| `related.json` | Final scoped related selection: **204 passed /13 files**, exit0. Includes animal/schema/spatial transactions/persistence/reference/play integration, recovery, record keys, Save5 and P0 persistence. |
| `related-development.json` | Earlier scoped selection: **159 passed /10 files**, exit0. Historical result, not added to the final count. |
| `diagnostics.json` | TypeScript compiler API syntactic and semantic diagnostics in tsconfig.json context for every changed source/test path: **15 files, 0 diagnostics**, exit0, before build. Initial/development diagnostic receipts also retained. |
| `typecheck.json` | `npm run typecheck:app`, exit0. |
| `build.json` | `npm run build`, exit0: app, player SDK/export and standalone bundle. Raw known warning classes retained: missing optional AI proxy keys, circular reexport, mixed dynamic/static imports, unresolved asset paths, large chunks. No warning suppression or baseline update. |
| `wiki-index.log/.exit`, `wiki-checks.json` | INDEX regeneration, index check, wiki verify, `git diff --check`: exit0. |

The Phase3 verdict's full-gate disposition remains unchanged: whole wrapper timeout124, completed Vitest exit1 with 219 failures and15 pending, separate surface exit1, and its documented attribution limits. This child did not rerun the whole13k suite or claim those failures resolved. No failures occurred in the final scoped selections above.

## Actual public/native lifecycle receipt

Executable: `node .omo/evidence/life-full-20260906/11/public-player.mjs`.
Final raw command log/exit: `native-command.log`, `native-command.exit` (**0**).
Complete before/after session owners, results, good/invalid raw Save5 strings and cleanup: `native/public-lifecycle.json` (**pass:true**).

Authority distinction:

- Real Firefox, dedicated `player.html`, actual exportProjectStoreShim and real PlayScene session, no editor shell. Local minimal engine fixture is supplied through a substituted GET; no action endpoint is mocked and no remote write occurs.
- The test captures the real Phaser Game with a transparent constructor proxy calling `Reflect.construct` unchanged. It records a test-owned handle; it does not substitute the game, scene, actions, inventory or production.
- Build/assignment/care/move/upgrade/demolition/collection use actual imported public modules against that live scene session. These are **public authority calls, not keyboard assignment/authoring UI**. That UI belongs to task13.
- Native Enter starts play. Native Z executes the authored sleep event through the real player input/interpreter/day transition. The exact action and day-completion observers are armed before input and have bounded deadlines; no sleeps/polling/retries are used.
- After the real daily transition, `a` has friendship10, readyProductCount1 and source-day feed/pet/advance receipts. No ready product state was injected. Demolition keeps the product and care state, refuses next-day unassigned care with entire-session equality, and collection grants exactly one `item_ether` while unassigned.
- Native Storage uses real create/saveToSlot/read/apply entry points and the returned restored session is applied to the live scene. Animal state and non-refundable payment evidence roundtrip through namespace `task11-local-proof:save-slot:v5:1`. A raw dual-ref save is rejected without rewriting its bytes or replacing live state. This is **public save/load API exercise**, not native save-menu navigation.

The receipt records 16 public pre-sleep actions (including full, wrong species, collision, insufficient cost and repeated-care refusals with full-session equality), one native sleep action, and demolition/unassigned-care/collection. Two home instances remain independent; home1 upgrades 2-to5, moves to y8 with its ID and paid costs intact. Starting authored gold40 is naturally spent by construction/upgrading to0 for the cost refusal; inventory/ready results are not injected.

The first native harness attempt incorrectly expected `window.Phaser.GAMES`; that export does not exist. `native-harness-failure/`, `.log`, `.exit` retain the exit1 and cleanup. The corrected probe captures the actual constructor-created instance and passed on its first execution. This is a diagnosed harness correction, not a timing retry or fabricated success.

Screenshots: `native/earned-product.png`, `native/resumed-unassigned.png`. The available image read tool reported that this model cannot display images. **No aesthetic/readability/image approval is claimed**; authoritative state/native input evidence is separate.

## Cleanup and handoff

`cleanup.json` and the native receipt record closed context/browser/server, removed owned Vite cache, removed the task-owned `dist` build output, and removed the probe's native save key. Local fixture content was not shipped as an authored demo. Captured proof artifacts remain; no task-owned runtime server/browser/cache is needed for handoff.

Parent integration should consume the new public assignment/resolver APIs for task13 and keep task12's persistent-versus-live occupancy distinction, including the previously documented farming self-plot integration obligation. This task did not edit those surfaces. Independent parent verification and integration remain parent-owned.

## DoneClaim

```json
{
  "taskId": "st_01a07801",
  "taskNumber": 11,
  "status": "done",
  "done": true,
  "branch": "agent/life-full-housing",
  "baseCommit": "966f414c07729e7d9474c568cbaf19a94d2bc740",
  "baseTree": "6ff79d95e11ba95ae47a9db97e106936728088fa",
  "verifiedCodeTestsWikiTree": "3ae60b4c128faa3d7494db08bb86a561e9d13640",
  "commitSubject": "feat(life): link animal housing to farm building instances",
  "implementationCommitLookup": "git log -1 --format=%H -- .omo/evidence/life-full-20260906/11/SUMMARY.md",
  "predecessor": { "verdict": "APPROVE - scoped Phase3", "requiredCorrections": 0, "reviewedHead": "bd81a933cbecfeb8b25ef15bf57bc24911011aa8", "ancestorExit": 0 },
  "legacyCharacterization": { "passed": 1, "exit": 0, "beforeBehaviorChanges": true },
  "red": { "failed": 1, "passed": 1, "exit": 1, "reason": "normalizer erased housing opt-in and level animal capacities" },
  "requiredTests": { "files": 1, "passed": 19, "failed": 0, "skipped": 0, "exit": 0, "singleFinalRun": true },
  "relatedTests": { "files": 13, "passed": 204, "failed": 0, "skipped": 0, "exit": 0 },
  "diagnostics": { "method": "TypeScript compiler API syntactic and semantic", "files": 15, "count": 0, "beforeBuild": true },
  "typecheckExit": 0,
  "buildExit": 0,
  "wikiChecksExit": 0,
  "publicProbeExit": 0,
  "nativeSurface": "Firefox player.html; real scene session; public transaction APIs; native Enter and Z sleep",
  "saveLoadSurface": "native Storage and public Save5 writer/read/apply, not save-menu keyboard navigation",
  "readyStateInjected": false,
  "actionEndpointsMocked": false,
  "fixtureGetSubstituted": true,
  "imageApproval": "unverified - image tool cannot display images",
  "projectVersion": 4,
  "saveVersion": 5,
  "rawPreservation": true,
  "paidEvidence": "actual gold/items receipt; normal demolition unpayable; incompatible recovery proved items only with original gold evidence retained",
  "newSchemaOutsideApprovedHousing": false,
  "fullRepositoryGates": "not rerun; parent-owned existing red/timeout disposition retained",
  "full51coverage": "not completed by task11",
  "task12or13Implemented": false,
  "remoteWrites": 0,
  "pushPrMerge": false,
  "teardown": "complete",
  "independentVerification": "parent-owned"
}
```
