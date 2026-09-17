# DB modal drag / maximize browser evidence

Base URL: http://127.0.0.1:9819 (`/?freshProject=1`, viewport 2000x1200, expert mode)

- **modal-open-baseline** — PASS (01-open.png): centered modal 186,150 / 1628x900 before any drag
- **modal-drag-follows-cursor** — PASS (02-dragged.png): header drag +350x/+250y moves window 186,150 -> 368,296 with `position: fixed`
- **header-button-press-starts-no-drag** — PASS (03-button-no-drag.png): mousedown on maximize-button SVG icon keeps window at 186,150
- **maximize-grows-window** — PASS (04-maximized.png): toggle grows window 1628x900 -> 1984x1184 at 8,8
- **maximize-restore-returns** — PASS (05-restored.png): second toggle returns to 186,150 / 1628x900
- **battle-command-studio-intact** — PASS (06-battle-command-tab.png): menu board with 5 rows + 6 drop slots renders normally
- **command-dnd-reorder-commits** — PASS (07-command-reorder.png): dragging 3rd menu row to slot 0 reorders (방어 first) with status "직업 메뉴 순서 변경"
- **dock-after-drag-clears-inline** — PASS (08-docked-after-drag.png, 09-undocked.png): dock clears inline position/size, undock restores centered modal

Page errors: none (Vite HMR websocket / autosave noise ignored per QA relay convention)

Verification:
- `npm run typecheck:app` exit 0
- `npx vitest run test/databaseModalDockMode.test.ts` 6/6 passed (drag-guard + maximize/dock-inline regression tests)
- `npx vitest run test/databaseTroopBattleTestModalClose.test.ts` 1/1 passed (adjacent modal close path)
- `npx vitest run test/databaseBattleCommandStudio.test.ts test/databaseBattleCommandDuplicateRows.test.ts` 40/40 passed (adjacent command DnD order logic)
