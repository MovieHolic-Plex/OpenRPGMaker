# Actual weapon-shop reproduction: oprn-e98456e1d8

## Decisive result

**Reproduced: the actual weapon shop shows no equipment stat increases/decreases because every stocked good is a battle consumable, not equippable equipment.** The shipping UI explicitly renders `data-reason="notEquipment"` in both the inline summary and full comparison detail.

This is **not** the legacy item-weapon rejection (`unsupportedItemEquipment`). The eight records have `type:"special"`, `consumable:true`, `occasion:"battle"`, and no corresponding `database.equipment` record. Their names and the map name suggest a weapon shop, but their actual data describes throwing items/bombs used in battle.

The appropriate content correction, if requested, is to stock actual canonical equipment IDs alongside these consumables. Do not relabel the existing battle consumables as equipment merely to force stat rows. No correction was made in this read-only task.

## Exact project and navigation

- Project ID: **`oprn-e98456e1d8`**, title **`용사의 여정`**.
- Actual runtime URL: **http://127.0.0.1:9841/export-player/player.html**.
- Data: main's `loadProjectFromSupabase` with this explicit project ID, including normal maps-table overlays; unchanged canonical load result delivered to the shipping player's `projectUrl` in an isolated Firefox context. No fixture, shop, party, gold or inventory replacement.
- Snapshot SHA-256: `2684a77c47d1ea75eb5ba9b4f17e09ff556550b08f42f0db81f67e616976ab3b`.
- Start: `map_blank_start`, `(3,8)`; press Enter on the real title screen.
- Shop map: **`map_weapon_shop`**, `무기 상점`, 12x16.
- Merchant event: **`ev_villager_35c9ba59-6f59-47a3-b0fb-bcf9b6de5c25`**, `(5,9)`.
- Page: **`ev_villager_35c9ba59-6f59-47a3-b0fb-bcf9b6de5c25_p0`**, action trigger, first command is the actual authored `shop`.
- QA movement only: teleport to `(5,10)` on that map, face up. Real Z activates the merchant; Enter chooses Buy.
- First selection: `item_throwing_knife`. Real ArrowDown selects `item_gen_throwing_knife` and updates the detail card.
- Real Tab, Tab reaches `shop-detail-open`; Enter opens the full comparison panel. Escape closes detail, Escape returns to entrance, Escape exits shop.

## Goods: actual data, not inferred from names

All eight entries below resolve from `database.items`, have item type `special`, are consumable/battle-only, and have no canonical equipment ID match:

| ID | Name |
|---|---|
| `item_throwing_knife` | 투척 단검 |
| `item_gen_throwing_knife` | 균형 투척 단검 |
| `item_gen_shuriken` | 수리검 |
| `item_poison_dart` | 독침 |
| `item_bomb` | 철제 폭탄 |
| `item_fire_bomb` | 화염 폭탄 |
| `item_ice_shard` | 빙결 파편 |
| `item_thunder_stone` | 뇌전석 |

`all-shop-classification.json` checks the other authored merchants in this same project's three maps. The only other merchant is `ev_merchant_claire` at `(9,7)` on `map_blank_start`; both its shop-bearing pages stock only `item_potion` (`medicine`). There are zero common events. **No existing merchant in this snapshot stocks equipment**, although the database has 87 equipment records. Claire was inspected in canonical data, not separately played.

## Live DOM and geometry evidence

Viewport: 1024x768. Both party members are present: `actor_hero`, `actor_guardian`. Gold is 0 and inventory is empty; no money or party seeding was performed. Insufficient purchase money does not explain the unavailable comparison: the actual reason is `notEquipment`.

Inline summary (`04-stock-geometry.json`):

- `shop-summary-reason`: `data-reason="notEquipment"`.
- Text: **`장비가 아닌 물건은 장착 비교를 제공하지 않습니다.`**
- Computed `display:block`, `visibility:visible`.
- Rect approximately **x643.33, y302.20, w287.67, h40.60**.
- Parent `.runtime-shop-comparison-summary` is `display:flex`; containing `shop-stat-slot` is `display:block`, with the same positive dimensions.
- `shop-summary-stat-attack` is **absent**, not a CSS-hidden node.
- `shop-detail-open` is visible, approximately **x687.88, y634.60, w114.98, h33.60**.

Full detail, opened by keyboard (`07-full-detail-reason.json`):

- `shop-comparison`: `data-preview-kind="unavailable"`.
- `shop-preview-reason`: `data-reason="notEquipment"`, same explicit Korean explanation.
- Reason computed `display:block`, `visibility:visible`, rect approximately **x177, y191.60, w670, h20.30**.
- `shop-stat-attack` is **absent**.

This rules out compact CSS as the cause in this reproduction: the inline reason is visible at desktop size, and full detail gives the same non-equipment reason rather than any hidden ledger or actor restriction. The comparison implementation is actually loaded: `loaded-bundle-evidence.json` records live resource URLs/hashes and tokens including `shop-summary-stat`, `shop-detail-open`, `shop-comparison`, `notEquipment`, and `unsupportedItemEquipment` in the gameplay chunk.

The code mechanism corresponds to the live evidence: `playSceneShopGoods.itemToGoods` marks these as `source:"item"`, category `special`; `shopEquipmentPreview.previewShopEquipment` returns `notEquipment` for non-equipment-category item goods; `shopComparisonDom` renders the reason and does not invent stat deltas. The upstream issue is the authored shop stock, not the presence of a comparison button.

## Honest native-pointer result

No `element.click()` bypass was used.

- A real mouse click at approximately `(343.67,269.20)` hit the Shuriken row. Captured `pointerdown`, `pointerup`, and `click` targets all identify `shop-buy-item_gen_shuriken`; selected row nevertheless remained `shop-buy-item_gen_throwing_knife`, no detail opened, no purchase occurred.
- Row is a BUTTON, **`disabled:false`**, no `aria-disabled`, with `data-max-qty="0"`, `data-unaffordable="1"`. Do not describe it as a native disabled button.
- A subsequent native click at approximately `(745.37,651.40)` hit `shop-detail-open`, but **did not open detail**. The exact prearmed comparison-mounted observation timed out; `08-native-pointer-opener-no-change.png/json` and the error log retain this failure.
- Keyboard activation of the same opener had already succeeded and produced the decisive full-detail screenshot.

The pointer discrepancy is an additional observed runtime/input issue whose cause was not investigated at this task's stop boundary. It must not be reported as working pointer navigation, a successful trade, or proof that clicking a good opens detail. It does not change the item-data cause of absent equipment deltas, which is reproduced using functioning keyboard controls.

## Fresh screenshot index

- `01-weapon-shop-field.png`: reached the real shop map.
- `02-shop-entrance.png`: actual merchant event opened the shop.
- **`04-stock-geometry.png`**: first selected throwing knife, visible non-equipment reason.
- **`05-keyboard-second-goods.png`**: ArrowDown-selected balanced throwing knife.
- `06-pointer-row-observed.png`: row click did not change keyboard selection.
- **`07-full-detail-reason.png`**: full comparison panel with explicit non-equipment explanation.
- `08-native-pointer-opener-no-change.png`: failed native pointer opener, recorded honestly.

These are fresh player screenshots, not editor-shell images or old fixtures. This child model cannot view the image attachments; screenshot capture and DOM/geometry are verified, subjective visual review is not claimed.

## Cleanup and limits

- Firefox page, isolated context, and browser closed with receipts in `browser-session.json`.
- PID 294271 absent; owned diagnostic port 40127 closed. Existing app ports 9841 and 9888 still listening (`cleanup-receipts.json`).
- No request failures. The two recorded error entries are the timeout/rejection for the failed native pointer opener, not an unreported successful pointer test.
- No production edits, DB writes, fixture/content substitution, commits, real-profile clearing, or app-server kills. No application server was started. Canonical snapshot and report files only were created under the new `weapon-shop/` subfolder; earlier gallery proof is preserved.
- No code validators/build run: this task was read-only browser diagnosis, not an implementation change.
