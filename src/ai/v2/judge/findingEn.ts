// 관문 문제의 모델용 영어 글 — 규칙(·갈래)마다 한 줄: 무엇이 틀렸나 + 고치는 호출. 값싼 모델은 영어 피드백을 더 잘 따른다(2026-10-30 「모델에게 가는 글은 영어」).
// 보고·장부·화면에는 한국어 줄(Finding.ko)이 그대로 실린다 — 이 표는 할 일 항목의 en 으로만 간다. 우리가 쓰는 글은 ASCII 만이고,
// 프로젝트의 이름(「별의 봉인」)은 자료라 저장된 그대로 «» 안에 id·칸과 같이 싣는다 — id 만 주면 모델이 누구인지 알려고 조회부터 한다.
import type { Project } from "@/project/types";
import type { Finding } from "./finding";

/** 게임 검사 — 열쇠는 표지의 주제(와 갈래). */
const GAME: Readonly<Record<string, string>> = {
  "날씨": "[game weather] The request asks for rain, snow or weather, but no changed event has a real weather command (a screen tint is not rain). Add a weather beat with add_event, or upsert_event with {kind:'setWeather',weather:'rain',intensity:0.6}.",
  "화면/shake": "[game screen-shake] The request asks for shaking or an earthquake, but there is no screen-shake command (a camera move is not a shake). Add a shake beat with add_event: {do:'shake',strength:'strong',axis:'vertical'}.",
  "화면/flash": "[game screen-flash] The request asks for a flash or lightning, but there is no screen-flash command (a fade-out is not a flash). Add a flash beat with add_event: {do:'flash',color:'white'}.",
  "화면/letterbox": "[game letterbox] The request asks for black bars (letterbox), but no changed event has a letterbox command; cutscenes do not add bars by themselves. Put a letterbox beat {do:'letterbox',show:true,size:12} first in add_scene/script_cutscene, or {kind:'m2Command',commandId:'m2-202-screen-effect',fields:{effect:'letterbox',value:12,durationMs:400}}.",
  "효과음": "[game sound-effects] The request asks for sound effects, but no cue has a sound. Whole style: set_game_audio{role:'sfx-style', style}. One cue: store_find_sound, then store_install, then set_game_audio{role:'se', cue, resourceId} (a sound already in the project: list_resources{kind:'se'}).",
  "음악/none-set": "[game music] The request asks for music/BGM, but no slot has a track. Set map, battle, boss, victory, title and ending tracks with set_game_audio (if no track fits: store_find_music, then store_install without asking). Only a short change inside a scene uses an add_event music beat {do:'music',action:'bgm',query:'festival'}.",
  "음악/chase-on-battle": "[game chase-music] The chase track was set on every battle (battle-default). Set it with set_game_audio role:'chase' (+mapIds) so it plays while the chaser is active, and put the battle track back. If there is no chaser, keep the track installed and say so in the report.",
  "상점": "[game shop] The request asks for a shop that buys and sells, but no changed event has a shop command (kind:'shop'). Attach one to the NPC with set_shop_stock, or on a time-of-day page add {kind:'shop',goods,allowSell:true} to the open-hours page.",
  "시간": "[game schedule] The request has a person whose place or action changes by time of day, but there is no schedule (set_npc_schedule) and no time-phase page ({kind:'timePhase'} condition). Turn on configure_time_system and set the day and night spots with set_npc_schedule.",
  "이동/duplicate-doors": "[game duplicate-doors] One map has several separate doors to the same destination map: a door added now duplicates one the builder already linked. Keep only the door at the requested spot and remove the others with remove_event (and their paired door on the other map).",
  "이동/no-way-in": "[game no-way-in] A new map has no door or transfer leading into it from any map, so the player cannot go there. Link it with create_transfer_pair (a house door or the village edge).",
  "장소": "[game place] The request asks for a forest or field, but field enemies were put on an existing map and no new map was built. Build that map with author_forest_route (forest; a field is terrain:'field'), link it at the map edge, and place the enemies there.",
  "반복": "[game repeat-reward] An event page gives an item, gold or another reward without turning on a switch or self switch, so it gives again on every talk. For a one-time reward turn on a self switch and add an 'already received' page under that condition (patch_event_page or upsert_event).",
  "조우/table-unchanged": "[game random-encounters] The request asks for random encounters, but no map's encounter table changed. Add enemy groups and a rate to that map with set_encounter_table (visible enemy events are not random encounters).",
  "조우/unasked": "[game unasked-encounters] The request does not ask for random encounters, but they were turned on for a map; unrequested encounters wear the party down. Turn them off with set_encounter_table{mapId, entries, encounterRate:0}; if a fight is needed use a visible enemy (place_field_enemy) or an event battle. If it was intended, say so in the report.",
  "전투/none": "[game battle] The request has monsters or enemies to fight, but this turn added no battle (battleProcessing) and turned on no encounter. Create them with upsert_enemy and upsert_troop and place them on the map with place_field_enemy (author_forest_route result data.maps[i].enemySpots are enemy spots; avoid clearing, deadEnds and entrance cells).",
  "전투/unwinnable": "[game unwinnable-battle] An event battle was simulated 20 times with the starting party and never won; if the player cannot level up before it, the game is stuck. Lower enemy HP and attack with upsert_enemy (check a 40-80% win rate with simulate_battle), or set canLose:true if the story battle is meant to be lost.",
  "엔딩/no-trigger": "[game ending] The request asks for an ending, but there is no triggerEnding command (narration plus return-to-title is not an ending). Define it with define_ending and put {kind:'triggerEnding',endingId} in the branch.",
  "엔딩/no-definition": "[game ending-definition] A triggerEnding command exists, but no ending is defined. Define it with define_ending.",
  "엔딩/epilogue-speaker": "[game epilogue-speaker] An ending's epilogue line starts with a 'Name:' prefix, so the script header shows on the ending card. With define_ending, remove the name from the body and put it in the say beat's speaker; use context:'narration' for scene description.",
  "엔딩/act-end": "[game act-end] The request asks for an 'end of act' screen, but no changed event has a real ending command; a dialogue line alone lets the game go on. Call define_ending{id:'ending_act1',presentation:{finalTitle,badge}} and put {kind:'triggerEnding',endingId:'ending_act1'} at the end of that scene.",
  "상태": "[game status-effect] The request asks for a status effect such as poison or paralysis, but no command applies a real state (a sound, flash or HP loss alone is not poison). Add {kind:'m2Command',commandId:'m2-019-change-state',fields:{target:'party',operation:'add',value:'state_poison'}}.",
  "물건": "[game item-prompt] An item-choice window (presentItem) opens even when the player does not have the item. Put the condition {kind:'item',itemId,present:true} on that page and let the normal dialogue page show when the item is missing.",
  "연계기": "[game combo-tech] The request asks for a combo technique, but no new combo record exists (an ordinary skill does not appear under the Combo command). Create it with upsert_combo_tech{id:'skill_combo_...', name, actorIds:[two actors], mpCosts, scope, power}; if an actor is not in the party, add them with set_party.",
  "사람 자리": "[game npc-in-road] A person stands and talks in the middle of a road or rail track. Move them with move_event to a sidewalk, a shop door, beside a bench or a plaza; for a wandering person set movement to fixed or keep them on the sidewalk.",
  "길막": "[game blocked-exit] An event blocks the one-cell path to an exit, so the player cannot leave the map. Move it with move_event two or three cells away onto open floor, and change wandering to fixed.",
  "카운터": "[game shop-counter] A shopkeeper is not behind the counter. Move them with move_event to the cell directly north of the counter, facing down, so the player talks across the counter.",
  "출입구/misplaced": "[game entrance-on-prop] An entrance (transfer) sits on a prop or furniture cell. Move it with move_event to the empty floor next to it (the cell in front of the stairs or door), or remove that prop with tile_erase.",
  "출입구/no-art": "[game entrance-no-art] An entrance has no cave-mouth or door art above it. Find one with list_spatial_designs{kind:'object',query:<cave entrance or door word>} and stamp it right above the entrance with stamp_object. If no art exists, write 'no entrance art' in the report.",
  "물건 자리": "[game examine-spot] An examine event is not on the cell of the object its name refers to. Move it with move_event onto that object's cell (for tall furniture, the bottom front cell).",
  "다리/dry-bridge": "[game dry-bridge] A bridge does not touch water; it looks like a bridge over dry ground. Turn those bridge cells back into floor with tile_erase, or move the bridge to where it crosses water.",
  "다리/dry-boat": "[game dry-boat] A boat stands on ground that is not water. Remove it with tile_erase and stamp it again fully on water cells, or rebuild the area with edit_place.",
  "방 쓰임": "[game room-purpose] A room holds furniture of another room type (a living-room set) that does not fit its purpose. Remove it with tile_erase and stamp furniture for that purpose with stamp_object (chapel: pews, candles; shop: shelves, counter; classroom: desks; clinic: beds), using onOverlap:'replace'|'nearest' on overlap, or redo the room with edit_place.",
  "깃발/undeclared": "[game undeclared-flags] Events use switches or variables that are not declared. Declare them with declare_story_flag, or use the id of a flag that is already declared.",
  "깃발/unread-switch": "[game unread-switch] A switch is turned on but no page or branch reads it. If it is a one-time gate, add an 'already done' page with that switch as its condition; if the flag is not needed, remove it.",
  "깃발/unread-variable": "[game unread-variable] A variable is changed but never read. Use it in a condition or branch, or remove it.",
  "깃발/self-switch": "[game self-switch] An event turns on a self switch but has no page with that self switch as its condition. Add an 'already done' page under that self-switch condition.",
  "깃발/unused": "[game unused-flags] Flags are declared but never used. Use them or remove them.",
  "끊긴 고리": "[game broken-chain] A command dropped from an event edited this turn made later content unreachable. Put the missing command (invite, switch on, common-event call) back on the new page; if it was removed on purpose, delete its condition page too and say so in the report.",
  "보임/bare-ground": "[game invisible-examine] An examine event has no graphic and no object tile on its cell, so the player sees bare ground. Find an object with list_spatial_designs{kind:'object',query:<object word>} and stamp it on that cell or the cell above with stamp_object, or move the event in front of an existing object with move_event.",
  "보임/blank-page-talks": "[game blank-page-talks] An event's default page has no graphic but speaks, so pressing the action key on empty floor shows dialogue before the person appears. Empty that page's commands, or keep the dialogue only on the visible page.",
  "선택지": "[game choice-notes] A choice option shows authoring notes to the player (ending or day-passing tags). Remove those tags from the option text; the scene after the choice shows the result.",
  "메뉴": "[game menu] A battle (battleProcessing) was added, but the ESC menu is the no-battle story menu, so skills, equipment and status cannot be opened. Restore it with configure_field_menu{preset:'default'}, or add skills, equipment and status with a custom menu.",
  "HUD": "[game hud-vitals] The field HUD always shows health, but nothing in this game reduces health (no battle, damage command or encounter). Turn the body gauges off with set_field_hud{theme, vitals:false}; if health matters, add something that deals damage and explain it with set_life_flower.",
  "시작": "[game instant-ending] Pressing only the confirm key right after the start ends the game. Move the ending choice to the last option (the first option continues), move the start cell away from that event with set_start_position, or put the ending on a switch-condition page reached after the earlier steps.",
  "퍼즐/skippable-clue": "[game puzzle-skippable] The puzzle reward can be taken before the clue is read. On the page before the clue remove the reward option and leave only a 'need a clue' line; keep the reward only on the page whose condition is the clue switch.",
  "퍼즐/unread-clue": "[game puzzle-unread-clue] The puzzle event does not read the clue's switch, so it can be solved without reading the clue. Make the puzzle's first page a 'need a clue' line only and move the answer choice and reward to the next page, with the clue switch as its condition.",
  "퍼즐/idle-gate": "[game puzzle-idle-gate] The cell a mechanism opens is not the only way through. Seal the other routes (wall gaps, side passages) with seal_locked_room so that cell is the only path, or put the mechanism on the real single path before the boss room.",
  "퍼즐/weak-lock": "[game puzzle-weak-lock] The lock's answer can be guessed. Change it to a number only the clue gives (a date, clock hands, page numbers joined) and fix the clue text to match; for a choice, do not put the right answer first (author_puzzle_chain shuffles automatically).",
  "퍼즐/lock-tells-answer": "[game puzzle-answer-leak] The lock's own dialogue gives the answer away. Remove the answer from the lock text, keep it only in the clue (diary, note), and accept input only on the page whose condition is the clue-read switch; author_puzzle_chain builds it in this order.",
  "위협/slow-chaser": "[game slow-chaser] A chaser is too slow to threaten the player. Set the chase page movement to speed 6 or more and frequency 8 (the make_chase_scene defaults), or approachStyle dash or swoop. If a slow chase is intended, say so in the report.",
  "위협/vanishing-chaser": "[game vanishing-chaser] Hiding once makes the chaser disappear for good. If hiding should only let it pass this time, turn that switch off again (setSwitch false after leaving the hiding spot, or on leaving the map); if permanent removal was requested, say so in the report.",
  "위협/no-chase": "[game no-chase] The request asks for sight, chase or patrol, but no changed event has chase movement (movement.type 'chase'), a patrol route or sight. Create a real chaser with make_chase_scene{mapId, chaser, patrol:{mode:'auto'}} (or add a route with configure_npc_patrol); if it cannot be built, write 'no chase' in the report.",
  "위협/unsafe-spawn": "[game unsafe-spawn] The player starts or respawns within the chaser's reach. Put the chaser out of sight (behind a wall, in another room), move the start with set_start_position, or move the checkpoint to before the chase area.",
  "카메라": "[game camera-zoom] An autorun event only sets the map camera zoom. Put the default zoom on the map with set_map_properties{mapId, zoom} and delete that event; keep only brief in-scene zooms as staging commands.",
  "잠긴 방": "[game locked-room-bypass] A locked room can be entered without its door. Seal the other ways in (wall gaps) with seal_locked_room{mapId, eventId}, or rebuild the whole puzzle with author_puzzle_chain.",
  "글": "[game placeholder-text] Placeholder text is shown on screen as written. Replace the hero-name placeholder with the real name (or \\N[1]) and literal '\\n' characters with real line breaks.",
  "동료": "[game follower-not-in-party] A companion follows as a sprite but is not in the party (not in the menu). If the story says they join, create the actor with upsert_actor and add both {kind:'changeParty',actorId,action:'add'} and {kind:'addFollower',actorId} (or add_companion). If they only tag along briefly, say so in the report.",
  "맵": "[game duplicate-map] Two maps have the same name and role. Keep one, point the doors to it, and delete the other with remove_map (if it cannot be deleted, rename it to split the roles).",
  "대사": "[game daily-dialogue] The request asks for dialogue that changes every day, but these people have fewer than three lines split by the day variable. Add day-variable condition pages (day 1, day 2, day 3+) to each person's event; keep affection-stage pages separate.",
  "순서": "[game story-order] The request says this happens AFTER an earlier task, but the ending or act-end scene is on an unconditional page and fires on first talk or touch. Let the earlier task's event turn on a switch (declare_story_flag) and move this scene to a higher-numbered page with that switch condition; keep a 'not yet' line on the page before it.",
  "회상": "[game flashback] The request asks for a flashback shown on screen, but the changed event only tints the screen while a present-day character narrates. Stage it with add_event{kind:'cutscene',when:'talk',after:<person>,beats:[{do:'tint',tone:'sepia'},{do:'appear',who:<past person>},{do:'walk'},{do:'say',who:<past person>},{do:'vanish',who:<past person>},{do:'tint',tone:'clear'}]}.",
  "시계/night-by-tint": "[game clock-night] The time system is on and the HUD clock runs, but night is made only with a switch and a screen tint, so the clock still shows morning. Add {kind:'setTime',hour:24,minute:0} to the branch that turns to night and {kind:'setTime',hour:6,minute:0} to the one back to day, or turn the clock off with configure_time_system{enabled:false}.",
  "시계/double-day-count": "[game double-day-count] The time system's HUD calendar runs and days are also counted in a variable, so the on-screen date and the 'day N' in dialogue and endings drift apart. Use one: keep the variable and turn the calendar off with configure_time_system{enabled:false}, or delete the variable and count days with set_deadline_ending.",
  "오프닝": "[game default-opening] A new game was made, but the project's default opening is still on, so the first screen tells an unrelated story. Replace it with a few scenes of this game's story using plan_opening/set_opening, or set_opening{enabled:false} if no opening is wanted.",
  "타이틀 모양": "[game title-style] The title screen's logoStyle and menuStyle are both empty, so it looks like every other game. Choose with set_title_screen{logoStyle:'gold'|'metal'|'stone'|'glow'|'plain', menuStyle:'window'|'plain', logoSubtitle} to fit the story.",
  "크기": "[game sprite-scale] An event graphic is drawn much larger than the party sprite; an enlarged chip looks like another resolution. Unless it is a boss, remove graphic.scale (or set it to 1) with patch_event_page; for a big body pick a boss graphic that has large art.",
  "그림": "[game sprite-mismatch] An event's walking sprite does not match its name. Pick a matching cell with list_npc_graphics{query:<age, kind or clothing word>} and change graphic with patch_event_page; if none fits, keep the closest and call generate_walk_chip for that event.",
  "얼굴": "[game face-mismatch] A dialogue face does not match the speaker's name. Choose a matching face from list_resources{kind:'faceset', query:<age or kind word>} and change changeFace; if none fits (doll, machine, ghost), clear it with changeFace resourceId:''. Do not borrow another character's face.",
  "타이틀": "[game title-backdrop] The title background shows a modern city skyline, but this game is not modern. Read the descriptions from list_resources{kind:'backdrop', query:<place or mood word>} and redo set_title_screen{backgroundResourceId, backgroundLayers:[]}; if nothing fits, use a plain sky without a city and say so in the report.",
  "주인공": "[game hero-sprite] The hero still uses the editor-default fantasy swordsman sprite, which does not fit this game. Read list_npc_graphics{query:<hero age, gender or outfit word>} and set upsert_actor{id, characterResourceId, characterIndex, faceResourceId}; with no battles, also clear weapon and shield in initialEquipment.",
  "부작용/battle-data": "[game side-effect battle-data] Battle data of an existing actor or class was emptied, which the request did not ask for; hiding it from menus is not deleting data. Restore the original values (upsert_actor or upsert_class); hide menu rows with configure_field_menu{preset:'story'} and the health display with set_field_hud{off:true}.",
  "부작용/look": "[game side-effect look] An existing event's graphic or face changed without being asked. Put the original graphic and face back.",
  "부작용/event": "[game side-effect deleted-event] An existing event was deleted without being asked, so its scene and dialogue are gone. If it is unrelated to the request, bring it back exactly with restore_event{eventId} (do not rewrite it from memory); if it was replaced on purpose, say what and why in the report.",
  "부작용/record": "[game side-effect record] An existing database record was changed without being asked, which changes values game-wide. Revert it if it is unrelated to the request; if the change was needed for the request, keep it and say what and why in the report.",
  "전투 난이도": "[game first-area-difficulty] In simulation the random encounters of the first battle area are too strong for the starting party. Lower enemy HP and attack with upsert_enemy so the party usually wins with HP to spare, or move those troops to a later map (or conditions.minPartyLevel); keep the encounter rate at 6-10 and check again with simulate_battle{troopId, heroLevel}.",
  "기술": "[game weak-paid-skill] A skill that costs MP is weaker than a free skill, so there is no reason to use it. With upsert_skill raise its power at least 10% above the free skill, or give it another use (element, status effect, multiple targets).",
  "적 개성/flat-boss": "[game boss-identity] A boss has no skill of its own that the map's ordinary enemies lack (basic attack only, or the same skills as its minions). Change its skills with upsert_enemy{enemy:{id, skillIds:[...], actions:[...]}} using existing skill ids; call upsert_skill only if no existing skill fits.",
  "적 개성/same-mobs": "[game enemy-identity] Ordinary enemies on one map share the same skills; each enemy kind needs one skill the others lack. Change them with upsert_enemy{enemy:{id, skillIds:[...], actions:[...]}} using existing skill ids; call upsert_skill only if no existing skill fits.",
  "전투 세기": "[game field-battle-strain] A newly placed visible field enemy is too strong for the starting party (it can lose, one fight costs too much HP, or the chain of fights drains the party). Change the event's troopId to a troop the party beats, or make a one- or two-enemy troop with upsert_troop and confirm with simulate_battle (win 100%, HP loss 35% or less), or place fewer; for a story-strong enemy put a recovery point before it and say so in the report.",
  "실행": "[game nothing-changed] This request changed no map or data. Do not stop to ask, or to say a tool is missing or a call limit was reached (there is no call limit): do the work. Build places and rooms with make_place (rooms: fill zones[].design); edit existing NPCs and objects with move_event, upsert_event, patch_event_page; create new ones with add_people, add_event, upsert_event. If no art fits exactly, use the closest and note it in the report.",
};

/** 출하 차단 — 열쇠는 차단 id(와 갈래). */
const SHIP: Readonly<Record<string, string>> = {
  "no-healing": "[ship no-healing] The game has battles but no way to recover HP, so lost HP stays lost and the boss becomes an endless game over. Call build_blueprint_path again (it adds a healing spring and 3 starting potions on the start map), or add an inn (recoverAll), sell potions (item_potion) with set_shop_stock, put place_chest{contents:{itemId:'item_potion'}} or place_savepoint{heal:true} before the boss, or give a companion skill_heal.",
  "art-generation/title": "[ship art-generation] The title picture is an in-game map view although pictures can be generated. Make one with generate_art{target:\"title\", prompt:<a scene of this story>}. A map view is accepted only after generation failed with an error.",
  "art-generation/ending": "[ship art-generation] An ending picture is an in-game map view. Make one with generate_art{target:\"ending\", prompt:<the ending scene>}. A map view is accepted only after generation failed with an error.",
  "requested-feature-missing/chaser": "[ship requested-feature-missing] The request asks for a chaser, but the game has none. Use make_chase_scene to add a chaser that patrols and chases on sight (pursuit, hidingSpots, killOnTouch).",
  "requested-feature-missing/darkness": "[ship requested-feature-missing] The request asks for darkness (lighting), but no map is dark. Darken the stage map with set_lighting_volume{mapId, ambient:0.8-0.9, sources:[{at:{kind:'player'}, radius:3-4}]}.",
  "requested-feature-missing/hiding": "[ship requested-feature-missing] The request asks for hiding spots, but the game has none. Put visible furniture (locker, wardrobe, closet) on a cell with place_object or draw_object and make that cell a hiding spot with configure_object_behavior{kind:'hiding'} or make_chase_scene hidingSpots. An invisible spot on bare floor does not count.",
  "requested-feature-missing": "[ship requested-feature-missing] A feature the request asks for is missing from the game. Build it now with the matching tool (chaser: make_chase_scene; darkness: set_lighting_volume; hiding spots: configure_object_behavior{kind:'hiding'}).",
  "chaser-no-hiding": "[ship chaser-no-hiding] A map has a chaser but no hiding spot, so the player cannot escape. Make wardrobe, locker, bed or curtain cells hiding spots with make_chase_scene hidingSpots or configure_object_behavior{kind:'hiding'} (2-14 steps from the patrol route); if there is no such furniture, add one with place_object.",
  "blueprint-missing": "[ship blueprint-missing] This game has no blueprint. Write it with write_blueprint: the new player's goal in one line, the core path from start to ending (places, events, conditions) and the ending, using the names as built.",
  "blueprint-place-missing": "[ship blueprint-place-missing] A blueprint step names a place that has no map. Build it, or if it was built under another name fix the step's place with write_blueprint.",
  "blueprint-place-unreachable": "[ship blueprint-place-unreachable] A blueprint step's map cannot be reached on foot from the start map through doors and paths. Link it to the previous step's place with create_transfer_pair.",
  "blueprint-event-missing": "[ship blueprint-event-missing] A blueprint step's event does not exist on its map. Add an event that performs the step, or if it has another name fix the step's event with write_blueprint.",
  "blueprint-event-empty": "[ship blueprint-event-empty] A blueprint step's event has no commands. Add the dialogue, choice and result that perform the step (patch_event_page or upsert_event).",
  "blueprint-event-unreachable": "[ship blueprint-event-unreachable] A blueprint step's event has no walkable cell next to it (a wall or another event blocks it), so the player cannot use it. Move it with move_event next to walkable floor, or remove what blocks it.",
  "blueprint-condition-unset": "[ship blueprint-condition-unset] A blueprint step's page requires a switch, item or variable that no event in the game ever sets or gives. Make the previous step's event set or give it in its result (patch_event_page).",
  "blueprint-condition-order": "[ship blueprint-condition-order] A blueprint step's condition is only set by a later step. Fix the order so an earlier step sets it.",
  "blueprint-no-ending": "[ship blueprint-no-ending] The last blueprint step does not call the ending. Connect the ending to that event, or to an autorun event opened by the switch it turns on ({kind:'triggerEnding',endingId}).",
  "blueprint-code-bypass": "[ship blueprint-code-bypass] A blueprint step is a number or password puzzle, but examining it moves on without solving anything. Require the right input before the result: keep the answer input and the result on a page gated by the clue (author_puzzle_chain builds this order).",
  "blueprint-battle-bypass": "[ship blueprint-battle-bypass] A blueprint step is a fight to win, but the story moves on without winning. Call build_blueprint_path again: it gates the step on the boss battle's victory switch (or fights inside this event and continues only on the win branch).",
  "blueprint-escape-leak": "[ship blueprint-escape-leak] In an escape-room blueprint an unconditional transfer leads out to a map that is not a blueprint place, so the locked room is left without solving the puzzle. Remove that transfer (remove_event) or gate it on the puzzle's switch.",
  "blueprint-stray-copy": "[ship blueprint-stray-copy] A copy of a blueprint step event also exists on another map and fights or calls the ending there: a shortcut that skips the step's own map. Remove the stray copy with remove_event and keep the one on the step's own map.",
  "maps-min": "[ship maps-min] Too few counted maps. Build new places with make_place{spec:{type:\"village\"|\"dungeon\"|\"interior\", name}} (in a world-blueprint game: build_places{add:[{name, kind, from}]}), link each by a door with create_transfer_pair and give it a person or an examine event. A map counts when doors reach it from the start, it is large enough (interior 10x10 or more) and it has its own layout. After adding doors do not call build_blueprint_path again.",
  "quests-min": "[ship quests-min] Too few counted quests. A quest counts with 2 or more steps, each with its own label, and a unique title: create_quest{def:{key:\"q_<ascii>\", title, order:\"sequence\", giver:{create:{mapId,x,y,name}}, steps:[{kind:\"talk\", label, target:{create:{mapId,x,y,name}}, lines:[...]}, {kind:\"talk\", label, target:{create:{mapId,x,y,name}}, lines:[...]}]}}.",
  "act-depth-min": "[ship act-depth-min] The story chain (an event turns on a switch that the next event reads) is shorter than required. Rewrite the core path as 6-8 steps over 2 or more places with write_blueprint and call build_blueprint_path once; each new step needs a new event name. Steps with a battle or shop are not rebuilt: chain them with patch_event_page (condition = the previous step's switch).",
  "exit-hidden": "[ship exit-hidden] A stair exit cannot be taken by walking toward the stairs. Call create_transfer_pair again on the stair art cell; the whole stair width becomes the exit.",
  "dark-unlit": "[ship dark-unlit] A map is dark but no light follows the hero, so walkable floor outside the light sources is black on screen. Add {at:'player', radius:3-4} to sources with set_lighting_volume.",
  "critical-invisible": "[ship critical-invisible] An event that advances the story or calls the ending shows nothing on screen (transparent, or one cell of a building wall), so a new player does not know where to press. Add a sparkle with patch_event_page{mapId, eventId, pageIndex, set:{nearSparkle:{radius:2}}}, or move it onto a visible person or small object.",
  "critical-unreachable": "[ship critical-unreachable] A progress event (battle, switch, item or ending) cannot be reached on foot. Move it with move_event next to a walkable cell, or remove the furniture that blocks it.",
  "entrance-off-art": "[ship entrance-off-art] A door or story event stands on bare floor next to the drawn entrance art, so a new player presses the art and nothing happens. Move it onto the art cell with move_event{mapId, eventId, x, y}; if that cell is blocked, set patch_event_page{mapId, eventId, pageIndex:0, set:{priority:'same', overlapForbidden:true}} so bumping into it works.",
  "dialogue-repeat": "[ship dialogue-repeat] In a day-loop game one page covers several days without telling them apart, so the first-day line repeats on the next day. Split the page by day (condition: day variable >= that day), or fork on the day variable inside the page.",
  "field-tint-heavy": "[ship field-tint-heavy] An event ends leaving a heavy screen tint, so the whole field looks frozen behind a dialogue backdrop. Lower the tint at the end of that event to alpha 0.3 or less with patch_event_page (m2-046 value like '20,30,80,0.3'), or clear it with value:'neutral' if it was only for a short scene.",
  "objective-missing": "[ship objective-missing] The on-screen objective line is missing, hidden, not set at the start, names a place without saying where it is, or is not updated after a milestone event. Set the first goal with set_objective{text, at:'start'} and the next goal on each milestone event with set_objective{text, eventId}; sending a vague objective again with the same text adds a direction.",
  "romance-gap": "[ship romance-gap] A romance-game completeness check failed: default title or subtitle, title art that does not fit, scaffold text left over, endings not branched per love interest, an affection variable not bound to a character, a deadline without a fallback ending, or an opening that is only still slides. Fix that part with {tools}.",
  "assembly-time-mismatch": "[ship assembly-time-mismatch] The blueprint, the title subtitle and the first opening scene disagree about the starting time of day (for example night against morning). Rewrite the one that is off: set_title_screen{logoSubtitle} for the subtitle, or edit_opening{op:'update', sceneId, scene:<the whole scene, only narration changed>} for the opening scene (a flashback must say how long ago).",
  "title-name": "[ship title-name] The game title is still the editor default. Set this game's title with set_title_screen{title}.",
  "title-image": "[ship title-image] The title picture is still the editor default. Pick a picture that fits this story with list_resources{kind:'backdrop',query:<backdrop word>} and set it with set_title_screen{backgroundResourceId}.",
  "title-not-requested": "[ship title-not-requested] The title on the title screen is not the title the request asked for. Use the requested title exactly with set_title_screen{title}.",
  "title-off-premise": "[ship title-off-premise] The title picture shows scenery that is not in this game's story. Pick a picture of the story's place with list_resources{kind:'backdrop', query:<stage word>} or list_opening_media{kind:'image', query:<stage word>} and set it with set_title_screen{backgroundResourceId}.",
  "title-spoiler": "[ship title-spoiler] The game title gives away a puzzle answer. Remove the number from the title or change the title with set_title_screen{title}.",
  "bundled-picture/title": "[ship bundled-picture] The title picture is a blank map view or an engine-bundled still, not this game's picture. Use the map view of a built place (map-view:<mapId>), a generated picture (generate_art) or an uploaded one with set_title_screen{backgroundResourceId}.",
  "bundled-picture/ending": "[ship bundled-picture] An ending picture is a blank map view or an engine-bundled still, not this game's picture. Give define_ending presentation.backgroundResourceId the map view of a built place (map-view:<mapId>), a generated picture (generate_art) or an uploaded one.",
  "opening": "[ship opening] The opening still has editor-default scenes. Replace them with this game's opening: a staged scene on the map with author_opening_stage{mapId, x, y, beats}, picture scenes with plan_opening and set_opening. Turning the opening off is not a fix.",
  "opening-music": "[ship opening-music] The opening music is still the editor default. Change it to a track with this game's mood (opening.musicResourceId).",
  "opening-missing": "[ship opening-missing] This game has no opening (it is off or has fewer than two scenes), so New Game drops the player on the field with no introduction. Build it with plan_opening and set_opening (two or more scenes, this story from the first scene) and set {enabled:true}; a staged scene on the map with author_opening_stage also works.",
  "opening-no-place": "[ship opening-no-place] The opening shows only generic backgrounds (sky, stars, clouds) and never this game's place. Show the place as a staged scene on the map with author_opening_stage{mapId, x, y, beats} (people walk and talk at a landmark spot), or pick a still of the place with list_opening_media{kind:'image', query:<place word>}; keep sky layers only behind place scenes.",
  "hud": "[ship hud] The field HUD is still the editor default (health hearts and numbers). Pick one that fits the genre with set_field_hud{theme:<genre>}, or turn it off with {off:true}.",
  "window-look": "[ship window-look] The dialogue window and menus still use the editor-default look. Pick one that fits this game with set_vn_look{preset} or set_project_settings{resources:{systemResourceId}}.",
  "map-bgm": "[ship map-bgm] Maps still play the editor-default field track. Pick a track per place with set_map_properties{mapId, bgm}.",
  "battle-bgm": "[ship battle-bgm] The battle track is still the editor default. Pick this game's battle track with set_project_settings{resources:{battleBgmResourceId}}.",
  "battle-background": "[ship battle-background] Maps with battles have no battle background, so the editor default shows. Pick the place's background with set_map_properties{battleBackground} or the troop's battleBackgroundResourceId.",
  "game-over": "[ship game-over] The player can die or lose, but the game-over screen is the editor default. Set this game's defeat screen and where to return with set_game_over{presentation, title, body, background}.",
  "ending-screen": "[ship ending-screen] Endings still use the editor-default ending card. Fill define_ending presentation{backgroundResourceId, finalTitle, credits, musicResourceId}.",
  "ending-bg": "[ship ending-bg] Endings still use the engine-default picture. Give define_ending presentation.backgroundResourceId a picture of that ending's place.",
  "ending-closure": "[ship ending-closure] An ending does not close as a scene: fewer than 3 closing lines, no word on what became of the characters, or no final picture. Fill define_ending epilogue (say, picture, music beats) and presentation (backgroundResourceId).",
  "ending-condition-unset": "[ship ending-condition-unset] An ending has conditions that no event ever turns on, so the ending never plays even when its trigger runs. Remove them from define_ending conditions (the event that calls the ending is the gate), or turn that switch on in that event.",
  "ending-off-premise": "[ship ending-off-premise] An ending has no final picture (so the title picture shows) or its picture shows scenery that is not in this story. Give define_ending presentation.backgroundResourceId a picture of that ending's place (closest match from list_resources{kind:'backdrop', query:<place word>}).",
  "default-place-leak": "[ship default-place-leak] The title or an ending names the new-project default chipset's place, which the request never mentions; it is not this game's stage. Rewrite the title (set_title_screen{title}) and the ending (define_ending) from the requested story.",
  "party-names": "[ship party-names] Party members still have editor-default names. Give them this story's names with upsert_actor{id,name}.",
  "party-faces": "[ship party-faces] Party members still have the editor-default portraits. Pick a face that fits each character (list_npc_graphics) or clear the face.",
  "hero-look": "[ship hero-look] The party still uses the editor-default sprite (fantasy swordsman). Pick this game's hero look with list_npc_graphics{query:<appearance>} and set it with upsert_actor.",
  "start-gear": "[ship start-gear] This game defines its own equipment, but the starting party still holds the engine-default gear. Give this game's gear with upsert_actor{id, initialEquipment}.",
  "combat-leftovers": "[ship combat-leftovers] The game has no battles, but battle defaults remain (ESC menu rows for skills, equipment, status; default starting gear). Switch the menu with configure_field_menu{preset:'story'} and remove the default gear with upsert_actor{id, initialEquipment:{}}.",
  "placeholder-text": "[ship placeholder-text] Scaffold or placeholder text is still in the game (default lines, or a placeholder name in ending credits). Replace it with this story's scenes and names, or delete it; if the author's name is unknown, drop the name line from the credits.",
  "project-reload-failed": "[ship project-reload-failed] The saved project cannot be loaded again, so the game will not open. Fix the field named in the error and save again.",
  "locked-exit-silent": "[ship locked-exit-silent] An exit transfers only when a condition holds, but says nothing when it does not. Add one line for the blocked case that says why (what is needed, what to do first).",
  "empty-sparkle": "[ship empty-sparkle] An event page sparkles but nothing happens when it is examined. Remove the sparkle or add a line of dialogue (patch_event_page).",
  "transfer-self-loop": "[ship transfer-self-loop] A transfer moves the player to the cell right next to it on the same map, so it looks like a broken door. Remove the transfer (remove_event), or link it to another map or a far cell with create_transfer_pair.",
  "boss-talk-no-battle": "[ship boss-talk-no-battle] An event's dialogue starts a fight, but no battle opens and the line just repeats. Add {kind:'battleProcessing', troopId:<that boss's troop>} at the end of that dialogue page and add an after-victory page (patch_event_page).",
};

const PLAY = "[play autoplay] Auto-play cannot reach an ending: the route is blocked at one step. The player must be able to walk from the start to the ending. Fix the path at the blocked place (door, create_transfer_pair, walkable cells) or the event that turns on that step's switch, then finish again. If it cannot be fixed, do not report the game as complete; name the blocked place in the report.";

const NON_ASCII = /[^\x20-\x7e]/u;
/** 줄·증거에서 뽑는 대상 — 프로젝트 id(map_… · ev_… · sw_… …)와 칸 좌표. */
const REF = /\b(?:map|ev|sw|var|actor|troop|enemy|skill|item|state|equip|ending|quest|class)_[A-Za-z0-9][\w-]*|\bmap-view:[\w-]+|\(\d+,\s?\d+\)/gu;
const isId = (ref: string): boolean => !ref.startsWith("(") && !ref.startsWith("map-view:");
const MAX_REFS = 6;

/** 프로젝트의 이름표 — id 로 저장된 이름(이벤트는 맵·칸까지)을 찾는다. */
export interface RefNames {
  name(id: string): string | undefined;
  event(id: string, mapId?: string): { readonly name: string; readonly mapId: string; readonly x: number; readonly y: number } | undefined;
}

/** 앞에 준 프로젝트가 이긴다 — 지금 것 다음에 시작 저장본을 주면 이번 턴에 지워진 이벤트·기록의 이름도 찾는다. */
export function refNames(...projects: readonly Project[]): RefNames {
  const names = new Map<string, string>();
  const events = new Map<string, { name: string; mapId: string; x: number; y: number }[]>();
  const put = (id: unknown, name: unknown) => { if (typeof id === "string" && typeof name === "string" && name.trim() && !names.has(id)) names.set(id, name.trim()); };
  for (const project of projects) {
    for (const map of Object.values(project.maps)) {
      put(map.id, map.name);
      for (const ev of map.events ?? []) {
        const at = events.get(ev.id) ?? [];
        if (!at.some((e) => e.mapId === map.id)) at.push({ name: String(ev.name ?? "").trim(), mapId: map.id, x: ev.x, y: ev.y });
        events.set(ev.id, at);
      }
    }
    for (const rows of [...Object.values(project.database), project.switches, project.variables, project.commonEvents, project.endings ?? [], project.quests ?? []]) {
      if (Array.isArray(rows)) for (const row of rows as readonly { id?: unknown; name?: unknown; title?: unknown }[]) put(row?.id, row?.name ?? row?.title);
    }
  }
  return { name: (id) => names.get(id), event: (id, mapId) => { const at = events.get(id); return at?.find((e) => e.mapId === mapId) ?? at?.[0]; } };
}

const quoted = (name: string | undefined): string => (name ? `«${name.replace(/[«»]/gu, "").slice(0, 40)}» ` : "");

/** id 하나를 «이름» (id) 로 — 이벤트는 «이름» (id @ 맵 (x,y)). 이름표가 없거나 거기 없는 id 는 id 그대로. */
function named(id: string, names: RefNames | undefined, mapId?: string): string {
  const ev = names?.event(id, mapId);
  if (ev) return `${quoted(ev.name)}(${id} @ ${ev.mapId} (${ev.x},${ev.y}))`;
  const name = names?.name(id);
  return name ? `${quoted(name)}(${id})` : id;
}

function refsOf(f: Finding, body: string, names: RefNames | undefined): string {
  const out: string[] = [];
  const seen = (ref: string): boolean => body.includes(ref) || out.some((o) => o.includes(ref));
  const t = f.target, evidence = f.evidence?.trim() ?? "", text = `${f.ko} ${evidence}`;
  // 이벤트가 어느 맵 것인지 — 대상이 말하면 그 맵, 아니면 줄에 처음 나온 맵.
  const mapId = t?.mapId ?? [...text.matchAll(REF)].map((m) => m[0]).find((ref) => ref.startsWith("map_"));
  const addId = (id: string | undefined) => { if (id && !NON_ASCII.test(id) && !seen(id)) out.push(named(id, names, mapId)); };
  addId(t?.eventId); addId(t?.mapId);
  // ref 가 id 가 아니라 이름(자동 플레이의 막힌 단계)이면 이름으로.
  if (t?.ref && NON_ASCII.test(t.ref)) out.push(quoted(t.ref).trim()); else addId(t?.ref);
  if (t?.x !== undefined && t.y !== undefined && !seen(`(${t.x},${t.y})`)) out.push(`(${t.x},${t.y})`);
  // 증거가 ASCII 이고 id 말고도 뜻이 있으면(「counted=1 need=4」) 통째로 — 그 안의 id 에도 이름을 붙인다.
  if (evidence && evidence.length <= 120 && !NON_ASCII.test(evidence) && /[A-Za-z0-9]/u.test(evidence.replace(REF, "")) && !seen(evidence)) {
    out.push(evidence.replace(REF, (ref) => (isId(ref) && !seen(ref) ? named(ref, names, mapId) : ref)));
  }
  for (const m of text.matchAll(REF)) {
    if (out.length >= MAX_REFS) break;
    if (!seen(m[0])) out.push(isId(m[0]) ? named(m[0], names, mapId) : m[0]);
  }
  return out.slice(0, MAX_REFS).join(", ");
}

/** 규칙 하나가 여러 검사를 묶은 것(연애 완성도)은 표가 고치는 도구를 알 수 없다 — 한국어 줄이 이르는 도구 이름을 그대로 싣는다. */
const TOOL_NAME = /(?<![\w-])[a-z]+(?:_[a-z]+)+(?![\w-])/gu;
function namedTools(ko: string): string {
  const names = [...new Set([...ko.matchAll(TOOL_NAME)].map((m) => m[0]).filter((n) => !n.match(REF)))].slice(0, 8);
  return names.length ? names.join(", ") : "the tool that owns that part (set_title_screen, define_ending, plan_opening/set_opening)";
}

/** 표에서 이 문제의 글을 찾는다 — 갈래가 있으면 갈래 글, 없으면 규칙 글. */
function textOf(f: Finding): string | undefined {
  if (f.judge === "play") return PLAY;
  const table = f.judge === "game" ? GAME : f.judge === "ship" ? SHIP : undefined;
  if (!table) return undefined;
  // 출하 차단은 갈래를 증거 머리에서 읽는다(ShipBlocker 에는 갈래 칸이 없다): 요청 기능 = 「chaser: …」, 번들 그림 = 「titleScreen.…」 · 「endings[…]…」.
  const variant = f.variant
    ?? (f.id === "requested-feature-missing" ? /^[a-z]+/u.exec(f.evidence ?? "")?.[0] : undefined)
    ?? (f.id === "bundled-picture" ? ((f.evidence ?? "").startsWith("titleScreen") ? "title" : "ending") : undefined);
  return (variant ? table[`${f.id}/${variant}`] : undefined) ?? table[f.id];
}

/**
 * 모델이 받는 영어 글 — «[묶음 규칙] 무엇이 틀렸나. Refs: «이름» (id @ 맵 (x,y)), …. 고치는 호출.». 표에 없는 규칙은 undefined(한국어 줄이 그대로 간다).
 * names 를 주면 대상 id 옆에 프로젝트의 이름을 싣는다.
 */
export function findingEn(f: Finding, names?: RefNames): string | undefined {
  if (f.en) return f.en;
  const text = textOf(f)?.replace("{tools}", () => namedTools(f.ko));
  if (!text) return undefined;
  const refs = refsOf(f, text, names);
  if (!refs) return text;
  // 대상은 첫 문장(무엇이 틀렸나) 바로 뒤에 — 항목 글을 앞에서 잘라 보이는 자리(Do now 120자 · Still open 50자)에서도 문제가 먼저 읽힌다.
  const cut = text.indexOf(". ");
  return cut < 0 ? `${text} Refs: ${refs}.` : `${text.slice(0, cut)}. Refs: ${refs}.${text.slice(cut + 1)}`;
}

/** 영어 글이 있는 규칙 열쇠(«game:날씨» · «ship:maps-min» · «play:autoplay») — 빠진 규칙을 재는 탐침·시험이 읽는다. */
export const FINDING_EN_RULES: readonly string[] = [...Object.keys(GAME).map((k) => `game:${k}`), ...Object.keys(SHIP).map((k) => `ship:${k}`), "play:autoplay"];
