# Task12 UI/native: confirmed (verify-r6)

Independent Grok verification of complete Task12 UI/native behavior on the
**real combined commit** in `/home/main/z-project/rpg-zzu-life-full-p4` after
the VERIFY-R6-CORRECTIONS harness fix. This is not approval of task13, Phase4,
a PR, or the overall 51-feature goal.

**Verdict: confirmed.**

verify-r5 remains frozen historical execution evidence (including its independent
91-suite run and the prior native exit0 traces). This node does **not** claim
that an actual unexpected timeout occurred in verify-r5; it only removes
harness action-error suppression so exit0 cannot hide a rejected wait.

No product, test, wiki, config, Git, dependency, or remote-project edits.
Task52 normalizer is not reopened. Model family remains GROK via `devpass/grok-4-5`.

## Entry gate

| Check | Result |
| --- | --- |
| `build-r5/COMMITTED.json` | present |
| Declared SHA | `2c136343eae7e39700fe4b0752d96b6e9c89e70d` |
| `git rev-parse HEAD` | `2c136343eae7e39700fe4b0752d96b6e9c89e70d` (match) |
| Subject | `feat(life): deliver live placement safety and authored body persistence` |
| Branch | `agent/life-full-p4` |
| Working tree | clean before and after (`identity.before.json` / `identity.after.json`) |
| 14 code/test + 3 wiki vs COMMITTED | **17/17 match** (`source-read/SOURCE-READ.json`) |
| Fixtures immutable | arena `d8a44e60…`, lastExit `ca7bb033…`, rug `265f600a…`, general `e48e935a…` |
| verify-r5 tree | **preserved** (adapters/VERIFY/receipts not rewritten) |

Entry gate **passed**.

## Adapter corrections (owned evidence only)

Copied verify-r5 native adapters into `verify-r6/native/` and applied the exact
VERIFY-R6-CORRECTIONS fixes. Legitimate `finally`/disposal `.catch` cleanup is
retained; action-await rejection is not suppressed.

| Script | Fix |
| --- | --- |
| `native-qa-general.mjs` | Removed hand-slot `wait…catch(() => null)` (old L635). Already-selected tool established via label + `data-slot` **before** any digit key; skip already-selected digit instead of timing out. No `localStorage.clear` in `addInitScript`. Assert owned initial keys empty. NS `task12-ui-verify-r6-general`. |
| `native-qa-rug.mjs` | Removed storage `wait().catch(() => null)` (old L743/748). Require and record `storageResult.changed === true`. Before Save2 assert key **absent** and record beforeBytes=0. Removed document-scoped `__qaDidInitialSlotClear` + clear (flag is not persistent across documents). Fresh profile + empty-keys assert. NS `task12-ui-verify-r6-rug`. |
| `native-qa-arena-lastexit.mjs` | Removed `localStorage.clear` on every init. Fresh persistent profiles + empty-keys assert for arena and last-exit. NS `task12-ui-verify-r6-arena` / `task12-ui-verify-r6-last-exit`. |

No equivalent catch-to-null remains on action awaits (scanned). Orientation continues
to be read from owner row/slot fields — rotate button text is next-action only
(`아래로 돌리기` after left orientation).

## Evidence reuse vs new execution

| Evidence | Kind | Receipt |
| --- | --- | --- |
| Independent 91/7 UI suite (45 `lifeFieldInteraction`, 3 rendered-body) | **REUSED** — not rerun | verify-r5 `tests/ui-suite.*` byte-copied + `tests/ui-suite-borrow.json`; source/test/commit equality |
| Counterfactual rendered-body RED (producer-r3 pre-render) | **REUSED read** | producer-r3 `replay/red.exit=1` (not re-executed on fixed commit) |
| build-r3 diagnostics/typecheck/full build | **REUSED read** | build-r3 exit0 receipts |
| build-r5 composite/openwiki | **REUSED read** | build-r5 exit0 receipts |
| Task52 independent acceptance | **REUSED read** | `52/PARENT-WORKING-VERIFIED.md`; normalizer untouched |
| fixtures-r4/r5 | **REUSED immutable** | FIXTURE-HANDOFF hashes |
| Corrected native general / arena+last-exit / rug | **NEW** this node | `native/*` under verify-r6 |
| PNG open/read | **NEW** this node | `png-read.json`, 33 PNGs |

**Not run:** focused UI suite, full build, typecheck, Task52-135, core-355,
upstream producers, product patches.

## Independent focused UI suite (borrowed, exact equality)

verify-r5 command (unchanged source):

```
node scripts/run-vitest.mjs run --configLoader runner --cache=false --maxWorkers=2 --minWorkers=1 \
  test/lifePlacementSceneUi.test.ts \
  test/lifePlacementRenderedBodyReplay.test.ts \
  test/p2SpatialPlayIntegration.test.ts \
  test/p2SpatialRuntimeUi.test.ts \
  test/playerStatusMenu.test.ts \
  test/playerOpenSaveMenu.test.ts \
  test/lifeFieldInteraction.test.ts
```

| Result | Value |
| --- | --- |
| Exit | **0** |
| Test files | 7 passed |
| Tests | **91 passed (91)** |
| `lifeFieldInteraction` | **45** |
| Rendered-body on commit | **3 passed** |
| Streams | verify-r5 `tests/ui-suite.stdout` / empty stderr |

## Independent native `player.html` (executed on corrected adapters)

Harness: dedicated `startPlayerQaServer` + Playwright, native keyboard only,
owned profiles under `/dev/shm/st_01a07c36`, shared lock
`/tmp/rpg-zzu-life-full-qa-01a0727b.lock`,
`PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright`.
No `DOM.click`, no result injection, no sleeps/poll delays, no catch-and-guess
on awaited actions. Selection/move/storage observers armed before keys.

Runner: `run-native.py` (refuse-overwrite of prior receipts).

Exact argv (each scenario):

```
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --kill-after=30s {600|900}s \
  node …/verify-r6/native/native-qa-{arena-lastexit|rug|general}.mjs
```

| Scenario | Fixture SHA-256 | Exit | Elapsed | stderr | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| arena + last-exit | arena `d8a44e60…`, lastExit `ca7bb033…` | **0** | 14.3s | 0 B | `native/arena-lastexit.*` |
| rug passage + Save/Load | `265f600a710025ee451361b70746b50ca2bf9165e6815d4ce0aa582e7eca520b` | **0** | 11.8s | 0 B | `native/rug.*` |
| general | `e48e935a33b8f6ed42e987ea7231ca508d1ae05abfc4862e11364e0357c54ff2` | **0** | 20.0s | 0 B | `native/general.*` |

All three: `pageErrors` empty, harness `errors` empty, `cleanupErrors` absent,
`uncaught` null, per-scenario scratch removed, final `/dev/shm/st_01a07c36` removed
(`cleanup.json`).

Owned initial keys empty asserted in every boot:
`owned-initial-keys-empty` with `keys: []` (general, arena, last-exit, rug).

### 3×3 / passRows 1

All fixtures assert `playerFootprint` 3×3 and `playerPassRows` 1. Boots:
general/arena/rug foot `(8,8)`; last-exit foot `(1,2)`.

### General (building / till / edge / NPC / Save·Load)

| Criterion | Result |
| --- | --- |
| Place shed `(7,9)` | ok; gold 500→**490** |
| Overlap re-place refuse | blocked; gold 490; one building |
| Upgrade level 2 at `(7,9)` | ok; gold 490→**470**; coords unchanged |
| Building move | `(7,9)`→`(11,6)` keep level 2 |
| Decoration place rug (dual-owner Save) | ok |
| Hoe equip | digit `1`: `빈 손`→`괭이 ×1` **without** catch-to-null |
| Till plot `7,9` | ok; `farmPlots.map_blank_start["7,9"].tilled=true` |
| Construction on plot refuse | blocked; gold 470 unchanged |
| Edge refuse from `(1,8)` | blocked; gold unchanged |
| Rendered NPC target overlap | origin `(16,5)`→`(16,6)`; **fractional:true**; place blocked; gold 470 |
| Menu Save slot1 | building **and** decoration IDs |
| Menu Load | restores rug UI + building at `(11,6)` lv2 |

Raw: `native/general/raw-slot-1.parsed.json`.

### Arena (rotate + different-coordinate move)

| Criterion | Result |
| --- | --- |
| Place table `(7,9)` down 2×1 | ok; potion 8→7; gold 500 |
| Rotate → **left** 1×2 same coords | owner orientation **left** (owner row/slot — **not** rotate button next-label `아래로 돌리기`) |
| Raw slot after rotate | `orientation:left`, `(7,9)`, recoveryItem potion×1 |
| Walk then move to `(5,6)` | ok; orientation kept left; gold 500 |
| Raw slot after move | `(5,6)` left |

### Last-local-exit (stationary)

| Criterion | Result |
| --- | --- |
| Boot foot `(1,2)`, blockers `(1,1)` + `(3,2)` | ok |
| Target label `(0,3)` | ok |
| Place shed refuse | **blocked**; foot stays `(1,2)`; gold 500; potion 8; hoe 1; owners only blockers |
| Raw slot | same owners/costs/foot; no decorations |

### Rug passage + divergent Save/Load (RUG-TRAVERSAL-CORRECTION)

| Criterion | Result |
| --- | --- |
| Place rug `(7,9)` down; shed `(12,6)` retained | ok; potion 8→7; gold 500 |
| DOWN `(8,8)`→`(8,9)` | origin passage ∩ rug = `[]`; dest passage ∩ rug = `{(7,9),(8,9)}` — **passage** traversal |
| Save slot1 standing on rug | before absent; **storageResult** `{beforeBytes:0, afterBytes:3740, changed:true}`; foot 8,9; rug 7,9/down; recovery potion×1; shed 12,6 |
| Divergent live before Load | foot `(8,10)`; rug `(7,11)`; slot1 reread still 8,9/7,9 |
| Load slot1 | **live** foot 8,9 + rug 7,9/down restored |
| Save **different** slot2 | before **absent** asserted; storageResult `{beforeBytes:0, afterBytes:3798, changed:true}`; slot2 matches slot1 foot/owners/recovery/inventory/gold |

Passage: `native/rug/native-evidence.json` → `passages` / `sessions.rug.passage`.
Slots: `raw-slot-standing-on-rug.parsed.json`, `raw-slot-after-load-slot2.parsed.json`.

Old r3 labelled walk-onto-rug (foot 2,3 vs rug 3,1/4,1) is **not** relabeled pass.

## Screenshots (opened and read)

33 PNGs (17×1024, 16×1440). Inventory: `native/png-inventory.json`.
Domain reads: `png-read.json`. Direct image opens this node:

- `general/npc-overlap-menu-1024.png` — message `처리할 수 없습니다: blocked`; gold **470G**; shed Lv.2 `(11, 6)`.
- `rug/rug-standing-on-1024.png` — player standing on cloud/rug graphic on field.
- `arena-lastexit/arena-after-rotate-1024.png` — `Table을(를) 회전했습니다`; rotate button shows **next** action `아래로 돌리기`; current orientation from owner/slot (**left**).
- `arena-lastexit/last-exit-after-refuse-1024.png` — blocked at target `(0, 3)`; gold **500G**; stationary.

No `.runtime-missing-resource` overlays observed.

## Criterion map (original Task12 scope)

| ID | Status | Evidence kind | Receipt |
| --- | --- | --- | --- |
| ui-suite-91 + lifeFieldInteraction 45 | **pass** | reused | verify-r5 `tests/ui-suite.*` |
| rendered-body on commit + counterfactual RED understood | **pass** | reused | suite 3 green; producer-r3 red.exit=1 read-only |
| remote/authored 3×3 passRows1 + player start | **pass** | new native | all three boots |
| place/overlap/upgrade/building-move | **pass** | new native | `native/general` |
| till + plot refuse + edge refuse | **pass** | new native | `native/general` |
| NPC rendered overlap refuse | **pass** | new native | `native/general` fractional:true |
| Save+Load building+decoration IDs | **pass** | new native | general raw slot + rug dual slots |
| decoration rotate orientation change | **pass** | new native | `native/arena-lastexit` owner/slot |
| decoration move different coords | **pass** | new native | `native/arena-lastexit` |
| last-local-exit atomic refuse | **pass** | new native | `native/arena-lastexit` last-exit |
| nonblocking rug **passage** ∩ cells + divergent Load + slot2 | **pass** | new native | `native/rug` + storage transitions |
| catalog pictures | **pass** | new native | png-read + harness |
| no swallowed unexpected action timeout | **pass** | new native | corrected awaits; empty stderr; exit0 only after asserts; storageResult required |
| fresh owned profile / empty initial keys / no later init clear | **pass** | new native | `owned-initial-keys-empty` all boots |
| slot2 absent-before + changed-storage recorded | **pass** | new native | rug `save-before-storage` + `save-storage-changed` |
| CLI diagnostics/typecheck/full build | **pass** | reused | build-r3/r5 receipts via COMMITTED equality |
| Task52 normalizer / independent acceptance | **pass** | reused | untouched; 52 PARENT-WORKING-VERIFIED |

## Commands this node ran

| Command | Exit | Purpose |
| --- | ---: | --- |
| Entry identity / SHA / fixture hash | 0 | gate |
| `python3 -B …/verify-r6/run-native.py arena-lastexit` | 0 | native rotate/move/last-exit |
| `python3 -B …/verify-r6/run-native.py rug` | 0 | native passage+Save/Load (strict storage) |
| `python3 -B …/verify-r6/run-native.py general` | 0 | native building/till/edge/NPC/Save |
| PNG open (PIL + direct image read) | 0 | visual domain |
| Final identity + cleanup | 0 | freeze + remove scratch |

**Not run:** UI suite, `npm run typecheck:app`, `npm run build`, Task52 135,
core 355, wiki rebuild, product patches.

## Cleanup

| Resource | Status |
| --- | --- |
| `/dev/shm/st_01a07c36` | **removed** (`cleanup.json`) |
| Shared lock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock` | retained, not deleted |
| Playwright browser cache | not deleted (shared install) |
| `node_modules` | untouched |
| Product/Git | clean; no commit from this node |
| verify-r5 | fully preserved as historical evidence |
| Isolated save namespaces | browser-local only; profiles destroyed with scratch |

## Limits

- Not task13, Phase4 PR, or overall 51-feature approval.
- Not a claim that verify-r5 observed an actual timeout; only that its harness
  could have swallowed one. verify-r5 domain results remain historical, not
  erased.
- Image route is Grok-family visual read of this node’s captures.
- No product defect was demonstrated; no product fix was authorized or applied.

## Verdict

Every scoped Task12 UI/native criterion above is **confirmed** on commit
`2c136343eae7e39700fe4b0752d96b6e9c89e70d` with:

- reused independent 91-suite + CLI/Task52 receipts under exact source equality,
- newly executed corrected native groups (general, arena/last-exit, rug) with
  command/stream/exit, raw-slot, storage-transition, PNG, source-hash, and
  cleanup evidence under `12/ui/verify-r6/`,
- harness action-error suppression removed without inventing historical timeouts.

Task12 independent UI/native acceptance is **confirmed** for parent gating of Task13.
