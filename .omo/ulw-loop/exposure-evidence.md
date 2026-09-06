# Exposure component evidence

## Delivered

- Base: `b9dec50fb6159e8be220b42eb59e526808b92b97`; branch `agent/ai-full-context`.
- Removed registry 40-tool pruning/pins and session 40-slot/capability-tail pruning, plus
  the historical blanket 128 clamp. The first working request carries all active native
  descriptions/schemas; core reads cannot be evicted by discovery, intent or plan tools.
- Explicit registry domain filters remain lossless within their scope. Session write
  filtering and execution refusal in ask mode remain intact; deprecated definitions stay hidden.
- Session-only BuildSpec/WorkPlan/acceptance lifecycle gates remain. Existing execution,
  shape validation, detached drafts, read-evidence, accounting and cancellation paths are unchanged.
- Capability index no longer claims missing schemas require a later discovery round.
- No delegate implemented: supported native transports have no observed need for one.
  See lead-owned `lead-baseline-and-provider.md`: Antigravity accepted 198 full native
  definitions (260686 JSON characters), HTTP 200. Codex has no connected live credential;
  its upstream acceptance remains unverified, not inferred from mocked HTTP.
- Installed adapter regression verifies Antigravity `functionDeclarations` and Codex's
  zstd request `input.additional_tools` preserve complete definitions at 40, 41, 127,
  128, 129, 198 and 207. An explicit 422 propagates without retrying a smaller catalog.

## Exact red command

```sh
npm test -- test/aiToolDiscoveryEscalation.test.ts
```

Before implementation: exit 1, **4 failed / 1 passed**. Both provider first-request cases
were missing active native schemas; ask mode omitted active reads; discovery required a
later round. Missing names included `get_project_summary`, `list_resources` and
`get_database_records`. Log: `/tmp/exposure-red.log`.

## Exact final green commands

```sh
npm test -- test/aiToolDiscoveryEscalation.test.ts test/toolExposureQuota.test.ts test/toolDomainScoping.test.ts test/toolRegistry.test.ts test/aiCapabilityEscalation.test.ts test/aiToolCapabilityIndex.test.ts test/planToolExposure.test.ts test/aiComposerModeSession.test.ts
bun test test/ohMyPiFullCatalog.bun.test.ts
npm run typecheck:app
git diff --check
```

- Vitest: exit 0, **8 files / 76 tests passed** on final code. `/tmp/exposure-focused-green.log`.
- Bun: exit 0, **14 passed / 0 failed / 42 assertions**, one complete green run.
  `/tmp/exposure-transport.log`. No sleeps, polling or live network calls in this fixture.
- App types: exit 0 (`TYPECHECK_EXIT=0`). `/tmp/exposure-typecheck.log`.
- LSP diagnostics requested for every changed TypeScript file before typecheck: no diagnostics.
- Public `AssistantSession.sendUserMessage` exercised first request, discovery follow-up,
  question mode and terminal provider-error behavior; original project remains unchanged on rejection.
- Existing composer tests additionally prove attempted ask writes are refused and drafts remain unchanged.

## Baseline-aware adjacent verification

```sh
npm test -- test/aiToolDiscoveryEscalation.test.ts test/toolExposureQuota.test.ts test/toolDomainScoping.test.ts test/toolRegistry.test.ts test/aiCapabilityEscalation.test.ts test/aiToolCapabilityIndex.test.ts test/planToolExposure.test.ts test/aiComposerModeSession.test.ts test/assistantReadContract.test.ts
```

Initial broader run: **79 passed / 1 failed**. Failure is unchanged baseline:

```text
FAIL test/assistantReadContract.test.ts
새로 만든 적도 조회 없이 트룹에서 참조할 수 없고, 반환된 ID만 참조 근거가 된다
AssertionError: expected false to be true
98| expect(made.ok).toBe(true);
```

Reproduced with `npm test -- test/assistantReadContract.test.ts` at exact base commit in
an isolated detached verification worktree: **4 passed / 1 failed**, same line 98.
The failing setup creates `upsert_enemy` with only id/name before testing read evidence.
No baseline fixture or production write behavior was changed to hide this failure.
Logs: `/tmp/exposure-green.log`, `/tmp/exposure-baseline-read.log`.
The temporary baseline worktree was removed after verification; shared main was not edited.

## Tooling and integration notes

- This environment has no `apply_patch` executable. Patches were applied with the local
  shell function `apply_patch() { git apply --whitespace=nowarn -; }`; no dependency added.
- The first transport fixture assumed plain Codex JSON/top-level tools and exact raw Google
  schemas. It failed correctly; inspection established zstd, `additional_tools`, private
  normalization symbols and Google's `propertyOrdering`. The fixture now parses the actual
  wire representation and compares JSON definitions with that documented ordering annotation.
- An initial 120-second typecheck timed out. The longer run caught a now-write-only domain
  cache (`TS6133`); removing the obsolete field/assignment fixed it. Final typecheck exited 0.
- The first temporary baseline location under `/tmp` could not resolve the pre-existing
  ancestor `zod` dependency. Moving the isolated worktree beside the project restored the
  same dependency environment and produced the baseline test failure above.
- Build, final repository gates, browser QA, final live provider request, generated wiki
  INDEX refresh, independent review and merge remain lead-owned. Rich-original-context
  and independent-review components were not implemented. Existing context/window accounting
  must incorporate the larger native schema payload in the subsequent context component.
- No user game content, live database writes, push, PR or merge performed by this component.

## Final provider-audit handoff

- Parent audit confirms neither supported subscription endpoint has a verified numeric
  cap: Antigravity uses Cloud Code Assist (`daily-cloudcode-pa.googleapis.com`), Codex
  uses `chatgpt.com/backend-api/codex/responses`. Vertex/Chat Completions limits are not
  evidence for these endpoints. No speculative limit or delegation layer was added.
- Full schemas are a separate `ChatRequest.tools` field. `compactMessagesForRequest`
  receives only `this.messages`; the same complete tools array is attached after that
  clamp. Prompt-character trimming therefore cannot truncate native definitions.
- Grounding component handoff: reserve/account for full serialized native tools when
  budgeting the combined model window. Do not move schemas into a trimmable text index
  or reintroduce name-only discovery as the authoritative catalog.
- The index heading now identifies the native tools field as the full schema source.
  This follow-up changes only prose/handoff documentation; no new prose-pinning test.
