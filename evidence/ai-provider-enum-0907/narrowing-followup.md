# Parent-review follow-up: explicit narrowing, no production assertions

Separate follow-up to `bdc6fad0258c147ea13e7983080c1c17db2d5039`; that commit
is not amended. Only `scripts/lib/ohMyPiToolEnums.ts` production code changes.

- Declaration filtering now supplies an explicit RecordNode type predicate.
- A declared `fail(detail): never` function lets TypeScript retain the existing
  record/type guards through traversal and final enum processing.
- Traversal branches between arrays (source-recorded numeric indices) and records
  rather than asserting a RecordNode at every path segment.
- All EnumField properties and the captured path/member arrays are readonly.
- Existing failure conditions, HTTP400 details, enum membership, provider scope,
  source immutability and post-normalization payload mapping remain unchanged.
- TypeScript AST inspection counted **zero type assertions** in the adapter.

## Verification on the follow-up source

```sh
bun test test/ohMyPiNumericEnum.bun.test.ts test/ohMyPiToolEnums.bun.test.ts test/ohMyPiImageTransport.bun.test.ts test/ohMyPiComplete.bun.test.ts
npm test -- test/ohMyPiNumericEnumLocal.test.ts test/toolSchemaProviderCompat.test.ts --maxWorkers=2 --minWorkers=1
node evidence/ai-provider-enum-0907/check-types.mjs /home/main/.bun/install/cache/bun-types@1.4.1@@@1/index.d.ts
bun evidence/ai-provider-enum-0907/live-opus-probe.ts
```

- Bun: **59 passed, 0 failed, 280 assertions**, single run. Exact output:
  `narrowing-provider-output.txt`. Full48, sparse49, corpus235, both serializers,
  real-normalization fail-closed cases, Codex and image/complete controls remain green.
- Local: **16 passed**, including actual house/interior parser countercases and
  existing string-to-number normalization. Exact output: `narrowing-local-output.txt`.
- Focused compiler: **0 diagnostics**, all transitive diagnostics included.
  Adapter LSP: no diagnostics. No type suppression or replacement assertion.
- `git diff --check`: passed. No broader build was rerun for this narrowing-only
  change; the original full build receipt remains associated with bdc6fad0.

## Refreshed real production-path proof

`live-opus-proof.json` is refreshed for this source. The earlier receipt is
preserved as `live-opus-proof-bdc6fad0.json`.

2026-09-06T16:52:40.340Z to 16:52:43.513Z: **one HTTP200**, all **48** captured
tools in exact order, requested/completion `claude-opus-4-6`, wire
`claude-opus-4-6-thinking`, integer enum fields encoded ["1","2","3"].
Completion **READY**, no returned tool calls, **zero executed calls**.
Auth bytes and source schemas unchanged. Final adapter SHA256:
`b3a1d79cc0c5850304e4a6cc84650117cdfcc20adf4b0dc37f7001e830d5c0e7`.
The runtime adapter hash is unchanged from bdc6fad0. Both hashes were compared
with the resulting source before commit.

No deadline, model, dependency, auth/environment, browser or game/DB edits.
No push, PR or merge. This is transport verification, not game acceptance.
