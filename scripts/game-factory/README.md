# game-factory — many different games, one lane per game

Builds many **different** games in parallel with a coding agent (default `opencodex/gpt-6.1-terra`, thinking high), then
checks each saved game by machine and plays it briefly. Every game has its own owning lane id (`g01`..`g30`), and every
fact a control-room view shows is written to `events.jsonl` by the process that caused it.

## Files

| file | what |
|---|---|
| `specs.json` | 30 briefs: genre, theme, protagonist, core loop, bundled-tool hint, and the Korean prompt the builder receives |
| `dispatch.mjs` | queue → build → check → smoke per game; at most `--concurrency` builders and at most `--max-global-agents` agent processes on the box |
| `build-one.sh` | one build: blank canonical SQLite project, warm editor host (`agent-host.mjs`, no browser), `omp -p` agent turn (+ one follow-up if time is left), `/final` receipt, teardown |
| `agent-host.mjs`, `imagegen.mjs`, `agent-kit/` | the agent-direct-edit host and `./oprn` CLI the builder talks to (same as the terra-fun-game lane) |
| `smoke.mjs` | shipped player (`dist/export-player`): boot, Enter until a field map, N seconds of arrow/Enter input; PASS = field reached and no page/console error |
| `sameness.mjs` | pairwise Jaccard of painted `(tileset, tile)` sets across built games + distinct genre/tileset counts |
| `render-dashboard.mjs` | control-room MP4 from `events.jsonl` and each game's own smoke frame |

## Run

Prerequisites in a fresh worktree: `npm run wt -- adopt …`, `npm run build:app`, `npm run build:player`, `npm run build:electron`
(the editor host needs `dist-electron/browser-bridge.js`).

    node scripts/game-factory/dispatch.mjs --out <runs dir> --only g01,g02 --concurrency 8
    node scripts/game-factory/sameness.mjs <runs dir> > sameness.json
    node scripts/game-factory/render-dashboard.mjs --runs <runs dir>[,<more>] --out dashboard.mp4 --seconds 75

States per game: `finished` (agent ended inside the cap) → checked → smoked; `capped` (cap reached — never scored);
`failed` (prepare/host/agent error; prepare/host errors are retried `--retries` times with a `retry` row).
`<runs dir>/summary.json` holds the table; each `<runs dir>/<id>/` holds RUN.txt, agent transcripts, `check-v2.json`, `smoke/`.

The machine checker is the save-check v2 script (`--checker`, default `/home/main/claude-viz/save-check/check.py`).
A checker PASS is not a fun or quality verdict.
