# Map archive review repair evidence

Task: `st_01a07d79`
Worktree: `/home/main/z-project/rpg-zzu-map-ai-history-review-fix`
Branch: `fix/map-ai-history-review`
Base: `8450274d3e8f5b99d5a7be33e1e47efe837c5203`

## Delivered behavior

1. The two inherited saved-history adoption tests explicitly choose the existing
   whole-project filter before searching their map-unattributed fixture. The
   current-map default is unchanged. Every active-turn retirement, queued-send,
   late-publication, and transcript-isolation assertion remains intact.
   Each parameterized case now uses its own deterministic saved ID: cleanup
   tombstones the previous case's record, so reusing one ID prevented the second
   case from seeding its fixture even after navigation was corrected.
2. Map catalog discovery queries the complete scoped archive using the existing
   API's uncapped limit, retaining the current-modal guard and 20-row list pages.
   A regression saves 200 newer Map A records plus one older deleted-map record,
   confirms 201 stored records, then selects and opens that older map's whole
   conversation without paging through Map A.
3. A rejected full-record read reports an error through the existing status
   surface and keeps the row available for retry. Error and non-Error rejections
   are covered. Missing records produce a visible notice and refreshed list.
   Neither case calls the restore callback or changes the active conversation.
   Closed/replaced modals ignore late failures.

Only the allowed modal behavior, two allowed test files, and this evidence were
changed. No CSS, images, visual controls, storage/outbox changes, PR, push, or
merge. The separate read-only unscoped legacy view is not implemented; retain it
as Grok4.6's separately reviewed visual-control work rather than folding unscoped
records into this project's archive filters.

## RED/GREEN chronology

Command outputs (trailing blank lines trimmed) and direct process exit statuses
are retained side by side. No test failure was suppressed; targeted RED selection
explains the reported skips.

| Evidence | Command / result |
| --- | --- |
| `red-inherited.log`, `.exit` | Before any test/production changes: `npm test -- test/aiStickyChecklist.test.ts -t 'manual saved-history adoption retires outgoing'`; exit 1, both inherited cases fail with `Missing rendered ai-history-open` at original line 522. |
| `red-regressions.log`, `.exit` | After adding regressions, before production fixes: `npm test -- test/aiConversationHistoryModal.test.ts`; exit 1, 4 failures (201st-record map absent; Error/null read failures and missing-record notice remain idle). Stale-modal cases already pass on the baseline. |
| `intermediate-tests.log`, `.exit` | First required combined run after navigation/modal changes: exit 1, 76 pass, terminal fixture fails because it reuses the prior tombstoned ID. This exposed the deterministic fixture-isolation fix; it was not retried unchanged. |
| `green-tests.log`, `.exit` | After isolating fixture IDs: `npm test -- test/aiConversationHistoryModal.test.ts test/aiStickyChecklist.test.ts test/aiChatSessionScope.test.ts`; exit 0, all 77 tests pass (25 + 34 + 18), no skipped tests. |
| `typecheck-app.log`, `.exit` | `npm run typecheck:app`; exit 0. |
| `changed-file-diagnostics.log`, `.exit` | TypeScript compiler API using `tsconfig.json`, syntactic and semantic diagnostics for all three changed source/test files: exit 0, zero diagnostics. Initial LSP checks also returned none on all three files; after the fixture-ID change, fresh LSP diagnostics timed out twice, so this compiler check verifies the final files instead. |
| `browser-smoke.log`, `.exit` | `node output/evidence/map-ai-history-review/browser-smoke.mjs`; Chromium + real IndexedDB, exit 0, zero page errors. |

`git diff --check` also passed. Whole-project gates and build remain parent-owned
and are not claimed here.

## Real browser exercise

The reproducible browser driver starts a private ephemeral Vite server with an
isolated temporary cache, mounts the shipped modal in Chromium, and invokes its
actual DOM controls. It verifies the 201-row catalog, whole-record open, visible
read error after successful listing, retry, stale-modal rejection suppression,
and missing-record refresh. The failure is injected at `IDBObjectStore.get`, not
by replacing the modal or conversation-load function. It restores that boundary
in `finally` and asserts no browser page errors.

The driver uses only isolated local test records, no remote project, credentials,
model call, CSS changes, or screenshot claim. Work settlement is awaited through
the existing pending-work API; no sleeps or polling were added. Browser/server
and temporary cache cleanup completes before the command exits.
