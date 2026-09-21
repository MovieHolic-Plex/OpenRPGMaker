# Project wiki acceptance evidence

## Delivered behavior

The existing world/codex database now holds source-backed project knowledge.
The user's configured OAuth LLM extracts declarations and lore; editor-owned
checkpoints persist them before authoring. New chats receive relevant documents.
Corrections and map exceptions drive actual contact/action monster authoring.
Manual edits, locks, supersession history, and newer live wiki state are protected.
Applied progress is recorded from actual state, not assistant completion prose.

## Live OAuth and persistence

- Provider/model used: `google-antigravity` / `gemini-3.7-flash`.
- Separate remote QA project: `qa-project-wiki-combat-20260907`.
- Four real editor turns completed: contact-JRPG/kingdom declaration, new-chat
  recall, contact monster authoring, global action correction with contact-map
  exception and action arena authoring.
- Remote `store.flush()` returned `saved`; reload preserved the wiki exactly.
- Export SHA-256:
  `34c6ea39d04f88029839bfb400e62c5911d4929ad724f37b1fd6c9977846888e`.
- Local detailed artifacts: `output/evidence/project-wiki/live-oauth.json`,
  `live-transcript.json`, `qa-project.json`.

## Actual gameplay, not only project flags

The runtime script loads the unchanged exported QA project into `player.html`.
It does not replace content with a demo or modify combat flags to pass.

| Scenario | Actual result |
| --- | --- |
| `map_blank_start`: walk into visible stationary slime | `battle-scene` opened |
| `map_action_test`: attack the same visible target on the map | Enemy HP `10000 -> 9953`; no battle screen created |

Runtime page errors: **0**. Browser contexts, browser and player server closed.
Detailed state/action evidence: `output/evidence/project-wiki/runtime/evidence.json`.
Screenshots: `runtime/contact-before.png`, `contact-after.png`,
`action-before.png`, `action-after.png`.

## Regression evidence

Before implementation, tests captured metadata loss, missing preparation barrier,
old proposals overwriting live documents, manual edit races, stale intent cache,
random encounter defaults despite explicit contact/action decisions, absent body
retrieval, loss of early history, and invisible unresolved monster graphics.

Observed RED/GREEN summaries and original browser baseline are retained under
`output/evidence/project-wiki/`: `red-domain.log`, `red-session.log`,
`red-application.log`, `red-manual.log`, `red-browser.json`,
`regression-ledger.md`, and matching GREEN artifacts.

The deterministic editor test proves a genuine new conversation receives the
persisted wiki through the real UI; it uses an HTTP model fixture only for that
repeatable regression. The separate live OAuth run above is not mocked.
The same browser test suspends an extraction response, edits the source document
through the real codex, then releases the response. The stale patch is rejected
and the manual text survives (`concurrent-manual-edit.png`). Final run: 1 passed,
1.8 minutes, retries disabled.

Final focused wiki/adjacent suite: **87 passed in 13 files**, exit 0.
The full production build passed (app, player and standalone). A whole-repository
gate run found 210 failures against an older stored baseline; immutable starting
commit comparison and narrow follow-up results are recorded in the final
verification report rather than relabeling that command as green.

## Reproduce

```sh
E2E_FREEZE_DEV_SERVER=1 DEV_SERVER_NO_TLS=1 npm run dev:worktree -- --port 9857
E2E_RETRIES=0 DEV_SERVER_PORT=9857 npx playwright test test/e2e/project-wiki.spec.ts --workers=1
node scripts/qa-project-wiki.mjs --base-url http://127.0.0.1:9857 --scenario oauth-combat --project-id qa-project-wiki-local-check
node scripts/qa-project-wiki-runtime.mjs --project output/evidence/project-wiki/qa-project.json
```

The scripts relay real HTTP response bytes through Node on hosts where Chromium
receives `ERR_NETWORK_CHANGED`. OAuth replies and LegacyDb writes are not mocked.
Use a new QA project ID, never a user's authored project.

## Review and limitations

Self-review follows the user's bare-ultrawork contract; no ulw-plan reviewer gate
was activated. The change remains HEAVY because it crosses persistent metadata,
asynchronous editor ownership and authoring decisions.

History recovery processes locally available same-project conversations. It does
not claim to retrieve remote transcripts no longer present in the local store.
The main model could not receive PNG attachments in this session; screenshot
artifacts are accompanied by real DOM, sprite and gameplay-state assertions,
not an invented aesthetic verdict.
