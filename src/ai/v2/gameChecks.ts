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

const WEATHER_WORDS = /비가|비\s*(가\s*)?오|빗방울|빗줄기|소나기|폭우|장마|눈이\s*(오|내|와|쌓)|눈\s*내리|함박눈|폭풍|폭설|안개|날씨|천둥|번개|rain|snow|storm|fog|weather/iu;
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
    const idle = newDeclared.filter((id) => !everywhere.includes(`"${id}"`) && !everywhere.includes(`[${id}]`));
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
  return out.slice(0, 4);
}

export type { Command };
