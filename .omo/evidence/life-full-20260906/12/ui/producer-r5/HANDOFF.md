# Task12 UI producer-r5 composite native closure (rug passage + resume)

This is a composite producer handoff, not final Task12 approval and not a commit.
Source stays uncommitted on `agent/life-full-p4` at HEAD `ea6b2b358088cb6061783f6ffd162169764a07e9`.
Product/test/wiki/core/Git were **read-only**. The 14 code/test files keep producer-r3 SHA-256 values.
Wiki/index bytes match build-r4 certified docs hashes (factual r4 wiki already present).

producer-r3, producer-r4, build-r3, build-r4, verify-r3, fixtures-r4, fixtures-r5, and Task52 acceptance were not rewritten.

## Outcome

The remaining original native gap — **actual nonblocking-rug passage then Save/resume** — now has a strict player.html keyboard proof on the unchanged source, using the fixtures-r5 remotely reloaded rug input.

| Criterion closed here | Result |
| --- | --- |
| Nonblocking rug placement at `(7,9)` down 2×1 | **pass** owner `ledger:decoration:rug:1`; potion 8→7; gold 500; shed `(12,6)` retained |
| DOWN onto rug with **passage** intersecting both rug cells | **pass** foot `(8,8)`→`(8,9)`; origin passage x7..9/y8 hits `[]`; dest passage x7..9/y9 hits `(7,9)` and `(8,9)` |
| Save slot1 while standing on rug | **pass** raw foot 8,9; rug 7,9/down; recoveryItem potion×1; shed 12,6; gold 500 / potion 7 / hoe 1 |
| Divergent live state before Load | **pass** foot `(8,10)` and same rug moved to `(7,11)`; slot1 reread alone still 8,9/7,9 |
| Load slot1 restores **live** foot+rug | **pass** runtime-state foot 8,9; spaces owner rug 7,9/down; shed/gold/inventory retained |
| Save loaded state to **different** slot2 and compare | **pass** slot2 matches slot1 foot/owners/recovery/inventory/gold; both keys present |

Unrelated r3/r4 successes were **not** rerun; they are linked by exact source identity. Honest r3 failures remain failures.

Native entry point `native/native-qa.mjs` via `python .omo/evidence/life-full-20260906/12/ui/producer-r5/run.py`.
Attempt 1 exit **1** (openSaveMenu after Load still on load group; live restore already succeeded; retained).
Attempt 2 exit **1** (harness over-correction skipped required system Enter; retained).
Attempt 3 / final exit **0**. Stderr empty.

## Fixture

- Project ID: `rpg-zzu-life-full-p4-t12-rug-st-01a07be4`
- Immutable input: `../fixtures-r5/rug.reloaded.json`
- SHA-256: `265f600a710025ee451361b70746b50ca2bf9165e6815d4ce0aa582e7eca520b`
- Body 3×3 / passRows 1; start foot `(8,8)` facing down (scene contract)
- Authored shed `r5-retained-shed` at `(12,6)`; rug type nonblocking 2×1

## Six native steps (executed)

Dedicated `startPlayerQaServer`, Playwright persistent context, native keyboard only.
No `DOM.click`, no `__oprnDebug` writes, no `__oprnInput.face`, no result injection.
Selection/message/player-move/player-at/storage/DOM signals armed before keys.
`localStorage.clear` runs only on the first document init (`__qaDidInitialSlotClear`); later Load must not wipe slots.
Load observes the current `runtime-state-json` node after applySession (re-query; handles replacement).
Orientation comes from owner row / raw slot fields, not the rotate button's next-action label.

1. Place Rug via `life-ledger-space-decoration-place-rug` at `(7,9)`. Message `Rug을(를) 배치했습니다`.
2. One completed DOWN `(8,8)`→`(8,9)`. Passage proof recorded in `native-evidence.json` / `sessions.rug.passage`.
3. Menu Save slot 1 → `native/raw-slot-standing-on-rug.json`.
4. DOWN `(8,9)`→`(8,10)`; move same rug to `(7,11)`. Live divergent vs slot1 recorded before Load.
5. Menu Load slot 1. Live foot 8,9 + rug 7,9 restored (mirror + spaces owner).
6. Menu Save slot 2 → `native/raw-slot-after-load-slot2.json`; full compare with slot1 and live.

## Composite links (not rerun)

### producer-r4 accepted closures (source-identical)

- Decoration rotation table down→left at `(7,9)` — `../producer-r4/native/raw-slot-arena-rotated.parsed.json`
- Decoration move `(7,9)`→`(5,6)` keep left — `../producer-r4/native/raw-slot-arena-moved.parsed.json`
- Last-local-exit shed `(0,3)` blocked; costs/owners unchanged — `../producer-r4/native/raw-slot-last-exit.parsed.json`

### producer-r3 original path (immutable)

- UI 91/91 exit 0; NEW replay RED3 exit 1
- Remote 3x3/pass1; place/overlap/upgrade/building-move `(11,6)` / till / edge / NPC overlap
- Save/Load owner **existence** (not divergent restoration; not geometric rug traversal)
- Honest failures retained: rug move/rotate blocked; last-exit false positive after walking away

### build-r4 gap this node closes

- `../build-r4/rug-traversal-audit.json` proved old r3 labelled `walk-onto-rug` never intersected rug cells `(3,1)/(4,1)`.
- That label is **not** relabeled as pass. This r5 scenario is the actual traversal+resume proof.

## PNGs

14 captures at 1024 and 1440. This node opened and read the frames listed in `png-read.json`.
Domain evidence (not footer alone):

- After place: message `Rug을(를) 배치했습니다`; gold **500G**; shed owner `(12,6)`
- Standing on rug: player sprite standing on cloud/rug graphic (field view)
- After divergent move: owner `Rug 아래 · 2×1` at `빈 맵 (7, 11)`; message `Rug을(를) 이동했습니다`; gold 500G
- After load: shed still `(12,6)`; gold 500G (spaces list; live rug owner asserted in state/slots)
- After slot2 save: slots 1 and 2 both `저장됨`; message `2번 저장 칸에 저장했습니다`

## Criterion map

See `CRITERION-MAP.json`. Original / r4-supplementary / r5-rug paths are distinct.
Every original DAG native requirement is accounted for without upgrading the old r3 rug walk label.

## Commands and exits

| Step | Exit | Path |
| --- | ---: | --- |
| native attempt 1 (save menu after load) | 1 | `native/native-qa-1.exit` |
| native attempt 2 (harness openSaveMenu) | 1 | `native/native-qa-2.exit` |
| native attempt 3 / final | 0 | `native/native-qa-final.exit` |
| r3 UI 91 (not rerun) | 0 | `../producer-r3/tests/ui-green-final.exit` |
| r3 replay RED (not rerun) | 1 | `../producer-r3/replay/red.exit` |
| r4 native final (not rerun) | 0 | `../producer-r4/native/native-qa-final.exit` |

Invocation (attempt 3): `TMPDIR`/`XDG_*`/`VITE_CACHE_DIR` under `/dev/shm/st_01a07bf9`, `PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright`, `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock`, `timeout 600s node native/native-qa.mjs`. See `native-qa-3.command.json`.

## Limits

- Not a combined commit. Astra still owns wiki-if-needed, CLI reuse, and the joint commit.
- Independent Grok verify must still drive full Task12 coverage after that commit.
- Attempts 1–2 are retained harness failures, not product defects.
- No product/source change was required; the frozen unit already implements passage-safe nonblocking rugs and Save/Load restoration.

## Cleanup

Owned tmpfs `/dev/shm/st_01a07bf9` is absent. Shared lock retained, not deleted. Playwright browsers path not deleted. `node_modules` untouched. Older evidence and fixtures-r5 untouched. See `cleanup.json` and `native-qa-3.cleanup.json`.

## Safe publication list

Include: this HANDOFF, SOURCE-HANDOFF.json, CRITERION-MAP.json, cleanup.json, png-read.json, run.py, native-qa-*.command.json / before / after / cleanup, native/native-qa.mjs, native/native-qa-*.stdout/stderr/exit, native/native-evidence.json, native/native-qa-final.*, native/*.png, native/raw-slot-*.json.
Exclude: `.env.local`, anon keys, headers, private reasoning.
