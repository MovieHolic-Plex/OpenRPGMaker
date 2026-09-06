# AI async test repair journal

Base: 3f7b89d64. Branch: agent/ai-seven-async. Production is unchanged in the deliverable.
All requests are intercepted; store remote persistence is disabled in repaired tests.

## Diagnosis

Initial independent hypotheses: intent JSON consumed as chat SSE; forced OAuth/model
normalization changed transport; fixed flush loops observed an unfinished turn.

`baseline-red.json`: 3 failures / 8 passes, exit 1, exact two requested suites.
Temporary TRACE instrumentation (removed) recorded request routing and terminal
activity in `trace-red.log` / `trace-red.json`, again 3 failures / 8 passes.

Runtime facts: the old tests request /v1/chat/completions using gemini-3.7-flash,
first intent, then planner, then execution. SSE bodies produce "Unexpected token
'd' ... is not valid JSON"; both observability turns end error with zero tools.
Refused fetch completes planner attempts at offsets 0/1500/4500/9000 ms, then
starts execution attempts. The 8 x 1500ms polling loop exits during execution.
401 reaches terminal error, explaining its old passing status.

Source/history:
- 0ce663cb3: loadAiConfig forces OAuth, ignores stored API keys/base URL, normalizes
  invalid models. Setting authMode:apiKey in localStorage is NOT a valid repair.
- e75c03013: each panel turn has a separate non-streaming structured intent request.
- 3668d572c: balanced autonomy enables orchestration even with agentMode:chat.
- abbb74e0b: session retries each model round three times with increasing backoff.
- assistantSession.runTurnLoop suppresses streaming for execution phase. Valid
  single-step intent skips planning and retains the intended streaming chat loop.
- aiTurnRunner publishes terminal recordAiActivity after controls/ghost cleanup.
  whenAiChatPanelSettled tracks boot/persistence only and is awaited BEFORE click.

## Repair and proof

`fixture-green.json`: first run of repaired fixtures, 11/11 pass, exit 0.
Actual panel -> session -> transport parser -> real registered tools -> draft/apply
remains intact. Only fetch and activity persistence are stubbed. Intent cache,
store and conversation state are isolated. Exact pre-click terminal subscription
replaces every fixed flush/poll loop in these suites. Refused fetch intentionally
runs real production retries (9 seconds total backoff), bounded by terminal timeout;
there is no test sleep, timer polling, or timing-based success assertion.

Temporary mutations (not for integration), recorded in mutation.patch:
1. Reuse first merged reasoning item instead of appending a separate item.
2. Disconnect aiTurnRunner's successful tool_call -> ghost updater callback.
3. Omit settingsAction from recovery actions (retain retry/terminal handling).
Each targets the actual production seam; no test name/assertion is disabled.
Mutations are restored before final GREEN, typecheck and commit.

## Verification ownership

File LSP diagnostics: both clean. App typecheck exit 0.
An initial combined app/full-test typecheck command exceeded the 120s command
budget during full-test checking (no result claimed). Scoped test+app tsc includes
all src and exactly the two changed test entrypoints; its output is retained.
Lead owns full build/gates and real-browser QA. Lead reports baseline recovery
passed at http://127.0.0.1:43791/?blankProject=1 with no pageerrors and screenshot
.omo/evidence/ai-seven/transport-error.png in the lead worktree (not child-run QA).

Final proof: mutation-red.json is exit 1 / 4 failures / 7 passes. Reasoning fails
with 1 item instead of 2; ghost has no observed previews despite successful apply;
both transport tests fail exactly at missing settings CTA. Production mutation
patch restored cleanly (git diff --exit-code on both production files is 0).
final-green.json is exit 0 / 11 passes / 0 failures after restoration.

Additional assertion-format-red.json records a test-authoring correction, not a
product defect: error DOM uses line-break elements, so textContent concatenates
lines. Comparing the entire runtime error now removes newlines from the expected
value, preserving shipped error content without pinning generated prose.

Typecheck baseline proof: temporarily reverse the test diff, run the same scoped
tsc, then reapply. Baseline: two source timer errors plus three getChatDock test
errors. Final: only the identical two source timer errors. App tsc remains exit 0;
changed tests have zero LSP or tsc errors. Full test-inclusive tsc is NOT claimed
green. The unrelated timer errors were not suppressed, skipped, or edited.

Lead additionally reports baseline reasoning and ghost browser PASS, no pageerrors:
.omo/evidence/ai-seven/reasoning.png and ghost-preview.png in lead worktree.
No child browser execution or full build/gates is claimed; those remain lead-owned.

Committed console logs omit ANSI color codes and trailing whitespace only; JSON
reporter evidence is unchanged. All error messages and outcomes are retained.
