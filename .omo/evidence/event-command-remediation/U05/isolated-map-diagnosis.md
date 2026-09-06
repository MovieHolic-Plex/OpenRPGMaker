# Isolated map diagnosis requested by lead

- Ran only `--grep 'U05 map:'`, one worker, fresh Firefox, retries=0, normal Node Vite on explicit free port 39011; no outer child deadline.
- Playwright exited normally: code 1, signal null. Full list reporter and JSON reporter completed. Artifacts copied before server/cache cleanup.
- First actual failing action: test/e2e/event-command-remediation-U05.spec.ts:31, called at :98.
- Locator: `[data-testid="event-command-edit-dialog"] [data-testid="change-battle-commands-target-mode"]`.
- Observed DOM: `<select hidden="" aria-label="누구에게" class="rich-native-select" data-testid="change-battle-commands-target-mode">...</select>`.
- Failure: `locator.selectOption: Timeout 15000ms exceeded`, element is not visible. Editor boot, event-list selection, event modal, selected row Space and command dialog all succeeded in this isolated run.
- Page errors: []. The screenshot/body include both inspector and dialog, with visible party/actor segments. Locator was correctly dialog-scoped; visibility, not duplicate targeting, caused failure.
- Classification: U05 browser-test driver bug, not demonstrated production behavior failure. `recordPicker.ts` segmentedSelect intentionally sets native select.hidden=true and provides visible `${testid}-segment-${option.key}` buttons. Test must click the actual segment (here change-battle-commands-target-mode-segment-actor), then observe hidden value and pressed state. Do not force hidden native interaction.
- No production change was made during this diagnosis turn. Full five browser tests and player proofs remain unverified.

## Evidence

- editor-map-case.log: full first-case failure and stack.
- editor-map-case-report.json: full JSON reporter.
- editor-map-failure.json / editor-map-failure.png: observed body, page errors, screenshot.
- isolated-map-playwright-output/: original Playwright error-context preserved before cleanup.
- editor-map-case-exit.json: code1, signal null.
- editor-map-case-launch.json / editor-map-case-cleanup.json: explicit port, fresh Firefox, server exited and cache removed.

## Prior runner failures distinguished

- Initial map attempt: H0 readiness timeout before canvas/export mirror appeared (both missing), no command input reached.
- Initial common/troop attempt: grouped database tabs hidden. Common locator db-tab-common-events resolved to hidden button; System group was collapsed. A test-only group-opening adapter was added before this isolated diagnosis; it has not been verified by the isolated map case.
- Earlier batch `exit null` was caused by my explicit SIGTERM to stop repeated known failures, not an outer deadline. This hid Playwright's final aggregate report; retained per-case artifacts remain in first-batch-playwright-output/.
- First isolated CLI pattern `^U05 map:` matched no tests because Playwright grep sees the combined full title. Corrected to `U05 map:`.
- A subsequent standalone invocation hit connection-refused because terminating the old runner also closed the retained server's output pipe. This was a diagnostic process-management error, not an app failure. The final isolated runner owns server and child lifetimes together and produced the actual hidden-select failure above.
