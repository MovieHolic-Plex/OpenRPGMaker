# Phase4 reviewed delivery

Phase4 is approved for a stacked PR against `agent/life-full-p3` at `966f414c07729e7d9474c568cbaf19a94d2bc740`. No remote merge is authorized. This is Phase4 delivery, not completion of the remaining economics/recovery journeys or all 51 features.

## Scope and source

Explicit per-placement animal housing, preserved paid-asset recovery rights, live placement safety, body/texture integration, linked-home editor and runtime controls, resident/weather/skill bounds, and save/DOM corrections were reviewed at `86562492591182205e7ff6add82eaad7ccf06d08`. Task13 product commit is `c92b2fbf0fcb8d2cf083d0ea659be1ff6366daea`. The final test-only lifecycle correction is `bae1f8624e9ec26f6e511a527d2bc3f1f96ba7a6`.

The earlier Task13 public [report](../13/final-publication-candidate/REPORT.md), [editor QA](../13/final-publication-candidate/EDITOR-QA.json), [player QA](../13/final-publication-candidate/PLAYER-QA.json), source binding and 21 named screenshots are retained unchanged. Their then-open whole-phase B1 disposition is superseded only by the correction described here.

## Verification and independent gate

- Prior parent integration: 116 related tests in 12 files, app typecheck, editor/player/standalone builds passed. Existing asset, import and bundle-size warnings remain. Task11/12/14 have their separate committed evidence directories.
- Real editor: 32 criteria passed, including changed remote save, close and reload, invalid-policy refusal and stale-consent protection. Real player: 30 criteria passed, including assignment/care/refusal and non-vacuous save-diverge-load. These use distinct explicitly labelled project inputs; ready products were input, not newly produced during the replay.
- Final correction: four initial case-local acquisitions moved into awaited hooks. All 12 test identities/order, 54 expect sites, four behavioral suffixes and eight other cases retained. Original 15s body and 90s hook defaults retained; gallery reset/reimport stays in its body. Two complete files passed once on two fork workers with a fresh run cache. Both test files had clean diagnostics.
- [Lifecycle data](lifecycle.json) and [original command output](lifecycle-stdout.log): 12 passed, 0 failed/pending, exit0. Setup settled before each body, all imports completed, and no import survived teardown. [Original process receipt](lifecycle-receipt.json): source/tool identity stable and no owned process after close. Exact local command was `node .omo/recovery/life-full-20260908/phase4-db-test-lifecycle/run-once.mjs`; the evidence-only runner/config remain local.
- Independent whole-phase reviewer `st_01a082d2` found only B1 blocking. Boundary reviewer `st_01a08322` approved the scoped approach. Fresh gate reviewer `st_01a08338` APPROVED these exact bytes and closed B1 after inspecting raw runtime events, installed watchdogs and 3,942 source/config hashes. Original final verdict SHA256: `0874f8c2e1bb4aba8b53d452b53d2c479fb0d7c81522f985dd93f75f73009e64`. Detailed original is retained locally at `.omo/recovery/life-full-20260908/phase4-db-test-lifecycle/B1-FINAL-VERDICT.md`.

## Historical failures and limits

Whole-suite comparison remains RED: base 13,910 total / 13,733 passed / 162 failed / 15 pending; prior current 14,080 / 13,899 / 166 / 15. There were 162 shared failed identities and four current-only database deadlines. All 170 added identities passed. Surface had six matched inherited failures. Unhandled invalid-204 and RPC observations remain disclosed in the prior report.

Controlled attribution found a BASE gallery timeout before render: 12.263s fetch API, 10.045s server handler and 7.979s overlapping transforms. A hypothesized new shape subtree was disproved. The four historical deadlines are resolved for delivery by the verified test-boundary correction, not renamed inherited or retrospectively attributed. No new whole-suite green, import speedup, cold-start SLA or cancellation guarantee is claimed. The independent gate required no additional full-suite run for this test-only correction. The pending-import fail-stop path was inspected but not executed.

Editor-owned remote ID: `task13-final-01a08046-d8cf2afc-b151-4f09-87d7-c14b2409bbaa`; stored wire SHA256 `c6372845d173186c54e48d7cab1ebd8806a4f3da8d38a7f2f1bf99ce44bce26f`. This does not replace the later whole-plan isolated remote proof.

No credentials, raw project/session/request data or private agent transcripts are added here. Lifecycle JSON is a labelled projection with local module paths made relative; stdout and receipt are exact originals. Historical raw failures and earlier evidence gaps remain preserved locally.
