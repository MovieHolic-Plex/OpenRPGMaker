# AI assistant UI audit evidence

Report: [Korean audit](../../../docs/qa/2026-09-06-ai-assistant-ui-audit.md).
Source snapshot: `49067218a`.
These selected PNGs are permanent audit evidence, not temporary PR decoration.

## Captures

| File | Actual browser action/state | Finding |
|---|---|---|
| [01-float.png](01-float.png) | 1440x900 initial real editor | Control state |
| [04-history-ai-command-menu-toggle.png](04-history-ai-command-menu-toggle.png) | More → 전체 기록 → More | F1: menu top -189 |
| [05-history-collapsed.png](05-history-collapsed.png) | History → collapse | F2: deck remains 47x799 |
| [06-history-to-studio.png](06-history-to-studio.png) | History → topbar studio | F3: old deck remains |
| [07-direct-studio.png](07-direct-studio.png) | Float → topbar studio | F3 control case |
| [08-studio-collapsed-columns.png](08-studio-collapsed-columns.png) | Collapse scenes and chat | F5: grid unchanged |
| [15-minimum-history-menu.png](15-minimum-history-menu.png) | 1024x768 history → More | F1 at supported floor |
| [16-minimum-history-collapse.png](16-minimum-history-collapse.png) | 1024x768 history → collapse | F2: deck remains 47x667 |
| [17-minimum-studio-collapse.png](17-minimum-studio-collapse.png) | 1024x768 scenes/chat collapsed | F5: grid unchanged |
| [18-tall-float-menu.png](18-tall-float-menu.png) | Two read-only fixture turns → More | F1 also affects float, top -59 |
| [20-idle-resize-no-effect.png](20-idle-resize-no-effect.png) | Idle resize: arrows and 80px pointer drag | F10: stored 560px, displayed 480px |

The screenshot filenames preserve the capture order; numbers missing from this table
were intermediate local captures, not missing test results. Settings captures are
not included because DOM measurements provide the required evidence without shipping
an account-connection screen.

The model could not inspect image pixels. The PNGs are supplied for human review.
Findings use actual interactions, computed DOM geometry and source verification.

## Reproduction

```sh
DEV_SERVER_PORT=19841 DEV_SERVER_NO_TLS=1 npm run dev:worktree -- --port 19841
```

Open `http://127.0.0.1:19841/?freshProject=1` in a separate profile; continue as guest.
Do not reuse or clear the user's normal browser profile.

Playwright operations used for layout reproduction:

```js
await page.setViewportSize({ width: 1440, height: 900 });
await page.getByTestId("ai-command-menu-toggle").click();
await page.getByRole("menuitem", { name: "전체 기록", exact: true }).click();
await page.getByTestId("ai-command-menu-toggle").click();
// F1: menu top must be >= 0, but is -189.
await page.keyboard.press("Escape");
await page.getByTestId("ai-collapse").click();
// F2: .ai-deck should be hidden, but remains display:flex.
```

Start a fresh float state for direct studio. Compare with history→studio, not just
studio in isolation. Measure `.ai-studio-shell` `gridTemplateColumns` before and after
`ai-studio-scenes-collapse` and `ai-studio-chat-collapse`.

For settings, click `topbar-ai-settings`, then
`[data-custom-select-for="ai-font-size"]`, then `role=option` named `크게`.
Compare localStorage `oprn:ai-font-size` with `ai-panel.dataset.aiFontSize`.
Repeat through `ai-command-menu-settings` as the control case.

The repository's existing `assistant-glass-settings.spec.ts` static GET relay was
needed for this host's Chromium module loading. It did not modify UI responses.
The conversation fixture intercepted `/v1/chat/completions` only with deterministic
read-only text and `/__oprn/ai-activity` with `{ok:true}`. This tested the real
composer/session/log UI, not a live provider or remote persistence.

## Evidence provenance

- `measurements.json`: desktop observations transcribed from captured tool results
  and the contemporaneous notebook after the first JS kernel lost memory.
- `action-log.json`: second kernel's directly accumulated action/measurement records.
  Some setup actions are described above rather than instrumented in that JSON;
  it is not a complete Playwright trace.
- `movement-log.json`: final movement-control checks; stored and rendered widths
  measured after CSS animations settled.
- Notebook: `/tmp/ulw-20260907-022351.o81mxB.md`.

## Cleanup receipt

- Closed the second Playwright context and browser; `browser.isConnected()` returned
  `false`. Destroyed the static-GET relay HTTP agent.
- Stopped the owned server session `bash_3`. `ss -ltnp '( sport = :19841 )'`
  returned only its header: the port is unbound.
- The first kernel's orphaned Chromium pid `479498` was terminated; final `ps`
  reported no process. Removed its exact profile
  `/tmp/playwright_chromiumdev_profile-o7DwT7`; existence check returned false.
- Deleted the downloaded `ai-session-audit.json` through Playwright `download.delete()`.
  QA-only conversations were deleted through the isolated history UI; the entire
  isolated profile was then closed.
- Removed the blank boot screenshot and ten intermediate PNGs, including both
  account-settings screens. The eleven listed screenshots are retained evidence.
- No leftover Playwright artifact directory from the audit's browser startup window
  was found. The existing server on 9841 and other users' browsers were untouched.

## Validation receipt

All three JSON files parse successfully. All 16 relative Markdown links across the
report and this README resolve to existing files. Product source was not changed;
no product test/build pass is claimed. Biome LSP is unavailable in this environment,
so JSON parsing and diff checks are reported instead of a fabricated LSP pass.
