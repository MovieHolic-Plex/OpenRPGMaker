// 이야기 흐름 결함 찾기 — 끊긴 연결(켜는 곳 없는 조건), 바로 끝나는 엔딩, 건너뛸 수 있는·죽은 단서, 느린·사라지는 추격자, 복사한 맵, 날마다 같은 사람.
import type { Project } from "@/project/types";
import { chaseCellMs } from "@/project/chaseTempo";
import { PLAYER_WALK_STEP_MS } from "@/project/characterMotion";
import { fieldApproachRecipe } from "@/project/fieldApproachStyle";
import { Obj, obj, eventsOf, walkCommands, allCommands, flatConditions, readsOf, settersOf } from "./gameCheckReads";

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

/**
 * 걸어 도망치는 주인공을 못 따라오는 추격자(J77, 2026-10-26 저택 argon-high: patch_event_page 가 frequency 5 를 넣어
 * 한 칸 160ms 걸음 + 240ms 쉼 = 400ms — 주인공 걷기 160ms/칸의 40% 속도). 한 칸 걸음이 주인공 걸음보다 느리거나,
 * 걸음 사이 쉼이 최소(80ms, frequency 8)보다 길면 잡을 수 없다. 다가오는 방식(approachStyle)을 고른 추격자는 일부러 고른 걸음새라 보지 않는다.
 * 전투로 이어지는 필드 적(battleProcessing)은 보지 않는다 — 잡히면 끝나는 위협만.
 */
export function slowChasers(project: Project, changedIds?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  // 공통 이벤트를 거쳐 전투로 가는 추격자(필드 적)도 뺀다.
  const battleCommons = new Set(((project.commonEvents ?? []) as unknown as Obj[]).filter((ce) => JSON.stringify(ce.commands ?? []).includes("battleProcessing")).map((ce) => String(ce.id)));
  const startsBattle = (commands: unknown): boolean => {
    const text = JSON.stringify(commands ?? []);
    if (text.includes("battleProcessing")) return true;
    return [...battleCommons].some((id) => text.includes(`"${id}"`));
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (changedIds && !changedIds.has(ev.id)) continue;
    for (const page of (ev.pages ?? []) as unknown as Obj[]) {
      const mv = obj(page.movement);
      if (mv?.type !== "chase" || startsBattle(page.commands)) continue;
      // 다가오는 방식(approachStyle: 육중·둥실·통통…)은 일부러 고른 걸음새다 — 그 추격자는 이 검사로 보지 않는다.
      if (fieldApproachRecipe(mv.approachStyle)) continue;
      // 런타임 추격 박자(@/project/chaseTempo) 그대로 — 쫓는 동안은 칸 사이에 서지 않는다.
      const cellMs = chaseCellMs({ speed: Number(mv.speed ?? 3), frequency: Number(mv.frequency ?? 3),
        ...(typeof mv.moveIntervalMs === "number" ? { moveIntervalMs: mv.moveIntervalMs } : {}),
        ...(typeof mv.chaseStepMs === "number" ? { chaseStepMs: mv.chaseStepMs } : {}) });
      if (cellMs <= PLAYER_WALK_STEP_MS) continue;
      out.push(`「${ev.name || ev.id}」(${ev.id}) 추격자가 쫓는 동안 한 칸에 ${cellMs}ms(speed ${String(mv.speed ?? 3)}·frequency ${String(mv.frequency ?? 3)}${typeof mv.chaseStepMs === "number" ? `·chaseStepMs ${mv.chaseStepMs}` : ""}) — 주인공 걷기(${PLAYER_WALK_STEP_MS}ms/칸)보다 느려 걸어서 도망치면 잡히지 않는다`);
      break;
    }
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
