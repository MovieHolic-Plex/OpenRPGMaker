# Reviewed Antigravity integer-enum transport repair

Task st_01a07772; isolated branch `agent/ai-provider-enum-0907` at base
`08c60dc68625c66ac2b7aa61799b27eaa4cf25aa`. Implemented after the final focused
ultrabrain REQUEST_CHANGES, retained as `review-contract.md`. The historical
pre-normalization proposal in `diagnosis.md` is superseded, not implemented.

## Production change

- `scripts/lib/ohMyPiPiAiRuntime.ts` adds the provider-scoped `onPayload` hook
  only for google-antigravity requests with tools. Model resolution, messages,
  image conversion/acknowledgement, Codex and local argument handling are unchanged.
- `scripts/lib/ohMyPiToolEnums.ts` records original safe-integer enum paths and
  exact members before SDK normalization, then clones the outgoing payload and
  changes only enum arrays on legacy `functionDeclarations[].parameters` nodes.
  Claude's retained numeric arrays are encoded; Gemini's removed arrays are
  restored from source and encoded. Numeric field types remain integer.
- The sparse neighborhood membership remains [4,8], never a range admitting 6.
  Existing encoded arrays are checked and repeat application is idempotent.
- Empty, mixed, noninteger/unsafe/duplicate numeric enums fail explicitly.
  Missing/ambiguous declarations, lost fields, changed types and incompatible
  normalized membership fail HTTP400 with provider/model/tool/path before fetch.
  Source schemas and partial payload edits cannot leak on failure.
- Only schema slots are traversed; default/examples and string enums are not
  interpreted as numeric schema. parametersJsonSchema is not protobuf-encoded.
  No whole-schema reconstruction, empty-object fallback or enum deletion occurs.

## Final verification

### Real normalization, SDK wire and response parsing

```sh
bun test test/ohMyPiNumericEnum.bun.test.ts test/ohMyPiToolEnums.bun.test.ts test/ohMyPiImageTransport.bun.test.ts test/ohMyPiComplete.bun.test.ts
```

Final single run: **59 passed, 0 failed, 280 assertions**, exit 0.
`green-provider-output.txt` is the complete output.

The production-path cases cover both Gemini and Opus with:
- original captured **48 tools**, unchanged order;
- those 48 plus actual upsert_autotile_group: **49 tools**;
- every live registry tool plus the captured session-only tools: **235 tools**.

Full-corpus requests are controlled/offline; they do not claim Google's live
maximum tool count admits 235. The actual live probe uses the captured 48.
All five numeric-enum placements, nested numeric returned arguments, string
enums, source/request immutability, actual PNG bytes and delivery positions are
checked. Existing Codex/image/credential/replay regressions run in the same Bun
process. Unsupported source inputs and real-normalization loss fail without
fetch. Corruption countercases start from real SDK-normalized payloads, then
exercise the production hook and SDK error handling: errorStatus400, no content,
zero fetches. No returned calls execute.

### Local validation and protected regressions

The exact 31-file command is recorded at the top of `focused-local-output.txt`.
Result: **31 files / 461 tests passed**, exit 0, including 10 new local-validation
cases. Protected acceptance/baseline/spatial/outcome/image/native-page/ending/
tile-query/dialogue/client regressions were included.

Local cases use shipped normalizeArgsForSchema and actual parseAuthorHouseRequest
and parseInteriorPlan, for single-house, houses[], and both exterior placements.
They accept 1/2/3 and existing "2" -> 2 normalization; reject 0/4/1.5/"4"/true/null.
The sparse real group schema accepts only 4/8 and rejects 6, including after
normalization. A control proves putting protobuf strings in the LOCAL schema
would reject valid normalized numbers. No game/DB tool is executed by the new
tests; existing protected tool tests use their existing in-memory fixtures.

### Typecheck, diagnostics, build

```sh
node evidence/ai-provider-enum-0907/check-types.mjs /home/main/.bun/install/cache/bun-types@1.4.1@@@1/index.d.ts
npm run build
```

- Focused TypeScript program: **0 diagnostics**, all transitive diagnostics
  included, using existing official cached Bun declarations. No dependency
  installation, ambient stubs, diagnostic suppression or type-ignore directives.
- LSP checks on production files, new tests/helper and live probe: no diagnostics
  on final checks. Some earlier fresh-diagnostic requests timed out; the compiler
  check is the complete independent type verification. JSON LSP is unavailable
  because Biome is absent; fixture JSON parsing/equality succeeded.
- Full build: **exit 0**, including app `tsc --noEmit`, editor, player and standalone.
  Complete output: `build-output.txt`. It retains warnings about optional missing
  proxy keys, record-picker circular chunks, mixed static/dynamic imports, large
  bundles and unresolved `/generated/battle-reference-forest.png`. These paths
  were not changed here; no warning was suppressed or unrelated repair bundled.
- An earlier standalone app-typecheck command hit its external 90s harness limit;
  no success was claimed for that attempt. The full build completed its same
  app typecheck successfully.

### Live implemented-path proof

```sh
bun evidence/ai-provider-enum-0907/live-opus-probe.ts
```

Executed once through the implemented `completeProvider`, real installed SDK and
real outbound fetch: **one HTTP200**, 2026-09-06T16:38:06.811Z to 16:38:11.624Z.
- Requested/completion model: `claude-opus-4-6`.
- Wire model: `claude-opus-4-6-thinking` (catalog's normal mapping, not fallback).
- All 48 captured tools in exact order; four integer-enum nodes encoded
  ["1","2","3"] after normalization.
- User text READY, neutral system instruction, completion **READY**, finish stop.
- No returned tool calls, **zero executed tool calls**, no DB/game writes.
- Auth file byte-identical before/after, source tools unchanged; no login,
  refresh, adoption, environment changes or secret logging. Refresh token is
  omitted from the probe credential pack.
- `live-opus-proof.json` records HTTP/model/tool/enum receipts and SHA256 of both
  production files. Those hashes were checked against the final implementation.

This is transport proof, not a generated-game acceptance result. No new actual
Gemini probe was required or made; its production serializer is covered offline.

## Failures found and corrected during implementation

These are not hidden by the final green results:
- First provider run: 58 passed / 1 failed. The new Codex assertion incorrectly
  looked for top-level tools; the installed default uses Responses Lite's
  `input[type=additional_tools].tools`. Throwing inside fetch caused SDK retry
  and a test timeout. Corrected to capture wire then assert at its real location
  outside fetch. No production workaround or deadline increase was made.
  `initial-provider-output.txt` retains the failure.
- Focused compiler checks caught a Set union-inference issue and test typing
  mismatches (Bun fetch.preconnect, SDK raw-schema index signature, fixture union,
  and completion union narrowing). These were corrected explicitly. The typed
  offlineFetch helper rejects preconnect rather than permitting a hidden network
  path. `initial-typecheck-output.txt` retains the test-type failures; final
  `focused-typecheck-output.txt` reports zero diagnostics.

## Scope and approval

No node_modules, model selection, local schema/argument semantics, timeout,
DB/game data, browser, environment or occupied9841 changes. No server started or
stopped. Earlier intent/planner aborts remain separate unresolved transport
observations, neither confirmed200 nor confirmed400; no deadline diagnosis is
claimed. User-visible game acceptance R6/R16 remains parent-owned and unfulfilled
by this READY transport probe. This isolated commit is authorized; push/PR/merge
and changes to main remain prohibited, and merge still requires final approval.
