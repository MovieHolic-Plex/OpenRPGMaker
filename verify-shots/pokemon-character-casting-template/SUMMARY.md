# Naru v2: explicit edits on an original body/gait template

Review: http://mdc-server:18316/?candidate=explorer-2fe0ce80a94b963f

First inspect `comparison.png` and `template-and-naru.gif` (top original Camper, bottom modified Naru). `decoded-gif.png` shows the four decoded GIF frames. `review-1100.png` and `review-320.png` show the actual browser.

The user requested treating original characters as templates. This derivative preserves the original Camper body/gait and changes hair, jacket, scarf and backpack through explicit palette and row edits. The original source is credited to Nintendo / Game Freak / Creatures; edited pixels are attributed to Codex GPT-6. It is not independent from-scratch artwork.

`template.json` contains the source SHA and edit operations; `recipe.json` embeds the replay spec and audit. All twelve poses preserve the lower four rows' index geometry. Other unchanged original pixels remain in the derivative. Palette changes are included in the orange difference mask.

Validation:

- Native structural import/check/preview passes. Source atlas and exported GIF match exactly; 15 opaque colors and four130ms frames. Raw pose-change warnings remain because the original gait has a1px bob; the registered stability gate passes. No native thresholds changed.
-9 replay controls pass: exact output reconstruction, protected feet, declared shared-template warning, undeclared recolor/head-only rejection, wrong source hash, no edits, feet mutation, identical renamed art and tampered output.
-17 browser checks pass: direct candidate selection, comparison images, provenance, review observations, phase stepping, mobile integer scaling/no overflow, no browser errors, pending download rejection and persisted pending state.
- No real user votes written. Existing decisions preserved; new candidate is pending. Previous Naru E remains available for comparison.

The initial browser attempt reached the server before it was listening; retry after readiness passed. No canonical game content was changed. Map context is a scale mockup, not gameplay evidence. Technical passes do not approve the art.
