# Pi agent path: data movement and compute per request

Axis: how much whole-project serialization, cloning, hashing and diffing one request does, from start to finish.
Repo: `/home/main/paseo-workspace/worktrees/3lblgwmp/slick-yak` @ ef701e36a (read-only; all scratch files are under /tmp/aiperf/).

## Test projects (real, from the local app store)

| id | source | bytes | maps | cells | tilesets | spatialAuthoring |
|---|---|---|---|---|---|---|
| **ws** (the default web workspace project, 121 maps) | `~/.local/share/oprn/web-workspace/project.sqlite` | 34.9 MB | 121 | 54,514 | 30.6 MB | yes, 1.3 MB |
| lake ("호수 마을") | `imported-projects-20260921/project-29b9…/project.sqlite` | 23.6 MB | 144 | 187,002 | 7.9 MB (+6.7 MB assets, 4.6 MB spatialAuthoring) | yes |
| castle (LPC castle interior) | `web-workspace/.oprn-projects/9f81…/project.sqlite` | 36.0 MB | 7 | 2,860 | 34.3 MB | no |

Tilesets make up most of every project: `tileset.image` is a data URL of about 7 MB per sheet. 15 of the 205 local projects have `spatialAuthoring`, and so does the default workspace project.

Benchmarks: `bench-data.ts` (Bun, worker side), `bench-data-v8.mjs` and `bench-data-sha-v8.mjs` (Node/V8, as a stand-in for the browser), `bench-data-tool*.ts` (per-write breakdown, CPU profile in `data-prof/`). Raw output is in `bench-data-{ws,lake,castle}.out`. Figures are medians in ms.

## Headline findings (by severity)

### S1 (CRITICAL): each write tool call hashes the whole project twice with pure-JS SHA-256
- `runToolDefinition` calls `beginSpatialToolProposal(draft, before)` and `sealSpatialToolProposal(draft)` (`src/editor/tools/toolRunner.ts:146,184`). Each of them calls `spatialToolFingerprint` = `sha256HexTextSync(JSON.stringify(project))` (`src/editor/tools/spatialToolState.ts:15-17,21-33`). That function is the hand-written `sha256Fallback` (`src/util/sha256.ts:79-81`), not WebCrypto or native code.
- Measured on ws with `runTool(paint_tiles, 6x6)` in Bun: **8.3 s on the first call, then 42.7 s, 40.2 s and 24.7 s** on the next calls. The CPU profile puts **96% of the time (111 of 116 s) in `sha256Fallback`**. The actual tool body (`tool.run`) takes 2.6 ms.
- For comparison: one fingerprint takes 3.1 s in Bun and 1.6 s in V8. Native `Bun.CryptoHasher` over the same string takes **185 ms including the stringify**, about 17x faster. Hashing only `spatialAuthoring` (1.3 MB) takes 125 ms.
- The same fingerprint runs again at every acceptance boundary:
  - worker `authorMergedSpatialProposal`: 2 hashes on each scoped checkpoint and on each team merge (`spatialToolState.ts:88-96`, `piAgentRuntime.ts:223`, `piTeamRuntime.ts:177`)
  - browser `adoptSpatialToolProof`: 1 hash (`aiPiPublication.ts:57`, `aiPiAgentCommand.ts:502`)
  - browser `assertSpatialToolAcceptance` inside `applyProposedProject`: 2 hashes (`spatialToolState.ts:115-121`)
  - That is about **5 hashes of the whole project on the browser main thread per checkpoint**, roughly 8 s in V8 on ws.
- Scope: this affects only projects that have `spatialAuthoring`. That includes the default workspace project. Castle has no `spatialAuthoring`, and the same write takes 390 ms there.

### S1 (CRITICAL): the browser NDJSON decoder is O(n²) in line length
- `createPiAgentLineDecoder.push` does `buffer += chunk; buffer.indexOf("\n")` from position 0 on every chunk (`src/ai/piAgent/protocol.ts:163-171`). Each chunk rescans and flattens the whole partial line accumulated so far.
- Decoding one `done` line on the main thread in V8, compared with `JSON.parse` of the same line at about 100 ms:

  | project | 16 KiB chunks | 64 KiB chunks | 256 KiB chunks |
  |---|---|---|---|
  | ws (33.5 MB line) | 51.0 s | 12.5 s | 3.2 s |
  | lake (21.9 MB line) | 24.6 s | 5.5 s | 1.4 s |
  | castle (Bun) | 27.0 s | 8.2 s | n/a |

- Which chunk size the browser actually delivers depends on the transport (loopback vs Tailscale). The cost applies to every large line, and there are many of them:
  - the `done` event (`piAgentRuntime.ts:494-503`)
  - every live-mode `checkpoint` event
  - in team mode, every child's nested `done`

### S1 (CRITICAL): the checkpoint slimming never works, so every live write ships the full project in both directions
- `snapshotProjectKeepingHeavy` keeps `tilesets` and `database` shared by identity (`protocol.ts:240-244`), and `checkpoint()` drops them from the line only when identity survives (`piAgentRuntime.ts:225-227`).
- But every write tool replaces `ctx.project` with `createDraft(before)`, and `createDraft` **`structuredClone`s tilesets and database** (`src/editor/tools/changeset.ts:18-28`). Identity never survives a write. Measured: `tilesetsIdentityPreservedAfterWrite=false`, `checkpointUnchangedKeys=[]` on all three projects.
- Resulting checkpoint line sizes:

  | project | actual line | line if identity were kept | ratio |
  |---|---|---|---|
  | castle | **35.1 MB** | 0.25 MB | 139x |
  | ws | **33.5 MB** | 2.3 MB | 15x |
  | lake | 21.9 MB | 13.5 MB | (spatialAuthoring and assets dominate) |

- The ACK sends the whole project back as well: `slimCheckpointProject(project, [])` (`src/ai/piAgent/client.ts:73-79`), then Node parses and re-stringifies it (`companionHttpUtil.mjs:1-12`, `ohMyPiPiAi.mjs:123-128`), then Bun parses it (`oh-my-pi-worker.ts:42-44`).
- Live application is the **default** apply mode (`DEFAULT_PI_APPLY="default"`, which `isLiveApplyMode` treats as live; `applyMode.ts:10,14`). A checkpoint fires after **every `exclusive` (write) tool call** (`piAgentRuntime.ts:255`).

### S2 (HIGH): the browser acceptance gate recomputes about 7 full canonical serializations per checkpoint
Each `publish` (`src/editor/panels/aiPiPublication.ts:41-79`) runs:
- `changedProjectKeys(project, next)`: about 300 ms, and it JSON-stringifies tilesets on both sides because identity is lost
- `applyProposedProject` (`applyChangesetToStore.ts:299-431`):
  - `isProposalBaseCurrent` twice: `proposalContent` = `canonicalJsonString(JSON.parse(JSON.stringify(project)))`, **921 ms each in V8** (`applyChangesetToStore.ts:218-240,304,383`)
  - `baseline.matches` → `authoredIdentity`: about 530 ms
  - the spatial hashes described in S1
  - `commitChangeset` → full `projectLint` including the serialize round-trip: 535 ms on ws, 767 ms on lake
  - `summarizeChanges`: 230–1,086 ms, because it stringifies every tileset twice (`changeset.ts:271-273`)
  - `recordProjectCommit` → `serialize(project)` plus a repository write of the whole project (`projectCommitLog.ts:80-93`)
- `onApplied`: `captureProposalBase` (again about 0.9 s) and `new AuthoredProjectBaseline` (about 1.0 s: authoredIdentity plus contentIdentity) (`aiPiPublication.ts:70-72`)

Estimated main-thread total per checkpoint on ws: **about 23 s with 64 KiB chunks** (decoder 12.5 + hashes about 8 + canonical/lint about 5), or about 14 s with 256 KiB chunks. This is the sum of the component measurements above, not one end-to-end run.

### S2 (HIGH): the plan turn ships the whole project to the worker and back just to read `changedKeys`
- With the default settings (not yolo, not a routine edit, not team), `runPiCommand` first runs a read-only "Ultrabrain plan" with `project: base` (`aiPiAgentCommand.ts:377-406`). It then runs the real turn with `project: base` again (`:409-440`).
- The plan's `done` carries the full project (`piAgentRuntime.ts:497`). The browser only reads `planned.changedKeys` and the assistant text (`:403`).
- Cost: 2 extra hops of 34.9 MB each, one extra O(n²) decode (up to 12.5 s), and one extra round of worker clones.
- Every AUTO harmony repair round does the same again (`aiPiAgentCommand.ts:598-603`, up to 2 rounds).

### S2 (HIGH): per-write overhead inside the worker, even with no spatial data

| step | castle | ws | lake |
|---|---|---|---|
| `createDraft` (full `structuredClone`) | 171 ms | 297 ms | 251 ms |
| `summarizeChanges` (stringifies all tilesets twice) | 196 ms | 229 ms | 175 ms |
| `commitChangeset(skipRoundtrip)` | 10 ms | 130 ms | 230 ms |

Checkpoint guard `changedProjectKeys(accepted, ctx)` costs 290–306 ms (`piAgentRuntime.ts:220`). On top of that:
- scoped runs add `mergeMapBundles`: 455–609 ms. It is a JSON round-trip clone of the whole base plus a stringify of every out-of-bundle map and every top-level key on both sides, done twice (`mapBundle.ts:44-46,96-124,264-272,275-305`).
- `structuredClone(slim)`: 184–322 ms (`piAgentRuntime.ts:230`)
- encoding the line: 142–193 ms

Without spatial data, one write costs about **1.0–1.5 s of Bun CPU** before the browser does any of its work. The model's own tool work is about 3 ms.

### S2 (HIGH): team mode re-ships the full project for every sub-agent
- Child events are wrapped verbatim as `agent_event` (`piTeamRuntime.ts:130-143`), including the child's `done`, which carries the full project (`piAgentRuntime.ts:503`).
- With B builders and R reviewers, plus the orchestrator and the final `done`, a run emits **B + R + 2 full-project lines**. Each one pays the O(n²) decode.
- Each assignment also:
  - clones `working` with `structuredClone` (`:201,254,347`)
  - gets cloned again inside `runPiAgent` (ctx, ghost maps, accepted snapshot)
  - merges with `mergeMapBundles`, which does a JSON round-trip of the whole `working` (`:163`)
- Each child checkpoint runs `mergeMapBundles`, `authorMergedSpatialProposal` (2 hashes) and `structuredClone(accepted)` (`:171-181`).
- Example: 3 builders and 1 reviewer on ws means 6 × 33.5 MB = **201 MB of NDJSON** before counting checkpoints.

### S3 (MEDIUM): duplicated baseline captures at the start of every request
- `runPiCommand` computes `captureProposalBase(base)` and `new AuthoredProjectBaseline(base)` (`aiPiAgentCommand.ts:209-210`).
- `createPiPublication(base)` computes both again (`aiPiPublication.ts:21-22`).
- That is 6 canonical full-project passes, **about 4–5 s in V8 on ws, before the POST is sent**.

### S3 (MEDIUM): a stale base throws away the whole run
- Review mode: the final `applyProposedProject` compares the full `proposalContent` against the base captured at the start (`applyChangesetToStore.ts:303-311`). Any human edit during a multi-minute run returns `stale-base`. The run's tokens and compute are lost, and there is no rebase or merge attempt.
- Live modes: a stale checkpoint throws, and the worker sets `rejected` and aborts the agent (`piAgentRuntime.ts:237-241`). The rest of the run is lost.

### S3 (MEDIUM): a stale worker is killed by the next companion call, even mid-run
- Any change to a file under `src/` or `scripts/` marks the worker stale (`vite.config.ts:176-182`).
- The next `startWorker()` call runs `stopOhMyPiWorker()` → `workerChild.kill()` (`ohMyPiPiAi.mjs:41,135-140`). This happens even if an `/agent/run` is in flight: any `/complete` or `/image` call, or a second `/agent/run`, triggers it. That contradicts the "진행 중인 실행을 죽이지 않는다" claim in `ohMyPiPiAi.mjs:27-35`.
- Respawn costs **1.5–1.7 s** (measured time to READY). In a box where other agents edit `src/` all the time, nearly every request pays it.

### S3 (MEDIUM): post-run full diffs are repeated
- `aiPiAgentCommand.ts` calls `changedProjectKeys` 11 times: `:472,513,515,612,628,630,674,676,713,769,779`. It also calls `summarizeChanges` up to 3 times, plus `buildChangeLedger`, `changedAreaLabels`, `computeChangeSites` and `mapLossConfirmRequest`. Each of these walks the whole project.
- Worker-side results are fresh parsed objects, so no identity shortcut applies and tilesets are stringified every time.
- Measured on castle: `changedProjectKeys(base, result)` 693 ms, `summarizeChanges` 1,086 ms. On ws: 347 ms and 270 ms.

### S4 (LOW): `map_delta` is cheap, but part of the work is wasted
- Encoding is good: a cell list, or the full layer when more than 1/8 of it changed (`mapDelta.ts:112-139`). **0.3–0.8 KB per write**, and diff time is 0.1–3.3 ms per `tool_end`.
- Wasted work:
  - `ghostShadow` never shares identity with `ctx.project` (0/121 maps shared, because `createDraft` and checkpoint restore replace every map object). So the "43맵 … 한 줄이 비교 대부분을 건너뛴다" shortcut (`mapDelta.ts:162-163`) never fires. Every `tool_end`, reads included, scans every cell of every map and JSON-compares every event. That is still only 3 ms for 187k cells.
  - In the live modes, which include the default, the browser discards `map_delta` (`aiPiAgentCommand.ts:319`), but the worker still computes and sends it (`piAgentRuntime.ts:428`).
- Ghost rendering: throttled to 150 ms and O(changed maps × cells) (`agentGhostPreview.ts:108,409-413`). After `done` in review mode, `reconcile(done.project)` replaces every map object, so one full scan of all maps follows. That is negligible (a few ms).

### S4 (LOW): `prompt_inspection` on every model call
- `onPayload` deep-scrubs the whole provider payload and pretty-stringifies every section (`promptInspection.ts:24-44`, `piAgentRuntime.ts:333-345`). The history grows every turn, so the total cost is O(turns²).
- Each call emits a line of up to about 80 KB. Over a 200-turn run that is about 16 MB of NDJSON.

### Informational
- `readRequestJson` caps request bodies at 64 MB (`companionHttpUtil.mjs:7`). The largest projects here are already at 35–36 MB, so a project that roughly doubles makes the agent path, including checkpoint ACKs, fail outright.

## Whole-project passes for one default-mode request
Assumptions: apply mode "default" (live), plain chat with the current map, not scopedByUser, W write tools, project with `spatialAuthoring`.

| phase | JSON stringify | JSON parse / round-trip | structuredClone | canonical JSON | SHA-256 of whole project | full diffs / lints | wire bytes (ws) |
|---|---|---|---|---|---|---|---|
| start (browser) | – | 4 (inside canonical) | – | 6 | – | – | – |
| plan upload | 2 (browser, Node) | 2 (Node, Bun) | 3 (ctx, maps, snapshot) | – | – | – | 2 × 34.9 MB |
| plan done | 1 (Bun) | 1 (browser, O(n²) decode) | – | – | – | 1 (`changedProjectKeys`) | 2 × 34.9 MB |
| exec upload | 2 | 2 | 3 | – | – | – | 2 × 34.9 MB |
| **each write tool (× W)** | 1 (Bun) + 1 (browser ACK) + 1 (Node re-stringify) + 1 (commit serialize) | 3 (browser, Node, Bun) + 1 (lint round-trip) | 2 (`createDraft`, slim) + 1 (snapshot) | 7 (browser gate) | 2 (worker) + 3 (browser) | about 5 (`summarizeChanges` ×2, `changedProjectKeys` ×2, `projectLint`) | 4 × 34.9 MB = **139.6 MB** |
| exec done | 1 | 1 (O(n²) decode) | – | – | – | about 10 post-run diffs | 2 × 34.9 MB |

- Totals for W = 10 on ws: **about 48 hops × 34.9 MB = 1.67 GB** of loopback JSON. That is roughly 40 stringifies, 40 parses, 36 clones, 76 canonical passes and **50 full-project SHA-256 passes**.
- The model's actual edits are about 5–10 KB.
