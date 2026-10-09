> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Stardew-like Core Elements Research

Research snapshot: 2026-08-25

This page records the product-model findings used to scope the Stardew-like editor and runtime work. It is not a request to reproduce Stardew Valley content, names, art, or exact balance. The useful reference is the way independent activities are connected by a shared day, calendar, economy, relationship state, and long-term goals.

## Primary finding

`crops`, `characters`, and `collections` are all relevant, but they are not three isolated pillars. The recognizable loop is:

1. Start a day with a date, weather, energy budget, forecast, and upcoming calendar events.
2. Choose among farming, animal care, social visits, fishing, foraging, mining/combat, and errands.
3. Convert limited time and energy into items, friendship, skill experience, unlocks, and money.
4. Process, donate, bundle, keep, gift, or ship those items.
5. Sleep to settle shipping, machines, crops, animals, schedules, weather, saves, and the next morning.

The editor should therefore present authoring domains in player-language rather than expose sparse schema nouns.

## Evidence-backed pillars

### 1. Day, energy, and overnight settlement

- A playable day runs from 6:00 to 2:00, with sleep advancing the day and the game saving after overnight settlement.
- Energy constrains productive actions and sleep restores it, with late/exhausted sleep penalties.
- This is the integration spine: weather, watering, crop growth, shipping, makers, animal production, skills, and save behavior must advance exactly once in a deterministic order.

### 2. Calendar, seasons, and weather

- Four 28-day seasons rotate crops, forage, fish, visuals, festivals, birthdays, shop stock, and some NPC schedules.
- Rain changes the player's optimal plan because outdoor crops are watered automatically and the forecast makes tool-upgrade timing legible.
- Calendar and weather are not decorative HUD data; they are availability rules and planning information.

### 3. Farming, animals, and processing economy

- Crops require planting, daily watering, growth, harvest, quality, seasonal validity, and reinvestment.
- Farm animals require compatible housing, capacity, daily feed/care, friendship, and product collection.
- Makers turn raw goods into more valuable artisan goods over time. Buildings, upgrades, tools, recipes, and sprinklers reduce friction and expand throughput.

### 4. Town life and relationships

- Villagers have time/day/season-sensitive schedules.
- Talking, gifts, gift preferences, birthdays, quests, and festivals change friendship.
- Friendship unlocks dialogue, mail, recipes/gifts, access, and authored relationship events. A resident record without schedule, calendar, preferences, and event hooks feels empty.

### 5. Parallel activity loops

- Fishing is location + season + weather + time availability combined with a skill action and a catch result.
- Foraging periodically repopulates valid world locations with season-dependent items.
- Mining/combat supplies ore, geodes, artifacts, monster drops, depth progression, checkpoints, and equipment pressure.
- These loops share energy, time, inventory, skills, economy, bundles, museum, and collections, so their value comes from cross-system use rather than isolated minigames.

### 6. Long-term goals and completion surfaces

- Community bundles turn diverse outputs into room/world restoration rewards.
- The museum accepts one of each eligible artifact/mineral and grants milestone or item-specific rewards.
- Collections record discovery, shipping, catches, and donations.
- Skills reward repeated play with recipes, proficiency, and profession choices.
- These surfaces give otherwise optional daily activities direction without forcing a single linear solution.

### 7. Personal ownership

- Farm buildings, house upgrades, furniture, wallpaper/flooring, paths, and character/farm naming make progress visibly personal.
- Placement needs footprint, obstruction, rotation, move/remove, capacity, upgrade, and persistence rules rather than being a static image field.

## Editor information architecture implication

Current source at `src/editor/panels/database.ts` already moved away from the ambiguous older labels:

- Group: `생활`
- `농사·작물`
- `주민 관계`
- `생활 기술·제작`

If a running build still shows `수집 / 작물 / 캐릭터`, it is stale relative to the checked-out source and should be rebuilt/reloaded before judging the current IA.

The next expansion should keep stable internal tab ids while using these player-facing areas:

- **농장 생활:** crops, animal species, animal homes, tools, sprinklers, makers, farm buildings.
- **마을과 인연:** residents, schedules, birthdays, gift tastes, dialogue/event hooks.
- **계절과 세계:** calendar, weather tables, festivals, fishing pools, forage tables.
- **수집과 성취:** bundles, museum donations/rewards, collection categories, unlocks.
- **성장과 경제:** skills, recipes, upgrades, prices, shipping, processing.

## Delivery priority

### P1: make the world feel alive

1. Deterministic daily weather and forecast integrated into the overnight transition.
2. Calendar/birthday visibility and NPC schedule/reference integrity.
3. Farm animal species, compatible buildings/capacity, feed/pet/produce, save/load, and runtime UI.
4. Authored starter content rich enough to exercise the loop, followed by LegacyDb save and project-id reload proof.

Implementation note (2026-08-25): `createFarmingDemoProject` now authors four seasonal weather tables with a three-day forecast, scheduled resident routines, feed/egg/milk items, chicken/cow species, one compatible farm-animal building, and two event-bound starting animals. `scripts/save-stardew-demo.mts` treats all of these counts as mandatory save/reload facts rather than optional showcase fields.

### P2: make daily choices converge on goals

1. Deterministic fishing availability and catch resolution. **Implemented in the P2 foundation (2026-08-25).**
2. Seasonal forage spawning and respawn/cleanup rules. **Implemented in the P2 foundation (2026-08-25).**
3. Unified discovered/shipped/caught/donated collection state. **Implemented in the P2 foundation (2026-08-25).**
4. Museum exact-once donations and rewards. **Implemented in the P2 foundation (2026-08-25).**
5. Farm-building footprint/capacity/upgrade placement.
6. Home decoration placement, rotation, move/remove, and persistence.

Mining/combat remain a core pillar, but this repository already has a battle/runtime foundation. P1-P2 should connect that foundation to the shared day, economy, items, skills, collections, and goals rather than replace it.

## Implementation invariants

- Forecasting and previews must not consume gameplay RNG.
- Day-bound effects must be keyed and idempotent; repeated calls cannot duplicate money, growth, products, donations, or rewards.
- Inventory and currency mutations must be atomic on failure or overflow.
- Authored IDs must participate in global reference validation, rename, deletion impact, repair, load/save, and migration.
- Editor writes authored project data; runtime writes session state.
- Visual acceptance uses 1024x768 and 1440x900 browser evidence.
- Authored game content is incomplete until it is saved to LegacyDb and reloaded by project id.
- Each phase receives focused tests, an independent hostile review, visual QA, and supervisor-run gates.

## Sources

- [ConcernedApe: official feature overview](https://www.stardewvalley.net/dev-update-25/)
- [ConcernedApe: Community Center design](https://www.stardewvalley.net/dev-update-19/)
- [Stardew Valley Wiki: Getting Started](https://stardewvalleywiki.com/Getting_Started)
- [Day Cycle](https://stardewvalleywiki.com/Day_Cycle)
- [Seasons](https://stardewvalleywiki.com/Seasons)
- [Calendar](https://stardewvalleywiki.com/Calendar)
- [Friendship](https://stardewvalleywiki.com/Friendship)
- [Animals](https://stardewvalleywiki.com/Animals)
- [Farming](https://stardewvalleywiki.com/Farming)
- [Fishing information](https://stardewvalleywiki.com/Fishing_Information_Broadcasting_Service)
- [Foraging](https://stardewvalleywiki.com/Forage)
- [The Mines](https://stardewvalleywiki.com/The_Mines)
- [Bundles](https://stardewvalleywiki.com/Bundles)
- [Museum](https://stardewvalleywiki.com/Museum)
- [Collections](https://stardewvalleywiki.com/Collections)
- [Skills](https://stardewvalleywiki.com/Skills)
- [Carpenter's Shop and farm buildings](https://stardewvalleywiki.com/Carpenter%27s_Shop)
- [Farmhouse customization](https://stardewvalleywiki.com/Farmhouse)
