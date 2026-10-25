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
import { lockBypasses, placeholderTexts, selfRevealingLocks, unjoinedFollowers } from "./puzzleChecks";
import { splitScriptSpeaker } from "@/project/endingSummary";
import { wantsWholeGame } from "./shipChecks";
import { lookMismatches, oversizedSprites, pristineFantasyHero, titleBackdropMismatch } from "./lookChecks";
import { placementProblems, type PlacementProblem } from "./placementRules";
import { offPurposeProps } from "./roomPurpose";

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

/** 프로젝트 전체에서 켜는(값을 바꾸는)·부르는 쪽. 끄기(value:false)는 켜기로 세지 않는다. */
function settersOf(project: Project): { switches: Map<string, string>; variables: Map<string, string>; commons: Map<string, string> } {
  const switches = new Map<string, string>(), variables = new Map<string, string>(), commons = new Map<string, string>();
  for (const ev of eventsOf(project).values()) for (const { cmd } of allCommands(ev)) {
    if (cmd.kind === "setSwitch" && typeof cmd.switchId === "string" && cmd.value !== false) switches.set(cmd.switchId, ev.name);
    if ((cmd.kind === "setSwitchRange" || cmd.kind === "controlSwitches") && typeof cmd.switchId === "string") switches.set(cmd.switchId, ev.name);
    if (cmd.kind === "setVariable" && typeof cmd.variableId === "string") variables.set(cmd.variableId, ev.name);
    if (cmd.kind === "callCommonEvent" && typeof cmd.commonEventId === "string") commons.set(cmd.commonEventId, ev.name);
  }
  // 엔딩·퀘스트 보상이 켜는 깃발도 켜는 쪽이다.
  const rest = JSON.stringify({ endings: project.endings ?? [], quests: project.quests ?? [] });
  for (const m of rest.matchAll(/"switchId":"([^"]+)"/gu)) switches.set(m[1]!, "퀘스트·엔딩");
  return { switches, variables, commons };
}

/** 전에는 켜는 곳이 있었는데 지금은 없고, 지금도 그것을 기다리는 곳이 있는 고리(보고 문장). */
export function lostLinks(before: Project, after: Project): string[] {
  const was = settersOf(before), now = settersOf(after), reads = readsOf(after);
  const out: string[] = [];
  const waiting = (id: string, kind: "switch" | "variable"): string | undefined => {
    for (const ev of eventsOf(after).values()) {
      const hit = ev.pages.some((pg) => flatConditions(pg.conditions).some((c) => (kind === "switch" ? c.switchId : c.variableId) === id))
        || allCommands(ev).some((r) => flatConditions(r.cmd.condition).some((c) => (kind === "switch" ? c.switchId : c.variableId) === id));
      if (hit) return ev.name;
    }
    return undefined;
  };
  for (const [id, who] of was.switches) if (!now.switches.has(id) && reads.switches.has(id)) {
    const reader = waiting(id, "switch");
    if (reader) out.push(`스위치 ${id} — 전에는 「${who}」가 켰는데 이제 켜는 곳이 없고 「${reader}」가 그 스위치를 기다린다`);
  }
  for (const [id, who] of was.variables) if (!now.variables.has(id) && reads.variables.has(id)) {
    const reader = waiting(id, "variable");
    if (reader) out.push(`변수 ${id} — 전에는 「${who}」가 바꿨는데 이제 바꾸는 곳이 없고 「${reader}」가 그 값을 본다`);
  }
  for (const [id, who] of was.commons) if (!now.commons.has(id) && (after.commonEvents ?? []).some((c) => c.id === id && (!c.trigger || c.trigger === "none"))) {
    out.push(`공통 이벤트 ${id} — 전에는 「${who}」가 불렀는데 이제 부르는 곳이 없다`);
  }
  return out;
}

/** 게임을 막 시작했을 때 켜져 있는 페이지 — 조건이 없거나 처음 값(셀프 스위치·스위치 꺼짐)으로 참인 페이지 중 번호가 가장 높은 것. */
function initialPage(pages: readonly Obj[]): Obj | undefined {
  let found: Obj | undefined;
  for (const pg of pages) {
    const conds = flatConditions(pg.conditions).filter((c) => !Array.isArray(c.conditions) && !c.condition);
    if (conds.every((c) => (c.kind === "selfSwitch" || c.kind === "switch") && c.value === false)) found = pg;
  }
  return found;
}

/** 확인 키만 눌러 가는 길(고르기 창은 첫 항목 — 커서가 처음 놓인 자리)에 엔딩·게임 오버가 있으면 그 명령 이름. */
function defaultPathEnd(commands: unknown): { kind: string; choice?: string } | undefined {
  if (!Array.isArray(commands)) return undefined;
  for (const raw of commands) {
    const cmd = obj(raw);
    if (!cmd) continue;
    if (cmd.kind === "triggerEnding" || cmd.kind === "gameOver") return { kind: String(cmd.kind) };
    if (cmd.kind === "choices" && Array.isArray(cmd.options)) {
      const first = obj(cmd.options[0]);
      const hit = defaultPathEnd(first?.branch);
      if (hit) return { kind: hit.kind, choice: String(first?.text ?? "") };
      return undefined;
    }
  }
  return undefined;
}

/** 시작하자마자 끝나는 길: 시작 맵의 자동 실행, 또는 시작 칸에서 몇 걸음 안의 이벤트가 확인 키만으로 엔딩·게임 오버에 닿는다(2026-10-25 G24). */
export function instantEndings(project: Project, near = 3): string[] {
  const map = project.startMapId ? project.maps[project.startMapId] : undefined;
  const sp = project.startPos as { x: number; y: number } | undefined;
  if (!map || !sp) return [];
  const out: string[] = [];
  for (const ev of map.events ?? []) {
    const pg = initialPage((ev.pages ?? []) as unknown as Obj[]);
    if (!pg) continue;
    const trig = String(obj(pg.trigger)?.kind ?? "action");
    const dist = Math.abs(ev.x - sp.x) + Math.abs(ev.y - sp.y);
    const auto = trig === "auto" || trig === "autorun";
    if (!auto && dist > near) continue;
    const hit = defaultPathEnd(pg.commands);
    if (!hit) continue;
    const what = hit.kind === "gameOver" ? "게임 오버" : "엔딩";
    out.push(`「${ev.name || ev.id}」(${ev.id}, ${ev.x},${ev.y}) — ${auto ? "시작 맵 자동 실행" : `시작 칸(${sp.x},${sp.y})에서 ${dist}걸음`}${hit.choice ? `, 첫 항목 「${hit.choice}」` : ""} → ${what}`);
  }
  return out;
}

/** 단서 건너뛰기: 같은 이벤트에서 단서 스위치 조건 페이지가 주는 물건·스위치를, 그 조건이 없는 아래 페이지도 준다(괘종시계 G25). */
export function skippableClues(project: Project): string[] {
  const out: string[] = [];
  for (const ev of eventsOf(project).values()) {
    if (ev.mapId === "common" || ev.pages.length < 2) continue;
    const gives = (pg: Obj): Set<string> => {
      const g = new Set<string>();
      walkCommands(pg.commands, (cmd) => {
        if (cmd.kind === "changeItem" && typeof cmd.itemId === "string" && cmd.op !== "-=" && !(Number(cmd.amount) < 0)) g.add(`item:${cmd.itemId}`);
      });
      return g;
    };
    ev.pages.forEach((pg, i) => {
      const clue = flatConditions(pg.conditions).filter((c) => c.kind === "switch" && c.value !== false && typeof c.switchId === "string");
      if (!clue.length) return;
      const reward = gives(pg);
      if (!reward.size) return;
      for (let j = 0; j < i; j++) {
        const lower = ev.pages[j]!;
        const lowerConds = new Set(flatConditions(lower.conditions).map((c) => String(c.switchId ?? "")));
        if (clue.every((c) => lowerConds.has(String(c.switchId)))) continue;
        const same = [...gives(lower)].filter((k) => reward.has(k));
        if (!same.length) continue;
        out.push(`「${ev.name}」(${ev.id}) ${i + 1}쪽은 단서 스위치 ${clue.map((c) => String(c.switchId)).join(",")} 가 켜져야 ${same.map((k) => k.slice(5)).join(",")} 를 주는데, 그 조건이 없는 ${j + 1}쪽도 같은 것을 준다 — 단서 없이 풀린다`);
        break;
      }
    });
  }
  return out;
}

/** 한 번 숨으면 영영 사라지는 추격자: 쫓는 페이지를 덮는 스위치 페이지에 그림·쫓기가 없고, 그 스위치를 다시 끄는 곳이 없다(G25). */
export function vanishingChasers(project: Project): string[] {
  const out: string[] = [];
  const offs = new Set<string>();
  for (const ev of eventsOf(project).values()) for (const { cmd } of allCommands(ev)) if (cmd.kind === "setSwitch" && cmd.value === false && typeof cmd.switchId === "string") offs.add(cmd.switchId);
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const pages = (ev.pages ?? []) as unknown as Obj[];
    const chaseAt = pages.findIndex((pg) => obj(pg.movement)?.type === "chase" || obj(pg.moveRoute)?.type === "chase");
    if (chaseAt < 0) continue;
    // 싸워서 이기면 사라지는 필드 적(처치 스위치)은 맞는 동작이다 — 잡히면 끝나는(전투 없는) 위협만 본다.
    if (JSON.stringify(pages[chaseAt]!.commands ?? []).includes("battleProcessing")) continue;
    for (let i = chaseAt + 1; i < pages.length; i++) {
      const pg = pages[i]!;
      const sw = flatConditions(pg.conditions).find((c) => c.kind === "switch" && c.value !== false && typeof c.switchId === "string");
      if (!sw) continue;
      const g = obj(pg.graphic);
      const still = !!(g && (g.sprite || g.appearanceId)) && (obj(pg.movement)?.type === "chase" || obj(pg.moveRoute)?.type === "chase");
      if (still || offs.has(String(sw.switchId))) continue;
      out.push(`「${ev.name || ev.id}」(${ev.id}) — 스위치 ${String(sw.switchId)} 가 켜지면 ${i + 1}쪽(쫓지 않는 빈 페이지)이 쫓는 ${chaseAt + 1}쪽을 덮고, 그 스위치를 다시 끄는 곳이 없다 → 한 번 뒤로 추격자가 영영 사라진다`);
    }
  }
  return out;
}

/** 같은 이름·같은 역할의 맵(「저택 2층」 둘, 「지하 예배당」과 「저택 지하 예배당」) — 이번 실행이 새로 만들거나 이름을 바꾼 맵이 낀 쌍만(G19). */
export function duplicateMaps(before: Project, after: Project): string[] {
  const norm = (s: string) => s.replace(/\s+/gu, "").replace(/\(.*?\)|（.*?）/gu, "");
  const maps = Object.values(after.maps).map((m) => ({ id: m.id, name: m.name ?? m.id, key: norm(m.name ?? ""), touched: !before.maps[m.id] || before.maps[m.id]!.name !== m.name }));
  const out: string[] = [];
  for (let i = 0; i < maps.length; i++) for (let j = i + 1; j < maps.length; j++) {
    const a = maps[i]!, b = maps[j]!;
    if (!a.touched && !b.touched) continue;
    if (/미사용|unused|백업|backup|사본|copy/iu.test(`${a.name}${b.name}`)) continue;
    const [short, long] = a.key.length <= b.key.length ? [a.key, b.key] : [b.key, a.key];
    if (short.length < 4 || !(long === short || long.endsWith(short))) continue;
    out.push(`「${a.name}」(${a.id}) 와 「${b.name}」(${b.id})`);
  }
  return out;
}

/** 날마다 달라지는 대사: 요청이 부른 사람마다 날짜 변수(호감 변수 말고) 값이 셋 이상 갈리는지(2026-10-25 G13: 서연은 7일 치, 지훈은 그대로). */
export function flatPerDayPeople(project: Project, task: string): string[] {
  if (!/날마다|매일|하루하루|하루마다|일차마다|날짜마다|요일마다|날이 바뀔 때마다|\d+\s*일차|each day|every day|per day/iu.test(task)) return [];
  const people = new Map<string, { values: Set<string>; ids: string[] }>();
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const pages = (ev.pages ?? []) as unknown as Obj[];
    if (!pages.some((pg) => { const g = obj(pg.graphic); return !!(g && (g.sprite || g.appearanceId)); })) continue;
    const base = String(ev.name ?? "").replace(/\s*[(（].*$/u, "").trim();
    if (base.length < 2 || base.length > 6 || !task.includes(base)) continue;
    const row = people.get(base) ?? { values: new Set<string>(), ids: [] };
    row.ids.push(ev.id);
    const note = (c: Obj) => {
      const id = String(c.variableId ?? (c.kind === "var" ? c.id : "") ?? "");
      if (!id || /affection|호감|love|like|heart/iu.test(id)) return;
      const name = project.variables.find((v) => v.id === id)?.name ?? "";
      if (/호감|affection/iu.test(name)) return;
      row.values.add(`${id}:${String(c.value)}`);
    };
    for (const pg of pages) {
      for (const c of flatConditions(pg.conditions)) note(c);
      walkCommands(pg.commands, (cmd) => { for (const c of flatConditions(cmd.condition)) note(c); });
    }
    people.set(base, row);
  }
  return [...people.entries()].filter(([, r]) => r.values.size < 3).map(([name, r]) => `${name}(${r.ids.slice(0, 3).join(",")}: 날짜로 갈리는 대사 ${r.values.size}가지)`);
}

/** 아무것도 열지 않는 단서: 쪽지·일기를 읽으면 켜지는 스위치를 그 이벤트 자신의 「이미 읽음」 페이지만 본다 — 퍼즐은 단서 없이 풀린다(G25 재현: 괘종시계). */
export function deadClues(project: Project, changedIds: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const all = [...eventsOf(project).values()];
  for (const ev of all) {
    if (!changedIds.has(ev.id) || ev.mapId === "common") continue;
    const sets = new Set(allCommands(ev).filter((r) => r.cmd.kind === "setSwitch" && r.cmd.value !== false && typeof r.cmd.switchId === "string").map((r) => String(r.cmd.switchId)));
    if (!sets.size || allCommands(ev).some((r) => ["changeItem", "changeGold", "transfer", "triggerEnding", "battleProcessing"].includes(String(r.cmd.kind)))) continue;
    for (const id of sets) {
      const readers = all.filter((other) => other.pages.some((pg) => flatConditions(pg.conditions).some((c) => c.switchId === id))
        || allCommands(other).some((r) => flatConditions(r.cmd.condition).some((c) => c.switchId === id)));
      if (readers.length && readers.every((r) => r.id === ev.id)) out.push(`「${ev.name}」(${ev.id}) 가 켜는 단서 스위치 ${id} 를 그 이벤트 자신의 「이미 읽음」 쪽만 본다`);
    }
  }
  return out;
}

const WEATHER_WORDS = /비가|비\s*(가\s*)?오|빗방울|빗줄기|소나기|폭우|장마|눈이\s*(오|내|와|쌓)|눈\s*내리|함박눈|폭풍|폭설|안개|날씨|천둥 ?(이|소리|번개)|rain|snow|storm|fog|weather/iu;
const SHAKE_WORDS = /흔들리|흔들린|흔들려|흔들어|지진|진동|쿵\s*(하|소리)|earthquake|tremor|shake/iu;
const FLASH_WORDS = /번쩍|섬광|번개(?!\s*(의\s*서|마법|기술|스킬|주문|책|의\s*검))(?!['’」』])|빛이\s*터|flash|lightning/iu;
const MUSIC_WORDS = /음악|배경음|브금|bgm|music/iu;
const HIDDEN_WORDS = /숨겨|숨은|몰래|보이지\s*않|투명|비밀|hidden|secret|invisible/iu;
const ENDING_WORDS = /엔딩|결말|ending/iu;
const STATE_WORDS = /독초|독에|독이|독을|독\s*상태|중독|맹독|마비|수면\s*상태|잠\s*상태|상태\s*이상|혼란|침묵|poison|paraly|stun/iu;

/** 맵 배경음·기본 전투곡·승리 팡파르·타이틀·오프닝 곡 연결이 바뀌었나(set_game_audio) — 그러면 음악 요청은 이벤트 명령 없이도 채워졌다. */
function audioBindingsChanged(before: Project, after: Project): boolean {
  const pick = (p: Project) => JSON.stringify([
    Object.entries(p.maps).map(([id, map]) => [id, map.bgm ?? null]),
    p.system.defaultBgmResourceId ?? null, p.system.battleBgmResourceId ?? null, p.system.battleVictoryMeResourceId ?? null,
    p.system.titleScreen?.musicResourceId ?? null, p.system.opening?.musicResourceId ?? null,
  ]);
  return pick(before) !== pick(after);
}

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
  if (MUSIC_WORDS.test(task) && !audioBindingsChanged(before, after) && !kinds.has("playAudio") && !kinds.has("stopAudio") && !m2Has(/bgm|audio|music/iu)) problems.push("[게임 검사 음악] 요청에 음악·BGM 이 있는데 어느 자리에도 곡을 걸지 않았다. 맵·전투·보스·승리·타이틀 곡은 set_game_audio 로 건다(맞는 곡이 프로젝트에 없으면 store_find_music → 묻지 말고 store_install 로 넣은 뒤). 장면 도중 잠깐 바뀌는 곡만 add_event 의 music 비트({do:'music',action:'bgm',query:'festival'}).");
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
  const unreadVar = [...setVar.entries()].filter(([id]) => !reads.variables.has(id));
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
    const chasers = vanishingChasers(after).filter((line) => [...changedIds].some((id) => line.includes(`(${id})`)));
    if (chasers.length) problems.push(`[게임 검사 위협] ${chasers.slice(0, 3).join(" / ")}. 숨기가 «이번 한 번» 지나가게 하는 것이면 그 스위치를 다시 끈다(예: 옷장에서 나온 뒤 기다렸다 setSwitch false, 또는 맵을 나갈 때), 영영 사라지는 것이 요청이면 보고에 적는다.`);
  }
  // 사슬 전체 검사(2026-10-25 판정 J11~J14): 잠긴 방이 벽 틈으로 열림·자물쇠가 답을 말함·자리 표시 글·파티에 없는 동료.
  {
    const changedIds = new Set(changed.map((ev) => ev.id));
    const bypass = lockBypasses(after, changedIds);
    if (bypass.length) problems.push(`[게임 검사 잠긴 방] ${bypass.slice(0, 3).join(" / ")}. seal_locked_room{mapId, eventId} 로 문 말고 다른 길(벽 틈)을 막거나, 퍼즐 전체를 author_puzzle_chain 으로 다시 묶는다.`);
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
  // 타이틀 그림 ↔ 시대(J38): 이번에 타이틀을 바꿨을 때만.
  if (JSON.stringify(before.system.titleScreen ?? null) !== JSON.stringify(after.system.titleScreen ?? null)) problems.push(...titleBackdropMismatch(after, task));
  // 주인공 모습 ↔ 장르(J43): 게임을 만드는 요청은 출하 검사(hero-look)가 이미 짚는다. 그 밖에는 이번에 장소(맵)를 새로 지은 실행만 —
  // 시작 위치 옮기기 같은 작은 고치기에서 시키지 않은 주인공 바꾸기를 시키지 않는다.
  if (!wantsWholeGame(task) && Object.keys(after.maps).some((id) => !before.maps[id])) problems.push(...pristineFantasyHero(after, task));
  problems.push(...placementContentProblems(before, after));
  return problems;
}

/** 값의 크기(배열 길이·객체의 빈 아닌 칸 수·빈 아닌 값 1). */
function fill(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.values(v as Obj).reduce<number>((n, x) => n + (fill(x) > 0 ? 1 : 0), 0);
  return v === undefined || v === null || v === "" || v === false ? 0 : 1;
}
const BATTLE_DATA: Record<"actors" | "classes", readonly string[]> = {
  actors: ["learnedSkills", "initialEquipment", "battleCommandIds", "classId"],
  classes: ["skillIds", "learnedSkills", "battleCommands", "equipmentPermissions"],
};
/** 배우·직업의 전투 데이터가 줄었다(요청이 메뉴·화면이 아니라 그 데이터를 지우라고 했을 때만 정상). */
export function battleDataEmptied(before: Project, after: Project, task: string): string[] {
  const deleteAsk = /(스킬|기술|장비|직업|전투\s*명령|skill|equip)[^.!?\n]{0,10}(지워|지우|없애|삭제|비워|빼앗|못\s*쓰게|배우지)/iu.test(task)
    && !/메뉴|탭|ESC|화면|창에서|창의|HUD|menu/iu.test(task);
  if (deleteAsk) return [];
  const out: string[] = [];
  for (const section of ["actors", "classes"] as const) {
    const old = new Map(((before.database as unknown as Obj)[section] as Obj[] | undefined ?? []).map((r) => [String(r.id), r]));
    for (const r of ((after.database as unknown as Obj)[section] as Obj[] | undefined) ?? []) {
      const prev = old.get(String(r.id));
      if (!prev) continue;
      const lost = BATTLE_DATA[section].filter((k) => fill(prev[k]) > 0 && fill(r[k]) < fill(prev[k]));
      if (!lost.length) continue;
      out.push(`[게임 검사 부작용] 기존 ${section === "actors" ? "배우" : "직업"} 「${String(r.name ?? r.id)}」의 전투 데이터(${lost.join(",")})를 비웠다 — 요청은 그 데이터를 지우라는 것이 아니다. 메뉴·화면에서 숨기는 것은 데이터 지우기가 아니다: 원래 값으로 되돌리고(${section === "actors" ? "upsert_actor" : "upsert_class"}), 메뉴 항목은 configure_field_menu{preset:'story'} 로, 체력 표시는 set_field_hud{off:true} 로 뺀다.`);
    }
  }
  return out;
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
      if (object.length) out.push(`[게임 검사 물건 자리] ${where}: ${object.join(" / ")} — 조사 이벤트는 이름이 말하는 물건 칸(키 큰 가구는 맨 아래 앞면 칸)에 둔다. move_event 로 그 칸으로 옮긴다.`);
    }
    if (rebuilt) {
      const off = offPurposeProps(after, map);
      if (off.length) out.push(`[게임 검사 방 쓰임] ${map.name ?? map.id}: ${off.slice(0, 3).map((r) => `${r.room}(${r.purpose}) 에 ${r.props.slice(0, 4).map((p) => `${p.label}(${p.at.x},${p.at.y})`).join("·")}`).join(" / ")} — 그 방의 쓰임에 안 맞는 다른 방 가구다(거실 한 벌). tile_erase 로 걷어 내고 그 쓰임의 가구(예배당: 장의자·촛대, 가게: 진열대·카운터, 교실: 책상·의자, 병원: 침상·진료 책상)를 stamp_object 로 그 가구 자리에 찍거나(쓰임에 안 맞는 가구는 찍을 때 저절로 걷힌다, 다른 가구와 겹치면 onOverlap:'replace'|'nearest') edit_place 로 그 방을 다시 꾸민다.`);
    }
  }
  return out;
}

/** 요청과 상관없이 바뀌면 안 되는 것 — 기존 NPC 의 그림·이름이 요청 없이 바뀌었는지(고치기 요청에서 흔한 부작용). */
export function unaskedChanges(before: Project, after: Project, task: string): string[] {
  const artAsk = /그림|외형|모습|얼굴|옷|칩|graphic|sprite|face/iu.test(task);
  const out: string[] = [];
  if (!artAsk) for (const map of Object.values(before.maps)) {
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
  // 요청 없이 지운 이야기 이벤트(2026-10-25 G31: 회상을 넣어 달라는 요청에 하나뿐인 오프닝 컷신 ev_v2cut_start 를 지우고 보고도 안 했다).
  // 장소를 다시 지으며 바뀐 것·자리표시·같은 이름으로 다시 만든 것은 빼고, 명령이 3개 이상인 이벤트만 센다.
  if (!/지워|지우|삭제|없애|빼\s*줘|빼고|치워|remove|delete/iu.test(task)) {
    const names = new Set(Object.values(after.maps).flatMap((m) => (m.events ?? []).map((e) => e.name || e.id)));
    const ids = new Set(Object.values(after.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
    for (const map of Object.values(before.maps)) {
      if (!after.maps[map.id]) continue;
      for (const ev of map.events ?? []) {
        if (ids.has(ev.id) || names.has(ev.name || ev.id) || /placeholder|자리표시/iu.test(`${ev.id} ${ev.name ?? ""}`)) continue;
        const size = (ev.pages ?? []).reduce((n, pg) => n + (pg.commands?.length ?? 0), 0);
        const auto = (ev.pages ?? []).some((pg) => ["auto", "parallel"].includes(String((pg.trigger as { kind?: string } | undefined)?.kind ?? "")));
        if (size < 3) continue;
        out.push(`[게임 검사 부작용] 요청에 없는데 기존 이벤트 「${ev.name || ev.id}」(${ev.id}${auto ? ", 자동 실행 컷신" : ""}, 명령 ${size}개)를 지웠다 — 그 장면·대사가 게임에서 사라진다. 요청과 상관없으면 같은 내용으로 되살리고, 일부러 대신했으면 보고에 무엇을 왜 지웠는지 적는다.`);
      }
    }
  }
  // 배우·직업의 전투 데이터(배울 기술·처음 장비·전투 명령·장비 허용)를 비웠다 — 「메뉴의 스킬·장비 빼 줘」를 데이터 지우기로 흉내 냈다
  // (2026-10-25 장난감 가게 고치기 4턴: 메뉴 도구가 안 실려 upsert_actor·upsert_class 로 주인공 기술·직업을 비웠다. 요청에 「파티」「스킬」이 있어
  // 아래 일반 검사의 낱말 면제에 걸려 못 잡았다). 메뉴·화면에서 숨기는 요청이면 데이터는 그대로 둔다 — 낱말 면제 없이 본다.
  out.push(...battleDataEmptied(before, after, task));
  // 이미 있던 데이터(아이템·장비·적·기술·직업)를 요청이 그 이름을 말하지 않았는데 고쳤다 — 값·능력치가 게임 전체에서 바뀐다(2026-10-24 스위트).
  const bdb = before.database as unknown as Record<string, unknown>, adb = after.database as unknown as Record<string, unknown>;
  if (!artAsk) for (const section of ["items", "weapons", "armors", "enemies", "skills", "classes", "actors"]) {
    const old = new Map(((bdb[section] as Obj[] | undefined) ?? []).map((r) => [String(r.id), r]));
    for (const r of (adb[section] as Obj[] | undefined) ?? []) {
      const prev = old.get(String(r.id));
      if (!prev || JSON.stringify(prev) === JSON.stringify(r)) continue;
      const name = String(r.name ?? prev.name ?? "");
      if (name && task.includes(name)) continue;
      // 주인공·동료 요청은 배우 고치기가 정상이다.
      if (section === "actors" && /주인공|동료|파티|합류|이름|직업|레벨|능력치|hero|party/iu.test(task)) continue;
      if (section === "classes" && /직업|레벨|스킬|기술|배우|class|skill|level/iu.test(task)) continue;
      // 요청이 그 종류를 가리키면(이름을 안 불러도) 고치기가 정상이다 — 「보스는 얼음에 약하게」·「난이도를 맞춰」에서 보스 적을 고친 것을
      // 부작용이라 해서 조수가 되돌렸고, 힌트 NPC 가 거짓말을 하게 됐다(2026-10-25 조수 단독 게임 G6).
      if (section === "enemies" && /보스|적|몬스터|약점|약하|약해|내성|강하게|속성|난이도|어렵|쉽|밸런스|이기|체력|공격력|boss|enemy|weak/iu.test(task)) continue;
      if (section === "skills" && /기술|스킬|마법|위력|MP|마나|공격|회복|skill|spell/iu.test(task)) continue;
      if ((section === "items" || section === "weapons" || section === "armors") && /가격|값|상점|가게|아이템|장비|무기|방어구|갑옷|회복약|포션|price|item|weapon|armor/iu.test(task)) continue;
      const keys = Object.keys({ ...prev, ...r }).filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(r[k]));
      // 장르 기본값(genreDefaults.ts): 판타지 기본 주인공 칩을 현대 칩으로 바꾼 것은 요청한 무대에 맞춘 것이다.
      if (section === "actors" && keys.every((k) => ["characterResourceId", "characterIndex", "faceResourceId", "name", "nickname"].includes(k))
        && (prev.characterResourceId === undefined || prev.characterResourceId === "easyrpg-charset-actor1") && /^oprn-charset-modern/u.test(String(r.characterResourceId ?? ""))) continue;
      out.push(`[게임 검사 부작용] 요청에 없는 기존 ${section} 「${name || String(r.id)}」 를 바꿨다(${keys.slice(0, 4).join(",")}) — 게임 전체 값이 바뀐다. 요청과 상관없는 변경이면 되돌리고, 요청을 이루려고 바꾼 것이면 그대로 두고 보고에 무엇을 왜 바꿨는지 적는다(요청을 이룬 변경을 되돌리지 않는다).`);
    }
  }
  return out.slice(0, 6);
}

export type { Command };
