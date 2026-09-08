# Event battle reliability

## Investigation

Production 9888 was exercised through its exported player with isolated diagnostic
projects. Valid fixed-troop battles reached the command menu through action,
autorun, parallel, player-touch and event-touch triggers. No production project
data was changed.

Confirmed failures:

- The editor accepts a native battle command without a selected troop. The
  exported-player loader rejects that fixed reference before title.
- An out-of-range variable selection with an empty fallback reaches battle
  construction and throws `Missing troop: `. Foreground execution does not show
  a runtime error, and commands after the battle do not execute.
- Battle audio state changes before construction; construction failure bypasses
  restoration.
- A troop with no members opens a battle menu without enemies.
- Monster-party mode with no party silently reports escape and continues.

The current M2 battle-only picker entries are informational and cannot be
inserted through trusted input. They are not an admission bug.

## Repair acceptance

- Invalid fixed or variable troop selections cannot silently start or disappear.
- Authoring rejects incomplete battle commands without losing their drafts.
- Initialization failure restores audio and input ownership and displays a useful
  error without fabricating victory, defeat or escape.
- Empty troop and empty monster-party configurations receive explicit handling.
- Valid battles, legitimate hidden-enemy encounters, cancellation, defeat and
  event continuation keep their established contracts.
- Regression tests and editor/exported-player browser evidence cover the repaired
  boundaries. Baseline gate failures are distinguished from new failures.

## Release gate

Implementation is assigned to deep. Ultrabrain reviews the exact candidate;
change requests return to deep and are re-reviewed until approval. Merge is
blocked until that approval and the final candidate's verification are recorded.
