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

`webExportAssets.collectProjectStrings` retains these implicit trainer resources
when the Emerald project uses the shared charset. Export pruning must not remove
them just because their IDs are calculated from the event graphic at runtime.

`configureEmeraldMonsterCast` refreshes stock and owned shared IDs while preserving
custom graphics, event coordinates, commands, movement, collision and session.
Route signs created by the old NPC helper become objects. First-town ambient people
use village roles. Professor opening art shares the generated professor identity.
Raw source/prompt records are in `assets/emerald-monster-v2/`.

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
