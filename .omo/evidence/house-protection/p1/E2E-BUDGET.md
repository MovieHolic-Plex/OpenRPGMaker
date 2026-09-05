# E2E setup-budget fix - 3 passed, 1 remaining transport failure

Worker: omo `st_01a07359`; root `01a072aa-d666-7ef3-a123-c923fcda0392`.
This is a new run, not the historical 02b496ae worker or 238d6f4f supervisor receipt.

## Change and unchanged contracts

The test now prepares each real editor in a separately bounded **180s fixture**:
transport/write guard, navigation/welcome dismissal, initial module imports, human
precondition and initial canvas capture. Named steps distinguish these from the
unchanged **120s behavioral test** and **60s AI send/store completion** deadline
(65s outer bridge bound). The separate 30s route-drain teardown is unchanged.
All **28 expect call sites** match the base exactly (TypeScript AST comparison),
including awaited overlay checks and looped full-map rollback assertions.
The model script, real session/tools/store/canvas and `connection: close`,
`maxRetries: 0`, 15s static-fetch timeout are unchanged. No sleeps or retries added.
An optional `E2E_HOUSE_EVIDENCE_DIR` isolates fresh artifacts from old receipts.

## Before-change evidence, inspected before editing

Supervisor cwd: `/home/main/z-project/rpg-zzu-house-protection-p1-approved-candidate`,
commit 03b269a4, port 35945. Its `test-results/` selection and confirmDestroy error
contexts report `Test timeout of 120000ms exceeded`. The readable confirmDestroy
`trace.zip` measures navigation-to-before-screenshot at **76.653s**, then the real
send at **42.742s**; the total deadline expires during the final `readMap`, after
send completion. Its UI context shows house construction, protection rejections
and applied changes. Selection's ZIP was unreadable; no detailed timing is claimed.
The supervisor separately reported 2 failed / 2 passed, 9.3m, exit 1 and server
cleanup. This worker did not reuse that server or rerun that baseline.

## One new zero-retry invocation

- Cwd: `/home/main/z-project/rpg-zzu-house-protection-p1-e2e-budget`.
- Tested base: `03b269a4d35e8f5b866dead5b976b5a5254b8208` plus the test diff
  committed with this receipt; spec SHA-256:
  `1ddf7fda8ab81920d0a4a5060fd16234b7a029f0233418f611f2096ddd9bec7a`.
- Started: `2026-09-05T20:59:02Z`; Playwright duration **410.940s (6.8m)**.
- **3 passed, 1 failed, 0 skipped, 0 flaky, every result retry=0, exit 1**.
- Own OS-selected free port **49007**, strict-port Vite, frozen watching and a
  private cache. Both Vite PID 1443610 and esbuild PID 1443741 had the exact cwd.

```sh
ARTIFACTS="$PWD/.omo/evidence/house-protection/p1/e2e-budget-st_01a07359"
DEV_SERVER_PORT=49007 E2E_RETRIES=0 \
E2E_HOUSE_EVIDENCE_DIR="$ARTIFACTS" \
PLAYWRIGHT_JSON_OUTPUT_FILE="$ARTIFACTS/playwright.json" \
node node_modules/playwright/cli.js test test/e2e/ai-house-protection.spec.ts \
  --project=chromium --workers=1 --retries=0 --reporter=list,json --trace=on \
  --output="$ARTIFACTS/test-results"
```

Above names the invocation; `run.json` records the actual absolute environment
values and argv, including the separately launched owned Vite command.

| Case | Setup fixture (s) | AI send step (s) | Result |
| --- | ---: | ---: | --- |
| selection | interrupted | not reached | static CSS fetch timeout |
| confirmDestroy | 68.945 | 34.254 | pass |
| overExisting-clear | 51.942 | 33.203 | pass |
| overExisting-keep | 50.240 | 26.989 | pass |

**Remaining failure:** selection's unchanged `route.fetch` deadline expired after
15000ms fetching `/src/styles/index.css` during cold navigation (spec line 92).
The resulting `page.goto: Test ended` is secondary; it did not run the AI turn.
The trace's early fixture-timeout label accompanies interruption, not a measured
180s setup exhaustion. No transport-deadline increase or retry was used to hide it.
This is **not a 4/4 certificate**; selection behavior remains unverified in this run.

The other three fresh JSONs independently passed all 42 protected-cell equalities,
three full-map rollback/rejection checks and exact outside-only final-map equality.
Each records remote persistence disabled and 18 blocked remote writes, not fake
save successes. Nine scenario PNGs exist; visual grading is unverified because the
image reader reports this model cannot inspect images. Final file LSP diagnostics
and `git diff --check` pass. No production edits, broad unit gate or build claimed.

## Artifacts and cleanup

Raw artifacts are local, not committed, under this absolute directory:
`/home/main/z-project/rpg-zzu-house-protection-p1-e2e-budget/.omo/evidence/house-protection/p1/e2e-budget-st_01a07359/`.
It contains fresh logs, JSON report, run/cleanup metadata, three scenario JSONs,
nine PNGs and four traces. Keep this directory for verification. Old artifacts
and receipts are untouched. SHA-256 references (relative to that directory):

```text
23cdfdcaf2c6ca533bfb0cdffe7e4c2c63a7426fc0f90321283cc97e51282be3  run.json
f036264617e898838320855da5dadce42126e80513afdafd0e9b9104e6c310dc  playwright.log
33d23bc65456aee82e4263ffc52a3876c3ac473b477295d77b23a222ccc537bc  playwright.json
b049b0d030e4dc7360e1db730cc748f306e1d99d15c6af7a792b35254f0899d0  test-results/ai-house-protection-comple-386e7-ion-with-overExisting-clear-chromium/trace.zip
2be2c8b6a6674324d80ed616eb2376c208a973171fa041e89a6d02a175b461d1  test-results/ai-house-protection-comple-5f5a8--destruction-with-selection-chromium/trace.zip
2050835542289b079a559ac25b6ae17ad186ad1ae9f3c71303cee3b16abf09f9  test-results/ai-house-protection-comple-c2ff1-tion-with-overExisting-keep-chromium/trace.zip
87f510c22b36a63cfccd7faf6de474e8541021507a7e765c6323f042061ccbb9  test-results/ai-house-protection-comple-feb49-ruction-with-confirmDestroy-chromium/trace.zip
```

The runner terminated its own server process group and awaited Vite exit 143;
no live owned server processes remained, the log-reader thread joined, the private
cache was removed, and a new socket bound 49007 successfully. Playwright exited
and disposed its browser contexts. No foreign server was killed. No push/PR/merge.
