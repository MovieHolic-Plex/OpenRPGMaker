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
