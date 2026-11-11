// 게임 내용 검사가 같이 쓰는 읽기 — 이벤트·명령·조건 걷기, 스위치·변수를 읽는 곳과 켜는 곳, 실행 전후로 바뀐 이벤트·음악·효과음·기록.
import type { Project } from "@/project/types";
import { isScriptCommand, scriptCalls, scriptReads, scriptWrites } from "@/project/script/effects";

export type Obj = Record<string, unknown>;

export const obj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

/** 이벤트 하나를 가리키는 이름(보고용). */
interface EventRef { readonly mapId: string; readonly id: string; readonly name: string; readonly pages: readonly Obj[] }

export function eventsOf(project: Project): Map<string, EventRef> {
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

/**
 * 시간 체계 달력과 따로 날짜를 세는 변수(J18): 잠자기(sleepUntilMorning)·하루 넘기기(advanceTime days)와 같은 명령 줄에서 +1 되거나,
 * 이름이 날짜 세기(일수·일차·날짜·day)인데 +1 되는 변수. onDayEnd 공통 이벤트 안의 카운트는 달력과 함께 가므로 뺀다.
 */
export function dayCounterVariables(project: Project, onDayEnd?: string): { id: string; name: string; where: string }[] {
  const names = new Map((project.variables ?? []).map((v) => [v.id, v.name || v.id] as const));
  const found = new Map<string, string>();
  const scan = (commands: unknown, where: string): void => {
    const lists: unknown[][] = [];
    const collect = (list: unknown): void => {
      if (!Array.isArray(list)) return;
      lists.push(list);
      for (const raw of list) {
        const c = obj(raw);
        if (!c) continue;
        for (const [key, child] of Object.entries(c)) {
          if (key === "condition" || !Array.isArray(child)) continue;
          if (child.some((x) => obj(x)?.kind)) collect(child);
          else for (const x of child) { const o = obj(x); if (o) { collect(o.branch); collect(o.commands); } }
        }
      }
    };
    collect(commands);
    for (const list of lists) {
      const cmds = list.map(obj).filter((c): c is Obj => !!c);
      const sleeps = cmds.some((c) => c.kind === "sleepUntilMorning" || (c.kind === "advanceTime" && Number(c.days ?? 0) > 0));
      for (const c of cmds) {
        if (c.kind !== "setVariable" || c.op !== "+=" || Number(c.value) !== 1 || typeof c.variableId !== "string") continue;
        const name = names.get(c.variableId) ?? c.variableId;
        // 날짜를 세는 이름만 본다(호감도·피로처럼 잠잘 때 같이 오르는 변수는 아니다). 영어는 낱말 경계(birthday·holiday·today 제외).
        // 이름만으로 잡을 때는 「일수·일차·N일째」, 잠자기 줄과 함께면 「날짜·며칠」도 날짜 세기로 본다.
        const label = `${name} ${c.variableId}`;
        const dayName = /일수|일차|일째|(?:^|[^a-z])days?(?:_?(?:count|elapsed|passed|num))?(?![a-z])/iu.test(label);
        if (dayName || (sleeps && /날짜|며칠/u.test(label))) if (!found.has(c.variableId)) found.set(c.variableId, where);
      }
    }
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const page of (ev.pages ?? []) as unknown as Obj[]) scan(page.commands, `「${ev.name || ev.id}」`);
  for (const ce of project.commonEvents ?? []) {
    const c = ce as unknown as Obj;
    if (onDayEnd && c.id === onDayEnd) continue;
    scan(c.commands, `공통 이벤트 「${String(c.name ?? c.id)}」`);
  }
  return [...found].map(([id, where]) => ({ id, name: names.get(id) ?? id, where }));
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
export function walkCommands(commands: unknown, visit: (cmd: Obj, guards: readonly Obj[]) => void, guards: readonly Obj[] = []): void {
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

export function allCommands(ev: EventRef): { cmd: Obj; guards: readonly Obj[]; page: Obj; pageIndex: number }[] {
  const out: { cmd: Obj; guards: readonly Obj[]; page: Obj; pageIndex: number }[] = [];
  ev.pages.forEach((page, pageIndex) => walkCommands(page.commands, (cmd, guards) => out.push({ cmd, guards, page, pageIndex })));
  return out;
}

/** 프로젝트 어딘가(모든 맵 이벤트·공통 이벤트)에 그 종류의 명령이 있는가. */
export function projectHasCommand(project: Project, kind: string): boolean {
  let found = false;
  const visit = (commands: unknown) => { if (!found) walkCommands(commands, (cmd) => { if (cmd.kind === kind) found = true; }); };
  for (const map of Object.values(project.maps ?? {})) for (const ev of map.events ?? []) for (const page of ev.pages ?? []) visit(page.commands);
  for (const ce of project.commonEvents ?? []) visit((ce as { commands?: unknown }).commands);
  return found;
}

/** 조건 나무 안의 모든 조건(all·any·not 펼침). */
export function flatConditions(conds: unknown): Obj[] {
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
export function readsOf(project: Project): { switches: Set<string>; variables: Set<string>; selfKeys: Map<string, Set<string>> } {
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
      // 스크립트가 리터럴 id 로 읽는 스위치·변수.
      if (isScriptCommand(cmd)) {
        for (const id of scriptReads(cmd, "switch", project)) switches.add(id);
        for (const id of scriptReads(cmd, "variable", project)) variables.add(id);
      }
    }
  }
  const rest = JSON.stringify({ endings: project.endings ?? [], quests: project.quests ?? [] });
  for (const m of rest.matchAll(/"(?:switchId|variableId)":"([^"]+)"/gu)) { switches.add(m[1]!); variables.add(m[1]!); }
  return { switches, variables, selfKeys };
}

/** 프로젝트 전체에서 켜는(값을 바꾸는)·부르는 쪽. 끄기(value:false)는 켜기로 세지 않는다. */
export function settersOf(project: Project): { switches: Map<string, string>; variables: Map<string, string>; commons: Map<string, string> } {
  const switches = new Map<string, string>(), variables = new Map<string, string>(), commons = new Map<string, string>();
  for (const ev of eventsOf(project).values()) for (const { cmd } of allCommands(ev)) {
    if (cmd.kind === "setSwitch" && typeof cmd.switchId === "string" && cmd.value !== false) switches.set(cmd.switchId, ev.name);
    if ((cmd.kind === "setSwitchRange" || cmd.kind === "controlSwitches") && typeof cmd.switchId === "string") switches.set(cmd.switchId, ev.name);
    if (cmd.kind === "setVariable" && typeof cmd.variableId === "string") variables.set(cmd.variableId, ev.name);
    if (cmd.kind === "callCommonEvent" && typeof cmd.commonEventId === "string") commons.set(cmd.commonEventId, ev.name);
    // 스크립트의 game.setSwitch·setVar·callCommonEvent(리터럴 id).
    if (isScriptCommand(cmd)) {
      for (const id of scriptWrites(cmd, "switch", project)) switches.set(id, ev.name);
      for (const id of scriptWrites(cmd, "variable", project)) variables.set(id, ev.name);
      for (const id of scriptCalls(cmd, "commonEvent", project)) commons.set(id, ev.name);
    }
  }
  // 엔딩·퀘스트 보상이 켜는 깃발도 켜는 쪽이다.
  const rest = JSON.stringify({ endings: project.endings ?? [], quests: project.quests ?? [] });
  for (const m of rest.matchAll(/"switchId":"([^"]+)"/gu)) switches.set(m[1]!, "퀘스트·엔딩");
  return { switches, variables, commons };
}

/** 맵 배경음·기본 전투곡·승리 팡파르·타이틀·오프닝·엔딩 곡 연결이 바뀌었나(set_game_audio) — 그러면 음악 요청은 이벤트 명령 없이도 채워졌다. */
export function audioBindingsChanged(before: Project, after: Project): boolean {
  const pick = (p: Project) => JSON.stringify([
    Object.entries(p.maps).map(([id, map]) => [id, map.bgm ?? null]),
    p.system.defaultBgmResourceId ?? null, p.system.battleBgmResourceId ?? null, p.system.battleVictoryMeResourceId ?? null,
    p.system.titleScreen?.musicResourceId ?? null, p.system.opening?.musicResourceId ?? null,
    (p.endings ?? []).map((e) => [e.id, e.presentation?.musicResourceId ?? null]),
  ]);
  return pick(before) !== pick(after);
}

/** 효과음 연결(자리 표·타이틀 메뉴 소리·패배/도주·지형 발소리)이 바뀌었나. */
export function seBindingsChanged(before: Project, after: Project): boolean {
  const pick = (p: Project) => JSON.stringify([
    p.system.seCues ?? null, p.system.titleScreen?.sounds ?? null,
    p.system.battleDefeatSeResourceId ?? null, p.system.battleEscapeSeResourceId ?? null,
    (p.database.terrains ?? []).map((t) => t.footstepSoundResourceId ?? null),
  ]);
  return pick(before) !== pick(after);
}

/** 데이터베이스에서 새로 생기거나 바뀐 레코드만 JSON 으로(기본 데이터의 독 기술 등이 섞이지 않게). */
export function changedRecordsJson(before: Project, after: Project): string {
  const out: unknown[] = [];
  const b = before.database as unknown as Record<string, unknown>, a = after.database as unknown as Record<string, unknown>;
  for (const [section, value] of Object.entries(a)) {
    if (!Array.isArray(value)) continue;
    const old = new Map(((b[section] as Obj[] | undefined) ?? []).map((r) => [String(r.id), JSON.stringify(r)]));
    for (const r of value as Obj[]) { const j = JSON.stringify(r); if (old.get(String(r.id)) !== j) out.push(r); }
  }
  return JSON.stringify(out);
}
