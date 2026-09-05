# Event editor audit classification

## Outcome and scope

The baseline inventory is complete: **79 registered native command kinds, 125 M2
catalog IDs and 110 files under `src/editor/panels/eventEditor`**. It also records
21 feature surfaces. Inventory completeness isn't behavioral correctness.
There is no blanket PASS and no claim that repairs have landed.

Baseline: `32ef1bcd66476d09486a8a09893da02184d2ebd5`.
Task: `st_01a072be`, parent session `01a072ac-d895-7d9b-8d30-9971d65ea221`.
This is the classification lane's baseline snapshot. `PLAN.md` governs the larger
three-phase repair effort; completing this report doesn't complete that plan.
AGENTS, quickstart, INDEX, PROJECT_WIKI, git-master and the existing PLAN were
reviewed. No production code, tests, configuration or shared remote content were
changed by this lane.

## How to read the evidence

| Strength | What it establishes | What it doesn't establish |
| --- | --- | --- |
| Executed inventory | Exact registry/catalog/file key sets and current file hashes | UI or runtime behavior |
| Source declaration | Factory, dispatch, schema activation, visibility and declared context support | That declared support works |
| Team-reported executed smoke | The parent audit says a renderer returned or an interpreter first step didn't throw | Fields, effects, resume, completion or all-context correctness |
| Team-reported confirmed defect | The supplied audit has confirmed the stated defect | A repair, independent rerun here or every possible input |
| Candidate | A concrete issue to reproduce and judge | Confirmed defect status |
| Intentional limitation | A scope boundary that should be described honestly | Permission to mislabel behavior as full runtime support |
| Not verified | No sufficient observation in the supplied audit | PASS or FAIL |

Evidence IDs and provenance live in `manifest.json`. Team probe logs weren't
supplied to this lane, so the manifest attributes those observations to the
parent handoff rather than claiming fresh execution. Source inventory and its
validator were executed here.

### Actual smoke coverage

- Native FakeDOM rendering: **78/79 returned**. `showAnimation` couldn't complete
  the fake-environment probe because fake `window` was missing. That's
  **inconclusive**, not a demonstrated application defect.
- Raw-M2 FakeDOM rendering: **125/125 returned**. A returned wrapper can have no
  parameter body. This result doesn't mean all forms are usable.
- Interpreter probes: **79 native plus 125 raw-M2 initial steps didn't throw**.
  These probes don't assert effects, player-host work, resume, completion,
  nested branches, persisted compatibility or map/common/troop equivalence.
- No per-command real-browser editing matrix, valid-value matrix, malformed-load
  matrix or shipped-player completion matrix has been established here. Each
  command record keeps those dimensions explicitly unverified.

`initial` is the baseline observation. `final` is the latest observation available
at this snapshot, not a promised phase outcome. Confirmed defects remain
`OPEN_NO_REPAIR_VERIFIED`; candidates remain candidates. The report doesn't
upgrade an initial observation based on a planned fix or a worker assignment.

## Authoritative sets and dispatch contracts

`manifest.json` has one record per key in `nativeCommands`, `m2Catalog` and
`files`. It records 21 `featureSurfaces`, 15 `findings`, evidence provenance and
12 historical anchors. Files carry hashes, exported-symbol inventories, a
surface assignment and initial/final classifications. Merely inventorying a
file isn't a line-by-line behavior review.

The authoritative inputs are:

- `src/project/commandKindRegistry.ts`: `COMMAND_KINDS`. The 79-kind registry
  includes the `m2Command` wrapper; 79 doesn't mean 79 visible native buttons.
- `src/project/eventCommands/m2Catalog.ts`: `M2_COMMAND_CATALOG`, constructed
  from the PDF and modern rows. Every ID is included, even hidden or deprecated
  rows. Raw saved M2 and picker-converted native commands are different paths.
- Recursive filesystem enumeration of `src/editor/panels/eventEditor`.
- `commandGuaranteeRegistry.ts`, `runtimeSupport.ts` and
  `commandPresentation.ts`: declared context support and visibility, not test
  outcomes. The raw-M2 behavior class and supported/unsupported effects are
  kept separately from the native alias's context support.

### Factory, form and interpreter mapping

Native records identify the `newCommand` switch case in
`src/editor/eventCommandFactory.ts`, their active form dispatch and the
`executeCommand` case in `src/player/interpreter/commandCatalog.ts`. Dedicated
form implementations are linked where the dispatch calls an imported or local
function. Every kind has a factory and interpreter switch anchor.

The active form precedence is schema, core handler, advanced handler, M2 handler,
then terminal fallback. A schema declaration alone doesn't activate a form:
`SCHEMA_RENDERED_KINDS` contains only `cutsceneControl`, `changeGold` and
`changeItem` at this baseline. Header-only forms are `changeLifeSkillExp`,
`spawnFieldEnemy`, `despawnFieldEnemy` and `openSaveMenu`. The first three need
editable parameters and are confirmed defects. `openSaveMenu` has no parameters;
its header-only body isn't the same defect.

For catalog rows, `existingKind` controls native conversion. The picker calls
`newCommand(existingKind)` for those rows, otherwise `newM2Command(id)`.
`playAudio` is special: the Play BGM row sets `loop=true`; other audio rows don't.
The manifest preserves that exception. An explicit raw-M2 fixture instead uses
`kind=m2Command`, the catalog ID and default fields. Its runtime route is
`executeM2Command`, including special cases and M2 runtime dispatch, not an
assumed replay of the corresponding native command.

### Hidden, partial and deprecated are different

- A native descriptor is selectable when its authored surfaces include
  `mainPicker` and map support is `full`. Hidden native kinds can have a nested,
  quick-authoring or AI route. Hidden doesn't mean absent from the inventory.
- Non-native catalog map selection uses the catalog index policy. Alias rows
  use their native descriptor. Both the policy and actual map-picker selection
  are stored, so these rules aren't collapsed into one boolean.
- The battle catalog policy is recorded separately. This isn't a browser proof
  that every troop surface exposes the row correctly.
- Deprecated rows are excluded from new picker authoring but retained in the
  catalog for saved data. Their replacement metadata remains in the manifest.
- `runtime-full`, `runtime-partial`, `editor-only`, `nativeAlias` and other raw-M2
  behavior classes are **source-declared support**, never audit PASS statuses.
  Map, common and troop declarations may differ. Raw alias persistence mustn't
  inherit the native picker's claimed effects without evidence.

## Findings and phase ownership

These findings come from the supplied team audit. Source mappings locate the
owning surfaces; they don't pretend this report independently reproduced each
failure. No final repair evidence was available to this lane.

| ID | Phase | Initial classification | Final at snapshot | Finding |
| --- | --- | --- | --- | --- |
| `P1-NAME` | 1 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Display-name cancellation leaks character profile changes. |
| `P1-HISTORY` | 1 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Keyboard/global and toolbar/local history differ; Ctrl+K and follower insertion bypass consistent snapshots; no-op history can destroy redo. |
| `P1-SELECTION` | 1 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Multi-selection is cosmetic while actions use a single path; page changes retain stale positional paths. |
| `P1-CONTEXT` | 1 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Context-menu Escape ownership and disposal are incorrect. |
| `P1-VALIDATION` | 1 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Page validation target IDs and active views fail to identify the actual condition controls. |
| `P1-TEMPLATE` | 1 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Template side effects need the event draft transaction boundary. |
| `P2-SHOP` | 2 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Shop UI festival, closingSale and vip values fail real serialize-to-deserialize round trips. |
| `P2-NULL-M2` | 2 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Null M2 fields are accepted at load and then throw at runtime. |
| `P2-HEADER` | 2 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Selectable changeLifeSkillExp, spawnFieldEnemy and despawnFieldEnemy commands have header-only parameter forms. |
| `P2-SHAPE` | 2 | CONFIRMED_DEFECT | OPEN_NO_REPAIR_VERIFIED | Malformed numeric text body and string wait ms survive loading. |
| `P3-KEYORDER` | 3 | CANDIDATE | CANDIDATE_UNVERIFIED | Record picker keyboard order differs from visible map-used grouping. |
| `P3-USAGE` | 3 | CANDIDATE | CANDIDATE_UNVERIFIED | Usage hints count JSON substring occurrences rather than semantic references. |
| `P3-STALE-CARD` | 3 | CANDIDATE | CANDIDATE_UNVERIFIED | Stale reference cards can be blank. |
| `P3-PREVIEW` | 3 | INTENTIONAL_LIMITATION | INTENTIONAL_LIMITATION | Preview simplifies loops, goto and calls. Disclose its limits; a full runtime redesign is not automatically required. |
| `P3-CALLBACK` | 3 | NOT_ESTABLISHED_AS_DEFECT | NOT_ESTABLISHED_AS_DEFECT | Setter callbacks and subdialog Cancel are not bugs without a violated transaction contract. |

The shop finding is the observed real serialize-to-deserialize failure for
`festival`, `closingSale` and `vip`. The earlier `repair` enum concern in PLAN
isn't promoted to a full-load defect here without equivalent evidence.
Null-M2 fields are a boundary defect; the report doesn't claim a malformed-null
execution was repeated for every catalog ID. Likewise, default first-step smoke
doesn't erase the malformed text-body and wait-ms findings.

Candidate record-picker issues still need deterministic real-surface evidence
and a judgment of impact. Preview loops/goto/calls should have honest simulation
limits; the finding doesn't authorize a full interpreter redesign. Setter
callbacks and subdialog Cancel aren't automatically defects. The relevant
question is whether the owning transaction promises rollback of those effects.

## Feature surfaces

Each subtree file has a primary surface in the manifest. Finding-to-file and
finding-to-surface links capture cross-cutting ownership. No file is omitted
because it looks like a helper or an old surface. External persistence/runtime
and global-search/common-event integration are explicit surfaces too; the
external source tree wasn't exhaustively inventoried by this documentation lane.

| Surface | Phase | Initial | Final | Coverage boundary |
| --- | --- | --- | --- | --- |
| `draft-lifecycle` | 1 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Modal open, draft, Apply, Cancel, autosave projection |
| `history-insertion` | 1 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Toolbar and keyboard history, Ctrl+K, follower insertion, no-op redo |
| `command-selection` | 1 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Root/nested selection, clipboard, delete, drag/drop, context menu |
| `pages` | 1 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Page add/copy/delete/reorder, conditions, movement, graphics, schedules and stale paths |
| `validation-navigation` | 1 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Issue bell, target IDs, active views and focus |
| `template-transactions` | 1 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Template insertion and project-wide side effects |
| `command-forms` | 2 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Native and raw-M2 forms, branches, defaults and schema activation |
| `command-picker` | 2 | NOT_VERIFIED | NOT_VERIFIED | Catalog/native picker, hidden routes, search, favorites, recents and preferences |
| `record-pickers` | 3 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Record lookup, map-used grouping, keyboard order, usage hints and stale cards |
| `graphic-pickers` | 3 | NOT_VERIFIED | NOT_VERIFIED | Charset, faceset, NPC graphics, animation and image controls |
| `map-transfer-pickers` | 3 | NOT_VERIFIED | NOT_VERIFIED | Map points, transfer destination, direction and preview |
| `move-routes` | 3 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Route catalog, nested route dialogs and parameter commits |
| `preview-simulation` | 3 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Preview simulation, conditions, branches, loops, goto and calls |
| `media-previews` | 3 | NOT_VERIFIED | NOT_VERIFIED | Audio, picture, movie and route previews |
| `command-presentation` | 3 | NOT_VERIFIED | NOT_VERIFIED | Summaries, visual cards, storyboard and modern script views |
| `ai-staging` | 3 | NOT_VERIFIED | NOT_VERIFIED | AI assist, staged command diffs and picture generation |
| `shop-authoring` | 2 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Goods, prices, economy configuration and save/load contracts |
| `modal-accessibility` | 3 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Subdialog ownership, focus, Escape, drag, resize, fullscreen and help |
| `shared-controls` | 3 | NOT_VERIFIED | NOT_VERIFIED | DOM controls, icons, inline helpers, custom select and types |
| `persistence-runtime-boundaries` | 2 | MIXED_SEE_FINDINGS | MIXED_SEE_FINDINGS | Shape/load validation, factory, interpreter, completion and effects |
| `search-common-event-integration` | 3 | NOT_VERIFIED | NOT_VERIFIED | Event search and common-event reuse outside the panel subtree |

The surface list includes command search/preferences, pages and schedules,
condition authoring, route editing, graphics/facesets, map transfer, audio and
visual previews, AI staging, summaries/storyboards, layout, focus, Escape,
common-event reuse and shared controls. These are coverage obligations, not an
assertion that each interaction was run. Unverified rows stay visible rather
than disappearing into a generic PASS.

## Baseline, browser provenance and fixtures

The historical `.omo/gates-baseline.json` is dated **2026-09-02** and records
**185 test failures**, with app typecheck exit 0. That's a historical baseline,
not a current result. The first current full-baseline run timed out; the parent
handoff says a rerun is pending. This report doesn't invent its exit status.

`scripts/verify-gates.mjs` compares failed test filenames, not individual failing
cases. Additional failures inside an already-red file can be missed. CSS and
surface failures are added as regressions even when related historical axes
were red. Compare actual diagnostic signatures and assertions against the same
baseline before assigning causation. Neither failure counts nor a gate label
alone prove regression freedom.

The old browser at **9841** was the wrong main server and is excluded as phase
verification. The actual phase server is **33509**. The parent reports that a
native-fetch transport overcame `ERR_NETWORK_CHANGED`. The file
`output/evidence/wish-event-audit/baseline-event-editor.png` exists and its SHA-256
is recorded. This lane didn't visually review that image. A screenshot of the
editor doesn't establish history, cancellation, parameter or runtime coverage.

Audit fixtures are native content-only fixtures with no remote writes. They
aren't shipped content and aren't evidence of Supabase persistence. There were
no remote content writes from this report lane.

## History anchors

Commit existence and subjects were checked with `git show -s`. These anchors
explain prior work and help locate its evidence; they don't establish that its
old tests still pass at this baseline.

| Commit | Audit context |
| --- | --- |
| `865c130f` | left-panel runtime audit |
| `2cd8db7d` | left-panel evidence correction |
| `bb27f699` | nine surface axes and mutation gates |
| `df88bd68` | mutation audit independence and determinism |
| `cd5923b4` | UI truthfulness and destructive surfaces |
| `c7494564` | blank command body repairs |
| `7733ec73` | legacy text isolation |
| `6e5b0059` | broken-command isolation |
| `915e8cf8` | lighting percentages and UI coverage |
| `f5d93c68` | flow coverage and 13 conditions |
| `ab074d89` | shop redesign |
| `026e9c7d` | persisted runtime execution fixes |

## Verification and update rule

Run from the repository root:

```sh
node .omo/evidence/wish-event-audit/verify-manifest.mjs
```

Observed result:

```text
nativeKinds: 79 entries, missing=0 extra=0 duplicates=0
catalogIds: 125 entries, missing=0 extra=0 duplicates=0
eventEditorFiles: 110 entries, missing=0 extra=0 duplicates=0
source hashes: 110 matched; mappings, aliases, evidence links and initial/final columns valid
Inventory verification passed. This is not a runtime, UI or repair PASS.
```

The validator loads the actual registry/catalog in memory, enumerates the actual
subtree, rejects duplicates and compares exact sets. It also checks file hashes,
conversion/deprecation metadata, factory/form/handler presence, finding links,
evidence references and initial/final columns. It isn't a new prose-pinning test
or a production behavior test. No product test suite, build or runtime QA was
rerun for this documentation-only change.

The validator has no LSP diagnostics and `node --check` passed. Markdown has no
configured language server; the JSON language server requires unavailable
Biome. No tooling was installed. JSON parsing and the executed inventory
validator provide the machine-readable checks instead.

Preserve initial columns when later phases add evidence. Change final columns
only after the corresponding observation exists, link its exact artifact and
commit, and state the proven dimension. If source inventories change, reconcile
the sets and hashes deliberately rather than carrying this baseline snapshot
forward as current proof. Confirmed defects stay open until their own repair
verification is observed.
