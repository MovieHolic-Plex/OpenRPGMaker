# AI assistant — control-flow waste review (loops, redundant passes, dead weight)

Repo: `/home/main/paseo-workspace/worktrees/3lblgwmp/slick-yak` (read-only review). Chart data: `/tmp/aiperf/loops.json`.

## Measurements (taken here, not estimated)

- Tool catalog (`selectPiToolDefinitions`): **248 tools, 363,444 schema chars** (about 90-120K tokens). Read-only: 77 tools / 40,859 chars. Decorator domains (core,tile,map): 108 / 136,283. Largest: make_villager 25K, place_npc 23K, upsert_event 22K, upsert_spatial_design 18K, author_house 13.5K.
- Default team builder (`toolDomains: []`) resolves to **all 248 tools**.
- Per write, on the 16-map sample project (1.74 MB JSON): `runTool tile_erase 1x1` **89 ms**, `projectLint` 57 ms, `createDraft` 32 ms, `structuredClone` 35 ms, `changedProjectKeys` 59 ms, `diffMapsForDelta` 0.8 ms, one activity visual 93K chars.
- Deprecated session: **75 modules / 1.02 MB of source** reach the Pi chat command *only* through `assistantSession.ts`. The chain is `aiPiAgentCommand -> aiChangePreview -> aiProposalCard -> aiChatPanelHelpers -> assistantSession`.

## Loop topology

```
send -> intent LLM -> [plan Pi run, read-only, <=maxTurns] -> exec Pi run(s) --turn--> tools
                                                             |   ^ refusal/ref-gate/+1 turn
                                                             |   write -> clone+lint -> checkpoint -> browser
                                                             +-> village check -> repair prompt (<=2)
          -> harmony (Vision+Ultrabrain per map, serial, x2 attempts) -> AUTO repair run (<=2, cold, full catalog) -> recheck
team: orchestrator --assign--> builders ; --wait_agents(10s)--> orchestrator turn (repeat) ; review_map agent -> fix (<=2/map)
      -> final reviewer agent (default on) -> browser harmony again
```

## Findings, ranked by estimated waste

### F1 (5): full catalog re-sent every turn, and the cache is busted
`scripts/lib/piAgentRuntime.ts:259-267`, `:207-208`, `:165-195`; `src/ai/piAgent/teamSpec.ts:45`; `src/editor/panels/aiPiAgentCommand.ts:598-603`; `aiLaneManager.ts:164`.
- **Mechanism:** a run with no `initialToolNames` and no `toolDomains` calls `createPiToolset(domains: undefined)`, which declares the whole registry. Several paths do this: the default team builder, AUTO harmony-repair runs, explicit `/pi` (plan=null), and lanes. A `find_tools` call with an empty result also expands to the full allowed catalog. Discovered tools are pushed in place mid-run, which changes the tools prefix and invalidates the provider prompt cache.
- **Multiplier:** about 100K input tokens per turn. Over a 300-turn builder that is about **30M tokens**.
- **Fix:**
  - Default to core + `find_tools` when no hint is given.
  - Remove the empty-match full expansion.
  - Declare discovered tools only at turn boundaries, in a stable order.

### F2 (5): orchestrator polling costs one model turn every 10 s
`scripts/lib/piTeamRuntime.ts:402-421` (`mailbox.wait(..., 10000)` at :416); `scripts/lib/piTeamMessaging.ts:84-95`.
- **Mechanism:** `wait_agents` races completion against a 10 s mailbox wait. `mailbox.wait` also resolves on `team_changed`, i.e. any spawn or close. Each return is a full orchestrator turn that replays its whole context, plus `reportFor` for all agents.
- **Multiplier:** a 10-min builder costs about 60 turns. A 50-min builder hits the 300-turn orchestrator cap. Context grows about 1K per poll, so waiting alone is quadratic: 60 polls is roughly 1.8M input tokens.
- **Fix:** block until an agent finishes, a message is addressed to the orchestrator, or the parent aborts. Drop the 10 s cap and do not wake on `team_changed`. Return delta rows only.

### F3 (5): one chat request stacks 4-6 model phases
`src/editor/panels/aiPiAgentCommand.ts:377-408` (plan), `:409-440` (exec), `:579-626` (harmony and AUTO repair); `scripts/lib/piAgentRuntime.ts:466-478` (village repair); `aiChatPanel.ts:2108-2150` (intent LLM call).
- **Mechanism:** in order, one request runs:
  1. an intent-declaration LLM call;
  2. an Ultrabrain plan run, read-only, with the *same* maxTurns (200 on balanced) and 77 read tools. All its reads are discarded and only the prose plan survives;
  3. the execution run;
  4. up to 2 village repair prompts;
  5. harmony review;
  6. in AUTO mode, up to 2 repair runs that start cold with no intent note and the full catalog (see F1), each followed by a re-review.
- **Multiplier:** worst case about **800 Pi turns** (200 + 200 + 2x200) for one request. Map reads are repeated by every phase.
- **Fix:**
  - Skip or cap the plan run to 1-3 tool-less turns, or plan and execute in the same Agent so reads stay in context.
  - Run repairs as a follow-up `agent.prompt` on the same Agent, with the same `initialToolNames` and intent note.

### F4 (4): three review layers in team mode, and per-role caps never apply
`src/ai/piAgent/teamSpec.ts:126-127`, `src/ai/piAgent/team.ts:70,82`, `scripts/lib/piTeamRuntime.ts:325-367,473-482`, `aiPiAgentCommand.ts:577`.
- **Mechanism:** each map can get review_map up to 3 times (1 + 2 fixes). Then the `reviewAfterWork` final reviewer runs (on by default), and then the browser harmony review looks at the same maps again. Separately, `enabledMembers` overwrites every member's `maxTurns` with `workBudget` (300), so the reviewer cap of 50 and builder cap of 200 in `PI_TEAM_ROLES` are dead code. The reviewer actually gets 6x its intended budget.
- **Fix:**
  - Apply per-kind caps.
  - Skip harmony for map revisions the team already reviewed (pass reviewed digests in `done`).
  - Default `reviewAfterWork` off, or fold it into the last review_map.

### F5 (4): harmony review makes two calls per map, one map at a time
`src/ai/ultrabrainReview.ts:139-200`.
- **Mechanism:** each changed map gets a Vision call and then an Ultrabrain call, and both see the same full image. Maps are reviewed one after another. `requestUsableReviewCompletion` allows 2 attempts per call.
- **Multiplier:** a 12-house village produces 13 maps, so 26 calls (up to 52 with retries), then the AUTO recheck on top.
- **Fix:**
  - Use one Ultrabrain call per map.
  - Review maps in parallel with a small concurrency limit.
  - Skip, or contact-sheet, interiors built by recipes that already passed structural QA.

### F6 (4): the tileset reference gate forces extra turns in every fresh run
`src/ai/piAgent/tilesetReferenceGate.ts`, `src/ai/tilesetReferenceEvidence.ts:47-94`, `piAgentRuntime.ts:159`.
- **Mechanism:** the first write to a referenced tileset is refused. The model then has to list references and read every page and image, and credit only lands after the *next* successful assistant message. Only then can it retry the write. Every `runPiAgent` (team child, fix, repair) creates a new gate, so all of this repeats, and the images go back into context each time.
- **Multiplier:** 2-3 or more extra turns per writing run.
- **Fix:** inject the required pages and images into the first user message, and share the evidence across the runs of one request.

### F7 (3): the village contract makes the model re-type arguments the code already has
`piAgentRuntime.ts:250-253,317`, `villageContract.ts:66-71`.
- **Mechanism:** `contract.args` is frozen before the run. The model must still reproduce it exactly, and any drift is refused and retried.
- **Fix:** call `author_village(contract.args)` in code, then let the model (or one `consult_writer` call) handle only the dialogue. At minimum, merge the args in `wrapTool` instead of asserting equality.

### F8 (3): every write does whole-project work
`src/editor/tools/toolRunner.ts:148-190`, `changeset.ts:18-28,316-337`, `piAgentRuntime.ts:219-243,255`, `piTeamRuntime.ts:171-183`.
- **Mechanism:** each write clones the project, runs a full `projectLint` (twice if the baseline already has errors), and runs tree-pair repair on every map. Then it checkpoints (2x `changedProjectKeys`, a merge, a clone, an HTTP ACK). In team mode it goes through another merge and clone, and a publication promise chain serializes all builders.
- **Multiplier:** about 250 ms CPU plus one round-trip per write. Fine-grained tools such as paint_tiles, tile_erase and place_props at 200 writes come to about 50 s of CPU.
- **Fix:**
  - Scope lint and repair to the changed maps.
  - Memoize the baseline lint per accepted revision.
  - Checkpoint once per model turn.
  - Use dirty-key tracking instead of deep compares.

### F9 (3): team message notifications carry no body
`piAgentRuntime.ts:459-461`.
- **Mechanism:** the steer message says a message arrived but not what it says, so the recipient needs a `read_team_messages` turn.
- **Multiplier:** +1 turn per message per recipient.
- **Fix:** put the message bodies in the steer.

### F10 (3): the deprecated session is still loaded and still runs
- **Loaded:** `aiChatPanelHelpers.ts:4-10` imports `AssistantSession` and `METADATA_ONLY_TOOLS` as values, and `aiChatPanel.ts:72-76` does the same. That puts the whole 5,571-line loop and its 75-module closure into the Pi chat bundle.
- **Still executed from these entry points:**
  - event-editor AI assist (`eventEditor/aiAssist.ts:462` -> `sendAiAssistantMessage` -> bridge `send` -> `sendText` -> `ensureSession`, `aiChatPanel.ts:1775`);
  - selection region task (`regionTask/runRegionTask.ts:311`);
  - cluster modal (`clusterAiModal.ts:189`);
  - run-recovery "남은 작업 계속" (`aiChatPanel.ts:848`);
  - evals and benchmark.
- **Duplicated machinery:**
  - two agent loops (`runTurnLoop` vs pi-agent-core);
  - two tool exposure layers (`sessionToolExposure`/`toolPayload` vs `piAgent/toolAdapter`). Note that the Pi path's `initialToolNames` is itself computed by the session's `buildSessionRegistryTools`;
  - two prompt stacks (`contextBuilder.ts` 62 KB vs `piAgent/systemPrompt.ts`);
  - two retry policies (`transientRetry` 3x vs the core's own);
  - two acceptance systems (acceptance ledger vs villageCompletion + harmony).
- **Fix:** split the shared types and constants into a leaf module, route event assist and region task through `runPiAgentViaCompanion`, and lazy-import the session for the rest until it is deleted.

### F11 (2): village completion is evaluated up to 5x per map
`villageCompletion.ts:26`, `villageContract.ts:66-100`.
- **Mechanism:** evaluation runs in the runtime loop (up to 2), at the final check, at team end, and in the browser. The geometry check `JSON.stringify`s every map twice per call, and the receipt clones the whole project.
- **Fix:** compute once in the worker and trust `done.villageCompletion`; limit the geometry compare to the contract map.

### F12 (2): observability data is shipped on every call
- **Visuals:** `activityVisual.ts:81` clones the tileset (about 93K chars per visual) for reads as well as writes, and writes send before and after.
- **Prompt inspection:** `promptInspection` sends 80K chars on every turn of every agent, and the browser keeps only the latest one.
- **Fix:** send tileset ids instead of tileset copies, and emit inspection on demand, debounced, top-level agent only.

### F13 (1): the map-delta shortcut never fires
`piAgentRuntime.ts:371-377`, `mapDelta.ts:162`.
- **Mechanism:** the shadow is a separate `structuredClone`, so `beforeMap === afterMap` is never true. The diff scans every cell and stringifies every event after every tool, reads included. It costs 0.8 ms now and grows with project size.
- **Fix:** diff only after writes, and only the maps a write touched.

### F14 (1): repeated prompt weight
`piAgentRuntime.ts:312-322`, `team.ts:59`.
- **Mechanism:** the capability index is appended even when the full catalog is declared. The orchestrator prompt carries all 7 workflow recipes, and the set_build_spec reminder rides on every writable run.
- **Fix:** send only the pieces that apply to the current run.

## Coarse vs fine tool grain
- `author_village` is the right grain: one call builds the whole village. The waste around it comes from the checks after it (F3-F5, F7, F11), not from the call.
- The fine tools (`paint_tiles`, `tile_erase`, `place_props`, `paint_road`) each pay the full F8 per-write cost, plus a model round-trip, plus about 100-300 KB of visuals. None of them accepts a multi-rect batch.
- Adding a batch variant (an array of rects or ops committed once) would cut both the round-trips and the per-write lint/clone/checkpoint by N.
