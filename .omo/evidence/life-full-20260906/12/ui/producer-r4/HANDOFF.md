# Task12 UI producer-r4 composite native closure

This is a composite producer handoff, not final Task12 approval and not a commit.
Source stays uncommitted on `agent/life-full-p4` at HEAD `ea6b2b358088cb6061783f6ffd162169764a07e9`.
Product/test/wiki/core/Git were **read-only**. The 14 code/test files keep producer-r3 SHA-256 values.
Astra wiki/index bytes match build-r3 certified hashes, not the pre-wiki producer-r3 `wikiCurrentSha256`.

producer-r3, build-r3, verify-r3, fixtures-r4, and Task52 acceptance were not rewritten.

## Outcome

The three missing native criteria now have strict player.html keyboard proofs on the unchanged source, using the two fixtures-r4 remotely reloaded inputs. Unrelated r3 successes were **not** rerun; they are linked by exact source identity.

| Missing criterion | Result |
| --- | --- |
| Accepted decoration rotation with actual orientation change | **pass** table `ledger:decoration:table:1` down → **left**, still `(7,9)` |
| Accepted decoration movement to different coordinates | **pass** same owner `(7,9)` → **`(5,6)`**, orientation **left** kept |
| Last-local-exit construction refusal, costs/owners unchanged | **pass** shed target `(0,3)` `blocked`; gold 500; potion 8; hoe 1; owners still `r4-block-up`/`r4-block-right`; foot stayed `(1,2)` |

Native entry point `native/native-qa.mjs` via `python .omo/evidence/life-full-20260906/12/ui/producer-r4/run.py`.
Attempt 1 exit **1** (overwrite-confirm on second Save; live rotate/move already succeeded; retained).
Attempt 2 / final exit **0**. Stderr empty.

## Supplementary native sessions (new)

Dedicated `startPlayerQaServer`, Playwright persistent contexts, native keyboard only.
No `DOM.click`, no `__oprnDebug` writes, no `__oprnInput.face`, no result injection.
Selection/message/player-move/testid signals were armed before keys. Failures throw and exit nonzero.

### Arena (`rpg-zzu-life-full-p4-t12-arena-st-01a07ba6`)

Fixture SHA-256 `d8a44e6019cb015ca557bdedb551efd006975f1ba754bc2a3cd611b301b234f8`.
Boot `(8,8)` facing down, 3x3/passRows1, gold 500, potion 8, empty buildings.
`__oprnPlayerSprite.moving === false` and nested `snapshot.player` before place/rotate/move.

1. Place Table at `(7,9)` down 2×1. Message `Table을(를) 배치했습니다`. Potion 8→7, gold 500.
2. Rotate without walking. Message `Table을(를) 회전했습니다`. Owner `왼쪽 · 1×2` at `(7,9)`.
3. Menu Save slot 1 `task12-ui-native-r4-arena:save-slot:v5:1` → `native/raw-slot-arena-rotated.json` orientation **left** at 7,9.
4. One completed left step `(8,8)`→`(7,8)`. Move target `(5,6)`.
5. Move. Message `Table을(를) 이동했습니다`. Owner `왼쪽 · 1×2` at `(5,6)`.
6. Overwrite-confirmed Save → `native/raw-slot-arena-moved.json` **left / 5,6**, gold 500, potion 7, foot 7,8.

Player never stood on the table before rotate or move.

### Last exit (`rpg-zzu-life-full-p4-t12-last-exit-st-01a07ba6`)

Fixture SHA-256 `ca7bb0339b1472d602db720620e927bc5b81e93cfafa18a9f1ed20df07e24813`.
Independent context. Boot `(1,2)`, gold 500, potion 8, hoe 1, buildings `r4-block-up@(1,1)` and `r4-block-right@(3,2)`.
**No walk or turn** before construction. Shed label `map_blank_start (0, 3)` proves facing down.
Place refused `처리할 수 없습니다: blocked`. Gold/inventory/owners/foot unchanged.
Save `native/raw-slot-last-exit.json` still those two sheds, decorations `{}`, gold 500, potion 8, x=1 y=2.

Static occupancy / nonblocking-vs-blocking live preflight remain fixtures-r4 model proofs, not this native run.
Native confirms the live construction refusal and unchanged costs/owners.

## Original r3 path (immutable, not rerun)

Reused only because the 14 declared files still hash-equal producer-r3 `SOURCE-HANDOFF.json`:

- UI 91/91 exit 0, including 45 `lifeFieldInteraction` and 3 rendered-body replay greens.
- NEW replay RED3: 3 failed / 0 passed, exit 1, then current UI restored.
- Remote project `rpg-zzu-life-full-p4-t12-ui-01a07b22`, 3x3/pass1.
- Native place/overlap/upgrade/building-move `(11,6)` / till 7,9 / edge / NPC overlap / Save+Load rug **ids**.
- Honest r3 gaps (do **not** treat as pass): rug move/rotate `blocked`; last-exit after walking away placed a third shed and spent gold while logging `lastExitBlocked:false` then exiting 0.

build-r3 configured diagnostics/typecheck/full-build remain valid on this same compiled unit. This node did not rerun them.

## PNGs

12 captures at 1024 and 1440. This node opened and read the listed frames in `png-read.json`.
Gold stays 500G. After rotate the footer is `Table을(를) 회전했습니다` with next-cycle `아래으로 돌리기`.
After move the owner is `왼쪽 · 1×2` at `(5, 6)`. Last-exit footer is red `처리할 수 없습니다: blocked`.

## Criterion map

See `CRITERION-MAP.json`. Original vs supplementary paths are distinct. All original DAG native requirements are accounted for: r3 receipts cover the previously passing set; r4 covers only the three closures.

Menu Save here proves **new owner properties** (orientation and coordinates). It is not labeled as Load restoration.

## Commands and exits

| Step | Exit | Path |
| --- | ---: | --- |
| native attempt 1 (overwrite confirm) | 1 | `native/native-qa-1.exit` |
| native attempt 2 / final | 0 | `native/native-qa-final.exit` |
| r3 UI 91 (not rerun) | 0 | `../producer-r3/tests/ui-green-final.exit` |
| r3 replay RED (not rerun) | 1 | `../producer-r3/replay/red.exit` |

Invocation (attempt 2): `TMPDIR`/`XDG_*`/`VITE_CACHE_DIR` under `/dev/shm/st_01a07bb6`, `PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright`, `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, `timeout 600s node native/native-qa.mjs`. See `native-qa-2.command.json`.

## Limits

- Not a combined commit. Astra still owns wiki-if-needed, CLI reuse, and the joint commit.
- Independent Grok verify-r4 must still drive full Task12 coverage after that commit; these three closures do not replace it.
- Save/Load of the r3 rug remains existence evidence from r3, not a new restoration proof.
- Attempt 1 is retained harness failure, not a product defect.

## Cleanup

Owned tmpfs `/dev/shm/st_01a07bb6` is absent. Shared lock retained, not deleted. Playwright browsers path not deleted. `node_modules` untouched. Older evidence untouched. See `cleanup.json` and `native-qa-2.cleanup.json`.

## Safe publication list

Include: this HANDOFF, SOURCE-HANDOFF.json, CRITERION-MAP.json, cleanup.json, png-read.json, run.py, native-qa-*.command.json / before / after / cleanup, native/native-qa.mjs, native/native-qa-*.stdout/stderr/exit, native/native-qa-*-evidence.json, native/native-evidence.json, native/native-qa-final.*, native/*.png, native/raw-slot-*.json.
Exclude: `.env.local`, anon keys, headers, private reasoning.
