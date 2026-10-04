# Romance first conversation authoring harness

`src/harnesses/romance-scene/` implements one bounded playable scene, using the canonical Project schema and existing runtime interpreter. It is not another engine or a general natural-language game compiler.

## Entry and contract

New-project interview choices must be romance alone, `activity=talk`, `progression=single`, `scope=scene`. The source brief is retained verbatim. Explicit supported name/place/two-choice forms are extracted from the latest edited summary first, then interview fields. Unspecified fields are labelled `temporary` in the internal contract; reference pictures do not define the protagonist or appearance. Arbitrary prose does not become enforced requirements automatically. Mixed genres and longer stories continue through the existing authoring route.

`gameDesignBrief.implementation` contains a registered `harnessId` and validated version-1 contract. It is optional for old projects, survives normal Project serialization and SQLite persistence, and remains internal to the assistant context. Eligibility is used only to prepare the new-project seed; completion gates require an explicitly activated contract, so an old matching interview is not newly blocked. `_core/authoringRegistry.ts` owns executable routing; the light manifest registry owns schema validation and CLI discovery.

The prepared single-map scene is playable immediately, with an existing temporary character sprite, first-choice variable, relationship variable, completion switch, branch-specific revisit pages, cancellation and ending. Its `_draft` page is explicitly incomplete. Startup saves before releasing the AI request and rebuilds the request from the prepared brief. It must not silently fall back to the old two-map skeleton on preparation failure.

## Authoring and rejection

While the seeded page is provisional, the production tool runner blocks other event/map/tile writes (planning `set_build_spec` remains available). The first builder must author the conversation before background construction, so visible playable progress does not wait for decoration.

`author_romance_scene` accepts opening, two reactions, two remembered revisit lines and closing. It preserves contract identities and choice labels. It authors native commands, then executes both branches before the ordinary tool runner atomically accepts the draft. Invalid arguments, identical reactions, inaccessible events or runtime failures leave the original project unchanged.

`inspect_romance_scene` walks from the real start position to the partner; it does not teleport or set expected relationship state. It executes both choices, repeated revisit, finish and cancel. It also serializes a real player save snapshot, restores it, and checks the remembered dialogue. This save-slot check is distinct from canonical SQLite project reload evidence.

Completion freezes the base contract and rejects changed/deleted contracts, changed source, identities or choice labels, unrequested protagonist sprite changes, extra maps, provisional pages, unchanged draft dialogue, missing/invisible sprite assets, equal reactions/memories, repeated gain, inaccessible events and unreachable endings. Inspection exceptions become blocking diagnostics. Team finish has no two-rejection bypass for this harness, and omission of a successful finish blocks the final result.

A successful current `review_map` is also mandatory. The read-only reviewer must receive an actual `show_map_region` PNG in a model tool response and submit `report_review` with no findings. The receipt is bound to the reviewed map/project content; subsequent content changes invalidate it. This is a model visual review, not a mathematical proof of art quality. Unsupported visual requirements and remaining findings must be reported honestly. Existing assignment repair budgets remain in force; no persistent TODO ledger is introduced.

## Art direction and compact dialogue (2026-10-04)

`artDirection.ts` adds the same 16-bit scene composition instructions to the assistant brief and the read-only map reviewer. It preserves user names, appearance and location; it does not impose the reference post-office layout on other games. The active romance reviewer must report `artChecks` for composition/place/materials/grounding/readability, each exactly once with `passed:true` and a concrete observation of at least 24 characters. Missing, duplicate, failed or empty evidence blocks completion even if the reviewer says `ok:true`. These receipts are observations from a model, not an objective beauty score, and cannot certify dialogue UI from a map-only PNG.

A narrowly bounded blank-ground check rejects a town interview when over 70% of the meeting viewport is bare stock Beodeul grass (737). It inspects at most 20×15 cells around the partner and includes both overlay layers. It applies only to the original bundled Beodeul texture, not an uploaded replacement/graft at that tile, other chipsets, or other experience choices. Passing this check does not prove composition quality; paved emptiness and repeated props still require visual rejection. Functional `author_romance_scene`/`inspect_romance_scene` remain independent so first dialogue can appear before scenery.

New relation/romance preset defaults use `pixel-cinematic`: square translucent charcoal panels, Galmuri9, compact 25% stage height. Existing authored cream/gold styles are retained. Explicit fonts/styles still take precedence. Long choices wrap and scroll inside the compact panel; keyboard selection scrolls that list only and accounts for the stage scale. Long prose uses native pagination. Actual `player.html` screenshots must accompany map review.

The earlier post-office art comparison was a **coding-agent authored reference scene**, not an AI regeneration success or a universal first-scene template. That manual refinement script has been removed; the stored historical project/evidence remains intact. Its save/reload and shipped-player evidence is indexed in `verify-shots/romance-art/SUMMARY.md` and must not be presented as maker automation proof.

## Maker-owned repair loop (2026-10-04)

The product must generate the scene from the confirmed interview. A coding agent manually improving an example project is not evidence that the maker improved. Fresh automatic evidence must retain the sent interview, provider events, AI-authored commits, unchanged user identities, and canonical save/reload; manual content edits invalidate that claim.

For a new-game request marked `장르 프리셋:` with an active authoring harness, production `review_map` now owns the rejection → builder repair → fresh image review loop. Each rejection consumes the existing per-map fix budget (maximum two); it uses normal map assignment, checkpoints, browser publication and persistence. The reviewer remains read-only. Failed repairs or exhausted budgets return an incomplete result and cannot receive `finish`. Scenery repair checkpoints and the final merge reject changes to the brief, map scope/start, protagonist identity/appearance, existing events, dialogue or choices before publishing them. Execution inspection is also run on the reviewed snapshot, so a visually approved repair that removes the conversation remains rejected. The current registered harness is bounded romance; this does not claim equivalent enforcement for every genre.

This loop does not run for later read-only review requests or ordinary follow-ups. Read-only requests cannot assign map writes. A review/repair holds the map against another writer or concurrent review and blocks project-wide writes and finish until it ends. Cancellation stops new repair assignments. An active harness still needs image evidence in YOLO; the ordinary non-harness YOLO route retains its skip behavior. Each mutation invalidates the prior whole-project review signature. Before any optional final narrative audit, the runtime checks the authoring receipt and execution contract. A verified first build reuses its mandatory current-image review instead of launching another narrative audit after accepted finish; ordinary follow-ups retain the configured final audit. This prevents a finished first scene from waiting on duplicate checks before terminal `done`.

The artist/reviewer instructions reject disconnected prop arrangements and paving that merely reduces the grass count. A location label or a generic shop badge is not evidence of the requested place. These are model observations, not an objective aesthetic guarantee. `scripts/qa/maker-art-repair.mts` injects a synthetic provider into production orchestration to check repair/pass, exhaustion, read-only/follow-up, cancellation, YOLO and broken event repairs. It is control-flow evidence, not live visual proof. `ROMANCE_QA_SPEC=<json>` configures the actual New Game interview QA without changing generated map content.

## Reproduction

```bash
npm run harness -- romance-scene inspect --project <hydrated-project.json>
node scripts/qa/romance-scene-contract.mjs <baseline.json> <proof.json>
node scripts/qa/romance-scene-live.mjs
node scripts/qa/romance-scene-package.mjs <canonical.json> output/qa/romance-scene/package <owned-host-url>
ROMANCE_QA_PACKAGED=1 ROMANCE_QA_PACKAGE_DIR=output/qa/romance-scene/package node scripts/qa/romance-scene-player.mjs output/qa/romance-scene/package/project.json <evidence-dir>
node scripts/qa/romance-scene-review.mjs <hydrated-project.json> <owned-host-url> <evidence-dir>
```

The focused contract script checks production tool dispatch, atomic rejection, schema roundtrip, native runtime paths and adversarial variants. Live QA uses a dedicated host/root, normal New Game interview, real provider, and host persistence. Authored tiles require reading the current canonical reference documents/images first. Game browser evidence must use the dedicated `player.html` QA server, never the editor play shell. Do not confuse fixture execution or JSON roundtrip with live provider success or SQLite reload.

Actual evidence is indexed in `verify-shots/romance-scene/SUMMARY.md`. The final automatic project completed without human content repair; a software-renderer page error prevents calling the full editor UI audit error-free. Package browser QA includes real exported dependencies and disables opening only on an explicitly labelled scene QA copy.
