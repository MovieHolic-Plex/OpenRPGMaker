// 조수 v2 게임 내용 검사 — 실행이 바꾼 이벤트·데이터를 요청 낱말과 맞대어 «흉내»와 «빠진 쪽»을 짚는다.
//
// 왜(2026-10-24 새 12 사례): 비 → 화면 색만, 독 → 소리·번쩍임만, 엔딩 → 내레이션+타이틀, 우물 동전 → 물건이 없어도 고르기 창,
// 암호 → 「이미 통과」 페이지 없음·선언 안 한 깃발. 모델이 「됐다」고 말해도 이 검사가 남은 문제를 끝맺음 관문에 올린다.
// 순수 함수(before·after·요청 글) — 워커·테스트가 같이 부른다.
import type { Command, Project } from "@/project/types";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

/** 이벤트 하나를 가리키는 이름(보고용). */
interface EventRef { readonly mapId: string; readonly id: string; readonly name: string; readonly pages: readonly Obj[] }

function eventsOf(project: Project): Map<string, EventRef> {
  const out = new Map<string, EventRef>();
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events ?? []) out.set(`${map.id}/${ev.id}`, { mapId: map.id, id: ev.id, name: ev.name || ev.id, pages: (ev.pages ?? []) as unknown as Obj[] });
  }
  for (const ce of project.commonEvents ?? []) {
    const c = ce as unknown as Obj;
    out.set(`common/${String(c.id)}`, { mapId: "common", id: String(c.id), name: String(c.name ?? c.id), pages: [{ commands: c.commands ?? [] }] });
  }
  return out;
}

/** 이 실행이 새로 만들거나 바꾼 이벤트. */
export function changedEvents(before: Project, after: Project): EventRef[] {
  const old = eventsOf(before);
  const out: EventRef[] = [];
  for (const [key, ev] of eventsOf(after)) {
    const prev = old.get(key);
    if (!prev || JSON.stringify(prev.pages) !== JSON.stringify(ev.pages)) out.push(ev);
  }
  return out;
}

/** 명령 나무를 걷는다 — 감싸는 fork 조건들을 함께 넘긴다. */
function walkCommands(commands: unknown, visit: (cmd: Obj, guards: readonly Obj[]) => void, guards: readonly Obj[] = []): void {
  if (!Array.isArray(commands)) return;
  for (const raw of commands) {
    const cmd = obj(raw);
    if (!cmd) continue;
    visit(cmd, guards);
    if (cmd.kind === "fork") {
      const cond = obj(cmd.condition);
      walkCommands(cmd.then, visit, cond ? [...guards, cond] : guards);
      walkCommands(cmd.else, visit, guards);
      continue;
    }
    for (const [key, child] of Object.entries(cmd)) {
      if (key === "condition") continue;
      if (Array.isArray(child)) {
        if (child.some((c) => obj(c)?.kind)) walkCommands(child, visit, guards);
        else for (const c of child) { const o = obj(c); if (o && Array.isArray(o.branch)) walkCommands(o.branch, visit, guards); if (o && Array.isArray(o.commands)) walkCommands(o.commands, visit, guards); }
      }
    }
  }
}

function allCommands(ev: EventRef): { cmd: Obj; guards: readonly Obj[]; page: Obj; pageIndex: number }[] {
  const out: { cmd: Obj; guards: readonly Obj[]; page: Obj; pageIndex: number }[] = [];
  ev.pages.forEach((page, pageIndex) => walkCommands(page.commands, (cmd, guards) => out.push({ cmd, guards, page, pageIndex })));
  return out;
}

/** 조건 나무 안의 모든 조건(all·any·not 펼침). */
function flatConditions(conds: unknown): Obj[] {
  const out: Obj[] = [];
  const visit = (c: unknown): void => {
    const o = obj(c);
    if (!o) { if (Array.isArray(c)) c.forEach(visit); return; }
    out.push(o);
    if (Array.isArray(o.conditions)) o.conditions.forEach(visit);
    if (o.condition) visit(o.condition);
  };
  visit(conds);
  return out;
}

/** 프로젝트 전체에서 «읽는» 스위치·변수·셀프 스위치(페이지 조건·fork 조건·엔딩 조건·퀘스트). */
function readsOf(project: Project): { switches: Set<string>; variables: Set<string>; selfKeys: Map<string, Set<string>> } {
  const switches = new Set<string>(), variables = new Set<string>(), selfKeys = new Map<string, Set<string>>();
  const note = (eventKey: string, c: Obj) => {
    if (typeof c.switchId === "string") switches.add(c.switchId);
    if (typeof c.variableId === "string") variables.add(c.variableId);
    if (c.kind === "var" && typeof c.id === "string") variables.add(c.id);
    if (c.kind === "selfSwitch" && typeof c.key === "string") { const s = selfKeys.get(eventKey) ?? new Set(); s.add(c.key); selfKeys.set(eventKey, s); }
  };
  for (const [key, ev] of eventsOf(project)) {
    for (const page of ev.pages) for (const c of flatConditions(page.conditions)) note(key, c);
    for (const { cmd } of allCommands(ev)) {
      for (const c of flatConditions(cmd.condition)) note(key, c);
      // 변수는 값으로도 읽힌다(대사 속 \V[..]·다른 변수 연산·조건부 분기의 피연산자).
      for (const [k, v] of Object.entries(cmd)) if (k !== "variableId" && typeof v === "object" && v) for (const c of flatConditions(v)) if (c.kind === "var" && typeof c.id === "string") variables.add(c.id);
      if (cmd.kind === "text" && typeof cmd.body === "string") for (const m of cmd.body.matchAll(/\\V\[([^\]]+)\]/gu)) variables.add(m[1]!);
    }
  }
  const rest = JSON.stringify({ endings: project.endings ?? [], quests: project.quests ?? [] });
  for (const m of rest.matchAll(/"(?:switchId|variableId)":"([^"]+)"/gu)) { switches.add(m[1]!); variables.add(m[1]!); }
  return { switches, variables, selfKeys };
}

const WEATHER_WORDS = /비가|비\s*(가\s*)?오|빗방울|빗줄기|소나기|폭우|장마|눈이\s*(오|내|와|쌓)|눈\s*내리|함박눈|폭풍|폭설|안개|날씨|천둥 ?(이|소리|번개)|rain|snow|storm|fog|weather/iu;
const SHAKE_WORDS = /흔들리|흔들린|흔들려|흔들어|지진|진동|쿵\s*(하|소리)|earthquake|tremor|shake/iu;
const FLASH_WORDS = /번쩍|섬광|번개(?!\s*(의\s*서|마법|기술|스킬|주문|책|의\s*검))(?!['’」』])|빛이\s*터|flash|lightning/iu;
const MUSIC_WORDS = /음악|배경음|브금|bgm|music/iu;
const HIDDEN_WORDS = /숨겨|숨은|몰래|보이지\s*않|투명|비밀|hidden|secret|invisible/iu;
const ENDING_WORDS = /엔딩|결말|ending/iu;
const STATE_WORDS = /독초|독에|독이|독을|독\s*상태|중독|맹독|마비|수면\s*상태|잠\s*상태|상태\s*이상|혼란|침묵|poison|paraly|stun/iu;

/** 데이터베이스에서 새로 생기거나 바뀐 레코드만 JSON 으로(기본 데이터의 독 기술 등이 섞이지 않게). */
function changedRecordsJson(before: Project, after: Project): string {
  const out: unknown[] = [];
  const b = before.database as unknown as Record<string, unknown>, a = after.database as unknown as Record<string, unknown>;
  for (const [section, value] of Object.entries(a)) {
    if (!Array.isArray(value)) continue;
    const old = new Map(((b[section] as Obj[] | undefined) ?? []).map((r) => [String(r.id), JSON.stringify(r)]));
    for (const r of value as Obj[]) { const j = JSON.stringify(r); if (old.get(String(r.id)) !== j) out.push(r); }
  }
  return JSON.stringify(out);
}

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
  if (SHAKE_WORDS.test(task) && !m2Has(/m2-048/u)) problems.push("[게임 검사 화면] 요청에 흔들림·지진이 있는데 실제 화면 흔들기 명령이 없다(카메라 이동은 흔들림이 아니다). add_event 의 shake 비트({do:'shake',strength:'strong',axis:'vertical'})로 넣는다.");
  if (FLASH_WORDS.test(task) && !m2Has(/m2-047/u) && !cmds.some((r) => r.cmd.kind === "setWeather" && r.cmd.weather === "storm")) problems.push("[게임 검사 화면] 요청에 번쩍임·번개가 있는데 실제 화면 번쩍 명령이 없다(페이드 아웃은 번쩍이 아니다). add_event 의 flash 비트({do:'flash',color:'white'})로 넣는다.");
  if (MUSIC_WORDS.test(task) && !kinds.has("playAudio") && !kinds.has("stopAudio") && !m2Has(/bgm|audio|music/iu)) problems.push("[게임 검사 음악] 요청에 음악·BGM 이 있는데 바꾼 이벤트에 음악 명령(playAudio)이 없다. add_event 의 music 비트({do:'music',action:'bgm',query:'festival'})로 넣는다.");
  // 1c) 눈에 안 보이는 «조사하는» 물건: 새로 만든 결정 키(action) 이벤트에 그림도 없고 그 칸에 물건 타일도 없다(이동석·덤불·표지판이 맨땅으로 보였다).
  if (!HIDDEN_WORDS.test(task)) {
    for (const ev of changed) {
      if (ev.mapId === "common") continue;
      const map = after.maps[ev.mapId] as unknown as Obj | undefined;
      const raw = ((map?.events as Obj[] | undefined) ?? []).find((e) => e.id === ev.id);
      if (!map || !raw) continue;
      const pages = ev.pages;
      if (!pages.length || !pages.some((pg) => obj(pg.trigger)?.kind === "action")) continue;
      if (pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); })) continue;
      const w = Number(map.width), i = Number(raw.y) * w + Number(raw.x);
      const at = (layer: unknown) => Array.isArray(layer) ? Number(layer[i]) : -1;
      // 도구가 만든 장면 받침(ev_cutscene_*·호위 목적지)은 빼고, 그 칸이나 바로 위(북쪽) 칸에 물건 타일·건물 도장이 있으면 «그 물건 앞»이라 본다.
      if (/^ev_(cutscene|escort)_/u.test(ev.id)) continue;
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
  if (/랜덤|무작위|인카운터|마주치|조우|encounter/iu.test(task)) {
    const enc = (m: unknown) => { const o = m as Obj | undefined; const v = o?.encounterTable ?? o?.encounters ?? o?.encounter; return Array.isArray(v) && v.length ? JSON.stringify(v) : ""; };
    const changedEnc = Object.values(after.maps).some((m) => enc(m) && enc(m) !== enc(before.maps[m.id]));
    if (!changedEnc) problems.push("[게임 검사 조우] 요청에 무작위 조우가 있는데 어느 맵의 조우표도 바뀌지 않았다 — set_encounter_table 로 그 맵에 적 그룹·빈도를 단다(보이는 적 이벤트는 무작위 조우가 아니다).");
  }
  // 2) 엔딩: 엔딩 정의 + triggerEnding.
  if (ENDING_WORDS.test(task)) {
    const newEndings = (after.endings ?? []).filter((e) => !(before.endings ?? []).some((b) => b.id === e.id && JSON.stringify(b) === JSON.stringify(e)));
    if (!kinds.has("triggerEnding")) problems.push(`[게임 검사 엔딩] 요청에 엔딩이 있는데 triggerEnding 명령이 없다${kinds.has("returnToTitle") ? "(내레이션+타이틀로 돌아가기는 엔딩이 아니다)" : ""}. define_ending 으로 엔딩을 정의하고 갈래에 {kind:'triggerEnding',endingId} 를 넣는다.`);
    else if (!newEndings.length && !(after.endings ?? []).length) problems.push("[게임 검사 엔딩] triggerEnding 은 있는데 정의된 엔딩(define_ending)이 없다.");
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
  const unreadVar = [...setVar.entries()].filter(([id]) => !reads.variables.has(id));
  if (unreadVar.length) problems.push(`[게임 검사 깃발] 값만 바꾸고 아무도 읽지 않는 변수: ${unreadVar.slice(0, 5).map(([id, who]) => `${id}(「${who}」)`).join(", ")} — 조건·분기에서 쓰거나 지운다.`);
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
  return problems;
}

/** 요청과 상관없이 바뀌면 안 되는 것 — 기존 NPC 의 그림·이름이 요청 없이 바뀌었는지(고치기 요청에서 흔한 부작용). */
export function unaskedChanges(before: Project, after: Project, task: string): string[] {
  if (/그림|외형|모습|얼굴|옷|칩|graphic|sprite|face/iu.test(task)) return [];
  const out: string[] = [];
  for (const map of Object.values(before.maps)) {
    const now = after.maps[map.id];
    if (!now) continue;
    for (const ev of map.events ?? []) {
      const cur = (now.events ?? []).find((e) => e.id === ev.id);
      if (!cur) continue;
      const g0 = JSON.stringify(ev.pages?.[0]?.graphic ?? null), g1 = JSON.stringify(cur.pages?.[0]?.graphic ?? null);
      const f0 = JSON.stringify((ev.pages?.[0] as unknown as Obj | undefined)?.face ?? null), f1 = JSON.stringify((cur.pages?.[0] as unknown as Obj | undefined)?.face ?? null);
      if (g0 !== "null" && (g0 !== g1 || f0 !== f1)) out.push(`[게임 검사 부작용] 기존 「${ev.name || ev.id}」의 그림·얼굴이 요청 없이 바뀌었다 — 원래 graphic·face 를 그대로 둔다.`);
    }
  }
  // 이미 있던 데이터(아이템·장비·적·기술·직업)를 요청이 그 이름을 말하지 않았는데 고쳤다 — 값·능력치가 게임 전체에서 바뀐다(2026-10-24 스위트).
  const bdb = before.database as unknown as Record<string, unknown>, adb = after.database as unknown as Record<string, unknown>;
  for (const section of ["items", "weapons", "armors", "enemies", "skills", "classes", "actors"]) {
    const old = new Map(((bdb[section] as Obj[] | undefined) ?? []).map((r) => [String(r.id), r]));
    for (const r of (adb[section] as Obj[] | undefined) ?? []) {
      const prev = old.get(String(r.id));
      if (!prev || JSON.stringify(prev) === JSON.stringify(r)) continue;
      const name = String(r.name ?? prev.name ?? "");
      if (name && task.includes(name)) continue;
      // 주인공·동료 요청은 배우 고치기가 정상이다.
      if (section === "actors" && /주인공|동료|파티|합류|이름|직업|레벨|능력치|hero|party/iu.test(task)) continue;
      if (section === "classes" && /직업|레벨|스킬|기술|배우|class|skill|level/iu.test(task)) continue;
      const keys = Object.keys({ ...prev, ...r }).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(r[k]));
      out.push(`[게임 검사 부작용] 요청에 없는 기존 ${section} 「${name || String(r.id)}」 를 바꿨다(${keys.slice(0, 4).join(",")}) — 게임 전체 값이 바뀐다. 새 레코드를 만들거나 되돌린다.`);
    }
  }
  return out.slice(0, 6);
}

export type { Command };
