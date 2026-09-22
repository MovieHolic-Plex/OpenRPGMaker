# AI assistant — measured real runs (efficiency axis)

Source: `/home/main/z-project/rpg-zzu/output/ai-activity/` (read-only). Script: `/tmp/aiperf/runs_analyze.py`. Chart data: `/tmp/aiperf/runs.json`.
Window: `at >= 2026-08-24`, which gives 1,220 records. The newest record is **2026-09-17T23:32Z**, so nothing has been logged in the 5 days before today (09-23).

| channel | n | what it is | used? |
|---|---|---|---|
| `pi` | 41 | Pi agent path (oh-my-pi worker). Default since 09-10. Records run 09-11..09-17 | yes, as the Pi population |
| `chat` / `region` | 169 / 25 | older in-browser `assistantSession` path. Records run 08-28..09-10 | yes, as the session population (172 turns with at least one model response) |
| `other` | 581 | `[play-boot]` runtime telemetry | excluded |
| `ui` | 404 | UI click events | excluded |

**How the Pi runs were told apart:** only by `channel === "pi"`. `src/ai/piAgent/activityLog.ts` is the only writer of that channel.

## 0. Headline caveat: the Pi path is nearly unmeasured
- For Pi, `startPiRunLog().finish()` saves `toolCalls` = **one entry per sub-agent** (`pi:팀장` / `pi:시공` / `pi:검수`). Each entry carries only a summary string like `"24턴/29툴콜 · 오류 2"`.
- Per-tool names, args, ok flags, timings, and token `usage` are all missing.
- The runtime does collect `stats.usage`, `stats.ms` and a per-agent `log` (`scripts/lib/piAgentRuntime.ts:440,498`, `TeamBoardAgent.stats/log`). The activity log drops them.
- `usage` is also overwritten on every message (`if (message.usage) usage = message.usage`). So even if it were saved it would hold only the **last** turn's usage, not the run total.
- **As a result, none of these can be computed for the Pi path from the logs:** tokens, tool mix, duplicate calls, or the latency split. Those sections below use the session path, which used the same Gemini Flash models and a comparable tool registry. That data is from before 09-10, so read it as a proxy.

## 1. Pi path (n=41, all `gemini-3.8-flash`; 35 team runs, 6 single)
Wall time is the gap between the pending row and the first final row in `activity.jsonl`.

| metric | p50 | p90 | max | sum |
|---|---|---|---|---|
| wall time (s) | 186 | 711 | 3,389 | 14,042 (3.9 h) |
| turns, summed over sub-agents | 32 | 108 | 228 | 1,913 |
| tool calls, summed over sub-agents | 42 | 177 | 252 | 2,612 |
| sub-agents per run | 3 | 8 | 22 | 178 |
| tool errors per run | 0 | 7 | 12 | 71 (2.7% of calls) |

**Outcomes**

| outcome | runs |
|---|---|
| applied (적용됨) | 18 |
| failed (ok=false) | 12, plus 1 ok=false that was applied |
| waiting for review (검토 대기) | 7 |
| answer only (답변) | 2 |
| no change (변경 없음) | 1 |

- **Runs that did not end as ok + applied:** 23 of 41 (56%). This counts 1 run that errored after its apply.
- Those 23 runs used **1,466 of 2,612 tool calls (56%)**, 1,107 of 1,913 turns, and **9,411 s of 14,042 s wall time (67%)**.
- Some of the 7 review-pending runs may have been applied later outside the log. The mirror keeps the last row per id, and those rows say not applied.

**Failures:** 13 runs, 663 tool calls, 2,288 s.
- 4× `terminated`
- 4× `network error`
- 2× worker 30 s silence watchdog
- 1× **stale-base**
- 2× commit-rejected: "Canonical AI acceptance requires an issued tool proposal", and a serialization round-trip failure on a missing switchId

**The largest failed run** (`c4fff44f`, 「실내를 만들고…숲이랑 이어지게」) ran 228 turns, 252 tool calls, 15 sub-agents and 439 s, then was thrown away by stale-base at apply time.

**Per role**

| role | n | turns p50 / p90 / max | tool calls p50 / p90 / max | errors |
|---|---|---|---|---|
| 시공 (builder) | 56 | 24.5 / 41 / 49 | 29 / 72 / 97 | 69 of the 71 |
| 팀장 (lead) | 35 | 5 / 17.6 / 57 | 8 / 17.6 / 58 | — |
| 검수 (reviewer) | 87 | 0 / 11 / 11 | — | 9 in state 실패 |

- **Builders do the work:** 1,336 turns and 1,852 tool calls.
- **Reviewers:** 59 of 87 spent 0 turns, meaning a deterministic check.
- **Review loop:** 116 `검수 지적` findings across 23 runs. 9 runs spawned 2–5 builders, i.e. fix rounds.
- **Killed mid-work:** 19 sub-agents in 10 runs were still `실행 중` when their run ended.
- Other: 4 out-of-scope spill drops and 1 map conflict.

## 2. Session path (chat/region): 172 turns, 08-28..09-10, gemini-3.7-flash ×104 / 3.8-flash ×68

| metric (all 172 turns) | p50 | p90 | max | sum |
|---|---|---|---|---|
| wall (s, turn slice) | 32.6 | 148.5 | 3,705 | 17,216 |
| model calls, main loop (count of `assistant` entries) | 8 | 26.9 | 49 | 2,038 |
| tool calls | 9 | 40.9 | 81 | 2,674 |
| output tokens (estimated `출력 토큰 ~N`, n=144) | 761 | 3,592 | 8,184 | 189,289 |

**Token-instrumented subset:** n=23 turns carrying `context:grounded` lines. Those lines are emitted just before each model call (`assistantSession.ts:4843`). Their `inputTokens` is a chars/4 estimate, not provider usage. Provider usage is absent: `run-recap` shows `prompt:0, missingUsage=calls`.

| metric (n=23) | p50 | p90 | max | sum |
|---|---|---|---|---|
| model calls | 9 | 44.6 | 48 | 336 |
| tool calls | 10 | 60.6 | 70 | 449 |
| input tokens, first call | 283,846 | 370,595 | 390,227 | — |
| input tokens, largest single call | 315,883 | 592,587 | 673,177 | — |
| **input tokens, sum per turn** | **2.21 M** | **17.7 M** | **24.7 M** | **130.3 M** |
| input tokens per tool call | 299 k | 623 k | 708 k | — |
| tool-schema tokens per call | 69,954 | 87,860 | 95,175 | 24.5 M (**18.8%** of all input) |

**The fixed prefix is the cost driver, not growth.**
- Even the first call of a turn is about 280–390 k tokens. That is tool schemas (~70 k) plus grounded project context and history.
- In the 11 turns with at least 10 calls, growth per call is only +0.6 k to +11.6 k tokens.
- If every call had stayed at the first call's size, those turns would already cost **77.4%** of what they actually cost.
- So cumulative cost is about linear in call count with a very large intercept. It is not quadratic.
- One *auto-compaction line* per turn appears in 74 of 172 turns, e.g. `211,673 -> 97,435 tokens`.

**Per-call input series** (full arrays in `runs.json → session.per_turn_series`):
- `6c8d5ffc` 「무기상점 만들어 무기 5개는 팔아야댐」: 48 calls, 70 tools. 294,076 → 672,553, a steady ~+10.5 k per call. Cumulative **24.5 M**.
- `95928d39` 「여기다가 마을을 .. 좀 만들긴해야할거같은데」: 48 calls, 59 tools. 372,637 → 615,210. Cumulative **24.7 M**.
- `05598a50` 「집깔아바」: 21 calls, 19 tools. 233,362 → 340,679. Cumulative 6.1 M, and the run ended in error.

**Time split** (23 instrumented turns, 3,224 s):

| part | seconds | share |
|---|---|---|
| model latency in the main loop | 2,174 | 67.4% |
| tool execution | 483 | 15.0% |
| other harness gaps | 568 | 17.6% |

- Model latency is measured from `context:grounded` to the `assistant` entry: n=336, p50 5.8 s, p90 9.4 s, max 47.5 s.
- Tool execution is the gap after the response: p50 0.35 s, p90 1.7 s.
- The "other" 568 s includes further LLM calls: intent classifier 156 s, independent reviewer 91 s, compaction 48 s, planner 44 s. **Counting those, LLM time is about 78%.**

**Tool mix** (2,674 calls in 172 turns)
- **Reads:** 974 (36%).
- **Writes:** 1,279 (48%).
- **Harness bookkeeping:** 421 (16%). These tools are not in the registry: `set_build_spec` 259 (82 failed), `complete_work_item` 107 (53 failed), `repair_acceptance` 30, `set_work_plan` 22.
- **Failed (ok:false):** 643 (24.0%). The median per-run failure rate is 22.9% (runs with at least 10 calls, n=84).
- **Refusal-like** (summary or issue text matching 거부/차단/refus…): 136 (5.1%).

**Top tools by count**

| tool | calls | failed |
|---|---|---|
| place_npc | 271 | 144 (53%) |
| set_build_spec | 259 | 82 |
| run_lint | 142 | 0 |
| get_map_region | 113 | — |
| show_map_region | 112 | — |
| fill_region | 110 | 47 |
| complete_work_item | 107 | 53 |
| find_tools | 107 | — |
| place_props | 98 | — |
| get_database_records | 82 | — |

Other high failure rates: author_house 76 calls / 40 failed, author_village 52 / 40 (77%), define_quest 50 / 41 (82%).

**Top tools by time** (sum of gaps capped at 60 s)

| tool | capped seconds | note |
|---|---|---|
| place_npc | 381 | raw sum 4,051 s because of one 3,509 s gap on a "스펙 게이트 차단" call |
| run_lint | 380 | p50 0.65 s, p90 5 s |
| show_map_region | 133 | |
| author_house | 128 | |
| get_map_region | 115 | |
| set_build_spec | 111 | |
| author_npc_cast | 90 | p50 8.6 s per call |

Tool execution is small next to model time.

**Identical repeated calls** (same tool and same args within one turn): 308 of 2,674 (11.5%).

| tool | repeats |
|---|---|
| run_lint | 88 (62% of its 142 calls) |
| evaluate_game_quality | 26 |
| show_map_region | 25 |
| place_npc | 13 |
| check_reachability | 13 |
| fill_region | 12 |
| tile_query | 11 |

The cost of a repeat is not the tool time, which is sub-second. It is **one extra ~300 k-token model round-trip** when the repeat lands in a new round.

**Waste turns**
- 95 of 172 turns left no project trace: no commitIds, no appliedCalls, no changed cells, no milestone. Many of those are Q&A.
- **10 turns made 20 or more tool calls and still changed nothing.** Together they account for 401 tool calls and 1,901 s.
- In the token subset, 17 of 23 turns ended with no change, and they used **64.6 M of 130.3 M input tokens (49.6%)**.
  - Largest: `7f8d1668` 「마을을 만들어」 17.8 M, error.
  - `192d11f8` 장르 프리셋 17.0 M, error.
  - `579c6643` 6.2 M, error.
  - `05598a50` 6.1 M, error.
  - `6c451a55` 5.5 M, error.
  - The six largest are all `stopped=error`.

**Loops and retries, counted over all 172 turns**

| signal | count |
|---|---|
| `verification:unmet` / lint-error lines | 50, in 11 turns |
| review-phase entries | 110 |
| RALPH continue | 28 |
| volume-contract continue | 20 |
| acceptance repair | 21 |
| transient retry lines | 11 |
| stops at `max-tool-calls` | 10 |
| stops at `error` | 7 |
| stops at `aborted` | 2 |

## 3. Things that stand out
1. **The Pi path cannot be measured.** It is the default path, it had 41 runs, and there is zero token or per-tool telemetry on disk. The data exists in memory (`stats.usage`, `agent.log`) and the activity log discards it. `usage` is also last-message-only.
2. **56% of Pi runs, using 56% of its tool calls and 67% of its wall time, produced no applied change.** A third of those were infrastructure failures: terminated, network, watchdog. One 252-call run was lost to stale-base at apply time.
3. **The session path re-sends about 280–390 k tokens on every model call.** 18.8% of that is tool schemas. p50 is 2.2 M input tokens per turn, max 24.7 M. Growth inside a turn is mild; the fixed prefix is 77% of the cost.
4. **Half the instrumented input tokens (49.6%) went to turns that ended with no change**, mostly `error` stops after dozens of calls.
5. **Runtime is dominated by the model** (about 67–78%); tools are about 15%. Making tools faster buys little. Fewer model rounds and a smaller prefix buy a lot.
6. **1 in 4 tool calls fails.** Harness bookkeeping tools are 16% of all calls and fail often. `run_lint` is re-run with identical args 88 times.
