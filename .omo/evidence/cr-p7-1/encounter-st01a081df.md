# CR-P7-1-R1 encounter authorization repair - st_01a081df

Base: `51eb50a9573632d7a5efa175ea92a9b2f20c2f2c`.
Worktree: `/home/main/z-project/rpg-zzu-cr-p7-1-st01a08193`.
No rebase, wall-work import, parent edit, or original-commit amendment.
The parent owns integration with wall head `d9563d934504841a4310e3ccbf61f3881213883e`.

## Delivered boundary

Encounter-capable approaches are unsupported. The host checks current content
when deriving/offering a preview and again before native execution of exact
approved args. Missing current project/map cannot authorize an amended execution.
The existing applied-content equality boundary remains in place.

The check follows native encounter selection: rate <= 0 disables encounters;
a nonempty encounter table overrides legacy troopIds; only positive integer
weights can select table entries. Conditional positive-weight entries are treated
as potential encounters, not proven safe from the initial position/state. This
bounded release deliberately rejects such maps without evaluating arbitrary
setup, region, time, switch, variable, or party-level conditions along the route.
Missing troop definitions are not a safe authorization substitute either.

A later encounter-enabling write leaves the append-only approval record visible
but cannot execute an approved correction or append proof. A prior passing proof
is stale after the write; undo does not revive it without fresh safe execution.
No runner/battle framework, sceneIdentity relaxation, game-content change, original
recipe/assertion/initial-state replacement, or hidden-event filtering was added.

## Red first and verification

Evidence root: `output/evidence/cr-p7-1/encounter-st01a081df/`.
The adjacent `encounter-st01a081df.json` records concise results and raw-file hashes.

- Before product edits, `native-wrong-credit.probe.ts` ran the real session
  dispatcher on the complete original fifteen-criterion fixture. Seven native
  encounters changed gold 11 -> 131 and added `review_extra_battle_event`.
  Only original door interactions at indices 2/5/7 were receipted, yet criterion
  13 passed and a resolution was appended. Full state: `native-wrong-credit.json`;
  executed assertion receipt: `native-wrong-credit.log` (exit 0, expected bad credit).
- New rejection expectations failed before the fix: `red.log` (exit 1, two failed
  tests: encounter preview was offered; later encounter-enabling content earned
  an appended resolution). This red receipt was not overwritten.
- Final focused command: `npx vitest run test/approachCorrection.test.ts
  test/pr687VerificationIntegration.test.ts test/canonicalAcceptanceOwnership.test.ts
  test/sceneVerificationRepair.test.ts test/verificationSelectionOwnership.test.ts
  test/assistantVerificationEvidence.test.ts test/aiStickyChecklist.test.ts
  --maxWorkers=2 --reporter=default --reporter=json --outputFile=.../final-green.json`.
  **7 files, 172 passed, 0 failed, 0 pending**, one final invocation, exit 0.
  All earlier 152 tests remain, plus 20 encounter/preservation countercontrols.
- Native non-encounter success, low-rate/conditional encounter rejection, table
  precedence, zero/noninteger/negative weights, later rate/troop/table/weight
  writes, preview expiry, write/undo staleness, last-cell same-map transfer and
  empty-touch passing verdicts without credit are covered. Existing original
  args/sibling/ownership/session/unapplied-draft boundaries remain tested.
- `npm run typecheck:app`: exit 0 (`typecheck.log`). LSP checks on both changed
  source files, the changed test and QA script returned no diagnostics.
  A separate TypeScript compiler check found a missing battle-page fixture name
  (`changed-test-types.log`); it was fixed, not suppressed. Final changed-test
  syntactic/semantic diagnostics: zero (`changed-test-types-final.log`). The final
  172-test invocation includes that fix. Initial green receipts also remain.
- `node --check scripts/qa/p7-approach-correction.mjs`, `git diff --check`, and
  `npm run openwiki:index -- --check`: exit 0. Wiki index generation reports its
  existing missing-reference/encoding inventory; no broad wiki cleanup was made.

## Real UI evidence at 1024px

`P7_QA_PORT=9878 P7_QA_OUTPUT=output/evidence/cr-p7-1/encounter-st01a081df/ui
node scripts/qa/p7-approach-correction.mjs .` exited 0.

The real editor imported synthetic fixture content through the file chooser and
created a fresh panel-owned session. At **1024x768**, normal clicks collapsed chat,
expanded the checklist and criterion bundle, opened review, and separately
confirmed the approach. Both buttons passed visible center hit tests and real
Playwright clicks without force or layout changes. New screenshots were directly
inspected: `ui/browser-green/review-action-1024.png` and `preview.png`.

The normal restore-chat control then exposed Send. The recorded-wire fixture
consumed the approved revision from the next actual outbound model-request
payload, not harness-supplied args, and native dispatch appended one fresh
resolution. Read-only harness assertions retained original failures and criterion
4 false. New Chat removed the approval surface. Full report:
`ui/browser-green/report.json`; route errors were empty. The own server shut down.

## Preservation and limits

Earlier 152-pass and failed-review receipts remain untouched. Key SHA-256 values:

- `output/evidence/cr-p7-1/verified-tests.json`: `de7bf505b593368ab9f7abe42e305248a27b9cd847f8c9c99c1f5b06501a188f`
- `output/evidence/cr-p7-1/supervisor-tests.json`: `9ace80d265e0d2173f139c75416d87cacc0e6e8ee382e8e4f85760e5281d6dc5`
- `output/evidence/cr-p7-1/review-st01a081cc-encounter-countercase.json`: `45586a5fc48b87884836ea9729133698fa8fa35059d7eb2eb99e10a91427dbef`
- Original `.omo/evidence/cr-p7-1/verification.md`: `86f5a1a3a1742876a7e36d7795e9ac9f0b38fe134ab7591cbc565e19ec0a4d3a`

Recorded-model responses are explicitly fixtures, not live game generation.
No private session injection/restoration, provider call, forwarded DB/network
write, saved-game mutation, or protected-port use occurred. The offline browser's
existing autosave refusal remains visible in the report; no persistence is claimed.
Historical P7 remains blocked. Saved game 6588, physical proof, P8, and live-provider
proof remain outside this repair. Full gates and build were deliberately not run;
the parent owns those after integration.
