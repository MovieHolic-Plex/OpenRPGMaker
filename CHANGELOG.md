# 변경 기록

이 파일은 `npm run release` 가 커밋 메시지에서 생성한다. 손으로 고치지 말 것 —
고칠 것은 커밋 메시지다(`feat:` `fix:` `refactor:` … 규약은 openwiki/release-and-version.md).

<!-- releases -->

## 0.360.1 — 2026-10-29

### 수정

- **fallen** — freeze Fallen Star towns to committed snapshots so generator changes cannot break the demo bake (#3912) (`147ffa2`)
- **runtime** — field-backdrop battle snapshot wait, timed-choice bar position (#3911) (`8cbb079`)

## 0.360.0 — 2026-10-29

### 기능

- **runtime** — opening animatic without black gaps, battler scale, no retreat box on evented battle ends (#3910) (`574cd06`)
- **store** — REFMAP-MODIFIED licence for modified REFMAP chips (#3908) (`9fe500f`)

## 0.359.0 — 2026-10-29

### 기능

- **chase** — field chasers 2x+ faster and smarter (#3907) (`4127a63`)
- **assistant** — party split looks/dialogue, dark obstacle cells, puzzle rewording, skill forgetting (#3904) (`6693f3d`)
- **assistant** — stealth patrol & puzzle tools, cone light sources (#3902) (`48d969d`)
- **assistant** — upsert_world_codex writes Codex documents and relations; character profile note; demo bake warns on empty lore (#3901) (`95b99e7`)
- **assistant** — paint_beodeul_plan tool, wall-mount on town walls, orphaned fadeOut safety net (#3899) (`65dbf02`)
- **assistant** — tool and runtime upgrades found while building the Fallen Star act 2 demo (#3898) (`5913c49`)
- **builder** — re-authored shop templates (bakery s/m, flower shop, tailor, village store) with a one-row keeper lane behind the counter and a customer row — all five Sonnet high PASS; clothing-shop words route to tailor_shop (`e93a888`)
- **builder** — 11 more hand-composed templates (retried inn halls/house/monster lab, clinic exam, nurse station, morgue, attic, grandma living/bedroom); hospital/attic/flower-shop words; lab bench (ball-like art) out of templates (`22f2d1b`)
- **builder** — no repeated room template within one game — rooms tag their template, venue maps tag the venue; the next same-use room rotates to the least-used variant and a second inn skips the venue (`205ff0e`)
- **builder** — 18 more hand-composed room templates from real game-run interiors (inn hall/guest rooms/kitchen, escape study/storeroom/bedroom sizes, village house, weapon shop, monster lab), Sonnet-reviewed; guest room/weapon shop/cottage/shop words route to them (`6699063`)
- **builder** — 15 hand-composed room templates from existing chipset objects (classroom, general store, laboratory, jail, chapel, small escape rooms) with overlap and reach lints (`600c723`)
- **builder** — vignette recipes per room use, room size from group footprint, purpose cores for rooms without examples (`acc13bc`)
- **builder** — assistant interiors place furniture with the vignette placer by default (no whole-room venue, no bare-floor filling) (`9ae49e7`)
- **builder** — interior vignette library — touching furniture groups from author example rooms, with wall/front/repeat rules, and a deterministic placer (`50017f5`)
- **ai** — leftover VQA blocker defects are a ship blocker — up to 2 extra fix rounds, report must say not complete (`9241a9c`)
- **ai** — blueprint progress after every build verb; optional designer model writes the blueprint (A/B/C comparison) (`a4dbc8f`)
- **ai** — blueprint-first whole-game building — write_blueprint verb, pinned blueprint, ship gate walks the critical path (`1b3ec87`)

### 수정

- **assistant** — patrol pauses survive retiming and scale with pace; combo staging accepts partners (#3906) (`ab75dd7`)
- **flagship** — leave bare floor under the vault star seal (#3905) (`872b5e3`)
- **css** — pass the CSS ratchet for the assistant suite bundle (`e4d0798`)
- **builder** — studies stop repeating one room — seeded template pick over hand + example designs, and a composed study path (seeded room shape, character-weighted vignettes) (`b358d77`)
- **builder** — dungeon dressing never cuts off floor that was reachable before it (`3a6f2ac`)
- **builder** — doors to the next step's map open only after this map's step; locked lines name the step (`0cfa491`)
- **builder** — clue lines point at the real clue object, stale chain clues dropped, digit words match codes, combined-clue safes ask for the number; facing any cell of an object reaches its examine event (`4dd2844`)
- **runtime** — draw a translucent player silhouette when a star furniture tile hides the body (`35abd2e`)
- **runtime** — zoom long narrow maps to fill their narrow axis (up to 1.5x the base view) (`dcb1efa`)
- **builder** — the first path battle levels the starting party up — shrink the shared exp curve when it does not (`c82d664`)
- **runtime** — battle-victory autosave waits until the event that started the fight finishes; the menu does not open while an event runs (`1aadc3f`)
- **builder** — start objective points at the first step, locked lines name what opens them; restore createBuildRun import after rebase (`5af5fc6`)
- **builder** — integration-head replay regressions — passage gates keep a 1-cell body, battle/transfer events are not examine spots, off-art entrance needs a cell to stand at (`5babed0`)
- **builder** — mystery accusation opens — evidence item gates the accusation, standing NPC stays the culprit, wrapped token names unwrapped, unset step conditions set by the previous step (`1a746e2`)
- **builder** — one path for lock result lines and floor examine spots after the outdoor merge (`693d9fc`)
- **builder** — a defeat without an authored outcome returns the party with progress kept instead of a title-only menu (`356c778`)
- **builder** — path battle budget sees route maps, common events, random lists and field spawns, carries lingering poison, and lowers enemy skill power (`8c13f07`)
- **builder** — monster finish rebuilds the gate level curve leader < boss < champion (`24aef91`)
- **runtime** — auto-battle breaks rounding ties by type-chart multiplier instead of a coin flip (`7020853`)
- **builder** — object-sheet chips (chests, bars) are not people for crowd spreading — boxes inside clocks/desks were dragged to the floor (`10abb52`)
- **builder** — interior majors from real game runs (vm4/vm5) — people avoid furniture cells and wall gaps, reach seeds the start cell even on an exit gate, 'inn ledger' is not a person, clue props move off runner rugs, a floor-standing door chip in an escape room moves to the wall; bakery-cafe lounge against the east wall (`ecbab1d`)
- **modern-city** — bakery-cafe back row uses staggered cafe round tables (2x1 tables read as benches) and the table under the espresso-bar gap has no north chairs; the full window-bar redesign blocked the gap from the upper rooms (room-vig9 77.8) (`c36d5b9`)
- **modern-city** — bakery-cafe hall seats vary by group instead of three copied table sets with back-to-back chair rows; hospital ward beds keep monitors/bedsides beside the bed and curtains two rows below; room shrink counts dropped template furniture as a crash; template rooms skip same-kind anchors (`9a53707`)
- **runtime** — show the current objective and controls in a centre card when play first becomes controllable (`42de9f0`)
- **runtime** — register large chipset frames, strip animations and relief pixels lazily (`9e765cc`)
- **runtime** — battle fast-forward runs at 3x and keeps hit-stop frames at full length (`c52b8b9`)
- **builder** — vm4 blocked runs — ending on the last step, footprint-aware reach, buried exits, route tails past bare bearings; bolder gold objective arrow (`d511748`)
- **builder** — JRPG finish fits path battles to a no-wipe budget (pre-boss HP loss sum, per-battle turn caps, symbol-foe count cap) and stocks a potion per pre-boss fight (`b646134`)
- **builder** — an objective naming two places tails only the one on the way to the other instead of repeating the same first exit twice (`0141576`)
- **runtime** — the objective window also avoids entrances and the building face above them, so it no longer covers a town's monster-center sign when the camera is pinned at the map edge (`1533879`)
- **builder** — route level lift stops where the lone starter still wins 80% of seeded sims, so newly learned typed moves do not make route 1 unwinnable (`ea90138`)
- **builder** — monster campaign finish lifts route wild and trainer levels onto the curve from the starter (or previous gate) to the next gym leader (`efc42dc`)
- **builder** — tune_enemy in monster games solves against the starter monster at the enemy's level and both sides' strongest moves (type chart, special moves tune mind) (`b1f8ba6`)
- **runtime** — reproduce the 'truncated HUD objective' report; the HUD shows it whole (`5fea982`)
- **runtime** — measure new-game load stages (pacing-boot) and add CPU profile ops to runtime QA (`77f4ae7`)
- **runtime** — Escape right after saving closes the whole menu (`07a6842`)
- **runtime** — a confirm key pressed to skip a battle sequence no longer lands as a command the instant the command card appears; the player's chosen battle speed carries into the next battle (`75d78ab`)
- **builder** — humanize id-like map names; objective arrow follows the walking route (`ec361a6`)
- **builder** — shelves/cabinets and crates/sacks/baskets count as the same kind for anchors in hand-composed rooms (no shelf hung over a wall cabinet, no chopping block in the counter gap) (`efed5fe`)
- **interior** — tabletop goods sit on the drawn top of raised-surface furniture (counter top is dy -1, not the drawer face); goods tiles are star so the lifted cell behind a counter stays walkable (`b2bc82a`)
- **builder** — connect map-edge exits to the map's road; keep edge exit labels inside the map (`d021d84`)
- **builder** — move mid-floor transfer cells onto a wall door, south gap or stairs, and re-pair the return transfer (`7387bd4`)
- **runtime** — hide title Resume when the newest save predates the last ending (`d08cdd7`)
- **runtime** — ending credits — one confirm keeps fast-forward, a second skips; placeholder credit title uses the game title (`25eca46`)
- **runtime** — dialogue typing catches up when the device lags; shorter punctuation pauses (`1534926`)
- **builder** — furniture-wide examine bodies skip events that carry a transfer, so a same-map puzzle gate does not become a 3x1 rotating door that walls off its side (`83bc506`)
- **builder** — monster campaigns point the objective at the gym on arriving in its town and refill branches no longer become fake milestones (`22ff4cf`)
- **builder** — monster-game balance checks measure later campaign battles with a caught-and-levelled party and simulate_battle uses monsters (`458f435`)
- **builder** — reach checks walk through same-map passages so a puzzle-gated gym leader stays behind the puzzle (`a1f753c`)
- **builder** — indoor people avoid doors, sole furniture access, stacking and runner rugs — placement cost in resolveWhere, and spreadCrowdedPeople also moves people standing on such blocking cells (finish and after place rebuilds); at (0,0) is a placeholder; blank flat filler is not a person; bare-floor shrink is refused when it makes furniture overlap (`4422ec1`)
- **builder** — combat games with gold and no shop get a supply merchant near the start (never on the start pocket's only neck); the boss rest crystal prefers the entrance side of the boss (`c065734`)
- **builder** — label transfer cells with the destination map name when the player is near (`78563be`)
- **runtime** — recover-all also clears lasting states (poison carried out of battle no longer survives the healing spring) (`43b19f7`)
- **runtime** — the status menu clock reads like the save slots (m:ss under an hour) — a 38-second game no longer shows 0:00 in the menu and 0:38 on the slot (`8f3ed48`)
- **runtime** — the key that confirms a load no longer re-examines the event the hero faces (`ccba55a`)
- **builder** — spread crowded NPCs so each has two open sides; story-NPC and spent-target examine markers; talk to walkers from the cell they are leaving (`155531c`)
- **builder** — replay regressions — self-loop only onto the event cell, remaining-clue pages only with real progress conditions (`05fba6d`)
- **builder** — mystery finish restores a lost culprit pick and tells how many clues are left (`406ef84`)
- **builder** — multi-map objective tails name the next door inside the map passed through; locked exits must say why (`b2d355f`)
- **builder** — objective exit hint says which of the side-by-side doors (문 셋 중 왼쪽) (`d08ff0f`)
- **builder** — lock success lines only after the right code; examine spots move to the named furniture nearby (`a88fd45`)
- **builder** — drop stray step copies, fit unwinnable gate bosses and put a rest crystal before bosses at finish (`0d9ff4e`)
- **builder** — order step battles behind earlier steps, drop self-loop transfers and empty sparkles at finish (`eb0cdaf`)
- **builder** — examine events answer from every furniture face; bare clue spots get a prop; runtime examine marker (`ecd8082`)
- **builder** — bed/bookshelf/wardrobe anchors count as present in authored rooms (no second bed in a hand-composed bedroom) (`d3497ac`)
- **ai** — a single-place request that names its game ("…game's village shop interior, just this one room") is not a whole-game request — the blueprint gate blocked make_place (`909ab9e`)
- **builder** — code locks use the model's clue number, no result line before input, empty Enter never submits, bare-map escape gets a real room (`b0b990b`)
- **builder** — whole-game requests include RPG and exclude single-room/part-of-game asks; entry steps carry the player into the next place and lock its other doors; objectives read where they land (`582c594`)
- **builder** — finish clears combat leftovers in combat-free games and forks stacked named ending calls on their conditions; critical reachability follows same-map transfers; time-mismatch and romance opening messages name the scene and the safe tool call (`442b127`)
- **builder** — examine cells off big event bodies, start in main walk area, cave mouth never seals start (`29944b0`)
- **builder** — no floating props in caves/villages, cave room purposes, second-door road stubs (`6dc29b1`)
- **builder** — title/ending off-premise check reads the blueprint story and title subtitle, the same text the assembly picks art from (`b3b3325`)
- **builder** — finish assembly also adds the where-tail to tail-less objectives that ship check objective-missing says can take one (`71eee0e`)
- **builder** — start objective never rides a page that reruns on map load; remove decoy door art next to the real door (`2a7d11d`)
- **builder** — escape exits on a south wall gap when the north wall has no door spot; code steps keyed by a code clue need input and the clue tells the number; retire orphan empty maps (`7015754`)
- **runtime** — save slots keep the current objective line (`76b96e4`)
- **builder** — objectives aimed at a battle-gated step point at the battle that opens it, and unnamed boss events take their troop name (`a90f6bc`)
- **builder** — objective tails give the bearing of the first exit from where the objective is set, route through intermediate maps, start objectives point at the first blueprint step, and finish assembly rewrites stale tails (`fbb2a63`)
- **builder** — cave wall stalagmites grow as mixed staggered clumps; no stray logs on cave shores (`92106cb`)
- **builder** — village start cell is no longer a grass hole in the river or the map's bottom row (`7692b0b`)
- **runtime** — objective marker follows the map route to the first exit, shows an arrow by the player when the target is off screen, and empty action pages stop offering 「Z 조사」 (`0f4a85e`)
- **builder** — generic kind words (shop/store/room) no longer pick a template by name fragment — kind shop picked tailor_shop over general_store (`b9a4fe6`)
- **builder** — a zone group that is all parts of one use (jail = cells + guard corridor) builds as that use's single template room; table/seat anchors count as present in authored rooms (`dbaf379`)
- **runtime** — an objective naming several people marks all of them, not only the longest name (`8cd99e1`)
- **builder** — mystery blueprints get three suspects, evidence presentation and a culprit pick instead of four invisible spots in a row (`cbf29c7`)
- **builder** — one finish auto-build for runtime and replay; fit unwinnable step battles, fill stale objectives, drop dead ending conditions, keep the start off sealed gaps; autoplay opens lever-gated paths (`8052e6c`)
- **builder** — clear a single chair blocking the front cell of an examine or talk target (`c579dd7`)
- **runtime** — current objective target keeps a soft marker on screen and the action prompt names what you face (`854bae9`)
- **builder** — hiding spots sparkle when the player comes within two tiles and show the hide prompt from any adjacent side (`9c87189`)
- **runtime** — a new chat message closes the open confirm card that would block it instead of queueing behind it for 30 minutes (`7cd2681`)
- **builder** — ship defaults also fill party names, menu look, game over and off-art entrances; inner battle rooms take the nearest dungeon ancestor's backdrop via transfers and blueprint order (`80c2d98`)
- **harness** — whole-game session declines an open decision card before typing the next request (`9cdfb28`)
- **runtime** — model calls give up on silent streams after short per-call limits and bounded retries; screen-fix turns stop repeating failed edits (`13820de`)
- **builder** — fill the six ship-check leftovers (battle music, battle backdrop, party look/face, ending closure, default place word) deterministically at finish assembly; slug map names are not place names (`a662c5a`)
- **builder** — keep authored room templates as authored (no shrink/fill/dress), count same-kind anchors, let small rooms pick authored templates (`936bf44`)
- **builder** — interiors default back to venue/room templates; vignette placer only when a zone has no template for its use or none fits its fixed size (`0eef614`)
- **builder** — vignette rooms stop copy-pasting wall groups, seat dining tables, keep footprint size (no C/D variant growth), shrink depth first (`969c83d`)
- **builder** — auto path step also fixes battle-bypass and no-healing games; checkpoint end fixes even when the path rebuild declines (`e3b6f9a`)
- **builder** — upper floors pick the layout and corridor width with the fewest void cells (`126b259`)
- **builder** — NPC faces sit right before that speaker's lines, not over narration (`c997630`)
- **types** — clear the narrow tsc errors in this batch's files; openwiki states one order for clearLanes and points battle steps to one page (`ec3dafc`)
- **builder** — a blueprint battle step only advances after winning the fight; the ship check flags endings reachable without the boss (`9a1b1e8`)
- **builder** — battle games get a healing spring and starting potions, and a blueprint key locks the door to its place (`4aba5c3`)
- **runtime** — double-Esc cutscene skip works while a dialogue line is open (`1af8803`)
- **builder** — the plain JRPG path fits picked troops to the start party too (`67a815d`)
- **builder** — title never shows the project id slug; subtitle drops words already in the title (`825e4db`)
- **builder** — objective tails name only the event on the same map (`0249551`)
- **builder** — chaser maps get 1-2 hiding spots on existing furniture near the patrol; ship check blocks a chaser with zero hiding spots (`dda715a`)
- **builder** — dungeon enemies are fitted to the start party instead of copying the strongest DB troop's strength (`0443ebf`)
- **runtime** — title menu window no longer shows the map through it; pixel ESC command rows get 16px and clear the cursor (`5f37d91`)
- **runtime** — game-over choice plates over a background share one width instead of stepping by label length (`68c547a`)
- **runtime** — skill list keeps the weapon tag next to the name and seats Back in the header row so three skills no longer show a false scroll cue (`83844aa`)
- **runtime** — objective chip keeps a minimum width, Z prompt steps off the exit corridor, firmer night-glass box, roomier ESC header (`ea285c7`)
- **runtime** — small-room margin continues the ceiling pattern instead of a flat colour band (`2082922`)
- **builder** — edit_place with zones on the blank placeholder start map builds the place there instead of failing (`870e7c4`)
- **runtime** — the skill list no longer repeats the basic attack skill (`7e432a6`)
- **runtime** — choices show with their question text, sparkles stay behind the hero, solo ending kicker, calmer ESC title item (`ca7eb58`)
- **runtime** — autoplay models multi-day loops where each day's page raises affection (`f690019`)
- **builder** — mark 1-wide doorways between partition rooms with round arch or doormats (`192db6a`)
- **qa** — runtime-qa checkpoints boot the --whole-game SQLite project (`bc4a825`)
- **runtime** — readable gold unit on the victory window; interior/crypt maps fight on the cave backdrop (`d8a9554`)
- **qa** — autoplay plans quest deliveries — itemCount-queried variables resolve to holding the item (`2fc1db5`)
- **builder** — invisible examine spots no longer become invisible walls on blank floor (`f52862f`)
- **builder** — blueprint walk sees battle/shop branches; ending devices are doors only in escape games; narrow dead gaps close without a door (`caea8d1`)
- **runtime** — game-over text gets a dark plate over background art; no PgUp hint for one-line bodies (`cedfd8d`)
- **runtime** — retro party window HP/MP columns grow to fit four-digit vitals (`b960c0c`)
- **builder** — blueprint objectives point at the next step; where-only set_objective no longer overwrites the start goal; parse array-string needs/gives (`92177fe`)
- **builder** — escape-room blueprints can no longer be walked out of — ship check flags off-place exits, builder seals them (`fed5795`)
- **builder** — blueprint code steps need the number — clue + input-gated ending; exit door finds room when the north wall is full (`ed9a7fc`)
- **builder** — blueprint default opening — map-view shots of start/next places with blueprint-sentence narration when the opening is missing/off/preset stills (`f6b1579`)
- **runtime** — opening animatics keep actors above the narration band (camera lift, or band to top when the backdrop ends) (#31) (`b244c7b`)
- **runtime** — objective box prefers off-map margin bands over any room overlap (narrowed/widened to fit, real measured height) (`3872bea`)
- **builder** — build late blueprints, retire the blank start map, keep provider error text out of the final answer, classify empty maps as fixable (`2aa1f3c`)
- **builder** — size dungeon rooms and cave chambers to their contents; give the monster home town's empty side a pond and clustered trees (`8c715d1`)
- **builder** — village trees and shrubs grow as clumps instead of rows and scattered singles (`01a3d74`)
- **builder** — flat villages also reopen walkable meadows sealed off by props (jrpg north meadow); cave mouth never half-covers a multi-cell prop (`76733b3`)
- **builder** — dungeon down-stairs no longer land inside the boss-room ritual circle; wiki notes for bridge deck, gate spot and floor decals (`b62f953`)
- **builder** — dungeon outdoor gate avoids fields, fences, houses and roads — cave mouth only where its 3x4 fits on open ground, else a reachable map-edge road end (`a95ec38`)
- **builder** — route tall grass patches get ragged, rounded edges instead of ruler-cut rectangles (ledger 125); replay honours the monster-request turn (`1d727fa`)
- **builder** — village stone bridge deck carries the road paving — the ashlar deck read as a wall across the road (ledger 120) (`67000b4`)
- **builder** — single-room interiors stay under 30% bare — downsize retry, workbench rows, magic circle floor decor, doormat is not a room rug (`f223179`)
- **builder** — close dead south exits with wall-door art and fill navy void cells in interiors (`982b37a`)
- **runtime** — fill non-integer-zoom small maps by fractional fit; skirt only extends rare seamless exit runs (`ddf16a3`)
- **builder** — magic-school places build wizarding_world spaces per room with linked doors and in-set prop substitutes; Joseon picks village by request hash and links extra rooms (`bff4f5f`)
- **builder** — deleting a map that the title shows as map-view clears it and remove_map re-picks the title instead of failing integrity (`fa04009`)
- **runtime** — ending/credits screens keep Korean words whole and balance credit lines (#107) (`29ff1df`)
- **runtime** — authored VN looks keep the veil stage's --dialogue-ui-scale (9px line in a 1024x768 box, #106) (`8533493`)
- **runtime** — pixel menu location name wraps instead of ellipsis (#47) (`2c34244`)
- **runtime** — emerald notebook hint contrast (#134), softer battle message shadow (#138) (`f658726`)
- **runtime** — title subtitle/menu legibility over art and weather (outline, brighter, tighter Hangul tracking) (`34ed277`)
- **runtime** — scale 320x240-designed UI on hi-res stages (dialogue, title, narration, skip hint); balance narration lines (`95d0419`)
- **runtime** — objective box also avoids action events (incl. invisible investigation spots) (`4ca05fa`)
- **builder** — Joseon/Hanyang/sageuk requests build joseon_baram registered places; Japanese-modern villages go to jp_city; murim reports missing chipset (`1e7e07d`)
- **runtime** — map-view title frames the busiest window at 1-2x and lays a dark vignette under the title text (`ed38f46`)
- **builder** — blueprint title never points at a still-blank map (it blocked builders from replacing the blank start map) (`e6e05f4`)
- **builder** — VQA fix loop only hands the model defects a verb can fix; ledger the rest, stop at zero (`c406fbe`)
- **builder** — auto links use door/stairs/road-end art, person steps get character chips, NPCs step off transfer lanes (`ef20f81`)
- **builder** — interior rooms sized to their content — dense templates, no per-room 1.3x in multi-room buildings, inner trim, every room dressed for its purpose (`d7ede3d`)
- **builder** — a "great" hero object too big for its room becomes its small variant (`00bb93c`)
- **builder** — goods on pedestal tables sit on the tabletop; interior/house make_place keeps the start on the main floor (`fc87b7b`)
- **builder** — shrink the emptiest interior room instead of filling it; no rug on rug; set repetition caps (`ba80a6f`)
- **builder** — interior rooms sized to content, dress_room keeps walkways, examined things drawn (`c54613b`)
- **builder** — reject character/face sheets as opening images and animatic backgrounds (`9d1d0f4`)
- **builder** — title art only when it strongly fits the genre/place, else the game's start map; horror art only for horror (`7642ebd`)
- **runtime** — title background accepts map-view:<mapId> and draws that map as dots (`1ab5f5b`)
- **builder** — an exact place match (폐병원) outranks a mood-only match in the blueprint title picker (`184ca5f`)
- **builder** — title/opening defaults follow the game blueprint; lenient set_opening/set_title_screen args (`ae026f4`)
- **builder** — finish gate builds missing blueprint places and links unreachable ones before the path (`b2e5a05`)
- **runtime** — cutscene skip hint reads 'Esc 두 번'; menu landing shows the current objective (`d6081c9`)
- **runtime** — to-title detail always offers its entry instead of an unprepared-confirm notice (`07b54d9`)
- **runtime** — number input shows the cursor digit, takes arrow keys, explains its controls (`609a6c4`)
- **runtime** — objective HUD picks a spot clear of player, NPCs and HUD; Korean wraps at word boundaries (`d0b2752`)
- **runtime** — small-map fit keeps a half-tile margin; margin takes the room's edge colour and exit passages continue (`8cfc7d5`)
- **builder** — clue events sit on the object their name names — chipset label match, item tile fallback (`acced81`)
- **runtime** — start cell avoids solid visible objects; map VQA shots say the player is not drawn (`716be07`)
- **builder** — opening actors on a map-view backdrop use the backdrop's pixel scale (`e47e4a6`)
- **runtime** — save-point glow no longer washes out light floors; objective chip settles to 0.4 (`f9f1983`)
- **runtime** — darkness mask stays inside the map, light mask colours become a soft tint (`99db5f3`)
- **runtime** — small rooms fill the screen at an integer canvas zoom (`3a88eca`)
- **builder** — puzzle-chain and blueprint-path events must be walkable — repair reach, snap door events to door art (`1dd26da`)
- **builder** — blueprint path is built deterministically — build_blueprint_path verb, auto-build at finish, no-ending gate (`804c6d6`)
- **harness** — wholeGameSession honours --ai-config again (`287902e`)
- **harness** — project host startup deadline 60s → 180s (suite runs under load) (`1d5513f`)

### 문서

- **openwiki** — study composed path, seeded template pick, variety key and the study-variety bench (`c4b122d`)
- **openwiki** — regenerate index for the autosave and first-level-up notes (`7927caa`)
- **openwiki** — furniture body and off-art entrance limits (`c7f3e01`)
- **openwiki** — finish one-path lock lines/examine spots, unset step conditions, model accusation culprit (`4ca6ac0`)
- **openwiki** — finish deterministic repairs from the vm3 judge pass (`61e0fd9`)
- **interior** — hospital props are a TODO checklist — not drawn, ward falls back to bedroom until they land (`9baf348`)
- **openwiki** — vignette phase 2 — recipes, footprint sizing, purpose cores (`18949be`)
- **openwiki** — objective margin-first placement, animatic narration band clearance (`1df56b5`)
- **openwiki** — hi-res stage UI zoom, VN look scale, title legibility, credits wrap (`cf34e6e`)
- **openwiki** — objective placement, keep-all wrapping, number input controls, to-title detail (`dd11b96`)
- **openwiki** — write_blueprint and the blueprint ship walk (`c794afb`)

### 테스트

- **runtime-qa** — victory-autosave scenario (save after the foe is cleared, load does not re-fight, ESC during a touch event); monster campaign waits through a sight trainer's speech (`1e10e91`)
- **runtime-qa** — defeat-recover scenario loses a cave bat fight at 1 HP and records where the party wakes and what it kept (`e573dc3`)
- **runtime-qa** — monster campaign fights every route trainer and gym grunt, settles after a loss, and can pick the starter (`874bb83`)
- **runtime-qa** — monster campaign scenario walks starter, capture, trainer, gym puzzle, leader, boss and league; battle op answers the forced switch (`ae4ec62`)
- **runtime-qa** — autoplay presents the evidence a goal needs and a mystery scenario walks suspects, presentation and the culprit pick (`64b8167`)
- **runtime-qa** — objective-target scenario shoots the target marker, the named prompt and the next objective (`9a457ff`)
- **runtime-qa** — horror run shows the hiding spot before entering and records how close the chaser came while hidden (`75f4dce`)
- **runtime-qa** — magic scenario plays the desk and statue riddle instead of forcing the tower switch (`d6cb8d4`)
- **runtime-qa** — whole-game magic/joseon story scenarios (opening, bust dialogue, door transfers, ending) (`1a975d4`)
- **runtime-qa** — horror run hides — spotted at the corridor mouth, runs to the bed hiding spot, chaser comes within two tiles and leaves (`4a906df`)
- **runtime-qa** — whole-game horror run — locked door, chaser sight and catch, horror game over, checkpoint retry, title load; debug switch writes refresh event pages (`6ec145e`)
- **runtime-qa** — whole-game battles cover skills, items, escape, wild encounter and capture (`605bbcb`)
- **runtime-qa** — whole-game battle scenarios for jrpg/dungeon/monster in the shipped player (`0c22e69`)

### 잡무

- **interior-authored** — build collects rooms*.mts (--skip-bad for parallel drafts), survey of real game-run interiors, Sonnet review script (`5f56871`)

## 0.358.0 — 2026-10-29

### 기능

- **i18n** — plural slots, place-scoped keys and bundled data names in the translator (`3bf0bf2`)
- **ui** — follow the OS dark mode and forced colours in the editor (`440a990`)
- **ui** — add the shared SVG icon set to components (`b2d2725`)
- **ui** — add type, hit-target, radius and layer scales (`2254e46`)

### 수정

- **css** — re-ratchet CSS baselines for the intended HIG stack changes (`c8c9292`)
- **css** — real defects behind the CSS ratchet on the HIG stack (`5938e6a`)
- **assets** — farm dirt-path tile names say 서쪽으로, not 서으로 (C-17) (`81b4207`)
- **i18n** — English catalog uses colons and periods instead of em/en dashes (C-18) (`84d4567`)
- **i18n** — singular English counts, 1 map / 1 item (C-12) (`85752c4`)
- **i18n** — sentence case for short English labels (C-14) (`a6650a9`)
- **i18n** — English names for the bundled Beodeul tileset, terrain cards and the default map (C-16) (`7213924`)
- **i18n** — translate the Workshop card, e.g. examples and strings the screen lanes added; ja log labels without a gap, zh AI Studio (C-15) (`48fafad`)
- **i18n** — one-line English rail labels without soft hyphens, Check instead of Lint (C-11) (`3746dcd`)
- **i18n** — one English term per thing: Up/Down/Left/Right passage, Music/Sound effects, Connection/Display, World overview, Enemy (C-13) (`2d7f5ad`)
- **ui** — canvas toolbar clears a wrapped temporary-session banner (C-32) (`b8e5cf7`)
- **ui** — keep an auto-fitted map centred when the docked assistant leaves less than 1x room (C-56) (`7f2a4be`)
- **ui** — keep 조수 readable in the 280px overlay panel head (C-57, C-61) (`9b31d02`)
- **ui** — map refits to the visible canvas and the canvas can be painted from the keyboard (C-33, C-105, IS-012) (`f78d9c6`)
- **ui** — palette cards are one listbox Tab stop, keep focus after choosing, ellipsised 12 px names, readable prefab chips (C-40, C-37, C-42) (`882d974`)
- **ui** — canvas toolbar stays one 40 px row, overflow goes to a floating More menu, SVG icons (C-32) (`4d2b9af`)
- **ui** — map create dialog with pressed preset, one primary action, compact size fields (C-51) (`a4a9c20`)
- **ui** — workshop disclosure keeps its marker at the 32 px target (C-49) (`a84ffb6`)
- **ui** — map tree context menu keeps delete rows last (IS-103) (`856fe55`)
- **ui** — undo and redo buttons name the step they reverse (IS-089) (`ef3d158`)
- **ui** — drawing panel: even tool rows and 32 px targets, layer-aware head, tile name first, sheet zoom, labelled tile properties (C-34, C-35, C-38, C-41, C-43, C-53, IS-012) (`3a9d968`)
- **ui** — brush toggles keep a fixed name with aria-pressed; autotile switch is announced with undo (C-36, C-107) (`61ae393`)
- **ui** — inspect popover opens beside the rail button with one title and sentence-case labels (C-44) (`cb5ea30`)
- **ui** — rail and dock tabs mark the active item with a fill, no accent stripes or sweeping hairline (C-31, C-55) (`2cdd975`)
- **ui** — map links summary and cards share one verdict, readable flags, fix action (C-48, IS-012) (`4b4fb0d`)
- **ui** — locked composer is described by the lock title and the scrim really drops its blur (C-60) (`d0c2fc8`)
- **ui** — a 429 from the companion marks AI usage limited until a model call succeeds (C-67) (`9bcabb7`)
- **ui** — open the guide at the requested section without smooth scrolling so the contents marks it (C-110) (`e1d010b`)
- **ui** — keep the last guide section active when the guide is scrolled to its end (C-110) (`1ed48de`)
- **ui** — temporary-session save offers export, banner records the export, 32 px banner buttons (C-54) (`4352ae7`)
- **ui** — progress pane marks and buttons at the 12 px / 28 px floor (C-47) (`b4d8d89`)
- **ui** — map list header tools always visible, 28 px row menu, text-only context menu (C-45) (`8ec6174`)
- **ui** — workshop pane drops placeholder card, names its checkbox, no inset stripe (C-49) (`63e89c4`)
- **ui** — store pane offers a web store link and shares the panel inset (C-50) (`2d0ab01`)
- **ui** — object cards fill the pane without repeated size and source meta (C-46) (`f862f9e`)
- **ui** — authoring progress judges tiled maps, drops git words and accent stripe (C-47) (`035e8e5`)
- **ui** — assistant panel docks from 1000px and shows one not-connected state (C-56, C-57, C-58, C-59, C-60, C-61, C-62, C-73, C-74) (`e9d308b`)
- **ui** — one AI connection state in the chip and settings (C-67, C-68, C-70, C-71, C-72) (`92a6aba`)
- **ui** — AI studio board reads at 12px, one accent, one-line tabs, counted requests (C-63, C-64, C-65, C-66, C-69) (`505112b`)
- **ui** — replace AI chrome edge stripes and accent outlines with tints (C-75) (`0864006`)
- **ui** — top bar overflow, single accent, layer radiogroup, file/help/language menus and Shift+1..3 layer keys (C-19..C-23, C-113, IS-003, IS-009, IS-036, IS-051) (`bce1173`)
- **ui** — command palette with map settings commands, find entry, key hint and result count (C-24, C-116, C-110) (`70b8883`)
- **ui** — editor guide without retired captures or accent bars, shortcuts section entry and focus return (C-29, C-118, C-111, C-114) (`c6f410b`)
- **ui** — map/event search without accent band, eyebrow or repeated guidance, default scope all (C-25) (`5aa58bf`)
- **ui** — music dialog with named controls, unplayable reasons, split row labels and a guide pane (C-26) (`4491618`)
- **ui** — resource manager with one primary action, svg placeholder, no empty pager or accent stripes (C-27) (`4166b89`)
- **ui** — identity popover without machine ids and history as 저장 기록 with an export action (C-28) (`56a28cb`)
- **ui** — replace accent side stripes in interview dialogs with tint and 1px border (C-30) (`04d8d16`)
- **test-play** — make the black player layout win over the editor's database-layer system-shell background (C-94) (`b21a3d5`)
- **battle** — widen the retro HP cell so the labelled value is not clipped (C-95) (`0c02dd5`)
- **test-play** — paint the player layout black so the picture has one letterbox colour (C-94) (`0a7af75`)
- **ui** — keep the actor toolbar on one line at 300px and drop the resolution warning stripe (C-76, C-88) (`e9f293c`)
- **battle** — snap enlarged battle stage scale to quarter steps so pixel fonts render at whole pixels (C-98) (`6b90aca`)
- **runtime** — field HUD numbers sit on a dark plate (C-101) (`1dc672b`)
- **runtime** — debug toggle is a labelled 28px button and the open panel is a side drawer (C-99) (`7d13b63`)
- **runtime** — status menu lead row no longer overprints name and location (C-97) (`5e8a2a5`)
- **battle** — label HP, show the disabled command reason, Korean stat badges, named enemy buttons (`89968fe`)
- **runtime** — opening skip chip and caption band follow the picture; first scene shows a loading label (`c34cd67`)
- **test-play** — one exit, 28px one-line title bar, modal focus, map name, pause chip and pointer menu (`856a0cb`)
- **ui** — label the default faction as 기본: <name> so the name translates (C-85) (`b8271df`)
- **ui** — let 닫기 carry the primary weight in a session that does not save (C-81) (`cabcbdd`)
- **ui** — stop the delete reason widening the list and reclaim list height (C-76) (`9190027`)
- **ui** — honour reduced motion across the editor chrome (`9560444`)
- **ui** — break Korean text between words, not inside them (`556b514`)
- **ui** — show the full accessible name in icon-only tooltips (`c395189`)
- **ui** — raise text and status tokens to AA on every tint (`8174503`)
- **ui** — make the focus ring opaque and shared across the editor (`3561107`)
- **ui** — Ctrl+Enter confirms the event editor and the event id moves behind 고급 (C-102) (`c5ed13b`)
- **ui** — name the state rate fields and stop upper-casing field labels (C-77, C-86) (`6875b59`)
- **ui** — keep the tab search placeholder clear of its magnifier icon (C-78) (`7ddbc50`)
- **ui** — replace 자료집 edge and inset stripe markers with tints (C-88) (`f1d5032`)
- **ui** — world overview radios share one shape and the copy says each thing once (C-87) (`cc3f56f`)
- **ui** — rail group switch opens a tab of that group; hidden tabs are buttons (C-79, C-80, C-86) (`8684ab7`)
- **ui** — delete names its record, locks referenced records with a reason, needs no second press (C-109, C-119, C-117, IS-091) (`69756ad`)
- **ui** — make 자료집 closing, focus and footer consistent (C-81, C-82, C-83, C-115, IS-075) (`1255da5`)
- **ui** — give the 자료집 list its height in small windows and drop repeated facts (C-76, C-84, IS-076) (`75f5319`)
- **ui** — keep raw enums and Korean labels out of translated enemy chips (C-85) (`c9710e7`)
- **ui** — drop one-side accent stripes from event editor selection and callouts (C-103) (`7dcee4f`)

### 문서

- **qa** — L2 before/after pairs for the i18n lane (`ce4aebf`)
- **qa** — L5 before/after pairs for the AI surface lane (`6586815`)
- **qa** — add lane L3 before/after pairs (`c54e3a6`)
- **qa** — add L7 before/after pairs for the test-play and runtime clusters (`76ceca7`)
- **qa** — L6 before/after pairs for the 자료집 lane (`768620d`)
- **ui** — document the L1 scales, theme and icon set; add before/after pairs (`1b49937`)

### 테스트

- **qa** — add lane L2 i18n devices and before/after pair runner (`a4f1942`)
- **qa** — L4 assistant devices open the panel by test id and require it open (`2f92ba1`)
- **qa** — C-114 ignores inline listboxes and polls for the command palette (`d847d21`)
- **qa** — C-10 links/objects devices force a wrap before sampling keep-all breaks (`c321085`)
- **qa** — L5 devices open the rail by DOM click, read the command row, render the closed menu group, and add before/after setups (`c6086ff`)
- **qa** — add lane L4 hig-ux devices (canvas, left dock, palette, map list) (`f463305`)
- **qa** — add lane L5 AI surface devices (`a28fc49`)
- **qa** — add lane L3 shell devices and before/after pair runner (`9aabf72`)
- **qa** — L7 devices sample painted gutter colour (C-94) and require an unclipped HP value (C-95) (`6482ae1`)
- **qa** — add lane L7 test-play and runtime devices (`922f469`)
- **qa** — L6 devices read var() border shorthands and check plurals per text node (`033087a`)
- **qa** — add L1 foundation devices for tokens, focus, scales, theme and tooltips (`c04ac4b`)
- **qa** — add lane L6 자료집 devices (`0581378`)
- **qa** — add wave-0 ideal-state classification devices (`c53a777`)
- **qa** — add hig-ux before/after composer (`970f250`)
- **qa** — add hig-ux device runner, selftest lane and planted-defect fixture (`d1ce610`)
- **qa** — add hig-ux browser plumbing and measuring probes (`78deb72`)

### 잡무

- **qa** — shrink before/after images to palette PNG for the repo (`7d0a513`)
- **qa** — add qa:hig-ux npm script (`fc07aa7`)

## 0.357.1 — 2026-10-29

### 수정

- **charset** — RefmapDoll - drop 133 chips that were mostly one original; re-pack 2,567 chips into 321 sheets (#3894) (`e6b2cdb`)

## 0.357.0 — 2026-10-28

### 기능

- **charset** — RefmapDoll - 2,793 modified REFMAP walking chips, bundled, with assistant search (#3882) (`5de42f9`)

### 수정

- **charset** — RefmapDoll - drop 93 chips that were an original REFMAP person recoloured (2,700 chips, 338 sheets) (#3883) (`16ad4e3`)

## 0.356.5 — 2026-10-28

### 수정

- **fallen** — act 2 judge round 2 — mission log, map-edge exits, entry checkpoints, frozen-time interactive QA (#3880) (`c4bd7ba`)

## 0.356.4 — 2026-10-28

### 수정

- **fallen** — act 2 playtest round — barracks stealth patrol, barracks battle backdrop, Frostford night guidance (#3878) (`a5a803b`)

## 0.356.3 — 2026-10-28

### 수정

- **qa-play** — qp mass-play — checkpoint boot, enforced budget, key aliases (#3876) (`65d1bf2`)

## 0.356.2 — 2026-10-28

### 수정

- **playable-segment** — monster-collect first segment paves its route on the monster kit (#3871) (`6f1c2e0`)

## 0.356.1 — 2026-10-28

### 수정

- **dialogue** — dialogue tab review fixes — clipped proposal buttons, counts, readable tool cards, accept-all confirm (#3872) (`0bda1d5`)
- **player** — keep the harness registry and workshop object-gen kit out of the exported player; add a player bundle guard (#3870) (`de97846`)

### 기타

- Dungeon themes: cave stalactites, exit fallback, mine/tower seed variety (#3873) (`cdadb49`)

## 0.356.0 — 2026-10-27

### 기능

- **dialogue** — quest/ending lines in the dialogue index; list_dialogue finds lines outside the open map; fix desktop build (#3868) (`5300f35`)

## 0.355.2 — 2026-10-27

### 기타

- Dungeon themes: otherworld slab floor on a new sheet-end tail (#3866) (`2e94009`)

## 0.355.1 — 2026-10-27

### 수정

- **player** — phone landscape menus draw like PC, with wider invisible tap areas (#3861) (`0880dc5`)

### 기타

- Fallen act 2: independent playthrough judge (interactive QA) + fixes it found (#3864) (`376fc54`)
- Dungeon themes: ice-cave wall redraw (gap-ice-r5) and portcullis lint fix (#3863) (`437c7af`)

## 0.355.0 — 2026-10-27

### 기능

- **beodeul-capital** — ship Astel capital art pieces (canal redrawn) into beodeul_city (#3860) (`d34ba46`)

## 0.354.0 — 2026-10-27

### 기능

- **fallen** — act 2 gap fixes, harder detection, 1.24 release stop at the sky tower (#3858) (`954280b`)

## 0.353.2 — 2026-10-27

### 수정

- **ci** — repair type errors left by the conflict-union merge (#3856) (`db4214b`)
- **i18n** — call furniture push directions a push, not a pan (#3800) (`b148009`)
- **player** — restore the screen tint when a flash ends (#3773) (`2148eb7`)
- **editor** — keep the loop inspector out of the command-column layout (#3691) (`5274060`)
- **editor** — keep event cut and delete to one undo step (#3731) (`c68c4cf`)
- **battle** — retarget a downed single target to the next living battler (#3749) (`9f2c52a`)
- **desktop** — refuse a non-empty folder for File → New Project (#3771) (`efa6a48`)
- **export** — start the Linux and macOS desktop launchers (#3772) (`d7e5f70`)
- **editor** — keep event condition labels on one line (#3782) (`f9cf5f7`)
- **player** — read physical keys in the shop while an IME is active (#3785) (`8195b29`)
- **input** — resume a tilted gamepad stick after the window returns (#3786) (`fc278a5`)
- **player** — 전투 준비가 그림을 데우되 무대는 즉시 떼고, 계약을 전송 바이트로 판정 (#3787) (`a552cf2`)
- **opening** — keep a camera pan from jumping by half the stage (#3791) (`3d98b2c`)
- **battle** — read physical keys while an IME is active (#3798) (`4c5a5d4`)
- **editor** — keep the map list filter caret while typing (#3799) (`37a4d4f`)
- **editor** — match Korean particles in the record picker empty state (#3804) (`d744e22`)
- **desktop** — save the open project before View → Reload (#3805) (`410e985`)
- **audio** — play a 0.6 sound cue at 60% and show that level in the editor (#3814) (`3298875`)
- **editor** — keep weekday toggles on a condition branch (#3816) (`64e95fe`)
- **player** — show level and save time on each in-game save slot (#3825) (`b31f925`)
- **editor** — keep upper-layer fill on the same ground (#3829) (`ae67414`)
- **desktop** — keep fullscreen test play below the window buttons (#3833) (`d3643ea`)
- **player** — step in place when an event's animation type says it should (#3834) (`526c210`)
- **player** — move the dialogue choice cursor with WASD (#3840) (`89d132f`)
- **player** — resolve name codes in the dialogue name box (#3853) (`411595d`)
- **player** — fade Hide Screen and Show Screen instead of cutting to black (#3831) (`e739289`)
- **editor** — 자료집 게임 타이틀을 고치면 프로젝트 이름도 따라간다 (#3848) (`913a167`)
- **audio** — stop title and system previews when their section hides (#3847) (`4d9036a`)
- **editor** — keep a long event list in place when you pick one (#3845) (`492077a`)
- **player** — leave the skill list on the first cancel (#3844) (`5e47bbf`)
- **editor** — keep a transfer's fade and door with the destination (#3843) (`d63988e`)
- **editor** — show letterbox bars in the screen-effect preview (#3842) (`14937f0`)
- **player** — inn window uses the database money, HP, and MP terms (#3841) (`0b9a6e6`)
- **ai** — keep the undo shortcut in the apply notice (#3839) (`82ed62e`)
- **battle** — 승리 화면이 자료집의 화폐 이름을 쓴다 (#3836) (`8d7302b`)
- **editor** — Delete clears the selected map region (#3832) (`f4aceb6`)
- **i18n** — name the new map's parent and height, not a tile layer (#3830) (`574a84e`)
- **editor** — import the files inside a dropped resource folder (#3828) (`95b96e1`)
- **player** — show an authored title subtitle without a logo style (#3827) (`2754bc5`)
- **export** — keep the build status until the export finishes (#3826) (`2af2eed`)
- **battle** — tell the player when this fight forbids escape (#3824) (`caee46d`)
- **editor** — keep IME confirm from running a command-palette item (#3823) (`569f6dc`)
- **database** — 자료집 드롭다운이 영어 코드 대신 한국어로 보이게 한다 (#3821) (`fec8ae5`)
- **player** — slide around a person on the corner of a diagonal step (#3820) (`5c92a2a`)
- **player** — 에메랄드 상점 판매 목록에 매각 단가를 표시 (#3819) (`4ab760b`)
- **editor** — show the message preview at the line's window position (#3818) (`982b5de`)
- **ai** — say the real apply mode on the assistant settings button (#3815) (`201cca1`)
- **opening** — draw title-card text at the size the creator set (#3813) (`3da2431`)
- **player** — scroll the dialogue history with the mouse wheel (#3812) (`3d96c3a`)
- **player** — cancel save overwrite confirmation when the cursor leaves that slot (#3808) (`f5e5d36`)
- **player** — scroll title credits with the keyboard (#3806) (`0a5b2de`)
- **editor** — let a picture fade wait before the next cutscene line (#3803) (`b8d6033`)
- **editor** — point the in-app guide at the current top bar (#3802) (`da1223d`)
- **export** — web platform card downloads the web player zip (#3801) (`a928299`)
- **player** — keep closing punctuation with the last message character (#3797) (`4524b70`)
- **editor** — keep skill combat fields the database form writes (#3793) (`50bc2e5`)
- **editor** — keep cliff height when copying a map region (#3792) (`73c87c6`)
- **audio** — stop event-command preview when the form closes (#3790) (`b36c08b`)
- **battle** — count each event loop's iteration budget separately (#3788) (`c785038`)
- **ai** — keep a single verification check object on work plans (#3784) (`8a193b2`)
- **battle** — status cures no longer say the effect failed (#3778) (`87e0ecd`)
- **i18n** — say 확인 and 1 digit on number input (#3777) (`ef93e0e`)
- **player** — show the autosave on the in-game load menu (#3776) (`0b08192`)
- **editor** — let map settings resize up to the 1024 tile limit (#3775) (`8939f92`)
- **player** — name the number input and speak each digit (#3769) (`e79ea17`)
- **player** — show the battle MP cost on the skill menu (#3768) (`f8b58d8`)
- **editor** — preserve timer comparison operators in event conditions (#3764) (`a80dadc`)
- **player** — keep picture scale, opacity, and rotation across Move Picture (#3762) (`ea08f24`)
- **project** — keep a state's lost equipment slot and battle aura across save (#3760) (`586ef3e`)
- **audio** — keep memorized BGM volume and fade-in (#3759) (`0530584`)
- **player** — keep the battle-exit cover up until game over is opaque (#3758) (`0952523`)
- **editor** — keep the database search caret through an IME composition (#3756) (`19c0e0b`)
- **player** — move dialogue choices with W and S (#3755) (`1e5e3ff`)
- **ai** — accept boolean strings for build-spec confirmDestroy (#3754) (`29bc2be`)
- **player** — resume countdown timers when a save boots a new scene (#3750) (`f3f4c7b`)
- **desktop** — save the open project before the file menu switches folders (#3748) (`a49b43b`)
- **editor** — fill a connected autotile as one material (#3747) (`d9743ae`)
- **editor** — name the wide change viewer and keep Tab inside it (#3746) (`ce9a344`)
- **i18n** — say 1 event and 1 door on map rows (#3745) (`055bf0c`)
- **export** — keep non-ASCII cover paths on the loading screen (#3744) (`97783a3`)
- **player** — keep a screen tint tween running across refreshes (#3743) (`788d0cb`)
- **editor** — keep map inspector primary labels readable (#3742) (`dcdb5cb`)
- **player** — show uploaded faces in the message window (#3737) (`822fa05`)
- **player** — retry a blocked move step when the route is not skippable (#3736) (`5e84c1e`)
- **project** — keep an explicit terrain raft ban across save (#3734) (`9dd6484`)
- **player** — cap shop quantity at the gold and bag limits (#3733) (`1b8a4f0`)
- **ai** — keep string successTools and mapTargets on work plans (#3732) (`35ce209`)
- **audio** — play the map BGM fade-in the author set (#3729) (`3c6ceb6`)
- **editor** — let database numbers keep a leading minus while typing (#3728) (`542840b`)
- **project** — keep equipment stat penalties across project save (#3727) (`0b13578`)
- **editor** — keep the map filter caret while typing (#3724) (`44546bb`)
- **player** — name the gift and present-item dialogs (#3723) (`9165220`)
- **battle** — tick gen1 poison and burn after field actions (#3722) (`52a74f8`)
- **battle** — read physical keys while an IME is composing (#3721) (`bbf9f46`)
- **editor** — refuse an event paste whose body leaves the map (#3720) (`8081b62`)

### 성능

- **player** — skip unchanged field HUD layout writes (#3757) (`8868a40`)
- **player** — reuse life-calendar HUD lines between frames (#3789) (`17595fc`)

### 문서

- **openwiki** — point the studio entry at the living shell (#3717) (`4009227`)
- **openwiki** — #3718 의 문서 3건이 밀어낸 인덱스를 재생성한다 (#3809) (`7b1c0ee`)
- **openwiki** — describe autotile shaping in the Korean getting-started guide (#3766) (`2fee7f6`)
- **openwiki** — point the delayed tooltip sheet at the map layer (#3741) (`230abbf`)

## 0.353.1 — 2026-10-27

### 수정

- **input** — read a diagonal gamepad stick inside the square dead zone (#3730) (`f4940dd`)
- **ci** — slice-4 decisions — enemy/species transparent, Pi outcome keeps response-final/blocked, layer-1 paint keeps layer 2 (#3846) (`c094d63`)
- **css** — route every font stack through the role tokens (#3761) (`70cd648`)

### 테스트

- **ci** — slice-5 drift fixes — 60 files green, 5 product fixes (#3822) (`cb32080`)

## 0.353.0 — 2026-10-27

### 기능

- **ai** — objective says where, drawn entrances work, no repeated day dialogue (J98, J101-J106) (#3795) (`7a85bb6`)

### 수정

- **export** — escape game titles in the Steam launcher and VDF (#3719) (`1f665b1`)
- **desktop** — demo music plays — embed demo BGM in baked demos, fetch other catalog tracks on demand (#3796) (`4cd15e1`)

### 성능

- **editor** — restore only map-used bundled tilesets on load; route tileset_blobs readers through deserialize (#3810) (`34cbea8`)

### 테스트

- **ci** — fix drift slice 0 — 51 vitest files green, 7 re-tagged timeout (#3765) (`a901a08`)
- **persistence** — follow #3774 bundled-tileset diffs — electron may import bundledTilesetDiff; restore the patched tileset before checking its reference documents (#3811) (`8da9778`)
- **ci** — slice-4 drift fixes — 62 files green, 4 product fixes (#3807) (`923287d`)

## 0.352.0 — 2026-10-27

### 기능

- **workshop** — 사진으로 만들기 — 그림을 그려 후보를 고르고, 어떻게 그렸는지 알린다 (#3449) (`c1544cc`)

### 수정

- **desktop** — open a project.sqlite file passed on the command line (#3718) (`1d1eb76`)
- **player** — 전투 준비가 그림을 데우되 무대는 즉시 떼고, 계약을 warm URL 재사용으로 판정 (#3794) (`3c1abd8`)
- **demos** — keep Fallen Star's grafted interior tiles on load; Scarloxy sample opens as a new project folder (#3779) (`cf0ddb2`)
- **demos** — desktop app opens Fallen Star — bake demos into desktop packages; builder fallback BGM (#3752) (`3b56fcb`)
- **qa** — scene runner fires a same-layer touch door on bump, like the runtime (#3740) (`66862f1`)

### 성능

- **project** — store bundled tilesets as diffs against the bundle (78MB → 4.4MB blank project) (#3774) (`3e6c80e`)

### 문서

- **openwiki** — 생성 인덱스를 현재 위키로 재생성 (깨진 줄 표가 낡아 ci-full 샤드 13이 섰다) (#3781) (`a3c38c9`)

### 테스트

- retire acceptance-ledger cases; aiChatPanelSettings follows the current UI (#3780) (`6ffbf5a`)
- **ci** — drift slice 1 — 62 of 74 drift files green on CI (#3751) (`febc15c`)

### CI

- pinned numpy/Pillow for joseon-baram harness tests (#3770) (`84c7552`)
- **fast** — openwiki 인덱스를 PR 레인에서 검사하고, 지금 낡은 인덱스를 재생성한다 (#3783) (`7ea941e`)

## 0.351.6 — 2026-10-27

### 수정

- **i18n** — call a dragged map rectangle a range in Japanese (#3716) (`8f632f5`)

### 테스트

- drift slice 3 — 60 vitest files green on CI, 4 product fixes (#3739) (`952aadd`)
- **ci** — fix timeout-tagged vitest files, slice to-00 (33/38 green) (#3725) (`8374a95`)

### 잡무

- **ci** — drop two files ci-full 40357882117 saw passing from the test baseline (633 → 631) (#3726) (`be5176b`)

## 0.351.5 — 2026-10-27

### 수정

- **player** — 전투 준비가 그림까지 데운다 + main 의 winners 부채 갱신 (#3714) (`c2bd6a9`)

## 0.351.4 — 2026-10-27

### 수정

- **bench** — battle-warmup 이 실제로 있는 데모 팩토리를 쓰게 한다 (#3712) (`890f6c9`)
- **input** — read physical keys while an IME is composing (#3711) (`4e50b1c`)
- **desktop** — open a project folder from macOS Open With (#3710) (`5d61bea`)
- **battle** — block burn and freeze by the target's type (#3709) (`17c9ff4`)
- **ai** — accept numeric strings for verification check indexes (#3707) (`e59d586`)
- **editor** — keep a dragged event body on the grabbed cell (#3706) (`1ec06d8`)
- **player** — name the gallery viewer and announce picture changes (#3705) (`ead83a5`)
- **i18n** — format editor dates in the chosen language (#3704) (`73aa8f3`)
- **editor** — use Korean confirm and cancel on database dialogs (#3703) (`5796453`)
- **project** — keep escape grace steps across project save (#3702) (`9a667da`)

### 성능

- **player** — skip unchanged time-tint redraws (#3708) (`f3ec52b`)

### 테스트

- **player** — gamepad 반복 단언의 산술을 바로잡는다 (총 keydown ↔ ArrowDown 혼동) (#3698) (`d7bb216`)

### CI

- **surface** — m2-214-ui-command 에 objectiveChip 선택지가 늘어난 것을 스냅샷에 반영 (1건) (#3699) (`d42d08f`)

### 잡무

- **ci** — #3690 의 nameEntry.css 접근성 규칙이 밀어낸 winners 래칫을 현재 트리로 (#3701) (`102b78a`)
- **ci** — 통과 확인된 두 파일을 테스트 기준선에서 제거 (635 → 633) (#3700) (`5072085`)

## 0.351.3 — 2026-10-27

### 수정

- **export** — fail when an uploaded media file cannot be read (#3695) (`f609864`)
- **ai** — accept numeric strings for plannedMap width and height (#3694) (`452cafe`)
- **battle** — name the major status that blocked a status move (#3692) (`e5287c8`)
- **player** — name the name-entry dialog and speak the grid character (#3690) (`20a13e3`)
- **editor** — draw every copied layer in the paste preview (#3689) (`52359ac`)
- **player** — keep absorb weakness notes across save and load (#3687) (`e1d55d8`)
- **i18n** — describe region select as a drag release, not a placement (#3686) (`077d2b8`)

### 문서

- point getting-started at the live schema and CI-only tests (#3688) (`87a4008`)

### 테스트

- **ai** — verificationNativeScopes 의 두 it.each 에 자기 예산(60s)을 준다 (#3696) (`3fc8852`)

## 0.351.2 — 2026-10-27

### 수정

- **ci** — 브라우저 축이 player QA 서버를 스스로 띄운다 (9944) (#3683) (`7387ceb`)

### 잡무

- **ci** — #3680 의 dialogue.css 선언이 밀어낸 winners 래칫을 현재 트리로 (#3684) (`994b3d1`)

## 0.351.1 — 2026-10-27

### 수정

- **battle** — skip secondary status when a gen1 hit knocks the target out (#3680) (`5f36944`)
- **player** — announce the choice question to assistive tech (#3679) (`ab496a4`)
- **player** — repeat held gamepad and touch directions (#3678) (`abdb603`)
- **desktop** — keep the close save running if the window is closed again (#3677) (`cd7ebff`)
- **export** — drop new tileset study docs from the player bundle (#3676) (`dcd9eb2`)

## 0.351.0 — 2026-10-27

### 기능

- **fallen** — act 2 B6–B9 (요새·새라, 서리 가도, 서리나루) — 1.23 stops at the 서리나루 inn (#3674) (`b6a4132`)
- **ai** — new-player discoverability — objective line, visible story events, cutscene-aware auto-play (J90-J96) (#3669) (`847345b`)

### 수정

- **ai** — keep a valid people list when flat fields sit beside it (#3673) (`0418532`)
- **i18n** — call reachability a passability preview, not traffic (#3672) (`4b2ed65`)
- **player** — keep memorized BGM across save and load (#3671) (`a619df2`)
- **editor** — find map events by their authored name (#3670) (`38b504a`)

### 테스트

- **player** — J88 이후 「돈 0G」 숨김 계약에 systemShell 기대를 맞추고 짝 검증 추가 (#3667) (`996ae33`)

### CI

- **surface** — #3546 「일지」 명령(m2-227-journal-line)이 바꾼 M2·포털 스냅샷 반영 (#3666) (`c77b356`)

### 잡무

- **ci** — 16샤드 실행이 통과 확인한 두 파일을 기준선에서 뺀다 (#3668) (`7f33dc8`)

## 0.350.6 — 2026-10-27

### 수정

- **ci** — 주의 표시 색을 하드코딩 hex 대신 --warning 토큰으로, ai-side-threads 표면 소유 선언 (#3664) (`f7f96ba`)

### 테스트

- **ci** — timeout batch to-01 — explicit suite timeouts, unstick export/graft boots; 26 files leave the baseline (#3663) (`1b9d3ef`)

### CI

- prune stale baseline entries (ci-full 40318900099) + storeEventDraftPreserve budget (#3662) (`55b08ab`)

## 0.350.5 — 2026-10-26

### 수정

- **test-dom** — env2 — fake-DOM/window gaps in 36 ci-full files; 27 files leave the gates baseline (#3661) (`2e22802`)
- **ai** — no-battle defaults, visible stair exits, unlit darkness (J87, J88, J89) (#3660) (`fa82ce8`)
- **test** — move 33 combined_town/EasyRPG tests onto retired sheets or current defaults; drop them from gates baseline (#3657) (`63b6298`)

### CI

- **full** — 16 vitest shards — shard 1 lost its runner at 8 shards (#3659) (`7aea117`)

## 0.350.4 — 2026-10-26

### 수정

- **ai-v2** — move_object on hand-edited rooms; dress_room floor decor (#3654) (`499304b`)

### CI

- **fast** — run the CSS ratchet on every PR; fold #3628's attention colour into the review rule (#3655) (`6f407e6`)

## 0.350.3 — 2026-10-26

### 수정

- **ai-v2** — dress_room verb for empty-room/bare-floor defects; scene test warns on unwalkable player cells (#3651) (`5367773`)

### CI

- rebuild gates baseline from 8-shard ci-full with tags; fix list in .omo/ci-fix-list.md (#3652) (`4c7b572`)

## 0.350.2 — 2026-10-26

### 수정

- **ai** — spec NPC autobuild searches its graphic full name -> role noun; interior shell test checks real invariants (#3649) (`3a9f0ec`)
- **opening** — map-view backgrounds render in previews and screen checks (#3647) (`d32f2f1`)

## 0.350.1 — 2026-10-26

### 수정

- **stills** — offer only installed opening still pack pictures; clear export error (#3646) (`291b046`)
- **test-dom** — close the window/ResizeObserver/fake-DOM gaps in editor panel tests (#3645) (`a6e86b4`)

## 0.350.0 — 2026-10-26

### 기능

- **fallen** — act 2 B1–B5 — cell escape to burned Dawnwell; duplicate_map night variant, lift action trigger, event-linked forest route (#3643) (`84a31e9`)

### 수정

- **ai** — VQA status says why a shot failed to capture (#3642) (`089f9f1`)
- **ai** — requested hiding spots must be visible to count (coverage check) (#3640) (`125b9ff`)
- **ai** — VQA map shots carry game lighting (J79 rerun: defects stuck 2→2→2) (#3638) (`5783942`)

### 테스트

- move combined-town/interior cases onto retired sheets, retire run_*_room_pipeline cases, refresh outdated expectations (#3641) (`a500c7f`)

## 0.349.1 — 2026-10-26

### 수정

- **ai** — CLI tool-list compaction walks schema positions only; a provider-error reply is a failed turn (J79b) (#3637) (`fbc625b`)
- **player** — map-entry checkpoint retry keeps progress (J58) (#3636) (`a4bb679`)

## 0.349.0 — 2026-10-26

### 기능

- **ai** — restore_event — restore a deleted/rewritten event exactly as before the request (toy-shop advisor t2) (#3633) (`69eae48`)
- **store** — publish the Shitamachi demo to the play store (#3634) (`328544f`)

### 수정

- **ai** — requested-feature coverage blocker — chaser, darkness, hiding (J71/J73) (#3631) (`3f045b3`)
- **ai** — local CLI context budget — compact tool list, one image per verb call, context-limit reply is a failed turn (J79) (#3630) (`58456d9`)

## 0.348.1 — 2026-10-26

### 수정

- **handInterior** — train car exits through its drawn doors, not a wall gap (J45) (#3629) (`4b76a96`)
- **ai** — open the side-thread tray when a run there waits for an answer (J72) (#3628) (`9e8a968`)
- **ai/v2** — ship blocker for a title other than the requested one (J71/J73) (#3626) (`30995b0`)

## 0.348.0 — 2026-10-26

### 기능

- **ai/v2** — flatten single-wrapper tool schemas (J67) (#3625) (`20175cf`)

### 수정

- **ai** — team image gates blame a text-only model, not a missing review (J69 follow-up) (#3624) (`1132afa`)
- **ai** — image delivery statuses report not-delivered when the model can't take images (J69) (#3623) (`dbb6833`)
- **ai/v2** — follow-up turns carry earlier requests; default place-name leak ship check (J70) (#3622) (`51e66a6`)

## 0.347.2 — 2026-10-26

### 수정

- **handInterior** — keep subway platform full width and seat train-car north seats (J45) (#3620) (`302fa31`)

## 0.347.1 — 2026-10-26

### 수정

- **ai/v2** — VQA fix turns start from a cleared context with a self-contained brief (J78) (#3618) (`1f5814a`)
- **ai/v2** — ship-block unreachable critical events (J75); flag chasers slower than the player (J77) (#3617) (`563270d`)

### 테스트

- retire vitest cases that call assistant tools removed on purpose (#3616) (`caf77ef`)

## 0.347.0 — 2026-10-26

### 기능

- **wasteland** — husk-b at 3.6x the hero and a calm asphalt road (#3615) (`0769690`)
- **wasteland** — settlement and shanty maps stand large ruins and two-storey shacks in their rows (#3613) (`63c9257`)
- **ai/v2** — VQA falls back across reviewers; same-family review is labelled (#3610) (`964ffa9`)
- **battle** — add_battle_guest mid-battle guest joins; visible field enemies get factions and clash (#3557) (`dcc34bf`)
- **wasteland** — scale objects up to Beodeul-measured heights (r64) (#3606) (`ed114f5`)

### 수정

- **ci** — re-ratchet css baselines — !important down 367→358, winners for #3542/#3546/#3558 (#3611) (`336456a`)
- **ai** — flag a day counter running beside the time-system calendar (J18) (#3609) (`791a423`)
- **ai** — break identical-refusal loops, not only arg-shape loops (J74) (#3608) (`aa9fed1`)

### 테스트

- **battle** — enemyBattleScale checks the pixel-sheet hit cell in retro2003 (#3614) (`11baee4`)

### CI

- **full** — 8 shards, 300-min jobs, reports always upload, cap flake retries (#3607) (`833802b`)

## 0.346.13 — 2026-10-26

### 수정

- **player** — keep a freeze frame across save and load (#3604) (`affbcb0`)
- **i18n** — call the lower layer ground, not a child item (#3603) (`e0f78a9`)

## 0.346.12 — 2026-10-26

### 수정

- **player** — don't let a hidden M press stick the minimap off (#3601) (`5af28c2`)

### 문서

- **openwiki** — refresh the wiki census agents read first (#3600) (`cd8c1da`)

## 0.346.11 — 2026-10-26

### 수정

- **export** — name the file when a web export check fails (#3597) (`399c97c`)

## 0.346.10 — 2026-10-26

### 수정

- **desktop** — close the project store if the window closes while it is opening (#3595) (`bdac1a2`)
- **player** — name the inn window and speak its cure and rest lines (#3594) (`ccf52c8`)

## 0.346.9 — 2026-10-26

### 수정

- **battle** — announce residual knockouts on the upkeep hit (#3592) (`9ccbad8`)
- **ai** — drop coordinate wrapper keys after copying them into tool arguments (#3591) (`08b3fe3`)

## 0.346.8 — 2026-10-26

### 수정

- **player** — keep message-window settings across save and load (#3589) (`aa674c7`)
- **editor** — jump to difficulty and item-used page conditions (#3588) (`168b066`)

## 0.346.7 — 2026-10-26

### 수정

- **player** — release held keys when a gamepad disconnects (#3586) (`20cd0dc`)
- **i18n** — call the ground layer 地上 in Japanese, not battle (#3585) (`e562220`)

## 0.346.6 — 2026-10-26

### 수정

- **export** — stop a player-bundle </script> from splitting standalone HTML (#3583) (`68be1d9`)

### 문서

- **openwiki** — don't list Korean question marks as broken text (#3582) (`b1260b7`)

## 0.346.5 — 2026-10-26

### 수정

- **desktop** — attach folder dialogs to the editor window (#3579) (`4479f19`)

## 0.346.4 — 2026-10-26

### 수정

- **ai** — send find_tools to the tools that author party splits, snow paths, journals, and timed escapes (#3577) (`005e9e0`)
- **player** — name the storage chest dialog and label its quantity field (#3576) (`6ec1bec`)

## 0.346.3 — 2026-10-26

### 수정

- **battle** — revive downed allies in enemy AI and auto-battle (#3574) (`46b7114`)
- **editor** — don't stack an event on a cell another event already covers (#3573) (`4ce70c2`)

## 0.346.2 — 2026-10-26

### 수정

- **player** — keep a changed map background across save and load (#3570) (`ae4b79d`)
- **i18n** — call map-content shift by its name, not pan or scroll (#3569) (`196b885`)

## 0.346.1 — 2026-10-26

### 수정

- **first-love** — single title, no black/loading card before cold open, sidewalk-only walkers, zoomed bump with sizable particles (#3568) (`18a2787`)

## 0.346.0 — 2026-10-26

### 기능

- **desktop** — open a project folder given on the command line (#3566) (`1398063`)

### 수정

- **player** — a gamepad press sends one confirm, not two (#3564) (`c2fbd40`)
- **export** — warn when single-file HTML exceeds GitHub's file limit (#3563) (`6d3e566`)

## 0.345.0 — 2026-10-26

### 기능

- **tools** — make_timed_escape — countdown escape with collapsing floor and checkpoint retry (#3548) (`9e24db4`)
- **runtime** — story journal — configure_story_journal tool, m2 «Journal Line», ESC menu 「일지」 (#3546) (`0b89b28`)
- **ai** — author_party_split — FF6-style party split with switch orbs, lever->door pairs, rejoin, and a solvability gate (#3553) (`54a15f3`)
- **ai** — derive_map_variant look:"burned" + keepIntact — burned village keeps house sites and roads (#3552) (`c0035b5`)
- **ai** — configure_party_bonds — party-member bond scores, campfire talk scene, threshold unlocks, bonds in the 「관계」 menu (#3547) (`e7d1aea`)
- **ai** — author_snow_route — winding snow-path maps with conifer walls, ice, drifts and gap-jump candidates (#3554) (`9ed055c`)
- **battle** — combo techs accept up to 4 participants (#3542) (`8207fbd`)
- **battle** — chargeBreak — interrupt charging skills by damage, element or state (#3544) (`d1b0cb6`)
- **ai** — place_field_obstacle kind:'gap' — pole-vault gap jump with an examine event on both edges (#3543) (`048b62e`)
- **wasteland** — hero-scale redraw of 12 objects, calm dirt, sparser floor decals (r63) (#3532) (`1ce4ae1`)
- **tools** — per-map camera zoom (set_map_properties zoom) and title menu font size (set_title_screen menuFontPx) (#3536) (`f15df91`)

### 수정

- **ai** — puzzles no longer put the answer first or use trivial codes (J63) (#3550) (`d1e4ec4`)
- **ai/v2** — VQA fix turns must call tools; no-tool rounds don't count (J68) (#3556) (`21099c1`)
- **player** — phone landscape plays like desktop — controls in side gutters, never over the game; undo #3526 phone-only menu rows (#3558) (`4b0ec3c`)
- **ci** — ratchet css budget/surfaces/winners to current main (#3541) (`81f15a2`)
- **jp-city** — road markings under vehicles, east-west crosswalk bars, cars stay on carriageway; road-edge cells are not sidewalk for NPCs (#3535) (`4ecbba6`)
- **ai** — a lever/bridge gate must actually gate (J1) (#3534) (`dc7db91`)

### 문서

- **fallen** — act 2 handoff — merged tools, open PRs, next beat queue, canonical save and QA commands (#3561) (`af691f9`)

### 테스트

- **ai** — passage dispatch expects the setter via find_tools, not in the narrowed first request (#3562) (`77763d4`)
- combined-town tile tests start on the retired combined-town map; cluster hint test follows the default tileset (#3560) (`290961c`)
- retarget generate_map tests to Scarloxy, drop removed editorUiMode import (#3559) (`da2aed8`)
- construction/row/cluster tool fixtures retarget the blank map to the retired combined-town sheet (#3555) (`96b4b28`)
- tile/harness fixtures add the purged EasyRPG combined-town, dungeon and world definitions; legacy import accepts bundled object kits (#3540) (`f9e74be`)
- **tools** — tileset atlas/graft tool tests use a shipped chipset (tex_beodeul_city); the EasyRPG sheets they named were deleted on 2026-10-07 and the tools now correctly reject them (`45cec8d`)
- **spatial** — compiler fixture keeps only the tilesets it uses, so transaction tests stop timing out on whole-project clones (`1baeee1`)
- rebuilt EasyRPG definitions go through load normalization (ensureTilesetHarnesses), restoring the combined-town harness groups an opened old save has (`2e83ef2`)
- **spatial** — seed the interior harness (furniture kits, wall autotiles) on the rebuilt definition, as old saves have it (`5cb668c`)
- **spatial,tools** — remaining interior-map fixtures use the retired EasyRPG definitions an old save carries (`7176a13`)
- **spatial** — fixtures rebuild the EasyRPG interior/combined-town definitions an old project carries (`5e2dd70`)

### CI

- **surface** — M2 스냅샷 재생성 — #3509 의 lift-ride 명령 승인 (2건) (#3549) (`7802cef`)
- **surface** — #3509 의 lift-ride 명령이 바꾼 M2 카탈로그 수치와 포털 탭 3 표면을 반영 (#3538) (`bfff9ec`)

### 잡무

- **fallen** — save a baked Fallen Star into its canonical local project and prove the reload (#3545) (`bdd6a07`)

## 0.344.0 — 2026-10-25

### 기능

- **player** — 44px touch rows in every ESC menu skin, title menu, item/save/load lists (PC look unchanged) (#3526) (`c01901e`)

### 수정

- **runtime** — ESC menu scales with high-res play resolutions (S6 club-festival) (#3530) (`24bbd58`)
- **ai-v2** — horror HUD shows life petals only when HP can drop (J67) (#3531) (`6656aa5`)
- **ai** — repeated identical tool-shape errors are refused; wrap repair covers open wrapper objects (#3528) (`b1a4f98`)
- **beodeul-massing** — keep tileMeta in step with count when a bundled building sheet changes size (#3527) (`bde0d4a`)
- **ai-v2** — person ghosts get a person chip, not the sheet ghost (J66) (#3522) (`1bb6c3e`)
- **ai** — flag MP skills weaker than a free skill; default 십자베기 power 62→74 (J8) (#3519) (`0fd8d9f`)
- **boot** — finish a pending deferred boot normalisation on flush (close) so the marker is saved (#3525) (`6eb042e`)
- **ci** — bun on vitest runners, three unparseable test files, window-less editor boot (#3524) (`08fa2d3`)
- **qa** — auto-play names the ending each route reached, not the first ending flag ever set (#3521) (`66391a3`)

### 테스트

- fix 18 ci-full environment failures (happy-dom pragma, CSS entry, async DOM stubs) (#3529) (`632ac9d`)

### 기타

- Dungeon lever gates: framed portcullis tile kit (#3533) (`6ed65db`)

## 0.343.0 — 2026-10-25

### 기능

- **shitamachi** — story-authored opening/title/ending, confession CGs, lantern HUD, sidewalk NPCs, room preset fixes (#3512) (`4c0e034`)
- **astra** — generated day key art for the title screen (supervisor pick of 4, downscaled to 480x320 / 64 colours); runners move to the bottom grass (#3517) (`cea62ac`)
- **building-kit** — VQA redraw of the medieval bundle (24 buildings) + town layout fixes (#3514) (`641a162`)
- **runtime** — breadcrumb follow, lift ride, all-member combos, field approach styles, save glow (Fallen Star 1.22) (#3509) (`b5eb7fd`)

### 수정

- **ai** — ship check flags placeholder credit names like 「기획 · 제작 / 당신」 (#3518) (`88abe7c`)
- **ai** — a run that ends without any answer says so; empty-reply guard skips the local CLI loop (#3516) (`f7fbc89`)
- **runtime** — tap/QA walks stop when an event starts, so text never shows while the hero keeps walking (J62) (#3504) (`0c1ba78`)
- **first-love** — opening and cold-open VQA fixes (op3/op4) (#3513) (`7f17f78`)
- **ai** — ship check flags an opening with no shot of the place and title/ending art off the premise (J24, J65, J10, J17) (#3510) (`51b9675`)
- **export** — ship bundled tilesets as references; qp boots the export projection (S4) (#3508) (`ea8c1cb`)

### 성능

- **boot** — reveal the editor shell before the map canvas boots (#3520) (`ff4ca86`)
- **boot** — first-launch boot normalisation runs after the editor shell; saves wait for it (#3511) (`aa10acc`)

### 테스트

- fix 16 stale vitest files after EasyRPG art purge (#3515) (`66b1716`)

## 0.342.0 — 2026-10-25

### 기능

- **ai** — v2 move_object moves, turns or removes one placed piece of furniture (#3505) (`e95a467`)
- **store** — news posts show real game screenshots — CDN upload script for shipped-player shots; assistant post guide asks for them (#3506) (`f0dd6f9`)
- **qa** — scripts/qa/argon-vqa.py — image-capable Argon blind reviewer (gemini-4-argon-high, images inline) (#3503) (`2a7627d`)
- **desktop** — show the last editor view instantly while the editor boots (#3501) (`e0071ba`)

### 수정

- **ai** — repair obvious tool-argument shape slips before failing validation (#3502) (`bda3a3f`)
- **ai** — compat endpoints explain why they fail (key missing, step, DNS) and empty image replies no longer end the turn silently (#3499) (`3a416a3`)
- **ai** — route images per model on openai-compat endpoints; 1-px image probe marks blind models (#3498) (`2af2138`)
- **dungeon** — cave maps get no tower windows, dry bridges/boats are flagged, entrances get a cave mouth and avoid props (J25) (#3500) (`00dd4de`)
- **ai** — v2 blocks combat games with no healing; encounters off unless asked (J55, J4) (#3494) (`532757b`)
- **ai** — chasers patrol, spawn never inside chaser sight (J54, J61) (#3495) (`0825f19`)

## 0.341.0 — 2026-10-25

### 기능

- **astra** — Gen 3 style opening - bright meadow intro, day title, professor capsule speech, gender/name stage with the hero shrinking into the room; actor:<id> pictures (#3432) (`7ebd815`)
- **village-art** — wasteland_ruins tileset + composer, Beodeul yard floors, r62 ground decals (#3488) (`60ad0d5`)
- **ai-v2** — ask_helpers — delegate bounded text jobs to the smol role (off until A/B) (#3483) (`cd1fcc4`)

### 수정

- **first-love** — opening VQA r1 fixes, cold-open bump, freeze alignment (#3463) (`1655d20`)
- **ai/v2** — VQA reviewer always calls an alias that sees images (#3497) (`5ffa092`)
- **project** — projects that name art removed in the 2026-10-07 purge load again; recollection uses a live cloud picture (#3492) (`a6c4691`)
- **tools** — stamp_object clears off-purpose furniture and takes onOverlap nearest|replace (J64) (#3485) (`cd57223`)
- **ai** — an empty provider reply never settles a turn; images are dropped once a provider blanks on them (#3486) (`7022e44`)
- **ai/v2** — skip a VQA round when nothing changed since the last one (#3490) (`396429b`)
- **ci** — 새 AI 컴포넌트의 표면 소유 선언 + undefined 토큰 폴백 제거, winners 래칫 갱신 (#3487) (`d3db7e8`)
- **player** — type-only Phaser import in field staging and emotes (#3482) (`7238c47`)

### 성능

- **electron** — show the start splash the moment it is created, not after ready-to-show (#3489) (`3959f92`)

### 문서

- **openwiki** — drop a leftover merge-conflict marker and its stale duplicate in editor-ai-tools.md (#3491) (`7e2a67d`)

### 빌드

- fail the build when a bundled reference doc exceeds REFERENCE_LIMITS (#3493) (`db9885f`)

### CI

- ci-vitest-files — run chosen vitest files on a hosted runner on demand (#3484) (`76d1d1f`)

## 0.340.0 — 2026-10-25

### 기능

- **ai/v2** — 3-round adversarial visual QA loop for whole-game builds (#3475) (`da31ef9`)
- **ai** — assistant role matrix with auto-assignment and per-role override (#3456) (`7a6d818`)
- **ai** — assistant finds, installs and wires store music (auto by default, swap note) (#3465) (`f6fefeb`)
- **beodeul-massing** — 27 hand-pixel medieval buildings from bk-massing-100 (gate + two independent reviews) (#3460) (`29c6f68`)

### 수정

- **ai-v2** — a missing image login no longer stops the turn — use the closest library picture and keep building (#3481) (`9ec1834`)
- **ai-v2** — dress rooms by purpose, keep NPCs off lanes/exits and behind counters, check object events (#3480) (`fa463d3`)
- **building-kit** — walk masks match the art (town-hall/market-hall/tithe-barn), check rejects passages and wall pockets; reference generator auto-splits docs >100k and validates REFERENCE_LIMITS (#3479) (`e208f31`)
- **player** — monster-style defeat box shows two lines, not three (#3477) (`aad4ee3`)
- **ai-v2** — pick faces, chips and title art by what they look like (J35 J30 J41 J38 J43) (#3476) (`083e985`)
- **player** — a save that cannot be read back is never reported as saved (#3474) (`48b5266`)
- **beodeul** — split the 262k street-tiles reference doc into 3 pages under the 120k limit (#3473) (`2464d1c`)
- **ai** — type errors from #3464; slow providers don't kill the turn at the intent step; moderation 400 in plain Korean (#3471) (`1178029`)
- **ai-v2** — menu/HUD requests never empty actor or class battle data (#3467) (`121405d`)
- **ai-v2** — add_event after: picks the NPC talk page; HUD/menu words load HUD and menu tools (#3464) (`a6a8ccf`)
- **ai-v2** — mid-floor guardians stay party size; finish check flags non-boss sprites drawn far larger than the party (J23) (#3459) (`b9811cf`)
- **runtime** — KO state in menus, door-entry followers, ending quotes, phone 4:3 dock, pixel list width (#3458) (`1f8a101`)
- **ai** — whole-game turns that stop on the skeleton (「기억의 조각 → 첫 구간 끝」) or with no ending are re-kicked up to 3 times (Salad S3) (#3457) (`9f67d9b`)

### CI

- **surface** — 스냅샷 6축 갱신 + eventSeesPlayer 픽스처 누락 수리 (#3461) (`8049a23`)
- ci-fast on PRs, ci-full on a 4h cron, merge helper that waits for ci-fast (#3478) (`1201f18`)

### 잡무

- **deps** — bump @oh-my-pi/pi-agent-core 18.9.1 -> 18.12.3 and zod 4.6.6 -> 4.6.7 (#3470) (`46bdcdc`)
- **agents** — tests run only on GitHub CI — local vitest, bun test, playwright test and gates exit 1 outside CI (#3468) (`fa40ff6`)
- **building-kit** — commit massing drawing scripts and fantasy-kingdom round modules; regen.py --check reproduces all 32 pictures byte-identically (#3466) (`88e19b2`)
- **dungeon** — drop unused resolveGraphic import (`95ea0ed`)
- **dungeon** — remove floor VQA verdicts that no reviewer returned (r1 Sonnet, r3 Argon A) (`b7ef16f`)
- **dungeon** — floor VQA r3 Argon A verdicts (`ec3291f`)
- **dungeon** — floor VQA r1-r3 evidence (`868e5a4`)

### 기타

- **dungeon** — floor VQA r4-r6 evidence (sonnet 12/12, argon 4/12 at r6) (`b285e00`)
- **dungeon** — r6 raw reviewer verdicts (sonnet 12/12 pass, argon 4/12) (`74ea58c`)
- **dungeon** — r5 raw reviewer verdicts (`84e0de6`)
- **dungeon** — otherworld void edges get the same majority smoothing as lava (`7c54633`)
- **dungeon** — swamp mud mixes only its calm cells (`de9c679`)
- **dungeon** — banked ponds use gap water interior variants (no 16px sparkle grid) (`541b917`)
- **dungeon** — mine rail is one continuous row per room and corridor (`637e879`)
- **dungeon** — drop the half-room ochre cell floor strip (`ba0fdd9`)
- **dungeon** — choke bars only in wall-flanked horizontal necks in built dungeons (`2e1b53f`)
- **dungeon** — wall face edge pieces only where the wall row really ends (stepped walls no longer show inner seams) (`115023d`)
- **dungeon** — r5 fixes - cave boats on water, swamp pads/pilings on open water and living reeds, temple stone altar and braziers instead of cult kit (`78d29fb`)
- **dungeon** — temple nave drops the single repeated moss slab (`38d8112`)
- **dungeon** — catacomb cells use dark catacomb slab instead of ochre castle cell floor (`b504c3c`)
- **dungeon** — wall-backed north standing props (thrones) first (`7800e76`)
- **dungeon** — natural caves block the lever path with a boulder (no bars on open dirt); clutter only beside walls or other props; cave plank bridges; smoother cave outline (3 passes + single-column notch levelling) (`a76b702`)
- **dungeon** — swamp water only in rooms, shade off water, one-rim thin ceilings, thickness fix for room layouts, mixed floor cells; theme-floors-r1 otherworld floor round; raw floor VQA r0-r4 outputs (`474c9c2`)
- Revert "chore(dungeon): floor VQA r3 Argon A verdicts" (`7831dab`)
- **dungeon** — ruins calm limestone with moss flagstone only in the nave; rubble at walls; gimmick circles avoid floor decals; cracked sandstone only in the pharaoh room (`fe48e7e`)
- **dungeon** — ice sheet only in the frozen-lake room; cave floor mixes only clean cells, fewer pale pebbles (`d2f1cb0`)
- **dungeon** — otherworld fewer bones/skulls at room edges (`8f998b8`)
- **dungeon** — swamp mud bank instead of moss squares; pyramid/otherworld mix only calm cells (`0651764`)
- **dungeon** — forest clearings use calm oasis lawn (737 grass glyph tiled as a 16px grid) (`c486652`)
- **dungeon** — calmer floors — close-tone patches only, no per-cell mix on seamed kits, debris near walls; tower observatory reachability fix (`58fc3a3`)
- **dungeon** — ice face r10d — seamless slab order, teal second ramp, grain, irregular ledge; compose uses <face>-mid 3-tile slab when baked (`2295ba9`)
- **dungeon** — ice face r10 — 48px facet slab, translucent ice ladder, hard top/left light edges (`8a6ed39`)
- **dungeon** — ice face r9 fresh start — Beodeul cave face frame, three facet concepts (`a2d3de7`)

## 0.339.0 — 2026-10-25

### 기능

- **ai-v2** — independent advisor checks each turn's report against the diff (#3448) (`694bf7a`)
- **ai** — whole-game builds can't ship editor defaults or one-line endings; set_field_hud; title spoiler check (J59, J60) (#3451) (`40a2fb2`)
- **first-love** — anime-OP opening montage + street cold open (bump, paper, freeze); freeze-frame/petals/paper engine features; KR street props (#3450) (`bc9c01d`)

### 수정

- **ai** — v2 add_event say without who is narration; beats missing who are skipped with a warning instead of crashing (who.trim) (#3455) (`3355612`)
- **ai** — shipChecks 의 미사용 filter 인자 제거 — main 빌드 차단(TS6133) (#3454) (`6b5286e`)
- **flagship** — 네 번째 계절 오프닝 루프의 미사용 index 제거 — main 빌드 차단 (#3453) (`fd51801`)
- **ai** — flashlight sources use at:{kind:'player'} everywhere; the schema rejected the 'player' string the horror card taught (#3446) (`1f2ecd1`)

### 잡무

- **ci** — css-winners 래칫을 현재 트리로 — 타이틀 메뉴 compact 선언 12건 (#3447) (`5a07254`)

## 0.338.0 — 2026-10-25

### 기능

- rebuild Shitamachi flagship demo + speakers-visible dialogue camera, map-view openings, romance story preset (#3445) (`4a87b28`)
- **save-points** — sparkle on approach and 「기록하시겠습니까?」 prompt; Fallen's three save points share one look (#3441) (`55a0f95`)

### 수정

- **space-craft** — judge edited maps against their start state, not only absolute gates (#3439) (`f3c3ec7`)
- **test** — 가짜 DOM 의 DocumentFragment·getComputedStyle 구멍과 dialogue sentinel (surface 축) (#3443) (`8473772`)
- **ai** — choice text never shows design tags like (엔딩)/(+1일); non-combat games get a story ESC menu without skills/equipment/party (J37, J39) (#3442) (`a260f85`)
- **runtime** — opening audio never freezes the animatic; title menu under the logo; distinct resume label (#3440) (`3fa4f02`)

## 0.337.0 — 2026-10-25

### 기능

- **fallen-star** — act-1 battle, field and save fixes for 1.21 (general tools) (#3435) (`24526a3`)

### 수정

- **editor** — move_event 길막힘 경고가 pages 없는 이벤트에서 죽지 않게 (#3437) (`a405302`)
- **ai** — cutscene critic gets a real repair round, first place revert keeps a retry, move_event warns when it cuts a path (#3436) (`523ed7f`)
- **ci** — css 게이트를 초록으로 — 죽은 규칙·표면 소유 누락을 고치고 래칫을 현재 트리로 올린다 (#3434) (`86bd519`)
- **ai** — stop picture searches after 3 misses, keep title preset effects off foreign art, name a dead worker (#3433) (`3a758ca`)

## 0.336.0 — 2026-10-25

### 기능

- **ai** — horror sound presets and ambient (bgs) beat for v2 events (#3430) (`b5439b8`)
- **ai** — v2 puzzle-chain verb, sealed-room fill and horror finish checks (#3428) (`691a0a9`)

### 수정

- **player** — shop and save/load windows show whole rows and unclipped text (#3429) (`ff023e0`)

### 잡무

- **deps-dev** — bump undici from 6.29.0 to 6.29.1 (#3356) (`cc47bb6`)
- **deps-dev** — bump fast-uri from 3.1.8 to 3.1.9 (#3355) (`1de8e96`)
- **deps-dev** — bump happy-dom from 21.0.3 to 21.0.4 (#3354) (`bd1d9d9`)

## 0.335.3 — 2026-10-25

### 수정

- **ai** — retry transient checkpoint/render acks, and a cut-off run tells the user what it already applied (G43) (#3426) (`fb3a953`)

## 0.335.2 — 2026-10-25

### 수정

- **ai** — v2 turns off the HP HUD in any non-combat game start, and flags night/day made only with switch+tint while the clock runs (G51) (#3425) (`2e6aaef`)
- **ending** — credits with literal \n render as lines; long ending card and final title no longer clip or overlap (G50, G52) (#3424) (`b4e282b`)
- **assistant** — opening caption track hides the duplicate narration box; finish check flags a drawn person's invisible base page that talks (G38, G49) (#3423) (`9a57072`)
- **assistant** — flashback people stay gone after the scene, flashbacks must show past people, dimmed opening backgrounds no longer reject (G34, G37, G40) (#3422) (`2796d89`)
- **assistant** — toy-shop game gaps — false opening claims, unasked deletes, sepia/colour rejects, map lock leak, shipped opening (G29–G32, G35, G42, G45, G46) (#3419) (`d801820`)

### 성능

- **assistant-v2** — halve the tool list sent every turn — battle/ending/quest tools load only when the request talks about them; repeated schema descriptions sent once (#3421) (`72683f7`)

## 0.335.1 — 2026-10-25

### 수정

- **ai** — v2 flags a clue that gates nothing in a guessable puzzle; upper floor of 「…1층」 is 「…2층」; driver seq de-dupe restarts per run (#3417) (`471d14d`)

## 0.335.0 — 2026-10-25

### 기능

- **ai** — assistant picks installed store music by scene and mood (#3416) (`ee02f97`)
- **harness** — whole-game session driver, shipped-player launcher, seq de-dupe in the capability fetch hook (#3413) (`fbe26da`)

### 수정

- **ai** — v2 keeps a place it already built instead of rebuilding over it; dungeon edit after linked doors rebuilds and relinks; per-day lines checked per person (#3415) (`fea74e0`)

## 0.334.2 — 2026-10-25

### 수정

- **ai** — v2 finish check catches instant endings, skippable clues, one-shot chasers and duplicate maps; v2 can delete maps; set_scene_mood takes flat light x,y (#3411) (`fd4c7c3`)

## 0.334.1 — 2026-10-25

### 수정

- **ai** — v2 catches links lost in a page rewrite; modern/romance games start with modern hero and no HP HUD; workshop drawing gets 9 min (#3409) (`459da73`)
- **fallen-star** — remove the checkerboard stone dais from the brazier (gate) and star-keeper vault rooms (#3408) (`77eefed`)

## 0.334.0 — 2026-10-25

### 기능

- **fallen-star** — act-1 dialogue polish with Argon (329 lines) + proposal-cap and unknown-ref fixes (#3405) (`96da59d`)

### 수정

- **assistant** — Argon turns no longer die with "Request was aborted" at the 8th-9th model turn; a cut-off turn says why; playAudio without an id says how to fix it (#3406) (`27b5ff2`)

## 0.333.0 — 2026-10-25

### 기능

- **harness** — cast-portrait repeated blind review (N=5, median + majority) calibrated on the cast (`1816e96`)
- **fallen-star** — Valen defeat branch (Bram's ambush keeps the story going), machine-form tuning, FF6-style party display, Elena learns chain lightning at Lv5 (`7954fee`)
- **fallen-star** — one container per room, open-style searches, star-keeper shrine save point (`cf3be43`)

### 수정

- **assistant-v2** — finish check catches act-end scenes that fire before the earlier step and act-end cards faked with a text line (#3404) (`6af5e0c`)
- **assistant-v2** — Korean modern requests build a Korean city street and city interiors instead of Japanese ones; edit/delete words load event tools (#3403) (`7573f20`)
- **ci** — compare the project title, not a system field that does not exist (`96b8ba6`)
- **assistant-v2** — side-effect check no longer makes the assistant undo requested enemy/skill/item edits; second report must say it replaces the first (#3400) (`3fec095`)
- **assistant-v2** — letterbox requests need a real letterbox command (#3399) (`6c842ad`)
- **harness** — cast-portrait reviewer key falls back to ANTHROPIC_AUTH_TOKEN; never read the proxy config (`bad7cb0`)
- **assistant-v2** — whole-game gaps G1-G5 — village on the blank start map gets its name and BGM, factory opening check, no rebuild of linked villages/dungeons (#3396) (`6527664`)
- **fallen-star** — golems stand in front of Valen; recorder confirms the battle result and tolerates slow boots (`3a46a3e`)
- **fallen-star** — Valen fight balanced against the game's own auto battle; second golem actually appears (`3f6222f`)
- **fallen-star** — Valen walks to centre in phase 2 and stands behind soldiers in target order; dragon uses the field-foe path and the wake cutscene pans to it (`adb1de0`)
- **fallen-star** — unused bindings and siege cell typing in act1Finale (`5dd2353`)

### 테스트

- **fallen-star** — shrine-save checkpoint waits on the in-game save list (`8c0a0e4`)
- **fallen-star** — SQLite reload check covers Valen phases, circuit and party display (`99616bf`)
- **fallen-star** — report-lost checkpoint for Hanel's Bram line (`1e23295`)
- **fallen-star** — defeat checkpoint follows Bram's ambush to the circuit; recorder lose segment (`736f4ea`)

### 기타

- **fallen-star** — 3-phase Valen (soldiers, golems, machine form), circuit to Hanel, dragon field sprite, shorter fable, busts (`aecb8f2`)

## 0.332.0 — 2026-10-25

### 기능

- **ai** — assistant reads store reviews of the user's game, drafts creator replies and complaint-addressing news (#3394) (`786918b`)
- **harness** — cast-portrait verdict/pick/install, eye colour-count check; cg-nat10 pixel fixes picked by the user (`84854c0`)
- **harness** — cast-portrait — dialogue busts locked to the existing cast's pipeline and spec (`3a6b0f1`)
- **player** — run by pushing the stick past 70% (ring shows the zone), tap-walk runs on paths of 5+ tiles; separate Run button is now opt-in (`7dc3e36`)
- **assistant-v2** — opening tier gets backdrop/caption/timeline tools and a night-sky card; finish check simulates battles events open (#3391) (`150c486`)
- **store** — creator voice — version comments and news posts from editor, CLI and assistant (#3388) (`ae4537f`)
- **assistant-v2** — load demo features by request words — combo techs, battle staging/fanfare, touch settings, dialogue desk, street walkers, modern street, rooftop background (#3386) (`c10a833`)
- **battle** — enemy weaknesses are discovered, not told — first-hit 「약점 발견!」, per-enemy knownWeaknesses in the save, battle.revealWeakness (never|afterDiscovery|always) for targeting; strip monster-weakness hints from Fallen Star skill and item texts (`abc0a9e`)
- **player** — landscape controls rise above dialogue/battle windows and step aside for the ESC menu/shop; leftovers probe + wiki (`25223da`)
- **player** — touch leftovers — 44px ESC menu rows (pixel skin) opened by one tap, 44px fullscreen button, cutscene skip restores camera/zoom/letterbox, controls fade under messages and battle in landscape (`672ea2a`)

### 수정

- **ci** — drop the duplicate damageTypeRates keys blocking main typecheck (`8bc2218`)

### 문서

- **openwiki** — drop a stray rebase marker from the assistant-v2 demo-tier note (#3389) (`3885e7b`)

### 테스트

- **qa** — mobile-run probe (stick deflection speed, tap route speed, always-dash); wiki: touch running rules (`3ca3358`)
- **dialogue** — story order, screenplay text, story tools and edit rejections; side scenes anchor after their map's entrance (#3383) (`6ffbbaf`)

## 0.331.0 — 2026-10-25

### 기능

- **assistant** — Fallen Star work reachable by the assistant — forest route, search containers, text replace, schema fields, tool tiers (#3382) (`1d5d243`)
- **fallen-star** — act-1 follow-up — 3-phase Valen, defeat continues via Bram, circuit, dragon sprite, short fable (#3364) (`f2ece51`)
- **workshop** — 캐릭터 「사진으로 만들기」 — 사진에서 후보를 만들고 하나 골라 추가 (#3330) (`20e694f`)
- **store** — structured game changelog lines (+ new, ~ improved, ! fixed) and --changelog-file (#3381) (`0658ebc`)
- **battle** — staging editor cards, touch landscape battle scale, combo bust preload, lunge QA trace and checkpoints; wiki (`f7abc13`)
- **battle** — staging settings — fast enemy lunge baseline with per-enemy speed, crossing-bust combo cut-in with finisher/shake/slow-mo/number burst, one-line skill hint in the prompt line; Fallen Star role growth curves (`9e52ebb`)

### 수정

- **ci** — restore FaceGraphic and drop names the first-love merge left unused (`8f90ff5`)

### 문서

- **battle** — landscape battle uses the general mobile landscape layout; measured sizes (`45058f0`)

## 0.330.0 — 2026-10-25

### 기능

- **first-love** — Korean business street, numbered subway exits, street walkers, rooftop street view (#3375) (`350cb67`)
- **dialogue** — 대본 screenplay view in story order + story tools for the assistant (#3377) (`8882615`)
- **player** — phone landscape fills the screen height — controls overlay the stage translucently; iPhone home-screen hint (`9e7d458`)
- **astra** — professor bust remade with the cast's char-gen pipeline, cg-nat10 default (`e0a5ed1`)
- **player** — mobile touch feel — tap-to-walk/talk on by default, cardinal-biased stick with hysteresis, auto stick, run toggle, haptics, 44px buttons (`f8adba2`)
- **battle** — skill help, distinct skill roles, level-up/learn fanfare, Chrono-style combo techs (Fallen Star) (#3370) (`c0ca99f`)
- **dungeon** — bake otherworld ceiling rim r10 A2 (panel 11 both PASS + object-gate PASS, delegated allow) (`02c8838`)
- **dungeon** — bake will-o-wisp fire bowl (panel 10 + object-gate PASS, delegated allow); rim A2 body grain, ice face frosted strata (`0eb8fb6`)
- **i18n** — 대사 tab labels in en/ja/zh (`01e087e`)
- **database** — 이야기 › 대사 tab — dialogue table, inline edit, runtime-measured overflow, voice notes, per-line AI proposal review (`e1f82de`)
- **dialogue** — dialogue index, edit gate, speaker voice desk and assistant tools (`da02b67`)
- **dungeon** — bake tower wall face (r9) and cracked-floor decal (r6) after panel 9 + object-gate PASS, delegated allows (`43fe640`)
- **beodeul-organic** — 버들항 자연 기물 37종 — 블라인드 두 판정자 검수, 위임 허용, 관문 굽기 (#3367) (`c3d8981`)
- **beodeul-forest** — T3 bark-contrast trunks are the shared broadleaf composer default (`4c6a398`)
- **dungeon** — bake otherworld wall face kits and minecart (delegated allows after blind panel 8 + object-gate PASS) (`0804588`)
- **astra** — user-approved starter lines (lotus lemur, flame ram, wave orca) (#3365) (`dc61fe8`)
- **forest-trunks** — T3 r8 bark — Argon VQA 7/7 PASS, user-approved human picks on r8 hashes (`bec301c`)
- **dungeon** — bake wizard tower ceiling rim (beodeul_dungeon_ceiling_tower), delegated allow after blind panel + object-gate PASS (`84a9c27`)
- **party** — FF6-style companion display (leader only on field, companions in story scenes) (`6936cfc`)
- **battle** — boss HP hiding, element exceptions in damage-type rates, enemiesAlive/enemyState battle conditions, humanoid enemy walk timing (`0c9c470`)
- **player** — portrait window panel for menu/shop at 1x, 1.5x scale step for iPad-class screens (#3359) (`0583779`)
- **fallen-star** — Valen intro boot/sword SFX; act-1 recorder maps WebAudio/blob SFX and plays the first battle rounds (`93710b8`)
- **player** — device-independent game UI — windows in game px scaled with the stage, integer scale on touch, portrait dialogue dock, shop in a logical frame (#3353) (`0731902`)
- **battle** — damage-type taken rates (physical/magic) with state overrides + enemyState troop condition (#3350) (`e03a34a`)
- **fallen-star** — tune crash Valen and moon dragon from headless sims; act-1 checkpoints, SQLite round-trip and play-recording scripts (`28f4023`)
- **player** — field enemies without a walking chip get a sprite derived from their battle dot art (#3349) (`95eb80c`)
- **fallen-star** — act 1 restructure — crash-site Valen mid-boss, vault labyrinth B3/B4, moon-scale dragon (pierce opens magic x3), 'Child of the Moon' panel lore, siege ending (`94ffe6d`)
- **battle** — damage prediction honours damage-type taken rates (auto-battle AI and target hints) (`c665dd6`)
- **fallen-star** — vault labyrinth floors B3/B4 room specs, star seal in vault, room preview scripts (`432f4f8`)
- **battle** — damage-type taken rates (physical/magic) on enemies, state overrides, enemyState troop condition (`083f500`)
- **fallen** — dawnwell necklace gives +30% damage dealt (new equipment trait) instead of ATK/MND approximation (`366d573`)
- **fallen-star** — town cast pass — adult smith chip, speaker busts with emotions, Iris/Elena gear at the smithy, running kids, hidden Dawnwell necklace, Valen no longer lingers in town after marching to the forest (`f211d4b`)
- **fallen-star** — act 1 dialogue flow, Iris join choice, Valen smoke exit, cult fanatics in the vault, curated house loot, missing scold lines (`563737e`)
- **fallen-star** — container fx, owner turn + ! / ? reactions and room-aware owner cues on whatever containers exist (`fd13504`)
- **fallen-star** — Valen phase 2 sheds armour (agility up + defence down) instead of attack x2; HP 2100 / atk 112 (sim: 95% win, ~17 actions, 1.4 potions); finale QA plan heals (`e39eed8`)
- **fallen-star** — act-1 roster by forest area (12 new foes, each one role) + per-area encounter tables; Iris becomes the Starlight Gunner with a star rod (bow-type) and beam skills; class names for Kael/Elena (`787e000`)
- **fallen-star** — battle QA checkpoints (weapon bonus, armored beetle, sleep, crit, ether/meditate, Valen finale); snipe text names its line pierce (`ef93daa`)
- **fallen-star** — Valen HP 1600 / atk 108 after headless sim (win 100%, ~16 actions, ~1.3 potions); add sim script (`c52c0d7`)
- **fallen-star** — distinct skill roles, armored/healer/swarm foes, Valen boss phases+summons+signature blade, MP recovery (`5db04e3`)
- **fallen-star** — cinematic 39 s cold open — parallax night sky, star cracks, fireball over the forest, bell, title with god rays (`1bc04ac`)
- **dungeon-themes** — towers stand above a sea of clouds (`9544297`)
- **dungeon-themes** — redrawn mine rails and ore veins, catacomb ossuary, ruin overgrowth baked and wired (`2b28eec`)
- **dungeon-themes** — redrawn otherworld portal and void edge, pyramid floor and sand/snow drifts baked and wired (`2819ff7`)

### 수정

- **ci** — clear the six type errors blocking main typecheck (`dc10179`)
- **dungeon** — carpet runner cells were baked solid (no walk_grid for its parts) and walled off the castle boss room on 2/20 seeds; now passable (`14dd919`)
- **player** — integer scale snaps to device pixels on fractional DPR screens (125%/150%) (`c469178`)
- **database** — Escape while editing a line cancels the edit instead of closing the database window (`77b7268`)
- **database** — hide the empty proposal box for a speaker, label speakerless proposals as narration (`388a021`)
- **dialogue** — turn a model's double-escaped \\n into real line breaks before checking an edit (`e250844`)
- **player** — door-open fx only on real doors (no city gate/passages/map edges), no hitch; editor 문 열림 연출 자동/켜기/끄기 (#3363) (`aeb44d4`)
- **player** — pixel shop party cards share the window width — names no longer cut to 「엘…」 at game-px text (#3362) (`094429f`)
- **fallen-star** — dragon battle BGM uses a catalog mp3 (store rejects .mid) (`19536ed`)
- **assistant-v2** — 92-task suite fixes — real screen effects, visible objects, kept/linked new maps, one-shot rewards, NPC reuse, arg aliases, farm barn (#3352) (`192d074`)
- **fallen-star** — the star fell in the NORTH forest everywhere — proclamation, credits, quest summary, telescope, bard, witness, gate guard, knight, store/home blurbs (`e5646d7`)
- **qa** — fallen-star report/ending checkpoints talk to Hanel at the telescope (12,13); he moved there in #3314 (`9e15c05`)
- **fallen-star** — the forest is north of town — 'east forest' / 'east gate' become north in dialogue, readables, quest text and switch names (opening cinematic and the brazier puzzle excluded); Hanel's sky tower lies beyond the forest (`993e707`)
- **fallen-star** — Valen keeps his 48px face (the shared bust wears a jester hat his chip lost); face-cell expressions on his angry/sad lines (`726e5e5`)
- **fallen-star** — elder's dusk line notes Valen left for the forest; kids capture frames the tag loop (`2751ccd`)
- **fallen-star** — Valen's smoke builds up before he fades; shorter flash; capture waits through the vanish (`2276ad6`)
- **fallen-star** — knight-post crate finds a wall corner by Rino's post; story2 capture + store round-trip scripts (`0e36403`)
- **fallen-star** — opening fall lands in the north forest; crisp integer upscale, skip button visible from frame 1, slower first pan (`b42bf2f`)
- **dungeon** — r2 VQA repairs — volcano lava streams survive crop, cave water stream + request cues pick the gimmick, entrance lever only as last resort, enemy names in summary, ice dungeon requests bypass snow-north, otherworld void without stone-bridge stubs or floating pillars (`8f98869`)
- **ai** — a pyramid dungeon request goes to author_dungeon, not a desert_east tomb room (`5ebc26a`)
- **dungeon-themes** — teleporter flash uses a catalog colour; towers stack floors by default (`f0140b7`)

### 문서

- **openwiki** — ice face not baked yet (`1d6df7c`)
- **openwiki** — mobile feel v3 — touch controls settings, tap-to-walk, stick sectors (`771dd29`)
- **openwiki** — dungeon themes round 2 pieces, style-judge lessons, carpet passability fix, samples script (`81cd928`)
- **openwiki** — play-surface integer scale snaps to device pixels on fractional DPR (`881ff99`)
- **openwiki** — 대사 tab, dialogue tools, project.dialogueDesk; narration label for speakerless lines (`94ae0b5`)
- **openwiki** — Fallen Star cinematic opening recipe, camera-offset trap, tap skip, handoff tile window (`ed303df`)
- **openwiki** — dungeon themes — r2 assistant-path repairs (`6ad8481`)

### 테스트

- **player** — touch stick sectors and touchControls normalization (`742bf0a`)
- **fallen-star** — defeat checkpoint advances in-battle dialogue before defending (`6fc28b1`)
- **fallen-star** — battle checkpoints start on the forest edge map (six-map forest) (`fe043e0`)
- **fallen-star** — ether checkpoint drains MP first so the ether shows (`f425e93`)
- **fallen-star** — ether checkpoint targets Elena by id (`8dbd75b`)

### 잡무

- **dungeon** — ledger run log (`15c7ee8`)
- **dungeon** — panel 12 evidence (ice face not passed; stays on cave C face) (`18a9cc6`)
- **store** — list touch controls on the store game page (`850fdec`)
- **qa** — mobile-feel probe — real CDP touch on emulated phones (`252a07e`)
- **deps-dev** — bump the development-dependencies group across 1 directory with 7 updates (#3310) (`1a4f46f`)
- **deps** — bump zod from 4.6.5 to 4.6.6 (#3319) (`df18bd7`)

### 기타

- docs(openwiki)+qa: phone landscape fill, overlay controls, landscape probe settles past the march cutscene (`b28a845`)
- **astra** — professor busts made with the cast's own char-gen pipeline (4 candidates, selectable ids) (`13fcc96`)
- **dungeon** — ice face r7g dull ice ledge, no bright frost specks, dull embedded ice (`64be8e8`)
- **dungeon** — otherworld rim r10 (tower coping structure in obsidian), ice face r7c quiet strata, wisp r8b teardrop (`e7d574c`)
- **astra** — hand-pixel professor bust A fix round after blind review; QA scenarios accept deviceScaleFactor (`ef50b3c`)
- **astra** — professor bust candidates (2 hand-pixel, 2 recolored shared) as selectable ids (`30fc909`)
- **dungeon** — wisp fire-bowl redraw (r8), ice face tinted water ramp (`6b58094`)
- **dungeon** — cracked floor as transparent decal with tinted joints; ice face tinted darks (`08983a0`)
- **dungeon-chipset** — walls-r9 tower face/rim, props-r7 ice strata (WIP, gate FAIL), panel-8 evidence (`97b29a6`)
- **dungeon-chipset** — walls-r8 glowing fissure + Beodeul grain, props-r5 Beodeul-size cart + frosted ice, props-r6 angular collapsed slab; panel-7 evidence (`9a378ea`)
- **dungeon-chipset** — walls-r8 slab-style otherworld rim, tower window without light frame (`adf44bf`)
- **dungeon-chipset** — walls-r7, props-r4 (low 3/4 cart, ice), tower rim A1 delegated pick, panel-6 evidence (`b81f6b4`)
- **forest-trunks** — T3 bark-contrast finalize passes r1-r4 — style gate 2/7, not composer default (`bb20a40`)
- **dungeon-chipset** — walls-r5 clumped grain, recessed crack, calmer second ramps (`bb125d8`)
- **fallen-forest** — hand-dot trunk redraw round (T1-T5) on the B1 broadleaf trees — 3/4 gate not passed (`db0548d`)
- **dungeon-chipset** — props-r2 cracked floor per-slab, props-r3 ice face, minecart TK wiring, bake handlers for props/ice face (`cb4ad5a`)
- **dungeon-chipset** — props-r2 3/4 minecart and sunk cracked floor; walls-r6 otherworld rim (`4aa80fa`)
- **dungeon-chipset** — theme-walls-r5 per-stone three-ramp faces, plum obsidian otherworld rim (`10603ad`)
- **fallen-forest** — forest-look prototype knobs (trunk-peek spacing, fringe trees, shadows, skirt) + option renderer (`ffff3a6`)
- **dungeon-themes** — theme-walls-r4 after r3 VQA (`0ef38d4`)
- **dungeon-themes** — theme-props-r1 minecart, cracked floor, wisp lantern redraw, ice wall face (`03a53c9`)
- **dungeon-themes** — walls r3 tower rim joints off the cell seam (`2de5acc`)
- **dungeon-themes** — theme-walls-r3 redraw after r2 VQA; sample dungeon save/reload script (`73a2ae2`)
- **dungeon-themes** — theme-walls-r2 redraw after r1 VQA FAIL; face/rim bake handlers; tower ceiling group wired (`73eab84`)
- **dungeon-themes** — theme-walls-r1 otherworld/tower wall faces and ceiling rims (draft, VQA pending) (`d41ac2d`)
- **dungeon** — pause (`9f9ab6c`)

## 0.329.0 — 2026-10-24

### 기능

- **fallen-star** — act 1 story flow, Valen smoke exit, vault cultists, curated loot, town cast & north forest (#3338) (`3a976f5`)
- **player** — touch list rows move the cursor first, tap the highlighted row to confirm; readable menu text on narrow touch screens (#3347) (`295048b`)

## 0.328.0 — 2026-10-24

### 기능

- **fallen-star** — forest r2 — north of town, organic B1 woodland, hidden items, shrine rest point (#3344) (`b5f701f`)
- **battle** — equipment damage-dealt / damage-taken percent traits (#3343) (`9417530`)
- **player** — mobile controls in every state, Fold touch detection, closable log, portrait/landscape touch layout (#3333) (`52ee52e`)

### 수정

- **export** — declare Galmuri11.woff2 as a runtime asset (#3341 used it in fonts.css) (#3346) (`b298072`)
- **player** — boot loader fits a landscape phone iframe and starts on any tap (#3345) (`952585b`)
- **player** — pixel dialogue + field popup text on the font's pixel grid (Galmuri11 12px, whole-pixel stage); QA clips with SFX (#3341) (`7e7e6e5`)

### 문서

- **fallen-star** — act 1 script (boxes, event-id tags, side quests, readables L1-L10) (#3307) (`8e87019`)

## 0.327.0 — 2026-10-24

### 기능

- **player** — account cloud saves for store web games via a postMessage bridge to the play page (#3339) (`34543bf`)
- **events** — wall/room-aware NPC sight + hearing, door-open before door transfer, data-driven container search fx (#3336) (`a686f3d`)
- **battle** — AoE lands on all targets at once; crit/weak/resist/weapon tags; weaponAffinity; state maxTurns; equipment drops; hit-wake order (#3334) (`262fdd2`)
- **fallen-star** — six-map whispering forest + field monsters that spot and chase (#3332) (`6d4907e`)
- **ai-v2** — add_event afterTalk; silhouette before the actor shows; per-leg scene walk cap (#3328) (`4615f8c`)
- **player** — mobile UI pass - touch-size menus, shop, battle, title; notch-safe portrait (#3324) (`4d5a32d`)
- **fallen-star** — act 1 core scenes — Iris waking, scope journal, Valen foreshadowing, ending cliffhanger (#3323) (`8690927`)
- **fallen-town** — act 1 town lines and three side quests (#3322) (`84163cc`)
- **store** — image packs + version-scoped service worker — full preload 32-39 s → 13-18 s (#3320) (`de12607`)
- **fallen-star** — battle elements, sword/spear lines, item gimmicks, drops, encounter rate, potion rebalance (#3315) (`0a85854`)
- **store** — play store games in the browser — auto-versioned publish, loading screen, full prefetch (#3318) (`ad7c143`)
- **fs-town** — owners catch you only by sight, many containers in houses and street (#3317) (`dd8de6b`)
- **fallen-star** — Hanel by the telescope with state-dependent lines, 10 lore readables, canopy-autotile forest rebuild (#3314) (`902bf6a`)
- **ai-v2** — game-element layer (quests, items, shops, battles, party, switches) + night/camera/shadow scene beats + 40-case game comparison set (#3312) (`db2cd77`)
- **flagship** — Fallen Star town life — searchable containers, Lisa catch/ban, Toma bread gimmicks, smithy (`65cb7f9`)
- **player** — mobile touch play — D-pad/A/B, tappable UI, fit scaling, fullscreen, iOS audio unlock (#3309) (`764e861`)

### 수정

- **events** — timer page condition honours an optional op (default <=, the old behaviour) (#3329) (`2c7455b`)
- **ai-v2** — scene-only actors walk at most 24 steps per scene; scene check flags 30+ step walks (#3327) (`b441767`)
- **ai-v2,cutscene** — no flicker on cutscene skip landing; vanishing scene actors get no follow-up line; cards for affinity variables, renames and place names (#3326) (`6c1b5fb`)
- **ai-v2** — scenes after an NPC's talk, existing-map add-ons, shared gates for borrowed tools; upsert_actor keeps an existing actor's curves on partial edits (#3325) (`8e1a702`)
- **editor** — open flagship demos from the baked project file as a real project (#3316) (`aca57eb`)
- **flagship** — fallen town container labels/josa, QA probe walks doors with real keys (`b348f58`)
- **flagship** — strip coordinate suffix from container labels; add townlife play probe (`06c433e`)
- **flagship** — townLife type cast (`2d3303c`)

### 문서

- **openwiki** — store game storefront moved to play.openrpgmaker.com (#3321) (`ad530b3`)

### CI

- **ci-full** — 수동 실행은 브랜치마다 따로 줄을 선다 (#3340) (`b34b10f`)

## 0.326.0 — 2026-10-24

### 기능

- **assistant-v2** — variety — same request no longer gives the same map; dungeon layout spread families and gate/stairs entrance; includes dungeon-themes @9f9ab6c60f (default off) (#3304) (`7752501`)
- **assistant-v2** — round 6 — speed (one repair round, own-map critics), plain dungeon variety, cutscene staging fix (default off) (#3303) (`6c0be78`)
- **assistant-v2** — round 4 — bosses drawn 2.5x with a 3x2 body, residential alleys keep a residential layout, outdoor people stand beside the road, modern-stage hero dressed as a schoolboy (default off) (#3298) (`7f2020f`)
- **assistant-v2** — round 3 — themed dungeons, framed north back door, refused patch costs a round, monster town title hint (default off) (#3294) (`86eec51`)
- **assistant-v2** — round 2 — interior venues, edit-in-place with north back door, simulated cutscene staging, place words, monster town and romance scene (default off) (#3290) (`8b2c791`)
- **qa** — agent play sessions on the shipped player + save-anchored regression scenarios (#3289) (`498945e`)
- **runtime** — natural town life — NPC strolls, free-flying birds, HGSS one-tile monster follower (#3288) (`115531f`)
- **dungeon-themes** — bake theme art (arcane, earth, r2 lava) and wire it into the builder (#3287) (`9aa0536`)
- **dungeon-themes** — 12 dungeon themes in the builder + first theme art bake (forest, ice, swamp, pyramid) (#3285) (`7e65f15`)
- **assistant-v2** — opt-in v2 assistant (spec → deterministic builders → independent critic), default off (#3284) (`90a497d`)
- **beodeul-dungeon** — gap pieces — rock/water/ice floor/door/lever/goblin camp/tower kit baked and wired (#3283) (`6a71413`)
- **astra** — redraw NPC dialogue portraits as clean 64x64 GBA-style busts (#3282) (`4406825`)
- **dungeon** — assistant dungeons 2 — crop void, always an exit, tower/liquid/boss themes, fixed judge brief (#3281) (`c7f21c5`)
- **assistant-capability** — 500-command family matrix with judge self-check and a pinned OpenAI-compatible model (#3272) (`411bcda`)
- **workshop** — one-click objects pass the 3/4 gate; faster object path; minor UX fixes (#3280) (`7ab99db`)
- **dungeon** — assistant builds working multi-floor, populated dungeons (stairs, counts, lever gate, flood, lair) (#3278) (`1cc1a19`)
- **fallen-star** — playable royal town matching the opening art, proclamation and two-abreast escort, five interiors, crash-site scorch trail (#3277) (`1c72caf`)
- **workshop** — one-click 공방 — object, character, terrain from one line (#3276) (`2430ced`)
- **beodeul-wall** — redraw town wall 3rd edition — 3/4 depth, texture, posterns, biome variants (#3273) (`362cf1b`)
- **astra** — install r5b battle trainer sprites + trainer-intro staging fixes (#3225) (`7ce0c34`)
- **wizarding** — redraw the six stair kits (up = north-wall doorway, down = floor stairwell) (#3264) (`75e1e01`)
- **jp-city** — redraw interior stairs (13 kits) with explicit up/down direction (#3270) (`9102060`)
- **interior-v5** — redraw stairs up stone/wood, stairs down, stairwell down so up/down reads at 1x; descriptions state direction, entry side, facing, arrival (#3267) (`bf743c3`)
- **ai** — village types by era — catalog, find_village_type, honest needs-art, quarter dressing, moonbase recompose (#3265) (`9497aee`)

### 수정

- **runtime** — followers keep the leader's trail and corner diagonal slot changes with correct facing (#3308) (`74b07b4`)
- **player** — battle entry waits for first-frame art (readiness gate) + map prefetch of battle assets (#3306) (`f2a01c8`)
- **player** — keep keyboard focus inside the game when embedded; no page scroll on game keys; release held keys on blur (`cf552ff`)
- **export** — no dead runtime asset declarations; retired art exports with a warning; guard script (#3302) (`f74203d`)
- **battle** — wild encounter names read Korean species names (#3301) (`05e2d91`)
- **shitamachi** — venue rooms get real return doors (#3300) (`aff42c3`)
- **battle** — only the cursor row paints a target glyph (#3299) (`97a8b52`)
- **player** — settings rows act, battle reports count party rounds, quest steps read cleanly (#3297) (`4daf827`)
- **player** — play clock reads the save and the title cursor resets on re-entry (#3296) (`915d0ba`)
- **field** — visible quest givers, campaign-backed map/badge menu, gated confession, honoured transfer arrival (#3295) (`416b7af`)
- **player** — hosted player reads public art and BGM from the host root (#3292) (`022693f`)
- **ai** — accept xhigh and max thinking effort in config types (`994e404`)
- **fallen-star** — guard MARCH_DEBUG reads so the shipped player doesn't throw ReferenceError: process (#3286) (`675390c`)
- **ai** — room loop 2 — observatory slit converges, cutscene review renders and judges, faster room runs, hidden start marker (#3275) (`96b896a`)
- **object-gate** — judge style against the candidate chipset's own shipped art, record the ref set in the receipt (#3271) (`a435a8c`)
- **editor** — VQA am3685 shell-studio — top bar chips, studio 1024 layout, assistant overlay/menu, team cancel, help text (#3252) (`cff33ce`)
- **editor** — VQA am3685 database — 자료집 레이아웃·리소스 관리자·타이틀 크레딧 16건 (#3251) (`e239653`)
- **editor** — VQA am3685 map-tools — 붓 보조·타일 속성·이벤트 툴바·진행 패널·검사 메뉴 등 10건 (#3248) (`e5b6406`)
- **editor** — VQA am3685 palette-modal — palette/modal Esc layers, toasts, select filter, header overflow (#3245) (`67bb208`)
- **editor** — VQA am3685 i18n — 번역 누락·문맥 오역·캔버스 0높이 수정 (#3246) (`d5f6fe6`)
- **ci** — let the desktop builder extract 7z before its own 7zz exists (`b541002`)
- **ci** — install bun on the hosted desktop builder (`7d82348`)

### 성능

- **player** — bake flagship demos at build time; fix web/HTML export failures (#3293) (`bcb0f1d`)

### CI

- **desktop** — build release packages on GitHub-hosted runners (`11ab6a3`)

### 잡무

- **object-gate** — persist delegated allows and VQA evidence recorded in the shared holds dir (town wall, stairs) (#3274) (`e367b48`)

## 0.325.0 — 2026-10-22

### 기능

- **jp-city** — hand-pixel street stairs (overpass, side stairs + stage, wall ladder) and explicit stair notes (#3263) (`c4edf79`)
- **ai** — polish mode — opt-in longer 1x review/critic/fix loop from the checklist panel (#3261) (`363a31f`)
- **workshop** — object-gen footprint decision, better reference pictures, multi-cell objects (#3260) (`70edc7c`)

## 0.324.0 — 2026-10-22

### 기능

- **beodeul** — village and brush forests use the joined canopy autotile (#3259) (`016546a`)
- **ai** — per-feature 1x review loop with an independent rubric critic for built interiors (#3258) (`ac9c8f8`)

### 수정

- **beodeul** — existing projects get town wall cells (graft relocation), delegated hold records, walled-village leftovers (#3255) (`445429c`)

## 0.323.1 — 2026-10-22

### 수정

- **stairs** — shipped stairwells no longer face the south wall; school 2F lands at the 3F down-stairwell (#3256) (`daa1f6e`)
- **fallen-star** — move a roaming townsperson out of the east-gate throat so the knight and Valen can march out (#3253) (`f18785c`)

## 0.323.0 — 2026-10-22

### 기능

- **beodeul** — hand-pixel town wall kit + walled villages (walls:true, wallGate) (#3250) (`14d9fc9`)
- **stairs** — stair entrance contract, lint and contract-driven placement (#3247) (`bee4306`)

## 0.322.0 — 2026-10-22

### 기능

- **workshop** — craft-workshop look — pixel stages, ember progress, ready reveal (#3243) (`afe0ac4`)
- **ai** — hand-interior composition lint, flat pieces on daises, focal-hall rules (assistant vs Fallen rooms test) (#3242) (`d986ce8`)

## 0.321.0 — 2026-10-22

### 기능

- **village** — villages differ by request — roofs/water/woods/highland, varied default seed, no fixed small-village template (#3240) (`f5c7d1d`)

## 0.320.0 — 2026-10-22

### 기능

- **staging** — approach / faceEachOther / dialogue auto-facing / exitVia + scene staging lint; migrate 첫사랑 (#3236) (`af99a64`)

## 0.319.0 — 2026-10-22

### 기능

- **workshop** — people packs shown per person — walking chip at integer 3x, bust at integer 1/4, real char-gen card sample (#3237) (`c579805`)

## 0.318.0 — 2026-10-22

### 기능

- **fallen-star** — act 1 rooms (VQA r28) on current main — Beodeul woodland from main (#3234) (`0c62bc8`)

### 수정

- **runtime** — hide the current-map HUD chip when the map has no name (#3233) (`ee61771`)

## 0.317.1 — 2026-10-22

### 수정

- **beodeul** — forest canopy and trees separate from the lawn (darker, hue-shifted leaf ramps) (#3229) (`e5c1f3d`)
- **battle** — battle runtime audio, tactics lifetime/clock, snapshot ownership and smoke fixture (#2586) (#3228) (`5c3769b`)

### 기타

- Runtime: talk across counters + natural NPC walk speed (#3231) (`6195e4d`)

## 0.317.0 — 2026-10-22

### 기능

- **ai** — assistant capability loop 1 — scene lessons suite, root-cause fixes (Sonnet stand-in 15/20 → 21/21) (#3226) (`1150b31`)

## 0.316.0 — 2026-10-22

### 기능

- **beodeul** — redraw the broadleaf trees, canopy and forest ground by hand (drop unknown-licence lineage) (#3223) (`431380e`)

## 0.315.0 — 2026-10-22

### 기능

- **ai** — map background assistant path — preset routing, generate_map_background, honest image handoff (#3221) (`843c6af`)

## 0.314.0 — 2026-10-22

### 기능

- **gen-kits** — workshop runners read object-gen prompts/rubrics from the pinned sync output; CI drift check (#3216) (`8ff0a05`)
- **qa** — runtime QA checkpoints — start any demo stage directly in the shipped player (#3192) (`b249d68`)

### 수정

- **ci** — stop hosted ci-fast from cloning private object-gen (`14fb65e`)
- **first-love** — platform exit gap is found on the lowest open row — the demo stopped building after #3182 honoured the explicit platform plan (#3218) (`2503cc5`)

## 0.313.0 — 2026-10-22

### 기능

- **workshop** — persistent job queue for all generators + gen-kits lock/sync (#3212) (`9fd1628`)

### 수정

- **runtime** — stable dialogue frame (no jumps across speaker/narration/choices, letterbox, locked-door line) + ending cards in the game language (#3214) (`a8dbf00`)

## 0.312.0 — 2026-10-22

### 기능

- **map-bg** — usable map backgrounds — own panorama presets, live preview, motion presets, centred cover, assistant support (#3210) (`f44e5a3`)

### 수정

- **editor** — UI audit — 55 approved fixes across shell, dock, palette, canvas, maps, event editor, AI, database and dialogs (#3211) (`b335eb9`)

## 0.311.0 — 2026-10-22

### 기능

- **workshop** — new objects follow the object-gen flow verbatim; setting as rules; placement check; advisory 3/4 badge (#3209) (`3af1cf3`)

### 수정

- **attribution** — credit EasyRPG RTP pixels in the Beodeul and vehicle sheets; add an RTP attribution check (#3208) (`6f9d34b`)
- **workshop** — tile-gen forest packs with a tree composer save again; forest card says "forest floor + trees" (#3206) (`d0352d4`)

## 0.310.0 — 2026-10-21

### 기능

- **workshop** — tile-gen material presets in the terrain request; drop the withdrawn grass sample (EasyRPG-derived target) (#3204) (`3c14f8d`)

## 0.309.0 — 2026-10-21

### 기능

- **workshop** — terrain card shows a real tile-gen grass sample, labelled 「견본 출력」 (not picked) (#3202) (`2eb1855`)

### 정리

- deprecate multi-user team collaboration (hide entry points behind TEAM_COLLAB_ENABLED) (#3201) (`8e642e4`)

## 0.308.0 — 2026-10-21

### 기능

- **workshop** — generator hub redesign, object stepper with place-on-map, terrain import, honest account-block states, char pack import fix (#3199) (`34193ea`)

## 0.307.0 — 2026-10-21

### 기능

- **ai** — generate_missing_object — assistant draws a truly missing prop via workshop object-gen (#3198) (`7a82250`)
- **lint** — scene-ceiling-tile — non-ceiling tile or stray floor in a ceiling area (#3197) (`81d8c64`)
- **modern-city** — redraw 11 interior objects (m142-b8) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3195) (`83b6a8d`)

## 0.306.0 — 2026-10-21

### 기능

- **workshop** — 공방을 생성기 넷(char-gen·object-gen·tile-gen·item-gen) 허브로 개편 (#3193) (`7aaffd0`)

## 0.305.0 — 2026-10-21

### 기능

- **ai** — scene-hang-on-floor — wall-hang kits standing on floor cells (#3187) (`5dd2a4e`)
- **jp-city** — jp house furniture 8 (interior_house3) — Opus VQA 8/8, delegated allow, baked into the house blueprint (#3146) (`1285886`)
- **jp-city** — forest r7 — tree composer forest, moss-floor sibling, always-on ground shade, paint_jp_forest; street/vehicle redraws; Opus VQA 107/107, delegated allow (#3058) (`7efb883`)

### 수정

- **jp-city** — house blueprint QA no longer counts the alias name-match hint as a failure (#3188) (`c8efb75`)
- **ai** — create_transfer_pair puts the trigger on the door cell; bump doors count as reachable (#3186) (`bcacb86`)
- **ai** — scene-actors-stacked replays visibility in order; more balance/backdrop lessons (#3183) (`4c4663e`)

### 문서

- **ai** — scene-polish §11-6 — interior padding is dark void only, no floor-valued or speck tiles (#3191) (`32e0ee1`)
- **ai** — scene-polish §11 map touch-ups (canal jogs, partial kit copies, reachability after stamping, relief offset, bridge footprint, dark interior pad) + QA timing lessons (#3190) (`331df3c`)
- **ai** — scene-polish §5-2 — pick BGM by ear; 3-run listening judge drops tracks flagged cheap 2/3 (#3189) (`13110c8`)
- **ai** — game-scene-polish only points at what exists on main (#3184) (`ffffbac`)

## 0.304.0 — 2026-10-21

### 기능

- **ai** — game-scene-polish skill + scene-* lint warnings from the three demo fixes (#3182) (`b347fd4`)
- **jp-city** — gate grandfathers already-shipped kits whose pixels are unchanged (#3180) (`d4e33d8`)

## 0.303.0 — 2026-10-21

### 기능

- **modern-city** — redraw 1 interior objects (m142-h3) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3177) (`3d9406d`)
- **modern-city** — redraw 1 interior objects (m142-b7) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3176) (`f0df402`)

### 수정

- **first-love** — konbini plaza props + compact top caption (#3178) (`e41f159`)

## 0.302.0 — 2026-10-21

### 기능

- **first-love** — 첫사랑 built-in office-romance demo (3 endings) + choice confirm grace, relationship pulse (#3173) (`a0cafb7`)
- **modern-city** — redraw 1 interior objects (m142-h2) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3172) (`5d9d8d7`)

### 수정

- **i18n** — 첫사랑 home card genre and description in en/ja/zh (#3174) (`a64ad74`)

## 0.301.0 — 2026-10-21

### 기능

- **modern-city** — redraw 15 interior objects (m142-h1) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3171) (`de37eb1`)
- **modern-city** — redraw 17 interior objects (m142-b5) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3170) (`b327231`)
- **modern-city** — redraw 2 interior objects (m142-b6) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3168) (`0d4c8a8`)

## 0.300.0 — 2026-10-21

### 기능

- **modern-city** — redraw 15 interior objects (m142-b4) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3166) (`a99cdaa`)
- **modern-city** — redraw 13 interior objects (m142-b3) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3165) (`10fa766`)
- **modern-city** — redraw 13 interior objects (m142-b2) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3164) (`a09fe6c`)
- **modern-city** — redraw 15 interior objects (m142-b1) via object-gen — Opus adversarial VQA pass, supervisor-delegated allow (#3163) (`f23df26`)
- **jp-inaka** — countryside R12-R14 — jp_city roof grammar hand pixels, Opus VQA gate (50/50), bake (#3071) (`e45d411`)

### 수정

- **inaka** — park the map 4 kei truck on the open dirt field instead of across the N-S farm lane (#3162) (`5914650`)
- delegated gate holds, jp interior 'study' kind, inaka map 3 truck (#3160) (`8d2a4d8`)
- **editor** — UI/UX 적대적 VQA 2차 (슬림 시작·AI 도크·공방·진행 창·타일 탭) (#3159) (`03c7061`)

### 성능

- **db** — fast 타일 tab (windowed chipset cells) + fix Fallen Star browser crash (#3167) (`ca8cb3f`)

## 0.299.0 — 2026-10-21

### 기능

- **object-gate** — Opus final judge v9-v11 — no exempt kind correction, wall_structure, contrast pairs, side-seat charge, 3 per call (all rejected) (#3158) (`97fa517`)

### 수정

- **beodeul** — woodland — tree composer forests + original-pixel fence corners (#3122) (`6159010`)
- **db-system** — 해상도 변경이 안 되던 버그(양쪽 전신 대화창) + 게임 설정 탭 전수 점검 (#3155) (`5eca89b`)
- **editor** — UI/UX VQA 1 — topbar overlap, canvas seams, i18n, CSP, AI-off login (#3154) (`d893ccd`)

### 잡무

- **object-gate** — beodeul dark-grass r9 — allow records (user-delegated to supervisor 2026-10-21), receipts, held images, Opus VQA receipts r1-r4 (#3157) (`498d040`)

## 0.298.0 — 2026-10-21

### 기능

- **object-gate** — Opus final judge v8 — same-chipset style anchors, kind correction (rejected) (#3151) (`6293e4e`)

### 수정

- **ai** — recover the ChatGPT/assistant connection after a local serve restart (stale token 403) without reload (#3152) (`0a1a93b`)

## 0.297.0 — 2026-10-21

### 기능

- **object-gate** — review page shows an optional per-batch explanation (scene image + plain text) (#3150) (`ca78853`)
- **object-gate** — Opus final judge v7 — audit of v6 misses, per-kind negative example, reshuffled anchors, majority of 3 (rejected) (#3147) (`cebdcc8`)

### 수정

- **ai** — Codex(ChatGPT) connection test always failed with 400 — worker now reads the {cli} body the settings screen sends (#3148) (`f6a1e7e`)

## 0.296.0 — 2026-10-21

### 기능

- **object-gate** — Opus final judge v5/v6 — chipset-original anchors, condition (b), per-family report (both profiles rejected) (#3144) (`b5df7b9`)
- **desktop** — splash at click, light boot entry, show home when cards are drawn (#3142) (`41a4ac9`)

### 수정

- **jp-city** — house interior passes the Opus interior gate by layout only; 2F inside 1F, 3-wide dressing room off the north corridor (#3143) (`c57c4d9`)

## 0.295.1 — 2026-10-21

### 수정

- **start** — start screen sections with one view-state owner; home shows only what you can do; refreshed demo art (#3140) (`adcaaf5`)
- **object-gate** — revoke Opus final profile 3b8dddb2 (7.5% clean pass; originals not measured) (#3139) (`80d20fc`)

## 0.295.0 — 2026-10-21

### 기능

- **object-gate** — final-queue fails list carries tileset, sheet and sheet cells; written atomically per batch (#3136) (`4d5939f`)
- **object-gate** — Opus 5.5 medium adversarial VQA is the final verdict (replaces option A) (#3135) (`f5aa0c2`)

### 수정

- **object-gate** — final-queue summary counts fails; beodeul_ground maps to beodeul_city (#3137) (`a7c3d1a`)

## 0.294.0 — 2026-10-21

### 기능

- **jp-city** — 일본 2층 단독주택 실내를 一戸建て 구조로 — 청사진 jp-house-1f/2f, 예제 재생성, 구조 참고문서 (#3133) (`4484b90`)

## 0.293.0 — 2026-10-21

### 기능

- **jp-city** — 「jp_city 칸 번호 복구」 — 밀린 판에서 그린 사용자 맵을 판 미리보기로 골라 지금 번호로 (#3132) (`036b48b`)
- **object-gate** — signed human allow is the final pass; 18323 review queue with batches (#3130) (`0832641`)

### 수정

- **object-gate** — review queue counts an image once — duplicate hashes in a batch broke 'allow this whole batch' (#3131) (`2d9c450`)
- **runtime** — choice window grows to fit 3-5 options at 480x270 (#3128) (`2b0af42`)
- **jp-city** — remap 32 published places to the current tile pins; block stale-pin bakes (#3127) (`38bcd79`)
- **build** — scope bundled-JSON lazy loader to browser transforms so vite-node runs work again (#3126) (`8f9da4d`)

## 0.292.0 — 2026-10-20

### 기능

- **jp-city** — 3/4 top-view depth for city buildings and vehicles (draft) (#3098) (`563991c`)

### 수정

- **runtime** — field followers no longer flank or overlap the hero (#3124) (`4e30d70`)
- **interior** — 실내 조수 RCA r2 — remove_map 행·상층 출구·school 견본·벽면 걸이 겹침·공공시설 program (#3123) (`d98b243`)
- **battle** — keep the emerald enemy HP box solid while the enemy stands (#3121) (`bc6d02c`)

## 0.291.0 — 2026-10-20

### 기능

- **object-gate** — split to private repo MovieHolic-Plex/object-gate (vendored copy + sync) (#3117) (`88a451f`)
- **object-gate** — rules v10 seat backrest exemption + frozen fresh5 calibration (rejected) (#3119) (`72e507e`)
- **monster** — install user-picked crab stalk eyes A + scoped eye-stalk rule (#3118) (`0924b04`)

### 수정

- **flagship** — Astra temple boss and league lead 베르카부 swap the bug move for 새싹치기, like the gym leader (#3114) (`a9a8b54`)

### 정리

- **worldmap** — public oprn-worldmap-kit is the single master of the generator; drop the 700-file in-repo copy (#3116) (`a109107`)

## 0.290.0 — 2026-10-20

### 기능

- **interior-seats** — seat study 2 — 89 seats passed by the user (2026-10-20), waiting on 3/4 gate receipts (#3115) (`635077c`)
- **fallen-star** — rebuild act 1 — real journey, puzzles, boss, 1x opening, natural dialogue (#3111) (`6df4e06`)

### 수정

- **flagship** — Astra Horizon plays its real campaign — audit fixes (shortcut, fairness, story, people, UI) (#3110) (`a7b1476`)

### 잡무

- **monster** — record user pass verdict for all 60 species (round 6, hash-bound) (#3113) (`ce67df4`)

## 0.289.0 — 2026-10-20

### 기능

- **monster** — round 6 eye catalog — distinct eyes for all 60 species, redraw 4 failed species (#3108) (`a1ee935`)
- **object-gate** — human review page for held (refer) verdicts — signed allow/reject bound to pixel hash, profile and kind (#3101) (`014e07f`)
- **object-gate** — rules v9 + frozen fresh4 final calibration (still rejected) (#3100) (`6a1a55c`)
- **interior-seats** — 3/4·quality redraws of 89 seats as pending candidates (#3097) (`6e0ce53`)
- **puzzle** — 옛 퍼즐 넷(레버·얼음·시간·경비)을 방째로 다시 짓기 + 판자·심연·추·빙판 손 도트 (#3081) (`662de61`)
- **start** — library home — one hero, my-games/built-in/concept shelves, settings with AI engine (#3094) (`6dec642`)
- **monster** — 불합격 14종 5차 — 한쪽 눈 옆얼굴(먼 눈 숨김) (#3093) (`eac5c64`)
- **store** — character packs pair chips with portraits from char-gen (#3091) (`6570b87`)

### 수정

- **modern-city-int** — 관문 없이 머지된 실내 기물 142종 적대 재검수 — FAIL 92종 다시 그림 (#3109) (`3851ca9`)
- **build** — player artifacts back under the 64MiB secret-scan limit (#3106) (`90253ee`)
- **interior** — v5 props round 2 — independent adversarial Argon re-judge, 13 redraws baked, 8 held (#3104) (`cf7cf9a`)
- **start** — AI connect from the desktop home actually shows, and home reflects an existing Google login (#3102) (`441cc63`)

### 성능

- **startup** — lazy-load bundled tileset definitions — editor opens ~1s faster (#3103) (`dd46149`)
- **startup** — desktop home in ~1.4s — lazy project core, slim start-screen bundle, codeCache, close-save fix (#3095) (`39d189a`)

### 문서

- **interior** — props34 round 3 — 2-wide ship bunk candidate held at object-gate REFER, last cloth/candle attempts fail Argon 0/3 (#3105) (`de3b110`)

### 잡무

- **object-gate** — record the user's 4 hold allows (profile 1db03a95) — relic cabinet, ship bunk 2w, control console, helmet shelf (#3107) (`5fcb430`)

### 기타

- **ai** — 조수를 사용자의 로컬 claude -p 로 돌리기 (MCP 서버) — 병합 금지 (#3072) (`f7baaeb`)

## 0.288.0 — 2026-10-20

### 기능

- **store** — per-asset generation method so the AI label is accurate (#3090) (`8288a32`)
- **battle** — battle-feel r3 — enemy formation spaced by sprite bounding boxes, victory windows leave the party visible (#3088) (`25917dc`)
- **modern-city-int** — r16 quality redraw of 21 modern interior props that did not read (racks, tokonoma, witness stand, booths...), baked in place (#3086) (`9ba0a4e`)
- **monster** — 눈 판정 1차 불합격 14종 몸 전체 4차 손 도트 재그림 (#3085) (`5b7db9a`)

### 수정

- **interior** — v5 non-seat props 3/4 + quality re-judge — 17 redraws baked in place behind object-gate (#3087) (`eedc48f`)

### 잡무

- **modern-city-int** — list 142 redrawn props that still need a 3/4 gate receipt (#3089) (`9f8389d`)

## 0.287.0 — 2026-10-20

### 기능

- **modern-city-int** — r16 3/4 redraw of the remaining 60 interior props + review fixes, baked in place (#3083) (`e109f31`)
- **store-cli** — preview / submit / discard for private store scratch previews (#3082) (`47b9e5c`)
- **modern-city-int** — r16 3/4 redraw of 61 interior props (tops 4-6 rows, lit edge, cornice shadow), baked in place (#3080) (`e4bd293`)
- **battle** — battle-feel r2 — integer battler pixel scale, boss entrance, result over the stage, shorter interludes (#3079) (`9f8e6f6`)
- **store** — open-in-editor deep link (oprn://store/install) and owner drafts (D2) (#3078) (`3df019c`)

## 0.286.0 — 2026-10-20

### 기능

- **objectspec** — ObjectSpec v1 — one object manifest for tile-gen, store packs and editor kits (#3076) (`a7807ed`)
- **defaults** — recommended play screen 480x270 at zoom 1 with integer scaling + letterbox; Fallen Star 480x270 z1 (#3077) (`81ab73d`)

### 수정

- **monster** — 룬 둘러싼 부유 조각돌 2차 — 줄기 없이 도는 석판 조각·결정 핵·큰 대기 움직임·번쩍 금 가는 피격 (19차) (#3073) (`417f1bb`)
- **object-gate** — revert profile ee216f0de5822996 to rejected — blind pixel rule for beodeul U (fresh 29/42 = 69%) (#3069) (`f508f17`)

## 0.285.0 — 2026-10-20

### 기능

- **object-gate** — calibrate profile ee216f0de5822996 — front_prop out of the clean-pass denominator, label fixes (fresh 31/38, violations 0/84, adversarial 0/144) (#3068) (`6e29818`)
- **puzzle-sfx** — SNES sample-instrument puzzle SFX (ALttP-like), same ids (#3067) (`f86b8dd`)
- **battle** — battle-feel prototype — widescreen side-view stage, crisp hit flashes, bold damage numbers, less chatter, cast charge ring (#3063) (`c60f014`)
- **store** — one-command asset contribution path for coding agents (#3064) (`222dcbb`)

### 수정

- **monster** — 눈 판정 2차 불합격 15종 눈 3차 손 도트 + 걷기 칩 눈 잔상 정리 (#3066) (`980b473`)
- **monster** — 룬 둘러싼 부유 조각돌 전투 도트 다시 그리기 + (0,2) 스킬 칸 (18차, 140/140) (#3065) (`71d2593`)

## 0.284.1 — 2026-10-20

### 수정

- **jp-city** — ground autotiles treat out-of-map as same material; border-only migration for saved maps (#3061) (`3e17750`)
- **puzzle** — adversarial VQA r3 — Zelda-style puzzle SFX, push sound, readable states, no soft-lock (#3060) (`1d12069`)
- **monster** — 눈 판정 불합격 32종 눈을 손 도트로 다시 그리기 + 걷기 칩 눈 다시 찍기 (#3059) (`96e7bde`)

## 0.284.0 — 2026-10-20

### 기능

- **defaults** — new projects default to 640x360 internal resolution at zoom 1; Fallen Star 640x360 at zoom 2 (#3057) (`f896d72`)

### 수정

- **monster** — 우파루파 물 정령·뼈 무더기·카벙클·나뭇잎 정령·푸른 해룡·번개 정령·가면 정령·부유 검·잎날개 요정·적갈색 말벌·나무 토템 전투 도트 다시 그리기 + (0,2) 스킬 칸 (17차, 마지막) (#3055) (`10d65f8`)
- **modern-city-int** — wood floor A — stripe-free oak and brown walnut herringbone, in-place rebake of tiles 10240-10271 (#3032) (`97f1f91`)
- **jp-inaka** — R4 2nd-pass layout - meandering stream below stepping stones, bicycle off the pole column (#3052) (`f4d1973`)

## 0.283.2 — 2026-10-20

### 수정

- **monster** — 새끼용·그리핀·불새·삼두룡·와이번·코카트리스·동굴 박쥐·가시 거미·풀잎 여우·불꽃 도롱뇽 전투 도트 다시 그리기 + (0,2) 스킬 칸 (16차) (#3051) (`1f72df9`)
- **jp-inaka** — R4 VQA layout fixes - wire height, watchtower/pole overlap, terraces, stream, forest stagger (#3049) (`a58b645`)

## 0.283.1 — 2026-10-20

### 수정

- **runtime** — Animal #0 강아지 초상화 매핑 교정 및 최상위 플레이 모드(.player-layout.system-shell) 0px 그리드 열 붕괴 수정 (#3047) (`9fad138`)

## 0.283.0 — 2026-10-20

### 기능

- **puzzle** — 상태 공간 모형(BFS) 퍼즐 프리셋 20종 카탈로그 및 출하 플레이어 실기 QA 러너 (#3045) (`40523d2`)

### 수정

- **editor** — align tile paint, pick, and hover coordinates on relief terrain (#3044) (`85866f1`)

## 0.282.0 — 2026-10-20

### 기능

- **store** — 에셋 스토어 UX 전면 개편 — 1클릭 넣기/되돌리기·즉시 검색·3단계 나누기 마법사 (#3042) (`c1205ad`)

### 수정

- **monster** — 물고기·피라냐·번개장어·게·지네·전갈·사마귀·기생충·도롱뇽·육상 상어 전투 도트 다시 그리기 + (0,2) 스킬 칸 (15차) (#3041) (`00c48bf`)

## 0.281.1 — 2026-10-20

### 수정

- **flagship** — capture emerald-crown opening animatic and redraw side-view skybird sprites (#3039) (`5cf6333`)

## 0.281.0 — 2026-10-20

### 기능

- **flagship** — 『아스트라 호라이즌: 다우닝 시티와 여명의 날개』 몬스터 수집 대표 데모 개편 및 여명의 날개 새 칩·1F/2F 계단 연결 (#3037) (`cce6bbb`)

## 0.280.1 — 2026-10-20

### 수정

- **monster** — 말·유니콘·하피·거대 독수리·켄타우로스·사슴·산양·잭 오 랜턴·실 인형·갓파 전투 도트 다시 그리기 + (0,2) 스킬 칸 (14차) (#3035) (`0c3a043`)

## 0.280.0 — 2026-10-20

### 기능

- **monster** — hand-drawn eye-stalk candidates for the crab line, user pick pending (눈 규칙 판본 5) (#3030) (`29db9a7`)
- **store** — restore official-pack publishers behind env-only store addresses (#3029) (`503f6e6`)

### 수정

- **monster** — 코브라·골렘 2종·바위 유인원·꼬마 악마·코볼트·오거·식충 식물·마법사·허수아비 전투 도트 다시 그리기 + (0,2) 스킬 칸 (13차) (#3033) (`d7d27a6`)
- **monster** — table-driven eye repair for 49 species — erase old eyes, clip to body, round eyes per line (눈 규칙 판본 5) (#3028) (`ccd181e`)

### 문서

- **store** — document where the store pieces live, contract sync, exclusion and publishers (#3031) (`d3169b0`)

## 0.279.0 — 2026-10-20

### 기능

- **hand-interior** — pilaster open-plan wings, vestibule/notched rooms, wall-floor contrast guard (#3019) (`535dd98`)
- **hand-interior** — add architectural corridors and L-shaped notched rooms to facility layouts (#3018) (`5eb20b6`)

### 수정

- **monster** — 고양이 2종·은회색 늑대·불꽃 강아지 전투 도트 다시 그리기 + (0,2) 스킬 칸 (12차) (#3027) (`af4ffbd`)
- **store** — cap bundle inflation, re-verify cached blobs, tighten pack validation (#3025) (`f9d1ff4`)
- **monster** — 언데드 8종·고블린 장사·오크 전투 도트 다시 그리기 + (0,2) 스킬 칸 (11차) (#3024) (`1a9aea4`)
- **monster** — run eye checks on the shipped bundle and add per-species eye table checks V0-V8 (눈 규칙 판본 5) (#3023) (`8bf757c`)
- **store** — refuse third-party and store-bought items anywhere in a pack's closure (#3022) (`93170cf`)
- **monster** — 슬라임 6종·우즈 2종·해골·좀비 전투 도트 다시 그리기 + (0,2) 스킬 칸 (10차) (#3021) (`9eea1be`)
- **store** — restore concept import and real bundle size cap in Electron store client (#3020) (`b4477cf`)
- **editor** — resolve left sidebar rail, drawer, submode, and overlay state desyncs (#3016) (`c36b48b`)

## 0.278.0 — 2026-10-19

### 기능

- **flagship** — overhaul Flagship #1 into Fallen Star (폴른 스타: 추락한 별과 태엽의 성녀) Act 1 & 6-shot 2x pixel animatic opening (#3011) (`64c5adf`)

### 수정

- **hand-interior** — merge non-rectangular L/U/T rooms and resolve 84-facility VQA issues (#3015) (`1869d45`)
- **stamp-place** — replace misassigned door wall/signpost tiles with stone walls, real signboards, and seamless waterfall-bridge (#3013) (`2295806`)
- **jrpg-pilot** — build 3-tile east-west bridge collapse & record 8fps playback GIFs (#3012) (`973986b`)

## 0.277.0 — 2026-10-19

### 기능

- **export** — add Desktop & Steam Depot executable package builder and build studio modal (#3007) (`381ea37`)

### 수정

- **handInterior** — resolve R17 adversarial VQA defects across daily routine spaces (#3009) (`8461187`)
- **monster** — restore BW starter pixel art and upgrade all 60 species to #6/#7/#8/#10 standard (R13) (#3008) (`16b48f2`)

## 0.276.0 — 2026-10-19

### 기능

- **jp-inaka** — scale up keitora (4x2), red tractor (4x3), and Kiha diesel railcar (8x3) + curate rural showcase (#3005) (`a52ef1a`)

## 0.275.0 — 2026-10-19

### 기능

- **stamp-place** — support 4-turn progressive RPG worldbuilding and fix road/roof VQA defects (#3003) (`da7446f`)

## 0.274.0 — 2026-10-19

### 기능

- **puzzle** — expand catalog to 16 presets and implement 5-step rolling boulder motion (#3000) (`602c6a2`)

### 수정

- **monster** — redesign starter 3/4 anime eyes and refine 4 species eyes (R12) (#3001) (`8cb3d8b`)

## 0.273.0 — 2026-10-19

### 기능

- **jp-inaka** — organic jp_city-style showcase maps + de-gridded ground tiles (#2996) (`96f2477`)

### 수정

- **jrpg-pilot** — route blind judge through Argon proxy for 8/8 authentic pilot PASS (#2999) (`4627aee`)
- **handInterior** — remove duplicate TV in mc_house and enrich mc_department_store atrium/fashion (#2998) (`aad7e9e`)

## 0.272.0 — 2026-10-19

### 기능

- **jp-inaka** — Opus full redraw in jp_city 3/4 style + jp_city kit reuse (#2994) (`6873fc3`)

## 0.271.0 — 2026-10-19

### 기능

- **jrpg-pilot** — add Batch 2 stage scenes (jrpg_015, jrpg_019, jrpg_020, jrpg_060) and plaza/lava-bridge upgrades (#2993) (`c85ffb3`)
- **jp-inaka** — reuse existing jp_city trains/rail kits and earthen courtyards (#2992) (`de86c7c`)
- **jp-inaka** — add 30 Japanese countryside 3/4 kits, 9 rural ground tiles, and 6 showcase maps (#2988) (`e790370`)
- **stamp-place** — add 2-turn LLM refinement loop and all 22 Priority 1-3 fast-path tools (#2987) (`b6a9e01`)
- **puzzle** — three-wave unlock reveals with tile particles and shake (#2984) (`791b86b`)

### 수정

- **jp-city** — overhaul 30 Japanese regions with surface zone-map composer and V1-V6 hostile VQA gates (#2991) (`7589a8e`)
- **interior** — R15 orthogonal stairs/escalators; reuse the jp_city train car instead of a separate mc_train_car (#2990) (`0980fa0`)
- **monster** — restore 57 clean sprites and fix exact 3/4 eye positions (#2986) (`cdc7e29`)

## 0.270.0 — 2026-10-19

### 기능

- **stamp-place** — add 4 castle archetypes, relative dx/dy move, NPC dialogue & shop stamps (#2978) (`0936856`)

### 수정

- **handInterior** — extend WALL_ONLY_RE and fix remaining floating props in diverse-84 facilities (#2985) (`db47ca5`)
- **interior** — R14 redraw stairs/escalators as real 3/4 flights; door approach keeps two tiles so all 21 daily venues are walkable (#2982) (`96efafd`)
- **handInterior** — add WALL_ONLY assertion, south/east/west/counterLine verbs, and south-band props (#2983) (`072b4ba`)
- **forest** — 숲 주변 풀밭을 수관 색 단으로 옮기고 숲 테두리 이끼 치마·낙엽 - Opus 적대적 VQA (#2981) (`1b6a58c`)
- **puzzle** — build the 6 stage presets as full 20x15 single-tileset rooms (#2979) (`730ab26`)
- **handInterior** — overhaul 84 diverse facility furniture placement per hostile VQA (#2977) (`7efed3b`)

## 0.269.0 — 2026-10-19

### 기능

- **interior** — R13b jumbo centerpieces for konbini, lecture hall, officetel; house/office/sento/mart/hospital layout fixes (#2974) (`4408f68`)
- **interior** — R13 25 jumbo 3/4 top-view centerpieces (MRI, surgical rig, grand sento bath, perfume rotunda, seafood island, arcade stages...) appended after R11; placed in 17 daily-routine venues (#2973) (`2bbcc91`)
- **ai** — authentic JRPG pilot 4/4 PASS — biome-authentic scene stages and cutscene/lint fixes (#2971) (`f82fbf8`)

### 수정

- **monster** — upgrade 3/4 perspective eyes on starters and all 60 species (#2976) (`cbc9415`)
- **forest** — 버들항 낱 나무·덤불·생울타리·바늘잎을 숲 수관과 같은 화풍으로 다시 칠하기 (Opus 적대적 VQA) (#2972) (`50ff130`)

## 0.268.2 — 2026-10-19

### 수정

- **interior** — R12b Opus VQA - redraw dept escalators/luxury displays and west-facing train cab in place; dept fashion wing boutique alcoves, hospital 3F OR/ICU/imaging zoning (#2969) (`55dd8b1`)
- **jp-city** — unify 26 region kits to 3/4 top-view style and densify all 30 regional maps (#2968) (`ec73a64`)

## 0.268.1 — 2026-10-18

### 수정

- **interior** — R12 Opus hostile VQA - redraw R10 props (mart rewrite, sculpted mannequins, per-seat moquette, kotatsu, washer, beds, CT, OR, elevator) in place + hypermarket continuous aisle runs (#2966) (`e567b0b`)

## 0.268.0 — 2026-10-18

### 기능

- **stamp-place** — support river, hill/cliff relief, house, castle, battlefield corpses, and context-aware harmonize_region (#2963) (`b7c523c`)

### 수정

- **interior** — hostile VQA fixes across 18 daily-routine spaces (non-rectangular trims, furniture orientation, aisle spacing) (#2964) (`9fb2670`)
- **jrpg** — make puzzle solving dramatically transform multi-tile map structures (gates, bridges, rockfalls, stairs, portals) (#2962) (`6fac7f5`)

## 0.267.0 — 2026-10-18

### 기능

- **interiors** — 84 venues in 11 categories with non-rectangular footprints; west-facing train cab (#2961) (`7db58f6`)
- **flagship** — embed Chrono Bell & Emerald Crown as built-in default demo games across welcome, menu, launcher, and URL deep-links (#2957) (`2fd9bbb`)

### 수정

- **monster** — rename all 60 monster species to natural names and fix starter eye positions (#2960) (`5b8d884`)
- **forest** — 숲 수관 명암 고도화 - 햇빛·겹친 수관 그늘·빛줄기·숲 끝 실루엣 (Opus 적대적 VQA) (#2959) (`bac378d`)

## 0.266.0 — 2026-10-18

### 기능

- **flagship** — add playable Flagship Demos (Chrono Bell JRPG & Emerald Crown Monster RPG) + welcome showcase (#2956) (`1fc61fc`)
- **interior** — 50x50 3-floor stepped hospital, elevator cabin interior, and reused street vehicles (#2955) (`01e939b`)
- **jrpg** — add 12 puzzle presets catalog (list_puzzle_presets) and atomic puzzle authoring tool (author_map_puzzle) (#2953) (`c99fa3f`)
- **jp_city** — add formal 6-ramp color palette contract and 30 Japanese regions catalog & composer tools (#2951) (`9cba5ea`)

### 수정

- **forest** — 버들 마을 숲 수관을 겹친 나무 덩이(2×2 수관)로 다시 굽기 — 3모델 적대적 VQA (#2952) (`fc4e1ad`)

## 0.265.0 — 2026-10-18

### 기능

- **ai** — add 3-tier fast-path command ops (place/erase/move) and quest/event rejection guard with handoff UI (#2950) (`e203fe2`)
- **interior** — daily-routine 18 spaces right-sized + 150 new 3/4 top-view props (mart merchandise, dept boutique, subway car, cozy home, hospital/elevator) (#2949) (`f6431e2`)
- **monster** — 종 다섯 면 단일 정본 하네스 + qa-game 일관성 게이트 (#2948) (`cff581a`)
- **monster** — add 5-tool AI monster authoring & modification suite (inspect/edit/cellPatches/choreography) (#2946) (`81b8991`)

## 0.264.0 — 2026-10-18

### 기능

- **monster** — add in-editor 9-cell retro2003 monster pixel studio and author_enemy_pixel_sheet tool (#2945) (`c626cbe`)
- **jp_city** — shotengai covered arcade streets + mansion, monthly parking, market shops, jizo hokora (#2943) (`4cce899`)
- **ai** — #2673 follow-up - focus-framed hazard stages + walking survival branch (#2917) (`fe6f590`)

### 수정

- **interior** — R9 hostile VQA — contract-size seed variation via row plans for 18 daily venues, map-key program seeds, legacy preset palettes, bar-lounge bookcase misread (#2944) (`c817c68`)
- **monster** — 과부 거미·뿔 딱정벌레·화염 지네·가루 나방·모래 지렁이·병정개미·다이어울프·검치호랑이·거대 쥐·매 전투 도트 다시 그리기 + (0,2) 스킬 칸 (8차) (#2941) (`130e149`)

## 0.263.0 — 2026-10-18

### 기능

- **jrpg** — author_jrpg_chapter 기믹 — 동료 합류·선택지 퍼즐·회복 장치·아이템 잠금 출입구·입자 분위기 (#2937) (`85111fd`)

### 수정

- **editor** — 최근 100개 PR 감사 — 좌/우 사이드바·스튜디오·자료집 모달·도구 노출 HIGH/MED 일괄 수리 (#2940) (`27310d5`)
- **jrpg** — 천년제·나르셰 선택지 장치로 8/8 장 기믹 + 마르 dead page·scene_mood unreachable 경고 수리 (#2939) (`e9946ae`)
- **monster** — 드래곤 3종·타락 기사·타락천사·자수정 골렘·심해 오징어·베히모스 + 불·물 정령 전투 도트 다시 그리기 + (0,2) 스킬 칸 (7차) (#2938) (`0b82dee`)
- **blueprint** — 버들 마을 숲 수관 오토타일 + 강의동 좌·우 양 끝 계단실 (#2936) (`969e234`)
- **monster** — 정령 6종 전투 도트 다시 그리기 + (0,2) 스킬 칸 (6차) (#2934) (`7dd3113`)
- **monster** — 고대 드래곤·마왕(96) 전투 도트 다시 그리기 + (0,2) 스킬 칸 (5차) (#2933) (`fae8416`)

## 0.262.1 — 2026-10-18

### 수정

- **monster** — 몬스터 9종 전투 도트 다시 그리기 + (0,2) 스킬 칸 (4차) (#2931) (`5d31aee`)
- **ai-team** — 상태 줄 팀원 칩 → 조수 카드 + 우측 조수 상세 복구 (#2930) (`a91cb99`)

## 0.262.0 — 2026-10-18

### 기능

- **jp_city** — deep 3/4 roofs for shitamachi/shotengai streets, 7-row front kits, wider alley stair (#2924) (`4c8c1df`)
- **modern_city** — animated street objects — signals synced to TRANSIT_SIGNAL, rail crossing gates, roadwork arrow boards, taxi stand, delivery scooter, emergency beacons (#2923) (`8376e57`)
- **interior** — 30 modern/Japanese venue presets, 40x25 department store, ceiling inner-corner tiles, redrawn subway fare gate (#2921) (`bc89edd`)
- **jp_city** — shitamachi/shotengai — calmer warm ground, edge lines, warm zebra, side curbs, 2-storey front kits (#2919) (`1e5a3f1`)
- **jrpg** — author_jrpg_chapter — 크로노 트리거·FF6 한 장(거점·갈래 맵·NPC·퀘스트·사건·시간의 문)을 기존 구성기로 짓는다 (#2918) (`ec9701d`)

### 수정

- **monster** — 몬스터 10종 전투 도트 다시 그리기 + (0,2) 스킬 칸 (2차) (#2922) (`b544f7c`)
- **editor** — AI 참고 청사진 VQA 18회차 — 로비 방 문·정문 표시·라운지 간격, 백화점 에스컬레이터 상하행 쌍 중앙 배치, 강의동 계단실(1F↔2F) (#2915) (`0d790cb`)

## 0.261.2 — 2026-10-18

### 수정

- **jrpg,map-variant** — JRPG R6 — 한 고장 분량 넓히기(expand_jrpg_campaign_volume) + 시대 조명 새기 수리 (#2914) (`5b1b39d`)
- **dialogue** — 양쪽 전신 베일 프리셋을 1024×768 네이티브 고해상도 무대로 자동 승격하고 대화창·선택지 UI 스케일링 적용 (#2907) (`c0b43f6`)

## 0.261.1 — 2026-10-18

### 수정

- **editor** — AI 참고 청사진 적대적 VQA 후속 — 강변 공원 남쪽·부두, 알현 회랑 청사진, 설원 마을 형태 요청 반영, 버들 잔디 부스러기 감소 (#2912) (`09732e8`)
- **jp_city** — shitamachi/shotengai rear row sized to band — no empty brick slab behind front shops (#2911) (`5997788`)

## 0.261.0 — 2026-10-18

### 기능

- **jp_city** — shitamachi/shotengai rear row of houses + back alley instead of roof-sea kits (#2909) (`6dc1f64`)

### 수정

- **interior** — R6 hostile VQA — fill 7 venue presets with dedicated props, remove bookcase-like bar shelf (#2908) (`5dacc44`)

## 0.260.0 — 2026-10-18

### 기능

- **jp_city** — shitamachi/shotengai roof sea and merged 45° ground shadows (#2899) (`275fc20`)

### 수정

- **database** — 세계·지역 기본 예시 지형을 worldmap_selected 로, 타일 탭 20초 멈춤·목적 띠 수리 (#2906) (`95518fa`)
- **jrpg,opening,map-variant** — JRPG R5 반려 — 타이틀·오프닝 분할 화면 스틸 금지 + 시대 변형 마을 땅·숲 전면 변환 (#2905) (`5f29e48`)
- **monster** — 새싹토·숲지기토 도트 + 스타터 미리보기 카드 + 새순 체육관 덩굴 나무 문 퍼즐 (#2904) (`7d8089e`)
- **monster** — 몬스터 8종 전투 도트 다시 그리기 + (0,2) 스킬 칸 (#2903) (`cbb27b2`)
- **romance,dialogue,ending** — 연애 R6 반려 4대 결함 — 중세 왕 칩 폴백 배제·현대 초상 도트 그림체 잠금·양쪽 전신 시선 마주 봄·이미지 엔딩 CG (#2894) (`834b3ea`)
- **interior** — 상행·하행 계단·에스컬레이터를 같은 문틀의 짝으로 바깥 북벽에 나란히 두고 측면 에스컬레이터·바닥 계단 홀 폐기 (#2901) (`1edc300`)
- **modern_city** — 랜드마크 맵당 1채·공원 자리 씨앗 분산·맨 아래 길가 녹지 띠 (바로 깔기 적대적 VQA R6) (#2900) (`3586cdc`)

## 0.259.0 — 2026-10-18

### 기능

- **editor** — AI 참고 청사진 2차 — 백화점 청사진 구성기, 강 굽이·남쪽 구획 난수, 마을 기후 읽기 (적대적 VQA 4~7회차) (#2896) (`7d6f36d`)

### 수정

- **riverside** — 강변 이름 jp_city 맵의 맨 위를 강물로 덮던 정비를 modern 칩셋에만 돌린다 (#2898) (`791f9ae`)
- **interior** — keep wall-flush stairs/escalators off room partitions in 7 venue presets (#2897) (`631a221`)
- **modern_city** — 3/4 top-down N/S vehicle art + don't-block-the-box junction rule (#2893) (`9fe8197`)
- **modern_city** — 바로 깔기 현대 도시의 가로 도로 위치를 씨앗마다 바꾼다 (#2892) (`0618a8c`)

## 0.258.2 — 2026-10-18

### 수정

- **jrpg,opening,map-variant** — JRPG R5 1줄 생성의 #2852 6샷 도트 애니메틱 오프닝·시대 지형 잔상·동료 스탯 분화·자동플레이 수리 (#2890) (`201c0c3`)

## 0.258.1 — 2026-10-18

### 수정

- **database** — 자료집 전 탭 크롤 수리 — 공용 얼굴 대응표·세계 탭·자동 연결 레이아웃·장소 갤러리 (#2888) (`a33950d`)

## 0.258.0 — 2026-10-18

### 기능

- **jp_city** — shitamachi alley & shotengai arcade street variants (#2886) (`a2c3486`)
- **studio** — drive the Director Board from live project data instead of canned demo content (#2881) (`5180526`)

### 수정

- **monster-taming** — resolve R5 Pokemon 1-line VQA & QA check defects (#2887) (`ba144b2`)
- **interior** — wall-flush side escalators/stairs and impassable subway track for 7 venue presets (#2884) (`ba1d284`)

## 0.257.0 — 2026-10-18

### 기능

- **editor** — AI 참고 청사진 — 수동 프리셋 버튼 철거, AI 가 청사진을 참고해 매번 새로 짓기 + 적대적 VQA 3회 고도화 (#2882) (`adefd95`)
- **ai** — add live 4-stage pipeline header and rich minimap/inspector tool telemetry cards (#2879) (`ff24ceb`)

### 수정

- **dialogue** — 양쪽 전신 베일 프리셋의 과한 장식 UI를 제거하고 대화창 높이를 슬림하게 조정 (#2880) (`6798826`)
- **monster** — redraw 칼날 사마귀 battle sheet with real mantis anatomy and 9 distinct poses (#2878) (`499bf95`)

## 0.256.0 — 2026-10-18

### 기능

- **studio** — reinvent Studio Mode center stage as Genre-Adaptive Storyboard & Director Board (#2875) (`75602b2`)
- **editor** — expose 20-preset Space Preset Gallery with parametric A/B/C/D variants in New Map modal and Left Sidebar (#2874) (`666abbc`)
- **transit** — tram and subway in set_street_traffic, stop-approach easing (#2872) (`365c6fa`)
- **dialogue** — 양쪽 전신 베일 프리셋을 고해상도 오토메 일러스트·미디엄 풀샷·상단 장미 필리그리·페이드 베일로 고도화 (#2870) (`7086f21`)

### 수정

- **modern_city** — one-engine 1:1 vehicle art for all four directions (#2877) (`0842367`)
- **ci** — align the studio director board with command and map-link types (`c211eaf`)
- **ai** — repair right AI assistant panel layout, model presets, and tool loop UX (#2871) (`13f25f1`)
- **interior** — bake orthogonal stairs & 7-venue props and resolve hostile VQA across 7 presets (#2867) (`f805359`)
- **modern_city** — right-hand lane-centred traffic, signalled junction turns, equal-length 3x2/2x3 sprites (#2869) (`27063cc`)
- **stamp-place** — 바로 깔기가 장소 한 장 요청을 기존 장면 구성기로 짓고 부를 때마다 다른 씨앗을 쓴다 (#2868) (`e9d4fd2`)

## 0.255.1 — 2026-10-18

### 수정

- **stamp-place** — 3-round adversarial visual QA repairs for town, city, and dungeon worldbuilding (#2864) (`774d4e5`)
- **ci** — record the dual-fullbody veil text style in event surfaces (`305ae99`)

## 0.255.0 — 2026-10-18

### 기능

- **modern_city** — add moving & 90-degree turning street traffic and set_street_traffic tool (#2861) (`c843bfd`)
- **interior** — add 7 multi-zone commercial/public interior presets and 10 3D stairs & department-store props (#2860) (`aa20f14`)
- **dialogue** — 양쪽 전신 베일 프리셋에 좌하단 발화자 초상 추가 및 기본 7.5~8등신 비율 적용 (#2859) (`14d6869`)
- **dialogue** — 연애·오토메 양쪽 전신 스탠딩 + 반투명 베일 대화창 프리셋(dual-fullbody-veil) 추가 (#2855) (`758facc`)
- **stamp-place** — support town, city, and dungeon worldbuilding end-to-end (#2854) (`e4fb506`)
- **opening** — AI 조수가 레이어드 도트 애니메틱 새로하기 오프닝을 저작 (#2560 대체) (#2852) (`52fc263`)

### 수정

- **opening,battle,jrpg** — 한 줄 게임 생성의 #2852 도트 애니메틱 오프닝 배선·픽셀 렌더러 결함·전투 4인 HUD 겹침·시대 변형 맵 지형 변환 수리 (#2863) (`a901e92`)
- **portraits** — 인위적으로 왜곡된 현대 전신 초상 120장을 원본 비율로 복원하고 좌하단 화자 초상 유지 (#2862) (`a327110`)
- **ci** — type the dungeon paint steps and jp house presets (`e8fecc6`)
- **editor** — preserve relief side panel across palette tab switches and polish left sidebar UX (#2857) (`ed003ed`)
- **store** — add OPK1 single-bundle streaming, reuse bundled reference URLs, and inline ref assets on .oprn export (#2856) (`8109a96`)
- **qa,battle** — strip system intent note in jrpg gates, retry secondary endings with companions, and fall back onField battle backdrop (#2853) (`7e5f412`)
- **romance,interior** — flush wall elevators, multi-zone office/campus presets, and 4-row riverside promenade (#2851) (`7b0aa71`)
- **stamp-place** — 바로 깔기 place_house — 장식 터 비우기·jp_city 건물·거절 사유 유지 (#2849) (`5a82a24`)

## 0.254.0 — 2026-10-17

### 기능

- **start** — 플레이 · 만들기 2모드 런처 껍데기 및 내 월드 바로 플레이 (1단계) (#2847) (`d35b56d`)
- **ai** — build_scene_setting stages event scenes; irregular terrain, bank overlays, hazard lint (#2673) (`0b4ed4a`)

### 수정

- **dialogue,romance** — drop the VN reading bar and gate untouched openings (#2848) (`78bc34f`)
- **ci** — drop unused scene-layout and tint-lint bindings (`5872bae`)

## 0.253.0 — 2026-10-17

### 기능

- **database** — 시스템 탭 구획 목록 · 폼 격자(R2) · 스위치(R3) 정리 (PR-5) (#2842) (`4f7f039`)

### 수정

- **ci** — record the portrait-bottom notice in the event text surface baselines (`f7a089a`)

## 0.252.0 — 2026-10-17

### 기능

- **database** — 장르 프로필 접기 — 「숨긴 탭 N개 · 모두 보기」 (PR-4) (#2841) (`f8de82e`)
- **database** — 6그룹 재배치·소제목·「게임 설정」 라벨 (PR-3) (#2838) (`acdc802`)

### 수정

- **ci** — record the menu note and search crumb classes as unstyled (`cf16020`)

## 0.251.2 — 2026-10-17

### 수정

- **database** — 메뉴 감사 부록 A 시각 깨짐·잘림 9건 수리 (B1~B9) (#2837) (`0258a79`)
- **qa** — ignore unreachable retired seed map and flag pre-populated JRPG companions (#2835) (`031ed9a`)

## 0.251.1 — 2026-10-17

### 수정

- **qa** — 사물 이름 NPC 에 사람 캐릭터 칩·흉상이 붙으면 완료 경고 romance-object-npc-bust (#2834) (`c83e7a2`)
- **editor** — strip speaker echo from dialogue body in eventCompile (#2833) (`8158170`)
- **dialogue** — 읽기 단추 줄이 왼쪽 흉상을 가리지 않게 (#2831) (`b592861`)

## 0.251.0 — 2026-10-17

### 기능

- **database** — wayfinding — section-word search, 3-level crumb, recent tabs (#2829) (`77d3f0e`)
- **dialogue** — 흉상·전신 초상이 있는 대사는 대사창을 항상 아래로 (#2828) (`73c179a`)

### 수정

- **jrpg** — seed-harbor gate names a path the assistant can take (new map + set_start_position) and only checks maps reachable from the start (#2830) (`a737c98`)
- **qa** — identical-stats check survives a vehicle actor joining the party (#2822) (`0404905`)
- **romance** — retire the unreachable generic happy ending once per-heroine endings exist (#2826) (`360b5d2`)
- **qa** — title-art setting check reads title/subtitle/map names when there is no design brief (#2824) (`767a1bd`)
- **qa** — autoplay ending goal accepts any ending after an auto-select triggerEnding (#2823) (`745206d`)
- **ci** — record three new charset chips in the event graphic surface baselines (`8f890d1`)

## 0.250.0 — 2026-10-17

### 기능

- **editor** — 자료집 「메뉴·시스템」 탭 — ESC 메뉴·대사창·갤러리/엔딩/저장 카드 한 화면 저작 (미연시 3단계) (#2808) (`6c70448`)

### 수정

- **ci** — record the visual-novel look and gallery backdrop in the CSS gates (`20bb7aa`)
- **romance** — unique ending ids for non-ASCII heroine ids, keep the happy tier called, duplicate-chip check groups by characterId (#2818) (`57fbafe`)

## 0.249.0 — 2026-10-17

### 기능

- **romance** — finish gate flags one heroine placed under different characterIds per map (#2815) (`6919a26`)
- **dialogue** — VN look presets — 8 dialogue-window skins, nameplate/choice/wait styles, font settings, ESC menu theme, set_vn_look (#2816) (`a14870e`)
- **ai** — create_time_gate 그림 없을 때 빛 표식 (#2776) (`b8c5a41`)
- **jrpg** — 역할별 능력치 곡선 경고·관문 + 요청 규모(비공정·붕괴 전후) 관문 (#2797) (`bb3af1b`)

### 수정

- **vn** — 미연시 수리 — 기기 단위 엔딩·CG 기록, 엔딩 목록 스크롤, 체크리스트·도구 경계 (vn-review-2) (#2819) (`994c36b`)
- **ai** — 시대 변형 철거 덧그림 제거 + 전투 배경 지명 단계 (#2775) (`caf2e0c`)
- **ai** — JRPG finish gate requires joining companions when the request promises them (#2805) (`15ab404`)
- **ai** — JRPG finish gate also blocks an unplayable first segment and the untouched seed fishing village (#2804) (`e0820b8`)
- **dialogue** — bust no longer narrows the text; centre-window head fits; right-bust bar clears the nameplate (#2814) (`d21c91c`)
- **ai** — stronger era-variant looks (ruin/past/future) and no rubble on water (#2798) (`dbe4f7e`)
- **battle** — skill/item list widens leftward under actor/keys/fan look presets (#2800) (`0e47a66`)
- **title** — force title line-height so a two-line title cannot cover its subtitle (#2796) (`e13d506`)

## 0.248.0 — 2026-10-17

### 기능

- **romance** — per-heroine deadline sync (place_npc, team finish) + heroine-endings-uncalled check (#2811) (`daf133b`)
- **ai** — reverse hard lock for monster-collect assets outside monster projects (#2812) (`2e28092`)

### 수정

- restore #2783/#2789/#2794 and v0.245.0 notes reverted by #2802 (#2810) (`11a09a8`)

### 문서

- **harness** — 미연시 추가 화면 실조수 시험 미검증 2문장을 재시험해 5/5 통과로 확정 (#2807) (`c27f943`)

## 0.247.0 — 2026-10-17

### 기능

- **charset-actor** — ScarloxyPeople11~13 — char-gen gallery 4 script mixes, 22 monster-world people chips (#2806) (`07e820a`)

## 0.246.0 — 2026-10-17

### 기능

- **vn** — stage 2 - gallery lock display and ending recall, ending checklist, save-card scene line (#2802) (`c919c0f`)

### 수정

- **ci** — record the dialogue bar and retro skill-list layout in CSS winners (`5801ee9`)

## 0.245.0 — 2026-10-17

### 기능

- **romance** — set_deadline_ending builds a per-heroine ending tier when tiers is omitted (#2794) (`cdf3622`)
- **romance** — finish gate flags endings aimed at a heroine whose affection can never rise (#2789) (`1b2f797`)
- **romance** — 소재별 연애 타이틀 키아트(카페·학원·회사·마을) + 소재 불일치 완료 검사 (R1-06) (#2783) (`a888468`)

## 0.244.2 — 2026-10-17

### 수정

- **battle** — walk-chip sheet set as battle sheet no longer renders a crowd (#2793) (`b4d30c8`)
- **battle** — retro2003 skill list uses full-width host and Korean element badges (#2773) (`de086ef`)
- **ai** — JRPG completion gate also applies to chat-line requests (balance, opening) (#2774) (`0e9ddf5`)
- **ai** — intent notes no longer count as monster-game signals (FF6-style request hijacked into a Pokemon campaign) (#2784) (`ac799cb`)
- **dialogue** — reading system adversarial-review repairs (D1-D8, D11, D12) (#2792) (`9d337d2`)

## 0.244.1 — 2026-10-17

### 수정

- **ci** — record the visual-novel reading colors in the CSS budget and winners (`51f3573`)
- **ci** — record the extra face-option nodes in the event surface baselines (`94e926b`)

## 0.244.0 — 2026-10-17

### 기능

- **dialogue** — 미연시 시스템 UI 1단계 — 백로그·오토·스킵·숨기기·설정 (#2782) (`2d3bb78`)

## 0.243.1 — 2026-10-17

### 수정

- **ci** — record the hanging portrait dialogue layout in CSS winners (`076750c`)

## 0.243.0 — 2026-10-17

### 기능

- **portraits** — paired bust and full-body portraits for the remaining 12 modern romance chips (#2777) (`f30e20d`)

### 수정

- **romance** — 동사 없이 소재만 적은 연애 게임 요청도 완료 검사를 받는다 (R03 재발) (#2781) (`0bea0ae`)
- **romance** — 기한 엔딩의 기본 결말이 조건 달린 엔딩이면 거절·검사 (아무도 안 만나면 끝나지 않던 구멍) (#2780) (`c7d28af`)
- **dialogue** — 위쪽 대사창의 흉상·전신 초상이 화면 밖으로 잘리던 것을 상자 아래로 매단다 (#2779) (`4cd0b37`)

## 0.242.2 — 2026-10-17

### 수정

- **jrpg** — 필드 HUD 클래식화(J09) + 전투 균형 완료 게이트(J06) (#2769) (`3441e8e`)
- **romance** — 남은 결함 R04/R07/R10/R14 + 429 자동 재시도, R12 재현 불가 확인 (#2768) (`6a91e9b`)

## 0.242.1 — 2026-10-17

### 수정

- **ci** — record new faces, chips, audio, and badge conditions in surface baselines (`3a22527`)

## 0.242.0 — 2026-10-17

### 기능

- **charset-actor** — remake the 12 first-round script people chips with Argon partial edits (11 replaced, 1 kept) (#2763) (`69639de`)

### 수정

- **ci** — record the runtime HUD and capture colors in the CSS gates (`52a90d1`)

## 0.241.0 — 2026-10-16

### 기능

- **romance** — 호감으로 갈리는 엔딩 셋 + 호감 변수 통일 (romance-real-2 R01/R02) (#2760) (`385d223`)
- **portraits** — paired bust and full-body portraits for 12 modern romance chips (#2759) (`23dd38a`)
- **ai** — JRPG 완료 가드 + 429 로 끊긴 배정 되돌리기 (jrpg-real-1 J04/J05) (#2752) (`07998ea`)
- **ai** — derive_map_variant gives each era variant a visible look (light tint, fog, demolished buildings, ruin/camp props) (#2744) (`7dd8937`)
- **ai** — JRPG hero/party charset search puts Heroes1 (CT·FF6 hero chips) first and tells the assistant to use it (#2740) (`2007d38`)

### 수정

- **romance** — HUD 가 지도·실내 위쪽을 덮지 않게, HUD 이름 짧게 (R06/R09) (#2762) (`0e44f1d`)
- **romance** — 제목·부제 완료 게이트(채팅 한 줄 경로 포함), 제목 그림 잠금, 긴 제목, 엔딩 작은 줄 (R03/R05/R08) (#2761) (`a955c43`)
- **battle** — 맵이 전투 배경을 정한다 — 던전 숲 배경(J08), 상자 대사 조사(J10) (#2755) (`c929a64`)
- **player** — title text/subtitle fit the 320px stage; dialogue pages re-split when the real body is narrower (jrpg-real-1 J05/J07) (#2751) (`b4ff6ec`)
- **player** — screen-distortion shader no longer redefines SHADER_NAME; failed shader compile skips the effect instead of freezing the screen (#2739) (`d4325bf`)

## 0.240.0 — 2026-10-16

### 기능

- **charset-actor** — 몬스터 세계 사람 칩 2차 — ScarloxyPeople5~10 45종 (Argon 36) (#2743) (`d675d91`)
- **monster-art** — cute-first judging, white-highlight-preserving pixelization (rules v4), 15 default monsters redrawn (#2754) (`57eef00`)

### 수정

- **charset-actor** — ScarloxyPeople5#6 선장·흰 선장 모자 제외 — 칸을 비워 두고 명단·카탈로그에서 뺌 (44 → 43종) (#2757) (`9eaccf3`)

## 0.239.3 — 2026-10-16

### 수정

- **monster** — lab professor chip matches the opening bust; gym leaders field distinct species with a higher-level ace (D34, D35) (#2749) (`e36db26`)
- **genre-lock,ai** — clear RTP hero battler under the monster lock; four monster-intent sentences turn on the kit (lock leak, routing) (#2748) (`a9363e0`)

## 0.239.2 — 2026-10-16

### 수정

- **player,menu** — blackout uses the dialogue-window skin and recovery centre; bag footer duplicate removed (D31, D32) (#2747) (`ab7dd2c`)
- **player** — empty-party battle admission goes through the game dialogue window once (D30) (#2746) (`a6ae44e`)
- **player** — title resume and load-panel focus follow the newest save (manual or auto), not always the autosave (D29) (#2745) (`b38ab2c`)

## 0.239.1 — 2026-10-16

### 수정

- **monster-art** — eye rules v3 and 15 default monsters redrawn (judge-picked) (#2741) (`860cecd`)

## 0.239.0 — 2026-10-16

### 기능

- **monster** — opt-in natures and EVs (monsterStatRules), evYield, summary nature row (#2732) (`49c4bd1`)
- **monster** — say why running is blocked; expSplitAlive 3rd-gen exp split (opt-in); result text names every participant (#2729) (`c089808`)
- **battle** — skill rule vocabulary — fixed damage, random multi-hit, recoil, flinch (#2736) (`f6ee6ea`)
- **player** — mouse/touch input, portrait layout and emerald loading screen for monster games (D15 D16 D25 D27) (#2734) (`ca033b9`)
- **monster** — Scarloxy People 변형 사람 칩 25종(ScarloxyPeople1~4) — 스크립트 21 + 실 Argon 4 (#2733) (`bb91f4c`)
- **romance** — modern chips under the genre lock, relationship ESC menu, romance skeleton + finish gate, HUD names/panel, project-wide chip spread (#2731) (`df5f357`)
- **monster** — level-up learn/forget scene + stop falsely saying 배웠다 (#2724) (`1044a82`)
- **monsters** — nickname rename input, gender, shiny marker; fix party rows overlap after 18px font (#2730) (`3ca1a34`)
- **monsters** — starter confirmation (preview + type + note + yes/no) and save-slot summaries (dex/badges/party), emerald load panel (#2727) (`d86e5e2`)
- **monsters** — PC 보관함 상자 화면 (30칸 상자·옮기기·놓아주기·필드 PC) (#2725) (`571d860`)
- **monster-opening** — generated professor bust replaces the chip-on-pedestal intro (#2720) (`0850a0a`)
- **monster-sfx** — 26 more original chip sounds (evolution, badge, items, status, weather, field) wired to monster projects (#2716) (`2d3dcfb`)
- **monster** — badgeCount condition, place_badge_gate tool, original-style obedience level caps (#2713) (`efe771d`)
- **monster** — wild encounter guard — flee grace steps, repel, escape rope, fishing flow (#2712) (`f8863bc`)
- **ai** — place_npc warns when the same walk chip becomes the third on a map (monster-lock variety prep) (#2722) (`315d63c`)
- **monster** — HM end-to-end — badge gating, examine 'use it?' prompt, giver chest, proven in the shipped player (#2708) (`f9cd137`)
- **charset** — modern romance chips Modern1-3 (24 chips: uniform/casual/suit/cafe/teacher) (#2723) (`b91bc77`)
- **monster** — field item use (revive/PP/rare candy/evolution stone) + bag pockets (#2707) (`60e4760`)
- **monster** — bundled trainer battle art for campaign trainers + place_trainer auto-assign (#2706) (`e334a7b`)
- **monster** — gym badge ceremony recipe (flash, jingle, rising bundled icon with glow), badge-case icons, configure_monster_campaign {badgeCeremony} (#2701) (`835b6f5`)
- **runtime** — pixel grid contract - integer monster display, Galmuri9 18px, integer window (D12 + D08 part) (#2711) (`a724e2d`)
- **monster-ui** — dex without campaign, paged detail, habitat line, progress meter, even list rows (#2714) (`ab397f0`)
- **monster** — open-purse mart + center heal ritual (place_monster_center) (#2705) (`789a147`)
- **battle** — capture throw shows the hero, dex registration line, stronger shake, varied failure lines (poke-sys 7) (#2704) (`b588667`)
- **monster-art** — design v2 - signature/chibi/silhouette rules + 15 species redrawn on the 64px grid (#2710) (`8d37923`)
- **monster-ui** — party swap order, paged summary, clipped-icon fix, held-item badge (#2700) (`04be155`)
- **qa-game** — romance conformance warnings for qa:game check (#2698) (`ad48191`)
- **qa-game** — gen --compat-base runs the real assistant path on an OpenAI-compatible endpoint (Argon via 8318) (#2687) (`5224d19`)
- **ai** — everyday-place BGM rule (campus/classroom/cafe/office) + auto BGM for new modern interiors + romance start map BGM (#2695) (`201df1e`)
- **monster** — spread campaign NPC faces by role over the genre chips, never the player chip (poke vqa D02) (#2693) (`6cb22d6`)
- **monster** — bundled trainer pictures on every campaign trainer troop (poke vqa D03) (#2690) (`ec7425a`)
- **monster-sfx** — original chip-synth default sound set for monster-collection games (15 cues) (#2697) (`ad718cf`)
- **ai-ui** — 작업 목록 하나로 — 드래그·팀·바로 깔기·이벤트·대화를 한 목록에, 렉 없이 (B안 2단계 안 A) (#2696) (`1b8eefb`)

### 수정

- **ai** — repair broken string literal in toolCapabilityIndex (#2736 merge left a stray quote before SKILL RULES) (#2738) (`0b3f277`)
- **battle-ui** — stage pills, long-name ellipsis, fainted box, lists, emerald ending hall of fame (D04 D13 D17 D20-D24 D26 D27) (#2735) (`9f79af1`)
- **monster-opening** — lift the introduced monster so the whole sprite shows above the dialogue window (#2728) (`26459a1`)
- **monster-opening** — put professor, introduced monster and dialogue window on the 2px dot grid; tidy bust to monster style (#2726) (`5e194b4`)
- **ai** — cutscene stage/impact tools pick the hero chip from the genre lock's allowed chips (monster-collect: Scarloxy people), not only RTP Actor1~4 (#2721) (`3245ee0`)
- **genre-lock** — late-added charsets, default roster and follower/party actors settle to allowed chips (#2719) (`58aec4b`)
- **ai** — first monster-only tool call on a blank new project opens the monster kit and locks the genre; place_npc graphic accepts resourceId (#2718) (`9daff09`)
- **ai** — monster-intent dictionary so gym-hopping, tamer, collection-RPG, pet-raising, Digimon, pocket-monsters-clone and /goal monster goals turn the monster kit and lock on (#2717) (`c9f04a7`)
- **ci** — treat missing event pages as no romance NPC graphic (`486fb1f`)
- **ai-settings** — Argon preset turns image input on (reference gate needs delivered pictures) (#2694) (`d2fe38e`)
- **ai** — define_ending no longer warns 'unreachable' for named endings; build_hand_interior_room floor/wall optional when layout/rooms given (#2692) (`3ed617b`)
- **monster** — campaign creation names the game instead of keeping the blank-project default title (poke vqa D05) (#2691) (`a44ea62`)
- **ci** — record the work-list colors in the CSS budget and winners (`c7aec81`)
- **ci** — record the settings cards and world chip bar in the CSS gates (`f76a7c7`)

### 문서

- **openwiki** — double battle (2v2) design memo — current state and staged plan (#2737) (`02e12ee`)

## 0.238.0 — 2026-10-16

### 기능

- **ai** — monster-collect genre lock covers faces, monster battlers, trainer art and battle backdrops (#2688) (`515e4be`)
- **world-ui** — compact codex — property rail replaced by chip bar, one-line stats (2/2) (#2686) (`83f47a9`)
- **ai-settings** — image section as two use-cards (picture / pixel), details folded (#2685) (`3b9174a`)
- **ai** — HM obstacle detour check + span/fullWidth, define_monster_families ability/ids, scene-test HM prerequisites (#2681) (`76c3dc1`)
- **ai** — monster-game guidance, routing and find_tools aliases for battle-depth features (#2678) (`058ca94`)
- **romance** — 2nd repair - multi-person loop, deadline-ending autoplay in qa:game check, social NPC defaults (#2677) (`5d130eb`)
- **romance** — campus-spring rooftop sunset as the romance default title (candidate C) (#2676) (`ec568d8`)
- **genre-lock** — lock character chips to the monster family + thin genre marker (#2683) (`eb86e6e`)
- **charset** — install pick-6 adopted 8 CT/FF6-style hero chips as bundled sheet Heroes1 (+ charset-actor Argon part-edit harness) (#2682) (`74aa0d0`)
- **genre-lock** — monster-collect lock is the default for projects that start as monster collection (#2675) (`b02bbf7`)
- **ai** — route image purposes per 2026-10-16 decisions; single-shot pixel art by the pixel text model (#2674) (`ea393a5`)

### 수정

- **ci** — clear the genre-lock typecheck failures (`623835e`)
- **monster** — 3-gym champion balance + fishing monster encounters (poke audit #7, #9) (#2684) (`5671405`)
- **ai** — narrow the dot-text surface when resolving an image route (`c7bf93c`)

## 0.237.1 — 2026-10-16

### 수정

- **ci** — record world-panel and battle-pill CSS in the gates (`c26e89a`)

## 0.237.0 — 2026-10-16

### 기능

- **battle** — conditional capture balls (type/first-turn/turns/repeat) + caught-ball record, menu row, assistant tool (#2667) (`4a4bbbd`)
- **battle** — 포켓몬식 지닌 도구 — 열매·강화·버티기·재생 (#2665) (`1c05e58`)
- **battle** — species abilities (seven declarative kinds) for the gen1 battle model (#2660) (`ebb2113`)

### 문서

- **object-gate** — remove stray merge-marker line (#2669) (`a586adf`)

## 0.236.0 — 2026-10-16

### 기능

- **battle** — badly-poisoned (toxic) and confusion for the gen1 battle model (#2657) (`1a45c1b`)
- **battle** — pokemon-style stat stages (-6..+6) with HUD pills, assistant tool and docs (#2655) (`139e0c1`)
- **battle** — weather — sun/rain/sandstorm/hail skills, damage mods, residual, badge, assistant tool (#2666) (`882947e`)

## 0.235.0 — 2026-10-16

### 기능

- **romance** — daily social loop (slots + per-person cap), deadline ending tool, place_npc strict keys, romance defaults + genre lock + heart HUD (#2664) (`47f2388`)
- **romance** — interview stage opens on a composed modern campus/city; first-meeting stage designation replaces one-map rule (#2654) (`6ea8127`)
- **world** — 세계관 노션식 통합 1단계 — 문서 용어·카드 AI 공개 범위·「AI가 읽는 것」·연결 자동 완성 (#2661) (`cc7b272`)

### 수정

- **qa-game** — autoplay plans friendshipAtLeast gates, follows NPC schedules, and sleeps through onDayEnd day locks (romance false blocks) (#2663) (`0acbadd`)
- **ai-ui** — 드래그 검토 입구·팀 레인·접힌 도크 개수 복구 (B안 1단계 보정) (#2662) (`62e3f41`)
- **ci** — record the assistant presence hide rules in the CSS gates (`0675a70`)

## 0.234.0 — 2026-10-16

### 기능

- **ai** — split image settings by purpose — generative image model vs dot-authoring text model (#2656) (`66aecb8`)
- **object-gate** — front_prop human approval record exempts the 3/4 half only for approved pixel hashes (#2653) (`69d5877`)
- **ai-ui** — B안 1단계 — 진행·확인·실패를 대화 속 카드 하나로 (#2651) (`467eecd`)
- **object-gate** — front_prop kind (rules v8) — human-review only; adversarial probe 0/144, fresh/A pass rates unchanged (#2650) (`f833b11`)

## 0.233.0 — 2026-10-16

### 기능

- **harness** — battle-trainer-sprites — generated image -> 128 smooth downscale trainer sprites (human pick) (#2601) (`15f8ce5`)

## 0.232.0 — 2026-10-16

### 기능

- **object-gate** — 얇은 소품 기준 보강 + 새 정상 35장 재측정 (프로필 e48906a, 여전히 rejected) (#2647) (`cb3af82`)

## 0.231.0 — 2026-10-16

### 기능

- **mode7** — 비행선 flightView opt-in 의사 Mode7 비행 시점 (FF6 audit #31) (#2634) (`2165301`)
- **cutscene** — author_stage_performance — opera/stage acts compiled to cutscene beats (FF6 audit #31) (#2614) (`ad0a2f8`)
- **world** — derive_world_variant, world entrance links, world terrain tags and terrain encounter conditions (#2604) (`0b73ced`)

### 수정

- **object-gate** — 굽기 스크립트의 관문 우회 길 제거 (#2644) (`f6f513a`)

## 0.230.0 — 2026-10-16

### 기능

- **object-gate** — rules v7 — 3/4 half passes calibration data, profile still rejected (style half) (#2642) (`072de5c`)

### 수정

- **stamp-place** — 바로 깔기 — 물건은 칩셋 그림을 이름으로 찾고, 없으면 깔지 않는다 (적대적 리뷰 + 코퍼스 가드) (#2643) (`39432bc`)

## 0.229.1 — 2026-10-15

### 성능

- **boot** — warm boot 9.3s -> 4.4s, cold 19.0s -> 13.6s, first-visit shared-content 13.1MB -> 3.7MB (#2640) (`ecd9f79`)

## 0.229.0 — 2026-10-15

### 기능

- **battle** — trainer pictures accept 128-wide canvases (display scale 128/width), throw frames 64 or 128 (#2638) (`08353b1`)

### 수정

- **ci** — record chocobo, cart, and raft on the M2 vehicle surfaces (`5f9c108`)

## 0.228.1 — 2026-10-15

### 수정

- **ci** — record follower chips and four-layer tile labels on event surfaces (`ca7d2c1`)

## 0.228.0 — 2026-10-15

### 기능

- **vehicles** — chocobo, mine cart, raft + ct-vehicle fixture fix (#2609) (`8d36be8`)

### 성능

- **ai** — 조수·팀 모드 렉 — 체크포인트 왕복 검사·강제 레이아웃·붓 라벨 재탐색 (측정 하네스 포함) (#2631) (`32cf184`)

## 0.227.1 — 2026-10-15

### 수정

- **ci** — record the team-swap command width and the genre-lock field (`32d52fc`)

## 0.227.0 — 2026-10-15

### 기능

- **monster-art** — follower walk chips for the remaining nine species (#2626) (`5d4ccb5`)
- **monster-art** — bake follower walk chips for sparkit, aqualing, leafling, pipbug (supervisor picks) (#2620) (`97b9330`)
- **genre-lock** — monster-collect genre chipset lock enforced for assistant/tool runs (#2625) (`105ac40`)
- **ct** — Active/Wait 연동·필드 배치·연계기·CT 시나리오 복구·완료 가드 (PR2) (#2624) (`e22aa52`)
- **monster** — HM 필드 기술 세트 — place_field_obstacle · 몬스터 필드 기술 · TM/HM 가르치기 · 잊기 불가 (포켓몬 감사 PR2) (#2622) (`eb2692b`)
- **boot** — instant discrete-step splash, failure + retry screen, always-on boot marks (#2611) (`4c62f61`)
- **monster** — 시야선 트레이너·18타입·풀 칸 조우·야생 레벨 범위·블랙아웃 규칙 (포켓몬 감사 S, PR1) (#2603) (`fed4d8d`)

### 수정

- **ci** — build system records field by field so typecheck can finish (`a1a929d`)
- **ci** — record the field-skill condition and four-layer tile surfaces (`6b71bd4`)
- **battle-ui** — team-swap command spans the full row in the retro2003 root menu (label was clipped to 로크 …) (#2623) (`dbfaecc`)

## 0.226.0 — 2026-10-15

### 기능

- **battle** — FF6식 팀 교대 전투 — 한 번에 한 팀만 싸운다 (battleTeams · teamSwapCost) (#2613) (`921d948`)
- **battle** — FF6 battle effects - zombie, sketch, rage, trance, enemy shuffle/forced switch (#2600) (`d814dd1`)
- **monster-art** — bake follower walk chips for gustchick and zaptoe (supervisor picks) (#2617) (`7b0f2b7`)

### 수정

- **ci** — keep harness follower chips out of the sealed walking catalog (`71571ea`)

## 0.225.0 — 2026-10-15

### 기능

- **monster-art** — follower walk-chip wiring (campaignSpeciesId -> species fieldGraphic via bundle manifest) + field_chip harness (#2612) (`ef21a7e`)

### 수정

- **ci** — record the pokemon battle CSS budget and winners (`27875e9`)
- **ci** — accept the harness monster walking chips in the charset catalog (`38e97b2`)

## 0.224.0 — 2026-10-15

### 기능

- **monster-art** — 12 species front/back picks + bundle build (supervisor-delegated) (#2607) (`5492828`)
- **battle** — pokemon battle phase 2 - typewriter text, capture shakes, evolution scene, level-up stat box (#2605) (`d7481be`)

### 수정

- **ai** — themeScene maps carry an explicit mapRole; 방어/방패 no longer read as interior (#2606) (`61e6db9`)

## 0.223.0 — 2026-10-15

### 기능

- **ai** — partyKnowsSkill condition + run_scene_test useFieldSkill + auto-play field-skill gates (#2602) (`19e48e3`)

## 0.222.0 — 2026-10-15

### 기능

- **monster** — seed the first 12 campaign species for the species harness (#2599) (`4a75eec`)
- **ai-tools** — create_map themeScene runs the theme composer in one call; check_map_emptiness and map-flat-ground lint; theme-scenes recipe (#2598) (`93c364d`)
- **battle** — pokemon battle phase 1 - move box info, EXP bar, final-blow faint, move effects, idle bob, Galmuri9 (#2594) (`e55bc24`)
- **monster** — harness-bundled species art wired into campaign + battle (#2593) (`a204cb4`)
- **ai-tools** — find_tools alias ranking, arg alias/repair helpers, encounter-table rejects unknown keys (#2592) (`0293fc9`)
- **ct** — 시대 변형·타일 변화·시간문 잠금·타이머 저장·NG+ 이월 도구 (PR1) (#2591) (`9b2e233`)
- **battle** — FF6 magicite growth - AP permanent learning, level-up bonus, once-per-battle skills, equipment slot tool (#2590) (`423504d`)

## 0.221.0 — 2026-10-15

### 기능

- **dungeon** — genre x tileset-adapter dungeons (author_dungeon), monster-kit adapter, beodeul cave/mine/volcano polish (#2587) (`cf71dea`)

### 수정

- **ci** — register the compatible-provider settings CSS (`68327c6`)

## 0.220.0 — 2026-10-15

### 기능

- **ai** — OpenAI 호환 사용자 지정 제공자 (CLIProxyAPI·LiteLLM·Ollama…) + Argon 전용 허용/차단 패턴 (#2585) (`92dcb3d`)
- **object-gate** — Sonnet 5.5 high judge + exact measurements; calibration rejected (43/47 · 19/36) (#2583) (`a80e9ea`)
- **dungeon** — 던전 종류 8가지 — 미궁·하수도·동굴·신전·광산·화산 (author_beodeul_dungeon type) (#2579) (`90ec00c`)

### 수정

- **ci** — drop unused dungeon symbols and type the gym shrink (`402e8f5`)
- **monster** — gym void check, volcano campaign theme, 0-gym annex, shrink cleanup, visual-flat (#2581) (`f38fa38`)

## 0.219.1 — 2026-10-15

### 수정

- **ci** — record the desktop window-control CSS winners (`41a85a4`)

### 성능

- **boot** — editor startup 22.8s -> ~9s (normalization marker, deferred digests) (#2577) (`a3de392`)

## 0.219.0 — 2026-10-14

### 기능

- **monster** — campaign scale parameters, definition-consistency check, post-save write rejection root-cause fix (#2573) (`03db7aa`)

### 수정

- **ci** — type the expedition rival rows and ferry menu (`9da5416`)

## 0.218.0 — 2026-10-14

### 기능

- **desktop** — window controls — minimize / maximize / fullscreen / close icons at top-right, platform-adaptive (#2572) (`2b02d6a`)
- **monster** — free-path monster intent routing, volcano start theme, no-capture tournament/expedition builders, family batch + propagating rename tools (#2570) (`91ba50d`)

### 수정

- **ci** — type the expedition format and species flying flag (`5c6882e`)

## 0.217.0 — 2026-10-14

### 기능

- **object-gate** — one gemini-4-argon pass judges 3/4 view and Beodeul-level style; profile 473db36f963972c9 calibration rejected (#2567) (`d44c144`)

### 수정

- **beodeul** — dungeon composer v2 — rimmed ceiling autotile, 2D layout, varied dressing (adversarial QA) (#2568) (`7fd4fcb`)

## 0.216.2 — 2026-10-14

### 수정

- **field-enemy,campus** — field sprite follows battle enemy, return-home + "!" at sight + patrol/chase; campus dead doors enforced (#2565) (`2083f4a`)

## 0.216.1 — 2026-10-14

### 수정

- **beodeul** — dungeon floors — ground-support rule + author_beodeul_dungeon room-list composer (#2563) (`c369e73`)
- **ci** — record the concept feed CSS winners (`503ed03`)

## 0.216.0 — 2026-10-14

### 기능

- **ai** — place_field_enemy — 눈에 보이는 필드 적(고정·순찰·시야 추격), 접촉 전투·승리 소멸·도주 기절 (#2559) (`6e4bce0`)
- **steampunk-city** — 버들항 결 맞추기 — 돌마다 읽히는 포석·판석·바구니 벽돌·재질 톤 윤곽·5단 가로수·슬레이트 (#2558) (`b7723c4`)
- **prehistoric** — 버들항 결 맞추기 — 낱알 흙·흙길 테 lane·들쭉날쭉 풀 가장자리·재질 톤 윤곽·잎 뭉치 수관 (#2556) (`fd535e1`)
- **pirate-isles** — 버들항 결 맞추기 — 재질 톤 윤곽·조용한 풀+그늘 덩이·잔돌 모랫길·기와/초가 램프·판자 (#2555) (`22209e0`)
- **sky-island** — 버들항 결 맞추기 — 층리 섬 밑면·풀 그늘/얼룩 변형·포석 큰길·기와 램프·큰 활엽수 (#2554) (`70cec72`)
- **sf-station** — 버들항 결 맞추기 — 재질 톤 윤곽·판 단위 빛면/그늘면 갑판·격벽·벽 띠 (#2553) (`668c500`)

## 0.215.0 — 2026-10-14

### 기능

- **modern_city** — leafy street trees, lawn variants and composer greenery (quality-b) (#2552) (`dee37f1`)
- **sengoku-edo** — 버들항 결 맞추기 — 잎 덩이 나무·고른 풀밭·잔돌 흙길·잔물결 해자·바랜 기와 (#2551) (`148fe88`)
- **desert-east** — 버들항 수준 명암·질감 — 야자·평지붕·풀·흙길·물 (#2550) (`06ad748`)
- **snow-north** — beodeul-level shading for trees, snow roofs, walls, slush/frost, hearth (#2548) (`ea63257`)
- **modern-campus** — quality-b — brighter lawn, fuller trees, cream school walls, green roofs (#2547) (`12d462c`)
- **gothic-manor** — buldeul-level grass clumps, dirt path, 5-step dead trees with soft outlines (#2544) (`190fe3c`)

### 정리

- **ai** — one composed-layout marker + one isComposedLayoutMap for layout-quality advice; jp_city street hedge/wall fills no longer fail silently (#2549) (`041afb7`)

## 0.214.0 — 2026-10-14

### 기능

- **start** — redesign launcher home experience (`310370d`)
- **beodeul-farm** — 3판 화풍 정렬 — 버들항 민가 문법 헛간·닭장, 가는 울타리, 반듯한 흙길 오토타일, 풀 무늬 (#2541) (`17cee01`)
- **jp-city** — rebake facility interiors with only gate-passing pieces (59 objects, 322 cells append-only); hospital doors use the school sliding door (`f8a7d06`)

### 수정

- **ci** — record the ten new chipsets on the change-tileset form (`f4d3d23`)
- **ai** — composers claim the game start on a blank start map; campus reports dead doors; example-copy warning no longer drives rebuild loops (#2540) (`4fdf3d6`)
- **jp-city** — office-free and hospital examples use passing pieces in place of the held ones (`e79fa6f`)
- **ai** — layout-built hand interiors carry composed-layout room labels; jp facility note says keep a clean program build instead of rebuilding it by hand (`b734e9a`)
- **jp-city** — hold 17 gate-failing facility pieces out of the bake; keep inter-floor stairs where the author put them when refitting doors (`fbe80f3`)

### 문서

- **jp-city** — facility interiors — gate hold list, door-fit fix, layout room labels, gemini-4-argon assistant scores (`f98f21b`)

### 테스트

- **jp-city** — door-link fixture for hospital/school-annex/IT-office examples (`ec0e40c`)

### 잡무

- **jp-city** — refresh interior reports after merging origin's copy-warning wording (`d498536`)
- **jp-city** — regenerate interior room templates after merge (`4081d14`)

### 기타

- **jp-city** — rebake after the hospital/phone-booth redraws (`d1e786d`)
- **jp-city** — clearer top planes on 7 hospital machines and the office phone booth; wiki section for the facility interiors (`42e3e3f`)
- **jp-city** — hospital/school-annex/IT-office interiors (76 pieces, 5 example maps, programs), routing; gate round 2 pending (`a4dbe81`)

## 0.213.0 — 2026-10-14

### 기능

- **interior-plus** — museum/ship/arena room kinds, layout programs, templates, references and assistant routing (`0ac4f12`)

### 수정

- **interior-plus** — guidance — rebuild at most once by shrinking room w/h, never re-type layout coordinates; doorway gaps through a wall face are the normal form (`1c7fa6a`)
- **interior-plus** — redraw gate failures until every piece and assembled room passes object-gate (`8ee3869`)
- **interior-plus** — guidance pass — stands sit above the arena floor in layouts, build only the rooms named, stop reference crawling (`f0fdea7`)
- **interior-plus** — one adversarial QA pass — painting line, cabinet tops, portcullis in wall, seated cask/sacks, readable chain/capstan/pin rail, hull skirting, calmer sand, re-laid rooms (`96fe6c4`)

### 문서

- **interior-plus** — assistant runs on gemini-4-argon medium, before/after guidance (`e1c663e`)
- **interior-plus** — gate results — all pieces and rooms pass, dropped four, north-facing cannon (`f5e1d96`)
- **interior-plus** — openwiki section and interior-room-authoring skill for museum/ship/arena (`a41048b`)

### 기타

- **interior-plus** — museum/ship/arena hand-pixel pieces appended to atlas_biome_interior (gate pending) (`5c6b7b6`)

## 0.212.0 — 2026-10-14

### 기능

- **ai** — assistant default = Google Gemini 4 Argon medium (all roles); recommended provider is Google (#2535) (`398e2b3`)
- **monster-kit** — rooms m17 — 3/4-gate fixes (lab chair, museum tank, ship bollard); object-gate receipts 48/48 PASS (`05974b8`)
- **beodeul-farm** — 2판 hand-pixel redraw — farmland/watered soil, crops, chunky fences + gate, barn, coop; watered art at runtime (#2534) (`70abc71`)
- **monster-art** — GBA redraw of rooms-sheet labs/school/museum/dept/ship + rebake gyms (mint turf, lumpy hedge trees) (`d64e70c`)
- **monster-art** — code-pixel title key art for meadow/desert/snow; GBA lumpy-crown gym hedge trees (`b68c4b3`)

### 수정

- **monster-art** — title QA pass — aurora ribbons, fox ground shadow, scarab legs (`65c8536`)

## 0.211.0 — 2026-10-14

### 기능

- **monster** — use-based fill for kit outdoor land (towns + furnish_outdoor_area region), beach hut door, theme cast wiring (`965f5af`)

## 0.210.0 — 2026-10-14

### 기능

- **monster** — theme-keyed title key-art hook (default/coast/desert/snow) with stag fallback (`87da523`)

### 수정

- **ci** — drop the unreachable interior check in modern city routing (`fbee487`)
- **hand-interior** — refit doors, start and incoming transfers when any room-spec chipset interior is rebuilt (`0bbc584`)
- **modern-city** — composed streets carry the composed-layout tag so the layout-quality repair never rebuilds a street as an interior; number duplicate building names (`6cc1a77`)
- **snow-north** — assistant guidance — compose first (no reference reading before the first call), cap newMap size at default+8 (`4d2259c`)
- **modern-city** — meeting-room side chairs, drop dangling desk-pc pair, quiet empty-default layout warning, exit event name (`ad5f2b3`)
- **snow-north** — one adversarial QA pass — work yards on trampled ground linked to paths, no tundra in villages, per-cell snow variety, irregular ponds and loose reeds, 2x2 ice holes with fishing spots beside them, staggered market stalls, cabin table, forest outside the south wall, falls feeding the stream (`f767f00`)

### 문서

- **modern-city** — real-assistant defects found and fixed, remaining program density gap (`55a6571`)
- **snow-north** — QA results and real assistant runs (gpt-6.1-sol fallback) (`05967a1`)
- **openwiki** — regenerate INDEX for snow-north page (`241b3a2`)
- **snow-north** — AGENTS entry (`34ce36d`)

### 기타

- **modern-city** — concept/start registries (BUILDABLE, seed hint, start size, route style, kit build line) + wiki (`102a517`)
- **snow-north** — remaining object-gate receipts (interior hearth frames, door wall, dropped barrel-in fails) (`25ebb94`)
- **snow-north** — references bake, policy, compose/link tools, shared wiring (bundled, defaults, routing chain, startRoutePaint, worldmap snow-north) (`8ff5c39`)
- **modern-city** — street composer + compose/link tools + modernCityPolicy routed after campus (no jp_city/campus/SF hijack) (`061e260`)
- **modern-city** — interior reference category mc-interior (dictionary, steps, 9 engine-built examples with full arrays, tamper codes) (`b6905ac`)
- **modern-city** — example rooms get partitions/pillars (no plain-box), hospital ward+waiting, konbini entrance kind, engine check script (`04cf83f`)
- **modern-city** — bake 64 gated interior pieces append-only, modern_city hand-interior spec, room templates (`fac5161`)
- **snow-north** — outdoor art — palette, terrain/autotiles, 19 buildings, 58 props, assembled part receipts (`d5195ee`)
- **modern-city** — gate redraw passes 2-4 (`c8c6d37`)
- **modern-city** — interior hand-pixel pieces, gate redraws, example rooms (`6db1498`)

## 0.209.1 — 2026-10-14

### 수정

- **gothic** — gate cell keeps the drive's paving; dead-tree groves in the gallery plaza's upper lawns (`ce145ef`)
- **gothic** — chapel altar centred at the runner end with flanking candles, cobwebs only in the NW corner, paintings only on bare wall, single dust decals; gemini-4-argon assistant config (`d965186`)

## 0.209.0 — 2026-10-14

### 기능

- **prehistoric** — stone-age chipset + composer + assistant routing (#2519) (`bf7c019`)
- **pirate-isles** — tropical archipelago / pirate harbor chipset + composer + assistant routing (#2513) (`3ca3b2d`)
- **sengoku-edo** — 전국·에도 일본 칩셋 — 손 도트 1014칸, 구성 도구, 다다미 실내 (#2512) (`2e2d7af`)
- **sky-island** — 하늘섬 손 도트 칩셋 sky_island + compose_sky_island_map 조수 길 (#2509) (`956164c`)
- **steampunk-city** — 스팀펑크 공업 도시 번들 칩셋 + compose_steampunk_city_map (#2508) (`a500d86`)
- **modern_campus** — redraw the campus chipset by hand, procedural campus composer, interior layout programs (#2500) (`44f3a58`)
- **sf-station** — SF station / colony / lab / cyber-neon chipset (172 Opus hand-pixel pieces), composer, assistant routing, references (#2499) (`80b2590`)
- **jp-city** — fill leftover street land by use (coin parking, nooks, playgrounds, gardens, construction, plaza dressing) (#2505) (`324155c`)
- **desert_east** — redraw 57 gate failures with visible top faces, gated bake (245/247 pieces), references, blank-map ground tile (`3b5f4cb`)

### 수정

- **ci** — type the desert temple floor uses so typecheck passes (`91cfa53`)
- **ci** — drop unused chipset composer locals that fail typecheck (`972d712`)
- **desert_east** — tag composed maps and rooms composed-layout so the layout-quality nudge does not make the assistant scatter props (`73a101d`)
- **desert_east** — assistant guidance — compose output is final, no loose stamping; fuller tomb chamber (`9633345`)
- repair syntax/duplicate breakage from the five stacked chipset merges (plainTurn routing chain, executionRoute note chain, hand-interior spec map/imports/enum, startRoutePaint map sizes, concept seed json) (#2520) (`0db604a`)

### 문서

- **desert_east** — status — gate counts, QA pass, assistant scores (`1f2eb06`)
- **desert_east** — openwiki page and final review page builder (`66a8751`)

### 잡무

- **desert_east** — object-gate receipts, first full run (115/172 items pass) (`35f26be`)

### 기타

- **desert_east** — adversarial QA single improvement pass — ground seams, prop footing, camp/bazaar/palace/caravanserai/pyramid layouts, great pyramid, rug runner (`dcf0288`)
- **desert_east** — art, composer, tools, policy and wiring before the gate run (`e2b44f1`)

## 0.208.0 — 2026-10-14

### 기능

- **gothic** — build_gothic_place hands out create_transfer_pair endpoints and keeps doors linked on rebuild (`cf76698`)
- **gothic-manor** — reference documents (gm-*), route horror/graveyard/gallery to build_gothic_place, drop old interior draft set (`594c1f7`)
- **gothic-manor** — wire bundled tileset, outdoor composer + build_gothic_place tool, QA improvement pass (`7877cbd`)

### 수정

- **gothic** — place builder meets the assistant layout-quality limits as built (clearing fill, smaller default rooms, seed probe) (`f964827`)

### 문서

- **gothic** — assistant real-run scores and the place-builder linking contract (`b25dff0`)

### 기타

- **gothic-manor** — gate-clean redraw (166 pieces), bake sheet+tileset+room spec, drop gate failures (`3587240`)
- **gothic-manor** — redraw engine (gmlib/gmdraw), buildings, graveyard, terrain first pass (`8c6fb34`)

## 0.207.4 — 2026-10-14

### 수정

- **ci** — give the geography raster page the test's own time budget (`1dc9e7e`)

## 0.207.3 — 2026-10-14

### 수정

- **ci** — install Playwright before the browser gate (`b6e0594`)

## 0.207.2 — 2026-10-14

### 수정

- **ci** — refresh the CSS live-class baseline after the surface update (`196835e`)

## 0.207.1 — 2026-10-14

### 수정

- **ci** — keep the interaction surface inside the CI heap (`ee10c6f`)

## 0.207.0 — 2026-10-14

### 기능

- **assistant** — gemini-4-argon model resolution (unverified) and MATRIX_NATIVE_MODEL pin for matrix-native (`ce70bf2`)
- **assistant** — edit history works under the Pi worker; semantic matrix-native judges (`2ace256`)

### 수정

- **assistant** — event edit notes for stale speaker after rename and unpaired screen fade (`9f40d1e`)
- **assistant** — create_transfer_pair ignores gates that were already sealed; stricter judges after visual review; robust bubble capture (`e43eee8`)
- **assistant** — return-door note names the exact direction to set (`f78b5f6`)
- **assistant** — reject malformed command keys; flag the return door when a transfer direction changes (`5d3bd27`)
- **assistant** — show_map_region reports blocked cells; patch_event_page summary flags dropped commands; judge ignores empty choices.branch (`e5427cd`)
- **assistant** — page-scope event assist rejects dropped commands even when the prompt says to keep them; touch trigger alias in judge (`ec1d603`)
- **assistant** — event edits can no longer silently drop commands or misplace transfer direction; assist results report added/removed (`07f6f71`)
- **assistant** — retry intent declaration once on timeout; count blocked cells in get_map_region; new doors are not blamed for gates sealed before them (`cef9344`)
- **assistant** — fill_region no longer grows past the rectangle at lone obstacles; anaphoric requests bind to the selection; capture shows the command's bubble (`e0be861`)
- **assistant** — sharpen event_command_assist guidance; matrix-native judges accept default-field fill and displayTextSettings (`e07a11e`)
- **assistant** — tell the Pi turn which event the user selected; fix cutsceneCritic for jimp 1.x (`4e2f5bb`)

### 테스트

- **assistant** — forest-path judge rejects holes and cells outside the area (`eb43532`)

### 기타

- **assistant** — native 50-command matrix with semantic judges and per-command host (`c94b8a9`)

## 0.206.0 — 2026-10-14

### 기능

- **jp-city** — gate-clean street kits, flat-roof art, rail kits, composer-first assistant routing (#2496) (`d847e06`)

### 수정

- **jp-city** — street composer harmony pass from one adversarial visual QA round (#2497) (`090ca8c`)

## 0.205.0 — 2026-10-14

### 기능

- **gothic** — interior reference docs bundle, assistant policy (gothic_manor), concept hint (`ebf0b93`)
- **gothic** — interior props wave 1 - 34 hand-pixel pieces + 3 anim strips, all object-gate PASS (`0663dba`)
- **gothic-manor** — outdoor kit pass 1 — 68 gate-passing pieces (buildings, graveyard, terrain) + registry (`d15467e`)

### 수정

- **opening** — critic must not recommend map-event routes; judge looks, fixes name staging values (`a39e78e`)
- **cutscene** — charset actors honor scale (was ignored, so walkers rendered at 13% height) (`d27702b`)

## 0.204.0 — 2026-10-13

### 기능

- **cutscene** — author_actor_charset tool — code-pixel walking charset for machines/robots/mounts (`639a9b6`)
- **opening** — motion strip over real map+tint for the judge, hero-overlap and focal-size probe checks (`77c087d`)
- **opening** — mech charset drawer, charset-actor gate, cover/size probe checks (`b77e642`)

### 수정

- **ci** — give each surface axis a fresh process and a DOM before Phaser (`e2ba0ab`)
- **cutscene** — detect a player move as moveEvent, not moveActor (`0a48128`)
- **cutscene** — lenient staging for common omissions; harness loads bundled resource images (`c8e4cc0`)
- **cutscene** — unique picture ids for actors sharing z (`28c837c`)
- **cutscene** — walk frames for charset-frame actors, keep scene tint after fade-in, scale on walk frames (`42ed2fd`)
- **qa** — headless harness supports google-antigravity models; phaser LICENSE resolve via package.json (`7650a3a`)
- **stage** — explicit picture resourceId wins over schema-filled default Actor1 character (unless hero) (`01eec5e`)
- **opening** — jimp 1.x-compatible image shrink; probe every auto cutscene on the start map and flag duplicates (`5e16db0`)
- **opening** — gate nag includes a concrete working script_cutscene_staged call shape (models went silent after tool errors); turn.diag diagnostics (`72498b2`)

### 정리

- **opening** — drop forced charset gate; critic judges intent fit (`f5d8047`)

### 잡무

- **qa** — QA_CHROME env to use system Chrome when Playwright browsers are missing (`55e18ea`)
- **qa** — headless bridge startup timeout 300s (machine load) (`907748c`)

## 0.203.0 — 2026-10-13

### 기능

- **beodeul** — beodeul_farm first pass - farmland autotile, crops, fence pieces (`76e97ea`)

## 0.202.1 — 2026-10-13

### 수정

- **farming** — read farmland autotile group from the tileset instead of EasyRPG tile 187 (`b8abc23`)

## 0.202.0 — 2026-10-13

### 기능

- **ai** — jp_city guidance is composer-first; route city-street requests without the word 일본 (`0e7936b`)
- **jp-city** — rail-signal redrawn as box with visible top; passes 3/4 gate (`e30fe28`)
- **jp-city** — bake refuses kits without a passing 3/4 gate receipt (JP_GATE=skip to bypass) (`cb2dcb6`)
- **jp-city** — rail/bridge kits redrawn with visible top faces, gate-copy export (_gate) (`23c07dc`)

### 문서

- **agents** — 3/4 top-view gate is a hard rule for new pixel kits (`9e2ebef`)

## 0.201.0 — 2026-10-13

### 기능

- **jp-city** — high-rise towers, wall-attached Japanese street props (#2482) (`84d9ad4`)

## 0.200.3 — 2026-10-13

### 수정

- **ci** — raise the CSS ratchet to the tree the full gate can actually reach (`2589157`)

## 0.200.2 — 2026-10-13

### 수정

- **ci** — shard the full test gate across four GitHub runners (`75f1533`)

## 0.200.1 — 2026-10-12

### 수정

- **css** — keep the battle band note inside the comment so minify can parse it (`97ba910`)
- **css** — close the battle submenu comment so the app build can minify (`6ac4960`)
- **player** — compile against Phaser 4 so CI typecheck passes (`d7f9e4b`)
- **ci** — let GitHub-hosted runners start the test suite (`d3eca29`)

### CI

- pin hosted actions so the public repo policy accepts them (`e7da5a8`)

## 0.200.0 — 2026-10-12

### 기능

- **jp-city** — integrated shopfront kits (door + ground floor drawn as one), prop overlap pruning, exact door approach cells (#2468) (`f4c8347`)
- **opening** — objective in-game cutscene verification — deterministic probe (visibility/scale/motion/overlap/sound) + independent judge, gate relies on them instead of the assistant's report (`d83a117`)
- **cutscene** — missing-resource error suggests nearest real ids (`d8c0ec9`)
- **opening** — in-game guidance is vocabulary + universal quality criteria, not an FF6 recipe (`bf76581`)
- **stage** — general mood/scale vocabulary — actor scale, bob walk for single-picture actors, tint/weather/letterbox/camera steps (`0056e60`)
- **stage** — reject cutscenes where an actor never enters/moves/shows (`8dcfae8`)
- **opening** — in-game gate requires made cutscene sprites to appear in start-map events (`8e6391d`)
- **opening** — in-game cutscene openings (FF6 march on the real map) — detection, gate, recipe, tools (`3334b54`)

### 수정

- **opening** — quote typo in gate hint (`4006e8e`)
- **opening** — in-game gate tells the model to load script_cutscene_staged via find_tools first (`16ae72b`)
- **stage** — blank schema-filled character no longer replaces a picture actor with default Actor1 (`bf8a140`)
- **stage** — drop picture-id character even when resourceId is also given (`6bdaa23`)
- **opening** — in-game gate no longer says 'no event' when an auto event already exists (`a4c8b14`)
- **stage** — treat cutscene_sprite_* passed as character as picture actors in run; clearer not-prepared error (`9489b2d`)
- **pi-worker** — read bundled /assets pictures (charset frames) from public/ in the worker (`d7024a6`)
- **stage** — skip charset frame prep for picture-resource actors passed as character (`cc2080a`)
- **stage** — picture resources passed as actor.character are treated as resourceId actors (`d6a21ca`)
- **lint** — start-position message tells how to fix it (`d89b2d3`)
- **opening** — in-game opening gets up to 5 completion rekicks that demand tool calls (`346e1bd`)
- **tools** — portraitMode is faceset-only; ignore it for other kinds (`c08ae30`)
- **tools** — list_resources ignores empty portraitMode instead of failing every call (`f5eb3a2`)
- **worker** — cutscene art uses the worker image route (fetch URL invalid in Bun worker) (`e8a2732`)

### CI

- run workflows on GitHub-hosted runners (`de56530`)

### 잡무

- **qa** — headless harness preloads cutscene tools (`4201126`)
- **qa** — log cutscene tool args in headless activity (`536c2dc`)
- **qa** — bridge only map/animatic renders (`d939339`)
- **qa** — bridge chromium flags (`c639ed0`)
- **qa** — headless harness can render maps via the browser bridge (`2cc1f83`)

### 기타

- agent worktree base for opening-assistant (`11128c3`)

## 0.199.0 — 2026-10-12

### 기능

- **jp-city** — river street — embankment walls, bridges, riverfront park, prop overlap rules (#2465) (`a6f57c8`)

## 0.198.0 — 2026-10-12

### 기능

- **editor** — open the tile palette on terrain and prefab cards (#2462) (`d801b09`)

## 0.197.0 — 2026-10-12

### 기능

- **jp-city** — horizontal river with embankment wall face, stairs, far-bank promenade; streets cross as railed bridges (#2460) (`8469bf4`)

### 테스트

- **assistant** — raise small command visual score (`77e2573`)

## 0.196.0 — 2026-10-12

### 기능

- **jp-city** — river with promenade, grass slopes, sakura/bench/lamps and railed bridges (#2458) (`5d28445`)
- **jp-city** — town composer — river with bridges, landmark buildings, rear walls (#2456) (`2deb5eb`)
- **jp-city** — block-based town composer — road network, blocks with zones (shop/house/park/parking), 2-3 building bands (#2455) (`0215140`)

### 수정

- **jp-city** — wires erased building ground floors (stamp before buildings); gravel base ground distinct from walls (#2457) (`aea9192`)

## 0.195.0 — 2026-10-12

### 기능

- **jp-city** — street composer v5 — door types/positions per role, entrance props beside built doors (#2452) (`baca316`)
- **jp-city** — street composer v4 — utility poles with wires, curve mirrors, bus stop, hydrant sign (#2451) (`1747c35`)

## 0.194.0 — 2026-10-12

### 기능

- **jp-city** — street composer v3 — road edge lines, ped signals, yards/parking lots between buildings (#2449) (`8b22265`)
- **opening** — more opening recipes (FF6 pixel-march, title-card, trailer, memory, credits) + image retry (`3f3e88a`)
- **opening** — headless real-assistant harness, SFX-link gate, fixes found by real run (`8283ba8`)
- **opening** — assistant ffmpeg tool, progress+thumbnails, title-screen scope, title art style/candidates (`dce6084`)
- **opening** — multi-cue timed SFX (direction.sounds) (`c51a604`)

### 수정

- **title** — remove editorial logo text-stroke (hollow CJK glyphs) (`9353938`)
- **title** — editorial logo — remove text-stroke that hollowed CJK glyphs; brighter fills, per-style fills, bigger size (`a8ff7df`)
- **opening** — legible captions — full-width dark band, min 13px, heavier weight (`decea77`)
- **title** — drop stale key-art titleGraphic on any set_title_screen (`a936c8d`)
- **title** — reject background art as titleGraphic; title art must carry the story focal point (`7b0e10d`)
- **opening** — cap raw presentation images sent to model; title gate accepts existing custom art (`7d319f5`)
- **opening** — text size is stage-logical (320x240) — smaller presets, render clamp, schema+gate (`869e167`)

### 잡무

- **opening** — recorder title-enter + network flags (`eedf101`)

### 기타

- agent worktree base for opening-assistant (`52e6c39`)

## 0.193.0 — 2026-10-12

### 기능

- **jp-city** — street composer — T/through alleys, spaced lamps avoiding doors, hedge back edge, facade signs (#2448) (`9951f0a`)
- route preset generation through goal campaigns (#2444) (`bb66bbf`)
- **jp-city** — street composer — seeded rule-based streets instead of pasted samples; compose_jp_city_street tool; jp starts use it (`bf9d00e`)

### 수정

- **jp-city** — one-way lane look — no oncoming cars, 30 marking, no centerline on narrow streets (`e1074a2`)
- **jp-city** — connect alley to the main road with sidewalks; label each building's door so interiors match shops (`4033064`)

### 기타

- docs+test: street composer (`f97097b`)

## 0.192.0 — 2026-10-12

### 기능

- **start** — jp_city concepts open on a finished street place; fix stale 48-column jp_city place tilesets on import (`8df789f`)

### 수정

- **jp-city** — redraw restaurant chairs in 3/4 view with attached backrests (`8c622e3`)
- **jp-city** — smaller coffee cup, red chair cushions so chairs read on dark floors (`80d9b65`)
- **jp-city** — table goods sit on the tabletop instead of hanging over the front edge (`044b72d`)

### 테스트

- **assistant** — score small command model quality (`18469d9`)
- **assistant** — verify all small commands through editor UI (`6e64ffe`)

### 기타

- **start** — pick door buildings that look like the shop (`30d43a1`)
- docs+prompt: jp_city start places, forbid grass overpaint (`aa469fb`)

## 0.191.0 — 2026-10-12

### 기능

- **editor** — streamline terrain editing workflow (`5331a48`)

### 수정

- **terrain** — remove ramp length illusion from cliff outlines (`3797705`)
- **terrain** — report ramp length without width area (`c0a2ed0`)
- **terrain** — match ramp length to cliff height (`aee7d18`)

### 문서

- **terrain** — align ramp length guidance (`f6c4663`)

### 테스트

- **assistant** — add live 50-command input harness (`ca595de`)
- **assistant** — execute 50 small command tool contracts (`94436e4`)

## 0.190.0 — 2026-10-12

### 기능

- **start** — lay a main street across kit start maps as the assistant's anchor line (`b62766f`)
- **start** — kit-aware first-place prompt, bigger kit start maps, tolerant layout+plan (`ce85ddd`)
- **start** — follow the concept's tileset for the start and route maps (`33c8e0c`)
- **start** — build example start and AI-mode start towns from the concept plan (`38d8eab`)
- **start** — derive first-place shape from the concept instead of a fixed skeleton (`08b7c82`)

### 수정

- **assistant** — warn read-only turns before the turn cap and ask the planner to batch reads (`a4ebc6d`)
- clear objects during relief edits (#2432) (`90e89cd`)

### 빌드

- **deps-dev** — bump the development-dependencies group across 1 directory with 9 updates (#2396) (`4ca73e5`)
- **deps** — bump the production-dependencies group across 1 directory with 3 updates (#2395) (`35d3310`)

### 기타

- docs+test: start-variety tileset-following start maps, assistant fixes (`5236521`)
- agent worktree base for start-variety (`7a7ce02`)
- Improve AI sidebar discovery and defer progress validation (`8bee4b0`)
- agent worktree base for ui-store-workflow (`d6526fa`)

## 0.189.0 — 2026-10-12

### 기능

- **opening** — showcase pipeline scripts (gen, build via real tools, player recording) (`5bd31cb`)
- **opening** — candidate generation with independent still critic and regenerate gate (`cc946ef`)
- **opening** — bible, cast rule and technique-style guidance for opening production (`671a194`)
- **ai** — default image route to ChatGPT with Google fallback when not connected (`da29a9f`)
- **opening** — structured still prompt with focal point, angle, light and palette (`c95734d`)
- **editor** — streamline terrain editing workflow (`84e0fb2`)

### 수정

- **editor** — reduce preset project startup cloning (`0303165`)
- **release** — record the desktop package version in the drop directory (`a68dc6c`)
- **release** — keep Windows packages for the test PC to pull (`e4ee92f`)
- **ci** — unblock typecheck on the remote runners (`c9ee0d7`)
- **editor** — pin bundled terrain floor choices (`5a34390`)
- **editor** — prefer repeatable wizarding floor (`4a970d8`)
- **editor** — choose blank floors per tileset (`421e598`)
- **terrain** — report ramp length without width area (`66df300`)
- **terrain** — match ramp length to cliff height (`7938c47`)

### 문서

- **opening** — critic loop notes (`d4e3943`)
- **terrain** — align ramp length guidance (`f121a1d`)

### 테스트

- **assistant** — execute 50 small command tool contracts (#2427) (`392194c`)

### 기타

- agent worktree base for opening-quality (`7023b5d`)

## 0.188.0 — 2026-10-11

### 기능

- **tools** — stamp_object 가 높이 단을 지킨다 — 두 단 걸침·경사로·남쪽 가림 거절 (`94f5b99`)
- **village** — 높은 단 오르막·윗길, 갇힌 단 방지, 포구 길가 일하는 물가, 둥근 울타리 모서리 (`b156cfa`)

### 수정

- **relief** — mirror the top half of row 0 into the pad fill (`237cfc5`)
- **village** — 곧은 길 45칸 미만·지붕 귀퉁이 한 칸을 단 위 땅으로 안 세기·앵커 자리 ±16 (`ced9bac`)
- **relief** — fill the top pad above row 0 and drop smooth-ramp outlines (`fd61801`)
- **village** — 높은 단을 가르는 울타리 거절·옛 relief 지우고 시공·덮어 짓기 안내 바로잡기 (`9e80a0c`)
- **assistant** — 배치 품질 검사를 사막·설원의 트인 땅에 맞추고 수리 뒤 미달을 보고하게 한다 (`05eec87`)

### 문서

- **openwiki** — INDEX 재생성 — #2420·#2421·#2422 머지 뒤 절 좌표 (`45f0dfd`)
- **relief** — top pad fill, borderless smooth ramps and village runtime QA (`e9cd4e4`)
- **village** — 곧은 길 45칸 미만 규칙·지붕 귀퉁이 제외·앵커 ±16·프로브 288판 — 위키·마을 문법(번들 참고문서 갱신) (`a7c0991`)
- **openwiki** — stamp_object 높이 단 규칙과 트인 땅 배치 기준 계약 (`fa15753`)

### 테스트

- **relief** — runtime QA scenario for terrain villages' top strip and ramps (`921bf3b`)

## 0.187.0 — 2026-10-11

### 기능

- **editor** — 버들항 지형 마을 남은 점 — 늪 마른 둔덕·골 가장자리 덤불·앵커 자리·곧은 길 겹침 (`40dc010`)
- **editor** — 버들항 마을 — 지형을 먼저 깔고 그 위에 마을, 길은 매끈한 경사로, 울타리 마감 (`5aa08dc`)
- **village** — 버들항 마을 — 자연 물가·그림자·놓기 규칙 준수·나루·포구 물가 큰길·밀도·언덕 (`d435b8c`)
- **tools** — 키트 놓기 규칙 — 물레방아·배·잔교·다리·건물은 stamp_object 가 거절한다 (`cc20981`)
- **tiles** — 버들항 자연 덧그림 팩 beodeul_nature — 그림자·자연 물가·풀밭 가장자리 (`b9e1e72`)

### 수정

- **village** — 물레방아는 방앗간과 짝, 다리 자리는 강을 다리 폭만큼 넓힌다 (`1890290`)
- **tiles** — 자연 덧그림 — 그림자 더 크게·집 밑동 흙 띠, 얼음 못·늪 둑, 칸은 ★ (`f91ed3a`)

### 문서

- **beodeul** — 그림자·자연 물가·놓기 규칙·언덕 — 위키·마을 문법 참고문서·그림 다시 굽기 (`54a734b`)

## 0.186.0 — 2026-10-11

### 기능

- 조화 검수 수리 한 바퀴+전후 대결, 버들항 마을 형태 넷·밭 울타리 (#2416) (`909b96b`)

### 문서

- prominently display direct desktop downloads in all READMEs (`9221fb9`)
- **release** — NSIS portable 은 wine 없이 리눅스에서 만들어진다 (`1d26078`)

### 빌드

- **desktop** — 윈도우 단일 실행 exe(portable)를 릴리스에 함께 올린다 (#2415) (`ef5ce08`)

## 0.185.0 — 2026-10-10

### 기능

- add hand-pixeled silver-haired swordswoman battler (#2400) (`3d7ae15`)
- **start** — 새 게임 「골라서 만들기」 빠른 인터뷰 + 인터뷰 배경 1,076장(#2403 포함) (#2408) (`84153d3`)
- **dungeon** — 던전 기물 판 props-r1 27항목 + 위임 검수 반영 (리셋 복구) (#2406) (`df0a613`)
- **murim** — 무림 기물 판 props-r1 28항목 + 위임 검수 반영 (리셋 복구) (#2405) (`5b28f41`)
- **object-gate** — 공용 3/4 시점 오브젝트 게이트 판정 엔진 (리셋 복구, 출구 미배선) (#2404) (`06ddfcd`)
- **jp-city** — 5묶음 오락·숙박·상업 실내 9곳(맵 12장) (#2399) (`95d1192`)
- **jp-city** — 4묶음 현대 던전 8곳(맵 17장) + 시트 96열 (#2398) (`3e9c8ab`)

### 수정

- **interior** — 방을 견본보다 작게 만들지 않고, 가구는 덩이째 자리 후보를 넣어 본다 (#2397) (`eb6bc69`)

### 정리

- separate store and community services (`be749f9`)

### 문서

- 공개본에서 뺀 포켓몬 캐릭터 하네스 폴더는 로컬 전용이라고 적는다 (#2401) (`a83f49f`)
- put direct desktop downloads on the README (`63abfde`)
- mark community service as archived (`87ae874`)

### 빌드

- **deps** — bump file-type and jimp (#2391) (`1f8e05c`)

### 잡무

- stop whitelisting deleted evidence trees (`fd007e5`)
- remove obsolete public report pages (`3e58835`)
- remove obsolete new-editor exclusions (`e4095d6`)
- remove internal artifacts and add repo hygiene (#2394) (`c1d9934`)

## 0.184.2 — 2026-10-09

### 기타

- OpenRPGMaker public baseline after security and artifact cleanup (`0d4f13e`)

## 0.184.1 — 2026-10-09

### 기타

- Update security audit workflow (`7b15438`)

## 0.184.0 — 2026-10-09

### 기능

- **jp-city** — 3묶음 장소 7곳 게시 — 학교·체육관·유치원·역·사무 빌딩·우체국·맨션 공용부 (interior.mjs --sets 3) (`5f0c99b`)
- **jp-city** — 3묶음 실내 합치기 — 학교·체육관·유치원·역·사무실·우체국·맨션 공용부 굽기·참고문서·문 잇기 QA 36/36 (`5da6f14`)
- **jp-city** — 학교 본관 실내 interior_school(sc-) — 가구 42·바닥 4·벽면 4·탁자 1·탁상 5, 예제 1층·2층·3층·옥상 (`06a7c7e`)
- **jp-city** — 우체국·맨션 공용부 실내 블록 interior_post — 가구 26·바닥 4·벽면 3·탁상 4, 예제 post-office·mansion-lobby·mansion-corridor (`4ee7592`)
- **jp-city** — 사무 빌딩 실내 블록 interior_office(of-) — 로비·사무층·회의실·급탕실·비상계단 (`7cf52c6`)
- **jp-city** — 일본 실내 3묶음 역 — 역사·승강장·전철 차내 (interior_station st-) (`8498758`)
- **jp-city** — 체육관·유치원 실내 블록 interior_gym (gy- 37종) + 예제 gym·kindergarten (`53d20ab`)

### 수정

- **jp-city** — main 의 새 방 짓기 경고(예제 베낌·떠 있는 구역)를 예제 검사·게시에서 가린다 — 예제 자신·open-zones.json 에 밝힌 구역만 (`5d060be`)
- **jp-city** — 3묶음 관문 1회차 반영 — 다시 굽기·참고문서(탁자 목록 자동·관문 단계), 문 잇기 QA 이동 칸 전부 74/74 (`3b4e023`)
- **jp-city** — 우체국 — 창구 끝 여닫이 칸 그림을 칸 안쪽으로(서쪽 벽 흰 조각 제거), 남동쪽 ATM 앞에 대기 벤치·화분 (`2210458`)
- **jp-city** — 사무층 책상 섬을 가로로 긴 島型 8자리×2로 — 섬 끝 세로 과장 책상, 회의 코너 (`f8add4e`)
- **jp-city** — 전철 차내 — 남쪽 줄 출입문 한 쌍(그림만·막힘), 연회색 고무 바닥 + 문 앞 노란 줄 (`c50e1c0`)
- **jp-city** — 체육관·유치원 관문 1회차 지적 — 낮잠 요·open 축소·흰 선 코트·골대 위치·신발장·뜀틀 (`e9e2a96`)
- **jp-city** — 학교 관문 interior-p3 1회차 — 학생 책상 다시, 교실 5×5·6×5와 뒤 사물함, 복도 스테인리스 수세대, 1층 화장실 칸 (`d518a0b`)
- **jp-city** — 역사 개찰 줄을 벽에서 창구까지 닫는다 — 칸막이 3 + 개찰기 4대(통로 3), 칸막이 벽 토막 제거, 벤치 한 줄 (`70f2778`)

### 테스트

- **jp-city** — 문 잇기 QA — 층·구역 이동 칸 전부를 밟아 대상 맵·칸 도착 확인(hops) (`cdbfc7a`)

### 잡무

- **jp-city** — 관문 interior-shop 14회차 재확인 통과, 장소 모드 문 잇기 QA 74/74 (`805bb40`)
- **jp-city** — 관문 interior-p3 2회차 통과 기록 (`f05031c`)
- **jp-city** — 4묶음 현대 던전 준비 — 검사기 dungeon(far·locks), places[3-9] 공통, 지시서 (`602d6a1`)
- **jp-city** — 3묶음 배선 — 참고문서 용도 interior-public3, 문 잇기 QA 여러 층 예제, 시트 --p3, 게시 관문 interior-p3 (`3acfd76`)
- **jp-city** — 3묶음 실내 준비 — 검사기 --places·inner·open, interior.mjs --only·places3, 작업 지시서 (`a8db019`)

## 0.183.1 — 2026-10-09

### 기타

- Add security audit workflow (`d8ae71e`)

## 0.183.0 — 2026-10-08

### 기능

- **interior** — 실내는 방 구성만 고르면 도구가 배치·칸막이·문·예제 방 가구를 정한다 (#2373) (`03cb2a3`)

### 기타

- add adversarial eight-genre visual audit evidence (`9dca473`)

## 0.182.0 — 2026-10-08

### 기능

- **interior** — 조수 방 짓기 rooms 입력 — 칸막이·문 자동 계산, 예제 베낌·떠 있는 구역 경고, 올린 칩셋 역할표 맞춤 (#2367) (`5ee5ab3`)

### 수정

- **interior** — 맞춤 뒤 다시 넣는 args를 let으로 둔다 (`b4edad8`)

## 0.181.0 — 2026-10-08

### 기능

- **harness** — dungeon-chipset 재질 0단은 그늘 쪽 허용 — 빛 쪽까지 두를 때만 OUTLINE (`cfc4057`)
- **harness** — dungeon-chipset 외곽선 규칙 — 먹 윤곽 없이 재질 명암, 관문 OUTLINE·CONTRAST 경고 (`bd8c4ad`)
- **harness** — dungeon-chipset edges-r1 — 물·용암·얼음·낭떠러지·다리를 줄마다 후보 2개(손 도트 28), 관문 FAIL 0 (`e2f402b`)
- **harness** — dungeon-chipset cave-r1 — 동굴 6항목을 줄 A·B·C 마다 후보 2개(손 도트 36), 관문 FAIL 0 (`31564f7`)
- **harness** — dungeon-chipset 줄(line) — A·B·C 를 세 던전 컨셉 줄로 남기고 (항목, 줄)마다 고르기 (`f5bebf3`)
- **harness** — dungeon-chipset 하네스 골격 — 관문·고르기 시트·사람 pick/reject, style-r1 감독 자체 수정 (`9f34672`)
- **harness** — dungeon-chipset 잠금 팔레트·손 도트 도구·style-r1 후보(항목 5 × A/B/C) (`f52271a`)
- **jp-city** — 가게·공공 실내 16곳 + 집 보강 3곳 장소 게시(관문 interior-shop 13회차 통과) — 게시 틀은 jp-city-apartment-1k(옛 inn-tavern 틀은 main 에서 삭제됨) (`7c97eb7`)
- **harness** — murim-chipset 외곽선 규칙 — 먹 윤곽 없이 재질 명암, 관문 OUTLINE·CONTRAST 경고 (`e8084a8`)
- **harness** — murim-chipset 객잔 살림 판 inn-r1 — 줄 A·B × 후보 2 × 8항목, 탁자·걸상 배치 견본 (`4c1f8ba`)
- **harness** — murim-chipset 골조 판 frame-r1 — 줄 A·B × 후보 2 × 7항목 (`7b6970c`)
- **harness** — murim-chipset 컨셉 줄(line) — A 밝은 문파·B 강남 무관을 둘 다 남긴다 (`b4e686b`)
- **harness** — murim-chipset 스타일 시험 판 style-r1 — 항목 6 × 후보 A/B/C (`f5d20ec`)
- **harness** — murim-chipset 하네스 골격 — 무림 칩셋(murim_wuxia) 후보·관문·고르기 시트 (`11712b6`)
- **jp-city** — 관문 7회차 반영 다시 굽기 — 가게 다섯 뼈대·계산대 입구 쪽, 편의점 복사기·초밥 좌탁·이자카야 초롱·맨션 단·슈퍼 창고 (`e0f271e`)
- **jp-city** — main 합친 뒤 다시 굽기 — 칸 번호는 main 9054 뒤로, ㅁ자 해소(슈퍼 창고·꽃집 냉장실·채소가게 창고·이자카야 주방·화장실·초밥 주방 칸막이) (`3c0e8cf`)
- **jp-city** — 관문 5회차 반영 다시 굽기 — 작은 가게 여섯 업종별 평면, 라멘 식권기·센토 노렌 문 (`a418437`)
- **jp-city** — 2묶음 다시 굽기(관문 3회차 반영) — 코인세탁 9×8, 라멘 스툴 (`a3bf4dd`)
- **jp-city** — 2묶음 3회차 다시 굽기 — 센토 남녀 분리·작은 가게 뒷방 없앰·뒷방 셋 분리·라멘 주방 줄, 빈 바닥 수치 sq 2 전부 (`4f7f8aa`)
- **jp-city** — 2묶음 2회차 다시 굽기 — 가구 244, 업종별 뒷방·라멘 L자·자시키·차분한 나무 바닥, 장소 id 크기 맞춤, 대조 시트 스크립트 (`b1bdd66`)
- **jp-city** — 참고문서 다시 굽기 — 용도 「일본 가게·공공 실내」 문서 20·그림 19, 집 실내 가구 사전 220종 (`20f00d8`)
- **jp-city** — 2묶음 예제 19곳 도구 검사 OK·다시 굽기 — 층층 장롱 태그가 「계단」이라 엔진이 밟는 계단으로 그리던 것 정정, 위키·스킬·도구 목록 (`7b50786`)
- **jp-city** — 참고문서 용도 「일본 가게·공공 실내」 — 장소 목록·거리 문 잇기·예제 19곳, 집 실내 「없는 것」 정정 (`306b592`)
- **jp-city** — 2묶음 실내 블록 5개 굽기 — 가구 97→220·바닥 18·벽면 11·탁자 5·탁상 44, 분류 10종 추가, 예제 19곳(places2.json) (`700c7df`)
- **jp-city** — 일본 실내 집 보강 interior_home2 — 베란다·맨션·목조 아파트·단층집 20종과 방 3곳 (`e89925d`)
- **jp-city** — 일본 실내 공공 블록 interior_public — 목욕탕·코인세탁·파출소·의원 가구 31·탁자 1·탁상 4, 데모 4실 (`e85a5b1`)
- **jp-city** — 일본 실내 음식점 interior_food — 바닥·벽 5, 카운터·탁자, 가구 21, 탁상 6, 데모 4실 (`3b3b551`)
- **jp-city** — 상점가 가게 interior_shop 블록 — 빵집·서점·약국·꽃집·채소가게·이발소 가구 30종과 데모 방 6개 (`e5f8306`)
- **jp-city** — 편의점·슈퍼 실내 interior_konbini 블록(cv- 31종)과 데모 방 둘 (`9c2b826`)
- **jp-city** — link_jp_city_interior — 거리 건물 문 ↔ 실내 장소를 한 번에 잇는 조수 도구 + 런타임 QA (`a26bf38`)

### 수정

- **event** — 안 쓰는 COMMAND_SCHEMA import를 뺀다 (`c7ca761`)
- **harness** — dungeon-chipset edges-r1 2차 — 불규칙 장면·울퉁불퉁 가장자리·여러 단 낭떠러지·얼음 두 안 (`3a4af1b`)
- **harness** — dungeon-chipset cave-r1 약한 후보 다시 — 몸통 변형·바위 혹 천장·끊긴 층리·둥근 덩이 (`8667d96`)
- **harness** — murim-chipset inn-r1 — 앞 걸상을 받침 앞으로, 장면 8×8, 줄 B 탁자 소품이 얼굴로 안 읽히게 (`6083555`)
- **jp-city** — 관문 12회차 — 맨션 LDK 한 줄 늘려 홀→LDK 두 줄 길, 킷사텐·꽃집·초밥 계산대 앞 두 줄, 채소가게 서쪽 선반을 재고 선반으로, 센토 동쪽 구석; 검사기가 가려진 통로·1칸 목·막다른 1칸·계산대 앞을 경고, 1칸이 맞는 곳은 예제 narrow 로 밝힘 (`116f962`)
- **jp-city** — 편의점 방 사각형도 한 줄 늘림 (`beba438`)
- **jp-city** — 관문 11회차 — 계산대 앞 두 줄(편의점 한 줄 늘림·채소가게·꽃집 다시 짜기), 서점 섬 한 줄 내림, 빵집·의원·이자카야 1칸 목 없앰, 슈퍼 가려진 통로 없앰, 센토 안마의자, 약국 빈 바닥 위 미닫이 뺌; 검사기 --grid·hid(가려진 1줄 통로) (`bc8232b`)
- **jp-city** — 관문 10회차 — 편의점 쿨러 앞 2줄, 슈퍼 2칸 세로 통로 둘, 센토 탈의실 가운데 비움; 통로 규칙을 주 동선 2칸·진열 사이 1칸 허용(조건 셋)으로 (`feba18e`)
- **jp-city** — 관문 9회차 — 편의점 쿨러 벽 4칸, 이자카야 의자 방향·입구 계산대, 의원 대기실 두 칸 통로, 탁자 다섯 종·입구 위치 문서 (`ba2d97e`)
- **jp-city** — 맨션 2LDK 평면 — 현관 홀에서 화장실·탈의실, 욕실은 탈의실 안쪽, LDK 북쪽에 방 둘(18×19) (`2f252ee`)
- **jp-city** — 약국 섬 사이 화분 대신 체중계(약국 단골 소품) (`244515f`)
- **jp-city** — 약국 진열 섬 사이 화분 뺌 (`92de3ce`)
- **jp-city** — 가게 실내 5곳 뼈대를 달리하고 계산대를 입구 쪽으로 옮김 (`46dca2f`)
- **jp-city** — 실내 예시 5곳 라운드7 지적 수정 (`c469b64`)
- **jp-city** — 이자카야·초밥집 실내 ㅁ자 해소 — 칸막이 주방·ㄱ자 알코브 구조 (`1d452e0`)
- **jp-city** — 슈퍼·꽃집·채소가게 ㅁ자 해소 — 칸막이와 노렌 문 너머 뒷방 창고 추가 (`cbe7e0b`)
- **jp-city** — main 의 exitWidth 규칙에 맞춤 — 예제에 출구 폭, 짓는 스크립트가 넘김, 맨션 베란다 남쪽을 벽으로(출구 덩이 하나) (`8634f17`)
- **jp-city** — 음식점 넷 평면 뼈대 분리(ㄱ자 카운터·동쪽 주방 열·북서 주방+다다미·벽붙이 카운터+창가 탁자), 커피잔 추가 (`7e36c82`)
- **jp-city** — 관문 6회차 — 색인 출구 규칙(모호하면 거절)·의원 문 문구·「없는 것」 절 정리·편의점/옛집 짜임 문장, 같은 뼈대 검사(같은 가구·같은 자리) (`f98fdd1`)
- **jp-city** — 작은 가게 여섯의 평면 구조를 업종별로 다르게 (`48db7fe`)
- **jp-city** — 라멘 식권기 상자형으로·센토 노렌을 통로 문틀에, 의자·대야·체중계 정리 (`3b18bc5`)
- **jp-city** — 관문 5회차 — 안내 문장 장소 id 를 placeId 에 맞춤·검사, 맨 아래 줄 틈 두 군데면 거절, 같은 틀 반복 검사(SAME), QA 요약에 커밋·실행 방식 (`60af681`)
- **jp-city** — 관문 4회차 minor — 코인세탁 짜임 문장 정정, 여탕 씻는 자리에 대야 (`35ca1a4`)
- **jp-city** — 관문 3회차 — 코인세탁 통로 2칸(9×8)·라멘 스툴, 문 잇기 출구 5칸 이상 거절·도착 칸 실내 절반 도달, 색인에 출구·도착 규칙 (`12df44d`)
- **jp-city** — 상점가 여섯 — 꽃집·채소가게·이발소 뒷방 없애고 맵 줄임, 뒷방 셋 벽·바닥·가구 분리, 앞방 북쪽 벽 가게별 장식 (`5d13b79`)
- **jp-city** — 센토 남녀 분리·편의점 뒷방·모쿠진/히라야 빈 바닥 가구 보강 (`bcd5582`)
- **jp-city** — 라멘집 주방 줄·ㄱ자 카운터 확장, 이자카야 좌석 단 방석 분리·동선 정리 (`67cb3e8`)
- **jp-city** — 문 잇기 출구 최대 4칸·도착 칸 방 안 도달 확인, 빈 바닥 수치(sq·e3), 관문 interior-shop 기록 추적 (`f93c8a0`)
- **jp-city** — 음식점 나무 바닥·벽을 널 4px 세로 결로 차분하게, 이자카야 자시키 4×2 다다미 단·디딤돌+신발 (`e38d74d`)
- **jp-city** — 음식점 실내 2회차 — 라멘 L자 카운터·식권기, 이자카야 자시키·구츠누기, 킷사텐 기구, 마루 세로 널 (`2ea5772`)
- **jp-city** — shop interiors fix2 - per-trade back rooms, shared noren, 2-cell sliding-door entrance (`aaf35bf`)
- **jp-city** — 파출소·센토·의원 예제 — 가구 반복 해소, 안쪽 통로 2칸 (`e6a630c`)
- **jp-city** — 편의점·슈퍼·빨래방 예제 2회차 — 뒷방 문틈 정렬, 입구 2칸, 카트·바구니 보관대, 빈 줄 줄이기 (`4d8fe23`)
- **jp-city** — 집 실내 빈 바닥 줄이기 — 맨션 복도 2칸·베란다 용도, 목조 아파트 현관 줄, 옛집 남쪽 방 축소 (`42676fb`)
- **jp-city** — link_jp_city_interior 출구는 맨 아래 줄 한 덩이, 도착 칸은 이벤트·출구 제외 (`2b74516`)
- **jp-city** — 일본 실내 2묶음 예제 3곳을 조수 도구가 경고 0으로 짓게 — 맨션 공용 현관 복도·옆문 위치, 목조 아파트 축소, 옛 농가 현관을 미닫이로·툇마루 채움 (`e699817`)
- **jp-city** — 2묶음 공공 실내 예제 3곳 도구 검사 통과 — 센토 씻는 자리 앞 통로·파출소 갇힌 바닥·의원 약장 앞 접수대 (`6982bdf`)
- **jp-city** — 상가 실내 예제 6곳을 조수 도구가 실제로 짓게 — 뒷방 길 확보·진열 통로·탁상 4층 충돌 해소, 서가·약선반 그림 차분하게 (`0a4354d`)
- **jp-city** — 일본 실내 음식점 예제 4곳을 조수 도구가 실제로 지을 수 있게 (`105204a`)
- **jp-city** — 편의점 예제 12×11로 줄이고 조수 도구로 OK — 계산대·핫케이스·커피 윗면, 뒷방 바닥 정리 (`47fc506`)
- **jp-city** — 문 잇기 QA — 순간이동 페이드 뒤에 찍는다 (`f00e739`)

### 문서

- **openwiki** — 던전 컨셉 연구 — 16비트 JRPG 원형 24·새 줄 D~G·웨이브 W5~W11 제안 (`d9fd1db`)
- 쇼케이스 주의점에서 내부 호스트 이름을 뺀다 (`e1966fe`)
- **jp-city** — 통로 폭 규칙 — 1칸이 맞는 곳은 narrow 로 밝힘, 집은 이 절 밖, 검사기 경고 넷과 ~ 칸 (`9463080`)
- **jp-city** — 가게 규칙 — 통로 2칸과 방문 1칸을 구분 (`c8395cd`)
- **jp-city** — 위키 — 문 잇기 출구 규칙·QA 세 판·판정 근거 (`6f52851`)
- **jp-city** — 입구 폭 규칙 — 매장 2칸, 공공·집 1칸 (`e365b5f`)
- **jp-city** — 2묶음 고치기 2회차 작업자 지침 (`e93ba70`)
- **jp-city** — 2묶음 가게·공공·집 보강 작업자 지시서 (`9cd2007`)

### 테스트

- **jp-city** — 문 잇기 런타임 QA 86/86 (e0f271e8f1) (`b1bdd61`)
- **jp-city** — 문 잇기 런타임 QA 86/86 (3c0e8cf6bb, main 합친 뒤) (`9fe2513`)
- **jp-city** — 문 잇기 런타임 QA 86/86 (a4184375dc) (`19a5eb3`)
- **jp-city** — 문 잇기 런타임 QA 최신 맵 86/86 (`9fb19da`)
- **jp-city** — 문 잇기 런타임 QA 3회차 86/86 (`93a0673`)
- **jp-city** — 문 잇기 런타임 QA 장소 21곳 86/86 — 계단 왕복·실내 양 끝·되튕김 없음 (`d1f929c`)
- **jp-city** — 문 잇기 QA 장소 21곳 3판·계단 왕복·되튕김 확인, 참고문서 가게 규칙 절·출구 문장 정정 (`c5c20a5`)
- **jp-city** — 문 잇기 런타임 QA 7곳 21/21 — 편의점·이자카야·킷사텐·빵집·옛집·1K·단독주택, 문 앞 한 줄 보도는 옆에서 발판으로 (`ef2662f`)

### 잡무

- **store** — 일본 도시 미리보기 5장(시트 포함 6장 상한) (`d9fce2b`)
- **store** — 일본 도시 팩 소개·미리보기에 가게·공공 실내 (`c1065e9`)
- **harness** — dungeon-chipset 관문 기록(외곽선 규칙 경고 포함) (`421334f`)
- **harness** — dungeon-chipset edges-r1 관문 기록 (`f913f6a`)
- **harness** — murim-chipset 관문 기록(외곽선 규칙 경고 포함) (`66d74c8`)
- **harness** — murim-chipset 탁자·걸상 배치 기준 — 사용자 지적(frame-r1 장면) (`c5b1f99`)
- **jp-city** — 관문 interior-shop 13회차 통과 기록 (`4ae632e`)
- **jp-city** — 문 잇기 런타임 증거 — 관문 12회차 고침 뒤 86/86 (`f81ce73`)
- **jp-city** — 관문 12회차 고침 다시 굽기 (`3f04ee7`)
- **jp-city** — 문 잇기 런타임 증거 — 관문 11회차 고침 뒤 86/86 (`3f106d0`)
- **jp-city** — 관문 11회차 고침 다시 굽기 (`7108217`)
- **jp-city** — 문 잇기 런타임 증거 — 관문 10회차 고침 뒤 86/86 (`a80f82e`)
- **jp-city** — 관문 10회차 고침 다시 굽기 + 검사기 통로 폭 지표 w2·cut, 1칸이 맞는 곳(카운터석 뒤·직원 길) 규칙 (`b973baa`)
- **jp-city** — 문 잇기 런타임 증거 — 관문 9회차 고침 뒤 86/86 (`0a79e05`)
- **jp-city** — 관문 9회차 고침 다시 굽기 (`0d4e0ac`)
- **jp-city** — 문 잇기 런타임 증거 다시 — 21곳 86/86 통과 (`4344b2c`)
- **jp-city** — 맨션·약국 다시 굽기 — 실내 예제·참고문서·관문 시트 (`4320481`)
- **jp-city** — 관문 interior-shop 8회차 기록 (`6905ca3`)
- **jp-city** — 관문 interior-shop 7회차 기록 (`e9cdbcb`)
- **jp-city** — 관문 4회차 반영 다시 굽기 (`d806613`)
- **jp-city** — 2묶음 실내 예제 렌더(1x·x2·x3) (`7271e5f`)
- **jp-city** — 굽기 보고·키트 색인·번호 핀(2묶음 실내 1018칸) (`b5ff9f8`)
- **store** — 일본 도시 팩 미리보기에 집 실내·학교·노면전차 거리 — 운영 판 4(칸 9023·부품 537·참고문서 11), 버들항 판 3 게시 (`b402d94`)

## 0.180.0 — 2026-10-08

### 기능

- **harness** — space-craft 에 조선·사극 과제 2개(주막·관아 동헌) (`5733fea`)
- **ai** — 시공(build) 역할 — 타일·맵·게임 전체 짓기는 시공 모델로, 나머지는 실행 모델로 (`36a359c`)
- **ai** — 조수가 번들 조선 칩셋(joseon_baram)을 찾게 — 지시문 줄·장소 검색 동의어·낱말별 검색 (`1184062`)
- **harness** — space-craft 그림 판정자·판정자 보정·사람 판정 시트 (`1f9e0ea`)
- **harness** — space-craft — 조수 공간 제작 시각 품질 1~2단계 (`7d4f95a`)
- **ai** — 조수가 기존 레코드를 통째로 다시 쓰면 거부 + patch_event_page (`ec5b249`)
- **ai** — 새 설정의 조수 기본을 gpt-6.1-sol 로, 작문만 Gemini (`c03c0a6`)
- **ai** — gpt-6.1-sol 을 Codex 경로에서 실제로 부를 수 있게 + 조수 하네스 모델 지정 (`979c3b2`)
- **concepts** — 피드는 지금 칩셋으로 지을 수 있는 컨셉 20개만 (`9a9e8a4`)

### 수정

- **ai** — 조수 워커가 공용 DB 참고 이미지를 SQLite 에서 바로 읽기 — 「fetch() URL is invalid」 (`286b412`)
- **tiles** — 업로드 그림판에서 이식한 칸을 그 그림판의 칸 배치로 그리기 — 공용 DB 기물이 맵에 안 보이던 문제 (`8b8a95e`)
- **qa-game** — 맵 소실 확인을 헤드리스에서 규칙으로 답해 실행이 죽지 않게 (`644f75e`)
- **ai** — 조수가 빈 값으로 채운 선택 칸·장면 종류에 안 쓰는 칸을 거부 대신 빼기 (`fb99045`)
- **ai** — 버들항 마을을 빈 시작 맵에 짓기·기후 theme 의 houseCount 무시 (`881f735`)
- **ai** — 실내 평면의 막힌 여백을 잘라 짓기 + space-craft 입구 검사를 참고로 (`1393774`)
- **ai** — 되돌려 보낸 DB 레코드는 거부 대신 바뀐 칸만 적용, event 안 replacePages 저장 막기 (`4f25a01`)
- **harness** — assistant-capability 공용 DB 사본을 실행당 하나로 하고 과제마다 하드링크 (`665dd33`)
- **concepts** — 라인업에서 일본 도시 칩셋에 무대가 없는 둘을 무대가 있는 둘로 교체 (`801db05`)

### 성능

- **ai** — 이벤트 명령 스키마의 분기·두 번째 목록에서 설명과 kind 목록 반복 빼기 (`7e6eb1d`)
- **ai** — 조수 호출마다 실리던 무관한 도구 설명·공간 규칙 덜어내기 (`45b3cab`)

### 문서

- README 를 언어별 파일로 나눈다 (`aafebca`)
- **openwiki** — 칩셋 로드맵 — 3회차 결과, 무림 A·B·던전 A·B·C 컨셉 줄 (`d4206b8`)
- **openwiki** — 로드맵 W1-A 두 원인 고침 (`d0db0d5`)
- **openwiki** — 무림 수련장 목인장 소실 = 같은 이식 배치 버그(조수가 안 보여서 지움) (`99465c6`)
- **openwiki** — 칩셋 로드맵 W1-A 진행 상황 (`2e99d96`)
- **openwiki** — 공용 칩셋 빈칸 목록(장르 프리셋×칩셋, 13개)과 로드맵 Phase 1 웨이브 (`31fb322`)
- **openwiki** — 공용 칩셋 로드맵 Phase·Wave — Phase 0 진행 상황 (`5cbed09`)
- 4개 언어 README 와 사이트용 쇼케이스 자료 (`ea1b3c4`)

### 테스트

- **evidence** — 라인업 20개 피드 화면(카드 20·칩 12·안내 문구) (`24b1bf2`)

## 0.179.1 — 2026-10-08

### 수정

- 골든 프로젝트가 지워진 EasyRPG 타이틀을 가리키지 않게 한다 (`e0b25ff`)

## 0.179.0 — 2026-10-08

### 기능

- **concepts** — 사용자가 받은 컨셉 330개 중 20개로 앱 번들 교체 (임시 7개 대체) (`2a3fc69`)

### 수정

- **concepts** — 스토어가 답했는데 컨셉이 없을 때 「인터넷에 연결하면」 대신 「앱에 든 기본 컨셉만」 (`a1e33c1`)

## 0.178.0 — 2026-10-08

### 깨지는 변경

- **start** — 새 게임·새 프로젝트를 컨셉 피드 하나로 — 런처 첫 화면·메뉴·첫 부팅 환영 (`3290cc9`)

### 기능

- **i18n** — 컨셉 피드 문구 en·ja·zh (`8290925`)
- **start** — 새 게임·새 프로젝트를 컨셉 피드 하나로 — 런처 첫 화면·메뉴·첫 부팅 환영 (`3290cc9`)
- **start** — 컨셉으로 만들기 — 런처·메뉴·첫 부팅 처리기와 편집기 덮는 창 (`2e9b94e`)
- **start** — 유튜브식 컨셉 피드 — 칩·검색·무한 스크롤·상세·살짝 바꾸기 (`d721788`)
- **concepts** — 입력 문장 → 컨셉 초안·도트 썸네일, 기획에 타일셋 힌트 (`42de3f2`)
- **concepts** — 피드용 컨셉 출처 — 스토어 쪽 읽기와 비상용 번들 (`78874b2`)
- **harness** — game-concepts 공식 컨셉 하네스 (`353247c`)
- **electron** — 스토어 컨셉 중계 채널 (`2208a78`)
- **store-server** — 컨셉 피드 표·목록·상세·만든 수·운영자 게시 (`995bcf2`)
- **concepts** — 컨셉 카드 형식과 컨셉→게임 기획 변환 (`a2e8b4e`)

### 수정

- **harness** — game-concepts draw 가 그림 서버 재시작에 한꺼번에 실패하지 않게 연결 오류만 다시 시도 (`acbb713`)
- **concepts** — 리뷰 반영 — 늦은 비슷한 컨셉은 그 칸만, 만드는 중 닫기·두 번 만들기 막음, 첫 부팅도 메뉴와 같은 장르 씨앗 (`1da25e2`)
- **start** — 내가 쓴 컨셉의 비슷한 컨셉을 출처에서 채우고 떠 있는 오류를 불투명하게 (`8da0c7d`)
- **concepts** — 내가 쓴 컨셉도 AI 연결 관문을 먼저, 통신 오류는 바로 보이고 글쓰기 모델이 없으면 가벼운 모델로 (`bc2db76`)
- **start** — 런처 위 막대 단추 줄바꿈·언어 선택 폭, 떠 있는 오류 불투명, Electron 탐침 AI 대역 (`100fddb`)
- **license** — carry Phaser's MIT notice in exported games (`777144c`)

### 정리

- **ai** — stop hard-coding other vendors' OAuth client values (`8c24521`)

### 문서

- **openwiki** — 컨셉 피드 — 시작 화면·장르 팩·스토어·첫 사용자 흐름, 런처 Electron 탐침 다시 씀 (`8449665`)
- **plan** — 컨셉 피드 구현 계획 (`9ab7b03`)
- **spec** — 새 게임 = 컨셉 피드 설계 (`12569e9`)
- **openwiki** — record post-purge public snapshot size and leftover tileset labels (`87f647e`)
- **license** — name the public repo OpenRPGMaker and add RPG Maker non-affiliation notice (`ad77ef5`)

### 테스트

- **evidence** — 컨셉 피드 실제 앱·브라우저 화면 증거 (`15db844`)
- **concepts** — 피드 만들기 처리기 인자 타입, 설계 문서 실행 메모 (`81c2575`)

### 잡무

- **license** — third party notices and audit-driven public exclusions (`7c4f2d3`)
- **license** — name OPRN as the licensor (`c005ab8`)
- **oss** — keep the original Brendan walking sprite out of the public snapshot (`9386063`)
- **oss** — drop dangling castle regions link and survive broken links in export (`e81d10c`)
- **oss** — export a public OpenRPGMaker snapshot from one commit (`2705ebb`)
- **oss** — pre-publication scan and public snapshot exclude list (`1c6d832`)
- **license** — editor under SUL, runtime MIT, games and outputs free (`dfe0ac1`)

## 0.177.1 — 2026-10-08

### 수정

- **assistant** — align single-cell exits and validate portal placement (`56b86b3`)

### 문서

- **assistant** — preserve raw verification exit evidence (`f08811f`)
- **assistant** — record verified exit events and runtime round trips (`203da6f`)

### 테스트

- **assistant** — verify exit coordinates and retain saved checkpoint evidence (`0b0f5c0`)

## 0.177.0 — 2026-10-08

### 기능

- **interior** — 마법 학교 방 짓기 역할표 · 조립 부품 가구 · RPG Maker 오토타일 블록 · AI 초안 (`b3b09bb`)

### 수정

- **jp-city** — 마루 줄 밀기 해시·광택·이음새 — 적대적 관문 interior 12회차 통과 (`fc8b979`)

### 문서

- **interior** — 역할표 — 오토타일 블록·AI 초안·조립 부품 가구·마법 학교 번들, build_wizarding_space 는 네모만 (`12c60b2`)
- **evidence** — 맵 기물 공방·스토어 사후 확인 화면 캡처 (#2326·#2327) (`3d42236`)

## 0.176.0 — 2026-10-08

### 기능

- **ai** — 다른 맵 실행을 메인 대화에서 떼어 「다른 스레드」 트레이로 (`d0afbc8`)
- **qa-game** — QA_IMAGE_PROVIDER=codex also routes title key art (`b8f84df`)
- **qa-game** — gen runs the genre-preset team path like the browser (`c7c871b`)

### 수정

- **assistant** — adversarial review of the romance preset first build (`940bb15`)
- **assistant** — first-build opening rejects JSON-escaped quotes in narration (`d943cf5`)
- **assistant** — rebuilt interiors carry start position and stranded events onto the new floor (`65fbf43`)
- **electron** — packaged assistant worker reads bundled reference images from the unpacked renderer dir (`e0e1518`)
- **assistant** — first-scene interiors get a visible exit, story routes start as a real walk (`836bf5f`)
- **assistant** — genre-preset first build no longer fails on an unreachable opening receipt (`37741da`)

### 정리

- **ai** — ⋯ 메뉴를 자주 쓰는 3줄 + 「고급·진단」 접힘으로 (`7cb1e84`)

### 테스트

- **e2e** — ⋯ 메뉴 고급·진단 접힘을 열고 누르도록 (`a5acd24`)

## 0.175.0 — 2026-10-07

### 기능

- **interior** — 업로드 칩셋 방 짓기 역할표 만들기 — 타일셋 「방 짓기」 탭 (`c576adb`)

### 정리

- **purge** — remove scripts, tests, wiki pages and evidence tied to deleted chipsets (`556a4c5`)
- **purge** — drop removed tool names from blueprint and skill notes (`3148de8`)
- **purge** — remove forest, climate, Tibo and shared-village defaults and dead tool-name tables (`f7322cd`)
- **purge** — remove pack-town, PAW, dungeon/interior session, forest recipe and tall-grass tools (`0c0a491`)
- **purge** — remove forest/combined-town village, house, fence and castle generators and village contract (`d9c9b9d`)
- **purge** — remove demo and showcase projects drawn on deleted chipsets (`ed31551`)

### 잡무

- **assets** — delete third-party art, audio and fonts (copyright) (`effd2b2`)
- **content** — delete every registered place not drawn on our own chipsets (copyright) (`247ddd5`)

## 0.174.0 — 2026-10-07

### 기능

- **interior** — 방 짓기 역할표 roomKit — build_hand_interior_room 이 칩셋 id 대신 타일셋의 역할표를 읽는다 (`2257ad4`)
- **interior** — 바닥 깔기 규칙 lay rowShift — 줄마다 무늬를 밀어 깔아 넓은 바닥의 반복 무늬를 끊는다(일본 마루 2종) (`a6f9c98`)
- **ai-ui** — 여러 맵·여러 조수 — 맵별 대기열 실행을 존재감에 합치고 맵별 목록으로 본다 (`d2bbae1`)

### 수정

- **jp-city** — 마루 밝은 널을 윗줄 1px 광택으로 — 넓은 빈 바닥에서 띠로 줄 서 보였다 (`668dffd`)
- **qa** — opening-assistant-run takes --model-like for unlisted models; declare brokerResults (`5144e8c`)
- **ai-ui** — 상태 줄의 안 쓰는 store import 제거 (`e2a7c19`)
- **release** — 아이콘 도구가 홈 package.json 때문에 ESM으로 깨지지 않게 한다 (`a978088`)
- **tiles** — old mart floor back; no monster-ball shapes in monster interiors (`4ac8618`)

### 문서

- 방 짓기 역할표 roomKit·바닥 깔기 규칙 (`043ca94`)

### 잡무

- **jp-city** — 참고문서 다시 굽기 — 마루 광택·줄 밀기 반영(엔진 실측) (`ad5994d`)

## 0.173.0 — 2026-10-07

### 기능

- **store** — 「AI 생성」 표시를 코드로 강제 — AI 자산 표식(generatedBy)·buildPack 최종 관문·조수 제안은 늘 켬 (`c1fca61`)
- **store** — 검열 1단계 — 보류 낱말은 확인 대기로, 바로 공개된 상품은 운영 「사후 확인」 목록에 (`7d92281`)

## 0.172.0 — 2026-10-07

### 기능

- **workshop** — 「직접 그려 줘」를 실내 밖 맵으로 — 공방 「맵 기물」이 그 맵 칩셋 색·화풍으로 그려 그 칩셋에 굽는다 (`75780c4`)

### 수정

- **relief** — 높이 붓 표본마다 페이지 통째 굽기를 계획 창 덮어쓰기로 되돌린다 (`7393f26`)

### 테스트

- **workshop** — 맵 기물 공방 가짜 모델 캡처(정의→후보→굽기) (`49a19be`)

## 0.171.1 — 2026-10-07

### 수정

- ci-fast parity를 타입체크와 같은 메모리 락으로 직렬화한다 (`ffe04ff`)
- **workshop** — 맞게 그린 기물을 되돌리던 귀퉁이 검사와 줄 폭 실수에 전체 다시 그리기 (`de23b9c`)

### 성능

- **workshop** — 실내 기물 한 판을 5장→3장, 자기 점검 호출을 뺀다 (`95eb37a`)

### 문서

- **workshop** — 실제 모델로 잰 한 판 시간과 헛걸음 셋 (`feeab06`)

### 테스트

- **workshop** — 칩셋 굽기·번호 이주·모델 답 수선·조수 스토어 도구 테스트, 공방 굽기마다 생기던 빈 칸 44개 제거 (`6a8fbea`)

## 0.171.0 — 2026-10-07

### 기능

- **tiles** — bake the redrawn interiors into monster-overworld and monster-rooms (`32dff05`)
- **tiles** — monster interiors redrawn in the GBA style (`012763f`)
- **monster** — houses and centers get a working second floor (`ead3e1b`)
- **tiles** — walkable stair feet and an appended interior section (`5cb5eb9`)
- **editor** — add categorized prop picker with full catalog search (`0e76cc1`)

### 수정

- **tiles** — keep the monster overworld sheet under its 320-color cap (`474623b`)
- **editor** — refine prop categories and record browser proof (`714f31c`)

### 문서

- **openwiki** — interior redraw, walkable stairs and second floors; stairs runtime QA (`d4d305f`)

## 0.170.0 — 2026-10-07

### 기능

- **jp-city** — 일본 집 실내 장소 다시 게시(관문 interior pass 10회차) (`3859e5b`)
- **jp-city** — 실내 가구 방별 분류 14종 · 계단 난간 · 여러 층 장소 가져오기 · 오브젝트 갤러리 공용+분류 부제 (`f97ce14`)
- **tiles** — bake the GBA-style monster overworld, wild, coast and climate sheets (`9884b8f`)
- **tiles** — town paths in earth tone; drop the original-map renderer (`70c750d`)
- **tiles** — monster town buildings and bridges in the GBA style (`df80428`)
- **tiles** — monster overworld ground and trees redrawn in a GBA 2nd-gen style (`285523f`)

### 수정

- **jp-city** — 짓는 법 문서에서 뺀 2층 장식 문 구절 삭제, 2층 복도 벽면에 벽시계·달력 (`7102ee5`)
- **jp-city** — 매트 술 두 칸 폭으로 보이게, 인터폰 = 벽걸이 분류, 이불 짝에서 자기 자신 뺌, 러그 문구 통일, 블록 자체검사·현관 데모 그림 다시 굽기 (`73a50fb`)
- **jp-city** — 러그는 2칸 가구 밑이 아니라 따로(사전·예제·규칙 일치, 거실 러그 남동으로 되돌림), 매트 설명 붉은 갈색 테두리, 2층 복도 장식 닫힌 문 뺌, 사전 w×h 뜻 명시 (`4fbdee1`)
- **jp-city** — 원룸에 공부 책상·의자·스탠드, 1층 거실 러그를 좌탁·소파 밑으로, 욕실 매트는 탈의실·세탁 분류, 참고문서 분류 순서 = categories.py (`b9eaef6`)
- **jp-city** — 현관 매트(베이지·주황 테두리·술)·슬리퍼(발등 띠+깔창)·아가리카마치 단 앞면 다시 찍음, 매트·슬리퍼는 마루 줄 규칙, 편집기 probe 상세 칸 확인 (`1fd6894`)
- **harness** — GBA redraw passes the overworld checks honestly (`76e153b`)

### 문서

- **jp-city** — 참고문서·런타임 화면 다시 굽기(새 현관 매트·슬리퍼, 매트 자리 규칙) (`85c45fe`)
- **jp-city** — 실내 참고문서 다시 굽기 — 가구 사전에 category·categoryKo, 짓는 법에 분류 14종, 새 계단 그림(엔진 실측) (`9832e08`)
- **jp-city** — 실내 분류·계단 난간·여러 층 가져오기 위키, 런타임 QA 다시 찍음(15/15), 편집기 probe netns 실행기 (`a17d8cb`)

### 잡무

- **jp-city** — 편집기 probe 증거 다시 찍음 (`6c8adef`)
- **jp-city** — interior_entry 자체검사 그림(새 계단) (`ac2c6f3`)
- **harness** — keep the monster sheet redeploy script in the harness (`affe07a`)
- **harness** — bring tileset-authoring sources and seeds onto main (`daf89e1`)

## 0.169.0 — 2026-10-07

### 기능

- **store** — 팩에 캐릭터 칸 설명(content.characters)을 싣고 넣을 때 조수가 생김새로 찾게 한다 (`ab80156`)
- **ai-ui** — 지도 이름표 · 상태 줄 · 받은함으로 AI 작업을 한눈에 (`fa46c58`)
- **workshop** — 고른 기물을 손 도트 실내 칩셋에 굽기(공방 2단계)와 조수 「직접 그려 줘」 연결 (`06c0d70`)

### 수정

- 마법 학교 캐릭터 공급자를 하네스 카탈로그 계약에 연결한다 (`9631af0`)
- **ai-ui** — 상태 줄의 안 쓰는 needsUser import를 뺀다 (`9333181`)

## 0.168.0 — 2026-10-07

### 기능

- **wizarding** — 기숙사 침실 — 사주식 침대·트렁크·옷장·서는 거울 등 조각 9 + 빌더 변형 shared.dorm (`bc70dd4`)
- **super-harness** — 해리포터 테마 팩을 공용 번들 wizarding_world 로 받는다 — 세계관·낱말·재료 관문, 조수 경로에 기숙사 낱말 (`57aaadc`)

### 수정

- **building-review** — 소품 심사에서 우물 광장·모래밭 같은 대형 제외 (`7e5e934`)

## 0.167.0 — 2026-10-07

### 기능

- **building-review** — 소품·울타리 프로필 beodeul-props + 라운드 1(기존 73개 + 새 울타리 3종) (`c6364fc`)
- **assistant** — 스토어 도구 6개와 「없는 타일 → 묻기 → 스토어 → 그리기」 흐름 (`1cce2a6`)
- **asset-store** — 데스크톱 다리에 숨기기·보이기, 코딩 에이전트용 명령줄(storeCli.ts) (`d0f9694`)
- **building-review** — 타일셋 프로필 일반화 + ZIP 대신 스토어 올리기(스테이징/운영) (`be32336`)
- **wizarding** — 방 구조 손보기 — 남벽 윗면 한 줄·가구에 맞춰 방 줄이기·서가 줄+열람 탁자·탁상 소품 다양화 (`d6a3325`)
- **super-harness** — 버들항 건물 검수를 슈퍼하네싱 탭(/harness/beodeul)으로 통합 (`56c6795`)

### 수정

- **beodeul** — 건물 번들의 빈 윗칸을 빈 목록으로 본다 (`98cdc55`)
- **super-harness** — 오래된 체크아웃에서도 검수 탭을 쓰도록 BUILDING_REVIEW_ROOT 지원 (`37cc476`)

### 문서

- **tool-catalog** — 스토어 도구 6개 행 추가 (`abf080c`)
- **asset-store** — 조수와 스토어 — 도구·카드·보안 경계·열어 두기·명령줄 (`ef8ad3f`)

### 잡무

- **asset-store** — 마법 학교 팩 표지를 고친 방(남벽 윗면·탁상 소품)으로 다시 찍음 (`6ffad4e`)

## 0.166.0 — 2026-10-07

### 기능

- **beodeul-building-review** — 결정 로그 저장소화 + 허용한 건물 42채를 공용 번들 beodeul_reviewed 로 설치 (`15f0b57`)
- **asset-store** — 마법 학교 팩 시트 이름에서 원작 이름을 빼고(displayName) 기존 상품에 판본 더하기(--new-version) (`050b729`)
- **asset-store** — 마법 학교 번들을 공식 스토어 팩으로 — 칩셋+참고문서+걷기 칩 35명, 운영 올리기 스크립트 (`92421c1`)
- **beodeul-building-review** — 통나무 후보는 원본 통나무 오두막을 비교 기준으로(게이트 확장, 점수·대조군 불변) (`ad1dfa4`)
- **beodeul-building-review** — round 10 통나무집 7장, r9 탑을 집 바닥선에 맞춤, 화면에 바닥 그림자 (`c73b127`)

### 수정

- **beodeul-building-review** — r9-15/16 접합부를 끝 칸 대신 전폭 칸으로(틈 반려 해소) (`1763958`)

### 문서

- **beodeul-building-review** — round 10 통나무집·탑 접지·바닥 그림자·게이트 통나무 기준 (`d69d453`)

### 잡무

- regenerate openwiki/harness indexes after sync (`f0dff1e`)

## 0.165.0 — 2026-10-07

### 기능

- **jp-city** — 일본 집 실내 장소 게시 — 2층 단독주택(1·2층) jp-city-house-interior-21x15 · 원룸 jp-city-apartment-1k-12x13 (관문 interior pass) (`11edda6`)
- **jp-city** — 원룸 부엌↔방 문(1K), 아이방 좌탁, 문서 정정(장식 광 문·shoji-open 제거), 조수 시험 3·4회 증거(4회: 호출 24·실패 0·269초, 문 직접 배치) (`cabf53a`)
- **jp-city** — 옆문 2종 그림(작업자), 참고문서·변조 10종 재굽기, 런타임 QA 15/15 (`b2d8601`)
- **jp-city** — 옆문 2종 그림 (`ce8a5c9`)
- **jp-city** — 예제에 옆문 4곳(욕실·탈의실·LDK·유닛 배스), 2층 복도 줄임·방문 x7·광 문·건조대·깔개, 변조 sidedoorNotInGap, 규칙 문서·probe 줄 번호 (`82a8af0`)
- **jp-city** — 옆문 종류 sidedoor — 세로 칸막이 3줄 틈 통로 칸에, 조립기 sidedoor-not-in-gap, 자리표시 2종 · 안 쓰는 문 부품 4종 뺌(닫힌 후스마·쇼지 문·화장실 문, 열린 쇼지) (`c7c092f`)
- **jp-city** — 실내 참고문서·변조 9종 재굽기(새 1층·방문), 렌더·런타임 QA 15/15 증거 (`79e88c6`)
- **jp-city** — 1층 다시 짜기 — 복도 동서·화실/화장실을 복도 북쪽에 열린 방문으로, 2층 방문 3·광 문, 원룸 통로 2칸·현관 문턱, 변조 door-not-in-gap, 참고문서 규칙 갱신, 열린 문·카펫·방석·욕조·다다미 그림(작업자 2), read_tileset_reference 한꺼번에 읽기 offset 0 허용 (`cdc70e2`)
- **jp-city** — 열린 방문 4종·현관문 문턱 그림 (`e524c16`)
- **jp-city** — 실내 문 종류 door — 가로 칸막이 1칸 틈에 인방+열린 문틀(통로 유지), 조립기 door-not-in-gap 검사, 자리표시 블록 interior_doors (`0a6c743`)
- **jp-city** — 참고문서 용도 jp-interior — 짓는 법·가구 사전 94종·바닥/벽면 칸·예제 3맵 4층 배열·정상/오류 변조 8종(엔진 실측), 실내 런타임 probe, 위키 (`4e2e4de`)
- **jp-city** — 일본 실내 방 표(rooms.json) — 방 종류 12·건물 2, list_hand_interior_parts({tileset:"jp_city", room}) 가 예제 방 가구를 준다 (`3ef360e`)
- **jp-city** — 일본 집 예제 실내 — 2층 단독주택(1층·2층 계단 이어짐)·원룸 1K 를 조수 도구 그대로 짓는 interior.mjs, 베이지 카펫·신발장은 옆벽 가구 (`172154c`)
- **jp-city** — 일본 실내 LDK interior_ldk — 부엌·식탁·소파·TV·책장 22종, 탁자 2(dining·kcounter), 탁상 9 · 계단통은 아랫줄을 밟는다 (`2085233`)
- **jp-city** — 일본 실내 현관·계단·문·창·벽걸이 interior_entry — 25종, 데모 방 2개 (`0e586b8`)
- **jp-city** — 일본 실내 욕실·화장실(interior_wet)·침실·아이방(interior_bed) 블록 + 방 예제 3종 (`79a640a`)
- **jp-city** — 화실 interior_washitsu — 좌탁·고타쓰·장롱·불단·도코노마·지가이다나·이불·안돈·꽃꽂이·브라운관 TV 와 탁상 물건 4종 (`0a343c6`)
- **jp-city** — interior_shell 구조 표면 — 바닥 7·벽면 5 손 도트, 집 데모 방 (`0fd687d`)
- **jp-city** — 실내 조립기·도구가 jp_city 사양도 짓는다 — build_hand_interior_room·list_hand_interior_parts 에 tileset:"jp_city", 조수 정책 줄 (`9a07801`)
- **jp-city** — 일본 실내 키트 틀 — 바닥·벽면·천장·가구·탁자·탁상 등록기(ikit), 방 미리보기, 사양 굽기(jpInteriorSpec), 구조 자리표 (`97926e1`)
- **monster** — route 1 takes the start theme's name (`953130f`)
- **monster** — pack delegated-approval theme cast (desert man/trainer, coast x3) (`4436af0`)
- **monster** — snow start gets a snow route 1, swapped towns keep their walkers, gyms and badges (`e7dde08`)
- **monster** — chapter-1 townsfolk and route trainers wear the start theme's approved walkers (`f95f854`)
- **harness** — theme-cast-v1 — desert/snow/coast townsfolk and route trainer walking candidates (`e1b8731`)
- **monster** — start theme carries into chapter 1 — gym board by leader type, native route species, themed second town (`8fc159a`)
- **battle** — emerald-style monster battles — terrain backgrounds, Gen3 narration, one foe at a time (`6d12396`)

### 수정

- **jp-city** — 재배치 충돌 표시 한 줄 지움(regionReferenceSnapshots) (`af37e31`)
- **jp-city** — 실내 장소 limitations 는 문자열, 규칙 문장을 새 평면대로 (`0ada44d`)
- **jp-city** — 열린 문짝이 보이게(반쯤 열린 후스마·젖혀진 문)·러그 채도(작업자), 재굽기·런타임 QA 15/15 (`2e12610`)
- **jp-city** — 열린 문짝이 보이게·러그 채도 (`7cd93d8`)
- **jp-city** — 관문 3차 — 카펫 채도·방석·욕조·다다미 짜임 (`d575298`)
- **jp-city** — 실내 층 이동 순서 — 없는 맵으로 가는 links 사전 거절·정책·참고문서 4단계, 조수 시험 하네스 --start-tileset·ctx, 그림 2차 반영 재굽기, probe 길은 canMove BFS (`bb8d560`)
- **jp-city** — 실내 관문 지적 그림 7건 — 카펫 팥색 단색 짜임·다다미 헤리 어두운 띠·창/커튼 세로 주름·신발 한 켤레·욕조 桶·변기 탱크/뚜껑/몸 단계·방석 감색+붉은 술 (`14fba2a`)
- **jp-city** — 실내 관문 1회차 지적 — 2층 복도+방문 칸막이·원룸 부엌 조리대·LDK 한 줄 정렬·화실 벽장, 예제 JSON 이 start·links 를 들고 있게, 조수 시험 --start-tileset (`25caab4`)
- **jp-city** — 실내 가구 쓰임(use)·바라보는 쪽(facing)을 조수 도구의 id 로 — ikit selftest 가 막는다 (`69be9af`)
- **qa** — headless monster tactics heal before a lethal hit (`4707e5a`)
- **battle** — command line keeps its own result after the foe switches (`ed06adc`)
- **battle** — frozen turns read as frozen, emerald ice thaws, swapped gyms swap leaders (`13cc0e1`)
- **battle** — forced switch opens the party list, fainted ally gets its line, themed trainers keep the intro (`934f848`)
- **qa** — monster autoplay keeps move coverage when learning new moves (`5192c32`)
- **battle** — emerald status badge sits in the HP box, Lv labels match, prize lines without broken josa (`1fd577d`)
- **monster** — emerald games skip party followers without field art instead of green slimes (`6093245`)

### 문서

- **openwiki** — frozen turns, thaw, command result lookup, route names, delegated cast (`dd2ecc8`)
- **openwiki** — snow route 1, gym personas, resident remap (`d3aa092`)
- **openwiki** — emerald battle overhaul, chapter-1 theme, theme cast wiring (`250e872`)

### 테스트

- **jp-city** — 실내 런타임 probe 15/15 — 방마다·계단 왕복·원룸, 조수 시험 하네스는 고쳐 지은 맵과 들어오는 착지 칸도 센다 (`5938de0`)

### 잡무

- **jp-city** — 굽기 — 일본 실내 6블록 881칸 덧붙임(핀 9007), jpInteriorSpec 가구 94·탁자 2·탁상 20 (`849d451`)

## 0.164.0 — 2026-10-07

### 기능

- **beodeul-building-review** — round 9 — 대기 19장을 원본 칸 파사드로 재저작(창 위치·종류 통일) (`a489c5f`)

### 수정

- **beodeul-building-review** — r9-09/10 의 떨어진 탑·곁채를 본채에 이어 붙임(UNENTERED_DETACHED_VOLUME) (`83f3eb1`)
- **beodeul-building-review** — 사람이 허용한 r7/r8 8장은 대체하지 않고 복원 (`605ee69`)

### 문서

- **beodeul-building-review** — round 9 창문 파사드 재저작 기록 (`7b88155`)

## 0.163.0 — 2026-10-07

### 기능

- **beodeul-building-review** — r7-23 철회, 공개 49장, 문서 갱신 (`fa2978f`)
- **wizarding** — 조수 공간 빌더 build_wizarding_space·list_wizarding_spaces — 13공간을 게임 크기로 한 번에(벽·문·바닥·가구, 놓을 때마다 통행 검사), 장소 17곳을 빌더 결과로 다시 게시 (`180d5a6`)
- **beodeul-building-review** — 사람이 허용한 그림은 게이트 재검수 면제, round 8 시드 편입 (`bf8e307`)

### 수정

- **wizarding** — build_wizarding_space 가 문 앞 접근 칸(keepClear)을 돌려주고 「비워 둘 것」을 요약에 적는다 — 1칸 문 앞에 NPC 를 세워 길이 막히던 실측 (`82522af`)
- **wizarding** — 조수 실행 결과 반영 — 시작 맵 재건축 때 시작 칸을 spawn 으로, Wizarding 인물 검색어(마법약 교수·호그와트 학생·부엉이 관리인…), 헤드리스 칩 미리보기가 못 읽는 시트 하나로 전체 실패하지 않게 (`c4b202e`)
- **beodeul-building-review** — round 8 의 돌 기단 혼합 벽 2장을 단일 재질 돌집으로 교체 (`3c6350a`)
- **wizarding** — 성채 바닥을 어두운 청회색 판석으로(벽과 명도 차), 붉은 통로 깔개·양탄자 추가 (`f3fef99`)
- **wizarding** — 우체국 안·시계탑·허니듀크 지하 벽과 바닥 구분 — 회벽/널마루, 파란 격자 바닥 제거, 어두운 판석 (`b4a5f69`)
- **wizarding** — 통행 덩이 검사 WZ-ISLAND — 갇힌 주머니가 있는 예제는 장소로 게시하지 않는다 (`2a66811`)

### 문서

- **wizarding** — 조수 실경로 3판 결과(blocker 0·엔딩 도달) (`cca1fd3`)
- **wizarding** — 벽·바닥 수정·통행 관문·조수 실경로 시험 기록 (`4892cce`)
- **wizarding** — 참고문서 입구에 「맵 짓기 — 먼저 build_wizarding_space」 (`fa1a622`)

### 테스트

- **qa-game** — 마법 학교 기획 견본 — wizarding_world 로 실제 게임을 만드는지 재는 판 (`3f53940`)

### 잡무

- **wizarding** — 벽·바닥 수정분 다시 굽기(칸 2472·키트 627), 프로젝트 맵 그림 도구 (`a94ec68`)
- **wizarding** — 벽·바닥 수정 조각 29개 재검수 봉인 (`112f3c4`)

## 0.162.0 — 2026-10-07

### 기능

- **wizarding** — 공용 번들 굽기 — 조각 682·오토타일 6·움직이는 칸 101·키트 621·인물/생물 35명(Wizarding1~5), 참고문서 17용도·장소 17곳 (`fa29461`)
- **wizarding** — 호그스미드 우체국 49·숲 마차 19 — 수정 후 얇은 재검수 전부 PASS (`5fc2a23`)
- **wizarding** — 부엉이 탑 38·시계탑 28·인물 12명 — 수정 후 얇은 재검수 전부 PASS (`1714a52`)
- **wizarding** — 성채 공용 키트 48·퀴디치 44·보트 창고 33·공용 가구 31 — 수정 후 재검수 전부 PASS (`20c4662`)
- **wizarding** — 도서관 29·자연 29·마법 생물 24·마법약 교실 추가 29 — 수정 후 재검수 전부 PASS (`b3fc0c0`)
- **wizarding** — 온실 40조각 — 독립 검수 40/40 PASS (`23d1909`)
- **wizarding** — 마법 효과 30·학생/교수 13명 — 독립 검수 전부 PASS, 불러오기에 모듈 도우미 경로 (`a37ab18`)
- **wizarding** — 병동 29조각 — 독립 검수 29/29 PASS (`848c81a`)
- **wizarding** — 허니듀크 지하 창고 25조각 — 독립 검수 25/25 PASS (`e5acffe`)

### 수정

- **beodeul** — 키트 이름과 시설 칸 접근을 타입에 맞춘다 (`731fabd`)
- **beodeul** — 문 키트 출처와 남은 선택 칸을 맞춘다 (`d2ed04d`)
- **beodeul** — 없는 윗칸·부위 목록을 빈 배열로 보고 문 키트에 출처를 넣는다 (`9092363`)
- **wizarding** — 재검수 시트가 다른 조각을 그려 넣는 키트도 그린다 (`f5171e8`)

### 문서

- **wizarding** — 현재 굽기 수치 (`5f19002`)
- **wizarding** — openwiki 쪽·AGENTS 길 안내, 얇은 재검수 시트 (`cace442`)

### 테스트

- **wizarding** — 번들 id 대조에 wizarding_world 추가 (`fe9ceda`)

### 기타

- **wizarding** — 참고문서 굽기(사전·완성 예제·정상/오류·검사 범위)·장소 게시·검수 봉인 (`921fcc4`)
- **wizarding** — 굽기(검수 통과분만·자리 키 핀·애니메이션 행 맞춤)·번들 배선·캐릭터 시트 카탈로그, native 168조각 먼저 (`86b06d1`)
- **wizarding** — 군별 작업자 주문서 18개 (`e0e259f`)
- **wizarding** — 조각 계약·wzlib(42색 램프·캔버스·등록·블롭 합성·검수 시트)·예제 미리보기 (`9de02ca`)
- **wizarding** — 지팡이 가게·마법약 교실 데모가 실제로 쓴 native 원본 55장 가져오기 (`f30063b`)

## 0.161.0 — 2026-10-07

### 기능

- **asset-store** — 한 명짜리 72×128 캐릭터를 288×256 시트에 넣어서 받기 (`5393951`)
- **beodeul-building-review** — round 8 단순한 주택 8장 초안과 문서 (`f675cf7`)
- **beodeul-building-review** — round 7 중 13장 철회, 게이트 프로필을 체크아웃 경로와 무관하게 (`87a2a77`)
- **asset-store** — 에디터 규격(16×16 칸·캐릭터 288×256 등)에 맞는 그림만 받기 (`aa0f382`)

### 기타

- 버들항 건축·시설·바닥·마을 하네스와 beodeul-building-review (round 7 직전 스냅샷) (`72108fb`)

## 0.160.0 — 2026-10-07

### 기능

- **jp-city** — 지하철 콘코스 둘레 벽·칸 가득 경고 블록·↓のりば, 점자 길을 개찰 통로 한 열로 — 노면전차 probe 가 지상→콘코스→승강장→복귀를 칸마다 걷는다, 관문 transit 11회차·tramstreet 7회차 통과·게시 (`8081c0d`)
- **jp-city** — 노면전차 거리 가운데 띠 3행(서쪽행 가선이 섬 난간 줄로)·남 보도 3행·행선지 분리(駅前/学校前) — 관문 tramstreet 4회차 통과·게시, 콘코스 점자를 승강장 계단 남쪽 입구까지 (`5d4e367`)
- **jp-city** — 노면전차 거리 가운데 섬 단면 — 두 섬 모두 궤도 남쪽(문 보이는 면), 전주 밑동 가운데 띠, 레일 광택·軌道敷 침목 결·일본식 보행 신호기, 보도 시설, 레일·횡단보도 이음 검사 (`c88fc1d`)
- **jp-city** — 노면전차 거리 예제 맵·런타임 QA, 궤도 칸은 차도에서 빼고 나란한 일방 차로 둘을 양방향으로, 키 큰 기물 밑동 y 정렬(foot-dy), 역 소품 4종·노면전차 4회차 (`9340704`)

### 기타

- **jp-city** — 노면전차 5회차 키트(軌道敷·횡단보도 레일·정지선·경계선·foot-dy 태그)·역 5회차(광고·계단 구별·승차 위치)·참고문서는 실제 예제 맵을 굽는다 — 가운데 섬 단면으로 옮기는 중 (`551e983`)

## 0.159.0 — 2026-10-07

### 기능

- **jp-city** — 동네 한 장에 차 흐름·버스(駅前·学校前) — 횡단보도를 지나는 간선도 한 띠로, 출하 플레이어 촬영 (`3cf1e08`)
- **jp-city** — 조수 탈것 도구 — 선로 찾기·auto.subway·정류장 몸 가운데(at:center)·선로 밖 거절, 노면전차 거리 3회차(센터 전주) (`8d56588`)
- **jp-city** — 참고문서 용도 「탈것·노면전차·지하철」 + 노면전차 거리 2회차·역 점자 유도 블록 정리, 학교 관문 통과(8회차) (`afcfb36`)
- **jp-city** — 지하철역 さくら町 예제 맵(콘코스·승강장) + 승강장 지하철 노선·타기, 역 블록 관문 1회차 반영 (`6050656`)
- **editor** — 맵 설정 「탈것(차·버스·전차)」 칸 — 길 그림에서 차 흐름 자동 깔기·노선 켜고 끄기·지우기·차 간격 (`daa494e`)
- **jp-city** — 맵 탈것 조수 도구 set_map_transit·inspect_map_transit + 런타임 QA 통과, 학교 관문 5회차 반영 (`1508727`)
- **jp-city** — 노면전차·지하철 블록 굽기(transit_street 7·transit_station 18) + 학교 관문 4회차(빈칸 4층 제외·수영장 데크 두 줄·덤불 섞기·「30」 차로 안·전봇대) (`a392b01`)
- **jp-city** — 지하철역 transit_station 블록 — 개찰구·발권기·계단·역무실·승강장 32칸+ 선로·역명판·LED·벤치 (`8d8a496`)
- **jp-city** — 노면전차·지하철 거리 블록 transit_street — 궤도(가로·세로·끝)·전차 정류장 섬·가선·전주·지하철 출입구 키트 7종 (`a09d38a`)
- **runtime** — 맵 탈것 노선(transit) — 순수 시뮬레이션·주인공 막기·정류장 정차·타기·QA 훅 + jp-city 참고문서 학교 분류 준비 (`be54cf4`)
- **jp-city** — 탈것 옆모습 3/4 윗면 띠·어두운 옆유리·경차 L4·세단/해치 두 차체 (`e38b2f1`)
- **jp-city** — 대형 탈것 검수 반영 — 버스 문은 왼쪽 면만·옆 유리 짙은 남색·전철 3문·마름모 팬터그래프·지붕 윗면 확대 (`b3ce165`)
- **jp-city** — 대형 탈것 4종 — 노선버스·노면전차·통근 전철·지하철 손 도트 프레임 (`ba9d08a`)
- **jp-city** — 승용·경차·택시·트럭 움직이는 탈것 10종 손 도트 (`075a9fc`)
- **jp-city** — 小学校 블록 24키트 + 교정 예제 맵 + 적대적 검증 관문 + kitmap 공용 생성기 (`bc4adab`)

### 수정

- **jp-city** — 학교 관문 3회차 — 수영장 탈의동→샤워 동선, 고무 칩·ツツジ 植え込み, 빈칸=바탕 흙만·무시 칸 분모 제외, 차선별 「30」(동서 길) (`ed5609d`)
- **jp-city** — 학교 관문 2회차 — 전선 처짐 잘림 수정(모든 경간), 놀이 구역 4줄 재배치·오르기 봉·외발자전거 걸이·등나무 그늘·비오톱, kitmap 입구(anchor) 도달·빈칸 상한 검사 (`7d3af9b`)
- **jp-city** — 학교 관문 1회차 지적 반영 — 25m 수영장·수돗가·학급 밭·정글짐 윗면·정문 4칸·동상, 맵 68×48 재배치 (`cf07585`)

### 문서

- **jp-city** — openwiki 학교·관문·kitmap·탈것·노면전차·지하철역, 조수 정책에 탈것 도구·순서, 툴 카탈로그 두 줄, 小学校 장소 게시 (`24de61b`)

### 빌드

- **jp-city** — 탈것 관문 1회차 반영 굽기(경차 4칸·옆 3/4 윗면·짙은 유리·버스 문 왼쪽 면) + SPEC 갱신 (`3e197f6`)
- **jp-city** — 탈것 14종 시트·목록 굽기 + 미리보기 (`5e8c6a6`)

### 잡무

- **jp-city** — 탈것 관문 3회차 판정 기록(fail — blocker 1·major 2, 4회차 진행) (`aa4723a`)
- **jp-city** — 콘코스 점자 블록 매표기~역무실, 런타임 QA 화면 갱신, 조수 시험 픽스처·위키 (`3cd5060`)
- **jp-city** — 움직이는 탈것 스프라이트 계약·굽기 틀 + 가나·교통 글리프 (`517f964`)

## 0.158.0 — 2026-10-07

### 기능

- **monster** — start town and first route follow the brief's landscape (`851d493`)
- **assistant** — furnish empty outdoor ground on kit sheets with find_empty_ground and furnish_outdoor_area (`1242ac7`)

### 수정

- **assistant** — monster game fingerprint ignores key order; repair keeps an equal hero cell (`74399be`)
- **assistant** — garden fill places a few props even when trees already cover the ground; film tolerates boot tileset resync (`b503405`)

### 문서

- **openwiki** — startTheme, canonical monster fingerprint, journey video (`d01c71c`)

### 테스트

- **qa** — monster journey records an mp4 and walks the opening stretch (`4b2ec53`)

## 0.157.1 — 2026-10-07

### 수정

- count approved preserved sources as authored theme coverage (`82326b4`)
- keep scene-bound coverage links across collection batches (`a390106`)
- accept same-theme actor sheets as preserved-source receipts (`883296e`)
- admit hash-bound native shelf re-review in candidate collection (`8fd9840`)
- **assistant** — check_reachability accepts a single to point (`bb11e1e`)
- **editor** — kit overlay tiles of bundled sheets paint on the upper layer (`00b0e5f`)
- **assistant** — show_map_region reads uploaded charsets stored by ref (`124177b`)
- **editor** — tile_erase finds kit ground via layer backing; reference reads find the category owner (`4fc7427`)
- **editor** — route tiles with an authored layer backing to their declared layer (`6805d68`)
- **qa** — monster autoplay trains in short chunks, heals at 60% HP, retries knocked-out walks (`5106c85`)

### 문서

- record super-harness coverage accumulation and actor action gap (`263da5a`)
- **openwiki** — monster film cases and bundled kit layer routing (`8c49ce8`)

### 테스트

- **harness** — follow-up fixture reads the campaign from ctx.project (`ef92eb6`)
- **harness** — build the follow-up campaign fixture in bun, not inside vite-node (`65026e2`)
- **harness** — film monster-followup — ask the assistant to fill an empty corner of an existing monster game (`de95940`)
- **harness** — film monster cases for the desert and harbor briefs, record gym 1 team (`043dd7f`)

## 0.157.0 — 2026-10-06

### 기능

- **jp-city** — 거리 시설 참고문서·동네 한 장 장소 게시 (`a62fc12`)
- **jp-city** — 동네 지도 — 전봇대 자리 비용 최소화, 전선 5~20칸, 상점가·신사·학교·공원 꾸밈 (`741e8fc`)
- **jp-city** — 간판 가나 섞기·셔터 가게·동네 거점·손 도트 거리 소품 50종 (`fa7176c`)

### 문서

- **asset-store** — openrpgmaker.com 을 Cloudflare 로 옮기고 store 만 프록시 (`c9a8138`)

### 기타

- **jp-city** — 동네 지도 생성기 town.mjs 첫 판 + 전선 폭·문기둥 1칸 수정 (`e68771d`)

## 0.156.0 — 2026-10-06

### 기능

- **jp-city** — 손 도트 일본 건물 53종 + 상점가 줄 키트 6종을 jp_city 번들에 굽기 (`9da6703`)
- **jp-city** — 주택 조립 키트 v1 — 기준 집 부품으로 6종(寄棟·妻入り 切妻+차고·平屋·片流れ·3층 陸屋根·목조 아파트) (`d3a6de0`)
- **jp-city** — 기준 2층 주택 손 도트 시안 v1 — modern3·칩셋 규약(윤곽 sumi, 한 층 32px, 문 16x28) (`5e227b2`)
- **asset-store** — 스토어 파일을 Cloudflare R2 로 내보내기 (`f50c8be`)

### 문서

- **jp-city** — 실제 일본 거리 조사 4편 + jp_city 대조·다음 작업 순서 (`df36277`)
- **asset-store** — R2 토큰에 IP 조건을 걸면 서명 주소가 403 — 기록 (`8460c18`)

## 0.155.0 — 2026-10-06

### 기능

- **monster** — the assistant can name and type all eight gyms and the first route's trainers (`60490f3`)

### 테스트

- **harness** — film save waits for a settled autosave state (`3365fbd`)

## 0.154.0 — 2026-10-06

### 기능

- **monster** — build_monster_game takes the brief's first gym type (`11d475b`)
- **monster** — the old star observatory gets its own hall instead of a ruins copy (`33758be`)

### 수정

- **monster** — no stray stone pair above the route 8 ruins exit (`7d69a7a`)
- **monster** — wooden route signs only outdoors and never three in one corner (`076b061`)
- **battle** — emerald message box spans the band while acting; journey flags text outside the box (`39b1529`)
- **assistant** — monster-game runs skip map layout quality; editor leaves a vanished map (`0e0d326`)

### 문서

- **openwiki** — monster game names/firstGymType, layout gate skip, film monster case (`29bb1ed`)

### 테스트

- **harness** — film-worldmaps keeps the refine findings the user sees (`4ee0529`)

## 0.153.0 — 2026-10-06

### 기능

- **asset-store** — 한·영·일·중 다국어 스토어와 진열대형 화면 (`d12aea3`)
- **monster** — build_monster_game takes the brief's names (`7574758`)
- **monster** — distinct grove, dune and moon towns with real gym buildings (`8753aa6`)

### 수정

- **asset-store** — 다른 언어 화면에서 한글 태그·그림 이름 숨김, 들어 있는 것 정렬, 디자인 문서 갱신 (`cdf5d36`)
- **events** — battle result branches imply branchOnResult; unwrap nested battleProcessing (`cbea00a`)
- **monster** — doors on drawn exits, trainers off grass and stairs, autoplay runs and heals near the fight (`84fa890`)
- **qa** — monster autoplay heals like a player, wakes at the last center (`9ff3172`)
- **monster** — first gym beatable by every starter, runtime journey QA in player.html (`6013172`)

## 0.152.1 — 2026-10-06

### 수정

- bind native wand scene panels and serialize trial animation (`53bc294`)

## 0.152.0 — 2026-10-06

### 기능

- **asset-store** — 공용 캐릭터 그림을 스토어에 진열 — 얼굴·흉상·전신 16표정, 걷기 칩 (#2250) (`2147df5`)
- re-review unchanged native wand shelf with current context (`47a1b29`)

### 수정

- recover native scene reviews and deploy playable drafts with resources (`9de0f9b`)
- recover native review reason format without changing verdicts (`572c855`)
- bind both required native shelf review receipts (`07b13f0`)

## 0.151.0 — 2026-10-06

### 기능

- **asset-store** — 스토어 화면 개편 — 밤의 상점 진열대(웹·에디터 창 공통) (#2247) (`d55c930`)
- wire reviewed native shelf pickup and return in wand demo (`1b89a29`)
- prepare isolated native wand shelf vacancy states (`fbd6655`)

### 수정

- accept identical replacement declarations and clear resolved demo errors (`926364d`)
- show understandable actions in wandshop playable draft (`ba6a993`)
- validate preserved material receipts before layout review (`399da47`)

## 0.150.0 — 2026-10-06

### 기능

- prepare hash-bound native wandshop runtime drafts (`fa89c8b`)
- expose executable draft previews in space progress (`b9f557b`)
- prepare frozen native potions runtime draft packets (`79b31e0`)

### 수정

- prepare absent isolated picker output directories (`2a392fa`)
- bind draft proof to stored bytes and name missing preservation evidence (`56f3d5a`)
- exclude mutable picker databases from drawing specifications (`5d4115d`)

## 0.149.0 — 2026-10-06

### 기능

- create native scene project packets without I/O (`383cc71`)
- add canonical native space persistence adapter (`77d926d`)

### 수정

- recover action requirements from older prepared manifests (`f7ec3f4`)
- retain added action obligations from native receipts (`d554971`)
- **qa** — monster campaign check budget, route tests follow the monster start map (`bedc665`)
- preserve native structure headroom in runtime camera bounds (`886630f`)
- require new actor poses in assembled scene evidence (`8e288c6`)
- show commissioned actor interactions in whole scene examples (`b1f6130`)
- reject stale calibration scope before scene repair admission (`ecc9c7b`)
- **qa** — monster campaign autoplay reaches the ending (`3b96870`)
- **qa** — autoplay carries a monster campaign through three gyms (`f352dcf`)
- **monster** — playable first route — starters out of early wild pools, type-aware headless moves (`4ea4c73`)

## 0.148.0 — 2026-10-06

### 기능

- prepare lossless native actor assets for playable space demos (`3dee886`)

### 수정

- retain full scene scope when repairing completed space demos (`926bf84`)
- preserve approved partial assets and validate native brief paths (`dba898d`)
- retain native frame definitions in shared content libraries (`139d55c`)
- preserve player native charset anchors across session changes (`e356481`)
- keep native component review independent of later scene assembly (`d55f8a5`)
- retain native anchors on route swaps and followers (`cd186e0`)
- preserve authored frame anchors for native action sprites (`a135cd5`)

## 0.147.0 — 2026-10-06

### 기능

- **asset-store** — 운영 Google 로그인 — PKCE(S256) 추가, 자격 증명 적용·검증 절차 기록 (#2237) (`11c41eb`)
- **monster** — keep new campaigns on the bright monster kit and give it its own family (`dfd5433`)
- adopt approved field monster, Emerald UI and music into campaign (`5d63e57`)
- add standalone field monster UI and music review harness (`6b3c913`)
- author distinct professor ranger and captain walking variants (`c1456eb`)
- redesign merchant silhouette and add original-to-revision walk comparison (`f83727c`)
- extract portable Pokemon-like character authoring and review harness (`12d8965`)
- create full template-derived walking cast and reusable review collection (`db07142`)
- support verified character template edits and comparative review (`075571e`)
- author Naru NPC pixel grids and four-direction walking review (`0cd82ec`)
- add native NPC candidate harness with persistent user Allow and Deny (`68ffa0e`)
- preserve generated clip rows with common source raster sampling (`1a2e338`)
- gate native trainer portraits through motion harness lifecycle (`b459c15`)
- add standalone native pokemon motion quality probe (`8c1ec42`)
- import generated opening clips through motion harness lifecycle (`83924fb`)
- add pokemon character motion harness with provenance and strict gates (`e5bdd5b`)
- animate authored professor poses within confirm opening pages (`7a15e33`)
- preserve generated monster candidates and document verified art repair (`ec51fe6`)
- replace schematic NPC art with generated walking and battle views (`68b010c`)
- show authored Emerald trainer portraits during battle introduction (`1050ca3`)
- animate Emerald opening atmosphere with authored title effects and quiet cues (`0fd3ff6`)
- refine all original monster sprites and add native party icons (`126df64`)
- evaluate ordinary monster game requests through actual Pi routing (`be1159d`)
- adopt native Emerald atlases while preserving authored tile layers (`006eca4`)
- add Emerald battle dialogue and monster menu surfaces (`e65fc86`)
- ship seven native Emerald monster tile variants and assembly references (`2a934ea`)
- replace stock fantasy people with original Emerald field cast (`182a88c`)
- provide original pixel title art and compact Emerald title menu (`1e1b1af`)
- produce complete Emerald monster games through the editor assistant (`1f6f6d5`)
- add Emerald shop quantity and confirmation workflow (`26d4047`)
- use the Emerald profile in every fresh monster campaign (`cba45db`)
- restore reusable monster campaign generator and bundled tile definitions (`1f44565`)
- author shared pixel professor introductions for Emerald monster games (`5589097`)
- define reusable Emerald monster production profile and evidence contract (`763b458`)
- require a fresh system review before assistant completion (`6b16773`)
- author collector menus original WAV scores and narrative openings (`839003b`)
- add monster expedition journal and campaign menus (`13ad0c4`)
- give opening assistant independent animatic timelines and researched references (`a20ef87`)

### 수정

- HUD 필수 값·파티 칸 속성·마을 체육관 키를 타입에 맞춘다 (`9b4c103`)
- show assembled space drafts before concept planning (`49b3ca6`)
- 테마 장부 병합이 깨뜨린 타입을 맞춘다 (`640e590`)
- recover completed materials and retire replaced demo components (`fdf87ee`)
- expose parallel native actor action progress in spaces (`8e34778`)
- **assistant** — replacing an untouched blank map is not map loss (`c7206d1`)
- **assistant** — let build_monster_game place its curated cast and point retired chipset refusals at same-family sheets (`fee0380`)
- **assistant** — keep monster-kit maps out of the PAW-only modern gate (`c83a42a`)
- adopt template NPCs and replace portal arrows with natural entrances (`6a42c94`)
- shorten merchant scarf tail and remove dark back stripe (`fa1c807`)
- use distinct NPC bodies and reject shared-body casting candidates (`0df3072`)
- adopt original Brendan walking pixels with per-pose fidelity gate (`edec4e7`)
- rebuild hero silhouette and alternate native walking poses (`f7363fd`)
- refine hero face cap backpack and walking footwear (`879ec6a`)
- redraw native hero against actual Pokemon character chipsets (`714960c`)
- refine one native hero through hostile GIF quality review (`107a0c6`)
- redraw Emerald characters with native Python pixels (`e73a08e`)
- enforce native Emerald sprite dimensions and ship reviewed motion (`a4d9458`)
- compare torso area in one idle-relative canonical band (`1cccae8`)
- fit shared raster scale to anchored source extents (`4fdb2a4`)
- measure stable skull roots and register motion comparisons (`a798e59`)
- separate Emerald native sprite dimensions from editor containers (`1065b21`)
- render native emerald trainer portraits at uniform scale (`5153be2`)
- preserve character frame coherence during source sampling (`f6bc217`)
- revise monster candidates and preserve paired atlas extraction (`ad56b5b`)
- preserve alpha sprite foreground and support reviewed import grid (`121f147`)
- show actual monster EXP progress on battle victory (`e5e40f0`)
- preserve transparent pixels and consistent block size when extracting generated sprites (`69648a7`)
- preserve script MIME types in compiled shop QA (`5645032`)
- ship implicit monster battle backdrops and observe compiled shop (`080918a`)
- target an existing map in whole-game AI change receipts (`c897013`)
- apply current bundled effect migration to campaign exports (`7c3ee5c`)
- keep Emerald detail pages still during menu transitions (`b761e0e`)
- contain Emerald victory rewards in the handheld stage (`975fb21`)
- isolate Emerald shop map and complete pending trade rows (`3dabbef`)
- preserve canonical campaign data during Emerald art adoption (`c3a8d66`)
- refresh shared monster artwork and preserve integer battle sprite scaling (`7feca11`)
- align astralhart battle anatomy with quadruped title stag (`2323592`)
- restore authored ice and arrow tile sliding in current runtime (`804629a`)
- retain indirect Emerald party icon resources in game exports (`281513a`)
- resolve native atlas catalog integration and restore slide rule lookup (`8ff3fb3`)
- inherit authored camera zoom when a saved follow state omits zoom (`c4386d3`)
- retain authored pixel animation resources in existing monster games (`dfe764e`)
- accept legacy monster types and require unique introduction pages (`7c13e3d`)
- record native presentation QA and canonical publication evidence (`a8757c9`)
- keep collector item descriptions visible on compact screens (`b934fb7`)
- distinguish rival and key NPC appearances from the professor (`3184d82`)
- expose actual shop prices and verify native opening controls (`8d8bf16`)
- author readable openings collector shops and safe resident patrols (`360c65c`)
- obtain headless bridge credentials without mounting the editor (`a45a62b`)
- review actual animatic illustrations text and audio references (`0266e05`)
- return real ID candidates for empty exact database lookups (`2766e99`)
- resolve empty read filters and expose actual opening actor identity (`e7b607a`)
- retain widescreen panel proportions in storybook framing (`291832b`)
- handle empty optional fields from structured assistant calls (`83f6318`)
- retain scene session lookup on menu back navigation (`4f03985`)
- keep actor equipment out of collector bags (`6861323`)
- select the first authored menu entry on initial open (`7dcd0a4`)
- preserve authored maps during nonspatial system tools (`dc110b4`)
- keep score hashing within synchronous tool transactions (`6100618`)
- accept structured preset menu calls and report effective skin (`51ef091`)
- show live monster party across common menus and shop previews (`6296033`)
- dogfood collector authoring and recover terrain-blocked saves (`f0bcf45`)
- target party monsters with field medicine and restore move PP (`8f24e2d`)
- preserve animatic timelines through older project hosts (`fe98332`)
- preserve title music across cursor redraws with attract openings (`27d962d`)
- preserve authored monster campaign in assistant preview loads (`e81d914`)
- register monster campaign textures in assistant preview (`a5dd919`)
- keep Korean opening captions together and maintain tool budget metadata (`52e93ce`)
- make Pi opening production generate, inspect and verify real shots (`de6ccc2`)

### 성능

- **persistence** — share field pieces between save text and roundtrip projection (`5aa77a1`)

### 문서

- record Emerald AI production canonical saves and native player QA (`4e4f5e9`)

### 테스트

- record the current opening tool family and the unavailable-generator contract (`562db00`)
- verify generated clip raster coherence and negative controls (`91c2f31`)
- distinguish torso band rounding from actual body drift (`0bb25d4`)
- cover common anchored fit without bypassing gait checks (`eea1c05`)
- guard motion registration against hair tips and two-pixel jumps (`f967d21`)
- verify Emerald native sprite contracts and source raster controls (`1c3a9d6`)
- replay real monster game output through native Pi client application (`ed57d49`)
- record native Continue of genuine predecessor monster saves (`c7e07f2`)

## 0.146.1 — 2026-10-06

### 수정

- freeze prior review outputs before native retries (`e56002c`)
- preserve demo coverage and finish collection before job handoff (`a7f2d3d`)
- wait for native host artwork before attachment review (`c978c24`)
- clear missing production instructions after theme collection (`39404e0`)
- reject stale native checks and support dedicated palettes (`d26edc5`)
- retain collected art during additional theme production (`e790dd6`)
- show native previews from the current approved content directory (`68235fe`)

## 0.146.0 — 2026-10-06

### 기능

- **asset-store** — store.openrpgmaker.com 운영 가동 — 운영자 일회용 로그인 링크, 배포 절차를 실제 배치에 맞춤 (`9589325`)
- **asset-store** — 앱 안 스토어 — Electron 중계·설치·프로젝트 넣기·크레딧·편집기 올리기, 첫 진열 팩 4종 (`fd65a33`)
- **asset-store** — 스토어 서버 — 카탈로그·업로드 검증·자동 공개·신고 숨김·기기 코드 로그인 (`4bb9fc7`)
- **asset-store** — 팩 형식 oprn-store-pack/1 · 넣기·출처·크레딧 공용 모듈 (`d9c3beb`)

### 수정

- clear missing production instructions after theme collection (#2226) (`f76b275`)
- reject stale native checks and support dedicated palettes (#2225) (`b19ac5b`)
- **asset-store** — 보안 검토 반영 — 업로드 용량·고아 blob 청소·신고 남용·판본 바꿔치기·열린 넘김·openExternal 출처·응답 상한 (`7c300dc`)

### 문서

- **asset-store** — openwiki 쪽·운영 배포 절차·테일스케일 스테이징 설치 스크립트 (`4124198`)

### 테스트

- **asset-store** — 왼쪽 막대 목록에 공방·스토어 반영, 운영 스토어 실제 넣기 화면 증거 (`35d0177`)
- **asset-store** — 타이틀 크레딧 창에 스토어 크레딧이 붙는다 (`3b36080`)
- **asset-store** — 실제 Electron e2e — 둘러보기·넣기·저장 재로드·기기 코드 로그인·편집기 올리기·운영자 승인 (`15b96af`)

## 0.145.1 — 2026-10-06

### 수정

- retain collected art during additional theme production (#2222) (`affbd57`)

## 0.145.0 — 2026-10-06

### 기능

- bind multi-actor theme requirements to complete native deliveries (#2217) (`aaed648`)
- produce and collect native theme actor action poses (#2212) (`9f5a1a3`)

### 수정

- show native previews from the current approved content directory (#2221) (`5053374`)
- disambiguate perspective flags for production slots (#2220) (`5adc802`)
- preserve sealed actor manifest bytes across native production (#2219) (`34750fb`)
- bind production review measurements to each native slot (#2218) (`ace5d9e`)
- require complete actor action frames in space demo states (#2215) (`e08ede6`)
- collect current native images without mixing historical attempts (#2214) (`abfe449`)
- reject standing-furniture contracts for ground tiles before drawing (#2213) (`1250b68`)

## 0.144.2 — 2026-10-06

### 수정

- **wild-route** — 버들항 도로를 모랫길·숲 벽으로 다시 깐다 (`aa082d9`)
- apply native review dimensions per item and slot (#2210) (`f63348a`)
- accumulate dedicated art batches before assembling demos (#2209) (`d35301e`)
- accumulate dedicated art batches before assembling demos (`838d705`)
- recover dedicated native art and resume independent review (#2207) (`1926aea`)

### 문서

- **openwiki** — regenerate INDEX after rebase (`65cdc27`)

## 0.144.1 — 2026-10-06

### 수정

- discard and redraw repeated monster bodies (#2205) (`0fa4199`)

## 0.144.0 — 2026-10-06

### 기능

- **assistant** — EasyRPG 계열 칩셋으로 조수가 새 맵을 만들지 못하게 막는다 (`ca6ece6`)

### 수정

- **super-harness** — continue reviewed theme drafts without fabricating user approval (#2202) (`308b73b`)
- 다양한 캐릭터 주문의 원본 반복 배정 방지 (#2201) (`ddaeee1`)

## 0.143.0 — 2026-10-05

### 기능

- 캐릭터 공방 동시 도트 워커 6개 지원 (`5c6e592`)

## 0.142.1 — 2026-10-05

### 수정

- 캐릭터 완성 수와 대량 주문 진행을 명확히 표시 (`82d1986`)
- 연속 제작 대기 상태와 후속 후보 표시 보완 (`830722e`)

## 0.142.0 — 2026-10-05

### 기능

- **super-harness** — prioritize themes and separate concept-led sets from kit extensions (#2197) (`7d1924f`)
- make worldmap brushes adapt to terrain and simplify assistant authoring (`afca1a1`)

### 수정

- 대량 캐릭터 주문이 검토 대기로 멈추지 않게 연속 제작 (`a241adc`)
- **super-harness** — require dedicated theme plans and authored material coverage (#2193) (`d65bda7`)

### 문서

- record vertical worldmap brush verification (`31841c1`)

## 0.141.1 — 2026-10-05

### 수정

- **assistant** — team lead reads the live team project, not its start copy (`10d0ff9`)
- **assistant** — event_command_assist works inside Pi runs (`63f444c`)
- **assistant** — run_scene_test moves a stray adjacent onto a walk step (`88d9284`)
- **assistant** — team lead hears which changes the user declined (`7cdc5ed`)
- **assistant** — make_chase_scene refuses a lost switch that is also the wake switch (`9fa1f1d`)
- **assistant** — scene test rejections name the expected shape for every expect field (`605a8d2`)
- **assistant** — one declined map deletion no longer ends the whole team run (`d27c25b`)
- **assistant** — find_tools only offers tools the run can call (`ac174a5`)
- **assistant** — team lead learns what a reportless member already applied (`c43ea84`)
- **assistant** — refresh request keys during long Pi runs (`e224b0b`)
- **assistant** — Pi client watchdog listens past a page freeze before cutting the run (`101c33f`)
- **assistant** — warn when a boss victory branch pays gold on top of the troop reward (`254ced9`)
- **assistant** — enumerate hand-interior floor/wall/ceiling ids in the tool schema (`4724c7f`)
- **assistant** — expand run_scene_test move count into repeated one-tile moves (`2971f14`)
- **assistant** — infer referencePurpose from the one fully read reference group (`d908b74`)
- **assistant** — skip malformed commands in story-flag pre-pass so shape errors reach the model (`f51ffca`)

### 성능

- **assistant** — heavy wire hashes one value once and remembers recent digests (`59cd6ca`)
- **assistant** — heavy wire keeps hashes only, builds blob JSON on 409 (`4efa7a9`)
- **persistence** — slim contentDigest node memos (identity digest retained 259→198MB) (`0b4fb35`)

### 문서

- **openwiki** — regenerate INDEX (`6acbcb6`)
- **openwiki** — team lead reads the live working copy (`ccd1502`)
- **openwiki** — team userDeclined and worker event_command_assist (`59111e1`)
- **openwiki** — find_tools run scope and recoverable checkpoint rejections (`e270143`)

### 테스트

- **qa** — stress driver treats in-panel decision prompts as human questions (`970321b`)
- **qa** — stress driver stays multi-process and unpins its renderers from the OOM killer (`c37ae04`)
- **qa** — time-box CDP metric reads in stress driver (`06cf87e`)
- **qa** — stress cases export the canonical snapshot for qa:game check (`0635945`)
- **qa** — stress driver samples live heap allocations after send (heap-sampling.json) (`7026638`)
- **qa** — stress driver tolerates editor freezes; replay awaits async reference images (`4e148f3`)
- **qa** — add real-path assistant stress suite (genre team first builds + hard prompts) (`ed58920`)

## 0.141.0 — 2026-10-05

### 기능

- **battle** — author hero magic cels and reuse hydra summon art (#2189) (`e760122`)

### 수정

- **super-harness** — expand concurrent spaces and add full image viewer (#2190) (`0be62ce`)
- **worldmap** — 적대적 시각 QA로 오토타일 연결·거점 복원 수정 (#2187) (`7ac2fac`)
- 캐릭터 참조 전수 교정과 실제 조수 선택 검증 (#2186) (`0114daa`)

## 0.140.0 — 2026-10-05

### 기능

- 통합 GIF 공방과 에디터 전체 원본 캐릭터 제작 (#2130) (`d40e451`)

### 수정

- **super-harness** — resume classroom demos from current native receipts (#2184) (`08d8436`)
- **super-harness** — prioritize finishing spaces and publish approved parking facility (#2183) (`f9d95e7`)

## 0.139.0 — 2026-10-05

### 기능

- **ai** — 조수 「턴 사이 기록」 — 각 턴 밖 프론트 액션만 읽는 표면과 버튼 (`07a68a1`)

### 수정

- **modern-chipset** — isolate Claude worker context as well as Codex (`2c8dfdd`)
- **super-harness** — persist provider retries and recover approved art inputs (`c1a7f7a`)
- **ai** — 턴 사이 기록을 툴바 행 밖으로 — 좁은 도크에서 한 글자 폭으로 눌리던 것 (`02903c2`)

### 문서

- **ai** — 턴 사이 기록 위키를 배치·검증 실측에 맞춤 + 화면 증거 추가 (`ac2e847`)

### 테스트

- **ai** — 복사 스텁에 인자 타입을 붙여 tsc void/string 불일치를 없앤다 (`19a7591`)

## 0.138.0 — 2026-10-05

### 기능

- **harnesses** — share the canonical catalog for unified production planning (#2174) (`c2d1fac`)
- 월드맵 팔레트에 연결 지형 붓과 빈 지도 저작 추가 (`49572a2`)

### 수정

- 월드맵 경사로 폭·빈 칸 채우기·아이콘 설명을 타입에 맞춘다 (`90a8f26`)
- unify audited charset references with full tool evidence (#2175) (`2171170`)
- 월드맵 고개 폭을 맞추고 팔레트 저작 정본 증거 기록 (`ac6c3bf`)

## 0.137.0 — 2026-10-05

### 기능

- **super-harness** — grow keyword seeds into continuous space demos (#2173) (`db5a6f7`)
- **ai** — simplify the first request with progressive disclosure (`4bf51c9`)
- add 300 town props and prioritize selected shared assets (#2170) (`5973e61`)

### 수정

- 캐릭터 칩 이름·태그 전수 조사 및 검색 누락 교정 (#2168) (`6367f81`)
- isolate native drawing worker session context (#2169) (`dbe4304`)

### 문서

- **qa** — record first-request UI and export evidence (`b39b1d1`)

## 0.136.0 — 2026-10-05

### 기능

- require whole-space tile demos before user decisions (#2167) (`9810566`)

### 수정

- preserve prop worker content paths and recover misplaced candidates (`14be169`)
- **worldmap** — separate reusable materials from continent maps (`9dbade9`)
- recover space review failures and report real native outcomes (#2163) (`30b39dc`)

### 문서

- **worldmap** — record canonical material palette browser reload (`298e908`)

## 0.135.0 — 2026-10-05

### 기능

- show live space milestones and actual image outputs (`f433025`)
- **editor** — unify AI workspace and simplify scoped log exports (`132c363`)

### 수정

- **editor** — 쓰이지 않는 measuredWidth를 지운다 (`13fe21f`)
- parallelize isolated space work and bound layout review scope (`299d9ec`)
- 실제 칩 이미지와 선택 ID로 조수 캐릭터 선택 검증 (#2157) (`b242ee4`)

### 문서

- capture AI workspace and log export UI evidence (`8957a4a`)

### 기타

- record workspace interactions and report dev reload limitation (`cccffa2`)

## 0.134.0 — 2026-10-05

### 기능

- add larger smaller and custom-size prop redraw actions (`beaaa10`)

### 수정

- put prop images first and confirm with double-click (`f669c35`)
- **ai** — 저장된 설정의 옛 공장 기본 모델(gemini-3.7-flash)을 3.8 로 소급 승격 (`3e88796`)
- **super-harness** — distinguish queue waits from missing execution links (`a710cab`)
- simplify prop selection and clarify shared database publication (`f1d2b90`)

## 0.133.0 — 2026-10-05

### 기능

- **super-harness** — simplify example and result decisions to allow or deny (`817a1a2`)
- **worldmap** — record live editor assistant and canonical reload (`44b5af5`)
- **worldmap** — implement six playable navigation structures (`5762ad8`)

### 수정

- **super-harness** — size all spaces from content and shared circulation (`223fac9`)
- **super-harness** — recover orchestration faults without user intervention (`b1e305f`)
- **worldmap** — allow dedicated tilesets for newly authored atlas maps (`9f9723d`)
- 데스크톱 앱 상단바 전체화면 버튼이 창을 축소하지 못하던 문제 (`2c080c0`)
- **worldmap** — wait for the native assistant composer when recording (`608ce6e`)
- **worldmap** — retain browser startup diagnostics for live recording (`847079f`)
- **super-harness** — recover malformed review responses without losing verdicts (`5f8c3ef`)
- **assistant** — AI 조수가 깐 NPC 의 기본 이동을 정지에서 배회로 (`21509da`)
- **ai** — allow collapsing the conversation dock (`11c7a95`)
- **worldmap** — keep existing continent map as default (`48e0245`)
- **worldmap** — replace placeholder maps with distinct shared cartography (`a21c6bc`)

### 문서

- **ai** — record conversation collapse UI evidence (`682d622`)
- refresh wiki index after main integration (`7717497`)

### 테스트

- **qa** — NPC 이동 기본값 재현·충돌판정·런타임 배회 증거 스크립트 (`005ffb5`)

## 0.132.0 — 2026-10-05

### 기능

- **super-harness** — collect feedback on rendered space examples (`a55dc29`)
- let assistants author map OST and preload gameplay during openings (`7477188`)

### 수정

- **super-harness** — guide chip choices with side-by-side parts (`2843cb1`)
- capture deferred Phaser keyboard events only once (`f5db3e0`)
- verify saved audio playback at the actual opening handoff (`2b85edd`)

### 문서

- verify integrated runtime and final SQLite audio revision (`56b160b`)
- record canonical OST playback and background opening evidence (`fda51ae`)

## 0.131.0 — 2026-10-05

### 기능

- **start** — default new projects to 480x270 (16:9) play resolution (`6167df5`)
- **ai** — let users collapse and restore the right team sidebar (`2adbe66`)
- **assistant** — AI 조수용 플레이 프리셋 96종 추가 (#2132) (`21754df`)

### 수정

- **super-harness** — show live worker progress and queue reasons (`fe653fe`)
- separate preparation role from facility review output (#2133) (`d516777`)
- **assistant** — forbid empty/duplicate enum members across all tool schemas (`9aa3b07`)

## 0.130.0 — 2026-10-05

### 기능

- **harness** — measure native assistant capabilities with independent gates (`5046fdf`)

### 수정

- route incomplete facility reviews into bounded repairs (#2128) (`9cbc87b`)
- **ai** — unblock Gemini team tools and preserve failed team reports (`14947f5`)
- **assistant** — preserve unrelated raster and report cancellation and stream failures accurately (`c479292`)

### 문서

- **qa** — record live team scenarios, remaining issues and MP4 evidence (`e4b5f40`)

### 테스트

- **assistant** — verify native regression fixes and preserve fault-injection evidence (`441b07a`)

### 잡무

- **qa** — separate canonical map folders from parallel team probes (`8b442a2`)

## 0.129.0 — 2026-10-05

### 기능

- demonstrate approved parking chips across twelve bays (#2124) (`4fc9d9d`)
- **ai** — center team UI on assistant work and support direct team commands (`d0e587b`)

## 0.128.0 — 2026-10-05

### 기능

- 승인 주차장 공용 키트와 실제 보행 맵 완성 (#2120) (`a2a8cb5`)

## 0.127.0 — 2026-10-05

### 기능

- author opening storyboards with independent art motion and original BGM (`69c8b4c`)

### 수정

- freeze art acceptance criteria and adjudicate conflicting reviews (#2118) (`134fc16`)
- preserve opening depth and record live production evidence (`27d5bc9`)
- retain painted detail in layered opening handoff (`42f8b86`)
- keep opening music through map preparation (`40dd88e`)
- preserve layered opening handoff at logical stage size (`34e96dc`)
- use the installed image decoder for opening alpha validation (`ccf4204`)

### 문서

- refresh opening handoff wiki index (`c8fdde2`)

## 0.126.1 — 2026-10-05

### 수정

- **editor** — 이벤트 그림 미리보기가 없는 스프라이트를 아이콘으로 보게 한다 (`8e05acb`)
- **player** — preserve title on navigation and close credits by keyboard (`5365ca7`)
- 그림 작업자에게 현재 도면 승인 전달 (#2112) (`7a016f8`)
- show diary and item graphics in event editor (`a48b60a`)

## 0.126.0 — 2026-10-04

### 기능

- **worldmap** — expose theme readiness and respect human icon selections (`5e20f70`)

### 수정

- align sunlight with visible terrain and height edits (`7372ae4`)
- keep charset motion comparison readable at native scale (`42557d4`)
- validate torso and leg motion before charset publication (`b3c800f`)

### 문서

- verify native terrain shadows in editor and shipped player (`7b086c9`)

## 0.125.0 — 2026-10-04

### 기능

- **ai** — 맵별 조수 실행 소유권과 실시간 작업 상태판 (`b756b47`)
- **ai** — 실시간 적용에서도 맵 위에 시공 연출을 보인다 (`427ac20`)

### 성능

- **ai** — 타일셋 참고문서 한꺼번에 읽기 — 관문이 요구한 용도를 한 번에 (`b7567ac`)
- **ai** — Pi 입력창 의도 선언 — 커버리지 감사를 라우팅과 동시에 (`c391844`)
- **ai** — 조수 실행 준비 80s → 14s — 카탈로그 캐시·워커 해시 보관·해시 먼저 (`84ab9e7`)

### 잡무

- **qa** — 조수 프로브 — 파이어폭스 선택·실패 도구 사유 기록 (`0a0bc06`)
- **qa** — 조수 실측 프로브 — CPU 프로파일·실제 클릭 시각·렌더러 사망 시 즉시 종료 (`d380c6d`)
- **qa** — 조수 실시간 표시 실측 프로브 (`a03fae2`)

## 0.124.0 — 2026-10-04

### 기능

- produce character variations from sealed human-kept pixels (`2ad3d82`)

### 수정

- retain native roof pixels behind gable seams (`0eb25bd`)

### 문서

- verify joined gable in canonical editor and player (`4aeec74`)
- capture complete gabled house in shipping player (`4874087`)

## 0.123.1 — 2026-10-04

### 수정

- 시점 표본 합격 저장 오류와 제작 메타데이터 누락 차단 (#2103) (`1a38e62`)
- use native gabled roofs and shorten default sunlight (`5bd47dc`)

### 문서

- record native roof and sunlight save reload evidence (`16bcd88`)

## 0.123.0 — 2026-10-04

### 기능

- add opt-in coordinate pixel editing experiment for character harness (`79c89c7`)

### 수정

- reject reserved palette symbols in coordinate pixel edits (`8429bf5`)

### 문서

- record coordinate character experiment delivery (`063b66a`)

## 0.122.1 — 2026-10-04

### 수정

- 반복 도면 교정에도 후보 근거와 표본 단계 보존 (#2098) (`f302e41`)
- 재제작 중 이전 후보와 실제 진행 상태를 유지해 표시 (#2095) (`efc6a61`)

## 0.122.0 — 2026-10-04

### 기능

- add authored opening typography and scene transitions (`707bf09`)

### 수정

- 반복 그림 실패를 시점 명세와 표본 검수로 되돌리기 (#2094) (`b54829b`)
- export from the newest canonical reload receipt (`5b94985`)
- retain the preceding composition until the next scene paints (`a2b2db9`)

### 문서

- record canonical opening authoring and shipping playback evidence (`27a4b45`)

## 0.121.1 — 2026-10-04

### 수정

- follow native building silhouettes when casting sunlight shadows (`142d37a`)
- 공간 도면·여백·구성을 실제 제작 관문으로 검수 (#2086) (`71d1af5`)

### 문서

- record native building shadow comparisons and shipping QA (`bb72e14`)

## 0.121.0 — 2026-10-04

### 기능

- give cinematic interview controls a pixel-framed finish (`321f1ee`)
- add configurable sun shadows to terrain editor and player (`731f7e0`)

### 수정

- **sunlight** — 다리 마스크가 없을 때 null 대신 undefined를 둔다 (`0a504b0`)
- restore original grid editing for charset production (`2f5feaa`)
- preserve exact shadow mask extent in canvas rendering (`1491e2d`)

## 0.120.1 — 2026-10-04

### 수정

- attach charset pixel references to GPT artist input (`05f3584`)
- pass approved drawing model to harness preparation (#2081) (`0a68516`)
- give the ci-full vitest worker a 12GB heap (`a9e8aa6`)

## 0.120.0 — 2026-10-04

### 기능

- regenerate chip candidates from bounded review feedback (#2073) (`3d7e3d8`)
- preload cinematic assets and direct opening storyboards (`2011f47`)

### 수정

- **editor** — 안 쓰는 타일 판별 import를 지우고 스키마 배열 길이를 허용한다 (`2ec5edb`)
- **editor** — UX 2차 병합이 깨뜨린 타입 네 곳을 되돌린다 (`6543728`)
- animate charset strips only when their pixels enter the viewport (`49b4c8c`)
- run latest spatial workflow from the unified checkout (`09d5b7c`)
- unify prop derivation and spatial harness under one service (`34e2590`)
- keep command edit popovers clickable beside history controls (`7817c83`)
- retain resource audio row focus and dispose virtual lists (`db90de5`)
- protect authored height cells alongside tile brush intent (`f1bb35b`)
- verify relief drafts and finish resident paging contracts (`18c5c6d`)
- keep sparse human wall comparisons within map coordinates (`5d59a0e`)
- page scoped conversation summaries and debounce archive search (`ba0007e`)
- bound historical activity capture rendering and archive pruning (`8e697ed`)
- bound resource galleries and retain virtualized audio workbench (`d17f257`)
- preserve yielded terrain save snapshots and cache live draft lists (`9be3ce4`)
- load Phaser before evaluating the background play scene (`f53a101`)
- preserve exact human layer defaults and spatial proposal refusal (`7e9612d`)
- bound event selection rendering and isolate event mutations (`1039a2d`)
- cache database connections by reference sources and reuse More results (`37616ae`)
- count persisted presentation artwork and observe real playback reliably (`9fb475b`)
- retain relief pixels in resident pages and bound editor culling (`1a1f405`)
- suspend inactive database previews and reuse animation sprites (`9a39365`)
- retain filtered atlas selection and defer closed palette popup bodies (`de1cd0b`)
- reuse spatial roundtrip projections and index human map edits (`aea9c06`)
- preserve native shared catalog conditional responses (`84ee8c9`)
- stop hidden Progress work and count committed events without clones (`13ef63e`)
- avoid duplicate map navigation tree renders (`7dc479d`)
- retain Life collection search and mount only selected inspector (`2fa4d8f`)
- slice map save preparation and collapse history jump copies (`f1f95ff`)
- retain opening effects until cinematic transitions finish (`8d5734f`)
- distinguish recovered opening repair receipts from automatic creation (`16814e3`)
- preserve active authoring through verified media separation (`71a7281`)

### 문서

- verify editor interactions after the latest main integration (`9852bf6`)
- report the observed visible charset draw count (`aeeb38e`)
- capture native round-two editor UX fixes and remaining latency limits (`4569a9b`)
- record further editor UX performance findings (`7ce9a76`)

### 테스트

- capture directed opening playback and asset recovery evidence (`19c0104`)

### 잡무

- normalize opening QA evidence formatting (`5b33206`)

## 0.119.0 — 2026-10-04

### 기능

- add chip selection with assembled candidate previews (#2069) (`67500b1`)

### 수정

- 주차장 조립 검수 실패 시 후보 선택 차단 (#2071) (`3bd7023`)
- run ci-full vitest as one 8GB worker (`dbd7616`)

## 0.118.3 — 2026-10-04

### 수정

- cap ci-full vitest at two 3584MB workers (`50cfaac`)
- preserve optional terrain enums and house entrance approaches (`1280e07`)
- paginate terrain inspection before assistant response truncation (`e443d3f`)
- preserve terrain settings and houses during assistant edits (`fc5897e`)

### 문서

- compact terrain audit arrays for review (`e26f482`)

### 테스트

- verify real assistants editing saved relief terrain in the editor (`9c0796f`)

## 0.118.2 — 2026-10-04

### 수정

- type the event storyboard host as HTMLElement (`82446a4`)
- keep ci-full vitest inside the 12GB slice (`feb83ef`)

## 0.118.1 — 2026-10-04

### 수정

- reduce editor typing, undo, and event-opening latency (#2061) (`edd0361`)
- retain user approved drawing model per concept (#2060) (`fbe6563`)
- retain user approved drawing model per concept (`1fb92f2`)
- run drawing harnesses through the supervisor (#2058) (`faafc3a`)

## 0.118.0 — 2026-10-04

### 기능

- 큰 공간 상세도 검수와 기획·칩 후보 이미지 표시 (#2057) (`be3cac9`)
- unify prop and space harness entry as super harnessing (`922f645`)
- **harness** — surface automatic derivation proposals before ordering (`58d2a68`)
- **harness** — automatically publish confirmed props to shared SQLite (`ea97bf3`)
- **harness** — bake selected prop motions with preserved timing and derivation metadata (`0f3dd8c`)
- **harness** — 소품 파생 — 방향 4·상태·움직임 묶음과 큰 판 (`524cd42`)
- **interior-surfaces** — SF 벽 다시 설계(갈비 기둥·짧은 빛 홈) + 엄격 검수 3판 — 4종 더 탈락, 7종 손질 (`4f3acc5`)
- **interior-surfaces** — 적대 검수 두 판 — 9종 탈락(CUT), 디더 전면 제거, 나머지 손질 (`903f144`)
- **interior-surfaces** — 바닥·벽 후보 다시 그림 — 모서리 명암·나뭇결·몰딩·부드러운 얼룩, 고르기 방에 가구 (`31e2e52`)
- **interior-surfaces** — 현대·동양·SF 바닥 10종·벽 7종 후보(A/B) + 고르기 화면 (`d58b5b1`)

### 수정

- start new-game interview directly in launcher (`db31c00`)
- make first creation author its title and illustrated opening (#2046) (`775832d`)
- let GPT author all twelve character frames (`80eebcc`)
- keep new-game planning in launcher until confirmation (`89a710d`)
- show current spatial plan summary in harness gallery (`f0b8beb`)
- avoid repeated UI work during right-button region drag (`d3f9c36`)
- keep planning reviewers owned by super harness scheduler (`ee9fad2`)
- **harness** — 파생 묶음 화면 — 움직임 미리보기 크기, 나란히 보기 숨김 (`6b24b4b`)
- **harness** — 파생 묶음 검수는 원본 칸 기준 — 절대 윗면 행 수 대신 (`245944b`)
- **harness** — 고르기 화면 버그·편의 — 되돌리기, 실패 복구, 기물별 메모, 폴링 재시도 (`52a25ad`)
- **harness** — 그림 로딩 — 왼쪽 목록 썸네일 300장이 후보 그림 앞에 줄을 섰다 (`f7c731c`)
- **harness** — 메모의 「2x2」 크기 요청이 실제 캔버스·칸 수·검사까지 바꾼다 (`6aad69b`)
- **harness** — 상태 25초 → 3ms(지문·gzip 스냅숏·derived.sqlite) · 다시 뽑기는 바로 고를 차례에서 빠진다 (`7a76dfb`)

### 문서

- document prop derivation contracts operations recovery and agent handoff (`ffcdb8b`)
- record model-authored walking frame evidence (`c7ad291`)
- verify installed terrain rendering with real body pixels (`a7198dd`)
- clarify terrain fixture storage and refresh wiki index (`a119a4d`)

### 기타

- **harness** — 첫 파생 주문 — 의자 S 방향, 왕실 상자 열림, 용암 화로 움직임, 안락의자 2×2 (`ac962e3`)

## 0.117.0 — 2026-10-04

### 기능

- require adversarial review of spatial plans and text diagrams (`fed3ecb`)
- **worldmap** — publish shared SQLite examples and verify real assistant authoring (`577acfa`)
- **joseon** — 하네스 시드·단계를 지도 14장으로 확장하고 문서를 맞춘다 (`be2210c`)
- **joseon** — 장소 카드 14장(사냥터·동굴 natural, 실내·궁 facility)과 내려받기·축소본 (`8fb41a9`)
- **joseon** — 새 참고문서 3용도(사냥터·동굴 / 실내 / 궁 내부)를 번들이 소유하게 추가 (`6da8e1e`)
- **joseon** — 새 지도 11장을 번들 시트에 덧붙이고 옛 칸 번호를 동결 장부로 고정 (`28f7c29`)
- **joseon-palace-int** — 자가 검수 라운드 — 벽 걸이 그리는 순서·용 문양·모퉁이 소품 정리·문 앞 깔개 3종, 보기 페이지 생성기 (`2ca62bb`)
- **joseon-palace-int** — 궁 내부 방 3장(정전 어좌 홀 21x22·회랑 32x10·침전 20x15) 평면·배치·굽기·점검, mapgate palace_int 프로필 (`22446ef`)
- **joseon-palace-int** — 궁 내부 조각 77종(pal_) — 단청 키트·어좌 단·카펫·병풍·용상·향로·북·종·침구·용장 (`db1fa57`)
- **joseon-interior-b** — 조각 판정 149건(통과 94·보충 55), 사람 캐릭터 범위 바로잡음, 서당·동헌 단 배치 수정, 바가지 다시 그림 (`d9f6ada`)
- **joseon-interior-b** — 계획서, 지도 게이트 interior_b 프로필, 호피 다시 그림, 얇은 줄 조각 정리 (`f34c643`)
- **joseon-interior-b** — 관아 동헌(21x14) 방과 6방 전체 굽기·점검 통과 (`d0b3ce1`)
- **joseon-interior-b** — 서당 방(18x13) 평면·배치 (`83c9360`)
- **joseon-interior-b** — 약방 방(14x10) 평면·배치 (`7036c11`)
- **joseon-interior-b** — 대장간 방(14x10) 평면·배치 (`35e6e78`)
- **joseon-interior-b** — 주막 방(22x14) 평면·배치, 맨바닥 판 점검을 2x2 판 기준으로 (`6250144`)
- **joseon-interior-b** — 조각 메타·통행 보정, 점검기, 민가 방 굽기 (`1892534`)
- **joseon-interior-b** — 후보 B 실내 키트·기물 초안(inb_*, 접두 in_b_) — 구조 키트·기물 149종과 카탈로그 덧붙임 (`85db58a`)

### 수정

- **joseon** — 번들 타일셋의 그룹·부품이 없을 때를 허용한다 (`3934e1b`)
- expose dialogue portraits and honor Joseon game fonts (`4f4992e`)
- preserve reading, selection and human edits during assistant work (`d08d096`)
- use the visible rear bank boundary when picking cliff surfaces (`bd3d93b`)
- gate super harness maps on approved materials and visual evidence (`189fa6d`)
- transfer authored surfaces into charset walking gaps (`fa4a456`)
- keep moving characters above their floor and preserve cliff rims (`778f4aa`)
- **joseon** — TREE_KINDS 에 grove 복원, 조각 관문이 쓴 검수 시트 190장은 병합에서 뺀다(생성물) (`e338baf`)
- **joseon-palace-int** — 엄격 검수 반영 2차 — 바닥 보 띠 제거·정전 비대칭 의례 배치·회랑 기둥 간격 변주·침전 기능 묶음 (`0c43f80`)
- **joseon-interior-b** — 독립 엄격 검수 반영 — 엮은 돗자리, 무작위 온돌·마루 바닥, 넓은 이부자리, 문틀, 진열대, 방 구성 차별화 (`74fa273`)
- **joseon-interior-b** — 블라인드 검수 고침 — 서당 목재 단·관아 단/의자/붉은 길/호피·약방 선반·주막 이부자리·문 조각·대장간 정리 (`cbcd59f`)

### 문서

- record moving-body pixel, cliff rim and canonical editor QA (`56e315e`)
- verify bank picking and retain northern contact evidence (`850d29d`)
- identify canonical sources in rendered character QA (`dc15a8c`)
- add packaged editor and canonical runtime fixture QA (`e5a5816`)
- **joseon-palace-int** — 궁 내부 방 3장 계획서(정전 어좌 홀·회랑·침전) (`c36c539`)

### 잡무

- **joseon** — 새 지도 11장 등록 후 화면 확인 사진 9장과 요약 추가 (`aebcb4e`)

## 0.116.1 — 2026-10-04

### 수정

- **relief** — 경사로 칸 값에 숫자 타입을 붙인다 (`26ec401`)
- require visible first-game scenes and verify shipping playback (#2040) (`501a450`)
- remove super harness daily caps and make orders readable (`7e6b3bf`)
- catch sprite transparency holes with adversarial alpha review (`208a367`)
- ground ramp movement and expose original Beodeul houses (`401b26d`)

### 문서

- record native house, ramp input and full terrain seam visual QA (`5179dcb`)

## 0.116.0 — 2026-10-04

### 기능

- review one character at a time with instant advance and visible walking previews (`ec98035`)
- **worldmap** — ship human-selected icons and verify saved map journeys (`3e1fc51`)

### 수정

- **worldmap** — 선택 아이콘 키트에 배치 문장을 넣는다 (`0553f7f`)
- **worldmap** — detect covered icon cells and record completed candidate review (`13614fd`)
- **worldmap** — pass correction notes to candidate reviewers (`01e1db2`)
- allow click-only launcher entry and record native flow failure (`eca3bbc`)

### 문서

- **worldmap** — record follow-up gallery verification (`8e7ecc7`)

## 0.115.0 — 2026-10-04

### 기능

- publish human-kept sprites and descriptions to the shared character catalog (`746a347`)

### 수정

- preserve assistant view and continue work in background (`585d7c7`)
- **ci** — run the full-lane typecheck with a 10GB heap (`e71aaaf`)

## 0.114.0 — 2026-10-04

### 기능

- connect AI terrain tools and verify cliff house access (`16d017f`)

### 수정

- keep elevated houses visible in large editor maps (`54ffb9c`)
- verify terrain tools through the real editor assistant (`42ce965`)

## 0.113.0 — 2026-10-04

### 기능

- **worldmap** — 실제 지리 style real — Natural Earth·ETOPO1 로 지구 어디든 세계 지도 (`d158ed9`)

### 수정

- make charset review actions instant and durable (`99f1458`)
- **ci** — give typecheck a 10GB heap and run it one at a time (`b0ad46e`)
- make startup fullscreen and interview click-first with fresh reviewed art (`fb9dd1f`)
- make new game art rejection trigger automatic repairs (`3ad4a55`)
- **worldmap** — 저작된 맵 보호와 조수 실행물 SQLite 재로드 근거 보완 (`4d9f527`)
- **worldmap** — 늪 픽셀이 없는 실제 지리 세계에서 swamp_final 통계가 죽던 것 (`38881a5`)
- **ai** — 빈 기본 시작 맵·세계 지도는 칩셋 계열 기준이 아니다 (`4fee005`)

### 테스트

- record maker validation after main integration (`ac5df99`)

## 0.112.0 — 2026-10-04

### 기능

- 자유 캐릭터 저작과 사람의 GIF 선택 공방 (`6f8cd25`)

### 수정

- 캐릭터 선택 단축키를 현재 GIF에 한정 (`345ceb7`)

### 문서

- GIF 캐릭터 공방 위키 색인 갱신 (`326cd2d`)

## 0.111.1 — 2026-10-04

### 수정

- 첫 자동 제작에서 핵심 플레이를 먼저 완성 (#2015) (`ce89668`)

## 0.111.0 — 2026-10-04

### 기능

- simplify terrain dock and add a modal creation guide (`dfac859`)

### 수정

- **harness** — include upstream character credits in exported packs (`ea39b71`)

## 0.110.0 — 2026-10-04

### 기능

- **ai** — 맵별 조수 실행 대기열 — 같은 맵은 차례대로, 다른 맵은 동시에 (`67e36aa`)
- add pixel cinematic dialogue and evidence based romance art review (`39ba2d5`)
- resize Beodeul roofs independently and soften terrain visibility (`49081eb`)
- **harness** — register charset workflow and enforce sprite contracts in CI (`30d2dae`)
- **harness** — continue character batches with verified output provenance and discard gates (`400e8ad`)
- **harness** — 캐릭터 칩 — 그림 넣어 고치기(약함·보통·강함) + 조수용 설명(desc.json) (`71ddfb3`)
- **harness** — 걸음 전파 — 작업자는 서 있는 자세만, 걸음 0·2 는 뼈대 움직임대로 자동 생성 + 돌출 픽셀 검수 (`1fc905c`)
- **harness** — 캐릭터 칩은 실루엣을 뼈대 그대로 — 소지품·모자 추가 금지, 실루엣 변화 150px 검수, 색 구성 지시 18명 (`9118b18`)
- **harness** — 캐릭터 칩 뼈대를 Actor1~4·People1~5 로 넓힘 — 짝 얼굴 정본 매핑, 뼈대 대비 검수, 새 지시 16명 (`cff72fe`)
- **harness** — 생성 얼굴 자르기를 원본 구도에 맞춤(align_crop) + --reuse 재판정 (`c8ecefb`)
- **harness** — 생성 얼굴 v3 — 생김새는 자유, 보는 각도만 잠그고 각도 전용 검수자로 판정 (`f6616b7`)
- **harness** — 생성 얼굴 v2 — 손 도트 얼굴을 참고로 손질만, 각도 점수로 재시도 (`6012036`)
- **harness** — 캐릭터 칩 얼굴을 이미지 생성으로(gen-faces) — 사용자 결정, 칩은 손 도트 유지 (`f3ff2c7`)
- **harness** — 캐릭터 칩 짝 얼굴(48×48)과 비포/애프터 화면 (`5ccbf84`)
- **harness** — 캐릭터 칩 받기/버리기 화면(18314)과 지시 16명, 원샷 묶음 실행(--par) (`491c418`)
- **harness** — 캐릭터 칩 고치기 루프 — GPT 가 고치고 Sonnet 이 검수, 남·여 지시 추가 (`60408d0`)
- **harness** — 캐릭터 칩 하네스에 Opus 5.5 high 엔진과 수정 작업(--src·--fix-notes) (`5afa53e`)
- **harness** — 캐릭터 칩 하네스 — Actor1 뼈대에 작업자가 격자를 직접 찍고 GIF 로 비교 (`7440c00`)

### 수정

- **harness** — report interrupted production batches as failures (`60b956a`)
- **harness** — preserve stable clothing pixels when propagating walking frames (`3d8c8b4`)
- explicitly default optional terrain vision to off (`a12b9e2`)
- **harness** — guide artists to keep clothing readable across walking frames (`ca6b21a`)
- **harness** — avoid rewriting unchanged user decisions on export (`f58144e`)
- **harness** — require fresh review after repairing previously discarded sprites (`78cb686`)
- **harness** — 걸음 전파 뒤 외톨이 점·1px 구멍 정리(뼈대에 없던 결함만, 원본 자기 재현 100% 유지) (`590f952`)
- **harness** — 생성 얼굴이 참고 그림의 투구·두건을 지우지 않게(칩과 어긋남) (`bda6cbb`)
- **harness** — 캐릭터 칩 작업자 — 처음부터 다시 그리지 말고 바꿀 부위만 고친다 (`a29d202`)
- **harness** — 캐릭터 칩 작업자가 작업 폴더 밖(claude-viz)에 쓰지 않게 (`be907ed`)
- **harness** — 캐릭터 칩 검수에 걸음 동작량 — 1px 내리기+발끝만 바꾼 걸음을 거른다 (`99e581d`)

### 문서

- **agents** — 캐릭터 칩 하네스 한 줄 갱신 (`471960a`)
- **agents** — 캐릭터 칩 하네스 받기/버리기 주소 (`2aff4a1`)

### 테스트

- **qa** — 마을이 아닌 쓰기 도구(길·타일·물체)도 맵 위에서 재생되는지 보는 시험 (`be7d6bc`)

### 잡무

- **harness** — 캐릭터 칩 루프 기본을 원샷(1판)으로 — 사용자 판단 (`cf711d3`)

## 0.109.0 — 2026-10-04

### 기능

- **super-harness** — replace the heavy kanban with a light picture gallery (`a8a5e39`)
- **ai** — 실행 중 다른 편집이 들어와도 체크포인트를 3-way 병합으로 적용한다 (`834e4a2`)
- **ai** — 마을뿐 아니라 모든 쓰기 도구의 실제 변경을 맵 위에서 다시 튼다 (`4c66fa4`)
- **ai** — 마을 시공은 도구가 실제로 밟은 단계를 기록해 그 순서대로 다시 튼다 (`9c64279`)
- **ai** — 큰 조수 적용은 예전 밑그림처럼 — 종이·집 자리 테두리·연필이 왼쪽부터 깔고 집을 차례로 놓는다 (`f3b2caa`)
- **ai** — 큰 조수 적용에 시공 연출, 조수창 즉시 반영, 마을 노트 먼저 보이게 (`094640e`)

### 수정

- **electron** — 앱 시작 즉시 죽던 worldmapBuild 최상위 import.meta.url 을 지연 평가 (`4a762d5`)
- **ai** — 시공 연출 덮개 지우기(dirty 함정)·프레임 시계·나무 칸은 바닥과 함께, 새 맵은 전체가 보이게 줌 (`a53b6a6`)
- **ai** — 마을 요청의 그래픽 선택 창과 Pi 경로의 쓰이지 않는 커버리지 감사 콜 제거 (`dfa361c`)

### 테스트

- **qa** — 실행 중 사람 편집 병합 증거 (`f64f91e`)
- **qa** — 실행 중 사람 편집과 AI 시공이 둘 다 남는지 보는 FOREIGN=1 모드 (`bf57dfa`)
- **qa** — 밑그림 시공 화면 증거 갱신 (`4d2ac63`)
- **qa** — 마을 바로 시공 화면 시험 증거(report·단계 띠) (`d90eb77`)

## 0.108.0 — 2026-10-04

### 기능

- **joseon** — 새 장소 12장(사냥터·동굴·실내 방 6·궁 내부 4) 등록 — 시트 꼬리 덧붙이기, 통행·마스크 규칙, 실내 기물 앞 도달 검사 (`4931bc8`)
- **joseon** — 동굴 2차 검수 반영 - 암반 여백 4칸·깊이 띠 천장(깊은 변형 4종)·비대칭 방·막다른 수정 굴·입구 흙 이행·소품 정리, 사냥터 연못 갈대·바위, 판정 갱신, 재굽기 (`a15b03a`)
- **joseon** — 사냥터 2차 검수 반영 - 길은 직선+모서리, 목적지 마당(건조장·낚시터·성벽 토막 앞), 비대칭 3단 바위산, 서로 다른 폐허 둘, 무덤터·연못 기슭·숲 윤곽 (`0e34f4f`)
- **joseon** — 동굴 3단 구조 재작성 - 천장 블롭·벽면·바닥 그림자·유기 윤곽·고리 복도, 소품 조각 15종 (`b8dfcff`)
- **joseon** — 사냥터 늪 윤곽 유기적으로·물 한 단 밝게·개구리밥 격자 해소, 짐승길 흙을 마당과 같은 램프로, 잔디 흰 점 노이즈 축소 (`18825a5`)
- **joseon** — 사냥터 빌더 단언 강화 — 같은 종 정렬·직사각 풀 덩이·맨 바위 판·격자 배치·맨 풀 판 금지, 풀 덩이 경계 깨기 (`6e6aa55`)
- **joseon** — 사냥터 1차 적대 검수 반영 — 북쪽 성벽+남문, 3단 계단 바위산, 곡선 짐승길(목적지 있는 가지), 변동 간격·꼬치 금지 나무 심기 (`3867094`)
- **joseon** — 사냥터·동굴 조각 58종·지형 12묶음 판정 기록 (눈으로 확인한 줄) (`7d6131c`)
- **joseon** — 동굴 joseon_cave 48×48 빌더·굽기 (자동 점검 통과, pixelDiff 0) (`d59be9a`)
- **joseon** — 사냥터 joseon_field 96×96 빌더·굽기 (자동 점검 통과, pixelDiff 0) (`842c4f3`)
- **joseon** — 사냥터 joseon_field_fa 구역 계획과 맵 빌더 1~4단계(지형·길·앵커·나무·소품) (`c7c079a`)
- **joseon-interior** — mapgate interior 프로필(I1~I5)과 interior_checks 자동 점검 (`3a12277`)
- **joseon-interior** — 카탈로그·메타·통행 보정 등록(in_register.py)과 게이트 L/T/E 수정 (`9699d51`)
- **joseon** — 사냥터·동굴 맵 빌더 공용 틀(fld_map.py), mapgate field·cave 프로필, 통행 보정 (`cf344a3`)
- **joseon-interior** — 기물 66종(살림집 A·일터 B)과 검수 시트 도구 (`a6a29f7`)
- **joseon** — 사냥터 지형·바위·식물·야영지·동굴 조각 모듈(fa_*) 초안 (`1d6f3ce`)
- **joseon** — 굴 입구 3종(석조·갱도·갈라진 틈)과 동굴 안 물체 9종, 바위산 앞면 바위결 개선 (`2d32c54`)
- **joseon** — 사냥터 물체 조각 46종(바위·들꽃·덤불·통나무·표식·야영지·무덤·폐허 석탑·나무 변형·군락) + 메타 (`ae4082c`)
- **joseon-interior** — 구조 키트(바닥 5·천장 블롭47·벽면 5종×끝변형·창·문·기둥·계단·단)와 방 빌더 (`73aa430`)
- **joseon** — 사냥터·동굴 지형 오토타일(짐승길·키 큰 풀·숲 바닥·늪·바위산 윗면/앞면·동굴 바닥/천장/벽/못) (`e5c6fe0`)

### 수정

- **joseon** — 사냥터 북쪽 이중 성벽·밑동 기단, 나무 그림 24x24 복제 한도 단언, 동굴 깊은 암반 바위 질감·막다른 굴 상자 (`7d2f096`)
- **joseon** — 무덤터 밖에 놓인 울타리 조각 제거, 재굽기 (`02d0fb3`)
- **joseon** — 동굴 석순 무리 빛 방향·수레 바퀴 굵기 정리 (`64a87df`)
- **joseon** — 사냥터 참배길 포장·짐승 굴 앞 짐승길 추가 (`8432f3d`)
- **joseon** — 동굴 사람 둘 배치 후보 보강 (`4308005`)
- **joseon** — 동굴 검수 반영 — 허공에 뜬 짧은 벽 조각 제거, 바닥 변형 통일, 입구 목(6칸)+화로·불규칙 햇빛 바닥, 둥근 동쪽 못, 상자는 보물방 하나, 복도 가장자리 소품·바위 속 광물 구역 (`be9703f`)
- **joseon** — 사냥터 검수 반영 — 곧은 짐승길(사다리·ㄷ자·막다른 끝 정리)·무덤터 석비 중심·몬스터 둥지·바위산 톱니 제거·늪 윤곽 다듬기·늪가 나무 비움·숲 간격 (`545ef37`)
- **joseon** — 사냥터 바위 언덕에 곁바위, 필드 mapgate 프로필을 첫 굽기 실측으로 조임 (`7329ac9`)

### 정리

- **joseon-interior** — 구현 둘을 하나로 — interior_kit/props_in 계열을 정본으로, in_kit·in_room·in_map·in_props* 중복 제거 (`1bef5f2`)

### 문서

- **joseon** — 한계 문단을 새 장소(실내·사냥터) 기준으로 고치고 검수 결과 문서를 가리킨다 (`fa92927`)
- **joseon** — 새 장소 12장 편집기 화면 증거 50~61 추가 (`4736da4`)
- **joseon** — 새 장소 12장 하네스 시드·CLI·위키·AGENTS 반영 (`f87b747`)
- **joseon** — 사냥터·동굴 구역 계획(PLAN.md) (`8bde653`)
- **joseon-interior** — 방별 계획(PLAN.md) — 민가·주막·대장간·약방·서당·동헌 (`a595bf3`)
- **joseon** — extra.json 계약과 JSON 3방 병합 도우미를 저장소에 보존 (/tmp 소멸 대비) (`e86f659`)

### 잡무

- **joseon** — 사냥터 빌더 하나로 통합 — 검수 승자(field-fa)를 demo_field.py 로, fa_* 구현·cave-fa 산출·field_fa 프로필 제거 (`2de9651`)
- **joseon** — 사냥터 구현을 fld_* 하나로 정리(fa_* 삭제), TERRAIN_VERDICT 한 줄로 시드와 일치, 맵 빌더 demo_field.py (`87d50d1`)

### 기타

- 조선 궁 문 앞 마당(pal_floor_yard) 지형 통행 보정 등록 (`23e31d5`)
- 조선 실내 2차 검수 S4: 월대 계단 카펫·회랑 문 대칭·관아 마루 바닥·마루 변형 4종·복제 줄이기, 방 10장 재굽기 (`8ca67c3`)
- 조선 실내 2차 검수 S1·S2·S3: 닫힌 문+문턱 단+문 폭 디딤돌, 기물마다 접지 그림자 단언, Actor1 조선풍 프레임만(복제 금지) (`b95a1a2`)
- 조선 궁 내부: 방 4장(어좌전·회랑·침전·서고) 평면·기물 배치·산출물 + 방별 계획 PLAN.md (`76e0d83`)
- 조선 궁 내부: 기물 24종(어좌·일월오봉도 병풍·향로·촛대·등·방석·교의·서안·북·종·침상·장롱·화장대·수라상·서가 …) + 메타·통행·판정 52종 (`8b689af`)
- 조선 궁 내부: 구조 키트(palace_kit) — 전돌·마루·황장판·월대·카펫 16칸·단청 천장·분합문/창호/회벽·붉은 기둥·들보·월대 앞면·큰 계단·출입구 (`dfb1f8b`)
- 조선 실내: 통로 문틀(in_doorway) 통행 오버라이드 (`e1e9c0b`)
- 조선 실내: 1차 적대 검수 R1~R7 반영 — 벽 두께·문틀·마당·바닥 재질·단 3/4·접지 그림자·인물 선택, 방 6장 재배치·재굽기 (`bc37034`)
- 조선 실내: PLAN.md 구현 상태 기록 (`2b16a86`)
- 조선 실내: 가는 줄 수리·호피 다시 그림, 실내 조각 136종 판정 기록(눈으로 시트 대조), 방 산출물 갱신 (`f5590c2`)
- 사냥터 동굴 48x48 빌더·굽기: 방 5·복도 ㄴ자 고리·못·보물방, 벽 규칙 점검, 지도 게이트 통과(OBJ_MIN 0.03→0.020 사유 주석) (`0eda059`)
- 조선 실내: 서당·관아 방 추가, 방 6장 산출물(map/pieces/extra/PNG) 생성, 러너 점검 예외 (`d96cea4`)
- 조선 실내: 서당 방 평면·기물 (`f2c026f`)
- 조선 실내: 대장간·약방 방 평면·기물 (`22d2a92`)
- 사냥터 들판: 폐허 석탑·무덤이 수관에 가려지지 않게 가시 구역 확보, 재굽기 (`119146d`)
- 조선 실내: 주막(joseon_in_inn) 방 평면·기물 (`004601b`)
- 사냥터 들판 96x96 빌더 완성·굽기: 자동 점검 통과, 지도 게이트 통과, 맨 잔디 창 완화 (`eb655f3`)
- 조선 실내: 방 빌더 demo_interior.py 와 민가(joseon_in_house) 평면·기물 배치 (`e999284`)

## 0.107.0 — 2026-10-04

### 기능

- enforce executable romance scene contracts and image-backed completion (`d023f37`)

### 수정

- **harness** — 첫 만남 엔딩에 우선순위를 넣고 페이지 해석에 장소 문맥을 넘긴다 (`527553e`)
- isolate activated scene gates and prove automatic exported gameplay (`97a4004`)

### 테스트

- record gameplay against the final compiled player (`5750ee0`)

## 0.106.0 — 2026-10-04

### 기능

- **jp-city** — 조수가 jp_city 와 건물 조립 도구를 고르게 연결 (`048985d`)
- **jp-city** — 도로 키트 39종·connect_extra·상가 거리 예제 갱신 (`39bb3d9`)

## 0.105.1 — 2026-10-04

### 수정

- **export** — 공간 배치 사본이 포트 타입을 잃지 않게 한다 (`f05dd73`)
- 실제 조수 제작과 SQLite 게임 내보내기 결함 수정 (#1988) (`330bef2`)

## 0.105.0 — 2026-10-04

### 기능

- **concept-cards** — 「인형의 방」 개념 카드를 굽는다 (`9eba8da`)
- **concept-cards** — 「온천탕」 개념 카드를 굽는다 (`0f8d374`)
- **super-harness** — gate empty space, plain rectangles and borrowed worldview props (`9c44df0`)
- **super-harness** — seed child concepts, wait on prerequisites, build large concept examples (`5ff5418`)
- **concept-cards** — 「미궁」 개념 카드를 굽는다 (`28ed4b9`)

### 수정

- **editor** — 버들항 빠른 집에 배치 문장을 넣는다 (`e12efc5`)
- use native Beodeul parts for quick houses and paved roads (`3996036`)

### 문서

- refresh terrain and Beodeul wiki coordinates (`ef7a930`)

## 0.104.0 — 2026-10-03

### 기능

- **super-harness** — 개념 카드 자동 공급 하네스와 조수 연결 (`dbdb6b2`)
- **qa-game** — gen --text 로 채팅 한 줄을 그대로 조수에게 보낸다 (`9190fef`)

### 수정

- **concept-cards** — 별칭은 낱말 머리에서만 맞추고, 검수·시험 기준을 바로잡는다 (`687815f`)
- deliver detailed genre authoring presets to game assistants (`f91c3d3`)

### 성능

- rebake only the brushed window of relief terrain while painting height (`4336549`)

## 0.103.0 — 2026-10-03

### 기능

- size house exteriors by dragging their footprint (`a890528`)
- fix terrain visibility and add quick house and drag road placement (`2f29157`)

### 수정

- **release** — 데스크톱 바이너리 빌드 스크립트를 되돌린다 (`716d3b5`)
- hide event badges during terrain visibility preview (`05817c6`)
- retain usable house choices when switching chipsets (`6eecdb2`)

## 0.102.0 — 2026-10-03

### 기능

- 시야 차단 수정과 집·도로 빠른 배치 (#1971) (`529120c`)

### 수정

- automatically dispatch confirmed game briefs when AI connects (#1969) (`c897c34`)

## 0.101.0 — 2026-10-03

### 기능

- 지형 재편집, 게임 상태 검사, 공용 도장과 선택형 시야 규칙 (#1967) (`c9792bd`)
- **map** — 맵별 캐릭터 크기 배율 characterScale — 월드맵에서 캐릭터 줄이기 옵션 (`0711ee3`)
- **worldmap** — 실제 한반도 윤곽 구조 korea — 조선 테마 기본 (`8ae0c81`)
- **worldmap-kit** — 문화권 지리 구조 — 반도(조선)·강 문명 대륙(무협)·열도(전국) (`a88a0b4`)
- **worldmap** — 지형 경계 v9 — 쌍 종류별 전이, 매끈한 강·용암·독 물가, 사구 능선·늪·숲 가장자리가 같은 경계를 따른다 (`c159e3e`)
- **ai** — 조수가 새 대륙 구조를 만든다 — edit/read_world_terrain 에 base generate (`98e4031`)
- **worldmap** — 우주 전용 구조 — 성계 지도는 생성 은하(galaxy) + 우주 5막 항해 (`c9d7205`)
- **worldmap** — 새 대륙 구조 생성(base generate) + 5막 여정 자동 맞춤 (`09f65c5`)
- **worldmap** — 조수 시험에서 막힌 곳 — 여정 규칙을 말로, 막힌 길 좌표, 화산 작업, 덜 먹은 바닥 경고 (`b20f52d`)
- **ai** — 조수가 세계 지도 지형을 바꾼다 — read_world_terrain · edit_world_terrain (`837c948`)
- **worldmap** — 호스트 월드맵 빌드 경로 /v1/worldmap/build + 통행 표·글자 지도 출력, 테마 지형 위 편집 합치기 (`bcf0243`)
- **worldmap** — 지형 편집 층 terrains/<id>.json — ops(땅·바다·섬·바닥·산·고개·강·숲·걷기·고원·장소 옮기기) (`0bfa7d2`)
- **worldmap** — 우주 지도 다시 — 밀도장 성운·빈 구멍·가스 실·워프 균열·둥근 항로 (`124d0e3`)
- **worldmap** — 팔레트 7종·스팀펑크 철로·연기·erase_roads 테마 정리 (`200a67d`)

### 수정

- show canvas activity immediately and prioritize the first scene (#1968) (`337b13e`)
- fill the first AI arrival with a full-window scene (#1966) (`b15bdea`)
- **ai** — 세계 지도는 칩셋 계열 검사에서 뺀다 + edit_world_terrain characterScale (`d5c34af`)
- **worldmap** — 화산재·현무암 길가에 흰 점 — 눈길 킷 대신 흙길, 눈가루는 실제 눈 픽셀에만 (`48fa9bc`)
- **worldmap** — 적대 QA 반영 — 강은 물 칸 안에서만, 조각 대륙은 깨진 판, 기후 어긋남, 천공섬 자리, 은하 나선팔·곡선 항로 (`8e9cd45`)
- **worldmap** — 조수 2차 시험 — 편집 바닥은 지역 팔레트가 안 덮고, 숲 density 는 비율, 화산 원뿔, 섬 붙음 경고 (`3f92446`)
- **worldmap** — 군도를 실제 섬나라로 — 굽이치는 2~3칸 해협·땅 목 다리, 섬 윤곽 굽이, 강 어귀 체크무늬 제거 (`817c712`)
- **worldmap** — 빌드 경로를 정적 import — dev 서버에서 동적 import 가 「module runner closed」 로 죽었다 (`978220f`)
- **worldmap** — 성운 경계 굽이·외계 길 끝 토막·SF 시가지 성기게 (`83648c3`)
- **worldmap** — 이온 폭풍 세기 장 — 잔잔한 눈과 거센 띠 (`50b4904`)
- **worldmap** — 길 띠 안쪽을 길 색으로 다시 칠함(바닥 색과 겹친 길 화소) (`18f345a`)
- **worldmap** — 공용 지형 길 틈 잇기(mend_roads)·광장 칸·번개 다양화·문서 (`903003e`)
- **worldmap** — 우주 아이콘 받침을 둥근 어둠으로 (`de93e0b`)
- **worldmap** — QA 3차 — 선사 길 지우기(같은 바닥 칸 빌려오기), 팔레트 분리(조선·전국·밝음·열대), 고딕 색상 나누기 (`5e9548a`)
- **worldmap** — QA 2차 — 길·항로 한 칸 틈 메우기·경사로 그물, 다리 밑 물, SF 건물 4종, 우주 경계 섞기·먼지·폭풍 (`65453c8`)

### 문서

- **worldmap** — 새 구조 생성·자동 맞춤·은하·경계 v9 문서 + 생성 세계 런타임 시나리오 (`6e9056e`)
- 지형 편집 쪽 증거 경로를 저장소 기준으로 (`3681124`)
- 세계 지도 지형 편집 — openwiki 쪽·키트 README ⑥·worldmapSource 스키마 (`7cbd62b`)

### 테스트

- **qa** — 조수가 만든 세계 지도를 출하 플레이어로 걷는다 — worldmap-terrain 시나리오 (`c905264`)

### 기타

- **worldmap** — 길 덧칠 — 발자국 연결은 옛 길 흔적으로, 지울 화소는 지도 전체에서 한 번에 메움 (`3b1bc19`)
- **worldmap** — 테마 17종 + 하네스 지도 자리를 테마 지형으로 (`327459e`)
- **worldmap-kit** — 테마 층 — 포장도로·철길·시가지·그을음·우주 지도, 팔레트 셋 (`40cdcd6`)

## 0.100.0 — 2026-10-03

### 기능

- make the first AI sentence a cinematic world arrival (#1960) (`faec83d`)
- redraw all common monsters and record battles with audio (`4abe155`)
- **interior-props** — 새 기물 10차 50종 — 중세 공방·훈련장, 판타지 종족, 무림 생활, 대형 10 (`e442234`)
- **interior-props** — 새 기물 9차 66종 — 무림 22 · 중세 17 · 판타지 12 · 대형 15 (`1519cd0`)
- **interior-props** — 새 기물 8차 139종 명세 — 장르 넓히기 (`b19c084`)
- **harness** — 후보 둘 + 셋째 자리 「다시 뽑기」 카드 (`49cbae1`)
- **interior-props** — 새 기물 7차 118종 명세(판타지 61 · 현대 57) (`f296913`)
- **interior** — 실내 시트 굽기 5판 — 공통 팔레트 v6(331색)로 옮기기 (`79f46b9`)
- **palette** — 실내 합친 팔레트 시안 — v5 203색 + 시트에서 뽑은 128색 = 331색 (`7b7ffc8`)

### 수정

- **harness** — 확정하면 다음 기물 맨 위로 · 방 안 그림 7×7 → 5×5 칸, 한 줄에 4장 (`532f159`)
- **harness** — 작업지시서가 아직 없는 판은 일꾼이 집어 가지 않는다 (`f6ca644`)
- **harness** — 확정이 바로 반영되게 — 늦게 온 옛 상태가 고른 기물을 되살리던 것 (`6a74ed8`)
- **harness** — 확정 알림을 오른쪽 아래로 — 위의 기물 이름을 가리지 않게 (`60862e3`)

### 성능

- **harness** — 일꾼 풀을 nice 10 으로 — 고르는 화면 서버가 굶지 않게 (`bd7a08e`)

## 0.99.1 — 2026-10-03

### 수정

- stabilize cinematic interview AI handoff and mobile controls (`c00e40c`)

### 테스트

- record interview QA against current main (`69532e8`)

## 0.99.0 — 2026-10-03

### 기능

- clarify first start and safely restore project backups (#1956) (`157ce43`)

## 0.98.0 — 2026-10-03

### 기능

- connect cinematic genre interview to actual new game flow (`af305f9`)
- **editor** — add ten terrain design tools with symmetry, stamps and route inspection (#1953) (`e8f8cb2`)

## 0.97.0 — 2026-10-03

### 기능

- **harness** — joseon-baram CLI 와 기존 조선 도구 다리 (`e6a5f82`)
- **harness** — joseon-baram 매니페스트·시드·레지스트리 등록 (`b874cd0`)

### 수정

- **jp-city** — 그룹 층을 멤버 칸의 엔진 홈에서 유도 — 정의·엔진 어긋남 177칸(13그룹) 정정 (`da3d266`)

### 문서

- **harness** — joseon-baram 하네스 문서와 AGENTS 하네스 절 한 줄 (`6fdccf0`)

### 테스트

- **harness** — joseon-baram 매니페스트·시드·CLI 단계 시험 (`9c383b9`)

## 0.96.0 — 2026-10-03

### 기능

- **jp-city** — AI 참고문서 6용도 47쪽 124장 — 오토타일·건물 조립·도로 키트·상가 키트·오류 총괄 (`c050977`)
- **joseon** — 국내성 원작 규모 통합 수정판 병합 — 새 문루·사립문·치·굴 통행 보정, 마스크 규칙 전환 (`80863b6`)
- **국내성원작규모** — 4칸 사립문·치·굴·망루 배선, 해자 기슭 흔들기·큰길 물 메움·마스크 전환·NPC/소품/나무 규칙, 자동 점검 단언 — 재굽기(pixelDiff 0, 지도 게이트 통과) (`a262211`)
- **국내성원작규모** — NPC 4조건·소품 규칙·나무 줄 간격·건물/성벽 그림자·슬리버 메움·성벽 변형 무작위 (`a88cd88`)
- **국내성원작규모** — 문루 변형 3종·4칸 사립문·세로 성벽 치·굴 입구 3종 조각과 배선 (`dcff708`)
- **joseon** — 국내성 원작 규모(200×208) 세 번째 맵 gungnae_full 등록 (`9cbf08e`)
- **joseon** — 국내성 원작 규모(200×208) 굽기 — 시트 pixelDiff 0, 지도 게이트 통과, 사람 40 (`0527c37`)
- **joseon** — 국내성 원작 규모 8단계 — 대나무 변형 6종(M4), 사람 배치·굽기 파이프라인 (`801e63c`)
- **joseon** — 국내성 원작 규모 7단계 — 전사의 길 정원, 섬 집 나무다리, 술사 담터 북문, 길망 점검 0건 (`1b7b3c2`)
- **joseon** — 국내성 원작 규모(200×208) 5~6단계 — 숲·가로수·잔디 채움, 밭 이랑길 (`ced3fb3`)
- **국내성원작규모** — 해자 윤곽 자료·정전 폭 18칸 조각 추가 (`8b7ae53`)
- **joseon** — 에디터 화면 확인 스크린샷 18장 + 조선 목록 축소본(catalog-thumbs) (`3272e75`)
- **joseon** — 국내성 최종판(d8ca6924c2) 등록 — 측면 문루 상인방/설주·나무 변형 12종·성벽 윗면 변형 반영 (`837e9ee`)
- **joseon** — 국내성 16구역판 합치기 — 변형 묶음 지형(road64·yard64·grass8·물 4변형)과 열린 사립문 건너는 곳 (`f7ca9bb`)
- **joseon** — 마을 20호+국내성 두 맵을 joseon_baram 한 시트에 등록 (산출물·참고문서·장소 카드·위키) (`786c546`)
- **joseon** — 변환기가 시트 여러 장을 한 시트로 합치고 국내성 통행 보정·건너는 곳 검사를 더함 (`39a6490`)
- **joseon** — 국내성 8차 검수 2단계 — 열린 측면 문루(길이 지붕 밑 통과)·불규칙 숲띠·건물 간격·잔디 창 보강·감옥 호수 (`7199d9a`)
- **joseon** — 국내성 8차 검수 1단계 — 세로 성벽 3칸(옆면+윗면+그림자)·측면 문루·궁 정전 단층 대전+3단 월대·회벽 담·청색 물·해자 대칭 (`aad0174`)
- **joseon** — 국내성형 맵 96x96 굽기 — 성벽·해자·왕궁·구획 건물·사람, 시트 재조립 pixelDiff 0 (`6929c40`)
- **joseon** — 국내성형 맵 — 소품·사람·지도 게이트 프로필(gungnae)·extra.json 출력 (`6b49e57`)
- **joseon** — 조선 마을 20호 장소 카드·스냅숏 배선 (공용 DB 게시 없음) (`cf2b25a`)
- **joseon** — 국내성형 맵 — 숲띠·나무 채움·시트 재조립 출력 (`8d27a7d`)
- **joseon** — 조선 칩셋 참고문서 6용도 생성기와 번들·저장 검증 (`fb936f8`)
- **joseon** — 국내성형 맵 — 담 두른 집·밭·전사의 길 정원 (`e7922b2`)
- **joseon** — 조선 칩셋 일반 변환기·번들 타일셋(joseon_baram)·저장 증명 스크립트 (`9c251c0`)
- **joseon** — 국내성형 맵 2~4단계 — 해자 고리·다리·왕궁·구획 건물 틀 (`31c026d`)
- **joseon** — 마을 20호 extra.json 출력 + 조각 통행(X/C/F) 자동 규칙·보정표 (`4fb9781`)
- **joseon** — 국내성형 맵 1단계 — 성벽 고리·망루·대문루·소문루·석판 대로 틀 (`01c2007`)
- **joseon** — 국내성식 집 변형 세트 — ㄱ/ㄷ자 몸채·주막 ㅁ자 마당집 키트·상점 4종·다층 기와집·초가 4종·구획 담 (61조각) (`34db019`)
- **joseon** — 8방향 블롭 물 오토타일 47종 — 굽이치는 강·둥근 연못 (`af9e551`)
- **joseon** — 국내성식 성벽·성문·망루·돌다리·석판 지형 조각 세트 (`51a4f85`)
- **joseon** — 국내성 왕궁 구역 조각 세트 — 정전·전각·행각·궁 담·궁 문·마당·어도·연못·소품·탑형 랜드마크 (`fc8a28c`)
- **joseon** — 마을 20호 7차 — 물레방아 홈통 제거·문 앞 풀 정리·두 번째 건널목·문 앞 소품 금지 구역 (`c57dfe0`)
- **joseon** — 6차 — 문/창 구분, 폭 2칸 안길, 나무 그림자, 건물 겹침 검사, 담 토막 제거 (`17a4d3b`)
- **joseon** — 5차 — 강 사행 완화, 큰길·안길 단순화, 집 앞 낮은 담·사립문, 방앗간·물레방아, 도랑·선착장, 한복풍 인물만 (`79492de`)
- **joseon** — 마을 길 체계 재설계(큰길 구간 어긋남·안길 꺾임·샛길 막다른) + 고증 반영(공동우물 마당·당산나무·장승 양옆·북쪽 고개) (`7678155`)
- **joseon** — 솟을대문·평대문(열린 통로) + 집 변형 9종 + 생활 소품 16종, 마을 20채 재배치 (`79a3d16`)
- **joseon** — 소규모 마을 20채(64×56) — 양반 저택·골목·시내·논·상점 + 신규 부품 9종 (`8854d06`)
- **joseon** — 밝은 팔레트 판, 수문 성벽·성문 밖 길(48×46), 홍살문 5칸 축 맞춤, 가판 3종, Actor1 캐릭터 확인 합성 (`5190ca0`)
- **joseon** — 팔레트 잠금을 바람의나라 군집 램프 94색으로 교체(옛 잠금은 palette_beodeul.json 보존), 잔디 판정을 램프 색 집합으로 (`6a1fa01`)
- **joseon** — 초가 지붕 v3 — 바람의나라식 쌓은 방석 3단(긴 짚 털·단 밑 그늘·주황 갈색) (`151f286`)
- **joseon** — 초가 v2(낮고 넓은 방석·열린 마루칸)와 바람의나라 구조물 확장 — 관아·성문·성벽·누각·홍살문·청사초롱 문·석탑·장터 차일·원두막 (`2b90fa2`)
- **joseon** — 초가 지붕을 사용자 기준 사진(어두운 갈색 세 단 알약 방석)으로 재설계 (`e3f5999`)
- **joseon** — 초가집 4종 codex(gpt-6.1-sol medium) 재제작 — 둥근 어깨 지붕·작은 창·널문·낮은 기단 (`0a6fe48`)
- **joseon** — 바람의나라 연구 반영 — 곡선 처마 기와 지붕·둥근 방석 초가·주황 막돌 담·개방 정자·처마 디더 그림자 (`368bc87`)
- **joseon** — 공간감 5차 — 물가 갈대·돌 자동 배치, 집 엇갈림·터 울타리, 덤불 크기 변형·대숲·소나무 군락 (`b677109`)
- **joseon** — 공간감 4차 — 건물 15채·언덕 석축 계단·빨랫줄·화단·자동 빈 잔디 채움, 겹침 게이트를 건물 밀도 게이트로 교체 (`bd0e621`)
- **joseon** — 공간감 3차 — 곡선 연못·큰 굽이 강·두렁 논·마당 흙 축소·밀도 보강 (`fa65434`)
- **joseon** — 공간감 2차 — 석축 둑·굽은 강·수변 소품·나무/건물 겹침 게이트 (`3f32c2e`)
- **joseon** — 버들항 급 나무(잎 덩이 겹침)·공간감 하네스(나무/지도 게이트)·밀도 높인 마을 지도 (`fc3e8ce`)
- **joseon** — 조선 칩 3라운드 — 소품·담 재도트, 적대 리뷰 기록(culture/view), 후보 구움 (`7a5a2f5`)
- **content** — 조선 건물을 버들항 블록 조립 문법으로 재작성 — 팔작·초가·대문·정자, 게이트 K(통그림 금지) (`5afc268`)
- **content** — 조선 칩셋 하네스 — 버들항 팔레트 잠금·화풍 게이트·기준 옆 검수·판정 기록 (`c8ade35`)
- **content** — 조선 칩셋 데모 초안 — 버들항 규칙으로 기와집·초가·대문·정자·땅 이음을 코드 도트로 (`5a9d4a3`)

### 수정

- **joseon** — 국내성 최종판 합치기 — 변형은 기준 이름의 통행 보정을 이어받고 측면 문루·그림자 칸을 새 그림에 맞춤 (`844a8bb`)
- **joseon** — 국내성 사람 17명을 새 길 위에 재배치 (`bbde117`)
- **joseon** — 국내성 사람 자리를 길 위로 옮김 (`8c383eb`)
- **joseon** — 4차 검수 반영 — 문 있는 오두막, 담 관통 꼬리길 제거, 선착장, 논 사이 밭 타일 제거, 인물 위치 (`dba4a5d`)
- **joseon** — 인물 위치를 새 배치에 맞춤 (`e8f844e`)
- **joseon** — 마을 20채 1차 적대 검수 반영 — 양반댁 마당·대문채 통로, 시내 폭·방향, 길 종점, 논·정자 접근, 수관 배치 규칙 (`1753d61`)
- **joseon** — 3/4 전수 리뷰 반영 — 건물 벽 명암·옆 그림자, 담 돌 밝게, 덤불 그림자 붙임, 어린 소나무 줄기 연결 (`696cbb3`)
- **joseon** — 담을 사람 키(2칸)로 키움, 울타리·성벽 윗면 직육면체로 재작도 (`fec8d1f`)
- **joseon** — 3/4 재리뷰 2차 반영 — 세로 담 윗면 세로 띠, 담 돌 배열 변형 3종, 담 끝 돌기둥, 낟가리·평상 보정 (`5955e86`)
- **joseon** — 3/4 리뷰 반영 — 옹기 바닥 호·그림자, 평상·울타리·멍석 윗면, 담 덮개 윗면/기왓면 분리와 옆면, 다리 상판, 계단·석축 갓돌, 빨랫줄, 장터 차일 윗면, 원두막, 성벽 윗면 (`52cb94c`)
- **joseon** — 3/4 시점 소품 재작도 — 옹기(입 타원·덮개)·우물·평상·낟가리·울타리·화단·멍석, 담(덮개 윗면+기왓골+돌쌓기)을 윗면+앞면+그림자 문법으로 (`670ae9c`)
- **joseon** — 리뷰 2차 반영 — 초가 균열선 제거·어깨 둥글게·장지문 마루, 치미 확대, 성문·누각 누상 바닥, 석탑 층급받침, 태극·청사초롱 문·장터·원두막 (`c45c354`)
- **joseon** — 리뷰 1차 반영 — 초가 한지 살창·용마름·새끼줄, 관아 회흑 기와+치미+현판, 붉은 주칠 누각 기둥, 석탑 이중 기단, 홍살문·청사초롱 문·장터·원두막 고증 수정 (`b7abb06`)
- **joseon** — 처마 밑 서까래 채움이 벽 윗줄을 지붕으로 오인해 비던 버그 수정, 다리·독·담 3/4 보정 (`7822e29`)
- **joseon** — 3/4 시점 소품(석등·장승·솟대·빨랫줄·울타리) 재작도, 지붕을 벽에 얹히게(처마 서까래 채움·폭 축소) (`d63b431`)

### 정리

- **joseon** — 3차 QA 반영 — 동서 담 방향, 장대석 성벽(이음 없음)·귀돌, 누각·청사초롱 문 4칸 길 축, 관아 3칸 길, 시장 마당, 고아 길 정리 (`b708cb5`)
- **joseon** — 2차 QA 반영 — 세로 담을 덮개+돌 옆면으로, 안채·담 간격, 관아→큰길 샛길, 논 위 나무 제거 (`d01cb19`)
- **joseon** — 양반댁 담 닫고 대문 정렬, 골목·길망·누각 접근로, 성벽을 성문 높이로 이어 붙임 (`c9f6b20`)

### 문서

- **joseon** — 에디터 화면 확인 SUMMARY (`36a1a69`)
- **joseon** — openwiki/joseon-baram.md — 변환기·통행·참고문서·검증 실측·국내성 합치는 법 (`1039d1e`)
- **joseon** — 데모 페이지 현재 상태 문구 정정(v4, 리뷰 3/3) (`7b6a864`)

### 기타

- 국내성 통합 수정 — 문루 통로 인자·_why_fit·타워 이동·새 조각 초안 (`2417ac1`)
- **국내성원작규모** — 수정 라운드 1~3단계 — 석판 보호·큰길 다리 행·궁 담 길 차단·apron·섬 먼저 깎기·fits 강화·구획 좌표 (`c8a827b`)
- **국내성원작규모** — 1~4단계 — 성벽·문, 원작 윤곽 해자·다리, 왕궁, 길·마당·구획 건물 (`6a74352`)
- **국내성** — 16구역 재검수 마지막 라운드 — 측면 문루 상인방/설주 분리, 나무 변형 12종 추가, 세로 성벽 윗면 변형 6종, 망루 하단 막돌, 대장간 계단 잇기, 판정 갱신 (`d8ca692`)
- **국내성** — 16구역 마감 — 사립문 열린 문, 예식장 계단 땅까지, 정전 계단 띠 개방, 궁문 주황 기둥, 성벽 변형 6종, NPC 재배치, 재굽기·판정 갱신 (`f72efcc`)
- **국내성** — 16구역 5단계 — 세로 성벽 전폭 재작성, 해자 곡선, 다리 상판 한 톤·낮은 교대, 문틀 보, 판정 갱신 (`d9cb21a`)
- **국내성** — 16구역 3~4단계 — 문 위치 실측·남안 뒤뜰·논 범위·나무 수관 겹침/건물 완충·소품 겹침 검사·NPC 재배치 (`3764c40`)
- **국내성** — 16구역 2단계 — 흙길 4변형·석판 5종·풀 8종·물 4변형, 성벽 밑 길 마스크, 석판-마당 병합 (`2273698`)
- **국내성** — 9차 3단계 — 건물 땅 그림자, 궁 담 벽돌 쌓기, 북 다리 좌우 대칭, 판정 갱신 (`bfb9582`)
- **국내성** — 9차 2단계 — 망루 폭 5 중심 정렬, 세로 성벽 몸체 중앙 정렬, 현판 글자 변형, 성가퀴 틈 석재 채움, 판정 갱신 (`1851643`)
- **국내성** — 9차 1단계 — 측면 문루 통로 기준 재조립, 다리 남단 착지, 북문 열린 아치, 성벽 그림자, 궁 남변 여유 (`b46625c`)

## 0.95.0 — 2026-10-03

### 기능

- **jp-city** — 예제 맵 ① 상가 거리 48×40 — 건물 8채·간선 교차로·건널목·철도 건널목, 지역 참고본 등록 (`f4c9fc3`)

### 문서

- **editor** — 지형 도구 실제 작동 GIF와 녹화 절차 추가 (#1945) (`59a3dc9`)

## 0.94.0 — 2026-10-03

### 기능

- **harness** — jp-city — 일본 도시 주택가·역·공원·신사 도트 후보 하네스 (항목 40, modern3, pick 까지) (`98dd020`)

### 수정

- **editor** — 팀 상태 배지와 지형 도구 막대 겹침 방지 (#1942) (`dc463d0`)

### 문서

- **agents** — jp-city 하네스 등록 + 웨이브 구동기 (`85bc923`)

## 0.93.0 — 2026-10-03

### 기능

- **editor** — 자동 경사로·다리·지형 붓·군집과 통행 미리보기 (#1937) (`0592bbd`)
- pass interview execution tasks to the assistant internally (`b60d50a`)

### 수정

- **project** — 기존 작업 로드를 막는 공용 grass 속성 누락 보충 (#1940) (`d494f59`)

## 0.92.1 — 2026-10-03

### 성능

- **jp-city** — build_jp_city_building 스키마 축소 1808→1505 토큰 (`d7f7845`)

### 테스트

- **ai** — 도구 색인 글자 상한을 실측 6,100 으로 (main 5,959 → jp_city 도구 +53) (`6aa8a2a`)

## 0.92.0 — 2026-10-03

### 기능

- **jp-city** — M3 건물 조립 도구(build_jp_city_building) + roads 블록 굽기 병합 (`28f7421`)
- **jp-city** — M4 일본식 도로 키트 블록 — 키트 29·새 칸 65 (생활도로·간선 4차선·건널목·지하도·표지) (`d488344`)

## 0.91.1 — 2026-10-03

### 수정

- **relief** — 언덕 통로를 단 없는 흙 경사면으로 연결 (#1931) (`c13a619`)

## 0.91.0 — 2026-10-03

### 기능

- **jp-city** — M1 번들 타일셋 jp_city 배선 (새 프로젝트·기존 프로젝트·계열 oprn-jp) (`b39837a`)
- **jp-city** — M1 굽기 — 시트 48열 3616칸·키트 176·그룹 169·오토타일 17, 자리 키 핀 (`5434559`)
- **jp-city** — M2-B 선형 오토타일 10세트 (블록담·생울타리·철망·가드레일·선로·차선·횡단보도·점자블록) (`4e5bdbe`)
- **jp-city** — M2-A 지면 오토타일 7세트 (연석·생활도로·잔디·자갈·광장·연못·수로) (`cbea3ab`)
- **jp-city** — M0 jpkit 이식 — 저장소 안에서 시트(2880칸)·카탈로그·지구 6장 재현, 행인 제외, 글자 122자 굽기 (`706c6b3`)

### 수정

- **relief** — 기본 계단을 풀과 흙벽 대신 돌 디딤판으로 렌더 (#1928) (`89891d8`)

## 0.90.0 — 2026-10-03

### 기능

- **editor** — 러프 높이 붓과 지형지물 도구 막대 (#1925) (`739f33e`)

## 0.89.0 — 2026-10-03

### 기능

- **modern-city** — 참고문서 49편·예제 도시 맵 60x60·지역 등록·도달성/변조 검증 (`35b74fe`)
- **modern-city** — 번들 타일셋 modern_city — 굽기(bake_tileset.py)·시트 9998칸·키트 575·번들 배선 (`cc42b8f`)

### 수정

- **assets** — keep retired RTP category lists typed when empty (`7ca33af`)

### 문서

- openwiki INDEX 재생성(modern-city) (`e5e3099`)
- **modern-city** — 굽기 절·위키 색인 (`b36f889`)

### 잡무

- **modern-chipset** — 합격 후보 사본 tiledata/modern-city/sources + run_town.sh (qa-runs 없이 재현) (`5551d83`)
- **modern-chipset** — 하네스 브랜치(도시 조립·에셋 JSON·modern4 팔레트)를 origin/main 위로 이식 (`611281f`)

## 0.88.0 — 2026-10-03

### 기능

- **assets** — redraw hydra with native RM2003 pixel poses (`1b297f4`)

### 수정

- **assets** — 비어 있는 EasyRPG 전투·몬스터 목록을 필터 대신 빈 배열로 둔다 (`10fcde9`)
- **assets** — remove rejected starter artwork and runtime references (`615f97d`)
- **battle** — 옛 전투 그림을 deprecated/ 로 옮기고 도트·포켓몬 그림만 쓴다 (`a0176dd`)

### 성능

- **harness** — 고르는 화면 그림을 미리 굽고 다음 기물을 미리 받는다 (`33ab5b5`)

## 0.87.0 — 2026-10-03

### 기능

- **palette** — 팔레트 시안 미리보기 둘 — 실내 바닥·벽 타일을 v5.pal 로, 몬스터 140종 공통 팔레트(32·48·64색) (`cbed552`)

## 0.86.0 — 2026-10-03

### 기능

- **interior-props** — 현대 실내 기물 50종 명세(batch6) — 집·사무실·가게·학교·병원 (`7680a24`)
- **interior-props** — 카드 두 번 누르면 확정, 물건 이름은 가운데 위에 크게 (`e105700`)

### 잡무

- **interior-props** — 동시 작업 16 → 32 (`392acca`)

## 0.85.0 — 2026-10-03

### 기능

- **interior-props** — 고르는 화면 기본을 「방 안」만으로 — 방 그림을 크게, 같은 그림인 둘째 벌은 숨김 (`e3326d5`)
- **interior-props** — 테두리 두 벌을 따로 카드로 — 한 판 10장(1 · 1′ …)을 한눈에 보고 누른다 (`a515705`)
- **interior-props** — 고르는 화면에서 후보마다 테두리 두 벌 — 전부 / 꼭 필요한 곳만 (`75f3376`)
- add cinematic lobby to desktop start screen (`90a6296`)

### CI

- 타입체크 힙을 7GB로 올린다 (`4d6a6aa`)

## 0.84.1 — 2026-10-03

### 수정

- protect committed event draft references during database deletion (`e35b8a3`)
- preserve event drag ownership and legacy page behavior (`40c193b`)
- bound repeated common event graph traversal (`6afe31d`)
- preserve nested event references when deleting database records (`135de86`)
- protect database skill and actor references on deletion (`1d83e6b`)
- report actual database saves and common event recursion (`85489fb`)

### 문서

- record database and event editor audit findings (`9a20d46`)

## 0.84.0 — 2026-10-03

### 기능

- **assistant** — 몬스터가 다가와 공격하는 컷신은 차셋 NPC 대신 staged 그림 배우로 유도 (`010a4ab`)
- **cutscene** — 대화창 위치 옵션(줄별 position·화면 기준 회피) + staged 에 맵 배우·애니메이션·장소 이동, 충격 연출 도구를 staged 로 통합 (`32cdf8f`)
- **assistant** — 그림 연출 소재 규칙·주인공 자동 맞춤·animation beat·암전 종료 거부 (`441580e`)
- **cutscene** — 선언형 연출에 turn·animate(게임 전투 애니메이션)·번들 그림 배우 추가 (`5439ab4`)
- **cutscene** — 선언형 연출에 효과음·화면 전환·ghost 배우·flash 색 추가, 이세계→포켓몬풍 데모 빌더 (`2da787a`)
- **assistant** — 그림 생성 승격 시 선언형 연출·미리보기를 함께 얹고 도구 설명 키워드 보강 (`a3515b1`)
- **cutscene** — 선언형 연출 script_cutscene_staged + 그림 style(game|illustration) (`9a4f411`)

### 수정

- **ai** — 창이 좁은 모델의 폴백에 전체 카탈로그를 보내지 않고, find_tools 가 설명 첫 문장 일치를 먼저 준다 (`5d8d300`)
- **battle** — 이도류는 무기마다 그 무기의 공격력으로 치고, 「전투 명령 변경」은 지금 메뉴 위에서 더하고 뺀다 (`31927ac`)
- **assistant** — 현대 맵 거부 메시지에 배경 그림+staged 대안 안내 (`774fa78`)
- **assistant** — action 생략한 그림 beat 도 손 연출 거부 대상 (`9641f9f`)
- **assistant** — 몬스터 공격 컷신 거부가 eventId·actorId 별칭도 잡도록 (`c50657c`)
- **assistant** — 몬스터 그림 생성 거부(게임 도트 유도), showAnimation target 경고 제거 (`295370e`)
- **assistant** — staged 주인공은 Actor1~4 만, 몬스터·소품 그림을 손으로 show 하는 컷신 거부 (`e0d9f01`)

### 테스트

- **ai** — 세션을 통째로 돌리는 툴 노출 테스트에 60초 한도 (`650f839`)
- main 에서 원래 빨갛던 테스트를 지금 제품에 맞춘다 (`af9f68e`)

## 0.83.0 — 2026-10-03

### 기능

- adapt battle choreography to every bundled character and current equipment (`0bda2ad`)
- **db** — 도트 측면 전투 배경은 종류로 고른다 + 전투 정리 잔여 (`d313d81`)
- add 32 shared battle motion programs and native gimmick rules (`1ea47cd`)

### 수정

- preserve casting and legacy combos with character motion evidence (`5efdd00`)
- branch battle previews and impact effects by action outcome (`6566f07`)
- synchronize battle contacts and replace sliding motion recovery (`5892e2c`)
- preserve separate contacts in multi-hit battle motion previews (`8b9a58f`)

## 0.82.0 — 2026-10-02

### 기능

- **interior-props** — 선 게이트 — 바깥 테 1칸·테가 안쪽보다 어둡다(검사·작업지시서·좋은/나쁜 예), 시험 기물 2종(거대 망원경·베틀) (`661fbdd`)
- **interior-props** — 선 문법 측정·보정 스크립트(외곽 두께·외곽 없음·외곽 색·빛 방향·안쪽 선 굵기) (`a177e68`)

### 잡무

- **interior-props** — 대형 기물 둘째 묶음 고른 결과(picks.json) (`15886ca`)

## 0.81.0 — 2026-10-02

### 기능

- **battle** — RM2003 이도류·공통 이벤트 명령·배우별 전투 명령 (`a6f4d01`)

### 수정

- **db** — 자료집 전투 정리 후속 — 숨긴 칸 경고·조수 스키마·규칙 단독 변경·deprecated 표식 (`99a0bdb`)

## 0.80.0 — 2026-10-02

### 깨지는 변경

- **battle** — 창 색만 다르던 측면 스킨 여섯을 지우고 전투 스킨을 retro2003·pokemon 둘로 줄인다 (`2145473`)

### 정리

- **battle** — 창 색만 다르던 측면 스킨 여섯을 지우고 전투 스킨을 retro2003·pokemon 둘로 줄인다 (`2145473`)

## 0.79.0 — 2026-10-02

### 기능

- **interior-props** — 대형 기물 둘째 묶음 10종 명세(batch4, 3/4 밑그림 포함) — 탄수차·유개 화차·짐마차·그랜드 피아노·거대 가마솥·용 알 둥지·보물 더미·당구대·왕실 침대·거대 수정 (`ff288fa`)

### 정리

- **db** — 자료집 전투 정리 — 전투 방식 두 가지·전투 화면 탭·안 쓰는 칸 삭제 (`1c9dff2`)

## 0.78.0 — 2026-10-02

### 기능

- **interior-props** — 대형 깊은 기물 3/4 밑그림(blockout) — 명세가 윗면·남쪽 면 띠를 정하고 검사가 채움을 잰다 (`274ff70`)

### 수정

- **interior-props** — 밑그림이 있는 기물의 꼭대기 규칙은 주 윗면(밑그림 띠)에 — 솟는 부품은 행 수 규칙 밖 (`3d1abcb`)
- **interior-props** — 밑그림 절은 깊이와 상관없이 blockout 이 있으면 싣는다 (`e97697b`)

## 0.77.0 — 2026-10-02

### 기능

- **worldmap-kit** — 월드맵 아이콘 세계관 세트 14개 + 하네스 일괄 받기 (#1888) (`38bcb25`)

## 0.76.0 — 2026-10-02

### 기능

- **battle** — 포켓몬 스킨 타격을 3세대 박자로 — 두 박자·깜빡임·HP 상자 떨림·상성 문장 (`3f78ca3`)
- **battle** — 포켓몬 타격감 3차 — 세기별 타격음·도트 착탄 별·킥 하한·넉백 배율 (`0df31d3`)
- **battle** — 포켓몬 타격감 2차 — 한 프레임 번쩍임·정지 진동·착탄 별·카메라 킥·HP 잔상 (`a1db5b8`)
- **battle** — 포켓몬 스킨 기술 움직임 7종 — 발사체·현장 발생·범위·보조 안무 (`a04653d`)
- **battle** — 포켓몬 스킨 타격 안무 — 닿는 돌진·접촉 정지·맞은 쪽 넉백 (`55834d8`)
- **battle** — 포켓몬 스킨 동작 템포 1.5배 — 히트스톱·대사는 그대로 (`fe85d0c`)
- **harness** — 공격 방향 계약과 스킬별 자세(tackle·special·buff·hurt) (`7f19b02`)
- **harness** — 몬스터 대기·공격 애니메이션 — 대기는 1px 움직임, 큰 동작은 sprite-gen식 한 줄 생성 (`f89f261`)

### 수정

- **battle** — 포켓몬 피해 박자 적대적 리뷰 결함 — 막타 쓰러짐·넘기기 겹침·판정 불일치 (`c7326f1`)
- **battle** — 효과음 적대적 QA 반영 + 피격 반응 리뷰 반영 (`e520397`)
- **battle** — 포켓몬 전투 효과음을 착탄에 맞춘다 (`d0ace4c`)
- **battle** — 포켓몬 스킨 타격감 — 내 몬스터 피격 노드 찾기·그림 흔들림·동작 비트 키 (`add247a`)

## 0.75.0 — 2026-10-02

### 기능

- **interior-props** — 깊은 기물은 다른 회사 모델이 한 번 더 검수(review2) — 둘 다 PASS 여야 통과 (`e9ca9be`)
- **interior-props** — 깊은 기물 꼭대기 면 강제 — 명세 검사·결정적 메모 검사·눈 먼 검수·교차 확인 (`81d0290`)
- **interior-props** — 대형 기물 10종 명세(batch3) — 기관차·객차·석탄 화차·귀족 마차·용 뼈 화석·시계탑 톱니·대형 수조·거대 기사 석상·인쇄기·증기 보일러 (`c655b12`)

## 0.74.0 — 2026-10-02

### 기능

- **harness** — 사막·동양풍도 원래 그림(옆면 약간) 허용 — 사용자 결정 (`5fb00b5`)
- **harness** — 다시 그리기 지시서 v2(출발 그림 화소가 재료·high·2바퀴·STYLE) + 감독 손수정 후보(town_bell) (`51306cb`)
- **harness** — 월드맵 아이콘 정면 카메라 다시 찍기 후보와 현대·SF 옆면 예외 (`2161580`)
- **interior** — 소품 하네스에서 고른 113종을 공용 실내 시트에 굽기 4판 + 칸 번호 고정 (`e231100`)
- **interior-props** — /harness 목록에서 「끝남」 기물을 접어 둔다 — 끝남 칩·머리를 눌러 펼친다 (`8308833`)

### 수정

- **harness** — town_bell 손수정 — 탑 명암 좌우 대칭 (`2bfad48`)
- **harness** — 정면 렌더 후보는 빛도 정면, 검수 ✗ 여도 고를 수 있게 · 현대 검수에서 엄격 절 제거 (`effcb91`)
- **interior** — 가구 사전 참고문서 — 작은 분류(8종 미만)는 20종 넘게 묶어 한 문서로(분류 한도 64문서), 두 낱말 분류 이름 잘림 고침 (`e4a252e`)

### 잡무

- **harness** — 월드맵 아이콘 결정 사본 갱신 — 사용자 검수 완료 (`d39bd0c`)

### 기타

- **harness** — 정면 카메라 개선안 실험 — 읍성(빛 원래·KY .62·정면용 배치) (`2cede59`)

## 0.73.0 — 2026-10-02

### 깨지는 변경

- **monsters** — 몬스터 그림 생성(AI로 만들기·generate_image_asset monster) 제거, 스킨 공용 정면 적 그림 삭제 (`d1a722c`)
- **battle** — 정면 전투 스킨 다섯(rm2000·dragonquest·mother·mv·vxace) 삭제 — 기본은 도트 측면 (`841f2fe`)

### 기능

- **workshop** — 에셋 만들기 권장 모델 안내(GPT-6.1 Sol medium · Claude Sonnet 5.5 이상) (`dedcf78`)
- **battle** — 정면 스킨에서 전투 화면 꾸미기를 고르면 측면 스킨으로 같이 갈아탄다 (`d4098ee`)
- **workshop** — 왼쪽 「공방」 판·공방 화면·판 화면·새 기물 폼 (`20eb77f`)
- **workshop** — 에디터 어댑터(그림·채팅·세션) (`b0c7f35`)
- **workshop** — 실내 기물 실행기(방향·그리기·자기 점검·검수 지시문) (`b78ebeb`)
- **workshop** — interior-props 매니페스트·팔레트·기물 사전·깨짐 검사 (`d2ab87f`)
- **workshop** — AI 표면 workshop-draw·workshop-review (`0e252ea`)
- **workshop** — 공방 실행기(큐·시도·자기 점검·검수·재개·429) (`a6584a3`)
- **workshop** — 공방 저장소(IndexedDB + 메모리 폴백) (`bb7d330`)
- **workshop** — 공방 공용 타입과 팔레트 키 격자 (`2211426`)

### 수정

- **workshop** — F 확대가 눈에 보이게 (정수 배율 + 크게 2배, 비교 8/16) (`a370cca`)
- **workshop** — prepare 실패 재시도, 실행 상태 알림, 공방 단축키 격리 (`17dd92e`)
- **workshop** — 공방 CSS 를 실제 토큰으로 교체하고 화면 캡처를 남긴다 (`4c5ad19`)
- **workshop** — 검색·메모 입력 보존, 오류 표시, 열기 경쟁, 단축키 가드 (`82853f4`)
- **workshop** — 프로젝트가 바뀌면 다른 프로젝트 공방 세션 정리 (`266afdc`)
- **workshop** — 검수·그리기 지시문에 생물·조각상·가는 막대 면제 (`6176fed`)
- **workshop** — 시트 자르기에서 반투명 그림자 색 보존 (`a65c606`)
- **workshop** — 엔진 다시 그리기 중복·재개 시도 기록·검수 답 예외 (`cf03965`)
- **interior-props** — 2층 침대를 가로(2×1, 32×48)로 — 머리판 서쪽·사다리 동쪽 (`8e67f12`)

### 정리

- **monsters** — 몬스터 그림 생성(AI로 만들기·generate_image_asset monster) 제거, 스킨 공용 정면 적 그림 삭제 (`d1a722c`)
- **battle** — 정면 전투 스킨 다섯(rm2000·dragonquest·mother·mv·vxace) 삭제 — 기본은 도트 측면 (`841f2fe`)

### 문서

- **openwiki** — INDEX 재생성 (`19512a5`)
- **workshop** — 공방 문서와 모델 없는 화면 캡처 스크립트 (`180f1f7`)
- **workshop** — 공방 1단계 구현 계획 + 저장을 IndexedDB 로 바꾼 설계 갱신 (`ebfc5ca`)
- **workshop** — 에디터 「공방」 1단계 설계 — 하네스를 사용자 계정으로 에디터 안에서 (`b14dc28`)

### 테스트

- **workshop** — 캡처의 가짜 검수가 B 1회차를 확정적으로 불통과, QA 메모 추가 (`2ceae9b`)

### 잡무

- **interior-props** — 2층 침대 가로 캔버스 폴더·후보 h210 (`c783c66`)
- **qa** — 조수 전투 화면 선택 A/B 4단계 증거와 블라인드 판정 (`41dccc0`)
- **scripts** — 지운 정면 스킨을 가리키던 QA 스크립트를 retro2003 으로, battle-frontview 시나리오 삭제 (`26f9717`)

### 기타

- test+docs: 정면 스킨·몬스터 그림 생성 삭제에 맞춘 시험 갱신, sideOnlyBattle 계약 시험, openwiki 절 (`96d1c93`)

## 0.72.1 — 2026-10-02

### 수정

- **ai** — 전투 화면 분위기 글의 「현대」가 판타지 첫 제작을 PAW 전용 현대 맵으로 잠그던 것을 고친다 (`d592a55`)

## 0.72.0 — 2026-10-02

### 기능

- replace arcane legacy enemy art with editable pixel sheets (`c596d06`)
- replace organic legacy enemies with articulated native pixel sheets (`805c566`)
- add original humanoid and boss enemy pixel sheets (`20f09e6`)

### 수정

- retire deprecated monster art with 100 native replacements (#1872) (`f9edf69`)
- retire legacy monster paintings and preserve native enemy catalog (`4428a19`)

## 0.71.0 — 2026-10-02

### 기능

- **harness** — redo — 안 고른 판을 지우고 새 지시서로 다시 뽑기, 화면 편의 (`05b4ccb`)
- **harness** — 미믹 새 지시서 시험 판 h132 — 열린 보물상자 h26-D 에서 출발 (`2b5903d`)
- **harness** — 후보마다 그린 쪽(Codex·Sonnet) 표시와 거르기 (`330d520`)
- **harness** — 소품 하네스 엔진을 Codex CLI(gpt-6.1-sol medium)로 — 그리기·검수 모두 (`8f4d7d4`)
- **interior** — 새 기물 2차 102종 명세 + 둘째 상태(다른 기물의 고른 그림에서 출발) (`23bf078`)
- **interior** — 가구 쓰임·방향·상태 짝 + 소품 하네스 새 기물 모드 + JRPG 장치 11종 명세 (`b5bc998`)
- **content** — 소품 하네스 — 검수 탈락 시 다시 그린다 (`4fe8037`)
- **content** — 실내 소품 하네스 — Sonnet 다섯 명이 찍고 사용자가 고른다 (`c75c696`)

### 수정

- **harness** — 작업지시서가 정면도를 허락하던 것 — 시점 절 숫자화, 예시 그림, 기준 그림 거르기 (`fe9c9f3`)
- **harness** — 검수가 윗판 없는 정면도를 통과시키던 것 — 꼭대기 면 규칙 (`06bb217`)
- **harness** — 새 기물 썸네일 자리 표시 (`f72ba41`)

### 성능

- **harness** — 작업자 세션을 가볍게 — 저장소 밖 작업 폴더·도구 넷·플러그인·MCP 없음 (`e1fed52`)
- **harness** — 소품 하네스 동시 작업자 5 → 16 (`25f81e4`)

### 문서

- **interior** — 쓰임·상태 짝·새 기물 하네스 모드·칸 번호 밀림 함정 (`e611ad3`)

### 잡무

- **harness** — 새 지시서 다시 뽑기 판 h133~h208 후보와 사용자가 고른 것 (`53c342f`)
- **harness** — Codex 판 h62~h128 후보 그림(335장, 검수 통과 332) (`64e4ba9`)
- **harness** — Codex 동시 작업자 16 명 — 12 명은 약 3.3시간 (`8cce5cf`)

## 0.70.1 — 2026-10-02

### 수정

- **editor** — 연출 편집 화면 실측 캡처에서 나온 세 군데 (`fa9e243`)

## 0.70.0 — 2026-10-02

### 기능

- **battle-fx** — 적 쓰러짐 연출·전투 배경 겹·상태 몸 표시 6종·이펙트 회전/뒤집기/겹치기·화면 필터 (`320344c`)

### 수정

- **ai-tools** — upsert_troop 이 members 만 받아도 enemyIds 를 채운다 + 전투 연출 조수 시험 브리프 (`45c3656`)
- **battle-fx** — 쓰러짐 연출 실측 반영 — 도트 적 맞은 칸 유지·결과 도장 대기·이펙트 층 섞기·오라 몸 상자 (`24cbb61`)

## 0.69.0 — 2026-10-02

### 기능

- **staging** — 레터박스·흔들기 방향·파티클·모습 효과(포즈·색·잔상) + 컷신 비트·연출 지침 (`7111254`)
- **items** — diversify effects and balance the shared item economy (`4029d2a`)
- **items** — seed 1000 shared items and regenerate unified pixel icons (`7d70caa`)

### 수정

- **ts** — JSON 선언 파일을 읽도록 allowArbitraryExtensions를 켠다 (`e4a2905`)
- **items** — bound TypeScript inference for shared item data (`f13b557`)
- **staging** — 조수 gen 실측 반영 — kind 짐작·화면 효과 full 판정·모자이크는 전환에만 (`35d8f0f`)
- **staging** — 따라가는 파티클 이미터를 원점에 만든다 + 위키·캡처·연출 기획 브리프 (`eac5b98`)

## 0.68.0 — 2026-10-02

### 기능

- **blend** — 이벤트 그림·그림 표시 겹치기 — 더하기·스크린·곱하기 (`811581e`)
- **harness** — 월드맵 아이콘 공격적 폐기 — 엄격 검수, 불합격 후보 숨김·대체, 투영 세트 일괄 버림 (`b788e47`)
- **screen-fx** — 화면 왜곡 — 물결·모자이크·기울기 (카메라 후처리) (`622da77`)

### 수정

- **battle** — 양피지 창 선택 글씨가 밝은 강조색에 묻히고 영화 띠가 파티 마지막 줄을 덮던 것을 고친다 (`cc99052`)
- **ai** — 실행 턴이 계획 턴의 「읽기 전용」 말을 제 얘기로 읽고 멈추지 않게 한다 (`ab95724`)

### 잡무

- **blend** — 캡처 그림을 화면 아래로 — 스프라이트와 안 겹치게 (`9293f5e`)

## 0.67.0 — 2026-10-02

### 기능

- **harness** — 월드맵 아이콘 다시 그리기 판 — 후보 N장, 검수, 사용자 고르기 (`1d99e45`)
- **cinematic** — 그림 이동·카메라 팬에 움직임 곡선(easing) (`df0face`)
- **assistant** — 컷신 그림을 게임 화면 계약(16비트 3/4 탑뷰·16px 도트)에 맞춘다 (`88498e6`)
- **assistant** — 컷신 그림 생성·충돌 연출·미리보기 도구와 컷신 beat 결함 수정 (`9394f64`)

### 테스트

- **cinematic** — 이징 곡선 단위 테스트 (작성만, 미실행) (`16af46d`)

## 0.66.0 — 2026-10-02

### 기능

- **harness** — 현대 거리 탈것 도트 하네스 modern-vehicles (pxgrid 후보 5명 + 기계 검사 + 독립 검수) (`cbede8f`)
- **harness** — 하네스 구조와 몬스터 수집 종 스프라이트 하네스 (`4e517b8`)

### 정리

- **harness** — modern-vehicles → modern-chipset (modern3 칩셋 전용, 종류는 안에서 확장) + codex 작업자 선택 (`607527b`)

### 테스트

- **harness** — 몬스터 종 하네스 시험 + 진화 단계 몸집 배율 + 모래상자 (`11008f2`)

## 0.65.0 — 2026-10-02

### 기능

- **ai** — 조수가 기획 톤에 맞춰 전투 화면 프리셋을 고른다 (`543fc0e`)
- **harness** — 월드맵 아이콘 하네스 — 검수자 판정 + 사용자 받기/버리기 (`8ddbb0b`)

## 0.64.0 — 2026-10-01

### 기능

- **content** — 월드맵 아이콘 세트 「현대·SF」 17역할 22장 (경사 투영 렌더러) (`c21f973`)
- **content** — 월드맵 아이콘 세트 사막·동양풍 — 투영 렌더러로 22장(17역할), 새 색 0개 (`c33b51d`)
- **content** — 월드맵 키트 — 지형·팔레트·아이콘 세트·여정 템플릿 4층 분리와 빌더 (`87e510f`)
- **relief** — 편집기에 들린 타일·절벽 띠 컨테이너·부분 갱신을 붙인다 (`f1ec040`)
- **relief** — 높이 지형 런타임 — 걷기·들림·화면 변환·줄 띠·양식·경사로 (`a7abcc1`)
- **battle** — 전투 화면 꾸미기 — 프리셋 12종과 칸별 덮어쓰기 (`9b165f1`)

### 수정

- **relief** — rim 블록의 양식 null 가드 (`fd9f4a9`)
- **relief** — 쓰지 않는 RELIEF_DEFAULT_RIM import 를 뺀다 (`ff63636`)
- **relief** — 높이 지형 맵은 창 단위 타일 그리기를 건너뛰고 전체 경로로 그린다 (`25035cb`)

### 문서

- **content** — 월드맵 키트 — 아이콘 세트 둘 검증 결과와 제품 등록 보류 사유 (`818de10`)
- **openwiki** — 색인 재생성 (`d006f2b`)
- **relief** — 높이 지형 지도(relief-terrain)와 스키마·편집기·도구 문서를 갱신한다 (`e5e1c01`)

### 테스트

- **relief** — peat 양식 기대값과 벽 띠 측정을 실제 렌더에 맞춘다 (`ac4ba0b`)
- **relief** — 높이 지형 단위 시험·구조 검사기·QA 시나리오·경사로 도트 원본 (`1b7e968`)

## 0.63.0 — 2026-10-01

### 기능

- add composable quest presets and verified player workflows (`4e97a36`)

### 수정

- **editor** — 퀘스트 선택 아이콘 크기를 DeckIconSize에 맞춘다 (`e7464ca`)

## 0.62.0 — 2026-10-01

### 기능

- support 1024 by 1024 maps and measure performance (`3499fd7`)
- **dialogue** — 전신 초상 크기를 에디터에서 조절한다 (`f90ae70`)

## 0.61.0 — 2026-10-01

### 기능

- support 512 by 512 maps across editor and tools (`bf02c1f`)

### 수정

- bound runtime map tile rendering to the camera (`1b54977`)

### 테스트

- repair parity consumer reference and record local CI checks (`a836907`)

## 0.60.0 — 2026-10-01

### 기능

- **portraits** — 공용 초상 16표정 전부·외형 전신 칸·조수 자원 검색 (`632ef9c`)

## 0.59.0 — 2026-10-01

### 기능

- **battle** — 측면 스킨 여섯을 도트 측면 전투 뼈대 위의 창 모양으로 (`1c93142`)

## 0.58.1 — 2026-10-01

### 수정

- **interior** — 사용자 판정 — 나빠진 7종 이전 그림으로, 옆 보는 의자 새 후보, 시야각 규칙 바로잡기 (`e8525b6`)
- **interior** — 3/4 전수조사 — 명백한 위반 44종 다시 그려 굽기 3판 (`52bb08c`)

### 기타

- **interior** — 3/4 전수조사 — 기준 그림 6종·§11-4·작업자 절차 3판·A 등급 44종 배정 (`62c7359`)

## 0.58.0 — 2026-10-01

### 기능

- 공용 표정 세트 76종에 흉상·전신 5표정을 더한다 (`f5b9dfe`)

### 수정

- **battle** — retro2003 아래 칸을 원작 배치로 — 왼쪽 적 이름·명령, 오른쪽 파티 상태 (`b63c491`)

### 문서

- openwiki 색인 갱신 (`7407873`)

## 0.57.0 — 2026-10-01

### 기능

- **battle** — 소환 그림(summonResourceId) — 도트 몬스터가 나타나 달려가 친다 (`699c189`)
- **battle** — 힘 모으기(적 대기술 예고)·게이지 밀기·변신 + 재생 오라 강화 (`970f741`)

## 0.56.0 — 2026-10-01

### 기능

- **interior** — 손 도트 실내 시트 굽기 2판 — 3/4 재작도·변형 몸통·새 기물 28종 (`b9d4e8d`)

## 0.55.0 — 2026-10-01

### 기능

- **content** — 실내 변형 몸통 71종 + 새 기물 28종 후보 (`5847c84`)
- 적 스킬 연출 레코드를 녹화 하네스(--custom)로 검증하고 위키를 갱신한다 (`552a40c`)

### 수정

- **release** — 태그가 앞서면 그 버전에서 이어서 제안하고 0.54.0 기록을 되돌린다 (`6261282`)
- 적이 쓰는 스킬에 연출 레코드를 붙일 때 편집기 안내·조수 노트·접근 판정이 적 기준으로 동작하게 한다 (`8973bc2`)
- 독 속성 자동 추천 연출이 독칼·맹독 상태·커스텀 독 상태에서도 초록으로 재생되게 한다 (`1ff5438`)

## 0.54.0 — 2026-10-01

### 기능

- **content** — 손 도트 실내 「새 기물 길」 — v5 밖 기물을 후보·고르기·굽기로 (`5ced6fd`)

## 0.53.0 — 2026-10-01

### 기능

- **content** — 고르기 화면에 「✱ 새 후보」 — 마지막으로 본 뒤 들어온 후보 표시 (`8ac7686`)

## 0.52.0 — 2026-10-01

### 기능

- **battle** — 반응·표적 상태 7종 — 반격·도발·감싸기·회피·리플렉·리레이즈·선고 (`3bbb414`)
- **ai** — 버들항 마을 노트·시스템 프롬프트가 theme 을 고르게 한다 (`e2297e5`)
- **editor** — author_beodeul_town 마을 문법 — 굽은 큰길·뒷길 고리·광장·길을 보는 집(theme) (`4b0da27`)
- **content** — 버들항 고른 조각 길·광장 표본에 road/plaza 태그, 통나무 집도 문 칸 (`896a0ba`)
- **content** — 버들항 고른 조각 건물 키트에 문 칸(parts.entrance)을 붙인다 (`4c07218`)

### 수정

- **editor** — 버들항 마을 길이 큰 맵에서도 45칸 넘게 곧지 않게 — 12~16칸마다 굽이 열쇠점 (`efe4082`)
- **editor** — 참고문서 읽기 도구가 빈 문자열 id 를 없는 것으로 본다 (`02d4483`)

### 문서

- **openwiki** — 버들항 마을 문법(author_beodeul_town theme)·문 칸·r2 시험 (`6745cc8`)
- **content** — 버들항 마을 배치 문법 참고문서 — 고른 변형 넷에서 뽑은 순서·수치·theme 별 키트 (`d9fccd6`)

### 테스트

- **ai** — 조수 실모델 시험 r2 — 「버들항 느낌으로 강가 마을 하나 만들어 줘」 (`eac7b19`)

## 0.51.0 — 2026-10-01

### 기능

- **content** — 빵 화덕에 천장까지 닿는 실내 굴뚝 + 위로 키운 애니메이션 기물 굽기 (`f89f100`)
- **content** — 빵 화덕·마법서 받침 3/4 3차 후보 (`5bd8bc0`)
- **content** — 실내 3/4 재작도 2판 — 애매 11종 + 독서대 2x1 (`6c536d6`)

## 0.50.0 — 2026-10-01

### 기능

- **tileset** — 버들항 고른 조각 참고문서 5용도와 조수 안내 (`dab2c79`)
- **tileset** — 기존 버들항 사본에 고른 조각 꼬리를 덧붙이는 ensure 경로 (`6b5df88`)
- **tileset** — 버들항 시트에 고른 장소 조각 439종 굽기 (칸 23936~27647, 키트 bd-pick-*) (`57b096e`)
- **content** — 버들항 변형 고른 조각 설치 스크립트와 고른 최종 세트 (`a389926`)

### 문서

- **openwiki** — 버들항 고른 장소 조각 굽기·기존 프로젝트 덧붙이기·화면 증거 (`a4df75a`)

## 0.49.0 — 2026-10-01

### 기능

- **content** — 실내 가구 50종 3/4 시점 재작도 후보 (`56cc942`)

## 0.48.0 — 2026-10-01

### 기능

- **dialogue** — 전신 초상을 대사창 뒤 입상으로 · 한 페이지 3줄 · 기록 버튼 숨김 · ▼ 진행 표시 (`998e3e3`)
- **content** — 월드맵 설계 데모 6~8단계 — 해안선·3띠 바다·성곽 도시·랜드마크 3/4 재작도·절벽 결·메사·협곡·길 (`e0c5c4a`)
- **battle** — retro2003 로스터 p5 묶음 스킬에 기믹을 넣는다 (`fad0854`)
- **battle** — retro2003 로스터 p4 묶음 스킬에 기믹을 넣는다 (`4090887`)
- **battle** — retro2003 로스터 p3 묶음 스킬에 기믹을 넣는다 (`10a2c00`)
- **battle** — retro2003 로스터 p2 묶음 스킬에 기믹을 넣는다 (`de82295`)
- **battle** — retro2003 로스터 p1 묶음 스킬에 기믹을 넣는다 (`ca7c65f`)
- **battle** — retro2003 로스터 m6 묶음 스킬에 기믹을 넣는다 (`91ae32d`)
- **battle** — retro2003 로스터 m5 묶음 스킬에 기믹을 넣는다 (`5c6ef16`)
- **battle** — retro2003 로스터 m4 묶음 스킬에 기믹을 넣는다 (`3ec3962`)
- **battle** — retro2003 로스터 b5 묶음 스킬에 기믹을 넣는다 (`2baf3e4`)
- **battle** — retro2003 로스터 b4 묶음 스킬에 기믹을 넣는다 (`5cbeed7`)
- **battle** — retro2003 로스터 b3 묶음 스킬에 기믹을 넣는다 (`2c43e0b`)
- **battle** — retro2003 로스터 b2 묶음 스킬에 기믹을 넣는다 (`117e99a`)
- **battle** — retro2003 로스터 b1 묶음 스킬에 기믹을 넣는다 (`9a35625`)
- **battle** — retro2003 로스터 a3 묶음 스킬에 기믹을 넣는다 (`2c58a84`)
- **battle** — retro2003 로스터 a2 묶음 스킬에 기믹을 넣는다 (`f86a0b6`)

### 수정

- **battle** — 즉사의 낫에서 엔진이 무시하는 state_death add 를 빼고 2타 비율 피해로 — 검사기·가이드에 즉사 금지를 적는다 (`4f72602`)

### 문서

- **openwiki** — 로스터 전 묶음 기믹과 검사 스크립트 (`7cce05b`)

### 잡무

- **qa** — retro2003 로스터 스킬 기믹 검사 스크립트 (`c079838`)

## 0.47.0 — 2026-10-01

### 기능

- **interior** — 18302 에서 고른 실내 가구 후보를 atlas_biome_interior 시트에 굽는다 (`2e8182f`)

## 0.46.0 — 2026-10-01

### 기능

- **interior** — 손 도트 실내 v5 를 main 에 이식 — 옛 실내 칩셋 폐기 + 새 실내 맵 기본 (`04a3b52`)
- **start** — 「예제로 시작」·「작은 마을 추가하기」 시작 마을을 버들항으로 (`46e26f0`)

### 수정

- **assistant** — author_wild_route 가 버들항 맵도 깐다 — 몬스터 수집 첫 구간이 버들항 시작에서 멈추던 것 (`0c011b8`)

## 0.45.1 — 2026-10-01

### 수정

- **defaults** — 버들항 기본의 남은 구멍 — create_map 잔디, 생성 칩셋 계열, 문법 오류 (`7386714`)
- **battle** — 흡수·버서크·겹 배경·연출 도구의 남은 결함 (`9eb9184`)
- AI 첫 연결 계정과 작업 모델 정합성 및 OAuth 재개 개선 (#1788) (`057c3db`)

## 0.45.0 — 2026-10-01

### 기능

- **ai** — 버들항 마을 실모델 시험 하네스·증거 + 참고문서 용도 오류에 유효 id 안내 (`6b6e674`)
- **ai** — 버들항 마을 요청은 author_beodeul_town 경로로 — 노트·도구 노출·마을 계약 우회 (`a6f83a1`)
- **ai** — author_beodeul_town 을 참고문서 WRITER 로 등록 (`09c135c`)
- **project** — 새 프로젝트의 야외 기본 타일셋을 버들항으로 (`764bb2b`)
- **ai** — author_beodeul_town — 버들항 블록 키트로 마을 시공, author_village 는 버들항 대상이면 그쪽으로 위임 (`c381580`)
- **defaults** — 버들항을 새 프로젝트 기본 타일셋으로 (`181ec0d`)
- **assistant** — fill_region path+width — 굽은 운하·강·대로를 중심선 점으로 한 번에 칠한다 (`5ebefa1`)
- **content** — 버들항 예시 「굽이 운하 도시」 — 다섯 요소·굽이 셋 운하·띠 쌓기, 참고문서가 바둑판 대신 이것을 먼저 보인다 (`33f9fcc`)
- **assistant** — 도시 스킬에 다섯 요소·띠 쌓기·check_city_form 먼저 — 시험에 check_city_form 노출, 라운드 비교 표 (`078ef6e`)
- **assistant** — check_city_form — 막다른 길·직선 운하·이웃 반복·축선 그래프를 좌표로 알려 주는 도시 형태 검사 (`1ab74cf`)
- **content** — 버들항 블록 변형 41종·반복 자·항구 예시 — 적대적 QA 반영 (`28cce56`)
- **content** — 버들항 빈 바닥 자와 블록 조립 예시 배치 layout-blocks (`299050d`)
- **content** — 버들항 블록 키트 25종 — 도시 한 블록을 통째로 찍는 bd-block-* (`4ae366a`)
- **content** — 버들항 원본과 다른 예시 배치 둘(언덕 위 성읍·강어귀 항구)과 배치 자 (`ef11a3a`)
- **content** — 버들항 자동타일(연석 포장길·운하 물·모랫길)과 강·폭포·항구 호수·귀족 저택·외곽 목조집·우물 광장 키트 (`db718e1`)
- **qa** — 조수 시험 — klb/claude-opus-5.5 가 참고문서만 보고 버들항 비슷한 도시를 새·기존 프로젝트에 깔았다(구역 키트 8/8, 문 앞 도달 전부, 원본 복사 65%·강 윗줄기 빠짐), runPiAgent 에 로컬 모델 객체 주입(options.model) (`36c9ecb`)
- **content** — 버들항 v6 를 공용 타일셋 beodeul_city 로 — 렌더를 16px 칸으로 자른 시트 22,784칸·animationStrips 1,699·구역/건물/소품/나무 키트 120·참고문서 4용도(MD 17·그림 21, 16구역 QA 오류 그림 5), 정본 저장·재로드(deepEqual, 통행 불일치 0, 주민 없는 원본과 0화소) (`70aa032`)
- **content** — 버들항 v6 마무리 — 잔교를 길과 잇는 길 한 줄, 포룸 아치 문·분수 발치 비움, 교수대로 읽히던 무기 거치대 뺌, 16구역 QA(중대 25→7)·v6 페이지·메타 (`8fe0554`)
- **content** — 버들항 v6 — 길과 이어지는 아치 다리, 무늬 없는 물과 자연 물가 (`235fefb`)
- **content** — 버들항 v6 — 큰 탑풍차, 각 잡은 포룸(신전·주랑·아치 문), 흰 마름돌 왕성 키트, 회벽+기와 저택, 수도교·우산소나무 제거 (`7a756ba`)
- **content** — 버들항 v6 시작 — v5 사본을 city_v6 로 옮기고 /tmp 경로를 저장소 기준으로 (`03a17e6`)
- **tiles** — 번들 타일셋의 animationStrips 도 재생 — 손으로 그린 분수·횃불 프레임을 번들 시트에서 움직일 수 있게 (`409b97f`)

### 수정

- **battle** — retro2003 스킬 한 행동을 연출 한 번으로 묶는다 — 대가·흡수 숫자는 대상·타수로 세지 않는다 (`55c3302`)
- **relief** — 높이 붓의 하위 층 절벽 굽기를 걷어내고 모든 칩셋을 덧그림으로 그린다 (`b347a08`)
- **assistant** — check_city_form 이 stamp_object 로 찍은 블록·구역 킷을 칸 무늬로 찾는다 (`3afa168`)
- **content** — 버들항 예시 배치 적대적 시각 QA 반영 — 잘린 구역 가장자리, 떠 있는 폭포, 빈 들판, 길망에서 떨어진 모랫길 (`7d53faf`)
- **content** — 버들항 그리기가 아직 /tmp/j8city 모듈을 읽던 것 끊기, 밀밭 색·구역 키트 가장자리 정리 (`77cbe6d`)
- **content** — 버들항 잔디 무늬 조각 6개를 실제로 만들기 — 원본엔 6×6 빈 풀밭이 없어 0개였다 (`fe64c3f`)
- **content** — 버들항 v6 잔결함 — 반복 나무·빨래줄 줄임, 밀밭 원색 누그러뜨림, 막다른 길·강으로 끝나는 길 정리, 성 북쪽 물띠 줄무늬, 넷째 다리·부두 (`fd557dc`)
- **content** — 버들항 v6 그리기가 /tmp·홈 폴더를 읽지 않게 — 정글 시트·잔디/물 견본 사본을 lib/city_v6/assets 로, 출력은 CITY6_OUT, 편집기용 땅 렌더·점유 격자·물체별 그림·주민 목록을 함께 쓴다 (`11bf71e`)
- **content** — 버들항 v6 — 탑 원뿔 처마 밑 소품 금지, 짚단 색(금 상자로 읽힘), 운하 남쪽 끝 이어짐, 새싹 밭 제외 (`c36cc57`)

### 성능

- **palette** — role 없는 타일셋의 지형 분류 보정 + 전후 측정 자료 (`d3876a8`)
- **palette** — similarTilesForTile 의 타일별 그룹 조회를 한 번만 만든다 (`977bfc4`)
- **palette** — 커스텀 팔레트 2D 가상화 + 필터 전환은 목록만 교체 (`93b9de2`)

### 문서

- **ai** — author_village tilesetId 설명 — 새 프로젝트 야외 기본은 버들항 (`c688328`)
- **ai** — 버들항 작업 지시서에 author_beodeul_town 먼저 부르는 단락 추가 (`d3fd89a`)
- **beodeul** — 타일 까는 이론 조사 — 조수가 쓸 수 있는 여섯 기법과 못 쓰는 것 (`eb5d609`)
- **openwiki** — 버들항 라운드 3 — 블록 키트·빈 바닥 자·조수 재시험·정본 v8 (`eb3beaa`)
- **content** — 버들항 블록 조립 참고문서 줄임 — 첫 시험이 읽기로 50분을 다 썼다 (`6901acc`)
- **content** — 버들항 블록 조립 참고문서와 조수 스킬 city-block-assembly (`4ca2259`)
- **content** — 버들항 라운드 2 조수 재시험 결과와 위키 — 원본과 같은 칸 65% → 0.4% (`49b9bd6`)
- **content** — 버들항 참고문서 다시 쓰기 — 「원본 좌표 = 정답」을 「원본은 예시, 배치 규칙」으로 (`d3eaee1`)
- openwiki/beodeul-city.md — 버들항 저장·공용 타일셋·조수 시험 기록, 다음 판 참고 그림 셋(귀족 저택·외곽 나무집·부품 조립 구조) 보류 방향 (`ddf67e4`)

### 테스트

- **qa** — 라운드 3 조수 결과를 도시 형태 자로 다시 잰 값 — 곧은 길 7~9줄(최장 86~87칸)·운하 곧음 0.99·막다른 길 0/12 (`f67a1ff`)
- **qa** — 버들항 라운드 3 조수 재시험 결과 — 블록 키트로 빈 바닥 34.7%·29.7% → 15.1%·14.1% (`96b8d4c`)

### 잡무

- **qa** — 버들항 조수 시험·정본 저장을 라운드 3 으로 — 블록 키트 과제, 빈 바닥 측정 (`cfa8017`)

## 0.44.0 — 2026-10-01

### 기능

- **content** — 현대·강남 v2·월드맵 3~5단계·버들항 변형 20곳·고르기 화면 모음 (`2f35432`)
- simplify project starts and show interview progress (`1831ddd`)

### 수정

- **editor** — 첫 실행 안내 저장에 scope를 붙여 main 빌드를 되살린다 (`e1f09ce`)

### 문서

- **atlas-pick** — 현대·강남·일본 작업 인수인계 문서 (`65eedaf`)

## 0.43.3 — 2026-10-01

### 수정

- **battle** — resolve 14 adversarial review findings (`568a461`)

## 0.43.2 — 2026-10-01

### 수정

- **perf** — 통합 타입 오류 3건 (저니 참조 이슈 null, 팔레트 필터 인자 타입) (`d8cb048`)
- **editor** — 맵 크기를 늘릴 때 새 칸을 검은 빈칸 대신 가장자리 바탕 타일로 채움 (`10872d7`)

### 성능

- **editor** — 느린 GL 에서 Phaser 루프를 setTimeout 으로 구동해 이동 지연 중앙값 29~37 -> 11~13ms (`9692a3c`)
- **editor** — 렌더 게이트 - pointermove 는 2프레임 예산, 느린 GL 은 렌더 간격 스로틀 (`0ccfbb2`)
- **editor** — 칠하기 중 자동저장 pending 상태를 이미 pending 이면 다시 방송하지 않음 (`a66efc0`)
- **editor** — 커서 상태 표시를 Text.data 로 갱신해 pointermove 당 전체 스타일 재계산 제거 (`414e3b5`)
- **editor** — 맵·레이어 전환 실측 증거 (렉 수정 I) (`bae22be`)
- **editor** — 맵·레이어 전환 UI 비용 규칙을 위키에 기록 (`5a0f2a8`)
- **editor** — 조수 패널 구독자·크기 크롬의 같은 값 재기록 제거 (`96765f7`)
- **editor** — 숨겨 둔 자료집 창에 content-visibility:hidden — 맵 전환 220->126ms (`f60f236`)
- **project** — 부팅 정규화 건너뛰기 증거 트레이스와 옛 파일 검증 도구, 위키 기록 (`5bb01dc`)
- **editor** — 레이어 전환의 스타일 재계산 50ms 제거 — :has(.is-active) 규칙을 정적 클래스로, 탑바 통째 재구성 중단 (`30f6619`)
- **editor** — 부팅 유휴 워밍을 캐릭셋 색키로 한정 (얼굴·칩셋·CC0 아이콘 ~1500장 제외) (`1ddfcc8`)
- **project** — 같은 빌드·같은 공용 판본이 이미 정규화한 문서는 부팅 정규화를 건너뛴다 (`30037c4`)
- **project** — 공용 타일셋 structureKits 순서를 수렴시켜 로드마다 문서가 뒤집혀 저장되던 것을 끝낸다 (`3b0a55a`)
- **editor** — 맵 전환 시 여정 띠·저장 배너를 입력이 같으면 다시 짓지 않는다 (`69d338b`)
- **palette** — 선택 칩·붓 컨트롤을 제자리 갱신해 전체 트리 스타일 재계산 제거 (`c07bf8b`)
- **project** — 부팅 정규화기 비용·마이그 저장 지속성 측정 증거 (`cfa9f57`)
- **build** — 큰 번들 JSON 을 bundled-data 청크로 분리 (진입 청크 31.0MB -> 8.9MB) (`8c97d42`)
- **project** — 번들·공용 참고문서를 저장 문서에서 빼고 로드에서 되돌림 (`9169116`)
- **palette** — 커스텀 팔레트 레이어·필터 전환은 시트를 유지하고 제자리 동기화, 그림 교체는 CSS 변수 하나, 타일셋 이미지 디코드 공유 (`2f634ed`)
- **store** — update 를 copy-on-write 로 (121ms → 3ms) (`7587fa3`)
- **persist** — 저장 diff 의 타일셋 비교를 한 번 대조 뒤 O(1) 로 (1.1s → 약 55ms) (`0a5c8fa`)
- **spatial** — 장소 카드 컴파일 캐시 — 입력 참조가 같으면 재컴파일 생략 (`daf2e66`)
- **spatial** — 카드 미리보기 컴파일 격리를 타일셋 포인터 공유로 — 카드당 5347→961ms (`650819c`)
- **editor** — 타일 칠하기 중 도구줄·여정·배너 재조립 생략, 조수·기록 구독자 거르기 (`e596241`)
- **host** — 살아 있는 타일셋 본문 목록을 행 sha 로 기억해 접힌 행 재파싱을 없앤다 — 저장 중앙값 542→469ms, 지문 동일 (`dceb460`)
- **host** — 미디어 분리 점검이 접힌 행만 본다 — 열기 5-6.7s→63ms, 저장 1-3번째 4.5s→0.7s (`f39df1e`)
- **host** — 저장 시 바뀐 맵 거울 행만 다시 쓰고 타일셋 본문 조회를 한 번으로 — 지문 동일 (`593fb58`)
- **host** — 저장 SHA 를 타일셋 접두 해시 상태 캐시로 계산 — 저장 중앙값 1885→660ms, sha 계약 불변 (`f62f026`)

### 잡무

- **perf** — 통합 전후 실측 증거 (`9df7e3c`)

## 0.43.1 — 2026-09-30

### 수정

- **battle** — 겹 배경을 쓰는 전투는 배경을 하나만 그린다 (`92420c6`)
- **battle** — retro2003 겹 배경을 진입 커버 동안 미리 읽어 전투 시작 직후 배경이 바뀌지 않게 한다 (`7591f62`)

## 0.43.0 — 2026-09-30

### 기능

- **retro** — upsert_choreography 에 screen 손잡이를 열고 B 단계 문서·증거를 정리한다 (`fde533b`)
- **retro2003** — 상태 지속 오라(battleAura) — 8종 CSS 표시, 상태 편집 선택기, upsert_state 필드 (`78744dc`)
- **retro2003** — 연출 자동 추천 — 계약 없는 스킬을 기전·속성·범위로 직업 연출에 배정한다 (`c7d2d9f`)
- **retro-choreo** — 연출 편집기에 손잡이 칸(속도·무게·색조·화면 효과·층 색/효과음)과 시트 카드 한글 이름 (`0258663`)
- **retro** — 연출 손잡이 런타임 — speed·weight·tint·screen·층 se (`c9d8dba`)
- **retro** — 연출 색 프리셋 9종(CSS filter)과 비교 시트 스크립트 (`e7a29b5`)
- **assistant** — preview_choreography 도구 — 층별 시트 프레임을 한 장으로 이어 붙여 조수에게 보여 준다 (`32ffef3`)
- 스킬 탭 도트 연출 칸을 애니메이션 썸네일 갤러리로 바꾼다 (`c99586e`)
- 데이터베이스에 「도트 연출」 탭과 움직이는 썸네일 갤러리, 층 타임라인 편집기를 더한다 (`40398d3`)
- 도트 연출·이펙트 시트 검색을 한국어로도 되게 한다 (`9eb409d`)
- 혼합 연출 4개와 기존 계약 스킬 회귀를 출하 플레이어 경로로 녹화·검증한다 (`223caeb`)
- 조수가 연출을 시트 조합으로 조립·복제·조회하는 도구 (upsert/duplicate_choreography, list_fx_sheets) (`8ab97af`)
- 스킬 연출 층에 startMs·scale·repeat·onHit 옵션을 붙인다 (`6647572`)
- 스킬 연출 조회를 한 함수(resolveSkillChoreography)로 모은다 (`8da808a`)
- 스킬 연출 레코드 타입과 database.skillChoreographies 컬렉션 (`8de851f`)
- **content** — 16px 칩셋 저작 하네스 — 3/4 시점 계약·칸 규격·후보 세트·EasyRPG 월드맵 개선판 (`b8f76d6`)

### 수정

- 도트 연출 편집기 층 행 숫자칸·시간축 글씨를 읽히게 하고 A2 증거·문서를 남긴다 (`4a6451c`)
- 연출 무대 미리보기가 존재하지 않는 mechanic 필드 대신 hitSequence 타수를 읽는다 (`32a416a`)

### 정리

- 연출 복제·id 생성을 공용 모듈로 옮긴다 (`70d7b2b`)

### 문서

- 프로젝트 연출 레코드(skillChoreographies)와 조립 도구를 openwiki 에 적는다 (`cf803bd`)
- 스킬 도트 연출을 자료집 레코드로 올리는 설계 (`313e555`)

### 테스트

- **qa** — 단계 B 증거 f — 상태 8종 오라를 실제 전투 화면으로 확인한다 (`6c53932`)
- **retro-choreo** — 단계 B 증거 e(계약 없는 스킬의 자동 추천 8종 녹화) (`ac53e2f`)
- **retro-choreo** — 단계 B 증거 a~d(색조·속도·무게·화면 효과)와 실측 하네스 (`5c31df9`)
- **retro2003** — 자동 추천 결과 표와 손잡이 편집 화면 증거 (`3fd03dd`)

## 0.42.0 — 2026-09-30

### 기능

- **qa** — 조수 도구로 만든 임의 스킬 8종을 retro2003 전투에서 재생 검증한다 (`543a0d6`)
- **assistant** — 스킬 설계 지침을 조수가 읽는 read_retro_skill_guide 도구로 제공한다 (`78f5460`)
- 조수 upsert_skill 에 체력 소모·흡수·연출 빌리기와 연출 조회 도구 추가 (`3280d72`)
- 스킬 탭에 도트 연출 고르기 (`a85f127`)
- 스킬 retroChoreographyId 로 계약 도트 연출을 빌려 쓴다 (`506f251`)

### 수정

- 스킬 무대의 쓰지 않는 import 를 걷어 tsc 를 통과시킨다 (`e6d483a`)
- **editor** — 도트 연출 고르기가 몬스터 스킬 조회를 없는 곳에서 가져와 자료집이 안 열리던 것을 고친다 (`60ae674`)

### 문서

- 스킬 도트 연출 빌리기·조수 스킬 저작 도구를 위키에 적는다 (`844117f`)
- 스킬 탭 도트 연출 고르기 편집기 증거 촬영을 남긴다 (`9b89ee2`)

## 0.41.0 — 2026-09-30

### 기능

- **project** — 기존 프로젝트에 레트로 로스터 레코드를 빠진 것만 심는다 (`0450c1c`)
- **editor** — 상태 편집 화면에 스톱·버서크·프로텍트/실드·속성 등급 덮어쓰기 칸을 추가한다 (`3493492`)
- **editor** — 스킬 편집 화면에 범위(원·직선)와 연계기 배우 칸을 추가한다 (`1023902`)

### 수정

- **db** — 연계 배우를 한 명만 골랐을 때 패널 재렌더로 선택이 사라지지 않게 한다 (`a4e2183`)

### 문서

- **openwiki** — 레트로 전투 기믹 편집 칸과 ensureRetroRosterRecords 를 적는다 (`d162ec6`)

### 테스트

- **editor** — 레트로 전투 기믹 편집 화면 증거 캡처 (`28962a5`)

## 0.40.1 — 2026-09-29

### 수정

- **release** — 플레이어 산출물 텍스트 검사 상한을 64MiB 로 올려 main 빌드를 되살린다 (`2a88663`)

## 0.40.0 — 2026-09-29

### 기능

- retro2003 로스터 m4 전투 도트·스킬 8×8 (`eb239a3`)
- retro2003 로스터 m5 전투 도트·스킬 8×8 (`12c8fd9`)
- retro2003 OPRN 몬스터 걷기 칩 Monster5 — 칸 위 여백·몸 높이 30px 이하·부유 높이 보정 (`3cb8541`)
- retro2003 로스터 m6 전투 도트·스킬 8×8 (`99ea0eb`)
- retro2003 OPRN 몬스터 걷기 칩 Monster4 (`ef32465`)
- retro2003 로스터 m6 전투 도트 — 키메라·타락 천사 15칸 (`9e352cc`)
- retro2003 로스터 m6 전투 도트 — 나방 인간·바실리스크·지니 15칸 (`b5fd7b6`)
- retro2003 로스터 m6 전투 도트 — 예티·인어 전사·사이클롭스 15칸 (`199d510`)
- retro2003 로스터 m5 전투 도트 3차(태엽 병정·촛불 임프), 임프 촛농 바닥 정렬 (`39a0124`)
- retro2003 로스터 m5 전투 도트 2차(저주 인형·마도서·허수아비) (`d398491`)
- retro2003 로스터 m5 전투 도트 1차(미믹·살아있는 갑옷·초롱 귀신) (`e3346ce`)
- retro2003 OPRN 몬스터 걷기 칩 Monster6 (`f9f8e77`)
- retro2003 OPRN 몬스터 걷기 칩 Monster5 (`a483fd4`)
- retro2003 b5 Monster3 8명 15칸 시트를 칩 × 1(셀 48)로 다시 생성 (`ac12e26`)
- retro2003 3차 로스터 계약 — OPRN 자체 몬스터 걷기 칩 Monster4~6(24명) 카탈로그·묶음 m4~m6(자리표시 그림) (`740f0b0`)
- retro2003 파티원 도트 재작업 b3 4명(15칸, 칩 비율 유지) (`344cd3e`)
- retro2003 파티원 도트 재작업 b1 8명(15칸, 칩 비율 유지) (`a73cca2`)
- retro2003 파티원 도트 재작업 b1 8명(15칸, 칩 비율 유지) — 나머지 7종 (`63cd91e`)
- retro2003 파티원 도트 재작업 b4 8명(15칸, 칩 비율 유지) (`bc803d6`)
- retro2003 파티원 도트 재작업 b1 8명(15칸, 칩 비율 유지) — 빌더·충견 (`17e51c0`)
- retro2003 비인간형 파티원 15칸 시트(시전 3단·도약·강화·필살기) 지원, 필살기 컷인 전신 대기 칸+이름 (`c348847`)
- retro2003 로스터 b4 전투 도트·스킬 8×N (`137b588`)
- retro2003 로스터 p5 전투 도트·스킬 8×N (`9ed9094`)
- retro2003 로스터 b2 전투 도트·스킬 8×N (`321a6c5`)
- retro2003 로스터 p1 전투 도트·스킬 8×8 (`573e67e`)
- retro2003 로스터 a3 전투 도트·스킬 8×8 (`b0f586a`)
- retro2003 로스터 b5 전투 도트·스킬 8×8 (`fe633f0`)
- retro2003 로스터 b3 전투 도트·스킬 8×8 (`37fd30b`)
- retro2003 로스터 p4 전투 도트·스킬 8×8 (`e9127de`)
- retro2003 로스터 p3 전투 도트·스킬 8×8 (`ffcc82b`)
- retro2003 로스터 a2 전투 도트·스킬 8×8 (`2026f73`)
- retro2003 로스터 b1 전투 도트·스킬 8×8 (`65a5c8f`)
- retro2003 로스터 p2 전투 도트·스킬 8×8 (`ba79028`)
- retro2003 로스터 a1 전투 도트·스킬 8×7 (`7fe0527`)
- **battle** — a1 묶음 56개 스킬에 기믹 칸을 채운다 (`1c25d06`)
- **battle** — retro2003 스킬 계약에 기믹 칸(mechanic)과 어휘·직업 설계 규칙 (`9cef346`)
- **battle** — 기믹 상태 8종(암흑·스톱·프로텍트·실드·버서크·석화·젖음·기름)과 상태 배지 (`7bc25c1`)
- **battle** — 스킬 HP 대가(hpCostPercent)·흡수(drainPercent) 선택 필드 (`0c15cd7`)
- retro2003 2차 로스터 통합(tsc 통과·위키 기록) (`3d27f12`)
- retro2003 2차 로스터 통합(녹화 --set roster · --set party-pixel) (`0775ab9`)
- retro2003 2차 로스터 통합(편집기 스킬 탭 계열 2단 선택·2단 칩 줄 높이 제한) (`d69e782`)
- retro2003 2차 로스터 통합(마도사 칩 이전 마무리) (`8aea72d`)
- retro2003 2차 확장 로스터 계약(걷기 칩 100직업·묶음 13개) (`fe48e53`)
- retro2003 몬스터 스킬 42종 연결(레벨대별 행동·전용 연출) (`9225769`)
- **editor** — retro2003 몬스터 스킬 미리보기 (`49eefa7`)
- retro2003 몬스터 스킬 도트 이펙트 18~35 (`ded6407`)
- retro2003 몬스터 스킬 도트 이펙트 36~52 (`58194e7`)
- retro2003 몬스터 스킬 도트 이펙트 0~17 (`ec82d1f`)
- retro2003 근접 파고들기 스킬 여운 520→260ms (`e858dfe`)
- retro2003 도약·대시류 스킬 가속, 몬스터 스킬 계약 42종(레벨대별 스킬 수 증가) (`fdddf75`)
- retro2003 마왕 도트 재작업(펼친 망토·근육질 거구) (`0cb1ce3`)
- retro2003 새 주인공 6명·스킬 48개·몬스터 30종 연결 (`f6632a7`)
- **editor** — retro2003 새 직업 스킬·몬스터 도트 미리보기 (`03204a5`)
- retro2003 새 주인공 6명 전투 도트(사무라이·닌자·무도가·음유시인·드루이드·마녀) (`1f510fb`)
- retro2003 몬스터 도트 10종(beasts) (`86b051f`)
- retro2003 druid·witch 스킬 도트 이펙트 (`661c5d4`)
- retro2003 몬스터 도트 10종(humanoid-boss) (`f64256b`)
- retro2003 몬스터 도트 10종(undead-magic) (`8859ef6`)
- retro2003 samurai·ninja 스킬 도트 이펙트 (`da36094`)
- retro2003 monk·bard 스킬 도트 이펙트 (`daa6109`)
- retro2003 확장 계약 — 새 주인공 6명 스킬 48개, 몬스터 30종 목록 (`c9183e5`)
- retro2003 직업 스킬 48개 기본 DB·연출 엔진 (`3db61b8`)
- **editor** — 스킬 탭에서 retro2003 도트 스킬 연출 미리보기 (`6f148ef`)
- retro2003 hero·guardian 스킬 도트 이펙트 (`fd7f055`)
- retro2003 mage·cleric 스킬 도트 이펙트 (`abf9f81`)
- retro2003 scout·ranger 스킬 도트 이펙트 (`e269b94`)
- retro2003 직업별 스킬 8종×6 카탈로그 계약 (`4a0ca2f`)
- retro2003 몬스터 도트 8종과 몬스터별 공격 모션 (`4ef5e50`)
- retro2003 스킬별 도트 연출 (`80d07ba`)

### 수정

- 샘플 모험 데모가 코드 기본값에만 있는 직업·배우를 덧붙인다 — 장비 참조 끊김(CI parity) (`a1ae1e4`)
- retro2003 로스터가 깬 기본 DB 계약 — 새 배우 맨손 연출·몬스터 skillIds 투영, 테스트 전제 갱신 (`fe3acfa`)
- retro2003 칩 × 2 로 그린 파티원 시트(art 2)는 화면 절반 크기로 — 사람 파티원과 키 맞춤 (`b34778b`)
- retro2003 People 전투 시트 40개를 준비 목록에 등록 — People 배우(공주 등)가 공용 폴백 도트로 서던 문제 (`be10c81`)
- retro2003 64px 파티원(범선·비공정 등)이 무대 오른쪽 밖으로 잘리지 않게 반폭만큼 당김 (`ef6c52b`)
- **battle** — retro2003 적 배지는 두 개씩 줄을 바꿔 위로 쌓는다 (`5c906cc`)
- **battle** — retro2003 파티 창 배지는 하나면 보통 크기, 둘 이상이면 두 줄 작은 격자 — 이름이 잘리지 않게 (`9c8c18e`)
- **battle** — 훔치기 결과 줄이 명령 대사에 가려지지 않게 하고 이미 걸린 상태는 「이미 … 상태다」로 읽는다 (`53f6cec`)
- **battle** — retro2003 적 배지·팝업을 도트 그림 머리 위에 붙이고 파티 창 이름 칸을 넓힌다 (`2546cbb`)
- **battle** — 상태 배지는 「…에 걸렸다!」 비트에 붙고 retro2003 배지 글자를 키운다 (`e57eea8`)
- **battle** — retro2003 에 상태 배지·부여 문장·떠오르는 상태 이름을 보이게 한다 (`59e6556`)
- **battle** — 기믹 칸 회복 효과는 정신력 고정(SkillEffect 타입) (`7b22ca7`)
- **battle** — 흡수 회복이 「피해를 입었다」로 읽히지 않게 하고 대가·흡수 줄은 기술 이름으로 쓴다 (`f5366be`)
- **battle** — 프로스트 오브는 기본 DB 에 없는 빙결 대신 둔화를 건다 (`470d6be`)
- **qa** — retro2003 스킬 녹화가 숫자 팝업·메시지·상태 배지를 스킬마다 남긴다 (`2fc3bbd`)
- **battle** — 이름이 겹치는 스킬은 시전자가 가진 쪽으로 연출을 고른다 (`bea8daf`)
- retro2003 몬스터 녹화 — 전투 뒤 새로고침 타이틀 대기 한 번 재시도 (`0611b8b`)
- retro2003 확장 필살기 화면 층 5장 가장자리를 타원 디더로 흩뜨림 (`3613afe`)
- retro2003 기존 도트 검수 수선 (`c6d93ef`)
- 사무라이 전투 시트를 actor3-0-samurai 로 분리, 마도사 시트 복원 (`65b4e44`)
- repaint_weapons 가 새 주인공 6명(art4 정본)을 덮지 않게 (`dbee832`)
- 전투 도트 무기를 손으로 다시 찍음(검·지팡이·활·단검) (`0b41769`)

### 정리

- 도트 적 시트 계약에 셀 크기·이동 방식 확장 (`02976a7`)

### 문서

- **wiki** — retro2003 15칸 파티원 시트·크기 규칙·3차 몬스터 기록 (`6bc016c`)
- retro2003 r2w5 party-pixel·이펙트 생성기 안내 (`eff46db`)
- **wiki** — a1 기믹 녹화 결과와 retro2003 상태 표시 공백 기록 (`6b725a2`)
- **wiki** — 스킬 기믹 명시화·HP 대가·흡수 필드 기록 (`77ebbce`)
- retro2003 다음 확장 설계 (`dc660a1`)
- art4 README 에 마도사 시트 보호 규칙 (`0fec4df`)

### 잡무

- 출하 데모·아이템 QA 픽스처를 기본 DB(retro2003 로스터 포함)에 다시 맞춤 (`97de79f`)

### 기타

- m4 전투 15칸 시트 8명(칩 × 1, 셀 48) (`c99bd66`)
- Monster4 걷기 칩 — 트렌트·버섯 요정·갓파·구미호 (`b7b1c46`)
- Monster4 걷기 칩 — 트렌트(monster4-0) 첫 칸, 나머지 7명 자리표시 (`4ab38af`)
- retro2003 b5 마장군 대검 손잡이 피벗·개미귀신 모래·화룡 불길 자리 (`97a9bc3`)
- retro2003 b5 Monster3 8명 15칸 첫 판(칩 2배 밑그림) (`490cc9d`)
- b3 좀비·사신 15칸(칩 2배 리그, 셀 64) (`cfa2f82`)
- retro2003 b5 pp15 리그와 세이렌 15칸(칩 2배 밑그림) (`4734d18`)
- b3 해골병 15칸(칩 2배 리그) (`b58ebbc`)
- retro2003 파티원 도트 b4 15칸 1차(칩 2배 밑그림 파이프라인) (`bd161f6`)
- retro2003 b3 슬라임·유령 15칸 시트(칩 2배 밑그림) (`c29d44f`)
- b3 파티원 15칸 리그(pp15_pp3, 칩 2배 부위 리그) (`eea8b4f`)
- retro2003 로스터 b4 마족 공작 스킬 이펙트 10장 (`aa17f49`)
- retro2003 p5 이펙트 은자·노병 (`283fdd4`)
- retro2003 로스터 b4 오니 무사 스킬 이펙트 10장 (`172c28e`)
- retro2003 b2 UFO 이펙트 11장 (`c0a2e25`)
- retro2003 p5 이펙트 사막 전사·메이드 (`1821ba7`)
- retro2003 b2 비공정 이펙트 10장 (`25270cd`)
- retro2003 b2 전차 이펙트 11장 (`978c10e`)
- retro2003 p5 이펙트 무녀 5장 (`019be7b`)
- retro2003 p1 이펙트 건슬링어·집사·승려 21시트 (`0dbebec`)
- retro2003 p1 이펙트 촌장·할머니 14시트 (`ce275dd`)
- retro2003 b5 Monster3 8종 시트와 스킬 64개 계약 (`6872079`)
- retro2003 p1 이펙트 학자·광부·농부 20시트 (`67498e9`)
- retro2003 b5 party-pixel 5종(세이렌~개미귀신) (`31b738b`)
- retro2003 party-pixel 확인판 스크립트 묶음 인자 (`c551317`)
- retro2003 로스터 p1 스킬표 64종(학자~승려) (`608dd58`)
- retro2003 b3 스킬 64개 계약(새 시트 12장) (`df8cc86`)
- retro2003 b3 Monster1 8종 party-pixel 시트 (`92c9c1b`)
- retro2003 b3 몬스터형 파티 리그와 슬라임·악마 시트 (`c615900`)
- retro2003 p4 이펙트 수녀 5장 (`511eef0`)
- retro2003 People 전투 도트 11명(a3 견습 기사·꽃집 아가씨·검객 + p1 8명) (`1bce60a`)
- retro2003 p4·p5 스킬 레이어 재배치(기존 시트 재사용, 새 시트 스킬당 최대 1장) (`be2388c`)
- retro2003 a3 Actor 전투 도트 5명 직업 장비(도끼·장총·부채·약병 지팡이·소환 지팡이) (`e953dba`)
- retro2003 a2 스킬 64개와 새 이펙트 10장(기존 시트 재사용) (`f34f6e7`)
- retro2003 b1 양~사자 이펙트 시트 10종 (`3a86947`)
- retro2003 p3 People 8명 전투 시트(art5/p3.py) (`e7e9c14`)
- retro2003 p5 전투 도트 5명(무녀·사막 전사·메이드·은자·노병, art5/p5.py) (`7fae1e1`)
- retro2003 b1 양~사자 스킬 표(기존 시트 재사용, 새 시트 10장) (`fc45e71`)
- retro2003 2차 로스터 r2w8 중단 시점 보존(미커밋 119개) (`9062cce`)
- retro2003 2차 로스터 r2int 중단 시점 보존(미커밋 3개) (`cbbafbf`)
- retro2003 2차 로스터 r2w6 중단 시점 보존(미커밋 12개) (`50638d9`)
- retro2003 2차 로스터 r2w4 중단 시점 보존(미커밋 12개) (`7c2c689`)
- retro2003 2차 로스터 r2w5 중단 시점 보존(미커밋 31개) (`bf8dfa9`)
- retro2003 2차 로스터 r2w3 중단 시점 보존(미커밋 14개) (`0e601bc`)
- retro2003 2차 로스터 r2w1 중단 시점 보존(미커밋 23개) (`03a2789`)
- retro2003 b2 열기구 이펙트 10장 (`9971e51`)
- retro2003 p2 국왕 이펙트 10시트 (`bb56416`)
- retro2003 b1 고양이 이펙트 시트 10종 (`68640b5`)
- retro2003 p4 이펙트 뱃사람·노승·귀부인 (`6fa4881`)
- retro2003 a3 이펙트 시트 82종 완성(꽃집 아가씨·검객 포함) (`5071580`)
- retro2003 b2 철갑선 이펙트 10장 (`8435d9b`)
- retro2003 p2 천사·요정 이펙트 21시트 (`045d5f9`)
- retro2003 b1 충견 이펙트 시트 11종 (`de70e36`)
- retro2003 a1 암흑기사·시공술사 스킬 16개와 새 이펙트 시트 (`65de689`)
- retro2003 b2 쪽배·범선 이펙트 22장, 파티 스킬 이펙트 공용 모듈 (`026f8ef`)
- retro2003 a3 이펙트 시트(광전사·총사·무희·연금술사·소환사·견습 기사) (`585bf9c`)
- retro2003 2차 로스터 통합(스킬 규칙 필드 유도 정밀화) (`f576176`)
- retro2003 p2 검무사·도박사 이펙트 21시트 (`bc3f087`)
- retro2003 a1 발키리·성기사·적마도사 스킬 24개와 새 이펙트 시트 (`d666505`)
- retro2003 2차 로스터 통합(비인간형 파티원 9칸 시트 렌더·이동·스킬 칸 매핑) (`e164edb`)
- retro2003 p4 전투 도트 8명(People 걷기 칩 기반 art5/rig45) (`44e4730`)
- retro2003 b1 스킬 64개 계약(이펙트 시트 80종 목록) (`cebafaf`)
- retro2003 p2 이펙트 공용 모듈·스킬 목록·방랑 점술사 10시트 (`aea0ff7`)
- retro2003 로스터 b1 Animal 8종 party-pixel 9칸 시트 초안 (`0e6ad52`)
- retro2003 로스터 b4 전투 도트 8종·스킬 표(64개) (`0de7a06`)
- retro2003 로스터 b2 탈것 8종 파티 전투 시트 초안 (`7da30eb`)
- retro2003 2차 로스터 통합(기본 DB 테스트 기대값) (`3e293a8`)
- retro2003 2차 로스터 통합(직업·배우·스킬 레코드 생성기, 공용 스킬 조회, 접근 방식) (`9a933bf`)
- retro2003 p2 People 전투 도트 리그(걷기 칩 팔·장비 오버레이)와 1차 시트 (`3ea9d39`)
- retro2003 로스터 a1·a2 전투 도트 — 직업 장비 15칩 다시 칠함(art5) (`cbec50d`)
- retro2003 로스터 p4·p5 스킬 계약(104개)과 이펙트 공용 모듈 (`fd42c34`)
- retro2003 로스터 b1 party-pixel 리그와 충견 전투 도트 (`26bf2ee`)
- retro2003 로스터 a3 스킬표 64종(광전사~검객) (`48de7d4`)
- retro2003 로스터 b2 파티 전투 도트 공용 모듈·쪽배 시트 (`5c2527b`)
- retro2003 로스터 b4 전투 도트 시트 3종(하피·가고일·골렘) (`a361775`)
- retro2003 2차 로스터 통합(People 전투 시트 등록·자동 대응) (`2ad9c61`)
- retro2003 2차 로스터 통합(마도사 칩 actor3-0 → actor1-5) (`75b10a7`)
- retro2003 몬스터 스킬 녹화 스크립트 (`540e6c4`)
- retro2003 몬스터 스킬 타임라인·적 재생 분기 (`623c140`)
- retro2003 몬스터 스킬 레코드 42종·도트 적 행동 배선 (`ed3e104`)
- retro2003 스킬 탭 몬스터 칩·반전 무대·CSS (`b45c68f`)
- retro2003 몬스터 스킬 타임라인·적 탭 스킬 버튼 (`04bed85`)
- retro2003 몬스터 스킬 도트 이펙트 18~35 1차 (`68667ae`)
- retro2003 몬스터 스킬 도트 이펙트 36~52 1차 (`b93ef39`)
- retro2003 몬스터 스킬 도트 이펙트 0~17 1차 (`7144f42`)
- 마왕 도트 재작업 1차 초안 (`6a7c735`)
- 128px 대상 층 1배 표시·식충 식물 제자리 공격 (`40296b2`)
- 몬스터 녹화 사본에서 없는 참조 걷기 (`f790ee9`)
- retro2003 잔상 체형·화살비·고리 반경 수선 (`30e4b27`)
- retro2003 방패벽·돌격 칸 안으로, 쓰러짐 검 손에 붙임 (`dedfe8a`)
- retro2003 몬스터 녹화 스크립트·스킬 녹화 확장·셀 크기별 몸 비율 (`893ec08`)
- retro2003 이펙트 칸 경계 잘림 디더 정리 (`223bb4b`)
- retro2003 확장 6직업 시전 종류·착탄음·투사체 모양 (`0d8634b`)
- retro2003 사무라이 변형 시트 폴백·적 카드 과녁 아군 (`81c8c28`)
- retro2003 새 직업 6·배우 6·스킬 씨앗 48·접근 방식·몬스터 30종 등록 (`8beae88`)
- 새 주인공 6명 전투 도트 1차(직업 장비 격자·art4 화가) (`75c0ca1`)
- retro2003 몬스터 30종 시트 등록·적 탭 도트 카드 CSS·i18n (`c01ad71`)
- retro2003 편집기 새 직업 스킬 무대·몬스터 도트 미리보기 (`630d9ef`)
- retro2003 몬스터 도트 지옥사냥개 (`4ae13a5`)
- retro2003 몬스터 도트 바위게 (`2113491`)
- retro2003 몬스터 도트 칼날사마귀·독사 (`d43c77c`)
- retro2003 몬스터 도트 모래전갈·곰 시트·검사기 (`ef2acd1`)
- retro2003 druid 스킬 도트 이펙트 10장 (`d5846c2`)
- retro2003 몬스터 도트 — 동굴 트롤·미노타우로스 (`d1a7786`)
- retro2003 몬스터 도트 거대벌 (`83e3df1`)
- retro2003 몬스터 도트 물의 정령·미라·리치·철 골렘 (`f501e1e`)
- retro2003 몬스터 도트 — 오크 전사·가고일 (`35f372b`)
- retro2003 몬스터 도트(beasts) 멧돼지·곰·흡혈박쥐 1차 (`f1fdab1`)
- retro2003 몬스터 도트 — 리자드맨·오크 주술사·하피 (`489d51f`)
- retro2003 몬스터 도트 해골 기사·유령·불의 정령 (`0907423`)
- retro2003 samurai 도트 이펙트 초안 (`636c5cc`)
- retro2003 monk·bard 스킬 도트 이펙트 1차 (`2dd94a4`)
- retro2003 몬스터 도트 — 공용 관절 리그, 고블린·복면 산적 (`6b49ece`)
- retro2003 직업 스킬 48종 녹화 스크립트·위키 (`c3f8a94`)
- retro2003 직업 스킬 타임라인 재생기(계약 레이어·frame×2 칸 이동) (`c617c4d`)
- retro2003 직업 스킬 48개 기본 DB 레코드·직업 습득 연결 (`4779aeb`)

## 0.39.3 — 2026-09-28

### 수정

- **save** — 새 프로젝트 첫 저장과 팀 실행 적용이 큰 문서에서 실패하지 않게 한다 (`efa0354`)

## 0.39.2 — 2026-09-28

### 수정

- **ai** — 전송 gzip 조각 스트림 타입을 CompressionStream 쓰기 쪽(BufferSource)에 맞춤 (`887b4c3`)

### 성능

- **ai** — 조수 렉 2차 실측 증거 (`df2cbec`)
- **ai** — 전송 gzip 양보를 조각마다가 아니라 12ms 마다 (`54141f8`)
- **ai** — 체크포인트를 칸 단위로 다시 그리기·커밋 기준 요약에 공유 항목 믿음·초점 이동의 강제 레이아웃 제거 (`9d9d39e`)
- **ai** — 조수 체크포인트의 클러스터 전체 스캔 제거·타일 색인·전송 gzip 을 조각으로 흘리기 (`b0e38e5`)
- **ai** — 조수 렉 실측 하네스·전후 증거·위키 기록 (`e347776`)
- **ai-ui** — record browser-only measurements and corrected validation scope (`6f0f1a8`)
- **editor** — record standalone Node measurements after validation halt (`c0db7b7`)
- **editor** — record texture redraw measurements and regression checks (`8670725`)
- **editor** — retain pending texture completion across scene restart (`abf81ca`)
- **editor** — verify texture redraw batching and scene lifetime (`b21c01e`)
- **editor** — coalesce texture completion redraws per frame (`47de879`)
- **ai-ui** — finalize rendering measurements and validation results (`b707351`)
- **editor** — finalize subscriber performance verification (`e2c04b5`)
- **ai-ui** — record measurements contracts and browser evidence (`9d05f55`)
- **editor** — record subscriber benchmarks and browser evidence (`0e7592b`)
- **ai-ui** — verify archive version guards pruning and write failures (`5565d06`)
- **ai-ui** — cover deferred rendering and DOM identity with a complete window fixture (`f29308d`)
- **ai-ui** — release activity media from removed subtrees only (`b860a7b`)
- **ai-ui** — match answer references with a cached prefix trie (`f3ecff5`)
- **editor** — cover coalesced panel state and mount lifetime (`60da691`)
- **ai-ui** — stop building permanently hidden legacy board rows (`8e96878`)
- **editor** — apply direct tool tile changes through incremental rendering (`51a28ea`)
- **ai-ui** — reuse member buttons and index recent media by actor (`e6a7d86`)
- **editor** — request a render frame only for visible store changes (`ee45dcb`)
- **ai-ui** — share actor indices and bound activity projections (`aac1ad7`)
- **editor** — debounce rule audits after the final edit (`d1d4488`)
- **editor** — reuse map link graphs and preserve unchanged link panels (`8387b32`)
- **ai-ui** — persist only pending runs and amortize archive pruning (`dd0d0cf`)
- **ai-ui** — scroll conversation replay once per batch (`d661838`)
- **ai-ui** — defer detached studio and hidden transcript updates (`ae61d79`)
- **editor** — share reference diagnostics and coalesce store panel refreshes (`f229979`)
- **ai-ui** — retain capped transcript rows by stable ordinal (`f0ac581`)

### 기타

- perf(ai) 조수 패널이 한가할 때 첫 턴·첫 적용 준비 비용을 미리 치르기 (`af17a6b`)
- perf(pi) 무거운 키 해시를 내용 요약으로 재사용 (`cb5a1b0`)
- perf(lint) 왕복을 통과한 공유 항목은 뼈대로 되읽기 (`6caec2a`)
- perf(ai) 적용 권위 요약이 공유 항목 대조를 반복하지 않게 (`b273d4a`)
- perf(ai) 조수 적용·체크리스트 경로의 전체 문서 직렬화·요약 줄이기 (`333f29c`)
- preserve AI UI verification report while app typecheck finishes (`6b47505`)

## 0.39.1 — 2026-09-28

### 성능

- **team** — 동료 저장 반영·참여 부팅·첫 참여 전송량을 줄인다 (`8836cf5`)

## 0.39.0 — 2026-09-28

### 기능

- **battle** — 도트 전투 결과를 한 화면 요약 + 레벨 업 한 명씩으로 줄이고, 적 그룹에 「전투 뒤」 이벤트를 붙인다 (`7536d0b`)

### 수정

- **runtime** — NPC 양보·교착 사슬·직접 추격·추격 A* 상한을 고친다 (`c11a962`)
- **ai** — 새 프로젝트 첫 Pi 요청과 팀 체크포인트가 크기 때문에 끊기지 않게 한다 (`616c554`)

### 성능

- **runtime** — 맵 진입 타일 그리기에서 타일별 판정을 패스 캐시로 줄인다 (`54d8002`)
- **runtime** — 소프트웨어 WebGL 타이틀 반해상도와 전투 워밍업 호스트 폭을 고친다 (`3ac2891`)
- **runtime** — 라벨 색인·스폰 실패 캐시·농사 사전 검사·비 버퍼로 반복 비용과 GC를 줄인다 (`64438b3`)

### 문서

- **openwiki** — 8차 런타임 렉 수정(NPC 길찾기·보류 3건·타이틀·맵 진입) 기록 (`e79768b`)

### 테스트

- **runtime** — 의도된 제품 변경을 따라가지 못한 기준선 실패 테스트 34건을 고친다 (`df8629d`)

## 0.38.1 — 2026-09-28

### 수정

- **rasak** — 에디터 확대 QA — 흩뿌린 소품 걷기·숲·이름표 교정 (`c582c24`)

## 0.38.0 — 2026-09-28

### 기능

- **refmap** — 빈 어둠 검사 — 걷는 곳이 맵의 30% 미만, 조수 시험 결과 기록 (`22ac9fe`)
- **refmap** — 조각난 집·출입구, 네모난 땅 검사 (`dd8b57c`)
- **refmap** — ㅁ자 방 검사 — 실내 바닥 덩이가 상자를 80% 이상 채우면 경고 (`aeee050`)
- **refmap** — paint_pack_layout — 글자 배열로 팩 맵 한 장을 깔고 검사, 밑줄 뜬 물체 검사 (`858a878`)
- **refmap** — 세트 맵 검사 — 오토타일 모양 어긋남, 바닥 결 무늬는 빈 바닥, 규칙 문서 보강 (`6a52b4b`)
- **refmap** — 조수용 세트 맵 검사 check_pack_map·층 원본 가져오기·탁자 위 소품·예시 문서 (`02408b4`)

### 수정

- **refmap** — paint_pack_layout 범례 스키마에 JsonSchema 타입을 붙여 빌드를 되살린다 (`b82558a`)
- **refmap** — 반복 검사 — 6개 이상이면 맵 크기와 상관없이 (`80e1bad`)
- **refmap** — 섬은 물가가 입구 — 모래 띠를 맵 끝까지 뚫지 않게 (`0eaae8e`)
- **pi** — Cloud Code Assist 400 INVALID_ARGUMENT 는 이어 가기 한 번 — 도구 호출 생성 중 실패 (`8c3ad29`)
- **refmap** — ㅁ자 방 기준 76% (`71d847e`)
- **refmap** — paint_pack_layout 줄 길이 ±2 맞춤, 못 가는 바닥 경고에 여는 칸 (`a4b74b0`)
- **refmap** — paint_pack_layout 범례를 배열로 — Gemini 검증 모드 400, 같은 소품 반복 검사 (`c05949a`)
- **places** — 층 원본은 합친 그림이 래스터 킷과 같을 때만 쓴다 (`174a0a2`)

### 문서

- openwiki INDEX 재생성 (`90e1f47`)
- **refmap** — 조수 참고문서 — 장소 가져오기는 같은 이야기일 때만, 가져온 뒤 요청 구역 대조 (`3574ffa`)
- **refmap** — 줄 길이 맞춤·여는 칸 (`514ce39`)
- **refmap** — ㅁ자 방 검사 (`9c55ed1`)
- **refmap** — 조수 깔기 8차 — paint_pack_layout 범례·반복 검사 (`b213ec0`)

### 잡무

- **refmap** — 공용 DB 재게시 증거 — 섬 입구 규칙 (`1417f56`)
- **refmap** — 공용 DB 재게시 증거 — 참고문서 가져오기 조건 (`ac9fe62`)
- **refmap** — 재게시 증거 (`4d48a6a`)
- **refmap** — 공용 DB 재게시 증거 (`2631968`)

## 0.37.1 — 2026-09-28

### 수정

- **runtime** — 좌표 이동 명령·시간표 이동의 결과 판정과 보간을 바로잡는다 (`a4a53a6`)
- **runtime** — NPC 생활·추격 길찾기가 몸 크기·가구·다른 NPC 를 실제 걸음과 같게 본다 (`c64292c`)

### 성능

- **runtime** — 첫 전투 CSS 매칭과 SE 디코드를 진입 커버 동안 미리 치른다 (`9ec169d`)

### 문서

- **openwiki** — 런타임 프레임 예산 7차 — NPC 길찾기·첫 전투 CSS 준비 (`ff4b355`)

## 0.37.0 — 2026-09-28

### 기능

- **player** — ESC 메뉴·장비·아이템·여관·전투 결과를 도트 창 기본값으로 통일한다 (`bfa6566`)

## 0.36.1 — 2026-09-28

### 수정

- **runtime** — 다른 NPC 에 막힌 생활 주민이 우회로로 재경로 (`6db2d6c`)

### 성능

- **runtime** — 표면 갱신에서 이벤트 스프라이트를 그래픽이 같으면 재사용 (`7003c36`)
- **runtime** — 타이틀 효과 입자를 프레임당 한 번 계산하는 보조 패스로 분리 (`d837b34`)
- **runtime** — 첫 전투 인트로 마운트에서 명령 화면 선그리기·숨은 버튼 포커스 제거 (`b7510d8`)

### 문서

- **openwiki** — 런타임 프레임 예산 6차 (`8e2160a`)

## 0.36.0 — 2026-09-28

### 기능

- retro2003 이동·순간이동·방출 효과음, 배경 README 를 도트 생성기 기준으로 (`7f8c121`)
- retro2003 직업별 근접 접근(질주·도약·순간이동·섬광)과 적 진형 다양화 (`2ae7ca5`)
- **team** — 팀원도 앱으로 참여하고 LAN·Tailscale HTTP 참여를 가볍게 한다 (`ecf8620`)
- 레트로 전투 배경 cave·snow·desert 도트로 다시 그림 (`4d5c6c0`)
- 레트로 전투 배경 plains·forest 도트로 다시 그림 (`cd74bc5`)
- retro2003 슬라임·박쥐 도트 시트와 적 근접 공격 모션 (`00e6e8f`)
- 레트로 전투 slime 도트 시트 (`ce6aca8`)
- 레트로 전투 bat 도트 시트 (`e2ebcaa`)
- **battle** — retro2003 아군 오른쪽 복귀·적 앞까지 걸어가 타격·마법 종류별 시전 칸·날아가는 이펙트 제거 (`144ae86`)
- actor4 6명 마법별 시전 도트와 무장 걷기 추가 (`35640a1`)
- **asset-gen** — 마법 종류별 시전 시트 규약(7종 × 3칸) (`08ac8f1`)
- **battle** — 빈 새 프로젝트도 retro2003 전투로 시작 (`6a7f32a`)
- 레트로 전투 HUD 재배치와 키보드 GIF 녹화 도구 추가 (`1dfbb18`)
- wire charset battlers and 24-pose retro side combat (`508db2c`)
- Actor4 후반 여섯 캐릭터의 원본 칩 기반 전투 도트 저작 (`4375659`)
- 걷기 칩 기반 도적과 마법사 5종 전투 도트 저작 (`aab64c5`)
- 걷기 칩 기반 사무라이 엘프 검객 닌자 전투 도트 저작 (`ee58660`)
- 걷기 원본 기반 청년 드루이드 무도가 음유시인 전투 도트 제작 (`bbf110b`)
- redraw Actor1 party battlers from walking charset pixels (`d5a4537`)
- 걷기 칩 기반 Actor2 다섯 명의 측면 전투 도트 저작 (`2f0d290`)
- **asset-gen** — 걷기 칩 기반 전투 시트 도구와 기준선 32명 (`d26c1d7`)
- add retro2003 battler motion and feedback (`1751715`)
- add layered retro2003 battle scenery and ambient motion (`310ead6`)
- add five layered pixel battle scenery biomes (`aef8ca3`)
- retro2003 런타임 QA 시나리오와 스킨 계약 추가 (`54d8107`)
- add retro2003 blue battle HUD and sideview transition (`8713f5b`)

### 수정

- retro2003 공격 대상 정확도·세로 이동, 48px 적 시트, 빈사 앉기 자세 제거 (`fe9a1ec`)
- actor4 전투 대기·걷기·방어를 선 자세로 (`10f3d56`)
- actor2 전투 대기·걷기·방어를 선 자세로 (`c56095c`)
- actor1 전투 대기·걷기·방어를 선 자세로 (`822beb3`)
- actor3 전투 대기·걷기·방어를 선 자세로 (`27abecd`)
- 레트로 전투 bat 도트를 아군 크기에 맞춰 축소 (`43f2d02`)
- 레트로 전투 slime 도트를 아군 크기에 맞춰 축소 (`27b8b1b`)
- retro 이동 거리 배율 보정, GIF 픽스처는 번들 전투칩 사용 (`2c9a8f6`)
- 마도사 지팡이와 여섯 캐릭터 속성별 시전 도트 수정 (`d5f0bb0`)
- 정찰병과 궁수 일행 시전 7종 및 무장 보행 교정 (`d0ed8e0`)
- add distinct spell casts and held weapons for five battlers (`0a72dd5`)
- add distinct spell casts and armed walks for five battlers (`40e0d55`)
- distinguish seven spell casts and retain weapons for five battlers (`17897fe`)
- **battle** — retro2003 재생 상태 칩 위치·프레임 프로브 키보드 입력·접지 실측값, 위키 절 추가 (`4e0652f`)
- 겹 배경 레이어를 번들 목록으로 내보내고 배경 피커에 노출 (`4e76754`)

### 문서

- retro2003 3차 수정 기록 (`ec9e6b4`)

### 기타

- retro2003 측면 도트 전투 스킨 골격 (`c9a7653`)

## 0.35.0 — 2026-09-28

### 기능

- **ai** — Pi 사용 로그에 의도 판정·도구 과정·실행 상태·해석 실패를 남긴다 (`848bfae`)
- **brand** — 앱 아이콘을 투명 배경의 도트 검 한 자루로 단순화한다 (`b700cdc`)

### 수정

- **ai** — 프리셋 인터뷰 기획을 말풍선에 다 보이고 검수·Writer 에도 넘긴다 (`fb457ea`)

### 기타

- 방향 있는 마을 요청과 막힌 마을 계약 해제 (`2d06627`)

## 0.34.0 — 2026-09-28

### 기능

- **faces** — 짝 얼굴이 없던 캐릭터 29칸에 도트 얼굴 생성·등록 (`f835b3f`)
- **ai** — 실내·마을 시공이 검토된 프리셋과 완성 마을 사례를 쓴다 (`35aafb3`)

### 수정

- **faces** — NPC·배우 얼굴을 캐릭터 짝 카탈로그로 전수 교정 (`12555d3`)
- **runtime** — 병렬 이벤트 16단계 상한 결과 보존, 걷는 중 길 막힘 보간 유지 (`f9730c6`)

### 성능

- **runtime** — NPC 패스 단건 조회 색인, fork 소셜 host 탐색 축소, 디버그 패널 재기록 제거 (`4e8884e`)

### 문서

- **openwiki** — 런타임 프레임 예산 5차 (`3cf36fd`)

### 테스트

- **runtime** — 5차 렉 수정 회귀 테스트 (`0440884`)

## 0.33.2 — 2026-09-28

### 수정

- **ai** — 팀 설정이 마을 요청·검수 생략에서 조용히 혼자 실행이 되지 않게 한다 (`66e04a3`)
- **i18n** — 언어 선택 표시와 누락 번역을 고치고 시작 화면에도 번역을 켠다 (`0c4a398`)

## 0.33.1 — 2026-09-28

### 성능

- **editor** — 바로 깔기 드래그·적용 멈춤 줄이기 (`8c295ae`)

## 0.33.0 — 2026-09-28

### 기능

- **refmap** — 작은 집 10곳과 실내 확장 시트 D 게시, 가로 침대 벽 판정 (`ee99748`)

### 수정

- **assets** — unify forest stone well palette and outline (`525afbd`)
- **runtime** — 지형 색인 해시 충돌과 지형 변경 뒤 막힌 생활 경로 재사용 (`56961fd`)
- **refmap** — 낱장 tile 조각도 엔진에서 막히는지 검사 (`16c8588`)

### 성능

- **runtime** — QA 마커 같은 값 재기록 제거, 상점·상태 메뉴 첫 개방 강제 레이아웃 제거 (`f2e4506`)
- **runtime** — 추격 막힘 판정 격자화, 생활 NPC BFS 정수화, 맵 연결·필드 스폰 선형화 (`f68122d`)

### 문서

- **openwiki** — INDEX 재생성 (`37c2140`)

### 테스트

- **runtime** — 렉 4차 퍼징 반례 회귀와 위키 갱신 (`6f5b764`)

## 0.32.0 — 2026-09-28

### 기능

- **brand** — 앱 아이콘 기본안을 메시지 창 속 검과 깃펜으로 바꾼다 (`5f446c0`)
- **editor** — 우클릭 AI 이벤트를 여러 칸 동시에 맡기는 작업함으로 바꾼다 (`a658919`)

### 수정

- **boot** — 이미 만든 프로젝트에는 「빈 맵으로 시작」 브리핑을 띄우지 않고, 로드 진행 막대를 보인다 (`029f8f5`)

## 0.31.0 — 2026-09-28

### 기능

- **shared-db** — REFMAP 던전·남쪽 섬 확장 시트와 새 장소 6곳 (`9011e8f`)
- **refmap** — 네모난 물 덩이 검사(수조·수로 제외) (`7b0c63c`)
- **refmap** — 막혀야 할 물체 칸이 뚫린 곳·같은 칸 다른 kind 검사 (`5f19d06`)

### 수정

- **editor** — 자료집에서 항목을 누르거나 값을 바꿔도 스크롤이 맨 위로 튀지 않는다 (`d243433`)
- **forest** — 나무 그림자가 밑동을 걸어서 지나가게 하던 통행 구멍을 막는다 (`87d0519`)

## 0.30.0 — 2026-09-28

### 기능

- **ai** — 프리셋 첫 생성은 코드가 깐 끝낼 수 있는 첫 구간 위에서 돌고 자동 플레이로 판정한다 (`9244b0c`)
- **start** — 첫 화면을 게임 그림 중심의 어두운 스튜디오로 다시 꾸민다 (`bf118fb`)

### 수정

- **start** — 첫 화면에서 고른 프리셋도 기획 인터뷰와 팀 첫 생성을 거친다 (`efc2f51`)

### 성능

- **runtime** — 조명·안개·분위기 소리·전투 진입·미니맵·디버그 패널의 스파이크 제거 (`05bfa5e`)
- **runtime** — 추격·생활 NPC 경로 탐색의 이벤트 전수 순회 제거, 턱 있는 성분 색인 교정 (`5e9ba8f`)
- **runtime** — 명령 이력 상한과 생활 상태 파서 선형화 — 오래 플레이할수록 느려지는 저장·날짜 경계 (`63e3b64`)

### 테스트

- **runtime** — 렉 3차 수정 동등성 회귀와 위키 프레임 예산 갱신 (`71a62bc`)

## 0.29.0 — 2026-09-28

### 기능

- **ai** — 바로 깔기 주문을 대기열로 받아 드래그를 연달아 내릴 수 있게 한다 (`56d3b9e`)

## 0.28.0 — 2026-09-28

### 기능

- **shared-db** — REFMAP 22장 통행·침대·벽 가구 적대적 QA 통과판 재게시 (`e28ba4d`)
- **brand** — RPG Maker 2000 계보의 맵 조각 앱 아이콘으로 바꾼다 (`86cef97`)
- **start** — 시작 화면이 최근 프로젝트 카드 그림을 직접 굽는다 (`70bfb8b`)
- **refmap** — 통행 검사 — 키 큰 물체 몸통을 지나야만 닿는 바닥, 발치로만 닿는 침대 (`aaea62b`)
- **refmap** — 통행 검사 보강 — 낱장 조각은 막힘(pass 로 통행), 큰 물체 겹침, 침대 머리 벽 (`dcc05cb`)
- **refmap** — 통행·벽걸이 검사 — 입구에서 못 가는 바닥, 닿을 수 없는 가구, 벽 밖 벽걸이 (`f19b519`)

### 수정

- **mv-pack** — 문 물체는 맨 아랫줄만 통행 — 문틀·아치 윗줄로 벽·대지 위에 올라가던 누수 (`75f4edd`)
- **team** — 팀 초기 생성의 맵 연결 계약과 루트 묶음 병합 유실을 고친다 (`aeae7f4`)
- **refmap** — 물 위 2층 길(여울)을 건널목으로 인정 (`3b27ca9`)
- **ai-tools** — 배치 매칭 전수 조사 — 대체 그림 대신 거절, 칸 라벨 정정 (`5327f6c`)
- **database** — 그룹 띠를 누르면 목록이 그 그룹으로 바뀐다 (`fae9d5d`)
- **refmap** — 통행 검사를 엔진 규칙(passabilityOf·방향 통행)으로 — 막힌 땅 위 누수도 잡는다 (`94e898a`)

## 0.27.1 — 2026-09-28

### 수정

- **event-editor** — 설정 레일을 한 열로 정돈하고 조건 창을 살아 있는 레일에 묶는다 (`72686c8`)

## 0.27.0 — 2026-09-28

### 기능

- **forest** — 나무 밑동과 발치에 그림자를 드리운다 (`5f8ea9c`)

### 수정

- **ai** — 숲 나무 물체를 칸 도안대로 찍어 수관이 빠지지 않게 한다 (`215d6e2`)

## 0.26.0 — 2026-09-28

### 기능

- **ai** — 프리셋 첫 생성 팀은 작은 플레이 조각과 턴 상한으로 돈다 (`cb2771d`)
- **ai** — Pi 실행을 해시 전송하고 끊긴 스트림을 이어 받는다 (`ffc0591`)
- **ai** — 프리셋 첫 요청은 의도 읽기 없이 바로 제작 턴으로 간다 (`065102d`)
- **shop** — 도트 비교 상점을 상점 UI 기본값으로 (`5b356ea`)

### 수정

- **ai** — 오류 줄로 깨끗이 닫힌 Pi 스트림은 이어 받지 않는다 (`ce5ae93`)

### 문서

- **openwiki** — INDEX 재생성 (`26baa89`)
- **ai** — 프리셋 팀 첫 생성 실측 스크립트와 전송·이어 받기 위키 (`e2086b5`)

## 0.25.0 — 2026-09-27

### 기능

- **shared-db** — REFMAP 22장 방·맵을 줄여 재게시 (공간이 남으면 너무 큰 것) (`66aac14`)
- **refmap** — set-tool space — 빈 바닥 직사각형 측정 (`c8860e5`)
- **shared-db** — REFMAP 실내 8곳 추가 (농가·잡화점·서재·겨울집·알현실·감옥·객실동·연회장) (`5e6ba4a`)
- **shared-db** — REFMAP 맵 구조 문법 고쳐 재게시 (천장 밑 벽·방 모양·계단·집 몸채) (`814096c`)
- **refmap** — 맵 기술에 천장·지붕 구조 검사 추가 (`e3ca393`)

### 수정

- **ai** — 워커가 128MiB 가 넘는 요청 본문도 받는다 (`0ff274e`)
- **ai** — 팀 체크포인트가 비워 둔 타일셋·DB 를 작업 사본에 다시 붙인다 (`9f71a1c`)
- **water** — 숲마을 물이 다시 움직이고 수면에 밝은 물결이 흐른다 (`1f98299`)

### 성능

- **runtime** — 구름·안개·분위기 소리 나눠 굽기, 빗소리 잡음 재사용, 날씨 입자 헛그리기 제거 (`50fb68a`)
- **runtime** — 타일 칸 판정 기억 — 이식 suffix·월드 해안 그룹, 맵 이동 이벤트 이중 복제 제거 (`5eca1fd`)

### 정리

- 편집 모드(초보/표준/전문가) 삭제 (`f7de689`)

## 0.24.0 — 2026-09-27

### 기능

- **assets** — 내부 브라우저로 받은 RAR 팩을 풀어 Rasak 프리셋 타일셋으로 바로 설치 (`9f699b5`)
- **shared-db** — REFMAP 세트 맵을 목적 있게 다시 깔아 재게시 (`706965e`)

### 성능

- **runtime** — 플레이 중 주기적 렉을 만드는 프레임 경로를 걷는다 (`cf44f8a`)

## 0.23.0 — 2026-09-27

### 기능

- **shared-db** — REFMAP 세트 8개(설원·실내·던전·남쪽 섬·화산·크레용·사진·MZ 지면)를 공용 DB 장소·오브젝트로 (`f48d9cc`)
- **start** — 데스크톱 첫 화면을 런처형으로 다시 만든다 (`8386140`)
- **editor** — 프리셋 시작 전 AI 연결 관문 + 첫 생성 팀 실행 (`7822f79`)
- **shared-db** — REFMAP 마을·숲·물가 맵 3장을 공용 DB 장소·오브젝트로 게시 (`d532040`)
- **mvpack** — REFMAP Town Outside 프리셋 (`04f925c`)

### 수정

- **rasak** — 성 안뜰 적대적 QA — 성탑·성문·요새·폐허 재구성, 문 없는 집에 문 (`d648d76`)
- **tileset** — 라삭 주택가 미사용 변수 정리(TS6133) (`65fce15`)
- **tileset** — 라삭 주택가 필지 섞기·주택 문 콘 그림 수정 (`c739037`)
- **db** — MV 팩 킷 썸네일에 실내 바닥 받침을 깔지 않는다 (`cab9459`)

### 문서

- **openwiki** — REFMAP 프리셋·공용 DB 장소 게시 쪽 (`e8addcb`)

## 0.22.0 — 2026-09-27

### 기능

- **database** — 자료집 개선안 2단계 — 헤더 저장 상태·연결 칸·카드 머리 (`d5b7e32`)
- **i18n** — 편집기를 영어·일본어·중국어(간체)로도 보여 준다 (`162c4bc`)

### 수정

- **editor** — 번역된 화면 글자를 한국어 리터럴과 비교하지 않는다 (`b9fbc97`)
- **battle** — 필드에서 들고 온 부위 손실 상태도 전투 시작 능력치에서 그 슬롯을 뺀다 (`4f9b3dd`)
- **battle** — 도주 실패 가산을 옵트인으로 되돌리고 명작 공백 L2·L3·#28 을 openwiki 에 적는다 (`0b52441`)

### 문서

- **battle** — 도주 가산 기본값 주석을 0 으로 맞춘다 (`f70b2f2`)

## 0.21.0 — 2026-09-27

### 기능

- **battle** — 타격감을 자료집에서 고르고 기본값을 묵직하게로 둔다 (`43a5e47`)
- **battle** — 적이 턴을 받고 공격 스킬이 평타보다 세도록 기본 적·스킬 수치를 다시 잡는다 (`30434a8`)

### 수정

- **rasak** — 짙은 풀 얼룩 경계를 밝은 풀 가장자리로 감춘다 (`3617401`)
- **battle** — 착탄 프레임에 숫자·번쩍임·흔들림이 함께 오고 맞은 적이 사라지지 않게 한다 (`e19f401`)

### 테스트

- **m2** — 명작 공백 병합 뒤 카탈로그 계약 수치를 main 에 맞춘다 (`8838563`)

## 0.20.0 — 2026-09-27

### 기능

- **ai** — 크게 보기 창 버튼을 운영체제별(macOS 신호등·Windows 캡션)로 바꾼다 (`0e59917`)
- **database** — 자료집 개선안 — 그룹 띠·쿨 인디고 팔레트·흰 카드 면 (`acf84da`)
- **horror** — 추격 포기·문 따라옴 순간을 스위치로 알린다 (`287f74e`)
- **menu** — 아이템 조합·바라보는 대상에 사용·스킬 장착 화면을 메뉴에 연다 (`b603284`)
- **actor** — 스킬 장착 칸을 저작하고 전투는 장착 스킬만 쓴다 (`9b99b81`)
- **title** — 엔딩·마지막 저장에 따라 타이틀을 바꾸고 시작하면 바로 이어하기·새 게임 난이도 선택을 연다 (`6cb377e`)
- **battle** — 난이도 배율을 적 HP·공격력·보상·인카운트에 곱하고 DB 시스템 탭에서 저작한다 (`d9a95fb`)
- **system** — 난이도·파티 묶음·몬스터 교환 명령과 난이도·아이템 사용 조건 스키마를 등록한다 (`a85b785`)
- **screen** — 화면 색조 변경에 채도·흑백·세피아 필터를 더한다 (`3f06cad`)
- **battle** — 전술 전투 명령이 격자 위 이동·인접 공격 턴제로 한쪽이 전멸할 때까지 싸운다 (`1456eb0`)
- **battle** — 다부위 적과 부위 손실 장비 슬롯을 전투에 반영한다 (`e35e5c2`)
- **battle** — 전투 배경을 스크롤·물결·색 순환으로 움직인다 (`cfad017`)
- **battle** — 입력 커맨드 기술과 액션 홀드 차지 단계를 판정한다 (`6f08e79`)
- **battle** — 마더식 롤링 HP 미터로 치명타를 버틴다 (`63a3023`)
- **action** — 액션 전투에서 동료가 가까운 적을 때리고 V 키로 조작을 넘긴다 (`064388c`)
- **battle** — 훔치기·라이브라·청마법·무작위 기술 특수 명령을 실행한다 (`65dd14c`)
- **field** — 미니게임 키트·필드 능력·방문지 순간이동·걸음 상태·클릭 이동을 더한다 (`c93489c`)
- **field** — 옆보기 맵이 중력·점프·사다리·낙하 피해로 움직인다 (`34e1654`)
- **editor** — 전투 자원·감정 상성·스킬 소모·상태 감정 단계를 DB 창에서 저작한다 (`66c7e1a`)
- **battle** — 장비가 전투 명령·스킬을 주고 MP 절반을 적용하며 끼운 장비를 그 자리에서 강화한다 (`66a134d`)
- **battle** — 리미트·기력·연계 게이지와 감정 단계·약점 추가 행동을 전투에 싣는다 (`7ee82ab`)
- **condition** — 이벤트가 배우 수치·상태·선두·방향·회차·요일·문자열을 읽는다 (`2b61033`)
- **battle** — 배우별 자동 전투 작전으로 동료 AI 를 고른다 (`26acf9b`)
- **battle** — 받는 HP 피해 일부를 MP 로 돌리는 상태를 더한다 (`aeee6dd`)
- **battle** — 전원 행동 불능 패배와 적 최후의 일격을 더한다 (`144ce8e`)
- **battle** — 도주에 실패할수록 다음 도주가 쉬워진다 (`58daac9`)
- **battle** — 선제·기습·백어택·협공 전투 개시를 굴린다 (`5279ad5`)

### 수정

- **editor** — 타일 레이어에서는 NPC 그림 대신 E 배지만 그린다 (`18ab4d4`)
- **field** — 클릭 이동이 플레이 입력 차단기 앞에서 누름을 읽는다 (`c8f634e`)
- **editor** — 레이어 전환 시 화면 이동 제거, 비이벤트 레이어 E 배지 가시성 복구 (`aeccd7b`)
- **editor** — 난이도·아이템 사용 조건을 고급 조건 목록에 보이고 시스템 QA 시나리오를 더한다 (`9afa35b`)
- **battle** — 롤링 HP 결과 화면에서 생존자는 살아 있고 전멸은 0 에 붙인다 (`237a189`)
- 병합 중복 import 정리, 조건 커버리지 표·openwiki 보강 (`a5b6c2a`)
- **field** — 클릭 이동이 출하 플레이어에서 동작하고 순간이동 결과가 이동 뒤에도 남는다 (`f831296`)

### 테스트

- **monster** — 놓아주기·NPC 교환·합성 규칙과 저장 왕복을 고정한다 (`5a2e7af`)
- **party** — 파티 묶음 저장·전환·위치 이동·세이브 왕복을 고정한다 (`32ae821`)

## 0.19.2 — 2026-09-27

### 수정

- **rasak** — 예제 확대 검수 2차 — 숲 줄·밭 울타리·문길 연결·노점 바닥 (`0cc67dd`)
- **player** — 화면 색조·페이드가 대사창을 덮지 않는다 (`cd5db7b`)

## 0.19.1 — 2026-09-27

### 성능

- **load** — 편집기는 접힌 행만 받고 타일셋 본문은 기기 캐시에서 채운다 (`2f8d7c0`)

## 0.19.0 — 2026-09-27

### 기능

- **relief** — 높이 붓이 절벽을 하위 층 타일로 굽는다 (`9572d09`)

### 수정

- **database** — 맵 그룹 목록의 출처·썸네일·레일 잘림을 고친다 (`fb05baa`)
- **paw-maps** — 공용 타일셋의 미검토 칸 통행을 그대로 가져오지 않는다 (`b1cddfe`)

### 문서

- **openwiki** — 높이 붓 타일 굽기와 relief.baked 를 적는다 (`84d0d01`)

## 0.18.1 — 2026-09-27

### 성능

- **store** — 저장 행의 타일셋을 내용 주소 본문으로 접는다 (`b363b54`)

## 0.18.0 — 2026-09-27

### 기능

- **assistant** — 조수가 맵 배경 파노라마·회상 흐름을 한 번에 쓰게 한다 (`813e68a`)
- **map-background** — 층별 깊이(카메라 따라가기)와 흐름 배율 명령 — 회상 파노라마 연출 (`1bc344a`)
- **ai-settings** — ChatGPT 모델 4종 제한·그림 GPT 추천·로그인 UX 정리 (`f17511e`)
- **paw-maps** — 51맵을 원본 시트 타일셋·오브젝트·장소로 공용 DB 에 다시 올린다 (`41023d7`)

### 수정

- **electron** — 패키지 워커를 쓸 때는 워커 스크립트 경로를 계산하지 않는다 (`6588c5c`)
- **assistant** — 조수 시험에서 나온 회상 파노라마 마찰 수리 (`5ccd9dd`)
- **electron** — OS별 files 만 두어 다른 OS 워커가 섞이지 않게 한다 (`5b650f2`)
- **electron** — OS별 files 는 전체 목록을 다시 준다 (`e855850`)
- **electron** — 데스크톱 AI 워커에 pi-natives 애드온을 함께 싣는다 (`98f8c3c`)
- **editor** — 팔레트 제자리 동기화 뒤 입력 기록을 갱신한다 (`08c9737`)

### 성능

- **editor** — 좌측 타일 팔레트는 입력이 같으면 다시 짓지 않는다 (`5565a05`)

### 문서

- **release** — wine·빈 HOME 워커 로그 증거를 txt 로 남긴다 (`ef78653`)
- **release** — 데스크톱 채팅의 두 번째 결함과 앱 전체 검증 증거를 남긴다 (`0f5c323`)

## 0.17.1 — 2026-09-27

### 성능

- **store** — 안 바뀐 타일셋은 편집·도구·저장마다 복제하지 않는다 (`68bd6e3`)

## 0.17.0 — 2026-09-27

### 기능

- **rasak** — 애니메이션 시트를 animationStrips 로 굽기 · 예제 22개 확대 검수 수정 (`95d6870`)
- **map** — 맵 설정에서 맵 성격(마을·던전·필드·실내)을 고르고 바로 깔기가 그 값을 먼저 쓴다 (`b311e11`)

### 수정

- **relief** — 높이 붓 렉을 걷고 우클릭은 반대로 칠하며 방식 8개를 보인다 (`51dcba9`)

## 0.16.1 — 2026-09-27

### 수정

- **shared-content** — 타일 참고문서 응답도 참고 이미지를 호스트 주소로 보낸다 (`6639b4c`)
- **team** — 혼자 쓰는 프로젝트는 죽은 탭의 맵 잠금을 새 탭이 회수한다 (`0410ba4`)
- **boot** — 첫 방문 웰컴이 편집기를 먼저 보여 준 뒤 덮지 않게 한다 (`5300c0e`)
- **assets** — 작은 부품 시트에 물·폭포 애니메이션 스트립을 만들지 않는다 (`914a869`)
- **tools** — 툴 스키마가 "null" 타입을 받는다 — 타이틀 sequence·transition 끄기 경로 (`389a591`)

### 성능

- **dispatch** — 맵 패치 로컬 문서를 저장 행에서 새로 파싱해 제자리 복구한다 (`e41dec6`)
- **store** — 저장 비교를 잘게 나눠 돌리고 영수증 정체성을 늦게 만든다 (`c85b19d`)
- **store** — 저장 비교가 타일셋 객체를 그대로 대조하고 기준본 요약을 미리 만든다 (`3ebfe20`)
- **store** — 로컬 저장은 복제 없는 보기를 넘기고 기준본을 패치로 잇는다 (`6801cfa`)
- **local-store** — 호스트 저장 와이어에서 재파싱과 JS 해시를 뺀다 (`02d3362`)
- **commits** — 사람 저장 커밋 요약을 유휴 시간으로 미룬다 (`9308e9e`)
- **store** — 자동 저장 대기를 4s 에서 1.5s 로 줄인다 (`c57f634`)
- **local-store** — 저장 행 메타 읽기와 문서 캐시, 기준본 지연 역직렬화 (`bf8cf6d`)
- **store** — 저장 영수증 정체성을 요약 캐시로 낸다 (`b31627b`)
- **editor** — 숨은 project-export-json 미러를 읽을 때만 직렬화한다 (`8de87ef`)
- **store** — 맵 패치 비교가 기준본의 요약 기억을 이어 쓴다 (`3f3619e`)
- **local-store** — 기준이 저장 행 그대로인 맵 패치는 3자 병합을 건너뛴다 (`c424fd7`)
- **boot** — 부팅이 공용 타일 참고문서(183MB)를 기다리지 않는다 (`d74977b`)

### 문서

- **onboarding** — 새 프로젝트 첫 저장 실측과 첫 실행 QA 증거 (`9ead4c1`)

### CI

- 전체 게이트를 main 푸시에도 돌린다 (`b81ab6c`)

## 0.16.0 — 2026-09-27

### 기능

- 크로노 공백 — 탈것·필드 위 전투·승리 포즈 (#1630) (`9e3ac9e`)

## 0.15.0 — 2026-09-27

### 기능

- **ai** — 바로 깔기가 마을을 알아보고 마을답게 깐다(함정·몬스터 막기, 낮은 보상, 여관·표지판) (`d36e3c8`)

## 0.14.1 — 2026-09-27

### 성능

- **store** — 저장마다 도는 전체 직렬화를 걷고 타일셋 비교 기억을 이어받는다 (`39da08f`)

## 0.14.0 — 2026-09-27

### 기능

- **ai** — 바로 깔기가 기존 이벤트와 겹치지 않고 상인·몬스터·함정·날씨까지 깐다 (`036380f`)

## 0.13.0 — 2026-09-27

### 기능

- **editor** — 왼쪽 활동 막대에 즐겨찾기·진행·연결 패널을 더한다 (`f2e290c`)

## 0.12.0 — 2026-09-27

### 기능

- **paw-maps** — 51개 맵을 공유 장소 라이브러리에 게시한다 (`fa79db1`)
- **ai** — 바로 깔기 현재 맵 배치 사실·상자/NPC/세이브/조사 지점·폴백 제거 (본문) (`97b1e6b`)
- **ai** — 바로 깔기는 반드시 모델을 거치고 현재 맵 사실로 상자·NPC까지 깐다 (`e36cc0c`)
- **paw-maps** — 실내 평면 layout 과 구조 린트를 엔진에 넣는다 (`df70cfc`)
- **paw-maps** — PAW 팩 전 시트로 맵 51개 생성기와 갤러리 추가 (`7139cb7`)
- **paw-town** — 남쪽 주택가 골목을 노비하자식 블록담 골목으로 두르고 空き地를 둔다 (`d558591`)
- **paw-town** — 일본 소도시 조사와 적대 리뷰를 반영해 전봇대·신사·묘지·수로·학교 운동장·주차장·밭을 고친다 (`b2cb0d4`)
- **paw-town** — 주택을 작가 샘플 s15 구조의 박공 본채+옆 날개 일본 주택으로 바꾼다 (`a979c16`)
- **content** — PAW 일본 소도시 96×72 직접 배치 생성기와 배치 기록을 추가한다 (`438c22c`)
- publish Pixel Art World exteriors to the shared library (`db749ac`)
- **paw** — 50종 카드 완성 + 낱개 소품 계열 등록 (`2c5e45b`)
- **paw** — six direct-authoring interior families from the reviewed catalogs (`fb9130c`)

### 수정

- **paw-maps** — 공용 DB 를 현재 맵으로 재발행하고 팩에 재구성 검증을 넣는다 (`57356ac`)
- **town** — #1618 이 남긴 미사용 변수 inRiver·civicLot 제거 (tsc TS6133) (`e7b8e4b`)
- **editor** — 다른 표면의 조회로 로그인이 확인되면 AI 잠금 막이 걷힌다 (`0b800d5`)
- **paw-maps** — 51개 맵을 확대 검수해 평면을 자연스럽게 고치고 어색한 배치를 뺀다 (`021851a`)
- **paw-town** — 반쪽 묘석 블록을 온전한 칩으로 되돌리고 묘지 매화 겹침을 뺀다 (`554ef5b`)
- **paw-town** — 뒷산 동쪽 나무를 잘리지 않은 온전한 3행 나무로 바꾸고 부지 뒷담을 한 줄 내린다 (`9257388`)
- **paw-town** — 뒷산 수관을 잘리지 않는 솔·매화 두 수종 교차로 정리한다 (`0f0a31f`)
- **paw-town** — 뒷산 수관을 세 수종·불규칙 간격으로, 자전거·차·묘석·묘지 숲 복제 해소 (`11ee52e`)
- **paw-town** — 비전 리뷰 반영 — 건물에 가린 전봇대 제거, 뒷산이 부지 담을 덮지 않게, 자전거·나무 복제 줄 해소, 마당 생활 소품 (`cc2df80`)
- **paw-town** — 1:1 확대 점검으로 기물 배치를 정돈한다 — 공원·광장·강변 벚꽃길·묘지·교정 나무·신사 참도·주차 방향·생활 소품 (`5b77fe0`)
- **paw-town** — 2차 적대 리뷰 반영 — 전봇대는 보도 위만, 매화·단풍·벚꽃 칩 온전히, 묘지 담, 운동장이 본관보다 넓게 (`0d53117`)
- **paw-town** — 상점가 보도 화분을 전봇대와 떨어뜨려 보행 칸이 막히지 않게 한다 (`a86772f`)
- **paw-town** — 남서 주택에 블록담을 두르고 상가·아파트·의원·주택을 같은 시트의 다른 타일로 다양화한다 (`527ed29`)
- **content** — PAW 소도시 상점 앞면을 기존 TN 타일로 다양화하고 광장 소품을 둔다 (`73eb3aa`)
- **paw** — 벽보다 높은 벽걸이 부품은 바닥 받침, 이어서 수정 때 최신 사전 사용 + 51종 실행 기록 (`bf761c3`)

### 성능

- **editor** — 공용 자료를 부팅마다 두 번·통째로 받지 않는다 (`a047a88`)

### 기타

- 라삭 마을 4라운드: 안 쓰는 변수 둘 제거(noUnusedLocals) (`21fbf33`)
- 라삭 마을 4라운드: 뒷골목 설비·밀도·강과 다리·특수 건물, r4 QA(신호등·옥상·문 앞·차양) (`737be30`)
- 라삭 마을 4라운드 — 뒷골목 설비·밀도·신호등·차양·옥상 (`ed76d51`)

## 0.11.1 — 2026-09-27

### 수정

- **host** — 로드 뒤 첫 맵 패치 저장이 413 으로 영원히 실패하지 않는다 (`9b39536`)
- **forest** — 수관 속 숨은 길에서 캐릭터 머리가 잎 위로 나오지 않게 한다 (`07a2ef6`)

### 성능

- **editor** — 레이어 전환 재생성의 강제 레이아웃을 걷고 좌패널 최소 크기를 맞춘다 (`f68956d`)

## 0.11.0 — 2026-09-27

### 기능

- **rasak** — 해골 납골 벽·회색 돌 신전 A4 변형 묶음 (`6e16177`)
- **battle** — 크로노식 전투 엔진 — Active ATB·상태 확장·반격·자동 부활·적 이동·승리 포즈·필드 배경 (`9d28e86`)
- **rasak** — 사막·정원·해골 지하묘지·신전 묶음과 조수 참고문서 (`9a9b571`)
- **tileset** — Rasak 마을 꾸밈 — 간판·카페·신호등·옥상 설비·연못·놀이터 배치 (`24b2183`)
- **forest** — 숲마을 숲을 크기별로 꾸미고 걸어 들어가는 수관(★)에 보물 자리를 만든다 (`360daed`)
- **tileset** — Rasak 마을 공원 산책로·나무 무리·수종 상한·가로수 지터 (`c3d1d10`)
- **content** — Rasak 계절 숲·도시2 묶음 — 이름표·예제 셋·참고문서 forest_autumn·forest_mushroom·town_winter_market (`3eaa932`)
- **ai** — tilesetId 를 생략한 도구는 합본 마을 대신 시작 맵 칩셋(없으면 숲마을)을 쓴다 (`b4115aa`)
- **editor** — 합본 마을 칩을 사용 중단으로 표시하고 타일 그림판 목록 끝으로 보낸다 (`29193b7`)
- **battle** — 연계기·위치 범위기·TP 습득 (`0da1e2e`)
- **field** — 파티 추종·리더 교체·턱 뛰어내리기·시간의 문, 동료 설정 유실 수정 (`1a6ca29`)
- **player** — New Game+ 와 챕터 표시 (`eeda9e5`)
- **ai** — 사용자 프롬프트 빈틈 3개 — JRPG 프리셋, 울타리 보수, 타이틀 단계 개선 (`5642355`)
- **editor** — 조수를 오른쪽 도크로 옮기고 왼쪽을 세로 활동 막대로 바꾼다 (`0579158`)
- **tileset** — 라삭 마을 짜임 r1 — 건물 밀도 30%+·박공 ㄱ자 주택과 현관문·뒷골목 무리·가로등 방향·줄 맞춘 조경·1층 쇼윈도 (`dd2544b`)
- **title** — 깊이 시차 — AI 깊이 지도로 키아트를 2.5D 카메라처럼 움직인다 (`3ac4c3f`)
- **content** — Rasak 엘프·설원·항구 묶음 — 이름표·조립 예제 셋·참고문서 elf_village·snow_village·port_harbor (`0950b1f`)
- **title** — 편집기 입장·전환 설정, AI 투명 로고 생성, 실제 오프닝 다시 보기 (`e7ee68e`)
- **title** — 입장 시퀀스·로고 반짝임·「새 게임」 전환 런타임 (`ddc16c6`)
- **title** — 입장 시퀀스·로고 반짝임·새 게임 전환 설정 모델과 도구 (`8cf36e7`)
- **tileset** — 라삭 마을 짜임에 자동차 배치 — 통로 주차·세로 골목길·로컬 도로 길가·큰길 차선 (`f1faf71`)
- **tileset** — 라삭 승용차 물체 20종(가로 4×3·세로 2×3, 5색)과 carsHorizontal·carsVertical 조립 필드 (`6ff025b`)
- **tileset** — 마을 짜임 도로 틀을 시드마다 바꾸고 빈 뒷골목·잔디를 물체로 채운다 (`c01d459`)
- **content** — Rasak 던전·성곽 묶음 — 이름표·조립 예제 둘·참고문서 dungeon_crypt·castle_court (`27da264`)
- **title** — 오프닝 편집기 단순화 — 무대 손잡이·실시간 인스펙터·바로가기 (`790e3a2`)
- **tileset** — 라삭 1줄 1층 띠·옥상 설비·나무 수종·버스 정류장 부품과 마을 짜임 배선 (`f22b7f6`)
- **tileset** — check_town_map 이 손 실수를 좌표로 잡고 확실한 규칙은 거부한다 (`217ec3d`)
- **tileset** — 마을 짜임 건물 층 문법·주택 박공 지붕 (`ce0ab54`)
- **tileset** — 팩 도시 마을 한 줄 요청 헤드리스 시험 스크립트 (`64a659b`)
- **title** — 오프닝 프리셋 10종으로 개편 + 키아트 자유 모드 (`58fbf01`)
- **editor** — 레이어 줄 맨 왼쪽에 「높이」, 「도구」 메뉴 삭제 (`77262d6`)
- **title** — 조작 힌트 줄을 없애고 저작자 표기를 크레딧 메뉴로 옮긴다 (`6e5a671`)
- **relief** — 높이 지형 map.relief 를 에디터에 적용 — 렌더·높이 붓·AI 도구 3종 (`9b3dcd4`)
- **ai** — 턴 단계 계측을 채팅 패널 배선에 연결한다 (`ee229c5`)
- **ai** — 조수 턴의 단계별 벽시계를 남기고 ai:trace 로 읽는다 (`5a49096`)
- **player** — 갤러리 켜기·이름, 장면 템플릿, 대사 음성 (`5eeabe6`)
- **tileset** — 팩 도시 타일셋 마을 짜임 도구 build_pack_town·check_town_map (`824688b`)
- **tileset** — Rasak 도시 건물을 층으로 쌓는 규칙 — 창문 줄=층, 1층 띠, 문·차양 겹침 (`9ca3ece`)
- **tileset** — RPG Maker MV 팩 프리셋 — 올리면 조수가 바로 까는 Rasak Modern 도시 타일셋 (`ad21d79`)
- **title** — WebGL opening effects layer, generated keyart with vision-fitted effects (`651593a`)

### 수정

- **tileset** — 교차로 모퉁이 튜플 타입 명시(TS2556) (`ecb73fe`)
- **database** — 쓰지 않게 된 세션 복제 헬퍼를 지운다 (`2e4225f`)
- **persistence** — 열린 폴더 채택을 편집기가 쓰는 저장소에 붙인다 (`4e251bc`)
- **events** — 가구 조사 이벤트 칸에 놓는 상자가 옆 칸으로 밀리지 않는다 (`55e8215`)
- **ci** — main 잡은 다음 머지가 와도 끝까지 돌린다 (`1b5b615`)
- **types** — main 에서 넘어온 typecheck:app 오류 4건 (`61c51e1`)
- main 타입체크를 다시 초록으로 — 미사용 변수·JSON 스키마 null·이미지 생성 signal (`d7b8307`)
- **tileset** — 마을 짜임에서 안 쓰는 paintHouseRoof 를 지운다(TS6133) (`7683b08`)
- **content** — Rasak 4단계 예제 적대적 시각 QA — 배 선체 한 척·거대 나무 통째·집 문·흩뿌림 줄임 (`7b378ba`)
- **title** — 오프닝 다시 보기 창이 비던 문제 — 런타임 레이어를 이기도록 무대 크기를 인라인으로 고정 (`5f09865`)
- **assistant** — 팩 도시 타일셋 마을 요청을 PAW 전용 현대 맵 게이트에서 뺀다 (`deb0c31`)
- **types** — main typecheck 빨간불 네 곳을 걷는다 — Project import·readonly 경고·남은 layer 참조·자기참조 추론 (`f161713`)
- **types** — DB 레코드 편집의 Project 타입 import 를 되살린다 (`d92c30b`)
- **assistant** — 팩 도시 타일셋 마을 요청은 숲마을 계약 대신 build_pack_town 으로 (`fbf7e21`)
- **types** — 저장 커밋 로그의 죽은 import 를 걷는다 — main 의 typecheck 를 기준선으로 되돌린다 (`67b700c`)
- **ai** — 리뷰 R3 의 N5 를 고친다 — 역할 정책 스탬프로 «일부러 고른 높음» 을 지킨다 (`cfbd3c0`)
- **ai** — 리뷰 R2 지적을 반영한다 — 옛 저장 역할 승격·테스트 핀·실측 표기 (`197f9f9`)
- **ai** — 프리셋 «빠르게» 와 역할 폴백까지 기본 모델 lockstep 에 묶는다 (`48f238b`)
- **ai** — 리뷰 R1 이 지적한 다이얼 게이트·계획 강도·apply 단계를 고친다 (`75d7dc1`)
- **title** — 편집기 미리보기를 런타임과 맞추고 프리셋·배경·AI 덮어쓰기에 확인과 취소를 붙인다 (`2aca23d`)
- **ai** — 빌더 실패 안내에서 적용 지시를 떼고, QA 하네스가 고친 뒤의 문구로 단정한다 (`9074e4a`)
- **editor** — 셀 수를 아직 모를 때 「0/0 셀」 대신 행동만 알린다 (`9d99293`)
- **editor** — Pi 턴이 지난 턴의 종료 4축 푸터를 물고 가지 않는다 (`83bce20`)
- **ai** — 진행 중인 턴을 실패 진단으로 기록하지 않는다 (`2fea55f`)
- **ai** — 검수 실패 뒤 적용 안내가 남지 않고, 웹 검색 대기가 실제와 어긋나지 않는다 (`57d62e6`)
- **worktree** — 포트 배정 범위를 198칸으로 넓힌다 (`18ef7b9`)
- **worktree** — 죽은 등록이 adopt 전량 순회를 중단시키지 않는다 (`6ef1c3e`)
- **worktree** — 포트 배정이 실제 listen 중인 포트를 피한다 (`4e9cb73`)
- **worktree** — dev 런처가 node_modules 보정을 스스로 돌린다 (`7dd439e`)
- **test** — parity 왕복 테스트가 기본 15s 예산을 넘겨 ci-fast 를 막던 것 (`9e8284d`)
- **editor** — 붙지 못한 캐릭터셋 카드의 시계도 거둔다 (`f5306b5`)
- **types** — typecheck:app 게이트를 되살린다 — 오류 20건 (`10cd35a`)
- **tileset** — MV 팩 조수 타일 검수 — 둘레 재료 재계산·창 없는 벽·차도 표시 거부 (`bcba4e5`)

### 성능

- **editor** — 맵이 쓰지 않는 업로드 타일셋 텍스처를 부팅에 올리지 않는다 (`c0aa321`)
- **database** — 데이터베이스 창을 열 때 프로젝트를 복사하거나 직렬화하지 않는다 (`13285af`)
- **host** — 팀 호스트 프로젝트 부팅이 공용 타일 참고문서 191MB 를 기다리지 않는다 (`88a1a40`)
- **boot** — 정규화기가 바뀐 것 없이 변경을 보고하지 않는다 (`357655e`)
- **editor** — 조수가 보이는 채 칠할 때와 입력할 때의 긴 작업을 없앤다 (`54b6c22`)
- **shared-content** — 공용 타일셋 참고 이미지를 호스트 주소로 보낸다 (`efa3e28`)
- **editor** — 도구 전환·검색이 좌측 팔레트를 통째로 다시 짓지 않게 한다 (`97729e5`)
- **shared-content** — 카탈로그 응답을 gzip 으로 보내고 판본이 같으면 압축본을 재사용한다 (`ac1e869`)
- **shared-content** — 편집기 부팅이 공용 카탈로그 전체 395MB 를 기다리지 않는다 (`d09973c`)
- **ai** — 리뷰 R1 의 차단 항목을 고친다 — 상한 제거 회귀를 다시 잡게 하고 재시도에 지터를 넣는다 (`6c366b7`)
- **ai** — 조화 검수 동시성을 6으로 올린다 — 6 동시가 직렬화되지 않음을 실측 (`c060fbd`)
- **ai** — 공장 기본 모델을 gemini-3.8-flash 로 옮긴다 (`8bd0e3c`)
- **ai** — 실행 루프의 사고 강도를 자율성 다이얼에 묶고 기본을 low 로 내린다 (`de24551`)
- **save** — 저장 한 번의 깊은 복제를 네 번에서 한 번으로 줄인다 (`26f5bb2`)
- **save** — 타일셋 비교를 문서 밖 필드까지 요약으로 본다 (`2aaccb0`)
- **editor** — DB 레코드 편집을 컬렉션 범위 복제 경로로 보낸다 (`9de3e6e`)
- **save** — 자동저장이 프로젝트 문서를 여섯 번 지나가지 않는다 (`aa3f990`)
- **editor** — 낭비된 전 맵 스캔과 자원 관리자 인터벌 누수를 없앤다 (`deaa22c`)

### 문서

- Rasak 4단계 조리법 7번 재시험 H3 결과 (`303e664`)
- Rasak 4단계 적대적 시각 QA·시험 H2 결과, 조리법 공통 금지 7번 (`f68c3da`)
- Rasak 던전·성곽 헤드리스 시험 G1 결과 (`758e1fb`)
- **openwiki** — 팩 도시 마을 요청의 숲마을 계약 가로채기와 우회 기록 (`2ed9ec3`)
- **ai** — 리뷰 R2 의 비차단 지적을 정리한다 — 오타와 낡은 근거 (`62163ba`)
- **ai** — 리뷰 R4 지적대로 로더 헬퍼 주석을 제자리로 옮기고 프로브 기록을 남긴다 (`dbee65c`)
- **ai** — 턴 계측의 «중첩·비합산» 계약과 실측 표기를 정정한다 (`197e55c`)
- **test** — 격리 원장을 실제 134개 파일과 일치시킨다 (`c043519`)
- **openwiki** — MV 팩 건물 층 문법·마을 짜임 도구 기록 (`bff0301`)

### 테스트

- **qa** — 크로노 매트릭스를 구현된 필드로 갱신하고 전후 판정을 남긴다 (`efbb28c`)
- **persistence** — 빈 로컬 폴더 부팅 케이스에 실제 비용만큼 예산을 준다 (`4f89ef4`)
- **qa** — 크로노 트리거 기준 저작·런타임 매트릭스 (`a51d515`)
- **perf** — 6 동시 검수 실측 원본을 증거로 남긴다 (`e95fb21`)
- **perf** — 턴 프로브에 대본 전송 모드와 렌더러 크래시 기록을 남긴다 (`effffd3`)
- **perf** — 조수 턴 지연 실측 프로브와 증거를 남긴다 (`c1eac3b`)
- **qa** — Pi 검토·적용 상태를 실브라우저로 관찰하는 하네스를 추가한다 (`fdfadb2`)
- **save** — 퇴역한 전송 대신 현재 커밋 포트로 영속을 검증한다 (`f1835bc`)
- **team** — 보기 전용 프로젝트의 AI 적용 거절을 회귀 시험으로 고정한다 (`152791c`)
- **perf** — 편집기 렉 실측 프로브와 증거를 남긴다 (`6416c0a`)

## 0.10.0 — 2026-09-26

### 기능

- **ai** — 조수가 타일 영역을 옮길 수 있게 move_region 을 추가한다 (`d33d08f`)
- **objects** — 공용 오브젝트 카탈로그 재생성 — 아틀라스 장면 소품 포함 (`e820e92`)
- **places** — 아틀라스 scenes 공용 DB 게시 — 장소·지역 등록 (`579cb2f`)
- **places** — 아틀라스 dungeons 공용 DB 게시 — 장소·지역 등록 (`a7442cd`)
- **places** — 아틀라스 biomes 공용 DB 게시 — 장소·지역 등록 (`86851cb`)
- **places** — 아틀라스 towns 공용 DB 게시 — 장소·지역 등록 (`6cc0114`)
- **atlas-towns** — 특수 마을 17장 + 기후 칩셋 아틀라스 부품 거부 (`61447f5`)
- **places** — atlas 실내 100곳 정본 저장·공용 DB 게시 — 예배당↔납골당 계단 짝, README (`841a8ee`)
- **atlas-towns** — 기후 마을 11장 — 설원·북방 항구·산장·오아시스·벼랑 굴집·사막 강마을·바자르·화산 대장간·피난 마을·단풍 마을·가을 신전 (`4815730`)
- **atlas-towns** — 농촌 11장 — 밀밭·과수원·말 목장·포도원·추수 장터·나무꾼·사냥꾼·네거리 여관·장터 읍내·양봉·물레방아 (`9bc6907`)
- **atlas-towns** — 산촌 7장 — 광산·채석장·계단 산촌·드워프 산채 둘·벼랑·고원 목장 (`ff1540c`)
- **tiles** — Tibo 69~71행 — 뒷모습 긴 의자·쇠창살·금고 문·칠판·보석/창구 카운터·룰렛·돌 욕조·고기 걸이·가죽 틀·무대 앞면 (`696c792`)
- **objects** — 공용 오브젝트 카탈로그가 tiledata/*/shared-objects.json 을 모은다 (`21355ec`)
- **places** — 공용 DB 게시 도우미 — 장소·지역을 파이프라인별 라이브러리로 (`ba62d3a`)
- **places** — 공용 DB 재게시 88곳 — 실내 6·던전 5·야외 7 추가 (`c8ff2d1`)
- **content** — Rasak 상점·성 실내 예제 3개 — 대장간·재봉점·성(A5 돌 벽면)·참고문서 용도 셋 (`3cac878`)
- **places** — 공용 DB 게시에 야외 2차 7곳 포함 — 야외 숲·설원·화산·월드 공용 사본 (`39a1a07`)
- **places** — 실내 2차 6곳 — 대성당·수도원·사막 궁전·설원 요새·여관 지하·곡물 창고 (`3af904d`)
- **ai** — 특수 건물 예제로 마을 기준 맵 교체 + stamp_object 가 킷 입구 좌표를 돌려준다 (`b91c522`)
- **places** — 던전 다섯 곳 추가 — 마왕성 정문 홀·투기장·늪 신전·해적 소굴·우물 밑 굴 (`f8a4d6f`)
- **places** — 야외 2차 7곳 — 마왕성 외관·숲 미로·용의 산 정상·숲 야영지·농장 목장·등대 곶·섬 해도 (`db2b1ba`)
- **content** — Rasak 특수 건물 43채 — 통째로 굽기·structureKits(sb_*)·town_buildings 참고문서·건물 마을 예제 (`46e1ded`)
- **places** — RPG 판타지 장소 70곳을 호스트 공용 DB 에 등록 (`0e8c769`)
- catch wide empty strips, ceiling filler, and jambless room doors in interior audit (`3c56f03`)
- **ai** — Pi 끝에서 배치 품질 한 번 수리 권고 + 무변화 반복 호출 차단 (`8c85759`)
- **places** — JRPG staple interiors — lighthouse (ground floor + lamp room), ranch barn, healer clinic, sewer prison (`62eea29`)
- **content** — 엘프 나무 위 칸 도트 다듬기 — 데크 판자·가장자리·줄기 음영·창·등불 (`e9d6b11`)
- **places** — sunken sea temple — flooded gate hall, coral pillar hall and sea-goddess altar (`b783286`)
- **content** — 엘프 나무 위 마을 — 숲마을 나무 위 칸(3131~3310) 이식·장소 등록·공용 AI 문서 (`833b978`)
- **places** — climate interiors — desert, snow and volcano houses with baked climate walls (`dfb59ea`)
- **places** — two more fields per climate — snow ford and ice-wall pass, lava-fall ridge and lava-lake causeway, canyon pass and dune-sea road, orchard road and maple valley (`5e650ff`)
- **content** — apply-assistant-pack --example-maps — 연구 프로젝트의 조립 예제 맵도 새 예제로 갈아 끼운다 (`98d472b`)
- **content** — Rasak 마을·실내 참고문서 3차 — 방 여럿·가구 한 벌·숲 벽·길에 맞댄 집 줄·대칭 금지 (`121f7ec`)
- **content** — Rasak 예제 네 장을 제작자 수준으로 다시 조립 + 조립 규칙 검사 (`e12b7a8`)
- **battle** — encounter swirl, decisive-kill finale stamp, count-up rewards, black return (`b001d4e`)
- **content** — Rasak 예제 품질 검사 — 빈 바닥·빈 정사각형·좌우 대칭·실내 허공을 제작자 맵 기준으로 (`4116e65`)
- enable direct interior tile authoring and report real validation failures (`b5e960c`)
- **ai** — 바로 깔기는 모델이 의도를 읽고 여러 도구로 나눠 바로 깐다 (`6775b90`)
- **editor** — 우클릭 드래그 바는 곧바로 채팅 턴으로 — 영역 작업 창 폐기, 번개 토글로 바로 깔기 (`24f2046`)
- **houses** — two-storey gable houses (gable-2f*) in author_house and villages (`22acdfc`)
- **battle** — revive the 9 deprecated battle skins as glass-skeleton variants (`3f3f521`)
- **content** — Rasak 마을·실내 참고문서 2차 — 집·방 뼈대 배열, 통째 복사 금지, 창을 지붕 줄에 둔 오류 (`c3bbd5e`)
- **ai** — 칩셋 계열 변경 질문 카드 — 지금 맵과 바뀔 칩셋 견본을 나란히 보여 주고 묻는다 (`b02075b`)
- **content** — Rasak 마을·도시·실내 묶음 — 이름표·조립 예제·참고문서 4용도 (`c9e6710`)
- **objects** — shared object catalog — 195 reusable objects with owner rules and previews (`e1dbfff`)
- **houses** — new roof colours and wall materials as six more house kits (`7813f76`)
- **ai** — ask_tileset_change — 다른 칩셋 계열이 필요하면 사용자에게 견본으로 묻는다 (`ececebd`)
- **ai** — 실행기가 다른 칩셋 계열로의 맵 생성·변경을 거부하고 create_map 은 지금 보는 맵 칩셋을 기본으로 (`ab8d073`)
- **ai** — 도구 ctx 에 지금 보는 맵과 승인 칩셋 계열을 싣는다 (`a31d182`)
- **tileset** — 칩셋 계열 판정 tilesetFamily + TilesetDef.family (`0b82401`)
- **houses** — chimneys, dormers, porch awnings and gable finials on gable houses (`cb9eaa8`)
- **houses** — gable parts become a kit-agnostic form catalog and the default mix (`2580730`)
- add eight modern Japanese interior scenes (`e2daa12`)
- **places** — desert and ash outdoors and fields fill with ground, not rocks (`97e34e4`)
- **ai,places** — shared places and objects visible without spatial activation, stamp_object (`eb37432`)
- **places** — snow on the frost fortress walls (`06e903f`)
- 우클릭 드래그 선택 바를 즉시 뜨는 한 줄 AI 컴포저로 교체 (`affa49f`)
- **editor** — 맵 테두리 밖에서 호버하면 맵 크기가 늘어난다 (`28a3c03`)
- **editor** — rotate a short line while the editor boots (`caf7fcc`)
- **climate** — desert and volcano villages fill their ground with cracks, lava plates, dunes and ripple sand (`2e91df7`)
- **ai,places** — import_region_reference brings a registered place and its tileset in one call (`a4683ea`)
- **content** — Rasak 참고문서 3회차 — 직사각형 금지·9×6 연못 조리법·굽은 길·장식 덩이 (`601a57f`)
- 바로 깔기는 모델 없이 가고 입력줄에서 맵 이름과 모델명을 뺀다 (`13eaa9b`)
- **headless** — oprn-tools saves with --write, starts from --new, awaits tool.prepare (`e9df110`)
- **content** — Rasak 참고문서 2회차 — 밀도 목표·길·장식 덩이·읽는 순서·금지 도구 (`3a36dac`)
- **editor** — 맵 설정을 항목별로 열고 목록에서 미리보게 한다 (`c2ea4fd`)
- **ai** — AI 설정에서 조수 도구 사용량을 보고 JSON으로 보낸다 (`bce45be`)
- **assistant** — open a copyable diagnostic log from assistant errors (`123b4d5`)
- **content** — Rasak 조수 지식 묶음 — 4층 참고문서·이름표·자동타일 그룹 빌더 (`5671d5b`)
- **ai** — 네 층 타일셋이면 Pi 시스템 프롬프트에 한 줄 + 네 층 가르치기 문서 (`8a4dead`)
- **ai** — 고스트 증분·변경 집계가 2·4층·그림자를 안다 (`41ab521`)
- **places** — outdoor places review fixes, great valley and world map, registered under 장소 with AI docs (`e579778`)
- **battle** — hit feel layer for front-view and monster battles (`bd4f2c4`)
- **ai** — 조수가 네 층을 본다 — show_map_region 2·4층·그림자, 헤드리스 지도 이미지 (`b207c9d`)
- **ai** — 조수 쓰기 도구가 1~4층·그림자를 쓴다 — stamp_layer_block·paint_shadow (`6377722`)
- let assistants construct shared schools interiors and city scenes (`3fd90eb`)
- document shared school stairs and verify live assistant placement (`d21d21a`)
- **map** — 오토타일이 고른 층 배열에서 모양을 잡는 autotileLayerView (`10254ff`)
- add verified static prop complements and sealed local publisher (`8d0fc63`)
- support verified archived Pixel Art World XP editions (`3e74b69`)
- publish PAW retrotown and facility assembly references (`6f02fa0`)
- seal and publish facility complement library locally (`2bc174b`)
- add complete facility supplement objects and support samples (`c240fed`)
- prepare native bathhouse and retro town exterior assemblies (`b10f52b`)
- publish mansion exteriors and complete water frame references (`19d2e83`)
- import complete sewer water event frames and placement references (`0f4181f`)
- prepare native mansion exteriors with complete buildings and gardens (`812f3cb`)
- publish compact assemblies and regional AI references (`6f8d307`)
- package loose supplements as isolated local shared library (`8e3f324`)
- support native wooden school exterior and compact sewer assemblies (`aba73a8`)
- prepare five native mansion interiors with owned assembly references (`cfc06ec`)
- add five complete loose prop assembly supplements (`2ba36c4`)
- publish Japanese rooms and regional expansion references (`fb08a34`)
- prepare native Japanese interiors with source-preserving booth assemblies (`b773b0e`)
- prepare reviewed loose prop library with sealed local CAS publishing (`f3c3105`)
- import Pixel Art World loose props with complete object references (`10669be`)
- publish bathroom and gym places with shared AI references (`b288769`)
- add reviewed local bathroom and gym tile packs (`388c48f`)
- publish reviewed drink shop and verify shared place references (`feb38d7`)
- prepare compact icecream shop with verified drink ensemble (`7a77ad3`)
- add verified event prop frames and restricted source catalog (`5b6acf3`)
- import food sprites with complete table compositions (`ea09b08`)
- expand verified door catalog with static and variable-grid sprites (`426dd70`)
- add icecream shop and public bath assembly packs (`22fac21`)
- import verified Pixel Art World door graphics and frame guides (`068456b`)
- prepare native references and shared place assemblies (`8830c6f`)
- add personal room and public restroom assembly packs (`483cc8c`)
- prepare shared XP tile references with reviewed material assemblies (`0a59af2`)
- expand verified XP autotiles and animate ditch strips (`d6f5bef`)
- add wooden school and park tile assembly packs (`0ce2337`)
- connect shared spatial AI references and local PAW library (`0195b34`)
- author four-storey school rooms and catalog source downloads (`6253172`)
- organize city around school shops and neighborhood paths (`ea102d9`)
- add school entrance hall with explicit room door connections (`ff65ad2`)
- build downloadable-tile city and compact connected interiors (`5ab0891`)
- add compact modern home from verified local tileset (`98d722b`)
- add varied Pixel Art World city exterior assembly kits (`a02fd56`)
- add compact Pixel Art World facility interiors metadata (`7ebc41f`)
- compact school classroom and add nurse and science interiors (`c937b4d`)
- add urban street scenes and integrate school tile references (`b7d28ec`)
- import Pixel Art World XP autotiles as baked connected tiles (`1188671`)
- add verified school tileset metadata and classroom assembly (`43bdfdf`)
- add user-downloaded Pixel Art World furniture support (`78cfc32`)

### 수정

- **objects** — 공용 오브젝트 카탈로그가 가리키는 PNG 54장 커밋 (`135c25d`)
- **dungeons** — 해적 소굴의 널판 뗏목을 진짜 범선으로 — 아틀라스 던전 조각 시트·재칠 시트 13장 (`8714b4b`)
- **interiors** — 교회·대성당·경매장 긴 의자를 제단·무대를 향한 뒷모습으로, 탁자 맨 아래 줄에 다리 달린 앞면 (`3ee9a5d`)
- **places** — 1×1 계단 한 칸 · 마구간 헛간 · 해저 신전 복도·산호·제단 (`03ae0d4`)
- **places** — 절벽 계단을 난간 있는 111|113 으로 — 1칸 디딤판 2689 두 칸 붙이기 폐기 (`57016d6`)
- **places** — 실내 계단 조각을 제 모양대로 — 오르막 3칸 폭 벽타기, 내리막 474|475 한 줄 (`a63ee04`)
- 하위 맵 포함 삭제를 한 번에 검증하고 빈 분류까지 지운다 (`2c15924`)
- preserve furniture and verify AI-authored interiors (`f6ac1ef`)
- restrict modern map authoring to installed Pixel Art World tilesets (`30931ba`)
- **autotile** — MZ 팩 그룹은 맵 밖을 이어진 이웃으로 본다(edgeConnects) — 맵 둘레 테두리 선 제거 (`b73608d`)
- **interior** — inn stairs stand on floor, Tibo ceiling borders close, mesa/bones on request only (`97f9676`)
- **houses** — windows only mid-wall, doors leave a 3-cell wall, stepped 2F out of mix (`b174594`)
- **ai** — 핸드오프의 바로 깔기 호출은 비동기 러너와도 맞게 void 로 부른다 (`cef080f`)
- **editor** — 맵 테두리는 드래그로만 키운다 — 호버는 안내만 (`eb8e1df`)
- **assistant** — 워커 소켓이 끊겨도 적용·그림 응답을 한 번 다시 보낸다 (`aaa6093`)
- **houses** — wall-face rule for wing templates, symmetric default windows (`36bb5ef`)
- **objects,climate,dungeon** — issues found in the v2 assistant rerun (`f6ab22b`)
- **houses** — gable roofs never float over grass, walls ≥3 cells, posts only mid-wall, windows everywhere (`2d610be`)
- **fields** — desert crossroads is open sand with sparse leafless groves (`df8e4cc`)
- **climate** — flow-plate volcano ground, ridge dunes, no road campfires (`5e8a2c0`)
- **houses** — roof deck reads as a railed terrace; awkward forms leave the default mix (`8769592`)
- **ai,map** — forest route uses the forest village road, tall grass tool arrange_tall_grass (`111e96b`)
- **ai,tiles** — layer metadata, whole reference pages, query_tiles offset (`f94ad90`)
- **dungeon** — lava theme lays a fire river, plank bridge and lava pools (`4db36a4`)
- **editor** — hidden database prewarm must not pull runtime CSS into boot (`a795cae`)
- **editor** — 편집기 CSS·긴 목록 비용 줄이기 (`09e73fc`)
- **ai,interior** — interior tools build on tibo_interior_expanded and fall back to the bundled inn/house (`f6da5cc`)
- **ai,village** — climate-aware author_village, fill_region water, paint_tiles gap fill (`fb749e0`)
- 바로 깔기는 문장으로 길·면·집 도구를 고른다 (`61ffc51`)
- **ai** — 되돌리기·새 프로젝트는 칩셋 바꿔치기 검사에서 빼고 네 층 리뷰 고침 (`f9695b8`)
- **tileset** — autotile water on every sheet that shares the town water block (`441e0e8`)
- **editor** — keep reference path check free of JSON imports (vite config graph) (`1b98220`)
- **editor** — ship reference images as static files, not inline bytes (`772f717`)
- **types** — declare VITE_STILL_CDN_BASE so typecheck:app is green again (`579f77b`)
- **editor** — skip idle map-canvas renders, clip grid, cheaper resize (`cb4803e`)
- 바로 깔기는 빈 칸을 꽉 채우고 소품 이름은 유지한다 (`0ad02f0`)
- **tiles** — new projects carry the tile numbers the place documents use (`66a96fe`)
- enclose izakaya tatami seating in a private room (`a2c776a`)
- require walls below ceiling edges and add two shop interiors (`539c2d4`)
- **editor** — cut web editor main-thread stalls on save, paint and pan (`427ab3f`)
- **editor** — a new actor gets a class even when the project has none yet (`ca2cbcd`)
- **player** — choice commands show at most five options, matching the event form (`26b4d65`)
- **editor** — clearing a map background or BGM does not keep an empty resource id (`59b758a`)
- **editor** — distinguish temporary erase from permanent event removal in the command summary (`3b80995`)
- **editor** — ignore a stale topbar render after the mode has already changed (`2859e1a`)
- **editor** — 조수 도구 사용 요약의 ?? 와 || 를 괄호로 묶는다 (`15e2a33`)
- **editor** — keep the first trapped error when the error log overflows (`e6a2aa9`)
- **player** — dialogue log follows the physical L key and stays on the tab order (`2b7bb97`)
- **editor** — welcome overlay restores focus to the control that opened it (`02ef507`)
- **editor** — coach rail copy uses the same tool names as the toolbar (`94cc596`)
- close review-critical holes in save, battle, play input, and map destruction (`839b5ea`)
- **ai** — 업로드 타일셋 맵의 칩셋을 도구가 말없이 바꾸면 거부한다 (`74cd76b`)
- enlarge izakaya and separate kitchen with connected walls (`bcba42a`)
- **editor** — 큰 프로젝트에서 조수 체크포인트마다 편집기가 멈추지 않게 한다 (`8c8cd2b`)
- connect izakaya ceiling autotiles and preserve dense seating (`4759c54`)
- **climate** — leafless groves no longer stand in a hedge along the map edge (`ec7c43f`)
- densify izakaya seating and add a two-bedroom house layout (`72687d6`)
- **electron** — 데스크톱 앱이 bun 없이 AI 워커를 띄우게 한다 (`26d6eb8`)
- **editor** — 그리기 타일은 칸 집합이 바뀔 때만 다시 그린다 (`7d7356d`)
- **electron** — 데스크톱 앱 AI 채팅이 app:// 에서 404 나지 않게 한다 (`deecfdf`)
- **ai** — 4층 쓰기 도구 리뷰 고침 — 2층 fill 은 1층 쌍으로, tile_erase 1/3 별칭, reshape:false (`b779e48`)
- **editor** — 숲마을 칩의 숲 밀도는 굽이숲 수관을 깐다 (`bc6318e`)
- **editor** — 장소 카드를 두 번 눌러도 확대 그림이 남게 한다 (`109a021`)
- raise school stairs and connect their central partition (`b9c5bf4`)
- move school stair flights closer to the back wall (`5ccb8bd`)
- move school stairs into a dedicated core and add rear lockers (`28d6930`)
- compact school floors within frozen 380-source scope (`92d0a31`)
- share immutable tile references in database modal snapshots (`394507e`)
- clarify PAW mansion furniture identities with owned visual references (`1db137c`)
- freeze PAW support scope at user-selected 380 sources (`681bdb9`)
- include loose prop filenames in catalog search (`752f8e8`)
- clarify loose prop views and override opaque tree shadows (`dfa0bd7`)
- ground loose barricades and block the large rock pile (`5a510d2`)
- persist food and event reference libraries and support large project seeds (`cd944a6`)
- retain food object kits and owned assembly references (`da09007`)
- preserve new door reference owners in canonical content patches (`1ac4d04`)
- compact civic facilities and preserve complete tabletop furniture (`394c78b`)
- compact homes and preserve shared spatial reference dependencies (`1d934d4`)
- densify studio layouts and screen restroom approaches (`5664661`)
- include shared defaults before creating project folders (`f522f78`)
- transport large project saves with bounded gzip RPC bodies (`49819fe`)
- select explicit XP reference backing and label templates (`1bf795a`)
- tighten PAW civic interiors and persist shared expansion (`9b572bd`)
- compact park example around purposeful paths (`d589511`)
- tighten school corridors and furniture-based room layouts (`d444c72`)
- compact school floors and join ceiling lintels across doors (`aafd59e`)
- keep school source dictionary within reference reader limits (`0a42f54`)
- rebuild interior rooms and connect school through a shared hall (`05337ae`)
- correct facility furniture assembly and grounded placement (`ee98938`)
- use seamless gable backing and broad roof pieces (`1276c47`)
- assemble complete city signals and zebra crossings (`233aba9`)
- ground school furniture and remove false wooden wall strips (`162532a`)

### 성능

- **editor** — 대형 칩셋 팔레트 클릭 렉 제거 (1.2~2.6초 → 0.1~0.2초) (`766edfa`)

### 문서

- **openwiki** — INDEX 재생성 (`b51ae28`)
- **openwiki** — atlas 실내·뒷모습 긴 의자·탁자 앞면 규칙 (`8745e1e`)
- 물체가 있어도 예제가 없으면 못 짓는다 — 상점·성 실내 시험 F1 (`d006a7c`)
- 문장 규칙은 예제를 못 이긴다 — 완성 건물 킷 시험 E·E2·E3 (`e6d5837`)
- record scoped house repair that passes structural and visual review (`a20dd8b`)
- record round of live house runs against new empty-strip/door/ceiling checks (`d9ddf9c`)
- 배치 품질 수리 권고·반복 차단 — D4 시험 결과와 흩뿌림 금지 문구 (`4cb7c56`)
- Rasak 예제 품질 기준·조립 검사·맵 가장자리 자동타일 규칙 (`4ebc35f`)
- **wiki** — Rasak 마을·실내 용도와 시험에서 배운 함정 (`2b90309`)
- **wiki** — 칩셋 계열 규칙 — 판정 순서·실행기 검사·create_map 기본값·질문 카드·헤드리스 플래그 (`54f7573`)
- **plan** — 칩셋 계열 지키기 + Rasak 마을·실내 묶음 계획 (`7dc4d99`)
- **places** — desert and ash tile dictionaries list the tiles the guides name (`5213105`)
- **openwiki** — 업로드 타일셋 바꿔치기 거부 실행기 계약과 네 층 도구 변화 기록 (`f721f11`)
- 생성형 이미지 설계 개정 1 — Pi 에서 생성 도구가 실행되지 않음·읽기 전용 노출·체크포인트 초크포인트 반영 (`1726c70`)
- 생성형 이미지 사용 단계 설계 (프로젝트 설정·입력창 칩·확인 카드·사용 안 함 게이트) (`72f84c2`)
- **plan** — MZ 4층 — 조수가 네 층을 잘 까게 하는 계획 (`0900c86`)
- record latest PAW new-project persistence evidence (`d9a540b`)
- record loose prop review and saved UI import evidence (`8d65a15`)
- record XP shared installation and canonical reload evidence (`894e36f`)

### 테스트

- verify modern interiors through the live assistant (`315c560`)

### 되돌림

- **interior** — restore the wall-climbing inn stairs (`ce7b77b`)

### 잡무

- **content** — Rasak 이름표 사본 — 특수 건물 43채(sb_*) 추가 (`d224f90`)

### 기타

- 올스탑 시점 저장 (`a570acf`)
- **dungeons** — 원소 신전 4×3층, 아틀라스 재칠 시트 13장을 던전 시트 쿼터 합성 목록에 등록(물·자동타일) (`11de698`)
- **atlas-scenes** — 숲·기후 항구 11장 + 배 갑판을 OutdoorMap 에 싣는 도구, 파이프라인 전용 타일셋 id (`d0ec7b9`)
- **atlas-interiors** — 배 2·기후 12 — 100곳 도달 (`fa0bb9b`)
- **dungeons** — 3회차 QA 기록 (`208f97f`)
- **dungeons** — 유령선 4칸·유령 저택 5칸 (`9633467`)
- **atlas-biomes** — 필드 89장 QA 1~4회차 — 황무지 채움·물 색, 섬 밑동, 툰드라 큰 패치 (`41e2637`)
- **atlas-interiors** — 성소 6곳 — 예배당·신전·사당·수도원 침실·필사실·납골당 (`83a640f`)
- **atlas-scenes** — 항구 4장·하늘 3장(돌부두·해군기지·해적만·조선소·비공정·하늘섬) (`4275bda`)
- **atlas-biomes** — 필드 77·경계 12 계획, 빈터 레이아웃, 경계 지대 이웃 땅 패치 (`fde5e49`)
- **atlas-interiors** — 성 10곳 — 알현실·회의실·침실·서고·예배당·부엌↔지하 저장고·탑·왕자·근위대 (`b79776a`)
- **dungeons** — 1·2회차 QA 표, 시각화 생성기, 19장 카탈로그·그림 (`16c6067`)
- **atlas-scenes** — 갑판 10장(상선·군함·해적·기함·여객·고깃배·정박·습격) + 갑판 짐 채우기 (`74d8072`)
- **dungeons** — 지하 묘지 5층·하수도 5칸 — 게이트·도달 통과 (`1fb8a7f`)
- **atlas-interiors** — 공방 10곳 — 대장간·목공·유리·가죽·직조·방앗간·풍차 1·2층·양조·빵 (`9ba62e5`)
- **atlas-interiors** — 공공시설 2 — 초소·감옥·병영·시청·우체국·고아원, QA 기록 (`ed418a0`)
- **atlas-interiors** — 공공시설 10곳 — 병원·은행·극장·목욕탕·카지노·경매장 (`30ec279`)
- **dungeons** — 튜토리얼·은광 9장 게이트 통과, 자연 덩이 채움·막힌 칸 메움 (`de12f0f`)
- **atlas-interiors** — 44곳 전부 빈칸·도달 통과 (`ad9e4a8`)
- **atlas-scenes** — 탈것·장면 시트(배·비공정·마차·축제) + 번들 타일셋 + 파이프라인 뼈대 (`9aa4ffd`)
- **dungeons** — 아틀라스 던전 저작기·튜토리얼 동굴·은광 계획 (`68760e9`)
- **atlas-interiors** — 상점 14·여관 5·길드 6·학교 4 (빈칸 보정 중) (`c940f89`)
- **atlas-biomes** — 경계 지대 풀 정리·둥근 바닥 패치·늪/사바나/툰드라 손질·섬 출구 혀 (`56ed00f`)
- atlas towns 산촌 묶음 (광산·계단 산촌·드워프 산채 통과, 설산 드워프 조정 중) (`e11218c`)
- **atlas-biomes** — 필드 빌더·레이아웃·테마·시험 지도 14장, 동굴 입구 조각 (`dd44541`)
- **atlas-towns** — 항구 마을과 청파항 전경·구역·축제 밤 (`16218d5`)
- **atlas-towns** — 고향·물가 마을, 왕도 전경과 구역 6장 (`edc818b`)
- **atlas-interiors** — 실내 저작 킷(겹침·의자 방향·탁자 앞면·뒷모습 긴 의자 검사)과 민가 15곳 (`492ef61`)
- **atlas-biomes** — 바이옴 시트 11장 굽기 — 재칠 + 손 도트 조각 + 땅 오토타일 + 경계 사본 (`0ad210e`)
- **atlas-towns** — 마을·도시 파이프라인 뼈대 · 부품 3311~3490 · 고향 마을 세 상태 (`1289816`)
- interiors round2 — baked well/fountain/rat hole, cathedral draft (`aa8b220`)
- frontier dungeon drafts (`2c3c16c`)
- agent worktree base for chipset-family (`63e32e2`)
- **climate** — calmer volcano ground and landform dunes (`8445aef`)
- **climate** — lava cracks, lava plates and pools, dunes and ripple sand for the desert and volcano sheets (`b615f7e`)
- **climate** — leafless groves no longer stand on one foot row (`e758849`)
- **climate** — regenerate renders, guidance and places after grove tuning (`1fc50e1`)
- **climate** — regions, AI guidance v6 and README for the leafless tree villages (`204e5be`)
- **climate** — lock leafless tree meta so renderers draw the trunk backing; guides v6; test for groves (`9599c5f`)
- **climate** — desert/volcano villages trade the leafy forest for leafless groves, meadows and sealed cliff ends (`2792512`)
- **climate** — leafless tree tile meta and bare-trees:* groups on snow/volcano/desert tilesets (`d2a810d`)
- **climate** — bake leafless trees into snow/volcano/desert sheets from 2880 (`6bbc910`)
- Revert "feat: support verified archived Pixel Art World XP editions" (`59bdc7b`)
- Revert "feat: add verified static prop complements and sealed local publisher" (`96767bd`)

## 0.9.0 — 2026-09-25

### 기능

- 숲성 마을 장소에 건물 목록·「생성형 이미지」 표시, 키큰 풀 E/F/G 정리 (`97a529a`)
- **dungeon** — browser proof for the 22 dungeon places, exports regenerated on the rebased base (`72d0e03`)
- **dungeon** — 21 RPG dungeons reworked after review, tower redesign and one large 80x64 dungeon, published as places (`d2d0605`)
- **events** — add monster species ownership conditions (`9d95742`)
- **rasak** — 스택을 4층·그림자로 싣는 시연 스크립트 (`1bfc6af`)
- **tiles** — tall grass redrawn in three kinds E/F/G for the forest atlas (`33a050f`)
- **editor** — 미리보기·썸네일이 새 층을 그린다 (`b0e369f`)
- **places** — interiors rework after full review — real partitions, tabletop items on tables, floor stairs, themed rooms; castle 1F 50x40 (`65f3e24`)
- **places** — refresh interior renders, guidance and place snapshots after fill passes (`8ab314c`)
- **places** — 22 RPG interiors — inn, homes, church, guild, magic trades, library, classroom, castle rooms, ship below decks, arena, casino, auction (`cc2952b`)
- **editor** — 에디터가 2층·그림자·4층을 그린다 (`f783762`)
- **player** — 2층·그림자·4층을 그린다 (`0452ad0`)
- **editor** — 크기·밀기·복사·지우기가 2층·4층·그림자를 다룬다 (`470a262`)
- **collision** — 4층 통행 — 위에서부터 ★ 건너뛰기 (`0a2f7da`)
- 설계도 방식 생성 건물 + 공용 장소 「개울 건너 숲성 마을」 (`9441285`)
- **map** — 2층·4층·그림자 선택 칸과 층 헬퍼 (`51e0fe5`)
- **content** — Rasak Fantasy(MZ) 팩 비공식 지원 스크립트 — 그림은 저장소 밖 (`4258b54`)
- **dialogue** — 대화창을 고를 수 있게 — 스타일·화자 프로필·대사 종류·그릇·본문 태그·대화 기록 (`4523e90`)
- **qa-game** — 회상 스토리 장르 검사 + @player 이동 오탐 제거 (`f14e5d1`)
- **qa-game** — autoplay grinds day cycles toward affection thresholds (`03f020c`)
- **qa-game** — 꿈 세계 빈 판·보이지 않는 조사 대상 검사 (`5ac512f`)
- **qa-game** — 꿈 세계 탐험 장르 검사 — 반복 맵·효과 외형·깨어나기·저장 (`10e65d8`)
- **player** — 주인공 모습 변경이 시트 안 인물 칸을 지킨다 — 효과로 외형 바꾸기 (`bc8b412`)
- **map** — 가장자리가 반대편으로 이어지는 반복 맵(map.loop) (`3773155`)
- **ai-tools** — set_life_flower — 이브식 꽃잎 체력 한 벌 + 갤러리 검사 (`b7c0ed9`)
- **cutscene** — script_cutscene 로 기억 진입·문 열림·엔딩까지 쓴다 (`1e4ae46`)
- **places** — forest canopy leaf fill — depth-shaded interior (K) (`325f031`)
- **ai-tools** — 추격전이 실제로 쫓고 숨을 수 있게 한다 + qa-game 추격 호러 검사 (`471e9db`)
- **qa-game** — monster-collect genre checks and a partner-first autoplay (`d2e5f43`)
- **qa-game** — 추리 장르 검사 + 모든 엔딩 자동 플레이 (`889e484`)
- **editor** — 왼쪽 사이드바를 탭 하나에 질문 하나로 정리 (`b7d0941`)
- **ai** — author_wild_route builds a monster-collect route with tall-grass encounters (`7d31bb9`)
- **qa-game** — 턴제 JRPG 장르 검사 + 문 발판 경로 오판 수정 (`e78a7a9`)
- match a downloaded tileset pack by its zip hash (`d8e5258`)
- publish five furnished multiroom interiors as shared places (`8f8c195`)
- **qa-game** — name the unused boss troop, list failed gen tool calls in report.html (`9da1402`)
- **ai** — ask before reading environment variable keys (`ae8ac08`)
- **qa-game** — headless map render and self-contained report.html (`893462e`)
- **db** — 자료집 사이드바 — 모든 그룹 펼침 + 빈 탭 접기 (개선안 C) (`ac67c12`)
- **editor** — enlarge place cards on hover and open a detail modal on double-click (`acfe272`)
- **qa-game** — replay recorded tool calls through current tool code and gates (`2c93a28`)
- **qa-game** — headless gen matching the browser 「이 기획으로 시작」 flow, with tool-call recording (`b452d3e`)
- **qa** — model-free game checker — map graph, command schema, progression, auto-playthrough (`3f0e1f5`)
- publish 31 reviewed Tibo interiors and retain curated objects (`adf3915`)
- expose shared LPC assembly objects and region references (`032d940`)
- **places** — fields between villages + desert and autumn climates (`c41d266`)
- **places** — snow and volcano climate villages — two climate chipsets + six places (`33229d8`)
- **launcher** — reuse the previous build when inputs are unchanged (`4fae1d1`)
- 판타지 장소 11곳 — 상점·대장간·성 내부·마왕성·마법사 탑·폐성 (`23a997d`)
- **ai** — mystery confrontations use presentItem — the player picks which evidence to show (`075d1df`)
- **events** — add presentItem command for showing evidence to NPCs (`788bdc2`)
- **ai** — author_mystery_case — 사건 명세를 검사한 뒤 플레이 가능한 추리 게임으로 컴파일 (`4975b43`)
- author named game-over flows and previews in the editor (`29df761`)
- 장르별 패배 귀환과 크레딧 엔딩 흐름을 추가한다 (`95a2112`)
- **editor** — 기본 장소를 프로젝트에 놓고 세계 탭을 바로 연다 (`d88e3f9`)
- **ai** — describe each charset slot from its standing frame (`6ea4fda`)

### 수정

- **ai** — 조수 맵 그림이 커스텀 칩의 2·4층과 투명색을 빠뜨리던 것을 고친다 (`06efc4d`)
- **editor** — 공용 장소 목록 썸네일을 넣고 맵에 놓기를 적용까지 끝낸다 (`a5bec23`)
- **project** — 새 프로젝트 생성 때 같은 문서를 여러 번 읽지 않는다 (`6e8cadf`)
- restore missing place gallery previews (`9259cc9`)
- default new projects and maps to the forest village chipset (`b1a6120`)
- **ai** — 조수 창을 가볍게 두고 쓴 턴과 토큰을 보여 준다 (`a883294`)
- hide capture items in restricted battles and verify medicine quest (`e9be1c2`)
- allow story flag descriptions to update without changing progress (`8daeaf2`)
- **dungeon** — mine west branch starts on the vein-room floor, tower 3F shelves instead of barrels (`c1655cf`)
- expose monster follower graphics to editor AI authoring (`8eb715d`)
- **spatial** — 허용 밖 바닥 재질이 지시 해석을 멈추지 않게 한다 (`5cc8f4e`)
- **map** — 층 옮기기 도우미 타입을 선택 층만으로 좁히고 넓은 --out 삭제를 막는다 (`be9610b`)
- **ai-tools** — place_examine_hotspots id 를 프로젝트 전역에서 고유하게 만든다 (#1441) (`904294b`)
- **events** — validate species references and record ownership runtime QA (`40972f3`)
- **map** — 옛 스프라이트 검사가 선택 층을 건너뛰고 주석을 새 층에 맞춘다 (`a2c4522`)
- **rasak** — 4층 판의 2층 A 장식을 ★ 로 — 막힌 1층이 통행을 정한다 (`08e3239`)
- **battle** — introduce trainer teams distinctly from wild encounters (`1474c89`)
- **collision** — 네 층 통행을 배열 없이 읽고 두 층 읽기를 넷으로 (`b8c2a4b`)
- **map** — 붙여넣기·영역 지우기가 빈 선택 층을 뺀다 (`63264c0`)
- **map** — 크기를 바꾸거나 잘라내는 모든 경로가 2층·4층·그림자를 옮긴다 (`956ea0d`)
- **quests** — resolve battle outcome paths and require manual walkthrough verification (`9fc0827`)
- make quest journal prose readable and keyboard scrollable (`80552b5`)
- **ai** — define_ending 이 연결되지 않은 단일 엔딩을 정의 시점에 경고한다 (`c4002af`)
- **runtime** — 자동 공통 이벤트는 전이 뒤 명령을 이어 실행한다 (`76da96e`)
- **qa-game** — 맨바닥 조사 사물에 보석 표식을 붙이고 꿈 세계 장식 지시를 보탠다 (`b95c486`)
- **tools** — 집 셀 보호가 통째 맵 삭제를 막지 않는다 (`cd9aca0`)
- **ai-tools** — rename_switch 가 DB 스위치 참조까지 치환하고 id 별칭을 받는다 (`9e17c96`)
- **qa** — text 명령의 style·context·container 를 모르는 필드로 세지 않는다 (`42a5d60`)
- **qa-game** — 문 후보 하나가 실패하면 계획 흔적을 goals 와 함께 되돌린다 (`995c4c9`)
- **ai-tools** — author_wild_route 가 기존 transfer 문까지 흙길로 이어 붙인다 (`f8cc8ba`)
- **player** — Scene SHUTDOWN 틈의 카메라 훅이 QA 런을 죽이지 않는다 (`e8cadfb`)
- **village** — 재시공 정리를 스코프 baseline 스냅샷보다 먼저 수행한다 (`47ce41c`)
- **event-tools** — 페이지 animationType 유니온 밖 값을 막아 첫 조작의 씬 사망을 끊는다 (`13656e7`)
- **qa** — 포켓몬 r2 — 이벤트 배치·통로 이동·몬스터 밸런스 세 결함 고침 (`6b2c1de`)
- **village** — 재시공 전 이전 마을 실내를 치워 고아 interior 를 남기지 않는다 (`1345f29`)
- **ai-tools** — create_transfer_pair 을 봉쇄된 문 자리에 두지 않고, 통로 컷신 안내·안전지대 stand 오판을 고친다 (`fb3364a`)
- **editor** — choices 질문 body 를 prompt 로 정규화하고 미술관 요령에 실내 벽 시공을 못박는다 (`06ab082`)
- **qa** — changeItem 장비 id 참조를 오프라인 검사도 커밋 계약과 같은 items∪equipment 로 본다 (`a0dabb4`)
- retain compact digests for detached AI apply authority (`cfc0940`)
- **qa** — 보스 전투 패배를 전투 패배로 보고하고 합류·레벨 전제는 경고로 낮춘다 (`5d4ec02`)
- **map** — 변경 명세가 선택 층의 생김·정리를 전 칸 변경으로 세지 않기 (`b1d23ef`)
- **qa-game** — inputNumber 금고 암호를 자동 플레이 선행으로 풀고 rename to+name 생성·러그 은신처 경고 (`3f9836a`)
- **map** — 저장·검증·원장이 2층·4층·그림자를 보존 (`af2cf06`)
- compress large browser bridge saves with bounded decoding (`de7d8c1`)
- **qa-game** — 자동 플레이 else 재귀가 미정의 page 를 참조해 빌드가 깨지지 않게 한다 (`4e4aad3`)
- **ai** — 장르 도그푸딩 1라운드에서 확인한 도구·자동 플레이 결함 정리 (`5235740`)
- compress large Pi project requests without dropping reference images (`bfb6e40`)
- **db** — 적대 검수에서 확인한 자료집·전투·저장 결함 정리 (`86c7eba`)
- **editor** — visual QA 지적 정리 — 떠 있는 층 하나만, 임시 세션 저장 표시, 768px 톱바 등 (`17786f0`)
- **qa-game** — 깨기 스위치를 끈 뒤 다음 꿈 세계로 다시 나가게 한다 (`3d72bd3`)
- **qa-game** — 깨기 공통 이벤트가 이동 중에 자신을 다시 부르지 않게 한다 (`993718f`)
- **qa-game** — 뒤 페이지가 켜는 만남 스위치를 끄고 호감을 되풀이한다 (`2ccfca4`)
- **qa-game** — 호감 문턱을 요일 문턱보다 먼저 채운다 (`20f97ab`)
- **qa-game** — 선물 제시 속 호감보다 반복되는 대화 상승을 먼저 고른다 (`ee61398`)
- **ai-tools** — 낮은 호감 페이지가 엔딩 문턱 앞의 호감 상승을 덮지 않게 한다 (`93c02ff`)
- **runtime** — 이름 있는 엔딩도 호감 조건을 보고, 출입구가 통로를 막지 않게 한다 (`cbd1623`)
- **player** — 꿈에서 깨는 스위치 아이템이 실제로 방을 돌리게 한다 (`198441f`)
- **ai-tools** — 페이지 없는 기억의 문을 페이지로 만들고, 빈 조사 지점에 표식을 붙인다 (`c81a5df`)
- **ai-tools** — 추격 호러가 암호를 숫자로 받고 스위치 끄기로 숨지 않게 한다 (`800719e`)
- **qa** — 갤러리 문간 인형과 쓸쓸한 엔딩 else 분기를 끝까지 가게 한다 (`56bb3e8`)
- **ai-tools** — 종 적의 빈 행동에 습득 기술을 넣는다 (`edec3d3`)
- **mystery** — 맨땅 추리 무대에는 검증 시나리오를 주지 않는다 (`74fe5b7`)
- **ai-tools** — 통행 불가 전이와 없는 착용 제한이 쓰기를 통째로 거부하지 않게 한다 (`c334c79`)
- **ai-tools** — say when moving the start orphans built maps; keep invented sprite ids from rejecting NPCs (`0dd8384`)
- **ai-tools** — fill_region 이 맵 전체를 한 바닥으로 채우면 빈 판 다음 단계를 알린다 (`d1f32b7`)
- **runtime** — 활성 페이지가 없는 이벤트는 길을 막지 않는다 (`c76ab49`)
- **ai-tools** — author_mystery_case 대사 앞 「이름:」 을 그 줄의 화자로 옮긴다 (`c7a26ce`)
- **ai-tools** — 공포 장르 추격 맵은 조명이 없으면 어둡게 한다 (`c33f068`)
- **ai-tools** — 없는 iconResourceId 로 아이템·장비 저장이 거부되지 않게 한다 (`c3d2294`)
- **ai-tools** — species enemies in monster-party games use the species formula (`8db46dd`)
- **cutscene** — accept text/narrate beats as say in epilogues and script_cutscene (`7a13286`)
- **ai-tools** — inputNumber 의 amount·length 를 digits 로 받는다 (`4bd165d`)
- **qa-game** — autoplay also resets a daily lock written as a fork (`9efdcd0`)
- **editor** — 타일 팔레트 클릭이 시트를 다시 그리지 않게 한다 (`ba90d99`)
- **ai-tools** — love interests are no longer invisible walk-through events (`2fe8b00`)
- **dungeon** — cave passages stay narrower than their rooms; room middles get a standing prop (`2d5b959`)
- **ai-tools** — author_mystery_case 요약이 맨땅 무대를 run_scene_test 보다 먼저 짚는다 (`5b5404f`)
- **player** — 붙잡혀 재시작하면 추격자가 제자리로 — 무한 게임 오버 막기 (`245b21f`)
- **tools** — warn when a blocking event seals a one-tile passage (`cd2ea80`)
- **cutscene** — shake beat 가 명령 형식 오류로 script_cutscene 전체를 거절시키지 않는다 (`c5b107c`)
- **ai-tools** — transfer 의 facing·dir 을 도착 방향 direction 으로 옮긴다 (`b7315a0`)
- **ai-tools** — set_start_position 이 빈 채로 남은 옛 시작 맵을 알린다 (`de06d99`)
- **cutscene** — 컷신이 끝나면 카메라가 주인공에게 돌아오고, camera return 이 카탈로그를 통과한다 (`af2b400`)
- **qa** — 꽃잎 체력 경고를 전투가 있는 게임에는 내지 않는다 (`9bbaeec`)
- **ai-tools** — place_npc 가 home:{x,y} 를, run_scene_test interact 가 to 를 받는다 (`b82de60`)
- **ai-tools** — 추격 맵을 덮는 안전지대와 아무도 켜지 않는 추격 스위치를 알린다 (`384234f`)
- **ai-tools** — 이름 없는 조사 이벤트도 id 로 사물을 알아본다 (`707ec16`)
- **ending** — 에필로그 안의 ending beat 가 에필로그를 무한 반복시키지 않는다 (`ea38d65`)
- **ai-tools** — upsert_event 가 pages 와 함께 온 최상위 commands 를 버리지 않는다 (`1cb2d45`)
- **ai** — a run that died mid-way no longer says "made it, go play" (`eb7e3a5`)
- **ai-tools** — define_monster_species says to define the evolved form first (`7659463`)
- **village** — bend forest band and field-setback treelines instead of painting black rectangles (`1bf23f6`)
- scope AI map water detection to the map tileset (#1322) (`10527e9`)
- remove departed enemy sprites and HUD after battle sequences (#1321) (`ee9d378`)
- **ai-tools** — 기후 세기 생략과 backdrop 검색 id 를 받아 준다 (`05dc498`)
- **ai-tools** — place_examine_hotspots 가 빈 바닥 위 투명 조사 지점을 알린다 (`05c3d0a`)
- **player** — 반복 맵 걸음이 발자국 width/height 를 읽는다 (main tsc 복구) (`3efbaca`)
- **tools** — 오프닝 서술의 글자 그대로 \\n 을 줄바꿈으로 바꾼다 (`ea2654b`)
- **qa** — 인카운터 소모전 전멸은 경고로, 자동 플레이는 동료를 모두 데려간다 (`351d078`)
- **ai-tools** — 그림 없는 이벤트 페이지가 보이지 않는 벽이 되지 않게 (`ae454f7`)
- **ai-tools** — 다른 방 옷장도 은신처로, 치명적 추격은 기본 진입 체크포인트 (`307205b`)
- **editor** — a slow status poll mid-run no longer shows AI as off (`bd48a7d`)
- **qa-game** — load-normalized ignores defaults the loader only filled in (`93ab7dd`)
- **pi** — a genre preset brief never becomes a one-village contract (`37aca5f`)
- **tools** — set_title_screen 이 없는 배경·음악 id 를 호출 시점에 짚는다 (`f09f82d`)
- **ai** — 거부된 발행 하나가 뒤의 모든 체크포인트를 막지 않게 한다 (`ada86a8`)
- **ai** — 저장 금지 맵의 저장 메뉴를 경고하고, 반복 맵·외형 변화 기획에 도구 경로를 안내한다 (`e299047`)
- **ai-tools** — set_life_flower 의 화면 효과 값이 적용 검증을 통과하게 한다 (`4aff5e3`)
- **tools** — run_scene_test 가 한 겹 감싼 expect 스텝을 펼쳐 실행한다 (`7792a1c`)
- **ai-tools** — build_wall 의 패턴 없는 벽 오류가 갈 길을 짚는다 (`19e5bb5`)
- **ai-tools** — setVariable 의 amount 를 value 로 받는다 (`80d1838`)
- **scene-test** — 조사로 선 자동 컷신을 돌리고, 잠긴 기억 맵까지 자동 플레이한다 (`ff62bdf`)
- **monster-collect** — build the gym with the dungeon room pipeline, and flag a bare gym map (`e0452c4`)
- **interior** — interiors follow the owner's trade, twin bedrooms differ, seed mirrors the plan (`493d4b7`)
- **ai-tools** — 근접 유사 NPC 재사용이 문·문 앞 발판을 덮어쓰지 않는다 (`557c2db`)
- **pi** — 생각만 흘리고 답이 없는 제공자 응답도 이어 가기로 재시도한다 (`6f812b2`)
- **ai-tools** — 켜는 곳이 뒤 페이지도 함께 열어 가려지는 페이지를 알린다 (`eadb5ae`)
- **ai-tools** — 없는 전투 애니메이션 id 는 비우고 후보와 함께 경고 (`a0749eb`)
- **villages** — farm plots get the farmland 3×3 edges instead of 188 everywhere (`0ea416d`)
- **tools** — create_transfer_pair moves a door the player cannot walk to (`388ceeb`)
- **qa-game** — 자동 플레이가 잠긴 문의 선행 조건을 사슬에 넣는다 (`8f794d5`)
- **tools** — 면 채우기가 아닌 재료는 역할에 맞는 도구를 짚는다 (`c76e4ed`)
- **ai** — a lighthouse brief gets a lighthouse — village landmark + single-room beacon (`087f1b0`)
- **ai-tools** — warn when a gift choice spends an item nobody checked for (`93d4430`)
- **player** — 깨운 추격자가 달려오고, 헤드리스 러너도 숨기·추적 정책을 안다 (`f00fade`)
- **ai-tools** — 트룹 밸런스 경고가 「이길 수 없음」 쪽도 알린다 (`c59f34a`)
- **ai-tools** — restore tsc on eventTools (`009b8cc`)
- **testing** — headless battles use a damaging skill when gen1 refuses the attack (`aa2f826`)
- **ai-tools** — 짧은 곡선이 초반에도 자라게 + qa-game 전멸·못 이기는 보스 검사 (`1c629a1`)
- **ai-tools** — 조사할 사물에 주민 그림을 세우지 않고, place_npc 의 최상위 commands 를 살린다 (`8fbc811`)
- initialize captured monster experience at its level floor (`1e19533`)
- **player** — 「내레이션」 화자는 이름표 없이 서술로 보인다 (`fb40019`)
- **ai-tools** — accept a fork written with page-style conditions (`7454f99`)
- **ai** — JRPG 마법사 — 레시피 이름 제목, 저작 요령, 합류 파티 모의전 (`64b0456`)
- **mystery** — 맨땅 무대에 사건을 쓰면 실내를 지을 도구를 짚는다 (`cf9c070`)
- **editor** — 미리 만들어 둔 자료집 창이 조수 패널을 숨기지 않게 한다 (`9b41377`)
- **mystery** — 물건 이름의 지목 NPC 를 사람 외형·얼굴로 그리지 않는다 (`97803b2`)
- allow unrestricted medicine for monster battle parties (`6425e75`)
- **player** — monster-party games fight with monsters headlessly and skip wild rolls without a partner (`c23fc27`)
- **ai-tools** — a character keeps one look across edits and maps (`1818552`)
- **ai-tools** — 선택지 보기 목록을 choices 로 쓰면 options 로 옮긴다 (`bcdea77`)
- **ai-tools** — 타일 가구·문 조사 지점에 주민 그림을 세우지 않는다 (`9e1c4b9`)
- **battle** — a capture item is thrown by its captureProfile, not its item type (`64eb384`)
- **tools** — fill_region 이 실내 나무 바닥·돌바닥·카펫을 채운다 (`961d30a`)
- **interior** — place_concept 가 create_map 빈 맵의 배경음·기후를 버리지 않는다 (`827ee87`)
- **new-project** — 오프닝이 기획 설명을 옮겨 적어 범인을 누설하지 않게 한다 (`a89af19`)
- **ai** — configure_monster_system keeps the battle party when battleParty is omitted (`17c93b5`)
- **ai-tools** — upsert_event 가 text 본문 별칭과 새 스위치·변수 id 를 받는다 (`9cbcc0d`)
- **ai** — the Pi client watchdog waits while the page is applying a checkpoint (`7f9b718`)
- **pi** — 제공자 스트림이 도중에 끊겨도 실행을 이어 간다 (`9d4b75a`)
- **ai** — 적용 검증 거부가 조수 실행 전체를 죽이지 않게 한다 (`ffea625`)
- **editor** — restore tsc after the pack-catalog merge (`00756d7`)
- **ai-auth** — 요청 키는 만료 15분 전부터 미리 갱신한다 (`b606098`)
- **ai-tools** — 짧은 능력치 곡선을 말없이 버리지 않는다 (`424025a`)
- **qa-game** — render composes tileset grafts like the editor atlas (`160e86d`)
- **editor** — keep library search fields alive while typing Korean (`f0f2032`)
- **ai-tools** — 무기점·방어구점이 실제 장비를 팔 수 있게 한다 (`5975e08`)
- **ai** — compact the 「더 다듬을 곳」 list — repeated findings become one line (`9be588d`)
- **editor** — preload the database window before it is opened (`419104d`)
- **qa-game** — replay 가 지금 스키마로 통과하는 옛 인자 거절 호출을 다시 돌린다 (`c787571`)
- **tools** — 이름과 appearanceTags 가 함께 가리키는 몬스터 외형을 고른다 (`c7bd170`)
- **tools** — read_tileset_reference 가 없는 ID 에 고를 수 있는 ID 를 함께 말한다 (`51259c3`)
- **pi** — set_build_spec 밑그림은 경계·교차를 경고로 돌려주고 plannedMap 을 선언한다 (`c1f7f62`)
- **tools** — rename_switch 가 switchId+name 으로 표시 이름을 바꾼다 (`c4e8f10`)
- **pi** — 실패한 도구 요약에 실제 오류 문구를 싣는다 (`bb77992`)
- **qa-game** — 헤드리스 gen 이 show_map_region 이미지를 pngjs 렌더러로 그린다 (`df070b8`)
- **tools** — battleProcessing 의 선택지 모양 결과 분기를 victoryBranch 로 옮긴다 (`85f08d8`)
- **ai** — declare kind-specific reference fields in the command schema (`f658141`)
- **mystery** — 통로를 막는 사건 인물과 시작 맵 밖 도달성을 검사한다 (`a25c7e3`)
- **ai** — a generated boss is a real threat to the start party by default (`680cb7c`)
- **editor** — give the place hover preview an opaque card (`29bf917`)
- **interior** — stairs against a wall, no stray ladder, windows only outside (`cda57bd`)
- **player** — 타일 크기가 다른 맵 사이에서 시야와 캐릭터 크기를 유지한다 (`d74d200`)
- **editor** — stop the place hover preview from chasing the cursor (`b625ca9`)
- **assets** — drop the fake hero-02 walking sheet (`086ddca`)
- **tools** — scene interact extras name walk/face; exact find_tools ignores domain (`61af5af`)
- **ai** — import companionToken in chatgptOAuthClient (`1cd0c22`)
- **interior** — one rectangular shell and a continuous north wall per house (`bdc2f43`)
- **player** — debug teleport moves the player like a real transfer (`71b1dbf`)
- **tools** — exact-name find_tools returns only that tool; empty list_resources browses (`2c15454`)
- **interior** — paint the cabinet base over the floor, not in place of it (`2d25d70`)
- **events** — charset textureKey tolerates resource-id spelling (`9ecca43`)
- **interior** — a concept plan builds without a concept bundle (`fb02391`)
- inspect project common events in game check (`9c2306e`)
- stop cloning tileset reference documents on every edit (`ea08737`)
- return undefined explicitly for missing shared content (`772cf26`)
- **assets** — lock charset sprites to the tile center (`22c6e4f`)
- allow newly bundled profiles when verifying example import (`7c7778d`)
- **events** — battleProcessing takes a lone troop alias and fills default flags (`0bebd82`)
- restore persisted sprite rendering and add Saesol editor adventure (`1f11eef`)
- load shared place libraries in deployed web projects (`d71d285`)
- **ai** — tileset reference reading gates only tools that hand-pick tiles (`455c805`)
- **editor** — open database map lists from small thumbnails (`38b9a69`)
- 도구·타일 선택마다 맵 타일과 썸네일을 다시 만들지 않는다 (`55bc020`)
- **editor** — show only three genres when a project starts (`9acf971`)
- **editor** — keep tile undo on one step and one set of sprites (`c59fff8`)
- close the type holes left by #1119, #1130, and #1179 (`20c2915`)
- **places** — install a reviewed place when spatial authoring is off (`a9b587b`)
- **places** — no thin roots dangling from forest steps (`4e8e44b`)
- **editor** — keep tile and object library sidebars scrolled in place (`e6475df`)
- drop unused grass-join and interior fork tilesets from the tile list (`eee0fff`)
- **ai,village** — a snowy brief builds a snow village whose battles use the snow backdrop (`d2b0007`)
- **ai,battle** — companion changeParty written with speciesId no longer puts null in the party (`cb7f372`)
- **ai** — Pi guard follows bundle merge — parallel plain turns reject off-bundle map writes, new off-bundle maps warn (`b2464f2`)
- **dev** — give checkouts with a shared node_modules their own vite cache (`af410dc`)
- **maps** — village renames a placeholder map; room pipelines adopt a create_map blank map (`49bc898`)
- **ai** — keep choice branches sent as `branch`; warn on dead choices, unset switch gates, uncalled endings (`4041b8c`)
- **auth** — /auth/status refreshes an expired-but-refreshable login (`6bba313`)
- **build:player** — keep editor-only tileset reference docs out of player artifacts (`419c46d`)
- **build** — clear the six game-over type errors that broke npm run build (`ea9df08`)
- **places** — whole tree trunks under every forest edge (`a10342f`)
- **ai** — upsert_enemy checks only the first troop containing the enemy (`c9555a4`)
- **battle,opening** — snowy maps fight on the snow backdrop; brief replaces stock opening (`e70e94b`)
- **ai** — upsert_troop/upsert_enemy report a troop that can never hurt the start party (`2c12da4`)
- **events** — authored events replace auto furniture inspects on the same tile (`18b1dbe`)
- **cutscene** — ending epilogue faces follow the speaker (`3488ebf`)
- **ai** — new dungeon pipelines ask for the dungeon chipset references only (`183dd05`)
- **ai** — render multi-page events at their game-start page instead of refusing (`2f11cd1`)
- **ai** — let run_scene_test see the battle party so join fixes can be verified (`984dd74`)
- **events** — canonicalize changeParty op/action drift instead of silently removing (`c0b3ffd`)
- **editor** — break Korean at word boundaries in the interview and assistant chat (`b5f05f2`)
- **editor** — keep inspection pictures and the raw change tally out of the brief assistant view (`2cfaf9d`)
- **editor** — stop revoking activity image blob URLs before the image loads (`9b6529b`)
- **editor** — carry the new-project wizard name into the game title screen (`f576373`)
- **host** — decode percent-encoded static paths so bundled BGM with spaces loads (`2ce9f19`)
- **host** — mirror assistant/edit activity logs on the shared host for the owner (`64bc4eb`)
- resolve tile detail queries against the target map (`e979328`)
- deliver current map images to editor assistants (`8e73eee`)
- **ai** — remote Codex login uses the device code; note agy paste is once per server (`50f72f0`)
- scope map terrain summaries to the active tileset (`9804b60`)
- let editor assistants read plans and use current tile contracts (`ffa5492`)
- **editor** — load bundled chipsets the project starts using after boot (`98ba639`)
- **assistant** — show first-time users their own words, plain progress and what was made (`29f3d26`)
- first-impression polish — boot loader, plain-language labels, collapsed debug icon (`18c000b`)
- **ai-auth** — one account name, no raw login URL, 10-minute wait with timeout (`b663d76`)
- **ai** — Pi map-bundle runs reject writes that change maps outside the bundle at call time (`90be535`)
- **ai** — mystery case rejects start-cell/unreachable placements and bundles a verification scene (`20f767f`)
- **pi** — carry newly enabled time system, grove autotile group and cast world entries through map-bundle merge (`c19e741`)
- **ai** — stop tools from silently dropping event work the runtime never runs (`a69f6ff`)
- 게임 오버를 독립된 종료 장면으로 구성하고 후속 실행을 차단한다 (`ae1a8d4`)
- **runtime** — 파노라마를 RM2K 방식으로 — 창 타일에서만 보인다 (`52caca3`)

### 성능

- **editor** — lazy-load region reference snapshots out of the main bundle (`4b09800`)
- **editor** — stop tile-paint strokes from stalling on audit, palette and export work (`5aa92a2`)
- **ai** — halve main-thread freeze when an agent checkpoint is applied (`46bc2e0`)
- **editor** — drop full depth sort and sleep off-screen tile chunks (`c5da5ad`)

### 문서

- verify earned league ending and persisted campaign title (`ad7346b`)
- verify editor-authored journey guidance and earned league school progress (`2287a37`)
- verify earned peaceful forest restoration route (`07faad9`)
- verify editor description persistence and earned fog rescue (`90fef3a`)
- verify earned temple and fourth badge progression (`2b33cb7`)
- verify campsite guidance and earned mountain progression (`29e13c9`)
- record editor-authored campsite quest and verified play flow (`01be16b`)
- verify six-species collection and persisted capture advice (`57664f2`)
- verify persisted cave deduction quest and earned monster captures (`e097617`)
- verify earned dex registration and persist dialogue corrections (`f167e8d`)
- record persisted Saesol ecology dex and verification limits (`33a294f`)
- record design-only dex response and corrective editor request (`b81aa5c`)
- record ownership deployment and editor dex authoring start (`43b0679`)
- **map** — 2층·4층·그림자 스키마·편집·게임 화면 규칙을 위키에 싣는다 (`8124875`)
- verify second-badge progression and summarize remaining authoring gaps (`1718d10`)
- verify rival sprite fixes and four real battle victories (`782c0b5`)
- persist rival arc revision 535 and record asset and dialogue defects (`2ba56c0`)
- record editor AI send delay and project allocation evidence (`dd825e2`)
- distinguish unsent rival request after editor renderer OOM (`92d2057`)
- verify ten Saesol quest journals in canonical revision 534 (`051be8f`)
- record fog rescue quest save and walking verification (`7dba685`)
- record playable league school and canonical revision 530 evidence (`ad6eee3`)
- add canonical revision 528 battle data evidence (`f4b9583`)
- record league school data save and authoring transport failures (`18c75a9`)
- verify restored ecology page and qualify hint regression (`d841f4e`)
- verify forest restoration branches and expose AI scope regression (`b16a277`)
- record saved forest restoration quest and remaining QA (`5c04758`)
- verify polished clue NPCs in the dedicated player (`bf32a0b`)
- verify saved NPC polish and retain post-save OOM limitation (`29d8e2e`)
- distinguish received AI draft from failed OOM application (`0ab5af6`)
- correct duplicate main module introduced by decoder rollout (`cf9d624`)
- record stale deployed decoder and versioned rollout (`706d4a9`)
- identify renderer OOM during editor AI event polishing (`815208b`)
- record Chromium save response and renderer crash evidence (`f916be7`)
- distinguish post-compression network aborts from save payload limits (`3592e11`)
- record bounded gzip bridge deployment and wire validation (`1e08ae2`)
- record oversized save fallback after shared catalog growth (`baf986a`)
- audit completed campaign segments and remaining duration gap (`ab9060e`)
- verify saved clue visibility and record remaining visual mismatches (`5629199`)
- verify medicine accusation and victory branches with QA limits (`cb0f701`)
- 맵 칸 4층 + 그림자(MZ식) 설계와 PR ① 구현 계획 (`88b3f08`)
- record saved medicine mystery and visibility authoring issues (`7836555`)
- verify rescue completion using type advantage and qualify battle-state retries (`01b2ebb`)
- record draft loss and distinguish capture and battle QA failures (`29cf38a`)
- distinguish completed harbor walk artifacts from interrupted QA teardown (`fe40da9`)
- verify harbor path refinement and audit campaign duration evidence (`7a12b32`)
- verify harbor reconstruction and actual portal walking (`0b17bdf`)
- verify compressed AI authoring and saved merchant sprite correction (`af48a58`)
- record separate companion request size failure after save recovery (`282547b`)
- verify autosave recovery with canonical revision 506 (`d55ccec`)
- diagnose Saesol autosave payload overflow and deploy compact transport (`57e1bc5`)
- verify partial NPC color changes and record apply crash (`74360ba`)
- verify optional team victories and fresh badge save reload (`d063434`)
- record optional team defeat recovery and strategy retry (`ae4225d`)
- record optional forest teams and fresh two-badge ecology run (`0369915`)
- verify persisted forest polish and start fresh ecology route QA (`0b5dbd8`)
- verify persisted ecology gym gate and earned badge progression (`a53d35f`)
- verify saved doorway fix and actual building round trips (`d889716`)
- record browser recovery and retry of isolated doorway fix (`10ed68c`)
- record doorway apply crash without canonical persistence (`09db51b`)
- distinguish adjacent reachability from doorway entry checks (`b4f0520`)
- record town art persistence and reproduce blocked building doors (`8722119`)
- verify persisted forest art and all walking approaches (`ca8f058`)
- audit map content density and prioritize unfinished town art (`321256a`)
- verify actual save reload and investigate paint publication stalls (`814ed1c`)
- distinguish reconnect catalog updates from forest authoring (`fab8cbf`)
- record partial forest paint and stream timing investigation (`121b3b4`)
- verify ecology report reward and missing-clue guidance (`ea587e2`)
- verify leaf observation persistence and walking interaction (`264997a`)
- verify feather clue first and summarize remaining authoring failures (`1c7d8dc`)
- verify first forest clue and record missing visual marker (`15499c4`)
- verify forest researcher acceptance and repeat dialogue by walking (`db29002`)
- record researcher event persistence and acceptance QA correction (`ee1e104`)
- record thinking-loop failure and isolated researcher event request (`f6e8919`)
- record forest base reload and observation event authoring start (`fbc0595`)
- record saved strict battle flow correction for forest teams (`2a5eee8`)
- distinguish intent timeout and resume through editor pi command (`a1c1b38`)
- distinguish initialized flags from progress changes during forest authoring (`6100c7e`)
- audit forest authoring scope and baseline walking evidence (`e40ecde`)
- connect fresh walking progression through champion and ending (`f58016e`)
- verify corrected trainer sprite in fresh game (`497ba32`)
- record four Elite Four walking victories and resolved player sprite (`69fa63a`)
- record forest heartbeat interruption and QA skill selection correction (`ae2cd37`)
- record fresh walking victories over first two Elite Four (`69844b7`)
- record saved league rework and forest quest authoring request (`53d2582`)
- refresh Saesol issue index and walking evidence guide (`4de3c53`)
- record fresh walking capture and league supplies (`2c14dab`)
- identify checkpoint size and observation overhead (`b08831a`)
- **openwiki** — how the assistant learns a tileset, with guard tests (`ba138ce`)
- record walking through fourth badge and wrong player leader (#1347) (`36aa462`)
- record renderer recovery and fresh mountain progression (#1339) (`7af3230`)
- record walking through rescue lighthouse and third badge (#1334) (`b42b5c1`)
- record fresh two-badge walking and league visual rework (#1324) (`9fb246b`)
- record champion ending and twenty-map walking verification (#1323) (`482fdd7`)
- record region four walking checks and league authoring recovery (#1305) (`7458972`)
- record league preparation and editor responsiveness findings (`81e73a8`)
- record fourth badge and league entrance verification (`11d2754`)
- record temple progression and turn-based authoring regression (`a142e58`)
- record third-badge authoring checks and progression defects (`7471e1c`)
- record Saesol editor AI authoring findings and remaining work (`633f525`)
- **openwiki** — 파노라마 창 계약을 기록한다 (`6e525f3`)

### 테스트

- **qa** — Rasak 합성·4층 판을 게임 화면에서 같은 프레임으로 비교하는 시나리오 (`a53b621`)
- **map** — 새 층 저장 왕복·되돌리기·옛 맵 불변·크기 경로를 고정 (`130b2da`)
- **collision** — tileAt 비교를 toMatchObject 로 — layers 필드 추가 대응 (`87a2edc`)
- **player** — a generated cave encounter table fires within 30 steps (`9dd294e`)
- regressions for the lighthouse JRPG dogfood authoring defects (`3e4a147`)
- **editor** — pin keep-all on the Korean interview and chat surfaces (`6fd6116`)
- **qa** — 절벽 + 구름 파노라마 증거를 남긴다 (`db55d57`)
- fill upperTileLayer in large-map window mock after rebase (`4686c06`)

### 잡무

- **dungeon** — exports and browser proof regenerated on the latest main (`a9c5ad9`)
- **villages** — verify-shots crops for the village fixes (17x13 at 2x) (`f507b84`)
- **qa-game** — add the harbor dating-sim brief (`52e0706`)
- **qa-game** — 꿈 세계 탐험 기획서 (`310b498`)
- **places** — a check that finds thin roots and stray trunks under forest canopies (`50b59f1`)

### 기타

- **villages** — harbor kit sheet 30 tiles wide (app slicing), dead saplings only by the ruin wall; full regeneration (`6ea8fa7`)
- **villages** — kit pieces one cell apart stay owned, market board and church lamps kept, grass in landmark yards, gate asserted; full regeneration (`7f269ca`)
- **villages** — docs — fullness rules, READMEs, openwiki for rev 14, harbor kit and the harbor town (`78db2ca`)
- **villages** — climate villages v5 — E/F/G grass, grouped scenes, no flowers in snow/ash/sand, snowy bushes for broadleaf, frozen river in snow chapel-hill (`c5553fb`)
- **villages** — diverse rev 14 regenerated with the harbor town — references, regions, places, snapshots (`1c9cf78`)
- **villages** — E/F/G tall grass in the gap fill, lone bushes and roadside benches go, pools without spurs, harbor town filled (`e508708`)
- **villages** — author the large harbor town 너울목 (80×64, four districts, loop, pier) and --add to the fill (`224d6c1`)
- **villages** — harbor kit (rowboats, mooring posts, gear) grafted and placed at the reed-bay pier (`b87ed80`)
- **villages** — drop crest, irregular pools, prune unowned props, natural fill without old tall grass (`39c834b`)
- **villages** — climate villages pass emptiness gate (v5, regions rev 5) (`477c9d9`)
- **villages** — ragged tall-grass patches, tight flower groups (diverse rev 14 regenerated) (`bf402fa`)
- **villages** — diverse villages pass emptiness gate (rev 14) (`ff3e9ae`)
- **villages** — fullness B scripts (`77c681e`)
- **places** — in-app proof and grid shots for the reworked interiors (`022f786`)
- **places** — interiors rework — app renders, references, place snapshots regenerated (23 maps) (`4a6bc4c`)
- **places** — interiors rework — real partition walls, tabletop items on tables, floor stairs, castle 1F 50x40 (`5092897`)
- **places** — second fill pass on sparse interiors (`45ce784`)
- **places** — fill interiors to the emptiness gate (maxSq<=3, screen<=30%) (`4aba21f`)

## 0.8.0 — 2026-09-23

### 기능

- simplify DB monster tabs by editor mode and section tabs (`f4b875f`)
- 맵 자료집 다섯 탭의 정보량을 줄인다 (`2d4de44`)
- 컨셉 마을 3종 — 교회 언덕·여울성·안개못 폐촌 (창문 개정10) (#1169) (`0391adb`)
- trim the party database tabs for beginners (`21b02bd`)
- add a two-waterfall river village to the shared forest villages (#1166) (`43a35bc`)
- 숲마을 세 곳 — 절벽 높이·검은 문·목적 있는 소품 (개정8) (#1165) (`ccba01c`)
- furnish village commons gardens and market with purposeful props (#1162) (`91e2d51`)
- add winding village cliffs, clustered forests and connected entrances (#1159) (`c75cafa`)
- add diverse village regions and bundled assembly references (#1155) (`5ecd410`)
- publish executable Dewbank village assembly references (#1154) (`3cf251c`)
- **opening** — resume finite still production after provider quota reset (#1152) (`dcdea32`)
- add preset-specific new project interviews and saved game briefs (`147f10b`)
- **editor** — group database tiles by art style (`cb7d1f4`)
- **opening** — 새 프로젝트 인터뷰와 검증된 오프닝 이미지 팩 (#1126) (`10d8917`)
- **editor** — 던전을 요청의 장소로 짓고 출입구·표지·순찰을 남긴다 (`32cdcc0`)
- let the AI draft and continue the world canon body (`e042861`)
- **editor** — AI 미연결이면 채팅 영역을 잠금 막으로 덮는다 (#1132) (`4d4c7a0`)
- remove the world canon spread head (`d0ca66a`)
- replace the world settings form with an AI interview surface (`dcebd79`)
- **editor** — AI 연결 상태를 톱바에 상시 보여 준다 (#1127) (`5d1eb68`)
- compact world canon head into a help icon and flatten settings into a plain form (`83e873d`)
- open world canon on the body canvas with settings and AI-delivery tabs (`789d81e`)
- **ai** — stage sound and animation before impact lines (`d57bd98`)
- split world canon one-pager into document and AI-delivery tabs (`1a9ad62`)
- record atlas pixel size on kits, snapshots, terrain and kit files (#1105) (`165bfaa`)
- **editor** — 프로젝트 기본 카메라 배율(system.cameraZoom) (#1100) (`3dff6f6`)
- add LPC Wooden Furniture tilesets and 39 shared furniture objects (`f4571e2`)
- make public tile references executable and validate assembly errors [skip ci] (#1097) (`e5d34ca`)
- make public tile references executable and validate assembly errors [skip ci] (#1098) (`d343f16`)
- rebuild world canon tab as a document-first spread view (`2d71b84`)
- add executable tile assembly guides and coordinate validation (`294e481`)
- **editor** — 다층 맵 배경과 고해상도 배경 맞추기 (#1089) (`567eb79`)

### 수정

- render place thumbnails for rooms captured from painted maps (`0a5b751`)
- 타일 탭 위쪽의 중복 시트 띠를 뺀다 (`06f7c22`)
- send the companion token on assistant, agent and image requests (`9449e9a`)
- host-disabled AI is a server response, not unreachable (`a7dba6f`)
- unblock first run on the personal launcher (`274aecd`)
- keep autosave under the 64MB host body limit (#1163) (`0b9219e`)
- place village props by authored activities and real anchors (#1161) (`05d918f`)
- organize village props into owned household yards (#1160) (`ef701e3`)
- match village grass edges to the existing floor (#1158) (`b0e4e2c`)
- **ai** — 조수 대기 화면 설정을 걷는다 (#1157) (`0d244d8`)
- rebuild village cliffs using the great-falls assembly (#1156) (`b48186a`)
- **opening** — remove key footer and expose reviewed scene descriptions (#1151) (`8b5586c`)
- retain interview step label and complete browser image captures (`2eccb1b`)
- **ai** — support picture resource searches (`1425397`)
- **editor** — 잘린 아이템 아이콘을 다시 맞추고 헤더에서 바로 고르게 한다 (`c9c4781`)
- restore place previews across gallery and picker renders (`884fb65`)
- **ai** — 원격 Google 로그인 콜백을 편집기가 받는다 (`1a4bcb1`)
- **editor** — 자료집 닫기와 X는 편집을 남기고 창을 닫는다 (`86dbc25`)
- **editor** — 맵 확대 하한을 0.25배까지 내린다 (`c9797b6`)
- **editor** — 로그인 후 잠금 막이 스스로 걷힌다 — 남은 한 단계 제거 (#1137) (`8d9c856`)
- **editor** — 장소 탭을 열 때 맵 원본을 읽지 않는다 (`031cc75`)
- **ai** — 맵 BGM을 곡 설명을 보고 고른다 (`c2f7f7b`)
- **ai** — 조수 작업 중 맵 전체 재렌더와 체크포인트 대기를 줄인다 (#1130) (`6376a79`)
- **editor** — 첫 실행의 로그인 벽을 없애고 AI 연결 안내를 먼저 보여 준다 (#1129) (`c192bbe`)
- mount the law dialog inside the DB modal and drop the world canon kicker (`e5e4fee`)
- **editor** — 첫 방문 브리핑이 AI 없이 '만들기' 를 받고 조용히 멈추던 것을 고친다 (#1124) (`130d0b4`)
- **editor** — stop seeding builtin room-kind cards into the places gallery (`8f353f7`)
- **player** — skip catalog monster sprites when opening test play (`786a24c`)
- replay host, test-play, and tile-paint fixes onto current main (`a725eb9`)
- **host** — keep internal access codes opt-in on 0.0.0.0 (`bca9db3`)
- **editor** — size incremental ghost tiles with the map tile size (`3ea092f`)
- **ai** — keep tile painting off the full-project lint path (#1109) (`dd83bfb`)
- **editor** — clear ghost sweep when discarding overlay (`b1119e9`)
- **ai** — keep tile painting off the full-project lint path (`f8950c3`)
- **player** — open test play without preloading the whole asset catalog (`27217ba`)
- close host and draft holes after the SQLite cutover (#1102) (`9ca7254`)
- **ai** — load searched material previews from the file id (`9157043`)
- **editor** — 맵 설정 BGM 피커 CSS 지연 로드 회귀를 고치고 중요 섹션을 상단으로 (`b3d1f4a`)
- reveal lazy guide images before capture and record live proof (`e243c29`)
- **build** — declare VITE_BGM_CDN_BASE on ImportMetaEnv (#1090) (`dcf1bb4`)

### 성능

- cut assistant write/decode cost and tighten assistant UI (`bd31fe0`)
- 무거운 프로젝트 로드에서 JSON을 반복 복사하지 않는다 (`7579b92`)
- **editor** — 쓰지 않는 16px 타일 창 헬퍼를 빼 둔다 (`ecfcde0`)
- **editor** — 큰 맵은 보이는 타일만 만들고 AI 스트리밍이 레이아웃을 매 프레임 재지 않게 한다 (`ed5fcb5`)
- **boot** — 타일셋 존재 확인을 생성자보다 먼저 해 프로젝트 로드에서 164ms→26ms (#1103) (`8829a0d`)
- shrink shipped castle study images and record the bundle-owned rule (`cc33c52`)

### 문서

- first-run guide reflects the launcher and lock fixes (`5dce6db`)
- add a first-run guide for non-developers and drop stray Qoder installer (`1155281`)
- 던전 생성 결과 보고서를 남긴다 (`0f8f73f`)
- picture-card questions before a broad or empty game request (`263323e`)
- **release** — 윈도우 zip 을 리눅스에서 빌드·검증하는 절차를 기록한다 (#1094) (`5624500`)

### 되돌림

- return main to the tree after #1104 (`fc9c6dc`)

### 기타

- 지역 탭 더미 카탈로그 제거 · 장소형 목록 UI (#1091) (`1336c95`)
- Codex worktree snapshot: startup-cleanup (`f1c0d01`)

## 0.7.0 — 2026-09-22

### 기능

- **editor** — 장소 탭을 라이브러리 우선으로 재설계 (#1082) (`c1b5884`)
- publish approved river forest village as a shared region (`c02adef`)
- 숲마을 공용 장소·소품과 타일 AI 참고문서 등록 [skip ci] (`244d180`)
- generate continuous forest contours with domain-warped fields (`ee44369`)
- register castle courtyard harbor and stone lodge as shared places (`f858763`)
- shape winding village forests and add everyday prop clusters (`d498ba2`)
- **places** — restore preferred castle entrance and publish shared fortress (`8d2c224`)
- restore river village defaults with connected forest groves (`5f20b7d`)
- AI assistant work surfaces lean UI + layer reveal (`7ee912c`)
- assemble village groves like the winding cliff forest (`8c53f63`)
- add tileset reference library and retire legacy tile UI (`0d86819`)
- default AI outdoor authoring to forest harmony (`287c074`)
- support 48px tiles and automatic character scaling (`cc3a2fc`)
- restore AI tile construction previews with drafting motion (`9296466`)
- pokemon 데모에 레벨 기술 테이블·상점·야생 트룑을 채운다 (#1059) (`c766129`)
- **maps** — develop castle exterior rest area and landscape transitions (`9314dd5`)
- support 32px tilesets and preserve Slates authoring guides (`5e5f45e`)
- **maps** — improve castle paving borders and contextual prop density (`5deaf88`)
- **tiles** — bundle castle atlas and preserve reference study with visual audit (`e68a81a`)
- archive forest tile rules and ten authored village references [skip ci] (`d3e14c6`)
- publish thirteen forest maps as shared places [skip ci] (`e8f95a8`)
- 아이템·장비 아이콘 220종을 16비트 픽셀아트로 재생성 (`58823e6`)
- preview creation choices in the expanded assistant workspace (#1049) (`e7be965`)
- share decorated forest villages and reviewed props [skip ci] (`dd25c64`)
- **assets** — bundle OGA greggman backdrops as catalog resources (#1046) (`085ed7d`)
- 조수 작업을 실제 이미지와 변경 전후로 표시 (#1045) (`012159b`)
- **hud** — 장르별 프리셋과 한글 서체·수집형 메뉴 추가 (`58cc848`)
- **hud** — 데이터 연결과 배치를 저작하는 인게임 HUD 구성 편집기 (`d52e63f`)
- 환경 효과·환경음 프리셋 30종과 편집기 추가 (#1039) (`b98c6c9`)
- **editor** — 웹 검색이 화면에서 한국어로 보이고, 기다리는 이유를 말한다 (`27c9f51`)
- finalize sixteen editor and runtime features with QA evidence (`3a818f2`)
- **ai** — 참조 작품을 지목하면 조수가 스스로 검색하고 설계한다 (`51918e1`)
- 조수를 대화 중심 작업창으로 재구성 (#1037) (`ede83ca`)
- improve weather visuals and add rain and thunder audio (#1036) (`0405834`)
- implement sixteen engine authoring and player features (`84b57f6`)
- **ai** — 조수에게 웹 검색 도구를 준다 (`7835b0d`)
- expose assistant activity levels and expand chat with team (#1032) (`bdeca53`)
- **editor** — 우클릭으로 AI 이벤트 작성 + 세계관 2만자·맵 읽기 툴 (#1030) (`759975b`)
- route event command editing through the shared assistant (`9143492`)
- **ai** — add hybrid editor tool exposure (`702e195`)

### 수정

- **electron** — 패키징 앱이 시작하지 못하던 것과 출하 번들 유출을 고친다 (#1088) (`8016d50`)
- **player** — keep castle AI study JSON out of the release collector (#1087) (`870ccaf`)
- 공용 숲마을 타일의 AI 참고문서 누락 보완 [skip ci] (#1085) (`a282997`)
- **player** — keep castle AI study JSON out of the export-player bundle (#1086) (`fbc4a6c`)
- include castle AI study in every new project (`aa4cf40`)
- store castle study documents and images in tileset AI references (`ab75f0d`)
- restore original grove trunks along curved forest boundaries (`cdfd359`)
- **event-editor** — 명령 툴바가 둘째 줄로 접히던 것을 한 줄로 되돌린다 (`65f3b7b`)
- run independent assistant tools in parallel (`97980ef`)
- **tileset** — fill required TileAiMetadata description on grove canopy (#1068) (`8112368`)
- **battle** — 포켓몬 트룹의 1:1 대치 계약을 복구하고 확정 상태기를 추가한다 (#1062) (`6bfe1e3`)
- accept map tile sizes in selection screen geometry (`040299d`)
- **editor** — 죽은 callMapEvent 호출에 경고를 냈다 (#1053) (`c69ef60`)
- **editor** — declare Vite BASE_URL so creation preview typechecks (#1051) (`c5b2041`)
- **ai** — skip missing activity-visual records so typecheck passes (#1047) (`44c7543`)
- enforce Pi village completion and honor saved designs (`694f493`)
- **editor** — keep typecheck after HUD and prompt-inspection merges (#1042) (`469a3fb`)
- harden combat prediction cooldown rewards and MP feedback (`d7fc679`)
- refine feature labels and strengthen real UI evidence checks (`87ff568`)
- harden feature integration and repair verification fixtures (`ee8663c`)
- **editor** — 사이드바 AI 추천을 실제로 작동시키고 캔버스 느낌표 버튼으로 옮긴다 (`2b11f55`)
- show activity level buttons and a labeled assistant expand action (#1034) (`aa3b9bf`)
- 커스텀 팔레트 원본 배열·밀도와 선택 성능 복구 (#1033) (`8c7eb0a`)
- **ai** — 자동 작업 기록을 제작 노트와 분리 (#1031) (`74b4901`)
- **editor** — keep typecheck after follower and data-integrity merges (`9336b7d`)
- preserve event and database authoring data across edits (`3707e22`)
- interpolate follower sprites between trail slots with walk animation (`5f48ab1`)
- use editor monsters in pokemon style battles (`87b1e0e`)
- align reference stripe grid and measure visual differences (`a266989`)
- refine pokemon type silhouettes and reference sky colors (`d8893e7`)
- match Korean pokemon battle reference and support rear sprites (`f115c53`)
- **event-editor** — 설정 레일 시트가 30px 슬리버로 붕괴하는 것을 고친다 (`e859a9f`)
- improve battle feedback, stage fit, and oversized enemy placement (`7c0a149`)
- guard battle outcomes, authoring inputs and returning state (`c0a44dc`)
- **event-editor** — remediate adversarial review findings (`931c2e3`)
- **editor** — reduce large-map paint and region-drag lag (`22b437a`)
- **editor** — Ctrl+V 붙여넣기에 선택 툴바가 따라오지 않게 한다 (`5530f75`)
- keep tile layers from opening events and rename overlay to 상위 (`d3128c6`)
- keep editor studio bar controls inside responsive grid (`7383ecf`)
- load assistant styles with editor bootstrap (`ecdc225`)
- harden editor first-paint CSS shells (`94c0fae`)
- make resource modal shell self-contained (`2c5e919`)
- **database** — move workbench summary type after dead-code cleanup (`2fd6a72`)
- **ai** — reuse existing omp oauth credentials (`950cd96`)
- **database** — IA·죽은 코드·색 토큰 정리 (P1-17, P1-18, P1-24, P2/P3) (`9487e37`)
- **database** — 접근성·카피 결함 (P1-14, P1-15, P1-19, P1-21, P1-22, C1/C3/C7) (`bb7760e`)
- **database** — 피드백·상태 결함 (P1-10..P1-13, P1-20) (`eaba165`)
- **database** — 목록 선택·reveal·폼 입력 결함 (P1-2..P1-9) (`a1f66cd`)
- **editor** — narrow MapEditLockStatus before comparing lock fields (`90a1540`)
- **ai** — wire hybrid tool exposure through the Pi chat runtime (`1176839`)
- **test** — 삭제 가드 테스트의 import 경로 수정 (`a84ec4c`)

### 성능

- avoid oversized palette rebuild stalls (`4b9b978`)
- skip hidden water animation updates (`53542ee`)

### 정리

- retire legacy remote storage and complete SQLite tooling (`ccc3d70`)
- split editor CSS surfaces and retire dead overrides (`71119e0`)
- isolate editor CSS ownership and extract static styles (`2603246`)

### 문서

- register new tiles and tile studies in shared scope (`627c56a`)
- require shared tile registration and record SQLite as project source of truth (`050d23e`)
- 공용 타일 참고문서 배포 화면 확인 기록 [skip ci] (`4d40ed6`)
- **readme** — document supported and unsupported map tile formats (#1065) (`f393c09`)
- record 32px editor and transfer verification after main merge (`2593b05`)
- record event assistant validation and baseline comparison (`d1e797f`)
- **review** — DB 리뷰 문서에 처리 결과와 미착수 사유를 기록 (`9d8455e`)
- record culled water animation contract (`34d1f26`)

### 테스트

- define feature integration and evidence acceptance checks (`d36117c`)

### 잡무

- 증거 스크린샷 압축 최적화와 아카이브 추가 (`02a9d4e`)

## 0.6.0 — 2026-09-19

### 기능

- add generic image asset generation tools (`246a396`)
- expose game over and audio authoring tools (`de1e679`)
- add focused party and character authoring tools (`7fcdf5b`)
- make RPG kickoff author world and character foundation (`b1f8559`)
- switch project picker to vertical thumbnails (`669920e`)
- polish hosted project picker (`31fc211`)
- **database** — 외형 슬롯에 공용 캐릭터·얼굴 분류를 읽기 전용으로 표시 (`00f6180`)
- add hosted project picker UI (`054381c`)
- enable web project folder opening (`ceab4c2`)
- redesign event condition modal (`28b837e`)
- **player** — 상점 UI 프리셋과 비교·재고 화면을 넣는다 (`df6460d`)
- classify place library by art style and spatial purpose (`73a01a9`)

### 수정

- **database** — 그룹 컨트롤 캡션 클릭이 첫 라디오·칩을 발화하던 것 수정 (`58a051c`)
- **database** — 모달 셸의 Escape 소유권·포커스 트랩·푸터 정직성 (`8fab3d5`)
- **database** — 저장본·편집을 잃던 두 경로를 막는다 (`bf897ea`)
- **interpreter** — 루프 반복 가드를 루프마다 따로 센다 (`bda03d2`)
- **ci** — parity 스위트 워커를 2개로 고정해 6GiB 슬라이스 OOM 방지 (`b4bbed0`)
- **editor** — 큰 맵 지연 깔기에서 mapId가 없을 때는 타일을 만들지 않는다 (`c9c533a`)
- defer large map tile materialization (`490d51e`)
- reduce project and map loading overhead (`fe47e3e`)
- load referenced tileset assets on hosted projects (`ebfd644`)
- stretch beginner tile rail (`00a5c6f`)
- fill custom tile palette columns (`454e723`)
- **database** — 공용 카탈로그 값 import 복원 (`558d611`)
- **database** — 외형 슬롯 읽기줄 편집에서 남은 배열 꼬리 제거 (`a9ba743`)
- **editor** — pin beginner canvas shell to fill column (`81ea2de`)
- **editor** — collapse empty persistence banner host (`e746445`)
- allow hosted project ids in folder picker (`bc1b807`)
- explain missing project host connection (`6e21b70`)
- **test** — approachCorrection 의 vi.fn 클로저가 세션을 붙잡는 걸 끊는다 (#981) (`fa4e113`)
- **editor** — sqlite 폴더는 웹 호스트에서만 열고, 미리보기는 project.json만 받는다 (`c0ff12b`)
- **event-fork** — unify preview card labels and refresh evidence (`91aaf75`)
- **event-fork** — no start-map fallback in preview verdicts (`1305320`)
- **baseline** — heal pre-existing red gates outside fork scope (`c68f07e`)
- **event-fork** — pass current map into condition eval badge (`05a7b9d`)
- **event-fork** — unify branch labels, 3-state preview, scoped validation (`c82c45f`)
- **gates** — 재판정 예산을 CI 규모에 맞추고 판정 결과를 파일로 남긴다 (`61a1d07`)
- **ai** — 검수가 예산 부족으로 끊기면 예산을 넓혀 다시 묻는다 (`30b340d`)
- **ai,village** — 검수 루프가 못 고칠 지적으로 헛돌지 않게, 환촌·광장촌이 목표 채수를 채우게 (`c781480`)
- **village** — 형태 유형 마을이 «마을처럼» 보이게 — 공터·울타리·바깥 숲 (`a1e192d`)
- **ai** — never show a running work card that no turn will finish (#973) (`db496f8`)
- **assets** — give the last nine forest harmony groups placement rules (#972) (`094287c`)
- **ai** — carry tile grafts the bundle added to an existing tileset (`8729918`)
- **ai** — report only changes the merge actually dropped (`a993f4e`)
- **editor** — remove canvas top gap and banner toolbar overlap (`ed9765d`)
- keep event command single-click selection without inline editing (`888b606`)
- apply shared face mappings when the assistant creates NPCs (`001af9c`)
- restore original grass terrain pixels in bundled forest chipset (`a5f188d`)

### 성능

- **database** — 썸네일 크로마키를 요소 가드에서 URL 캐시로 (`46e502b`)
- reduce hosted editor cold-load stalls (`f43cfc5`)
- defer cold editor diagnostics (`cfa6c0a`)
- avoid duplicate hosted project and thumbnail work (`d92553b`)
- **editor** — 내보내기 미러가 프로젝트를 복제하지 않게 한다 (`6812577`)

### 정리

- **loop** — drop redundant body check in walkHasBreak (`d99e360`)

### 문서

- **review** — DB UI/UX 적대적 리뷰와 2차 재검증 기록 (`1e95dd3`)
- **database** — 외형 슬롯 공용 분류 읽기줄을 위키에 기록 (`5368d67`)
- add project folder picker mockup (`fd33ebd`)
- **event-fork** — record timer negative-input gap (`568395e`)
- **event-fork** — badge and simulation share map input (`35f5484`)
- **wiki** — regenerate INDEX after event-authoring edits (`75d50bb`)

### 테스트

- **surface** — refresh fork entries for unified branch labels (`d34dd5a`)

### 잡무

- **gates** — 기준선을 갱신한다 (2026-09-12 → 09-18) — 허용 174→147 (#986) (`b7805db`)
- **gates** — 기준선을 갱신한다 (2026-09-12 → 09-18) — 허용 174→147 (`9b6e68a`)

### 기타

- **editor** — lock canvas gap screenshots across modes (`c8cce02`)
- filter workaround proof for chromium composite strip (untracked follow-up) (`45d3233`)

## 0.5.0 — 2026-09-18

### 기능

- center event editor on commands with right preview and AI modal (`21dba48`)
- add five AI apply modes with live editing and staged approval (`1995a3a`)
- bundle forest harmony chipset for all projects (`710891b`)
- centralize team budgets and review in composer menu (`a0e7a24`)
- **editor** — suggest grounded project tasks and simplify team settings (`0bcdbb5`)
- add seven team authoring workflows and project task delegation (#936) (`6c1ee50`)
- add team member budget preset buttons (`3c21ff9`)
- enable direct messaging between AI team agents (#934) (`6d32ae4`)
- **editor** — show plain AI results with collapsed execution details (`c235da2`)
- **editor** — separate map navigation and properties from tiles (`ee66475`)
- **editor** — add collapsible AI sidebar and team member rail (`329b861`)
- 팀 SQLite 호스트와 협업 권한·초대 UI (#926) (`9f30513`)
- **editor** — choose game menu skins with preview cards (`d1a5a91`)
- **editor** — give game menu settings a dedicated system section (`4fb956b`)
- **player** — expand game menu designs to twelve and fix menu regressions (`10c7551`)
- **places** — 「언덕 위 숲마을」 장소 저장본 — 혼합 칩셋 위 괴촌·언덕 마을을 비취 대계곡과 같은 형식으로 동결한다 (`3108a87`)
- **village** — 혼합 칩셋 위 언덕(relief=hills) 마을과 숲 나무 킷 — 45° 대각 절벽 띠, 큰길만 비탈, 나무는 타일셋 따라 고른다 (`a54898c`)
- **assets** — 혼합 칩셋에 숲 나무 확장 띠 — 사용자 시트의 나무를 원본 픽셀로 960~1139 에 붙이고, 혼합 칩셋 밑동 받침을 고친다 (`bb359ce`)
- **editor** — 초보 사이드바 하단에 상시 맵 필드를 둔다 (`1675df3`)
- **editor** — 세계 개요 잘림 신호 — 600자 초과 시 warn 톤·뒤 N자 표시 (`1222e86`)
- **editor** — 세계 개요·설정집 v2 — AI 미터·hero stat·stat 스트립 (`1371b0a`)
- **village** — 취락 형태 유형(morphology) 경로 — 뼈대 길→필지→집→밭→거리 기울기 나무, 가로촌·광장촌·환촌·괴촌 옵트인 (`e820b4a`)
- **assets** — 합본 마을+레트로 월드맵 혼합 칩셋 — 480×512 확장 시트, 위 480칸 ID 불변·아래 +480 (`945ee79`)
- **editor** — 자료집 시스템 탭에서 게임 메뉴 디자인을 고른다 — 5종 드롭다운·설명·미리보기 (`538ce8b`)
- **runtime** — 사이드 시트 메뉴 스킨 — 지도를 남기는 오른쪽 시트와 2열 명령 격자 (`9956b11`)
- **runtime** — 허브 타일 메뉴 스킨 — 3열 격자 커서·명령 요약·파티 스트립 (`afadf63`)
- **runtime** — 파티 퍼스트 메뉴 스킨 — 컬러 아이콘 레일·파티 개요 첫 화면·사이드 파티 (`452c22c`)
- **runtime** — 컬러 아이콘 스킨용 평탄 레일 — 파티 펼침·저장 꺼냄·시스템 접기 (`6ea22b0`)
- **runtime** — ESC 메뉴 스킨 레지스트리 5종과 system.menuUiStyle 저장 계약 (`34860d6`)
- **village** — 정주지·왕궁 도시 참고 맵의 집을 저작 형태로 옮겨 마을 시공에 섞는다 — 셀 레시피 4종+23종, 슬롯 후보·설계서·author_house 가 같은 목록을 본다 (`8cfa251`)
- **studio** — 하단 레인 보드로 구현 — 에이전트별 진행은 덱의 표 하나로, 스튜디오 밖엔 요약 줄과 나가기 확인 (§11·§12) (`611c754`)
- **assistant** — 조수 창은 대화만, 한 일은 캔버스 하단 가로 띠로 (방향 G) (`552f7b0`)
- **editor** — restore 357 Tibo props in shared objects library (`d93623a`)
- **gates** — 배럴 수출 계약 검사를 추가하고 ci-fast 에 물린다 (`168ea47`)
- **player** — make storage chests authorable with windowskin UI (`b53d775`)
- **ai** — NPC 배치 시 이름으로 자율 이동을 추론한다 (`d7f1942`)
- **gates** — (선택자,속성) 승자 래칫 게이트를 만든다 (`8fbdc42`)

### 수정

- place prominent layer controls next to resources in app header (`13a26ec`)
- make map list navigation immediate and reuse project diagnostics (`1e38f41`)
- prevent forest tile tab crash from incomplete metadata (`a602f14`)
- move map layer switching from tile panel to canvas toolbar (`f322143`)
- make internal web access codes opt-in (`8147d56`)
- seed interior ceiling autotiles and compose connected corners (`5045036`)
- restore owner AI access and preserve web logins across restarts (`03fe566`)
- implement explicit map edit lock takeover (`a19799d`)
- include required placement rules in forest group snapshot (`fbcc2b6`)
- simplify chat composer options into labeled settings (`b21eb6f`)
- complete forest chipset arrays so web projects can save (`d015f87`)
- load persistent host systemd working directory correctly (`590d582`)
- install persistent web host over legacy preview service (`753e1d2`)
- **editor** — 팀원 폼에 남은 budget 사용처를 뗀다 — main 타입체크 복구 (`281529e`)
- share editor tile animation clocks to accelerate map switches (`936a540`)
- migrate legacy AI review defaults to live application (`d881eed`)
- enable durable web project creation and switching (`770a30c`)
- connect npm start to the persistent SQLite project host (`fa38087`)
- isolate team ghost previews and reconcile accepted drafts (`4a21032`)
- keep AI draft apply actions visible after team completion (`d17990b`)
- share and restore reviewed character face mappings (`9e9e07c`)
- increase assistant turn budgets fivefold (`ccd950b`)
- **vitest** — availableParallelism 을 믿지 말고 cgroup 을 직접 읽는다 (#930) (`cbfc43d`)
- isolate team logins and enforce read-only access with lock recovery (#929) (`c46c6d0`)
- 3-wide stair transfers per tile + walkable stair depth below character (#925) (`778ec7b`)
- repair character face workspace layout and responsive cards (`dafd443`)
- correct actor face sheet offsets and reject unsupported matches (`b783c85`)
- **database** — 창 드래그가 커서를 따라오게 — CSS 특이성 경쟁을 인라인으로 이긴다 (#916) (`22edfad`)
- improve character face matching and comparison UI (`03a6a87`)
- **ai** — skip redundant planning for simple creation requests (`6495021`)
- **npc** — Pathfind 런타임 기록 속도도 1–8 스케일로 묶는다 (#914) (`d290963`)
- wait for graft atlas readiness before AI visual review (`ec6c4da`)
- **npc** — Pathfind Move 속도를 페이지와 같은 1–8 스케일로 통일한다 (`9294086`)
- **editor** — 복원한다 — 맵 필드 커밋이 덮은 베이스 규칙 2건 (`fbfb1d4`)
- **editor** — 설정집 검사 지적을 카드 첨부 기준으로 — 전역 수백 건 대신 카드 N장 (`997f2a8`)
- **editor** — 세계 개요 카드 헤드 래핑 특이성 상향 — workspace-modern 패배 수정 (`48d0aa7`)
- **npc** — 명령 이동 무버가 페이지 이동속도를 물려받게 한다 (#909) (`2bd0141`)
- **event-editor** — 1024/768 에서 저장 버튼이 보이고 명령 열이 폭을 받는다 — narrow.css + P1 손질 (`20d85df`)
- **event-editor** — 삽입 자리 규칙 하나 — 선택 행 바로 아래 같은 깊이, 분기 추가 줄은 항상 남는다 (`9081bcd`)
- **event-editor** — 조건 칩이 첫 스위치에 묶지 않는다 — 비운 채 세우고 피커를 열며, 피커는 미리 고르지 않는다 (`5016f23`)
- **event-editor** — 이벤트 이름은 GameEvent.name — 헤더 상자가 이벤트 이름을 쓰고 페이지 이름은 탭과 설정 열에서 고친다 (`47888c2`)
- **event-editor** — 대사·선택지 미리보기를 게임 창과 같은 규격으로 — 320×240 무대를 축소, 줄바꿈 일치 (`b1f2509`)
- **assistant** — 조수가 성공이라고 말한 네 가지 거짓을 끊는다 — 범위 밖 버림·상한 중단·맵 소실·내보내기 (`8118f00`)
- **pi** — 집 다양성 정책 줄을 Pi 시공 에이전트 프롬프트에도 넣는다 — templateId 없는 사각형만 깔리던 원인 (`bf449a2`)
- **village** — 레거시 프로젝트의 2층 실내 위층을 스코프 위반으로 거부하던 검사 — transfer 사슬을 따라간다 (`f087996`)
- **dev** — 체크아웃별 dev 포트를 고정한다 — 워크트리의 npm run dev 거절, dev:worktree 자동 배정·기록 (`523fcf3`)
- **play** — 텍스트 필드에 갇힌 포커스 때문에 테스트 플레이 방향키가 죽는다 (`2472efa`)
- **pi** — 의도 노트와 마을 시공 노트를 Pi 턴에 실어 「마을을 만들어달라」가 author_village 로 가게 한다 (`601258e`)
- **editor** — web preview boot path and recovered Tibo interior pack (`721e50a`)
- **ai** — 조수가 지금 뭘 깔고 있는지 다시 보이게 한다 — Pi 워커가 툴마다 map_delta 를 흘린다 (`3de5513`)
- 스튜디오에서 맵 이벤트 더블클릭이 편집기를 바로 닫던 유령 click 을 막는다. (`ddd28a9`)
- **assets** — restore 76 shared character expression sets (`0a89506`)
- **editor** — include ships and harbor in default places (`3389d0c`)
- **pi-agent** — 중단 사유를 abort 에 실어 「Request was aborted」 대신 진짜 이유를 보인다 (`1445418`)
- **css** — #883 병합 후 빨개진 CSS 게이트를 되돌린다 — 가려져 있던 죽은 규칙 4개 제거 (`c1c7da7`)
- **test** — 배럴에서 빠진 데모 팩터리를 쓰던 e2e 스펙 두 개를 새 경로로 (`798ac8d`)
- **player** — type chest gold row as HTMLElement so tsc can build after #882 (`77702a1`)
- **css** — :not() 로 올라간 특정도를 :where() 로 되돌린다 — 각져 버린 버튼들을 복구 (`081cd5e`)
- **css** — 배우 목록 5열 정렬을 되살린다 — 번호 계약을 위치가 아니라 이름으로 고친다 (`06f4cbd`)
- **editor** — 보관 상자 그래픽을 보물상자와 구분한다 (`9379703`)
- **editor** — 이벤트 레이어에서도 맵과 탭을 한 줄로 유지한다 (`481457b`)
- **battle** — 에디터 CSS 가 전투 미리보기를 덮던 누수를 막는다 (`fe5fd82`)
- **css** — 쓸 수 없는 토큰 4개를 지우고 포커스 링을 하나로 합친다 (`66a4dcb`)
- **battle** — 포켓몬 스킨 UI 결함을 고치고 스타일시트를 한 파일로 모은다 (`41fa8a7`)
- **battle** — 포켓몬 전투에서 죽은 키 입력 두 개를 없앤다 (`2ffbdf7`)
- **gates** — dead-css 를 집행 경로에 넣고, 그 게이트가 가리키던 실제 결함을 고친다 (`67ba97e`)
- **gates** — CSS 게이트 4개를 전부 집행 경로에 넣는다 (`a300e17`)
- **gates** — @import 파서를 하나로 합쳐 게이트 세탁 경로를 막는다 (`4180e91`)
- **gates** — 표면 게이트를 초록으로 되돌린다 — 노이즈 702건 등록, 거짓 양성 7건 제거 (`c9e0d4f`)
- **css** — 실제로 렌더되던 크림 잔재를 정본 토큰으로 바꾼다 (`3d50240`)
- **db** — 정의된 적 없는 --oprn-* 를 읽던 죽은 선언을 지우고 hover 하나를 되살린다 (`28876c8`)
- **css** — spatial-composition 시트에 빠진 layer(database) 를 붙인다 (`c6d9f45`)
- **player** — 다크 런타임에 다크 토큰을 준다 — 전환이 검게 닫히고 터치 버튼이 읽힌다 (`0268ac6`)

### 정리

- **editor** — 미터 채움막 i에서 시맨틱 div로 — progressbar 역할 유지 (`d55136e`)
- **css** — 값 보존이 증명되는 토큰 리터럴 40건을 더 바꾼다 — 위험한 3종은 남긴다 (`1d16564`)
- **css** — 액센트 리터럴 181건을 토큰 참조로 바꾼다 — 그중 135건은 죽은 폴백이었다 (`36fd1ce`)
- **css** — database 표면을 접는다 — 번호 계약 복구 + 죽은 규칙 456줄 제거 (`74d0565`)
- **css** — map·shell 표면을 접는다 — 죽은 규칙 785줄 제거, 시각 변화 0 (`3ab4bfd`)
- **css** — editor/ 유령 디렉터리를 해체한다 — 21장은 map, 5장은 shell/dialogs (`9b2ff9a`)

### 문서

- record event command workbench browser evidence (`dc93ad5`)
- include persistent host verification results (`43796c5`)
- record SQLite host save and reload evidence (`89e3755`)
- record AI sidebar browser evidence (`80fed84`)
- **editor** — 잘못된 맵 필드 클로즈업 증거를 걷어낸다 (`e68583a`)
- **wiki** — INDEX 재생성 — 맵 필드 불릿 반영 (`d04939f`)
- **editor** — 사이드바 맵 필드 증거를 추적 경로에 둔다 (`f8b11c1`)
- **openwiki** — INDEX 재생성 — 세계관 v2·폴리시 반영 (`333b4ec`)
- **openwiki** — 이벤트 편집기 P0 다섯 가지 수정 계약 — 이름 필드·빈 참조 조건·삽입 규칙·닫기 상태·좁은 화면 (`a718cb0`)
- **runtime** — ESC 메뉴 스킨 구현 결과 캡처 (`0904b5d`)
- **runtime** — ESC 메뉴 스킨 설계 스펙과 구현 계획 — system.menuUiStyle 로 5종을 고른다 (`b8b7731`)
- **runtime** — ESC 메뉴 개선 제안서 — 현재 캡처 6장·결함 6건·목업 A/B/C 6장 (`547438c`)
- **event-editor** — NPC 하나를 손으로 저작하며 적은 적대적 리뷰 — P0 5건·P1 8건·P2 5건, 스크린샷 21장 (`6bfb0e1`)
- **studio** — 하단 레인 보드를 확정 설계로 — 목업 4장 + 현재/제안 비교 (`c793101`)
- **css** — 작업 보고서(이미지 내장 HTML)와 회귀 2건의 실행 후기를 남긴다 (`516f9da`)
- **css** — 레이어 선형 순서의 한계와 서브레이어 함정을 실태대로 적는다 (`b520f7f`)
- **css** — CSS 얽힘 해소 계획을 기록한다 — 적대적 리뷰 5축 → 20 태스크 6 페이즈 (`ba51706`)
- **css** — 메커니즘을 거꾸로 설명하던 주석 2종과 R4 계약 역전을 바로잡는다 (`67c303f`)

### 테스트

- **battle** — 누수 제거의 캐스케이드 덤프를 증거에 채운다 (`1fc3e27`)
- **battle** — 포켓몬 스킨 수정 증거를 붙인다 (`0856b30`)
- **battle** — 누수 증거와 캐스케이드 덤프 하네스를 붙인다 (`d5138f9`)
- **battle** — 반투명 진단 프로브를 남긴다 (`ce89ecf`)
- **battle** — 전투 스킨 진단·캐스케이드 회귀 하네스를 더한다 (`fae646d`)

### 스타일

- **editor** — 자료집 개요 세계관 카드 카피 정리 — 세계 개요 표기 통일 (`3b6d373`)
- **editor** — lint 블록 탈포화·칩 카드 호버·포커스 — database 레이어 우선 (`1a622e6`)
- **editor** — 세계 개요 히어로 리듬 — 미터·stat 간격 16px (`0f7f4d4`)
- **editor** — 설정집 선택 카드 레일 3px·테두리·그림자 강화 (`902834f`)
- **editor** — 세계 개요·설정집 폴리시 — Studio 문법 내 시각 리듬 (`c798fef`)

### CI

- self-hosted 러너만 쓰도록 게이트로 못 박는다 (`4ead3fe`)
- **full** — 아티팩트 업로드를 박스 디스크 보관으로 바꾼다 (`1b5755f`)
- 이 박스를 통제된 self-hosted 러너로 만든다 (전체 게이트 78분 사망 → 완주) (`83bfb98`)

### 잡무

- **css** — refresh winners baseline after merging main into #883 (`09a77b0`)

### 기타

- a11y(editor): 세계 개요 이름 카드 제목·미터 status·progressbar (`181ac6b`)
- 조수 도구가 거부 대신 대체한다 — pages 기본값·영역 확장·형태 대체·활엽수 반쪽 제거 (`59db3fb`)
- 수용 원장(acceptance ledger)을 만들지 않는다 — 최대 런 첫 턴 526 s 의 절반이 만족 불가능한 계약 두드리기였다 (`7df00c9`)
- 검문소를 걷어내고 필요한 것만 남긴다 — 「마을 만들어줘」가 16분 동안 빈 맵을 남기던 이유 (`0adb643`)
- 오프닝 프리셋: 한 번 눌러 완성된 연출을 깐다 (`680130c`)
- 테스트 플레이: 오프닝을 볼지 작업자가 고른다 (`a034769`)
- 십자 길을 버리고 집 먼저 골격으로 잇는다 (`e713708`)
- 머지된 fix 브랜치를 떠나기 전에 워킹트리를 붙잡는다 (`146afe3`)

## 0.4.0 — 2026-09-17

### 기능

- **ai** — 후보+전체 설명을 한 번에 주는 recommend_bgm 읽기 툴 (`2f05c17`)
- **electron** — electron-builder 패키징 절차와 실측 검증 경로를 둔다 (`8c55676`)
- **ai** — 루프백 동반 서비스에 실행별 토큰을 건다 (`18c53ac`)
- **electron** — 앱과 웹이 같은 로컬 폴더 정본을 쓰게 한다 (`fad874d`)
- **ai** — Pi 툴 에스컬레이션 — find_tools 수확·폴백 구제로 실행 중 툴을 얹는다 (`ab2780a`)
- **ai** — /team 을 일급 명령으로 — /pi 접두사는 이중 경로 시절의 잔재다 (`1930fcf`)

### 수정

- **merge** — #874 브리지에 adoptElectronOpenProject를 되돌리고 listSync를 뺀다 (`3ed8fea`)
- **merge** — #874 gitignore 충돌 마커를 양쪽 예외로 합친다 (`d17701d`)
- **ai** — 맵 자동 BGM이 seed 1에 고정돼 같은 곡만 고르던 편향 제거 (`4e95535`)
- **electron** — 패키징 잔여 결함 셋을 고친다 (`1a19748`)
- **app** — 열린 로컬 폴더로 부팅한 패키징 앱이 편집기까지 도달하게 한다 (`3a8646e`)
- **test** — 격리 스위트가 실제로 돌게 전용 config 를 둔다 (`37b9879`)
- **editor** — 좌측 사이드바 맵 전환을 빠르게 — 크로스페이드를 130/200 에서 80/120 으로 (`7d8d331`)
- **ai** — 범위 밖 타일 저장·턴 슬롯 공백·Pi 감사 누락을 막는다 (`3df768e`)
- **ai** — 조화 검수 응답을 재시도하고, 검수 불가를 지적으로 세지 않는다 (`9e5c890`)
- **ai** — 워커 경로의 canonical 수용 증거를 프로세스 경계 너머로 잇는다 (`34b498c`)
- **ai** — max_tokens 상한(65536)을 선언해 DB AI 턴의 400 을 고친다 (`5f645fd`)
- **evidence** — 브라우저 증거 스크립트가 앱과 다른 store 인스턴스를 잡던 결함을 고친다 (`fdcfca0`)

### 성능

- **gates** — vitest 워커 수를 8로 명시한다 — 기본값에 맡기면 2.9배 손해 (`530a25e`)
- **editor** — 화면 밖 타일 컬링으로 큰 맵 렌더 비용 절감 (`96b2b3e`)

### 정리

- **activity** — 활동 미러 2종을 공용 본체로 꺼내 앱·웹·로컬 서버가 같이 쓴다 (`942923a`)
- **persistence** — 동기 커밋 조회를 지워 두 껍데기의 브리지를 같게 만든다 (`29b894d`)

### 문서

- **openwiki** — 데스크톱 산출물을 릴리스에 붙이는 절차를 기록한다 (`a511bd5`)
- **openwiki** — regenerate INDEX after merging branch set (`9beeba7`)
- **openwiki** — regenerate INDEX after merging #870 (`a3e9b4d`)
- **openwiki** — regenerate INDEX after merging #868 (`ee46f6a`)

### 테스트

- **ai** — 실모델 라이브 검증 증거를 추가한다 (`ea5206a`)

## 0.3.0 — 2026-09-16

### 기능

- **studio** — 하단 덱을 오버레이 드로워로 — 맵이 세로를 다 쓴다 (`1a0b4aa`)
- **editor** — AI 설정 모달을 레일+페인 구조로 재설계하고 제공자 카드에 브랜드 마크를 통합 (`f732ace`)

### 수정

- **ai** — max_tokens 상한(65536)을 선언해 DB AI 턴의 400 을 고친다 (`daa0903`)
- **player** — 전투가 소유한 지연 콜백을 teardown 이 한 번에 끊는다 (`f53282e`)
- **assets** — 가짜로 승격된 스타터 에셋 5장을 실제 생성물로 복구 (`23ab875`)
- **player** — MP 부족 행에서도 스킬 이름이 읽힌다 (`675fb51`)
- **player** — 아이템 행이 보유 수량을 잘리지 않는 슬롯에 둔다 (`bf1b87a`)
- **player** — 전투 teardown 이 지연된 기절음을 끊는다 (`3f3c600`)
- **player** — 대상 목록이 커서를 따라 스크롤한다 (`fca471b`)
- **player** — 전투 복귀가 필드 BGM 저작 볼륨을 잃지 않고, 종국 패배는 필드곡을 되돌리지 않는다 (`43cae5b`)
- **qa** — 실제 모델 DB 검토 QA 가 실패를 실패로 보고한다 (`8b3be17`)
- **assets** — dry-run 가짜가 생성 아트로 승격되지 않게 한다 (`af2ddd5`)
- **ai** — 커버리지 감사가 라우팅 예산을 물려받지 않는다 (`5b12824`)
- **player** — 타이틀 복귀가 무음이 되지 않는다 (`c6adc59`)
- **player** — 병렬 전투가 자기 write-back 으로 페이지가 꺼져도 결과를 전달한다 (`29742ec`)
- **battle** — 전투가 건드리지 않은 타이머를 되살리지 않는다 (`d17af15`)
- **battle** — 인트로 배너가 전환 커버가 걷힌 뒤에 뜬다 (`53f6d4b`)
- **battle** — 회복 아이템이 자원별로 표시된다 — MP 회복이 HP 로 새던 결함 (`e571288`)

### 성능

- **ai** — 한 요청에 인라인하는 원본 근거에 상한을 둔다 (`22bdc1c`)
- **editor** — 화면 밖 타일 컬링으로 큰 맵 렌더 비용 절감 (`dc07738`)

### 문서

- **openwiki** — regenerate INDEX after merging #860-#861 (`f3c98ba`)
- **openwiki** — regenerate INDEX after merging #856-#859 (`dd2e9aa`)
- **evidence** — DB AI 턴을 죽이는 400 의 실측 (자격 아님, 요청 수준 거부) (`30323c7`)
- **openwiki** — regenerate INDEX after merging #856-#857 (`f231fd7`)
- **openwiki** — 생성 에셋 계약을 복구 완료 상태로 갱신 (`553731f`)
- **readme** — README를 제품 소개용으로 다듬고 스크린샷 갤러리 추가 (`232854b`)
- **openwiki** — regenerate INDEX after merging #854 (`b30aa7b`)
- **evidence** — 다섯 가짜의 영향 범위를 실측대로 바로잡는다 (`3b72ae2`)
- **evidence** — 재생성 절차 문장의 잘못된 음절 교정 (`ef68e3b`)
- **assets** — 재생성 절차와 두 층 계약을 위키·증거에 반영 (`d562a71`)
- **openwiki** — regenerate INDEX after merging #848-#853 (`8f411d2`)
- **battle** — 계약 문장 정정 (`8aa6193`)
- **battle** — 계약 문장에서 드롭된 글자 정정(따라 움직이면 따라간다) (`6210c52`)
- **evidence** — 표면 QA 스크린샷을 현재 트리로 갱신 (`84789d0`)
- **openwiki** — 동반 서비스 자격 해석 규칙을 기록 (`de37367`)
- **evidence** — 생성 에셋 가짜의 원본 부재와 재생성 경로 상태를 기록 (`ccd0138`)
- **battle** — 회복 자원·인트로 배너·타이머 write-back 계약과 계측 프로브 (`0d6115e`)

### 테스트

- **battle** — teardown 프로브가 clearTimeout 을 구분한다 (`0b3d0f8`)
- **assets** — 생성 에셋 전체를 훑어 dry-run 가짜를 잡는 계약을 추가 (`a16823c`)
- **battle** — 타이틀 복귀 오디오 사다리 계측 프로브 (`d4298fd`)

## 0.2.0 — 2026-09-16

### 기능

- **release** — 릴리스 제안 PR 과 발행을 로컬에서 자동화한다 (`8c647d6`)

### 문서

- **openwiki** — 릴리스 자동화 절과 Actions 미사용 근거 (`68e0d17`)

## 0.1.0 — 2026-09-16

### 기능

- **release** — 릴리스 자르기 스크립트와 릴리스 노트 생성 (`d835d41`)
- **brand** — 빌드가 자기 버전을 알고 도움말이 그것을 보여준다 (`2670ae7`)
- **editor** — 목록에서 사용자가 직접 고른 맵 전환도 크로스페이드로 (`436ee4f`)
- **editor** — 장소 탭이 제 목적을 말하게 한다 — 목적 스트립·쓰임 감사·배치 팝오버 (`93c9dab`)
- **persistence** — LegacyDb 어댑터가 기존 sync 모듈을 그대로 감싼다 (`27c7caf`)
- **persistence** — 메모리 어댑터와 저장소 계약 테스트 (`a988e8a`)
- **persistence** — 저장소 포트 인터페이스와 대상 타입, 선택기를 둔다 (`b8aef27`)
- **ai** — 조수의 맵 전환을 크로스페이드로 — 하드컷 + 중앙 스냅 제거 (`f945a59`)
- **player** — 내보낸 게임 세이브 네임스페이스를 oprn-export: 로 바꾸고 옛 세이브를 첫 부팅에 입양한다 (`e1fda9d`)
- **db** — 캐릭터·얼굴 JSON schema id 를 oprn-npc-face-mapping 으로 바꾸고 옛 id 도 받는다 (`f8926b7`)
- **db** — 구조물 파일 판별자·확장자를 oprn 으로 바꾸고 옛 rpgzzu 파일도 계속 읽는다 (`af70557`)
- **ai** — 제공자 자격 파일을 ~/.oprn 으로 옮기고 옛 ~/.rpg-zzu 파일은 첫 읽기에 한 번 복사한다 (`c750469`)
- **env** — RPG_ZZU_* 환경 변수를 OPRN_* 로 개명하고 옛 이름은 경고와 함께 한 릴리스 더 읽는다 (`37da80d`)
- **editor** — DB AI 어시스턴트를 창 안 검토 오버레이로 (`364968f`)
- **ai** — 채팅 세션 턴에 deferApply 검토 게이트 (`cd8f05c`)
- **editor** — DB AI 변경 레코드 카드 렌더러 (`0ad852c`)
- **project** — 데이터베이스 레코드 단위 구조 diff (`a48b18e`)
- **editor** — 장소 탭 UX 정비 — 인라인 이름 수정·툴바 축소·속성 통합·목록 복귀 (`ffad12b`)
- **resources** — add shared face expressions and character expression manager (`a51b665`)
- **ai** — 결과 보고서 모달 — 변경 지점마다 before/after 한 쌍 (`bf11050`)
- **ai** — 팀원을 조수 데크 「대화|작업」 탭으로 — 공용 작업 페인, 검토 스트립, 스튜디오 상세 (`831e9f8`)
- preserve castle and lake references with authored spatial library (`6be1b67`)
- **editor** — diversify compact interiors and enforce furnishing constraints (`733dd13`)
- author emerald fields and link saved maps to regions (`d9e52f2`)
- **ai** — 오프닝 부분 편집·그림 생성 툴 (`3841ff7`)
- **editor** — 오프닝 그림 슬롯을 스틸 카탈로그로 열고 AI 생성을 붙인다 (`10d4d62`)
- **runtime** — 오프닝 시퀀스 배경음악(musicResourceId) (`b528059`)
- **battle** — 비활성 커맨드 행에 커서를 세우고 사유를 보여 준다 (`4c59544`)
- **event-editor** — B형 껍데기 7건에 설명카드를 달고 판정 축을 하나로 모은다 (`41838e8`)
- **map** — make cloud shadows read as clouds, not as round smudges (`6ef8b48`)
- **ai** — 사용자의 커스텀 오프닝을 에디터 AI 로 저작한다 (`2b8e43e`)
- **ai** — 변경 내역을 긴 명세로 — 항목별 before → after 를 카드에 담는다 (`e5c04c9`)
- **map** — draw drifting cloud shadows over a map (`ef5b0a3`)
- **editor** — 캔버스에서 맵 배경을 확인하는 미리보기 토글을 넣는다 (`1abb65e`)
- **map** — 맵 배경에 반복 X/Y 플래그와 레이어 스택 렌더 경로를 넣는다 (`89b22b3`)
- **editor** — 맵 배경 탭에 고른 그림 미리보기를 세운다 (`e473f83`)
- **runtime** — 맵 배경(파노라마)을 실제로 그린다 (`df48359`)
- **editor** — generate connected dungeons from room graphs (`4ec6aef`)
- **ai** — split model roles and route planning through Ultrabrain (`f698828`)
- **editor** — unify room and building authoring under places (`59706de`)
- open shared read-only demo village on first visit (`5faf408`)
- author a compact reusable one-floor house interior (`d27855b`)
- compose village decoration from reusable outdoor spaces (`c231031`)
- revise house catalog and add settlement gable exteriors (`2e70ad9`)
- **editor** — add mixed spatial composition workspaces and asset browsers (`cf0037e`)
- add completed settlement reference to regions and AI lookup (`25ff9a2`)
- persist dense small-village design with exact storey quotas (`70fe518`)
- **editor** — 생성 히어로 얼굴 시리즈를 저작 목록에서 내린다 (`993b3a5`)
- add compact village groves and tall grass patches (`c62a8a7`)
- **editor** — arrange market goods around walkable customer aisles (`dda5963`)
- **content** — add ten connected two-storey house exteriors (`fd93811`)
- author ten connected large and multi-storey house exteriors (`a1b6d86`)
- **ai** — 조수 데크를 레일 드래그로 자유롭게 옮기고 위치를 기억한다 (`13d2f39`)
- **editor** — author_house에 저작 형태(셀 레시피) 경로와 manor-balcony를 추가한다 (`8da97ab`)
- **ai** — canonical 발생체 수명주기 도구와 UI 오류 복구 경로를 추가한다 (`0243453`)
- **editor** — 왼쪽 사이드바를 컴팩트한 타일 중심 배치로 다시 짠다 (`cddb828`)
- **spatial** — 마을 설계서가 지역 계층의 정주지 설계가 되고 실제 마을로 시공된다 (`f33c17c`)
- **editor** — 필드 스폰과 퀘스트가 좌표 대신 로케이션을 가리킨다 (`39211c9`)
- **editor** — 로케이션이 맵 시스템의 저작 표면이 되고, 이벤트와 겹칠 때 클릭 규칙을 갖는다 (`79052f6`)
- **editor** — 날개별 층수로 계단식 2층 집을 짓고 다층 연결 실내를 고친다 (`086d3fb`)
- **editor** — 로케이션을 구역 그리기 도구로 보이게 한다 (`c93c9be`)
- **ai** — 팀을 실행 경로에서 내려 설정 비트로 옮긴다 (PR #758 나머지) (`4663bd9`)
- **editor** — 구역이 없는 맵에서는 쓰는 지점이 행동을 낸다 (`754769e`)
- **ai** — 조수 채팅을 Pi 하나로 줄이고 세션 경로를 걷어낸다 (`43faf6b`)
- **css** — 죽은 선택자 규칙을 지우는 도구를 만든다 (`b612271`)
- **ai** — Pi 실행을 활동 로그에 남긴다 (PR #758 에서 분리) (`c48890e`)
- **css** — 가려진 선언을 찾아 지우는 도구를 만든다 (`b10d997`)
- **tools** — author_village가 맵 크기를 코드로 정하고 부족한 기존 맵은 스스로 키운다 (`7195fcd`)
- **ai** — 맵 규모 파괴는 적용 전에 사용자 허가를 받는다 (`8f72dcc`)
- **tools** — 맵 전체 청소 clear_map 을 추가한다 (`cc6d0ab`)
- **ai** — 실행 경로를 둘로 줄이고 Pi 실행을 감사 로그에 남긴다 (`8089e81`)
- **css** — 표면 레지스트리와 R1–R6 격리 게이트를 경고 모드로 붙인다 (`260e47c`)
- **css** — @import 평탄화와 선언 인덱스 라이브러리를 만든다 (`dd5c9df`)
- **region** — 진입 화면은 문장 하나 — 경로는 코드가 고른다 (P2 + P4) (`82b05d5`)
- **region** — 검토 표면을 캔버스로 — 액션 바 + 청크 도형 클릭 (P4 일부) (`01e3c08`)
- **ai** — 슬래시 노브와 Pi 전용 컴포저 (`5063b6f`)
- **ai** — 팀 행에 종류 배지를, 수정 배정에 원인 검수를 표시한다 (`88647fc`)
- **ai** — 팀 배정을 프롬프트가 아니라 툴 계약으로 지킨다 (`320ec1a`)
- **region-task** — 캔버스 위에서 청크를 골라 검토한다 (`13468e8`)
- **region-task** — 캔버스 고스트가 청크 선택을 따라간다 (`671f6a6`)
- **region-task** — 청크 캔버스 도형 기하와 선택 투영 순수 모듈 (`99e170a`)

### 수정

- **editor** — 검토 턴이 "반영됐다"고 말하지 않게 — 적용 여부를 applied 로만 판정 (`96f59a4`)
- **ai** — 팀 지시가 사용자가 보는 맵을 기본 대상으로 삼게 하고 실행 상한을 3000초로 올린다 (`542d5f4`)
- **ai** — 기록 추출이 깨진 답을 받아도 시공을 막지 않는다 (`89047b3`)
- **headless** — 헤드리스 도구가 .oprn 패키지를 우선하고 .rpgzzu 도 계속 연다 (`bce5007`)
- **ai** — 수정 요청에서 맵 크기를 바꿀 수 있게 네 계층을 연다 (`688578b`)
- **editor** — ship reviewed dungeons and interiors as default places (`d8af548`)
- expose emerald basin in the default place catalog (`a255804`)
- **gates** — 0 실패인데 vitest exit 1 이면 파싱 버그가 아니라 unhandled error 로 분류한다 (`4568463`)
- retain default place selection when adding reference cards (`8d96704`)
- **pi** — 스트림 침묵을 없애고 남은 침묵은 고장으로 읽는다 — idleTimeout 0 · 델타 중계 · heartbeat · 워치독 (`a4f753e`)
- **ai** — 게이트가 잡은 완화 세 곳의 부작용을 좁힌다 (`f450b49`)
- **ai** — 조수를 막던 자체 게이트 다섯 곳을 실측대로 연다 (`a16ae72`)
- **ai** — 오프닝 미디어 id 검사를 DB 피커 카탈로그와 같게 좁힌다 (`cc0bdd6`)
- **ai** — 최신 캡처 이미지를 문자 클램프 1차 압축에서 보호한다 (`d78d37b`)
- **ai** — 오프닝 툴의 활동 문구 패밀리를 명시한다 (`ae372fb`)
- **battle** — 포켓몬·측면 스킨 — 파티 박스가 적을 가리지 않고, 교체·포획이 화면에 나타난다 (`ac4c482`)
- **battle** — rm2000 유리 HUD — 파티 카드 스냅 제거, 칩·게이지·결과 카드·팝업 정리 (`054d64b`)
- **battle** — 시퀀서·커맨드·타격·결과 UX — 스킵이 진짜 줄이고, 착탄이 임팩트와 겹치고, 「뒤로」가 눌린다 (`3101213`)
- **battle** — 전투 전환이 실제로 보이게 — 커버 색은 막대에만, 인트로는 커버 뒤에서 시작 (`05ea894`)
- **editor** — 타일 팔레트 개수를 실제로 그리는 칸과 맞춘다 (`e5b3466`)
- **pi** — 코드가 바뀌면 워커를 갈아 끼우고, 팀 경로 병합을 회귀 테스트로 잡는다 (`8c86d97`)
- **ai** — 조수 데크 드래그 계약 셋 — 3px 임계값 · 릴리스 하나 · 끌 수 없는 상태의 커서 (`2f5c796`)
- **map** — 맵 배경 저작값을 로드에서 검증·클램프한다 (`5f477da`)
- **ai** — 검토 시점에 before/after 를 보여주고, 그림 밖 변경을 말로 남긴다 (`2793bd3`)
- **pi** — carry a bundle's own flag definitions through the map-bundle merge (`f27b23e`)
- **ai** — retain current inspection images under schema budget pressure (`1ee3d47`)
- **editor** — stop editor shortcuts and Ctrl+Z leaking behind open confirms (`ac77275`)
- **editor** — make map deletion actually undoable as the confirm promises (`6605509`)
- **editor** — restore house interior landing and storey-band fixes reverted by #782 (`f7c3fa4`)
- review interior spaces and preserve furniture wall placement (`e12a5ac`)
- **css** — 작업 열기 모달 크롬 오버라이드를 database 레이어로 옮긴다 (`dcceb71`)
- overlap village trees and thicken outer grass fringe (`3acee7d`)
- **growth** — 스킬 트리 노드 정보를 한눈에 읽히게 개선 (`b530804`)
- **css** — drop extra brace from spatial-shell merge (`9ecbb06`)
- **growth** — DB 스킬 트리 적대적 리뷰 결함을 수정한다 (`99ee5d4`)
- **editor** — preserve legacy spatial navigation alongside mixed canvases (`eb98584`)
- **sweep** — refresh event-editor portal surface baseline (`b66c34b`)
- **sweep** — glue ready PR merge for gates (`83ab7ac`)
- **editor** — 리소스 관리자 목록에서 중복 칩셋·캐릭터셋 카드를 접는다 (`6480cea`)
- **tileset** — 합본 마을 사선 지붕 몸체 374–377을 하위 레이어로 교정한다 (`a3fb153`)
- **db** — 맵 → 타일 작업대 붕괴·열 반전 레이아웃을 고치고 회귀 테스트를 잠근다 (`d1ad8f5`)
- keep constrained village lakes horizontally elongated (`26d951a`)
- **editor** — 리소스 관리자 몬스터 탭이 소재 카탈로그 전체를 보여준다 (`facb995`)
- preserve tree companions during village construction (`23f9fd8`)
- **editor** — 부트 레이스 고아 Phaser 게임의 Ctrl+Z 이중 실행을 막는다 (`89cee04`)
- **spatial** — wing 도면을 legacy import 스위치에서 명시적으로 거절한다 (`167d076`)
- **ai** — spatial 도구의 잔여 적대적 결함을 해소한다 (`d38ae24`)
- **editor** — 데이터베이스 맵 그룹 6탭이 기본 설계를 읽기 전용 카탈로그로 그린다 (`721aae0`)
- **editor** — AI 연결 실내의 찍어내기를 끊고 도면 정본을 설계·저작본·씨앗으로 갈라 세운다 (`1f3c480`)
- **ai** — canonical 공간 계층의 AI 도달 경로를 복구한다 (`4a55096`)
- **ai** — Pi 경로에 의도 선언을 다시 붙여 질문 발화를 읽기 전용으로 승격한다 (`716a0bd`)
- **shop** — 키보드 전용 정책과 어긋난 상점 UX 잔여 결함 정리 (적대적 브라우저 리뷰 후속) (`3358990`)
- **ai** — Pi 변경-0 종료를 「적용됨」과 분리하고 답 말풍선을 먼저 둔다 (`a4f691a`)
- **editor** — 캔버스 렌더러가 나무 밑동 아래 잔디 받침을 깐다 (`533edde`)
- **battle** — 모델 간 의미론 파리티 + 커맨드 UX 결함 수정 (11판 실플레이 적대 리뷰 후속) (`618f87d`)
- **project** — 기본 아이템 카탈로그와 아이템 효과를 재점검하고 결함을 고친다 (`b305bf0`)
- **editor** — tier-front를 세로 인접 스택으로 재설계해 위층 벽이 드러나게 한다 (`2a42c4a`)
- **editor** — 로케이션 그리기 결함 다섯을 적대적 리뷰에서 잡아 고친다 (`da89b31`)
- **ai** — Pi 경로에도 실행 결과 4축을 그리고 종료 캡션에 오류·버림을 숫자로 고지한다 (`875dcd9`)
- **interior** — 개념 실내 입구 표식을 남쪽 벽 개구부에 둔다 (`40febe6`)
- **css** — 상점 명령 편집 머리행 숨김을 overrides 로 올리고 깊이 오판 항목을 되돌린다 (`611b01b`)
- **gates** — 기준선 이후 신규 테스트 파일을 회귀로 세지 않는다 (`f536d75`)
- **css** — 게이트가 템플릿 중간의 동적 클래스 접두어도 살아 있는 것으로 본다 (`70ab06c`)
- **css** — 1단계 리뷰 반영 — 플레이어 사슬 편집기 규칙 스코프·danger 색 복원·빈 시트 정리 (`2da5ba2`)
- **css** — 미정의 변수 4종과 z-index 주석을 고치고 죽은 마을 정보 시트를 지운다 (`06719e9`)
- **ai** — 해소 불가능한 검증 요구를 애초에 만들지 않는다 (`5ceaef7`)
- **editor** — 오버레이가 삼킨 캔버스 제스처를 소유권 판정 하나로 되돌린다 (`ff5d288`)
- **css** — 허브·미배정 표면도 래칫하고 레지스트리 접두어를 '-' 종결로 통일한다 (`0aa4339`)
- **tools** — 맵 생성 테두리 옵션을 모델 스키마에서 뺀다 — 조수가 스스로 외곽 벽을 두르던 원인 (`a659549`)
- **css** — 표면 게이트 기준선을 줄 번호 없는 지문과 표면별 카운트로 바꾼다 (`efaf1fd`)
- **ai** — 완료 거부에 성공 기록이 지워진 이유를 실어 보낸다 (`2e3caf3`)
- **css** — 선택자 도우미가 괄호 안 결합자와 :not/:is/:has 인수를 올바르게 다룬다 (`2ff3497`)
- **ai** — malformed 검증 스코프는 계속 완료를 막는다 — 계획 공백과 구분 (`6381aa9`)
- **ai** — 검증 게이트를 되돌리고, 탈출 경로 고지와 테스트 OOM을 고친다 (`5853bd0`)
- **editor** — 로케이션 오버레이가 맵을 미는 제스처를 삼키지 않게 한다 (`85037fc`)
- **test** — 전체 스위트가 워커 힙 상한에서 OOM 나던 문제 (`508fde5`)
- **ai** — 미지정 검증 스펙이 완료를 영구 차단하지 않게 한다 (`36d1132`)
- **ai** — 범위 밖 감사를 에이전트가 출발한 사본 기준으로 잰다 (`009356e`)

### 성능

- **tools** — 완성 집 보호 검사의 짝 비교를 색인과 실제 칸 경계로 가지친다 (`90cdc9c`)
- **db** — 맵 탭 카드 썸네일을 보일 때 굽고 프로젝트 세대로 기억한다 (`047c562`)
- **gates** — judge flake retries one file at a time with maxWorkers=1 (`2a6477a`)
- **gates** — judge flake retries by test-level failures and run them in one batch (`88e79a9`)
- **gates** — re-judge newly failing files in isolation before calling them regressions (`19cd2b5`)
- **gates** — add --changed scoping so iterations stop running all 23k tests (`a7b157b`)

### 정리

- **persistence** — 커밋 로그·팀 패널·AI 기록·타일 메타가 포트를 부른다 (`6b34f7f`)
- **store** — 저장·읽기·증명·활성화·헬스체크를 저장소 포트로 부른다 (`2c862a8`)
- **persistence** — 맵 패치 계획을 core 로 빼고 sync 가 그것을 부른다 (`36864ce`)
- **persistence** — 저장본 JSON 로드 복구를 core 로 옮긴다 (`5a52d44`)
- **persistence** — 맵 병합·충돌 판정을 core 로 옮긴다 (`6113200`)
- **persistence** — 정규 JSON 과 저장 와이어를 core 로 옮긴다 (`1764714`)
- **brand** — rpgzzu 계열 식별자를 oprn 으로 치환한다 — 헤더·전역·텍스처 키·스크립트 이름 (`cb3b2b8`)
- **ai** — streamline routine edits and single-agent UI (`7c1ffaf`)
- **editor** — 리소스 후보 목록을 순수 모듈로 분리한다 (`9d43d4d`)
- **spatial** — 파라메트릭 집 구조 킷(kind:"house") 잔재를 제거한다 (`2e1f50f`)
- **editor** — 첫 화면과 「새 프로젝트」 다이얼로그를 하나의 선택 정본으로 합친다 (`bc2e5d8`)
- **css** — 이벤트 에디터 시트를 세대가 아니라 구성 요소로 묶는다 (`afe33cb`)
- **css** — 죽은 부모를 가진 이벤트 에디터 잔여 선택자를 지운다 (`a7e6c19`)
- **css** — 이벤트 에디터의 !important 를 레이어 순서로 대체한다 (`c330aa3`)
- **css** — 이벤트 에디터의 가려진 선언과 죽은 규칙을 지운다 (`b2975a7`)
- **css** — 이벤트 에디터 시트를 event/ 표면 디렉토리로 옮긴다 (`783d96e`)
- **css** — 표면 진입 시트와 레이어 선언으로 캐스케이드 순서를 고정한다 (`4762a31`)
- **css** — 다른 표면 파일에 들어 있던 셸·맵 규칙을 주인 표면으로 옮긴다 (`c9358bc`)
- **css** — 뒤 선언에 완전히 가려진 선언을 표면을 가리지 않고 지운다 (`dbe79f2`)
- **css** — 표면을 넘는 !important 를 overrides 레이어로 모은다 (`890e0f7`)

### 문서

- **openwiki** — 릴리스·버전 네 축과 절차를 적는다 (`c8dd013`)
- **openwiki** — regenerate INDEX after merging #847 (`f0abc1d`)
- **editor** — DB AI 검토 오버레이 위키 절 · 목업 · QA 하네스 · 증거 (`5879877`)
- **openwiki** — regenerate INDEX after merging #842-#844 (`80da3d5`)
- **openwiki** — regenerate INDEX after merging #838-#841 (`a197aee`)
- **perf** — 데이터베이스 맵 탭 로딩 측정 근거와 재현 스크립트 (`3f741b3`)
- 개명된 환경 변수·자격 파일 경로·파일 포맷 이름을 문서에 반영하고 옛 이름 호환 기간을 적는다 (`ee2ef7b`)
- **plan** — 저장소 포트 도입(P1) 실행 계획 — 동작 불변 (`df05341`)
- **openwiki** — 장소 탭 1·2차 UX 수리 실측 기록 (`96e8473`)
- **openwiki** — regenerate INDEX after merging #830-#834 (`619d005`)
- **spec** — 로컬 SQLite 프로젝트 저장소와 Electron 데스크톱 전환 설계 (`0511916`)
- **openwiki** — 옛 제품명과 개명된 스크립트 경로를 현재 이름으로 맞춘다 (`583d147`)
- **openwiki** — regenerate INDEX after 보고서 모달 (`f093dde`)
- **openwiki** — regenerate INDEX after 「대화|작업」 탭 + gates 가드 (`4e26e50`)
- **plan** — 팀원 패널 계획서 — 독립 데크(P1~P7)와 조수 데크 「대화|작업」 탭 A안 목업 (`fea9f44`)
- **openwiki** — 오프닝 미디어 배선과 좁은 창 함정 (`d10a217`)
- **evidence** — 실패 모드 보고서를 저장소에 넣는다 (`f1e266c`)
- **openwiki** — regenerate INDEX after #815-#819 merges (`6c92830`)
- **openwiki** — regenerate INDEX after #815-#818 (`5c5d6e0`)
- **openwiki** — regenerate INDEX after runtime-battle review section (`defed1a`)
- **openwiki** — runtime-battle — 2026-09-14 전투 UI/UX·모션 적대적 리뷰 후속 계약 절 추가, 낡은 수치 교정 (`1832073`)
- **openwiki** — regenerate INDEX after the worker-staleness note (`5384a32`)
- **openwiki** — regenerate INDEX after #813/#814 (`878d730`)
- **openwiki** — regenerate INDEX after change-ledger commit (`a9f2709`)
- **openwiki** — regenerate INDEX after the cloud shadow section (`650dc86`)
- **openwiki** — regenerate INDEX after PR sweep (#807-#812) (`53be456`)
- **openwiki** — 맵 배경 렌더 계약과 남은 경계를 적는다 (`18724a0`)
- **openwiki** — regenerate INDEX after #804 follow-up (`d1b9c74`)
- **openwiki** — regenerate INDEX after #804/#805 (`1b41f5f`)
- **openwiki** — regenerate INDEX after #782 (`f83b650`)
- **openwiki** — regenerate INDEX after #802/#803 (`9c380e1`)
- **openwiki** — regenerate INDEX after #792 follow-up (`10228f0`)
- **openwiki** — regenerate INDEX after #799/#800 sweep (`01f60f8`)
- **openwiki** — regenerate INDEX after ready PR sweep (`df6349a`)
- **openwiki** — 캔버스 렌더러도 받침 계약을 진다는 실측 결함을 남긴다 (`258120d`)
- **editor** — 스포이트 좌/우클릭 소유권 예외를 주석에 남긴다 (PR #761) (`c319ca2`)
- **openwiki** — 로케이션 레이어 어포던스 감사와 A 적용 기록 (`2379a8a`)
- **css** — TOKENS.md 를 tokens.css 실제 값과 레이어 표로 다시 쓴다 (`3e5ce1d`)
- **openwiki** — clear_map 계약과 허가 모달 예외를 기록한다 (`ce9bbb6`)
- **ai** — pending 사유 구분 계약 기록 + 판정 근거 (`7654751`)
- **css** — 에디터·DB 스타일 표면 격리 스펙과 실행 계획 (`f4afd7d`)
- **ai** — 팀 배정 계약과 2026-09-11 실측을 기록한다 (`45cce69`)
- **region-task** — 영역 작업 UI/UX 재설계 스펙 + 목업 4장 (`aa5d448`)
- **evidence** — NOTES 에 최종 커밋 목록 기록 (`5b2e210`)

### 테스트

- **tools** — 고스트 스토어 경계를 찍는 진단 프로브를 넣는다 (`bc620f9`)
- **e2e** — 고스트 게이트의 목업 라운드와 칩 계약을 현재 것으로 되돌린다 (`d8a508f`)
- **brand** — 옛 환경 변수·자격 파일 경로·파일 포맷·세이브 네임스페이스 이름을 가드에 넣는다 (`4c26339`)
- **persistence** — core 경계 가드가 여러 줄·부수효과·동적 import 도 잡는다 (`1f5eb1e`)
- **evidence** — gates 기준선 대비 판정 — merge-base 대조로 회귀 0건 확인 (`8416097`)
- **brand** — 탈-쯔구르 가드를 스윕한 이름으로 넓히고 scripts·test 도 훑는다 (`4a5162c`)
- **editor** — verify reviewed default places across projects and all builds (`0d1f61d`)
- verify default place across real preview projects (`3a642a7`)
- **ai** — 보고서 모달 QA 증거 — 1440/1920 지점 3곳 실캔버스 렌더 (`4623d3a`)
- **ai** — 「작업」 탭 브라우저 QA 증거 — 1440/1920 팀 실행·검토 스트립·단독 실행·스튜디오 상세 (`bd039e2`)
- **ai** — 조건 수리 기대값을 원래 계약으로 되돌린다 (`66a0d71`)
- **store** — 되돌리기 스냅샷 공백 명단을 양방향 래칫으로 고정 (`2ecdff7`)
- **scripts** — 변경 영향만 도는 vitest 래퍼와 실측 소요를 문서에 박는다 (`14f7158`)
- **ai** — 검수 재투입 계약만 재도록 모델 창을 분명히 한다 (`3cbf7db`)
- **ai** — 큰 위임 명세의 실브라우저 증거 — 이벤트 12·퀘스트 3·스위치 2를 한 번에 (`96f8f89`)
- **export** — 맵 배경 PNG 가 내보내기에 실리는 경로를 못박는다 (`f91d2f7`)
- **browser** — split the two page boots into two tests with one shared server (`2fd1a03`)
- **gates** — run browser tests in their own low-concurrency stage (`8450824`)
- **browser** — reuse a stable Vite cacheDir in the raster harness (`91cbe5d`)
- quarantine 156 permanently-red files (25% of vitest CPU) (`460d9bd`)
- **browser** — warm the harness module graph before the 30s ready deadline (`e9583a5`)
- **fixtures** — refresh house template baseline after restoring tier-front (`03ce810`)
- align switch-list expectations with item-driven switches and at-rule scan (`fbaecc5`)
- record integrated gates and final remote interior proof (`d43a451`)
- verify compact interior in current composition workspace (`1d08dbe`)
- confirm village survives later unrelated project save (`1eb80d5`)
- **ai** — 질문 발화 승격의 실표면 증거 스펙을 추가한다 (`00de336`)
- **editor** — 공통 지연 툴팁을 Escape 계층 게이트 면제에 사유와 함께 등록한다 (`5e385a5`)
- **ai** — Pi 전용 경로에서 세션 계약을 보던 두 테스트의 관찰점을 고친다 (`a44a95c`)
- **ai** — 되돌린 #750 배선을 검사하던 케이스를 걷는다 (`3ae0d20`)
- **css** — 픽셀 기준선에 컬렉션 탭·전문 모드·3페이지를 더하고 무음 건너뛰기를 없앤다 (`a2e5a17`)
- **css** — 셸·이벤트 에디터·DB 37탭 픽셀 기준선을 찍는다 (`85000dc`)
- **qa** — 최종 커밋 트리에서 증거 재수확 — 문구 오타 수정분 반영 (`edf54d0`)

### 되돌림

- PR #758 병합을 되돌린다 — 그 브랜치 자체가 빨간 상태다 (`a3c46bf`)
- 「슬래시 노브와 Pi 전용 컴포저」(#750 5063b6f42) 를 되돌린다 (`613bd62`)

### 잡무

- **qa** — main 에 #832 뒤 들어온 QA 스크립트 둘의 옛 저장 키를 oprn 으로 맞춘다 (`88902a1`)
- 직렬화 주석과 커뮤니티 interop 증명이 현재 패키지 확장자 .oprn 을 말하게 한다 (`9b60c1d`)
- **evidence** — 맵 배경 렌더 전/후 샷과 실측 수치를 남긴다 (`d3c1e3c`)
- **surface** — regenerate event-editor baselines after #777 switch defs (`5394474`)
- **gates** — refresh baseline after ready PR sweep (`cf856db`)
- **evidence** — canonical 대조 샷과 실제 runTool 호출 결과를 남긴다 (`30f3a91`)
- **evidence** — 공간 설계 활성화 버튼 브라우저 캡처를 남긴다 (`361a00e`)
- **evidence** — 상점 수정 후 재실행한 런타임 리포트 요약 갱신 (`227a1a6`)
- **evidence** — 나무 밑동 검은 구멍 수정 전/후 샷과 실측을 남긴다 (`4d5782a`)
- **evidence** — 리베이스 후 브라우저 QA 재실행 샷으로 갱신한다 (`82e1944`)
- **css** — event 표면의 R2·R3·R5 를 실패로 승격한다 (`6a5a23f`)
- **css** — main 병합으로 들어온 database 신규 R2 지문 4건을 기준선에 기록한다 (`11a14f6`)

### 기타

- Add distinct inn and shop interiors and reduce household curtains (`a3109c9`)
- Record interior activity-zone full gate comparison (`e54ea55`)
- Compose reviewed homes from reusable interior activity zones (`aa9843f`)
- Redesign interior catalog with varied footprints and room programs (`858f254`)
- 수납장 상단을 벽면에 겹쳐 배치하도록 지원 (`de2b897`)
- 작은 집 가구를 주방 식사 수면 용도별로 재배치 (`a864b56`)
- 연결된 실내 벽 최종 검증 결과 기록 (`b6ea5d2`)
- 실내 방 평면에서 외벽과 칸막이를 함께 생성 (`ef81473`)
- 분할 실내 최종 회귀 검사와 원격 재조회 기록 (`5f3ea24`)
- 작은 집에 침실 칸막이와 출입구 추가 (`2218f3e`)
- Build compact villages from saved exterior objects (`29ec4fc`)
- Add reserved organic village lake planning and atomic painting (`8e36cec`)
- Author twelve compact plaster and stone village houses (`6a349e8`)
- Add read-only authored village tile capture and inspector (`eddd28e`)
- Publish and verify thirty distinct reusable house exteriors (`765aa50`)
- Add ten distinct single-storey house exteriors for house 30 (`0dd27d8`)
- Register connected house catalog and stage village construction (`657656a`)
- Hide exterior validation status until input needs correction (`200ccc6`)
- Clarify spatial kinds and select building exterior graphics (`c44e4e5`)
- Clarify canonical house discovery and spatial AI authoring (`604ecd6`)
- agent worktree base for sidebar-compact (`4433ad1`)
- agent worktree base for item-effects-audit (`833e869`)

> 이전 3587건은 생략했습니다. 전체 이력은 `git log` 를 보세요.
