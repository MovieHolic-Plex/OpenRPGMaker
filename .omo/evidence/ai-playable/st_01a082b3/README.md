# CR-INTEGRATION-HISTORY-1 correction

Task: st_01a082b3. Author: OmO <omo@local>.
Parent/root session: 01a07680-34ac-7f79-8729-1c06bf78b736.
Base: 51c9d816de2002abcf40bf9f29f6c5ba9853d752.
Correction tree: /home/main/z-project/rpg-zzu-history-correction-st01a082b3.
Branch: agent/cr-integration-history-st01a082b3.

## Change and boundary

The startup closure now captures renderGeneration before awaiting the initial
archive catalog. It starts its list query only if that generation AND the live
modal/panel owner still match. This prevents older startup work from advancing
the generation and retiring an explicit Recover that started later. No recovery
admission, timestamp policy, outgoing checkpoint, Open, legacy, or session logic
was changed. Production diff is two added lines in aiConversationHistoryModal.ts.

The new worktree was created directly from exact 51c9 before source/test edits.
The integration baseline and parent QA checkout were not edited. No build, broad
suite, live provider, remote DB/game action, game generation, or extra agent was
invoked. Vite used fixture-only environment values, no .env.local, and unique
port 9283 with /tmp/st01a082b3-vite-cache. The dedicated race test intercepts
remote traffic and companion handshakes; no history request escapes its offline
response fixture. Normal/legacy controls use the existing blank-project browser
harness and its offline REST/LLM mocks. This is editor/source evidence, not live
history recovery, final game acceptance, or final parent build verification.

## Preserved review

51c9-integration-review.md and main-history-policy-adjudication.md are byte-for-byte
copies of the original parent evidence. They are not revised adjudications.
The actual parent evidence directory was the ai-playable-adversarial-0906 tree,
not the default command working directory. Original files remain in place.

## Red-first evidence (unchanged 51c9 production source)

- unit-red.log: four new tests; normal startup passes, race and two stale-owner
  startup cases fail. Race failure is exact retained entries versus undefined.
  Close/owner cases observe two archive queries instead of one. Exit 1.
- ui-red-confirmed.log/json and ui-red-confirmed-startup-recover-receipt.json:
  real shipped clock -> held native catalog completion -> Recover -> held GET ->
  release old catalog -> valid remote fixture. One GET; state becomes idle;
  retained record null; backend indexeddb. Exact-entry assertion fails, exit 1.
- ui-red.log: initial standalone browser registration hit its default 30-second
  test budget during cold editor boot, before the race. Not a source red.
- ui-red-ordering.log/json: first registration inside the existing history suite
  reached the clock, but its signal bound incorrectly included Playwright
  actionability overhead. Not a source red. The fixture now subscribes before
  action and bounds signal delivery after actionability completes. No fixed
  sleeps, polling, retries, or existing timeout increases were added. The test
  uses the existing history suite's unchanged 180-second boot/test budget and
  unchanged 5-second explicit signal bound.
- The confirmed red additionally blocked companion /v1/browser/next probes.
  Green explicitly fixtures both hello and next as offline 503. This transport
  fixture adjustment does not alter the catalog, recovery or archive logic.

All raw red outputs, screenshots, error contexts and traces remain in ui-red/,
ui-red-ordering/ and ui-red-confirmed/ in this worktree. Large trace ZIPs are not
included in the correction commit; raw-evidence-sha256.txt records their hashes.
The textual red receipts and decoded counterexample are included in the commit.

## Green verification

- history-green.log: one invocation, 8 files / 184 tests passed, exit 0:
  aiConversationHistoryStartup, aiConversationHistoryModal,
  aiConversationRemoteHistory, historyRecoveryAdmission, mapConversationRemote,
  mapConversationStore, conversationStore, aiChatSessionScope.
  Retains close/current-scope/replacement/new-chat/teardown/Open/legacy ownership,
  transactional admission, local overwrite/tombstone policy and ordinary startup.
- typecheck-app.log: npm run typecheck:app, exit 0.
- LSP tools reported no diagnostics on all four changed TypeScript files.
  changed-file-types.log independently checks syntactic/semantic diagnostics
  using the repository TypeScript compiler and tsconfig.json: zero in each file.
  Markdown LSP is unavailable; wiki-index.log and the index check validate the
  generated navigation index instead. Authored code/wiki diff --check passes.
  Whole staged diff --check reports eight trailing-whitespace lines in preserved
  raw red console logs; they are intentionally not rewritten (whitespace.json).
- ui-green.log/json: one invocation, three Chromium tests passed, zero retries:
  startup/Recover ordering; normal clock/current-map startup; read-only legacy.
- ui-green-startup-recover-receipt.json: loading after stale startup, ok after
  response, exact entries durably retained in native Chromium IndexedDB, one GET,
  no forbidden requests. Assertions additionally verify visible success, enabled
  Recover, one visible row, unchanged live ID/log until explicit Open, and no
  extra history request after Open. No private session or ledger is injected.
- ui-green-visible-recovery-success.png: visually inspected at 1440x900. Visible
  completion status (imported 1/skipped 0) and imported fixture row; modal remains
  open. The underlying blank editor is explicitly an offline fixture.

The unit regression wraps the real pending-work tracker only to observe the
startup promise while Recover is pending. Its archive query and fake IndexedDB
transactions remain native production operations. The browser instead holds the
completion notification of one already-finished Chromium readonly transaction;
it never holds a transaction open across networking. A subsequent native read
transaction completion drains the released startup microtasks before the GET is
released. Production modal/repository code is neither projected nor stubbed.

## Reuse on final parent source

From that checkout, with its own unused port and cache path (no live env file):

```sh
npm test -- test/aiConversationHistoryStartup.test.ts test/aiConversationHistoryModal.test.ts test/aiConversationRemoteHistory.test.ts test/historyRecoveryAdmission.test.ts test/mapConversationRemote.test.ts test/mapConversationStore.test.ts test/conversationStore.test.ts test/aiChatSessionScope.test.ts
npm run typecheck:app
VITE_LEGACY_DB_URL=https://history.invalid VITE_LEGACY_DB_ANON_KEY=fixture-only \
VITE_LEGACY_DB_PROJECT_ID=history-startup-fixture VITE_LEGACY_DB_USE_PROXY=false \
VITE_CACHE_DIR=/tmp/history-final-parent-cache DEV_SERVER_PORT=9284 E2E_RETRIES=0 \
npx playwright test test/e2e/ai-map-history.spec.ts \
  --grep 'startup catalog|clock opens history with the current-map filter active|legacy unscoped view'
```

The Playwright-managed server/browser close after the run. Port 9283 was confirmed
unbound; the task-owned temporary Vite cache was removed after verification.
The worktree and its raw evidence are retained for parent inspection/cherry-pick.
Parent compact-checklist/approach revalidation and final game QA remain parent-owned.
