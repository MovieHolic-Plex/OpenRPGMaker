# Event editor window controls

Base: `b9dec50fb6159e8be220b42eb59e526808b92b97`.
Worktree: `/home/main/z-project/rpg-zzu-event-window-controls`.
Scope: editor code only; browser fixtures use local-only blank sessions.

## User-visible acceptance

The lead drove Firefox against the worktree's own server on port 39477.
Screenshots are local artifacts in this directory; they are not pixel-review
approval. Both the lead and the visual QA agent reported that images could not
be delivered to their models. Geometry, visibility, focus and interaction assertions
were executed in the real browser.

| Scenario | Observed | Local artifact |
| --- | --- | --- |
| Normal window, 1024x768 | Inset 960x720 at (32,24); all three controls within viewport | `manual-normal-1024.png` |
| Normal window, 1280x800 | Inset 1216x752 at (32,24); all three controls within viewport | `manual-normal-1280.png` |
| Normal window, 1440x900 | Inset 1376x820 at (32,40); top-right controls | `manual-normal-1440.png` |
| Minimize and map work | Backdrop hidden; actual lower-layer button works; draft text retained | `manual-minimized-1440.png` |
| Maximize and restore | 1428x888 at (6,6); Escape restores exact original bounds | `manual-maximized-1440.png` |
| Drag and resize | Pointer drag moves (32,40) to (48,52); keyboard resize reduces width 1376 to 1360 | Lead browser action log |
| Dirty close | Confirmation appears; declining retains draft; Save closes successfully | `manual-dirty-close.png`, `manual-saved.png` |
| Automated full lifecycle | Firefox 1024/1280/1440, 3 passed, exit 0 | `browser/` |
| Final cleanup and button-size delta | Final 1024 lifecycle passed; lead remeasured all three viewports with exactly 32x32 controls and verified clean/dirty close | `final-close/`, `manual-normal-*.png` |

The automated lifecycle covers actual canvas double-click creation, titlebar
dragging, minimize, pointer and F7 map-layer switching, keyboard restore and
caret retention, same-event map-list reopening while maximized, Alt+Enter,
keyboard resizing, dirty-close cancellation, saving and clean reopening.

## Verification and baseline comparison

- Initial and final `npm run build`: exit 0, including application typecheck, editor,
  player/SDK and standalone bundles.
- Final lead run: 52 passed across 8 files covering document lifecycle,
  window controls, close, windowing, SVG drag, editor/history/text hotkeys.
- Full `npm run gates`: timed out after 1800 seconds. This is unresolved,
  not a passing full-suite result.
- CSS gate: `cssFileCount 267 -> 268` fails identically on the clean base.
  This change adds no CSS file and does not alter the budget baseline.
- Surface gate: the same six assertions fail on clean base and changed tree:
  CommitProbe snapshot and no-commit ratchet; Form, Interaction, M2 and Portal
  snapshots. Shell, Condition and staged-state axes pass.
- TrustLoop: the same four assertions fail on clean base and changed tree:
  missing `window` for show-animation, invalid-position focus, missing
  `KeyboardEvent`, and missing interaction surfaces. Final lead run confirms
  41 passed, these 4 failures, and zero unhandled errors.
- A new asynchronous cleanup regression was found and fixed: owning-document
  cleanup now survives removal/replacement of the global document. Red evidence
  and green checks are in `output/evidence/event-window-controls/`.
- Chromium failed before UI assertions with host `ERR_NETWORK_CHANGED`.
  Firefox was used independently; no Chromium pass is claimed.
- CSS language-server diagnostics were unavailable because Biome is absent.
  The existing PostCSS parser and CSS graph checker were used instead.

## Review contract

Ultrabrain is the requested final reviewer. Any blocking findings must be fixed
by a deep agent, reverified, and submitted to a fresh ultrabrain review.
The PR must not merge before explicit approval of its final code.
