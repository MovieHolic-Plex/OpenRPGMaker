# Event editor audit and repair

## Governing outcome

Every event editor capability is classified with explicit evidence strength.
Every confirmed in-scope defect is repaired and protected by a deterministic
regression test and real-surface verification. Each sequential phase lands through
an atomic commit and a PR only after final ultrabrain approval.

The original request includes a cooperating audit team, exhaustive investigation,
history recovery, adversarial review, fixes, commits, PRs, and approved merges.
The durable aggregate is registered in the parent worktree at
`.omo/ulw-loop/wish-event-audit/{brief.md,goals.json,ledger.jsonl}`.

## Scope and integration

- Repository: `MovieHolic-Plex/rpg-zzu`; integration branch: `main`.
- Initial baseline: `32ef1bcd66476d09486a8a09893da02184d2ebd5`.
- Phase 1: `/home/main/z-project/rpg-zzu-wish-event-audit-p1`,
  `agent/wish-event-audit-p1`, development port `33509`.
- Preserve the parent worktree's untracked `WISH.md` and all unrelated changes.
- Engine/editor code and isolated test fixtures are in scope. Creating or changing
  a shipped game, map, demo, or a user's shared remote project is not necessary.
- Existing cream design tokens and component contracts remain authoritative;
  this is correctness repair, not a redesign.
- HEAVY rigor: the user explicitly requires exhaustive and adversarial review.

## Sequential phases

1. Exhaustive classification, baseline and editing lifecycle: undo/redo, insertion,
   command selection/clipboard/deletion, pages, modal save/cancel and drafts.
2. Command contracts: every registered kind/catalog entry, parameter forms,
   nested branches, defaults, validation, serialization and interpreter alignment.
3. Auxiliary surfaces and integration: routes, record/graphic/map pickers,
   preview/flow, validation navigation, AI staging, search, common-event reuse,
   accessibility, final evidence and classification closure.

Each phase has a new dedicated worktree. Phase N+1 implementation begins only
after Phase N is reviewed, approved and merged.

## Delegation topology

The read-only team has three interdependent lanes: command contracts, lifecycle,
and history/verification context. A supplementary explorer inventories auxiliary
surfaces. Cross-contract discoveries are relayed while work continues.

Each phase uses one mass-ulw graph. Independent fixes each receive a separate
provisioned worker worktree, an explicit file scope, and ownership of both the
implementation and failing-first proof. An integration/verification node depends
on every producer. The supervisor inspects diffs, runs gates and exercises the
browser surface independently.

Category choices: `deep` for behavior, cross-module logic and browser work;
`writing` for the evidence-backed classification artifact; `ultrabrain` for the
single adversarial judgment of the combined phase. Mechanical tasks use `quick`.

After the PR is open, ultrabrain reviews the exact commit and evidence. Requested
revisions become independent isolated deep-worker tasks where possible. Integrate,
verify, and resubmit the combined tree until approval. An inconclusive review
never permits merge.

## Evidence standard

Classification distinguishes executed PASS, executed FAIL, static contract
evidence, intentional limitation, and not yet verified. An insertion-count sweep
does not prove parameter editing, save/load, or runtime execution.

Every behavior repair first captures a deterministic failing test for the actual
regression, then the same test passing. No fixed sleeps, prose-pinning tests,
disabled assertions, or hidden retries. Browser runs use the phase's explicit
port and `E2E_RETRIES=0`.

Exact baseline commands:

```sh
DEV_SERVER_PORT=33509 DEV_SERVER_NO_TLS=1 E2E_RETRIES=0 npm run test:e2e -- test/e2e/event-quick-authoring-all-commands.spec.ts --workers=1
npm run gates -- --json
```

Phase verification includes relevant focused tests, `npm run typecheck:app`,
`npm run gates`, `npm run build`, real editor interaction and screenshots.
Runtime changes use `npm run qa:runtime` and the shipped `player.html` path.
Compare new failures with the same baseline; do not assume the historical
baseline file covers every failure or that failure counts prove equivalence.

## Initial findings requiring reproduction

- `modal.ts:691` routes keyboard history through global `handleHistoryHotkey`,
  while the toolbar has page-local command snapshots in
  `commandToolbarHistory.ts:51-130`.
- The active Ctrl+K picker insertion path may bypass toolbar history.
- `commandListContextMenu.ts:242-244` marks rows selected by CSS only, while
  copy/cut/delete use a single command path.
- Team enumeration reports 79 native kinds and 125 catalog IDs; these counts
  must be reconciled against a complete manifest before claiming coverage.
- `changeLifeSkillExp`, `spawnFieldEnemy` and `despawnFieldEnemy` appear to lack
  parameter forms. A no-parameter `openSaveMenu` command is not the same defect.
- Team live-module probes report valid `repair` / `festival` enum values rejected
  by the shape validator and malformed text/wait/m2 commands accepted. Trace
  the full load boundary before assigning severity.

## Completion

Stop when every capability has a final evidence-backed classification, every
confirmed in-scope defect is resolved, every phase PR has final ultrabrain
approval and is merged, all QA resources are cleaned up, and the Korean report
contains classifications, verification evidence, commit hashes and PR URLs.

## Phase 1 concrete work graph

The initial audit reconciled 79 native command kinds, 125 M2 IDs and 110
eventEditor files. Its module/FakeDOM probes are not complete runtime proof.

| Lane | Isolated worktree suffix | Port | Scope and failing-first proof |
| --- | --- | --- | --- |
| History | wish-event-p1-history | 19842 | Modal/content/history/inspector: keyboard undo equals toolbar undo, Ctrl+K insertion participates, page changes clear stale positional selection; text native undo stays local. |
| Selection | wish-event-p1-selection | 29842 | Command list/context menu/clipboard: Ctrl/Cmd+A followed by copy/cut/delete affects selected root commands once, nested commands are not duplicated, Escape dismisses only the context menu and listeners are cleaned. |
| Draft | wish-event-p1-draft | 33675 | Character display-name editing and draft transaction: Cancel restores name, autosave projection does not leak draft name, Apply commits name, unrelated character fields survive. |
| Validation | wish-event-p1-validation | 40853 | Validator/bell/page controls: missing switch/variable/actor/item issue opens and focuses the real condition control, without weakening fatal validation. |
| Classification | wish-event-audit-p1 | 33509 | Evidence only: complete native, catalog and filename manifests, source/evidence strength, initial/final status and defect-to-phase mapping. |

The five producers are independent. The integration verifier depends on all five,
cherry-picks only verified atomic worker commits into the phase worktree, runs
focused tests and reports exact diffs/conflicts to the supervisor. The supervisor
then runs gates/build/browser and opens the PR for final ultrabrain review.

Worker reports include exact RED/GREEN output and tests, own commit SHA, changed
files and cleanup receipts. No worker pushes, creates PRs, or merges main.

Additional source-confirmed Phase 1 defects: display-name edits bypass event
draft rollback (`pageProps.ts:711-727`); context-menu Escape bypasses modalStack;
validation issue field IDs do not match page controls. Positional selection on
page changes is covered by History rather than accepted as a feature.

## Baseline corrections

- The source `.env.local` port was copied by worktree provisioning. Port 9841
  belongs to `/home/main/z-project/rpg-zzu` (PID 2252417), not the phase.
  The original browser attempt was stopped and is not verification evidence.
  The shared main server was not stopped.
- Phase 1 now uses port 33509; every worker has a separately checked port.
- The first full gate monitor timed out without a result. It is not a pass and
  supplies no failure-count baseline. A later gate invocation needs a sufficient
  command timeout and the real exit status.


## Classification snapshot handoff

The classification lane reviewed this plan and persisted `CLASSIFICATION.md`,
`manifest.json` and `verify-manifest.mjs` beside it. Exact authoritative sets
match: 79 native kinds, 125 M2 IDs and 110 eventEditor files, with no missing,
extra or duplicate keys. The manifest also records 21 feature surfaces.

This is baseline evidence, not phase closure. Team FakeDOM probes returned for
78/79 native kinds and all 125 raw-M2 IDs; showAnimation remains inconclusive
because fake window was missing. All 79+125 interpreter initial steps reportedly
didn't throw, but effects, resume and completion weren't proved. Confirmed
findings remain open; candidates and intentional preview limits stay distinct.
The current full gate rerun is still pending in the supplied handoff. See the
classification for the stronger observed shop round-trip finding and the limits
of the earlier enum-only concern. No repair or merge is claimed by this snapshot.
