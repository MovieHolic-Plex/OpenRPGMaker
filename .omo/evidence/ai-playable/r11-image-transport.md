# R11 image transport investigation

Base: affaa027e3847eb78640c6330b4cf437f51394d4. Isolated worktree:
`/home/main/z-project/rpg-zzu-ai-image-transport-0906` (initially clean).
Runtime: Node v24.11.1, Bun 1.4.2. No server, browser, content or DB writes;
`.env.local` and occupied port 9841 are outside this task's mutation scope.

## Evidence and hypotheses

Read round2 review and REPORT.md in the parent adversarial worktree. The captured
adapter seam loses `image_url`; actual browser audit has no downstream payload.

1. Adapter flattens user parts: `openaiToContext` calls `textOf`. Distinguishing
   evidence is a deterministic PNG in real SDK outbound JSON. Fix: preserve parts.
2. SDK model capability drops images: Google conversion checks `model.input` and
   inserts a text placeholder on unsupported models. Fix: reject capability.
3. Receipt predates delivery: session calls `deliver` on insertion; a subsequent
   provider failure can leave usable coverage. Fix: acknowledge completion.
4. Request compaction drops images: `messageBudget` strips even recent image
   parts when over budget. Fix: bind acknowledgements to actual request parts.

## Artifact ledger

Retained regression tests and this report are intended evidence. Command output
goes under `output/evidence/ai-image-transport/`; no live credentials are used.
Existing source baseline is the clean git base above. All edits use apply_patch.
No debugger instrumentation or temporary server was created. The existing Bun
completion suite uses and removes its own temporary fake-credential auth store;
no real credential store was used.
Parent owns full build, broad gates, browser game completion and ultrabrain review.

## Confirmed mechanism and fix

The failing-first real SDK fetch capture contained only `{text:"Delivered map"}`;
the deterministic PNG inlineData was absent. The session reproduction returned
`review_acceptance.result.ok: true` despite no acknowledgement. Conversion now
preserves bytes/MIME and rejects bad encodings, mismatched image headers,
unsupported roles/parts/URLs and nonvision capabilities with status 400. The
worker and companion already roundtrip the completion object unchanged, so no
worker server/protocol rewrite was needed. `image_delivery` is inside that object,
not a frontend claim or a model-authored tool argument. Error/aborted completions
cannot produce it. Stub mode produces no acknowledgement.

Receipt credit requires a successful response acknowledging the exact image
parts in the post-compaction request. Pending receipts are turn-local and consumed
once; missing/partial acknowledgements, rejection, abort and compaction cannot
credit retained images later. A new render may establish fresh receipts. The R2
currentness store, coverage union, later explicit verdict, draft/applied filtering,
DB-only retention and no-undo-revival remain unchanged.

The broader SDK wire test exposed an additional failure: Codex serialized
`label0,label1,image0,image1`, not the submitted alternating order. The adapter now
ends each Codex user segment at its image. Consecutive user messages preserve the
original order through the installed SDK; Antigravity needs no segmentation.

The installed catalog returns `input:["text","image"]` for
`gemini-3.7-flash` and `gemini-3.7-flash-tiered`. `gemini-3.7-flash-low` is not a
catalog entry, so the adapter resolves it via the existing default fallback.
All three passed real Antigravity outgoing-image assertions (SDK aliases the wire
model). This is the actual editor default, not a substituted vision model.

## Executed validation

All commands ran in this worktree. Logs are under
`output/evidence/ai-image-transport/`.

| Command | Result | Log |
| --- | --- | --- |
| `bun test test/ohMyPiImageTransport.bun.test.ts` before fix | 0 pass, 1 fail: outgoing PNG absent | `red-provider.log` |
| `npm test -- test/assistantAcceptanceSession.test.ts --maxWorkers=2 --minWorkers=1` before fix | 12 pass, 1 fail: unacknowledged review accepted | `red-session.log` |
| First Node integration execution | suite failed: Bun-only catalog import (`Bun is not defined`) | `integration-first.log` |
| Initial expanded Bun execution | 25 pass, 1 fail: Codex label/image reordering | `provider-first.log` |
| First `npm run typecheck:app` | exit 2: pending parts typed too broadly (`ContentPart` vs `ImageUrlPart`) | `typecheck-first.log` |
| `bun test test/ohMyPiImageTransport.bun.test.ts test/ohMyPiComplete.bun.test.ts` after corrections | 26 pass, 0 fail, single run | `green-provider.log` |
| `npm test -- test/assistantImageTransport.test.ts test/assistantAcceptanceSession.test.ts test/assistantVisualEvidenceSession.test.ts test/assistantImageEvidence.test.ts test/assistantAcceptance.test.ts test/llmClient.test.ts test/messageBudget.test.ts --maxWorkers=2 --minWorkers=1` | 72 pass, 0 fail in 6 files; `llmClient.test.ts` does not exist and was not collected | `green-focused.log` |
| `npm test -- test/aiLlmClient.test.ts test/llmReasoning.test.ts test/llmRetry.test.ts --maxWorkers=2 --minWorkers=1` (actual client suites) | 47 pass, 0 fail | `green-client.log` |
| `npm run typecheck:app` after correction | exit 0 | `typecheck-app.log` |

The Node integration runs real AssistantSession -> llmClient -> companion router
-> runtime conversion, including completion JSON serialization. Its Bun-only
SDK/catalog boundary is replaced; the complementary Bun tests use the real catalog,
complete implementation and provider serializer with only fetch replaced. They
assert multiple images and ordering, text controls, MIME/bytes, malformed input,
provider rejection and default aliases. No external API request or credentials.

Session tests cover missing/partial acknowledgement, provider rejection, malformed
image, real compaction and abort, followed by continuation/retry. Existing R2
tests still cover DB-only writes, both budget exits, per-map/full coverage,
subsequent review, render-input changes and undo no revival. No fixed sleeps or
polling were added; tests control the boundary or abort at the exact request.

## Limits and integration

No live game completion, worker-process restart/build identity, browser/player,
full build or broad gates are claimed. Those remain parent-owned. The worker
source is unchanged; parent must restart its already-running worker to load this
adapter and verify the editor/player/worker candidate identities together.
Header checks are not full image decoding; provider rejection still fails the
completion and cannot acknowledge delivery. Successful delivery is not proof of
model attention, image correctness, game quality or gameplay completion.

Final LSP calls returned `No diagnostics found` for every changed TypeScript file.
The first Bun-test call reported unavailable `bun:test`/`Bun` ambient types and
implicit callback parameters; the parameters were fixed with explicit string
types. No suppressions or dependency changes were added. This is not a claim of
a separate full Bun TypeScript compiler gate: Bun executed the tests directly.
Markdown diagnostics were unavailable (`No LSP server configured for extension:
.md`). Final `git diff --check` exited 0 (`diffcheck.log`). The existing oversized
session received only its locally owned acknowledgement timing change, not a
broad refactor while other agents own adjacent completion policies.

Likely cherry-pick overlap: `assistantSession.ts` (one import, one loop-local,
post-response acknowledgement block, and insertion-site receipt replacement),
`openwiki/editor-ai-panel.md` (only the image lifecycle subsection). No R7 parser
or R8/R9/R12 completion policy was changed.
