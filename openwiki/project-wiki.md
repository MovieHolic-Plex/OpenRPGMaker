> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Project wiki

The project wiki extends the existing `project.world` documents. It is not a
separate browser memory database. `project.worldCanon` remains manually owned.

## Data and evidence

`WorldEntity.wiki` is optional for legacy compatibility. It records a document
kind (`declaration`, `knowledge`, `progress`), evidence basis (`explicit`,
`inferred`, `observed`), host-owned sources, optional topic/combat mode, and
superseded document IDs. `origin: ai` identifies the writer, not the certainty
or provenance of a fact.

### Work history is not a codex document (2026-09-20)

New wiki extraction creates lasting `declaration`/`knowledge` only. The extraction
adapter rejects new `progress` patches. `applyProposedProject` records work through
the existing commit and mutation audit paths; it no longer calls a wiki observer,
adds an `적용된 작업` card, takes a second wiki undo snapshot, or flushes a progress
document. Application delivery refers to the actual tool-applied project.

Legacy AI `progress`/`observed` cards backed solely by application sources remain
byte-content-preserved in `project.world.entities` for export/load compatibility
and references. This is a read-through history migration, not deletion or replay
into newly timestamped commits. `world/activity.ts` identifies them; the codex
list, search and selection omit them. `작업 기록 → 행위 기록 → 이전 AI 작업 기록`
provides a read-only, newest-first, paged view with original dates and full text.
Manual annotations (`knowledge` with manual sources) and user-owned records stay
in the codex. No schema bump, SQL migration or live-project bulk rewrite is needed.

All `progress` documents are excluded before both the eight-document retrieval
limit and the 64-document extraction-input limit. `read_project_wiki` also excludes
them when explicit IDs or `includeHistory` are supplied; that flag refers to old
knowledge revisions, not work logs. Automatic work history cannot become project
knowledge merely by matching the query. Historical source bodies remain available
in the work-history UI and project exports.

Source IDs, text, kind and chronological ordering are supplied by the host.
The model can reference supplied IDs but cannot fabricate evidence. User
intentions do not prove implemented progress. Applied-state sources cannot
prove an explicit user request.

## Ownership and retrieval

- `src/project/world/wiki.ts` validates patches and reconciles them against the
  current documents. Conflicts reject the patch atomically. Locked, manually
  authored, and manually edited pages are protected. Corrections retain old
  documents and supersede them using new IDs.
- `src/ai/projectWikiClient.ts` uses the existing OAuth-aware LLM configuration.
  Extraction errors and cancellation propagate; only its own 45-second abort is
  typed as `ProjectWikiExtractionTimeoutError`. An empty patch means the model
  found no new facts, not that a failed call succeeded. The patch boundary accepts
  bare JSON or one JSON/unlabelled code fence with optional surrounding prose.
  Surrounding braces, brackets or backticks reject the envelope rather than
  selecting among competing objects, arrays or fences. The entire payload still
  passes JSON parsing and the existing strict schema/provenance validation;
  missing `upserts`, malformed records and unknown fields are not empty results.
- `src/ai/projectWikiContext.ts` selects at most eight relevant documents within
  a 6,000-character context budget. Map-scoped explicit combat decisions take
  precedence over global explicit decisions; inferred defaults stay in context.
- `AssistantSessionOptions.prepareProjectWiki` is awaited before intent/tool
  selection. The editor owns saving, while the session owns detached authoring.
- Ordinary authoring proposals preserve the live wiki. They do not own newer
  codex changes. Explicit project reset remains a separate operation.

Generic legacy world CRUD tools and blanket world lint warnings remain excluded.
The approved lifecycle supersedes the former blanket AI exclusion, without
restoring the old unused ontology scaffolding.

## Editor lifecycle

`src/editor/projectWikiCoordinator.ts` owns document updates and awaited saves.
Chat, region and cluster sessions inject its preparation callback. A changed
project identity, locked document, concurrent manual edit, malformed extraction,
or unsuccessful save stops authoring with a visible error. Temporary projects
may save locally, but the status does not claim a remote save.

Extraction parsing runs in the browser, not the provider worker:
`AssistantSession.sendUserMessage` -> injected coordinator `prepare` ->
`extractProjectWiki` -> `parseProjectWikiPatch`. An HTTP 200/stop response can
therefore fail preparation before intent selection. A valid `{"upserts":[]}`
preserves the whole project and completes preparation; existing wiki records
still take the coordinator's normal awaited flush path.

Only a current-turn extraction's own deadline may return the typed preparation
outcome `{kind: "deferred", reason: "extraction-timeout"}`. This requires an
existing wiki before preparation, unchanged world records, the same project
identity, unchanged requested-map content (including same-ID replacements), and
no caller cancellation. Backfill and
initial extraction remain fatal on timeout. Unknown/provider/caller timeouts,
parsing/provenance/protected/supersession conflicts, and save errors remain
failures. Deferral applies no patch, records no history, emits no delivery or
save milestone, and leaves both detached world copies intact (never an empty
patch or `undefined` fallback). The session reports `wiki:deferred`, then the
original user turn performs normal intent, acceptance, original-context,
planning and authoring initialization. No retry/driver continuation is injected.
The 45-second deadline and provider options are unchanged. This source repair
is prospective: it does not resume P6 or establish effective provider settings.

Integrate parser fixes into the editor source/bundle through normal deployment.
A worker restart alone cannot update a loaded browser module. Existing sessions
retain their preparation callback from construction; do not assume a build or
HMR replaces that callback. A normal editor reload/recreated session loads the
new code, but conversation restoration restores audit/transcript context, not
private acceptance ledgers or request baselines. It is not a continuity proof for
an open acceptance run. Preserve such a run until its owner authorizes a lifecycle
transition; do not hotpatch callbacks or manually reconstruct private ledgers.

For projects without wiki records, available same-project local conversations
are recovered chronologically in batches of 16 sources before the current
request. The shared AI action menu also exposes `이전 대화로 설정집 정리`.
This reads the full same-project local conversation archive, not the recent-50
list. `projectWikiHistorySources` preserves `history:<conversation-id>:<entry-index>`
source IDs and the existing text conversion. The archive may contain compressed
transcripts, so deleted middle entries cannot be recovered by this reader.
Explicit map-history remote hydration can make additional local sources available;
browsing or importing history itself never invokes wiki extraction or saves wiki
documents. Wiki backfill remains a separate, editor-owned action.

Intent selection and normal authoring receive the same relevant wiki context.
The intent cache includes that context, so a correction invalidates the earlier
route. Core declarations outrank other knowledge within the context budget;
work-history records do not enter it.
`read_project_wiki` retrieves selected document bodies in 12,000-character pages.
Generic CRUD and blanket wiki lint remain absent.

Successful shared proposal application records work in the existing commit/audit
history. It creates no wiki progress document. Ordinary proposals and region
applies retain newer live documents.

## Combat acceptance slice

`make_hunting_ground` follows explicit wiki combat decisions and map exceptions.
Otherwise an already active action map stays action, and the existing
`adventure-jrpg` genre uses contact battles. Contact/action routes disable random
encounters; action enables both the system and map opt-in. Inferred defaults are
not relabelled as explicit user statements.

Field graphic overrides require a real sprite reference (or explicit
transparency). An unresolved `{query: "monster"}` is not an EventPageGraphic and
must be rejected; omitting the override uses the troop enemy's existing art.

## Verification

Work-history separation: `wikiActivitySeparation.test.ts` covers actual
serialize/load retention, manual annotations, codex deep links, both AI input
budgets, explicit tool reads, original dates, escaped text, pagination and project
switches. `projectWikiApplication.test.ts` checks repeated successful application
and commit-log failure without extra documents, snapshots or wiki flushes.
Browser component QA: `node scripts/qa/wiki-work-history.mjs` (set
`WIKI_QA_ORIGIN` to the worktree server); screenshot and report under
`output/evidence/wiki-work-history/`. It uses production panels/store/styles and
test fixtures without remote writes. At `759975b8c`, the existing LegacyDb-specific
assertions in `applyChangesetToStore.test.ts` fail unchanged on baseline because
the default repository now selects memory/local storage; compare regressions
against that baseline rather than treating those two assertions as new failures.

Domain tests: `projectWikiDomain.test.ts`, `projectWikiPatch.test.ts`,
`projectWikiClient.test.ts`, and `projectWikiContext.test.ts`.
Session/application tests: `projectWikiSession.test.ts` and
`projectWikiApplication.test.ts`. Manual edit races:
`projectWikiManualEdit.test.ts`. `projectWikiPreparation.test.ts` exercises the
real coordinator/extraction/parser seam and the session's pre-intent barrier,
including the captured Round11 wire100 response in
`test/fixtures/project-wiki/wire-response-100.json`. Assertions cover parsed
values, complete-project preservation, valid record application and atomic
rejection, not the explanatory prose or the user's continuation wording. These
are offline tests, not renewed gameplay or acceptance evidence.
`projectWikiTimeout.test.ts` uses controlled deadline scheduling and exact abort
and transport-settlement signals through the real session/coordinator/parser
and in-memory store/history path. Test-context cancellation aborts the original
turn; failure-path teardown settles ignored transports and drains all owned
turn/extraction/transport operations before restoring shared state. Only the
extraction's own deadline is advanced; unrelated background jobs remain frozen.
A one-tile tileset removes irrelevant bundled metadata, not real authority or
persistence checks. It checks preserved records, normal planner
and original-context initialization, real acceptance authority rejection,
detached title authoring, no late writes, fatal non-exempt errors, and timely
application with truthful local-save delivery. No live project is exercised.

Live evidence uses a separate LegacyDb QA project and the user's existing OAuth
provider. A successful model reply is not evidence of wiki persistence; require
store flush followed by loading the same remote project. Runtime combat proof
uses the exported player (`player.html`), never the editor play shell.

Commands:

```sh
E2E_RETRIES=0 DEV_SERVER_PORT=9857 npx playwright test test/e2e/project-wiki.spec.ts --workers=1
node scripts/qa-project-wiki.mjs --base-url http://127.0.0.1:9857 --scenario oauth-combat --project-id qa-project-wiki-combat-20260907
node scripts/qa-project-wiki-runtime.mjs --project output/evidence/project-wiki/qa-project.json
```

The runtime proof loads unchanged exported data, uses keyboard Enter at the
keyboard-only title, then proves visible monster contact opens `battle-scene`
and a map attack reduces the same action enemy's HP without creating that scene.
