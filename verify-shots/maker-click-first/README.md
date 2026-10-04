# Game maker startup / interview evidence

These are production surfaces and the app's generation pipeline, not a manually authored reference game. No coding-agent edits were made to the live QA game's content.

| Check | Evidence | Result |
| --- | --- | --- |
| Native Electron opens fullscreen; visible mouse controls and unobscured launcher navigation | `desktop/proof.json`, `desktop/startup.png` | PASS under Xvfb with xfwm4; window bounds equal display bounds |
| Click-only arrival and all five interview questions; visible answer/navigation buttons at 1440×900, 960×540, 390×844, 320×568 | `ui-proof.json`, `review-320.png` | PASS; production components, synthetic unavailable image service |
| Actual image generation and actual vision review | `live-art/proof.json`, `live-art/actual-interview.png` | Two candidates rejected; third approved by all six checks, navigation remained enabled |
| Redraw budget, absent delivery acknowledgement, malformed verdict, stale responses, close during generation | `art-contract-proof.json` | PASS; synthetic transport and bitmap fixture, not visual-quality evidence |
| Actual editor → complete internal brief → actual AI → finished task → SQLite save/reload | `handoff-proof.json`, `canonical-proof.json` | Workflow finished; 43,913-character request, no user-visible task JSON, same project and brief after reload |
| Actual automatically authored game's exported player | `player-shipping/SUMMARY.md`, `player-shipping/proof.json`, `player-shipping/branch-0/choices.png` | PASS: both branches, cancellation, distinct reactions/memories, no repeated relationship gain, ending; pixel-cinematic dialogue occupies 25% of player height |

The actual editor observer also recorded `Framebuffer status: Incomplete Attachment`; its composite result is **FAIL**. A subsequent read-only reload and desktop/mobile resize probe recorded no framebuffer failures. The editor error is unresolved and is not erased by the successful player or workflow results. Runtime QA disables the opening on a separate QA copy and uses the dedicated shipped player, never the editor play shell.

Pixel-art rejection is an actual model review of the delivered bitmap, not a mathematical certification of a 320×180 source grid or a historical console's palette. Interview art is ephemeral illustration and does not overwrite the protagonist, implementation brief, tilesets, or authored game content. Slow generation, missing account access, rejected art and cancellation leave the interview usable; generation is not claimed to be instant. The initial waiting background is the user's requested world-map video, not a bank of preset branch pictures.

App, player and Electron production builds passed. Full Vitest / gates / typecheck suites were not run. Raw provider logs, account configuration, full project documents and large export packages remain outside committed evidence.
