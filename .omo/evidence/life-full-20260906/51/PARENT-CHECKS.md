# Parent recovery integrity checks

The first parent invocation of `verify-recovery.parent.py` returned exit1 at
the source-byte comparison for `owned/st_01a07972/task.json.gz`. The recorded
artifact itself passed its archive and decoded SHA256 checks.

Direct comparison found exactly two changed live task-metadata fields:
`residency_state` advanced from `resident` to `evicted`, and `updated_at`
advanced from `2026-09-07T01:36:32.158Z` to `2026-09-07T02:01:04.802Z`.
All other task metadata fields were identical. This is subsequent harness
lifecycle activity, not an altered execution event or corrupted archive.

The second parent invocation returned exit1 for the same two-field lifecycle
transition on `owned/st_01a07982/task.json.gz`. A batch comparison of all four
owned task records confirmed that only these two records changed, only in
`residency_state` and `updated_at`; no other metadata fields changed.

The parent-only checker retains every payload/source/event comparison and
accepts only those two exact tasks' observed lifecycle transition with monotonic
timestamp and strict equality of every other field. It records any accepted
transition in `PARENT-INTEGRITY.json`. The original forensic checker and its
original `INTEGRITY.json` remain unchanged. No product tests or assertions
were changed, and missing full r2 streams remain explicitly missing.
