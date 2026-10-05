# Pokémon-like field kit — review before game integration

The 2026-10-05 scope is field monster graphics, UI and music. Human NPC production,
battle-art replacement and campaign/story expansion are outside this pass.

`harness/pokemon-like-field-kit/` is a standalone Node24/Python/Pillow folder. Its
operational copy is `/home/main/z-project/harness/pokemon-like-field-kit`, review
server18327. The existing human character harness/server18326 and its approvals
remain separate. This folder does not depend on editor APIs or a project DB.

## Current candidate

- Snow cat (`mx_species_flurrykit`): native32×32 Poochyena overworld body/gait,
  explicitly edited head/ears/muzzle/fur. Original source SHA/attribution retained.
  Four directions ×3 poses. Source lower-leg indices protected. No shrinking a
  battle front or using the human16×32 checker. Atlas96×128, anchor16/32.
- UI: integer-scaled240×160 field/menu/party/bag/shop design preview. HP/item/money
  are local demo state; the preview does **not** save or run the canonical game.
- Music: original16bar D-major town88BPM and route124BPM arrangements, plus three
  short original menu cues. The old town cue is available for A/B. Symbolic source
  and actual WAV measurements are stored. The model has not auditioned the audio.

## Ownership and validation

`render.py` + `recipes/` own art; `compose.mjs` owns notes; the local
`lib/musicScore.ts` is a portable snapshot of the engine renderer. `site/` owns the
review prototype. `server.mjs` persists append-only human receipts in `.data`.
`package.mjs` hashes source and bytes, refuses changed bundles and exports only
when all current category packages have human Allow. Changing a package invalidates
its earlier decisions. Agents may never create production approval receipts.

The focused browser script records native GIF loading, keyboard navigation,
demo purchase/healing, audio-context playback, menu transitions without a BGM
restart, pause/resume, A/B selection, mobile overflow and absence of production
votes. Synthetic Allow/Deny checks use a **separate temporary folder/server**.
See harness `evidence/` and README. These are candidate-tool checks, not game QA.

## Canonical boundary

Canonical project `fca4b134-ed34-4365-9021-450c7ee24894` was freshly read from the
official9888 host at revision34/SHA
`a8c2b6b63aca60c3d4135c732a8a4af61bfdc880c6648c0c93e1c345519602d0`.
This host currently opens the canonical project directory directly, so its identity
uses `bridgeProject: ""` rather than nesting the old hostProject selector again.
AI conversation table had0rows. Read evidence is private under
`~/.local/share/oprn/monster-expedition-evidence/field-ui-music-20261005/`.

## Approved integration (2026-10-05)

All three current package hashes received real `human-browser` Allow decisions on
18327 (monster07:57:45Z, UI07:57:47Z, music07:57:49Z). Approved source files and
receipts remain immutable. `scripts/content/prepare-approved-field-kit.mjs` checks
them and prepares a detached patch; `monster-expedition-store.mjs save` owns the
backup, compare-and-swap save and fresh host reload. Review-tool votes are never
fabricated by the adoption script.

- `pack-reviewed-field-monster.py` checks that each native32×32 frame has four
  transparent columns on each side, packs the unchanged24×32 ink into slot0 of the
  engine288×256 sheet and reorders directions. Reconstructing all12native frames
  must reproduce every RGBA byte. No resampling, palette changes or redrawing.
- `mx_field_flurrykit_approved_v1` uses manual scale1 and150ms walk poses. The
  species `mx_species_flurrykit.graphic.fieldGraphic` also uses it for followers.
- Two same-priority, solid roaming events live at home11,10 and frost6,9. Every
  route edge is checked against actual map passability and existing NPC routes.
- Approved town/route scores replace60authored references; three cues bind native
  title/menu sounds. The existing Emerald UI controllers retain party, medicine,
  shop transactions and save behavior; their surfaces use the approved palette.
- Canonical session, hero start and opening remain unchanged. Export keeps the
  original `starlight-islands-v1` save namespace.

`field-kit-native.probe.mjs` checks the built exported player using a genuine
predecessor save in a private browser: preserved party/inventory/money, visible
walk frames, solid collision, dialogue, native healing, menu audio continuity,
real shop purchase and slot save/load. Temporary HP damage and a paused NPC are
explicit QA setup. This is separate from the prototype review evidence.

Integration evidence: `verify-shots/field-kit-adoption-20261005/`. Full canonical
snapshots, asset bytes and official receipts stay in the private evidence folder
`~/.local/share/oprn/monster-expedition-evidence/field-kit-adoption-20261005/`.

Canonical adoption completed at revision35, SHA
`85fb2d5b0bde403c319e13d972e6268dc11e8786e3026decf90a0c89fc34b418`.
The first save completed but its final media read lost a transport socket; no
second save was attempted. A fresh read plus `verify-approved-field-kit.mjs`
confirmed the full normalized document and all6media byte hashes. That recovery
script performs reads only. The exported live entry remains
`http://mdc-server:18301/monster-expedition/player.html`.
