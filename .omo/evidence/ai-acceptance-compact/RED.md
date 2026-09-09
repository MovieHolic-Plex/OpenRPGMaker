# Pre-implementation regression evidence

Base: `e05a99b915102de113ac4634f4a06a5bb3267788`.
Request-only commit: `d45a235df`.
Only the two regression test files were changed when this command ran:

```sh
npm test -- test/aiStickyChecklist.test.ts test/aiOutcomePresentation.test.ts --maxWorkers=2
```

Parent monitor `mon_0A1M7FP4YM8Q9K0V` / `bash_4` completed with exit code 1.
Vitest reported 18 failed tests across both files.

Observed failures match the requested behavior:

- Withdrawal button is still inside summary.
- Required-only count expects `1/2`; the old implementation reports `1/4`.
- Optional/withdrawn groups and zero-required fraction hiding are missing.
- Wide viewports start expanded rather than compact.
- Hide/show/hasSnapshot APIs, drag handle, and assistant reopen actions are absent.
- Blocked reasons remain inside closed details.
- Verified grouping and the corresponding focus/disclosure behavior are absent.

Existing pending/working/verifying/verified/blocked status projection, actual map
navigation, deleted-map handling, new-chat late-event rejection, backend refresh,
and abort retention cases passed in this run. This is RED evidence, not a passing
validation claim.
