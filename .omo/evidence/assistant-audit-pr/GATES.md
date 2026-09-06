# Supervisor gate outcome

Candidate: `60baa32d89a3601a9d1805c066f08264198e359a`.
Comparison main: `3f7b89d64`.

## Whole gate: incomplete

`npm run gates` ran inside an isolated Linux network namespace, with loopback
enabled, for the configured 1,800,000 ms limit. It timed out during the complete
Vitest run and produced no JSON test report. Seven active workers were observed,
not an idle process; host load was approximately 75. Parent CPU affinity was
widened from cores 0-7 to 0-31 while retaining the running test invocation.

This is **not a whole-suite pass** and does not establish that every unrelated
test is regression-free. No partial or older JSON report was reused. The final
175-test supervisor run and complete app/player/standalone build passed separately
and are recorded in `final-checks.log`.

## Independent CSS and surface gates

Both gates were then completed independently on the candidate. A separate clean
worktree at `3f7b89d64` ran the same commands, also without external networking.

| Gate | Candidate | Baseline main | Comparison |
| --- | --- | --- | --- |
| CSS | exit 1; budget 1, graph 0 | identical | `cssFileCount` allows 267, observes 268 |
| Surface | exit 1; 10 axes; 6 failed tests | identical failure identities/counts | Existing five snapshot files below |

Surface failures:

- `eventEditorCommitProbe.baseline.test.ts`: snapshot difference count 4 and the existing no-commit allowlist assertion.
- `eventEditorFormSurface.baseline.test.ts`: snapshot difference count 4.
- `eventEditorInteractionSurface.baseline.test.ts`: snapshot difference count 4.
- `eventEditorM2Surface.baseline.test.ts`: snapshot difference count 2.
- `eventEditorPortalSurface.baseline.test.ts`: snapshot difference count 2.

The candidate and baseline have identical Git objects for the style tree,
CSS-budget checker and CSS baseline:

```text
styles:   8a321e80bfe1aabb526b02c3c101def216c8ccf2
checker:  cebb03c139a6a898a8b05174f4a84b3d99caf9ea
baseline: 6c794902547d162ed1ea38e9b79013091d1489dd
```

There is no candidate diff in those paths or `src/player/player.css`.
No CSS baseline, surface fixture, assertion or production guard was changed to
hide these failures.

`gates-final.json`, `gates-baseline.log`, `gates-candidate-screen.txt` and
`gates-whole-status.txt` preserve the results. The clean baseline worktree was
removed with `wt remove --keep-branch`; its branch remains recoverable.
