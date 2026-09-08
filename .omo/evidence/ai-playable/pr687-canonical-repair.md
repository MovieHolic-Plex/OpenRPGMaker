# PR687 canonical acceptance repair (CR1 + CR2)

Base: `8c3836f3bbc68b80444b7ce525622167ea1951cc`.
Branch: `fix/pr687-canonical-contract-st_01a07c86`.
Tree: `/home/main/z-project/rpg-zzu-pr687-integration-st_01a07c86`.
The commit containing this report is one cohesive source repair, pending parent validation/re-review.

## Contract

- Canonical tool arguments now pass the existing registered-schema and native-input validator.
  Malformed arguments produce actionable, repairable criteria errors and remain required repair
  obligations even if declared optional. Fully valid optional criteria remain optional.
- Canonical scenes expose `interactionTargets` and reuse ordinary scene ownership validation.
  Each explicit interaction has a map-qualified target. Host initial state is captured before
  any probe, including when scope is pending. Same arguments/same event ID/same final map do
  not authorize a different interaction map or substituted initial state.
- Valid arguments with missing/partial ownership stay fixed and pending, not immutable dead ends.
  `repair_acceptance` may fill missing ownership only: no changed args, previously declared
  targets, sibling criteria, owner/source or original baseline. Pending initial state survives
  the repair. Resolution requires a fresh matching execution; prior exploratory passes cannot count.
- Unnamed scene interactions are not an admissible canonical specification; they remain
  repairable malformed criteria rather than an impossible fixed scope. Ordinary exploratory
  scene execution is unchanged. Scenes without interactions have empty ownership scope.
- No change to route equivalence, skip policy, functional/reward evaluation, persistence,
  provider transport, scheduler completion semantics or external services.

## Regression evidence

`test/canonicalAcceptanceOwnership.test.ts` uses normal session dispatch and registered tools,
scripted model transport, exact message-event yielding, and a fetch guard asserting zero calls.
Its seven cases cover missing ownership recovery; partial ownership and protected-state recovery;
original pass -> transfer/state edit -> identical successful foreign execution -> blocked goal;
restoration and fresh pass; required/optional malformed-input repair; immutable valid criteria;
and valid optional behavior. The repair tests also prove original baseline preservation through
an intervening map-name edit. Scheduling completion is asserted separately from terminal goal truth.

Red first at8c: `pr687-canonical-recovery-red.log` records seven failing cases, including the
reported false satisfaction and `immutable-valid` repair refusal. The earlier six-case red log
is retained; its first scheduler assertion was corrected to respect existing scheduler semantics.

Checks executed in this tree:

- `pr687-canonical-focused.log`: exact npm command is in the header; **20 files / 453 tests passed**
  in one invocation, including the prior nine-row verification matrix, native scopes, atomicity,
  selection ownership, schema/provider normalization, functional persistence and NPC reward controls.
- Final recheck: `npm test -- test/canonicalAcceptanceOwnership.test.ts test/toolSchemaProviderCompat.test.ts test/assistantAcceptanceProvider.test.ts --maxWorkers=2`
  **3 files / 82 tests passed** (`pr687-canonical-final.log`; overlaps the 453, not additional tests).
- `bun test test/ohMyPiImageTransport.bun.test.ts test/ohMyPiVision.bun.test.ts test/ohMyPiFullCatalog.bun.test.ts test/ohMyPiComplete.bun.test.ts`
  **64 passed / 0 failed**, one run (`pr687-canonical-provider.log`), real SDK with mock HTTP.
- Direct TypeScript-server syntax/semantic/suggestion diagnostics: **9 files, zero missing
  responses, zero diagnostics** (`pr687-canonical-tsserver.json` and `.log`). An initial overly
  broad type predicate caused two diagnostics and was corrected; no type suppression was added.
- `git diff --check` passed. Focused wiki updated and INDEX regenerated. No Markdown LSP configured.

The old canonical initial-state test was strengthened: a seed substitution must remain blocked
until the protected state is restored and the exact scene is rerun. The former provider-envelope
fixture used invalid walkthrough commands/unknown native fields; positive coverage now uses
valid native input and the former payload is retained as a rejection control. No assertions or
failing tests were deleted/skipped; no sleep, polling delay or increased timeout was added.

Parent/live8c, parent branch, env files and remotes were not changed. No real UI, DB, model or
content actions occurred. No full gates or builds were run; parent owns those and source re-review.
