# Phase 3 integration gate results

The full command exited 124 at its 1200-second budget during the first surface check. Unlike the earlier Phase2 attempts, the complete Vitest JSON report was produced and preserved. This is not a passing whole-project gate.

- App typecheck: exit 0.
- Full Vitest: exit 1; 13910 total, 13676 passed, 219 failed, 15 pending. All 8 changed Phase3 test files passed, covering 234 cases.
- Failed test files: 113; 42 are absent from the old filename baseline. New regression attribution is pending paired comparison against the actual Phase2 base, including failed assertions inside already-baselined files.
- CSS budget and graph: exit 0. Separate CSS gate also exited 0.
- Separate surface gate: exit 1, six assertion failures. The full normalized failure blocks exactly match both retained base and prior Phase2 output. Only ANSI escapes and recorded worktree roots were normalized; assertion values and stack frames were preserved. See surface-comparison.json.

The full run started at d107ac24e; the documentation-only commit b4395f929 was made while it ran. Product, test and package bytes stayed equal to tested bbaf9464c. Canonical wiki checks separately passed at the current documentation state.

Original commands, times, exits and raw output are in full.json, css.json, surface.json and numbered subprocess receipts. completion.json confirms the report exists; vitest-report.json retains it. The original timeout and all failures remain intact. Task41 classification and task33 final approval/PR remain pending.
