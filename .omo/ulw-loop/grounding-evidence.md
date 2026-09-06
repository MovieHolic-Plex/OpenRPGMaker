# Grounding component evidence

## Delivered

- Base: `aab0b85033c9701560d3da0a07e167474a2f7514`, branch `agent/ai-full-context`.
- `originalContext.ts` extracts detached pre-write project metadata, target map metadata,
  full tile layers/stacks, complete existing event definitions/pages/commands, authored
  system settings and relevant full DB records. Relevance uses actual map/selection,
  structured intent tool domains/collections and transitive actual-ID references, including
  common-event cycles. There is no new natural-language keyword router.
- Original snapshot IDs survive continuations and change for new requests. The planner and
  first working writer request receive originals; request-time reinjection survives tiny
  system-prose budgets and conversation compaction. Extraction is reusable for before/after
  review without implementing that review loop.
- Oversized originals are omitted as whole entries, explicitly counted with an accessible
  `get_original_context` list/read route. Stable escaped paths, snapshot IDs, UTF-16 offsets,
  bounded page sizes and next offsets make exact JSON reconstruction possible. Partial,
  failed or omitted data does not count as a full original read.
- Only successfully delivered original read receipts enter the existing ToolReadEvidence
  seam. Reference-ID and current-record fingerprint checks remain unchanged. Credited
  originals are not replayed over later fresh native reads. The large public-session test
  proves initial write refusal, complete page delivery, same-response refusal and the
  subsequent successful first mutation. Ask mode and detached project identity survive.
- Browser-safe capacity projection matches every installed supported pi-catalog 17.4.0
  model; the 9 MB catalog/provider runtime is not imported into the app. Known exact native
  windows and native fallback models replace inaccurate prefix assumptions at this boundary.
  The request accounts for full schemas, conversation, originals and existing 16,384-token
  response reserve. An impossible window is an explicit error, never schema pruning.
- Task recipes use actual active tool names for NPC/event, map, interior, DB/battle,
  quest/world and life read -> write -> verify work. Recipe data is validated against the
  registry; no prompt/prose snapshots were added.
- Project runtime session, configuration/credentials and asset transport blobs are not
  projected. Tests use sentinel values to verify exclusion. No live DB writes or game content.

## Exact red command

```sh
npm test -- test/assistantOriginalContext.test.ts
```

Before implementation: exit 1, 2 failed. First request had no structured original context;
explicit missing target also had no original missing-state declaration.
Log: `/tmp/grounding-red.log`.
An earlier patch application failed before creating the test; that no-test-file run is
not the regression evidence. Patches used a local `apply_patch` shell function backed by
`git apply` because this environment has no apply_patch executable.

## Exact final green commands

```sh
npm test -- test/originalContext.test.ts test/assistantOriginalContext.test.ts test/aiToolDiscoveryEscalation.test.ts test/aiToolCapabilityIndex.test.ts test/contextBuilder.test.ts test/aiComposerModeSession.test.ts test/assistantSessionCompaction.test.ts test/assistantSessionContextSurface.test.ts
npm run typecheck:app
git diff --check
```

- Focused Vitest: exit 0, 8 files / 66 tests passed in one complete final run.
  `/tmp/grounding-final-green.log`.
- Final app types: exit 0, `TYPECHECK_EXIT=0`. `/tmp/grounding-final-typecheck.log`.
- LSP diagnostics requested on every changed TypeScript source/test before final typecheck:
  no diagnostics. Public `AssistantSession.sendUserMessage` is the exercised real entry point;
  provider responses are deterministic fixtures, not a live-network claim.
- Installed capacity audit command:
  `bun -e 'import {getBundledModels} from "@oh-my-pi/pi-catalog"; for (const p of ["google-antigravity","openai-codex"]) console.log(p,JSON.stringify(getBundledModels(p).map(m=>({id:m.id,contextWindow:m.contextWindow,maxTokens:m.maxTokens}))))'`
  confirms Spark=128000, GPT-5.6 variants=1000000, and the small tab models=16384.
  The final Vitest test checks the entire shipped capacity projection against installed JSON.

## Baseline-aware adjacent checks

```sh
npm test -- test/assistantReadContract.test.ts
npm test -- test/assistantSessionIntent.test.ts
```

- Final read-contract run: 4 passed / 1 failed at unchanged line 98:
  `expect(made.ok).toBe(true)` receives false because the fixture creates an enemy with
  only id/name. Prior exposure evidence reproduced this on base b9dec50f. We did not repair,
  delete or skip that fixture. `/tmp/grounding-read-contract-final.log`.
- Broader run: 76 passed / 3 failed (10 files). `/tmp/grounding-focused.log`.
  The two other failures are unchanged `assistantSessionIntent` expectations: line 110
  expects writer prose instead of missing-acceptance failure; line 257 expects
  `set_type_chart` hidden despite prior full exposure.
- Both intent failures reproduced at exact pre-grounding aab0b850 in a detached sibling
  worktree: 10 passed / 2 failed. `/tmp/grounding-baseline-intent.log`. That worktree was
  removed; shared main was never edited. The test file remains unchanged.
- The read-contract test changed only the intended expectation: delivered full originals
  authorize the first write, changed records still require a fresh later response.
  The exposure test now includes the additional complete session-owned read schema.

## Residual integration concerns and explicit limits

- Large original paging works through the first mutation, proven at the existing computed
  max-tool-calls boundary. Continuing that narrow-model fixture immediately after mutation
  exposed a separate irreducible latest `upsert_item` result containing the entire ~288 KB
  description: `original-context-window-exceeded: no room for the original context manifest;
  no tools were removed` (`/tmp/grounding-large-session-final.log`). No arbitrary write-result
  truncation was added. This is an honest error path, not a claim of end-to-end success for
  arbitrarily large latest write outputs. Reviewloop must not treat such an error as approval.
- The initial paging comparison also incorrectly matched JSON against optional undefined
  in-memory fields; the final fixture compares exact JSON values instead. No data was cut.
- Token accounting remains the existing weighted character estimate, with the existing
  response reserve, not an exact provider tokenizer or output-length guarantee. Smaller
  native models that cannot carry the full catalog fail explicitly. No domain delegation
  or transport-output policy was added by this component.
- Full build/repository gates, browser/live provider QA, generated wiki INDEX, independent
  review/repair loop and final merge remain lead-owned per component handoff. This component
  adds no review orchestration, push, PR, merge or authored user content.
