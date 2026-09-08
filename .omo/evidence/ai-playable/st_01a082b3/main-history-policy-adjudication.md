st_01a08244 [completed] model gpt-6-astra (reasoning max, variant max)
## Decision

Adopt **main's current-project archive UI with separate explicit recovery**, while preserving the parent's ordinary-read safety and ownership checks. **Do not make recovery absent-only.** That would remove main's existing ability to recover a newer remote revision of an older local record, although the actual callers already distinguish that action from Open.

This decision explicitly permits replacement **only during user-invoked recovery, for a preexisting local record that remains unchanged and is strictly older than the validated remote record**. It does not permit automatic replacement, replacement of concurrently changed records, or remote writes.

References below use:
- **P**: `d2be60d92b74e456ea4b9e54e30daafe7fc41fc8`
- **M**: `72f1f179b39972c3838922746c7641a57e95fce8`

### Why coexistence is feasible

Main already has separate production call paths:

- `ai-history-open` calls **`loadConversationForScope`**, which reads the local store and validates project ownership.
  - M `src/editor/panels/aiConversationHistoryModal.ts:377-412`
  - M `src/ai/conversationStore.ts:488-491`
- `ai-history-recover` calls **`hydrateConversationArchive`**. Recovery imports locally and refreshes the archive; it does **not** call `onOpen`.
  - M `src/editor/panels/aiConversationHistoryModal.ts:201-209,588-615`
- The only production modal entry point is the existing panel history action.
  - M `src/editor/panels/aiChatPanel.ts:946-968`; confirmed by this turn's revision-qualified `git grep`.

No additional remote viewer, fork/version archive, or session framework is necessary.

## Successor policy

### 1. Browse and ordinary Open

Use main's scoped archive queries and local-only scoped Open:

- Current-map, other-map, All and unknown-attribution views contain **only the captured project**.
- Legacy unscoped records remain separately inspectable, read-only. Foreign-project records remain stored but are neither listed nor adopted in either view.
- Browsing/filtering does not import remote records or change the live conversation.
- Open loads the latest available **local** retained record for the selected ID and scope. It must not hydrate, concatenate transcripts, replace that record from remote timestamps, or silently fall back to recovery.
- Remote-only history becomes available through the existing **explicit recovery button**, then ordinary local Open.

This deliberately supersedes P's automatic summary-GET/selected-record-GET UI sequence, not its ordinary-read safety principle. The approved scope distinction is also explicit in the supplied memory contract at `map-ai-history-run.md:8,20,31-34`.

**Nonmutating has a precise boundary:** archive reads and target-record adoption do not import or rewrite the selected transcript. Existing preservation of the *outgoing* live conversation must remain. Main checkpoints it at history entry and again before manual adoption; the latter also retires the outgoing turn. Do not remove those saves to manufacture “zero writes from the entire panel.”
- M `src/editor/panels/aiChatPanel.ts:342-367,799-810,946-950`
- Existing save/mirror policy is separate; this adjudication authorizes no live execution of it.

### 2. Explicit recovery admission

Capture one immutable local-record baseline **after legacy migration and before the first remote request**, covering the entire recovery operation—not a fresh baseline before each page.

For each validated returned record, apply this admission rule **inside the existing readwrite transaction**:

| State at transactional admission | Result |
|---|---|
| Recovery owner invalid or aborted | Stop further admission |
| Foreign local ID collision or scoped tombstone | Preserve local decision; skip |
| Absent at baseline and still absent | Import |
| Present at baseline and current stored record is exactly unchanged; remote `savedAt` is strictly greater | Replace locally |
| Local record created during retrieval | Skip, regardless of timestamps |
| Local record changed during retrieval | Skip, including equal-ms changes |
| Remote timestamp equal to or older than unchanged local | Skip |

“Unchanged” must compare the stored content, not just time, length, title or summary: include entries and nested content, title, model, ownership, timestamp and stored map provenance. Snapshot by value; the memory backend returns references from reads.
- M `src/ai/aiRecordDb.ts:93-108`
- Equal-time live updates are intentionally accepted: M `src/ai/conversationStore.ts:304` and `test/mapConversationStore.test.ts:120-125`.

The existing transactional seam is sufficient. Extend its admission precondition; do not perform a separate read/check followed by an unconditional write, and do not hold a transaction across network retrieval.
- M `src/ai/conversationStore.ts:258-267,520-541`
- M `src/ai/aiRecordDb.ts:164-207`

Retain main's pagination, validated destination/scope/body, compaction/provenance, tombstones, `{imported, skipped, rejected, durable}` result and local-only import. Concurrent-local vetoes are skips; invalid returned rows remain rejections. Later failure/abort does not roll back previously imported pages.
- M `src/ai/conversationStore.ts:509-546`
- M `openwiki/editor-ai-panel.md:31-49`

Do not rebase the operation's baseline on later pages: a local record created during page 1 must remain protected when its remote counterpart arrives on page 2. A subsequent **new explicit recovery invocation** can establish a new baseline.

### 3. Ownership and stale results

Compose, rather than choose between, both sides' guards:

- Retain P's live panel/project/scope/conversation/disposal predicate—not merely main's cached modal identity.
  - P `src/editor/panels/aiChatPanel.ts:953-961`
- Apply that ownership predicate to recovery admission as well as list/open callbacks.
- Retain P's latest-selection guard; main's render generation alone does not distinguish two Open clicks within one rendered list.
  - P `src/editor/panels/aiConversationHistoryModal.ts:100-103,155-165,199-201`
- Retain main's view-generation checks on Open success **and failure**, synchronous removal of scoped controls on legacy transition, and rejection of detached scoped actions in legacy.
  - M same path: `289-298,377-388,425-427`
- Preserve scoped errors without adopting a transcript, and refresh usable local history after an owned recovery outcome—including failure—so concurrent local saves do not remain hidden behind stale rows.
- No recovery/list/open completion may repaint a replacement or invalidated view. Already committed old-scope imports remain subject to main's documented partial-recovery boundary.

## Assertions to retain or explicitly migrate

| Existing assertions | Disposition |
|---|---|
| P `test/aiConversationHistoryModal.test.ts:191-203` and `test/aiConversationRemoteHistory.test.ts:252-262`: foreign-local selection | **Explicit policy migration:** replace with main's exclusion assertion at M `test/aiConversationHistoryModal.test.ts:304-313`. Also assert the foreign stored record survives and remains loadable under its own scope; exclusion is not deletion. |
| P remote-history test `:90-108`: automatic remote-only listing/Open, empty local store, two GETs | **Explicit action migration:** ordinary browse performs no recovery; Recover imports validated retained data locally; subsequent Open adds no import or remote GET. Retain exact transcript/no-concatenation checks. The old “store remains empty after the whole sequence” and summary-then-selected GET assertions no longer describe the successor UI. |
| P remote-history test `:110-123`: local duplicate wins for remote timestamps 1,000 and 9,000 | Retain for **ordinary Open without recovery**. Add a distinct explicit-recovery positive assertion: unchanged local 5,000 may be replaced by remote 9,000, but not remote 1,000 or 5,000. Do not convert the ordinary-Open test into a recovery test. |
| P remote-history test `:125-169,194-250,278-307`: failures, invalid data, local arrival, fresh affordances, foreign collisions | Migrate retrieval triggers to explicit recovery while retaining the safety assertions: local entries/title/preview/deletion affordance survive races and failures; invalid/foreign rows are not adopted; failures are not successful empty recovery. The former selected-ID GET mismatch case becomes appropriate full-page ID/shape/collision validation, not a fictitious selected GET. |
| P remote-history test `:171-192,264-276,330-356`: dismissal, replacement, scope, newer selection, new chat and teardown | Retain Open ownership tests using deferred scoped loads; additionally exercise pending explicit recovery through the real panel for the applicable ownership boundaries. |
| P remote-history test `:309-328`: shipped button restores public transcript; harness is null | Retain through **clock → Recover → suitable project filter → Open**. Keep audit equality, rendered retained text and `getHarness() === null`; migrate GET counts and allow main's added `mapIndex` metadata without weakening entries equality. |
| M `test/mapConversationRemote.test.ts:59-143` | Retain pagination/idempotence, full retained entries, zero import mirrors, newer-local/tombstone protection, rejection counts, partial provenance, abort/project-switch and transport-error assertions. |
| M `test/mapConversationRemote.test.ts:146-230` | Retain captured destination and equal-ms authoritative outbox replay, ambiguous legacy-payload failure and tombstone suppression. These existing outbound contracts must not be rewritten as part of recovery adjudication. |
| M `test/aiConversationHistoryModal.test.ts:225-313,343-451,454-671` | Retain recoverable scoped-load errors, map filters/catalog beyond 200 records, paging, provenance, read-only legacy inspection and transition races. |
| M `test/mapConversationStore.test.ts:21-165`; `test/conversationStore.test.ts:183-194` | Retain full retention/reopen, project isolation, map provenance, ordering, stale/equal-time saves, durable tombstones and truthful memory fallback. |
| M `test/aiStickyChecklist.test.ts:484-546` | Retain the entire history-adoption integration: outgoing abort, late-event/finally isolation, no queued-send replay, successful subsequent send and preserved restored transcript. Selecting All for its unclassified fixture is legitimate; deleting these assertions is not. |

Retain the corresponding project-session and browser contracts at M `test/aiChatSessionScope.test.ts:319-422` and `test/e2e/ai-map-history.spec.ts:102-175,191-265`. No browser execution was performed here.

Reconcile documentation explicitly: P `openwiki/editor-ai-panel.md:896` cannot remain an unqualified current contract beside main's archive section. Also correct main's recovery tooltip at `aiConversationHistoryModal.ts:206`: its “missing here” description does not disclose the implemented older-local update behavior. Describe the bounded replacement rule; no new prose-pinning test.

## Required new negative and race cases

Use deferred request/load signals and pending-work settlement, not sleeps:

1. Local absent at retrieval start, created while GET is held with a timestamp **lower than remote**: survives.
2. Preexisting local changed while GET is held, still older than remote: survives.
3. Equal-ms changes independently to entries—including same-length edits—title, model and map provenance: survive.
4. Local change after response arrival but before transactional admission: survives. Cover the actual IndexedDB transaction seam and memory fallback.
5. Record created during an earlier page and returned on a later page: survives.
6. Tombstone or foreign same-ID collision introduced while pending: no import, adoption or resurrection.
7. Unchanged older-local positive case still imports; equal/newer-local cases skip; repeat recovery is idempotent. This prevents an absent-only implementation from passing unnoticed.
8. Failure/malformed response after concurrent local creation: visible error plus usable fresh local rows; no successful-empty interpretation.
9. Close, project switch, new chat, teardown, competing Open, and legacy round-trip: no stale adoption/error painting; fresh authorized Open still works.
10. Recovery success never opens automatically, creates a private ledger/session, calls a model/wiki extractor, mirrors imported records or enqueues them for upload.

**Coverage clarification:** M `test/mapConversationRemote.test.ts:79-95` tests **newer-local** preservation, not newer-remote replacement. The latter is established by the implementation and this turn's execution; it needs its own retained positive regression.

## Adversarial check and verification boundary

I executed the exact M `hydrateConversationArchive` and `aiRecordDb` code in an isolated **memory-backend** probe with controlled retrieval and forbidden network/mirror/outbox boundaries. Eight checks confirmed:

- Main admits a newer remote record over unchanged older local.
- Main currently also overwrites records created during retrieval and equal-ms transcript/title/model changes made during retrieval.
- Newer/equal local timestamps, tombstones and foreign collisions are preserved.

The missing guard is specifically the import at M `conversationStore.ts:540` reaching the timestamp-only admission at M `aiRecordDb.ts:175-177`. A separate 18-case decision-table model passed for the proposed content-baseline rule. **That model is not an implemented or validated integration fix.** No repository suite, build, live DB, browser, provider or network operation ran; no source/test edits were made.

The strongest counter-case is a **preexisting, unchanged, divergent older local transcript**: the recommended explicit-recovery rule intentionally permits replacing it. A newer timestamp does not prove that remote contains every local entry. This decision therefore preserves ordinary-read and concurrent-unsynced safety, but must **not** be represented as lossless reconciliation of every divergent historical copy.

There is no additional human choice required to preserve the already-approved explicit timestamp-admission behavior under these stated limits. An absolute “never replace any divergent older local copy, even on explicit recovery” guarantee would be a different policy choice; neither current main nor this coexistence rule provides it. This adjudication authorizes no recovery against the saved game or existing user transcripts, and makes no private-ledger restoration claim.
