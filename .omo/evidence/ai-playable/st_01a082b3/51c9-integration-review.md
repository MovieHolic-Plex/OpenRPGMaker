st_01a082a2 [completed] model gpt-6-astra (reasoning max, variant max)
**CHANGES REQUESTED for `51c9d816de2002abcf40bf9f29f6c5ba9853d752`, tree `585bf78abc4dfd77dfc1627fe5529f9790507ace`.** One integration-specific source CR is confirmed. The other reviewed composition paths have no established blocking source finding.

All source references below are relative to the integration checkout.

## CR-INTEGRATION-HISTORY-1 — stale startup work cancels newer explicit recovery

**Priority: P2.** Guard the initial catalog-to-list continuation against generation changes.

At `src/editor/panels/aiConversationHistoryModal.ts:691-694`, startup does:

```ts
await refreshArchiveMapIds();
await fetchPage(false);
```

`refreshArchiveMapIds` correctly discards its stale result, but its caller then unconditionally starts `fetchPage`. That increments `renderGeneration` and clears loading status (`:538-539`), invalidating a newer recovery's `isRecoveryCurrent` predicate (`:597-605`).

### Independently reproduced

The bounded offline countercase used the real modal, archive queries and fake IndexedDB. It held the initial catalog result, clicked Recover, held the mocked GET, then released startup before returning valid remote history. No scope change, dismissal or competing user action occurred.

Observed:

```text
{"requests":1,"recoveryState":"idle","retained":null,"adopted":0}

AssertionError: expected undefined to deeply equal [
  { kind: "user", text: "request-remote-only" },
  { kind: "assistant", text: "answer-remote-only" }
]
```

Thus an authorized recovery silently disappears. This is not a local-overwrite vulnerability; it is incorrect retirement of the newer operation by older work.

**Required correction:** capture startup's generation before awaiting the catalog, and invoke its subsequent `fetchPage(false)` only if that generation and live modal ownership still match. Retain a deterministic regression for this ordering, including successful import, visible successful recovery status, no automatic Open and no import mirror.

I tested that narrow guard through an **in-memory source projection only**. The control passed:

```text
{"requests":1,"recoveryState":"ok",
 "retained":[
   {"kind":"user","text":"request-remote-only"},
   {"kind":"assistant","text":"answer-remote-only"}
 ],
 "adopted":0}
```

The candidate remains unfixed. Each invocation selected one countercase; the other 41 tests were unselected, not new coverage. No repository edits were made.

The existing recovery scenarios settle startup before clicking Recover, explaining why their recorded green results do not cover this race. [`test/aiConversationRemoteHistory.test.ts:84-164,233-245`]

*Corrected source location: the startup continuation is at lines 691-694, not the coordinates in my earlier commentary.*

## Remaining source composition

I inspected the 12 resolved production files and their shared callers, rather than treating inherited changes as newly authored work.

- **History admission:** one cloned, full stored-value baseline is captured after migration and before networking; transactional admission preserves concurrent creation/change, equal-time nested content/title/model/map provenance, tombstones and foreign collisions. Unchanged older-local replacement remains permitted. Ordinary Open remains local-only. [`conversationStore.ts:258-288,523-575`; `aiRecordDb.ts:165-212`; `aiConversationHistoryModal.ts:380-419`]
- **Independent review and delivery:** the fresh complete envelope, deterministic blockers, separate reviewer image acknowledgment, shared budget and approval-before-apply path remain composed. Writer delivery does not donate reviewer credit. [`independentReview.ts:179-202,207-239`; `assistantSession.ts:4518-4529,4586-4590,4805-4820,4965-5006`; `aiTurnRunner.ts:493-504`]
- **Canonical acceptance and approach:** original baselines, IDs, args and sibling criteria remain immutable; approach authorization remains host-confirmed, encounter-excluding and dependent on fresh exact native proof. [`assistantAcceptanceLedger.ts:54-66,141-164,307-324`; `toolVerificationEvidence.ts:179-190,269-346,361-429`; `assistantSession.ts:1715-1734`]
- **Wall accounting:** historical executed layer and explicit current-cell coverage remain separate from meaningful change. Automatic completion, independent review and terminal accounting pass current project content. [`mapTools.ts:347-398`; `proposalCompleteness.ts:106-164`; `assistantSession.ts:3306-3320,4526`; `aiTurnRunner.ts:508-517`]
- **Wiki and persistence:** typed owned-wiki timeout deferral does not bypass authored-baseline rejection. Lineage-scoped save/retry handling retains main's remote-enabled condition, transactional source-current safeguards and actual accepted-revision proof. [`projectWikiCoordinator.ts:152-190`; `assistantSession.ts:2273-2294`; `store.ts:1214-1277,1300-1374,903-948`]

The exact single-side blob audit found **no unexpected modifications outside the declared manual paths**. All recorded final-file hashes still matched after the probes.

## Fixture and gate accounting

The inspected migrations preserve substantive checks rather than replacing them with approval shortcuts:

- Baseline tests now inspect rejected draft evidence while asserting unchanged store, undo history and commit calls where early application is prohibited.
- Scripted acknowledgments enumerate actual request image positions.
- The event-image fixture still uses the real renderer and PNG encoder, checks outbound image presence, retains `[1,0]` rendered-image and `[true,false]` review results, and remains finally unverified. [`assistantAcceptanceRequestBaseline.test.ts:112-205`; `independentReviewFixture.ts:12-21`; `toolImageEventAcceptanceSession.test.ts:43-118`; `toolImageRasterDom.ts:92-96`]

Executing the inspected accounting validator without its file-output statement confirmed the recorded **76-file overlay: 1,276 passed / 4 retained baseline failures**, with **316 core passes**. This remains an overlay, not a fresh all-green invocation. The original 19 failures are accounted for as 15 fixture migrations and four retained failures. The four matching assertion bodies remain:

```text
aiWorkItemStall (a)(b): expected 'in_progress' to be 'blocked'
aiWorkItemStall (a-2): expected undefined to be truthy
aiWorkItemStall (c): expected 'in_progress' to be 'blocked'
eventValidationNavigationContract: expected 2 to be +0
```

The diagnostic comparison confirmed **20 inherited test diagnostics, zero new signatures and zero source diagnostics** in that recorded selection. The new supervisor typecheck and CSS receipts both report **exit 0**.

### Updated surface gate: red and incompletely captured

`supervisor-surface-gate.log` reports exit1; its embedded console summary says **107 passed / 8 failed across 10 files**. But the file is actually truncated at 65,614 bytes inside `out`, and JSON parsing fails with an unterminated string. The referenced `/tmp/db-surface-xmevMe/vitest.json` no longer exists.

The additional shell mismatch reports `event-page-appearance-select` and associated controls. That control is present at `pageProps.ts:1471-1488`; the relevant shell source, appearance-control source, shell baseline/floor and all ten axis test files are **exact 72f blobs**.

Therefore this shell difference is attributable to retained upstream surface changes at the source level—not evidence of an integration-authored regression. **Complete failure equality against executed exact72f remains unsettled.** I do not reuse d2be's seven-failure classification or mark this gate green.

At my last read, `supervisor-51c9-tests.log` contained only its 76-file START record. No completed fresh supervisor test result is claimed here. Authored-source whitespace against72f passed; whole incoming-diff cleanliness is not claimed.

## Residual obligations

1. **Integrated browser surface:** after the source CR is fixed, exercise history startup/Recover ownership normally. Also revalidate approach discovery, preview, distinct confirmation and subsequent exact execution in main's compact/grouped, hideable checklist. Its layout differs from approved d2be; the older browser receipt does not establish visibility here. [`aiStickyChecklist.ts:127-375`]
2. **Final gates and persistence:** complete parent-owned tests/build and exact72f surface classification, preserving incomplete receipts. Bind the final source/build to actual save and fresh-reload identity; this review did not contact the live project.
3. **Player/artifact:** retain historical P7/P8 as blocked and preserve the supplied `5a6fdc…467a` artifact boundary. Complete the adjudicated final shipping-player journey, no-key crossing, reward/key provenance, ending/open-page state, separately labeled save-codec proof, duration and audio disposition. Mixed-source actual-AI history plus prospective source proof and final-player evidence remains permitted. [Parent `p8-artifact-boundary-review.md`, section 4]

**Recommendation:** require CR-INTEGRATION-HISTORY-1 before SOURCE CLEAR. Do not regenerate the game, relax acceptance, rewrite historical records or replace main's explicit recovery policy to address it. This is neither final-game approval nor PR merge approval.
