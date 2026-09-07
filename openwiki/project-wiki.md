# Project wiki

The project wiki extends the existing `project.world` documents. It is not a
separate browser memory database. `project.worldCanon` remains manually owned.

## Data and evidence

`WorldEntity.wiki` is optional for legacy compatibility. It records a document
kind (`declaration`, `knowledge`, `progress`), evidence basis (`explicit`,
`inferred`, `observed`), host-owned sources, optional topic/combat mode, and
superseded document IDs. `origin: ai` identifies the writer, not the certainty
or provenance of a fact.

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
  Extraction errors and cancellation propagate; an empty patch means the model
  found no new facts, not that a failed call succeeded.
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
route. Core declarations outrank incidental progress within the context budget.
`read_project_wiki` retrieves selected document bodies in 12,000-character pages.
Generic CRUD and blanket wiki lint remain absent.

Successful shared proposal application records observed tool/map state directly,
not a model's guess about what happened. Failed/discarded proposals never become
progress. A later wiki save failure is reported separately from successful game
application. Ordinary proposals and region applies retain newer live documents.

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

Domain tests: `projectWikiDomain.test.ts`, `projectWikiPatch.test.ts`,
`projectWikiClient.test.ts`, and `projectWikiContext.test.ts`.
Session/application tests: `projectWikiSession.test.ts` and
`projectWikiApplication.test.ts`. Manual edit races:
`projectWikiManualEdit.test.ts`.

Live evidence uses a separate Supabase QA project and the user's existing OAuth
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
