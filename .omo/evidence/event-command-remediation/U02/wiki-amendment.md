# Exact amendment for lead: openwiki/editor-event-command-fixes.md

Replace this existing bullet:

> - `shouldRerenderCommandForm` rebuilds the edit dialog for fork condition kind / else presence / branch lengths and loop body length.

With:

> - `shouldRerenderCommandForm` rebuilds fork forms when else presence or branch lengths change. Condition editors own kind/query changes and their local inactive drafts; loop editors own their child-list structure. Ordinary edits do not remount these forms.

Append the following section:

## Nested command drafts and branch identity (2026-09-06, U02)

- Loop edits patch the current staged body, preserving unrelated children and text speaker/emotion/autoAdvance. Every child can open the full command editor; child Cancel and parent Cancel leave their respective source unchanged. Break detection traverses the current loop's branches but stops at nested loops, whose breaks cannot exit their parent.
- Condition target changes retain the current comparison/value/present controls, including nested all/any/not rows. Mode drafts belong to the mounted condition editor, not a module-global cache. Fork evaluation updates from the latest condition without remounting the leaf controls.
- Deleting a choice before the cancel destination adjusts its stored one-based index so cancellation still reaches the same branch. Nonempty branch deletion asks for consent; empty branch deletion does not. Deleting the cancel destination first requires the author to select another cancel policy. Add/delete restores adjacent text-field focus; inactive cancel-branch bytes remain intact.
- Timer start without seconds means resume. The start-mode control distinguishes resume from restart, keeps an inactive seconds draft while editing, and omits seconds when resume is confirmed. Stop hides/disables seconds without deleting an existing inactive value. Explicit restart values 0 and 60 retain their meanings.
- Input Number never chooses a variable while rendering. Its scoped `event-command-validate` hook blocks Confirm for empty/missing destinations and focuses the picker. This hook supplements, rather than replaces, the weighted-branch guard. An empty destination is a valid unsaved factory draft, not an importable saved reference.
- Regression coverage: `test/eventCommandRemediation/U02.test.ts`, `test/e2e/event-command-remediation-U02.spec.ts`, and `scripts/qa/runtime/event-command-remediation-u02.scenario.mjs`. Evidence: `.omo/evidence/event-command-remediation/U02/manifest.json`. Editor proof uses real map Confirm/Apply, reopen, Cancel and file import; player proof uses dedicated `player.html`, never editor play. The player recipe appends explicit QA setup/termination commands while retaining the editor-confirmed command payloads and nested children.
