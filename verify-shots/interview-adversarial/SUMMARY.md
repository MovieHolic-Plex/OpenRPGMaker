# Cinematic interview adversarial QA — 2026-10-03

Actual production dialog imported from the worktree dev launcher on port 9812; synthetic draft values, no AI or canonical writes in this script. Run `node scripts/qa/interview-adversarial.mjs`.

36 checks passed: all four single genres and 12 ordered mixtures; widths 320/360/390/768/850/1024/1440; mobile readability/touch targets/new-question position; live reduced-motion switch; out-of-order image responses; failed-image same-choice retry; unbroken 1000-character answer; 4000-character summary and double-confirm; keyboard focus containment/cancel restoration; no uncaught page errors.

Failures found and fixed:
- Mobile input 13px and motion button 34px -> input 16px, controls >=44px.
- Mobile panel retained its previous scroll position -> each rendered step resets the panel as well as the desktop body.
- Changing reduced-motion while open left the video running -> a removed-on-close media-query listener pauses motion immediately.
- Failed scene key blocked the same option from retrying -> reset the key on the current request's failure.
- Transformed backdrop image enlarged panel scroll width -> contain it inside the backdrop.

The 45 shipped WebPs matched their recorded SHA-256 and all existing review check flags. `assets-contact.webp` was also inspected for scene relevance, discrete pixel shading, accidental photographic/painted substitution and text overlays. “16-bit” is the art direction, not a hardware certification. Pixel art remains illustrative; protagonist identity comes only from user answers.

`layout-320.png`, `layout-850.png`, `layout-1440.png`, and `long-summary-320.png` are actual browser captures. Desktop and mobile captures were visually inspected, including question position, text legibility, background visibility and accessible controls. `report.json` contains individual assertions and geometry.
