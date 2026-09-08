# Frozen B1 QA-envelope browser handoff (GROK full11)

This lane is **not** final repo-gate, PR approval, or a production performance fix.
Integration worktree was not edited.

## Candidate

- Worktree: `/home/main/z-project/rpg-zzu-unbounded-ui-01a07570`
- Branch: `agent/unbounded-final-qa-01a07570` (locked)
- Product HEAD: `8441f679dd3e701ffe76b4cf2c11e0f98e8ca23f` (`Align adjacent fixtures with preserved execution contracts`)
- Only dirty file: `test/e2e/ai-unbounded-execution.spec.ts` (B1 QA envelope). Patch: `spec-envelope.patch`
- No product/wiki/other tests/fixtures/config edits. No commit/push/merge/rebase/unlock.

## Exact old → new QA bounds

| bound | old | new | who |
|---|---:|---:|---|
| B1 terminal waiter (`boundedTerminal` / `terminal()`) | 240000 | **600000** | B1 variants only (including Confirm `continue`) |
| B1 test timeout | 300000 (file-level) | **660000** (`test.setTimeout` inside B1) | B1 only |
| File-level test timeout | 300000 | 300000 | B2/B3/B4 still this |
| `terminal()` / `boundedTerminal` default | 240000 | 240000 | B2/B3/B4 |
| fixture signal `bounded()` | 120000 | 120000 | all |
| inspect | 15000 | 15000 | all |
| applied-progress watchdog | 15000 | 15000 | all |
| product execution/context/output/tool budgets | unchanged | unchanged | product |

Why: prior 8441 B1 auto hold-55 was 223466ms and still Stage 59 at 240s (`final-integrated-browser` FAIL). Attribution showed ~4s/step environmental timing, not a new core stall or verifier hashing. User rejected host-idle blockade. Envelope is a failure-only safety guard, not the tested behavior, and not permission to hide stalls.

## Browser result (one invocation)

Surface: Chromium editor `http://127.0.0.1:19844/?blankProject=1&aiBridge=0`

Exact command (`03-full11.cmd.txt`):

```
DEV_SERVER_PORT=19844 \
VITE_CACHE_DIR=$PWD/.omo/evidence/final-browser-qa-envelope/vite-cache \
E2E_RETRIES=0 DEV_SERVER_NO_TLS=1 \
PLAYWRIGHT_JSON_OUTPUT_FILE=$PWD/.omo/evidence/final-browser-qa-envelope/full11-machine.json \
npx playwright test test/e2e/ai-unbounded-execution.spec.ts \
  --project=chromium --workers=1 --trace off --max-failures=1 \
  --reporter=list --reporter=json
```

- Exit **0** (`03-full11.exit`)
- Stats: expected **11** / unexpected **0** / flaky **0** / skipped **0** (all 11 executed, retry 0)
- Duration 1479983.266 ms (24.7m list reporter)
- Machine JSON sha256 `523d342e429ebf74bef9c5f70df2d90be4677de142a4543e11844ad4c5cadeb1` (original copy identical)
- Playwright 1.61.0, workers 1, retries 0, trace off
- Host load recorded as context (125.91 at start); no idle wait
- 19844 was unbound before bind; 9841 pid **2252417** never touched

## Product hashes (must match frozen 8441 UI)

```
98cad8c809dc24174ac5fa52e16d465d1efe8dc00d5709a1afe20b8c207ba29e  src/ai/assistantSession.ts
1f453266fd8dceebf3d1a3d829c9813933011229c6899d4b97015cad2da16525  src/editor/panels/aiChatPanel.ts
4ede7abbf44fdd919044ea67869a7d7edada2bf0bc4bea48d9120fb0af3c84bc  src/editor/panels/aiChatRenderers.ts
db442c6df115f3d236b117ecf87efebaac80b732bba541f44dd28a26c861d5ca  src/editor/panels/aiTurnRunner.ts
```

Spec hash this lane: `c415d606aa0f5a4d5b0baa29f47ae077d7bac4ca5f7ba6a43fd40b9d92a4aeaf` (was frozen `749bdbd387b6eda41c0ee99ca61ba36d37aa0d990423816d2482fef7b8c702be` before envelope).

No typecheck/full build this lane (prior 8441 app typecheck/full build already passed).

## Cleanup

- Owned 19844 webServer/browser stopped with Playwright (19844 unbound after run).
- Generated Vite cache under `final-browser-qa-envelope/vite-cache` removed only.
- 9841 still pid **2252417**.
- Previous stale browser files retained in `preserved-previous-ai-unbounded-browser/`.
- No commit/push/merge/rebase/unlock.
