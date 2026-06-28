# Visual QA - Verdict: NEEDS WORK

## Evidence

- Browser path: Chromium, `/?freshProject=1&qa=database-tabs-visual-qa`, toolbar Database button hover/focus, then direct click through 20 Database tabs on desktop `1365x900` and mobile `390x844`.
- Screenshots: `desktop-contact-sheet.png`, `mobile-contact-sheet.png`, and 40 per-tab captures under `tabs/`.
- State dumps: `scenario.json`, `project-export.json`, `tab-metrics.json`, `console.json`.
- Diff: `visual-diff.json`; no committed all-tab baseline was available, but 40/40 tab screenshots were non-empty and manually compared via contact sheets.
- Console: no app crash or page error. Captured logs were Vite/Phaser startup plus repeated WebGL `ReadPixels` performance warnings.

## Findings

- FAIL: Desktop record tabs have a crushed left record rail. In `desktop-actors.png`, `desktop-skills.png`, `desktop-items.png`, `desktop-equipment.png`, and `desktop-states.png`, record names are clipped and the `+ 추가` / `복제` / `삭제` controls are compressed into tiny overlapping buttons near the top of the list.
- FAIL: Desktop `equipment` content extends past the visible modal/footer area. `tab-metrics.json` places class/state checkbox rows below the modal screenshot bottom, and `desktop-equipment.png` shows the lower options panel cut off.
- FAIL: Mobile Database tabs overflow horizontally on every tab. The tab strip is about `554-555px` wider than its visible container, so later Korean tab labels are outside the viewport rather than visible in the clicked result.
- FAIL: Mobile wide editors clip important right-side UI. `mobile-troops.png` has `bodyScrollWidth 1160` vs `bodyClientWidth 384`, cutting off the battle event/right controls. `mobile-tilesets.png` shows the tileset editor/grid constrained to the left slice with right-side context lost.
- WATCH: Tileset passability markers have low measured contrast on some bright tile cells. They remain visible in the desktop capture, but the automated contrast pass flags many `O` overlays around `2.07:1`.

## Must Fix

- Fix the shared record-list pane layout so list names, search text, and add/duplicate/delete controls do not overlap or shrink below readable width.
- Add a mobile strategy for the Database modal: scrollable or wrapped tab navigation plus per-tab responsive panels or explicit horizontal scrolling for wide editors.
- Ensure tall record forms scroll inside the modal body without being hidden behind the footer, especially Equipment and Troops.
