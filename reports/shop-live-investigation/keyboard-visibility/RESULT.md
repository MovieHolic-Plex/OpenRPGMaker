# Keyboard-only stat visibility: canonical real gameplay

## Outcome

All requested keyboard paths work at actual browser viewports **1024x768, 640x480, and 320x240**. The original symptom of equipment comparison being unavailable through keyboard gameplay was **not reproduced**. Specific inline visibility limits were reproduced: lower rows are clipped at 640x480; all inline rows are deliberately CSS-hidden at 320x240. Full detail remains keyboard-accessible and every stat can be brought fully into view.

This establishes tested conditions, not the original user's root cause. Intentional global pointer exclusion is not a bug; no pointer action, bypass, input change, or mouse proposal was made in this run.

## Provenance and one gameplay setup

- Canonical LegacyDb project: `oprn-e98456e1d8`, **용사의 여정**. Fresh read through main's `src/project/legacyDbProjectSync.ts#loadProjectFromLegacyDb`; `provenance.json` records the existing merchant and database records. The loaded snapshot is byte-identical to the authoritative positive control: SHA-256 `2684a77c47d1ea75eb5ba9b4f17e09ff556550b08f42f0db81f67e616976ab3b`.
- One isolated Firefox  runtime at `http://127.0.0.1:9841/export-player/player.html`. Unchanged public assets were routed at the exported player's relative asset base. Loaded `player.js`, `PlayScene-BAKbtaZw.js`, and `player-BhSXHFWt.css` hashes exactly match prior shipping-bundle evidence; current hashes are in `browser-session.json`.
- Escape -> Equipment -> hero -> Weapon -> Unequip -> Enter. `00-normal-unequip-preview.png` captures the normal menu. `before-unequip.json` / `after-unequip.json` show inventory `{}` -> `{equip_sword:1}`; no synthetic inventory or stock was inserted.
- Exit menu normally. Authorized QA movement only: teleport to `map_weapon_shop` (5,10), face up; native keyboard Z activates authored merchant `ev_villager_35c9ba59-6f59-47a3-b0fb-bcf9b6de5c25` at (5,9). ArrowDown -> Sell -> Enter selects actual `shop-sell-equip_sword`, `aria-current=true`.
- No reset between sizes: `page.setViewportSize` changes the actual browser viewport on the same page/session. No CSS override, component resizing, temporary layout instrumentation, or simulated user configuration was used.
- Buy stock is the existing eight special consumables in the merchant's canonical command. No equipment-buy comparison is claimed. The sword's Sell detail is an **equip preview**, not a claim that selling increases attack.

All three sizes retain the same four inline and detail numeric attributes:

| Stat | Current | Next | Delta |
|---|---:|---:|---:|
| Attack | 45 | 53 | +8 |
| Defense | 72 | 72 | 0 |
| Mind | 48 | 48 | 0 |
| Agility | 45 | 45 | 0 |

`shop-comparison` is `previewKind=ready`, `actorId=actor_hero`, `slot=weapon`, `sameEquipment=false`. No `shop-summary-reason` or `shop-preview-reason` is present. None of these values is absent or permission-blocked.

## Measured visibility

Coordinates are browser CSS pixels, `(x, y, width, height)`, rounded here. Raw JSON preserves unrounded geometry, all ancestors' display/visibility/rect/scroll/client dimensions, selected row, focus, and state. Classification is row-box clipping geometry, not OCR or glyph-level measurement.

| Actual viewport | Inline stats on normal selected sword | Full detail on keyboard open | Keyboard visibility recovery |
|---|---|---|---|
| 1024x768 | All four fully visible. Attack `(643.33,360.90,287.67,37.30)` | All four fully visible. Attack `(177,341.50,670,37.30)` | None needed |
| 640x480 | Attack and defense fully visible. Mind row has only 6.40px at its top inside the panel; agility row is below it. Attack `(407.65,289,211.35,34.40)` | Attack/defense/mind rows fully visible; agility row's bottom is partially clipped. Attack `(25,260,590,34.40)` | Tab -> Weapon slot, Tab -> detail scroll, ArrowDown once: `scrollTop=32`; all four rows fully visible |
| 320x240 | All four remain in DOM with numeric attrs but ancestor `shop-stat-slot` has `display:none`; all row rects zero | All four rows initially below detail scroll viewport. Attack `(21,246.30,278,34.40)` | Tab -> Weapon slot, Tab -> detail scroll; ArrowDown reveals each row. At `scrollTop=248` attack/defense/mind fully visible; at `312` mind/agility fully visible |

The distinction between row clipping and numeric text matters at 640x480. Inline mind exposes less than the CSS's 8px top padding, so its numerical text is below the panel boundary. Initial full-detail agility is clipped only near its bottom; **a partly clipped row does not establish that its numbers are unreadable**. One keyboard ArrowDown removes that ambiguity by exposing the entire row.

### Ancestor and component geometry

- **1024x768:** actual stage is 960x720 at `(32,24)`, integer scale 3; shop overlay is 936x696 at `(44,36)`. Inline detail panel is `(619.33,150.20,335.67,421.57)`, `overflow:auto`, `scrollTop=0`, client height 422 / scroll height 530. All stat rows end above its clipping boundary. Full-detail scroll is `(169,77,686,537.60)`, client height 538 / scroll height 700, initially scrollTop 0.
- **640x480:** stage and shop overlay are 640x480, integer scale 2. Inline detail panel is `(395.65,70.60,235.35,293.60)`, `overflow:auto`, `scrollTop=0`, client height 294 / scroll height 492. Its lower boundary is y364.20; mind starts y357.80 and agility y392.20. This is local scroll-container clipping, not absent data or the tiny-screen hide rule. Full-detail scroll is `(17,17,606,377.60)`, client height 378 / scroll height 644.
- **320x240:** stage and shop overlay are 320x240, scale 1. Inline detail panel is `(5,94,310,41.50)` and uses `overflow:hidden`; stat-slot display is none. The stat row itself still computes `display:grid; visibility:visible`, demonstrating why checking only that element's CSS is insufficient. Full-detail scroll is `(13,13,294,130.80)`, client height 131 / scroll height 676. Opening auto-scrolls to the focused hero at scrollTop 42; keyboard focus progression reaches scrollTop 88. Subsequent ArrowDown positions are recorded in `320x240-scroll-steps.json`. Four 34.4px rows require 137.6px, exceeding this 130.8px viewport, so they cannot all fit simultaneously.

The game's logical 320x240 canvas is **not** the media-query viewport. At outer 1024x768 the stage scales to 960x720 and the tiny media query is false; at outer 320x240 it is true. The shop is mounted outside the stage transform. These are observed shipping defaults, not assumptions about the user's setup.

### Detail opener and return focus

At every size the keyboard route is selected sword -> Tab -> Sell tab -> Tab -> `shop-detail-open` -> Enter. The opener is enabled and fully within clipping bounds:

| Viewport | Opener `(x,y,w,h)` | Escape return |
|---|---|---|
| 1024x768 | `(687.88,634.60,114.98,33.60)` | detail removed; focus `shop-detail-open` |
| 640x480 | `(375.88,402.60,114.98,33.60)` | detail removed; focus `shop-detail-open` |
| 320x240 | `(13,187,85.50,24)` | detail removed; focus `shop-detail-open` |

## Cause assessment

The measured behavior follows two separate mechanisms:

1. `src/styles/runtime/shop.css:499-525`: viewport width <=460px **OR** height <=360px explicitly hides `.runtime-shop-detail [data-testid="shop-stat-slot"]`. This explains 320x240 inline hiding; it does not explain the 640x480 clipping, where that media query is false.
2. `shop.css:267` supplies the inline panel's `overflow-y:auto`; the compact layout has less vertical room than its content. `shopComparisonDom.ts:104-140` gives full detail a separate scrollable region. `shopDecisionInput.ts:75-86` implements keyboard scroll only when that region owns focus. `playSceneShop.ts:130-163` opens detail, focuses the actor, and restores the opener on close.

Calculation is not implicated by this run: `playSceneShop.ts` uses the same equipment preview for summary and detail, and all numeric attributes agree. The compact display/scroll conditions can explain why values are not immediately visible in these tested states, but no evidence establishes which, if either, caused the original report.

## Evidence and verification

- Small machine-readable table: `visibility-table.json`.
- Normal selection and opener: `<size>-inline.png/json`, `<size>-opener.png/json`.
- Initial full detail: `<size>-detail-initial.png/json`.
- Decisive fully revealed rows: `640x480-detail-keyboard-scroll.png/json`; `320x240-detail-keyboard-scroll-05.png/json` and `320x240-detail-keyboard-scroll-07.png/json`.
- Focus restoration: `<size>-return.json`; also `320x240-return.png`.
- `python3 summarize.py` passed: all three viewports, every numeric attribute, canonical row selection, keyboard detail opening and focus return, full-row reachability, canonical/bundle hash equality, 16 PNG dimensions, evidence-script syntax, and cleanup. No app build or unit suite was run because production code/data was not edited.
- Limitations retained: the initial `tsx` launcher was unavailable; Bun successfully executed the loader. The browser log retains two `Missing observed state` entries from evidence observers, including an incorrect status-menu child-focus predicate (the real control uses `aria-activedescendant`). The same browser continued from its correctly reached menu state; there was no second gameplay setup. No failed network requests. This is not presented as a zero-error run.
- Image attachments cannot be visually inspected by this child model. Screenshots are freshly captured and dimensions verified; visibility judgments rely on DOM geometry and inspected CSS, not subjective image review.

All owned page/context/browser resources are closed; owned PID1530620 and control listener36673 are absent. Existing servers9841/9888 remain listening. `cleanup-receipts.json` and `verification.json` preserve receipts. No source/DB writes, project saves, stock additions, inventory/debug grants, pointer actions, commits, or existing-server shutdowns. All new files are confined to this evidence subfolder.
