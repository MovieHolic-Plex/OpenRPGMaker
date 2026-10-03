# Romance first conversation authoring harness

`src/harnesses/romance-scene/` implements one bounded playable scene, using the canonical Project schema and existing runtime interpreter. It is not another engine or a general natural-language game compiler.

## Entry and contract

New-project interview choices must be romance alone, `activity=talk`, `progression=single`, `scope=scene`. The source brief is retained verbatim. Explicit supported name/place/two-choice forms are extracted from the latest edited summary first, then interview fields. Unspecified fields are labelled `temporary` in the internal contract; reference pictures do not define the protagonist or appearance. Arbitrary prose does not become enforced requirements automatically. Mixed genres and longer stories continue through the existing authoring route.

`gameDesignBrief.implementation` contains a registered `harnessId` and validated version-1 contract. It is optional for old projects, survives normal Project serialization and SQLite persistence, and remains internal to the assistant context. `_core/authoringRegistry.ts` owns executable routing; the light manifest registry owns schema validation and CLI discovery.

The prepared single-map scene is playable immediately, with an existing temporary character sprite, first-choice variable, relationship variable, completion switch, branch-specific revisit pages, cancellation and ending. Its `_draft` page is explicitly incomplete. Startup saves before releasing the AI request and rebuilds the request from the prepared brief. It must not silently fall back to the old two-map skeleton on preparation failure.

## Authoring and rejection

While the seeded page is provisional, the production tool runner blocks other event/map/tile writes (planning `set_build_spec` remains available). The first builder must author the conversation before background construction, so visible playable progress does not wait for decoration.

`author_romance_scene` accepts opening, two reactions, two remembered revisit lines and closing. It preserves contract identities and choice labels. It authors native commands, then executes both branches before the ordinary tool runner atomically accepts the draft. Invalid arguments, identical reactions, inaccessible events or runtime failures leave the original project unchanged.

`inspect_romance_scene` walks from the real start position to the partner; it does not teleport or set expected relationship state. It executes both choices, repeated revisit, finish and cancel. It also serializes a real player save snapshot, restores it, and checks the remembered dialogue. This save-slot check is distinct from canonical SQLite project reload evidence.

Completion freezes the base contract and rejects changed/deleted contracts, changed source, identities or choice labels, unrequested protagonist sprite changes, extra maps, provisional pages, unchanged draft dialogue, missing/invisible sprite assets, equal reactions/memories, repeated gain, inaccessible events and unreachable endings. Inspection exceptions become blocking diagnostics. Team finish has no two-rejection bypass for this harness, and omission of a successful finish blocks the final result.

A successful current `review_map` is also mandatory. The read-only reviewer must receive an actual `show_map_region` PNG in a model tool response and submit `report_review` with no findings. The receipt is bound to the reviewed map/project content; subsequent content changes invalidate it. This is a model visual review, not a mathematical proof of art quality. Unsupported visual requirements and remaining findings must be reported honestly. Existing assignment repair budgets remain in force; no persistent TODO ledger is introduced.

## Reproduction

```bash
npm run harness -- romance-scene inspect --project <hydrated-project.json>
node scripts/qa/romance-scene-contract.mjs <baseline.json> <proof.json>
node scripts/qa/romance-scene-live.mjs
ROMANCE_QA_PACKAGED=1 node scripts/qa/romance-scene-player.mjs <export-project.json> <evidence-dir>
node scripts/qa/romance-scene-review.mjs <hydrated-project.json> <owned-host-url> <evidence-dir>
```

The focused contract script checks production tool dispatch, atomic rejection, schema roundtrip, native runtime paths and adversarial variants. Live QA uses a dedicated host/root, normal New Game interview, real provider, and host persistence. Authored tiles require reading the current canonical reference documents/images first. Game browser evidence must use the dedicated `player.html` QA server, never the editor play shell. Do not confuse fixture execution or JSON roundtrip with live provider success or SQLite reload.
