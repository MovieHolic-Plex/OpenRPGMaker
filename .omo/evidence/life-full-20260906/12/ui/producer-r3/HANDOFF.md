# Task12 UI producer-r3 handoff (frozen uncommitted)

This is one serial shared-unit handoff, not final Task12 approval and not a whole-goal verdict. Source stays uncommitted on `agent/life-full-p4` at HEAD `ea6b2b358088cb6061783f6ffd162169764a07e9`. Product UI bytes are the preserved attempt2 implementation. Task52 normalizer/test bytes are accepted frozen core inputs. Astra owns combined CLI/docs/commit of this same dirty set next.

Attempt1, producer-r2/build-r2/verify-r2, and Task52 producer/verify evidence were not rewritten.

## Outcome

UI production files were not redesigned. The eight r2 UI sources plus three r2 UI tests keep their r2 SHA-256 values. This node added one new test file for rendered-body replay RED, reloaded a **new** isolated QA project through the Task52 codec (3x3 / passRows 1), and drove dedicated `player.html` native keyboard proof.

**UI tests:** 91/91, exit 0, one focused run on final bytes (prior 88 plus 3 new regressions, including 45 `lifeFieldInteraction`). **Native player.html:** exit 0 (`native/native-qa-18` copied to `native-qa-final`). **Remote authored project:** new id, save+reload proved 3x3/pass1.

## NPC / body / passage and mid-step choices

Unchanged from producer-r2:

- Discrete player body: `resolvePlayerBody` at integer `tileX/tileY` (origin while a step is in flight). Sprite lerp is not forwarded to core.
- Placement overlap uses full `footprintBounds`, never `passRows`/`passRect`.
- In-flight player: `placementBlockedByRenderedBodies` refuses while `scene.moving`.
- Walking walls in the core reader: `priority === "same"` and `overlapForbidden` only.
- Visible construction protection is separate and uses interpolating NPC feet; above/below/pass-through block construction on overlap and are not last-exit walls.

Native observation for interpolating NPC (final run): player at `(16,2)` facing down, 3x3 adjacent target `(15,3)`. NPC `activeMove` `(16,5)→(16,6)`. Logical dest body `top=4..bottom=6` does **not** cover row 3; origin body at y=5 has `top=3` and does. Menu open pauses the updater (frozen mid-move). Place refused `blocked`, gold 450 unchanged. Sprite pixels `(264,96)`, `fractional:false`. Origin-versus-destination plus overlap refusal is the proof. Screenshot `npc-overlap-menu-1024.png` shows target `(15, 3)`, moved shed at `(11, 6)` Lv.2, red `처리할 수 없습니다: blocked`.

## Task52 codec / isolated project

Do not reuse the r2 1x1 remote blob.

- New project id `rpg-zzu-life-full-p4-t12-ui-01a07b22` (not stardew-demo / WISH / `…-01a07a93`).
- LegacyDb saveKind `saved`, sha256 `350f3b2d133b555976eadf60dbbfdce9121e4b4146922f13fca6abd4fc99df27`.
- Reload: `playerFootprint` `{width:3,height:3}`, `playerPassRows` 1, `farmPlots` `{}`.
- Local `fixture.json` is `serialize(reloaded)` of that codec output.
- Native New Game: start `(8,8)`, empty `farmPlots`, Spaces target `(7, 9)` not 1x1 `(8, 9)`.

`ProjectSession` was not given authored `farmPlots`. Plot at `7,9` was created by actual hoe tilling (`item_hoe`, action receipt `tilled` at 7,9). Construction footprint was then matched to that plot from `(8,8)` facing down.

Task52 files were not modified:

- `src/project/databaseRecordModel.ts` `c27eb4c534e39a6b0c68c2d3650aadb905c8f42e0d053d10f79c8092aa6cbdfd`
- `test/playerBodyProjectPersistence.test.ts` `0dd6e5c03614aa124a4d953c8f80e6189fbdaebe0c31bf0b3335619861372ef1`

## NEW rendered-body replay RED

Not a relabel of r2 RED2.

1. Byte-preserved current r2 UI production files under `preserved-current/` (hashes match r2).
2. Temporarily restored producer-r2 `saved-impl` UI sources only (Task52 and Astra wiki untouched).
3. Ran `test/lifePlacementRenderedBodyReplay.test.ts` (ledger entry points only; no `placementBlockedByRenderedBodies` import): **3 failed / 0 passed**, exit 1. Failures spent gold/items because interpolating/below/pass-through/in-flight cases applied. Streams: `replay/red.stdout`, `replay/red.stderr`.
4. Restored exact current r2 UI bytes immediately (re-hashed equal to `preserved-current/MANIFEST.json`).
5. Kept the three tests in the final 91 suite (they pass on current UI).

## Native mutations (player.html, keyboard only)

Harness: dedicated `startPlayerQaServer`, no editor play, no `DOM.click`. Navigation arms the next selection/mode/depth transition after one key; unexpected timeouts throw. `activateByTestid` does not treat 400ms `false` or `timeout:true` as success. Nested `snapshot.player.x/y` verified. Fresh owned Chromium context; `PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright` not deleted. Private tmpfs `/dev/shm/st_01a07b22`. Menu closed and a completed walk observed before reopening build UI.

| Action | Result |
| --- | --- |
| Place shed | `(7,9)`, gold 500→490 |
| Overlap re-place | `blocked`, gold 490, still 1 building |
| Upgrade | level 2 at stored `(7,9)`, gold 470 |
| Move building | `(7,9)` → `(11,6)` (different coordinates), level 2 kept |
| Place rug | `ledger:decoration:rug:1` placed |
| Move rug | native `blocked` at the `(2,2)` follow-up (not a success) |
| Rotate rug | native `blocked` at the same follow-up (not a success) |
| Till then place on `7,9` | hoe equipped, plot created, place `blocked`, gold unchanged |
| Edge from `(1,8)` facing left | `blocked`, gold unchanged |
| Last-exit after walking off `(1,2)` | **not refused** (third shed placed at `(4,0)`); recorded, not claimed |
| NPC overlap place | `blocked`, gold 450 |
| Menu Save slot 1 | raw key `task12-ui-native-r3:save-slot:v5:1` (4274 bytes) has sheds + rug |
| Load-menu slot 1 | spaces UI restored `life-ledger-space-decoration-*-rug:1` and three building ids |

Walk onto rug: `(2,2)→(2,3)` after place (nonblocking). Catalog pictures: ledger artwork and EasyRPG cloud pictures render; no `.runtime-missing-resource` / `__MISSING`. Grok read 1024 and 1440 PNGs (`spaces-before-place`, `after-place`, `npc-overlap-menu`, `field-after-load`).

## Wiki update brief (fact-only, Astra)

No wiki edit here. Carryover hashes unchanged. Farming occupancy still includes plots in core; live ledger still passes a call-scoped scene reader. Task52 now preserves authored `system.playerFootprint` / `playerPassRows` through serialize/parse; native reload is 3x3/pass1. `startSession` still starts `farmPlots: {}`.

## Source identity

See `SOURCE-HANDOFF.json`. Combined dirty set for Astra (uncommitted):

- 11 r2 UI/test paths (hashes above)
- new `test/lifePlacementRenderedBodyReplay.test.ts`
- Task52 `src/project/databaseRecordModel.ts` + `test/playerBodyProjectPersistence.test.ts`
- 3 Astra wiki/index files (untouched this node)

No occupancy/transaction/restore/farming/save codec edits except the already-accepted Task52 normalizer.

## Commands and exits

| Step | Exit | Path |
| --- | --- | --- |
| NEW replay RED (pre-render UI) | 1 | `replay/red.exit` |
| UI final 91 | 0 | `tests/ui-green-final.exit` |
| remote save (https check fail) | 1 | `native/remote-save-1.exit` |
| remote save (farmableArea w/h) | 1 | `native/remote-save-2.exit` |
| remote save final | 0 | `native/remote-save.exit` |
| native attempts 1–17 | mixed | `native/native-qa-N.*` preserved |
| native final | 0 | `native/native-qa-final.exit` |

Heavy commands used lock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock`, `--maxWorkers=2 --minWorkers=1`, `--cache=false`.

## Limits (honest remaining)

- Native decoration **move** and **rotate** were attempted after place and both returned `blocked` (occupied/edge geometry at the follow-up cell). Place + Save/Load of the rug id succeeded. Not claimed as native move/rotate success.
- Native last-local-exit refuse was **not** obtained: after sealing down from `(1,2)`, walking right opened a new exit and a third shed placed. Handler tests still cover last-exit. Do not treat this as native last-exit proof.
- Load-menu message text was empty on the activating z; restoration is the post-load spaces testids + raw slot JSON, not the toast string.
- No typecheck:app, full CLI build, 355-core suite, or wiki authoring (Astra next). No commit.

## Cleanup

Owned tmpfs `/dev/shm/st_01a07b22` held TMPDIR/XDG/Vite caches. Shared lock was not nested and was not deleted. Playwright browsers path was not deleted. `node_modules` untouched. Native servers closed in script `finally`. See `cleanup.json`.

## Safe publication list

Include: this HANDOFF, SOURCE-HANDOFF.json, preserved-current/*, replay/*, tests/*, native/remote-proof.json, native/*.log, native/*.png, native/fixture.json, native/build-fixture.mts, native/native-qa.mjs, native/raw-slot-1.json, native/raw-slot-1.parsed.json, native/native-evidence.json. Exclude: `.env.local`, anon keys, headers, private reasoning.
