// 게임 내용 검사 — 요청이 바란 것이 실제로 있나: 효과(날씨·화면·소리), 세계(상점·시간·문·맵·보상·조우·적), 엔딩·상태·물건, 전투.
import { simulateBattle } from "@/battle/simulate";
import { splitScriptSpeaker } from "@/project/endingSummary";
import { asksChaseNotBattleMusic, asksComboSkill, asksCure, asksOpenField, asksTimedWhereabouts, asksWorkingShop, buildsWholeGame, namesRandomEncounters } from "../request/readers";
import { enemyIdentityProblems } from "./enemyChecks";
import { hudTitleChoiceProblems } from "./hudTitleChecks";
import { musicAsked, musicOnly, soundOnly } from "../request/readers";
import { FOE_ASK, STATE_WORDS } from "../request/combat";
import { WEATHER_WORDS, SHAKE_WORDS, FLASH_WORDS, ENDING_WORDS } from "../request/asks";
import { tagged, type Finding } from "./finding";
import { type GameCheck, Obj, obj, eventsOf, walkCommands, allCommands, projectHasCommand, flatConditions, audioBindingsChanged, seBindingsChanged, changedRecordsJson } from "./gameCheckReads";

/** 날씨·화면 흔들림·번쩍임·효과음·음악 — 요청한 효과가 흉내가 아니라 실제 명령으로 있나. */
export function effectChecks({ before, after, task, cmds, kinds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 1) 날씨: 실제 setWeather(컷신 weather 비트·set_scene_mood 도 결국 setWeather 다).
  if (WEATHER_WORDS.test(task) && !kinds.has("setWeather") && !cmds.some((r) => r.cmd.kind === "m2Command" && /m2-050/u.test(String(r.cmd.commandId)))) {
    problems.push(tagged("game", "날씨", `요청에 비·눈·날씨가 있는데 바꾼 이벤트에 실제 날씨 명령(setWeather)이 없다${kinds.has("tint") ? " — 화면 색(tint)은 비가 아니다" : ""}. add_event 의 weather 비트나 upsert_event 의 {kind:'setWeather',weather:'rain',intensity:0.6} 로 넣는다.`));
  }
  // 1b) 화면 흔들림·번쩍·음악: 실제 명령(카메라 이동·페이드로 흉내 내지 않는다).
  const m2Has = (re: RegExp) => cmds.some((r) => r.cmd.kind === "m2Command" && re.test(String(r.cmd.commandId)));
  // TypeScript event scripts call the same effects through game.* (openwiki/script-sandbox.md) — 2026-10-31 live run:
  // a lever script with `await game.shake(6, 40)` was reported as «no shake command».
  const scriptSource = cmds.filter((r) => r.cmd.kind === "script").map((r) => String(r.cmd.source ?? "")).join("\n");
  const scriptCalls = (re: RegExp) => re.test(scriptSource);
  if (SHAKE_WORDS.test(task) && !m2Has(/m2-048/u) && !scriptCalls(/\bgame\.shake\s*\(|m2-048/u)) problems.push(tagged("game", "화면", "요청에 흔들림·지진이 있는데 실제 화면 흔들기 명령이 없다(카메라 이동은 흔들림이 아니다). add_event 의 shake 비트({do:'shake',strength:'strong',axis:'vertical'})로 넣는다.", { variant: "shake" }));
  if (FLASH_WORDS.test(task) && !m2Has(/m2-047/u) && !scriptCalls(/\bgame\.flash\s*\(|m2-047/u) && !cmds.some((r) => r.cmd.kind === "setWeather" && r.cmd.weather === "storm")) problems.push(tagged("game", "화면", "요청에 번쩍임·번개가 있는데 실제 화면 번쩍 명령이 없다(페이드 아웃은 번쩍이 아니다). add_event 의 flash 비트({do:'flash',color:'white'})로 넣는다.", { variant: "flash" }));
  if (soundOnly(task) && !seBindingsChanged(before, after) && !kinds.has("playAudio") && !scriptCalls(/\bgame\.playSe\s*\(/u)) problems.push(tagged("game", "효과음", "요청에 효과음이 있는데 어느 자리에도 소리를 걸지 않았다. 화풍 통째로는 set_game_audio{role:'sfx-style', style}, 자리 하나는 store_find_sound → store_install → set_game_audio{role:'se', cue, resourceId}(프로젝트에 있는 소리면 list_resources{kind:'se'} 로 골라 바로 role:'se')."));
  if (musicAsked(task) && !audioBindingsChanged(before, after) && !kinds.has("playAudio") && !kinds.has("stopAudio") && !m2Has(/bgm|audio|music/iu) && !scriptCalls(/\bgame\.(playBgm|stopBgm)\s*\(/u)) problems.push(tagged("game", "음악", "요청에 음악·BGM 이 있는데 어느 자리에도 곡을 걸지 않았다. 맵·전투·보스·승리·타이틀·엔딩 곡은 set_game_audio 로 건다(맞는 곡이 프로젝트에 없으면 store_find_music → 묻지 말고 store_install 로 넣은 뒤). 장면 도중 잠깐 바뀌는 곡만 add_event 의 music 비트({do:'music',action:'bgm',query:'festival'}).", { variant: "none-set" }));
  // 추격 음악은 추격자가 나타날 때의 곡이다 — 전투 곡이 아니다(2026-10-30 실조수 e2e: 「아오오니 느낌으로 추격 음악」이 모든 전투에 걸렸다).
  if (musicAsked(task) && asksChaseNotBattleMusic(task) && (before.system.battleBgmResourceId ?? null) !== (after.system.battleBgmResourceId ?? null)) problems.push(tagged("game", "음악", "추격 음악을 모든 전투 곡(battle-default)에 걸었다. 추격 곡은 set_game_audio role:'chase'(+mapIds)로 추격자가 나타날 때 바꾸고 끝나면 되돌린다 — 전투 곡은 원래대로 돌려놓는다(추격자가 없으면 곡만 넣어 두고 보고에 적는다).", { variant: "chase-on-battle" }));
  return problems;
}

/** 상점·시간표·문·새 맵으로 가는 길·되풀이되는 보상·조우·싸울 적·적 개성·HUD — 요청한 것이 세계에 실제로 놓였나. */
export function worldChecks({ before, after, task, changed, kinds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 1d) 상점: 사고파는 요청인데 바꾼 이벤트 어디에도 상점 명령이 없다(대장장이가 낮에 대사만 했다 — 2026-10-24 스위트).
  if (asksWorkingShop(task) && !kinds.has("shop")) {
    problems.push(tagged("game", "상점", "요청에 사고파는 상점이 있는데 바꾼 이벤트에 상점 명령(kind:'shop')이 없다 — set_shop_stock 으로 그 NPC 에 상점을 달거나, 시간대 페이지라면 열린 시간 페이지에 {kind:'shop',goods,allowSell:true} 를 넣는다."));
  }
  // 1e) 시간표: 「밤에는 집에·낮에는 가게에」처럼 시간대마다 자리가 바뀌는 사람 — 시간표(schedule)나 시간대 페이지(timePhase)가 있어야 한다.
  if (asksTimedWhereabouts(task)) {
    const scheduled = Object.values(after.maps).some((m) => (m.events ?? []).some((e) => {
      const prev = before.maps[m.id]?.events?.find((b) => b.id === e.id) as unknown as Obj | undefined;
      const sch = (e as unknown as Obj).schedule;
      return Array.isArray(sch) && sch.length > 0 && JSON.stringify(sch) !== JSON.stringify(prev?.schedule);
    }));
    // 시간대 페이지는 «사람» 이벤트(그림 있는 페이지)여야 한다 — 팻말 하나에만 시간대 페이지가 있으면 사람은 그대로다.
    const phasePages = changed.some((ev) => ev.pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); }) && ev.pages.some((pg) => flatConditions(pg.conditions).some((c) => c.kind === "timePhase")));
    if (!scheduled && !phasePages) problems.push(tagged("game", "시간", "요청에 시간대마다 자리·행동이 바뀌는 사람이 있는데 시간표(set_npc_schedule)도 시간대 페이지({kind:'timePhase'} 조건)도 없다 — configure_time_system 을 켜고 set_npc_schedule 로 낮·밤 자리를 정한다."));
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
        problems.push(tagged("game", "이동", `${map.name ?? map.id} 에서 「${after.maps[to]?.name ?? to}」로 가는 문이 ${groups.length}곳 따로 있다: ${where} — 짓기 도구가 이미 이은 문과 새로 단 문이 겹쳤다. 요청한 자리(가장자리 길 끝·문) 하나만 남기고 나머지는 remove_event 로 지운다(반대쪽 맵의 짝 문도).`, { target: { mapId: map.id, ref: to }, variant: "duplicate-doors" }));
      }
    }
  }
  // 1e3) 「숲·들판에 적/사당」인데 새 맵 없이 마을 맵에 두었다(마을 나무 덩이 안의 고블린·멧돼지 — 2026-10-25).
  if (asksOpenField(task) && !Object.keys(after.maps).some((id) => !before.maps[id])) {
    const foes = changed.filter((ev) => ((ev as unknown as Obj).pages as Obj[] | undefined ?? []).some((p) => (p.trigger as Obj | undefined)?.kind === "eventTouch" && JSON.stringify(p.commands ?? []).includes("battleProcessing")));
    if (foes.length) problems.push(tagged("game", "장소", `요청은 숲·들판인데 새 맵 없이 기존 맵에 필드 적 ${foes.length}개를 두었다 — author_forest_route(숲, 들판은 terrain:'field')로 그 맵을 짓고 가장자리로 이은 뒤 거기에 둔다.`));
  }
  // 1f) 새로 지은 맵에 들어가는 길: 다른 맵의 이벤트·연결 어디에도 그 맵 id 가 없으면 플레이어가 못 간다(집 실내·필드가 고립됐다).
  {
    const newMaps = Object.keys(after.maps).filter((id) => !before.maps[id] && id !== after.startMapId);
    if (newMaps.length) {
      const rest = after as unknown as Obj;
      for (const id of newMaps) {
        const others = JSON.stringify({ maps: Object.values(after.maps).filter((m) => m.id !== id).map((m) => m.events), common: after.commonEvents, conn: rest.mapConnections ?? rest.connections ?? null, world: rest.worldmap ?? null });
        if (!others.includes(`"${id}"`)) problems.push(tagged("game", "이동", `새 맵 「${after.maps[id]!.name ?? id}」(${id}) 로 들어가는 문·이동이 어느 맵에도 없다 — 플레이어가 갈 수 없다. create_transfer_pair 로 문(집 문·마을 가장자리)과 잇는다.`, { target: { mapId: id }, variant: "no-way-in" }));
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
      if (!setsFlag && ungated.length) problems.push(tagged("game", "반복", `「${ev.name}」(${ev.id}) 페이지 ${pi + 1}: ${ungated.map((g) => String(g.cmd.kind)).slice(0, 3).join("·")} 를 주는데 스위치·셀프 스위치를 안 켜서 말 걸 때마다 또 준다 — 한 번만이면 셀프 스위치를 켜고 그 조건의 「이미 받았다」 페이지를 둔다.`, { target: { mapId: ev.mapId, eventId: ev.id } }));
    });
  }
  // 1h) 무작위 조우: 「랜덤 인카운터·풀숲에서 마주치는」 요청인데 조우표가 안 바뀌었다(보이는 적 이벤트만 놓았다).
  if (namesRandomEncounters(task)) {
    const enc = (m: unknown) => { const o = m as Obj | undefined; const v = o?.encounterTable ?? o?.encounters ?? o?.encounter; return Array.isArray(v) && v.length ? JSON.stringify(v) : ""; };
    const changedEnc = Object.values(after.maps).some((m) => enc(m) && enc(m) !== enc(before.maps[m.id]));
    if (!changedEnc) problems.push(tagged("game", "조우", "요청에 무작위 조우가 있는데 어느 맵의 조우표도 바뀌지 않았다 — set_encounter_table 로 그 맵에 적 그룹·빈도를 단다(보이는 적 이벤트는 무작위 조우가 아니다).", { variant: "table-unchanged" }));
  }
  // 1i) 싸울 몬스터: 「약한 몬스터가 있게·적과 싸우는」 요청인데 이번에 바뀐 이벤트에 전투가 없고 켜진 조우도 바뀌지 않았다
  // (2026-10-31 sc-1031-b4 terra 숲길 3판 «몬스터·조우 없음» — 할 일 고리는 모델이 전투 항목을 적을 때만 이것을 본다).
  if (FOE_ASK.test(task) && !kinds.has("battleProcessing")) {
    const enc = (m: unknown) => { const o = m as Obj | undefined; return Number(o?.encounterRate ?? 0) > 0 && Array.isArray(o?.encounterTable) && (o!.encounterTable as unknown[]).length ? JSON.stringify([o!.encounterTable, o!.encounterRate]) : ""; };
    const encOn = Object.values(after.maps).some((m) => enc(m) && enc(m) !== enc(before.maps[m.id]));
    if (!encOn) problems.push(tagged("game", "전투", "요청에 싸울 몬스터·적이 있는데 이번에 단 전투(battleProcessing)도 켠 조우도 없다 — upsert_enemy·upsert_troop 로 적을 만들고 place_field_enemy 로 그 맵에 둔다(author_forest_route 결과 data.maps[i].enemySpots 가 적 자리, clearing·deadEnds·출입구 칸에 겹치지 않게).", { variant: "none" }));
  }
  // 1j) 적 개성(2026-11-09 fs-use-tools E1): 게임을 만드는 요청에서 보스가 기본 공격뿐이거나 일반 적 기술이 전부 같다.
  if (buildsWholeGame(after, task)) problems.push(...enemyIdentityProblems(after));
  // 1l) HUD·타이틀 선택(2026-11-09 fs-use-tools): 게임을 만드는 요청에서 HUD 가 이야기 기본 템플릿 그대로이거나 타이틀 모양을 아무도 고르지 않았다.
  if (buildsWholeGame(after, task)) problems.push(...hudTitleChoiceProblems(after));
  return problems;
}

/** 엔딩·상태 이상·물건 고르기 창. */
export function endingStateChecks({ before, after, task, cmds, kinds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 2) 엔딩: 엔딩 정의 + triggerEnding.
  // 음악만 바라는 엔딩 요청(「잔잔하게 엔딩곡」)은 엔딩을 짓는 요청이 아니다. 엔딩 명령은 이번에 바꾼 이벤트가 아니라 프로젝트 전체에서 찾는다 —
  // 이미 있던 보스 이벤트의 triggerEnding 도 엔딩이다(2026-10-30 r11: 바꾼 이벤트만 봐서 «triggerEnding 이 없다»고 거짓으로 막았다).
  if (ENDING_WORDS.test(task) && !musicOnly(task)) {
    const newEndings = (after.endings ?? []).filter((e) => !(before.endings ?? []).some((b) => b.id === e.id && JSON.stringify(b) === JSON.stringify(e)));
    if (!kinds.has("triggerEnding") && !projectHasCommand(after, "triggerEnding")) problems.push(tagged("game", "엔딩", `요청에 엔딩이 있는데 triggerEnding 명령이 없다${kinds.has("returnToTitle") ? "(내레이션+타이틀로 돌아가기는 엔딩이 아니다)" : ""}. define_ending 으로 엔딩을 정의하고 갈래에 {kind:'triggerEnding',endingId} 를 넣는다.`, { variant: "no-trigger" }));
    else if (!newEndings.length && !(after.endings ?? []).length) problems.push(tagged("game", "엔딩", "triggerEnding 은 있는데 정의된 엔딩(define_ending)이 없다.", { variant: "no-definition" }));
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
    if (leaks.length) problems.push(tagged("game", "엔딩", `엔딩 「${ending.name}」(${ending.id}) 에필로그 대사 본문이 「이름:」으로 시작한다: ${leaks.slice(0, 2).join(" · ")} — 엔딩 카드에 대본 머리말이 그대로 보인다. 이름은 본문에서 빼고 say 비트의 speaker 에 둔다(카드는 「」 인용으로 보인다). 장면 설명은 context:'narration' 으로.`, { variant: "epilogue-speaker", target: { ref: ending.id } }));
  }
  // 3) 상태 이상: 실제 상태 걸기(m2-019-change-state add) 또는 상태를 거는 데이터(아이템·기술·적의 stateEffects).
  if (STATE_WORDS.test(task)) {
    // 치료·해독 요청이면 상태를 «지우는» 것도 실제 상태 처리다(g-healer). 아이템의 healStateIds 도.
    const cures = asksCure(task);
    const applies = cmds.some((r) => r.cmd.kind === "m2Command" && /m2-019/u.test(String(r.cmd.commandId)) && (cures || obj(r.cmd.fields)?.operation !== "remove"))
      || (cures && cmds.some((r) => r.cmd.kind === "recoverAll"));
    const changedDb = changedRecordsJson(before, after);
    const dataApplies = /"stateEffects":\[\{[^\]]*"operation":"add"|"addStateIds":\["state_|"stateId":"state_/u.test(changedDb) || (cures && /"healStateIds":\["state_/u.test(changedDb));
    if (!applies && !dataApplies) problems.push(tagged("game", "상태", "요청에 독·마비 같은 상태 이상이 있는데 실제 상태를 거는 명령이 없다(소리·번쩍임·HP 감소만으로는 독이 아니다). {kind:'m2Command',commandId:'m2-019-change-state',fields:{target:'party',operation:'add',value:'state_poison'}} 를 넣는다."));
  }
  // 4) 물건 고르기 창은 그 물건이 있을 때만.
  for (const r of cmds) {
    if (r.cmd.kind !== "presentItem") continue;
    const wanted = new Set<string>([...((r.cmd.itemIds as string[] | undefined) ?? []), ...(((r.cmd.options as Obj[] | undefined) ?? []).map((o) => String(o.itemId)))]);
    const guarded = [...flatConditions(r.page.conditions), ...r.guards.flatMap((g) => flatConditions(g))].some((c) => c.kind === "item" && c.present !== false && (!wanted.size || wanted.has(String(c.itemId))));
    if (!guarded) problems.push(tagged("game", "물건", `「${r.ev.name}」(${r.ev.id}) 페이지 ${r.pageIndex + 1}: 물건 고르기 창(presentItem)이 그 물건이 없을 때도 뜬다. 그 페이지 조건에 {kind:'item',itemId,present:true} 를 걸고, 물건이 없을 때는 평소 대사 페이지가 나오게 한다.`, { target: { mapId: r.ev.mapId, eventId: r.ev.id } }));
  }
  return problems;
}

/** 못 이기는 전투와 연계기. */
export function battleChecks({ before, after, task, cmds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
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
        if (sim.winRate === 0) problems.push(tagged("game", "전투", `${r.ev.id} 가 여는 전투(${c.troopId})를 시작 파티(Lv${level})로 모의 20판 해 보니 한 번도 못 이긴다 — 플레이어가 그 전에 레벨을 올릴 길이 없으면 게임이 막힌다. upsert_enemy 로 HP·공격을 낮추거나(simulate_battle 로 승률 40~80% 확인), 지는 이야기 전투면 canLose:true.`, { variant: "unwinnable", target: { mapId: r.ev.mapId, eventId: r.ev.id } }));
      } catch { /* 모의 실패는 넘어간다 */ }
    }
  }
  // 연계기(두세 사람이 같이 쓰는 기술): 요청에 있는데 새/바뀐 연계 기록(comboActorIds 2명 이상)이 없다 — 평범한 기술 두 개로 흉내 내지 않는다(2026-10-25 데모 과업).
  if (asksComboSkill(task)) {
    const prior = new Map(before.database.skills.map((sk) => [sk.id, JSON.stringify(sk)]));
    const combo = after.database.skills.some((sk) => (sk.comboActorIds?.length ?? 0) >= 2 && prior.get(sk.id) !== JSON.stringify(sk));
    if (!combo) problems.push(tagged("game", "연계기", "요청에 연계기가 있는데 새로 만든 연계 기록이 없다(평범한 기술은 「연계」 명령에 안 뜬다). upsert_combo_tech{id:'skill_combo_…', name, actorIds:[두 배우], mpCosts, scope, power} 로 만들고, 참가 배우가 파티에 없으면 set_party 로 넣는다."));
  }
  return problems;
}
