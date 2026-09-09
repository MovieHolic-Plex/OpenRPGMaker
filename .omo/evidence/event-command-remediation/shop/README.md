# U01 / G1-F3 — Shop message reload safety

The load validator now uses the same SHOP_MESSAGE_TYPES as authoring and runtime. No new enum, fallback, or broader shop behavior change.

## RED
Three failures (festival, closingSale, vip) raised ProjectFormatError; four controls passed including unknown-value rejection. See red.json.

## GREEN
11 tests passed: seven persistence boundary cases and four adjacent shop runtime handoff/transaction cases. App typecheck exit0 and changed source/test LSP clean. See green.json.

## Real-surface proof
Firefox actual editor at1440x900: all three options selected, Confirm/reopen retained values; real authored VIP store project serialized/deserialized without changed shop data; Cancel preserved VIP.
Dedicated player.html at1024x768 with export store shim: each of the three reloaded variants reached an actual visible shop through title Enter and action z, with zero editor-shell nodes. Observations were registered before input and resolved by MutationObserver; no fixed delay.
Screenshots remain local, not committed: festival-selected.png, closingSale-selected.png, closingSale-reopened.png, vip-selected.png, vip-reopened.png, cancel-retained.png, player-festival.png, player-closingSale.png, player-vip.png.

## Cleanup
Editor/player browsers closed. Owned bash_8 and bash_11 servers stopped(exit143), prior bash_6 stopped before final QA. Temporary editor Vite cache removed. Worker worktree retained clean for integration; remove after cherry-pick.

## Scope and caveats
No authored game content or remote DB writes. No pixel-level visual claim. Full integration gate timing limits are recorded separately, not presented as this unit passing a full suite.
The initial browser harness used Enter expecting edit; actual command shortcut is Space. After source verification, focus+Space was used for successful reopen actions.

Detailed structured actions/results: manifest.json.
