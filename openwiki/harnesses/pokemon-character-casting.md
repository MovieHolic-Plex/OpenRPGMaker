# Pokémon character casting — browser Allow / Deny

User-requested reusable human selection harness. `src/harnesses/pokemon-character-casting/` owns the producer, review server, SQLite decisions, live approval checks and approved output. It uses the existing `pokemon-character-motion` native import/check/preview/review/gate/build without changing its implementation hashes. Genre: monster-collect. CLI and standalone review page exist; editor workshop integration/assistant tools do not yet exist and are honestly false in the manifest.


## Portable harness (2026-10-05)

For new editor-independent work, use **`harness/pokemon-like-characters/`**. Copy that directory alone;
`node cli.mjs doctor|templates|prepare|new|render|queue|serve|status|verify|export` runs without the editor,
Vite, project storage, API credentials, or runtime npm packages. Node24 and Python3.10+/Pillow12.1.1 are required.
The original `src/harnesses/` adapter and live review records stay intact; the portable store has a separate approval history.

It owns readable `core/` sources plus a prebuilt Node bundle, pinned template references, all sixteen row-edit recipes,
Python render/replay/GIF/clone checks, SQLite review, a browser UI, author instructions, and focused portable tests.
`new` copies an editable draft; the agent must author its pixel rows. It does not invent artwork from a name.
The default `.data/` lives beside the tool or `--data` selects an external store. Store relocation was verified after Allow.
Engine-neutral export is 48×128 PNG, four-direction GIF, 16×32 frame metadata at130ms, provenance and human receipt.
No editor slot/asset ID is part of the portable contract. The background preview is light/dark/green contrast, not game QA.
`node scripts/copy.mjs --out <new-directory>` copies a dependency-free distribution with file hashes, excluding all review data.

Read the portable README and AGENTS for future character work. Verify portability with `node tests/verify.mjs` (copies the
whole tool outside the repo), and UI with `node tests/browser.mjs --data <store>` (backups to disposable SQLite before voting).
Synthetic QA votes never touch the real review store. Evidence: `verify-shots/pokemon-like-characters-portable/`.

## Legacy editor adapter: start and reuse

```bash
npm run harness -- pokemon-character-casting prepare
npm run harness -- pokemon-character-casting serve --host 0.0.0.0 --port 18316
npm run harness -- pokemon-character-casting status
npm run harness -- pokemon-character-casting build --id <approved-candidate-id> --out /absolute/local-output
```

Focused equivalent launcher: `node src/harnesses/pokemon-character-casting/node/cli.mjs <stage> ...`.

Default durable store: `~/.local/share/oprn/pokemon-character-casting/`. Use `--data /absolute/path` for isolation. `casting.sqlite` owns candidates and append-only decisions; `receipts/<seq>.json` binds each browser action to a package SHA. Sources and immutable package files are in `source/` and `candidates/`. Closing the browser/server does not lose choices. This is a harness store, not the game project's SQLite; no canonical project writes occur during preparation or voting.

Live review: http://mdc-server:18316/. The server fails if its explicit port is occupied; never reuse/stop another service. Keep the owned review server running while awaiting user choices. Restart with the same data directory. No CLI Allow/Deny stage; agents and supervisors must not invent votes or call the production decision API to approve their own work.

## Current distinct-body wave (supersedes first wave)

The user rejected the six Brendan-body/head-and-palette variants because they looked like the same character. Their immutable packages and any user decisions remain in place. `candidate_lifecycle` stores separate producer withdrawal metadata; it **does not insert a human Deny or erase an earlier vote**. The page hides withdrawn candidates by default and offers “이전 후보 보기”. Withdrawn candidates cannot Allow/build/download even if historical records contain an approval.

Seed: `harness-data/pokemon-character-casting/seed.json`, version2, collection distinct-v2. Rival: Wally-bodied boy and May-bodied girl; explorer: broad Hiker and Sailor; ranger: Camper boy and bearded Expert male. These are **six different actual original-game NPC sprites adopted losslessly**, not new independent artwork. Bodies, faces, clothing, props and drawn gait poses differ at source. `references/sources.json` pins all six original144×32sources, URL and SHA; ATTRIBUTION.md credits Nintendo/Game Freak/Creatures and pret/pokeemerald. Shared native16×32 contract and source animation mapping are retained. No original art is claimed as a new hand drawing. Original Expert female failed the existing minimum ink contract during reference probing and was excluded; no threshold was loosened to admit it.

`author.py` uses distinct native source cells with index0transparency and source right-facing flips. Output48×128, up/right/down/left × stepA/idle/stepB. GIF68×32 source-exact[0,1,2,1],130ms,infinite loop,explicit indexed palette. It runs the whole-wave diversity check before producing a queue list. `prepare` queues the reference wave and only after success activates that collection while withdrawing its prior versions and the legacy collection. Independently queued collections are preserved. Same content requeues the same immutable candidate. The rejected first-wave seed/art/script is retained as history, not the current producer.

The initial strict policy in `diversity.py` rejected nearly identical full silhouettes or body/leg silhouettes (IoU≥.985), and exact pixel-region partitions after replacing colors by encountered-color labels. Native body band is localy22..31, over all12poses. Jointly transparent background is excluded from IoU. This detects a shared body despite changed hair and recolored outfits. Thresholds are a clone-control policy, **not an artistic quality score**. Pairwise silhouette diagnostics do not prove different age,gender,anatomy or role. Negative controls cover recoloring and head-only changes. The six-source wave has15pair comparisons; highest body IoU .936, highest full IoU .901. User confirmation remains required.

`queue` compares a new candidate to all current non-withdrawn candidates, even if it gives itself another collection name. Renaming the role/candidate/collection cannot bypass this duplicate-body check. Exact requeue is idempotent. The user subsequently requested existing characters as body/gait templates. The replay-verified template policy below supersedes blanket shared-body rejection. Merely renaming collections still does not bypass validation.

The page shows current full-color/down-idle views alongside black silhouette canvases and lets the user open each real GIF and all12poses. Distinct-body Allow additionally requires “색을 빼도 … 구분된다”; all five observation checks are mandatory on the server. The overview and mockup are visual comparisons, not actual NPC runtime play proof.

External `queue --bundle <folder>` accepts candidate.json(role,label,variant,description,sourceNote), native charset.png, source-exact walk.gif,480×360 context.png,origin.txt,recipe.json. It copies inputs,native-imports,checks and previews them. Contract failures and clones are rejected rather than silently repaired. The mockup places the candidate below unchanged Brendan at an integer scale. Battle portraits and actual project application still follow a later user selection.

## Human review

- Role/state filters and individual candidate selection.
- Native1× and integer4× real GIF playback; pause/resume and four-frame stepping; native12pose atlas; map placement mockup; original Brendan GIF comparison.
- Allow requires explicit observations of directions,gait,pose identity and map scale/role; current distinct-body candidates also require cross-candidate identity/silhouette distinction. Structural success alone is never aesthetic approval.
- Deny requires a correction note. Its text persists for the next revision. Deny of an approved candidate revokes build/download permission.
- One current Allow per role: allowing another variant supersedes the previous selection. Earlier decisions remain in history.
- User decisions are anonymous browser operator records, not authenticated human identity proofs. Same-origin JSON POST plus session cookie/CSRF are required. Native review evidence hashes bind the receipt to the current native package; none of this proves artistic truth.

The page says Allow approves a candidate; canonical game application is a separate operation. Successful downloads contain native48×128, editor72×128 padding-only adapter, GIF, source recipe/origin, native gates and human-approval.json with cast slot coordinates. GET/download rechecks the live Allow; old ZIP files are not ongoing permission to apply a denied/superseded candidate.

## Freshness and shipping gate

Package checksum binds source PNG/GIF,context,origin,recipe, native source/final/provenance/prompt/preview and native implementation. Different pixels/GIF/frame order/provenance/implementation cannot retain the old approval. Each build also reruns native gate/build and rechecks the live decision. Approved native review evidence must contain the current receipt hash.

`register-pokemon-character-motion.mjs` grandfather-matches currently published role source hashes. Any newly introduced/changed field walking source requires `selection.humanReview.dataDir` and that role/source's **live current Allow** from this store. It checks again before shared writes. A changed approved role uses its package provenance instead of incorrectly comparing it to the old baseline Python role SHA; all unchanged roles and portraits keep their previous source-hash checks. Native source/output equality, exact editor padding and the hero's separate quality/fidelity gate remain required. Human selections appear in the generated role ledger. User review of walking never silently approves battle portraits.

To register a selected role, copy the previous full selection, replace `walk[role]` with the nativeCandidate in its current human-approval receipt, and set humanReview.dataDir. Build all35 current native candidates as usual. Canonical save/fresh reload and actual standalone runtime QA are still required **after** the user chooses. The game stays untouched while the six current candidates await choices. Old withdrawn packages are retained.

## Focused verification

`node src/harnesses/pokemon-character-casting/node/verify.mjs --out /absolute/evidence` exercises the actual review UI and local output on a disposable **copied** store. Synthetic browser Allow/Deny are never production votes. Production checks are view-only, does not write real decisions, and prove registrar rejection does not alter shared output. Uses no Vitest/full gates/typecheck/stash. Inspect SUMMARY first.

Evidence: `verify-shots/pokemon-character-casting/`. Full local screenshots/source QA: `/home/main/z-project/pokemon-character-casting-evidence/`. Initial canonical AI conversation table was checked read-only and contained0rows; this chat's user instructions establish the requested workflow. No access credentials are stored in harness evidence.

Distinct-body correction evidence: `verify-shots/pokemon-character-casting-distinct/`, full private `/home/main/z-project/pokemon-casting-distinct/`. New focused verification includes producer withdrawal preservation and renamed duplicate-body rejection.

`node src/harnesses/pokemon-character-casting/node/verify-distinct.mjs --out /absolute/evidence` verifies the current six-source wave, archived variants, five-observation approval requirement, silhouette overview, all six GIFs, and mobile layout. The review server must already run on18316. Rejected API approval attempts use a copied disposable store on18586; production receives no votes. Read the distinct evidence SUMMARY first.

## Newly authored candidate workflow (2026-10-05)

`harness-data/pokemon-character-casting/authored/naru-v1/` contains Naru, a new explorer candidate authored as twelve explicit 16×32 palette grids. Source: `naru.px.json`; design, reference observations and corrections: `DESIGN.md`. The original PNGs are visual references only. `render-authored.py` reads the grid, never original sprite images, and bakes each symbol directly into PNG/GIF; no mirroring, tracing, recoloring or automatic pose generation. The separate placement backdrop is a screenshot mockup. Its recipe embeds the entire source grid and source/renderer hashes, so the immutable candidate preserves the editable authorship source too.

```sh
python3 src/harnesses/pokemon-character-casting/node/render-authored.py --source harness-data/pokemon-character-casting/authored/naru-v1/naru.px.json --candidate harness-data/pokemon-character-casting/authored/naru-v1/candidate.json --out /absolute/review/naru
npm run harness -- pokemon-character-casting queue --bundle /absolute/review/naru
```

Current Naru candidate: `explorer-1c9395185ff2b26e`. Open `http://mdc-server:18316/?candidate=explorer-1c9395185ff2b26e` to select it directly. Picking another candidate updates this query; reload preserves it. Seven current candidates coexist (six reference adoptions plus this new grid artwork); provenance is displayed for each. Old screenshots/checks describing exactly six candidates are historical distinct-v2 evidence.

`activateWave` scopes producer withdrawal to the selected collections plus explicit `replaceCollections`. Reference `prepare` explicitly replaces the no-collection legacy Brendan variants. It preserves independently queued authored collections and all user decisions. This prevents rerunning reference preparation from silently hiding a newly authored character.

New evidence: `verify-shots/pokemon-character-casting-naru/SUMMARY.md`. Native/GIF/clone checks passed; 19 focused browser and collection-preservation checks passed. No user votes were added by QA. Naru remains pending; the pre-existing user Allow remains recorded. Source creation and structural checks do not approve the art or apply it to the canonical game.

## Template edits (current strategy, user-directed 2026-10-05)

Use an existing character matching the role/body as a template; preserve working gait and proportions while editing head, clothing and accessories. Select different templates when roles need different body types. The user explicitly requested this strategy after the independently authored Naru candidate. Original-derived pixels must be described as such.

Example `harness-data/pokemon-character-casting/templates/naru-camper-v2/`: Camper-based Naru v2, candidate `explorer-2fe0ce80a94b963f`. Original template, edited atlas, change mask, recipe and explicit edit spec are preserved. `render-template.py --spec <template.json> --candidate <candidate.json> --out <folder>` reconstructs the derivative; `queue --bundle <folder>` uses the existing native import/check/preview and human approval workflow. The renderer reuses the pixel encoder, then writes the actual template-derived provenance. Its generated grid is a mechanical intermediate, not independently authored full rows.

`template.py` pins the reference PNG SHA, maps original frames, applies the authored palette/row edits, preserves bottom four rows' index geometry, requires head and clothing edits in all twelve poses and exactly reproduces the final atlas. These checks are provenance/contract rules, not artistic quality measurements. Current example retains the source's lower-leg/feet indices; colors can change with the palette.

Diversity policy v2 permits a shared template only when both lineages are verified against the same pinned reference and at least one is a replayed derivative. The pair emits a shared-body warning. Identical final images remain blocked, as do undeclared recolor/head-only clones. Shared-source claims with wrong hashes, changed output pixels or no authored edits fail. Similarity is diagnostic; a properly declared shared body is intentional under the user's revised direction.

Template packages additionally hash `template.png` and `changes.png`; `verify_bundle.py` checks both against replay. Candidate metadata must agree with the verified template id. Server exposes only the named files; approved downloads include the two comparison images. Existing packages without a template declaration remain readable. Native gates and current human Allow requirements are unchanged.

The review page shows original/modified/change-mask triptychs, labels provenance, and asks whether the head/clothes/accessories were changed as intended. It no longer requires every derivative to have a different body silhouette. Mobile uses integer1× and desktop integer3× comparison atlases. Candidates still use the same persistent Allow/Deny store.

Evidence: `verify-shots/pokemon-character-casting-template/SUMMARY.md`. Focused `verify-template.py` exercises replay/tamper/clone controls on temporary copies. Browser evidence covers direct selection, comparison media, all four phases, mobile and pending download rejection. Naru v2 is pending; existing decisions and Naru v1 remain preserved.

## Complete sixteen-role template collection (2026-10-05)

Current review: `http://mdc-server:18316/?wave=full-cast-v1`. Fifteen new derivatives plus existing Naru v2 cover all16 seed roles /192 walking poses. Each role uses a different original walking template. Full role/name/template/id table and design notes live in `harness-data/pokemon-character-casting/templates/full-cast-v1/README.md`. These are original-game derivatives with explicit part/palette changes, not independent drawings. Original nurse lacks a full walking sheet; the nurse derivative uses `woman_3` body/gait with a nursing cap and uniform.

Registered command: `npm run harness -- pokemon-character-casting prepare-cast`. `author-cast-wave.py` stores author-chosen literal pixel substring replacements and palettes; it expands only those changes at the original pose coordinates into replayable full rows. Right views follow the original left/right reflection contract. Feet/leg geometry remains protected and the existing native checks are unchanged. `prepare-cast.mjs` renders, queues all15 new bundles plus the saved Naru v2 bundle, validates all16 roles/packages, then atomically publishes `data/waves/full-cast-v1.json`. Same-input reruns preserve IDs and all human decisions; failures do not publish an incomplete wave.

`GET /api/waves` reads named collection manifests. The review page's 묶음 selector filters overview, choices, role options and counts. Wave IDs and selected candidates survive reload in query parameters. All older candidates remain accessible in 모든 후보. Each candidate's actual current Allow is still authoritative; a wave is only a review grouping and grants no permission.

Role IDs can contain underscores (`gym_leader`, `company_agent`, `moon_leader`). `safeId` and media/download routes consistently allow `[a-z0-9_-]`; path separators/encoded traversal are rejected. This fixes a previously unexercised mismatch where queue accepted these roles but package lookup failed.

Evidence: `verify-shots/pokemon-character-casting-full-cast/SUMMARY.md`:16 native/media passes,120 pairwise comparisons,81 browser/persistence checks, decoded GIF sheets for every role/direction, live desktop/mobile screenshots and same-ID prepare rerun. No human votes were added; existing review history is preserved. Actual game application still requires the selected candidate's live Allow and the canonical save/reload procedure. Battle portraits are outside this walking collection.
