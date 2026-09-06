# Cinematic narration keyboard scrolling

Date: 2026-09-06
Task: st_01a07573
Worktree: `/home/main/z-project/rpg-zzu-wish-cinematics-scroll`
Branch: `agent/wish-cinematics-scroll`
Base: `17492434a52fe4e3248e81ab1913abfb60be000b`

## Delivered behavior

The shared opening/game-over cinematic player now handles ArrowUp/Down (24 logical pixels), PageUp/Down (90% of the visible narration height, retaining reading overlap), and Home/End. It assigns element `scrollTop` synchronously and leaves bounds clamping to the browser. Scroll keys accept OS repeat; confirm, skip and retry still require distinct presses. IME actions and all cinematic key events remain consumed before title/menu/Phaser handlers. Confirm/video gating, authored deadlines and skip permissions are unchanged.

A concise scrolling hint is hidden unless `scrollHeight > clientHeight`. It is measured after mounting and refreshed by a scene-owned ResizeObserver, disconnected on scene cleanup. No new timers, polling, CSS, theme, schema, editor UI, or unrelated runtime changes.

Assumptions: scrolling does not pause an authored deadline or video; existing timing semantics remain authoritative. Native ResizeObserver is available in supported browsers. The unit DOM has no layout, so unit tests model only geometry and native scroll clamping; the actual shipping-player surface independently proves native scrolling.

## RED: reproduced before production edits

Command (exit **1**):

```sh
npm test -- test/cinematicSequence.test.ts test/playerCinematics.test.ts
```

Result: **4 failed, 32 passed**. The three new text/image/video scrolling cases failed at the first ArrowDown assertion:

```text
AssertionError: expected +0 to be 24 // Object.is equality
```

The overflow hint case failed with:

```text
AssertionError: expected null not to be null
```

Only the test file had been edited when this command ran. The earlier parent-session browser boot timeout is not behavioral RED evidence and is not used here.

Raw log: [cinematics-scroll/unit-red.log](cinematics-scroll/unit-red.log).

## GREEN: focused verification

- Same focused test command, first post-implementation run: exit **0**, **36 passed** across two files (27 cinematic playback, 9 player integration).
- `npm run typecheck:app`: exit **0**.
- LSP `severity=all`: **No diagnostics found** for both `src/player/cinematicSequence.ts` and `test/cinematicSequence.test.ts`.
- `git diff --check`: exit **0**.
- Full build and broad gates were not run, as explicitly scoped by the task.

Regression assertions cover synchronous offsets, repeat scrolling, both bounds, Home/End, all three scene kinds, IME consumption, repeated confirm/skip suppression, scene reset, skip completion, no key fallthrough, listener removal, overflow-only hint state, resize notification, and observer disposal on advance/abort. Existing focused cases continue to cover confirmation aliases, pointer exclusion, video continuation gating, media errors/retry, authored timing and player lifecycle handoffs. New tests use no sleeps or polling and do not pin hint prose.

Logs: [unit-green.log](cinematics-scroll/unit-green.log), [typecheck.log](cinematics-scroll/typecheck.log).

## Real-player evidence

Executed once, exit **0**:

```sh
cd /home/main/z-project/rpg-zzu-wish-cinematics-scroll && \
CINEMATICS_WORKTREE=/home/main/z-project/rpg-zzu-wish-cinematics-scroll \
CINEMATICS_EVIDENCE=/home/main/z-project/rpg-zzu-wish-cinematics-scroll/output/evidence/cinematics-scroll \
node /home/main/.herdr/worktrees/rpg-zzu/wish-3/.omo/ulw-loop/wish-cinematics-0906/manual-long-narration.mjs
```

The supplied harness ran actual `player.html` with 40 Korean narration lines at 1024x768. It subscribed to narration's native scroll event before pressing PageDown, with a bounded timeout.

| Measurement | Before PageDown | After PageDown |
| --- | ---: | ---: |
| scrollTop | 0 | 122 |
| clientHeight | 135 | 135 |
| scrollHeight | 1680 | 1680 |

Observed `signalled: true`, `pass: true`. The browser and owned player-QA server both closed successfully. Startup printed missing optional AI-provider proxy-key notices; they did not prevent player boot or scrolling.

- [Browser log](cinematics-scroll/player.log)
- [Before screenshot](cinematics-scroll/long-narration-before.png)
- [After screenshot](cinematics-scroll/long-narration-after.png)

Limitations: the supplied browser probe verifies PageDown, not every scrolling key or hint visibility. Those behaviors have unit coverage. Screenshots were generated and read through the image tool, but this worker's model cannot display images; visual review is explicitly unverified. Raw logs/screenshots remain local ignored artifacts at the above worktree paths; this concise report is committed.

## Scope and tooling

The commit contains only the shared cinematic player, its focused test, the relevant runtime wiki paragraph, and this report. No push, PR or merge. The requested native apply_patch tool is not exposed in this child session; edits used the provided exact-edit tool, not a shell patch wrapper.
