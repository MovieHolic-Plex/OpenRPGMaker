# dom-global

One convincing candidate remains at `d7a3f0136e`; confidence: **code hypothesis**, not measured lag.

- **Trigger:** Press Tab/Shift+Tab in a long event editor page, including Story view or a filtered command list.
- **Current path:** [modal.ts:972](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/modal.ts:972) queries every focusable descendant, then reads each candidate’s `offsetParent` at line 976.
- **Producer → style → layout:** [content.ts:298](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:298) hides the retained command list; [content.ts:558](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:558) hides filtered rows. The next Tab scan still visits their controls and performs layout-sensitive reads.
- **Scale:** Each ordinary command contributes one focusable head and three action buttons: [commandList.ts:143](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandList.ts:143), [commandList.ts:540](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandList.ts:540). Thus approximately **4C candidates**, plus other controls, on every Tab—even when the list is hidden. The first geometry read can flush pending document style/layout; this does **not** imply 4C separate reflows.
- **Safeguards:** Only the top modal participates; invisible controls are excluded after measurement; the listener is removed on teardown. These prevent incorrect trapping and listener accumulation, but not repeated enumeration.
- **Narrow remedy:** Cache tabbable boundaries, invalidate on structural/visibility changes, and let native Tab handle interior navigation. Reject explicitly hidden ancestors before geometry checks during boundary refresh.
- **Supervisor scenario:** In a supervisor-owned fixture with 1,000 ordinary commands, open the native event editor; measure 20 Tabs in List view, then Story view, then with a zero-match search. Record candidate counts, `offsetParent` reads, key-handler duration, and attributable style/layout trace events.

No additional strong whole-document chain established: parked-database containment is already present; tooltip detachment callbacks only check connectivity; i18n processes changed subtrees; toolbar overflow is restricted to the single-button play-mode row. No files changed or runtime measurements performed.
