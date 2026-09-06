# Task11 cumulative-payment receipt correction

The cumulative-payment regression is corrected in `/home/main/z-project/rpg-zzu-life-full-housing-receipts`, branch `agent/life-full-housing-receipts`, based on `b8f7b00e38c4d18badb2d8ea5211d03daf6384f0`. H1 (64 historical rows plus a repeated item) and H2 (32+33 distinct paid items) both succeed through actual public transactions and Save5. Existing transaction, inventory/wallet and recovery-claim limits are unchanged. Voluntary demolition remains nonrefundable and independent of recovery capacity.

This is a new correction commit, not an amendment. Resolve the delivering commit with `git log -1 --format=%H -- .omo/evidence/life-full-20260906/11/receipt-correction/SUMMARY.md`; the handoff also supplies its exact hash. `identity-cleanup.json` records the verified source and built artifact SHA256 values. The command receipts identify the base HEAD plus the dirty correction's transaction source hash; they are not claimed to have executed against a then-existing correction commit.

## Implementation and scope

- `src/project/spatialPlacementTransactions.ts`: retain original per-level cost preflight unchanged. Aggregate validated historical receipt rows and preflighted new costs separately from `aggregateCosts`, which remains the bounded per-transaction helper. Validate cumulative safe-integer totals before spending anything.
- `src/project/lifeRecovery.ts`: a payment receipt validates nonnegative safe-integer gold and unique nonempty item IDs with positive safe-integer counts. It no longer borrows the one-wallet, one-stack or one-claim limits. Historical payment evidence is not reinterpreted using today's authored costs or capped to one transaction. Unsafe/duplicate/malformed values still refuse.
- The existing recovery splitter and Save5 boundaries already consume this shared receipt predicate. They required no implementation changes: recovery splits large totals into bounded claims, and writer/parser/apply reject invalid receipts without silently dropping them.
- Added `test/spatialPaymentReceipts.test.ts` (21 cases). No existing test/assertion was deleted, skipped, suppressed or weakened. The old suites contained no additional receipt-cap assertion requiring replacement. The stronger existing demolition and conservation cases remain unchanged.
- Updated only `openwiki/runtime-project-schema.md` among wiki pages. No session/schema version change, gold-refund field, inferred legacy costs, housing redesign, task12/13/UI or bounds-lane source edits.

The canonical plan, corrected task11 summary and independent H1 verifier findings were read. The parent probe and old RED were copied byte-for-byte for preservation and hashed again during cleanup. No original parent/producer evidence was changed.

## RED/GREEN and validators

Every heavy invocation uses `record.mjs`, retaining exact argv, cwd, base HEAD, transaction SHA256, raw stdout/stderr and direct exit code. Its envelope is:

```sh
flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock \
  timeout --signal=TERM --kill-after=15s <recorded-seconds>s <command>
```

No nested lock, fixed sleep, polling, test-deadline increase, timing retry, baseline update or shared-cache cleanup was used.

| Evidence | Actual result |
| --- | --- |
| `red.json`, `red-test-source.txt` | Before product edits: exit1, **7 failed /14 passed**. H1, H2, all16 levels, repeated full payments, capacity setup and safe cumulative boundary cases fail on the old receipt contract. |
| `green-final.json` | **245 passed /15 files, exit0**, one complete final invocation, no skipped tests. Includes all21 new receipt cases, all20 required housing cases and204 related cases. |
| `diagnostics-final.json`, `diagnostic-results-final.json` | Compiler API syntactic/semantic diagnostics in this worktree's tsconfig context: all3 changed product/test TS files, zero diagnostics, exit0, before build. LSP calls also returned no diagnostics; the compiler API, not that initial LSP result, caught the test typing issue recorded below. |
| `typecheck.json` | `npm run typecheck:app`, exit0. |
| `parent-replay.json`, `payment-capacity-green.json` | **The actual parent script at its original absolute path**, unchanged, with this worktree as cwd and a new owned output path: exit0/pass:true, authored Project4 costs32+33 accepted, level2 built, receipt65, claims64+1. |
| `native-verified.json`, `native-verified/public-lifecycle.json` | Real Firefox player.html public/native lifecycle, exit0/pass:true; detailed authority below. |
| `build.json` | `npm run build`, exit0: app1364 modules, export player529 modules, SDK7 files +45 runtime assets, standalone531 modules. App/export/standalone all completed. |
| `wiki-verify.json` | `npm run openwiki:verify`, exit0, no failures. |
| `wiki-index-check.json` | **Exit1: generated INDEX is stale after the scoped schema wiki update.** INDEX was left untouched because this task's wiki edit scope is only runtime-project-schema.md. Parent integration owns regeneration of the combined wiki index. This is not a green index check. |
| `cleanup.json`, `identity-cleanup.json` | Closed native resources, native key removed, port39921 successfully rebound/released, owned caches/config-temp/dist/tmpfs removed, parent RED/probe hashes unchanged. |

Final related command (E is this directory):

```sh
npm test -- test/spatialPaymentReceipts.test.ts test/linkedAnimalHousing.test.ts \
  test/p1FarmAnimals.test.ts test/p1FoundationSchema.test.ts test/p2SpatialSchema.test.ts \
  test/p2SpatialTransactions.test.ts test/p2SpatialPersistence.test.ts \
  test/p2SpatialReferenceIntegrity.test.ts test/lifeRecovery.test.ts \
  test/lifeRecoveryPersistence.test.ts test/lifeSaveVersion.test.ts \
  test/p0SessionPersistence.test.ts test/p1ReferenceIntegrity.test.ts \
  test/p2SpatialPlayIntegration.test.ts test/lifeRecoveryRecordKeys.test.ts \
  --config E/vitest.config.ts
```

The wrapper config changes only the owned Vitest cache location; repository test selection, configuration and deadlines remain unchanged. Final QA set `TMPDIR=/dev/shm/st_01a0786a-receipt-qa/tmp`. This task-owned volatile storage was necessary after an observed root-filesystem ENOSPC. Build output used an owned `dist` symlink to the same task's tmpfs; sources and retained evidence always remained in the assigned worktree. All those volatile resources were removed.

## Contract coverage

1. **H1:** 64 distinct construction rows plus one repeated upgrade row become64 distinct receipt rows, with the repeated count2. No concatenation-before-aggregation refusal.
2. **H2:** 32+33 distinct accepted Project4 costs become65 receipt rows. Writer -> Storage -> reader -> apply preserves the active receipt and resources. Removing the building definition produces exactly two claims of64 and1, retaining the complete original placement/payment JSON. Reconciliation/save/resume does not reissue the source; explicit collection pays every one of65 items once. Duplicate source/claim attempts preserve the entire session.
3. **Full valid level history:** all16 levels each pay64 new distinct items. Receipt1024 persists; content recovery produces16 claims of64 without loss.
4. **Repeated quantity and gold:** each of16 levels pays a full legal stack and full legal wallet after newly funded resources. History reaches159999984 items and159999984 gold, while each transaction respects9999999. Recovery emits16 bounded same-item claims. A full inventory refuses the next collection with whole-session equality; spending room permits the next explicit receipt. Gold remains evidence only, never a payout.
5. **Safe arithmetic boundary:** valid receipt gold/item totals at Number.MAX_SAFE_INTEGER survive Save5. Adding one more is refused before spending, with entire-session equality. Malformed unsafe values are rejected, not normalized.
6. **Unchanged transaction limits:** a65-row *new cost input* (even all repeated IDs), per-transaction quantity above ITEM_QUANTITY_MAX, gold above GOLD_MAX, and an over-cap wallet still refuse atomically.
7. **Capacity refusal:** a paid65-item building with4095 existing claims cannot move into the one remaining slot. Explicit conversion, writer and direct apply refuse; the whole source/session, sequence, inventory, gold and previous raw slot remain unchanged.
8. **Raw preservation:** negative/fractional/unsafe gold or counts, zero counts, duplicate IDs, empty IDs and malformed item containers are tested through writer/read/apply. Corrupt current-key bytes and legacy raw remain unchanged; live owners are not partially applied.
9. **Prior demolition correction:** unchanged required housing tests cover0 and4096 existing claims with full-session conservation, no refund and no added/changed claim. Native sleep-earned product and unassigned collection remain functional.

## Public/native authority

`public-player-verified.mjs` is an evidence-owned adaptation of the prior task11 native probe; `native-provenance.json` records the original hash and changes. It runs a fresh strict-port39921 Vite runner-config server rooted in this exact worktree and Firefox151.0 against **player.html/exportProjectStoreShim**, not the editor shell. Only a local minimum-fixture GET is substituted. There are zero attempted writes and zero page errors.

- Actual public transaction modules operate on the real PlayScene session. Twenty pre-sleep actions include the prior housing/care/refusal lifecycle plus real H1/H2 construction/upgrades. The64/65 paid rows originate in authored cost inputs, not injected successful receipts.
- Native Enter starts play; a prearmed observer precedes native Z sleep through the actual input/interpreter/day transition. Production is earned on day2, not injected. The existing demolition/no-refund/unassigned-care/product assertions are retained.
- Native Storage Save5 writer/read/apply preserves both cumulative and repeated receipts before content removal. Applying a changed content definition produces65 proved items in claims64+1 and no inventory/gold payout. Claims themselves save/read/apply unchanged.
- Real explicit collection grants all65 items once; duplicate collection preserves the entire live session. A further save/read/apply leaves sequence3 and no claims. Remaining home2 and repeated-item building receipts remain active and unchanged.
- Native corrupt Save5 inputs for unsafe gold, unsafe item count and duplicate receipt item IDs are rejected through reader and typed direct-apply errors. Full raw strings, actual error reasons and full state/byte preservation assertions are retained.
- Native screenshots: `native-verified/earned-product.png`, `resumed-unassigned.png`, `cumulative-recovered.png`. Image read was attempted but the tool reported that this model cannot display images. **No aesthetic/readability/image approval is claimed.**

These are public API transactions and public Storage calls on a real native scene, not keyboard housing-authoring/assignment or save-menu navigation. Task12/13 and broader UI journeys remain outside this correction.

## Preserved failed attempts and limits

- `green.json` is the initial combined attempt, **exit1**, despite its filename:242 tests passed, while p2SpatialPlayIntegration failed during collection with `ENOSPC: no space left on device, write`. `storage-diagnosis.json` records root and /tmp sharing the full filesystem with200MiB free, versus50GiB free tmpfs. Only owned temporary storage was relocated; no shared files were removed. The complete final selection then passed in one invocation.
- `diagnostics.json`, `diagnostic-results.json`: one introduced test TS2540 (direct assignment to readonly cost). Replaced with immutable definition reconstruction, preserving the test input and all assertions. Final compiler diagnostics and complete tests were run after this correction.
- `native.json` and `native/`: harness arithmetic treated an exhausted/absent inventory key as undefined instead of0, so `undefined+1` became NaN. `native-zero-key-diagnosis.json` records the prior raw inventory and paid receipts. The conservation check now uses the canonical absent-stack zero; no expected quantity or result was injected.
- `native-final.json` and `native-final/`: the next harness version caught the actual typed refusal but incorrectly required its reason to equal the inner parser sentinel. `applySaveSnapshot` wraps the parser message in a snapshot-level LifeReconciliationError. `native-apply-diagnosis.json` records this source-backed diagnosis. The final version checks the public typed rejection and retains its actual reason; no raw/state preservation check was removed. Both failed scripts and outputs remain untouched.
- Build warnings are retained in raw stderr: missing optional AI proxy keys, circular re-export, mixed static/dynamic imports, runtime-resolved asset URLs and large chunks. No warnings were suppressed.
- Whole-repository gates and their inherited failures were not rerun or relabeled. The prior task11 standalone-build timeout is historical; this correction's full build succeeded. Generated wiki INDEX freshness remains the explicit parent-integration issue above.

## Handoff and cleanup

All retained evidence belongs to this directory and is included in the correction commit. `artifact-manifest.json` hashes the retained artifacts (excluding itself). The assigned worktree, branch and canonical dependency link remain for parent verification/integration; no main checkout, merge, push, PR, dependency/service/network write or shared-cache cleanup was performed. The exact correction commit is returned in the handoff. Parent integration must regenerate the combined wiki INDEX; no overall life-system/task34 approval is claimed.
