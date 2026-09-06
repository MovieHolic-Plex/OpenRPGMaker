# Task 4 image-family adapter

Branch: `agent/aiq-image-silver`. Base: `9647fac2`.

**Canonical-checkpoint correction:** the initial 28-test proof below used an
in-memory checkpoint fixture and did not establish repository roundtrip safety.
The subsequent fix and actual-repository RED/GREEN are recorded at the end;
those results supersede the initial retry proof.
Scope: image executor, two image-specific helpers, focused test and this evidence.
No shared runtime, provider adapter/client, other family, canvas helper, UI, package,
Vite configuration, editor store, or parent-worktree file was changed.

## Delivered API

```ts
executeImageJob(
  input: AiJobInput & { family: "image" },
  host: AiJobHost,
): Promise<AiJobResult>
```

Exported from `src/ai/jobs/executors/imageJob.ts`; it also re-exports
`ImageJobPayload`, `ImageJobDestination`, and `ImageJobProposal` from
`src/ai/jobs/imagePayload.ts`. That file exports runtime payload/destination
parsers using the existing guards and command-shape validator.

`input.payload` is the JSON encoding of:

```ts
interface ImageJobPayload {
  prompt: string;               // complete prompt, including the field's kind prefix
  model?: string;               // default remains IMAGE_GENERATION_MODEL
  resourceId: string;           // allocate BEFORE admission; never allocated on retry
  name: string;
  kind: "picture" | "faceset" | "title" | "backdrop" | "monster";
  postprocess: "none" | "flatten";
}
```

`resourceId` must be nonempty, unpadded, not a prototype property name, absent
from submitted uploaded assets/resource profiles, and contain `-bust` for a
faceset (the existing insertion helper's single-bust convention). Admission/UI
migration must capture this ID rather than retaining a DOM callback. Name/prompt
are trimmed. `input.mode` must be `auto` or `review`; event drafts require `review`.
`input.project`, `projectSnapshot`, and `target` remain the captured submission
identity and baseline; the executor never reads a current editor project.

`input.target` is an `ImageJobDestination`, not an opaque queue key:

- `{kind:"database", table, recordId, field}` with exactly the combinations below.
- `{kind:"system", field}` with one of the three title fields below.
- `{kind:"title-layer", index}` for an existing layer, index 0..3.
- `{kind:"event-draft", draftId, draftRevision, owner, commandPath, binding, command}`.
  `draftRevision` is the SHA-256 of the captured reviewed draft. `command` is the
  captured full expected command, validated with `validateCommandArray` and the
  real M2 catalog. `commandPath` is the existing numeric command/branch path.
  `owner` is one of:
  `{kind:"map-event",mapId,eventId,pageId}`,
  `{kind:"common-event",commonEventId}`, or `{kind:"troop",troopId,pageId}`.
  `binding` is `show-picture | change-face | actor-faceset | parallax`.

The draft revision is a conflict token, not a new live-project lookup. An unsaved
review draft may legitimately have no counterpart in the saved project. The later
review adapter MUST resolve the same owner/draft ID and verify its full revision
and expected command before linking. A path, array index, or queue key alone is
not a stable identity. No draft allocation/persistence or UI migration was added.

### Target contracts traced to actual call sites

| Target | Kind | Existing field/call site and preserved effect |
| --- | --- | --- |
| database actors / faceResourceId | faceset | `actorRecordView.ts:543`, updates captured actor's face |
| database enemies / monsterResourceId | monster | `databaseEnemyRecordView.ts:705`, updates captured enemy |
| database troops / previewBackgroundResourceId | backdrop | `databaseTroopRecordView.ts:446`, preview backdrop |
| database terrains / battleBackgroundResourceId | backdrop | `databaseUtilityRecordViews.ts:255`, capture terrain ID instead of its UI index |
| database monsterSpecies / graphic.monsterResourceId | monster | `databaseMonsterSpeciesView.ts:520`, preserves graphic hue and siblings |
| system / titleResourceId | title | `databaseSystemView.ts:280`, writes BOTH system.titleResourceId and titleScreen.backgroundResourceId |
| system / titleScreen.backgroundResourceId | title | `databaseSystemView.ts:1507`, does NOT change system.titleResourceId |
| system / titleScreen.titleGraphic.resourceId | title | `databaseSystemView.ts:1477`, preserves/defaults mode and layout coordinates as patchTitleGraphic does |
| title-layer / index | title | `databaseSystemView.ts:1906`, only that layer.resourceId changes; later apply must treat captured layer array atomically |
| event-draft / show-picture | picture | `commandBodyPage3Native.ts:1293` -> `showPictureAiField`, changes showPicture.resourceId |
| event-draft / change-face | faceset | `commandBodyCore.ts:668`, changes changeFace.resourceId |
| event-draft / actor-faceset | faceset | `commandBodyM2Actor.ts:858`, Change Actor Faceset fields.value; preserves actor target |
| event-draft / parallax | backdrop | `commandBodyM2Page3.ts:1590`, Change Parallax Back fields.target/value/resourceId and operation="set" |

The generic `databaseResourcePickerDialog.ts:215,308` enables AI only for
`title`, `backdrop`, and `monster`. Its `image`, `icon`, other graphic/audio kinds
are not silently accepted as new AI targets. The direct actor/event fields cover
facesets; the show-picture wrapper covers pictures. No field panel is imported.

### Result contract

```ts
result.payload = {
  completion: "complete",
  persistence: "not-applicable",
  checkpoint: "private-draft",
  provider: string, model: string,
  proposal: {                         // ImageJobProposal
    version: 1,
    kind: "create-image-and-link",
    resource: {
      id: string, name: string, kind: GeneratedPictureKind,
      artifact: BlobRef, width: number, height: number,
    },
    destination: ImageJobDestination,
    command: JsonObject | null,       // updated command only for event-draft
  },
}
```

`generatedSnapshot` is an immutable private project snapshot for database/system/
layer destinations, made with the existing `insertGeneratedPictureAsset` helper
and validated by the existing full project deserializer. It is **null** for an
event draft: that result contains only the typed resource+reviewed-command
proposal. The adapter must later create the resource AND link its field in one
transaction, verify project identity/baseline or draft revision, reject ID
collisions, and preserve unrelated live edits. This generation function has no
apply/save authority and does not claim applied/saved.

`artifacts` retains the raw paid response JSON, decoded/generated image binary,
and generated project snapshot when present. The resource points to the actual
immutable binary, not a data URL masquerading as an artifact. Binary bytes are
fully decoded in Chromium before image success, including on checkpoint resume.
Only raster PNG/JPEG/WebP/GIF data URLs with matching declared MIME and valid
base64 are accepted; remote URLs/SVG/undecodable content fail.

## Paid boundary, flattening and recovery

- The existing `generateAiImage` request/response helper runs with an injected
  transport. Its Antigravity provider selection, default model, prompt trimming,
  returned model/provider and wire response semantics are preserved. There is no
  real fetch or hidden paid retry. No `imageGenerationClient.ts` edit was needed.
- The only operation is `host.providerOperation({key:"image/provider/generate",
  request:{kind:"image",provider:"google-antigravity",body:{prompt,model}}})`.
  The key/request remain identical across attempts; the host's existing ledger
  owns replay/uncertain-outcome/duplicate-spend decisions.
- Before postprocessing, the response is saved with `putJson` and checkpointed.
  `postprocess:"none"` still decodes actual pixels. `flatten` uses the existing
  `flattenGeneratedArtwork`/`keyOutBackground`, producing the actual fitted PNG
  (maximum dimension 512); unavailable canvas is rejected before the foreground
  helper's no-context fallback can report false success.
- Stage keys: `image/start`, `image/provider-response`, `image/artwork`,
  `image/completed`. State version 1 contains `binding` (normalized payload,
  target, project and baseSnapshot), `responseRef`, `image` (artifact, dimensions,
  model/provider), `completed`, and `generatedSnapshot`. Every referenced blob is
  retained in checkpoint artifacts. Job, binding, structure, refs, dimensions,
  stage prerequisites, actual image bytes and final project are checked on replay.
- Postprocess failure retains paid output; snapshot persistence failure retains
  processed artwork. Retry does not request another image or allocate another ID.
  Completed retry returns the exact previous generated snapshot ref. A lost
  provider acknowledgement reuses the host ledger with the same operation key.
- Invalid provider images remain inspectable in the response artifact and fail
  honestly on retry; they are never reported as successful image artifacts.

## Verification and command record

All commands ran in this branch/worktree. No .env files were inspected or printed,
no paid providers were called, and no local/remote user project was written.

1. BEFORE production changes: `npm test -- test/aiImageJob.test.ts`, exit **1**.
   `red.log`: existing `generateAiImage` accepted base64("not an image") as PNG;
   the rejection assertion received a successful image object instead. This is
   a behavioral RED, not a missing-module/syntax failure. The final regression
   exercises that same invalid response through the new actual job adapter,
   preserving the unchanged foreground client's public contract.
2. Initial `npm run typecheck:app`, exit **2**, caught a missing required title
   graphic mode; fixed by matching the actual helper's default `mode:"text"`.
3. Initial `npm test -- test/aiImageJob.test.ts test/imageGenerationClient.test.ts`,
   exit **1**: Vitest rewrote a serialized Playwright dynamic import; fixed by
   loading the real module from browser source, not SSR-transformed test code.
   The next invocation exited **1** on Chromium static module fetch. The adopted
   runtime handoff describes this Linux Chromium transport issue; the fixture now
   transports same-origin static GETs via Playwright's Node request API with
   redirects/retries disabled, exactly as the isolated runtime does. Foreign
   requests and non-GETs fail. The next invocation exited **0**, 20 tests.
4. `npm run typecheck:app`, exit **0**, `typecheck-app.log`.
5. `./node_modules/.bin/tsc --noEmit -p .omo/evidence/ai-job-queue/task-4-image/tsconfig.image-test.json`:
   initial exit **2** found recursive Playwright serialization type expansion and
   an optional fixture asset ID. Explicit JSON wire serialization and a fixture
   existence check fixed both; final exit **0** (`typecheck-test.log`, empty).
6. Expanded focused invocation initially exited **1**, 3 fixture failures/25
   passing: a layer referred to unregistered `old-layer`. Added a real fixture
   resource; did NOT weaken the project validator or skip any tests.
7. FINAL `npm test -- test/aiImageJob.test.ts test/imageGenerationClient.test.ts test/generatedPictureAsset.test.ts`,
   exit **0**, **28 tests across 3 files**, `focused-final.log`. The new file
   includes 14 image tests plus the existing runtime graph test imported with its
   graph utility. It runs the actual module/helper in Chromium through a bound
   host with an explicitly deferred provider event, not a fake executor.
8. LSP diagnostics on all four owned source/test files returned **no diagnostics**;
   the final test fixture was checked again after its correction. TypeScript app
   and focused-test checks provide compiler verification in addition to LSP.
9. `ss -ltnp 'sport = :19843'`, exit **0**, no listener after awaited browser/server
   teardown. No owned process/port is intentionally left running.

The tests verify retained image IDs/targets, genuine 1024x512 opaque PNG output,
real flattening to 512x256 with transparent corner and preserved colored center,
invalid bytes rejection, local-stage recovery without another paid operation,
ledger replay after interruption, completed-ref stability, all four reviewed
event bindings, independent title-field semantics, input/project/checkpoint
validation, no live project mutation, and the complete transitive runtime import
graph (no store/panels/editor boot/PWA). There are no sleeps/polling barriers.

## Supervisor integration and boundaries

Only shared integration needed: import and dispatch `executeImageJob` for
`family === "image"` in supervisor-owned `workerEntry.ts`. Existing host, provider
adapter, contracts and checkpoint transport already suffice. Nothing shared was
edited here. UI admission migration must capture the documented IDs/destinations;
later application/report adapters consume the immutable proposal/artifact.

Full six-family browser acceptance, full app/player build and whole gates remain
supervisor-owned and were deliberately not duplicated. This handoff claims only
focused real-browser image execution and the compiler/tests above.

Initial implementation commit: `8135afdd40dbdaa263063bea216cedb1774da6e1`.
The canonical-checkpoint correction below is a NEW fix commit, not an amendment.
Its exact SHA is returned to the supervisor and can also be read with
`git log -1 --format=%H -- src/ai/jobs/executors/imageJob.ts`.

## Canonical-checkpoint correction

The supervisor identified a genuine integration blocker: repository.putJson uses
canonicalJson (recursively sorted object keys), and the scheduler reads checkpoint
state back from those bytes. Comparing insertion-order JSON.stringify strings
therefore rejected unchanged persisted bindings. The old in-memory fixture
preserved object insertion order and concealed this failure.

The executor now compares recursive canonical content. Every key/value, primitive
type and array position remains significant; only object property insertion order
is irrelevant. Existing version, job, target, project, ref, artifact and stage
checks remain unchanged. There is no checkpoint migration or public API change.
No shared runtime or other family files were edited.

The image test host now uses the ACTUAL openAiJobsRepository for every JSON/binary
write and read. It retains only a checkpoint ref, loads the envelope from its
canonical disk bytes on every attempt, and can close/reopen the repository before
retry. It no longer stores a live checkpoint object. Temporary repositories are
closed and removed after each test. The paid provider remains the controlled host
boundary; the executor, image client, canvas, decoder and storage are real.

Evidence commands, all in this worktree:

| Command | Exit | Evidence |
| --- | --- | --- |
| `npm test -- test/aiImageJob.test.ts -t 'retries real flattening and completed output'` BEFORE production fix | 1 | `canonical-red.log`: actual repository reopen -> Image checkpoint binding mismatch after one saved paid response and local canvas failure |
| `npm run typecheck:app` AFTER production fix | 0 | `canonical-typecheck-app.log` |
| `./node_modules/.bin/tsc --noEmit -p .omo/evidence/ai-job-queue/task-4-image/tsconfig.image-test.json` AFTER final test changes | 0 | `canonical-typecheck-test.log` (empty success output) |
| `npm test -- test/aiImageJob.test.ts test/imageGenerationClient.test.ts test/generatedPictureAsset.test.ts` final | 0 | `canonical-green.log`: 29 tests / 3 files, no skips |

One intermediate full run exited 1: the new seven-invocation negative regression
exceeded its old 30-second deadline under real disk/browser load. Its pending
invocation then exposed the fixture's mutable shared-host flaw, causing the next
test's unexpected paid-call assertion. This was not suppressed: browser host
calls now carry a unique invocation token, and each invocation resolves only its
own host. The integration suite has a bounded 90-second per-test deadline (not a
sleep/poll); the final negative case finished in about 30.4 seconds. The final
full invocation above passed in one run. The intermediate output is retained
locally as `canonical-harness-failure.log`.

The regression verifies canonical ordering at both binding and nested target
levels, then closes/reopens the repository after failed postprocessing, retries
real flattening, closes/reopens again, and retries completed output. Exactly ONE
provider call remains; allocated-face-bust, artifact refs, proposal and generated
snapshot ref are unchanged. A separate persisted-checkpoint test rejects changed
command-path order, draft revision, command content, project ID and resource ID,
then confirms the original binding still replays with one paid call.

Final LSP checks: no diagnostics on imageJob.ts and aiImageJob.test.ts. The existing
transitive runtime graph assertions still pass, including no store/panel/PWA boot.
Final `ss -ltnp 'sport = :19843'` exited 0 with no listener; `/tmp` contained no
remaining ai-image-canonical-* repository directories. No paid call, remote
project write, shared-runtime edit, build or whole-gates run was performed.
Selected logs have trailing whitespace normalized for git diff checks.
