# NEW r3 independent verification - plan47/48

## Verdict: confirmed (scoped nonvisual correction only)

The committed correction **b87c9822f431ece4674e97a9d9cd15d1956be327** satisfies the scoped plan47/48 rights-conservation criteria. Required product fixes found: **0**. This is not whole task12, Phase4, Grok, browser, scene, renderer, image, or overall-goal approval. Mixed `lifeFieldInteraction45` remains Grok-owned and unverified here.

Verifier task `st_01a079d2`, independent Astra context (`PI_MODEL=gpt-6-astra`, captured in `audit.json`). Source was the explicitly authorized sequential, frozen producer checkout `/home/main/z-project/rpg-zzu-life-full-spatial-rights-r3`, read-only throughout this verification. Its parent is **b5c679efc6c5e575f7a1afb65dfa86939aade325**; that base is not represented as a fix. No producer process was found by the scoped process inspection. Per-command HEAD, porcelain status and SHA-256 inventory of populated tracked files remained identical; all ten changed owners equal their committed blobs. All nine preserved plan51 owners match `51/SOURCE-MANIFEST.json`. `certification.stdout` and `audit.json` record these checks.

Read prerequisites: producer `SUMMARY.md` and `DONE.json`, complete original NEW r3 characterization/RED/GREEN/build streams and direct exits, canonical plan47/48 at `.omo/plans/life-systems-full-implementation.md:323-334`, and complete `51/RECOVERY.md`. The old r2 excerpts are not fresh receipts. The first r3 verifier in `../verify` never loaded its external module and ran no tests/diagnostics/typecheck; it is incomplete, not a prior product pass or product failure. Its files remain untouched. No old dirty source was opened or changed.

## Independent executions

Every executed validator has `.command.json`, complete `.stdout`/`.stderr`, `.exit`, `.before.json`, `.after.json`, and `.cleanup.json` here. Commands run from the frozen R3 root, with the same `/tmp/rpg-zzu-life-full-qa-01a0727b.lock`, flock timeout900, timeout420/kill-after15 for product checks, and private TMPDIR/Vite/npm caches inside this evidence directory. No broad gate, dependency install, skipped/altered test, or retry-to-green test run occurred.

| Receipt | Exit | Observed result |
| --- | ---: | --- |
| `tests` | 0 | Exact producer 18-file argv, once; 355 passed, 18 files; 23.72s |
| `typecheck` | 0 | `npm run typecheck:app` |
| `diagnostics` | 1 | All eight changed code/test owners clean; two verifier-script-only unreachable-branch typing errors |
| `diagnostics-final` | 0 | Configured TypeScript syntactic/semantic diagnostics clean for all eight code/test owners and final external script |
| `public-rights` | 0 | Initial independent external probe passed; complete first captures retained |
| `public-rights-final` | 0 | Final independent public probe: 99 labeled whole-state/raw-slot captures |
| `interrupted` / `interruption` | -15 / 241 | Exact-ready-signal stub interrupted; cleanup survived |
| `misleading-failure` | 7 | A misleading success message cannot hide the actual failing exit |
| `lock-released` | 0 | Shared lock reacquired after interruption and failure |
| `certification` | 0 | Committed/source/evidence/import/cleanup assertions passed |

The 18-file invocation in `tests.command.json` contains exactly one `--configLoader runner`, `--cache=false`, `--maxWorkers=2`, `--minWorkers=1`. It excludes mixed lifeFieldInteraction45. Diagnostics use the actual configured TypeScript program, not invented LSP output. Both changed Markdown files were read completely; no prose-pinning test was added.

The explicitly corrected external entry point is:

```sh
node node_modules/vite-node/vite-node.mjs --config /home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/r3/verify-r2/probe.config.mjs /home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/47-48/r3/verify-r2/independent-rights.mts
```

`probe.config.mjs` has the R3 root, absolute @ alias, .ts/.js resolution, middlewareMode true, hmr false, private cacheDir, and fs.allow limited to R3, this evidence directory and the real shared node_modules. No product config or listener was created. Project imports in the script are absolute; `import-resolution.json` contains real paths and hashes. The probe does not import the producer probe. It extends the prior independent basic assertion with newly authored independent fixtures.

The initial diagnostics failure was `Property 'kind' does not exist on type 'never'` in two error-message branches after assert.equal had already narrowed the result. Only those impossible-branch messages were changed. `independent-rights.pre-diagnostics.mts`, the failed diagnostics and first successful public receipts remain. The final probe also adds explicit decoration-capacity and quota cases; both public runs passed. The 18-file suite was not rerun. Final stderr contains the expected, asserted quota refusal from the real save writer, not an unexplained error or suppressed failure.

## Rights and public storage evidence

`public-state.final.json.gz` is the losslessly compressed **complete 136,688,643-byte JSON capture**, not excerpts. It contains 99 captures with whole sessions, snapshots, parsed saves and literal raw slots. `state-index.json` lists labels and the uncompressed SHA-256. `public-state.first.json.gz` and `first-state-archive.json` retain the complete earlier run. Compression was verified by decoding and byte equality before removing only the redundant uncompressed files. MemoryStorage was cleared only after its slots were captured.

| Criterion | Independent evidence and exact assertion |
| --- | --- |
| Gold10+item1 quarantine/collect/repeated Save5 | Basic public placement debits gold100 to90 and inventory10 to9. After plot incompatibility, item collection and two saves, inventory is10, gold90, consumed claim ID absent, and exactly one empty-item unresolved owner contains the **entire original placement and gold10/item1 receipt**. No sourceId-only or tombstone-as-repayment assertion. |
| New split batches | A real placement and separately funded real upgrade create gold20 and ITEM_QUANTITY_MAX+1 paid history. Quarantine yields max-stack and item1 batches plus exactly one original unpaid owner. Payable batches carry no duplicated unpaid record. Partial save, inventory overflow refusal, spending, final collection and repeated save preserve the one unpaid record and gold80. |
| Old mixed records | Two imported historical mixed owners retain two originals after collection; no cross-claim speculative deduplication. Inventory reaches11, gold remains90, nextSequence increases and old IDs disappear. |
| Full-capacity legacy collection | A 4096-owner imported mixed state collects recovery:1 and recovery:2 in separate transactions with save between. Each removes its old ID and creates one empty evidence owner, leaving exactly4096 owners. Sequence advances4097 to4099; each original is exact; inventory changes only by accepted item1. This checks **net owner count**, not premature capacity rejection. |
| Required frozen decoration item | Actual public placement requires a known placementItemId, consumes one, and persists exact `{itemId,count:1}`. Empty item ID is rejected with complete state/slot equality. No free-placement policy was introduced. |
| Ordinary reclaim and changed/deleted types | Separate actually paid fixtures recover exactly the frozen old item through ordinary reclaim; changed cost receives nothing. Repeated reclaim is missing, repeated saves do not repay. Inventory overflow and deleted paid item refuse without state/raw changes. |
| Incompatible decoration and unknown/restored item | Changed/deleted definitions and persistent plot incompatibility return the frozen item through recovery. Unknown item collection refuses; restoring its explicit definition and saving gives no automatic credit; explicit collect credits one and removes ID. |
| Legacy/starting evidence | Missing-proof legacy and authored-start records survive repeated reconciliation/save as exact unresolved original records, with no payable items, no guessed refund and unchanged inventory. |
| Malformed proof | null, empty ID, count0/2/-1/fraction are tested twice for both Save4 and Save5 input. Writer and apply reject; parser returns corrupt; poisoned raw and prior valid slots plus whole input state remain unchanged. |
| Capacity/sequence/inventory atomicity | Building extra-unpaid-owner exhaustion, decoration exhaustion, exhausted legacy sequence and inventory overflow preserve whole state and raw slots. Writer/apply conversion failure does not commit a prefix. |
| Save4/5 and quota | Actual Save4 legacy-key read/apply then two Save5 saves preserve original legacy bytes and decoration proof; Project stays4. Real MemoryStorage quota exception after successful explicit collection leaves both prior disk slot and current accepted action intact. |
| Live context | Extra npcs/readLive fields sent through ordinary placement are absent from the exact persistent field whitelist; actual saved captures retain only placement fields and frozen item proof. Existing nonvisual live-reader safety regressions ran in the 18-file suite. |
| H1/H2 and cumulative bounds | Independently executed, fully read `spatialPaymentReceipts.test.ts`: H1 repeated item after64 rows, H2 32+33 unique items, 16x64 distinct costs, 16 full-wallet/full-stack histories, per-input bounds, safe cumulative overflow, malformed writer/parser/apply and previous-slot preservation. Assertions keep exact paid totals, one unpaid owner for paid-gold splits, no gold credit, monotonic sequence and exactly-once collection. |
| Housing and no-refund demolition | Independently executed, fully read `linkedAnimalHousing.test.ts`: separate instance capacities, move/upgrade receipts, shrink/unassignment/progression retention, whole-state refusal and demolition at0/4096 claims. Public probe separately verifies demolition bypasses recovery exhaustion with no new claim, inventory or gold refund. |

## Source review and scope

Read every changed source/test/wiki file completely and compared the actual committed diff (`committed.diff`). Inspected payment creation, persistent-field whitelist, cumulative receipt validation, decoration proof validation, parser-before-lossy-normalizer ordering, start placement cloning, authored placement normalizers, persistent placement restoration, reconciliation, collection and both removal paths. Save writer calls prepareLifeSnapshot before inventory normalization; parser calls parseLifeState; apply validates/parses a separate session and runs the shared prepareLifeSnapshot before returning it. Runtime proof survives these paths; authored normalizers do not infer historic payment.

New paid-gold conversions partition batches from one unpaid original. Legacy collection deletes the old ID before validating the replacement recovery state, so full capacity is legal at unchanged net count and unsafe sequence still fails atomically on the draft. The three existing-test changes reflect the new two-owner layout while retaining/strengthening exact item totals, gold evidence, ownership counts and repeated-save checks. No ownership assertion was weakened, test disabled, timing sleep introduced, UI wiring changed, or new schema/free-feature policy added. The existing ordinary missing-proof legacy reclaim fallback remains intentionally unchanged and is distinct from incompatible legacy recovery, which infers nothing.

## Producer receipts reviewed, not independently rerun

The complete NEW r3 baseline is75/2 files exit0 on base product; RED is17 failed/5 passed/22 total exit1 with base product and the final new test. The RED bodies explicitly show lost unpaid original and undefined paid decoration recoveryItem. `audit.py` compares baseline/RED owned product hashes to actual base blobs and RED test hash to the committed test. Final355/18 files, configured diagnostics, typecheck and public probe are complete raw receipts with exact final source hashes. This is not historical r2 partial-output reuse.

The producer's **full `npm run build` exited0**. Its entire stdout/stderr and command/direct exit were read. It completes app, player, SDK manifest and standalone bundle. Missing optional AI-key notices, circular/dynamic import warnings, large chunks and unresolved runtime assets are retained; no warning-free build is claimed. Build source hashes match the frozen correction and its private dist/scratch cleanup is verified. **This verifier did not rerun build.** `audit.json` records producer raw-file paths, byte sizes, hashes, exits and cleanup; `producer-stream-review.txt` preserves additional complete reviewed streams.

## Cleanup, adversarial evidence and limits

All writes were confined to this evidence directory. No new checkout, source/test/config edit, dependency change, commit, merge, push, remote operation, sparse/read-tree/reset, UI, scene, browser, render or image work occurred. Full populated-source hash inventories and clean HEAD/status compare equal before/after every executed command and final certification. Shared dependencies and caches were not removed. Owned per-command caches/TMPDIRs and ready FIFO are absent, lock reacquisition passed, and no source dist output was produced by this verifier.

The interruption test registers its owned FIFO before launching a stub, awaits exact INDEPENDENT_READY with a bounded selector, then sends SIGTERM. It uses no sleep/poll/retry and interrupts no real suite. Inner exit-15 and wrapper241 plus cleanup receipts are retained. An explicit exit7 with misleading green prose remains a failure. Dirty/stale input boundary values are injected only into the verifier's identity-return value: both reject before scratch/command creation; no foreign source is mutated. Existing receipt overwrite is rejected. `adversarial-results.json` distinguishes these setup rejections from executed product failures. Producer interruption/failure/lock receipts and their removed scratch paths were also checked. SIGKILL, power loss, browser disk durability and real device exhaustion are not claimed.

**Integration limitation:** generated `openwiki/INDEX.md` includes sparse-filesystem missing-reference churn. The index is not evidence of full-checkout equivalence and requires canonical parent regeneration during integration. This is not additional product scope or a reason to edit source in this read-only verification. Disk headroom was low (299MiB observed before final compression; 458MiB after compression); no ENOSPC occurred. Durable raw content was compressed rather than discarded or moved into source.

The verdict is limited to the exact frozen committed plan47/48 nonvisual correction. Canonical parent index regeneration and all broader/Grok-owned approvals remain outside this verdict.
