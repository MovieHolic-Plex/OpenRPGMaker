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

## Current first wave

Seed: `harness-data/pokemon-character-casting/seed.json`. Three roles × two variants: rival, explorer, ranger. Other roles can be added to the seed or imported as external bundles. These are **original Brendan-derived walking bodies/gaits with explicitly authored head-row and palette edits**, not wholly new independent artwork. Original Nintendo/Game Freak/Creatures artwork and pret/pokeemerald source SHA are preserved in each recipe. No shrinking/quantization/generated geometry. Hair, cap and brim heads have explicit native rows; source bob/right-facing flip are retained. The 95% original-Brendan fidelity claim from the hero task does not apply to these changed characters.

Source body reference is pinned16×32/9frames. Output48×128, up/right/down/left × stepA/idle/stepB. GIF68×32 is source-exact [0,1,2,1],130ms, infinite loop, explicit indexed palette. Source/implementation hashes and full changed head rows/palette are in recipe.json. The mockup compares the new character below the unchanged Brendan on an existing runtime screenshot, at integer display scale; it is not actual NPC runtime QA.

External `queue --bundle <folder>` accepts candidate.json(role,label,variant,description,sourceNote), native charset.png, source-exact walk.gif,480×360 context.png,origin.txt,recipe.json. It copies inputs, native-imports, checks and previews them before storing a package. Contract failures are rejected rather than silently repaired. Same content/provenance/native implementation requeues the same candidate; changed inputs produce a new pending candidate.

## Human review

- Role/state filters and individual candidate selection.
- Native1× and integer4× real GIF playback; pause/resume and four-frame stepping; native12pose atlas; map placement mockup; original Brendan GIF comparison.
- Allow requires explicit observations of directions,gait,pose identity and map scale/role. Structural success alone is never aesthetic approval.
- Deny requires a correction note. Its text persists for the next revision. Deny of an approved candidate revokes build/download permission.
- One current Allow per role: allowing another variant supersedes the previous selection. Earlier decisions remain in history.
- User decisions are anonymous browser operator records, not authenticated human identity proofs. Same-origin JSON POST plus session cookie/CSRF are required. Native review evidence hashes bind the receipt to the current native package; none of this proves artistic truth.

The page says Allow approves a candidate; canonical game application is a separate operation. Successful downloads contain native48×128, editor72×128 padding-only adapter, GIF, source recipe/origin, native gates and human-approval.json with cast slot coordinates. GET/download rechecks the live Allow; old ZIP files are not ongoing permission to apply a denied/superseded candidate.

## Freshness and shipping gate

Package checksum binds source PNG/GIF,context,origin,recipe, native source/final/provenance/prompt/preview and native implementation. Different pixels/GIF/frame order/provenance/implementation cannot retain the old approval. Each build also reruns native gate/build and rechecks the live decision. Approved native review evidence must contain the current receipt hash.

`register-pokemon-character-motion.mjs` grandfather-matches currently published role source hashes. Any newly introduced/changed field walking source requires `selection.humanReview.dataDir` and that role/source's **live current Allow** from this store. It checks again before shared writes. A changed approved role uses its package provenance instead of incorrectly comparing it to the old baseline Python role SHA; all unchanged roles and portraits keep their previous source-hash checks. Native source/output equality, exact editor padding and the hero's separate quality/fidelity gate remain required. Human selections appear in the generated role ledger. User review of walking never silently approves battle portraits.

To register a selected role, copy the previous full selection, replace `walk[role]` with the nativeCandidate in its current human-approval receipt, and set humanReview.dataDir. Build all35 current native candidates as usual. Canonical save/fresh reload and actual standalone runtime QA are still required **after** the user chooses. This task intentionally leaves the game untouched while all six candidates await choices.

## Focused verification

`node src/harnesses/pokemon-character-casting/node/verify.mjs --out /absolute/evidence` exercises the actual review UI and local output on a disposable **copied** store. Synthetic browser Allow/Deny are never production votes. Production checks are view-only, assert zero real decisions, and prove registrar rejection does not alter shared output. Uses no Vitest/full gates/typecheck/stash. Inspect SUMMARY first.

Evidence: `verify-shots/pokemon-character-casting/`. Full local screenshots/source QA: `/home/main/z-project/pokemon-character-casting-evidence/`. Initial canonical AI conversation table was checked read-only and contained0rows; this chat's user instructions establish the requested workflow. No access credentials are stored in harness evidence.
