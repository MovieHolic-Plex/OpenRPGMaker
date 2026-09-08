# Parent source-review follow-up: wire and duplicate admission

Base: `954e02ee7d371cb5c91bf52b6d7023336db0f962`. Same isolated worktree/branch.
No amendment to that commit. The only additional production change is one check
in `parseNpcRewardRequirements`; the wire schema and runtime validators are unchanged.

## Actual new-field wire evidence

Installed package: `@oh-my-pi/pi-ai` version `17.4.0`; Bun `1.4.2`.
The new `test/ohMyPiGoldRewardWire.bun.test.ts` does not substitute normalization:
it invokes repository `completeProvider`, with only fetch replaced by `offlineFetch`.
That executes repository request conversion, installed `toolWireSchema`, Google/CCA
conversion, the actual Antigravity request builder and repository onPayload hook.
The controlled fetch captures the final serialized request before supplying local SSE
function calls to the real SDK response parser and repository completion adapter.
No credentials, network connection or real model call are used.

Both routes emit exactly this `parameters.properties.steps.items.properties.goldDelta`:

```json
{"description":"Currency delta: exact signed safe integer (e.g. 20 or 0), or {atLeast:1}. Relative to snapshotRewards, scene start by default. Not an inventory item."}
```

| Requested model | Actual wire model | Controlled fetches |
|---|---|---:|
| gemini-3.7-flash | gemini-3.7-flash-low | 1 |
| claude-opus-4-6 | claude-opus-4-6-thinking | 1 |

The field does **not** default to STRING, disappear, or trigger local schema fallback.
The installed JSON Schema value validator accepts numeric 20/0 and objects
`{atLeast:1}`/`{atLeast:0}` against both the captured field and complete request schema.
Those values roundtrip unchanged through SSE/SDK/repository parsing, then execute
through real `run_scene_test`: currency 37 -> 57 -> 57, inventory gold delta zero.
A string-valued response (`"20"`/`"0"`) also roundtrips unchanged but is rejected by
the real tool preflight, so the permissive wire does not weaken runtime validation.

**Limit:** an untyped schema is permissive, not a structural integer/object union.
These tests prove installed serialization, local JSON Schema representability and
response/runtime roundtrip; they do not simulate Google's service-side legacy Schema
validator or prove model generation quality. Remote service acceptance remains
unverified under the explicit no-real-model-call constraint. No unsupported STRING
default or narrowing was demonstrated, so no speculative schema change was made.

The earlier normalizer-only regression was not treated as sufficient for this review;
this follow-up captures the final actual SDK request at the fetch boundary instead.

Installed source hashes (SHA-256):
- `utils/schema/normalize.ts`: `3e9ff39422aecf7ac94f9db2e076fb141396fe5ceb411d2287d03ab4e0a9e186`
- `utils/schema/wire.ts`: `2c5c62de3904a52d8dbd7d8fd2a3b93981a1fa242ac8d68a42b3226f61a15609`
- `providers/google-shared.ts`: `74791d3f9e345eee5505d6496da39d2693d6ce495324504c32f4ae3da04ff074`
- `providers/google-gemini-cli.ts`: `a74232ec52cfd9cf027e7a6ce2151c61cb2dcc3d1774fe43e0c693167f4b2be5`

## Duplicate currency components: reproduced and fixed at admission

Before production editing, four parser regressions and three bounded-repair
regressions failed: duplicate components were accepted, and the client made one
call instead of entering its single repair call. Red run: **7 failed / 73 passed**.

The parser now rejects a second gold component within one NPC reward requirement.
Exact, conflicting, unspecified and item-interleaved duplicates all fail. It does
not mutate input, sum amounts, alter item/monster admission, or reset an adopted
contract. Independent NPC requirements and mixed item/gold/monster grants remain valid.

Observed result (`duplicate-admission-result.json`):

```json
{"invalidReason":"npcRewards: duplicate gold grants for target {\"eventId\":\"chief\"}; declare one gold grant with the amount from the user request, preserving other grants and counts. Do not sum ambiguous amounts"}
```

The existing bounded repair receives the full original raw declaration, including
all other grants/counts and `oneTime`. A supplied corrected declaration preserves
those exact components and the original non-reward intent fields. Repeated duplicate
or omitted correction remains invalid after exactly two calls. No extra repair
budget or contract-reset path was added; completion retains its existing guard.

## Verification

Raw logs are preserved byte-for-byte in `followup-logs.tar.gz`; uncompressed copies
remain in this worktree. Exact Vitest file lists are at the top of each log.

- Red: `npm test -- test/npcGoldReward.test.ts test/intentDeclarationClient.test.ts
  --pool=threads --maxWorkers=1 --no-file-parallelism --reporter=dot` -> exit 1,
  7 failed / 73 passed (`duplicate-admission-red.log`).
- Final focused/protected Vitest: **397 passed across the same 22 files**, exit 0
  (`followup-focused-protected.log`). No unrelated suite expansion or timeout changes.
- `bun test test/ohMyPiGoldRewardWire.bun.test.ts`: **2 passed / 0 failed** in one
  final run (`provider-wire-roundtrip-final-node-assert.log`), with exact normalized
  field, model IDs, roundtripped values and scene outcomes printed per route.
  Node's built-in test/assert APIs run under Bun so no missing `bun:test` TypeScript
  declarations are required; all assertions are retained. Earlier intermediate
  transport runs also passed and are archived rather than overwritten.
- `npm run typecheck:app`: exit 0 (`followup-typecheck-app.log`).
- `VITE_CACHE_DIR=/dev/shm/ai-npc-gold-0907-vite npm run build`: exit 0, app + player/SDK
  + standalone (`followup-full-build.log`). Existing chunk/import/asset warnings remain.
- LSP: no diagnostics on changed source and all three changed/new tests. Initial Bun
  import/type diagnostics were resolved without ignores or ambient stubs.
- `bun .omo/evidence/npc-gold-0907/native-tool-smoke.ts`: exit 0;
  `followup-native-smoke.json` again proves native 37 -> 57 -> 57.
- `git diff --check`: clean. No source changes outside `src/ai/intentDeclaration.ts`.

No prerequisite witness, reward timing, native changeGold, parent/review tree,
archived Round8, live game/ledger/DB, provider dependency, push/PR/merge changes.
