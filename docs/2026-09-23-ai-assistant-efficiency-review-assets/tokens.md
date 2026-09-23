# Pi agent path: per-request prompt and token overhead (adversarial review)

Worktree `slick-yak` @ ef701e36a. Tokens are counted with tiktoken `o200k_base` (GPT-5 family; Gemini counts differ by about ±20%). The tool definitions come from the real registry via `selectPiToolDefinitions` and are serialized the way `createPiToolset` builds them (`{name, description, parameters}`, toolAdapter.ts:162-167). The Gemini wire size comes from pi-ai's own `convertTools`, and the Codex size from `buildTransformedCodexRequestBody`.
Scripts: `/tmp/aiperf/measure.ts` (bun, imports the repo source) and `/tmp/aiperf/count.py`. Raw dumps are in `/tmp/aiperf/raw/`.

## Headline numbers

| What | Value |
|---|---|
| Registry entries / live (non-deprecated) tools | 284 / **248** (not 206) |
| Full catalog schema | **441,681 B, 113,311 tok** (Gemini wire 126,064 tok, Codex body 114,592 tok) |
| of which parameters / descriptions | ~106k / ~24k (the schemas dominate) |
| write tools / read tools | 100,391 / 12,920 tok |
| Top 20 tools as a share of the catalog | 47% |
| Duplicated sub-schema (COMMAND_SCHEMA inlined 8x across 5 tools, plus the NPC `pages` schema 2x) | **~21.9k tok (~19% of the catalog)** |
| Read-only set (77 tools) | 12,920 tok (Gemini wire 14,068) |
| Base system prompt | 1,125 tok (the 16-map backup project gives 1,135, so the map list does not grow it) |
| Tool capability index (full / read) | 1,389 / 615 tok |
| Pre-turn intent calls (declarer + coverage audit) | 2 extra LLM calls, **9,221 input tok** in total |

### Top 20 tools (tokens)
make_villager 6,943 · place_npc 6,605 · author_house 6,457 · upsert_event 6,011 · upsert_spatial_design 4,385 · upsert_troop_battle_page 2,908 · author_village 2,801 · upsert_common_event 2,489 · start_interior_room_session 1,835 · place_concept 1,658 · create_quest 1,338 · generate_map 1,335 · run_interior_room_pipeline 1,296 · upsert_enemy 1,164 · define_ending 1,084 · run_dungeon_room_pipeline 1,082 · script_cutscene 1,069 · start_dungeon_room_session 1,039 · run_scene_test 971 · upsert_item 962.
By first domain: event 31.0k (39 tools), tile 28.5k (54), database 19.5k (47), map 9.1k, system 8.8k, world 7.8k, battle 4.0k, quest 2.2k, core 1.9k.

## Q1. Are all tools sent every turn? Is there tool selection?

**Selection exists, but only on the plain-chat write path. Several paths bypass it and send the full 113k catalog.**

- Plain chat, create or modify: the intent declarer picks `initialToolNames` (aiChatPanel.ts:2151 → sessionToolExposure.ts:65-90). The runtime then exposes only those plus the tileset reference readers (piAgentRuntime.ts:259-267). Measured scenarios:
  - village create: 19 tools, 8,045 tok
  - NPC modify: 19 tools, **22,340 tok** (place_npc plus upsert_event alone are 12.6k)
  - item DB: 17 tools, 4,229 tok
  - paint road: 17 tools, 3,802 tok
- Tools are also added mid-run: after `find_tools` via harvesting (piAgentRuntime.ts:202-214), and through the fallback for undeclared calls (piAgentRuntime.ts:349-353).
- **Full catalog (248 tools, about 117k tok per call including the prompt)**:
  1. **Team builder** (HIGH). Every team child is started with `initialToolNames: undefined` (piTeamRuntime.ts:206, 270, 353, 466). The default builder has `toolDomains: []` (teamSpec.ts:45), so `domains` is undefined and every live tool is sent (toolAdapter.ts:69-82).
  2. **Harmony-review repair run** (HIGH). It calls `runPiAgentViaCompanion` with no `initialToolNames` or `toolDomains` (aiPiAgentCommand.ts:598-602). A cosmetic fix pays 116.8k tok per call, and the repair loop runs up to 2 times.
  3. **Empty `find_tools` search** (MED). It "restores the complete permitted catalog" by pushing about 230 schemas into the live array (piAgentRuntime.ts:207-208). One missed keyword costs about +105k tok on every later call.
- **All read tools (77, 12.9k)** are sent for question turns, for which initialToolNames is skipped because `plan.readOnly` (aiChatPanel.ts:2113, 2145-2147), for the **Ultrabrain plan turn** (aiPiAgentCommand.ts:377-390, readOnly with no initialToolNames), and for the reviewer. A question like "how many maps?" gets 77 schemas.
- The capability index (1,389 tok, piAgentRuntime.ts:312-314) lists every allowed name. That is intended as navigation for the trimmed set, but it is also appended when the full catalog is already on the wire, where it is pure duplication.
- The pi-agent-core option `pruneToolDescriptions` (agent.ts:254-259) and a shared `$defs` for COMMAND_SCHEMA (schemaShapes.ts:87) are both unused.

## Q2. System prompt and injected context

- `buildPiAgentSystemPrompt` (systemPrompt.ts:23-50) is 1,125 tok for the blank project and 1,135 tok for the 16-map backup. Only the scoped map id/name/size lines and `gameDesignBrief` are injected. **Map and project data are not serialized into the prompt**; the model has to read them through tools. This is good for prefix size, but it means every request starts cold (see Q4).
- Runtime additions: the capability index (1,389 / 615), the set_build_spec rule (92), and, when relevant, the step/yolo/writer/read-only lines (piAgentRuntime.ts:317-322). The village contract embeds `JSON.stringify(contract.args)` (line 317), which is small.
- The intent note is appended to the user task (executionRoute.ts:108-110): 420 tok for a village, 81 for NPC modify.
- **Two extra LLM calls run before every create or modify turn** (intentDeclarationClient.ts:90-190): the declarer (INTENT_SYSTEM_PROMPT 3,101 plus a facts payload of 1,226 that lists **all 248 tool names** plus wiki context, intentDeclarationClient.ts:57-70) and a separate coverage audit (REQUEST_COVERAGE_AUDIT 3,668 plus the same 1,226 payload, line 126). That is **9.2k tok and two sequential round trips before the agent starts.**
- The team orchestrator prompt is 2,880 tok and lists every project map (team.ts:34-36). The builder member prompt is 1,406 and the reviewer 366.

## Q3. Prompt caching

- **No explicit caching is configured.** The runtime never passes `sessionId`, `promptCacheKey` or `cacheRetention` to `Agent` (piAgentRuntime.ts:324-354). For Codex, `getOpenAIPromptCacheKey` therefore returns undefined (pi-ai openai-shared.ts:463-466), and the measured request body has `prompt_cache_key: undefined`. OpenAI's automatic prefix caching can still fire, but without the routing key it is much less sticky. For Antigravity there is only implicit Gemini caching: pi-ai reads `cachedContentTokenCount` (google-gemini-cli.ts:885-893) but never sets `cachedContent`.
- **Things that break the prefix inside a run**:
  - (a) `tools` is mutated in place by find_tools harvesting, the fallback declare, and village repair (piAgentRuntime.ts:164-167, 191-195, 473-476). The tool block comes before the instructions and history, so each growth invalidates the entire cached prefix.
  - (b) An empty `find_tools` result swaps in the full catalog mid-run.
- **Across requests**: every chat message is a new `Agent` whose only user input is `request.task` (piAgentRuntime.ts:463). There is no conversation carry-over. The prefix (tools, then system) is stable for identical exposure sets, but the exposure set is chosen per message by an LLM, so two consecutive messages rarely share an identical tool list.
- Team children each get a unique system tail (`teamCommunicationPrompt(agentId)`, `describeScopedMaps`). The 113k tool block precedes it and could be shared, but only if the provider routes them together.
- **Usage is not observable**: `usage = message.usage` overwrites on every call (piAgentRuntime.ts:440). `stats.usage` is the last call only, so neither total input nor cache-hit rate is recorded anywhere. Nobody can currently measure whether caching works.
- No timestamps or random IDs appear in the system prompt. Tool order is registry order, which is deterministic. `antigravityToolEnumPayload` is deterministic.

## Q4. Tool result sizes and history

Measured on a blank project after `author_village` (78×44, 8 houses) and on a real 16-map QA project:

| Tool | tokens sent | note |
|---|---|---|
| get_map_region full 78×44 | 1,155 | ASCII grid, compact |
| get_map_region 100×100 (backup) | 2,257 | **truncated** at 12,000 chars |
| get_database_records items | 3,543 | |
| get_database_records include=full | 3,604 / 3,877 | raw 286,409 / 21,834 chars, **truncated** |
| run_lint | 3,376 | 43 warnings + 13 info, all listed |
| find_tools "마을" | **4,680** | returns the **full parameter schemas** of 6 matches, which are then also declared in `tools` |
| list_npc_graphics | 1,641 | |
| get_project_summary | 310 / 864 | |

- Truncation: `DEFAULT_MAX_DATA_CHARS = 12_000` (toolAdapter.ts:63, 84-89, 91-106). It is a **raw string slice**, so the model gets invalid JSON (about 3.6k tok) plus a hint to re-read. That costs a second call after already paying 3.6k.
- `find_tools` pays twice: the schema text sits in history for good as a tool result, and is re-sent in the tool block on every later call.
- `read_tileset_reference` attaches **every reference image as base64** content (toolAdapter.ts:180-185), and the system prompt instructs the model to read it before any tile placement (systemPrompt.ts:43). I could not measure the size because the blank project has no categories.
- **There is no compaction, pruning or transformContext** (piAgentRuntime.ts:324-354; the agent-core compaction module is unused). Every tool result and image stays in context until the run ends. Input cost grows quadratically with turns: `DEFAULT_MAX_TURNS=200` (line 67), and team builders get 300 (teamSpec.ts:46).
- Per call, `inspectPromptPayload` deep-scrubs and pretty-stringifies the whole outgoing payload and emits it (piAgentRuntime.ts:340-342, promptInspection.ts:33-57). That is CPU and wire overhead that scales with history (about 450 KB or more per builder call).

## Q5. Team mode duplication

Fixed per-call prefix by role:

| Role | Prefix tokens |
|---|---|
| orchestrator | 4.5k (3 registry tools plus about 6 custom tools, custom part estimated at ~0.9k) |
| builder | **117.1k** (full catalog, plus the index that duplicates the names) |
| reviewer | 13.9k (all 77 read tools) |

- Every builder re-sends the same 113k schema block, and none of it is shared, because there is no cache key.
- The reviewer only needs get_map_region and run_lint per its prompt (team.ts:84-90), yet it gets 77 read tools.
- Ultrabrain harmony review (ultrabrainReview.ts:158-178) makes **2 vision calls per changed map**, each with a full-map image at `detail:"high"`: first Vision, then Ultrabrain, which re-sends the same image. A village request produces one exterior plus N interiors, so that is 2×(N+1) image calls. A recheck is limited to failed or repainted maps (aiPiAgentCommand.ts:608-612).

## Illustrative totals (no caching, history +1.8k per call; the call counts are assumptions)

| Scenario | Input tokens |
|---|---|
| Question turn, 4 calls | ~70k |
| Village create, non-routine (intent 2, plan 4, exec 12) | ~342k |
| One harmony repair run, 10 calls | **~1.25M** |
| Team (orchestrator 10, 2 builders × 20, reviewer 2 × 5) | **~5.7M** (about 4.7M of it is repeated builder schema) |

## Fix candidates (ranked)

1. Pass the intent-selected `initialToolNames` (or a role-specific set) to team builders and to the harmony repair run. That saves about 105k tok per call.
2. Make an empty `find_tools` search return a hint instead of expanding to the full catalog.
3. Hoist COMMAND_SCHEMA and the NPC pages schema to shared `$defs`/`$ref` if the providers accept it, or slim them. That removes about 22k tok.
4. Pass `sessionId` (a stable run id) to `Agent` so Codex gets a `prompt_cache_key`. Declare discovered tools in a way that keeps the prefix stable, for example by appending tools only at turn boundaries.
5. Accumulate usage per call, including cacheRead, instead of overwriting it.
6. Give question and plan turns a small read set instead of all 77 read tools. Give the reviewer only the tools its prompt names.
7. Replace the raw-slice truncation with structure-aware truncation. Make `find_tools` return names and short descriptions, not full schemas.
8. Add a transformContext that elides old large tool results and images.
