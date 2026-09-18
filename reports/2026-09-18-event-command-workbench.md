# Event command workbench — 2026-09-18

Implemented in this worktree; browser served at http://127.0.0.1:9840.

- .superpowers/sdd/qa-shots/event-command-workbench/editor.png: actual editor, existing sample NPC, command list and permanent right preview.
- .superpowers/sdd/qa-shots/event-command-workbench/ai-modal.png: actual AI authoring modal, prompt entered, no LLM request sent.
- .superpowers/sdd/qa-shots/event-command-workbench/command-selected.png: inline command form and live preview on the right.
- .superpowers/sdd/qa-shots/event-command-workbench/editor-1024.png: narrower desktop, all three columns remain alongside one another.

Browser observations:
- At 1600px: 240px settings, 6px separator, 789.375px commands, 402.625px preview.
- At 1024px: 200px settings, 6px separator, 492px commands, 260px preview; no overlap.
- Editing the existing first dialogue updates the right preview and retains the inline form;
  its original text was restored inside the disposable browser context.
- Empty AI prompt shows inline validation; typing clears that validation.
- AI modal is the top modal (stack depth 2). Escape closes only AI (parent editor remains).
- No uncaught page exceptions. The temporary, nonpersistent sample session reports expected
  autosave-disabled errors; a local service is unavailable (ERR_CONNECTION_REFUSED).

No full gates, vitest, typecheck, real LLM generation, remote project persistence, or deployment.

Screenshots were captured before integrating the latest main; that integration changed unrelated editor shell features.
