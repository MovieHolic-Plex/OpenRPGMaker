# Sweep 4 audio / AI local merge handoff

Base: `58105616bb4b970f8012e43fc20498bbe9c9d11a`.
First merge: `5003e3f06` (PR657 `db895b1a56eb54c88f85ea670e88d6a439b25d69`).
Second merge parent: PR660 `a90a6544d62dffd6027204994e036ab1900d6639`.
The commit containing this report is the candidate. Work was confined to this worktree.
No push, remote comment, live database write, full gate or build was performed.

## Resolution

- Audio project ownership uses PR655's existing content lineage rather than a second epoch counter. Full replacement/reset invalidates proof and baseline; ordinary edits and undo retain per-key audio reconciliation.
- Accepted content is captured independently of the live baseline before hashing. Historical saves still issue receipts and commit records, but cannot install a baseline, descriptions or dirty state into a replacement. Lineage is checked after hashing and after synchronous reconciliation subscribers. The lineage regression additionally asserts replacement-baseline preservation.
- Preserve PR655 apply-commit correlation and proof-publication ownership, upstream acceptance/image/read-before-write hardening, and large independent plans. PR660 adds map-keyed specifications, committed-only successful expansion, applied-write accounting, target-specific retries, and NPC reward acceptance. Its source merge was conflict-free.
- Editor JSON/packages retain audio descriptions; playable export removes metadata and ignores it for resource usage. Existing cinematic export/resource behavior remains.
- Runtime QA retains cinematic operations alongside native audio actions and requested inventory/owned-monster count observations. Missing collections are not treated as zero.
- Preserve both sides of additive design/wiki conflicts. Regenerate INDEX after both merges. Imported raw historical evidence is unchanged.

## Verification in this session

All Vitest executions ran in `unshare -Urn` with loopback enabled, preventing live DB access, and used `--maxWorkers=2 --testTimeout=60000`.

- `npm run typecheck:app`: exit 0 (`typecheck-app.log`).
- Focused batch: external 480-second deadline, exit 124 (`focused-tests.log`). 28 files / 507 tests reported passing before termination, with no reported assertion failures. Includes audio concurrency (22), persistence proof (18), run-end proof (29), apply correlation (6), per-map specs (18), dependency retry, batch completion, NPC reward/repair, acceptance baselines, and audio export. This is NOT a completed-suite pass.
- Smaller required batch: exit 1 (`required-tests.log`), 96 passed / 1 timed out, 6 files fully passed. `storePersistenceLineage.test.ts` passed 7/8 cases; `does not resurrect saved authority after reload during PATCH` exceeded its explicit 60000 ms deadline. Reload of a previously published receipt, pending load/reconnect and the added replacement-baseline assertions in those completed cases passed. No baseline attribution or green lineage-suite claim is made; no retry, timeout increase or suppression was applied.
- Required batch fully passed runtime QA gate (56), runtime audio contract (2), large-plan size (5), scene verification repair (6), export usage pruning (5), and audio editor DOM behavior (15).
- `npm run openwiki:index -- --check`: exit 0 after regeneration.
- `node --check` on runtimeQaRun.mjs, runtimeQa.mjs and runtimeQaAudio.mjs: exit 0.
- Source merge whitespace checks: exit 0. Newly captured raw test logs may contain runner-generated trailing whitespace; preserve them as evidence.
- LSP diagnostics unavailable: Biome not installed for src; test/scripts requests timed out. No dependency was installed.

The first batch's command is recorded in its log header; the required batch's exact command is likewise recorded. Build, real browser/audio playback, live-model and real persistence checks remain parent-owned. The candidate is boundedly verified but NOT all-green.

## Minimal safe parent checks

From the candidate worktree, this UI command uses the existing temporary-project harness, isolated network namespace/cache and a dedicated loopback port. It is proposed, not executed in this handoff:

```sh
unshare -Urn sh -c 'ip link set lo up && DEV_SERVER_PORT=19857 VITE_CACHE_DIR="$PWD/.omo/sweep4-ui-cache" npx playwright test --config playwright.audio.config.ts --workers=1'
```

The harness opens `?freshProject=1` and rejects remote persistence. Network isolation also makes external assets/providers unavailable; this is deliberately local-only UI verification, not live AI or DB evidence. No listener occupied 19857 when checked, but the parent must retain server ownership.

Minimal deterministic assistant regression command, also without live DB/provider access:

```sh
unshare -Urn sh -c 'ip link set lo up && npm test -- test/assistantMultiMapSpec.test.ts test/assistantBatchCompletion.test.ts test/aiTurnAppliedAccounting.test.ts --maxWorkers=2 --testTimeout=60000'
```

The unresolved 60-second lineage test timeout is the specific follow-up for the parent before calling the combined candidate green.
