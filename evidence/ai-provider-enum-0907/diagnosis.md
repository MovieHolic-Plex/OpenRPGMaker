# Historical phase: Opus numeric-enum HTTP400 diagnosis and red regression

This is the original pre-implementation receipt. Its pre-SDK encoding proposal
was superseded by the final ultrabrain review's POST-normalization onPayload
contract. See `review-contract.md` and `implementation.md` for the authorized,
verified repair and live probe. Statements below describe the earlier phase.

Task: st_01a07772. Base: `08c60dc68625c66ac2b7aa61799b27eaa4cf25aa`.
Worktree: `/home/main/z-project/rpg-zzu-ai-provider-enum-0907`.
Installed `@oh-my-pi/pi-ai` and catalog: 17.4.0. Bun: 1.4.2.
No production behavior change, dependency patch, environment edit, DB/browser
operation, live LLM/game API request, commit, push, PR or merge was performed.
No server was started or stopped; port 9841 was not touched.

## Confirmed live incident, distinct from local reproduction

The parent QA receipt in
`/home/main/z-project/rpg-zzu-ai-playable-adversarial-0906/output/evidence/ai-playable-final/round4/`
contains the full execution request, exact HTTP400 response, and offender map.
`REPORT.md` confirms 48 tools, requested `claude-opus-4-6`, zero proposed/applied
tool calls, and failure before game authoring. Source/fixture hashes are in
`test/fixtures/oh-my-pi/README.md`; the complete tools array is retained there.

The live provider returned `INVALID_ARGUMENT` and TYPE_STRING violations for
all three values at each of these four locations (12 violations):

| Captured tool index/name | Canonical parameter path | Values |
| --- | --- | --- |
| 0 author_house | properties.houses.items.properties.stories.enum | [1,2,3] |
| 0 author_house | properties.stories.enum | [1,2,3] |
| 18 start_interior_room_session | properties.exterior.properties.stories.enum | [1,2,3] |
| 20 run_interior_room_pipeline | properties.exterior.properties.stories.enum | [1,2,3] |

The allTools registry contains 230 tools. Its fifth numeric-enum path is
`upsert_autotile_group.parameters.properties.group.properties.neighborhood.enum`
with [4,8]; this tool was NOT in the captured execution request. All five
numeric-enum paths are active, not deprecated.

Earlier intent/planner calls are a separate observation: five browser
`NS_ERROR_ABORT` failures, an intent NetworkError fallback and planner retries.
They have no captured response status/body or correlated upstream request IDs.
They are neither confirmed HTTP400s nor confirmed successful text calls.
The parent's separate text/three-image HTTP200 smoke tests do not change that.

## Mechanism and source pointers

1. `src/editor/tools/authorHouseToolDef.ts:44-46,114-117` shares integer enum
   [1,2,3] between single-house and houses[] schemas.
   `src/editor/tools/interiorRoomSession.ts:50-57` shares exterior.stories.
   `src/editor/tools/tilesetAtlasSchemas.ts:21-26` owns neighborhood [4,8].
2. `src/editor/tools/toolRegistry.ts:226,517-530` exposes schemas with reason
   injection; `src/ai/assistantSession.ts:3591-3645` assembles the turn's tools.
   `src/ai/llmClient.ts:511-531` forwards them in the OpenAI-shaped request.
3. `scripts/lib/ohMyPiPiAi.mjs:65-78,113-116` forwards to the Bun worker;
   `scripts/oh-my-pi-worker.ts:26-31` calls completeProvider.
4. `scripts/lib/ohMyPiPiAiRuntime.ts:119-130` passes parameters unchanged into
   SDK tools; `:196-229` resolves the model and calls real complete().
5. Installed SDK `src/utils/schema/wire.ts:601-609` upgrades/caches raw schemas.
   `src/providers/google-shared.ts:372-393` branches on `model.id.startsWith("claude-")`:
   Claude uses normalizeSchemaForCCA -> parameters; Gemini uses
   normalizeSchemaForGoogle -> parametersJsonSchema.
6. Installed SDK `src/utils/schema/normalize.ts:1096-1150` sets
   `stringEnumsOnly: true` for Google but NOT for CCA. Its `:568-572` helper
   DROPS non-string enums rather than encoding them. CCA retains numeric enums.
7. Installed SDK `src/providers/google-gemini-cli.ts:1200-1219,1332-1334`
   converts Antigravity Gemini declarations to legacy parameters as well.
   Gemini's enum has already vanished; Claude's numeric enum survives.
   Native `providers/anthropic.ts` input_schema normalization is NOT this route.
8. The outbound Google protobuf parser rejects numbers in repeated string enum.
   `google-gemini-cli.ts:964-983` preserves HTTP status in the SDK error;
   `ohMyPiPiAiRuntime.ts:150-153` throws it back to the companion caller.

## Correct provider dialect (not string-valued tool arguments)

Google's published schema explicitly documents INTEGER enums with string members:
https://github.com/googleapis/googleapis/blob/master/google/cloud/aiplatform/v1/openapi.proto
Read directly from the public raw source during this task, lines 92-98:

```proto
// Optional. Possible values of the element of primitive type with enum
// format. Examples:
// 1. We can define direction as :
// {type:STRING, format:enum, enum:["EAST", NORTH", "SOUTH", "WEST"]}
// 2. We can define apartment number as :
// {type:INTEGER, format:enum, enum:["101", "201", "301"]}
repeated string enum = 9 [(google.api.field_behavior) = OPTIONAL];
```

Required numeric-leaf wire representation for this incident:
`{type:"integer", enum:["1","2","3"]}` (and ["4","8"] for neighborhood).
The INTEGER type remains numeric; enum member spelling belongs to the Google
Schema transport dialect, not canonical JSON Schema. Do not feed this wire
schema back into local JSON Schema validation. The SDK strips format metadata;
adding format alone cannot fix a number in a repeated-string protobuf field.

An in-memory-only experiment cloned ALL 48 captured tools, string-encoded the
four integer-enum leaves, and passed them through real completeProvider/SDK
with controlled fetch and an SSE functionCall response. Both Gemini and Opus
retained 48 declarations, top-level and nested integer type + ["1","2","3"],
and returned `{kind:"single",mapId:"offline",stories:2}` with a NUMBER 2.
This establishes SDK compatibility, not live backend acceptance. No production
file or node_modules file was changed for that experiment.

## Regression and verification

Exact failing command (one execution, no retry-to-green):

```sh
bun test test/ohMyPiNumericEnum.bun.test.ts test/ohMyPiImageTransport.bun.test.ts
```

Result: exit 1; **17 pass, 1 intentional fail, 125 assertions**.
Full exact output: `red-test-output.txt` alongside this report.
Failure: `Cloud Code Assist API error (400)`, status 400, at
`assistantToOpenAI (.../ohMyPiPiAiRuntime.ts:151:21)`.
The controlled parser derives 12 violations from the REAL serialized body;
it is not an unconditional mock rejection. Each model made exactly one fetch.
Gemini: wire model gemini-3.7-flash-low, 48 tools, four enums absent, accepted.
Opus: wire model claude-opus-4-6-thinking, 48 tools, numeric enums, rejected.
The red assertion propagates the real SDK/adapter exception. After HTTP400 is
fixed, assertions still require enum retention on BOTH model routes, numeric
returned arguments, unmutated captured/live schemas and unchanged tool order.
No returned tool calls are executed.

The passing local-validation control reads the five LIVE registry leaves;
valid numeric members pass, strings fail direct strict validation, and 7/1.5
fail. Existing normalizeArgsForSchema can coerce numeric strings before the
runner's validation; this existing behavior is not changed or disguised.
validateArgs is shallow: the test wraps each real leaf to verify its membership
rule, not to claim global recursive runner validation. Nested native parsers
also exist (`roomHarness/interiorKit.ts:97-102`, `tilesetAtlasTools.ts:337-340`).

`npm test -- test/toolSchemaProviderCompat.test.ts`: 6/6 passed, exit 0.
Those tests check schema shape/union restrictions, NOT this SDK wire dialect;
passing them did not prevent the incident.
TypeScript LSP: no diagnostics on the new test. JSON LSP unavailable (biome not
installed); Python JSON parsing and exact 48-tool value equality passed instead.
No tool/dependency was installed. git diff --check passed. Production build and
live UI acceptance were not run: this is deliberately a red-test-only handoff.

## Abort/deadline follow-up: separate investigation, no timeout fix justified

`intentDeclarationClient.ts:27,91` has a 20,000ms local intent deadline. The
captured intent fallback reported NetworkError at **10,225ms**, not its timeout
message. `llmClient.ts:757,925-947` has a 180,000ms fetch deadline and distinct
timeout handling. Planner start 15:51:06.208Z to error 15:52:13.641Z is **67.433s
total**, including retries; no per-attempt upstream timing is captured.
`assistantSession.ts:3491-3547` permits three transient retries after the first
attempt. The 30s timer in `ohMyPiPiAi.mjs:61` is worker STARTUP, not completion.

Thus the receipt warrants a separate browser/companion abort-correlation
investigation, but DOES NOT establish that these configured deadlines caused
the failures or should be raised. Do not attribute all aborted calls to enum
HTTP400 or bundle deadline changes into this fix. Required future evidence:
correlated browser/companion/worker request IDs, per-attempt start/end times,
and the actual abort source/reason. Existing data cannot supply them.

## Focused ultrabrain request / proposed minimal fix contract

Review this boundary decision before authorizing implementation:

- For the existing google-antigravity CCA route, clone tool parameters at the
  application completion-adapter boundary, BEFORE SDK normalization can strip
  Gemini enums. Recursively encode numeric enum members as strings only in
  schema nodes for numeric types; preserve integer/number type, members/order,
  required fields, tool names/order and unrelated schema content.
- Do not mutate canonical registry schemas, input requests, messages, history,
  returned arguments or local validation. Do not traverse instance data such
  as default/examples as schema, or confuse property names with keywords.
- Do not globally stringify tool arguments, erase enums, replace schemas with
  empty objects, downgrade models, patch node_modules, or change native
  Anthropic/OpenAI JSON Schema encodings. Provider routing must be explicit;
  any extension beyond this CCA route needs its own dialect evidence.
- Verify this red test with all 48 captured tools and the full live numeric-enum
  inventory, including [4,8] and nested arrays/objects. Preserve strings and
  non-enum nodes, request immutability, and strict local rejection of invalid
  numeric membership. Add focused boundary tests for those cases during deep
  implementation rather than treating a single toy schema as acceptance.
- After approval: deep implementation, focused tests/diagnostics/build, then
  authorized read-only real-provider probe with all captured tools + READY,
  with no returned tool execution. Finally re-run matched-candidate user-visible
  acceptance; controlled fetch is not proof of live Google acceptance.
- User final approval remains required before merge. This handoff is neither
  implementation authorization nor merge/acceptance approval.
