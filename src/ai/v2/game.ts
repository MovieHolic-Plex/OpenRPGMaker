// 조수 v2 «게임 요소» — 퀘스트·아이템·상점·전투·파티·스위치처럼 맵이 아닌 요청.
//
// 왜(2026-10-23 게임 요소 비교 40): v2 동사(make_place·add_people·add_event·add_scene)는 장소·사람·연출만 다뤄서
// 「심부름 퀘스트」「새 무기를 상점에서」「보스 전투 뒤 감사」를 옮길 길이 없었다. 이 층은 이미 검증된 v1 결정론 도구를
// 그대로 내놓는다(스키마·검증·저장 계약이 v1 과 같다). 요청에 게임 낱말이 있을 때만 싣는다 — 맵 요청의 첫 턴을 무겁게 하지 않는다.
import { createPiToolset, type PiToolShape } from "@/ai/piAgent/toolAdapter";
import { assistantScriptsOn } from "@/ai/scriptsSwitch";
import { getTool } from "@/editor/tools/toolRegistry";
import type { PiAssistantV2Env } from "./env";
import { asksForEncounters } from "./request/readers";
import { englishToolMessage, parseFailure } from "./loop/failureText";
import { withForestRouteBrief } from "./forestBrief";
import { v2ToolPool } from "./request/toolGroups";
import { classifyRequest } from "./request/intent";
import type { GameTopic } from "./request/topics";

/** 거절 본문(JSON·감싼 JSON·글)에서 첫 이유 한 줄 — 머리(«'도구' 실행 실패:»)를 걷는다. */
const firstReason = (why: string): string => { const p = parseFailure(why); return (p.issues[0]?.message ?? p.summary).replace(/^'[^']+'\s*실행 실패:\s*/u, ""); };

/**
 * 게임 카드 줄 — [주제, 글]. "core" 는 게임 도구를 쓰는 요청이면 늘 싣고, 나머지는 작은 요청이 그 주제를 말할 때만 싣는다(request/topics.ts).
 * 게임 하나를 짓는 요청은 전부 싣는다. "fallen" 은 그 아래 «  · » 줄(폴른 스타 제작에서 나온 일)의 머리다 — 아래 줄이 하나라도 실릴 때 같이 싣는다.
 */
const GAME_LINES: readonly (readonly [GameTopic | "core" | "fallen", string])[] = [
  ["core", "[Game elements — quests, items, shops, battles, party, switches] For this request use the v1 game tools as they are (places and staging use the verbs above)."],
  ["core", "- Order: 1) read — get_database_records (existing items, enemies, actors), find_events (NPC and event ids on this map) → 2) data — upsert_item/upsert_equipment/upsert_skill/upsert_enemy/upsert_troop/upsert_actor/upsert_class → 3) attach — add_people (a new NPC) / upsert_event (pages, conditions, commands), set_shop_stock, place_chest, set_encounter_table, create_quest → 4) re-read with get_event to confirm conditions and commands."],
  ["core", "- Stand new NPCs with add_people using a spot word, then put pages, conditions and commands on the returned event id with upsert_event. Move an existing person or thing with move_event{eventId, dx,dy | where} (it returns the cell). For a tool that needs x,y (chest, lever) get a free cell from find_empty_ground — never invent one."],
  ["core", "- To change an existing NPC (village chief etc.) do not stand a new one (add_people with the same name reuses that NPC; keep their art, face and spot); upsert_event on that event id. Keep existing lines unless the request says to change them."],
  ["core", "- Dialogue whose state changes (request → in progress → done, remembered choices) gets a different condition per page (switch, variable, self switch). Rewards, item gains/losses, gold and party changes go in as commands."],
  ["script", "- Logic with conditions, math, loops — events first: people READ the event list, so build everything readable as ordinary commands (dialogue, cutscenes, branches, choices, switch/variable/gold/item changes, movement, effects). A script command is ONLY for a short fragment commands express badly: a formula (price, damage), a loop over a list, an ordered-sequence check, a timer or countdown. Keep each script 1-3 lines with one job and named consts for its numbers, write the result into a variable or switch, and let the commands around it use that value (Show Text with \\V[var_id], a fork on the variable, changeGold amount {kind:'var',id}). No dialogue inside a script unless the line depends on the computed value. Example: [script \"price\": const BASE = 120, MAX_OFF = 30; game.setVar(\"var_price\", Math.round(BASE * (100 - Math.min(MAX_OFF, game.getVar(\"var_rep\"))) / 100));] → Show Text \"A potion is \\V[var_price] G.\" → the usual choice and gold commands. Decide once per event and keep it — never write a script and then convert it to commands (or the reverse), and never turn existing commands into scripts unless the user asks. Write each fragment with one author_script call carrying explain (1-2 plain sentences in the user's language) and examples (normal case + one edge): it compiles and runs the examples in that call, so do not follow it with check_script or dry_run_script. Several similar fragments = one author_script{scripts:[…]}. Never hand-write {kind:'script'} in upsert_event/patch_event_page."],
  ["items", "- If the request gives numbers (heal amount, attack, price), use them exactly. If an item links an effect skill (skillId), set that skill's power to the same value with variance 0 (otherwise the real heal differs from the request)."],
  ["affection", "- «Accumulating» values like affection, trust or reputation are variables: add/subtract commands on each talk or gift, and the changing-dialogue page is chosen by that variable condition (≥ threshold) — a talk-count self switch instead turns affection into decoration."],
  ["core", "- Things that must happen once (reward, chest, joining) are blocked from repeating with a self switch or switch."],
  ["time", "- If NPC spots or lines change by time of day (day/night), use configure_time_system (turn time on) → set_npc_schedule (timetable) and page conditions (if there is no house interior, build one with make_place and link the door). If you cannot, build the nearest working version before asking, and say so in the report."],
  ["rename", "- Renaming: send only id and name to upsert_actor (stats stay). If the request says «also call them that in dialogue», find the NPCs who address that person with find_events and fix only that line with patch_event_page — keep the other lines. If the named line has no name yet, add one where that person calls the hero by the new name («어서 오게, 아린. …») — the point of the request is to hear the new name in dialogue."],
  ["equipment", "- When changing starting equipment, check it is in the hero class's equipment permissions (class equipmentPermissions) and add it with upsert_class if not. Do not swap in weaker equipment (unless asked)."],
  ["items", "- Shops use set_shop_stock (selling is turned on). If you write a shop command directly with upsert_event, always include allowSell:true (without it there is no sell menu). Sell-back rates (e.g. 70%) are a per-item table in set_sell_prices, so fill it broadly — not just that shop's goods but the consumables and equipment the player usually carries."],
  ["core", "- Write lines in the person's own spoken voice — never use a quest summary («~를 찾아 소식을 전해 주자») as NPC dialogue. Hero monologue and narration have no speaker name."],
  ["time", "- Timers and time limits: page condition timer is {timerId:\"timer1\"|\"timer2\", seconds, op?} — without op it means «time left ≤ seconds» (\">\" etc. also work; no other timerId). Start = timer set (seconds) + start (timer1) + a start switch; success = timer stop on the object/switch condition page; failure = the time-left ≤0 page (highest number)."],
  ["core", "- When done, run the critical path once with run_scene_test (talk interact · choose → expect switchOn/inventoryCount/goldDelta etc.). On failure fix with patch_event_page and run again. Report «done» only for what passed."],
  ["core", "- Character art: for new NPCs, new pages and actor art, look at candidates with list_npc_graphics (query: appearance) and use their selectionId (an invented cell number is rejected by the art gate). When adding a page to an existing NPC, copy that NPC's existing graphic as is. Beasts and enemies like wolves or bats that list_npc_graphics lacks become place_field_enemy (field enemy) or an art-less touch event — do not repeat the same search."],
  ["core", "- Flags: declare new switches and variables first with declare_story_flag (name, meaning), and every switch you turn on must be read by some page condition or branch (a flag set but never read means the «already done» page is missing). Do not make flags you only declare and never use."],
  ["gates", "- One-time gates (password, toll, reward, key) always get an «already passed / already received» page: a higher-numbered page conditioned on the pass switch (or self switch) with a short line («지나가게») and just the pass action."],
  ["gates", "- Showing or handing over an item (presentItem, item pick) appears only when the player has it: put {kind:'item',itemId,present:true} in that page's condition (or wrap it in a fork) — without the item, the normal dialogue page must show."],
  ["status", "- Status ailments (poison, paralysis, sleep…): do not fake them with screen effects or sound; apply the real state — {kind:'m2Command',commandId:'m2-019-change-state',fields:{target:'party'(or actor id),operation:'add',value:'state_poison'}}. Check state ids with get_database_records (states). Sound and flashes go on top."],
  ["weather", "- Weather (rain, snow, storm, fog): use the real weather command {kind:'setWeather',weather:'rain'|'storm'|'snow'|'fog'|'none',intensity:0~1} (or add_event's weather beat; map-wide default weather is set_scene_mood). tint (screen color) is not weather."],
  ["staging", "- Shake and quakes are add_event's shake beat (or m2Command m2-048-shake-screen), flashes and lightning are the flash beat (m2-047-flash-screen), music changes are the music beat ({do:'music',action:'bgm',query:'festival'} or {kind:'playAudio',resourceId,loop:true}) — do not fake them with camera moves or fades."],
  ["examine", "- Objects the player «examines» (gravestone, warp stone, fountain, herb spot, ore vein, signpost, bush) must be visible: find the object id with list_spatial_designs{kind:'object',query:'비석'|'돌'|'분수'|'나무'|'덤불'} (gravestone, stone, fountain, tree, bush), stamp it with stamp_object{mapId,objectId,x,y}, then place_examine_hotspots{mapId,hotspots:[{at:<its cell>,name,lines}]}. An object already on the map: hotspots:[{on:'<object name>',name,lines}]. Never leave an invisible event on bare ground (unless the request asks to hide it)."],
  ["examine", "- For an object with no exact art (apple tree, gravestone, pile of crates): draw_object first (core rule) and still build the item, lines and switch. Only if the drawing fails, put the examine event on the nearest existing object (tree, stone, signpost) and name the substitute in the report."],
  ["gates", "- Number locks and password input: read into a variable with {kind:'inputNumber',variableId,digits:4} and open with fork condition {kind:'variable',variableId,op:'==',value:3817} (the answer must be a number only learnable from a clue — common numbers like 1024·1234·0000 are sent back by the finish check. The condition kind is 'variable' — 'var' is only setVariable's operand {kind:'var',id}). If there is no storeroom or door to lock, build that building or door first (add_event, create_transfer_pair)."],
  ["maps", "- Every new map (interior, field) needs a way in: house door cell ↔ interior entrance is create_transfer_pair, village edge ↔ field is also create_transfer_pair. Random enemies are set_encounter_table (not a visible enemy event) — turn it on only when the request asks for random encounters."],
  ["battle", "- A game with battles must have a way to recover HP: an inn (recoverAll), shop potions (set_shop_stock), a potion chest (place_chest), place_savepoint{heal:true} before the boss, or a healer ally — at least one. Without it the finish gate blocks. Tune the first forest/cave enemies so the starting party usually wins (simulate_battle win rate 80%+)."],
  ["flashback", "- Flashbacks (past scenes) are add_event cutscenes: when:'talk' · after:'<person talked to>' with tint sepia → appear past person → walk/say → vanish → tint clear. Do not fake them with screen color plus a monologue by present people (past people vanish after the scene)."],
  ["feelings", "- Followers (addFollower) and flashbacks also turn on a self switch and get an «already done» page. Emotions like «!» over the head are add_event's emote beat (not a line)."],
  ["script", "- Event commands have no random-number command (setVariable value is a number or {kind:'var',id} only). For chance (a 1-in-3 failure, a random reward) write a one-line script with author_script — game.setVar(\"var_roll\", game.random(3)) (the same saved RNG as the game) — and branch on var_roll with ordinary fork commands; do not fake it with a fixed rotation."],
  ["ending", "- Endings: check list_endings, define the ending with define_ending (id · name · epilogue), then put {kind:'triggerEnding',endingId} in the choice branch. Do not fake an ending with narration + returnToTitle. For a choice asked «at the end», put the prerequisite (boss defeated, completion switch) as the page condition."],
  ["examine", "- If a spot the request points to (in front of the bridge, riverside, beside the well…) does not exist on the map, do not ask: create that object or terrain (stamp_object, fill_region overpaint; otherwise the most plausible path spot), build it, and write «~가 없어 ~에 만들었다» (X was missing, so I made it at Y) in the report."],
  ["fallen", "- [Fallen-Star-style jobs — when a matching tool exists, use it instead of assembling by hand]"],
  ["snow", "  · Snowfield route maps (snowy pass, frost road, ice field, 1–3 maps): author_snow_route{fromMapId, side, count, moods:['snow','blizzard'], gapCount (number of ice gaps), openEnd} — do not build the north with the green forest tool. It links the edges too. Ice gap spots come back as data.maps[i].gaps[k].from/to (path cells before and after the gap) — the device for crossing a gap is placed separately."],
  ["forest", "  · Forest and field maps (one or several: winding forest path, broadleaf trees, objects hidden between trees, dark foggy forest; open field is terrain:'field'): author_forest_route{fromMapId, side:'north'…, count, terrain, moods:['normal','darkfog'], hiddenPerMap, designs:[{bends, sway, entryAt, exitAt, width, branches:[{at, toward, length, end:'chest'}], clearings}]} — you design each map's route shape (bends, branches, clearings) to fit the story and make it differ from routes built before. It links the edges too (no separate create_transfer_pair). Put the boss or shrine on the returned data.maps[i].clearing, chests on deadEnds and field enemies (place_field_enemy) on enemySpots — never two on one cell. This tool places no monsters or encounters (encounters:'none'), so for «a forest with monsters» place them yourself. If the request says «enemies/shrine in the forest» and there is no forest map, build the forest with this tool first instead of using the village map's tree clumps."],
  ["search", "  · Searchable barrels, chests, jars, wardrobes (search animation, once only, empty on re-check, «!» scolding if the owner sees, owners do not see through walls or into other rooms, caught count): place_search_containers{mapId, containers:[{x,y,style,loot,ownerId,caughtLines,caughtVariableId}]}. For «caught three times and the shop won't sell», give caughtVariableId and add a page on the shop NPC conditioned on that variable ≥3."],
  ["fieldEnemy", "  · Visible field enemies (roam, «!» and chase on sight, battle on touch, give up when far, forward-only vision, vanish when beaten): place_field_enemy{behavior:'chase', sightRange, vision:'cone' (forward only), giveUpRange (give up and return when far), patrol (patrol + chase)} — village maps are rejected, so use forest or field maps. Different from random encounters."],
  ["replace", "  · Bulk text replace («change every 'North Forest' to 'Whispering Forest'», an NPC name in both name tag and dialogue): replace_text_in_project{find, replace} once. Do not patch line by line."],
  ["status", "  · States: upsert_state — duration cap runtimeEffects.maxTurns («poison lasts at most 3 turns»), per-turn damage hpDamagePercentPerTurn, damage-type override runtimeEffects.damageTypeRates ({magic:300} = magic ×3). Enemy type resistance is upsert_enemy damageTypeRates ({magic:0} = immune to magic). Applying a state with a skill = skill stateEffects."],
  ["equipment", "  · Equipment numbers: damage dealt +30% = upsert_equipment damageDealtPercent:30, damage taken -20% = damageTakenPercent:-20, crits = criticalRate. A «+20% while holding a sword» skill = upsert_skill weaponAffinity{elementIds:['sword'],bonusPercent:20}. MP recovery item = upsert_item mpRecovery."],
  ["boss", "  · Boss patterns (phase-2 lines and a strong skill at HP %, summoning minions, one heal): author_boss_phases{troopId, phases:[{atHpPercent,…}]}. A charge-up warning = that skill's chargeTurns:1. «Interrupted if hit for more than N / by fire / by stun» = chargeBreak{damage:N, elementIds?, stateIds?, message:'송신 실패'} on the same skill (do not fake it with a delay gaugeShift); check break counts in simulate_battle's chargeBreaks. Run simulate_battle once when done."],
  ["opening", "  · Game-start opening: when people walk or the camera tours a real place, stage it on the map with author_opening_stage (engine stage). For a night-sky parallax, shake or a close-up CG, set up shots with plan_opening and build with create_opening_animatic_shot/upsert_opening_layer/animate_opening_camera; the title is set_title_screen. Turn on system.opening."],
  ["feelings", "  · Expressions (smiling, then worried): give the text command emotion:'happy'|'sad'|'angry'|'surprised' (worry/sorrow = sad) or put a [표정:sad] tag before the line — the face slot in the dialogue window switches to that expression (the NPC art needs a matching face: pick art with a face in list_npc_graphics). Do not fake it with an emote balloon. Lines of an existing NPC go on that event id via patch_event_page/upsert_event — do not create a new one with add_event."],
  ["readable", "  · Long readables (bookshelf, gravestone, journal, letter): place_examine_hotspots with readable:true (parchment «letter/book» window, one lines entry = one page, 3–5 sentences per page) — or a text command with style:'letter'. Make the object visible with stamp_object."],
  ["vanish", "  · Vanishing in smoke: add_scene's vanish beat (smoke + transparent), then a self-switch/switch page so they do not return."],
  ["ending", "  · Act-end cards («제N막 끝», «제2막으로 이어집니다») = define_ending{id:'ending_act1',presentation:{finalTitle:'제1막 끝', badge:'제2막으로 이어집니다'}} + {kind:'triggerEnding',endingId} at that point — do not fake it with lines or pictures."],
  ["patrol", "  · Patrolling and running around: configure_npc_patrol (closed path) or add_people movement:'wander'. Door-opening effect + interior = create_transfer_pair (doorAt) or place_door."],
  ["door", "  · To force the door-opening effect on or off: put door:true (on) | false (off) on that transfer event's transfer command with patch_event_page (omitted = auto: only on door-art cells). Fade only = door:false + fade."],
  ["forest", "  · Forest and field nature objects (rocks, mossy stones, fallen logs, stumps, mushrooms, ferns, wildflowers, bushes, silver grass, mossy shrine stones): use the «버들항 자연 · …» objects (bd-org-*) from list_spatial_designs{kind:'object', query:'버들항 자연'} — desert, snowfield and sea-cave rocks are for other places. Scatter them in clumps away from paths, door fronts and event cells (not in a line)."],
  ["removeMap", "- Removing maps: delete unused maps and maps built twice for the same role with remove_map{mapId} (transfers into that map are cleaned up too, and a user confirmation card appears before it applies). Move the start map first with set_start_position. Never hand it off as «delete it by hand»."],
];
export const GAME_CARD = GAME_LINES.map(([, line]) => line).join("\n");

const SCRIPT_CARD_LINE = GAME_CARD.split("\n").find((line) => line.startsWith("- Logic with conditions, math, loops")) ?? "";
const SCRIPT_RANDOM_LINE = GAME_CARD.split("\n").find((line) => line.startsWith("- Event commands have no random-number command")) ?? "";
const PRE_SCRIPT_RANDOM_LINE = "- The engine has no random-number command (setVariable value is a number or {kind:'var',id} only) — do not keep trying; use an outcome that rotates in order (e.g. fails one time in three) and write «order instead of chance» in the report.";
/**
 * 게임 카드 글. topics 를 주면(작은 요청) 그 주제의 줄만, 안 주면(게임 하나) 전부.
 * OPRN_V2_SCRIPTS=0 이면 스크립트 이전 글(스크립트 줄 없음, 난수는 순서 돌리기)로 돌려준다(src/ai/scriptsSwitch.ts).
 */
export function gameCard(topics?: readonly GameTopic[]): string {
  const want = topics && new Set<string>(["core", ...topics]);
  const picked = GAME_LINES.filter(([key], i) => !want || (key === "fallen" ? GAME_LINES.slice(i + 1).some(([k, line]) => line.startsWith("  · ") && want.has(k)) : want.has(key))).map(([, line]) => line);
  if (assistantScriptsOn()) return picked.join("\n");
  return picked.filter((line) => line !== SCRIPT_CARD_LINE).map((line) => (line === SCRIPT_RANDOM_LINE ? PRE_SCRIPT_RANDOM_LINE : line)).join("\n");
}
export const TERRAIN_CARD = "[Overpainting an existing map — water, bridges, small objects] For fixing a map without rebuilding it (river, bridge, lever, signpost in a village already built).\n- Water: fill_region{mapId, material, rect:{x,y,w,h}, shape?:'ellipse', referencePurpose} — on the Beodeul chipset (beodeul_city) use material:'버들항 물' (plain '물' becomes watered field soil) and referencePurpose:'beodeul-city-water'. A bending river is several rects. Take every rect and x,y from what you read (the inspect picture grid, find_events/get_event positions, find_empty_ground) — never from a guess. Avoid houses and finished areas, and leave the spot where a road crosses the water for a bridge.\n- Objects: find the id with list_spatial_designs{kind:'object', query} and stamp_object{mapId, objectId:'kit:…', x, y}. Common in Beodeul: bridge 'kit:beodeul_city/bd-bridge-arch', signpost 'kit:beodeul_city/bd-out-signpost',\n  floor-standing lever 'kit:shared_hand_interior_harness/shared_hand-interior:floor lever' ('wall lever' and dungeon levers hang only on wall faces). Use draw_object only when the search finds nothing. Place it first before asking.\n- Events (examine, touch) go on that object's cell (the x,y you just used). When done, look at the 1x picture with inspect.";
/** 휑한 야외를 채우는 요청에 싣는 한 줄. */
export const DRESS_CARD = "[Filling empty outdoor ground] furnish_outdoor_area{mapId, region?, props?} fills the empty ground of an outdoor map with fitting props in one call (it avoids roads, door fronts and event cells). For one chosen spot, get a free cell with find_empty_ground and stamp one object with stamp_object. Interiors are not for this tool — use review_layout or dress_room there.";

/** 게임 도구 묶음 — 실행 기록은 v1 경로와 같은 onCall(env.record)로 남는다. */
/** pool:true 면 이 요청의 도구에 v2ToolPool 전부를 더한다(필요할 때 싣는 도구도 같은 감싸개를 지나게). */
export function createGameTools(env: PiAssistantV2Env, task = "", options: { readonly pool?: boolean } = {}): PiToolShape[] {
  // 도구 묶음은 요청 글과 프로젝트를 같이 본 기록에서 읽는다(게임 하나를 잇는 «계속» 은 글에 게임 낱말이 없어도 게임 도구를 받는다).
  const names = [...new Set([...classifyRequest(task, env.ctx.project).tools.extra, ...(options.pool ? v2ToolPool() : [])])].filter((name) => getTool(name));
  return withActorLookRetry(withItemUtilityCleanup(withTransferRelocation(withForestRouteBrief(withEncountersOnlyWhenAsked(withPictureSearchBudget(createPiToolset(env.ctx, { ...(env.toolsetOptions ?? {}), toolNames: names, onCall: env.record })), task), () => env.ctx.project, env.record))));
}

/**
 * 회복약에 딸려 온 탈출·퇴치 칸을 뺀다 — 스키마 칸을 기본값으로 다 채워 보내는 모델이 escapeTo:"entrance"(열거 첫 값)·repelSteps:0 을 실어
 * 회복약이 «던전 탈출» 아이템으로 저장됐다. 이름·설명에 탈출·퇴치 낱말이 없으면 그 칸을 뺀다. repelSteps 0 은 늘 뺀다.
 * 다른 도구의 빈 칸·어긋난 칸(트룹의 빈 members, 필드 적의 patrol·graphic, 이동 쌍의 doorAt)은 그 도구가 스스로 읽는다(2026-11-11 B5a).
 */
const ESCAPE_ITEM_WORD = /탈출|귀환|되돌아|입구로|escape|rope|로프|밧줄/iu;
const REPEL_ITEM_WORD = /퇴치|기피|쫓|피하|성수|향|repel|ward/iu;
function withItemUtilityCleanup(tools: PiToolShape[]): PiToolShape[] {
  return tools.map((tool) => tool.name !== "upsert_item" ? tool : { ...tool, async execute(id, params, signal) {
    if (!params || typeof params !== "object") return tool.execute(id, params, signal);
    const args = structuredClone(params) as Record<string, unknown>;
    if (args.item && typeof args.item === "object") {
      const it = args.item as Record<string, unknown>;
      const words = `${String(it.name ?? "")} ${String(it.description ?? "")}`;
      if (it.escapeTo !== undefined && (it.escapeTo === "" || !ESCAPE_ITEM_WORD.test(words))) delete it.escapeTo;
      if (it.repelSteps !== undefined && (!(Number(it.repelSteps) >= 1) || !REPEL_ITEM_WORD.test(words))) { delete it.repelSteps; delete it.repelBelowLead; }
    }
    return tool.execute(id, args as typeof params, signal);
  } });
}

/**
 * upsert_actor 가 캐릭터 칩 관문(「캐릭터 그림 선택을 되돌렸습니다」)에 걸리면 칩 칸(characterResourceId·characterIndex)만 빼고 한 번 더 부른다 —
 * 이름·능력치·기술·얼굴은 저장되고, 결과 글이 «겉모습은 그대로 두었다 + 바꾸려면 list_npc_graphics 에서 고른 selectionId 를» 이라고 알린다.
 * 왜 (2026-10-30 scenes-duel en-loop 판, terra): 관문 거절이 upsert_actor 재실패 1위(판당 0.33, ce04 0.44)였다. 진짜 거절(쓰기 전체 되돌림)이다 —
 * terra 는 list_npc_graphics 를 부르지 않고 characterIndex 만 0→1→… 바꿔 같은 거절을 되풀이했고, 그사이 배우의 능력치·기술도 저장되지 않았다.
 * 같은 호출 id 로 다시 부르므로 기록(tool_end)에는 다시 부른 결과가 남는다. 칩을 «본 적 있는» 후보로 고르면 관문이 받는다(손대지 않는다).
 */
const LOOK_GATE = /캐릭터 그림 선택을 되돌렸습니다/u;
function withActorLookRetry(tools: PiToolShape[]): PiToolShape[] {
  return tools.map((tool) => tool.name !== "upsert_actor" ? tool : { ...tool, async execute(id, params, signal) {
    const args = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
    let why: string | undefined;
    try {
      const result = await tool.execute(id, params, signal);
      const body = (result.content.find((c) => c.type === "text") as { text?: string } | undefined)?.text ?? "";
      if (!LOOK_GATE.test(body)) return result;
      why = body;
    } catch (error) {
      why = error instanceof Error ? error.message : String(error);
      if (!LOOK_GATE.test(why)) throw error;
    }
    // 레지스트리 모양은 {actor:{…}} 이다(평평하게 펴기 flatWrapper 는 이 감싸개 바깥).
    const nested = args.actor && typeof args.actor === "object" && !Array.isArray(args.actor);
    const actor = (nested ? args.actor : args) as Record<string, unknown>;
    if (signal?.aborted || (actor.characterResourceId === undefined && actor.characterIndex === undefined)) throw new Error(why);
    const { characterResourceId: sheet, characterIndex: slot, ...rest } = actor;
    const chip = /\((charset:[^)]+)\)/u.exec(why)?.[1] ?? `${String(sheet ?? "")}:${String(slot ?? 0)}`;
    const retryArgs = nested ? { ...args, actor: rest } : rest;
    const second = await tool.execute(id, retryArgs as typeof params, signal); // 실패면 그대로 던진다(다른 이유) — 할 일 고리가 영어로 옮긴다.
    const note = `[Look not changed] The walking chip ${chip} was not picked from a list_npc_graphics result you have seen, so it was left out; everything else in this call was saved. `
      + `To change the look: list_npc_graphics{query:'<look>'} → upsert_actor{id:'${String(actor.id ?? "<id>")}', characterResourceId:'<sheet>', characterIndex:<slot>} using a selectionId charset:<sheet>:<slot> from that result. Do not resend the same chip.`;
    return { ...second, content: [...second.content, { type: "text", text: note }] };
  } });
}

/**
 * 문 칸(doorAt)을 단 create_transfer_pair 가 문앞이 막혀(상자·벽·봉쇄) 또는 doorAt·x,y 모양이 어긋나 거절되면, 그 끝의 doorAt 을 빼고 한 번 더 부른다 —
 * 편집기 도구는 doorAt 없는 끝을 시작 위치·다른 입구에서 걸어 닿는 가장 가까운 칸으로 옮겨 잇는다.
 * 2026-10-30 omo-loop-1030 terra boss-room r1~r3: 던전 안쪽 (24,7) 문앞이 막혀 세 판 모두 link 가 막힘으로 끝났다(문 그림은 없던 자리).
 * 옮긴 자리는 결과 글에 남고, 문 그림이 필요하면 그 자리에 stamp_object 로 찍는다.
 */
export function withTransferRelocation(tools: PiToolShape[]): PiToolShape[] {
  type End = { mapId?: string; x?: number; y?: number; doorAt?: { x: number; y: number } };
  const failed = (result: Awaited<ReturnType<PiToolShape["execute"]>>): string | undefined => {
    const first = result.content.find((c) => c.type === "text") as { text?: string } | undefined;
    const body = first?.text ?? "";
    let ok = true;
    try { ok = (JSON.parse(body) as { ok?: unknown }).ok !== false; } catch { ok = !/실행 실패/u.test(body); }
    return ok ? undefined : body;
  };
  return tools.map((tool) => tool.name !== "create_transfer_pair" ? tool : {
    ...tool,
    async execute(id, params, signal) {
      const args = (params && typeof params === "object" ? params : {}) as { a?: End; b?: End } & Record<string, unknown>;
      let result: Awaited<ReturnType<PiToolShape["execute"]>>;
      let why: string | undefined;
      try { result = await tool.execute(id, params, signal); why = failed(result); }
      catch (error) { why = error instanceof Error ? error.message : String(error); result = { content: [{ type: "text", text: JSON.stringify({ ok: false, summary: why }) }] } as Awaited<ReturnType<PiToolShape["execute"]>>; }
      if (!why || signal?.aborted || !/doorAt|안전한 출입구를 만들 수 없습니다|봉쇄|겹칩니다/u.test(why)) return result;
      // 어느 끝이 거절됐나: «A:»/«B:» 머리, 아니면 «문앞 (x,y)» 좌표가 맞는 끝, 아니면 doorAt 이 있는 끝 모두.
      const at = /문앞 \((\d+),(\d+)\)/u.exec(why);
      const hit = (e: End | undefined) => !!e?.doorAt && (at ? e.x === Number(at[1]) && e.y === Number(at[2]) : true);
      const sides = /(^|[^A-Za-z])A:/u.test(why) ? ["a"] : /(^|[^A-Za-z])B:/u.test(why) ? ["b"] : (["a", "b"] as const).filter((k) => hit(args[k]));
      // 먼저 거절된 끝만, 그래도 안 되면(도착 칸이 다른 이벤트와 겹침 등) 두 끝 모두 doorAt 을 뺀다.
      const withDoor = (["a", "b"] as const).filter((k) => args[k]?.doorAt);
      const tries = [sides.filter((k) => args[k as "a" | "b"]?.doorAt), withDoor].filter((t, i, all) => t.length && (i === 0 || t.join() !== all[0]!.join()));
      let second: Awaited<ReturnType<PiToolShape["execute"]>> | undefined;
      let drop: string[] = [];
      // 같은 호출 id 로 다시 부른다 — 실행기 기록(tool_end)이 처음 거절이 아니라 옮겨 이은 성공을 싣게(2026-10-30 «이어졌는데 FAIL 로 기록»).
      for (const t of tries) {
        const retry: Record<string, unknown> = { ...args };
        for (const k of t) { const { doorAt: _d, ...rest } = args[k as "a" | "b"]!; retry[k] = rest; }
        try { const r = await tool.execute(id, retry, signal); if (!failed(r)) { second = r; drop = t; break; } } catch { /* 다음 시도 */ }
      }
      if (!second) return result;
      const note = `[Relocated and linked] The first request was refused (${((t) => t.length > 220 ? `${t.slice(0, 219)}…` : t)(englishToolMessage(firstReason(why)))}) — called again without doorAt (the door cell) on end ${drop.map((k) => k.toUpperCase()).join("+")}, and linked at the nearest walkable cell (the new cell is in the result above). If you need a door picture, stamp it there with stamp_object.`;
      return { ...second, content: [...second.content, { type: "text", text: note }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
    },
  });
}

/**
 * 무작위 조우는 요청이 말할 때만 켠다(2026-10-25 판정 J55): 견습 기사·던전·마법 시험 게임에서 조수가 시키지 않은 조우표를 깔았고
 * set_encounter_table 이 발생률 0 을 기본값으로 올려 회복 수단 없는 파티가 길에서 전멸했다. 요청에 조우 낱말이 없고 encounterRate 를
 * 주지 않았으면 0(꺼짐)으로 넘긴다 — 표는 남아 나중에 켤 수 있다. 일부러 켜려면 encounterRate 를 숫자로 준다(끝맺음 검사가 보고를 요구한다).
 */
export function withEncountersOnlyWhenAsked(tools: PiToolShape[], task: string): PiToolShape[] {
  if (asksForEncounters(task)) return tools;
  return tools.map((tool) => tool.name !== "set_encounter_table" ? tool : {
    ...tool,
    async execute(id, params, signal) {
      const args = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
      if (args.encounterRate !== undefined) return tool.execute(id, params, signal);
      const result = await tool.execute(id, { ...args, encounterRate: 0 }, signal);
      const note = "[Encounters off] The request asks for no random encounters, so encounterRate was set to 0 (off) — the player never fights just by walking. Put fights in visible enemies (place_field_enemy) or event battles; if you really need random encounters, call again with encounterRate as a number (6-10 is typical).";
      return { ...result, content: [...result.content, { type: "text", text: note }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
    },
  });
}

/**
 * 그림 찾기 상한(G44, 2026-10-25 장난감 가게): 묶음에 장난감 가게 그림이 없는데 list_resources 를 14번 돌렸다.
 * 그림·배경(picture·backdrop·faceset) 검색이 0개로 끝난 것이 3번이면 더 찾지 않고 «없다»를 분명히 돌려준다 —
 * 사용자에게 그리기/일반 그림 중 고르게 하거나, 가장 가까운 일반 그림을 쓰고 보고에 적으라고 한다.
 */
const PICTURE_SEARCH_MISSES = 3;
function withPictureSearchBudget(tools: PiToolShape[]): PiToolShape[] {
  let misses = 0;
  const tried: string[] = [];
  return tools.map((tool) => tool.name !== "list_resources" ? tool : {
    ...tool,
    async execute(id, params, signal) {
      const args = (params ?? {}) as { kind?: string; query?: string };
      const pictureLike = ["picture", "backdrop", "faceset"].includes(String(args.kind));
      if (pictureLike && misses >= PICTURE_SEARCH_MISSES) {
        const summary = `[Picture search stopped] The picture bundle has no matching picture (already ${misses} searches with 0 results: ${tried.join(", ")}). Not searching again — ` +
          "either (1) ask the user with ask_user, in Korean: «꼭 맞는 그림이 없어요. 새로 그릴까요, 비슷한 일반 그림을 쓸까요?», " +
          "or (2) use the closest general picture you already found (night sky, field, interior…) and write in the report «맞는 그림이 없어 일반 그림을 썼다».";
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, summary }) }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
      }
      const result = await tool.execute(id, params, signal);
      if (pictureLike) {
        const first = result.content.find((c) => c.type === "text") as { text: string } | undefined;
        let count = -1;
        try { const parsed = JSON.parse(first?.text ?? "{}") as { summary?: string }; count = Number(/리소스 (\d+)개/u.exec(String(parsed.summary ?? ""))?.[1] ?? -1); } catch { /* 글 */ }
        if (count === 0) { misses += 1; tried.push(`${args.kind}:${String(args.query ?? "").slice(0, 30)}`); }
      }
      return result;
    },
  });
}
