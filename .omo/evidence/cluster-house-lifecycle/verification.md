# Cluster house-protection lifecycle validation

Task `st_01a073b4`; base `c1f0d9fafe3628c40d1d1ead39503385f7dde4b0`.
Worktree: `/home/main/z-project/rpg-zzu-house-protection-p1-cluster-e2e`.
Only the cluster E2E spec and this proof are committed; no production changes.

## Cause and fix

Supervisor `release-qa/playwright.json` recorded four AI-house passes, then the
combined cluster test timed out at its 120,000ms budget (151,601ms reported), with
`page.unrouteAll: Target page, context or browser has been closed` secondary.
Both stale-case receipts were already correct; the safe case had not completed.

Three independent test-scoped pages, model script counters and result maps now
cover `upper-and-stack`, `new-house`, and `safe`. The proven AI-house pattern
separates 180s editor boot/module setup, 120s behavior, and 30s route draining.
Static route fetches have a 60s bound and `maxRetries: 0`; overlay disappearance
is checked after dismissal. Named steps identify setup, proposal, acceptance,
invariants and teardown. No closure catch, sleeps, test retries or product mocks
were added. The existing pre-click MutationObserver and 15s acceptance deadline
are unchanged. Real modal/session/runTool/live protection/store/history remain
in use; only model HTTP responses are scripted, with real static files relayed.

## One browser run

Started `2026-09-05T22:40:22.632Z`; total 471,309.716ms; Playwright 1.61.0.
Port 40914 was bind-checked free before Playwright started its own strict-port
server; `E2E_FREEZE_DEV_SERVER=1` disables HMR/watch in this worktree.

```sh
DEV_SERVER_PORT=40914 E2E_FREEZE_DEV_SERVER=1 E2E_RETRIES=0 \
PLAYWRIGHT_JSON_OUTPUT_NAME=.omo/evidence/cluster-house-lifecycle/playwright.json \
node node_modules/.bin/playwright test test/e2e/cluster-ai-house-protection.spec.ts \
  --project=chromium --workers=1 --retries=0 --reporter=line,json --trace=on \
  --output=.omo/evidence/cluster-house-lifecycle/test-results
```

Exit **0**: **3 passed**, 0 unexpected, 0 skipped, 0 flaky, no report errors.
Every result has `retry: 0` and `timeout: 120000`.

| Scenario | Editor fixture setup (ms) | Reported test duration (ms) | Route-drain fixture teardown (ms) |
| --- | ---: | ---: | ---: |
| upper-and-stack | 122402.8 | 68951 | 31.9 |
| new-house | 82841.6 | 48336 | 115.4 |
| safe | 61506.8 | 40624 | 22.1 |

Fixture timings come from paired before/after call IDs in each `test.trace`;
reported test duration is Playwright's value, not whole-case wall time. In
particular, the first editor boot alone exceeded the old combined 120s budget.
Context disposal is additional to route draining (30174.6/16241.1/11826.4ms),
not a claim that all teardown took under 32ms. All fixture records had no error.

## Exact post-accept receipts

All three report `toolResults: [["metadata", true]]` and remote persistence
disabled. The original assertion expressions are retained unchanged.

| Scenario | Same reference | Same bytes | Same maps | Mutations | Undo delta | Proposal retained | Metadata added |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| upper-and-stack | true | true | true | 0 | 0 | true | false |
| new-house | true | true | true | 0 | 0 | true | false |
| safe | false | false | true | 1 | 1 | false | true |

Each case captured a PNG and JSON receipt, attached its receipt, verified the
above invariants, closed the real modal, then drained routes before page disposal.
The server was released: post-run connect to 127.0.0.1:40914 returned Linux
ECONNREFUSED (111), and `ss -H -ltn 'sport = :40914'` returned no listener.
No foreign process was killed or reused. Screenshots are captured evidence,
not a claim of manual visual review.

## Static validation and artifact identity

- Changed-spec LSP: no diagnostics (final fresh check).
- `npm run typecheck:app`: exit 0. An earlier invocation hit the external 120s
  command cap; the completed check used a 600s command cap, without source fixes.
- TypeScript compiler API, repository options plus `types: ["node"]` for the
  Node E2E environment: changed-spec syntax/semantic diagnostics 0, exit 0.
  The initial invocation inherited `types: []` and reported TS2307 on the
  unchanged `node:fs` import; it was an environment mismatch, not suppressed.
- `git diff --check`: exit 0. AST comparison confirms every original `expect`
  assertion remains; only three overlay-readiness assertions were added.
- No production build/full unrelated suite was run for this test-only fix.

Raw local artifacts are under this directory: `browser.log`, `playwright.json`,
and `test-results/*/{trace.zip,<scenario>.json,<scenario>.png}`. They are not
committed; this compact proof records their results and identity.

SHA-256:

```text
spec             0ca4047b5cd46ee21b9b84104948d4bac9e57f74304655291efae74fbc90f7bd
playwright.json  80fd43ae17f7f92fa14015d650c7225e109320f1195ec7fd84d927b5ba591153
upper trace      fd72342248c07076cbe3ffa28855a9e116a0136d34617d29113755d9111b9c25
new-house trace  3462974722657e71eba269aee4847385b679fdad776db86524865ace8bc622ba
safe trace       62d99e010f031ece06953000aed0b27a7d8c72ee7d557f6f87da674c56ec0c04
```
