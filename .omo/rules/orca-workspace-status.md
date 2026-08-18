# Orca workspace status

When this repo is opened in Orca, every work window has a board `workspaceStatus`.
The default is `in-progress`. Leaving cards there after the work ends fills the
board and breaks the card UI.

## Required

- Create isolation with `npm run wt create <name>` (not a bare `git worktree add`).
- When the work is finished, call `npm run wt done <name>` or `npm run wt remove <name>`.
- If Orca cards stay in In progress after the checkout is gone, run `npm run wt orca-sync`.
- Do not set custom status ids. Only `todo`, `in-progress`, `in-review`, `completed`.
- Do not change the main checkout's board status from a worker.

`orca.yaml` `scripts.setup` / `scripts.archive` call the same mapper as `npm run wt`.
