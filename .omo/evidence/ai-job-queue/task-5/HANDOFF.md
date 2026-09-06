# Task 5 - guarded delayed application

Task: st_01a076ff. Base: 4643a71e84e2620ade9ffe8737edcc54cfd76af2.
Implemented in the adopted silver-harbor worktree. No commit, push, PR, paid
provider call, user remote project write, full build or full gates command.

## Delivered APIs

```ts
// src/editor/aiJobs/applyJobResult.ts
applyJobResult(jobId: string, options?: ApplyJobOptions): Promise<JobApplicationOutcome>
retryJobSave(jobId: string, options?: Pick<ApplyJobOptions, "client" | "storage">): Promise<JobApplicationOutcome>
getVolatileApplicationRecovery(jobId: string): ApplicationRecord | undefined
applicationLockName(identity: { backend: string; projectId: string }): string

// options.review is explicit approval, never inferred from opening a report.
interface JobReview {
  approved: true;
  excludedRowIds?: readonly string[];
  proposalIds?: readonly string[];
}
```

`ApplyJobOptions` contains `review`, optional `ApplicationClient`, and optional
`IDBFactory`. Production defaults use same-origin HTTP, browser IndexedDB and
Web Locks. Tests inject only real storage factories and the HTTP wire boundary;
they do not replace application/store/history. Outcome fields are `application`,
`save`, optional `reason`, `receiptId`, and `evidencePending`. Save-only HTTP or
storage failures can reject; the caller must display that failure and may retry.
A pending save request is replayed exactly; an acknowledged failed/unknown save
gets a new persisted saveAttemptId on the next explicit retry. A confirmed save
never triggers another flush.

`ApplicationClient` exports `detail`, `post`, `bytes`, and `json`; reads verify
blob byte length and raw SHA-256. Its default fetch wrapper preserves the browser
receiver (the first browser run found and corrected an illegal-invocation bug).

`src/ai/jobs/resultPatch.ts` exports `mergeResultProject`, `canonicalProject`,
`canonicalJson`, `equalJson`, `appliedSnapshotHash`, `ResultConflict`, and
`APPLIED_HASH_SCHEME`. The merge supports keyed maps/tilesets/characters,
ID-keyed DB records, common events/switches/variables, uploaded resources and
kind+assetId resource profiles. Record/map bodies, command arrays, tile payloads
and unsupported roots stay atomic. Creation collisions are conflicts even when
current content happens to equal generated content. Live drafts are restored
exactly to untouched maps; changes to a map containing an open draft conflict.
House protection and commitChangeset reference/integrity gates run before undo.
Assistant/region/tileset broad read dependencies conservatively require the
canonical baseline; DB/image global reference/world dependencies are checked.
No generation/tool execution is replayed during application.

## Full loaded identity and storage

ProjectStore adds:

- `getLoadedProjectIdentity(): { backend, projectId }`
- `getProjectEpoch(): number`
- `getLoadedConnection()` (editor-internal captured config, not receipt metadata)
- `hasDurableLocalIdentity()`
- `hasReadOnlyProjectSnapshot()`
- `subscribeApplicationAvailability(listener)`
- `assertEffectiveConnection(identity?)`

The existing conversation-facing `getProjectIdentity()` stays compatible.
Identity code in `src/project/loadedProjectIdentity.ts` has no AI/editor runtime
imports. Credentials are not identity. Explicit and ordinary connection captures
use the effective browser URL resolver, including HTTPS HTTP-to-/supabase folding.
Loads capture config before I/O, recheck effective identity, and only adopt it
with successfully loaded data. Full replacements increment the application epoch,
even if their UI projectSwitch annotation is false. Late save responses do not
adopt another project's persistence baseline or flush a replacement through the
old save's catch-up loop.

`loadLocalProjectEnvelope` and `persistLocalProjectEnvelope` serialize cache-slot
migration/write with Web Locks. The cache stores `{version:1, localProjectId,
project}`; legacy project-only entries are atomically upgraded. Reload/rename
retain UUID; identical new/import/reset content receives another UUID. Fresh/blank
boots intentionally skip restoration and persistence. Non-cache local sessions
remain ephemeral. `hasDurableLocalIdentity()` is the admission UI's honesty seam.

The existing Vite plugin derives `GET /api/ai-jobs/session.configuredBackend`
from the actual resolved dev/preview `/supabase` proxy target, normalized without
credentials/query/hash plus schema `rpg_zzu`. Format is
`supabase-proxy:<sha256>`. The same proxy URL with another upstream differs;
key rotation does not. This is a URL/path/schema namespace, not a database-instance
UUID behind an unchanged URL. No vite.config.ts target duplication was added.

Application storage is `oprn-ai-job-applications-v1`, object store `records`, key
`job:<jobId>`. `openApplicationRecords()` has no memory fallback or eviction.
Transaction completion, not request success, acknowledges durability. Records
retain claim/receipt IDs, binding, exact before/proposed/applied recovery images,
canonical preimage hash, draft before/after, serialized application artifact,
phase, exact evidence body and save-attempt pending/acknowledged state.

A prepared record without durable applied receipt is outcome-unknown. Equality
with current content never authorizes replay. A server claim without the local
record also never authorizes reapplication. Receipt-write failure after mutation
retains a volatile recovery image but returns unknown and blocks replay. Applied
record recovery retries artifact/evidence only. Immutable unknown evidence is
final, not a temporary state that can later be overwritten with applied evidence.
Pre-claim conflicts return without consuming a server claim, so corrected live
state can be reviewed again; immutable generation artifacts remain retained.

## Draft ownership and review integration

`src/editor/aiJobs/draftOwners.ts` exports `registerDraftOwner`,
`captureDraftBinding`, `resolveDraftOwner`, and `findDraftOwner`, with
`LiveDraftOwner` and `DraftBinding` types. A binding includes draft UUID, SHA-256
revision of exact commands and explicit map-event/common-event/troop owner IDs.
Image destinations additionally carry commandPath and expected command.

Map-event draft UUID is minted on creation/open, persists in the namespaced
vault, and ends on commit/discard. Vault namespaces use loaded backend+project ID,
not selected config or legacy ambiguous local/ID-only slots. Delayed vault writes
retain captured owner key AND captured entries. Vault presence is not live-editor
registration. Map-event content registers the actual connected section and draft
UUID. Same-owner rerenders are resolved to the new live registration; closed,
changed, discarded and replaced owners reject.

`openEventCommandEditDialog` returns its live owner or null; its optional request
`owner` captures actual IDs. The owner survives form rerender, reads closure-local
staged commands and unregisters on all normal close paths. Existing map/common/
troop command-list and new-command call sites pass their owner IDs. Command body
contexts expose `jobDraft` for task8 capture. A dialog root image path is `[0]`;
nested paths are relative to the owner's single-root command list, not a later
selection. EventCommandsJobPayload now accepts optional `draftBinding`; old jobs
without one are retained but cannot authorize a delayed draft application.

Reviewed event lists use existing `commandToolbarHistory.replaceAll` once,
including diff exclusions. Its narrow optional annotation is forwarded through
replaceEventPageCommands so registered map-event job application is attributed to
AI. The dialog still requires its existing confirmation to commit staged commands.
Draft-only applications are not remotely saved by retryJobSave.

## All result families

- Assistant, region, database: immutable generated project snapshots, with keyed
  merge or conservative broad-read guard as described above.
- Event commands: null snapshot is a real proposalRef; base/final lists are diffed
  using the existing helper and reviewed exclusions, then the bound live owner is
  changed through its one-undo replacement.
- Image canonical destination: generated snapshot bundles resource creation and
  destination field. Image command draft: binary artifact is materialized with its
  recorded ID and linked to the bound reviewed command in the same synchronous
  application boundary. Subscribers never observe the resource without its link.
- Tileset cluster-edit/range-classify/unclassified-analysis: full snapshot path.
  Knowledge-analysis/question-followup: selected native review proposals are
  compiled on a detached tileset using the existing review implementation.
  Proposal-draft: mapping answer uses the existing mapping helper, with group IDs
  derived from the immutable proposal hash rather than Date.now; collisions and
  human-group replacement reject. Structure-kit-metadata: applies the recorded
  metadata and condition IDs to its exact kit after explicit review.

All tileset/event/draft paths require review. Only input.mode=auto on the existing
assistant/database/canonical-image snapshot surfaces is automatically eligible.
There is no fallback that silently treats a null snapshot as unsupported/no output.

## Exact applied artifact contract for task 6

The narrow synchronous `applyProposedProject(..., {onApplied})` hook captures the
actual store snapshot before subscribers and commit-log awaits. Its returned
`applied` is also that captured snapshot, not later store.getCurrent(). Read-only
play-test snapshots defer application and are never used for preimages/undo.

Server prepare accepts optional `receiptId` in addition to the existing fields.
New clients persist both IDs before POST. Existing receipt compatibility remains.

```
POST /api/ai-jobs/:jobId/application/artifact
{
  claimId, receiptId, project, resultSha256,
  snapshotSha256,
  serialized // exact UTF-8 JSON text, not inline receipt history
}
-> { artifact: { sha256, byteLength, mediaType: "application/json" } }
```

The server checks the exact prepared binding and raw UTF-8 SHA-256, stores opaque
bytes in the existing immutable blob repository, rejects a different artifact for
the same receipt, and exposes it through the explicit job manifest. Metadata:

```
job.applicationEvidence.artifact = { receiptId, resultSha256, ref: BlobRef }
job.applicationEvidence.receipt.evidence = {
  appliedSnapshotSha256,
  appliedArtifact: BlobRef,
  beforeSnapshotSha256,
  hashScheme,
  scope: "project" | "draft"
}
```

For scope=project, `hashScheme=project-canonical-json-no-event-drafts-v1`:
projectWithoutEventDrafts -> existing serialize/deserialize normalization -> sorted
object keys, original array order -> UTF-8 -> SHA-256. Uploaded bytes are that exact
canonical JSON; raw artifact SHA equals appliedSnapshotSha256. Before hash uses the
same canonical scheme. Live recovery snapshots separately retain drafts.

For scope=draft, `hashScheme=command-draft-canonical-json-v1`; serialized content is
`{project, owner, draftId, commands, resources}` with canonical keys. Commands are
exact applied draft commands; resources are the captured uploaded-resource map.
This is NOT a canonical saved project or proof that the user confirmed the dialog.

Task6 must require matching receiptId/resultSha256/ref/hashScheme before rendering
applied-after. Do not redraw from current editor state and do not substitute the
generated snapshot. An absent/mismatched artifact means unavailable applied-after.
Save evidence stays separate. retryJobSave flushes using captured loaded config,
then calls detached normal loadProjectFromSupabase(config), including map-row
overlays. Only an exact normalized applied hash confirms saved. Concurrent changes
or failed/stale publication remain failed/unknown; no overwrite forces equality.

## Verification and exact command record

All logs are in this directory. The final main focused invocation passed in one
run; no failing test was deleted, skipped in that run, or weakened to pass.

| Command | Exit / evidence |
| --- | --- |
| `npm test -- test/aiJobApplication.test.ts` before implementation | 1; red.log, real cache reload retained content but changed UUID |
| `node --test --test-name-pattern='application snapshot upload' test/aiJobsHttp.test.mjs` before extension | 1; artifact-red.log, prepare rejected receipt-bound artifact contract |
| `npm test -- test/aiJobApplication.test.ts -t 'preserves the actual live draft'` before preservation correction | 1; draft-red.log, candidate omitted actual open event draft |
| `npm test -- --maxWorkers=1 test/aiJobApplication.test.ts test/aiJobIdentity.test.ts test/aiApplyActivityLabels.test.ts test/applyChangesetToStore.test.ts test/eventPages.test.ts test/eventPageActivityLabels.test.ts test/eventDraftVault.test.ts test/eventDraftVaultPersistDebounce.test.ts test/databaseCommonEventCommandListAdapter.test.ts test/tilesetAiNativeReviewApply.test.ts test/tilesetAiMappingRules.test.ts` | 0; focused-final.log, 90 tests / 11 files |
| `npm test -- --maxWorkers=1 test/aiJobApplication.test.ts -t 'full replacement'` | 0; replacement-epoch-green.log, added final epoch regression |
| `npm test -- --maxWorkers=1 test/aiJobApplication.test.ts -t 'creates image resource\|previous process\|full replacement'` | 0; final-delta-green.log, 3 targeted tests after test-typing corrections; other 21 excluded by explicit filter, not disabled |
| `node --test test/aiJobsHttp.test.mjs` | 0; http-final.log, 10 tests |
| `npm run typecheck:app` | 0; typecheck-app-final.log, final production source |
| `node test/aiJobApplication.browser.mjs` | 0; browser-final.log, browser-evidence.json, browser-reviewed-command.png, browser-trace.zip |
| `node --check scripts/lib/aiJobs/http.mjs && node --check scripts/lib/aiJobs/service.mjs && node --check scripts/lib/aiJobs/vitePlugin.mjs && node --check test/aiJobApplication.browser.mjs` | 0 |

Final application suite has 24 tests (23 at the 90-test full focused pass, then
one added full-replacement epoch regression). It uses actual ProjectStore,
application/history, fake-indexeddb transactions including success-then-abort,
Node's real Web Locks, fsynced job repository and controlled real HTTP. Coverage:
identity reload/new/reset/fresh/blank and legacy migration; actual Vite proxy target
and HTTPS reconnect/key rotation/upstream change; unrelated edits/open drafts;
overlap/deletion/collision; two-client single mutation/undo; lost prepare/evidence/
save acknowledgements; prepared crash uncertainty; failed applied-receipt write;
closed/changed/replaced/rerendered drafts; read-only play deferral; all result
shapes; failed map publication -> new save attempt -> saved; evidence-only retry;
exact synchronous capture while a subscriber makes a later human edit.

Real Chromium proof uses two pages in one browser context: actual shared local
cache and IndexedDB, browser Web Locks, exported application API, reload with the
same UUID, history counts [1,0], one shared receipt, and an existing command dialog.
The staged command changes after explicit job review, canonical commands stay
unchanged until the existing confirm button is clicked, and that confirm has one
command undo. Both immutable applied artifacts have manifest/ref/hash/receipt
binding checks. The screenshot was captured; DOM values and history behavior were
asserted. No visual redesign or full-editor layout QA is claimed.

LSP checked every changed production/test file (directory checks plus per-file
checks), including server declarations. The eventEditor directory request timed
out; all changed files in it were subsequently checked individually and were clean.
A fresh test diagnostic exposed missing MJS declarations/JSON typing and an unused
import; these were fixed with a typed test helper declaration and real JSON
conversion, then diagnostics were clean. The last fresh store.ts requests timed
out waiting for diagnostics after its final one-line epoch guard; earlier store
checks were clean and the final application compiler passed. This timeout is not
reported as a fresh clean LSP result. See lsp.md.

## Exact older-store baseline comparison

The initial nine-file related run had 8 failures (related-run1.log), including
cold-import timeouts under concurrent load and a timing-sensitive activity-log
fetch assertion. A read-only Vite loader overlay of ALL changed existing source
files from base HEAD was used; no product source was reverted or tests changed.

```
npm test -- --config .omo/evidence/ai-job-queue/task-5/baseline.config.ts --maxWorkers=1 test/storePersistence.test.ts test/storeEventDraftPreserve.test.ts
npm test -- --maxWorkers=1 test/storePersistence.test.ts test/storeEventDraftPreserve.test.ts
```

Both exit 1 with the SAME six failing tests, 7 passing tests, and both draft-store
tests passing (baseline-store.log/current-store-comparison.log):

- pre-load zero-fetch assertion sees the existing edit-activity POST;
- three local showcase tests omit boot's showcase-factory injection and receive
  undefined mocked network responses;
- the showcase-status test likewise lacks factory injection and makes an existing
  GET using its fake test key, receiving Invalid authentication credentials;
- missing-row test counts all fetches: expected 1, got 4, including activity logs.

Both serial runs pass clean-flush and stale-save paint-preservation tests. No
unrelated legacy cleanup was performed. The inherited test's failed authenticated
GET is not a paid call or a user project write; no real remote write was made.

## Task 6 / 7 / 8 handoff and cleanup

- Task6 consumes immutable generated proposals and the applied artifact contract
  above. Keep generated/applied/draft-confirmed/saved states distinct.
- Task7 wires queue/inbox/report review buttons to applyJobResult and retryJobSave,
  displays returned conflicts/unknown/pending evidence, and subscribes to
  application availability after play-test close. Do not treat an application
  receipt as remote save or silently switch projects. No new queue/report UI here.
- Task8 captures full loaded identity, snapshot, actual live draft UUID/revision/
  owner/path/expected command, explicit mode and review choices before admission.
  Use command body jobDraft and findDraftOwner/captureDraftBinding; never selection
  alone or vault presence. Event payloads missing draftBinding remain reviewable
  artifacts but cannot be applied. Existing paid submission ownership is unchanged
  here and remains the migration task's responsibility.
- Volatile unknown recovery images are inspection/recovery inputs only; neither
  this API nor later UI may auto-restore them over newer edits.

The browser and identity QA owned port 19841 only and closed all contexts,
services/listeners and temporary repositories/caches in finally. Port 9841 was
not touched. cleanup.txt records the final listener/temp-directory check and
unchanged HEAD. No owned browser/service is intentionally left running. Language
server infrastructure is tool-managed. Evidence is ignored by the repository's
.omo rule; the supervisor must explicitly include desired evidence when staging.
Full gates/build, submission migration, report rendering/UI and commits remain
supervisor/downstream-owned, not claimed here.
