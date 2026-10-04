# assets

Three current-path findings at `d7a3f0136e`. All are **code hypotheses**; no latency measurements claimed.

1. **Image gallery rebuilds every matching thumbnail on selection and typing.**
   - Trigger: 소재 → 칩셋/얼굴 그래픽, select cards or edit search.
   - Path: [resourceManagerViews.ts:382](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:382), [thumbnail creation:632](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:632).
   - Heavy work: synchronous filtering and complete DOM replacement, O(catalog + matches), with N new eager images using full asset URLs. Loading/decode is asynchronous; repeated decode is **not proven**.
   - Safeguards: alias deduplication and browser caching; no pagination or lazy loading here.
   - Narrow remedy: update selection classes in place; paginate results and use lazy thumbnails, including the existing chipset thumbnail helper.
   - Supervisor scenario: open 칩셋, click three different cards, then type/delete a search. Count added/removed gallery nodes and image requests for cold versus warm runs.

2. **Character previews animate cards below the visible area.**
   - Trigger: 소재 → 캐릭터셋, leave the grid open or scroll it.
   - Path: [resourceManagerViews.ts:509](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:509), [canvas drawing:592](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManagerViews.ts:592).
   - Heavy work: one timer per connected card, eight synchronous canvas draws every configured 260 ms. The current 24 bundled sheets imply 192 draws per tick cycle once loaded, including offscreen cards.
   - Safeguards: detached-card cleanup and bounded attachment waiting are already fixed; this is remaining work while connected.
   - Narrow remedy: suspend animation outside the gallery viewport using intersection visibility.
   - Supervisor scenario: record canvas draws during five seconds at the grid top, after scrolling, and in compact-list view; separate visible/offscreen card counts.

3. **Resource manager audio rows bypass the existing picker virtualization.**
   - Trigger: 소재 → 효과음 (SE), select another sound or type/delete search.
   - Path: [audioDescriptionEditor.ts:146](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/audioDescriptionEditor.ts:146), [full-shell refresh:66](/home/main/.codex/worktrees/e85c/rpg-zzu/src/editor/panels/resourceManager.ts:66).
   - Heavy work: empty search mounts at least 635 catalog buttons; each selection/search synchronously re-enumerates resources, replaces matching rows, and rebuilds the surrounding workbench.
   - Safeguards: selected detail survives search; metadata-only audio preload and teardown guards exist. The ordinary database audio picker already virtualizes rows.
   - Narrow remedy: reuse that virtual list for manager audio rows; filter without rebuilding the shell.
   - Supervisor scenario: open SE, count `[data-testid="audio-resource-row"]`, select three sounds, then type/delete search; measure DOM churn and confirm only one preview audio element remains.

No convincing repeated audio decode defect found.
