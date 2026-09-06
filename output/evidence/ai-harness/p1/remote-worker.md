# P1 independent live-Supabase persistence proof

Task `st_01a07615`, 2026-09-06. Scoped QA is GREEN, including mutation RED and
restored-source GREEN. This is not session integration or P1 release approval.
No product behavior, dependencies, schema, default project, browser/editor session,
or another worktree was changed. No push, PR, merge, or subagent was used.

## Exact provenance and execution

- Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p1-remote-20260906`.
- Branch: `agent/ai-harness-p1-remote-20260906`.
- API base: `3eccfb89f36daae1826d7b93f51bea5a4ac3d40a`.
- **Committed harness / exact final-run SHA:**
  `057b5427cc5d32da657e9c35b2e442c4af526f7e`.
- Harness: `scripts/qa/ai-harness-remote-proof.mjs`.
- Harness SHA-256:
  `587c91a13ebdf3aad6b2efaedd96b52ec44db9e33f72100aa9c2aab1aa8db083`.
- Original and restored `src/project/store.ts` SHA-256:
  `7823f05b36f84ef5e2cf4532b6b3e11331228a650c7973117ce6c7f35f5c9645`.
- Runtime: Node v24.11.1, Linux x64. Native Node plus existing Vite SSR;
  no added dependency. No browser or network listener is started.

Exact acceptance command (exit 0, `remote.receipt`):

```bash
node scripts/qa/ai-harness-remote-proof.mjs --create-isolated-project --scenario all --report output/evidence/ai-harness/p1/remote.json
```

`remote.json` contains 15 observed scenario steps, the actual accepted receipt,
and 51 ordered request/action entries with HTTP statuses and response sizes.
`remote-actions.jsonl` is an exact extraction of its action array. Successful
requests are real fetches, including real ProjectStore save, child writes,
background commit, proof reads, independent normalized reads, content PATCHes,
and cleanup. `persistence-surface.mjs` was an API reference, not live evidence.

## Isolation and connection boundary

The harness validates the configured origin, anon/publishable role, and configured
application project-id syntax without printing keys. It uses the checkout's
configured self-hosted origin `http://dbserver:8100`; it does not invent a public
Supabase endpoint or require the unrelated novice launcher's HTTPS-only policy.
The configured default id is recorded as configuration metadata only. There is
**no read/load/flush/switch/delete against it**.

A UUID project id is minted and its absence is checked over real REST before any
store import. Only this target enters Vite defines and the process-owned in-memory
window/storage. Every remote request is guarded by origin/table/project-id or
run-created commit-id ownership. A run marker in the row's title and pre-run
absence are both required before cleanup. Credentials stay in process memory;
request logs omit headers and payloads. Redirects are rejected.

The existing `_setPersistenceStateForTest` bootstraps only a fresh store singleton
without calling `load` or project-switch APIs. Save, serialization, normalized
loader, verifier, commit writer and all successful HTTP paths remain real. The
fixture contains an action NPC with a run-specific dialogue sentinel, asserted
in the normalized remote result. No demo content is shipped to the app.

## Final live receipt and assertions

- Project id: `qa-ai-proof-577b3786-69b8-413e-8654-6ec813ffac52`.
- Accepted revision: `beb8781c-fa30-4c08-9903-80892b2a751d`, generation 1.
- Accepted / initial observed / restored observed normalized identity:
  `4922e7929e1675758d960fc2e68c503fc7b4cf7988a6f766d5a4251e6ebe6d72`.
- Changed remote normalized identity:
  `a55a152ee3e739ce663c0c143ceae07a83bc827b35e3e2523127f8679a2e99f8`.
- Intentionally unchanged server wire hash across the real remote content change:
  `a6801b84699a2f909118aeb49f86a252a8ce6748a58404d737d7e42d6683cc48`.

Assertions establish:

1. One real store save issues a frozen receipt; a clean flush reuses that exact
   receipt without another project POST.
2. Real matching content verifies/current. A real PATCH changes `current_json`
   while preserving the wire hash: the actual verifier returns mismatch/content.
   Restoring remote content allows the same exact receipt to verify without saving.
3. Explicit **injections**, not alleged remote outages: synthetic HTTP 503 gives
   failed; a real read with an altered returned id gives mismatch/target; test-only
   persistence disable gives disabled; caller abort after an event-gated real
   response gives cancelled. Transport/target/cancel retry on the same receipt
   succeeds through real remote reads.
4. Each non-edit proof leaves exact live object identity, full content, storage,
   dirty=false, and zero subscriber emissions unchanged. During an event-gated
   real read, a newer local edit remains the exact dirty live object; the old
   receipt verifies historically with `isCurrent:false`, and the current-receipt
   predicate is false. Remote content remains the accepted version.

Subscriptions/deferred signals are armed before triggering save/read/edit/cancel.
Timeouts bound operations; there are no sleeps or polling delays. The race's
owned autosave debounce is cleared using disabled flush, not allowed to run by
clock luck. This control does not replace the verifier or real successful save.

## Mutation RED: exact false-verification, not a missing API

`remote-mutation-check.mjs` requires the isolated branch and a clean git status.
It applies each single-line verifier-seam mutation with `apply_patch`, executes
the unchanged real harness, and restores exact original bytes in `finally`.
This helper is archived as executed at the pinned harness SHA above, where its
output directory is ignored. Reproduction uses a fresh isolated clone at that
SHA with the helper copied into the ignored evidence directory; do not overwrite
the committed evidence on the later evidence commit and call that a clean replay.
The final runner command exited 0 (`remote-mutation.receipt`):

```bash
APPLY_PATCH=/tmp/apply_patch node output/evidence/ai-harness/p1/remote-mutation-check.mjs
```

Here `/tmp/apply_patch` is the workstation's unified-diff wrapper around
`patch -p1 --forward`; no production mutation is committed. The four
`remote-mutation-*-apply/restore.patch.log` artifacts retain the exact temporary
patches and successful application/restoration receipts.

| Mutation | Actual failing assertion | Harness exit |
| --- | --- | --- |
| Content mismatch result falsely returned as verified | `changed-real-content`: actual `verified`, expected `mismatch` | 1 |
| Read-error catch falsely returned as verified | `injected-transport-503`: actual `verified`, expected `failed` | 1 |

The content RED still performs the actual changed remote read and normalization.
The transport RED follows real save/match/mismatch/restore and then the explicitly
injected failure. Neither RED is a missing-method/import failure. Typed actual
results are recorded before assertions in `remote-red-content.json` and
`remote-red-transport.json`; failing assertion messages remain in their logs.
`remote-mutation.json` verifies original/restored hash equality, clean status
before/after mutation, and the subsequent **unmutated exact-command GREEN**.

Two harness-development failures are retained rather than counted as passes:

- `remote-initial.*`: reusing novice HTTPS-only validation rejected the configured
  self-hosted HTTP origin before any store import or remote fixture creation.
  QA-origin validation was corrected without changing deployment settings.
- `remote-mutation-initial.*`: both RED assertions and remote cleanup succeeded,
  but the transport mutation's reverse needle also matched the ordinary verified
  return. The helper's uniqueness assertion correctly failed. The source was
  immediately restored with a context-qualified `apply_patch`, and
  `git diff --exit-code -- src/project/store.ts` confirmed restoration. A unique
  QA-only marker now makes the reverse patch unambiguous. The final complete
  mutation runner restored source in `finally` and passed. Initial RED reports
  are preserved as `remote-red-*-initial.*` with their cleanup receipts.

## Cleanup receipts

**All six actually created remote fixtures were deleted**, including the first
live development run and both initial/final mutation runs. The initial invalid-
origin run created nothing. Each report verifies root-row absence plus absence
of maps, tilesets, project commits, and changes filtered by run-created commit id.
Only the positively identified run-owned project root was deleted; child rows
were removed by its cascade and then checked, not assumed absent.

| Run | Isolated project suffix (after `qa-ai-proof-`) | Cleanup |
| --- | --- | --- |
| First live GREEN | `877f4c3a-11f8-43a1-aa63-426af83dca5e` | deleted; root/children absent |
| Initial content RED | `8e42495e-3778-417f-adbd-f15b891b33aa` | deleted; root/children absent |
| Initial transport RED | `3febe680-f055-498c-a83a-33f6e49eaf6c` | deleted; root/children absent |
| Final content RED | `8d2e2286-25df-4ad1-945d-0bad4e416fec` | deleted; root/children absent |
| Final transport RED | `57fbf00a-da11-4589-8625-7267edff5874` | deleted; root/children absent |
| Restored-source GREEN | `577b3786-69b8-413e-8654-6ec813ffac52` | deleted; root/children absent |

Final background commit `318a8c38-3d7a-430e-8f70-ea46515717a3` was observed through
its real POST completion, then removed/absence-checked during cleanup. No latest-
commit query was used as save identity. Live anon DELETE succeeded despite the
more restrictive checked-in migration; no permission limitation remains for
these runs. The harness also explicitly records HTTP 401/403 limitations on
other deployments rather than escalating privileges or claiming deletion.

Final local receipt: Vite closed, no listener started, globals restored, autosave/
retry/activity/draft-vault timers cleared, deferred proofs settled, active
transports=0 and pending proofs=0. Every real request consumes its response body,
has an abortable deadline, and requests `Connection: close`. Processes exited
naturally, without forced success exits or sleeping for teardown.

## Verification and handoff boundary

| Validator | Result / artifact |
| --- | --- |
| Node syntax and LSP, both QA `.mjs` files | no diagnostics; syntax valid |
| `npm test -- test/storePersistenceProof.test.ts test/supabaseProjectSync.test.ts` | exit 0; **47 passed / 2 files**, one invocation; `remote-related-tests.*` |
| `npm run typecheck:app` | exit 0; `remote-typecheck.*` |
| `npm run build` | exit 0; app/player/standalone build chain; `remote-build.*` |
| Real remote command after source restoration | exit 0; `remote.json`, `remote.log`, `remote.receipt` |
| Two seeded false-verified regressions | each exit 1 with exact typed false-success assertion, then runner exit 0 |

Build mixed-import/chunk-size warnings remain visible in the raw build log.
`git diff --cached --check` reports exit 2 only for trailing spaces/final blank
lines in the raw build/test/typecheck logs (`remote-diff-check.*`). The logs are
preserved byte-for-byte; no source whitespace error is hidden. Markdown has no
configured language server; the QA JavaScript files have no LSP diagnostics.
`remote-validation.json` records credential absence, JSON parsing, action-log
identity and exact original-source identity; `remote-artifacts.sha256` inventories
the evidence and harness bytes.
The full repository gate and browser/session integration were not run by this
worker; those remain the lead's responsibility. No existing failing tests were
changed, skipped, deleted, or repaired. No prose-pinning tests were introduced.
The evidence is scoped to the actual persistence API, not assistant delivery UI.
