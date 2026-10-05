# Pokémon character casting — browser Allow / Deny

User-requested reusable human selection harness. `src/harnesses/pokemon-character-casting/` owns the producer, review server, SQLite decisions, live approval checks and approved output. It uses the existing `pokemon-character-motion` native import/check/preview/review/gate/build without changing its implementation hashes. Genre: monster-collect. CLI and standalone review page exist; editor workshop integration/assistant tools do not yet exist and are honestly false in the manifest.

## Start and reuse

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

`author.py` uses distinct native source cells with index0transparency and source right-facing flips. Output48×128, up/right/down/left × stepA/idle/stepB. GIF68×32 source-exact[0,1,2,1],130ms,infinite loop,explicit indexed palette. It runs the whole-wave diversity check before producing a queue list. `prepare` queues all current candidates and only after success activates this wave while withdrawing prior candidates. Same content requeues the same immutable candidate. The rejected first-wave seed/art/script is retained as history, not the current producer.

`diversity.py` rejects nearly identical full silhouettes or body/leg silhouettes (IoU≥.985), and exact pixel-region partitions after replacing colors by encountered-color labels. Native body band is localy22..31, over all12poses. Jointly transparent background is excluded from IoU. This detects a shared body despite changed hair and recolored outfits. Thresholds are a clone-control policy, **not an artistic quality score**. Pairwise silhouette diagnostics do not prove different age,gender,anatomy or role. Negative controls cover recoloring and head-only changes. The six-source wave has15pair comparisons; highest body IoU .936, highest full IoU .901. User confirmation remains required.

`queue` compares a new candidate to all current non-withdrawn candidates, even if it gives itself another collection name. Renaming the role/candidate/collection cannot bypass this duplicate-body check. Exact requeue is idempotent. To publish a future intentional revision with a similar body, withdraw/replace its previous lineage rather than inventing collection names; same-uniform clone exceptions need an explicit change in the user-approved art requirement, not an agent override.

The page shows six full-color/down-idle views alongside black silhouette canvases and lets the user open each real GIF and all12poses. Distinct-body Allow additionally requires “색을 빼도 … 구분된다”; all five observation checks are mandatory on the server. The overview and mockup are visual comparisons, not actual NPC runtime play proof.

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
