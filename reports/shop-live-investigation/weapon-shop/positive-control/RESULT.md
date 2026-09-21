# Actual-game canonical-equipment positive control

PASS: actual canonical equipment displays its comparison in the existing shop.

- Project `oprn-e98456e1d8`, `용사의 여정`; same unmodified LegacyDb-loaded snapshot as the preceding consumable-stock reproduction. A fresh isolated Firefox context was used because the earlier owned context had already been closed.
- Shipping URL: http://127.0.0.1:9841/export-player/player.html
- Open runtime menu with Escape -> keyboard select Equipment -> hero -> Weapon -> Unequip -> Enter. No inventory/debug grant and no project save.
- Unequip preview shows attack **53 -> 45 (-8)** (`03-weapon-unequip-choice.png`).
- `unequip-proof.json` records inventory `{}` -> `{equip_sword:1}`, hero weapon removed, guardian's `equip_sword` unchanged. No legitimate restriction blocked unequip.
- Leave menu, use QA movement only to `map_weapon_shop` (5,10), face up, Z activates event `ev_villager_35c9ba59-6f59-47a3-b0fb-bcf9b6de5c25` at (5,9). ArrowDown selects Sell; Enter opens the real Sell list.
- `shop-sell-equip_sword`: `data-category=equipment`, unit price50, max quantity1. The selected sword is the actual unequipped authored item, not inserted test stock.

## Decisive visible comparison

`05-sell-canonical-sword.png/json`:
- `shop-summary-stat-attack`: **45 -> 53, +8**.
- data-current45, data-next53, data-delta8; computed display:grid, visibility:visible.
- Rect approximately x643.33 y360.90 w287.67 h37.30; parent grid also visible.
- `shop-summary-reason` absent.

Tab -> Sell tab, Tab -> detail opener, Enter:

`07-keyboard-full-sword-comparison.png/json`:
- `shop-comparison`: previewKind=ready, actorId=actor_hero, slot=weapon, sameEquipment=false.
- `shop-stat-attack`: **45 -> 53, +8**, same numeric data attributes.
- Computed display:grid, visibility:visible; rect x177 y341.5 w670 h37.30.
- No unavailable reason. This is an equip-preview even in Sell mode, not a promise of a sale changing actor stats.

## Native pointer vs keyboard (no element.click bypass)

- Native pointer clicked the enabled `shop-detail-open` at (745.37,651.40). Recorded pointerdown/pointerup/click target was that exact button, but detail stayed absent and focus stayed on the sword row (`06-pointer-detail-attempt.json`, `06-pointer-detail-no-open.png`).
- Keyboard Tab/Tab/Enter opened that same detail and rendered +8, as above.
- After closing detail, native click hit enabled `shop-sell-equip_sword` at (343.67,203.20). Events were recorded, but no trade occurred: gold0 and inventory sword1 remained unchanged (`08-pointer-sword-row-attempt.json`, `08-pointer-sword-row-observed.png`). The row had maxQty1; this cannot be explained by the earlier Buy list's zero money/maxQty0.
- No mouse success is claimed. The native-pointer dispatch problem remains a separate observed issue; this task did not diagnose its cause or alter production input handlers.

## Conclusion and cleanup

The actual-game contrast is now established: this same shop's Buy stock is special consumables and renders `notEquipment`, while an actual canonical sword obtained by normal unequip gameplay renders visible +8 in both inline and full detail. The comparison calculation/rendering works through keyboard controls at 1024x768. Native pointer activation remains independently broken in the observed Firefox surface.

All owned page/context/browser resources closed; process and diagnostic listener absence plus surviving app listeners recorded in `cleanup-receipts.json`. No browser errors or request failures in this positive-control run. No DB writes, production changes, injected inventory, saveProject calls, commits, or existing-server kills. Previous consumable and gallery evidence preserved. Screenshots are fresh captured runtime evidence; child model cannot visually inspect image attachments, so visual interpretation is backed by recorded DOM/geometry, not subjective image review.
