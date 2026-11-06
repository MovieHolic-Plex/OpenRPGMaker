---
name: oprn-game-building-rules
description: Use when building or finishing a playable game in OPRN Studio (map, events, objective line, ending) — the editor assistant's build rules: checklist first, a «현재 목표» line per milestone, ending + structure check, a real path to an ending, visible entrances and investigate feedback. OPRN 에서 게임을 지을 때의 조수 규칙.
---

## 1. Plan with a checklist before the first write

1) For a change request, the first call is todo(op:"init") listing the whole request as steps, nothing left out — one item per place, person, dialogue, battle, link, ending and object, each with a check (machine check). A write verb called before the list is bounced.
2) Build the in-progress item with a tool, then mark it done right away — done runs the machine check and will not close on a ✗. 
3) If you cannot do it, close it as blocked with a one-line reason and move on. If a tool rejects, first try the other tool or argument the rejection names. After 3 failures on one item it counts as blocked.
4) Do not end the reply after calling only the checklist. Report in 3–6 lines: what you built (map names) and what you could not.
On the editing side of OPRN you have no todo tool: keep the same list in TODO.md before the first write, one line per item with its check, and tick a line only after its check passes.

## 2. Keep a «현재 목표» line on screen for the whole game

Set a one-line to-do in the «현재 목표» (current objective) bar at the top right of the screen (it persists across loads and map changes). When making a game always: one starting objective with at:'start', and for every event that advances the story (gives a key, shows a flashback, turns on a switch) the next objective with eventId — it goes right after that event's switch-on or item gain. Make the text concrete with place, person and object names («창고 상자에서 태엽 열쇠를 찾자», «밤이 되면 집 현관에서 쉬자»). A «where» is attached too: give the target event or place (id or name) in where, or if the text names another place, the direction of its entrance is added automatically («(지하철역 입구: 남동쪽)»). Not needed on events that call the ending.
So the game always has:
one starting objective with at:'start' on the start map's autorun (after the opening cutscene), then
for every event that advances the story (hands over a key, shows a flashback, turns on a switch) the next objective with eventId, placed right after that event's switch-on or item gain,
concrete text with place, person and object names, and a «where» (target event or place id/name) so the bar can add the entrance direction («(지하철역 입구: 남동쪽)»).
The chip is an event command, not a tool name: write {kind:"m2Command",commandId:"m2-214-ui-command",fields:{surface:"objectiveChip",message:"<text>",durationMs:0}} into the event's commands (upsert_event / patch_event_page), and turn the HUD line on with set_field_hud{objective:true} when the project hides it.
These are the exact guard messages the editor prints when the objective line is wrong — aim to never see them:
· 게임 어디에도 「현재 목표」 줄이 없다 — 새 플레이어가 무엇을 해야 하는지 화면에서 읽을 수 없다. set_objective{text, at:'start'} 로 시작 목표를 걸고, 이정표 이벤트마다 set_objective{text, eventId} 로 다음 목표를 건다.
· 게임을 시작했을 때 「현재 목표」 줄이 비어 있다 — 시작 맵의 자동 실행(오프닝 뒤 첫 컷신)에서 목표를 건다: set_objective{text, at:'start'}.
· 필드 HUD 가 「현재 목표」 줄을 숨긴다(fieldHud.objective:false) — set_objective 를 한 번 부르면 켜진다.

## 3. Define the ending, and check the structure before you finish

Save an ending definition (id, name, epilogue, presentation). It does nothing alone: put {kind:'triggerEnding',endingId} in a reachable event's commands. If the ending has conditions they are checked at the trigger — false = no ending, the next command runs. epilogue = script_cutscene beats. Act-end cards: presentation.finalTitle '제1막 끝' (End of Act 1).
A switch used in a page condition must be turned on by some branch's setSwitch, or the ending never fires.
Before you finish, 완료 직전 구조 점검(가드가 같은 것을 막는다): ① set_start_position 으로 시작 맵을 지은 게임의 첫 맵에 맞춘다(빈 시드 맵에서 시작하면 안 된다) ② 저작한 모든 맵이 시작 맵에서 문으로 닿는다(create_transfer_pair/create_time_gate) ③ define_ending 과 그것을 부르는 {kind:"triggerEnding"} 이벤트가 있다 ④ 새로하기 오프닝이 #2852 레이어드 도트 애니메틱 **6샷**(kind:"animatic" + pixelGrid 384×216 + 배경·캐릭터 칩 배우·광원/카메라·자막)으로 저장돼 있다.
In practice:
the start map is the first map of the game (set_start_position) — not the empty seed map,
every map you authored is reachable from the start map through a door or gate (create_transfer_pair / create_time_gate),
a define_ending definition exists and a reachable event calls it with {kind:"triggerEnding",endingId},
the new-game opening is saved as the #2852 layered pixel animatic with 6 shots (kind:"animatic", pixelGrid 384×216, background + character chip actors + light/camera beats + subtitles).

## 4. Play the whole path to an ending before you report done

Run a scene headlessly at a fixed tick and check the result. Input {mapId, start:{x,y}, steps:[…]}. Steps: wait{ticks} · face{dir} · move{dir|to} (stepping on touch events triggers them) · interact{eventId?} · choose{index} · present{itemId?} · set{switches?,variables?,inventory?,mapId?,x?,y?} · snapshotRewards · gift · useFieldSkill · retryCheckpoint · advanceDays · expect{…}. expect keys: playerAt, switchOn/switchOff, variableEquals, variableAtLeast, eventAt, eventOnMap, partyIncludes, followerCount, bgmPlaying, gameOver, endingReached (ending id), mapId, inventoryCount, goldDelta, inventoryDelta, interactionComplete, lastTransfer{fromMapId,toMapId}, and more. For rewards: snapshotRewards right before the interact, then expect goldDelta/inventoryDelta. Field action battles are not run here.
Choices must have their result inside the branch: an NPC's choices:[{text,commands:[…]}] or the native choices command's options:[{text,branch:[…]}]. Put party joins, boss battles (setSwitch in the win branch) and endings inside the branches, then check partyIncludes · switchOn · endingReached.
Run run_scene_test from the start position, through every interact and choice of the story, to expect:{endingReached:"<endingId>"} for each ending. Fix and re-run until it passes.

## 5. A new player must reach the ending without help

Put the door or stairs event ON the drawn entrance tile, and make the entrance readable before the player walks into it: the drawn door/stairs picture itself, or a sign next to it, or the entrance event with a nearSparkle. Never stand a door or story event on bare floor beside the drawn entrance — a new player clicks the picture, nothing happens, and they stop.
Every point a player can investigate must answer: a line of dialogue, an item, a switch, a hint at minimum. Decoration the player can click (sign, well, chest, bookshelf, statue, sparkle) with no text reads as a broken game. If a cell is only scenery, leave it without an event.
Before you report done, play it once as a first-time player: start from the new-game opening, follow only the «현재 목표» line and what you can SEE on screen, and reach an ending. Every step of that play must be one of: the objective line says where to go, or you can see the thing to walk to. If you needed a coordinate, an event id, or the project files to move on, a new player cannot — fix the map (visible entrance, sparkle, objective with «where») and play again from the start. On the editing side of OPRN this play is the goal, because a new player cannot read the database. Verify it with run_scene_test through the whole path plus the critic's screen check.
