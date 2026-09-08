# PR687 gate-contract repair: Added1 + Added2

Base: `9ec00519084303743848223501b1782ca0111ec3`.
Branch: `fix/pr687-advisory-provenance-st_01a07c86`.
Tree: `/home/main/z-project/rpg-zzu-pr687-integration-st_01a07c86`.
This cohesive commit follows parent `pr687-gate-adjudication-8c.md`; parent owns combined validation and re-review.

## Added1: narrow pre-write lint provenance

The host executes the existing read-only lint producer against its project baseline before
preparation/model writes. Producer logic is shared with registered run_lint, not duplicated.
Capture happens once per goal; same-goal rebase, repair and continuation cannot replace it.
Only explicit new-goal retirement clears that provenance. Capture failure is audited and
leaves provenance unknown, never exempt.

An automatic default `run_lint({})` finding can be report-only only when its complete error
records match host-confirmed pre-write records, including identity and multiplicity, it has
never been observed explicitly, and no active adopted lint requirement owns the check.
Missing/truncated details, unknown provenance, new errors, equal-count different identities,
explicit genuine negatives and required checks remain blocking. Other verification tools
receive no exemption. Findings remain negative and retained; no passing verdict is invented.
Distinct lint defect sets are retained separately so a later new error cannot hide behind an
older report-only finding. Explicit observation promotes the matching finding permanently;
a later advisory observation cannot downgrade it. Compatible real passing checks still clear findings.

`problems()` and `CompletionAssessment.verification` retain all reports.
`problems("blocking")` and `CompletionAssessment.blockingVerification` drive terminal gates.
Report-only baseline lint is appended to the completed response and remains in audits and
snapshots, without spending terminal-repair budget on the unrelated title edit.

## Added2: fixture only

The frontage test now uses valid identical `from` coordinates, upfront adoption and an explicit
owner/check ID. The ID is exactly `JSON.stringify([tool, frontage])`, preserving both original
scope-string assertions. Structured checks prove passed -> stale -> successful unrelated guide
attempt with the same sole stale requirement -> fresh exact pass. All three attempts must be
successful. No source rollback or altered scope assertions were used.

## Verification

- Red: `pr687-provenance-title-red.log` reproduces the real title-only failure at9ec:
  `expected error to be final`, after script exhaustion. The unchanged case retains the original
  four responses and never pads them. The initial red log also records an overly strict zero-fetch
  fixture assertion; the known optional activity mirror is now intercepted explicitly, with no HTTP.
- `pr687-provenance-green.log`: **2 files / 32 tests passed**. New controls cover the real title
  application, exact unchanged lint identities, adopted lint, explicit negatives, introduced errors,
  equal-count identity replacement, unknown provenance, continuation/rebase capture-once behavior,
  separate retained findings and explicit promotion. Only external commit logging/activity transport
  is replaced; normal session dispatch, native lint, the commit gate, apply and store remain real.
- `pr687-provenance-added1.log`: the original untouched Added1 test in aiAssistantSession passed
  with its original final assertion and four-response script (one selected test; 62 unrelated cases
  were not executed). No test code was skipped/deleted or timeout/budget increased.
- `pr687-provenance-focused.log`: **19 files / 405 tests passed in one invocation**, including the
  prior nine-row matrix, 9ec canonical recovery/ownership, functional persistence and NPC contracts.
  Exact commands and outputs are in the logs; overlapping counts are not additive.
- `pr687-provenance-tsserver.json` / `.log`: direct TypeScript-server syntax, semantic and
  suggestion diagnostics for **all 5 changed TS files: zero missing responses, zero diagnostics**.
- Product/test/wiki `git diff --check` passed; focused wiki and generated INDEX updated.

No parent/live, UI, DB, model, env-file or remote Git writes occurred. Unit transports were
intercepted; no actual HTTP/DB call occurred. No full gates/builds or additional baseline sweeps
were run. Canonical scene/input repair and provider transport source are unchanged by this patch.
