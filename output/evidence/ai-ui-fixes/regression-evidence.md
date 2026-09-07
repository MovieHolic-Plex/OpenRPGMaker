# Captured regression evidence

These are selected excerpts from executed commands and browser observations, not
tests run by this document. Full final browser results live in `e2e-results.json`.
No failures are suppressed or relabeled as successes.

## Panel state and popovers

Current-source F1 browser RED:

```text
Error: expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 0
Received: -227
```

Panel state RED:

```sh
npm test -- test/aiPanelChrome.test.ts -t "F[2349] " --maxWorkers=1 --no-file-parallelism
```

```text
F2 collapsing history returns to the collapsed float surface: expected true to be false
F3 entering studio clears the full-history surface: expected true to be false
F4 the visible history menu action toggles open and closed: expected true to be false
3 failed
```

The initially added FakeDom F9 case did not reproduce native disabled behavior.
It was not accepted as coverage; the dedicated native-DOM case below replaced it.

GREEN:

```text
Panel/composer regression: Test Files 3 passed; Tests 35 passed
Existing popup/composer regression: Test Files 3 passed; Tests 14 passed
Actual history popovers: y=97, all three hit tests true
Actual long-conversation menu: y=227, bottom=505, pointer export succeeded
```

## Studio columns

```sh
npm test -- test/aiStudioColumnCollapse.test.ts
```

RED:

```text
expected '252px 8px minmax(0, 1fr) 8px 400px'
to be '52px 8px minmax(0, 1fr) 8px 400px'
expected '316px 8px minmax(0, 1fr) 8px 464px'
to be '52px 8px minmax(0, 1fr) 8px 52px'
2 failed
```

GREEN:

```text
Focused regression: 2 passed
Parent integration with existing aiStudioShell suite: 23 passed
Actual browser grid: 52px 8px 1260px 8px 52px
Actual monitor width: 712 -> 1260
```

## Settings and modal focus

RED, before corresponding production changes:

```text
aiSettingsEntryParity: 3 failed, 5 passed
  topbar font remained normal instead of large
  current session did not receive the saved config
  topbar temperature choices were absent
aiSettingsHistoryFocus: 15 failures
Hidden panel-menu opener: 1 failure
Replacement topbar opener: expected replacement button, received BODY
```

GREEN:

```text
Settings worker wider regression: 8 files / 102 tests passed
Parent after replacement-opener delta: 3 files / 31 tests passed
Actual topbar: font=large, autonomy=max
Actual topbar and panel temperature values: map-first, ink-only, quiet-gold
Actual settings/history Tab: inside=true; Escape opener restoration=true
Actual nested select: first Escape leaves settings open
```

The replacement-opener test replaces the DOM node deterministically. The real
browser diagnosis also captured `originalAttached=false` before close; it does not
depend on a fixed delay to make the replacement happen.

## Empty export and idle resize

```sh
npm test -- test/aiEmptyExportFeedback.test.ts
```

RED:

```text
expected null not to be null
1 failed
```

The real resize seam imported the production module and actual CSS:

```text
before=480; expected=488; rendered=480; stored=488px
```

GREEN:

```text
Native export + resize regression: 2 files / 12 tests passed
Actual empty export: feedback=true
Actual nonempty export: ai-session-audit.json, failure=null; download deleted
Actual resize E2E: arrows, 80px drag, ARIA, focus, reload passed
Actual held-response abort: sendVisible=true, inputEditable=true, abortHidden=true
```

## Environment failures, excluded from product evidence

- The first attempted worker checkout ran out of disk space; sparse worktrees were
  created on tmpfs without deleting other work.
- An initial browser run reused another worktree's 19841 server and was discarded.
- Two baseline suites initially failed to load with ENOSPC. Their exact retry passed
  31 tests using the task's tmpfs temporary directory.
- Tmpfs workers did not inherit `/home/main/node_modules/zod`. Local worker-only
  dependency resolution was corrected; no manifest or shared dependency changed.
- An early F1 GREEN attempt selected a hidden summary button in empty context.
  The test target was corrected without weakening viewport/hit-test expectations.
- Interrupted runs and a truncated Playwright trace are not counted as final PASS.
