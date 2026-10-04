# Confirmed brief automatic execution

Run: `node scripts/capture-confirmed-brief-autostart.mjs` with this worktree's dev server.

The browser mounts the production assistant panel and new-project startup modules. Authentication,
AI responses and saves are intercepted for isolated fixtures. No live model was called and no
canonical project was created, changed or presented as a finished game.

All five cases passed with no browser errors:

- Cold authentication cache: probe finishes before a single automatic team request.
- Worker acceptance: one request, retry marker claimed; another startup does not repeat it.
- Disconnected then connected: short visible draft retains the full hidden request; connecting
  automatically sends it without pressing Send.
- Switch while authentication is checking: no request is dispatched into the other project.
- Save failure: no request is dispatched and the retry marker remains.

The three dispatch cases deliver the exact complete **9,162-character** fixture prompt, including
the author's custom premise and the internal P03/F03 tasks. The cold-cache and reconnection cases
simulate HTTP 503 before worker startup and verify that the retry marker is restored and saved.
`worker-accepted.png` represents a simulated worker that accepted the request and made no changes;
it is not evidence that production content or a playable game was generated.

`report.json` contains the measured request and save transitions. `npm run build:app` also completed
with exit 0. Focused Vitest cases were authored; Vitest, gates and full typecheck were not run,
following this session's repository rules. Runtime generation and canonical save/reload remain
outside this probe's scope.
