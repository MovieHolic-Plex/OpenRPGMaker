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
The new lifecycle must prove real authoring outcomes rather than restoring the
old unused ontology scaffolding.

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
