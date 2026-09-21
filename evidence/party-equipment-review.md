# Party inventory and equipment review

**Independent gate review: APPROVE.** The reviewer retracted its initial
slot-transition finding after tracing the exact callback chain. No production
change was needed: the catalog already rerenders synchronously and restores
focus. Additional tests confirmed both slot-transition directions.

## Outcome

Database > Party has one **아이템·장비** catalog. Items and equipment keep their
existing storage collections and IDs, but share search, kind/subtype filters,
selection, counts and list/gallery presentation. Creation explicitly chooses
item or equipment. Existing detail forms, AI item generation, duplication and
reference-protected deletion remain available.

Projects can add real equipment slots, rename their labels, and remove unused
custom slots. The catalog is used by initial equipment, event commands, runtime
menus, equipment transitions, derived stats and save validation. Built-in hand
IDs retain two-handed/dual-wield semantics; a custom slot is not an accessory alias.

## Adversarial findings and fixes

| Finding | Correction | Evidence |
|---|---|---|
| Separate item/equipment screens fragmented search and creation. | One catalog with explicit record kinds and shared filtering. | `test/databaseInventoryCatalog.test.ts` |
| Five hard-coded slots silently discarded custom equipment during runtime projection. | Project-authored catalog and catalog-aware persistence/runtime consumers. | `test/customEquipmentSlots.test.ts`; shipping-player scenario |
| Slot add/rename/remove bypassed undo history. | One project snapshot per catalog operation, including add-and-select. | `test/equipmentSlotHistory.test.ts`: all three operations failed before the fix and passed after it |
| Expanding slot management consumed 424px of the fixed header. | Native slot select in the header; management in the scrolling body. | Browser measurements: header 129px at 1024/1280/1440 widths |
| A deferred database refresh closed management immediately after opening it. | Synchronous view-session ownership of the disclosure state. | Failing-then-passing refresh test in `databaseInventoryCatalog.test.ts`; production browser reproduction |
| Cross-collection IDs and delete confirmation could target the wrong selection. | Collection-aware selection and fresh confirmation after selection changes. | Catalog selection/deletion tests |
| Cold modal opening lost a requested equipment target. | Preserve the requested record across modal-session reset. | Catalog cold-modal test |
| Copy referred to a retired Equipment tab. | Instructions name the actual `+ 장비` creation action. | `databaseItemRecordView.ts` |

## Direct verification

- **80 tests passed**:
  `npm test -- test/databaseInventoryCatalog.test.ts test/equipmentSlotHistory.test.ts test/customEquipmentSlots.test.ts test/databaseRecordPartialRender.test.ts test/itemEquipmentAuthoringTrust.test.ts test/databaseAiBar.test.ts test/databaseEquipmentInspector.test.ts --maxWorkers=1`.
- A separate seven-file equipment-domain run passed **61 tests**, including
  equipment transitions, command authoring, catalog runtime axes and save loading.
- The final catalog-specific run passed **16 tests**, including the additional
  weapon-to-shield and shield-to-weapon control/focus regression.
- `npm run typecheck:app`, `npm run build:app`, and `npm run build:player` passed.
  Existing large-chunk build warnings were not suppressed.
- `git diff --check` and staged diff checks passed.
- The independent CSS gate passed: budget exit 0, graph exit 0, no CSS regression.
- Production editor harness passed with **312 initial records**, no page errors,
  and no horizontal overflow at 1024x768, 1280x800 and 1440x900. It exercised both
  detail kinds, shared search, keyboard filtering, hidden-selection reveal,
  list/gallery switching, both creation kinds, duplication, guarded deletion,
  custom slot creation/rename/reference protection, and opening the AI item dialog.
  It did not send a live AI-generation request.
- Shipping-player QA passed **six beats with no runtime errors**: title, custom
  initial slot, unequip choice, empty slot, inventory return and re-equip.
  This used the built player and export store shim, not editor play mode.

Reproduction: `scripts/qa/inventory-catalog.mjs` accepts `CATALOG_QA_URL` and
`PLAYWRIGHT_MODULE`. Runtime scenario:
`scripts/qa/runtime/custom-equipment-slots.scenario.mjs`.

Local browser artifacts are in `output/evidence/inventory-catalog/` (nine PNGs
and `measurements.json`). Runtime artifacts are in
`verify-shots/runtime-qa/custom-equipment-slots-production/` (`SUMMARY.md`,
`manifest.json`, and five PNGs). Generated screenshots and fixtures are not
committed. Geometry and interaction claims are browser-measured; unavailable
image-model inspection is not represented as a visual approval.

## Verification limits and existing failures

- Clean `32ef1bcd` baseline: **219 failed / 13,062 passed**, 111 failed test files;
  app typecheck and CSS passed, while the surface gate already failed.
- The integrated full `npm run gates -- --json` reached the 30-minute execution
  limit without producing a Vitest report. The shared 32-core host had load
  averages of 181-195. A full-suite pass or zero-new-failures claim is therefore
  **not established**.
- Existing sidebar test fixtures omit the promotion-tree and skill-tree entries
  already present in the baseline. Their failing assertions were not removed.
- The surface-only gate reported 6 failed / 107 passed. The affected form and
  interaction snapshots were then rerun after the narrow equipment-catalog
  expectation update: only the same four baseline kinds remained (`changeFace`,
  `giveMonster`, `evolveMonster`, `showPicture`), with no equipment-surface delta.
- The runtime development harness could not load its CSS module. The same runtime
  scenario passed against the built shipping player, with asset requests served
  from the local public assets.
- LSP availability varied during execution; application typechecking and builds
  were used as compiler evidence. No dependency was added merely to repair LSP.

## Code review checks

The implementation reuses the existing database mutators, detail forms, reference
guards and workspace primitives. Runtime slot semantics have one catalog authority;
validation remains at project/save boundaries. No dependency, fallback storage
layer, exception suppression, timeout sleep, or failure allowlist was added.
Behavioral tests cover stored values, transitions and real controls rather than
pinning explanatory copy. The two event-form snapshots update only the
`changeEquipment` option order and body-slot label to match the shared catalog;
unrelated baseline failures and all snapshot floors remain intact.

This is editor/engine work with QA-only fixtures. No authored game content or
remote LegacyDb project row was changed.
