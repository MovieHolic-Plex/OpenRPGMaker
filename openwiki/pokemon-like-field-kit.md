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

No candidate from this pass has been approved or installed into the game. After
actual human choices, an external adapter must preserve native sprite geometry,
bind the approved menu/audio settings through the host service, fresh-load the
saved project and verify the exported player. A JSON preview or this harness's
Allow record alone is not canonical integration evidence.
