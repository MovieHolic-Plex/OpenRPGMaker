# Parent verification and baseline comparison

## Full repository gate

Parent ran `npm run gates` on the implementation worktree.
Monitor `mon_B7S94BRQFX546Y9E` / `bash_5`: exit 1.

- Application types: exit 0, zero errors.
- Vitest: 201 failed, 18,126 passed, 107 failing files.
- CSS budget and graph: exit 0.
- Surface gate: exit 1, seven failing axes.
- The stored September 2 baseline flagged 41 test files plus seven surface
  failures. This full gate is not reported as green.

## Same-source baseline isolation

Created an isolated baseline worktree at the implementation's original base,
`e05a99b915102de113ac4634f4a06a5bb3267788`, with the same dependency installation
and copied environment. Ran only the 41 flagged test files with `--maxWorkers=4`
on both baseline and changed trees.

| Result | Original base | Changed tree |
| --- | ---: | ---: |
| Test files failed / passed | 40 / 1 | 40 / 1 |
| Tests failed / passed / skipped | 61 / 436 / 8 | 61 / 436 / 8 |
| Failure headings, including suite setup | 62 | 62 |
| Changed-only failure headings | - | 0 |

Parent compared the complete sorted failure headings from both monitor logs:
no additions and no removals. The one remaining flagged file passed on both
narrow runs; it is not treated as a confirmed regression.

- Baseline monitor: `mon_XNF4C40JMADNA978` / `bash_7`, exit 1.
- Changed monitor: `mon_2SQ147ZBPSN2Z5EB` / `bash_8`, exit 1.
- Machine reports: `/tmp/ai-acceptance-base-regressions.json` and
  `/tmp/ai-acceptance-changed-regressions.json`.

The baseline-only `npm run gates -- --only surface` reproduced all seven
surface failures: database tab inventory, commit probe/no-commit controls,
form, interaction-form, M2, and portal snapshots.
Monitor `mon_W7TYXP9J3T1CVPRV` / `bash_9`: exit 1.
Those surfaces were not edited by this PR.

## Final CSS

After Grok corrected hidden-panel painting and title/status layout, parent ran
`npm run gates -- --only css` again.
Monitor `mon_RRW2Z44G2EX16EAX` / `bash_11`: exit 0, no CSS regressions.

The repository failures above remain visible and unchanged. No baseline,
allowlist, test skip, or assertion was weakened to obtain a passing result.
