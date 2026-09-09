# Task12 UI/native: confirmed (verify-r5)

Independent Grok verification of complete Task12 UI/native behavior on the
**real combined commit** in `/home/main/z-project/rpg-zzu-life-full-p4` after
build-r5. This is not approval of task13, Phase4, a PR, or the overall
51-feature goal. Prior attempt evidence, producer-r3/r4/r5, build-r3/r4/r5,
fixtures-r4/r5, and Task52 receipts were not rewritten. This node did not
mutate product, test, wiki, config, core, Git, or dependencies.

**Verdict: confirmed.**

## Entry gate (enforced first)

| Check | Result |
| --- | --- |
| `build-r5/COMMITTED.json` | **present** |
| Declared SHA | `2c136343eae7e39700fe4b0752d96b6e9c89e70d` |
| `git rev-parse HEAD` | `2c136343eae7e39700fe4b0752d96b6e9c89e70d` (match) |
| Subject | `feat(life): deliver live placement safety and authored body persistence` |
| Branch | `agent/life-full-p4` |
| Working tree | clean (`git status --porcelain=v1` empty before and after) |
| 14 code/test + 3 wiki hashes vs COMMITTED | **17/17 match** (see `identity.before.json`) |
| Fixtures immutable | r3/r4/r5 fixture SHA-256 match FIXTURE-HANDOFF / SOURCE-HANDOFF |
| Producer composite native prereqs | r3 UI91, r4 arena/last-exit, r5 rug passage+resume present; not substituted for this run |
| CLI prereqs | build-r3 diagnostics/typecheck/full-build exit0 and build-r5 composite/openwiki exit0 **read, not rerun** |

Entry gate **passed**. Independent focused UI suite and native `player.html`
acceptance were executed on this frozen commit.

Receipts: `identity.before.json`, `identity.after.json`.

## Source identity (independent)

| Path | SHA-256 | Bytes |
| --- | --- | --- |
| src/player/lifePlacementScene.ts | `275318021fbdfdfa0a8bcb131314fd7a75bf5a8fba1c37fdd35b47eac4739565` | 6063 |
| src/player/lifeLedger.ts | `9e7ffb6f6e3bdd24f22d723556513570be03a5cb0394640ea718d918e5cfebcb` | 30221 |
| src/player/playerStatusMenuDetails.ts | `26b30f5a06f8fc49ce9a815d7493300c4aae42d2d8b1693304cf9a2a3f96b67b` | 36013 |
| src/player/playerStatusMenu.ts | `5d33e4a4844ddf2a5f623928b2c730ca514cdca29922d7435feeff2a4a3d6370` | 16481 |
| src/player/playerStatusMenuController.ts | `7cf1dd019700f5ad8e19a170f6aa33fccfa0bfdce388eb00241c364bf81565e7` | 31985 |
| src/player/playerStatusMenuTypes.ts | `40efe968f6d087034ec01e134f87043327eac5108d0b20ddb4b1b6ddee54972c` | 3556 |
| src/player/playerStatusMenuDetailTypes.ts | `42ac4b0a3b6e06b1f6f5b594843b7c61cf85f141dd46c6711a9fc9b30a89614a` | 5081 |
| src/player/PlayScene.ts | `a3c2fe2b3baad143cdef4db6de14590137316669961a451ec65407b0c156225d` | 27542 |
| test/lifePlacementSceneUi.test.ts | `78403533ace4a55fa78c8b1e77e8466c87a18f1db187c5c38e0968a4821f6b56` | 35644 |
| test/p2SpatialPlayIntegration.test.ts | `b7329262d031932ab515ec5647026e0a956c8275a145051e40f8ccc8403a9e51` | 8496 |
| test/p2SpatialRuntimeUi.test.ts | `927d55ec45b0a72e8cd0240270701f9983f76734f1ace7b1d145cd822663be2f` | 2873 |
| test/lifePlacementRenderedBodyReplay.test.ts | `f7ffd8d8a89a2fb10ef67ee13a459a8bda592e63e7035a50b63a75d27b06cc97` | 7659 |
| src/project/databaseRecordModel.ts | `c27eb4c534e39a6b0c68c2d3650aadb905c8f42e0d053d10f79c8092aa6cbdfd` | 46246 |
| test/playerBodyProjectPersistence.test.ts | `0dd6e5c03614aa124a4d953c8f80e6189fbdaebe0c31bf0b3335619861372ef1` | 6375 |
| openwiki/INDEX.md | `3671e8357729819f30c557ec70a345a1e26593bcfec1db25cc400f30f120ca45` | 38587 |
| openwiki/runtime-project-schema.md | `0d88d9040930ec3a1d7a88105bbd56e193d660da0b10703520d7986793c3753d` | 76618 |
| openwiki/runtime-sessions.md | `8c3d2d7ae0eb27d1666ace7365b6c66b1299cb132ec18bd294d6d6237d9db975` | 83643 |

Source-read notes: `source-read/SOURCE-READ.json`. Combined diff is the
build-r5 joint commit content; product UI/test bytes equal producer-r3
identities on the committed tree. Task52 normalizer is the only
`src/project` change in scope (`databaseRecordModel.ts`).

## Canonical receipts read (not substituted)

- `ATTEMPT4-INSTRUCTIONS.md`, `RUG-TRAVERSAL-CORRECTION.md`, `DAG.attempt3.json` /
  `DAG.attempt5.json` `verify-live-ui`.
- producer-r3/r4/r5 HANDOFF + SOURCE-HANDOFF + CRITERION-MAP; producer-r5 raw
  slots/passages; r3 honest failures retained as non-pass.
- build-r5 `COMMITTED.json` / `SUMMARY.md` / composite native audits.
- fixtures-r4 arena+lastExit and fixtures-r5 rug FIXTURE-HANDOFF (model
  preflight is **not** native proof).
- Task52 `PARENT-WORKING-VERIFIED.md` and independent acceptance; `47-48/VERIFY.md`
  scoped nonvisual only.
- Attempt1 `verify/VERIFY.md` logical-only inversion: **not repeated**.
- verify-r3 entry failure (no COMMITTED): historical; this gate is closed.
- visual-qa skill: screenshots opened and domain-read (not footer alone).

CLAUDE.md ignored.

## Independent focused UI suite (executed once)

Command (repo runner, cache-loader, at-most-2 workers):

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
| Exit | **0** (`tests/ui-suite.exit`) |
| Test files | 7 passed |
| Tests | **91 passed (91)** |
| `lifeFieldInteraction` | **45** |
| Rendered-body replay on committed source | **3 passed** (part of 91) |
| Streams | `tests/ui-suite.stdout`, `tests/ui-suite.stderr` (empty), `tests/ui-suite.command.json` |

### Counterfactual rendered-body RED (evaluated accurately)

Producer-r3 `replay/red.*` is a **new counterfactual** run against
byte-preserved **pre-render** UI (`preserved-current/`), describe title
`life placement rendered-body replay (new, not historical RED)`, exit **1**,
3 failed / 0 passed. It is **not** a recovered historical RED and was **not**
re-executed against the current fixed commit (that would invert the proof).

On the **committed** source, the same three cases are green inside the 91-suite
above. That is the independent acceptance of rendered mid-step body protection
(interpolating NPC cover while destination body does not; below/pass-through
without walking walls; in-flight player at integer origin). Logical-only
origin/destination inversion from attempt1 is rejected.

## Independent native `player.html` (executed)

Harness: dedicated `startPlayerQaServer` + Playwright persistent/fresh contexts,
native keyboard only, owned profile under `/dev/shm/st_01a07c17`, shared lock
`/tmp/rpg-zzu-life-full-qa-01a0727b.lock`, installed
`PLAYWRIGHT_BROWSERS_PATH=/home/main/.cache/ms-playwright`. No `DOM.click`, no
result injection, no `__oprnInput.face`, no timing retries. Selection / move /
storage / document observers armed before keys; unexpected timeout fails.
Namespaces: `task12-ui-verify-r5-{general,arena,last-exit,rug}`.

Runner: `run-native.py`. Scripts under `native/` (evidence-only adapters).

| Scenario | Fixture SHA-256 | Exit | Evidence |
| --- | ---: | ---: | --- |
| general (r3 path, bogus rug/last-exit labels removed) | `e48e935a33b8f6ed42e987ea7231ca508d1ae05abfc4862e11364e0357c54ff2` | **0** | `native/general.*`, `native/general/` |
| arena + last-exit (r4 separate inputs) | arena `d8a44e60…`, lastExit `ca7bb033…` | **0** | `native/arena-lastexit.*`, `native/arena-lastexit/` |
| rug passage + divergent Save/Load (r5) | `265f600a710025ee451361b70746b50ca2bf9165e6815d4ce0aa582e7eca520b` | **0** | `native/rug.*`, `native/rug/` |

All three stderr streams empty. `pageErrors` / harness `errors` empty.

### 3×3 / passRows 1

All three fixtures assert `playerFootprint` 3×3 and `playerPassRows` 1 at boot.
General, arena, and rug start feet match authored contracts; last-exit starts
at foot `(1,2)`. Player start under the fixed normalizer succeeded in each
fresh session (title → Enter → `runtime-state-json`).

### General scenario (building / till / edge / NPC / Save·Load existence)

Derived from **actual** pre-action gold 500 (not hardcoded final totals alone):

| Criterion | Independent result |
| --- | --- |
| Place shed adjacent `(7,9)` | ok; gold 500→**490** (receipt gold 10) |
| Overlap re-place refuse | blocked; gold stays 490; one building |
| Upgrade level 2 at stored `(7,9)` | ok; gold 490→**470** (Δ20); coords unchanged |
| Building move different coords | `(7,9)`→`(11,6)` keep level 2; player had stepped to `(9,8)` |
| Decoration place rug (for dual-owner Save) | ok; id `ledger:decoration:rug:1` |
| **Not claimed:** r3 rug move/rotate/walk-onto | explicitly excluded (RUG-TRAVERSAL-CORRECTION) |
| **Not claimed:** r3 last-exit choreography | explicitly excluded (false positive history) |
| Hoe till plot `7,9` | ok; `farmPlots.map_blank_start["7,9"].tilled=true` (no authored Project farmPlots) |
| Construction on plot refuse | blocked; gold 470 unchanged; still one building |
| Edge refuse from `(1,8)` | blocked; gold unchanged |
| Rendered NPC target overlap | active move origin `(16,5)`→`(16,6)`; **fractional:true** sprite; place blocked; gold 470 |
| Menu Save slot1 | raw slot has building **and** decoration IDs |
| Menu Load | restores rug testids + building `ledger:building:shed:1` at `(11,6)` lv2 |

Raw slot: `native/general/raw-slot-1.parsed.json` —
buildings `{ledger:building:shed:1}`, decorations `{ledger:decoration:rug:1}`.

### Arena (decoration rotate + different-coordinate move)

| Criterion | Independent result |
| --- | --- |
| Place table `(7,9)` down 2×1 | ok; potion 8→7; gold 500 |
| Rotate → **left** 1×2 at same coords | owner orientation **left** (from owner row/slot, **not** rotate button next-label `아래로 돌리기`) |
| Raw slot after rotate | `orientation:left`, `(7,9)`, recoveryItem potion×1 |
| Walk left to foot `(7,8)` then move to `(5,6)` | ok; orientation kept left; gold 500; potions 7 |
| Raw slot after move | `(5,6)` left; typeId table |

### Last-local-exit (separate fixture; stationary)

| Criterion | Independent result |
| --- | --- |
| Boot foot `(1,2)`, blockers `(1,1)` + `(3,2)` | ok |
| Target label `(0,3)` proving facing down | ok |
| Place shed refuse | **blocked**; foot stays `(1,2)`; gold 500; potion 8; hoe 1; owners only `r4-block-up` + `r4-block-right` |
| Raw slot | same owners/costs/foot; no decorations |

### Rug passage + divergent Save/Load (RUG-TRAVERSAL-CORRECTION)

| Criterion | Independent result |
| --- | --- |
| Place rug `(7,9)` down; shed `(12,6)` retained | ok; potion 8→7; gold 500 |
| DOWN `(8,8)`→`(8,9)` | **origin passage** x7..9/y8 ∩ rug = `[]`; **dest passage** x7..9/y9 ∩ rug = `{(7,9),(8,9)}` — actual **passage** traversal, not upper-body-only |
| Save slot1 standing on rug | foot 8,9; rug 7,9/down; recoveryItem potion×1; shed 12,6; gold 500 / potion 7 / hoe 1 |
| Divergent live before Load | foot `(8,10)`; rug moved `(7,11)`; slot1 reread still 8,9/7,9 |
| Load slot1 | **live** foot 8,9 + owner rug 7,9/down restored (re-query runtime-state after applySession) |
| Save **different** slot2 | slot2 matches slot1 foot/owners/recovery/inventory/gold; keys s1+s2 both present |

Passage proof: `native/rug/native-evidence.json` → `passages` /
`sessions.rug.passage`. Slots:
`raw-slot-standing-on-rug.parsed.json`,
`raw-slot-after-load-slot2.parsed.json`.

Old r3 labelled walk-onto-rug (foot 2,3 / passage row3 vs rug 3,1/4,1) is
**not** relabeled pass.

## Screenshots (opened and read)

33 PNGs at 1024 and/or 1440 under scenario dirs. Inventory:
`native/png-inventory.json`. Domain reads: `png-read.json`.

Notable:

- `rug-standing-on-1024.png` — player standing on cloud/rug graphic on field.
- `rug-after-place-1024.png` — message `Rug을(를) 배치했습니다`; gold **500G**; shed `(12, 6)`.
- `arena-after-rotate-1024.png` — `Table을(를) 회전했습니다`; rotate button shows **next** action; current orientation from owner/slot.
- `npc-overlap-menu-1024.png` — `처리할 수 없습니다: blocked`; gold **470G**; shed Lv.2 `(11, 6)`.

No `.runtime-missing-resource` / `__MISSING` catalog overlays observed; harness
asserted overlay count 0 after place actions.

## Contracts preserved (from source-read + tests + native)

1. All six live mutations go through the non-omitted scene reader (`createLifePlacementLiveReader` / ledger `readLive`) — covered by lifeFieldInteraction 45 + native activate paths.
2. Fresh scene/context on apply; no cached actor array as sole authority; slots hold owners/session values without transient QA context keys (`native/slots-summary.json`).
3. Direction distinct from orientation; rotation/upgrade use full footprint and self-exclusion (suite + arena rotate/move + building upgrade).
4. Rendered mid-step body protection on committed source (3 green replay tests); counterfactual RED documented as pre-render only.
5. No ghost/fake passage wall / global-motion ban; below/pass-through cases are refuse-via-ledger without walking-wall fabrication (replay tests).
6. Static restore/farming/forage/remove/receipt contracts retained beyond Task52 normalizer identity.
7. Input exclusion while menus open; live actor/session freshness after Load (rug live restore).
8. Unchanged costs/assets on refuses; nonblocking rug walk costs unchanged.

## Astra CLI receipts (read, not rerun)

| Receipt | Exit |
| --- | --- |
| build-r3 diagnostics / typecheck:app / full build | 0 / 0 / 0 |
| build-r5 composite-final / openwiki-verify / openwiki-index | 0 / 0 / 0 |

No typecheck, full build, Task52-135, or core-355 rerun here. Equality to
COMMITTED hashes licenses reuse of those receipts only.

## Criterion map (independent)

| ID | Status | This-node receipt |
| --- | --- | --- |
| ui-suite-91 + lifeFieldInteraction 45 | **pass** | `tests/ui-suite.*` |
| rendered-body on commit + counterfactual RED understood | **pass** | suite 3 green; producer-r3 `replay/red.exit=1` read-only |
| remote/authored 3×3 passRows1 + player start | **pass** | all three native boots |
| place/overlap/upgrade/building-move | **pass** | `native/general` |
| till + plot refuse + edge refuse | **pass** | `native/general` |
| NPC rendered overlap refuse | **pass** | `native/general` (fractional:true observed) |
| Save+Load building+decoration IDs | **pass** | general raw slot + rug dual slots |
| decoration rotate orientation change | **pass** | `native/arena-lastexit` |
| decoration move different coords | **pass** | `native/arena-lastexit` |
| last-local-exit atomic refuse | **pass** | `native/arena-lastexit` last-exit |
| nonblocking rug **passage** ∩ cells + divergent Load + slot2 | **pass** | `native/rug` |
| catalog pictures | **pass** | png-read + harness |
| no swallowed unexpected timeout | **pass** | empty stderr; exit0 only after asserts |

## Commands this node ran

| Command | Exit | Purpose |
| --- | ---: | --- |
| Entry identity / SHA / fixture hash Python | 0 | gate |
| Focused UI suite (above) under flock900 / timeout600 | 0 | independent UI |
| `python3 -B …/run-native.py arena-lastexit` | 0 | native rotate/move/last-exit |
| `python3 -B …/run-native.py rug` | 0 | native passage+Save/Load |
| `python3 -B …/run-native.py general` | 0 | native building/till/edge/NPC/Save |
| PNG open via evidence tooling + PIL inventory | 0 | visual |
| Final identity + cleanup | 0 | freeze + remove scratch |

**Not run:** `npm run typecheck:app`, `npm run build`, Task52 135, core 355,
Astra-only wiki rebuild, stardew-demo writes, product patches.

## Cleanup

| Resource | Status |
| --- | --- |
| `/dev/shm/st_01a07c17` | **removed** (`cleanup.json`) |
| Shared lock `/tmp/rpg-zzu-life-full-qa-01a0727b.lock` | retained, not deleted |
| Playwright browser cache | not deleted (shared install) |
| `node_modules` | untouched |
| Product/Git | clean; no commit from this node |
| Isolated save namespaces | browser-local only; profiles destroyed with scratch |

## Limits

- Not task13, Phase4 PR, or overall 51-feature approval.
- Not a re-approval of foreign projects or stardew-demo content.
- Producer native exit0 alone was never treated as substitute; full UI + three
  independent native groups were required and executed.
- Image route is Grok-family visual read of this node’s captures.

## Verdict

Every scoped Task12 UI/native criterion checked above is **independently
confirmed** on commit `2c136343eae7e39700fe4b0752d96b6e9c89e70d` with full
command/stream/exit, raw-slot, PNG, source-hash, and cleanup evidence under
`12/ui/verify-r5/`.
