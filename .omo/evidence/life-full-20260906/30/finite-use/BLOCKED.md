# Finite-use B1 continuation - explicit scope blocker

- Executor: st_01a074ed; parent/root 01a0727b-398a-7481-b557-b198013542c1.
- Worktree: /home/main/z-project/rpg-zzu-life-full-p2-life-full-record-keys.
- Branch: agent/life-full-record-keys. Initial clean HEAD: 7c19e5edc5849e800db81b4af0c3f26504401bc1; tree 7c013a59633197ca8031b856e9b1dcd79dba5bff.
- Read full reviewer VERIFY first, approved Scope/task30, AGENTS/quickstart/wiki and existing finite FIFO tests. CLAUDE.md ignored. No previous quantity correction was redone.
- RED code/test tree: 071148d13c1192abce95b920c198ca2400b785aa. No production changes from initial HEAD at RED.
- Candidate code/test tree: 0f21f55ba6a2060a834b165f806fb89bf04d233c. Exactly two product-line changes: both itemUseCharges accumulators now Object.create(null). Existing lookup needs no extra own check because transitions always read these normalized internal dictionaries.

## New finding requiring authorization

The full requested Storage acceptance exposes the same numeric-setter cause in a third accumulator, outside the expressly allowed file:

```ts
// src/player/saveSlots.ts:973-980
function parseItemUseCharges(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const charges: Record<string, number> = {};
  for (const [itemId, charge] of Object.entries(value)) {
    if (typeof charge === "number" && Number.isFinite(charge)) charges[itemId] = charge;
  }
  return charges;
}
```

After the permitted two-line fix, actual imported authority collection preserves inventory4 and own charge2. Normalize and writer also preserve charge2. Storage reader drops it; apply of that reader output cannot reconstruct spent uses. Fresh ordinary/__proto__/constructor/toString all produce own numeric charges1..4 then no inventory/no charge on use5. Object.prototype descriptors stay unchanged.

`public-after-accumulators.json` records exactly four failing checks: __proto__ reader/apply with inventory1, and reader/apply after explicit claim collection with inventory4. All previous exact contribution/unknown/retry/ownership assertions remain in the extended probe and pass before its finite checks. Recommendation: authorize only changing parseItemUseCharges's numeric accumulator to Object.create(null), then rerun the same unchanged assertions and required validations. Do not workaround this in itemTransitions or infer missing charges.

## Commands and exact results

Every command uses the retained `run.mjs`: `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --signal=TERM --kill-after=15s <seconds>s ...`. Each JSON records exact argv, stdout/stderr separately, direct exit/signal, timestamps and trees. Logs are readable whitespace-trimmed views; JSON preserves exact output text. No failure receipt was overwritten.

| Receipt | Deadline | Result |
| --- | ---: | --- |
| red | 300s | exit1: 6 failed / 31 passed, new focused tests before product edits |
| public-red | 180s | exit1: 24 finite stage mismatches; actual shipping claim and Storage, all four IDs |
| diagnostics | 300s | exit1: source clean, three new test optional-owner typing errors |
| diagnostics-final | 300s | exit0: both changed TS files clean; four new JS syntax checks clean |
| final-green (attempted final, FAILED) | 300s | exit1: 179 passed / 2 failed across all eight requested suites |
| public-after-accumulators | 180s | exit1: four remaining reader/apply mismatches; all collection/depletion checks pass |
| typecheck | 300s | exit0: npm run typecheck:app |
| build | 600s | exit0: app/player SDK/standalone; task-only VITE_CACHE_DIR |
| cleanup | 60s | exit0: owned dist/cache/console outputs removed; no matching task processes |
| wiki-check | 120s | exit0: current INDEX check |
| wiki-verify | 120s | exit0: failures empty |

The attempted final test command includes lifeRecoveryRecordKeys, lifeRecovery, lifeRecoveryPersistence, p0SessionPersistence, p2SpatialPersistence, itemTransitions, p0CommerceFinalSafety and p0EconomySafetyFollowup. It ran once after the production edit; no timing retry. The two failures assert own __proto__ charge2 in the restored collection state and directly in Storage reader output. No assertions were deleted, skipped or weakened. The pre-build diagnostic correction adds explicit missing-owner failures/narrowing for optional save fields; it does not suppress types. All original 21 record-key tests and existing FIFO/limit/batch assertions are retained.

The probe is an extended copy of the original public-roundtrip.mjs in this new directory; original probe/evidence unchanged. It uses actual project serialize/deserialize, JSON.parse own numeric inputs, real Happy DOM Storage and SSR-imported shipping/recovery/save/use authorities, no fake successful result or prototype-setting literal. Its soft stage observer records every mismatch and fails the process if any exist, rather than truncating evidence at the first failure. Cleanup assertions run in finally even on RED.

Build warnings remain visible: missing optional proxy keys, circular cross-chunk recordPicker reexport, mixed static/dynamic imports, unresolved runtime assets/fonts and large chunks. No unrelated gates, full suites, UI journeys or remote writes were performed or claimed.

## Preservation and pending delivery

Only test/lifeRecoveryRecordKeys.test.ts, src/project/itemTransitions.ts and task30 SUMMARY are modified tracked files. New receipts/scripts live solely in finite-use/. No real-index staging or commit occurred; this is deliberately not represented as a verified correction commit. Matching wiki update, evidence-inclusive INDEX generation/staging, final passing run and post-commit check remain pending scope approval. Current wiki checks alone are not those final checks.

Both tracked .vite-cache files and root package.json are byte-identical to frozen base f86474547028cddf795c8e431b2195b7edccd201, with exact hashes in cleanup.json. No shared/tracked cache was removed. All task-owned temporary caches/processes are gone, Storage cleared, Happy DOM and Vite closed. The existing isolated worktree and uncommitted scoped candidate are retained for continuation rather than discarding the reproduction. Reviewer VERIFY, parent state/WISH/phase2 tree and other tasks were not edited or staged.

No native apply_patch executable is available; all authored file edits used an apply_patch shell function forwarding explicit unified patches to git apply --whitespace=error-all. Generated validator receipts use the retained runner. No reset/amend/history rewrite/push/PR/merge occurred.
