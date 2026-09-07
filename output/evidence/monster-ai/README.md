# Monster AI lookup and appearance evidence

Branch: `agent/monster-ai-0907`.

Dependencies were supplied by the lead and cherry-picked before GREEN/commit:
- Foundation `e354b1d222a81775db1906668170a5f7d2fee844` -> `ca4d022b3`.
- Reviewed catalog `67db34b4d20cc859a0d98ce85234b54b9d96f425` -> `11cf8403b`.

## Delivered behavior

- `list_monster_resources({})` returns every registered index entry without a hidden first-page cap. Explicit query/IDs/full/offset/limit return honest total, returned, nextOffset, complete and unknownIds. Full detail retains the entire effective description.
- `get_monster_resource` reads one exact current monster resource. No fuzzy substitute.
- Both reads and all three appearance writers are available in trimmed database exposure; session-required reads survive turn exposure trimming.
- Generic `list_resources` now passes `monsterProject`, so override names/tags/descriptions participate in search.
- Shared graphic assignment requires monster-kind registration. Uploaded picture/music IDs cannot bypass this through a monster prefix/profile. Existing non-AI explicit-art, reliable identity query, rename and transparency contracts remain unchanged.
- `ToolReadEvidence` requires full current selected metadata for new/changed AI art even without a generic read contract. Current-request call IDs and exact executed payloads are matched against the actual post-compaction request. Index, failed, stale, malformed, unreturned, historical and same-batch unobserved reads do not authorize art.
- Root `appearanceTags` is a tool envelope, never a persisted enemy/species field. All requested tags must match effective metadata; at least one identity word must be outside the documented bounded generic class/color/size/origin vocabulary. Custom user tags and unrelated boss display names remain valid.
- Optional `monsterMetadataChanged` participates in session summaries and completeness accounting.

## Verification

All commands used the repository npm/Vitest runner and real exit codes. Long calls used bounded foreground execution with two Vitest workers: this child did not expose `monitor` or task delegation tools. No sleeps, polling, new dependencies, provider edits, remote writes or visual-review claims were introduced.

| Evidence | Observed result |
| --- | --- |
| `red-corrected.log` | 27 failed / 3 passed before implementation: absent tools, missing mandatory evidence, wrong-kind art accepted by all three writers |
| `red-session.log` | 5 failed / 2 passed through the real AssistantSession before registration |
| `red-generic-identity.log` | 21 failed / 3 passed: shared classes/colors authorized art; custom authored identity remained legal |
| `red-mutation-session-gate.log` | Temporarily bypassing the appearance guard caused 6/7 real-session tests to fail, including Goblin/slime writes accepted and same-batch writes accepted |
| `red-mutation-truncated-index.log` | Temporarily slicing model-facing resources to 20 while preserving complete:true caused both selected serialized-index tests to fail (6 nonselected tests in that focused invocation) |
| `green-new.log` | 114/114 new tests passed in one invocation before the reviewed data handoff |
| `baseline-related.log` | Foundation-only, own changes stashed: 198 passed / 1 pre-existing failure |
| `final-reviewed-catalog.log` | Final restored implementation with real reviewed catalog: 314 passed / the same 1 pre-existing failure, 18 files, 120.33s; all 114 new tests pass |
| `typecheck-app.log` | `npm run typecheck:app`, exit 0 |
| `build-reviewed-catalog.log` | Full `npm run build`, exit 0, including current app typecheck, editor, player SDK and standalone bundle |

Both mutation edits were reverted before the final run. `git diff --check` passed. All changed TS files received clean targeted LSP diagnostics; one busy identity-module diagnostic request timed out and the subsequent fresh diagnostic succeeded. No test was deleted, weakened or disabled.

### Known baseline failure (not masked)

`test/assistantReadContract.test.ts:98`, test `새로 만든 적도 조회 없이 트룹에서 참조할 수 없고, 반환된 ID만 참조 근거가 된다`:

```
AssertionError: expected false to be true
expect(made.ok).toBe(true)
```

Its setup creates an unrelated-name visible enemy without art, which the existing non-AI graphic guarantee already rejects. It fails identically with this lane's source/tests stashed on the foundation. The final related command deliberately includes the test and exits 1; the evidence does **not** call the whole related suite green. Existing graphic reliability tests pass without changes.

The first full build attempt reached standalone bundling but exceeded the 300-second command deadline. The final full build on the reviewed catalog completed with exit 0. Build warnings remain visible: mixed static/dynamic imports, large chunks, and a battle-reference image deferred to runtime. No warning was suppressed. Full repository gates/browser/live-provider QA remain lead-owned.

## Real surface and adversarial proof

`monsterAppearanceSession.test.ts` now selects actual bundled IDs `generated-enemy-goblin-scout` and `generated-enemy-slime-01` from the supplied reviewed catalog. All three writers reject unseen same-batch reads, then accept observed goblin metadata with the independent display name `The Last Emperor`; Goblin intent with slime art is rejected. No old resource display label is pinned.

`monsterAppearanceHttp.test.ts` runs the real AssistantSession and `chatCompletion` serializer against an ephemeral loopback HTTP model endpoint. It checks that the wire carries the independent authority's entire ID set (>50, including all reviewed bundled entries), the exact full effective description including prompt-like strings, and that a matching custom-name write persists exact art. `monsterAppearanceSession` also checks model-facing serialized data after `toolResultForModel`, `compactToolDataForModel` and request budgeting. The truncation mutation proves these assertions catch a transport-only first-20 regression, not merely a tool.run regression.

`monsterAppearanceTransport.test.ts` explicitly ages and drops an executed full response through the real request budget, confirms that the response is absent, then proves it cannot authorize art. Historical request messages are also rejected.

The injected model/HTTP endpoint is deterministic integration coverage, **not** a claim of live LLM behavior or independently performed image review. Actual image provenance belongs to the supplied catalog/vision lane; this lane does not edit or cherry-pick provider image adapter code.

## Review and limitations

New modules own resource query, appearance-envelope schema and request-local appearance evidence respectively; all are under 200 pure LOC. `loc.txt` records every changed source/test. Existing oversized integration modules receive only narrow registration/accounting/session hooks; broad session/registry refactors were explicitly outside scope.

Boundary validation follows the existing JSON-schema runner plus typed guards, with exact metadata snapshots in the interior. New code adds no type assertions/suppressions, parameter mutation, tagged-union fallthrough, broad semantic/name matching, speculative helpers, negative-form flags, redundant destructive verification, or production logging. New functions have at most three parameters; the existing five-parameter shared graphic API is unchanged to avoid unrelated writer-file refactoring.

The generic-word list is a bounded exclusion policy, not a closed creature catalog or general semantic classifier. Unknown authored tags remain legal. Incorrect metadata, an unlisted generic synonym, or tags dishonestly chosen after selecting arbitrary art can still be internally consistent. Tag matching is neither machine vision nor proof of user intent. Prompt-like metadata is reference data, never instructions. These limitations and tool contracts are documented in `openwiki/editor-ai-tools.md`.

`raw-logs.tar.gz` preserves all byte-exact logs, including intermediate failures and the full adversarial truncation diff. The readable result index is `results.txt`.
