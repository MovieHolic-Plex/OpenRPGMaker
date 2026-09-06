# Task30 finite-use B1 independent reverification

Verdict: **confirmed**. Mandatory blockers: **0**.

B1 is corrected on actual candidate `6ac1eedb89c0fcefccfa585d2c00fd8b000daa4b`, evidence-inclusive tree `2f2814726f754865ea780ca790ccab4418001129`. This verdict supersedes the prior needs-fix verdict for quantity-correction parent `7c19e5edc5849e800db81b4af0c3f26504401bc1`, not its historical findings. The complete previous VERIFY is preserved verbatim below.

## Identity and scope

- Independent verifier: `st_01a07501`, 2026-09-06; parent/root `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2-life-full-record-keys`.
- Actual branch: `agent/life-full-record-keys`; HEAD/tree checked before execution and after cleanup, matching the candidate above.
- Original base: `f86474547028cddf795c8e431b2195b7edccd201`.
- Source and tracked evidence were clean initially and after execution/cleanup. This report is ignored and untracked, not a new commit or evidence-inclusive committed tree.
- Read full current SUMMARY, existing VERIFY, finite-use/BLOCKED, authorized command receipts and finalization receipts; approved plan Scope, recovery/save contracts and task30; AGENTS, quickstart, project map and relevant INDEX/wiki context. CLAUDE.md was ignored.

## Product and test assessment

The entire new product diff from quantity parent is exactly three initializer substitutions: `Object.create(null)` instead of `{}` for the two `itemUseCharges` accumulators in `src/project/itemTransitions.ts` and the numeric accumulator in `src/player/saveSlots.ts:parseItemUseCharges`. No blacklist, new schema, dependency, inferred charge, quantity limit, recovery policy or broader parser change exists in this diff.

Both transition entry paths normalize into these own-key dictionaries before reading absent charges. Consequently the existing `?? 0` lookup is sufficient: it cannot see inherited constructor/toString values. Real Storage parsing now preserves own __proto__ instead of invoking the ordinary-object setter. JSON/structuredClone may restore ordinary prototypes, but the next authority entry rebuilds the safe dictionary.

Read the full added sixteen deterministic cases (four groups times four IDs), the entire prior 21-case regression, and ordinary finite-use FIFO/limit/batch tests. A byte-prefix comparison after removing only the two added imports confirms all old regression content is retained verbatim. Git diff confirms other test files are unchanged. No sleeps, polling, test timeout increases, skipped/deleted assertions or mocked successful recovery/Storage were introduced.

Inspected the prior quantity correction: three contribution parse/retained/excess null-prototype accumulators, two inventory accumulators and the own-property quantity preflight. Inspected actual recovery collection -> changeItemsAtomically -> transitionItemStates callers, snapshot writer/reader/apply normalization and player successful-use caller. The new three lines preserve those existing ownership/atomicity contracts. The producer's final code/test projection `e2efc070d6792216d78eb03707a8b35a3fdcf3c2` has no src/test differences from actual HEAD (git diff exit0).

## Independently executed public behavior

Executed the complete retained `finite-use/public-roundtrip.mjs` as Node stdin, with its sole substitution `/tmp/st_01a074ed-public-` -> `/tmp/st_01a07501-public-`. No producer source or receipt was overwritten. It imports actual Vite SSR public authorities, actual project serialize/deserialize and real Happy DOM Storage. There is no fake claim collection or reader/writer.

All four IDs (`ordinary`, `__proto__`, `constructor`, `toString`) are accepted by the actual project roundtrip, including consumable:true and consumptionLimit:5. All **60 finite stage checks passed**, finiteFailures was empty, and Object.prototype descriptors remained unchanged.

| Actual case, for every ID | Observed result |
| --- | --- |
| Inventory1 / JSON-owned charge2, normalize -> writer -> Storage reader -> apply | Own inventory1 and own numeric charge2 at all four stages |
| Actual shippingQueue3 -> recovery:1 | Shipping source removed, claim items exactly3; inventory1/charge2 unchanged |
| Explicit collection of recovery:1 | Own inventory4/charge2; claims empty; nextSequence2 |
| Duplicate collection | missing-claim; no second payout |
| Collected state, normalize -> writer -> reader -> apply | Own inventory4/charge2 at all four stages |
| Fresh successfulUse1,2,3,4 | Inventory1 and exact own numeric charges1,2,3,4 |
| Fresh successfulUse5 | No inventory owner and no charge owner |

The same public execution retained the original exact JSON __proto__ contribution parse assertion; contribution5 -> retained2 + claim3; two reconciliation/roundtrip retries; explicit payout once; unknown original preservation and refused collection without mutation; two unknown retries; returning definition without automatic payout; explicit payout only after return. Writer input and Storage bytes remain unchanged by writer and reader/apply respectively. These are executed ownership assertions, not merely printed values.

The 37-case record-key suite additionally executes FIFO tail removal for every ID (remove3 from inventory4/charge2 leaves inventory1/charge2, then remove1 clears both), full-inventory claim rejection with identical serialized state, invalid negative grant preserving count/cursor, malformed negative source rejection at Storage/direct apply with disk bytes intact, and unsafe-sequence writer rollback. Ordinary FIFO, lowered limits, ordered batches, caps, quota and day/persistence safety assertions also remain in the eight passing suites.

## Independent commands and real exits

Every heavy command was executed serially through `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --signal=TERM --kill-after=15s <deadline>s ...`. Captured subprocess return codes directly, not a pipeline's last command. Deadlines were fixed in advance; no retry-to-green, sleeps, polling, timeout escalation or full unrelated suite.

| Inner command | Deadline | Actual exit / result | Wall seconds |
| --- | ---: | --- | ---: |
| `node .omo/evidence/life-full-20260906/30/finite-use/diagnostics.mjs` | 300s | 0; empty syntactic/semantic diagnostics for both changed product files and regression test; four JS syntax checks exit0 | 8.68 |
| Exact eight-file npm command below | 300s | 0; **181/181 tests, 8/8 files**, single run | 15.12 |
| `node --input-type=module`, retained public probe cache-only substitution above | 180s | 0; 60 finite checks pass, ownership assertions pass | 4.92 |
| `npm run typecheck:app` | 300s | 0 | 35.41 |
| `env VITE_CACHE_DIR=/tmp/st_01a07501-build-cache npm run build` | 600s | 0; app, player SDK, standalone | 84.49 |
| `npm run openwiki:index -- --check` | 120s | 0; evidence-inclusive candidate INDEX current | 0.55 |
| `npm run openwiki:verify` | 120s | 0; ok:true, failures:[] | 0.19 |

```sh
npm test -- test/lifeRecoveryRecordKeys.test.ts test/lifeRecovery.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/itemTransitions.test.ts test/p0CommerceFinalSafety.test.ts test/p0EconomySafetyFollowup.test.ts --maxWorkers=2 --minWorkers=1
```

No alternative Vitest config, cache flag or test timeout was added to this exact requested command. Test totals: record keys37, recovery54, recovery persistence40, P0 session9, P2 spatial3, item transitions4, commerce final safety16, economy followup18. Vitest reported duration14.38s. Compiler-API diagnostics preceded typecheck and build.

Build success is not warning-free: missing optional proxy keys, recordPickerPanel/recordPickerDialog circular cross-chunk reexport, mixed static/dynamic imports, unresolved runtime fonts/assets and chunks over500kB remain in actual stderr. These are also present in producer build history; none were suppressed or changed. This scoped approval does not claim full gates, a player.html UI journey, remote writes or integration approval.

## Historical failures are retained, not relabeled

- Previous verifier's B1 RED on quantity parent remains in full below, including charge erasure on collection/save and inherited-function fresh charges. It was not rerun on an old tree in this verification.
- Producer finite-use `red`: exit1, **6 failed / 31 passed**; `public-red`: exit1, 24 finite mismatches, before the cursor fixes.
- Producer `final-green` is a **failed attempted final run**, exit1, **179 passed / 2 failed**, on the two-accumulator-only candidate. Expected own __proto__ charge2 was actually absent. `public-after-accumulators` exit1 records exactly four remaining reader/apply mismatches (inventory1 and inventory4). BLOCKED.md remains unchanged.
- The authorized third parser initializer change resolves that observed boundary. Authorized final receipts report 181/181 and public exit0 on the final code/test projection; this independent execution confirms those results on actual committed HEAD.
- Earlier quantity RED8/13, observer failure, test diagnostics failure and tracked-cache cleanup mistake remain historical evidence, not green executions.

## Cleanup and integrity

The public finally block reported storageEntries0, windowClosed:true after awaited Happy DOM close, viteClosed:true, cacheExists:false, httpListenerStarted:false and remoteWrites0. Its unique verifier cache was removed. No browser/listener was launched. A final /proc scan found no target-root Node/Vitest/Vite runtime processes left by these executions.

Dist was absent before execution and contained no tracked files; only this build's generated dist was removed afterward. The verifier build cache is absent; no verifier public cache remains. Shared node_modules and tracked/shared caches were not deleted. The exact npm test may update its normal shared result cache; it was deliberately not cleaned or restored. No product/test/wiki, parent tree, producer receipt, baseline or WISH edits, staging, commits, pushes, PRs or integration occurred.

Before and after execution, these three files were byte-compared with original base f8647454 (all identical):

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `.vite-cache/deps/_metadata.json` | 146 | `eb92c7299e3ca1a241fff3664422f1a7821a242b763935b799631990183f8edc` |
| `.vite-cache/deps/package.json` | 23 | `3ca9d4afd21425087cf31893b8f9f63c81b0b8408db5e343ca76e5f8aa26ab9a` |
| `package.json` | 5406 | `b712911d186b12c954dfecb278451f6a6fae255ab0f9d8e25529dc90dcce6211` |

Cleanup/integrity Python command, `git diff --exit-code HEAD` and `git diff --check` all exited0 before report delivery. Producer tracked evidence is unchanged. The sole deliverable is this VERIFY.md, prepended via an `apply_patch` shell wrapper over `git apply --whitespace=error-all` because no native apply_patch executable is installed. The parent must explicitly retain this ignored report; it is not staged.

## Preserved prior verification (historical, quantity parent only)

Everything below is the previous report verbatim. Its needs-fix verdict applies to 7c19e5ed, not the independently confirmed 6ac1eedb candidate above.

---

# Task30 independent verification

Verdict: **needs-fix**

Mandatory blockers: **1 (B1: finite-use numeric record keys remain unsafe)**.

The contribution/parser/recovery quantity correction passes its targeted tests and public roundtrips. Approval is blocked because the immediate inventory transition still drops an existing own `__proto__` finite-use cursor during successful explicit recovery collection and save normalization. Fresh reserved-name finite consumables also fail to deplete. This is the same ordinary-object numeric dictionary/setter/inherited-value cause in the already changed inventory module, not a request for a broad inventory redesign.

## Verified target and scope

- Verifier task: `st_01a074e1`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Date: 2026-09-06.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2-life-full-record-keys`.
- Branch supplied: `agent/life-full-record-keys`.
- Actual HEAD, checked before and after execution: `7c19e5edc5849e800db81b4af0c3f26504401bc1`.
- Actual evidence-inclusive committed tree: `7c013a59633197ca8031b856e9b1dcd79dba5bff`.
- Frozen base: `f86474547028cddf795c8e431b2195b7edccd201`, tree `8386dd1efe4338f705d6a7accdbdefaa3b0beb6a`.
- Candidate was clean before verification and remained clean after executions/cleanup, before this new report. This report is not committed; no evidence-inclusive commit containing this report is claimed.

Read the approved plan's Scope, recovery/save contracts and task30 at `/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/plans/life-systems-full-implementation.md`; task30 SUMMARY; all three changed source files in full; the full 131-line regression test; immediate recovery, save and finite-use callers; quantity safety tests; retained probe sources and receipts. CLAUDE.md was ignored.

Scope reconstructed: arbitrary valid JSON item and bundle keys must keep positive quantities in parser, compatible retention, retained/excess separation, recovery, inventory transitions, writer, reader, apply and repeated reconciliation. Unknown definitions must preserve original evidence without inferred or automatic payment; returning definitions require explicit collection. Ordinary IDs, capacity/invalid-count atomicity, FIFO finite-use ownership and Object.prototype descriptors must remain correct.

The product diff is limited to null-prototype contribution parsing/retained/excess dictionaries, null-prototype inventory dictionaries in both transition normalizers, and an own-property inventory preflight lookup in `changeItemsAtomically`. Outer contribution records use computed properties/spreads; recovery uses own-source/own-claim checks and Map aggregation. Those mechanisms do preserve nested reserved bundle/item keys. JSON/structuredClone/entries consumers do not require inventory prototype methods. The uncovered problem is the neighboring numeric `itemUseCharges` dictionaries, not incompatibility with null-prototype inventory itself.

## B1 - finite-use cursors are erased or read from Object.prototype

**Location:** `src/project/itemTransitions.ts:86-92,113-115,129-142`; immediate callers `src/project/session.ts:617-619`, `src/project/lifeRecovery.ts:collectLifeRecoveryClaim`, `src/player/saveSlots.ts:286,489-494`, and `src/player/playerItemUse.ts:260-263`.

Both `sanitizeItemState` and `normalizeItemState` still create `itemUseCharges` as `{}` and assign arbitrary item IDs into it. `successfulUse` reads `state.itemUseCharges[item.id] ?? 0` without own-property isolation. Consequences independently executed on the actual candidate:

1. **Explicit collection resets an existing FIFO cursor.** A known consumable `__proto__`, limit5, inventory1, JSON-owned charge2, shipping claim3 successfully moves and collects `recovery:1`. Inventory becomes4 and the claim is consumed, but `itemUseCharges` becomes `{}` instead of retaining own `__proto__:2`. The source-to-claim and claim-to-inventory actions both return success. This directly affects task30's inventory1+claim3 path, which its regression currently tests only without a finite-use cursor.
2. **Normalization and save/resume erase spent uses.** The actual project `serialize -> deserialize` accepts the consumable ID and preserves `consumable:true, consumptionLimit:5`. Starting inventory1/own charge2, actual `normalizeItemTransitionState`, snapshot writer, Storage reader and apply each produce inventory1 with no own charge for `__proto__`. The live writer input remains unchanged, but the saved state has lost the cursor.
3. **Fresh reserved-name finite items do not deplete.** Five actual `transitionItemState(..., {kind:"successfulUse"})` calls with inventory1 and no own charge leave inventory1 for `__proto__`, `constructor`, and `toString`. `__proto__` never gets an own charge. `constructor` and `toString` get strings derived from inherited functions rather than numeric charge1; normalization prunes them before each subsequent use, which repeats the same error. Ordinary control items record charges1,2,3,4 and deplete on use5.

Object.prototype descriptors stayed byte-for-value equivalent under descriptor comparison; this failure is record ownership/finite-use corruption without global prototype mutation.

**Required correction:** make both finite-use cursor numeric accumulators safe for arbitrary own IDs and ensure absent reserved-name charges behave as zero. Add deterministic behavioral coverage for existing cursor preservation through explicit recovery collection and writer/read/apply, plus fresh successful-use depletion for ordinary and reserved IDs. Preserve FIFO, limits and rollback; do not blacklist otherwise accepted IDs or weaken assertions. Reverify the scoped suites and public paths. No product or test correction was made by this verifier.

### Independently executed RED evidence

Finite-use probe command: `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --signal=TERM --kill-after=15s 180s node --input-type=module`, with the inline module reproduced below. Actual exit **1**, four failing case groups; no retry.

| ID | Charge2 at normalize / writer / reader / apply | Five fresh successful uses | Result |
| --- | --- | --- | --- |
| ordinary | 2 / 2 / 2 / 2; quantity1 throughout | charges1,2,3,4, then no item/no charge | pass |
| __proto__ | absent / absent / absent / absent; quantity1 throughout | own charge absent on all five; quantity1 remains | FAIL twice |
| constructor | 2 / 2 / 2 / 2; quantity1 throughout | `function Object() { [native code] }1` on all five; quantity1 remains | FAIL |
| toString | 2 / 2 / 2 / 2; quantity1 throughout | `function toString() { [native code] }1` on all five; quantity1 remains | FAIL |

Separate actual explicit-claim probe, same lock and 180s deadline, exited **1** with this output (no retry):

```json
{"case":"finite-explicit-claim","before":{"inventory":{"__proto__":1},"itemUseCharges":{"__proto__":2}},"moved":{"ok":true,"claimIds":["recovery:1"]},"collected":{"ok":true,"claimIds":["recovery:1"]},"after":{"inventory":{"__proto__":4},"itemUseCharges":{},"lifeRecovery":{"nextSequence":2,"claims":{}}},"expected":{"inventory":{"__proto__":4},"itemUseCharges":{"__proto__":2}},"objectPrototypeDescriptorsUnchanged":true}
{"cleanup":{"viteClosed":true,"cacheAbsent":true}}
```

The final assertion was `assert.equal(s.itemUseCharges['__proto__'],2,'Explicit claim collection must preserve the existing FIFO charge2')`. Actual failure:

```text
AssertionError [ERR_ASSERTION]: Explicit claim collection must preserve the existing FIFO charge2
+ actual - expected
+ [Object: null prototype] {}
- 2
```

The actual value shown is the inherited Object.prototype object, not an own charge. The setup used `normalizeItemRecord({id:'__proto__',name:'finite',consumable:true,consumptionLimit:5,scope:'none',price:1})`, `startSession(p,30)`, and JSON.parse for inventory `{"__proto__":1}`, itemUseCharges `{"__proto__":2}`, shippingQueue `{"__proto__":3}`. It called actual `moveLifeRecoverySource(p,s,{sourceKind:'shippingQueue',sourceId:'__proto__',reason:'disabled'})` then `collectLifeRecoveryClaim(p,s,'recovery:1')` through Vite SSR imports. A unique `/tmp/st_01a074e1-claim-*` cache was closed and removed in finally.

## Confirmed contribution/recovery behavior

The new regression's **21 tests pass**, within the required **131/131 tests across six files**. No fixed sleep/polling or timing-dependent assertion was introduced in that regression; Happy DOM close is awaited by the afterAll hook. The related ordinary FIFO tests pass but do not cover B1's reserved finite-use cases.

Executed the actual retained `reserved-key-probe.mjs` and `public-roundtrip.mjs` after reading them, using no-file stdin equivalents with only each cacheDir declaration replaced by a unique verifier-owned `/tmp/st_01a074e1-public-*` path. All assertions/module imports were unchanged. Both exit **0**. Producer sources and receipts were not overwritten.

- Exact input `{"bundleContributions":{"bundle":{"__proto__":1}}}` produces own quantity1; directOwner true, unresolvedOwner false.
- Actual project serialize/deserialize accepts `ordinary`, `__proto__`, `constructor`, and `toString` as item and bundle IDs. The finite-use probe additionally uses the deserialized project, retaining its finite consumption contract.
- Fully compatible requirement5 retains source5 and creates no claim in the regression.
- Requirement2 splits contribution5 into retained2 + claim3. Writer, reader and apply agree; two more reconciliation/save/read/apply cycles preserve that ownership and sequence.
- Explicit collection pays exactly3, consumes the claim once, preserves source2 and nextSequence2; the duplicate collection reports missing-claim.
- Existing inventory1 plus direct shipping claim3 becomes4 and survives roundtrip for all four IDs, absent a finite cursor; B1 qualifies the broader contract.
- Unknown item definitions preserve full original contribution JSON in unresolved evidence with proven claim amount5, no inventory payment, unchanged state on refused collection and two repeated cycles. Returning definitions still pay nothing during roundtrip; explicit collection then transfers5 exactly once.
- Unsafe sequence/capacity writer failure preserves input. Malformed negative quantities produce corrupt Storage reads/direct-apply rejection and leave original disk bytes unchanged. Full inventory collection fails atomically, retaining claim and inventory.
- Object.prototype descriptors are unchanged throughout. Absent inherited inventory values are not counted as quantities by the fixed preflight/transition dictionaries.

## Historical RED authenticity and provenance

This verifier did **not** execute the frozen old product tree and does not claim a new historical RED run. The retained exact evidence was inspected:

- `public-red.json`: actual recorded base HEAD/tree, code/test tree `c16d8e5d0757d4eb09c0f1a47fed9098004b2ef5`, command and exit1.
- `reserved-key-probe.initial.mjs` and `public-red.log`: exact raw input above, actual `{"bundleContributions":{"bundle":{}}}`, directOwner false, unresolvedOwner false, and assertion `A positive source amount must retain an owner or explicitly refuse parsing`.
- `red.json` / `red.log`: 8 failed / 13 passed before the product correction, including parse loss, compatible/split/unknown `__proto__` loss, inherited-name collection refusal and existing inventory stack loss.
- Git comparison confirms the retained RED tree has no source changes from frozen base. RED-to-final code/test tree has exactly the three product-file changes plus the test cleanup hook change from `window.close()` to `window.happyDOM.close()`; no assertion weakening. Final verified code/test tree `7cecb337c4de1a3ef732bc1161cf5f5551aa5e89` has no src/test difference from the candidate.
- Decoded all six base64 entries in `raw-command-output.json`, verified each SHA-256, and verified its readable .log is exactly the raw text after trailing-whitespace/final-blank-line formatting only. This includes the RED log (SHA-256 `d11c3cebe64310d80c28238d0f1399b08b1c7b923ef2efb998121b69e4fa7c84`).
- The producer's initial public-roundtrip observer failure, initial tracked-cache cleanup mistake, and later correction receipts remain retained. They were not treated as successful original executions or overwritten by this verification.

## Commands actually executed on the candidate

All heavy commands used `flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --signal=TERM --kill-after=15s <deadline>s ...`; command deadlines were fixed in advance. No timeout increases or retry-to-green. Results below are independent executions, not copied producer pass claims.

| Command inside lock/deadline | Deadline | Actual result |
| --- | ---: | --- |
| `node .omo/evidence/life-full-20260906/30/diagnostics.mjs` | 300s | exit0; empty syntactic/semantic diagnostics for all three source files and regression test; all five evidence-script syntax checks exit0 |
| `npm test -- test/lifeRecoveryRecordKeys.test.ts test/lifeRecovery.test.ts test/lifeRecoveryPersistence.test.ts test/p0SessionPersistence.test.ts test/p2SpatialPersistence.test.ts test/itemTransitions.test.ts --maxWorkers=2 --minWorkers=1` | 300s | exit0; 131/131, six files; 13.09s reported duration |
| `npm test -- test/p0CommerceFinalSafety.test.ts test/p0EconomySafetyFollowup.test.ts --maxWorkers=2 --minWorkers=1 --no-cache` | 240s | exit0; 34/34, two files; 7.44s reported duration |
| `npm run typecheck:app` | 300s | exit0 |
| Reserved-key stdin probe, cache-only substitution described above | 120s | exit0; own quantity1 retained |
| Public-roundtrip stdin probe, cache-only substitution described above | 180s | exit0; four IDs and cleanup assertions pass |
| Inline finite-use probe below | 180s | **exit1; B1 reproduced in four case groups** |
| Inline explicit finite-use recovery probe described above | 180s | **exit1; B1 reproduced during successful claim collection** |
| `env VITE_CACHE_DIR=/tmp/st_01a074e1-build-cache npm run build` | 600s | exit0; app, player SDK and standalone bundles built |
| `npm run openwiki:index -- --check` | 120s | exit0 on the final evidence-inclusive candidate; INDEX current |
| `npm run openwiki:verify` | 120s | exit0; ok true, failures empty |

Compiler-API diagnostics were run before the build. No stale LSP result was substituted. Build success was **not warning-free**: optional API proxy keys absent; circular cross-chunk reexport warning for recordPickerPanel/recordPickerDialog; mixed dynamic/static imports for playSceneInterpreter, editorUiMode, devProjectPersistence, audio and player; unresolved runtime fonts/generated image references in player/standalone; chunks above500kB. These outputs remained visible. No unrelated full suite, gates baseline changes, UI journey or remote writes were performed or claimed. Two early exploratory shell listings returned exit2 for absent optional paths; these were not validator results and did not drive a product edit.

## Cleanup and file integrity

- Each verifier SSR server was middleware-only, watch disabled, HMR off, and closed in finally. No HTTP listener was started.
- Both Happy DOM windows used by verifier probes had Storage cleared and `await window.happyDOM.close()` completed; public probe reported windowClosed true and storageEntries0. The finite-use failing probe also reported windowClosed true, storageEntries0, viteClosed true, cacheAbsent true before exit1.
- Unique public, finite and explicit-claim caches were removed by their owners after server close. Final `/tmp/st_01a074e1-*` scan found no remaining entries.
- `dist` was absent before the build, had no tracked files, and was removed after the successful build. The specified build cache was absent at cleanup. No tracked/shared caches were deleted; shared node_modules, provisioned env and worktree were retained.
- Final /proc scan found no remaining target-root SSR Node, Vitest/Vite or TypeScript server processes matching the verifier's execution surfaces. No language server was launched by this verifier.
- `git diff --check` and `git diff --exit-code HEAD -- .omo/evidence/life-full-20260906/30 src test openwiki .vite-cache` were exit0 before writing this report. All 50 producer task30 evidence files remained tracked and unchanged.
- Both tracked cache files were byte-compared to frozen base before and after verification:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `.vite-cache/deps/_metadata.json` | 146 | `eb92c7299e3ca1a241fff3664422f1a7821a242b763935b799631990183f8edc` |
| `.vite-cache/deps/package.json` | 23 | `3ca9d4afd21425087cf31893b8f9f63c81b0b8408db5e343ca76e5f8aa26ab9a` |

Only this VERIFY.md is delivered. No source/test/wiki edit, producer receipt overwrite, staging, commit, PR, push, merge, baseline update or test weakening occurred. Parent integration/cherry-pick approval remains blocked on B1.

## Final report-delivery check

After writing this report, the actual branch was confirmed as `agent/life-full-record-keys`, tracked diff/check remained exit0, and the final INDEX check again exited0 with the report present. A verifier bookkeeping assertion expecting `?? VERIFY.md` in git status failed (exit1): `.gitignore:19` ignores `.omo/evidence/*`. `git check-ignore -v` established that cause, and direct file inspection confirmed this report exists while all tracked files remain unchanged. This is an ignored, unstaged delivery file; the parent must explicitly include it if retaining it in git. No ignore rule or producer file was changed to hide that bookkeeping failure.

## Executed finite-use probe source

The following was passed directly to Node stdin in the candidate working directory under the 180s locked command above; it created no probe file.

```js
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { Window } from 'happy-dom';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
const cacheDir=mkdtempSync('/tmp/st_01a074e1-finite-');
const root=process.cwd();
const window=new Window();
const server=await createServer({configFile:false,root,cacheDir,resolve:{alias:{'@':`${root}/src`}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,watch:null,hmr:false},appType:'custom'});
const prototype=Object.getOwnPropertyDescriptors(Object.prototype);
let failures=0;
const own=(r,k)=>Object.hasOwn(r??{},k)?r[k]:null;
try {
 const {createBlankProject}=await server.ssrLoadModule('/src/project/defaults.ts');
 const {normalizeItemRecord}=await server.ssrLoadModule('/src/project/databaseRecordModel.ts');
 const {startSession}=await server.ssrLoadModule('/src/project/session.ts');
 const {normalizeItemTransitionState,transitionItemState}=await server.ssrLoadModule('/src/project/itemTransitions.ts');
 const {createSaveSnapshot,saveToSlot,readSaveSlot,applySaveSnapshot}=await server.ssrLoadModule('/src/player/saveSlots.ts');
 const {serialize,deserialize}=await server.ssrLoadModule('/src/project/io.ts');
 for(const id of ['ordinary','__proto__','constructor','toString']) {
  let project=createBlankProject();
  project.database.items.push(normalizeItemRecord({id,name:id,scope:'none',price:1,consumable:true,consumptionLimit:5}));
  project=deserialize(serialize(project));
  const item=project.database.items.find(i=>i.id===id);
  assert.equal(item.consumable,true);assert.equal(item.consumptionLimit,5);
  const session=startSession(project,30); session.inventory=JSON.parse(`{${JSON.stringify(id)}:1}`);session.itemUseCharges=JSON.parse(`{${JSON.stringify(id)}:2}`);
  const before=JSON.stringify(session);
  const normalized=normalizeItemTransitionState(session,project.database.items);
  const snapshot=createSaveSnapshot(project,session);assert.equal(JSON.stringify(session),before);
  assert.equal(saveToSlot(window.localStorage,1,snapshot).ok,true);
  const read=readSaveSlot(window.localStorage,1);assert.equal(read.kind,'present');
  const applied=applySaveSnapshot(project,read.snapshot);
  const counts=[normalized,snapshot.session,read.snapshot.session,applied].map(s=>({quantity:own(s.inventory,id),charge:own(s.itemUseCharges,id)}));
  const pass=counts.every(s=>s.quantity===1&&s.charge===2);if(!pass)failures++;
  console.log(JSON.stringify({case:'partial-charge-roundtrip',id,authoredContractAccepted:true,expected:{quantity:1,charge:2},stages:['normalize','writer','reader','apply'],actual:counts,pass}));
  let fresh={inventory:{[id]:1},itemUseCharges:{}};const stages=[];
  for(let use=1;use<=5;use++){fresh=transitionItemState(fresh,project.database.items,{kind:'successfulUse',itemId:id});stages.push({use,quantity:own(fresh.inventory,id),charge:own(fresh.itemUseCharges,id)});}
  const depleted=!Object.hasOwn(fresh.inventory,id);if(!depleted)failures++;
  console.log(JSON.stringify({case:'fresh-five-successful-uses',id,expectedFinalQuantity:0,actual:stages,pass:depleted}));
 }
 assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype),prototype);
 console.log(JSON.stringify({failures,objectPrototypeDescriptorsUnchanged:true}));
 process.exitCode=failures?1:0;
}finally{window.localStorage.clear();await window.happyDOM.close();await server.close();rmSync(cacheDir,{recursive:true});console.log(JSON.stringify({cleanup:{windowClosed:window.closed,storageEntries:window.localStorage.length,viteClosed:true,cacheAbsent:!existsSync(cacheDir)}}));}
```
