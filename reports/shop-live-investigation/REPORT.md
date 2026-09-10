# Live configured-project shop investigation

## Decisive finding

The configured canonical project currently has **no shop**. Its NPC named `상인` is dialogue-only. I played the actual Supabase-loaded project through the shipping player, triggered that NPC with the keyboard, advanced both authored messages, and returned to the field without any shop being mounted.

This establishes a **project/content mismatch**, not a reproduced equipment-comparison rendering defect. It would be false to claim that compact CSS, legacy item goods, stale comparison wiring, or an equipment restriction caused the user's original shop symptom: there is no purchasable goods list in the configured snapshot to test. No replacement fixture or shop was authored.

## Identity and provenance

- Configuration: main checkout `/home/main/z-project/rpg-zzu/.env.local`, read privately.
- Canonical project ID: `rpg-zzu-house-template-gallery`.
- Canonical content title: `호수 마을`.
- Runtime URL exercised: **http://127.0.0.1:9841/export-player/player.html**.
- The isolated browser's `/__runtime-qa/project.json` response contained the unchanged result of main's `loadProjectFromSupabase`, including its normal maps-table overlay and migration path. `canonical-project.json` is that data, not an authored fixture.
- Loaded snapshot SHA-256: `f8723892939ac574bc7c834429144a735181339e80c0e39a170ceba6b68b489a`.
- Main source HEAD observed: `d79e602eacbb8cc827c690e8e20388a6613892f1`.
- Separate read-only raw-row verification: `updated_at=2026-09-08T05:44:00.402+00:00`, `current_sha256=60f1b9d1070aa5091e45967f65edcff4fb5d406e4cd02720795ec83ebd4f8e06`. This raw wire hash is not the normalized/overlay snapshot hash above.
- The recent-project list confirmed the configured ID was the most recently updated project. Its metadata title changed between two GET observations (`증발 위험 변경` -> `호수 마을`); this investigation issued no database writes. Do not assume the shared row is immutable across agents/sessions.
- Port 9888 `/player.html` returned the **editor SPA fallback**, not a player. `/export-player/player.html` on both ports returned player HTML. Runtime evidence uses only the latter path on 9841, not editor screenshots.

## Concrete reproduction

1. Boot the shipping player with the configured Supabase snapshot in a new isolated context, QA instrumentation enabled, and private save namespace `st_01a07f83:live-readonly`.
2. Press **Enter** on `title-new-game`.
3. Start map: `map_lake_village` (50x50), authored start `(18,24)`. The shipping startup validator itself repairs this impassable start to `(17,24)`; this was not a project edit by the probe.
4. Merchant: `ev_village_42_map_lake_village_3`, page `ev_village_42_map_lake_village_3_p0`, authored/runtime observed position `(30,26)`, action trigger.
5. QA movement only: relocate the player to `(30,27)` and face up to reach the merchant. No event commands, shop handler, inventory, gold, party, or database records are injected/replaced.
6. Press **Z** to invoke the actual event. First message: `광장에서 과일을 팔고 있어요.`
7. Native pointer test: mouse click at `(512,615.6000137329102)`, within the observed dialogue body. It **does not advance** the first message. The bounded subscription to the expected second-message state timed out; this failure is retained, not reported as a pass. No `element.click()` bypass was used.
8. Press **Enter**: second message `호수 쪽 산책로도 추천해요!` appears. Press **Enter** again: dialogue closes and the field returns.
9. All shop selectors remain absent.

The second map is `map_lakeside_park` (40x40). The project has 12 events total and zero common events. The complete loaded project and the separately read raw project both contain zero shop commands. The merchant's entire command list is `changeFace`, `text`, `text`.

**Shop goods/item IDs: none.** There is no canonical shop selling either items or equipment. The database contains 226 item records and 86 canonical equipment records, but merely having them in the database does not create shop stock. The live party is not absent: `partyActorIds=["actor_hero"]`, with initial weapon `equip_sword`, shield `equip_oak_shield`, armor `equip_leather_armor`, helmet `equip_traveler_hat`, accessory `equip_focus_charm`.

## Screenshots and DOM/geometry

Fresh runtime captures, not reused report images:

- `01-canonical-field-firefox.png`: actual configured field after title entry.
- `03-merchant-first-line.png`: merchant first message.
- `04-pointer-click-no-change.png`: same message after native pointer click.
- `05-keyboard-second-line.png`: second message after Enter.
- `06-merchant-return-no-shop.png`: return to field, no shop.

The capture tool available to this child cannot display images to its model; **screenshots were captured, but subjective visual review is not claimed**. DOM and geometry are independently recorded in `live-dom-evidence.json` and `merchant-pointer-geometry.json`.

Measured viewport: 1024x768. Stage and real canvas rect: x32, y24, width960, height720. Dialogue rect: x62, y511.20001220703125, width900, height208.8000030517578, computed `display:flex`, `opacity:1`. Pointer hit-test returned the actual `.body` element containing the merchant text.

After the event completes:

| Selector/test ID | Present | Computed display / rect |
|---|---:|---|
| `shop-scene` | false | null; no DOM node |
| `shop-summary-stat-attack` | false | null; no DOM node |
| `shop-detail-open` | false | null; no DOM node |
| `shop-comparison` | false | null; no DOM node |
| `shop-stat-attack` | false | null; no DOM node |

This is absence of the shop itself, not a measured hidden stat row. The inline/detail CSS hypotheses cannot be meaningfully exercised on this content, nor can shop-pointer trade-versus-detail behavior or equipment-block reasons.

## Loaded comparison implementation

`loaded-bundle-evidence.json` records URLs, hashes and token presence for resources actually loaded during this play session:

- `export-player/player.js`: SHA-256 `fba48fdd6baa19109fac3eceaa069ba4301c4cadebb54491d97660005338af6b`.
- `export-player/assets/PlayScene-BAKbtaZw.js`: SHA-256 `34958e9b3eaa86463bf217547b9b7c0a5968256456c9e1395bb955cca1f6ff3f`. Contains `shop-summary-stat`, `shop-detail-open`, `shop-comparison`, `shop-stat`, and `unsupportedItemEquipment`.
- `export-player/assets/player-BhSXHFWt.css`: SHA-256 `e44f805a11eda7b96408b82e352e4530ff4ba67004c0dbc8080978d3ea2e2c0e`.

Thus the exercised shipping bundle does include comparison code. This does not claim that its UI was exercised without an authored shop.

## Errors, limitations and cleanup

- Initial Chromium boot probe had an incorrect QA asset route that forwarded JS chunks to SPA HTML; it produced `Unexpected token '<'` and `Phaser script loaded without exposing window.Phaser`. The probe route was corrected to serve only existing public asset files at the exported relative base and leave shipping JS/CSS requests intact. `boot-attempt-1.json` preserves the failed attempt.
- The corrected Chromium run reached the field, then its target crashed while attempting merchant input. `chromium-crash.json` retains the failure and cleanup.
- Firefox completed the actual merchant event using keyboard. It had zero request failures. The only recorded Firefox errors are the bounded observation rejection/unhandled rejection for the native pointer click that did not advance dialogue; it is not a successful pointer test.
- No production source edits, authored fixture substitution, project saves, DB writes, commits, profile clearing, or application-server kills occurred. Public asset routing reads existing files only. Boot/render instrumentation and QA movement are session-local.
- All three owned browser attempts closed their page, isolated context and browser. Their logs include close receipts. The owned diagnostic HTTP control listeners exited with their processes. A final `ps` check found none of PIDs 1324, 62439, 128225; application ports 9841 and 9888 remained listening.
- No application server was started/stopped. No build or code tests were run because this was read-only executable diagnosis.

**Remaining blocker:** the original reported shop cannot be reproduced from this configured canonical snapshot because it contains no shop. The report does not invent a root cause for another unidentified project or editor shop preview.
