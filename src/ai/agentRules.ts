// 게임을 짓는 규칙의 단일 소스 — 편집기 조수(프롬프트·가드)와 에이전트 모드(코딩 에이전트 스킬)가 같은 글을 쓴다.
// 같은 규칙을 세 곳에 손으로 적으면 한 곳만 고쳐져 조용히 갈라진다(B+ 비교의 스킬 사본이 그랬다).
// 여기 상수만 고치고, 커밋된 스킬은 `npm run agent-rules:skill` 로 다시 굽는다 — 어긋나면 test/agentRules.test.ts 가 잡는다.

export const TODO_LOOP_LINE =
  "1) For a change request, the first call is todo(op:\"init\") listing the whole request as steps, nothing left out — one item per place, person, dialogue, battle, link, ending and object, each with a check (machine check). A write verb called before the list is bounced.";

export const SET_OBJECTIVE_DESCRIPTION =
  "Set a one-line to-do in the «현재 목표» (current objective) bar at the top right of the screen (it persists across loads and map changes). When making a game always: one starting objective with at:'start', and for every event that advances the story (gives a key, shows a flashback, turns on a switch) the next objective with eventId — it goes right after that event's switch-on or item gain. Make the text concrete with place, person and object names («창고 상자에서 태엽 열쇠를 찾자», «밤이 되면 집 현관에서 쉬자»). A «where» is attached too: give the target event or place (id or name) in where, or if the text names another place, the direction of its entrance is added automatically («(지하철역 입구: 남동쪽)»). Not needed on events that call the ending.";

export const OBJECTIVE_MISSING_MESSAGE =
  "게임 어디에도 「현재 목표」 줄이 없다 — 새 플레이어가 무엇을 해야 하는지 화면에서 읽을 수 없다. set_objective{text, at:'start'} 로 시작 목표를 걸고, 이정표 이벤트마다 set_objective{text, eventId} 로 다음 목표를 건다.";

export const OBJECTIVE_HUD_HIDDEN_MESSAGE =
  "필드 HUD 가 「현재 목표」 줄을 숨긴다(fieldHud.objective:false) — set_objective 를 한 번 부르면 켜진다.";

export const OBJECTIVE_NOT_AT_START_MESSAGE =
  "게임을 시작했을 때 「현재 목표」 줄이 비어 있다 — 시작 맵의 자동 실행(오프닝 뒤 첫 컷신)에서 목표를 건다: set_objective{text, at:'start'}.";

export const PRE_FINISH_STRUCTURE_CHECK =
  "완료 직전 구조 점검(가드가 같은 것을 막는다): ① set_start_position 으로 시작 맵을 지은 게임의 첫 맵에 맞춘다(빈 시드 맵에서 시작하면 안 된다) ② 저작한 모든 맵이 시작 맵에서 문으로 닿는다(create_transfer_pair/create_time_gate) ③ define_ending 과 그것을 부르는 {kind:\"triggerEnding\"} 이벤트가 있다 ④ 새로하기 오프닝이 #2852 레이어드 도트 애니메틱 **6샷**(kind:\"animatic\" + pixelGrid 384×216 + 배경·캐릭터 칩 배우·광원/카메라·자막)으로 저장돼 있다.";

export const RUN_SCENE_TEST_DESCRIPTION =
  "Run a scene headlessly at a fixed tick and check the result. Input {mapId, start:{x,y}, steps:[…]}. Steps: wait{ticks} · face{dir} · move{dir|to} (stepping on touch events triggers them) · interact{eventId?} · choose{index} · present{itemId?} · set{switches?,variables?,inventory?,mapId?,x?,y?} · snapshotRewards · gift · useFieldSkill · retryCheckpoint · advanceDays · expect{…}. expect keys: playerAt, switchOn/switchOff, variableEquals, variableAtLeast, eventAt, eventOnMap, partyIncludes, followerCount, bgmPlaying, gameOver, endingReached (ending id), mapId, inventoryCount, goldDelta, inventoryDelta, interactionComplete, lastTransfer{fromMapId,toMapId}, and more. For rewards: snapshotRewards right before the interact, then expect goldDelta/inventoryDelta. Field action battles are not run here.";

export const DEFINE_ENDING_DESCRIPTION =
  "Save an ending definition (id, name, epilogue, presentation). It does nothing alone: put {kind:'triggerEnding',endingId} in a reachable event's commands. If the ending has conditions they are checked at the trigger — false = no ending, the next command runs. epilogue = script_cutscene beats. Act-end cards: presentation.finalTitle '제1막 끝' (End of Act 1).";

// 새 지침 셋 — 2026-11-06 B+ 판정에서 남은 격차가 «안내 마무리»(입구·조사 지점·새 플레이어 도달)였다.

export const MARK_ENTRANCES_RULE =
  "Put the door or stairs event ON the drawn entrance tile, and make the entrance readable before the player walks into it: the drawn door/stairs picture itself, or a sign next to it, or the entrance event with a nearSparkle. Never stand a door or story event on bare floor beside the drawn entrance — a new player clicks the picture, nothing happens, and they stop.";

export const EXAMINE_FEEDBACK_RULE =
  "Every point a player can investigate must answer: a line of dialogue, an item, a switch, a hint at minimum. Decoration the player can click (sign, well, chest, bookshelf, statue, sparkle) with no text reads as a broken game. If a cell is only scenery, leave it without an event.";

export const NEW_PLAYER_PLAYTEST_RULE =
  "Before you report done, play it once as a first-time player: start from the new-game opening, follow only the «현재 목표» line and what you can SEE on screen, and reach an ending. Every step of that play must be one of: the objective line says where to go, or you can see the thing to walk to. If you needed a coordinate, an event id, or the project files to move on, a new player cannot — fix the map (visible entrance, sparkle, objective with «where») and play again from the start. On the editing side of OPRN this play is the goal, because a new player cannot read the database. Verify it with run_scene_test through the whole path plus the critic's screen check.";

// 2026-11-07 terra-fun-game 판정: 파일럿 Terra 게임이 «끝까지는 간다»인데 판단·보상 연출이 0이었다(fun 3/10, choice 0 · payoff 1 · again 0).
// 그래서 «끝까지 간다» 다음 층—— 플레이어가 판단하고, 누르면 화면이 반응하고, 클라이맥스가 연출로 보인다 —— 를 같은 단일 소스에 넣는다.
export const PLAY_LOOP_RULE =
  "A game that only walks to an ending is a tutorial, not a game. Before you call it done, the whole path must contain at least one decision the player makes and sees the result of. Author it with a real instrument, not prose: list_puzzle_presets then author_map_puzzle (or compile_puzzle kind:switch-sequence|password|item-gate|push-switches) for the gate, and put the reward inside a branch so the outcome differs. One gate on the way to the ending is the minimum; two is better than one.";

export const ACTION_FEEDBACK_RULE =
  "Every pickup, unlock and switch-on must be SEEN, not only said. Text alone ('반짝!', '숲이 환하게 빛났어요') reads as nothing happened. Attach the picture to the act: place_pixel_fx / set_event_pixel_fx (fire, sparkle, glow, water) at the spot, attach_pixel_fx for skill and item effects in battle, set_game_audio for field BGM plus the pickup and clear sounds, and a file dialog line from the speaker who reacts. The judge called exactly this out: an ending line said the forest lit up while the field stayed the same.";

export const CLIMAX_STAGING_RULE =
  "Stage the turn and the ending with script_cutscene (beats: dialogue, camera move, wait, transfer, triggerEnding) or script_cutscene_preset (memory_opening|bedside_monologue|ending_fade). A climax delivered as one dialogue line gets a payoff score of 1; the same beat with a 3-5 second staged scene (light, character entrance, music change, then the ending card) is what players remember. Keep each staged scene under 10 seconds and never stage a scene that the ending card already shows.";

export const OBJECTIVE_MATCHES_PICTURE_RULE =
  "The thing the objective line names must look like that thing on the map. If the objective says 별나무 (star tree) the player must not find a treasure chest sprite; if it says 창고 the entrance must read as a warehouse. Pick the sprite or tile that matches the words, or change the words to match the picture — a mismatch sent a judge looking at the wrong object and cost the game two major defects.";

export const REWARD_LOOP_RULE =
  "A reward the player cannot use is decoration. Every pickup must (a) LAND visibly — the item appears in the inventory with a short line from the finder and a sparkle at the spot (place_pixel_fx) — and (b) have somewhere to go: a shop that sells something useful (place_npc with shop, then set_shop_stock with real stock and prices), an equipment piece the player can wear (upsert_equipment), or a consumable that changes the next fight (upsert_item). One shop with three items the player can actually afford beats five chests of nothing. Judges called exactly this out twice: a star shard that only went back to the quest giver, and a market square with crates but no merchant.";

export const PROGRESSION_RULE =
  "If the game has any fight or challenge, the player must END stronger than they started, and the difficulty must follow: a starting party (set_party), one skill or weapon gained on the way (upsert_skill / upsert_equipment inside the reward branch), and a second encounter that needs it (place_battle_blocker or a battleProcessing branch with a different troop from upsert_troop). Growth the player never feels is a zero, and so is an HUD number that never changes — either give the number a meaning the player discovers, or hide it with set_field_hud.";

const OBJECTIVES: readonly string[] = [
  "one starting objective with at:'start' on the start map's autorun (after the opening cutscene), then",
  "for every event that advances the story (hands over a key, shows a flashback, turns on a switch) the next objective with eventId, placed right after that event's switch-on or item gain,",
  "concrete text with place, person and object names, and a «where» (target event or place id/name) so the bar can add the entrance direction («(지하철역 입구: 남동쪽)»).",
];

const STRUCTURE: readonly string[] = [
  "the start map is the first map of the game (set_start_position) — not the empty seed map,",
  "every map you authored is reachable from the start map through a door or gate (create_transfer_pair / create_time_gate),",
  "a define_ending definition exists and a reachable event calls it with {kind:\"triggerEnding\",endingId},",
  "the new-game opening is saved as the #2852 layered pixel animatic with 6 shots (kind:\"animatic\", pixelGrid 384×216, background + character chip actors + light/camera beats + subtitles).",
];

export const AGENT_RULES_SECTIONS: readonly { readonly title: string; readonly lines: readonly string[] }[] = [
  {
    title: "1. Plan with a checklist before the first write",
    lines: [
      TODO_LOOP_LINE,
      "2) Build the in-progress item with a tool, then mark it done right away — done runs the machine check and will not close on a ✗. ",
      "3) If you cannot do it, close it as blocked with a one-line reason and move on. If a tool rejects, first try the other tool or argument the rejection names. After 3 failures on one item it counts as blocked.",
      "4) Do not end the reply after calling only the checklist. Report in 3–6 lines: what you built (map names) and what you could not.",
      "On the editing side of OPRN you have no todo tool: keep the same list in TODO.md before the first write, one line per item with its check, and tick a line only after its check passes.",
    ],
  },
  {
    title: "2. Keep a «현재 목표» line on screen for the whole game",
    lines: [
      SET_OBJECTIVE_DESCRIPTION,
      "So the game always has:",
      ...OBJECTIVES,
      "The chip is an event command, not a tool name: write {kind:\"m2Command\",commandId:\"m2-214-ui-command\",fields:{surface:\"objectiveChip\",message:\"<text>\",durationMs:0}} into the event's commands (upsert_event / patch_event_page), and turn the HUD line on with set_field_hud{objective:true} when the project hides it.",
      "These are the exact guard messages the editor prints when the objective line is wrong — aim to never see them:",
      "· " + OBJECTIVE_MISSING_MESSAGE,
      "· " + OBJECTIVE_NOT_AT_START_MESSAGE,
      "· " + OBJECTIVE_HUD_HIDDEN_MESSAGE,
    ],
  },
  {
    title: "3. Define the ending, and check the structure before you finish",
    lines: [
      DEFINE_ENDING_DESCRIPTION,
      "A switch used in a page condition must be turned on by some branch's setSwitch, or the ending never fires.",
      "Before you finish, " + PRE_FINISH_STRUCTURE_CHECK,
      "In practice:",
      ...STRUCTURE,
    ],
  },
  {
    title: "4. Play the whole path to an ending before you report done",
    lines: [
      RUN_SCENE_TEST_DESCRIPTION,
      "Choices must have their result inside the branch: an NPC's choices:[{text,commands:[…]}] or the native choices command's options:[{text,branch:[…]}]. Put party joins, boss battles (setSwitch in the win branch) and endings inside the branches, then check partyIncludes · switchOn · endingReached.",
      "Run run_scene_test from the start position, through every interact and choice of the story, to expect:{endingReached:\"<endingId>\"} for each ending. Fix and re-run until it passes.",
    ],
  },
  {
    title: "5. A new player must reach the ending without help",
    lines: [
      MARK_ENTRANCES_RULE,
      EXAMINE_FEEDBACK_RULE,
      NEW_PLAYER_PLAYTEST_RULE,
    ],
  },
  {
    title: "6. Make it fun, not just finishable",
    lines: [
      PLAY_LOOP_RULE,
      ACTION_FEEDBACK_RULE,
      CLIMAX_STAGING_RULE,
      OBJECTIVE_MATCHES_PICTURE_RULE,
    ],
  },
  {
    title: "7. Rewards have to be usable and the player has to grow",
    lines: [
      REWARD_LOOP_RULE,
      PROGRESSION_RULE,
    ],
  },
];

export const AGENT_RULES_SKILL_ID = "oprn-game-building-rules";

export const AGENT_RULES_SKILL_DESCRIPTION =
  "Use when building or finishing a playable game in OPRN Studio (map, events, objective line, ending) — the editor assistant's build rules: checklist first, a «현재 목표» line per milestone, ending + structure check, a real path to an ending, visible entrances and investigate feedback. OPRN 에서 게임을 지을 때의 조수 규칙.";

export function renderAgentRulesSkill(): string {
  const front = ["---", "name: " + AGENT_RULES_SKILL_ID, "description: " + AGENT_RULES_SKILL_DESCRIPTION, "---", ""];
  const body = AGENT_RULES_SECTIONS.flatMap((section) => ["## " + section.title, "", ...section.lines, ""]);
  return [...front, ...body].join("\n").trimEnd() + "\n";
}

export function agentRulesPromptLines(): readonly string[] {
  return [
    "Game-building rules of OPRN Studio (the editor assistant follows the same text):",
    ...AGENT_RULES_SECTIONS.flatMap((section) => ["[" + section.title + "]", ...section.lines.map((line) => "- " + line)]),
  ];
}
