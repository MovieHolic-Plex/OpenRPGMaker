# Full template-derived walking cast

Review: http://mdc-server:18316/?wave=full-cast-v1

## Inspect first

- `all-16-walk.gif`: all sixteen down-facing walks at integer4× scale, decoded from submitted GIFs. Exactly144 palette colors including labels/background; no sprite quantization.
- `original-and-edited.png`: role-by-role original/edited standing comparisons.
- `decoded-group-1.png` through `decoded-group-4.png`: actual GIF frames for all four directions and all sixteen roles. These sheets were visually inspected.
- `wave-1100.png`, `wave-320.png`: live browser review UI, wave selector and comparison panels.

## Delivered

Sixteen walking roles, 192 native poses: hero, rival, professor, nurse, merchant, mother, resident, gym_leader, company_agent, captain, worker, explorer, student, ranger, moon_leader, hiker. Fifteen new template derivatives plus the existing Naru v2 explorer. Sixteen distinct original walking templates are used. Names are review labels and do not change game story content.

Source and replayable edits: `harness-data/pokemon-character-casting/templates/full-cast-v1/`. Each original source PNG has a pinned SHA and primary source URL. Original artwork belongs to Nintendo / Game Freak / Creatures; Codex authored partial pixel/palette edits. This is not independently drawn artwork.

## Verification

- All16 native import/check/preview results pass, with exact PNG/GIF media checks; see `asset-checks.json`. Original leg/foot index geometry remains protected. Native thresholds were not changed. Raw pose change warnings reflect the original1px gait bob and were reviewed in decoded playback sheets.
- All120 pairwise comparisons pass; source lineages replay to their submitted pixels. No candidate is auto-approved by similarity metrics.
- Live browser and persistent-package verification: 81 focused checks pass. All16 actual GIFs and original/edit/difference images load. Five observations, frame stepping, role filter, collection switching, reload, mobile layout, unsafe ID rejection and pending downloads are covered.
- This exposed an old ID validation mismatch: role IDs containing underscores could queue but not open. Store and asset/download routes now consistently permit safe underscore role IDs; path-like IDs remain rejected. All three underscore roles were checked through real browser media requests and download rejection.
- `prepare-cast` was rerun through the registered CLI: it reproduced the same16 IDs, wrote zero approvals, and preserved the wave. The new command publishes its collection only after all packages validate.
- Production human decisions before and after browser checks: 1. No production votes were written. Existing reviews are preserved. The sixteen wave candidates remained pending on final readback.

## Scope

Durable harness SQLite and immutable packages were saved and reloaded. No canonical game content or battle portraits were changed. Placement pictures are scale mockups, not runtime gameplay proof. Technical checks establish format, provenance and review functionality; the user decides appearance with Allow/Deny.
