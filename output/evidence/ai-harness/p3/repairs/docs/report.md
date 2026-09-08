# P3 repair documentation handoff

The existing AI Panel/tools, observability and testing sections now describe the
integrated independent-review corrections at
`34d5b672ad30c2dec5a3d58fa761f83781a6ee35`. The P3 evidence README leads with that
source and its recorded validators, and separates the earlier successful runs,
failed independent candidate and original timeout attempts as historical evidence.
OpenWiki verification, index generation/check and the artifact audit exited 0.
This is a documentation handoff, not independent re-verification or phase approval.

Task `st_01a07d66`; parent/root `01a07564-2645-75ee-8627-2f0990a25d52`.
Sole documentation writer in `/home/main/z-project/rpg-zzu-ai-harness-p3-20260907`
after repair integration. No product, test, QA, dependency, schema or other wiki
section changed. No behavior test, build, browser, full gate, PR, push or merge ran
in this task. No prose-pinning test was added.

## Source review and documented boundaries

Read the parent phase contract at
`/home/main/z-project/rpg-zzu/.omo/ulw-loop/ai-harness-implementation-01a07564/phase-p3.md`,
repository guidance, matching wiki sections, the integration report, both fix
reports and the original independent report. The retained
[artifact audit](raw/artifact-audit.json) hashes the two fix reports and original
independent report/probe/JSON/log/human failure packet. It checks working source
against all 4,509 scoped file hashes from the integrated focused command receipt.

Inspected the actual shared adapter and both ProjectStore replacement paths, plus
the human-race owner, response/retry and release ordering code. The documentation
now records:

- The same owner-bound `onApplied` callback runs after the actual mutation/counters,
  before activity observers or store subscribers can retire A and start B. A's
  prepared cancellation result retains applied delivery, without a pending copy,
  B-owned accounting, replay or fabricated persistence proof.
- Throwing accounting outcome observers still allow activity/store/autosave
  notification through `finally`; the original error propagates.
- The finite human edit/save/read owner holds every transport waiter and retry.
  Failure, cancellation and cleanup reject the hold. Observers subscribe before
  Send; only this race starts its unchanged completion timers just before release.
  Evaluation/cleanup bounds and product request limits remain, so this isn't an
  unlimited-latency claim.
- The integrated human packet has all 39 checks and saved readback at action 74,
  owner completion while held at 75, release 76 and final HTTP 77. The late packet
  has all 19 checks and awaits actual original A host settlement at sequence 11.
  Fake-clock lifetime coverage, not the native run's speed alone, supports R2.

[Repair integration](../integration/report.md) remains the behavioral evidence
owner. Its raw focused JSON has 883 passes, no failed/pending/todo tests and 53 file
results. Node output records 12 passes, including 11 lifetime cases and the original
completion wrapper. Direct receipts for app typecheck, build and all eight native
scenarios agree with their recorded exits, ports and packet hashes. The retained
52-file historical command still matches the repair runner's original selection
before it appends the accounting regression. None of those commands was rerun here.

## History, isolation and remaining limits

The earlier `9b2782f18` integration and original docs report remain historical.
The independent `450a1bbfb` report stays needs-fix: R1 had two passing controls and
one real accounting failure; R2 had only 15 positive checks, with 24 stale checks
never executed. The old item5 marker is now described as revoked after R1, not
current acceptance. The two original human deadline errors, later isolated success,
terminal-only late verification gap, predecessor REDs and first integrated focused
881-pass/two-failure attempt remain visible and unmodified.

Explicit unit history-transport isolation and the private Vitest cache requirement
remain documented. The six known ambient commit/change pairs and exact absence
checks aren't generalized to other IDs or unmeasured project-row impact. The
original full-gate 198 failures/23 pending and incomplete watcher attempt remain
historical, not overwritten by focused results. Paired full gates, independent
re-verification, gate13 and delivery remain lead/verifier-owned.

No new redaction guarantee, subjective pixel approval, external MCP HTTP/remote
telemetry proof, durable checkpoint or distributed/two-tab ownership guarantee is
claimed. Raw evidence still needs publication review. Many linked packets and the
original independent report live in retained ignored evidence or sibling worktrees;
a fresh checkout doesn't promise those files.

## Documentation verification

All validation commands used the phase TMPDIR and held the parent-owned
`p3-independent-repair-01a07564.lock` through bounded `flock -w 900 -E 75`.
Direct command receipts and unmodified logs are in this report's `raw/` directory.

| Validator | Result |
| --- | --- |
| `npm run openwiki:index` | Exit 0; generated INDEX from actual wiki content. Existing 137 missing-file references and 79 garbled lines remain visible, not repaired or hidden. |
| `npm run openwiki:verify` | Exit 0, `ok:true`, no failures. This validator's limited secret patterns aren't a complete redaction audit. |
| `npm run openwiki:index -- --check` | Exit 0, index current. |
| `python3 output/evidence/ai-harness/p3/repairs/docs/audit.py` | Exit 0; initial audit checked 74 links/anchors and 12 recorded command receipts, plus source equality and retained report/probe hashes. Final report-inclusive audit is recorded separately. No behavior execution or prose assertions. |
| Markdown LSP diagnostics | Unavailable: no `.md` server configured. Not reported as a clean diagnostic pass. |
| `git diff --check` | Exit 0 before staging; final staged check and commit receipt are retained in `raw/delivery.json`. |

## Authorized metadata and scoped delivery

The lead explicitly authorized including its existing
`.omo/plans/ai-harness-omo-adoption.md` modification unchanged. No checkbox or plan
text was edited by this writer. Its entry and delivery SHA-256 is
`eb6f6336661c65a46c5ef5fdc8f0ac27f00b6eb038d7d93655846a01c78b2fa9`.
This inherited change reopens item5; including it doesn't approve P3.

The single documentation commit contains only that authorized plan, the four
matching wiki pages, generated `openwiki/INDEX.md`, P3 README and this report.
`raw/delivery.json` records the commit SHA, direct commit exit, exact path list,
unchanged src/test/QA trees and final tracked cleanliness. Raw audit/validator
artifacts remain ignored for lead preservation, not staged as product or QA files.
