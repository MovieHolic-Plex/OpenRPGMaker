# Phase 3 failure comparison disposition

Task41 comparison is complete. This is not a green whole-project gate or task33 approval.

The parent directly ran the original full gate and a one-shot current/base comparison of every113 failed file and all1251 of their cases. All219 original failures are accounted for:162 shared failures with matching complete printed assertion diagnostics, and57 failures not reproduced on either side. Four diagnostic differences are solely the exact source coordinates or one audit timestamp documented in common-comparison.md; the parent independently checked the actual bytes and source offsets.

The only additional current failure compared with the exact Phase2 base is an audit POST observed by the next persistence test. The parent exercised real clean flush and the real deferred audit callback on both heads with controlled time; both behave identically, and the existing audit reset prevents that request on both. See audit-candidate-conclusion.json. The original flaky test was not modified or declared fixed.

No additional reproducible Phase3 assertion failure remains unexplained in this pair. That observation is narrower than a claim that every original failure is inherited or that no regression is possible:57 non-reproductions have no established cause, two case-attributed audit console lines differ, warning order differs around a common timeout, and blocked-network plus two identical unhandled errors limit the runs. These limits remain explicit for final review and later full-goal verification. They are not absorbed into the baseline or silently treated as passes.

The original full command exits124 after the test phase during its first surface check. Full Vitest is13910 total/13676passed/219failed/15pending; all234 cases in the8 Phase3 changed test files passed. Direct app typecheck/build and CSS pass. The separate surface exits1 with six full failure blocks exactly matching earlier base output. All receipts remain in phase3-gates/.

The parent read both raw streams/reports, validated11 input hashes,1772 byte-range references,1099 JSON pointers and all219 original-case mappings, then independently recomputed162 complete human-body comparisons. See parent-comparison-verification.json. Both product trees remain clean; owned runtime processes, caches, timers and globals were cleaned by the completed pair/probes. The locked comparison tree is retained for final review and parent-owned handoff cleanup.
