# P1 real editor and remote proof

Task `st_01a0763c`, 2026-09-06. **Both required commands pass on the combined
P1 tree.** This closes the scoped surface-proof node, not supervisor gates,
ultrabrain review, PR, or release approval. No product source or user project
was edited by this node. The lead-owned plan progress edit remains unstaged.

## Commits and executable scope

Worktree: `/home/main/z-project/rpg-zzu-ai-harness-p1-20260906`.
Branch: `agent/ai-harness-p1-20260906`.

The phase-required QA-only commits were inspected and integrated in order:

- `aa14052f` -> `37a95dec`: repaired Firefox cold-CSS boot and existing abort expectations.
- `057b5427` -> `7982c0a4`: independent real Supabase harness.
- `86f58bb7` -> `476d7a7c`: independent remote RED/GREEN and cleanup evidence.
- `8a59f1e7`: new `scripts/qa/ai-harness-contracts.mjs` (proof-failure only) and
  `scripts/qa/ai-harness-vite.config.mjs` (test-only in-memory regression mutation).

The remote harness is reused unchanged. No duplicate remote implementation,
product mutation, new agent, merge, push, user config edit, or other phase was
introduced. Existing OpenWiki updates belong to the following docs node.

The exact editor run captures production base `476d7a7c` and harness SHA-256
`f16661fec79f339d0d2324710e3791475913de3e0c354cdc86d0f0526abcb663`.
Those harness bytes are committed in `8a59f1e7`; committing did not change them.
The unchanged session and store hashes are in `editor/actions.json.sourceHashes`.

## Exact commands and exit codes

```sh
QA_PORT=19847 EVIDENCE_DIR=output/evidence/ai-harness/p1/editor xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario proof-failure
node scripts/qa/ai-harness-remote-proof.mjs --create-isolated-project --scenario all --report output/evidence/ai-harness/p1/remote.json
npm test -- test/aiRunEndProof.test.ts test/storePersistenceProof.test.ts test/storePersistence.test.ts test/supabaseProjectSync.test.ts test/aiComposerModeSession.test.ts test/aiMilestoneTurnAccounting.test.ts test/aiAssistantTurnCleanup.test.ts
npm run typecheck:app
npm run build
```

| Command | Actual result | Artifact stem |
| --- | --- | --- |
| Exact editor | **0**, six screenshots, all assertions pass | `editor.log`, `editor.receipt`, `editor/actions.json` |
| Exact remote | **0**, 15 scenario observations | `remote.log`, `remote.receipt`, `remote.json` |
| Related tests, one invocation | **1**, 89 passed / six pre-existing failures, seven files | `surface-tests.log`, `.receipt` |
| App typecheck | **0** | `surface-typecheck.log`, `.receipt` |
| Full app/player/standalone build | **0** | `surface-build.log`, `.receipt` |
| Node syntax, three new/integrated harness files | **0** | validation tool results |
| LSP, all four affected QA files including boot repair | no diagnostics | validation tool results |

The six legacy failures are identical to the earlier unchanged-source probe in
`persistence.md` / `persistence-legacy-baseline.log`: before-load fetch count
sees edit-activity POST; three dev-showcase/fresh-project cases receive undefined
fetch responses; disabled-dev-status gets invalid test authentication; missing
project sees four fetches instead of one. They were not retried, skipped,
rewritten, or suppressed. All 14 session-proof, 18 store-proof, 29 sync, six
composer-mode, three milestone-accounting, and 14 turn-cleanup tests pass.
Five other store tests pass. Raw build warnings remain in the log.
The staged evidence whitespace check exits 2 only for original build/test log
trailing spaces and test/typecheck final blank lines (`surface-diff-check.*`).
The scripts' staged whitespace check passed. Raw diagnostic output is preserved
byte-for-byte instead of being rewritten to hide warnings or failures.

## Actual editor surface

The harness follows the repaired `map-owned-ai-turns.mjs` pattern: exclusive
listener, private optimizer cache, cold real CSS transform, headed Firefox,
new disposable profile, real composer click and busy/idle DOM subscription.
Only `/v1/chat/completions` responses are scripted. Session execution, real
`set_title_screen`, advisory `run_lint`, milestone apply, store flush, normalized
Supabase read and editor rendering are not mocked or replaced.

Before any content QA, the script validates env origin, anon/publishable role,
and configured project-id availability without printing secrets, then proves
its UUID target absent over real HTTP. The configured user project is never
read, loaded, switched, or written. The browser starts a fresh blank local
fixture with a run-only `?project=` target. The existing test-only persistence
bootstrap then enables **real** remote save for that target. `blankProject=1`
is not used as a substitute for remote proof. All browser project requests are
ownership-guarded; unrelated activity/conversation writes are blocked and
recorded, not fulfilled as successful persistence.

Exact editor project: `qa-ai-surface-9e93524e-f047-4733-850d-4edcd348f0e9`.
Accepted receipt: `c662629b-2c3b-4c85-ab93-33b2d056efd9`, generation 2.

| Observation | Normalized identity / machine outcome |
| --- | --- |
| Accepted save and independent normalized read | `76b3ce9efe7c214955da4d9b682ba2611b03b2849b936723cffb0f68d7966bf5` |
| Real remote PATCH, intentionally unchanged wire hash | observed `d36eed2d2d20e133e5dd3522c9388c14f2a79d0c64187e933f6ba03f35cefa61` |
| Actual completion read after PATCH | `failed`, `verified:false`, `reason:mismatch-content`, saved-audit sentinel count 0 |
| Restored remote + real composer continuation | same exact receipt, `succeeded`, `verified:true`; observed identity equals accepted |
| New local edit during a gated real read | `failed/stale`, `verified:false`; embedded historical proof `verified/isCurrent:false`; live object/bytes preserved, dirty true |
| Final composer continuation saves newer edit | `succeeded`, `verified:true`, dirty false; observed `167d38b3921b39cda3a0dd0ca9205f8250af2086090f80e0e049ee9e7f3e20b7` equals latest accepted receipt |

The same-revision retry performs no additional project write and no tool replay.
Across all four composer turns there is one session, one title write, and one
real advisory lint call. The work item is done even while persistence proof is
failed, correctly separating plan completion from accepted storage proof.
`commitId:null` is recorded as observed; it is not invented from the newest
commit row and is not used as evidence that a project save failed.

The live-edit race uses the real store update boundary to inject the edit, not
a claim that a second human UI was driven. Its autosave debounce is cleared via
disabled flush before reenabling persistence, so the race never relies on a
four-second timing window. All proof gates and DOM observers are subscribed
before actions and have bounded rejection; there are no sleeps/polling delays.

Screenshots: `editor/00-before.png` through `editor/05-latest-revision-verified.png`.
They are captured real-surface evidence, **not a subjective visual-design pass**:
the image read tool reports that this session's model cannot view images.
Machine outcomes come from the live store/session and real DOM, never status
prose or screenshot labels. No P2 outcome projection or new proof-retry UI is
claimed; retry is the existing composer continuation.

## Faithful regression RED

```sh
AI_HARNESS_MUTATION=false-verified QA_PORT=19851 EVIDENCE_DIR=output/evidence/ai-harness/p1/editor-red xvfb-run -a node scripts/qa/ai-harness-contracts.mjs --scenario proof-failure
```

Actual exit **1**, `editor-red.log/.receipt`. The test-only Vite pre-transform
requires an exact single match of the two session proof guards, then omits them
in memory. Product source files stay byte-for-byte unchanged. The real save,
real remote PATCH and mismatched normalized read still execute. Captured state:
embedded proof `kind:mismatch/reason:content`, but session `status:succeeded`,
`verified:true` and saved audit count 1. The assertion fails exactly at:

```text
A real content-mismatched read must not be verified
true !== false
```

This is not a missing-method/import failure or label inspection. The final
harness later added the observed advisory `run_lint` to its post-RED tool-count
expectation; the mutation kill assertion and all actions before it are unchanged.
Upstream pre-production RED remains in `session-red.*` and persistence evidence;
this node made no production changes requiring a new source RED/GREEN cycle.
The independently committed store false-verified mutation evidence is preserved
in `remote-red-content.*` and `remote-red-transport.*`.

Earlier development failures are retained separately, not called RED success:
`editor-port-collision.*` refused an unrelated listener on 19847 and created no
fixture. `editor-boot-config-failure.*` exposed this new script's accidental
5-second Playwright expectation default; it was corrected to the reused
baseline's existing 60-second bound, not a retry of broken product startup.
`editor-development.*` then passed on 19851. The other owner subsequently freed
19847 without any kill/reuse by this node, and the exact required command passed
once on the final script. No port blocker remains.

## Combined-tree remote proof and historical evidence

Exact remote project: `qa-ai-proof-87289b68-3b25-422e-b493-5641626bb3f9`.
Accepted revision: `f3a61432-92cc-4cc6-8697-453703fbc940`, generation 1.
Accepted/initial/restored normalized identity:
`28540a0f484856b8218cf87fc4a3df375d6bf7e4ff1302a7c9f4bcf10cc9985e`.
Changed real remote identity:
`593fe42850a93fec95a64422cf657d41ef43d5ff944d8ab8bf8d6dc43f6f634e`.

The unchanged harness proves real accepted match, real changed-content mismatch,
restore/same-receipt retry, and newer-local-state preservation. Its 503, returned
wrong target, disabled-store and caller-cancel cases are explicitly labeled
injections, **not asserted real service outages**. Successful transport and all
save/load normalization are real. The NPC dialogue sentinel survives readback.

The imported worker's original `remote.json/.log/.receipt` were archived
byte-for-byte as `remote-worker-final.json/.log/.receipt` before the required
combined-tree command rewrote the prescribed report names. All other upstream
metadata/mutation evidence remains unchanged. Its original inventory
`remote-artifacts.sha256` describes that earlier run, not the combined report;
validation maps the three archived names when checking it. Original
`remote-actions.jsonl` matches the archive; `remote-combined-actions.jsonl`
matches the current required report. No old proof is relabeled as this run.

## Cleanup and bounded DoneClaim

All four projects actually created by this node were deleted and root/maps/
tilesets/commits/changes absence verified by their owning scripts:

- Mutation RED: `qa-ai-surface-58d4f90e-6f7c-4f04-b1a6-4b6fa81b0347`.
- Development GREEN: `qa-ai-surface-7045c20b-4d21-409a-bd4b-62ae4644b40e`.
- Exact editor GREEN: `qa-ai-surface-9e93524e-f047-4733-850d-4edcd348f0e9`.
- Exact remote GREEN: `qa-ai-proof-87289b68-3b25-422e-b493-5641626bb3f9`.

Failed preflight/boot runs created no remote row. Browser contexts, owned Vite
process groups, observers, routes, private caches and timers are closed. The
exact editor report has zero active routes; remote has zero transports/proofs
and no listener. Exclusive port rebinding succeeds; a subsequent `ss` check
shows neither 19847 nor 19851 listening. No other process was stopped.

**DoneClaim:** scoped P1 harness delivery has faithful browser mutation RED,
exact-command browser and live-remote GREEN, saved/read normalized identities,
no-local-overwrite and retry proof, complete fixture cleanup, typecheck/build,
and the full related-test result with six established baseline failures kept
visible. No P1 release, full-repository gate, visual aesthetics, later phase,
user-project persistence, or cross-device guarantee is claimed.
