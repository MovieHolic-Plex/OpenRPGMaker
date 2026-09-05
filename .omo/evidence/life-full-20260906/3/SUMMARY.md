# Task3: recoverable life transaction evidence

Task3 is implemented and verified as one local atomic increment on `agent/life-full-p2`.
This replaces the stale blocked producer SUMMARY; it does not rewrite the previous independent VERIFY.
The parent must obtain fresh task3 verification before starting task4.

## Identity and entry gate

- Task: `st_01a073c7`; parent/root: `01a0727b-398a-7481-b557-b198013542c1`.
- Worktree: `/home/main/z-project/rpg-zzu-life-full-p2`.
- Evidence directory: `/home/main/z-project/rpg-zzu-life-full-p2/.omo/evidence/life-full-20260906/3/`.
- Base HEAD: `f1024a2202ab6205591af630aeb53b0bc3445669`.
- Base tree: `20ff00cebb72c149653294bd0320453706783403`.
- Verified code/tests/wiki tree, before evidence: `fc0b6997f212a48fd7c2e7417470a0a64f8109c9`.
- Atomic commit subject: `feat(life): preserve recoverable transaction claims`.
- Implementation commit lookup: `git log -1 --format=%H -- src/project/lifeRecovery.ts`.
  This SUMMARY is included in that same commit, so it uses the immutable product tree and lookup rather than a circular self-hash.
- Before ANY edit, read task2 VERIFY: **confirmed, acceptance0, blockers0**, verified exact HEAD above.
  `git merge-base --is-ancestor f1024a2202ab6205591af630aeb53b0bc3445669 HEAD` exited0; HEAD also equaled it.
- Read the full approved Scope and task3, previous task2 SUMMARY/VERIFY and stale task3 SUMMARY/VERIFY,
  AGENTS, quickstart, PROJECT_WIKI, focused runtime guidance, programming/TypeScript, debugging and git-master.
  All CLAUDE.md ignored. No parent plan, Boulder or other-task source edited.
- Target began clean. No upstream configured. Node v24.11.1, installed repository npm/dependencies,
  inherited DEV_SERVER_PORT=9841. No dependency installation or HTTP listener was needed.

## Actual changes

| Path | Responsibility |
| --- | --- |
| `src/project/session.ts` | Optional recovery state/claim/JSON types, maker contract, runtime-only spatial payment and decoration recovery item receipt types. |
| `src/project/lifeRecovery.ts` | Bounded state/JSON validation and draft-atomic source-to-claim and explicit claim-to-inventory transactions. |
| `src/project/makers.ts` | Copy actual inputs, promised outputs, duration and resolved time basis at successful start; pay the frozen promise while retaining legacy current-definition jobs. |
| `src/player/saveSlotValidation.ts` | Export the recovery boundary predicate; validate optional new maker contracts and their deadline/duration consistency. Existing equipment validation is unchanged. |
| `test/lifeRecovery.test.ts` | 53 deterministic boundary, ownership, cancellation, malformed-input, legacy and resume tests. Existing p0Makers tests remain unchanged. |
| `openwiki/runtime-sessions.md`, generated `openwiki/INDEX.md` | Explain implemented foundation and explicitly distinguish later persistence/UI wiring. |

### Recovery contracts

- `lifeRecovery = {nextSequence, claims}`; claims carry `id`, `sourceKind`, `sourceId`, `reason`,
  item amounts and optional `{record, detail}` unresolved JSON. IDs are canonical `recovery:N`, beginning at1.
  Sequence is a positive safe integer, always above every retained claim sequence. Receiving never rewinds it.
  Duplicate IDs under different keys, noncanonical keys and stale/unsafe sequence fail validation.
- At most **4096 claims**, **64 distinct items per claim**, positive safe counts at most **9,999,999**.
  Large proven quantities split into capped claims. A 65-item source splits64+1.
  Failure to fit the complete conversion preserves source, inventory, claims and sequence; no trimming.
- Unresolved raw JSON is at most **64 KiB UTF-8 including JSON encoding**, total serialized recovery state
  at most **8 MiB**. Tests accept each exact boundary and reject the next byte. Unicode is measured in
  UTF-8, not string length. JSON traversal rejects cycles, sparse arrays, nonfinite numbers, undefined,
  accessors and symbol properties without silently dropping them; shared serializable values remain valid.
- Source ownership is selected by an explicit session field plus source ID, never detached caller-provided
  quantities. Equal IDs in shipping and bundle records remain distinct sources. Once removed, a repeated
  request cannot reissue a claim. Inherited `constructor`/`__proto__` names are not owned records.
- Move checks the complete candidate recovery state before committing source removal plus claims on a draft.
  Receipt uses the existing real `changeItemsAtomically` on a cloned session and commits payout plus claim
  removal together, including item-use and collection state. Inventory overflow or malformed collection
  metadata leaves the whole session unchanged.
- Unknown item amounts retain their original source JSON. Receipt pays zero while the item is undefined;
  redefining the item alone changes nothing. Only a later explicit receipt pays. Unproven/empty evidence
  never pays. Completed bundle receipt IDs refuse refunds and remain untouched.

### Maker and spatial boundaries

- A new job copies the successfully consumed inputs and promised outputs rather than retaining definition
  array references. Its duration and resolved dayStartHour/dayEndHour/daysPerSeason are stored with it.
  Editing outputs2 to9 or the duration does not change that job; the next job uses the new definition.
- Existing jobs without contracts retain current-definition payout and existing absolute deadlines.
  New contracts survive the existing compatible writer -> parser -> apply path; resume pays2 rather than
  edited9 while leaving the original live job unchanged. Overflow/missing promised item preserves the ready job.
- The explicit cancellation primitive accepts a cutoff in the ORIGINAL job time basis: at39 before deadline40
  it moves the frozen inputs3; at40 it moves only outputs2, even after the maker definition is deleted.
  Malformed new evidence is rejected; missing legacy definitions preserve the full original job unresolved,
  with no guessed historical refund. Automatic deletion/package/time-basis reconciliation is task4 wiring,
  not claimed here.
- Runtime `FarmBuildingPlacementState.paymentReceipt` and `HomeDecorationPlacementState.paymentReceipt`
  carry actual paid `{gold,items}`; decoration state can also retain `recoveryItem`. All are optional so
  legacy/authored placements do not invent payment. Old spatial records can be retained unresolved.
  Transaction receipt capture, gold/spatial refund policy and connected housing remain downstream.

**Scope limit:** recovery state persistence, lossy-filter replacement, partial donation excess,
clock-path wiring, ledger UI and full player journeys are NOT implemented by task3.
The new recovery predicate is ready for task4; current Save5 does not yet serialize recovery claims.
This report does not mislabel a boundary-predicate test as a full recovery slot roundtrip.
No general event-sourcing framework, automatic payout, guessed refund or silent claim trimming was added.

## RED/GREEN and verification receipts

`commands.json` records exact commands, bounds, exits and tree. Every runnable validator below captured
its actual child exit, not a pipeline's tail status. No monitor tool was available.
Readable logs trim only trailing whitespace; `raw-output.json` preserves exact original output and SHA256.

| Receipt | Result |
| --- | --- |
| `red.log`, `red.json` | Before production edits: required two-file command, **4 failed /9 passed**, exit1. New job had no contract; edited definition paid9 rather than2; malformed contract was accepted; recovery predicate absent. Legacy characterization and all8 p0Makers tests passed. No missing-module import failure was used as RED. |
| `initial-green.log` | Initial increment: **54 passed**, exit0. Not substituted for final expanded coverage. |
| `adversarial-red.log` | **2 failed /58 passed**, exit1: a malformed maker's valid opposite side could be refunded, and a200,000-entry JSON array overflowed argument spreading. Fixed by whole-contract validation and bounded-stack iteration. |
| `json-red.log` | **1 failed /60 passed**, exit1: a global visited set rejected a serializable shared object. Replaced with path-local ancestry tracking and own-data-property inspection. |
| `green.log`, `green.json` | `npm test -- test/lifeRecovery.test.ts test/p0Makers.test.ts`: **2 files /61 passed /0 failed /0 skipped**, one final execution, exit0. Both named files exist and actually ran. |
| `related.log` | Eight related persistence, ledger and day-transition files: **35 passed /0 failed /0 skipped**, exit0. No unrelated assertion weakened or test skipped. |
| `diagnostics.log` | Direct TypeScript language-service syntactic+semantic diagnostics on all five changed TS files: **0**, exit0. Direct LSP calls also returned no diagnostics. |
| `typecheck.log` | `npm run typecheck:app`: exit0, after diagnostics. |
| `public-probe.log`, `ownership.json` | Real Vite SSR public imports and happy-dom Storage: frozen maker save/read/apply payout; actual source/claim/inventory move; overflow rollback; duplicate receipt refusal; unknown preservation; malformed recovery boundary input unchanged. Exit0. |
| `build-timeout.log` | Initial full build hit its300-second bound, exit124. App/player/SDK finished, but standalone had only been invoked: NOT a successful full build. |
| `build.log` | After inspecting process/resource state and unchanged standalone config, full command with900-second bound completed in**342.94s**, actual child exit0. App, player/SDK and standalone all built. No source/config was changed to absorb the timeout. |
| Tool results | `npm run openwiki:verify`, `npm run openwiki:index -- --check`, `git diff --check`, staged diff check: all exit0. |

The build timeout was a bound failure, not a diagnosed source defect. Inspection found multiple unrelated
worktree test/browser/compiler processes and about26 GiB used swap; none was stopped. The completed full
build needed more than the original300 seconds, corroborating the bound adjustment. Build output retains
runtime-resolved asset URL, mixed static/dynamic import and large-chunk warnings; no warning suppression.
An initial guidance-directory search timed out at30 seconds and is not treated as complete validation.
The first manually counted test patch failed with unexpected end-of-file, exit2, and created no file;
the generated unified patch applied successfully before the actual RED run. Two newly authored fixture
field names were corrected to the real CollectionProgress and placement types; negative-count/raw-preservation
assertions were retained, and final language-service verification checks the corrected tests.

## Public surface and adversarial keys

The task's real surface is its public transaction/boundary API. The executable probe imports actual
session, makers, recovery, validation and save modules; it does not mock these targets or inject successful
results. Fixture inventory is unit/probe input, not proof of earned gameplay resources. No player.html
or full51 journey is claimed.

- **cancel/resume:** cutoff39/40 selects inputs/outputs; actual maker Save5 read/apply resumes the original
  promise after definition edits. Legacy/unproven cancellation remains unresolved.
- **malformed:** bad counts, unsafe sequence, duplicate IDs/items, invalid maker contract, raw JSON shape,
  4097claims/65stored-items/64KiB+1/8MiB+1 all reject. Source/payout failures assert unchanged ownership.
- **stale:** repeated removed source and consumed claim cannot pay twice; nextSequence does not rewind;
  independent same-ID source kinds remain separate; edited definitions cannot overwrite existing promises.
- **flaky:** no sleeps, polling, wall-clock/random claim IDs or timing retries. Test clocks are explicit
  absolute game minutes. Final required suite passes in one run. Build-bound adjustment is separately logged.
- **dirty:** clean entry, exact approved paths staged, ignored stale VERIFY not overwritten or staged.
  Parent plan/Boulder/WISH, task2 source, dependencies and full51 coverage untouched.
- **misleading output:** REDs, intermediate GREEN, patch/search failures, build124 and warnings retained.
  New predicate is not presented as completed recovery persistence; module probe is not called UI success.

## Cleanup and architectural audit

Public probe clears storage and closes its window and middleware-only Vite server in finally.
No HTTP port or browser process was opened. All test/compiler/build commands actually exited; process
inspection found no remaining task3 test/build/probe child. Task-created dist outputs and temporary copied
logs were removed after preserving exact receipts. Shared node_modules, .env.local and pre-existing caches
were untouched. No remote DB write, dependency change, push, PR or merge occurred.

New recovery module owns recovery transactions and their bounded boundary (179 nonblank/non-line-comment
lines); maker module remains195 by that measure. Existing large session/validator files receive only bounded
type/guard additions, not an unrelated refactor. Domain failures use explicit result variants; untrusted raw
JSON is validated before copying; transaction failures preserve the original; no new any/non-null/type-error
suppression was added. The existing p0Makers tests were not edited. All product/test/wiki/evidence edits used
`/tmp/apply_patch`, an inspected GNU patch wrapper, with generated unified diffs. Wiki index content came from
the actual generator rendered to stdout then applied as a patch; the official check passed.

`test/fixtures/life-full/coverage.json` is unchanged: all**51 feature rows and13 findings remain not-run**.
Full gates and player/editor end-to-end scenarios were not run by this bounded child. They remain parent/future
work and do not qualify this task's verified primitive contracts.

## DoneClaim

```json
{
  "taskId": "st_01a073c7",
  "taskNumber": 3,
  "status": "done",
  "done": true,
  "branch": "agent/life-full-p2",
  "baseCommit": "f1024a2202ab6205591af630aeb53b0bc3445669",
  "baseTree": "20ff00cebb72c149653294bd0320453706783403",
  "verifiedCodeTestsWikiTree": "fc0b6997f212a48fd7c2e7417470a0a64f8109c9",
  "commitSubject": "feat(life): preserve recoverable transaction claims",
  "implementationCommitLookup": "git log -1 --format=%H -- src/project/lifeRecovery.ts",
  "predecessor": { "verdict": "confirmed", "blockers": 0, "matchesAncestor": true },
  "claimBounds": { "claims": 4096, "distinctItems": 64, "itemCount": 9999999, "rawUtf8Bytes": 65536, "totalUtf8Bytes": 8388608 },
  "ownership": "source-to-claim and explicit claim-to-inventory draft-atomic; no duplicate payout",
  "unknownEvidence": "preserved unresolved; zero payout until explicit eligible receipt",
  "makerContract": "spent inputs, promised outputs, duration, resolved timeBasis copied; legacy behavior retained",
  "spatialReceipts": "runtime-only optional types; transaction wiring later",
  "requiredTests": { "files": 2, "passed": 61, "failed": 0, "skipped": 0 },
  "relatedTests": { "files": 8, "passed": 35, "failed": 0, "skipped": 0 },
  "diagnostics": 0,
  "typecheckExit": 0,
  "fullBuildExit": 0,
  "publicProbeExit": 0,
  "recoveryPersistence": "task4, not claimed implemented",
  "full51coverage": "not-run; unchanged",
  "remoteWrites": 0,
  "pushPrMerge": false,
  "teardown": "complete",
  "independentTask3Verification": "parent must refresh stale VERIFY before downstream execution"
}
```
