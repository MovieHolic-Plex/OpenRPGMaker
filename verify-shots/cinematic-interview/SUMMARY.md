# Actual app interview — browser evidence

The production modules were opened through Vite (`scripts/capture-cinematic-interview.mjs`), not the standalone visualization.

- New-project menu enters planning, then the real cinematic interview. Relationship + monster selection returns the matching collection engine and preserves original concept, protagonist, blend and recommendation source.
- All four genre question paths complete; saved cinematic briefs reopen; cancellation writes nothing and restores focus.
- Editing answers after a manually edited summary blocks confirmation until it is refreshed/edited.
- Internal tasks reach the assistant prompt, with no TODO/export controls in the user screen.
- Welcome poster cancellation calls no save callback. Changing its interview to mystery selects the story engine in both applied plan and assistant prompt.
- Desktop New Game enters AI planning; the three existing examples remain reachable through the alternative start chooser.
- 390px mobile viewport: no horizontal overflow. Reduced-motion mode pauses video and removes scene transitions.
- Browser errors: 0. Missing interview assets: 0. All 45 shipped image hashes match their recorded visual review.

Inspect `02-romance-scene.png` for the transparent scene-cut UI and `04-mobile.png` for the narrow layout. `01-genres.png` and `03-summary.png` show genre mixing and user-facing confirmation. Exact observations: `browser.json`.

Limits: the connection/save callbacks are stubbed. No live AI game generation or canonical SQLite project writes were performed. JSON brief normalization was exercised; real serializer/handoff regression cases were authored but not executed locally. No local Vitest/gates/full typecheck under repository session rules. TypeScript syntax transpilation and `git diff --check` passed.
