# Integration st_01a08238: history-policy adjudication required

## Exact isolation

- Branch: agent/ai-main-integration-st01a08238
- Worktree: /home/main/z-project/rpg-zzu-ai-main-integration-st01a08238
- HEAD / first intended parent: d2be60d92b74e456ea4b9e54e30daafe7fc41fc8
- MERGE_HEAD / second intended parent: 72f1f179b39972c3838922746c7641a57e95fce8
- Verified common base: 9a7069e685bad13cde5cbb22b9cb285e893f2356
- Exact merge invoked with --no-commit --no-ff and rerere disabled. Exit 1, 23 unmerged files. Original merge output and contextual conflicts retained alongside this note.
- No source/test/wiki conflict resolution has been applied. Automatic nonconflicting Git composition is present, not verified as correct.
- Provisioned with project wt adopt. Its copied DEV_SERVER_PORT was protected 9841; changed ONLY this new worktree's port to 19838 and its private copied env permissions to 0600. No server was started or port contacted/bound. Credentials were not displayed or changed.
- Parent worktree was read-only and its HEAD was rechecked as d2be. No game, settings, DB, provider or browser operations. No gc/prune/log/object cleanup.

## Genuine incompatible history contracts

These are product-policy assertions, not old selectors or scripted reviewer envelopes:

1. d2be test/aiConversationRemoteHistory.test.ts, test `keeps the established explicit foreign-local open policy`, requires a foreign local conversation to be listed and passed to the normal onOpen callback. Its wiki contract explicitly retains selectable foreign-local history.
   72f test/aiConversationHistoryModal.test.ts, test `Given 다른 프로젝트의 대화 When 모든 필터 Then 나열되지 않는다`, requires no foreign-project rows even in All. The upstream modal file header and openwiki/editor-ai-panel.md first section require current-project-only adoption; legacy unscoped history is read-only.
   Both cannot hold in the same project history surface.

2. d2be test/aiConversationRemoteHistory.test.ts, test `shows and opens a remote-only record without caching, concatenating or writing it`, requires summary GET then selected-record GET and an empty local records store afterward. d2be local duplicates remain authoritative even when the remote timestamp is newer; local records created during a GET also win.
   72f's normal public remote recovery uses explicit hydrateConversationArchive, loads full remote pages, compacts/imports records locally, and then opens through loadConversationForScope. The implemented importer uses timestamp admission (older/equal imports skip); it is not a non-caching remote-open path. Upstream map archive/tombstones and explicit recovery contracts are documented in openwiki/editor-ai-panel.md:3-80 and exercised in mapConversationRemote.test.ts.
   Changing the d2be assertions to expect cached imports or newer-remote replacement would alter the preserved recovery contract, not merely adapt selectors.

## Recommendation for parent

Authorize main's current-project-only/explicit-recovery surface as the successor UI policy, while retaining d2be's stronger unsynced-local precedence and stale owner/selection checks. Explicit import may add only absent non-tombstoned IDs, must not replace any extant local transcript, must not mirror/write remotely, and must preserve honest compacted/public-history-only provenance. This requires explicit adjudication of d2be's non-caching UI and foreign-local-open assertions and upstream newer-remote import semantics. Do not silently delete or invert these assertions during integration.

An alternative separate non-caching remote-view UI would broaden product scope; it has not been implemented or assumed.

## Per-domain resolution matrix (decisions proposed, NOT applied/validated)

| Domain | Conservative composition | Status |
| --- | --- | --- |
| Independent reviewer/session | Retain upstream fresh complete reviewer envelope, budgets, authored-baseline latches and approval-before-apply; feed d2be canonical/blocking checks and meaningful/maintenance coverage into it, not the removed writer self-review. Preserve final completion/persistence assessment independently. | Pending resolution + seam tests |
| Acceptance/approach | Retain immutable originals, host-only appended approach revisions, encounter exclusion, exact current-applied-content dispatch and append-only failed receipts. Upstream draft evaluation must not label a draft as applied or grant approach credit to an unapplied draft. | Pending resolution + 285 core tests |
| Image delivery | Retain d2be actual transport acknowledgment and upstream independent reviewer image payloads; no receipt credit from merely rendering/queuing an image. | Pending resolution + negative seams |
| Wiki preparation | Retain owned-timeout deferral and upstream authored-baseline/wiki ownership checks. Deferred result does not overwrite any world; stale authored baseline still rejects. | Pending resolution + timeout/persistence seams |
| Persistence/store | Combine lineage-scoped failure/retry guards with upstream remotePersistenceEnabled guard, diagnostics, issue693 transactional showcase/media guarantees. | Pending resolution + focused persistence tests |
| History/archive | Scope-only versus foreign adoption; explicit local import versus non-caching read/local-always-wins. | BLOCKED: parent policy adjudication |
| Checklist/panel | Retain upstream compact grouped checklist, visibility/menu/focus behavior and d2be distinct approach preview/confirmation callbacks under live owner checks. | Pending resolution + DOM tests |
| Fixtures | Preserve both sets of machine assertions; adapt tool budgets, fresh reviewer responses and selectors to actual upstream contracts. No old early milestone application or weakened gates. History policy assertions cannot be migrated without decision above. | Pending |
| Nonconflicting upstream domains | Retain exact upstream audio-preview workbench, project-menu, issue693 and other cleanly merged changes. Audit automatic composition against both parents. | Auto-merged only, not validated |
| Wiki INDEX/evidence | Merge prose by domain, reconcile adjudicated contracts, regenerate using unchanged generator and check whitespace. Keep historical P7 failures and all parent receipts. | Pending |

## Verification boundary

No app typecheck, focused tests, LSP, build or browser validation has been claimed or run on the unresolved merge. Compiling conflict markers would not validate a candidate. No merge commit created: the user requires resolved conflicts and successful focused validation before commit. Parent final-source gates/build/game QA remain untouched. Historical P7 is still blocked/incomplete/persisted, saved game6588 unchanged, P8 UNSENT and private-ledger restoration not claimed.
