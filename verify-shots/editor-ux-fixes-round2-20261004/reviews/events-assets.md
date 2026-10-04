# Independent correctness review

Reviewed event UX `1039a2d36e` and assets `9a393650ec` / `997605b28e`, including surrounding callers. Static, read-only review; no source edits, tests, gates, typecheck, browser, server, or stash operations.

## Findings

### [P2] Audio windowing removes the focused row during keyboard traversal

**Commit:** `997605b28e`  
**Changed location:** `src/editor/panels/audioDescriptionEditor.ts:53–54`  
**Supporting code:** `src/editor/panels/databaseListVirtualizer.ts:147–162`

The newly adopted virtualizer reconstructs every rendered button with `rowsHost.replaceChildren(...rendered)` whenever its window changes. It neither preserves the focused button nor restores focus by resource ID, and the audio editor supplies no keyboard navigation or focus recovery.

**Trigger:** Open Music or Sound with more than 80 resources. Tab through the audio rows until native focus scrolling changes the window, or focus an audio row and scroll enough to change the window. Even if that resource remains within the new window, its original focused button is removed. Focus falls out of the audio rows, so subsequent Tab/Enter no longer continues browsing from that resource. Previously, scrolling retained the fully mounted audio buttons.

Preserve row identity for retained resources and preserve/recover keyboard focus when advancing the window.

### [P2] Closing a resource manager leaves its virtualizer observer attached

**Commit:** `997605b28e`  
**Changed location:** `src/editor/panels/audioDescriptionEditor.ts:252–256`  
**Supporting code:** `src/editor/panels/databaseListVirtualizer.ts:169–187`; `src/editor/panels/resourceManager.ts:79–86,126`

`createVirtualList` creates an internal `ResizeObserver`, observes the audio rows container, and exposes no disposal method. `AudioDescriptionEditor.dispose()` disconnects only its separate `this.resize` observer; `virtualRows.setItems([])` merely clears the data and renders. The virtualizer observer continues observing the detached container, with its callback retaining the virtualizer, its `renderRow` closure, and the disposed editor/container graph.

**Trigger:** Repeatedly open and close the resource manager. Every opening constructs an audio editor, including openings on image categories, and adds another internal observer that close cannot disconnect. This introduces accumulating preview/list ownership after modal teardown.

Give the virtualizer an explicit disposal operation that disconnects its observer and removes its scroll listener, and call it from the audio editor's disposal path.

## Remaining scope

No additional concrete commit-introduced regression established in the event selection/move/undo/IME/focus/stale DOM paths or the database preview/audio lifecycle paths reviewed. The findings above are source-based; no runtime reproduction was performed.
