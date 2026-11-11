// 조수 v2 게임 내용 검사 — 실행이 바꾼 이벤트·데이터를 요청 낱말과 맞대어 «흉내»와 «빠진 쪽»을 짚는다.
//
// 왜(2026-10-24 새 12 사례): 비 → 화면 색만, 독 → 소리·번쩍임만, 엔딩 → 내레이션+타이틀, 우물 동전 → 물건이 없어도 고르기 창,
// 암호 → 「이미 통과」 페이지 없음·선언 안 한 깃발. 모델이 「됐다」고 말해도 이 검사가 남은 문제를 끝맺음 관문에 올린다.
// 순수 함수(before·after·요청 글) — 워커·테스트가 같이 부른다.
import type { Command, GameMap, Project } from "@/project/types";
import { choiceMetaTag } from "@/project/choiceText";
import { fieldMenu } from "@/project/fieldMenu";
import { usesRelationshipMenu } from "@/project/relationshipMenu";
import { simulateBattle } from "@/battle/simulate";
import { gatesThatOpenNothing, lockBypasses, placeholderTexts, selfRevealingLocks, unjoinedFollowers, weakPuzzleLocks } from "./puzzleChecks";
import { splitScriptSpeaker } from "@/project/endingSummary";
import { wantsWholeGame } from "../request/readers";
import { enemyIdentityProblems } from "./enemyChecks";
import { hudTitleChoiceProblems } from "./hudTitleChecks";
import { withoutNegatedEncounters } from "../request/combat";
import { lookMismatches, oversizedSprites, pristineFantasyHero, titleBackdropMismatch } from "./lookChecks";
import { dryBoats, dryBridges, placementProblems, type PlacementProblem } from "../place/placementRules";
import { offPurposeProps } from "../place/roomPurpose";
import { unsafeSpawnLines } from "@/project/chaserSpawnSafety";
import { projectCanLoseHp, resolvedHudWidgets } from "@/project/fieldHud";
import { musicAsked, musicOnly, soundOnly } from "../request/readers";
import { FOE_ASK, STATE_WORDS } from "../request/combat";
import { WEATHER_WORDS, SHAKE_WORDS, FLASH_WORDS, HIDDEN_WORDS, ENDING_WORDS } from "../request/asks";
import { Obj, obj, eventsOf, dayCounterVariables, changedEvents, walkCommands, allCommands, projectHasCommand, flatConditions, readsOf, audioBindingsChanged, seBindingsChanged, changedRecordsJson } from "./gameCheckReads";
import { lostLinks, instantEndings, skippableClues, slowChasers, vanishingChasers, duplicateMaps, flatPerDayPeople, deadClues } from "./storyFlowChecks";

/** 실행이 바꾼 내용에서 요청과 어긋나는 것 — 끝맺음 관문이 고칠 거리로 올린다. 빈 배열이면 문제 없음. */
export function gameContentProblems(before: Project, after: Project, task: string): string[] {
  const problems: string[] = [];
  const changed = changedEvents(before, after);
  const cmds = changed.flatMap((ev) => allCommands(ev).map((row) => ({ ev, ...row })));
  const kinds = new Set(cmds.map((r) => String(r.cmd.kind)));

  // 1) 날씨: 실제 setWeather(컷신 weather 비트·set_scene_mood 도 결국 setWeather 다).
  if (WEATHER_WORDS.test(task) && !kinds.has("setWeather") && !cmds.some((r) => r.cmd.kind === "m2Command" && /m2-050/u.test(String(r.cmd.commandId)))) {
    problems.push(`[게임 검사 날씨] 요청에 비·눈·날씨가 있는데 바꾼 이벤트에 실제 날씨 명령(setWeather)이 없다${kinds.has("tint") ? " — 화면 색(tint)은 비가 아니다" : ""}. add_event 의 weather 비트나 upsert_event 의 {kind:'setWeather',weather:'rain',intensity:0.6} 로 넣는다.`);
  }
  // 1b) 화면 흔들림·번쩍·음악: 실제 명령(카메라 이동·페이드로 흉내 내지 않는다).
  const m2Has = (re: RegExp) => cmds.some((r) => r.cmd.kind === "m2Command" && re.test(String(r.cmd.commandId)));
  // TypeScript event scripts call the same effects through game.* (openwiki/script-sandbox.md) — 2026-10-31 live run:
  // a lever script with `await game.shake(6, 40)` was reported as «no shake command».
  const scriptSource = cmds.filter((r) => r.cmd.kind === "script").map((r) => String(r.cmd.source ?? "")).join("\n");
  const scriptCalls = (re: RegExp) => re.test(scriptSource);
  if (SHAKE_WORDS.test(task) && !m2Has(/m2-048/u) && !scriptCalls(/\bgame\.shake\s*\(|m2-048/u)) problems.push("[게임 검사 화면] 요청에 흔들림·지진이 있는데 실제 화면 흔들기 명령이 없다(카메라 이동은 흔들림이 아니다). add_event 의 shake 비트({do:'shake',strength:'strong',axis:'vertical'})로 넣는다.");
  if (FLASH_WORDS.test(task) && !m2Has(/m2-047/u) && !scriptCalls(/\bgame\.flash\s*\(|m2-047/u) && !cmds.some((r) => r.cmd.kind === "setWeather" && r.cmd.weather === "storm")) problems.push("[게임 검사 화면] 요청에 번쩍임·번개가 있는데 실제 화면 번쩍 명령이 없다(페이드 아웃은 번쩍이 아니다). add_event 의 flash 비트({do:'flash',color:'white'})로 넣는다.");
  if (soundOnly(task) && !seBindingsChanged(before, after) && !kinds.has("playAudio") && !scriptCalls(/\bgame\.playSe\s*\(/u)) problems.push("[게임 검사 효과음] 요청에 효과음이 있는데 어느 자리에도 소리를 걸지 않았다. 화풍 통째로는 set_game_audio{role:'sfx-style', style}, 자리 하나는 store_find_sound → store_install → set_game_audio{role:'se', cue, resourceId}(프로젝트에 있는 소리면 list_resources{kind:'se'} 로 골라 바로 role:'se').");
  if (musicAsked(task) && !audioBindingsChanged(before, after) && !kinds.has("playAudio") && !kinds.has("stopAudio") && !m2Has(/bgm|audio|music/iu) && !scriptCalls(/\bgame\.(playBgm|stopBgm)\s*\(/u)) problems.push("[게임 검사 음악] 요청에 음악·BGM 이 있는데 어느 자리에도 곡을 걸지 않았다. 맵·전투·보스·승리·타이틀·엔딩 곡은 set_game_audio 로 건다(맞는 곡이 프로젝트에 없으면 store_find_music → 묻지 말고 store_install 로 넣은 뒤). 장면 도중 잠깐 바뀌는 곡만 add_event 의 music 비트({do:'music',action:'bgm',query:'festival'}).");
  // 추격 음악은 추격자가 나타날 때의 곡이다 — 전투 곡이 아니다(2026-10-30 실조수 e2e: 「아오오니 느낌으로 추격 음악」이 모든 전투에 걸렸다).
  if (musicAsked(task) && /추격|쫓아|쫓기|chase/iu.test(task) && !/전투|배틀|battle/iu.test(task) && (before.system.battleBgmResourceId ?? null) !== (after.system.battleBgmResourceId ?? null)) problems.push("[게임 검사 음악] 추격 음악을 모든 전투 곡(battle-default)에 걸었다. 추격 곡은 set_game_audio role:'chase'(+mapIds)로 추격자가 나타날 때 바꾸고 끝나면 되돌린다 — 전투 곡은 원래대로 돌려놓는다(추격자가 없으면 곡만 넣어 두고 보고에 적는다).");
  // 1c) 눈에 안 보이는 «조사하는» 물건: 새로 만든 결정 키(action) 이벤트에 그림도 없고 그 칸에 물건 타일도 없다(이동석·덤불·표지판이 맨땅으로 보였다).
  if (!HIDDEN_WORDS.test(task)) {
    for (const ev of changed) {
      if (ev.mapId === "common") continue;
      const map = after.maps[ev.mapId] as unknown as Obj | undefined;
      const raw = ((map?.events as Obj[] | undefined) ?? []).find((e) => e.id === ev.id);
      if (!map || !raw) continue;
      const pages = ev.pages;
      // 조사하는 쪽 = 결정 키로 열리고 명령이 있는 쪽. 명령이 없는 action 쪽(목표 줄 이벤트 ev_objective_* 의 «다 보여 준 뒤» 빈 쪽)은 조사할 것이 없다 —
      // 2026-11-10 Terra 두 판(jrpg-w1·fun-w1): set_objective 가 지은 「시작 목표」가 «맨땅» 으로 걸려 조수가 그 칸 위에 물건을 찍었다.
      const examinePages = pages.filter((pg) => obj(pg.trigger)?.kind === "action" && Array.isArray((pg as Obj).commands) && ((pg as Obj).commands as unknown[]).length > 0);
      if (!examinePages.length) continue;
      if (pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); })) continue;
      const w = Number(map.width), i = Number(raw.y) * w + Number(raw.x);
      const at = (layer: unknown) => Array.isArray(layer) ? Number(layer[i]) : -1;
      // 도구가 만든 장면 받침(ev_cutscene_*·호위 목적지)은 빼고, 그 칸이나 바로 위(북쪽) 칸에 물건 타일·건물 도장이 있으면 «그 물건 앞»이라 본다.
      if (/^ev_(cutscene|escort)_/u.test(ev.id)) continue;
      // 바닥에 떨어진 증거(evidenceOnThing `<사람 id>_evidence`)는 그림 대신 가까이 오면 반짝인다(nearSparkle) — 맨땅이 아니다.
      // 이 칸에 「물건을 찍거나 옮겨라」를 내면 모델이 칸을 일곱 번 옮기고 대사의 자리 말과 어긋났다(2026-10-31 mef3 terra 추리).
      if (examinePages.every((pg) => !!obj((pg as Obj).nearSparkle))) continue;
      const x0 = Number(raw.x), y0 = Number(raw.y), h = Number(map.height);
      let near = false;
      for (const [dx, dy] of [[0, 0], [0, -1]] as const) {
        const x = x0 + dx, y = y0 + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const j = y * w + x;
        const v = (layer: unknown) => Array.isArray(layer) ? Number(layer[j]) : -1;
        if (v(map.upperTiles) > 0 || v(map.lowerOverlayTiles) > 0) near = true;
      }
      const inStamp = ((map.structurePlacements as Obj[] | undefined) ?? []).some((sp) => x0 >= Number(sp.x) && x0 < Number(sp.x) + Number(sp.w) && y0 >= Number(sp.y) && y0 < Number(sp.y) + Number(sp.h));
      if (near || inStamp || at(map.upperTiles) > 0) continue;
      problems.push(`[게임 검사 보임] 「${ev.name}」(${ev.id}) 는 조사하는 이벤트인데 그림도 없고 그 칸(${String(raw.x)},${String(raw.y)})에 물건 타일도 없다 — 플레이어 눈에 맨땅이다. list_spatial_designs{kind:'object',query:'비석·돌·분수·나무…'} 로 물건을 찾아 stamp_object 로 그 칸 바로 위(${String(raw.x)},${Number(raw.y) - 1})나 그 칸에 찍거나, 이벤트를 이미 있는 물건 앞으로 move_event 한다.`);
    }
  }
  // 1c2) 그림 있는 사람의 「그림 없는 기본 페이지」가 말을 한다 — 장면 전에는 빈 바닥인데 결정 키를 누르면 대사가 나온다
  //   (2026-10-25 장난감 가게 G38: 회상 대역 ev_flashback_* 의 투명 페이지 0 에 「젊은 제페토: …」 한 줄).
  for (const ev of changed) {
    if (ev.mapId === "common" || /^ev_(cutscene|escort)_/u.test(ev.id)) continue;
    const drawn = (pg: Obj) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); };
    if (!ev.pages.some((pg) => drawn(pg as unknown as Obj))) continue;
    const bare = ev.pages.find((pg) => { const p = pg as unknown as Obj; return !drawn(p) && obj(p.trigger)?.kind === "action" && !((p.conditions as unknown[] | undefined) ?? []).length
      && ((p.commands as Obj[] | undefined) ?? []).some((c) => c.kind === "text"); });
    if (bare) problems.push(`[게임 검사 보임] 「${ev.name}」(${ev.id}) 의 그림 없는 기본 페이지가 말을 한다 — 그 사람이 보이기 전에는 빈 바닥인데 결정 키를 누르면 대사가 나온다. 그 페이지의 대사를 비우거나(명령 없음) 보이는 페이지에만 대사를 둔다.`);
  }
  // 1c3) 선택지 문구에 제작 메모 꼬리표 — 「(엔딩)」「(배드 엔딩)」「(+1일)」은 스포일러이자 제작 흔적이다(2026-10-25 판정 J37).
  //   런타임도 보여 줄 때 걷지만(playerChoiceText), 저작본에서 지워야 편집기·대화 기록에도 남지 않는다.
  for (const r of cmds) {
    if (r.cmd.kind !== "choices" || !Array.isArray(r.cmd.options)) continue;
    const tagged = (r.cmd.options as Obj[]).map((o) => ({ text: String(o?.text ?? ""), tag: choiceMetaTag(String(o?.text ?? "")) })).filter((o) => o.tag);
    if (tagged.length) problems.push(`[게임 검사 선택지] 「${r.ev.name}」(${r.ev.id}) 의 선택지에 제작 메모가 보인다: ${tagged.slice(0, 3).map((o) => `「${o.text}」`).join(" · ")} — 플레이어 문구에서 ${tagged.map((o) => o.tag).filter((t, i, a) => a.indexOf(t) === i).join("·")} 를 지운다(엔딩·날짜 경과는 선택 뒤 장면이 보여 준다).`);
  }
  // 1c4) 전투 없는 이야기 메뉴인데 전투를 넣었다 — 스킬·장비가 메뉴에 없어 전투 준비를 못 한다.
  {
    const menu = fieldMenu(after);
    const commands = new Set(menu?.entries.map((e) => e.command) ?? []);
    if (menu && !commands.has("skills") && !commands.has("equipment") && !usesRelationshipMenu(after) && cmds.some((r) => r.cmd.kind === "battleProcessing")) {
      problems.push("[게임 검사 메뉴] 전투(battleProcessing)를 넣었는데 ESC 메뉴가 전투 없는 이야기용이다 — 스킬·장비·상태를 볼 수 없다. configure_field_menu{preset:'default'} 로 기본 메뉴로 되돌리거나 custom add 로 skills·equipment·status 를 더한다.");
    }
  }
  // 1d) 상점: 사고파는 요청인데 바꾼 이벤트 어디에도 상점 명령이 없다(대장장이가 낮에 대사만 했다 — 2026-10-24 스위트).
  if (/상점|가게|무기점|도구점|잡화점|장사|shop|store/iu.test(task) && /팔|사고|살 수|구매|장사|문을 열|열고|열어|buy|sell/iu.test(task) && !kinds.has("shop")) {
    problems.push("[게임 검사 상점] 요청에 사고파는 상점이 있는데 바꾼 이벤트에 상점 명령(kind:'shop')이 없다 — set_shop_stock 으로 그 NPC 에 상점을 달거나, 시간대 페이지라면 열린 시간 페이지에 {kind:'shop',goods,allowSell:true} 를 넣는다.");
  }
  // 1e) 시간표: 「밤에는 집에·낮에는 가게에」처럼 시간대마다 자리가 바뀌는 사람 — 시간표(schedule)나 시간대 페이지(timePhase)가 있어야 한다.
  if (/(밤|저녁|아침|낮|새벽|시간)[^.!?]{0,12}(에는|엔|이 되면|마다|동안)[^.!?]{0,20}(집|가게|광장|여관|방)\s*(안|밖)?\s*(에|으로|로)\s*(있|가|들어가|돌아가|나와|서)/u.test(task)) {
    const scheduled = Object.values(after.maps).some((m) => (m.events ?? []).some((e) => {
      const prev = before.maps[m.id]?.events?.find((b) => b.id === e.id) as unknown as Obj | undefined;
      const sch = (e as unknown as Obj).schedule;
      return Array.isArray(sch) && sch.length > 0 && JSON.stringify(sch) !== JSON.stringify(prev?.schedule);
    }));
    // 시간대 페이지는 «사람» 이벤트(그림 있는 페이지)여야 한다 — 팻말 하나에만 시간대 페이지가 있으면 사람은 그대로다.
    const phasePages = changed.some((ev) => ev.pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); }) && ev.pages.some((pg) => flatConditions(pg.conditions).some((c) => c.kind === "timePhase")));
    if (!scheduled && !phasePages) problems.push("[게임 검사 시간] 요청에 시간대마다 자리·행동이 바뀌는 사람이 있는데 시간표(set_npc_schedule)도 시간대 페이지({kind:'timePhase'} 조건)도 없다 — configure_time_system 을 켜고 set_npc_schedule 로 낮·밤 자리를 정한다.");
  }
  // 1e2) 같은 두 맵 사이 문이 따로 떨어져 둘 이상: 짓기 도구가 이미 이은 뒤 다시 이어서 풀밭 한가운데 투명 문이 남았다(2026-10-25 숲 3건).
  {
    const transfersOf = (ev: Obj): string[] => {
      const out: string[] = [];
      const walk = (list: unknown): void => { if (!Array.isArray(list)) return; for (const c of list as Obj[]) { if (c?.kind === "transfer" && typeof c.mapId === "string") out.push(c.mapId); for (const k of ["then", "else", "branch", "commands"]) walk(c?.[k]); if (Array.isArray(c?.options)) for (const o of c.options as Obj[]) walk(o?.branch); } };
      for (const page of (ev.pages as Obj[] | undefined) ?? []) walk(page.commands);
      walk(ev.commands);
      return out;
    };
    for (const map of Object.values(after.maps)) {
      const old = new Set((before.maps[map.id]?.events ?? []).map((e) => e.id));
      const byTarget = new Map<string, { x: number; y: number; id: string; fresh: boolean }[]>();
      for (const ev of map.events) for (const to of new Set(transfersOf(ev as unknown as Obj))) {
        if (to === map.id) continue;
        const list = byTarget.get(to) ?? []; list.push({ x: ev.x, y: ev.y, id: ev.id, fresh: !old.has(ev.id) }); byTarget.set(to, list);
      }
      for (const [to, doors] of byTarget) {
        if (!doors.some((d) => d.fresh) || doors.length < 2) continue;
        // 붙어 있는 문(두 칸 폭)은 한 문으로 친다.
        const groups: (typeof doors)[] = [];
        for (const d of doors) { const g = groups.find((gr) => gr.some((o) => Math.abs(o.x - d.x) + Math.abs(o.y - d.y) <= 2)); if (g) g.push(d); else groups.push([d]); }
        if (groups.length < 2) continue;
        const where = groups.map((g) => `(${g[0]!.x},${g[0]!.y}) ${g[0]!.id}`).join(" · ");
        problems.push(`[게임 검사 이동] ${map.name ?? map.id} 에서 「${after.maps[to]?.name ?? to}」로 가는 문이 ${groups.length}곳 따로 있다: ${where} — 짓기 도구가 이미 이은 문과 새로 단 문이 겹쳤다. 요청한 자리(가장자리 길 끝·문) 하나만 남기고 나머지는 remove_event 로 지운다(반대쪽 맵의 짝 문도).`);
      }
    }
  }
  // 1e3) 「숲·들판에 적/사당」인데 새 맵 없이 마을 맵에 두었다(마을 나무 덩이 안의 고블린·멧돼지 — 2026-10-25).
  if (/숲|들판|필드|초원/u.test(task) && !/마을\s*(안|광장|길|숲)|광장/u.test(task) && !Object.keys(after.maps).some((id) => !before.maps[id])) {
    const foes = changed.filter((ev) => ((ev as unknown as Obj).pages as Obj[] | undefined ?? []).some((p) => (p.trigger as Obj | undefined)?.kind === "eventTouch" && JSON.stringify(p.commands ?? []).includes("battleProcessing")));
    if (foes.length) problems.push(`[게임 검사 장소] 요청은 숲·들판인데 새 맵 없이 기존 맵에 필드 적 ${foes.length}개를 두었다 — author_forest_route(숲, 들판은 terrain:'field')로 그 맵을 짓고 가장자리로 이은 뒤 거기에 둔다.`);
  }
  // 1f) 새로 지은 맵에 들어가는 길: 다른 맵의 이벤트·연결 어디에도 그 맵 id 가 없으면 플레이어가 못 간다(집 실내·필드가 고립됐다).
  {
    const newMaps = Object.keys(after.maps).filter((id) => !before.maps[id] && id !== after.startMapId);
    if (newMaps.length) {
      const rest = after as unknown as Obj;
      for (const id of newMaps) {
        const others = JSON.stringify({ maps: Object.values(after.maps).filter((m) => m.id !== id).map((m) => m.events), common: after.commonEvents, conn: rest.mapConnections ?? rest.connections ?? null, world: rest.worldmap ?? null });
        if (!others.includes(`"${id}"`)) problems.push(`[게임 검사 이동] 새 맵 「${after.maps[id]!.name ?? id}」(${id}) 로 들어가는 문·이동이 어느 맵에도 없다 — 플레이어가 갈 수 없다. create_transfer_pair 로 문(집 문·마을 가장자리)과 잇는다.`);
      }
    }
  }
  // 1g) 한 번만 주는 보상: 말 걸 때마다 물건·돈·동료가 또 생긴다(개 동행 셋, 회상 반복 — 2026-10-24 스위트).
  for (const ev of changed) {
    ev.pages.forEach((pg, pi) => {
      if (obj(pg.trigger)?.kind !== "action" && obj(pg.trigger)?.kind !== "playerTouch" && obj(pg.trigger)?.kind !== "touch") return;
      const rows: { cmd: Obj; guards: readonly Obj[] }[] = [];
      walkCommands(pg.commands, (cmd, guards) => rows.push({ cmd, guards }));
      const grants = rows.filter((r) => (r.cmd.kind === "addFollower") || (r.cmd.kind === "changeParty" && r.cmd.action === "add") || ((r.cmd.kind === "changeItem" || r.cmd.kind === "changeGold") && r.cmd.op !== "-=" && !(Number(r.cmd.amount) < 0)));
      if (!grants.length) return;
      // 돈을 내고 사는 거래(같은 페이지에 돈·물건을 빼는 명령)와 상점·여관은 반복이 맞다.
      if (rows.some((r) => (r.cmd.kind === "changeGold" || r.cmd.kind === "changeItem") && (r.cmd.op === "-=" || Number(r.cmd.amount) < 0)) || rows.some((r) => r.cmd.kind === "shop" || r.cmd.kind === "inn")) return;
      const setsFlag = rows.some((r) => ["setSelfSwitch", "setSwitch", "setVariable", "removeEvent", "eraseEvent"].includes(String(r.cmd.kind)) || (r.cmd.kind === "m2Command" && /erase|remove/iu.test(String(r.cmd.commandId))));
      const ungated = grants.filter((g) => !g.guards.length);
      if (!setsFlag && ungated.length) problems.push(`[게임 검사 반복] 「${ev.name}」(${ev.id}) 페이지 ${pi + 1}: ${ungated.map((g) => String(g.cmd.kind)).slice(0, 3).join("·")} 를 주는데 스위치·셀프 스위치를 안 켜서 말 걸 때마다 또 준다 — 한 번만이면 셀프 스위치를 켜고 그 조건의 「이미 받았다」 페이지를 둔다.`);
    });
  }
  // 1h) 무작위 조우: 「랜덤 인카운터·풀숲에서 마주치는」 요청인데 조우표가 안 바뀌었다(보이는 적 이벤트만 놓았다).
  if (/랜덤|무작위|인카운터|마주치|조우|encounter/iu.test(withoutNegatedEncounters(task))) {
    const enc = (m: unknown) => { const o = m as Obj | undefined; const v = o?.encounterTable ?? o?.encounters ?? o?.encounter; return Array.isArray(v) && v.length ? JSON.stringify(v) : ""; };
    const changedEnc = Object.values(after.maps).some((m) => enc(m) && enc(m) !== enc(before.maps[m.id]));
    if (!changedEnc) problems.push("[게임 검사 조우] 요청에 무작위 조우가 있는데 어느 맵의 조우표도 바뀌지 않았다 — set_encounter_table 로 그 맵에 적 그룹·빈도를 단다(보이는 적 이벤트는 무작위 조우가 아니다).");
  }
  // 1i) 싸울 몬스터: 「약한 몬스터가 있게·적과 싸우는」 요청인데 이번에 바뀐 이벤트에 전투가 없고 켜진 조우도 바뀌지 않았다
  // (2026-10-31 sc-1031-b4 terra 숲길 3판 «몬스터·조우 없음» — 할 일 고리는 모델이 전투 항목을 적을 때만 이것을 본다).
  if (FOE_ASK.test(task) && !kinds.has("battleProcessing")) {
    const enc = (m: unknown) => { const o = m as Obj | undefined; return Number(o?.encounterRate ?? 0) > 0 && Array.isArray(o?.encounterTable) && (o!.encounterTable as unknown[]).length ? JSON.stringify([o!.encounterTable, o!.encounterRate]) : ""; };
    const encOn = Object.values(after.maps).some((m) => enc(m) && enc(m) !== enc(before.maps[m.id]));
    if (!encOn) problems.push("[게임 검사 전투] 요청에 싸울 몬스터·적이 있는데 이번에 단 전투(battleProcessing)도 켠 조우도 없다 — upsert_enemy·upsert_troop 로 적을 만들고 place_field_enemy 로 그 맵에 둔다(author_forest_route 결과 data.maps[i].enemySpots 가 적 자리, clearing·deadEnds·출입구 칸에 겹치지 않게).");
  }
  // 1j) 적 개성(2026-11-09 fs-use-tools E1): 게임을 만드는 요청에서 보스가 기본 공격뿐이거나 일반 적 기술이 전부 같다.
  if (wantsWholeGame(task)) problems.push(...enemyIdentityProblems(after));
  // 1l) HUD·타이틀 선택(2026-11-09 fs-use-tools): 게임을 만드는 요청에서 HUD 가 이야기 기본 템플릿 그대로이거나 타이틀 모양을 아무도 고르지 않았다.
  if (wantsWholeGame(task)) problems.push(...hudTitleChoiceProblems(after));
  // 2) 엔딩: 엔딩 정의 + triggerEnding.
  // 음악만 바라는 엔딩 요청(「잔잔하게 엔딩곡」)은 엔딩을 짓는 요청이 아니다. 엔딩 명령은 이번에 바꾼 이벤트가 아니라 프로젝트 전체에서 찾는다 —
  // 이미 있던 보스 이벤트의 triggerEnding 도 엔딩이다(2026-10-30 r11: 바꾼 이벤트만 봐서 «triggerEnding 이 없다»고 거짓으로 막았다).
  if (ENDING_WORDS.test(task) && !musicOnly(task)) {
    const newEndings = (after.endings ?? []).filter((e) => !(before.endings ?? []).some((b) => b.id === e.id && JSON.stringify(b) === JSON.stringify(e)));
    if (!kinds.has("triggerEnding") && !projectHasCommand(after, "triggerEnding")) problems.push(`[게임 검사 엔딩] 요청에 엔딩이 있는데 triggerEnding 명령이 없다${kinds.has("returnToTitle") ? "(내레이션+타이틀로 돌아가기는 엔딩이 아니다)" : ""}. define_ending 으로 엔딩을 정의하고 갈래에 {kind:'triggerEnding',endingId} 를 넣는다.`);
    else if (!newEndings.length && !(after.endings ?? []).length) problems.push("[게임 검사 엔딩] triggerEnding 은 있는데 정의된 엔딩(define_ending)이 없다.");
  }
  // 2b) 엔딩 카드 요약은 내레이션이다: 에필로그 대사 본문 앞에 「이름:」을 직접 쓰면 카드에 대본 머리말이 그대로 샌다
  //     (장난감 가게 「노장인 제페토: …」, 2026-10-25 심판 J36). 말한 사람은 speaker 칸에 두면 카드가 「」 인용으로 보인다.
  for (const ending of after.endings ?? []) {
    const old = (before.endings ?? []).find((b) => b.id === ending.id);
    if (old && JSON.stringify(old.epilogue ?? []) === JSON.stringify(ending.epilogue ?? [])) continue;
    const leaks = (ending.epilogue ?? []).flatMap((beat) => {
      const text = typeof beat.text === "string" ? beat.text.trim() : "";
      const split = text ? splitScriptSpeaker(text) : { text };
      return split.speaker ? [`「${text.slice(0, 24)}…」`] : [];
    });
    if (leaks.length) problems.push(`[게임 검사 엔딩] 엔딩 「${ending.name}」(${ending.id}) 에필로그 대사 본문이 「이름:」으로 시작한다: ${leaks.slice(0, 2).join(" · ")} — 엔딩 카드에 대본 머리말이 그대로 보인다. 이름은 본문에서 빼고 say 비트의 speaker 에 둔다(카드는 「」 인용으로 보인다). 장면 설명은 context:'narration' 으로.`);
  }
  // 3) 상태 이상: 실제 상태 걸기(m2-019-change-state add) 또는 상태를 거는 데이터(아이템·기술·적의 stateEffects).
  if (STATE_WORDS.test(task)) {
    // 치료·해독 요청이면 상태를 «지우는» 것도 실제 상태 처리다(g-healer). 아이템의 healStateIds 도.
    const cures = /치료|고쳐|고치|해독|낫게|cure|heal/iu.test(task);
    const applies = cmds.some((r) => r.cmd.kind === "m2Command" && /m2-019/u.test(String(r.cmd.commandId)) && (cures || obj(r.cmd.fields)?.operation !== "remove"))
      || (cures && cmds.some((r) => r.cmd.kind === "recoverAll"));
    const changedDb = changedRecordsJson(before, after);
    const dataApplies = /"stateEffects":\[\{[^\]]*"operation":"add"|"addStateIds":\["state_|"stateId":"state_/u.test(changedDb) || (cures && /"healStateIds":\["state_/u.test(changedDb));
    if (!applies && !dataApplies) problems.push("[게임 검사 상태] 요청에 독·마비 같은 상태 이상이 있는데 실제 상태를 거는 명령이 없다(소리·번쩍임·HP 감소만으로는 독이 아니다). {kind:'m2Command',commandId:'m2-019-change-state',fields:{target:'party',operation:'add',value:'state_poison'}} 를 넣는다.");
  }
  // 4) 물건 고르기 창은 그 물건이 있을 때만.
  for (const r of cmds) {
    if (r.cmd.kind !== "presentItem") continue;
    const wanted = new Set<string>([...((r.cmd.itemIds as string[] | undefined) ?? []), ...(((r.cmd.options as Obj[] | undefined) ?? []).map((o) => String(o.itemId)))]);
    const guarded = [...flatConditions(r.page.conditions), ...r.guards.flatMap((g) => flatConditions(g))].some((c) => c.kind === "item" && c.present !== false && (!wanted.size || wanted.has(String(c.itemId))));
    if (!guarded) problems.push(`[게임 검사 물건] 「${r.ev.name}」(${r.ev.id}) 페이지 ${r.pageIndex + 1}: 물건 고르기 창(presentItem)이 그 물건이 없을 때도 뜬다. 그 페이지 조건에 {kind:'item',itemId,present:true} 를 걸고, 물건이 없을 때는 평소 대사 페이지가 나오게 한다.`);
  }
  // 5) 깃발: 선언 안 한 스위치·변수, 켜기만 하고 아무도 안 읽는 것(「이미 했다」 페이지가 빠졌다), 선언만 하고 안 쓰는 것.
  const declaredSw = new Set(after.switches.map((s) => s.id)), declaredVar = new Set(after.variables.map((v) => v.id));
  const reads = readsOf(after);
  const setSw = new Map<string, string>(), setVar = new Map<string, string>(), usedSw = new Set<string>(), usedVar = new Set<string>();
  for (const r of cmds) {
    if (r.cmd.kind === "setSwitch" && typeof r.cmd.switchId === "string") setSw.set(r.cmd.switchId, r.ev.name);
    if (r.cmd.kind === "setVariable" && typeof r.cmd.variableId === "string") setVar.set(r.cmd.variableId, r.ev.name);
    for (const c of [...flatConditions(r.cmd.condition)]) { if (typeof c.switchId === "string") usedSw.add(c.switchId); if (typeof c.variableId === "string") usedVar.add(c.variableId); }
  }
  for (const ev of changed) for (const page of ev.pages) for (const c of flatConditions(page.conditions)) { if (typeof c.switchId === "string") usedSw.add(c.switchId); if (typeof c.variableId === "string") usedVar.add(c.variableId); }
  const undeclared = [...new Set([...setSw.keys(), ...usedSw])].filter((id) => !declaredSw.has(id)).concat([...new Set([...setVar.keys(), ...usedVar])].filter((id) => !declaredVar.has(id)));
  if (undeclared.length) problems.push(`[게임 검사 깃발] 선언 안 된 스위치·변수: ${undeclared.slice(0, 6).join(", ")} — declare_story_flag 로 선언하거나 이미 선언된 깃발 id 를 쓴다.`);
  const unread = [...setSw.entries()].filter(([id]) => !reads.switches.has(id));
  if (unread.length) problems.push(`[게임 검사 깃발] 켜기만 하고 어떤 페이지·분기도 읽지 않는 스위치: ${unread.slice(0, 5).map(([id, who]) => `${id}(「${who}」)`).join(", ")} — 한 번만 일어나야 하는 관문이면 그 스위치 조건의 «이미 했다» 페이지를 두고, 필요 없는 깃발이면 지운다.`);
  // 퀘스트 도구가 등록한 진행 변수(var_<key>_progress — 퀘스트 기록이 읽는다)는 조건에서 안 읽어도 쓰는 값이다 —
  // «쓰거나 지운다» 로 돌려보내면 조수가 퀘스트 변수를 지우거나 헛조건을 단다(2026-11-10 Terra 두 판 모두 이 줄을 받았다).
  const questVars = new Set((Array.isArray((after as unknown as Obj).quests) ? ((after as unknown as Obj).quests as Obj[]) : []).map((q) => `var_${String(q?.key ?? q?.id ?? "")}_progress`));
  const unreadVar = [...setVar.entries()].filter(([id]) => !reads.variables.has(id) && !questVars.has(id));
  if (unreadVar.length) problems.push(`[게임 검사 깃발] 값만 바꾸고 아무도 읽지 않는 변수: ${unreadVar.slice(0, 5).map(([id, who]) => `${id}(「${who}」)`).join(", ")} — 조건·분기에서 쓰거나 지운다.`);
  // 고쳐 쓰다 끊긴 고리: 전에는 어떤 이벤트가 켜던(바꾸던·부르던) 스위치·변수·공통 이벤트를 이번 실행 뒤에는 아무도 안 켜는데, 그것을 조건으로 보는
  // 페이지·분기는 남았다 → 그 내용에 영영 닿지 못한다(2026-10-25 조수 단독 게임 G15: 서연 대사를 날마다 다르게 다시 쓰며 「퇴근길에 같이 걸을래요?」
  // 초대가 빠졌고, 걷는 장면은 sw_0005 를 기다리는데 켜는 곳이 사라졌다 — 보고는 「못 한 것 없음」).
  const lost = lostLinks(before, after);
  if (lost.length) problems.push(`[게임 검사 끊긴 고리] 이번에 고친 이벤트에서 빠진 명령 때문에 닿을 수 없게 된 내용이 있다: ${lost.slice(0, 4).join(" / ")} — 빠뜨린 명령(초대·스위치 켜기·공통 이벤트 부르기)을 새 페이지에 다시 넣거나, 일부러 없앤 것이면 그 조건 페이지도 지우고 보고에 적는다.`);
  // 시작하자마자 끝나는 게임: 확인 키만 몇 번 눌러도 엔딩·게임 오버(2026-10-25 조수 단독 게임 G24 — 시작 칸 바로 앞이 정문이고 첫 항목이 「혼자 도망친다(배드 엔딩)」).
  {
    const startTouched = after.startMapId !== before.startMapId || JSON.stringify(after.startPos) !== JSON.stringify(before.startPos);
    const changedIds = new Set(changed.map((ev) => ev.id));
    const instant = instantEndings(after).filter((line) => startTouched || [...changedIds].some((id) => line.includes(`(${id},`)));
    if (instant.length) problems.push(`[게임 검사 시작] 시작하자마자 확인 키만 눌러도 게임이 끝난다: ${instant.slice(0, 3).join(" / ")} — 끝내는 항목은 고르기 창의 마지막 항목으로 옮기고(첫 항목은 「돌아간다」처럼 이어지는 쪽), 시작 칸을 그 이벤트에서 떨어뜨리거나(set_start_position) 그 엔딩을 앞 일을 마친 뒤의 스위치 조건 페이지로 옮긴다.`);
  }
  // 단서를 건너뛰는 퍼즐·한 번 숨으면 사라지는 추격자(G25) — 바뀐 이벤트만.
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const clues = skippableClues(after).filter((line) => [...changedIds].some((id) => line.includes(`(${id})`)));
    if (clues.length) problems.push(`[게임 검사 퍼즐] ${clues.slice(0, 3).join(" / ")}. 단서 전 페이지에서는 보상 항목을 빼고 「뭔가 단서가 필요하다」 대사만 두며, 보상은 단서 스위치 조건 페이지에만 남긴다.`);
    if (/단서|쪽지|힌트|일기|메모|적혀|써\s*있|clue|hint|note/iu.test(task) && /맞추|맞춰|퍼즐|비밀번호|암호|자물쇠|금고|열쇠가 나|puzzle|code/iu.test(task)) {
      // 숫자·글자를 입력하는 자물쇠는 답을 알아야 풀리니 단서 스위치로 막지 않아도 된다 — 고르기 창으로 찍어 맞힐 수 있는 퍼즐만 본다.
      const guessable = changed.some((ev) => !allCommands(ev).some((r) => /^input/u.test(String(r.cmd.kind)))
        && allCommands(ev).some((r) => r.cmd.kind === "choices" && JSON.stringify(r.cmd.options ?? []).match(/"kind":"(changeItem|setSwitch)"/u)));
      const dead = guessable ? deadClues(after, changedIds) : [];
      if (dead.length) problems.push(`[게임 검사 퍼즐] ${dead.slice(0, 3).join(" / ")} — 퍼즐 이벤트가 그 스위치를 보지 않아 단서를 안 읽어도 풀린다. 퍼즐 이벤트의 첫 페이지는 「뭔가 단서가 필요하다」 대사만 두고, 정답 고르기·보상은 그 단서 스위치 조건의 다음 페이지로 옮긴다.`);
    }
    const slow = slowChasers(after, changedIds);
    if (slow.length) problems.push(`[게임 검사 위협] ${slow.slice(0, 3).join(" / ")}. 추격 페이지 movement 를 speed 6 이상·frequency 8 로 두거나(빠른 걸음새가 필요하면 approachStyle dash·swoop) — make_chase_scene 기본값(speed 6·frequency 8)이 그 값이다. 느린 추격이 의도면(숨바꼭질형) 보고에 적는다.`);
    const chasers = vanishingChasers(after).filter((line) => [...changedIds].some((id) => line.includes(`(${id})`)));
    if (chasers.length) problems.push(`[게임 검사 위협] ${chasers.slice(0, 3).join(" / ")}. 숨기가 «이번 한 번» 지나가게 하는 것이면 그 스위치를 다시 끈다(예: 옷장에서 나온 뒤 기다렸다 setSwitch false, 또는 맵을 나갈 때), 영영 사라지는 것이 요청이면 보고에 적는다.`);
  }
  // 말로만 쫓는 추격자(2026-10-25 심판 J54): 요청이 「시야·추격·순찰·느낌표」인데 바뀐 이벤트 어디에도 쫓는 움직임·순찰 길·시야가 없다.
  {
    const asked = /시야|추격|쫓|순찰|느낌표|「!」|patrol|chase|line of sight/iu.test(task);
    const built = changed.some((ev) => ev.pages.some((pg) => {
      const mv = obj(pg.movement) ?? obj(pg.moveRoute);
      return !!mv && (mv.type === "chase" || !!obj(mv.route) || !!obj(mv.sight) || typeof mv.sightRange === "number");
    }));
    if (asked && !built) problems.push(`[게임 검사 위협] 요청은 시야·추격·순찰인데 이번에 바꾼 이벤트에 쫓는 움직임(movement.type 'chase')·순찰 길(movement.route)·시야가 하나도 없다 — make_chase_scene{mapId, chaser, patrol:{mode:'auto'}} 로 실제 추격자를 만들거나(이미 있으면 configure_npc_patrol 로 순찰 길을 더한다), 못 지었으면 보고에 「추격 없음」이라고 적는다. 대사·느낌표 말풍선만으로는 쫓아오지 않는다.`);
  }
  // 맵 기본 배율을 이벤트로 켜고 끄기(2026-10-25 J69): 자동 실행 페이지가 카메라 배율만 건다 — 저장·불러오기·맵 재진입에서 어긋나고 매번 한 박자 늦게 걸린다.
  {
    const zoomOnly = changed.filter((ev) => ev.mapId !== "common" && ev.pages.some((pg) => {
      const trig = String(obj(pg.trigger)?.kind ?? pg.trigger ?? "");
      if (trig !== "auto" && trig !== "parallel") return false;
      const cmds = Array.isArray(pg.commands) ? (pg.commands as Obj[]) : [];
      const zoom = cmds.some((c) => c.kind === "m2Command" && c.commandId === "m2-201-camera-control" && obj(c.fields)?.zoom !== undefined || c.kind === "cameraControl" && c.zoom !== undefined);
      return zoom && cmds.every((c) => ["m2Command", "cameraControl", "setSelfSwitch", "eraseEvent", "wait", "comment"].includes(String(c.kind)) && (c.kind !== "m2Command" || c.commandId === "m2-201-camera-control"));
    }));
    if (zoomOnly.length) problems.push(`[게임 검사 카메라] 자동 실행 이벤트가 맵 카메라 배율만 건다: ${zoomOnly.slice(0, 3).map((ev) => `「${ev.name}」(${ev.id}) @${ev.mapId}`).join(", ")} — 맵 기본 배율은 set_map_properties{mapId, zoom} 로 맵에 두고 그 이벤트는 지운다(들어올 때마다 바로 걸리고 저장·불러오기에서도 맞다). 장면 중 잠깐 당기는 줌만 연출 명령으로 둔다.`);
  }
  // 태어나자마자 잡히는 시작·체크포인트(2026-10-25 심판 J61).
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const startTouched = after.startMapId !== before.startMapId || JSON.stringify(after.startPos) !== JSON.stringify(before.startPos);
    const unsafe = unsafeSpawnLines(after).filter((entry) => startTouched || changedIds.has(entry.eventId) || (!!entry.spotEventId && changedIds.has(entry.spotEventId)));
    if (unsafe.length) problems.push(`[게임 검사 위협] ${unsafe.slice(0, 3).map((entry) => entry.line).join(" / ")}. 추격자를 시야 밖(벽 너머·다른 방)에 두거나, set_start_position 으로 시작을 옮기거나, 체크포인트를 추격 구역 앞(문 밖)으로 옮긴다.`);
  }
  // 사슬 전체 검사(2026-10-25 판정 J11~J14): 잠긴 방이 벽 틈으로 열림·자물쇠가 답을 말함·자리 표시 글·파티에 없는 동료.
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const bypass = lockBypasses(after, changedIds);
    if (bypass.length) problems.push(`[게임 검사 잠긴 방] ${bypass.slice(0, 3).join(" / ")}. seal_locked_room{mapId, eventId} 로 문 말고 다른 길(벽 틈)을 막거나, 퍼즐 전체를 author_puzzle_chain 으로 다시 묶는다.`);
    const idle = gatesThatOpenNothing(after, changedIds);
    if (idle.length) problems.push(`[게임 검사 퍼즐] ${idle.slice(0, 3).join(" / ")}. 장치가 연 칸 말고 다른 길(벽 틈·옆 통로)을 막아 그 칸이 유일한 길이 되게 하거나(seal_locked_room), 보스 방 앞 진짜 외길에 장치를 다시 둔다.`);
    const weak = weakPuzzleLocks(after, changedIds);
    if (weak.length) problems.push(`[게임 검사 퍼즐] ${weak.slice(0, 3).join(" / ")}. 답은 단서에서만 알 수 있는 번호(날짜·시계 바늘·쪽수를 이은 것)로 바꾸고 단서 대사도 같이 고친다. 고르기면 정답을 첫 보기가 아닌 자리에 둔다(author_puzzle_chain 은 자동으로 섞는다).`);
    const leaks = selfRevealingLocks(after, changedIds);
    if (leaks.length) problems.push(`[게임 검사 퍼즐] ${leaks.slice(0, 3).join(" / ")}. 자물쇠 대사에서 답을 빼고(「번호를 모르겠다」), 답은 단서(일기·쪽지)에만 두고 단서를 읽으면 켜지는 스위치 조건 페이지에서만 입력받는다 — author_puzzle_chain 이 이 순서로 짓는다.`);
    const holes = placeholderTexts(after, changedIds, JSON.stringify(after.system.opening ?? null) !== JSON.stringify(before.system.opening ?? null) || JSON.stringify(after.endings ?? []) !== JSON.stringify(before.endings ?? []));
    if (holes.length) problems.push(`[게임 검사 글] 화면에 그대로 보이는 자리 표시가 남았다: ${holes.slice(0, 4).join(" / ")} — 주인공 이름은 실제 이름(또는 \\N[1])으로, 줄바꿈 「\\n」 글자는 실제 줄바꿈으로 고친다.`);
    const loners = unjoinedFollowers(after, changedIds, task);
    if (loners.length) problems.push(`[게임 검사 동료] ${loners.slice(0, 3).join(", ")} 가 그림만 따라오고 파티에는 없다(메뉴에 안 보인다) — 이야기가 「함께 간다」면 upsert_actor 로 배우를 만들고 {kind:'changeParty',actorId,action:'add'} 와 {kind:'addFollower',actorId} 를 같이 넣는다(또는 add_companion). 잠깐 따라오는 것뿐이면 보고에 적는다.`);
  }
  // 같은 역할의 맵이 둘(G19: 「저택 2층」 두 장, 「지하 예배당」 두 장 — 계단이 2층→2층으로 이어졌다).
  {
    const dups = duplicateMaps(before, after);
    if (dups.length) problems.push(`[게임 검사 맵] 같은 이름·역할의 맵이 둘 있다: ${dups.slice(0, 3).join(" / ")} — 하나만 남기고 그 맵으로 가는 문을 그 하나로 모은 뒤, 남는 맵은 remove_map 으로 지운다(지울 수 없으면 이름을 바꿔 역할을 나눈다).`);
  }
  // 날마다 달라지는 대사를 사람마다(G13: 서연만 고치고 지훈은 그대로 두고 「다 했다」).
  {
    const flat = flatPerDayPeople(after, task);
    if (flat.length) problems.push(`[게임 검사 대사] 요청은 날마다 대사가 달라지게인데 이 사람들은 날짜(일차 변수)로 갈리는 대사가 셋 미만이다: ${flat.slice(0, 4).join(" / ")} — 그 사람의 이벤트에 일차 변수 조건 페이지(1일차·2일차·3일차 이상…)를 더해 날마다 다른 말을 하게 한다(호감 단계 페이지는 따로 둔다).`);
  }
  // 셀프 스위치: 켰는데 그 이벤트 어느 페이지도 그 키를 조건으로 안 본다.
  for (const ev of changed) {
    const key = `${ev.mapId === "common" ? "common" : ev.mapId}/${ev.id}`;
    const setKeys = new Set(allCommands(ev).filter((r) => r.cmd.kind === "setSelfSwitch" && r.cmd.value !== false).map((r) => String(r.cmd.key)));
    const seen = reads.selfKeys.get(key) ?? new Set();
    const missing = [...setKeys].filter((k) => !seen.has(k));
    if (missing.length) problems.push(`[게임 검사 깃발] 「${ev.name}」(${ev.id}) 이 셀프 스위치 ${missing.join(",")} 를 켜지만 그 조건의 페이지가 없다 — 「이미 했다」 페이지(셀프 스위치 ${missing[0]} 조건)를 더한다.`);
  }
  const newDeclared = after.switches.filter((s) => !before.switches.some((b) => b.id === s.id)).map((s) => s.id)
    .concat(after.variables.filter((v) => !before.variables.some((b) => b.id === v.id)).map((v) => v.id));
  if (newDeclared.length) {
    const everywhere = JSON.stringify({ maps: Object.values(after.maps).map((m) => m.events), common: after.commonEvents, endings: after.endings, quests: after.quests });
    // 던전 도구가 적마다 만드는 「처치」 스위치(sw_ev_<맵>_<적>_clear)는 다시 짓기로 그 적이 사라져도 남는다 — 엔진 장부라 사용자 깃발로 세지 않는다.
    const idle = newDeclared.filter((id) => !/^sw_ev_.+_clear$/u.test(id) && !everywhere.includes(`"${id}"`) && !everywhere.includes(`[${id}]`));
    if (idle.length) problems.push(`[게임 검사 깃발] 선언만 하고 어디서도 쓰지 않는 깃발: ${idle.slice(0, 6).join(", ")} — 쓰거나 지운다.`);
  }
  // 순서가 있는 이야기: 「숲을 조사하고 돌아오면 … 제1막 끝」인데 엔딩·막 끝이 조건 없는 페이지에 있어 첫 대화에 바로 터진다
  // (2026-10-25 폴른 과업 fs-end-act: 숲에 가기도 전에 촌장 첫 대화에서 마을 습격 + 「제1막 끝」).
  if (/돌아오면|다녀오면|다녀온 (?:뒤|다음|후)|(?:하|마치|끝내|조사하|보고하|만나|잡|물리치|구하)고 (?:나서|나면|오면|돌아)|한 (?:뒤|다음|후)에?|끝나면|마치면|이후에/u.test(task)) {
    for (const r of cmds) {
      const endingText = r.cmd.kind === "text" && /제\s*\d+\s*막\s*끝|막이?\s*끝|THE END/iu.test(String(r.cmd.body ?? ""));
      if ((r.cmd.kind !== "triggerEnding" && !endingText) || r.ev.mapId === "common") continue;
      const gated = flatConditions(r.page.conditions).length > 0 || r.guards.length > 0;
      const trig = String(obj(r.page.trigger)?.kind ?? "action");
      if (gated || (trig !== "action" && trig !== "touch" && trig !== "autorun")) continue;
      problems.push(`[게임 검사 순서] 요청은 앞 일을 마친 «뒤»에 일어나는 이야기인데 「${r.ev.name}」(${r.ev.id}) ${r.pageIndex + 1}쪽의 ${endingText ? "막 끝 장면" : `엔딩(triggerEnding ${String(r.cmd.endingId ?? "")})`}이 조건 없는 페이지에 있어 처음 말 걸거나 밟자마자 터진다. 앞 일(숲 끝·보스·조사)을 마치는 이벤트가 스위치를 켜고(declare_story_flag), 이 장면은 그 스위치 조건의 더 높은 번호 페이지로 옮긴다 — 조건 전 페이지에는 「아직」 대사를 둔다.`);
      break;
    }
  }
  // 회상(과거 장면): 화면 색만 바꾸고 지금 인물이 옛이야기를 읽어 주면 과거 장면이 아니다 — 과거 인물이 화면에 나와야 한다
  // (2026-10-25 장난감 가게 G34: 「장난감에게 말 걸면 과거 장면이 보이게」에 세피아 색 + 장난감 독백만 넣었다).
  if (/회상|과거 장면|과거의 장면|옛날 장면|플래시백|flashback/iu.test(task) && /보이|나오|나와|등장|화면|장면/u.test(task)) {
    const others = (ev: { id: string }) => cmds.some((r) => r.ev.id === ev.id && (
      (r.cmd.kind === "moveEvent" && r.cmd.eventId !== undefined && r.cmd.eventId !== "player")
      || (r.cmd.kind === "m2Command" && /m2-225/u.test(String(r.cmd.commandId)) && Number((r.cmd.fields as Obj | undefined)?.opacity ?? 0) > 0)
      || (r.cmd.kind === "look" && r.cmd.target !== "player")));
    const tinted = changed.filter((ev) => cmds.some((r) => r.ev.id === ev.id && (r.cmd.kind === "tint" || (r.cmd.kind === "m2Command" && /m2-046|m2-202/u.test(String(r.cmd.commandId))))));
    if (tinted.length && !changed.some(others)) {
      problems.push("[게임 검사 회상] 요청은 과거 장면이 화면에 보이는 회상인데, 바꾼 이벤트는 화면 색만 바꾸고 지금 인물이 옛이야기를 말한다 — 과거 인물이 나오지 않는다. add_event{kind:'cutscene',when:'talk',after:'<말 거는 대상 이름>',beats:[{do:'tint',tone:'sepia'},{do:'appear',who:'<과거 인물>'},{do:'walk',…},{do:'say',who:'<과거 인물>',text:…},{do:'vanish',who:'<과거 인물>'},{do:'tint',tone:'clear'}]} 로 과거 인물을 세워 움직이고 말하게 한다(장면 뒤에는 사라진다).");
    }
  }
  // 밤·낮을 스위치와 화면 색으로만 바꾸는데 시간 체계가 켜져 있으면 HUD 시계는 따로 흘러 「자정」 뒤에도 「06:16」을 보인다
  // (2026-10-25 장난감 가게 G51). 그 갈래에 setTime 을 같이 넣거나, 시계를 안 쓰면 시간 체계를 끈다.
  if ((after.system.timeSystem as { enabled?: boolean } | undefined)?.enabled) {
    const nightTint = (cmd: Obj): boolean => {
      const fields = (cmd.fields ?? {}) as Obj;
      const text = `${String(fields.value ?? "")} ${String(fields.color ?? "")} ${String(cmd.tone ?? cmd.color ?? "")}`;
      if (/night|밤|dusk|midnight/iu.test(text)) return true;
      const rgba = String(fields.value ?? "").split(",").map(Number);
      return rgba.length >= 3 && rgba.slice(0, 3).every((v) => Number.isFinite(v) && v <= 90) && (rgba[3] === undefined || rgba[3] >= 0.25);
    };
    const timeKinds = new Set(["setTime", "advanceTime", "sleepUntilMorning"]);
    const off: string[] = [];
    for (const ev of changed) {
      const rows = allCommands(ev);
      const tints = rows.filter((r) => (r.cmd.kind === "tint" || (r.cmd.kind === "m2Command" && /m2-046/u.test(String(r.cmd.commandId)))) && nightTint(r.cmd));
      if (!tints.length || !rows.some((r) => r.cmd.kind === "setSwitch")) continue;
      if (rows.some((r) => timeKinds.has(String(r.cmd.kind)))) continue;
      off.push(`「${ev.name}」(${ev.id})`);
    }
    if (off.length) problems.push(`[게임 검사 시계] 시간 체계가 켜져 있어 화면 시계(HUD)가 따로 흐르는데, ${off.slice(0, 3).join(", ")} 은 밤을 스위치와 화면 색으로만 만든다 — 「자정」 뒤에도 시계는 아침 시각을 보인다. 밤으로 바꾸는 갈래에 {kind:'setTime',hour:24,minute:0}(자정), 낮으로 돌리는 갈래에 {kind:'setTime',hour:6,minute:0} 을 같이 넣는다. 시계가 필요 없는 이야기면 configure_time_system{enabled:false} 로 끈다.`);
  }
  // 날짜를 두 번 센다(2026-10-25 판정 J18, 서울 연애): 시간 체계가 켜져 HUD 달력이 「봄 4일」을 보이는데 대사·엔딩은
  // 「서울에서 보낸 일수」 변수로 1일차를 센다. 대화마다 advanceTime 이 달력을 넘기고 잠자기가 또 넘겨 두 날짜가 어긋난다.
  // onDayEnd 공통 이벤트 안의 카운트(set_deadline_ending 의 var_days_elapsed)는 달력과 같이 넘어가므로 뺀다.
  {
    const ts = after.system.timeSystem as { enabled?: boolean; onDayEnd?: string } | undefined;
    const dualDays = ts?.enabled ? dayCounterVariables(after, ts.onDayEnd) : [];
    const touched = changed.some((ev) => allCommands(ev).some((r) => r.cmd.kind === "setVariable" && dualDays.some((d) => d.id === r.cmd.variableId)))
      || JSON.stringify(before.system.timeSystem ?? null) !== JSON.stringify(after.system.timeSystem ?? null);
    if (dualDays.length && touched) {
      const v = dualDays[0]!;
      problems.push(`[게임 검사 시계] 시간 체계가 켜져 HUD 달력(「봄 N일」)이 따로 흐르는데, 날짜를 변수 「${v.name}」(${v.id})로 또 센다(${v.where}) — 대화의 advanceTime·잠자기가 달력을 넘겨 화면 날짜와 대사·엔딩의 「N일차」가 어긋난다. 하나만 쓴다: 변수로 세려면 configure_time_system{enabled:false} 로 달력을 끄고(잠자기 대신 화면 전환·대사로 하루를 넘긴다), 달력을 쓰려면 그 변수를 지우고 날짜는 set_deadline_ending(onDayEnd 카운트)으로 센다.`);
    }
  }
  // 「제1막 끝」 카드: 대사 한 줄로 흉내 내면 게임이 그대로 이어진다 — 진짜 엔딩(막 끝 화면)이어야 한다(fs-end-act).
  if (/제\s*\d+\s*막\s*끝|막이?\s*끝나|막 끝/u.test(task) && !kinds.has("triggerEnding")) {
    problems.push("[게임 검사 엔딩] 요청에 「막 끝」 화면이 있는데 바꾼 이벤트에 진짜 엔딩 명령이 없다 — 대사 「제1막 끝」만으로는 게임이 그대로 이어진다. define_ending{id:'ending_act1',presentation:{finalTitle:'제1막 끝',badge:'제2막으로 이어집니다'}} 뒤 그 장면 끝에 {kind:'triggerEnding',endingId:'ending_act1'} 를 넣는다.");
  }
  // 레터박스(위아래 검은 띠): 컷신이 띠를 저절로 넣지 않는다 — 실제 띠 명령이 있어야 한다(2026-10-25 폴른 과업 fs-cine-letterbox: 「자동」이라 믿고 빠뜨림).
  if (/레터박스|검은 띠|letterbox/iu.test(task) && JSON.stringify(after.system.opening ?? null) === JSON.stringify(before.system.opening ?? null) && !JSON.stringify(changed.map((ev) => ev.pages)).includes("letterbox")) {
    problems.push("[게임 검사 화면] 요청에 위아래 검은 띠(레터박스)가 있는데 바꾼 이벤트에 띠 명령이 없다 — 컷신은 띠를 저절로 넣지 않는다. add_scene/script_cutscene 의 letterbox 비트({do:'letterbox',show:true,size:12}) 또는 {kind:'m2Command',commandId:'m2-202-screen-effect',fields:{effect:'letterbox',value:12,durationMs:400}} 를 장면 맨 앞에 넣는다.");
  }
  // 새 게임인데 오프닝이 공장 기본(「강을 낀 왕국…」) 그대로 켜져 있다 — 첫 화면부터 다른 이야기가 나온다(2026-10-25 조수 단독 게임 G3).
  {
    const op = after.system.opening as { enabled?: boolean; scenes?: { narration?: string; resourceId?: string }[] } | undefined;
    const factory = !!op?.enabled && (op.scenes ?? []).some((sc) => /강을 낀 왕국에는 오래도록 전쟁이 없었다/u.test(sc.narration ?? "") || sc.resourceId === "oprn-still-kingdom-day");
    const newGame = after.meta.title !== before.meta.title || /게임을? (하나 )?만들|게임 하나|새 게임|만들고 싶어/u.test(task);
    // 요청이 오프닝을 고치라는데 공장 기본이 그대로면, 설정(켜기·음악)만 바꿨어도 문제다 — 「오프닝을 새로 만들었다」는 거짓 보고가 났다(2026-10-25 G35).
    const openingAsk = /오프닝|opening|시작할 때 나오|처음 (시작할 때|나오는)/iu.test(task);
    if (factory && (openingAsk || newGame && JSON.stringify(op) === JSON.stringify(before.system.opening))) {
      problems.push("[게임 검사 오프닝] 게임을 새로 만들었는데 오프닝이 프로젝트 기본(「강을 낀 왕국에는 오래도록 전쟁이 없었다」)이 그대로 켜져 있다 — 새 게임 첫 화면에 엉뚱한 이야기가 나온다. plan_opening/set_opening 으로 이 게임 이야기(주인공·목표) 몇 장면으로 바꾸거나, 오프닝을 원하지 않으면 set_opening{enabled:false}.");
    }
  }
  // 못 이기는 전투(2026-10-25 사용자: 게임에서 못 쓰면 실패): 바뀐 이벤트가 여는 전투(지면 안 되는 것)를 시작 파티·시작 레벨로 모의 20판 → 0승이면 돌려보낸다.
  {
    const party = after.system.startActorIds ?? [];
    const level = Math.max(1, ...party.map((id) => after.database.actors.find((a) => a.id === id)?.initialLevel ?? 1));
    const seen = new Set<string>();
    // 이 실행 전에도 그 이벤트에 있던 전투는 새로 저작한 것이 아니다(2026-10-25 실조수: 보스전 음악만 바꿨는데 드래곤 능력치를 깎았다).
    const had = new Set<string>();
    for (const ev of eventsOf(before).values()) for (const row of allCommands(ev)) if (row.cmd.kind === "battleProcessing") had.add(`${ev.mapId}/${ev.id}#${String(row.cmd.troopId)}`);
    for (const r of cmds) {
      const c = r.cmd as { kind?: string; troopId?: string; canLose?: boolean; troopSource?: string };
      if (c.kind !== "battleProcessing" || c.canLose || c.troopSource === "variable" || !c.troopId || seen.has(c.troopId)) continue;
      if (had.has(`${r.ev.mapId}/${r.ev.id}#${c.troopId}`)) continue;
      seen.add(c.troopId);
      if (!after.database.troops.some((t) => t.id === c.troopId) || !party.length) continue;
      try {
        const sim = simulateBattle({ project: after, troopId: c.troopId, heroLevel: level, n: 20, seed: 7, useSkills: true });
        if (sim.winRate === 0) problems.push(`[게임 검사 전투] ${r.ev.id} 가 여는 전투(${c.troopId})를 시작 파티(Lv${level})로 모의 20판 해 보니 한 번도 못 이긴다 — 플레이어가 그 전에 레벨을 올릴 길이 없으면 게임이 막힌다. upsert_enemy 로 HP·공격을 낮추거나(simulate_battle 로 승률 40~80% 확인), 지는 이야기 전투면 canLose:true.`);
      } catch { /* 모의 실패는 넘어간다 */ }
    }
  }
  // 연계기(두세 사람이 같이 쓰는 기술): 요청에 있는데 새/바뀐 연계 기록(comboActorIds 2명 이상)이 없다 — 평범한 기술 두 개로 흉내 내지 않는다(2026-10-25 데모 과업).
  if (/연계|합체기|협동 기술|콤보 기술|같이 쓰는 (기술|필살기)|combo/iu.test(task)) {
    const prior = new Map(before.database.skills.map((sk) => [sk.id, JSON.stringify(sk)]));
    const combo = after.database.skills.some((sk) => (sk.comboActorIds?.length ?? 0) >= 2 && prior.get(sk.id) !== JSON.stringify(sk));
    if (!combo) problems.push("[게임 검사 연계기] 요청에 연계기가 있는데 새로 만든 연계 기록이 없다(평범한 기술은 「연계」 명령에 안 뜬다). upsert_combo_tech{id:'skill_combo_…', name, actorIds:[두 배우], mpCosts, scope, power} 로 만들고, 참가 배우가 파티에 없으면 set_party 로 넣는다.");
  }
  // 그림 크기(J23): 보스가 아닌데 파티보다 훨씬 크게 그린 칩.
  problems.push(...oversizedSprites(before, after));
  // 그림 ↔ 이름(J35·J30·J41): 젊은 인물에 노인 얼굴, 인형·태엽 병정에 사람 얼굴, 하얀 드레스에 분홍 드레스 칩.
  problems.push(...lookMismatches(before, after));
  // 체력이 줄 일이 없는 게임에 체력 HUD(공포 꽃잎·하트)가 설명 없이 떠 있다(2026-10-25 심사 J67). 이번 실행이 HUD 를 바꿨을 때만.
  if (JSON.stringify(before.system.fieldHud ?? null) !== JSON.stringify(after.system.fieldHud ?? null) && after.system.fieldHud
    && resolvedHudWidgets(after.system.fieldHud).some((widget) => widget.source === "hp") && !projectCanLoseHp(after)) {
    problems.push(`[게임 검사 HUD] 필드 HUD(${after.system.fieldHud.theme})가 체력(꽃잎·하트)을 늘 보이는데 이 게임에는 체력이 줄 일(전투·피해 명령·인카운트)이 없다 — 플레이어에게 설명 없는 장식이다. set_field_hud{theme:'${after.system.fieldHud.theme}', vitals:false} 로 끄거나, 체력을 쓰는 게임이면 피해를 주는 장치(함정·추격자 changeActorHp)를 만들고 set_life_flower 로 꽃잎의 뜻을 보인다.`);
  }
  // 타이틀 그림 ↔ 시대(J38): 이번에 타이틀을 바꿨을 때만.
  if (JSON.stringify(before.system.titleScreen ?? null) !== JSON.stringify(after.system.titleScreen ?? null)) problems.push(...titleBackdropMismatch(after, task));
  // 주인공 모습 ↔ 장르(J43): 게임을 만드는 요청은 출하 검사(hero-look)가 이미 짚는다. 그 밖에는 이번에 장소(맵)를 새로 지은 실행만 —
  // 시작 위치 옮기기 같은 작은 고치기에서 시키지 않은 주인공 바꾸기를 시키지 않는다.
  if (!wantsWholeGame(task) && Object.keys(after.maps).some((id) => !before.maps[id])) problems.push(...pristineFantasyHero(after, task));
  problems.push(...placementContentProblems(before, after));
  return problems;
}

/**
 * 놓기 검사(2026-10-25 판정 J5·J6·J40·J42·J31·J64, 사용자 규칙 «차도 한가운데 사람 금지»):
 * 이번에 바뀐 맵의 사람·조사 이벤트 자리, 방 쓰임에 안 맞는 가구. 바뀐 이벤트(자리·페이지)만, 새로 지은 맵·타일이 바뀐 맵은 전부 본다.
 */
export function placementContentProblems(before: Project, after: Project): string[] {
  const out: string[] = [];
  const tilesKey = (m: GameMap | undefined): string => (m ? `${m.width}x${m.height}:${(m.lowerTiles as readonly number[] | undefined)?.join(",") ?? ""}|${(m.upperTiles as readonly number[] | undefined)?.join(",") ?? ""}|${(m.lowerOverlayTiles as readonly number[] | undefined)?.join(",") ?? ""}` : "");
  for (const map of Object.values(after.maps)) {
    const prev = before.maps[map.id];
    const rebuilt = !prev || tilesKey(prev) !== tilesKey(map);
    const oldEvents = new Map((prev?.events ?? []).map((e) => [e.id, JSON.stringify(e)]));
    const ids = new Set((map.events ?? []).filter((e) => rebuilt || oldEvents.get(e.id) !== JSON.stringify(e)).map((e) => e.id));
    if (ids.size) {
      const rows = placementProblems(after, map, ids);
      const by = (kind: PlacementProblem["kind"]) => rows.filter((r) => r.kind === kind).slice(0, 4).map((r) => `「${r.name}」(${r.eventId}) ${r.detail}`);
      const where = map.name ?? map.id;
      const lane = by("npc-lane"), exit = by("npc-exit"), counter = by("npc-counter"), object = by("event-object");
      if (lane.length) out.push(`[게임 검사 사람 자리] ${where}: ${lane.join(" / ")} — 사람은 차도·선로 한가운데 서서 말하지 않는다. move_event 로 보도·가게 문 앞·벤치 옆·광장으로 옮기고, 배회하는 사람이면 movement 를 fixed 로 바꾸거나 보도 안쪽에 둔다.`);
      if (exit.length) out.push(`[게임 검사 길막] ${where}: ${exit.join(" / ")} — 출구로 가는 한 칸 길이 막히면 플레이어가 맵을 못 나간다. move_event 로 길목에서 두세 칸 떨어진 넓은 바닥으로 옮기고, 배회는 fixed 로 바꾼다.`);
      if (counter.length) out.push(`[게임 검사 카운터] ${where}: ${counter.join(" / ")} — 주인은 카운터 «뒤»(카운터 바로 위 칸, 아래를 보게) 선다. move_event 로 카운터 북쪽 칸에 옮기면 플레이어는 카운터 너머로 말을 건다.`);
      const prop = by("transfer-prop"), bare = by("door-bare");
      if (prop.length) out.push(`[게임 검사 출입구] ${where}: ${prop.join(" / ")} — move_event 로 출입구를 옆 빈 바닥(계단·문 앞 칸)으로 옮기거나 그 물건을 tile_erase 로 걷는다.`);
      if (bare.length) {
        const r0 = rows.find((r) => r.kind === "door-bare")!;
        const adit = map.tilesetId === "beodeul_city" ? ` 버들항이면 stamp_object{objectId:'kit:beodeul_city/bd-pick-mining-valley-adit',mapId:'${map.id}',x:${r0.at.x - 2},y:${r0.at.y - 4}} — 갱구 문이 출입구 바로 위 칸에 온다.` : "";
        out.push(`[게임 검사 출입구] ${where}: ${bare.join(" / ")} — 출입구 바로 위에 굴 입구·문 그림을 찍는다(list_spatial_designs{kind:'object',query:'갱구·동굴 입구·문'}).${adit} 그림이 없으면 보고에 「굴 입구 그림 없음」으로 적는다.`);
      }
      if (object.length) out.push(`[게임 검사 물건 자리] ${where}: ${object.join(" / ")} — 조사 이벤트는 이름이 말하는 물건 칸(키 큰 가구는 맨 아래 앞면 칸)에 둔다. move_event 로 그 칸으로 옮긴다.`);
    }
    if (rebuilt) {
      const dry = dryBridges(after, map);
      if (dry.length) out.push(`[게임 검사 다리] ${map.name ?? map.id}: 물에 닿지 않는 다리 ${dry.length}곳 ${dry.slice(0, 4).map((c) => `(${c.x},${c.y})`).join(" ")} — 마른 바닥 위 다리로 보인다. tile_erase 로 그 다리 칸을 바닥으로 되돌리거나, 물을 건너는 자리로 옮긴다.`);
      const boats = dryBoats(after, map);
      if (boats.length) out.push(`[게임 검사 다리] ${map.name ?? map.id}: 물이 아닌 바닥 위의 배 ${boats.length}척 ${boats.slice(0, 4).map((c) => `(${c.x},${c.y})`).join(" ")} — 뭍에 오른 배·마른 바닥 위 나무다리로 보인다. tile_erase 로 걷고 물 칸 위(배 전체가 물)로 다시 찍거나 edit_place 로 다시 짓는다.`);
      const off = offPurposeProps(after, map);
      if (off.length) out.push(`[게임 검사 방 쓰임] ${map.name ?? map.id}: ${off.slice(0, 3).map((r) => `${r.room}(${r.purpose}) 에 ${r.props.slice(0, 4).map((p) => `${p.label}(${p.at.x},${p.at.y})`).join("·")}`).join(" / ")} — 그 방의 쓰임에 안 맞는 다른 방 가구다(거실 한 벌). tile_erase 로 걷어 내고 그 쓰임의 가구(예배당: 장의자·촛대, 가게: 진열대·카운터, 교실: 책상·의자, 병원: 침상·진료 책상)를 stamp_object 로 그 가구 자리에 찍거나(쓰임에 안 맞는 가구는 찍을 때 저절로 걷힌다, 다른 가구와 겹치면 onOverlap:'replace'|'nearest') edit_place 로 그 방을 다시 꾸민다.`);
    }
  }
  return out;
}

export type { Command };
