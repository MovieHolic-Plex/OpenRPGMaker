# Final house-protection E2E budget verification - 4/4 PASS

Worker omo `st_01a07359`; root `01a072aa-d666-7ef3-a123-c923fcda0392`.
This fresh run follows the material static-fetch deadline alignment. The earlier
3/4 run and its exact cold `/src/styles/index.css` 15s timeout remain recorded in
`E2E-BUDGET.md`; neither that receipt nor its artifacts were relabeled.

## Tested change

One test-code line changes static `route.fetch` from 15s to **60s**, matching the
existing canvas readiness deadline. Editor preparation remains separately bounded
at **180s**. The **120s behavioral test**, **60s session deadline**, `maxRetries: 0`,
`connection: close`, 30s route-drain fixture and all **28 expect sites** are unchanged.
The only source diff from b8ae19c3 is that numeric timeout; the assertions were also
AST-compared with 03b269a4. No production edits, sleeps, polling delays or retries.

## Fresh run identity and result

- Cwd: `/home/main/z-project/rpg-zzu-house-protection-p1-e2e-budget`.
- Tested base: `b8ae19c3fd8986f219eec72079ce797c00929092` plus the one-line change
  committed with this receipt. Tested spec SHA-256:
  `2a4608863dfb36ce4eb812bfc9df0cbc2ceafe2e77482b2c42cc4cb153bd0558`.
- Runner started **2026-09-05T21:11:10Z**; Playwright duration **252.519s (4.2m)**.
- **4 passed, 0 failed/skipped/flaky, exit 0; one invocation, every result retry=0**.
- Own OS-selected port **38917**, strict-port Vite, frozen source watching and a
  fresh private cache; Vite PID 1623114 and esbuild PID 1623189 had the exact cwd.

```sh
ARTIFACTS="$PWD/.omo/evidence/house-protection/p1/e2e-budget-static60-st_01a07359"
DEV_SERVER_PORT=38917 E2E_RETRIES=0 E2E_HOUSE_EVIDENCE_DIR="$ARTIFACTS" \
PLAYWRIGHT_JSON_OUTPUT_FILE="$ARTIFACTS/playwright.json" \
node node_modules/playwright/cli.js test test/e2e/ai-house-protection.spec.ts \
  --project=chromium --workers=1 --retries=0 --reporter=list,json --trace=on \
  --output="$ARTIFACTS/test-results"
```

`run.json` records exact absolute environment values and both server/test argv.
Trace measurements keep editor setup separate from actual send behavior:

| Case | Setup fixture (s) | AI send step (s) | Result |
| --- | ---: | ---: | --- |
| selection | 34.518 | 17.033 | pass |
| confirmDestroy | 34.755 | 21.941 | pass |
| overExisting-clear | 29.139 | 12.888 | pass |
| overExisting-keep | 20.859 | 11.991 | pass |

The first CSS fetch took **6.124s** in this run, so this pass does not claim it
actually needed more than 15s here. The prior observed timeout, not this duration,
is the evidence for aligning the compilation/network-read budget.

All four fresh JSONs independently pass 42 protected-cell equalities, all three
`protected-house-write` rejections with entire-map rollback, and the exact final
map equality with only the selected outside upper tile erased. Real AI store
completion was recorded; remote persistence is disabled and remote writes are
blocked (16 for selection, 18 for each other case), never faked as successful saves.
LSP diagnostics and diff checks pass. Twelve PNG headers/dimensions are 1440x900;
subjective visual grading is not claimed. No application build or broad gate claimed.

## Artifacts and verified cleanup

Fresh local raw artifacts (not committed) are under:
`/home/main/z-project/rpg-zzu-house-protection-p1-e2e-budget/.omo/evidence/house-protection/p1/e2e-budget-static60-st_01a07359/`.
Keep this directory: four scenario JSONs, twelve PNGs, four traces, Playwright JSON
and text logs, server log and run/cleanup metadata. `SHA256SUMS` hashes every raw
artifact; its SHA-256 is `fcba8edd979624fc363c12971ce9d6b316a0568ae09b8bca09b3a104471f295d`.

Owned server group terminated and Vite exit 143 was awaited; log reader joined,
private cache removed, and a new socket bound 38917 successfully. A subsequent
`/proc` inspection found no scoped browser/server processes. No foreign server was
used or killed. Historical receipts/artifacts are untouched. No push/PR/merge.
