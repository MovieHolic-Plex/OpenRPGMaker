// 목표 표시가 가리키는 칸이 실제로 반응하는가(끝맺음 lanes, 맵마다).
//
// 왜(2026-10-30 씬 벤치 sc-1030a terra ending r1~r3): 판정자가 「현재 목표 — 동굴의 흔적」을 따라 화살표 쪽 칸에서 Enter 를 눌렀는데
// 아무 일도 없었다고 적었다(blocker). 재구성해 보니 그 판의 「동굴의 흔적」(마왕의 동굴 (10,6), 해골 무더기 위 투명 조사 칸)은 (10,7)에서
// 마주 보고 누르면 「동굴의 흔적을 살펴보았다.」가 나왔다 — 판정자는 화살표 곁 모닥불 칸을 대상으로 읽었다. 그 판은 고장이 아니었지만,
// 목표 표시(빛무리·화살표, player/objectiveTarget.objectiveTargetViews)가 가리키는 대상이 실제로는 아무 데서도 못 누르거나 눌러도
// 아무 일이 없는 경우는 같은 증상(「표시를 따라갔는데 반응이 없다」)이 된다. 그래서 기계로 잰다.
// 규칙: 프로젝트의 목표 글(objectiveChip)마다 이 맵에서 표시가 가리킬 대상 이벤트를 런타임과 같은 함수로 고르고,
//   1) 걸어 닿는 칸(그 칸 또는 마주 볼 이웃 칸)이 없으면 repairEventReach 로 닿는 자리로 옮긴다(이름이 가리키는 물건 칸·가까운 빈 바닥).
//   2) 조작으로 부르는 페이지(조사·접촉)에 명령이 하나도 없으면 「눌러도 아무 일 없음」으로 적는다(고치지 않는다 — 무슨 일을 할지는 조수 몫).
// 옮기지 못한 것도 적는다. 새 그림은 없다.
import type { GameEvent, Project } from "@/project/types";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import { objectiveTargetViews } from "@/player/objectiveTarget";
import { isObjectiveCommand } from "./discoverability";
import { repairEventReach, unreachableEvents } from "./eventReach";
import type { BuildRun } from "./types";

type Obj = Record<string, unknown>;

/** 프로젝트의 목표 글 전부(같은 글은 한 번). */
export function objectiveMessages(project: Project): string[] {
  const out = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (!node || typeof node !== "object") return;
    const r = node as Obj;
    if (r.kind === "m2Command" && isObjectiveCommand(r as never)) out.add(String((r.fields as Obj).message).trim());
    for (const v of Object.values(r)) if (v && typeof v === "object") visit(v);
  };
  for (const map of Object.values(project.maps)) visit(map.events ?? []);
  visit((project as { commonEvents?: unknown }).commonEvents ?? []);
  return [...out];
}

/** 세션 없이 만든 이벤트 보기 — 페이지마다 하나(어느 페이지가 켜질지 모르므로 다 본다). */
function staticViews(map: Project["maps"][string]): RuntimeEventView[] {
  const out: RuntimeEventView[] = [];
  for (const event of map.events ?? []) for (const page of event.pages ?? []) {
    const trigger = (page.trigger ?? (event as { trigger?: unknown }).trigger ?? { kind: "action" }) as RuntimeEventView["trigger"];
    out.push({ event, page, pageId: page.id, x: event.x, y: event.y, trigger, priority: (page.priority ?? "same") as RuntimeEventView["priority"], overlapForbidden: !!page.overlapForbidden, footprint: { width: 1, height: 1 }, passRows: 1 } as unknown as RuntimeEventView);
  }
  return out;
}

const pressable = (event: GameEvent): boolean => (event.pages ?? []).some((p) => {
  const kind = ((p.trigger ?? (event as { trigger?: unknown }).trigger) as { kind?: string } | undefined)?.kind ?? "action";
  return (kind === "action" || kind === "playerTouch" || kind === "eventTouch") && (p.commands ?? []).length > 0;
});

/** 이 맵에서 목표 표시가 가리키는 대상 — 닿지 않으면 옮기고, 눌러도 아무 일 없으면 적는다. 한 일 글. */
export function checkObjectiveTargets(run: BuildRun, mapId: string): string[] {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map) return [];
  const views = staticViews(map);
  const targets = new Map<string, { event: GameEvent; objective: string }>();
  for (const message of objectiveMessages(project)) {
    for (const view of objectiveTargetViews(project, map, views, message)) if (!targets.has(view.event.id)) targets.set(view.event.id, { event: view.event, objective: message });
  }
  if (!targets.size) return [];
  const notes: string[] = [];
  const lost = unreachableEvents(project, mapId, [...targets.keys()]);
  if (lost.length) {
    const fixed = repairEventReach(run, mapId, lost);
    for (const m of fixed.moved) notes.push(`목표 대상이 닿지 않아 옮김: ${m}`);
    const still = unreachableEvents(run.ctx.project, mapId, lost);
    for (const id of still) { const t = targets.get(id)!; notes.push(`목표 「${t.objective.slice(0, 40)}」 대상 「${t.event.name ?? id}」(${t.event.x},${t.event.y}) — 걸어 닿는 칸이 없다(못 옮김)`); }
  }
  for (const [id, t] of targets) {
    if (pressable(t.event)) continue;
    notes.push(`목표 「${t.objective.slice(0, 40)}」 대상 「${t.event.name ?? id}」(${t.event.x},${t.event.y}) — 조사·접촉해도 아무 명령이 없다`);
  }
  return notes;
}

/** 출하 전 보기용: 맵마다 목표 대상이 닿는지·누르면 무엇이 일어나는지(바꾸지 않는다). */
export function objectiveTargetGaps(project: Project): { mapId: string; eventId: string; name: string; x: number; y: number; why: "unreachable" | "inert" }[] {
  const out: { mapId: string; eventId: string; name: string; x: number; y: number; why: "unreachable" | "inert" }[] = [];
  const messages = objectiveMessages(project);
  for (const map of Object.values(project.maps)) {
    const views = staticViews(map);
    const ids = new Map<string, GameEvent>();
    for (const message of messages) for (const v of objectiveTargetViews(project, map, views, message)) ids.set(v.event.id, v.event);
    if (!ids.size) continue;
    const lost = new Set(unreachableEvents(project, map.id, [...ids.keys()]));
    for (const [id, ev] of ids) {
      if (lost.has(id)) out.push({ mapId: map.id, eventId: id, name: String(ev.name ?? id), x: ev.x, y: ev.y, why: "unreachable" });
      else if (!pressable(ev)) out.push({ mapId: map.id, eventId: id, name: String(ev.name ?? id), x: ev.x, y: ev.y, why: "inert" });
    }
  }
  return out;
}
