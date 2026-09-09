st_01a07773 [completed] model gpt-6-astra (reasoning max, variant max)
## REQUEST_CHANGES - P1: Antigravity tool-schema enum transport

Candidate `08c60dc68625c66ac2b7aa61799b27eaa4cf25aa` still needs this focused repair. **Encode integer enum members as protobuf strings on the provider wire, while retaining numeric enums in the registered/local JSON Schema.** Do not change models or tool argument types.

No source edits, commits, merges, game/tool execution, or DB/browser writes were performed. The locked review tree remains clean at the candidate head.

### 1. Demonstrated failure and ownership

The captured execution request contains 48 tools. Its HTTP 400 rejects twelve numeric values across these four fields:

| Tool | Parameter path | Local contract |
|---|---|---|
| `author_house` | `stories` | integer, `[1,2,3]` |
| `author_house` | `houses[].stories` | integer, `[1,2,3]` |
| `start_interior_room_session` | `exterior.stories` | integer, `[1,2,3]` |
| `run_interior_room_pipeline` | `exterior.stories` | integer, `[1,2,3]` |

Evidence: round4 `llm-response-0.txt:1`, `offending-schema-enums.json:1-38`; registered definitions in `src/editor/tools/authorHouseToolDef.ts:44-47,114-116` and `src/editor/tools/interiorRoomSession.ts:50-57,156,238`.

The application currently forwards those schemas unchanged to pi-ai and supplies no dialect correction at `scripts/lib/ohMyPiPiAiRuntime.ts:119-127,223-227`.

Installed **pi-ai 17.4.0** takes different paths:

- **Claude:** `normalizeSchemaForCCA(toolWireSchema(tool))` directly.
- **Gemini:** `normalizeSchemaForGoogle(...)`, followed by CCA normalization for Antigravity.
- Google normalization **deletes non-string enums**; CCA normalization retains these numeric enums.

Evidence: installed `@oh-my-pi/pi-ai/src/providers/google-shared.ts:366-392`, `google-gemini-cli.ts:1201-1218,1332-1334`, and `utils/schema/normalize.ts:568-573,1096-1140`. Both branches were executed against the full captured tools in this turn.

Consequently, adding Google normalization to the Claude path would hide the 400 by losing membership constraints. That is not a repair.

### 2. Correct dialect encoding, verified

For this legacy CCA `parameters` wire:

```text
Registered/local JSON Schema: type: "integer", enum: [1, 2, 3]
Provider protobuf JSON:       type: "integer", enum: ["1", "2", "3"]
Returned/local argument:      stories: 2
```

The string representation belongs to the **schema's protobuf enum field**, not the argument contract. Google's published [`openapi.proto:92-98`](https://github.com/googleapis/googleapis/blob/master/google/cloud/aiplatform/v1/openapi.proto#L92-L98) explicitly illustrates an INTEGER enum encoded as strings; that source was fetched in this turn.

More importantly, the actual Antigravity route was exercised:

- **Full captured 48-tool set:** retained every schema, replaced conversation text with neutral `READY`, and changed only the four outgoing enum arrays after SDK normalization. One provider request returned **HTTP 200, `READY`**.
- Wire model: `claude-opus-4-6-thinking`; SDK completion model: `claude-opus-4-6`.
- **Separate small read-only echo:** HTTP 200, `stopReason: toolUse`, with numeric arguments `stories:2`, `houses:[{stories:3}]`, `exterior:{stories:1}`, `neighborhood:8`.
- No returned call was executed. Original schemas remained unchanged; the full-set probe also asserted the auth file was unchanged.

These are transport proofs, not game acceptance.

### 3. Bounded repair contract

Implement this in the application-owned completion adapter, using pi-ai's **post-normalization `onPayload` seam**, immediately before serialization. That seam is called after `buildRequest` and before `JSON.stringify` at installed `google-gemini-cli.ts:585-600`.

Requirements:

1. **Scope to Antigravity's legacy `functionDeclarations[].parameters` dialect.** Do not apply protobuf encoding to Codex or arbitrary `parametersJsonSchema` payloads.
2. Retain original numeric-enum paths and members from the input schemas. On a fresh outgoing payload copy, encode the currently shipped safe-integer enums:
   - the four `[1,2,3]` fields above;
   - `upsert_autotile_group.group.neighborhood: [4,8]`, defined in `tilesetAtlasSchemas.ts:26`.
3. Handle both Antigravity branches at this same boundary. Claude still has numeric members; Gemini has already deleted them. **Restore Gemini's exact original membership on the surviving integer field**, then encode it. Do not reconstruct or replace the whole schema.
4. Leave registered schemas, other fields, requiredness, descriptions, string enums, message/image content, argument objects, model selection, and acknowledgement behavior untouched.
5. **Fail closed when preservation is impossible.** Empty/mixed/unsupported numeric enums, an unmappable enum-bearing field, changed type, or incompatible normalized membership must produce an explicit HTTP 400 schema-transport error identifying provider/model/tool/path, before fetch. No enum deletion, `{}` fallback, model fallback, or success/image acknowledgement.

A source-aware prototype was executed through the real SDK for **both Opus and Gemini**, using all 48 captured tools plus the sparse-enum tool: five enum leaves retained, numeric response arguments preserved, repeated encoding idempotent, source schemas unchanged. Unsupported-shape and lost-field/type/membership countercases rejected. An actual SDK `onPayload` failure probe produced `stopReason:error`, `errorStatus:400`, the explicit field error, and **zero fetches**.

This is one bounded enum adapter, not a general schema-normalization framework.

### 4. Required regression evidence

Use the independent child's real-SDK test as the red foundation:

```text
cd /home/main/z-project/rpg-zzu-ai-provider-enum-0907
bun test test/ohMyPiNumericEnum.bun.test.ts
```

Executed here: **2 passed, 1 failed**. The failure reproduces:

```text
Cloud Code Assist API error (400)
...properties[houses].items.properties[stories].enum[0]:
expected TYPE_STRING, received 1
```

It also captures Gemini's missing enums. The exception surfaces at `scripts/lib/ohMyPiPiAiRuntime.ts:151`, from `completeProvider:228`.

The finished regression must establish:

- All **48 captured tools**, unchanged names/order, traverse the production adapter and real installed SDK; only fetch is mocked.
- All four offending wire fields retain integer type and exact string-encoded membership; the actual `[4,8]` field also retains membership.
- SDK response parsing and application argument serialization preserve numeric leaves.
- Original registry and request schemas remain unchanged; Codex/string-enum/image controls remain intact.
- Unsupported translation fails explicitly before fetch.
- The implemented production path repeats the full-set read-only Opus provider check, not merely a toy-schema check.

**Local-validation countercases must use the shipped normalization plus actual parsers**, not just a synthetic leaf validator. The generic validator is shallow (`jsonSchema.ts:225-270`); nested house/interior membership is enforced by `construction/parseHouseRequest.ts:197-204` and `roomHarness/interiorKit.ts:90-103`.

Executed here, without running tools:

- All four placements accept numeric `1,2,3`.
- They reject `0,4,1.5,"4",true,null`.
- Existing `"2"` → numeric `2` argument normalization remains valid; do not accidentally remove it.
- `[4,8]` rejects `6`.
- Changing the **local** integer enum to strings rejects both numeric `2` and string `"2"`.

The strongest countercase was **non-contiguous `[4,8]`**: replacing membership with a range, or deleting the enum, incorrectly admits `6`.

Existing baseline image-wire tests were also executed:

```text
bun test test/ohMyPiImageTransport.bun.test.ts
15 passed, 0 failed
```

That is baseline evidence only. Preserve and rerun the protected R1-R15 regressions after implementation; no all-gates pass is claimed here.

### 5. Abort/deadline follow-up is separate

The earlier five browser-aborted requests are **neither confirmed 200s nor confirmed provider 400s**. Round4 `first-harness.json:60-88` records intent fallback after **10,225 ms**, followed by planner network errors and retries. The configured intent deadline is **20,000 ms** (`intentDeclarationClient.ts:27,90-91`); the general request deadline is **180,000 ms** (`llmClient.ts:757,924-936`).

**No deadline defect is established by these receipts.** Keep deadline changes out of this repair. A separate transport investigation needs request-start capture and browser/worker/upstream correlation, including the abort initiator and reason; response-only recording cannot settle those aborted requests.

**Disposition:** repair the legacy enum boundary under this contract. R6 and R16 remain unfulfilled; neither the successful probes nor this review approve the game.
