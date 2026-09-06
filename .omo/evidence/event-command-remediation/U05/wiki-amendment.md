## U05 — actor commands and operand drafts (verified)

Resolve G2-F1, G2-F4, G2-F6, G2-F7 and G2-F8 in commits `8f9f6c222f7ecdbfcf1a3366d33be54ece867670` then `b5521e4d73ce17b8adc971c90096217419c2c403`.

- 092 stores an actual actor ID or explicit party; a narrowly scoped reader accepts old actor+actorId data, without creating an `actor` runtime key or treating incomplete old individuals as party.
- EXP keeps VariableOperand, actor/op and mounted inactive numeric/variable drafts. Same-kind EXP edits no longer remount the form. Real inline variable creation reads the current store for validation/preview and refreshes the selected label, preserving numeric31 and the same controls through Confirm and map Apply.
- 014/021 honor explicit numeric source despite a retained inactive variable ID; reopen/edit and damage presets remain consistent.
- State editing preserves missing IDs and set/toggle, never invents the first chip, and rejects unresolved Confirm even with an empty state catalog.
- Five identity forms, EXP and learnSkill distinguish explicit whole-party support from an incomplete individual selection. Invalid individual edits cannot Confirm or silently persist party from inline editing. Intentional legacy empty-party runtime behavior remains supported.

Evidence: original56 cases (47 RED,9 controls) retained with source/hash provenance; main narrow/adjacent command121/121; follow-up focused command97/97 including all59 current U05 cases. All five real Firefox editor cases passed together, covering map/common/troop Confirm, outer Apply/Save, actual wire-file import and map inline clearing. Seven dedicated player scenarios passed for authored/edge/legacy values and canonical/legacy/party/incomplete battle menus, including untargeted actor checks. The additional real inline-variable browser case passed after the follow-up fix. No claim of a combined122-case unit run or six-case browser batch.

The stale CLI input was actually consumed, not auxiliary: both raw and normalized hashes differed only at commonEvents[0].trigger. It was regenerated and both affected acceptance runs repeated against the current fixture/export; subsequent inline-only work did not repeat unaffected proofs. Current player source/export hash: `170a17d661f8f51bb8f69269db0a34cf1284d19bb1b1d303e86eccb8fdd559dd`.

Scoped compiler checks report zero diagnostics across11 TS files; LSP/syntax/diff checks are clean. Accepted runs have zero guarded DB writes, no page errors, released observations and closed owned server/browser contexts. Original RED, fixture/driver failures, source/tree IDs, scenario PASS criteria and cleanup are retained under `.omo/evidence/event-command-remediation/U05/manifest.md` and `manifest.json`.

Integration: U05 precedes U06. `commandBodyAdvanced.ts` changes are limited to the validity import and learnSkillBody; follower functions remain untouched. Shared wiki/Design/snapshots were not edited by this worker. No full suite/build/final gates were run; lead retains final integration verification ownership.
