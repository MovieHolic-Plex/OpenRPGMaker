# events

Three findings at `d7a3f0136e`. All confidence: **code hypothesis**; no timings measured.

1. **Opening or switching pages eagerly builds hidden command trees.**
   - Trigger: open a long event in List view, or switch its page.
   - Sites: [content.ts:197](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:197), [content.ts:275](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:275), [content.ts:306](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/content.ts:306).
   - Synchronous work: recursively builds all N list rows and all N storyboard cards. List mode then empties the storyboard; Story mode builds it again: **two full tree builds in List, three in Story**.
   - Safeguards: stable header/catalog survives refresh; unrelated editor-state changes are filtered. Hidden views still incur construction.
   - Narrow remedy: create only the active command surface; populate other views when selected.
   - Supervisor scenario: open pages containing 100/1,000/5,000 text commands in List and Story; record allocation and scripting stacks through first paint.

2. **One command reorder copies the page and containing map.**
   - Trigger: drag a command one position, or click its move arrow.
   - Sites: [commandToolbarHistory.ts:130](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandToolbarHistory.ts:130), [eventPages.ts:453](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/eventPages.ts:453), [projectClone.ts:240](/home/main/.codex/worktrees/e85c/rpg-zzu/src/project/projectClone.ts:240).
   - Synchronous work: deep-clones the complete page history snapshot; the map getter deep-clones the entire containing map, including tile layers and other events; history then JSON-stringifies both page versions at line 141. Cost scales with **page bytes + map bytes**, before the modal’s full body refresh.
   - Safeguards: current copy-on-write shares untouched maps, tilesets and uploaded assets; history caps at 50 entries. Copy granularity remains one whole map.
   - Narrow remedy: introduce an event-scoped mutation path sharing tile layers and unaffected events.
   - Supervisor scenario: keep the same 1,000-command event on 100×100 and 512×512 maps; move the middle row down once and compare clone allocations/stacks.

3. **Typing one choice label deep-clones all its branch commands per keystroke.**
   - Trigger: double-click a Choices command and type into an option label.
   - Sites: [commandBodyChoices.ts:112](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandBodyChoices.ts:112), [commandEditDialog.ts:94](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/eventEditor/commandEditDialog.ts:94).
   - Synchronous work: every input replaces the staged root using `structuredClone(command)`, copying all B descendant commands despite changing only a label: **O(branch bytes) per character**, followed by preview reconstruction.
   - Safeguards: unchanged option count/cancel policy avoids form reconstruction and preserves focus; the dialog isolates edits until confirmation.
   - Narrow remedy: retain isolated staged branch references for label-only updates; deep-clone at dialog entry and final apply.
   - Supervisor scenario: use two choices with 10/1,000/5,000 total branch commands; type ten characters into `event-choice-option-1`, recording input-handler allocations while confirming focus and Cancel preservation.
