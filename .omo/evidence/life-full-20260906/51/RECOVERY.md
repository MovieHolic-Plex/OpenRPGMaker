# Plan51 - original evidence recovery and partial-source preservation

## Outcome

The nine remaining dirty plan47/48 files and the exact `git diff --binary` are safely preserved and byte-verified. Original owned session records recover meaningful **partial execution evidence**, the original first blocked summary, the original 19-case RED test revision, and the original public probe/diagnostics/runner patch history. They do **not** recover the missing full r2 raw log and state bundle.

This is forensic recovery, not implementation, QA, or approval. No source commit exists for this correction. Producer HEAD remains `b5c679efc6c5e575f7a1afb65dfa86939aade325`; its nine-file dirty status and bytes remained unchanged. Neither plan47 nor plan48, independent product verification, task12, Phase4, Grok wiring, nor the overall goal is approved.

Recovery task: `st_01a0798f`, parent/root `01a0727b-398a-7481-b557-b198013542c1`. The four recovered tasks' metadata and session tool messages identify `opencodex/gpt-6-astra`. No browser, UI, images, filesystem carving, dependency installation, validators, source mutation, commit, worktree creation, sparse changes, or read-tree operation was performed by this recovery.

## 1. Source protected first

Read-only producer: `/home/main/z-project/rpg-zzu-life-full-spatial-rights`.

Capture began at `2026-09-07T01:51:14Z`, before transcript recovery. `SOURCE-MANIFEST.json` records each absolute original path, exact byte count, SHA-256, compressed SHA-256, base SHA and dirty status. `INTEGRITY.json` records the completed comparison against live source and archive bytes.

| Preserved file | Original bytes | Backup under `source/` |
| --- | ---: | --- |
| `src/project/lifeRecovery.ts` | 13969 | `src/project/lifeRecovery.ts.gz` |
| `src/project/lifeStateReconciliation.ts` | 12077 | `src/project/lifeStateReconciliation.ts.gz` |
| `src/project/spatialPlacementTransactions.ts` | 14855 | `src/project/spatialPlacementTransactions.ts.gz` |
| `src/player/saveSlotSpatialValidation.ts` | 2692 | `src/player/saveSlotSpatialValidation.ts.gz` |
| `test/lifePlacementSafety.test.ts` | 11841 | `test/lifePlacementSafety.test.ts.gz` |
| `test/linkedAnimalHousing.test.ts` | 22232 | `test/linkedAnimalHousing.test.ts.gz` |
| `test/spatialPaymentReceipts.test.ts` | 14227 | `test/spatialPaymentReceipts.test.ts.gz` |
| **`test/spatialRecoveryRights.test.ts` (untracked)** | **17788** | **`test/spatialRecoveryRights.test.ts.gz`** |
| `openwiki/runtime-sessions.md` | 82223 | `openwiki/runtime-sessions.md.gz` |

`source/git-diff.binary.gz` decodes to the exact 19910-byte `git diff --binary` output, SHA-256 `ca2551d3dcbab9308e98231a85bb106497bf5f1e099da7e3665a853007bff076`. Git's tracked diff does not include the untracked test; that test is independently backed up above. Do not restore only the patch and omit it.

The current diff also equals the surviving independent r2 verifier's `diff.stdout` byte-for-byte. All eight code/test hashes match the producer's post-loss `remaining-source.sha256`; the wiki is the ninth separately verified file. These are current/post-loss identity checks, **not a substitute for the lost pre-run `final-source.sha256`**.

Reuse is possible from the nine compressed files plus base SHA. Treat this as an unapproved partial implementation requiring review and new evidence, not a ready-to-commit verified fix. No source restoration was performed here.

## 2. Exact owned sources and search boundary

The coding-agent-sessions skill and its Senpi reference were read. Discovery then used exact task-ID prefixes, the `2026-09-07T01:*` time window, metadata parent/root ownership, and exact cwd `/home/main/.herdr/worktrees/rpg-zzu/wish-html`. No broad historical transcript search was run.

Store prefix:
`/home/main/.herdr/worktrees/rpg-zzu/wish-html/.omo/senpi-task/`

| Task | Role | Original child session | UTC execution window | JSONL lines |
| --- | --- | --- | --- | ---: |
| `st_01a07964` | First blocked producer | `01a07964-615e-7f0c-83b2-8e07b9aa9ba1` | 01:03:36-01:07:20 | 50 |
| `st_01a07967` | First independent verifier | `01a07967-cc4c-72c1-8bf5-94498ae2d7f7` | 01:07:20-01:09:45 | 27 |
| `st_01a07972` | r2 producer and evidence loss | `01a07972-3d61-7166-aa77-70fc1974434a` | 01:18:45-01:36:32 | 102 |
| `st_01a07982` | r2 independent prerequisite verifier | `01a07982-85e2-7876-a93e-af889bcf16cb` | 01:36:32-01:38:55 | 28 |

All four exact task metadata files, lifecycle logs and child-session event inventories were exhausted. Lifecycle logs contain tool execution flags and assistant reports, not missing stdout/state payloads. `PROVENANCE.json` includes each full original session path, whole-file hash/size, header identity, and archived artifact provenance. `SESSION-INDEX.json` inventories all tool calls, including non-evidence calls not archived.

Only two original bash-output archive references occur in these owned sessions:

- First producer line9 references `/tmp/pi-bash-bebe323a0dfcd380.log`: a broad original discovery/worktree listing, not validator logs. Only exact parent-original listing ranges are archived.
- r2 verifier line10 references `/tmp/pi-bash-6a6360f675c36595.log`: HEAD/status/log and parent evidence inventory followed by unrelated worktree listings. The exact prefix before the unrelated listings is archived.

Both referenced files survive. Their relevant byte ranges and whole-source hashes are in `original-tool-archive/` and the manifest. Neither contains the lost r2 execution streams. There is no final-validator output archive reference in the r2 producer session: the original shell redirected validators to the subsequently deleted evidence files and printed selected tails/exit lines only.

Other authorized sources exhausted: the producer's four current post-loss files, both independent evidence-only verifier directories, and the named historical `placement-parent-astra` originals. No unrelated transcript, credential file, CLAUDE.md, free-space carving, scratch hunt, or repeated recovery scan was used. Discovery listings may contain unrelated path names; their transcripts/files were not followed.

## 3. What the original execution records actually prove

Paths below are relative to this directory. In `owned/st_01a07972/decoded/`, filenames beginning with the listed three-digit line number contain the exact recorded argument/result text; `events/` contains the corresponding original JSONL event bytes. The manifest identifies exact filenames, tool-call IDs, event IDs, byte offsets, lengths, hashes and JSON pointers.

**Recorded tool output is distinct from an assistant summary.** Where the original shell used `tail`, `head`, or `rg`, the complete tool-result message is only a partial original validator stream.

| Evidence | Original record | Recoverable status and limit |
| --- | --- | --- |
| Baseline characterization | Producer r2 call45, result46/event `c0984352` | Original `characterization exit=0` and `tail -12 characterization.stdout`: **75 passed, 2 files**. Command is preserved, followed by the original unchanged-source diff check. Full stdout/stderr and separate exit/hash files are not recovered. |
| Original RED | r2 call47, result48/event `0c79e8d5` | Original `RED exit=1`, stdout tail10 and stderr head24: **15 failed / 4 passed / 19 total**. Original 19-case test bytes recovered from recorded native-patch builder. This is the original run, not a recreated RED. |
| Both distinct defect failures | r2 call49, result50/event `bed4736e` | Original line-numbered `rg` excerpt of RED stderr. Building: expected retained list length1, got0. Decoration: expected frozen `{ itemId: 'item_potion', count: 1 }`, got `undefined`. Fifteen failure names and selected assertions survive, but not all full failure bodies/stacks. |
| Initial LSP diagnostics | r2 call69, results70-77 | All eight original structured diagnostic results survive, each `totalDiagnostics:0`, `truncated:false`. These precede later added/typed test changes; do not label them final-byte LSP checks. |
| Configured preflight failure | r2 call86, result87/event `aaa804dd` | Original exit1 and filtered diagnostic output: two new test type errors and two probe typing errors. Preserved as a real failure; not suppressed or dropped. |
| Configured final diagnostics | r2 call88, result89/event `f8aef8af` | Original runner prints `diagnostics exit=0`; runner and diagnostics script recovered. Full final diagnostics JSON/stdout/stderr is unavailable. |
| Final focused test run | r2 call88/result89 plus call90/result91/event `3f9f1b66` | Original `tests exit=0` and stdout tail12: **355 passed, 18 files**. Exact 18-file command survives in recorded `run-final.sh`. Full test stdout/stderr and final-source receipt are missing. |
| Public placement/collect/Save5 MemoryStorage probe | r2 call88/result89 | Original `public-rights exit=0`; exact initial probe creation and corrective patch arguments recovered. Original `public-rights.stdout`, `public-state.json`, and `import-resolution.json` were never printed in these records and remain unavailable. Assertions and a zero-exit receipt are not the lost raw before/after captures. |
| App typecheck | r2 call88/result89 | Original `typecheck exit=0`, with actual `npm run typecheck:app` invocation in the runner. Complete stdout/stderr is unavailable. |
| Failed build | r2 call88/result89 and call90/result91 | Original `build exit=1`, stderr tail45 and stdout tail25. Exact ENOENT stack for `community-site/package.json` survives, along with some runtime-asset/import/chunk warnings and successful app/player Vite bundle tails. Full build output/warnings are unavailable. This is not a build pass. |
| Evidence-destructive setup and non-launch | r2 call94, result95/event `dbdf48cf` | Actual `git sparse-checkout add community-site/scripts` / `git read-tree -mu HEAD` arguments survive. Subsequent redirections fail because `.omo/.../r2` disappeared. `build-complete exit=1` is a shell redirection failure, **not a second executed build**. Setup's redirected receipt itself was lost. |
| Post-loss state | r2 calls96/100 and results97/101, four surviving r2 files | Current source, HEAD, missing original summary, cleanup/status/hash observations. Explicitly post-loss, not original validator evidence. |
| Independent verification | Both surviving `VERIFY.md` files and owned verifier records | Both stopped on missing implementation-commit/prerequisite evidence. Neither executed independent product validators. Their exit0 capture/identity receipts are not product passes. |

Thus the 75/19/355 counts and final exit sequence are no longer merely producer prose claims: original tool-result excerpts support them. They are still **incomplete evidence**, without the deleted raw streams, snapshots, and original final-byte receipt.

## 4. Recovered original artifacts and derivation distinctions

- `existing/verifier-first/producer-summary.txt.gz` is the original first blocked SUMMARY, copied by the first independent verifier before loss. It equals the first producer's recorded write argument byte-for-byte. A clearly named copy is `recovered-created/first/SUMMARY.md.gz`. It documents the original free-decoration contract blocker, not a correction or successful execution.
- `recovered-created/first/adopt.stdout.gz` is the complete first adoption stdout as preserved by the original full read result. No truncation marker is present. This is recovered recorded text; the original standalone on-disk hash receipt is unavailable. No empty stderr file or guessed exit file was manufactured.
- `recovered-created/r2-line43/JOURNAL.md.gz` is the original Add File payload decoded from the recorded native patch. It is contemporary producer prose, not a raw execution log.
- `recovered-created/r2-line47/spatialRecoveryRights.test.ts.gz` is the **original RED revision**, decoded from the recorded literal and exact Add File string builder. It is not the final 17788-byte dirty test and must not replace that backup by mistake.
- `recovered-created/r2-line84/{public-rights.mts,diagnostics.mjs,run-final.sh}.gz` are original Add File payloads decoded from actual recorded native-patch arguments/string builders. They are not newly authored scripts. Original escaping, line endings and LF patch semantics are preserved.
- `recorded-patches/` contains original native patch arguments, including the initial RED Add File, later test extension, production/test/wiki changes, probe creation, and the line88 type corrections. Computed arguments were decoded only with AST literals and whitelisted string operations; recorded Python/shell/subprocess calls were never executed.
- `recovered-created/r2-final-recorded-patches/public-rights.mts.gz` is the original final script recovered by deterministic replay of line84 creation and line88's two exact unique probe hunks **in memory**. This is not a new authored reconstruction, but also not a directly recovered final disk file. Its original final disk-hash receipt is missing. Decoded bytes:10479; SHA-256 `bbb4d4562544f0bcd8c65f11c2bed6d6d5cc1f61d6a83a0406eeba90ebec08b6`.
- `existing/post-loss-r2/` archives exactly the four post-loss files as such. `existing/verifier-r2/producer-summary.copy.md.gz` is also post-loss prose, never relabeled as the original first summary or original execution logs.
- `existing/verifier-first/` and `existing/verifier-r2/` preserve the original independent evidence-only files, including source snapshots, command/stdout/stderr/exit capture receipts and cleanup reports. Both directories remain untouched.
- `existing/parent-original/` preserves the historical parent rights probe, raw state, stdout/stderr/exit, original clone-error attempt and relevant commands/report. They are historical parent evidence, not r2 successes. The parent rights probe stops at its unpaid-gold assertion; it is **not** a separate decoration RED. The separate original r2 decoration failure is result50 above.

`PROVENANCE.json` contains 384 recovered-evidence artifacts. Together with the ten source/patch gzip backups, compressed artifact payload is 594840 bytes (about581 KiB). Metadata and filesystem allocation add overhead, but no checkout copy was made.

## 5. Explicit partial / unavailable list

**First attempt:** SUMMARY is recovered completely via its independent copy and matching recorded write. Adoption stdout is recovered from its full read result; direct adoption exit0 survives in the original shell result. Original standalone `adopt.stderr`, `adopt.exit`, `state.txt`, `source-blocker.txt`, `parent-receipt.txt`, and `cleanup.txt` are unavailable as full original files. Their generating commands and some source/setup observations survive, not all original output bytes. No characterization, RED, final suite, diagnostics, typecheck, build, or public probe was executed in that first blocked attempt; those are unexecuted, not lost passes.

**r2 execution streams:** only the original portions in section3 survive. Full `characterization.stdout/.stderr`, `red.stdout/.stderr`, final `tests.stdout/.stderr`, `diagnostics-preflight.stdout/.stderr`, final `diagnostics.stdout/.stderr`, `public-rights.stdout/.stderr`, `typecheck.stdout/.stderr`, and `build.stdout/.stderr` are unavailable. Separate `.exit` file bytes are not recovered; embedded original exit lines are preserved instead. Missing stderr must not be presumed empty.

**r2 state and identity:** original `public-state.json` (whole before/after, raw save, refusal and repeated-roundtrip captures), `import-resolution.json`, `final-source.sha256`, `identity-before.txt`, `originals.sha256`, and full original generated `commands.txt` are unavailable. The exact runner command templates survive but are not relabeled as the lost expanded command file. The final-source check was built into the recorded runner, but its lost expected-hash file cannot be replaced by today's source hashes and called original.

**r2 setup/cleanup:** full `build-setup.txt`, characterization/RED cleanup files, final `scratch-path.txt`, `cleanup-size.txt`, `cleanup.json`, and the attempted `build-complete.*` receipts are unavailable. The latter redirections failed, so no new build execution receipt existed there. Original final runner stops at failed build; its trailing `run diff-check` was not reached. The observed later diff-check and cleanup observations are post-loss only. Deliberate interruption cleanup was not tested and remains unverified.

**Approval prerequisites still missing:** an evidence-preserved successful build, a reviewed/verified committed correction, complete compliant fresh execution/state receipts, and independent verification of the actual corrected source. Grok-owned scene/UI/renderer behavior remains outside this recovery and unapproved. Counts from historical parent runs or the current verifier capture commands cannot satisfy these prerequisites.

The exact authorized sources are exhausted. These gaps are irrecoverable from those sources; no fabricated logs, regenerated snapshots, guessed empty streams, new-run RED, or summary-as-original substitution was created.

## 6. Safe r3 handoff (not performed)

1. Retain this evidence51 bundle outside any checkout whose setup can remove ignored files. Verify `SOURCE-MANIFEST.json`/`PROVENANCE.json` hashes before reuse. Keep first-attempt, r2 and parent originals immutable and visibly separate from new r3 receipts.
2. Review/reuse the preserved nine-file partial implementation against the recorded base; the untracked test is mandatory. Do not reset, stash, checkout, read-tree, or alter sparse patterns in the preserved dirty producer. A different future source location/setup requires coordinator authorization; none was created here.
3. Complete **all evidence-safe setup before any new receipt-producing execution**. Check disk headroom and dependency/adoption needs first. The failed original build's missing prerequisite was `community-site/package.json`; the source-input inventory also requires `community-site/scripts/sync-player.mjs` and `community-site/scripts/lib`, as well as its other declared inputs. These package/scripts inputs were missing from the initial sparse selection; the later population attempt caused the evidence loss. Current post-loss selection includes them, but that is not a successful build receipt.
4. After setup is frozen and durable evidence placement established, perform **no sparse-checkout or read-tree operations afterward**. Do not rely on an ignored `.omo` directory surviving index/population operations. Preserve complete stdout, stderr, direct exit, source/HEAD identity, scripts and raw state into durable owned evidence before cleanup. New evidence must be explicitly r3, never a replacement original RED or recovered r2 run.
5. Recovered scripts are forensic artifacts, not safe launchers in their archived location: they contain the original hardcoded cwd, relative imports, output paths, and scratch/dist cleanup. Read them and adapt any future runner/probe as an explicitly new r3 artifact before use. In particular, do not execute recovered `run-final.sh` or public probe directly from parent evidence51, and do not rerun `recover.py` (one-shot archiver with overwrite guards).
6. A future successful build and compliant scoped/independent verification still have to be earned on the exact corrected bytes. Recovery alone provides no product acceptance. The original free-placement requirement was withdrawn in the r2 task metadata; retain the required-item public placement contract and unresolved starting/legacy records rather than expanding that policy during handoff.

## 7. Verification performed for this recovery

`verify-recovery.py` was executed successfully. It verifies every recovered gzip hash/size, exact original event/file byte ranges, decoded JSON argument/result pointers, all four complete owned session hashes, original existing evidence bytes, all nine live dirty source files, exact binary diff, HEAD/status stability, independent r2 diff equality, and post-loss source/parent hash matches. `INTEGRITY.json` records the result. Script recovery also confirms first-summary write/copy equality and explicit probe patch derivation in `RECOVERED-SCRIPT-NOTES.json`.

These are bounded forensic integrity checks only. No LSP, test, typecheck, build, application entry point, original probe, or reconstructed probe was run during recovery. All writes were confined to this parent evidence51 directory.
