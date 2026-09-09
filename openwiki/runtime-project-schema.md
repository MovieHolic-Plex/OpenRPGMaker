# Runtime Project Schema & Persistence

## Truthful migrated-load state (2026-09-07)

`store.normalizeCurrentProject` compares raw project structure before and after
normalization (`structuralJson`: object-key order only; arrays and every field stay
significant). Helper `changed` flags remain diagnostic hints, not evidence that a
revision needs saving: transient pack rewrites can return to the same structure.
This comparison does not deserialize, change canonical hashing, or exclude content.

Real normalization changes set dirty and advance mutation generation before they can
be persisted. Initial load schedules migration autosave only after `loaded=true`;
reload/reconnect capture the remote baseline before normalization and defer saving
through the ordinary autosave/flush path. None clears a migrated revision as clean.
Failure keeps it dirty; edits during migration persistence trigger the existing
local-first catch-up save. Coalescing is scoped to content lineage, so a replacement
migration can save independently of an older held save. Historical responses cannot
clear a replacement flight, dirty state, receipt or autosave status.

The faceset-repair await captures both its project object and content lineage.
If a switch or immutable edit detaches that target, completion cannot mark the
current project dirty or schedule its save. Likewise, synchronous `saving` status
subscribers may replace the project: the old flush rechecks lineage before starting
persistence and returns `disabled` without issuing a write or replacing the new
lineage's flight. This result disables that stale request, not remote persistence.
Same-lineage callback edits and repairs whose target remains current retain their
normal save behavior. Deterministic coverage: `storeLifecycleReentrancy.test.ts`.

Interior group composition and strict cabinet-kit migration are described in
[the room harness page](editor-interior-room-harness.md). Placed map layers without
per-cell provenance are preserved, including deliberate lower-layer props. No schema
bump is needed. Existing accepted-save receipts/proof and `serializeForComparison`
remain unchanged; graphical/both title graphics and nondefault authored content are
still identity-significant. Tests: `interiorLoadConsistency.test.ts`,
`storePersistenceLineage.test.ts`, and the existing persistence-proof tests.
## Explicit publication identity and Save6 (2026-09-06)

Project4 optionally carries `meta.publication`: `gameId`, `versionLabel`, a full
SHA-256 `runtimeTarget`, `saveCompatibilityId`, and directional
`acceptedSaveCompatibilityIds`. `publication.ts` validates without repairing or
generating identity. Only explicit prepare/fork/upgrade operations create IDs.
Rename, ordinary persistence and `.oprn` package round-trips preserve them.
Upgrade preserves game identity and starts a new save lineage; fork changes both.

Identity-bearing snapshots use Save6. Standalone/editor keys remain
`oprn:game:<gameId>:lineage:<saveCompatibilityId>:save-slot:v6:<slot|auto>`;
title, filename and legacy host namespace changes do not change that identity.
Community keys instead begin `oprn:community:<encoded-listing-slug>:game:...`.
`exportEntry` derives `saveIsolationScope` from the actual `/play/<slug>/...` URL,
even for opened/embedded projects; neither project metadata nor a boot
`saveNamespace` override can choose it. `renderPlayer` installs publication and
scope together via `setSavePublication(publication, isolationScope?)`.
Save6 `identity.isolationScope` records the host scope separately from game and
lineage. Manual/autosave readers, writers, blockers and apply reject foreign
scope snapshots. Community boot also skips the global legacy-prefix migration
(`exportStorageBoot.ts`); it must not enumerate, migrate or delete other saves.
Legacy projects still write Save5 and retain the existing Save4/5 read/fallback
rules. Legacy readers do not accept Save6. Save6 without identity is invalid.
`applySaveSnapshot` rejects wrong-game/unaccepted-lineage snapshots before state
restoration. `importSaveCopy` accepts one explicitly named storage key, requires
explicit legacy adoption for Save4/5, validates a separate session, and writes
only an empty destination slot. It never scans storage or changes source bytes.
Tests: `publication.test.ts`, `publicationSaves.test.ts`, `lifeSaveVersion.test.ts`.

The runtime load panel offers copy-and-load controls only for explicitly accepted
predecessor lineage keys **inside the current listing scope**, including their
autosave, into the first empty manual slot. `importSaveCopy` checks the source key
against local current/accepted lineage keys before reading it; uploader-accepted
lineage metadata is compatibility, never cross-listing access authority.
Legacy adoption remains an explicit standalone
`importSaveCopy({sourceKey, adoptLegacy: true, ...})` operation on a known legacy
key, not title/slug discovery or a bypass for community keys.

Cross-listing transfer is a separate player-selected file flow: in the source
load panel export a manual/autosave JSON file, then in the destination select
that file using the copy-and-load control. `importSelectedSaveFileCopy` receives
only those selected bytes (never a discovered storage key), requires compatible
Save6 game/lineage metadata, validates a separate session, rebinds scope, and
writes an empty manual slot. It cannot overwrite a destination or change the
source. Cancel/failure changes no live session. Native file controls and the
existing keyboard cursor menu own selection; no accounts or listing ownership
platform is involved. The UI caps selected files at 8 MiB.

Tests: `communitySaveBoot.test.ts`, `publicationSaves.test.ts`,
`publicationSaveImportPanel.test.ts`, and the real Chrome/PostgreSQL seam
`node --test test/communitySaveIsolation.test.mjs`. Runtime archive/export
operations and browser QA commands are in `editor-workflows-misc.md` under
Versioned publication.

## P1 accepted-save receipts and read-only proof (2026-09-06)

`ProjectFlushResult` keeps its existing variants; `saved` optionally includes a
`ProjectPersistenceReceipt`. A clean flush after load may return `saved` without
a receipt, which isn't proof. After an accepted save, a clean current flush
returns the same receipt without another write.

The frozen, in-memory receipt contains `revisionId`, `projectId`,
`mutationGeneration`, `contentIdentity` and optional `sha256`. Identity is SHA-256
of the existing `serializeForComparison(projectWithoutEventDrafts(...))`
normalization, derived from `result.project ?? submittedProject`, not live
`getCurrent()` after an await. Accepted merged content can differ from the live
editor. The optional wire/server hash alone doesn't establish content equality.
If accepted content can't normalize, saving logs the error and returns no receipt.

`store.verifyPersistedRevision(receipt, { signal?, validate? })` accepts the exact
store-issued object. A private WeakMap holds its captured Supabase configuration
and load/adoption lineage; copied or reconstructed tokens fail. `loadProjectForPersistenceProof` reuses the
normalized/hybrid loader with observed `project_id` and cancellation, without
commit-tip hydration. It performs a remote read, not `reloadFromRemote()`: no
live-project replacement, dirty reset, draft change, URL change, or store event.
Manual reload retains its separate contract. The optional trusted synchronous
`validate(project)` callback runs on the canonical read only after target and
normalized content identity match. Returning a diagnostic produces `failed`;
throwing or cancellation cannot produce success. Assistant functional acceptance
uses this hook to re-run immutable gameplay expectations, not to accept worker
scripts or pass flags. The callback does not persist or replace project data.

Results are `verified` with `isCurrent`, `mismatch` with `reason: target | content`,
`disabled`, `cancelled`, or `failed` with a message. Missing rows and read errors
fail. Each verifier call makes a fresh attempt, so a failed receipt can retry.
`isPersistenceReceiptCurrent(receipt)` checks loaded/enabled state, the latest
receipt reference, mutation generation, load/adoption lineage and captured target
configuration. Adoption, successful remote reload and reconnect advance lineage
and clear the current receipt. Saves capture lineage before submission; a late
receipt from an earlier lineage remains available for historical verification,
but can't become current again or overwrite a replacement lineage's receipt.
This separate counter leaves local-edit generation and local-first catch-up saves
unchanged. A matching historical read may return `verified` with `isCurrent:false`;
consumers mustn't promote newer live state from that result and must recheck
currentness when consuming it after an await. Neither save responses nor proof
reads replace newer local edits.

Sources: [store types and methods](../src/project/store.ts) and
[proof loader](../src/project/supabaseProjectSync.ts). The
[session contract](editor-ai-panel.md) describes completion/retry and optional
apply-commit correlation. [P1 evidence](../output/evidence/ai-harness/p1/README.md)
records real editor and isolated Supabase proof. This adds no schema migration,
durable receipt recovery, cross-device guarantee, or P2-P5 implementation.

## Opening and game-over cinematic settings (2026-09-06)

`SystemRecords.opening?: CinematicSequence` and `gameOver?: GameOverSettings` are additive, opt-in project-v4 authoring records. No schema bump, server migration, or default/demo content is needed. `src/project/cinematicSettings.ts` owns the mutable authored types and pure normalization; all four types are re-exported through `@/project/types`:

- `CinematicMotion = "none" | "fade" | "pan" | "zoom"`.
- `CinematicScene` is a discriminated union with common `id`, `narration`, optional `narrationAudioResourceId`, and `durationMs`. A `text` scene has no media or motion field; an `image` scene requires `resourceId` and `motion`; a `video` scene requires `resourceId` and has no motion field.
- `CinematicSequence = { enabled: boolean; skippable: boolean; scenes: CinematicScene[] }`.
- `GameOverSettings` has optional `sequence`, `title`, `message`, `retryLabel`, `titleLabel`, and `backgroundResourceId` fields.

`CINEMATIC_SCENE_LIMIT = 100` and `CINEMATIC_DURATION_MAX_MS = 120000` are exported from the focused module. `normalizeCinematicSequence(sequence: CinematicSequence): CinematicSequence` and `normalizeGameOverSettings(settings: GameOverSettings): GameOverSettings` accept typed records; the `normalizeSystemRecords` whitelist calls them only for present settings. Missing settings stay missing, empty authored records/sequences and disabled content survive, and normalization preserves ordering and exact text (including blank strings and whitespace). IDs are trimmed; optional empty IDs are omitted on typed direct normalization. Normalization does not mutate input and is idempotent; it is not a replacement for wire validation.

`io/shapeDatabaseFields.validateSystem` checks these records before typed cloning/normalization. It rejects non-objects, unknown or variant-inappropriate fields, missing required fields, incorrect field types, blank IDs, duplicate scene IDs (after trimming, scoped to each sequence), more than 100 scenes, and non-finite/non-integer durations outside `0..120000`. Image motion must be one of the four values above. `io/resourceReferenceValidation.validateSystemResources` validates image/video/narration/background IDs through the existing known-resource authority even when a sequence is disabled. This is existence validation, not media decoding or MIME compatibility validation.

The duration contract for playback consumers is: zero means keyboard advance for image/text; videos advance on completion, with a positive duration acting as an authored maximum. Text is stored literally; renderers must use safe native text rendering. This model increment does not implement playback, new-game routing, game-over menus, or editor authoring UI.

`webExportAssets` already traverses nested project strings outside uploaded payloads, so no cinematic asset collector is added. Disabled sequences retain uploaded media in `prepareWebExport`, including narration referenced nowhere else. Uploaded video filenames now use `.mp4`, `.webm`, or `.ogv` for the media types accepted by the existing movie importer (rather than the former `.png` fallback); image/GIF/WebP and audio handling is unchanged. `test/cinematicSettings.test.ts` covers legacy absence, disabled/empty retention, deterministic serialize/deserialize, strict rejection, resource validation, and actual export-entry bytes for image/video/audio/background, with unused uploads pruned.

## 적 전투 이미지 크기 (2026-09-06)

`EnemyRecord.battleScalePercent?: number`는 선택적인 전투 표시 백분율이다. `normalizeEnemyRecord`는 유한 숫자를 반올림해 정수 10~300에 제한하고, 누락·비숫자·비유한 값은 100으로 처리한다. 100은 키를 생략해 기존 프로젝트를 희소하게 유지한다. 기존 editor mutation allowlist와 `upsert_enemy` 정수 스키마에 포함되며 `serialize`/`deserialize`가 비기본값을 보존한다. 기존 로드 정규화를 재사용하는 additive 필드라 스키마 버전 변경이나 SQL migration은 없다. `test/enemyBattleScale.test.ts`가 실제 편집→저장→로드→재저장과 손상된 입력/기본값 복귀를 검증한다. 원격 DB 쓰기 없이 엔진·편집기 코드만 변경한 계약이다.

## Project monster metadata overrides (foundation, 2026-09-07)

`Project.monsterMetadata?: Record<string, Partial<MonsterMetadata>>` stores editor-only
`name`, `tags`, and `description` overrides by raw resource ID. The readonly metadata
value type is exported through `@/project/types`; mutations belong to
`@/project/monsterMetadata`. `setMonsterMetadataOverride(overrides, resourceId, patch)`
returns a new map, trims new input, deduplicates tags, and preserves omitted fields.
Names must be nonblank and <=120 UTF-16 units; descriptions <=4000; tags <=32 entries
of <=64 units. Empty tags/descriptions explicitly clear defaults. Loading validates
stored values without trimming, deduplicating, registering orphan IDs, or backfilling.
`resetMonsterMetadataOverride(overrides, resourceId)` removes the whole resource override
and returns `undefined` when the map becomes empty. Callers delete the optional project
field on that result. Raw IDs such as `terrainTemplates` and `__proto__` retain identity.

`applyMonsterMetadataDelta(base, local, latest)` merges per resource AND per field.
Only locally changed fields replace latest values; local changes win same-field races.
A local reset removes fields present in base, preserving concurrently added remote fields.
Map-patch saves apply this delta; accepted-save reconciliation applies it again using
submitted/current/saved snapshots. The existing content-lineage guard rejects stale
responses after project replacement. Reconciliation preserves live maps and does not
create authored mutation generations or extra history entries. Project snapshots already
support undo/redo; UI Apply/reset must record one snapshot and use labeled `store.update`.

`@/assets/monsterResourceCatalog` owns `listMonsterResources(project)` and
`getMonsterResource(project, rawId)` (missing IDs return `undefined`). Entries expose
`resourceId`, effective metadata, `origin` (`bundled`/`uploaded`/`profile`),
`reviewStatus` (`reviewed`/`unreviewed`), and per-field `sources`
(`project`/`catalog`/`fallback`). Promoted monster artwork includes troop previews;
builtin enemies, EasyRPG, Scarloxy, explicit profiles and uploads are stably deduplicated.
Explicit upload kind overrides prefixes, profiles, and bundled identity. Custom uploads
never inherit catalog review status. Metadata-only IDs do not become resources.
`MONSTER_CATALOG` is an intentionally empty typed scaffold in this independent foundation
increment; the lead must supply original-artwork-reviewed values before final review.
Fallback descriptions are empty and always unreviewed; inferred search tags are not vision evidence.

Monster search (`monsterProject` option) and monster picker enumeration delegate to that
same authority. Non-monster image/picture picking and URL resolution remain unchanged.
`monsterMetadataChanged` counts changed resources for diff/history/commit accounting;
legacy summaries may omit it. Editor JSON, backup and package round trips retain overrides;
playable exports strip them and exclude their text from uploaded-asset usage accounting.
No schema version bump, SQL table, migration, or live-project rewrite is needed.

## Project audio description overrides

`Project.audioDescriptions` is an optional v4 field, defined in
`src/project/types/base.ts` and `src/project/types/project.ts`:

```ts
audioDescriptions?: {
  music?: Record<string, string>;
  sound?: Record<string, string>;
};
```

Keys are raw resource IDs, not `bgm:`/`se:` search IDs, filenames or URLs. A missing key
inherits the catalog default; an own key with `""` explicitly clears it; another string
is project-authored text. Reset removes only the override, pruning empty containers.
An explicit value equal to today's default stays an override.

`src/project/audioDescriptions.ts` is the catalog/DOM/store/player-independent authority.
New writes trim surrounding whitespace and enforce 4,000 UTF-16 code units after trimming,
preserving internal line breaks. `src/project/io/shape.ts` validates stored strings without
rewriting them, rejects malformed partitions/values and overlong strings, and accepts field
absence. Unknown IDs survive loading as metadata but don't become selectable resources.
`src/project/io/serialize.ts` preserves raw dictionary keys even when they resemble a
legacy field name.

Defaults remain in immutable catalogs; overrides aren't duplicated in upload `meta`,
profiles or browser-global localStorage. Existing projects need no default backfill,
schema-version bump, new SQL table or live-project rewrite.

### Concurrent persistence

`applyAudioDescriptionDelta(base, local, latest)` starts from the latest stored descriptions
and applies only kind/raw-ID states that changed locally relative to base. Different-key
edits survive together; a changed local key wins a same-key conflict. Absence is reset,
not clear. Unchanged local keys retain remote edits and remote resets.

`src/project/supabaseProjectSync.ts` uses this delta for map-patch saves. A project-scoped
description mutation doesn't force a full save: `src/project/store.ts` chooses the save API
from the persisted baseline. After success, the store reconciles descriptions with
`base=submitted`, `local=current`, `latest=saved`. This preserves typing during the request,
adopts remote-only changes and avoids resending stale metadata on the next map save.
It replaces only the necessary root/description state, keeps live maps and mutation-generation
handling, and emits synchronization without counting a new authored edit.

Reconciliation uses the same content-lineage counter as accepted-save receipts.
Full project replacement/reset advances lineage, invalidates current proof and clears
the old persisted baseline, so its next save is authoritative
rather than a merge with the previous project. A late completion from an earlier epoch
cannot reinstall that baseline or copy remote descriptions into the replacement.
Accepted historical saves still issue verifiable, non-current receipts and commit records.
The ownership check runs after receipt hashing and again after synchronization callbacks;
neither boundary may reset a replacement's dirty state.
Ordinary edits and undo within one project keep the per-key reconciliation contract.

### Editor preservation and playable export

Editor JSON, backups and `src/project/package.ts` packages preserve absent, empty, authored
and orphan states. `src/project/webExport.ts` removes the entire field from the playable
export clone before loading/validation, without changing the source project.
`src/project/webExportAssets.ts` excludes the description subtree from usage traversal:
neither a description key nor text equal to an upload ID keeps an unused upload alive.
Real playback references still retain their assets and IDs.

`test/audioDescriptions.test.ts`, `test/audioDescriptionPersistence.test.ts`,
`test/audioDescriptionConcurrentPersistence.test.ts` and
`test/audioDescriptionExport.test.ts` exercise these boundaries. Transport-mocked tests
using real save/load/merge functions aren't evidence of a live Supabase write.

## Character/face authoring metadata (2026-09-06)

`ResourceProfile` optionally carries standalone-face `graphicAttributes`/`graphicNote`, or charset `characterSlots: [{characterIndex,graphicAttributes,status,faceResourceId,quality,note}]`. Seven independent string axes are kind/age/gender/skin/hair/clothing/role. Sprite names remain in `Project.charsetLabels`; face names use the existing profile name. No parallel asset registry, project version bump, or SQL migration is introduced.

`characterGraphics.validateCharacterGraphicsProject` runs in `validateProjectV4`, rejecting malformed attributes, duplicate canonical sprite slots and unknown mapped face IDs. Non-mapped states require an explicit null face ID; pending/no-face are distinct. Existing projects keep these optional fields absent; display-only literal-label suggestions do not write metadata on load. Texture-key/resource-ID profile aliases resolve to the annotated profile rather than hiding edits. Whole-project serialize/deserialize, packages and Supabase current_json retain the fields; the existing missing-only bundled-profile supplementation preserves annotated profiles.

Metadata JSON import validates all v1/v2 rows before a single mutation, retains pending labels and exact supplied face IDs, and never invokes automatic face matching or rewrites authored event commands. V2 exports both independent attribute sets. Focused contracts: `test/characterGraphics.test.ts`, `test/characterGraphicsLoad.test.ts`, `test/databaseCharacterGraphics.test.ts`.
## Character appearance sets v1 (2026-09-06)

`database.characterAppearances?` is an additive v4 catalog of
`{id,name,description,charset?:{resourceId,characterIndex},face?:{resourceId},bust?:{resourceId}}`.
It is independent of social `project.characters` / `characterId`. All graphic
slots are optional; legacy projects keep the catalog absent. Actors and active
event-page graphics reference a set with optional `appearanceId`, retaining their
direct graphic fields for unlink/fallback. Both `actorModel` normalization and
`databaseActions`' actor patch whitelist must preserve that link.

`characterAppearanceValidation.ts` validates shape, unique IDs, slot bounds,
resource kinds and dangling links. Face resources are standalone facesets, busts
are pictures, charsets use the supported 288x256 sheet with eight 24x32-frame
characters. Known mismatched uploaded metadata is rejected; actual decoded
dimensions are checked before runtime frame registration. Built-in bust/full
aliases and promoted portrait metadata match the resource picker. No migration,
SQL table, or save-slot field is added.

`characterAppearances.ts` owns shared projections and usage scanning. Session
actor overrides still win; linked slots override legacy actor/page resources,
and missing slots keep their legacy fallback. The player now uses the selected
charset index rather than always cell zero. Uploaded charsets are loaded and
registered by the existing asset loader and recognized by NPC animation.

An event starts with its active page's set face as default. Explicit `changeFace`,
including clear, takes precedence. The existing command supports optional
`appearanceId` and `presentation:"face"|"bust"`; a missing bust uses that set's
face, then no portrait. Explicit presentation takes precedence over old filename
inference. Names are never used to infer speaker identity.

Contracts: `characterAppearanceSets`, `characterAppearanceRuntime`, and
`characterAppearanceScenario` tests; the dedicated
`scripts/qa/runtime/character-appearance-sets.scenario.mjs` exercises player.html.
`node scripts/qa/appearance-runtime-proof.mjs` uses that same harness with an
isolated Firefox context where Chromium has host-level ERR_NETWORK_CHANGED
asset failures. The scenario removes its temporary fixture on cleanup/exit.

## New-project save/reload verification (2026-09-05)

Persistence regression harness correction (2026-09-08): `test/io.test.ts` compares the complete first-roundtrip wire against the seed with only its redundant text-only `titleGraphic` removed, then requires byte-stable subsequent roundtrips. It does not normalize both expected and actual through the same loader. Storage-key guards parse executable string/template values, not explanatory comments. The no-local-project-DB guard permits `typeof indexedDB` capability inspection for AI-log durability but still rejects IndexedDB access, SQLite and the retired project fallback implementations.

`storePersistence` and `unsavedChangesGuard` wire the real `createDevShowcaseProjectForLocation` through `setDevProjectFactory`, as `bootApp` does; importing `store` alone does not activate URL showcases. Tests block live fetches and distinguish canonical REST writes from edit-activity telemetry. Fire-and-forget commit audit mirroring is isolated from the next case's transport. Cold module transformation belongs in setup, not the save behavior deadline. `persistenceTestSignals.ts` provides real bounded deadlines around pre-registered autosave and request signals; only the actual debounce/backoff contract advances fake time. Race tests hold each response until the next local edit and verify the still-dirty intermediate state before catch-up completes. The mode overlap test subscribes to editor teardown and uses a synchronous player mock, avoiding Vitest's async-mock call-stack bypass on concurrent imports. The editor autosave test uses a DOM implementation with real storage and tears down the rendered editor. Evidence and the non-fabricated historical-item mapping are in `output/evidence/event-command-completion/legacy-persistence/ledger.json`.

`store.loadNewRemoteProjectTransactionally` compares draft-free projects with `serializeForComparison`, not raw wire bytes. The comparison runs both sides through the project loader's normalization and recursively sorts object keys; arrays and authored non-default values remain significant. New blank/preset seeds contain the default `system.titleScreen.titleGraphic = { mode: "text", x: 32, y: 62 }`, which normalization omits, and the farm preset gains `system.timeSystem.forceSleep = false` on load. PostgreSQL JSONB also changes object-key order. These representation differences must not reject a successful save/reload. Wire serialization and SHA-256 persistence remain unchanged; actual mismatches still reject before adopting the new project or changing drafts, config, or URL. `test/transactionalNewRemoteProject.test.ts` exercises all five presets plus blank creation through real save/load functions with a JSONB-like transport, and rejects changed titles, map tiles, and array order.

## Task15 nonvisual economy command contract (2026-09-08)

`craftRecipe` and `applyItemUpgrade` accept optional `resultVariableId: string` in Project4 commands.
Shape validation rejects non-string values; ProjectIO references, event draft validation and variable deletion guards require a declared ID, including nested commerce/battle-result branches.
Omission stays omitted through serialization and creates no result variable. The existing interpreter calls the existing atomic transaction and uses `setVariable` to record success `1` or failure `0` only when requested (missing project also means `0`). Both outcomes advance to the next command; authors must branch explicitly before paying success-only rewards.
The scene runner already uses that interpreter. Nonvisual `previewSimulation.ts` now executes these two commands through the same interpreter on its local preview state, preserving quantity/charges/collection and recipe-unlock state rather than predicting success. It does not mutate the authored project.

`handleShopTransaction` now resolves its sale baseline through `resolveShopSellUnitPrice`: authored buy100/sell90 pays90, table100 is capped at99, explicit0 pays0, omitted table defaults to50. Shipping deliberately continues using `resolveSellPrice` (table100 pays100); undefined shipping allow-list means all database items and `[]` means none. To turn off A from undefined/all, the authoring checkbox consumer must materialize all current item IDs then remove A, retaining B/C. No shipping schema or runtime change is needed for that UI fix.
Bundle reward definitions are validated before mutation, while inventory capacity is checked once by `changeItemsAtomically` against donation followed by reward. Donation1/reward1 of the same item succeeds at `ITEM_QUANTITY_MAX=9_999_999`; reward2 still fails without inventory, gold or completion changes. Existing duplicate-reward rejection and once-only completion remain.
Regression: `test/lifeEconomyConsumerParity.test.ts`. Forms, sale display/offer/haggle UI wiring and native visual QA are separate Task15 work, not verified by this nonvisual increment.

## Independent game Save5 boundary (2026-09-06)

Project `SCHEMA_VERSION` remains 4 (`Project.version`); runtime `SaveSnapshot.schemaVersion` now uses independent `SAVE_SCHEMA_VERSION=5` in `src/player/saveSlots.ts`, even without optional life state. The current reader accepts Save4 and Save5, upgrades Save4 in memory, and explicitly rejects Save3 and future versions. Historical save-v3 statements below do not describe current reader support. `test/fixtures/life-full/saveSlots.phase1.ts` is the byte-identical complete phase1 module from `87de73785d1c309bbbe975636414f70bbc73a4b9`; its real old parser rejects new writer output at the schema comparison. Its unchanged validation imports remain shared; this is a frozen reader, not a whole old application binary.

Manual keys are `oprn:save-slot:v5:1..3` and autosave is `oprn:save-slot:v5:auto`. An export namespace substitutes for `oprn` unchanged. Each reader consults the matching old key only when the new key is absent (`null`), never when it is empty, malformed, or unsupported. Reading/migration performs no writes. Writing touches only the new key; no backup copy or deletion is needed because the original bytes stay at the old key. Failed quota writes preserve the old bytes, previous new slot, and live session. Equipment parsing and the missing-custom-slot load blocker are unchanged. Tests: `test/lifeSaveVersion.test.ts`, `autosave.test.ts`, `customEquipmentSlots.test.ts`.

## Life ownership in Save5 (2026-09-06)

Farm plots optionally retain `regrowDaysRemaining` as a non-negative safe integer. The existing lossless plot validation rejects malformed countdowns without trimming plots or rewriting saved bytes. Zero is retained as a ready regrowing crop; omission preserves legacy initial-growth behavior, never an inferred prior harvest. The writer, Storage reader and apply path retain the complete plot record. Save5 keys and Project4 are unchanged; see `test/cropRegrowthContract.test.ts` for remaining-seven roundtrip and malformed-value refusal.

When saved maker jobs depend on a present clock, writer/parser/apply reject malformed dates rather than dropping the clock while keeping its jobs. Frozen jobs also reject absolute-minute overflow in their original basis. Legacy omitted clocks retain the initial-clock fallback; project-free parsing does not impose the default calendar on legacy jobs. Save5/Project4 versions and key namespaces are unchanged.

Optional `session.lifeRecovery` now crosses writer, manual/auto Storage, parser and apply unchanged after bounded validation. Shared pure life reconciliation runs before known-content filters; incompatible sources are moved to claims or preserved as unpayable original JSON, never silently deleted. Completion/reward tombstones and region/recipe IDs retain dormant rights. Claim quantities/counts, monotonic sequence, 64 KiB raw UTF-8 and 8 MiB total limits are reject-without-trimming boundaries. Duplicate JSON object keys are rejected by both disk readers. Existing Save4 migration and v5 key isolation remain unchanged. Source removal plus claim creation and explicit receipt plus inventory transfer are separate atomic draft transactions. See `runtime-sessions.md` for restoration order, cancellation clocks and task boundaries; regression `test/lifeRecoveryPersistence.test.ts` executes the actual codec.

**Explicit instance-linked animal homes (task11, 2026-09-06):** Project4 adds optional `FarmBuildingTypeRecord.animalHousing: { allowedSpeciesIds: string[] }` and level `animalCapacity`. Every level of an enabled housing type must explicitly author an integer capacity 0..9999; generic `capacity` is unchanged and never supplies animal slots. `FarmAnimalStartInstance` and its runtime state add optional `housingPlacementId`, referencing an actual placement instance, mutually exclusive with legacy `buildingId`. JSON shape validation and direct normalization reject malformed/dual references; project reference validation checks enabled placement, allowed species and each independent capacity. Invalid new references are not silently repaired away. Existing independent animal homes remain supported.

`src/project/animalHousing.ts` is the single derived-home authority: `resolveAnimalHome` reads placement ID, map, coordinates and current level, without matching names, types or nearby coordinates. `reconcileLinkedAnimalHousing` keeps capacity survivors in Unicode code-point ascending instanceId order (not locale or UTF-16 order), unassigns the rest and never relocates them. Missing placement/type, housing disable and species exclusion also unassign, preserving animals and all progress. Runtime assignment is `assignFarmAnimalToHousingPlacement` in `farmAnimals.ts`; explicit reassignment to either home kind removes the other reference and never resets daily care. Unassigned animals can collect already-earned products but cannot feed/pet or advance production through a missing home.

Building construction and upgrades record actual aggregate `paymentReceipt: { gold, items }`; moving preserves it and the instance ID. Receipts are cumulative history: gold is a nonnegative safe integer and each unique nonempty item ID has a positive safe-integer total, not a single wallet/stack or 64-row claim. New costs still independently obey the 64-input-row and wallet/stack transaction limits. Previously validated history is aggregated with the preflighted new payment without passing the concatenation through per-cost limits; unsafe cumulative addition refuses before any spending. Thus 64 historical rows plus a repeated item, 32+33 distinct items, all16 levels of64 items, and repeated full-stack/wallet payments remain intact through Save5. Content recovery splits distinct rows and large same-item totals into the existing bounded claims (64 unique items, ITEM_QUANTITY_MAX per row, 4096 claims, 64 KiB raw and 8 MiB total); insufficient recovery capacity refuses the whole conversion with the source and prior slot unchanged. `test/spatialPaymentReceipts.test.ts` covers these boundaries, exactly-once collection and malformed/unsafe raw preservation. Voluntary demolition is nonrefundable: it atomically removes the placement and clears only its animal housing references, without creating or changing any recovery claim, even when all4096 claim slots are occupied. Animals retain identity, friendship, products and all care/day receipts. Only content-incompatible buildings move proved paid item quantities to existing explicit-collection claims, with original placement/payment JSON (including gold evidence) retained in `unresolved`. This does not add a gold claim/payout schema or infer earlier costs for legacy placements. Save5 validates and preserves active receipts. Writer and apply reconcile persistent plots/placeables/chests, then spatial recovery, then linked homes/animals, then other life transactions and restored-clock processing, before returning the successful draft. A removed linked reference never falls back to an authored legacy start home, including a second save/resume while unassigned. Map deletion clears affected authored linked references only.

`test/linkedAnimalHousing.test.ts` covers independent instances, 2-to-5 upgrade, movement, care/collection, stable shrink selection, demolition/type changes, payment evidence, conflict/cost/species refusals, Project4/Save5 roundtrips and corrupt raw preservation. Task11's native `player.html` probe calls public transaction modules on the real PlayScene session and earns production through native Z sleep; assignment/authoring UI and live player/NPC placement safety remain tasks13/12, not claims of this schema change.

## Placement safety core (task12, 2026-09-06)

`canOccupySpatialFootprint` is persistent-only: terrain, complete oriented building/decor footprints, placeables, chests and actual farm plot records. Farmable areas alone do not reserve space. Save restoration and forage use this same authority. Restoration never reads live actor context; transient player/NPC overlap cannot quarantine an otherwise compatible building or rug. Persistent incompatibility still follows the existing proved-payment recovery contract. Farming removes only its own target plot from the temporary occupancy view, preserving water/harvest and all other occupancy checks.

`spatialOccupancy.ts` exposes the nonpersisted `SpatialLiveActor` (`mapId`, foot-anchor `x/y`, full `footprint`, optional movement `passRows`), `SpatialLiveContext` (`player`, `npcs`) and `SpatialLiveContextReader`. `canPlaceSpatialFootprint(project, session, position, footprint, readLive?, exclude?, blocksMovement=true)` adds full-body collision and refuses closing the last currently available one-step player movement neighbor. Movement uses existing passage/terrain authorities, not global pathfinding; pre-existing confinement or body overhang does not globally prohibit unrelated construction. Nonblocking rugs and plots reserve placement space, not movement space.

All six construction/move/rotate/upgrade public transactions accept the reader as their final optional argument, invoke live preflight before costs, and do not retain it. New records whitelist persistent placement fields rather than spreading arbitrary input. No Project4/Save5 schema change. `adjacentSpatialPosition(player, direction, footprint, orientation)` returns a top-left outside the full body, accounting for rotated dimensions: up `top-H`, down `bottom+1`, left `left-W`, right `right+1`; the other coordinate aligns with the body's left/top.

The live ledger's `spatialEntries` now passes a call-scoped `SpatialLiveContextReader` to all six building/decor placement, movement, upgrade and rotation transactions. `src/player/lifePlacementScene.ts` resolves the player's full body at the scene's logical foot tile and projects NPCs through `runtimeEventViewsForMap` with current session/event positions each time the reader runs, rather than retaining a preview snapshot. Page-less, off-map and erased actors are excluded. The discrete reader includes only same-priority, overlap-forbidden NPCs as walking walls. Separately, `placementBlockedByRenderedBodies` checks the target against visible NPC full bodies, including above/below/pass-through actors and interpolated moving bodies; those actors do not become walking walls. An in-flight player action refuses until the step completes. Fractional rendered anchors are examined only by this UI overlap gate, never forwarded into discrete core geometry. Unrelated NPC movement does not prohibit a nonoverlapping target. Place/move targets use `adjacentSpatialPosition` with the full player body and scene facing; upgrades/rotations retain stored positions. Missing or unusable scene context refuses the live action instead of omitting the reader. Removes are unchanged. Live context is not serialized into sessions, placements or saves. Reader omission still retains legacy/static behavior for nonvisual callers; it is not live-safety verification. Producer-r3 handler receipts report 91 passing tests, including three rendered-body replay regressions. Its native `player.html` receipt uses a newly saved/reloaded 3x3/passRows1 project, with target `(7,9)` from foot `(8,8)`, building placement/upgrade and movement to different coordinates, plot/edge and moving-NPC-origin overlap refusals, rug placement, and menu Save/Load with raw owners. Those r3 decoration move/rotation attempts returned `blocked`, and its last-exit setup allowed another building (`lastExitBlocked:false`); those failures remain historical, not passes. On identical source, producer-r4 uses two separately saved/reloaded, core-preflighted fixtures: a non-square table rotates down to left at `(7,9)`, then moves to `(5,6)` with orientation and recovery item retained in real menu Save slots. In the independent last-exit session, foot `(1,2)` stays stationary while construction at `(0,3)` refuses with gold500, potion8, hoe1 and both starting owners unchanged. The r4 Save receipts prove changed owner properties, not Load restoration from divergent state. Producer-r5 supplies a separate native nonblocking-rug passage and restoration proof on another remotely reloaded 3x3/passRows1 input: DOWN from foot `(8,8)` to `(8,9)` crosses rug cells `(7,9)` and `(8,9)` with passage x7..9/y9. After Save slot1, the live foot moves to `(8,10)` and the rug to `(7,11)`; menu Load restores foot `(8,9)` and rug `(7,9)`. A newly written slot2 matches slot1 for both owner kinds, rug orientation/recovery item, gold and inventory. The old r3 walk label did not intersect the rug with its passage and is not relabeled as traversal. Composite producer evidence does not replace post-commit independent native/visual acceptance. Nonvisual core contract: `test/lifePlacementSafety.test.ts`; scene/handler contracts: `test/lifePlacementSceneUi.test.ts` and `test/lifePlacementRenderedBodyReplay.test.ts`.

Task52 corrects the existing `normalizeSystemRecords` whitelist to retain authored optional `system.playerFootprint` and `system.playerPassRows` independently through public Project serialize/deserialize. Existing footprint and passage normalizers remain the authority; absent keys stay absent and malformed wire geometry is still rejected. Authored 3x3/passRows1 survives roundtrips and resolves as a full 3x3 body with a one-row movement passage, not a 1x1 construction body. Project remains version4 and Save4/5 compatibility is unchanged; this does not invent session-override persistence. Regression: `test/playerBodyProjectPersistence.test.ts`.

## Project-authored equipment slots (2026-09-05)

`ProjectDatabaseRecords.equipmentSlots?: EquipmentSlotRecord[]` is an additive v4 catalog of `{ id, label }`. Omission keeps the five built-ins. `src/project/equipmentSlots.ts` merges built-ins with authored label overrides and custom slots; built-in IDs cannot be removed. IDs are stable ASCII identifiers, not labels. `EquipmentRecord.slot`, `ActorInitialEquipment`, and `changeEquipment.slot` reference these IDs. Actor normalization preserves every slot key; shape/reference validation rejects duplicate/unsafe catalog IDs, empty labels, and dangling equipment/actor/event slot references. No migration or schema bump is needed for catalog-free projects.

Runtime projection and atomic equip transitions enumerate the catalog; custom slots have ordinary one-item occupancy and contribute their authored stats/effects. Only `weapon` and `shield` have dual-wield/two-handed semantics. Save parsing validates every equipment entry (including custom values); missing equipment maps remain legacy-compatible. `snapshotLoadBlocker` refuses a save whose slot catalog is no longer present rather than silently treating that slot as accessory. The project editor prevents removal while equipment records, actor initial equipment, or nested map/common/troop commands (including drafts) reference a slot. External saves are not rewritten on catalog edits; missing-slot saves are explicitly blocked at load.

Contract: `test/customEquipmentSlots.test.ts` covers create/rename/use, initial equipment serialization and reload, menu/event equip, stats/effects, save storage roundtrip, removal protection, invalid slots, and legacy fallback.

## 전투 명령 CSS (2026-09-05)

선택 필드 `system.battleCommandCss?: string`은 프로젝트 공통 메뉴 스타일이다. 기존 프로젝트는 필드 없이 기존 스킨을 유지한다. `validateSystem`은 문자열 타입을 검사하고 `normalizeSystemRecords`는 비어 있지 않은 원문을 보존한다. 버전 증가나 데이터 마이그레이션은 필요 없다. 저장/로드·패키지·출하 플레이어가 같은 프로젝트 필드를 사용한다. 지원 문법 밖의 가져온 문자열은 보존하되 렌더하지 않아 편집기에서 고칠 수 있다. `test/battleCommandCss.test.ts`가 직렬화 왕복·구형 프로젝트·잘못된 타입·CSS 격리를 검증한다.

## 기본 카탈로그 삭제 보존 (2026-09-05)

로드의 `ensureDefaultDatabaseIconResources`는 기존 기본 행의 아이콘 연결만 보정한다. 누락 아이템·장비를 새로 주입하거나 그 종속 스킬·상태를 추가하지 않는다. 신규 생성은 기존 기본 카탈로그를 그대로 사용한다. `test/itemEquipmentAuthoringTrust.test.ts`는 삭제한 기본 행이 serialize→deserialize→부팅 정규화 후에도 없는 것을 확인한다. 종류 필드가 없던 v3 스킬 아이템은 `normalizeItemRecord`가 skillId를 보고 special로 복원한다. 명시된 종류는 추론으로 덮어쓰지 않으며 실제 v3 전투 fixture와 직렬화 왕복으로 검증한다. ItemRecord 종류 전환은 저장 필드를 삭제하지 않고 `itemUsage.activeItemEffects`로 실행만 제한하므로 스키마 버전 변경이 없다.

## 전투 페이지 중복 ID 복구와 슬롯 참조 (2026-09-05)

`normalizeTroopRecord`는 옛 길이 기반 생성기가 남긴 중복 페이지 ID를 결정적으로 복구한다. 첫 ID는 보존하고 이후 중복은 사용되지 않은 `_2`, `_3` 등의 접미사로 바꾼다. 입력 전체의 기존 ID도 예약하므로 뒤에 나오는 정상 ID를 빼앗지 않는다. 여러 번 정규화·저장·로드해도 결과가 같다. 옛 모호한 ID를 참조하던 명령은 첫 페이지를 계속 가리킨다. 새 스키마 필드나 버전 증가는 없다.

프로젝트 참조 검증은 각 적 그룹의 편성 수만큼 `enemy-1`…`enemy-N`을 범위화하여 HP 조건에 허용한다. 몬스터 레코드 ID 조건도 기존대로 허용한다. 슬롯 참조를 전역 enemy ID 집합에 넣으면 다른 그룹의 잘못된 슬롯을 통과시키므로 `ReferenceContext.enemySlotIds`로 분리한다.

`test/monsterBattleAuthoringContract.test.ts`는 중복 ID 복구의 충돌 회피·멱등성, serialize→deserialize 반복, 두 번째 중복 몬스터 슬롯의 실제 조건 실행까지 검증한다.


Authored project schema, defaults, validation, migration, references, and persistence boundaries.

생활 스키마 회귀 fixture (2026-09-06): `test/fixtures/life-full/legacyProject.ts`는 새 프로젝트의 중복 `titleScreen.titleGraphic`만 명시적으로 제외한다. 생성기는 `{mode:"text",x:32,y:62}`를 제공하지만 로더는 리소스 없는 text-only 그림을 생략한다. 이 의도된 첫 정상화를 생활 optional 필드 부재/전체 byte-stability 검사와 혼합하지 않는다. fixture 안에서 deserialize를 호출하지 않으며, `p0ProjectSchema`는 새 프로젝트에서 그 한 필드만 없어지는지와 리소스 있는 text/graphic/both 보존을 별도로 검사한다. P0/P1/P2는 원문 동일성과 두 번째 왕복 안정성을 모두 유지한다. 공간 탭의 0개 배지는 공용 UI 계약대로 `data-count`를 생략하며, `p2SpatialEditorAuthoring`는 추가/삭제 확인/undo/redo와 4종 합계를 검증한다. `test/fixtures/life-full/coverage.json`의 51개 기능 및 F01..F13은 후속 완주용 **미실행 명세**이며 PASS 원장이 아니다.

## 통행 컴포넌트 색인의 계약 (2026-08-30, PR #286)

`src/project/tilePassabilityComponents.ts` 는 "여기서 저기로 갈 수 있나" 를 미리 계산한 색인이다. 세 가지가 계약이다.

- **1x1 게이트.** 색인 사용 여부를 `pass` 인자의 **유무**로 가르면 안 된다 — `playSceneAutonomous.ts` 가 추격에서 항상 `pass` 를 객체로 넘기므로 모든 추격에서 색인이 죽는다. 판정은 크기로 한다: `passIsUnitRect`(`player/chaseAi.ts:150`)가 1x1 인지 보고, 1x1 이면 색인을 쓴다. 통행 규칙을 복사하지 말고 `passageBounds` 에 물어야 한다.
- **타일셋 통행이 지문에 섞인다.** 지문을 타일 배열만으로 해시하면 안 된다 — `setPassageMark` 는 같은 `TilesetDef` 를 **제자리에서** 바꾸므로 벽을 통행 가능으로 바꿔도 색인이 낡은 "도달 불가" 를 계속 답한다. `mixTilesetPassage`(`:245`)가 4방향 통행 비트와 우선도를 지문에 접는다.
- **`INDEX_SCAN_RATIO = 8`**(`:102`). 훑은 칸이 맵 전체의 1/8 미만이면 색인을 만들지 않는다(`:115`) — 짧은 탐색에 색인 구축 비용을 물리지 않는다. `scannedCells` 를 생략하면 항상 만든다.

## 세계 법칙의 명시적 부재 (2026-09-05)

`worldCanon.laws[kind].present`의 기존 optional boolean 형태를 유지하되 `false`를 압축에서 제거하지 않는다. 키 부재는 미정, false는 없음, true는 있음이다. 기존 빈 프로젝트에 법칙을 만들어 넣지 않으며 버전 마이그레이션은 필요 없다. 과거 저장 시 제거된 false 값은 복구할 근거가 없어 미정으로 남는다. 설명만 있는 법칙은 설명을 보존하며 존재 여부는 미정으로 표시한다. normalize → serialize → deserialize 왕복과 AI의 「신: 없음」 전달을 `test/worldAuthoringRegression.test.ts`에서 검증한다. 이 데이터는 저작/AI 설정이며 게임의 죽음·통화·마법 런타임 규칙을 자동으로 바꾸지 않는다.

## Showcase media save-copy durability (issue #693, 2026-09-08)

`mediaImportPersistence.ts` stages showcase audio/video in a detached candidate.
The shared confirmation explicitly authorizes a NEW Supabase project before any
remote write. `loadNewRemoteProjectTransactionally(..., { source: "dev-showcase" })`
does not flush a quota-constrained source: it preserves live edits and previous
local recovery, saves the candidate to a generated target, then uses the existing
proof reader to check target identity and normalized content before adoption.
Cancellation, concurrent source edits/switches, failed writes, mismatched reloads
and local config/selection quota errors leave the source active. A successfully
written but unadopted remote copy may remain; there is no automatic remote delete.

Adoption removes the three showcase boot selectors from the URL so reload opens
the new remote project, not the seed. The original local override stays available
at its original URL. Supabase `current_json.assets.uploaded` remains the media
root; `supabaseResourceCache` remains a cache, not canonical blob storage. No
project schema migration, local DB fallback or new backend is introduced.

Ordinary remote media import awaits store flush before success. A failed remote
flush retains the pending edit and asks the author to restore connection and save;
it does not erase data that other live edits may already reference. Showcase
imports instead publish nothing until the explicit save-copy is verified.
`ProjectStorageQuotaError` classifies native Web Storage quota errors with export/
cleanup guidance; local failures do not start the remote network retry loop.

Transaction ownership is the captured `contentLineage`, authored
`mutationGeneration` and project identity, not root-object reference equality.
A normal source flush may reconcile accepted audio/monster metadata into a new
root without an authored mutation. That synchronization must not reject the
transition. Real edits (even if subsequently saved), same-ID reload/replacement,
and cancellation still invalidate it at flush, target-save and target-reload
boundaries. `transactionalRemoteSourceLineage.test.ts` exercises the actual
flush/reconciliation and save/load pipeline with only the transport replaced.

Focused contracts: `devMediaPromotion.test.ts`, `mediaImportDurability.test.ts`.
Real browser script: `scripts/qa/issue693-media.mjs`; default runs actual showcase
quota/cancel/network-denial paths with all remote writes blocked. Only a lead with
authorization may run `--permit-new-remote-project` to prove an 8 MiB file's exact
bytes after real remote reload and Test Play. The default is not remote proof.

## Project schema & persistence
- **System audio cue authoring (2026-09-08):** M2 027/028 fields add optional concrete `cue` and `operation:"set"|"reset"` (omission means set), preserving `resourceId` precedence over legacy `value` even when empty. New catalog defaults are `{cue:"battle",operation:"set",resourceId:"",volume:100}` for BGM and `cue:"confirm"` for SE. `src/project/systemAudioOverrides.ts` owns the finite cue keys; `volume` is per-track 0..100, not a mixer mutation. Generic forms show a disabled legacy placeholder instead of pretending a cue-less saved command has the new default. Existing project versions need no audio migration: generic M2 fields round-trip unchanged; only the optional runtime/save-slot `systemAudioOverrides` field is added. Its parser rejects unknown families/cues, non-string resources and non-finite/out-of-range volumes. See `runtime-sessions.md` for playback and silence/reset semantics.
- **Map-patch correction of invalid remote references (2026-09-08, task66):** a remote `current_json` can contain linked animals with an empty housing species policy even after the editor restores a valid local policy. Ordinary `deserialize`/Supabase load still rejects that row. Patch comparison extracts current-v4 maps/mapTree through shape checks and reference-independent normalization (`readProjectV4MapMergeSnapshot`); it never exposes invalid remote roots as a loadable Project. Reference repair is reserved for ordinary load and the validated complete candidate, not patch projection: repairing against remote roots first can delete concurrent common-event calls, transfers, schedules/living destinations, or rewrite emote targets that local roots/maps restore. This applies even if ordinary remote load would succeed after pruning. The same unpruned projection drives conflict detection, so a command-only remote edit cannot disappear from comparison. Local roots merge with the latest remote maps under the unchanged map/tree conflict rules. The completed candidate must pass reference validation before compatible load normalization, then the existing SHA-conditional write; a failed SHA re-reads and re-merges. Invalid local references, malformed remote shapes/versions, or incompatible merged references produce no write. No full-save fallback, animal-link repair policy, store-flight redesign, or schema migration is introduced. `test/supabaseMapPatchRecovery.test.ts` uses real parsing/validation and deferred transport barriers for correction, unrelated-map/event payload preservation, restored reference targets, load refusal, same-map command conflicts, SHA races, and zero-write rejection.
- **Supabase schema deployment is manifest-driven (2026-08-24):** `scripts/lib/supabase-database-ops.mjs` registers every deployable file under `supabase/migrations/`; `test/supabaseDatabaseOps.node.test.mjs` fails when a non-draft SQL file is omitted. Run `npm run db:check` for an anon-key/PostgREST schema probe. An administrator sets `SUPABASE_DB_URL` in untracked `.env.local` and runs `npm run db:migrate`; the Bun runner records SHA-256 checksums in the admin-only `rpg_zzu.schema_migrations` ledger, baselines already-complete legacy migrations, rejects partially applied or checksum-changed SQL, reloads the PostgREST schema cache, and finishes with project-scoped `ai_activity_logs`/`ai_conversations` insert→reload→cleanup verification. `DRAFT_*.sql` is never deployable. Do not report DB work complete until `npm run db:verify-ai` passes and the project id is recorded.
- **Missing AI tables are configuration errors, not successful fallbacks:** new activity writes never fall back into `ai_analysis_runs`; that table is read only for historical fallback rows. Missing `ai_activity_logs`, `ai_conversations`, or `user_skills` writes throw `SupabaseMigrationRequiredError` naming the required migration. The local conversation record (IndexedDB `oprn-ai-records` since 2026-09-03; the old `oprn:ai-conversations` localStorage key is migrated on first access) remains available, but the failed remote mirror is logged instead of silently swallowed. `scripts/list-ai-activity.mjs --remote` loads `.env` plus `.env.local` and scopes both primary and historical queries to `VITE_SUPABASE_PROJECT_ID`.
- **Online-save credentials are deployment-owned (2026-08-24):** when a complete Vite Supabase URL/Anon pair exists, `supabaseProjectConfigDraftWithSource` treats it as authoritative over stale browser custom credentials. Product UI never asks a user to enter URL, Anon key, or Project ID. Work selection persists separately as the non-secret `oprn:supabase-selected-project`; `loadNewRemoteProject` must not copy deployment credentials into localStorage. Old `oprn:supabase-project-config` remains read-only compatibility when deployment env is absent. This is a zero-configuration UX change, not Supabase Auth or per-user RLS: the client-visible Anon key is still public application configuration, and user isolation must not be claimed until Auth/RLS is implemented and verified.
- **AI 로그·대화 테이블의 anon 권한은 최소로 유지한다 (2026-08-27):** `20260827000000_ai_log_anon_delete_revoke.sql` 이 `ai_activity_logs` / `ai_conversations` / `ai_analysis_runs` 에서 anon 의 DELETE 를 회수한다. 클라이언트에는 이 세 테이블의 삭제 경로가 없다(`replaceRows` 는 maps/tilesets, `deleteSupabaseUserSkill` 은 user_skills 만) — 그래서 회수해도 기능 손실이 없고, 공개 anon 키로 남의 프로젝트 로그를 지우는 경로가 사라진다. 권한만 바꾸는 마이그레이션은 컬럼 계약으로 상태를 판정할 수 없으므로 레지스트리가 `revoked-privilege` 계약을 갖고, 적용기가 `information_schema.role_table_grants` 를 읽어 적용 여부를 판정한다(계약 없이 등록하면 SQL 실행 없이 baseline 으로 기록되어 조용히 누락된다). `verifyAiPersistence` 의 프로브 행은 고정 id 로 upsert 되고, anon DELETE 가 거부되면 실패가 아니라 `probeRetained` 로 보고되며 `db:migrate` 가 관리자 DSN 으로 정리한다. Phase8 초안(`DRAFT_20260706_auth_rls.sql`)은 이 세 테이블의 RLS + 4개 동작 정책을 포함해야 하고, `test/supabaseRlsCoverage.node.test.mjs` 가 등록된 마이그레이션이 만드는 모든 `rpg_zzu` 테이블에 대해 이를 강제한다(신규 마이그레이션의 anon GRANT 도 함께 차단).
- **P2 fishing/forage/collection/museum foundation (2026-08-25):** optional `database.fishSpecies` and `system.fishing`, `system.seasonalForage`, `system.collections`, `system.museum` records are normalized and shape/reference validated by `p2FoundationRecords.ts`, `shapeDatabaseFields.ts`, and `io/references.ts`. Missing P2 fields remain absent for byte-stable legacy project serialization. Fishing spots and forage areas carry bounded map rectangles; fish/item/map/reward references and duplicate ids fail closed. `PlaySession.collections`, `museumRewardAppliedIds`, `forageLastAdvancedDayKey`, generated-forage placeable metadata, and the dedicated `rng.streams.fishing` cursor are optional save-v3 fields handled by the shared manual/autosave/checkpoint writer, parser, and apply path. Load repair removes dangling P2 child rows without weakening museum AND conditions; map deletion reports and removes only definitions on the deleted map.
- **Optional P0 life-sim system records (2026-08-24):** `SystemRecords` accepts additive `energy`, `shipping`, `bundles`, `worldUnlocks`, and `makers` definitions. They are whitelisted by `normalizeSystemRecords`, shape-validated before normalization, serialized only when authored, and therefore leave old project JSON byte-stable. Bundle/world-unlock/maker definition ids and per-definition item rows must be unique. Reference validation fails closed for shipping allow-list items, bundle requirement/reward items and switch/recipe/world-unlock targets, world-unlock switches, maker input/output items, and enabled life-skill reward switch/recipe targets. Duplicate bundle/world-unlock/maker ids are also reported when linting an in-memory project, not only at the wire boundary.
- **P1 weather/animal foundation (2026-08-25):** authored weather is optional `system.dailyWeather { enabled, forecastDays?, seasons }`, where each season maps to bounded weighted `{ kind, weight, intensity? }` rules and `kind` reuses the native `none|rain|storm|snow|fog` union. Animal definitions are optional `database.farmAnimalSpecies`, placed animal-home definitions are `system.farmAnimalBuildings`, and editor-authored starting instances are `project.session.farmAnimals`. The animal-home type is intentionally limited to animal capacity/placement and must not be reused as the future general farm-building/house-placement model. `src/project/p1FoundationRecords.ts` owns direct-write normalization and collection/numeric limits; `shapeDatabaseFields.ts` rejects duplicate ids, unknown enums, unsafe numbers, and over-limit arrays at the JSON boundary. All fields remain absent when unauthored, so legacy project serialization stays byte-stable and no project schema-version bump is required. `src/project/io/references.ts` is the canonical cross-record authority: it validates duplicate species/building/instance IDs, feed/product item IDs, building map/bounds/allowed-species IDs, and start-instance species/building/event compatibility and capacity with exact authored paths. Repair drops species whose required item references are invalid and cascades their instances, prunes dangling allowed species, removes invalid placed homes, and clears invalid/incompatible/overflow home assignments without inventing replacements. Unknown event bindings remain a validation error rather than being silently retargeted.
- `system.craftRecipes[].requiresUnlock` and `system.itemUpgrades[].capability {areaWidth,areaHeight,energyMultiplier}` are additive authoring fields. Wire shape validation requires boolean recipe locks, tool axes in `1..9` with at most 81 affected tiles, and a finite positive energy multiplier; editor clamping and runtime fallback use the same limits. Legacy recipe/upgrade rows omit them unchanged. Sell-price rows used by shipping must have unique nonblank item ids and non-negative integer prices.
- Save schema version remains 3: P0 progress and the previously omitted `PlaySession.lifeSkills` / five shop economy fields are backward-compatible optional snapshot members rather than a project migration. `createSaveSnapshot`, the shared manual/autosave parser, and `applySaveSnapshot` own their only persistence path; checkpoint snapshots call the same writer/apply functions. Gold, loyalty spend, sold/bought counts, and mileage share the `src/project/economyValues.ts` safe-integer `0..GOLD_MAX` contract at writer, wire-parser, and direct-apply boundaries: malformed gold falls back to `0`, while malformed optional ledger rows are dropped without corrupting the whole save. Life-skill progress is restored only for current project IDs, XP is safe/capped to the authored maximum and level is derived from XP. Maker deadlines must be monotonic safe integers. Bundle completion/reward receipts are normalized to one known-ID union so a one-sided receipt cannot reapply rewards. Shipping history is bounded by authored `historyLimit`, and legacy omitted values restore to `startSession` defaults.
- P1 keeps save schema version 3. `PlaySession.dailyWeather` stores only the resolved current day `{dayKey,kind,intensity}`; `src/project/dailyWeather.ts` derives actual weather and tomorrow-first forecasts statelessly from the session seed plus calendar day key, so forecast length/query order never changes persisted RNG streams or the actual result. Forecasts are never serialized. `PlaySession.farmAnimals` is keyed by `instanceId` and preserves identity plus friendship, production progress, ready-product count, and fed/petted/last-advanced day keys. Writer, shared slot/autosave parser, direct apply, and checkpoints use the same bounded sanitizers. A runtime-moved `buildingId` is restored only while the current building exists and allows that species; otherwise apply falls back to the compatible authored start home (or no home). Invalid entries otherwise fall back to the authored start instance, unknown species are not restored, and legacy saves with both optional fields omitted start from `project.session.farmAnimals` with zero progress.
- Calendar wire parsing must not normalize against the default 28-day season because the parser does not yet have a `Project`. `isGameTime` accepts only structurally valid wire dates up to the authored maximum of 99 days and preserves them verbatim; `applySaveSnapshot(project, ...)` performs the calendar-dependent normalization for both `gameTime` and `farmPlotsAdvancedThrough`. This keeps day 40 in a 40-day season while safely clamping it if the current project is later changed to 28 days (`test/customSeasonSave.test.ts`).

- The `src/project` data model is the canonical authored content: maps, database records, tilesets, events, and saveable project metadata. Code that edits project content should update this model, not runtime session fields.
- Optional `system.genre` is limited to the five IDs in `src/project/genrePackId.ts`, is preserved by normalize/serialize/deserialize, and rejects unsupported strings during shape validation. It is editor authoring metadata only: all packs use the same `Project` schema and runtime, and player code must not branch on it. Pack definitions and readiness live in `src/editor/genrePacks.ts`.
- `GameMap.roguelikeRoom?` is additive authored room metadata: `{ roomId?, resetEventState?, encounterSlots?: [{ id, choices: [{ fieldSpawnId, weight?, minFloor?, maxFloor? }] }] }`. Slots reference field spawns on the same map, have unique non-empty ids, require at least one choice, use positive integer weights, and accept floor bounds 1–9999 with `minFloor <= maxFloor`. `resetEventState` defaults to true and scopes authored event self switches plus `Erase Event` state to the current room generation; false opts out. Omission preserves legacy field-spawn behavior and requires no schema-version bump. Runtime run state remains in `PlaySession.roguelikeRun`, not in project JSON.
- **DB-is-truth for database records (2026-07-24):** Supabase `current_json` is the canonical source for authored database collections (items, skills, states, battleAnimations, battlerAnimations). `repairSupabaseCurrentJson` in `src/project/supabaseProjectSync.ts` no longer backfills missing records from `defaultItemRecords()` / `defaultSkillRecords()` / etc. on load — a sparse DB row loads as-is. JSON defaults only **seed new projects** via `createBlankProject` → `saveProjectToSupabase` (a DB write). Local is cache-only; there is no local-JSON-as-truth path (enforced by `test/noLocalProjectDb.test.ts` and the `supabase-project-root` ontology contract). Verified by `test/supabaseProjectSync.test.ts` (no-backfill unit) and `test/supabaseCanonicalRoundtrip.live.test.ts` (live load→save→reload).
- **번들 기본 카탈로그 보충은 Supabase 백필과 다른 층이다 (2026-08-30):** 위의 "보충 금지"는 `repairSupabaseCurrentJson` 이 **원격 행**에 손대지 않는다는 규칙이다. 그와 별개로 `ensureDefaultDatabaseIconResources()` (`src/project/defaults/defaultDatabaseIconResources.ts`, `store.normalizeCurrentProject` 에서 호출) 는 **번들 기본 아이템과 기본 장비**를 id 기준으로 보충한다 — 없는 id 만 넣고 이미 있는 레코드는 절대 덮지 않는다. 이 층이 필요한 이유는 실측이다: 편집기 기본 예제(`createSampleAdventureProject`)가 동결된 export 픽스처 `src/project/defaults/fixtures/dew-village-demo.json` 를 복제하는데, 그 픽스처에는 아이템 21개·장비 11개만 들어 있다. 아이템만 보충하고 장비는 보충하지 않던 비대칭 때문에 코드의 기본 장비 86종 중 11종만 화면에 보였다. 계약은 `test/defaultEquipmentBackfill.test.ts` 가 고정한다(모든 `defaultEquipmentRecords()` id 존재 + 사용자가 고친 이름 보존). **한계는 그대로 적어 둔다: 사용자가 의도적으로 지운 기본 레코드는 다음 로드에 다시 살아난다.** 보충이 `changed` 를 세우므로 그 부활이 다음 저장에 실려 나갈 수 있다. 아이템 보충이 원래 갖고 있던 성질이고 이번 변경이 만든 것은 아니지만, "보충 금지" 이야기의 유일한 실질 예외라서 명시한다.
- **저장이 스킵되는 세션은 화면이 그렇다고 말해야 한다 (2026-08-30):** `?freshProject=1` / `?blankProject=1` / dev 쇼케이스 위치는 의도적으로 `remotePersistenceEnabled = false` 이고 `isSaveSkippedLocation()` 이면 localStorage 기록조차 스킵한다. 예전에는 이 상태에서 편집해도 자동 저장 표시가 조용해서(또는 `saved` 로 보여서) 사용자가 저장됐다고 믿었고, 다시 열면 추가한 레코드가 사라졌다. 이제 `store` 가 이 조합에서 `{ kind: "error", code: "session-not-persisted" }` 를 세워 톱바 저장 칩(`db-autosave-state`)에 "이 세션은 저장되지 않습니다" 를 띄운다. 저장이 안 되는 것은 의도된 동작이고, 조용했던 것이 결함이었다. 계약은 `test/itemAddPersistence.test.ts` 가 실제 store·실제 `addDatabaseRecord` 경로로 고정한다.
- Runtime item-use charges are optional save/session data for backward compatibility. Missing or malformed charge maps normalize to an empty map; finite-use transitions own inventory/charge conservation. `src/project/itemQuantities.ts` owns the shared `ITEM_QUANTITY_MAX` (9,999,999), safe-integer validation, and result resolution. `changeItem`/`changeItemsAtomically` reject an unsafe current value, delta, or result before touching inventory or charge cursors; shipping, bundles, upgrades, makers, farming, crafting, storage transfers, and shop purchases/sales commit item movement through that contract. Chest save parsing and direct snapshot restore preserve valid chest metadata while dropping zero, unsafe, or over-cap inventory rows. Runtime equipment reads use effective normalized equipment, while user equip/unequip writes go through the strict atomic transition authority and never mint or delete inventory.
- Optional `GameMap.layoutPlan` stores generation bbox design after village/market builds (`MapLayoutPlan` / `MapLayoutRegion` in `types/project.ts`). Helpers: `src/project/mapLayoutPlan.ts` (`findLayoutRegions`, `rankRegionsByCenter`). Do not discard plan after stamping tiles — keep for “move blue house in center” style queries.
- `ActorRecord.faceResourceId` stores a standalone 48×48 face graphic resource id. `ActorRecord.characterIndex` (0..7) remains an optional sheet cell defaulting to 0 when omitted. `ActorRecord.faceIndex` is removed. Project schema version is bumped to 4 (`SCHEMA_VERSION = 4`); `migrateV3toV4` rewrites stored legacy (sheet id, faceIndex) pairs to standalone face resource ids on load, treating an omitted index as cell 0. Normalization may drop explicit characterIndex 0 to keep legacy JSON compact; editor previews and list thumbnails treat missing characterIndex as 0.
- `SkillRecord.scope` accepts `self | ally | allAllies | enemy | allEnemies`. `allAllies` is an additive value handled by type guards, normalization, references, tools, editor controls, runtime targeting, and serialization; existing scope values and saved projects remain valid, so this addition does **not** require a project schema-version bump or migration. Keep authored scope authoritative instead of deriving target side/cardinality from damage/healing/support effect kind.
- Gen1 battle metadata is additive and optional in schema v3: `SkillRecord.maxPp` (1..99) and `gen1CriticalRate: "normal"|"high"`, `StateRecord.gen1MajorStatus` (`poison|burn|sleep|freeze|paralysis`), `TroopRecord.trainerBattle`, and `ItemCaptureProfile.ballClass` (`poke|great|ultra|master`). Omission keeps the compatibility contract: no authored PP cap, normal critical class, no major-status semantic, wild/non-trainer troop, and the existing capture `multiplier` path. Normalization drops invalid metadata while preserving valid values through load/save, so this optional expansion does **not** bump `SCHEMA_VERSION` or require migration.
- The `monster-collect` genre preset must set the canonical selectors `system.battleParty = "monsters"` and `system.battleFlow = "strict"` in addition to the legacy `monsterBattleParty` compatibility flag, Pokemon battle UI, and `battleModel = "gen1"`. A Pokemon skin/model without the canonical party/flow selectors is not a complete preset.
- Optional `system.playResolution` is the project-authored logical play viewport. Omission remains byte-compatible with the legacy 320×240 default; `normalizePlayResolution` truncates and clamps authored values to 320–1920 × 240–1080 and drops an explicit default. `validateSystem` requires numeric width/height when the field exists, so serialize → deserialize preserves a valid custom viewport without a schema-version bump. `createPlayGame` uses it for Phaser, while `createPlaySurface` publishes matching CSS variables and geometry for title/runtime DOM. Dialogue width, lighting masks, and runtime marker culling derive from the live host/camera rather than fixed 320×240 constants. `calculatePlaySurfaceScale` keeps integer pixel-perfect upscaling when the stage fits at 1× or larger, but uses a fractional contain scale below 1× so a large authored stage never crops inside a smaller host. Battle keeps its separate 640×480 logical stage contract.
- System graphics: `system.titleResourceId` / `titleScreen.backgroundResourceId` drive the title background via `applyTitleScreenBackground` (default `rpg-zzu-title-field` 320×240 llm-provider pixel-art night village + crest logo `rpg-zzu-title-logo-crest` (scripts/generate-system-title-art.mts)). Changing `titleScreen.backgroundResourceId` must not clear `system.titleResourceId`. Optional `titleScreen.titleGraphic` (`mode` text|graphic|both + logo resource/x/y) renders title logo independently of the background. `system.systemResourceId` is the 9-slice windowskin (`applySystemGraphic` → `--runtime-window-skin`). `system.battleSystemResourceId` is the RM2k3 **System2** gauge/number/arrow chrome sheet (80×96 EasyRPG System2A/B/C) — **not** a windowskin and **not** a battle field backdrop. `applyBattleSystemGraphic` chroma-keys the sheet (top-left orange key), sets `--runtime-battle-system2`, and publishes slice CSS vars (`--system2-hp-fill-*`, `--system2-sp-fill-*`, `--system2-at-fill-*` from `src/assets/system2Sheet.ts`) consumed by `.battle-stat-bar` / `.battle-atb-bar`. Battle field art uses `resolveBattleBackdrop` (override → troop `previewBackgroundResourceId` → terrain → `generated-battle-reference-forest`); editor command previews and DB battle-screen labels must use the same fallback and never substitute System2. Runtime UI SFX use short RM2k3 cursor/decision/cancel wavs (`src/player/runtimeJuice.ts`); title can override cursor/confirm SE via `titleScreen.sounds.*SeResourceId` (`soundResourceId` on juice). Avoid long chimes on every menu open. The authored default runtime windowskin ships as `public/assets/ui/windowskin-warm.png`, a warm brown 9-slice painted through the same `--runtime-window-skin` variable (`src/styles/runtime/system.css`) and consumed via `border-image` by the status-menu party cards, detail panel, and command dock; `system.systemResourceId` still overrides it per project.
- Runtime pixel typography: `--runtime-pixel-font` (`src/styles/runtime/system.css`) lists `NeoDunggeunmo` first, ahead of the existing `Galmuri11` / `Galmuri9` / `GulimChe` / `DotumChe` / `"MS Gothic"` / `monospace` fallbacks, so the fallback chain stays intact when the webfont is unavailable. The face is declared with `@font-face` loading `public/assets/fonts/neodgm.woff2` (Neo둥근모, SIL Open Font License; license text kept alongside the file at `public/assets/fonts/LICENSE-neodgm.txt`). Neo둥근모 is wider per glyph than Galmuri at the same authored `font-size`, so runtime surfaces that pack text into fixed-width grid columns must be re-measured after touching this variable rather than assumed safe.
- Title menu options are id-based (`newGame` / `continueGame` / `quit`) and filtered by `titleScreen.menuVisibility` through `listTitleMenuOptions` (newGame always visible). Keyboard (↑↓ / Z·Enter / X·Esc) and mouse/touch click target only visible options. Click handlers live on `titleScreen.ts` options; `playInputBlocker` allows pointer events whose target is a title option (`title-new-game` / `title-load-game` / `title-quit-game`) while still blocking field pointer input. Optional `titleScreen.showInputHint` (default true) toggles the on-screen key hint. E2E should prefer `startNewGameFromTitle` from `test/e2e/runtimeInput.ts` (Enter) for stability; title option clicks are also valid for real users.
- `Project.storyFlags?: StoryFlagDef[]` is authored metadata that gives existing switches/variables stable narrative meaning. It stores `{id, kind:"switch"|"variable", targetId, description, questId?, tags?, retired?}` and must not replace `Project.session` or `PlaySession.switches/variables` as the runtime state machine. `declare_story_flag` registers/renames/retires this metadata; retire is soft deletion and live usage should remain visible through warnings.
- `Project.switches` / `Project.variables` are dynamically sized definition arrays with no configured 1000-record ceiling. New project factories seed one 20-row picker block for immediate command-form usability; editor add/range actions grow beyond it on demand, and `ensureSwitchVariableSlots` only reconciles authored definitions with `ProjectStartState.switches/variables` (it does not impose a minimum or maximum on loaded projects). Preserve legacy projects that already carry 1000 unnamed slots, and keep ids above `sw_1000` / `var_1000` valid through normalize, save/load, and `startSession`.
- `Project.meta.terms` stores optional authored label overrides for the currently wired runtime strings: battle commands (`attack`, `skill`, `item`, `capture`, `back`, `target`), shop labels, inn labels, and common/status labels (`gold`, `goldPrefix`, `level`, `hp`, `mp`). Runtime code should call `resolveTerms(project)` from `src/project/terms.ts` instead of reading raw fields so omitted terms keep default Korean behavior without bloating serialized old saves. Runtime `inn` pauses as a commerce surface (`playInn`); optional `branchOnNotEnoughGold` resumes with value `"notEnough"` into `notEnoughBranch`, while stay path recovers party vitals (`recoverMp` optional) and can `advanceToMorning` through `sleepUntilMorning`.
- `Project.quests` can contain legacy step-compiled quests and graph quests from `define_quest`. Graph quest nodes use `completesWhen` conditions over existing switch/variable targets or storyFlag ids resolved through the registry, plus DAG edges; they are authored metadata only and do not add a new runtime state machine.
- Quest graph static lint lives with `projectLint`: missing write sites for node completion conditions are `quest-graph:dead-end-node` errors, while unreachable-from-start and edge-orphan nodes are warnings. `generate_walkthrough` turns graph nodes into `run_scene_test` JSON by tracing story flag write sites; non-automatic steps use `manualHint` plus the headless-only `set` step.
- `Project.endings` is authored project data. Each ending has `{ id, name, conditions, priority, epilogue? }`; `triggerEnding` either targets an explicit id or selects the satisfied ending with the highest priority. `epilogue` uses the same beat shape as `script_cutscene` and is compiled at runtime before the existing title-return ending step.
- **Faction registry (2026-08-28):** optional `project.factions { defs, relations }` is the runtime faction identity layer, distinct from the authoring-only lore graph in `project.world` (whose `faction` entities and `enemyOf`/`allyOf` relations the runtime does **not** read). `FactionDef` is `{ id, name, worldEntityId?, color?, aggression?, protectedFromNpcs? }`; `FactionRelationDef` is `{ a, b, stance }` with `FactionStance` in `-2 worstEnemy | -1 enemy | 0 neutral | 1 friend | 2 ally` and `FactionAggression` in `0 unaggressive | 1 aggressive | 2 veryAggressive | 3 frenzied`. Membership rides on optional `EnemyRecord.factionId` and optional `FieldSpawnDef.factionId`, where the spawn wins so one enemy record can staff both sides of a fight. `src/project/factions.ts` is the only authority: `normalizeProjectFactions` drops empty/duplicate ids and relations pointing at undeclared factions, and `resolveFactionTable` builds the dense `Int8Array(size*size)` lookup. Two reserved factions `player` and `enemy` always occupy slots 0 and 1 with a built-in `-1` between them, unauthored pairs default to `0`, the diagonal defaults to `2`, and an unknown `factionId` resolves to the reserved `enemy` slot — so a project with no `factions` field behaves exactly as before and a typo stays hostile instead of turning pacifist. All fields are absent when unauthored, `validateFactions` in `io/shape.ts` fail-closes on malformed wire data (`worldEntityId` must be a string when the key exists), and load re-normalizes, so this does **not** bump `SCHEMA_VERSION`. Covered by `test/factionStance.test.ts` (defaults, symmetrization, duplicate-row folding, reserved-slot override, normalization drops, serialize/deserialize roundtrip), `test/factionsFromWorld.test.ts` (world provenance), and `test/factionRuntimePersistence.test.ts` (save overlay).
- **Duplicate authored rows fold to the more hostile value:** `resolveFactionTable` tracks which cells an authored `relations` row has already written (a parallel `Uint8Array` beside the dense `Int8Array`) and resolves a second row for the same pair with `Math.min`, writing both directions. Stance therefore cannot depend on `relations` array order. Nothing dedupes rows before this point: `normalizeProjectFactions` only drops rows whose endpoints are undeclared, and `validateFactions` checks shape, not uniqueness. The editor's stance matrix (`setSparseFactionStance`) and the `set_factions` tool both merge a pair given in either order, so duplicates arrive through hand-edited, machine-merged, or imported JSON — and before folding those resolved to whichever row happened to be last. Folding applies **only between authored rows**: the first row for a pair still overwrites the neutral default fill, the ally diagonal, and the reserved `player`/`enemy` `-1` seed exactly as before, so authoring `player`/`enemy` as allies still produces allies. `Math.min` is the same conservative rule `factionStance` already applies across asymmetric directions, so a peace row can never hide a war row.
- **`worldEntityId` is provenance, not identity:** factions materialized out of the `project.world` lore graph by `planFactionsFromWorld` (`src/project/factionsFromWorld.ts`, driven from the world panel's 전투 진영 변경안 preview in `src/editor/panels/worldManager.ts`) carry the originating `WorldEntity.id`. The planner resolves a lore entity to an existing def by that provenance **before** falling back to the derived combat id (`combatFactionIdFromWorldEntityId` keeps an id that already matches `WORLD_COMBAT_FACTION_ID_PATTERN` and is not reserved, otherwise emits `world_<readable>_<stable hash>`), so renaming a faction's combat id no longer makes the next materialization add a second def for the same lore faction. Stamping provenance onto a def that predates the field is the single write this planner performs on an existing row, and only when the derived id already paired them and `compatibleExistingDef` accepted the pair; name, color, and aggression stay hand-authored, incompatible same-id defs stay blocked in `diff.defs.conflicts`, and no def is ever removed. The stamp rides `diff.defs.changed` and counts toward `hasChanges`, so the preview reports it as `변경 N` and the apply button is not disabled as 적용할 변경 없음 (the apply toast still counts added defs and relations only). Repeat application is idempotent after that one pass.
- Event page movement type `chase` is distinct from `approach`: it uses deterministic A* over `canMove` passability, fixed direction tie-breaks, optional `sightRange`/`giveUpRange`, and `eventTouch` contact to run the page commands. `GameMap.safeZones` is an authored `{x,y,w,h}` tile-rect array; when the player is inside one, chase movers wait outside instead of touching the player.
- Play-mode character collision (RM2K3 same-as-characters): non-`through` NPC movers cannot enter the player's committed tile or mid-move destination (`isPlayerOccupyingTile` in `playSceneAutonomousMapActions.ts`), nor another `priority:"same"` + `overlapForbidden` event tile (`canNpcMove`). Player input already blocked solid events via `findBlockingRuntimeEventAtInMap`; forced player move routes use the same solid check. Move-route `setThrough` / jump still ignore character occupancy.
- Move-route hop commands: `{kind:"jump", dx, dy, heightPx?, durationMs?, se?}` and `{kind:"dropIn", heightPx?, durationMs?, se?, impact?}`. All hop options are optional and absent when unauthored, so this does **not** bump `SCHEMA_VERSION`; `validateMoveCommandShape` type-checks them and the runtime clamps (`0..960px` lift, `60..5000ms`). Defaults: jump peak 12px / 300ms / no impact, and `dropIn` 128px (8 tiles, above a 320×240 screen) / 620ms / impact on. `dx`/`dy` of `0` means "two tiles the way you face"; `dropIn` never changes tiles, so it clears the ground-occupancy question entirely and produces no walk step (no footfall care ticks, poison tick, follower step, or random encounter) — a jump lands as one normal step and does fire touch triggers. Both commands work for the player and for events; the player path lives in `applyPlayerRouteCommand` and only checks `inBounds` (out-of-map jumps are skipped, matching `canNpcMove`'s jump branch).
- `Project.world` is optional authored worldview data. Its canonical shape is `ProjectWorld` in `src/project/world/` (`entities` plus `relations`), normalized through `normalizeWorld` when present and treated as an empty world when absent for legacy projects. Editor UI should commit changes through the project store and keep runtime session state out of worldview records.
- `Project.worldGraph` is optional authored declarative map topology data. Its canonical shape lives in `src/project/worldGraph/`: nodes are `{mapId, role: "town"|"field"|"dungeon"|"interior", label?}` and edges connect `from.mapId/exit` to `to.mapId/entry` with kind `"transfer"` or `"adjacent"` (`"transfer"` default). The graph is normalized on load, permits planned nodes before maps exist as warnings, and `projectLint` includes `lintWorldGraph` for transfer destination/event-overlap errors plus adjacent boundary passability warnings. Actual player travel still uses normal event `transfer` commands; `link_maps`/`build_world` generate those events with stable IDs.
- Web export treats authored project JSON as the source of truth but strips editor-only event drafts and prunes `assets.uploaded` to statically referenced resource ids before writing `project.json`. `prepareWebExport()` must deserialize the serialized JSON once for shape validation before any package/download path reports success.
- **Export resource completeness (2026-09-06):** `src/battle/partySpriteResources.ts` owns party back-view/fallback selection for both battle rendering and export. `webExportAssets` includes derived resources for reserve actors and both fallback slot parities, then adds idle strips from the runtime catalog. Derived uploaded overrides must survive `prepareWebExport` pruning; a party texture key or successful combat result is not proof that its image decoded.
- **Export URL ownership:** `exportEntry` registers the game directory in `inlineAssetStore` before boot. `withInlineAsset` prefers embedded data, then rebases local `assets/` paths for exported players only. Editor paths, external URLs and SVG fragments remain unchanged. Image warmup, minimap tileset URLs and movie fallbacks use the same boundary. Catalog BGM may be fetched from the editor's configured CDN, but is packaged at the player's canonical local fallback path so exported playback needs no CDN setting.
- **Invalid ingredients do not produce success artifacts:** standalone rejects missing/empty/HTML bundle or media bytes; ZIP additional media rejects empty/HTML bytes while its existing manifest/hash checks remain authoritative for the player bundle. `url(#battle-flash-tint)` is a document fragment, not a file to fetch. The standalone CLI delegates to the same exporter.
- Idle and high-resolution sheet URLs also pass through `withInlineAsset`; including a file without rewriting its runtime URL is insufficient. HUD icons, runtime fonts and the fallback window skin use Vite-resolved CSS imports so web bundles use embedded or relative hashed assets; standalone `assetsInlineLimit` embeds imported CSS assets directly. `test/exportBattleAssetUrls.test.ts` exercises the actual producers and CSS build output.
- Loading v3 projects migrates legacy `villageInfoDocuments` into `Project.world` only when world is absent or empty. Each document becomes a `place` world entity linked to its map, while the original `villageInfoDocuments` field is preserved for one-version rollback and repeated deserialize/serialize cycles must not duplicate entities.
- `createBlankProject()` is a true blank authoring seed: one 20x15 default-chipset grass map named `빈 맵`, no events, a valid start position, and a one-actor starting party using the standard default database/system records needed to enter play mode. The sample adventure is intentionally separate as `createSampleAdventureProject()` (loads the editor-authored 《이슬 장터 — 30분》 fixture under `src/project/defaults/fixtures/dew-village-demo.json`, 16 maps) and should be requested explicitly when tests or UI flows need example content.
- **The shipped fixture's default-database tables are a derived artifact, not a hand-frozen snapshot.** `items`, `equipment`, `skills`, `states`, and `battleAnimations` are generated from the code defaults by `npm run fixture:sync` (`scripts/sync-fixture-default-database.mts`, merge rule in `scripts/lib/fixtureDefaultDatabase.mts`); `test/fixtureDefaultDatabaseDrift.test.ts` fails with that recovery command when they drift. The merge replaces default-id rows with the code value and preserves rows whose id is not a code default, so authored records survive. Maps, events, and every other table stay hand-authored — content scripts grow those.
  - Why the gate exists (measured 2026-08-30): content scripts read this fixture, add maps/events, and write it back, so the database froze at whatever it was when first exported. The demo shipped with all 11 equipment rows missing `accuracy`/`criticalRate`, 18 rows pointing at other records' icons (16 items + 2 equipment — `item_hi_potion` → `cc0-jetrel-potion-red`, `item_sword_manual` → a bronze sword instead of a book, `equip_iron_sword` and `equip_steel_sword` → both the bronze sword), empty `attackElementIds`/`stateDefenseIds`, and three stale prices. `ensureDefaultDatabaseIconResources` could not repair it because that pass only fills *empty* icon fields — a wrong value is left alone. `test/sampleAdventureNeedsNoBackfill.test.ts` now pins that the load-time pass finds nothing to do for the shipped demo.
  - Refreshing `items`/`equipment` alone is not valid: their rows reference `anim_gen_*` animations, `state_*` rows, and `skill_item_*` skills, so a partial sync leaves dangling references and `validateProjectReferences` throws. The five tables move together.
  - `test/e2e/author-dew-village-editor-demo.spec.ts` does **not** write this file. It writes a separate 2-map authoring smoke output to `test/fixtures/projects/dew-village-demo.json` and hard-asserts that 2-map shape. The two files share a name but are different artifacts; the earlier "regenerate with that playwright spec" note pointed at the wrong path and is how the shipped fixture went stale unnoticed.
- **`test/fixtures/projects/dew-village-demo.json` is deliberately kept old.** It is the legacy specimen for the three legacy-repair tests in `test/supabaseProjectSync.test.ts` (imported as `dewVillageDemoLegacySpecimen`), which need a pre-migration project to have anything to repair — `retiredEquipmentItemReplacement` rewrites an existing row and does nothing when the row is absent. Do not "helpfully" refresh it or point those tests at the shipped fixture: the tests would pass vacuously.
- Shop economy session fields `shopLoyaltySpend` / `shopTradeCounts` / `shopMileagePoints` / `shopPawnTickets` / `shopLastRestockDayKey` persist S/A/B shop economy state (loyalty discount, dynamic pricing, mileage). Purchases preflight the player stack, player/merchant gold, and trade counters before committing the item grant; sales likewise preflight inventory, payout capacity, merchant gold, and every shop ledger before checking `changeItemsAtomically` and committing gold/count changes. A full, unsafe, or overflowing value leaves inventory, player gold, trade ledgers, and merchant gold unchanged. Mileage accrues **only on successful purchase** via `mileageRate` and is **deducted on refund** via `refundShopMileage`. Repair/appraisal services gate on `appraisalUnidentifiedPool` — empty pool disables the menu and returns `failed` (no gold is charged). Festival/traveling shops are **condition-gated**: `festivalFlag`/`travelingRouteId` must be wrapped in a `fork`/`condition` event; runtime does not auto-show a closed festival shop.
- `TilesetDef.transparentColor` is an optional authored-project hex color key (`#rrggbb`) set by the editor. It is persisted with the tileset, validated as an optional string, and render-time transparency should prefer it over bundled chipset default color keys.
- `TilesetDef.kind` optionally classifies a sheet as `"rpg2k"` or `"custom"`. Legacy records infer uploaded or non-480 sheets as custom; bundled 480-chip sheets remain RPG2K. Editor tileset selectors group both categories. Custom map palettes preserve exact source-cell order (up to ten visible columns) and must not apply Combined Town tile-number/autotile-collapse semantics; explicit tile metadata and priority still control layer routing.
- `TileGroupMetadata.junctions` and `TileGroupMetadata.overlays` are optional authored structural-rule arrays. They are persisted with tile groups for roof/wall boundary omissions/replacements and conditional overlay tiles; keep them backward compatible and validate referenced roles/tiles through tileset semantic checks.
- `TileGroupMetadata.rules` is an optional authored cluster-rule array. `hard` rules map to project lint errors but do not block `commitChangeset`; placement-time enforcement plus lint reporting is the hard-rule contract. `medium` maps to warnings and `soft` maps to info. Current rule kinds are adjacency, spacing, and count, with validation owned by `src/project/lint/clusterRuleValidators.ts`; spacing/count use footprint instances rather than raw occupied cells.
- `TilesetDef.palettePresets` is optional authored tileset vocabulary. Each `PalettePreset` has a `pp_` id, name, origin, optional locked flag, and role slots (`ground/path/wall/water/decor/boundary/roof/furniture`) with tile ids and optional slot weight. Missing `palettePresets` remains absent for legacy projects; deserialize only normalizes present preset ids to the `pp_` prefix. `TileAiMetadata` also accepts numeric `confidence` plus `origin`/`locked` while preserving legacy string confidence/source/userLocked fields.
- `palettePresets` and semantic `tileGroups` are separate persisted contracts. Legacy placement may select `presetId + paletteRole`; v3 construction resolves approved group labels and pattern grammar. `BUILD_PALETTE_GROUP_IDS` contains persisted tile-group ids and `ensureBuildPaletteTileGroups` only normalizes matching groups; it must not create or mutate `palettePresets`.
- Legacy `tileset.terrainTemplates` fields are no longer part of the project schema. `deserialize`/`validateProjectV3` drops them silently for old JSON, and `serialize` must not write them back out. House structure grammar belongs to `src/editor/houseKit.ts`; dirt/sand terrain shaping belongs to `paint_road` autotile paths.
- Human tile-meta corrections mark `TileAiMetadata` as `origin:"user"`, `confidence:1`, and `locked:true` while preserving the legacy `source:"user"`/`userLocked:true` fields. AI tile metadata write paths must treat either `locked` or `userLocked` as protected, skip those tileMeta entries unless the call is explicitly user-confirmed, and return the Korean preserved-count warning line for proposal review.
- `src/project/tilesetPalette.ts` owns the compatibility reads (`tileMetaOrigin`, `tileMetaLocked`, `tileMetaConfidence`) and the canonical confirmation write (`confirmUserTileMetadata`). Do not normalize legacy aliases away during deserialize; old project JSON remains readable while all new human-confirmation paths write both generations consistently.
- Manual knowledge groups may persist `cellLayers` for row-major lower/upper decisions and `sourceBlocks` for coordinate-addressed atlas sub-blocks. `patternGrammar.kind:"repeatable_block"` requires positive `blockWidth`/`blockHeight` and exactly one row-major `repeatBody` tile per block cell; construction expands it by two-dimensional modulo. A 9×9 water atlas is stored as a source rectangle plus nine 3×3 `sourceBlocks`; it is not falsely treated as one generic autotile brush. Directional travel remains canonical in per-tile `TilesetDef.passability` (`up/down/left/right`) and is orthogonal to visual grammar.
- AI `run_lint` combines the existing `projectLint` result with `src/project/world/lint.ts` so world reference errors, unlinked lore warnings, unregistered NPC/item warnings, and guideline info share the same `error`/`warning`/`info` issue shape.
- Story flag static analysis lives in `src/project/storyFlagUsage.ts` and scans authored map events, common events, and troop battle-event pages for switch/variable reads and writes. `projectLint` emits warning-only `story-flag:*` issues for read-without-write, write-without-read, retired target use, and undeclared switch/variable use only once a project has at least one story flag, preserving legacy projects with raw switch usage.
- Combined Town defaults seed conifer/dry-tree/broadleaf hard adjacency plus flower medium and bush soft examples, and expose 흙길/모래/lake-water terrain clusters for palette discovery. Harness re-application preserves an existing harness group as authored state, only backfilling default `rules` when the group has no `rules` property. Deleted Combined Town harness groups are persisted through `TilesetDef.suppressedHarnessGroupIds` tombstones so load/normalize does not recreate them.


## Variable arithmetic & loop runtime (2026-08-07)
- 변수 연산: `session.setVariable`는 `/=`에서 `Math.trunc`(0 방향) + `-9,999,999..9,999,999` 클램프, `0` 나누기는 기존값 유지+경고. `previewSimulation.applyVariableOp` 동일 규격. 프리뷰 값 소스는 시뮬 상태 기준.
- 루프 스택: `stack.breakLoop`는 가장 가까운 `loopOwner`만 끊고, 루프 없으면 스택을 비우지 않고 경고를 반환한 뒤 현재 `breakLoop` 명령을 한 칸 넘긴다. 같은 명령을 재실행해 instruction budget을 소진하지 않는다. `hasLoopFrame` / `maxLoopIterations=100,000` / `maxStackDepth` 가드는 유지.

## Canonical event-draft projection (2026-07-30)
- Open editor drafts may live inside the in-memory `Project`, but they are never canonical authored output. `committedEvents()` excludes `draft.kind:"new"` and projects `draft.original` for edit drafts; `projectWithoutEventDrafts()` applies this to every map. Autosave, Supabase writes, package/web export, edit-history project snapshots, and any canonical serialization boundary must use that projection.
- Editor-only map/list/marker/drag surfaces use `editorWorkingEvents()` so new and edited events do not disappear while their canonical projection is hidden. Runtime/project consumers must not switch to this working projection.
- `eventDraftVault.ts` stores project-scoped local recovery copies and reapplies live drafts over incoming remote/replace snapshots. Apply/OK remove draft metadata before canonical persistence; Cancel forgets the vault row and restores the original/removes the new event. The vault is recovery state, not a second authored source of truth and not evidence of a successful remote save.
- `store.beginReadOnlyProjectSnapshot()` temporarily changes `getCurrent()` for runtime readers while mutations, dirty state, autosave, `flush()`, and Supabase persistence continue to use the private canonical `current`; release restores the prior reader snapshot idempotently. Ordinary test play exposes a `projectWithoutEventDrafts()` snapshot after its save flush, while selected-event test exposes the canonical snapshot plus only the selected working body and never flushes. Keep this API scoped to runtime sandboxes and release only after player teardown.

## P2 general buildings and home decorations (2026-08-25)

- Authored definitions are optional `database.farmBuildingTypes[]` and `database.homeDecorationTypes[]`. General building levels carry contiguous `level`, rotated `footprint`, generic `capacity`, optional build/upgrade `cost`, and graphics. Decorations carry `placementItemId`, footprint, `blocksMovement`, allowed orientations, graphics, and optional allowed maps.
- Authored starts are optional `project.session.farmBuildingPlacements[]` and `project.session.homeDecorationPlacements[]`; runtime uses keyed `PlaySession.farmBuildingPlacements` and `PlaySession.homeDecorationPlacements`. These domains are intentionally separate from P1 `system.farmAnimalBuildings` and legacy single-tile `placeables`.
- Limits are centralized in `spatialPlacements.ts`: 256 definitions, 16 levels, 1,024 placements, footprint axes <=16 and area <=128, capacity <=9,999. Normalization is bounded, duplicate IDs are first-wins, costs aggregate duplicate item rows without exceeding `ITEM_QUANTITY_MAX`, and orientations are `down|left|right|up`.
- `shapeDatabaseFields.ts` validates full definitions and `shape.ts` validates authored starts. Old projects with all four fields absent retain the same serialized shape.

## 이벤트 초안 보관함: 명시적 저장은 자기가 대체한 디바운스를 취소한다 (2026-08-29)

`src/project/eventDraftVault.ts` 는 `scheduleEventDraftVaultPersist()` 로 250ms
(`PERSIST_DELAY_MS`) 디바운스 저장을 걸고, `persistEventDraftVaultNow()` 로 즉시 저장도 한다.
문제는 즉시 저장이 **대기 중인 타이머를 그대로 두었다**는 것 — `rememberEventDraftVaultEntry()` 가
디바운스를 건 직후 `persistEventDraftVaultNow()` 를 부르면 즉시 1회 쓰고, 250ms 뒤 **같은 내용을
한 번 더** 쓴다(`savedAt` 만 갱신된 중복 쓰기). 같은 파일의 `restoreEventDraftVaultEntries()` 와
`_resetEventDraftVaultForTest()` 는 이미 타이머를 취소하고 있었으므로, 취소는 이 모듈의 기존 규약이다.

지금은 `cancelPendingPersistSupersededBy(projectId)` 가 **projectId 가 일치할 때만** 취소한다.
무조건 취소하면 다른 프로젝트를 겨냥해 대기 중인 저장을 잃을 수 있다 — 그래서 예약 시점의
projectId 를 `persistTimerProjectId` 에 함께 들고 있는다.

왜 눈에 걸렸나: `test/transactionalNewRemoteProject.test.ts` 가 localStorage 스냅샷을 바이트
동일성으로 단언하는데(실제 타이머 사용), 이 중복 쓰기가 단언 앞뒤로 오가며 `savedAt` 만 달라지는
**경합**을 만들었다. 테스트를 느슨하게 하는 대신 중복 쓰기 자체를 없앴다. 계약 테스트:
`test/eventDraftVaultPersistDebounce.test.ts`.

## Boot normalizers must not create dangling references (2026-08-30)

`store.normalizeCurrentProject` 는 부팅마다 13개 정규화기를 돌린다. 그중
`ensureDefaultDatabaseIconResources` 는 이름과 달리 **기본 아이템 카탈로그 187종을 프로젝트에
밀어넣는다.** 그 아이템들은 기본 스킬·상태 테이블(`defaultSkillRecords`/`defaultStateRecords`)을
참조하므로, 자기 스킬·상태 세트가 더 작은 프로젝트(예제 어드벤처 = 이슬 장터: items 21 / skills 21 /
states 5)에 아이템만 넣으면 **프로젝트가 부팅 중에 스스로 참조 무결성을 깬다.**

실측(2026-08-30): 이슬 장터 로드 직후 참조 위반 0건 → 아이템 주입 후 82건. AI 런의 `run_lint` 가
그 54건(런 시점 기준)을 잡아 레이어 검증이 3회 연속 실패하고 런이 죽었다. 게다가 에이전트가 고아
레코드를 `delete_database_record` 로 지우려 하면 커밋 게이트가 **같은 왕복 오류**로 거부해 청소가
불가능한 교착이 됐다.

계약:
- 기본 레코드를 주입하는 정규화기는 주입 대상이 참조하는 기본 스킬·상태를 **같이** 보강한다
  (`ensureItemReferences`). 기본 세트로도 채울 수 없는 참조를 가진 레코드는 주입하지 않는다.
- `state_death` 는 엔진 내장 상태다(`references.stateIdExists`) — 레코드가 없어도 유효하다.
- 검증: `test/bootNormalizerReferenceSafety.test.ts` 가 계약을 고정한다 — 예제 어드벤처·빈
  프로젝트 모두 부팅 DB 정규화(`ensureDefaultDatabaseIconResources` →
  `ensureBundledBattleAnimations`) 후 참조 위반이 **0** 이어야 하고, 주입된 아이템은 없는
  스킬·상태를 가리키지 않아야 한다. 두 정규화기의 선언 순서가 계약의 일부다(아이템의
  animationId 는 뒤따르는 애니메이션 보강이 채운다).
- 커밋 게이트 기준선 대조는 집계 메시지를 줄 단위 원자로 쪼개 비교한다
  (`changeset.issueAtoms`) — 그러지 않으면 위반 하나를 지우는 편집이 "새 오류"로 분류돼 청소가
  영구 차단된다.

## `.oprn` 은 단일 파일 게임 컨테이너다 — 편집기와 플레이어 양쪽이 읽는다 (2026-08-30)

`.oprn` 은 예전부터 편집기 전용 "프로젝트 파일"이었다. 게임을 남에게 넘기는 경로는 「웹 게임
내보내기」뿐이었고 그 산출물은 `player.html` + `project.json` + 에셋이 흩어진 **여러 파일 ZIP** 이라
압축을 풀고 웹 서버에 올려야 돌아간다. 즉 **파일 하나를 건네 게임을 여는 경로가 없었다.**

계약:
- **컨테이너는 그대로다.** `src/project/package.ts` 의 `createProjectPackage` / `readProjectPackage`
  가 정본이고 확장자는 `RPGZZU_EXTENSION = ".oprn"`, MIME 은 `application/vnd.openrpg.project+zip`.
  새 포맷을 만들지 않았다 — 이미 단일 파일 ZIP 이고 업로드 에셋도 `assets.uploaded[].dataUrl` 로
  안에 들어 있다.
- **플레이어가 `.oprn` 을 연다.** `src/player/exportEntry.ts` 는 번들 `project.json` 을 못 읽으면
  죽지 않고 `renderOprnGameFilePicker`(`src/player/oprnGameFilePicker.ts`) 를 띄운다. 파일 선택 또는
  드래그&드롭 → `readOprnGameFile` → 기존 `startPlayer` 경로(제목·hostBridge)를 탄다. 단, 파일로 연
  게임의 세이브 네임스페이스는 그 파일의 `exportedProjectId` 로 정한다. 주소에 번들된 게임을 위한
  호스트 `saveNamespace` 나 `/play/<slug>` 를 물려받지 않아 서로 다른 게임의 세이브가 섞이지 않는다.
  번들 게임은 기존 우선순위(호스트 값 → 커뮤니티 slug → 프로젝트 ID)를 그대로 유지한다.
  `?open=1` 로 번들 게임이 있어도 열기 화면을 강제할 수 있다.
- **판정 로직은 DOM 과 분리한다.** `src/player/oprnGameFile.ts` 가 확장자/MIME 판정
  (`isOprnGameFile`), 드롭 목록에서 게임 파일 고르기(`pickOprnGameFile`), 디코드
  (`readOprnGameFile` — 던지지 않고 `{ok:false, message}` 를 준다) 를 소유한다. 그래서 브라우저 없이
  `test/oprnGameFile.test.ts` 로 고정된다.
- **에셋이 왜 따라오는가.** 번들 에셋은 플레이어 앱 안에 있고 저작자가 올린 그림은 프로젝트 JSON 의
  data URL 이다. 그래서 `.oprn` 하나로 화면이 정상 렌더된다 — 별도 에셋 폴더가 필요 없다.
- **플레이어는 `.json` 프로젝트를 받지 않는다.** 편집기 「가져오기」는 레거시 호환으로 `.json` 을
  계속 받지만, 플레이어 열기 화면은 `.oprn`/`.rpgzzu` 만 받는다. 게임 배포 표면을 좁게 유지한다.

검증: `test/e2e/oprn-single-file-game.spec.ts` 가 한 스펙에서 세 구간을 전부 통과시킨다 —
편집기에서 내보낸 `.oprn` 한 개(ZIP 매직 `PK` 확인) → `player.html?open=1` 의 보이는 버튼과 실제
`filechooser`, 이어서 실제 `DataTransfer` 드롭으로 각각 열어 타이틀 화면 기동(`document.title` 이
내보낸 파일명 어간과 일치) → 같은 파일을 빈 프로젝트 편집기로 되가져와 맵 수가 원본과 같아짐.
세이브 네임스페이스의 파일/번들 분기는 `test/oprnGameFile.test.ts` 가 고정한다. 증거 PNG 는
`verify-shots/oprn-single-file-game/`.

## 성장 트리 선택 확장 (2026-09-05)

`Project.growth`는 v4 선택 필드이며 기존 저장본에 자동 생성하지 않는다.
스킬 노드/직업 참조와 DAG는 `growth/validation.ts`, 투자 세이브는 `PlaySession.growthProgress`와
`saveSlots.ts`가 소유한다. 영구 스킬 목록에 투자 효과를 합쳐 저장하지 말 것.
자세한 계약: [성장 트리](growth-trees.md).
## 마을 설계서 (2026-09-05)

v4에 선택 필드 villagePresets[].design, defaultVillagePresetId, maps[].villageDesignSource를 추가했다. 레거시 프리셋은 자동 전환하지 않는다. 설계서·기본 참조는 load validator가 검사하며 JSON 저장/재로드 계약 테스트가 있다. 상세 계약과 경계는 [마을 설계서](village-design.md).
- 2026-09-05 emote recovery: native `showEmote` retains target/emote/durationMs through serialize/deserialize. `repairProjectReferences` (via `pruneDanglingCommandRefs`) recursively converts missing named event targets to `{eventId:""}`; native validation checks icon vocabulary, target shape and numeric duration. No stored project version bump is required for this additive command.


## 공포 게임 제작 기능 (2026-09-05)

선택적 EventPage.interaction 및 movement.pursuit를 검증하며 구버전 기본 동작을 보존한다. 데이터·런타임·저작·검증 계약은 [horror-authoring.md](horror-authoring.md) 참조.

### 저장된 대사 별칭과 맵 오버레이 (2026-09-05)

`oprn-399e312698` 약초상 릴리는 `{kind:"text", text:"..."}`가 저장돼 `body`가 undefined인 채 대화 렌더에 도달했다. `textBodyOf`와 ProjectStore의 로드 후 정규화는 `body`(빈 문자열 포함) → `text` → `lines` → `dialogue.lines` 순서로 원문을 읽는다. 인터프리터도 같은 읽기 함수를 사용해 maps-table 오버레이·기존 세션이 정규화를 건너뛰어도 대사에서 멈추지 않는다. 잘못된 객체는 문자열로 강제 변환하지 않는다. `test/textLegacyLines.test.ts`가 저장→로드 후 정규화→재저장과 원시 명령 실행을 검증한다.

## NPC 표시 이름 (2026-09-05)

GameEvent.name은 선택적 표시 이름이다. place_npc가 저작한 이름을 상태 페이지의 name과 별도로 보존해 재시도 중 중복 생성되지 않게 한다. 기존 이름 없는 이벤트는 페이지 이름을 조회 폴백으로 유지한다. 저장→로드 뒤 동일 NPC 갱신 계약은 test/adventureCompletion.test.ts로 검증한다.

`GameEvent.placementRole?: "npc"` is optional authored placement metadata (2026-09-06).
`place_npc` stamps it independently of sprite names and opt-in social `characterId`.
The existing JSON persistence path preserves it, and `validateEventShape` rejects
unknown role values. No version bump or blanket migration of custom sprites is used:
legacy unknown fixed objects must not become NPCs. Uploaded graphic replacements,
serialized reload, blocked-position lint and `move_event` recovery are covered by
`test/aiBlockedEventRelocation.test.ts`; authored pages and commands remain unchanged.

`set_project_settings({startActorIds})`는 system 메타데이터와 저작 시작 상태 `project.session.partyActorIds`를 함께 갱신한다. 실제 새 게임은 `startStateOf(project)`를 사용한다. 시스템 필드만 변경하고 런타임 파티 인원까지 바뀌었다고 판정하지 않는다.
## 연결 실내 도면의 영속성 (2026-09-05)

집·마을에서 자동 생성한 실내도 기존 `GameMap.roomHarnessPlan`에 개념 오버레이가 포함된 플랜을 저장한다. 새 스키마 필드나 버전 증분은 없다. `createHouseInteriorMap`은 현재 프로젝트의 꾸러미·구조물 그림을 읽고, 재로드 후에는 이 플랜으로 방 세션을 복원할 수 있다. `test/interiorConceptRoutes.test.ts`가 실제 `serialize` → `deserialize` 후 장소·물건 오버레이 보존을 검증한다. 옛 플랜은 실내 재시공 때 꾸러미에 연결된다.

## 개념 장소 형상 (2026-09-05)

`ConceptPlaceRecord.shape?: "rect"|"l"|"alcove"`는 장소의 선택적 바닥 형태다. 생략은 이전 직사각형과 동일하다. cloneConceptBundle·plan 파서·validateTileset·방 하네스 플랜·serialize/deserialize가 보존/검증한다. 모양을 바꾸어도 장소 id나 이벤트 소유 공간이 여러 개로 분할되지 않는다. 구체 도면은 `project/interiorRoomFootprint.ts`의 사각형 합집합으로 해석한다.
