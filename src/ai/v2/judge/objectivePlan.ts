// set_objective 의 계획 — 시작 목표와 이정표 목표를 어느 이벤트 어느 자리에 걸지 정한다(planObjective). 늦은·되풀이 시작 목표 찾기도 여기.
import { childLists, type RawCommand } from "@/qa/gameCheck/walk";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { OBJECTIVE_SURFACE, objectiveCommand, isObjectiveCommand } from "./objectiveCommand";
import { Cell, bare, whereHint, withWhere } from "./objectiveWhere";
import { rawChild, insertAfterMilestones } from "./objectiveRoutes";

interface ObjectivePlan {
  readonly ok: boolean;
  readonly summary: string;
  /** upsert_event 로 쓸 이벤트들(맵별). */
  readonly events: { readonly mapId: string; readonly event: Record<string, unknown> }[];
}

/**
 * 시작 목표가 뒤 단계의 일을 이미 일어난 것처럼 말하나 — 「투숙객이 자백했다. 여관 주인에게 보고하자」(2026-10-29 vm3 argon 추리:
 * 모델이 마지막에 set_objective 를 시작 자리로 불러 첫 단계 「여관 주인과 대화」 대신 마지막 단계 문구가 처음부터 떴고, 주인은 「아직 범인을
 * 찾지 못했다」고 했다). 끝난 일 말투(…했다.)이면서 첫 단계에는 없는 뒤 단계 gives 낱말(자백)을 담으면 늦은 목표다.
 */
export function lateStartObjective(project: Project): { readonly message: string; readonly first: string } | undefined {
  const steps = project.gameBlueprint?.steps ?? [];
  if (steps.length < 2) return undefined;
  const map = project.maps[project.startMapId];
  let message = "";
  for (const event of map?.events ?? []) for (const page of event.pages ?? []) {
    if (message || !["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) || !runsOnce(event, page)) continue;
    const found = (page.commands as RawCommand[] ?? []).find((command) => isObjectiveCommand(command));
    message = found ? String(((found as { fields?: { message?: unknown } }).fields?.message) ?? "").trim() : "";
  }
  if (!message || !/[가-힣](?:했|었|았|였|혔|졌|냈)다[.!]/u.test(message)) return undefined;
  const stem = (w: string) => w.replace(/(?:에게서|에게|에서|으로|이|가|을|를|의|은|는|와|과|로|에|도)$/u, "");
  const words = (s: string) => s.split(/[\s:·,.「」『』()]+/u).map(stem).filter((w) => w.length >= 2);
  const first = steps[0]!;
  const firstText = `${first.event} ${first.action} ${first.gives ?? ""}`;
  const late = steps.slice(1).some((step) => !/^엔딩$|ending/iu.test(step.gives ?? "") && words(step.gives ?? "").some((w) => message.includes(w) && !firstText.includes(w)));
  if (!late) return undefined;
  return { message, first: first.action.trim().replace(/[.。!]+$/u, "").slice(0, 60) };
}

/** 시작 맵에서 맵에 들어올 때마다 다시 도는 자동·병렬 페이지(runsOnce 아님)에 걸린 「현재 목표」 — 그 글. 불러오기·다시 들어오기마다 목표를 처음으로 되돌린다. */
export function repeatingStartObjectives(project: Project): { readonly eventId: string; readonly message: string }[] {
  const map = project.maps[project.startMapId];
  const out: { eventId: string; message: string }[] = [];
  for (const event of map?.events ?? []) for (const page of event.pages ?? []) {
    if (!["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) || runsOnce(event, page)) continue;
    const found = (page.commands as RawCommand[] ?? []).find((command) => isObjectiveCommand(command));
    const message = found ? String(((found as { fields?: { message?: unknown } }).fields?.message) ?? "").trim() : "";
    if (message) out.push({ eventId: event.id, message });
  }
  return out;
}

/**
 * 자동·병렬 페이지가 한 번만 도나 — 자기 지우기, 또는 켜는 자기 스위치·스위치가 같은 이벤트의 다른 페이지 조건이거나 이 페이지의 «꺼져 있어야» 조건이다.
 * 아니면 맵에 들어올 때마다(불러오기 포함) 다시 돈다(장면 분위기 페이지).
 */
export function runsOnce(event: GameEvent, page: { readonly commands?: unknown; readonly conditions?: unknown }): boolean {
  const self = new Set<string>();
  const sw = new Set<string>();
  let erases = false;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== "object") return;
    const c = node as Record<string, unknown>;
    if (c.kind === "eraseEvent") erases = true;
    if (c.kind === "setSelfSwitch" && c.value !== false && typeof c.key === "string") self.add(c.key);
    if (c.kind === "setSwitch" && c.value === true && typeof c.switchId === "string") sw.add(c.switchId);
    for (const v of Object.values(c)) if (v && typeof v === "object") visit(v);
  };
  visit(page.commands);
  if (erases) return true;
  type Cond = { kind?: string; key?: string; switchId?: string; value?: unknown };
  const conds = (p: { conditions?: unknown }) => (Array.isArray(p.conditions) ? p.conditions : []) as Cond[];
  const hits = (c: Cond) => (c.kind === "selfSwitch" && typeof c.key === "string" && self.has(c.key)) || (c.kind === "switch" && typeof c.switchId === "string" && sw.has(c.switchId));
  if (conds(page).some((c) => c.value === false && hits(c))) return true;
  return (event.pages ?? []).some((other) => other !== page && conds(other).some((c) => c.value !== false && hits(c)));
}

/**
 * 「현재 목표」 줄을 건다. at:'start' = 시작 맵의 자동 실행(오프닝 뒤 첫 컷신) 끝에, 없으면 새 자동 실행 이벤트로.
 * eventId = 그 이벤트의 이정표(스위치 켜기·아이템 얻기) 바로 뒤에 — 이정표가 없으면 그 이벤트 첫 페이지 끝에.
 */
export function planObjective(project: Project, input: { readonly text: string; readonly at?: string; readonly eventId?: string; readonly mapId?: string; readonly where?: string }): ObjectivePlan {
  const raw = input.text.trim().slice(0, 80);
  let text = raw;
  if (!text) return { ok: false, summary: "text 에 지금 할 일 한 줄을 준다(예: 「창고 상자에서 태엽 열쇠를 찾자」)", events: [] };
  // where 만 준 다음 목표(2026-10-28 mt3 argon escape): set_objective{text:'책장 주변에서 두 번째 단서를 찾자', where:'책상'} ·
  // {text:'…문을 열고 탈출하자', where:'책장'} — 모델은 where 를 «이 이벤트 뒤에»로 썼는데 eventId 가 없어 둘 다 시작 목표를 덮었고,
  // 게임 시작부터 마지막 목표(「문을 열고 탈출하자 (책장…)」)가 떠 첫 단서(책상)로 가는 안내가 사라졌다.
  // 시작 목표가 이미 있고, where 가 이정표(스위치 켜기·아이템 얻기)를 가진 이벤트인데 글이 그 이벤트를 가리키지 않으면
  // (글이 where 이벤트 이름을 담으면 그게 대상이다) where 이벤트 뒤의 다음 목표로 건다. 「어디」는 글에 나온 이벤트 이름에서 붙는다.
  if (input.at !== "start" && !input.eventId && !input.mapId && input.where) {
    const start = project.maps[project.startMapId];
    const hasStart = (start?.events ?? []).some((event) => (event.pages ?? []).some((page) => ["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) && JSON.stringify(page.commands ?? []).includes(OBJECTIVE_SURFACE)));
    const trigger = Object.values(project.maps).flatMap((map) => (map.events ?? []).filter((event) => event.id === input.where || event.name === input.where))[0];
    const milestone = trigger && JSON.stringify(trigger.pages ?? []).match(/"kind":"(setSwitch|changeItem)"/u);
    const fromMap = trigger ? Object.values(project.maps).find((map) => (map.events ?? []).includes(trigger)) : undefined;
    const namesTrigger = Boolean(trigger?.name) && bare(raw).includes(bare(String(trigger!.name)));
    if (hasStart && trigger && milestone && fromMap && !namesTrigger) {
      return planObjective(project, { text: raw, eventId: trigger.id, mapId: fromMap.id });
    }
  }
  if (input.at === "start" || (!input.eventId && !input.mapId)) {
    const map = project.maps[project.startMapId];
    if (!map) return { ok: false, summary: "시작 맵이 없다", events: [] };
    const startOrigin = (project.startPos ?? undefined) as Cell | undefined;
    // 시작 목표의 「어디」는 청사진 첫 단계 이벤트다(where 를 따로 주지 않았으면) — 글에 나온 먼 장소(「마왕의 동굴」)가 아니라
    // 지금 할 첫 일. 2026-10-29 vm2 flash jrpg: 시작 목표가 「(마왕의 동굴 입구: 남쪽)」 를 달아 첫 단계 「마을 시작」(시작 자리 3칸 위)을
    // 건너뛰게 했고, 열쇠 없이 동굴에 들어가면 막힌다.
    const firstStep = project.gameBlueprint?.steps[0];
    const firstStepEvent = firstStep ? Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === firstStep.event || e.name === firstStep.event))[0] : undefined;
    text = withWhere(project, map.id, raw, input.where ?? firstStepEvent?.id, startOrigin);
    if (text === raw && !input.where && firstStep) {
      const target = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === firstStep.event || e.name === firstStep.event).map((e) => ({ mapId: m.id, x: e.x, y: e.y, label: String(e.name ?? firstStep.event) })))[0];
      const hint = target ? whereHint(project, map.id, target, startOrigin) : undefined;
      if (hint && !raw.includes(hint)) text = `${raw} (${hint})`;
    }
    // 시작 맵 자동 실행에 이미 목표가 있으면 그 자리를 바꾼다(조건 달린 오프닝 페이지여도) — 새 이벤트를 하나 더 두면 두 목표가 겨룬다.
    // 단 맵에 들어올 때마다 다시 도는 페이지(장면 분위기 — 자기 스위치 없는 자동 실행)는 목표 자리가 아니다: 불러오기·다시 들어오기마다
    // 시작 목표로 되돌렸다(2026-10-29 vm2 deepseek 방탈출: 열쇠를 얻고 저장→불러오기 하자 「일지를 읽자」로 돌아감). 거기 있던 목표는 빼고 아래에서 다시 건다.
    const autoObjective = (page: { trigger?: unknown; commands?: unknown }) => ["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind)) && JSON.stringify(page.commands ?? []).includes(OBJECTIVE_SURFACE);
    const stripped: { mapId: string; event: Record<string, unknown> }[] = [];
    for (const event of map.events ?? []) {
      if (!(event.pages ?? []).some((page) => autoObjective(page) && !runsOnce(event, page))) continue;
      const copy = structuredClone(event) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      const strip = (list: RawCommand[]): RawCommand[] => list.filter((command) => !isObjectiveCommand(command)).map((command) => {
        for (const child of childLists(command)) { const rawList = rawChild(command, child.key); if (rawList) rawList.splice(0, rawList.length, ...strip(rawList)); }
        return command;
      });
      copy.pages.forEach((page, index) => { if (autoObjective(page) && !runsOnce(event, (event.pages ?? [])[index]!)) page.commands = strip((page.commands as RawCommand[]) ?? []); });
      stripped.push({ mapId: map.id, event: copy });
    }
    const owner = (map.events ?? []).find((event) => (event.pages ?? []).some((page) => autoObjective(page) && runsOnce(event, page)));
    if (owner) {
      const event = structuredClone(owner) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      let replaced = 0;
      const swap = (list: RawCommand[]): void => {
        list.forEach((command, index) => {
          if (isObjectiveCommand(command)) { list[index] = objectiveCommand(text); replaced += 1; return; }
          for (const child of childLists(command)) { const rawList = rawChild(command, child.key); if (rawList) swap(rawList); }
        });
      };
      for (const page of event.pages) if (["auto", "parallel"].includes(String((page.trigger as { kind?: string }).kind))) swap((page.commands as RawCommand[]) ?? []);
      if (replaced > 0) return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 의 ${owner.name ?? owner.id} 에 있던 시작 목표를 바꿨다`, events: [...stripped.filter((s) => s.event.id !== owner.id), { mapId: map.id, event }] };
    }
    const hostPage = (event: GameEvent) => (event.pages ?? []).findIndex((page) => (page.trigger as { kind?: string }).kind === "auto" && (page.conditions ?? []).length === 0 && runsOnce(event, page));
    const host = (map.events ?? []).find((event) => hostPage(event) >= 0);
    if (host) {
      const event = (stripped.find((s) => s.event.id === host.id)?.event ?? structuredClone(host)) as unknown as Record<string, unknown> & { pages: Record<string, unknown>[] };
      const page = event.pages[hostPage(host)]!;
      const commands = (page.commands as RawCommand[]) ?? [];
      const existing = commands.findIndex((c) => isObjectiveCommand(c));
      if (existing >= 0) commands[existing] = objectiveCommand(text);
      else {
        // 끝에서 자기 지우기·자기 스위치 앞에 넣는다(그 뒤 명령이 안 돌 수 있다).
        let at = commands.length;
        while (at > 0 && ["eraseEvent", "setSelfSwitch"].includes(String(commands[at - 1]?.kind))) at -= 1;
        commands.splice(at, 0, objectiveCommand(text));
      }
      page.commands = commands;
      return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 의 ${host.name ?? host.id} 시작 컷신 끝에 걸었다${stripped.length ? `(맵에 들어올 때마다 도는 ${stripped.map((s) => String(s.event.name ?? s.event.id)).join("·")} 에서 목표를 뺌)` : ""}`, events: [...stripped.filter((s) => s.event.id !== host.id), { mapId: map.id, event }] };
    }
    const taken = new Set((map.events ?? []).map((event) => `${event.x},${event.y}`));
    // 걷는 칸에 둔다(upsert_event 가 막힌 칸을 거절한다 — mt3 argon 방에서 (0,0) 벽에 놓으려다 시작 목표가 통째로 빠졌다). 시작점에서 가까운 칸 먼저.
    let cell = { x: 0, y: 0 };
    let best = Infinity;
    const sp = (project.startPos ?? { x: 0, y: 0 }) as { x: number; y: number };
    for (let i = 0; i < map.width * map.height; i += 1) {
      const c = { x: i % map.width, y: Math.floor(i / map.width) };
      if (taken.has(`${c.x},${c.y}`) || !isPassable(project, map, c.x, c.y)) continue;
      const d = Math.abs(c.x - sp.x) + Math.abs(c.y - sp.y);
      if (d < best) { best = d; cell = c; }
    }
    const event = {
      id: "ev_objective_start", name: "시작 목표", x: cell.x, y: cell.y,
      pages: [
        { id: "ev_objective_start_p0", name: "목표 걸기", trigger: { kind: "auto" }, priority: "below", graphic: { transparent: true }, conditions: [], commands: [objectiveCommand(text), { kind: "setSelfSwitch", key: "A", value: true }], movement: { type: "fixed", speed: 3, frequency: 3 } },
        { id: "ev_objective_start_p1", name: "끝", trigger: { kind: "action" }, priority: "below", graphic: { transparent: true }, conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [], movement: { type: "fixed", speed: 3, frequency: 3 } },
      ],
      // upsert_event 를 거치지 않고 바로 맵에 넣는 쪽(출하 기본값)도 저장 모양이 맞게 — 이벤트 수준 trigger·commands 가 없으면 불러오기 검사가 거절했다.
      trigger: { kind: "action" }, commands: [],
    };
    return { ok: true, summary: `시작 목표 「${text}」 — ${map.name ?? map.id} 에 시작 목표 이벤트를 새로 놓았다(${cell.x},${cell.y})${stripped.length ? `(맵에 들어올 때마다 도는 ${stripped.map((s) => String(s.event.name ?? s.event.id)).join("·")} 에서 목표를 뺌)` : ""}`, events: [...stripped, { mapId: map.id, event }] };
  }
  const maps = input.mapId ? [project.maps[input.mapId]].filter(Boolean) as GameMap[] : Object.values(project.maps);
  for (const map of maps) {
    const found = (map.events ?? []).find((event) => event.id === input.eventId || event.name === input.eventId);
    if (!found) continue;
    const eventOrigin = { x: found.x, y: found.y };
    text = withWhere(project, map.id, raw, input.where, eventOrigin);
    // 「어디」가 안 붙었고 이 이벤트가 청사진 단계면 다음 단계 이벤트 자리를 붙인다(「…문을 열고 탈출하자」 → 「(잠긴 문)」).
    const steps = project.gameBlueprint?.steps ?? [];
    const k = steps.findIndex((step) => step.event === found.id || step.event === found.name);
    const nextStep = k >= 0 ? steps[k + 1] : undefined;
    if (text === raw && !input.where && nextStep) {
      const target = Object.values(project.maps).flatMap((m) => (m.events ?? []).filter((e) => e.id === nextStep.event || e.name === nextStep.event).map((e) => ({ mapId: m.id, x: e.x, y: e.y, label: String(e.name ?? nextStep.event) })))[0];
      const hint = target ? whereHint(project, map.id, target, eventOrigin) : undefined;
      if (hint && !raw.includes(hint)) text = `${raw} (${hint})`;
    }
    const event = structuredClone(found) as unknown as Record<string, unknown> & { pages?: Record<string, unknown>[]; commands?: RawCommand[] };
    let placed = 0;
    const lists: RawCommand[][] = event.pages?.length ? event.pages.map((page) => (page.commands as RawCommand[]) ?? []) : [event.commands ?? []];
    for (const list of lists) placed += insertAfterMilestones(list, text);
    if (!placed) {
      const first = lists[0];
      if (!first) return { ok: false, summary: `${found.name ?? found.id} 에 명령 목록이 없다`, events: [] };
      first.push(objectiveCommand(text));
      placed = 1;
    }
    return { ok: true, summary: `다음 목표 「${text}」 — ${found.name ?? found.id}(${map.name ?? map.id}) 의 이정표 ${placed}곳 뒤에 걸었다`, events: [{ mapId: map.id, event }] };
  }
  return { ok: false, summary: `이벤트 ${input.eventId} 를 찾지 못했다`, events: [] };
}
