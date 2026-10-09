# Emerald campaign art and presentation repair

The former coordinate-generated character pack is a schematic baseline, not visual approval.
Use actual image generation for new NPC/monster artwork and inspect the native pixels.

## Shared NPC pack

`public/assets/emerald-monster/cast/uploaded-cast.json` supplies two native 288×256
charsets (16 roles × 12 poses), a real signpost charset and 17 trainer pictures.
Roles in sheet order: hero/rival/professor/nurse/merchant/mother/resident/gym_leader;
company_agent/captain/worker/explorer/student/ranger/moon_leader/hiker.
Direction rows remain up/right/down/left. Every cell is 24×32, foot anchored at31.
Trainer pictures are64×96; hero_back is separately generated.

Resource dimensions are not walking-motion approval. The original pack crops and
centres each pose separately and extracts per-frame palettes. A character's12
frames need shared palette/anchors and an actual0/1/2/1 gait preview; equal bottom
bounds manufactured by packing cannot prove planted feet. See the dedicated
character-motion harness when correcting this pack.

`webExportAssets.collectProjectStrings` retains these implicit trainer resources
when the Emerald project uses the shared charset. Export pruning must not remove
them just because their IDs are calculated from the event graphic at runtime.

`configureEmeraldMonsterCast` refreshes stock and owned shared IDs while preserving
custom graphics, event coordinates, commands, movement, collision and session.
Route signs created by the old NPC helper become objects. First-town ambient people
use village roles. Professor opening art shares the generated professor identity.
Raw source/prompt records are in `assets/emerald-monster-v2/`.

Confirm-page professor gestures now have an optional authored horizontal strip
in `oprnOpeningBook.portraitMotion`, with stationary native canvas, per-page frame
orders and one persistent active-time clock. Contract/tool/fallback/verification
are in [opening-animatic-authoring.md](opening-animatic-authoring.md). This code
capability does not mean a new pose strip has been generated or applied.

Packing uses `scripts/content/emerald-art-v2-pack.mjs <harness-repo> <manifest> <out>`.
It imports the existing monster harness pixel pipeline: a reviewed fixed8px block
for walking sheets, transparent-alpha masking, palette extraction and native fitting.
It draws no new artwork. `emerald-art-v2-register-npc.mjs` updates the shared pack only.
Current harness source is in the newer monster-opening-host integration checkout.

## Monster candidates

All60 existing species retain IDs, stats, EXP curve, skills, PP, evolutions and habitats.
New front/back pairs are candidates until a human chooses them. Register generated
raw cells via the integration's `monster-collect-species import` in an isolated
`MONSTER_HARNESS_SANDBOX`; do not overwrite the pre-existing starter seed/ledger.
Do not call `pick` or silently install candidates as approved production sprites.
After the user chooses, adopt the selected fronts/backs and derived icons into the
shared campaign pack and canonical project, then reload and inspect gameplay.

### Candidate revision requested by the user

The user rejected immediate adoption and answered `후보 그림부터 더 수정`.
Revision2 is the rejected comparison baseline; revision3 is intermediate; current
revision4 remains `pending-human`. No species-harness pick/build or production
monster write has occurred. See `assets/emerald-monster-v2/CANDIDATES.md`.

Seven families (lynx, heron, rare-a, mantis, crab, gecko, bird),21 species, were
regenerated/refined with built-in imagegen. Exact generation/edit prompts and
workspace source paths are in `monster-revision3-generation.json` and
`monster-revision4-generation.json`; raw prior variants are retained.
All60 front/back pairs were re-extracted, including the39 unchanged designs.

`emerald-art-v3-pairs.mjs` uses the existing harness pixel functions. It locates
transparent row and per-row column gutters before extraction, uses one reviewed
grid scale for all six family cells, fits front/back with one shared factor,
and caps native ink at40/52/64 according to stage and palette at16 colors.
It draws no artwork. A fixed sheet midpoint clipped the Stormskink front tail
and imported its fragment into the back. The final original row gutter is at533
of1024 after imagegen cleanup; the back now has one connected ink component.
No clear inter-sprite gutter is an error, rather than silently clipping.

`emerald-art-v3-import.mjs` bundles and invokes the actual integration CLI `run`
handler with `import --block 8` in a fresh sandbox. The CLI's second palette/orphan
cleanup is authoritative:65 final candidates differ from the pre-import drafts.
Review images must be those final candidate PNGs. CLI candidate `sha256` hashes
the raw input, whereas candidate-pack index `sha256` hashes the final sprite;
`rawSha256` records the former separately.

Current sandbox: `/home/main/z-project/emerald-art-v4-final-review-20261004`.
`candidates-v4/index.json` and `pair-provenance.json` record final bytes, bounds,
palette, source/crop/grid and warnings.120 images, no structural errors,140
automatic warnings; body-area square-root back/front ratio0.889..1.044. Warnings
are visible per selected species in the review; passing dimensions/color counts
does not establish visual quality. Human review is still required.

The newer integration's shared `grid.ts` ignores hidden corner RGB only when
corner samples establish a transparent background; opaque background flood
cleanup remains active. `import --block` validates2..40 and records the value.
Integration commit121f147770 contains this fix and a focused executable verifier.
The connected-white fixture previously lost1216 foreground pixels; the actual
Glaciermane source lost0. Do not attribute its previous grid damage to that
separate fixture bug. See the alpha-grid evidence summary.

## Opening and victory

Title effects use the actual shared key-art coordinates. Intro atmosphere/professor
motion is persistent across Enter-confirm pages; SFX has disposal and SE volume.
Victory is a compact bottom window with native4px actual EXP gauge, staged rewards,
and result-only actor-image offset so monsters remain visible. Read-only monster
instance EXP in the battle snapshot drives progress; reward/write-back logic is unchanged.
Trainer intro uses matching generated front/back human art only for the initial
challenge message. Send-out returns to the actual monster roster.

Canonical content must be saved through the host API with CAS, freshly reloaded,
and new media compared byte-for-byte before reporting the live game updated.

## 2026-10-04 delivery evidence

Canonical campaign `fca4b134-ed34-4365-9021-450c7ee24894`, host folder
`649482df-81ca-4af9-806b-2613f7d7bebb`, revision27 was freshly reloaded;
22 media byte hashes match. Only the NPC/professor/title changes were adopted.
All60 monster pairs remain pending human selection, isolated from the default
starter seed and production ledger. Do not interpret candidate creation as approval.

`verify-shots/emerald-art-v2-20261004/SUMMARY.md` describes actual compiled-player
opening, trainer intro and EXP QA including explicit battle preparations. Genuine
Continue slot preservation was separately checked. Public-player opening was also
run directly by the supervising agent, with8 pages, home10,10 and zero errors.
The corrected native probe waits for the authored title sequence to finish before
sending its menu Enter. Old immediate Enter was consumed during `seq-state=playing`.

Public game uses artifact `1b3950dca5dc3ca3`; report `/emerald-art-v2-report.html`.
Shared cast `SOURCES.md`/`catalog.json` describe and hash the registered generated
bytes, rather than the superseded coordinate placeholder files. Original trainer-a
generation and the transparency cleanup have separate provenance. No full test
suite or gates were run in this session.
