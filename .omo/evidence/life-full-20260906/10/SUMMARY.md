# Task10 - real fishing and generated-forage confirmation

Status: scoped implementation complete; parent verification/integration remains separate.

## Source identity and scope

- Worktree: `/home/main/z-project/rpg-zzu-life-full-field-input`
- Branch: `agent/life-full-field-input`
- Confirmed base HEAD: `fb0588d9383f2b3c85a421bfe706a56e8c40742b`
- Handoff was read before editing and matched task10/status confirmed/worktree/branch/base. Required task8 `98b099f8d73a3d36be96fef17746f48fe5f027fe` and task9 `27db0af0021fb49414723b64141a0e1c568b8069` are actual ancestors; both committed VERIFY files say confirmed with zero mandatory corrections. `handoff.json` and `source.json` retain exact identity and VERIFY hashes.
- `source.json` records SHA256 and Git blob IDs of all nine source/test files. Its seven production hashes match the final native-player run. The implementation and this SUMMARY ship together in this commit; the parent can identify the commit through this file's Git history.
- Read AGENTS, quickstart, INDEX, PROJECT_WIKI, focused runtime/testing/session contracts, the approved plan and TypeScript programming guidance. No CLAUDE.md was used.

## Implemented behavior

At each coordinate, confirmation now checks event -> chest -> explicit generated forage -> authored fishing region -> farm, preserving front -> feet order. A shared, small `lifeFieldInteraction.ts` result helper distinguishes unhandled, success and explicit refusal. Both real `handleAction` and the scene runner call it. Refusals consume confirmation, report through the existing transient feedback channel, and cannot fall through to an underfoot harvest/event or action-combat swing. Farming's existing ignored/not-a-target fallback is unchanged.

Fishing catches validate map bounds and authorize authored fish rules through the unchanged `resolveToolUseOnTile`; absent fish rules require no new tool type. They continue to commit RNG, reward, collection, energy and enabled XP atomically. Species, tool, energy, inventory and invalid-location failures retain owners/RNG.

Forage collection and drawing share a pure live-date/location/definition check. Expired, season-old, future-dated, invalid-coordinate and missing-definition objects cannot pay out. Generated pickups use the existing bundled Object2 gem marker: the authored ForageEntryDefinition has no graphic field, so no new artwork/schema contract was invented. Missing definitions retain a fallback marker and flow through the existing missing-resource warning surface. The narrowly required renderer helper call in `playSceneMapRuntime.ts` restores forage warnings after event-only refresh clears the shared set. Successful pickup refreshes the existing tile/HUD paths and removes the marker.

The runner now uses `farmIntentForHand` like the real input path, as well as the shared life helper and chest lookup. Its chest handling records consumption; it does not simulate UI deposit/withdraw success. The chest parity test seeds an actual runtime chest through `ensureChest` at the session boundary (authored start state does not initialize chests).

Unchanged verified authorities are hashed in `source.json`: farming/regrowth, toolActions, dayTransition, makers, saveSlots and session. No Save5/Project4, recovery, explicit-XP, clock, authoring or sibling-system changes were made. `test/p2LifeRuntime.test.ts` sets the live date before collecting date-generated forage; its two readonly fixture assignments were made type-correct without changing assertions.

## Verification results

All heavy commands ran from the assigned worktree under:

`flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`

Each focused test/diagnostic/typecheck/player command used `timeout 300s`; build used `timeout 600s`. No timing retries, deadline increases, skipped tests, baseline updates or new dependencies.

| Evidence | Actual result |
| --- | --- |
| `red.txt.gz`, `red.exit` | Before production edits: 22 failed / 2 passed; exit1. Missing real input, expiry/bounds and rendering failures observed. |
| `green-initial.txt.gz` | Initial implementation: 24/24 passed; exit0. |
| `focused-final.txt.gz`, `.exit` | `npm test -- test/lifeFieldInteraction.test.ts`: 27/27 passed in one final run; exit0. |
| `related-final.txt.gz`, `.exit` | 17 files, 267 tests: 265 passed / 2 inherited failures; exit1. No task10 failures. |
| `diagnostics-verified.txt.gz`, `.exit` | TypeScript compiler API syntactic + semantic diagnostics on all nine changed source/test files: zero diagnostics; exit0, before typecheck/build. |
| `typecheck.txt.gz`, `.exit` | `npm run typecheck:app`: exit0. |
| `build.txt.gz`, `.exit` | `npm run build`: app, exported player and standalone bundles completed; exit0. Raw unresolved starter-image and large-chunk warnings retained, not suppressed. |
| `player-final.txt.gz`, `.exit`, `player-final/player.json` | Dedicated native Firefox player, five real Z inputs across three scenarios; exit0; zero page errors, failed requests or remote writes. |
| `player-final/pixels.json` | Exact native PNG comparison: 3,408 changed pixels, confined to x128..191/y188..259, the pickup-marker region. Exit0. |

The exact broader selection was:

```sh
npm test -- test/lifeFieldInteraction.test.ts test/p2LifeRuntime.test.ts test/p2HostileAudit.test.ts test/seasonalForage.test.ts test/lifeSkillDisabledHarvest.test.ts test/toolActionAuthoringParity.test.ts test/p0ToolCapability.test.ts test/farmingRuntime.test.ts test/cropRegrowthContract.test.ts test/playSceneFarmFeedback.test.ts test/playScenePlaceableOverlay.test.ts test/p2SpatialPlayIntegration.test.ts test/lifeQaObservability.test.ts test/actionDebounceFootprint.test.ts test/npcActionFacing.test.ts test/sceneTestRunner.test.ts test/makerClockIntegration.test.ts
```

The two inherited failures are the two `__oprnDebug` snapshot tests in `actionDebounceFootprint.test.ts`: `TypeError: Cannot read properties of undefined (reading 'registry')` at `syncCutsceneHudVisibility`. The test fixture omits `scene.game`. `inherited-failures.json` proves the test file and failing function are unchanged from the confirmed base and preserves both matching failures from the committed Phase2 triage evidence. They were retained in the final broader run, not skipped or fixed outside scope. Full-project gates and the full51 journey are not claimed here.

Other original failures remain intact: initial diagnostics exposed new fixture typing errors and two pre-existing readonly assignments in the changed P2 test; all were corrected. `green.txt.gz` records an additional new-test fixture failure from incorrectly assuming authored `session.chests` would initialize runtime chests, then `related-final.txt.gz` proves its actual runtime-boundary correction. `diagnostics-initial.txt.gz` and `diagnostics-final.txt.gz` preserve the failed diagnostic attempts.

Raw output is gzip-compressed byte-for-byte (`raw-logs.json` records original names, sizes and SHA256). Use `gzip -dc <file>.txt.gz`. The first staged whitespace check correctly flagged whitespace in raw tool output; `raw-whitespace.txt.gz`/`.exit` retain that failure. Log compression preserves every byte instead of editing errors/warnings.

## Native player evidence

Runner: `node .omo/evidence/life-full-20260906/10/player.mjs` (final output in `player-final/`). It uses `startPlayerQaServer` at provisioned port35433, `player.html`, the shipping `exportProjectStoreShim`, native Firefox keyboard input and `performObservedAction` prearmed `oprn:action` subscriptions. No editor-play entry, runtime success-state injection, direct catch/collect call or remote content writes were used. The existing local engine-test fixture is copied in memory; final fixture digests and exact source hashes are in JSON.

1. Catch: Z grants exactly one trout and spends energy3 -> 0. A second Z consumes an energy refusal with the entire readable state (excluding only the action receipt) and RNG unchanged.
2. Authored-tool refusal: Z consumes the missing tool refusal; inventory, energy and RNG remain unchanged.
3. Date forage: Z triggers the real underfoot authored sleep event. A prearmed DOM/state signal waits for day2, an authored switch set after sleep/fade completion, and `running=false`. A second Z collects the generated front pickup, berry0 -> 1, with RNG unchanged. Initial state contained no reward items or generated forage. The before/after marker screenshots are pixel-compared.

All scenarios enable actual action combat. Post-action combat snapshots show zero swing cooldown and full stamina, and the durable audio receipt contains no `easyrpg-sound-attack1` after any input. Event/chest/forage/fishing overlaps, front/feet, malformed bounds, expiry and failure-owner preservation are covered by the 27-test real-input suite.

Immediate captures:

- `player-final/fish-caught.png`
- `player-final/catch-energy-refusal.png`
- `player-final/authored-tool-refusal.png`
- `player-final/forage-generated.png`
- `player-final/forage-picked.png`

The first native run's root-level PNG/JSON receipts are also retained. Its gameplay assertions passed, but its day2 observation could capture before fade completion; the final probe adds the exact post-sleep command signal rather than a sleep/polling delay. Final screenshots have a localized marker-only difference. This model could not decode image attachments; no human/visual-model aesthetic inspection is claimed. Native rendering is evidenced by real screenshots, exact PNG pixel comparison and actual renderer regression tests.

## Documentation, cleanup and integration boundary

`WIKI-PROPOSAL.md` contains exact focused runtime-sessions/testing replacements for the parent's serialized wiki update. Shared wiki/INDEX were not edited.

`cleanup.json` confirms all dedicated contexts/browser/server were closed, port35433 is closed, both owned player caches are absent, and the exclusively task-created dist directory was removed after successful build. The pre-existing `.vite-cache` and all shared caches were preserved. Only source/tests and retained evidence remain. No worktree creation, push, PR, merge, amend or remote persistence was performed.

All owned changes and retained evidence are committed together. Parent verification/integration is the prerequisite for the next node; this report does not grant that approval.
